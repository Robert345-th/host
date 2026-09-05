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
          status TEXT NOT NULL DEFAULT 'pending',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `)
      .then(() => pool.query(`ALTER TABLE bookings ALTER COLUMN status SET DEFAULT 'pending'`))
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
       ORDER BY CASE
                  WHEN b.status = 'pending' THEN 0
                  WHEN b.status = 'booked' THEN 1
                  WHEN b.status = 'done' THEN 2
                  ELSE 3
                END,
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
      `SELECT id, status FROM bookings
       WHERE customer_id = $1 AND service_id = $2 AND status IN ('pending', 'booked')
       LIMIT 1`,
      [req.userId, serviceId]
    );
    if (existing.rows.length) {
      const already = existing.rows[0];
      const message = already.status === 'pending'
        ? 'You already asked to book this. Waiting for the shop to confirm.'
        : 'You already booked this.';
      return res.status(409).json({ error: message, booking_id: already.id, status: already.status });
    }

    const inserted = await pool.query(
      `INSERT INTO bookings (customer_id, vendor_id, service_id, event_date, notes, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
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
      'Booking request',
      `${customerName} wants to book ${service.rows[0].title}. Confirm it in Booked.`,
      { type: 'booking', bookingId: row.id, url: '/booked.html' }
    ).catch((err) => console.error('Booking push failed:', err.message));

    res.status(201).json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not send booking request.' });
  }
});

async function loadBooking(id) {
  const result = await pool.query('SELECT * FROM bookings WHERE id = $1', [id]);
  return result.rows[0] || null;
}

function isParty(row, userId) {
  return Number(row.customer_id) === Number(userId) || Number(row.vendor_id) === Number(userId);
}

router.put('/:id/confirm', requireAuth, async (req, res) => {
  try {
    await ensureBookingsTable();
    const row = await loadBooking(req.params.id);
    if (!row) return res.status(404).json({ error: 'Booking not found.' });
    if (Number(row.vendor_id) !== Number(req.userId)) {
      return res.status(403).json({ error: 'Only the shop can confirm this booking.' });
    }
    if (row.status !== 'pending') {
      return res.status(400).json({ error: 'This booking is not waiting for confirmation.' });
    }
    await pool.query(`UPDATE bookings SET status = 'booked' WHERE id = $1`, [req.params.id]);
    const title = (await pool.query('SELECT title FROM services WHERE id = $1', [row.service_id])).rows[0]?.title || 'your booking';
    sendPushNotification(
      row.customer_id,
      'Booking confirmed',
      `The shop confirmed ${title}.`,
      { type: 'booking', bookingId: row.id, url: '/booked.html' }
    ).catch((err) => console.error('Booking confirm push failed:', err.message));
    res.json({ success: true, status: 'booked' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not confirm booking.' });
  }
});

router.put('/:id/decline', requireAuth, async (req, res) => {
  try {
    await ensureBookingsTable();
    const row = await loadBooking(req.params.id);
    if (!row) return res.status(404).json({ error: 'Booking not found.' });
    if (Number(row.vendor_id) !== Number(req.userId)) {
      return res.status(403).json({ error: 'Only the shop can decline this booking.' });
    }
    if (row.status !== 'pending') {
      return res.status(400).json({ error: 'This booking is not waiting for confirmation.' });
    }
    await pool.query(`UPDATE bookings SET status = 'declined' WHERE id = $1`, [req.params.id]);
    const title = (await pool.query('SELECT title FROM services WHERE id = $1', [row.service_id])).rows[0]?.title || 'your booking';
    sendPushNotification(
      row.customer_id,
      'Booking declined',
      `The shop declined ${title}.`,
      { type: 'booking', bookingId: row.id, url: '/booked.html' }
    ).catch((err) => console.error('Booking decline push failed:', err.message));
    res.json({ success: true, status: 'declined' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not decline booking.' });
  }
});

router.put('/:id/done', requireAuth, async (req, res) => {
  try {
    await ensureBookingsTable();
    const row = await loadBooking(req.params.id);
    if (!row) return res.status(404).json({ error: 'Booking not found.' });
    if (!isParty(row, req.userId)) {
      return res.status(403).json({ error: 'This is not your booking.' });
    }
    if (row.status !== 'booked') {
      return res.status(400).json({ error: 'The shop must confirm this booking first.' });
    }
    await pool.query(`UPDATE bookings SET status = 'done' WHERE id = $1`, [req.params.id]);
    res.json({ success: true, status: 'done' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not update booking.' });
  }
});

router.put('/:id/cancel', requireAuth, async (req, res) => {
  try {
    await ensureBookingsTable();
    const row = await loadBooking(req.params.id);
    if (!row) return res.status(404).json({ error: 'Booking not found.' });
    if (!isParty(row, req.userId)) {
      return res.status(403).json({ error: 'This is not your booking.' });
    }
    if (row.status !== 'pending' && row.status !== 'booked') {
      return res.status(400).json({ error: 'This booking cannot be cancelled.' });
    }
    if (row.status === 'pending' && Number(row.vendor_id) === Number(req.userId)) {
      return res.status(400).json({ error: 'Decline the request instead of cancelling.' });
    }
    await pool.query(`UPDATE bookings SET status = 'cancelled' WHERE id = $1`, [req.params.id]);
    res.json({ success: true, status: 'cancelled' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not cancel booking.' });
  }
});

module.exports = router;
module.exports.ensureBookingsTable = ensureBookingsTable;
