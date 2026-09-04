const express = require('express');
const router = express.Router();
const pool = require('./db');
const requireAuth = require('./middleware');
const { sendPushNotification } = require('./notifications');

// GET - top vendors by rating (must stay above /vendor/:id)
router.get('/leaderboard', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.name, u.business_name, u.business_photo_url, u.vendor_status,
              (u.is_vendor = true AND u.vendor_status = 'approved') AS is_verified,
              ROUND(AVG(r.rating), 1) AS average,
              COUNT(*)::int AS total
       FROM reviews r
       JOIN users u ON u.id = r.vendor_id
       WHERE (u.is_deleted = false OR u.is_deleted IS NULL)
         AND (u.is_suspended = false OR u.is_suspended IS NULL)
         AND u.is_vendor = true
       GROUP BY u.id, u.name, u.business_name, u.business_photo_url, u.vendor_status, u.is_vendor
       HAVING COUNT(*) >= 1
       ORDER BY AVG(r.rating) DESC, COUNT(*) DESC
       LIMIT 10`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load top vendors.' });
  }
});

// GET - all reviews for a specific vendor
router.get('/vendor/:vendorId', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.id, r.rating, r.comment, r.date_posted, u.name AS reviewer_name
       FROM reviews r
       JOIN users u ON r.reviewer_id = u.id
       WHERE r.vendor_id = $1
       ORDER BY r.date_posted DESC`,
      [req.params.vendorId]
    );

    const avgResult = await pool.query(
      `SELECT ROUND(AVG(rating), 1) AS average, COUNT(*) AS total FROM reviews WHERE vendor_id = $1`,
      [req.params.vendorId]
    );

    res.json({
      reviews: result.rows,
      average: avgResult.rows[0].average || 0,
      total: parseInt(avgResult.rows[0].total),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load reviews.' });
  }
});

// GET - full vendor public profile (name, business info, rating, trust badge)
router.get('/vendor/:vendorId/profile', async (req, res) => {
  try {
    const userResult = await pool.query(
      `SELECT id, name, business_name, business_bio, business_photo_url, date_joined,
              is_vendor, vendor_status
       FROM users WHERE id = $1`,
      [req.params.vendorId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Vendor not found.' });
    }

    const vendor = userResult.rows[0];
    const isVerified = vendor.is_vendor === true && vendor.vendor_status === 'approved';

    const avgResult = await pool.query(
      `SELECT ROUND(AVG(rating), 1) AS average, COUNT(*) AS total FROM reviews WHERE vendor_id = $1`,
      [req.params.vendorId]
    );

    const activeServicesResult = await pool.query(
      `SELECT COUNT(*) FROM services WHERE vendor_id = $1 AND status = 'active'`,
      [req.params.vendorId]
    );

    const total = parseInt(avgResult.rows[0].total);
    let badge = null;
    if (total >= 25) {
      badge = { emoji: '🏆', label: 'Elite Vendor' };
    } else if (total >= 10) {
      badge = { emoji: '🌟', label: 'Trusted Vendor' };
    }

    res.json({
      id: vendor.id,
      name: vendor.name,
      business_name: vendor.business_name,
      display_name: vendor.business_name || vendor.name,
      business_bio: vendor.business_bio,
      business_photo_url: vendor.business_photo_url,
      active_services: parseInt(activeServicesResult.rows[0].count),
      average_rating: avgResult.rows[0].average || 0,
      total_reviews: total,
      member_since: vendor.date_joined,
      badge,
      is_verified: isVerified,
      vendor_status: vendor.vendor_status,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load vendor profile.' });
  }
});

// POST - leave a review for a vendor
router.post('/vendor/:vendorId', requireAuth, async (req, res) => {
  const { rating, comment } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Rating must be between 1 and 5.' });
  }

  if (parseInt(req.params.vendorId) === req.userId) {
    return res.status(400).json({ error: 'You cannot review yourself.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO reviews (vendor_id, reviewer_id, rating, comment)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (vendor_id, reviewer_id) DO UPDATE SET rating = $3, comment = $4, date_posted = NOW()
       RETURNING *`,
      [req.params.vendorId, req.userId, rating, comment]
    );

    sendPushNotification(req.params.vendorId, 'New Review! ⭐', `You received a ${rating}-star review.`);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not submit review.' });
  }
});

module.exports = router;
