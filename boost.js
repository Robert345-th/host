const express = require('express');
const router = express.Router();
const pool = require('./db');
const requireAuth = require('./middleware');
const requireAdmin = require('./requireAdmin');
const { sendPushNotification } = require('./notifications');

async function ensureBoostSchema() {
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS free_featured_credits INTEGER DEFAULT 0');
  await pool.query('ALTER TABLE services ADD COLUMN IF NOT EXISTS boosted_until TIMESTAMPTZ');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS boost_requests (
      id SERIAL PRIMARY KEY,
      service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      transaction_ref TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

router.get('/payee', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT name, phone FROM users
       WHERE is_admin = true
         AND (is_deleted = false OR is_deleted IS NULL)
       ORDER BY id ASC
       LIMIT 1`
    );
    res.json({
      name: result.rows[0]?.name || 'Robert Zulu',
      phone: result.rows[0]?.phone || '0978012009',
      amount: 50,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load payment details.' });
  }
});

router.get('/my-credits', requireAuth, async (req, res) => {
  try {
    await ensureBoostSchema();
    const result = await pool.query(
      'SELECT COALESCE(free_featured_credits, 0)::int AS credits FROM users WHERE id = $1',
      [req.userId]
    );
    res.json({ free_featured_credits: result.rows[0]?.credits || 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load your boost credits.' });
  }
});

router.post('/:serviceId', requireAuth, async (req, res) => {
  const { transaction_ref, use_credit } = req.body;
  try {
    await ensureBoostSchema();
    const check = await pool.query(
      'SELECT vendor_id, title FROM services WHERE id = $1',
      [req.params.serviceId]
    );
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Service not found.' });
    }
    if (Number(check.rows[0].vendor_id) !== Number(req.userId)) {
      return res.status(403).json({ error: 'You can only boost your own services.' });
    }

    if (use_credit) {
      const creditCheck = await pool.query(
        'SELECT COALESCE(free_featured_credits, 0)::int AS credits FROM users WHERE id = $1',
        [req.userId]
      );
      const credits = creditCheck.rows[0]?.credits || 0;
      if (credits <= 0) {
        return res.status(400).json({ error: "You don't have any free Boost credits." });
      }
      await pool.query(
        'UPDATE users SET free_featured_credits = GREATEST(COALESCE(free_featured_credits, 0) - 1, 0) WHERE id = $1',
        [req.userId]
      );
      const boostedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await pool.query('UPDATE services SET boosted_until = $1 WHERE id = $2', [
        boostedUntil,
        req.params.serviceId,
      ]);
      return res.status(201).json({ success: true, usedCredit: true, boosted_until: boostedUntil });
    }

    const ref = String(transaction_ref || '').trim();
    if (ref.length < 6) {
      return res.status(400).json({
        error: 'Paste the Airtel or MTN confirmation SMS (or the transaction ID) after you send K50.',
      });
    }

    const existing = await pool.query(
      `SELECT 1 FROM boost_requests WHERE service_id = $1 AND status = 'pending'`,
      [req.params.serviceId]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'This service already has a pending boost request.' });
    }

    const result = await pool.query(
      `INSERT INTO boost_requests (service_id, user_id, transaction_ref)
       VALUES ($1, $2, $3) RETURNING *`,
      [req.params.serviceId, req.userId, ref]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not submit boost request.' });
  }
});

router.get('/pending', requireAuth, requireAdmin, async (req, res) => {
  try {
    await ensureBoostSchema();
    const result = await pool.query(
      `SELECT br.id, br.transaction_ref, br.requested_at, s.id AS service_id, s.title,
              u.name AS user_name, u.phone AS user_phone, u.business_name
       FROM boost_requests br
       JOIN services s ON br.service_id = s.id
       JOIN users u ON br.user_id = u.id
       WHERE br.status = 'pending'
       ORDER BY br.requested_at ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load boost requests.' });
  }
});

router.put('/:id/approve', requireAuth, requireAdmin, async (req, res) => {
  try {
    await ensureBoostSchema();
    const boostResult = await pool.query(
      `UPDATE boost_requests SET status = 'approved' WHERE id = $1 AND status = 'pending' RETURNING *`,
      [req.params.id]
    );
    if (boostResult.rows.length === 0) {
      return res.status(404).json({ error: 'Pending boost not found.' });
    }
    const boostedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await pool.query('UPDATE services SET boosted_until = $1 WHERE id = $2', [
      boostedUntil,
      boostResult.rows[0].service_id,
    ]);
    sendPushNotification(
      boostResult.rows[0].user_id,
      'Boost live',
      'Your service is featured on Home for 24 hours.'
    );
    res.json({ success: true, boosted_until: boostedUntil });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not approve boost.' });
  }
});

router.put('/:id/reject', requireAuth, requireAdmin, async (req, res) => {
  try {
    await ensureBoostSchema();
    const result = await pool.query(
      `UPDATE boost_requests SET status = 'rejected' WHERE id = $1 AND status = 'pending' RETURNING user_id`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pending boost not found.' });
    }
    sendPushNotification(result.rows[0].user_id, 'Boost declined', 'Your boost request was not approved.');
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not reject boost.' });
  }
});

module.exports = router;
