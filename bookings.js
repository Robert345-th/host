const express = require('express');
const router = express.Router();
const pool = require('./db');
const requireAuth = require('./middleware');
const { sendPushNotification } = require('./notifications');

let tableReady = null;

async function ensureBookingsTable() {
  if (!tableReady) {
    tableReady = pool
      .query(`
        CREATE TABLE IF NOT EXISTS bookings (
          id SERIAL PRIMARY KEY,
          customer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          vendor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          service_id INTEGER REFERENCES services(id) ON DELETE SET NULL,
          event_date TEXT,
          notes TEXT,
          status TEXT NOT NULL DEFAULT 'booked',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `)
      .catch((err) => {
        tableReady = null;
        throw err;
      });
  }
  await tableReady;
}

function bookingSelect() {
  return `
    SELECT b.id, b.customer_id, b.vendor_id, b.service_id, b.event_date, b.notes, b.status, b.created_at,
           s.title AS service_title, s.photos AS service_photos, s.price AS service_price,
           COALESCE(NULLIF(TRIM(vendor.business_name), ''), vendor.name) AS vendor_name,
           COALESCE(NULLIF(TRIM(customer.business_name), ''), customer.name) AS customer_name
    FROM bookings b
    LEFT JOIN services s ON s.id = b.service_id
    JOIN users vendor ON vendor.id = b.vendor_id
    JOIN users customer ON customer.id = b.customer_id
  `;
}

router.get('/', requireAuth, async (req, res) => {
  try {
    await ensureBookingsTable();
    const result = await pool.query(
      `${bookingSelect()}
       WHERE b.customer_id = $1 OR b.vendor_id = $1
       ORDER BY CASE WHEN b.status = 'booked' THEN 0 WHEN b.status = 'done' THEN 1 ELSE 2 END,
                b.created_at DESC`,
      [req.userId]
    );
    res.json(
      result.rows.map((row) => ({
        ...row,
        role: Number(row.vendor_id) === Number(req.userId) ? 'vendor' : 'customer',
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load bookings.' });
  }
});

router.post('/', requireAuth, async (req, res) => {
  const serviceId = req.body.service_id;
  const eventDate = req.body.event_date ? String(req.body.event_date).trim().slice(0, 80) : null;
  const notes = req.body.notes ? String(req.body.notes).trim().slice(0, 400) : null;

  if (!serviceId) {
    return res.status(400).json({ error: 'Pick a service to book.' });
  }

  try {
    await ensureBookingsTable();
    const service = await pool.query(
      `SELECT s.id, s.title, s.vendor_id, s.status
       FROM services s
       JOIN users u ON u.id = s.vendor_id
       WHERE s.id = $1
         AND s.status = 'active'
         AND (u.is_deleted = false OR u.is_deleted IS NULL)
         AND (u.is_suspended = false OR u.is_suspended IS NULL)`,
      [serviceId]
    );

    if (!service.rows.length) {
      return res.status(404).json({ error: 'Service not found.' });
    }

    const vendorId = service.rows[0].vendor_id;
    if (Number(vendorId) === Number(req.userId)) {
      return res.status(400).json({ error: 'You cannot book your own service.' });
    }

    const existing = await pool.query(
      `SELECT id FROM bookings
       WHERE customer_id = $1 AND service_id = $2 AND status = 'booked'
       LIMIT 1`,
      [req.userId, serviceId]
    );
    if (existing.rows.length) {
      return res.status(409).json({ error: 'You already booked this.', booking_id: existing.rows[0].id });
    }

    const inserted = await pool.query(
      `INSERT INTO bookings (customer_id, vendor_id, service_id, event_date, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [req.userId, vendorId, serviceId, eventDate, notes]
    );

    const created = await pool.query(
      `${bookingSelect()} WHERE b.id = $1`,
      [inserted.rows[0].id]
    );
    const row = { ...created.rows[0], role: 'customer' };

    const customerName = row.customer_name || 'A customer';
    sendPushNotification(
      vendorId,
      'New booking',
      `${customerName} booked ${service.rows[0].title}`,
      { type: 'booking', bookingId: row.id, url: '/booked.html' }
    ).catch((err) => console.error('Booking push failed:', err.message));

    res.status(201).json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not create booking.' });
  }
});

async function updateStatus(req, res, status) {
  try {
    await ensureBookingsTable();
    const check = await pool.query(
      'SELECT customer_id, vendor_id FROM bookings WHERE id = $1',
      [req.params.id]
    );
    if (!check.rows.length) {
      return res.status(404).json({ error: 'Booking not found.' });
    }
    const row = check.rows[0];
    if (Number(row.customer_id) !== Number(req.userId) && Number(row.vendor_id) !== Number(req.userId)) {
      return res.status(403).json({ error: 'This is not your booking.' });
    }
    await pool.query('UPDATE bookings SET status = $1 WHERE id = $2', [status, req.params.id]);
    res.json({ success: true, status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not update booking.' });
  }
}

router.put('/:id/done', requireAuth, (req, res) => updateStatus(req, res, 'done'));
router.put('/:id/cancel', requireAuth, (req, res) => updateStatus(req, res, 'cancelled'));

module.exports = router;
module.exports.ensureBookingsTable = ensureBookingsTable;
