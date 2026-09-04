const express = require('express');
const router = express.Router();
const pool = require('./db');
const requireAuth = require('./middleware');
const { ensureShopFollowsTable } = require('./follows');

async function ensureViewColumn() {
  await pool.query('ALTER TABLE services ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0');
  await pool.query('ALTER TABLE services ADD COLUMN IF NOT EXISTS boosted_until TIMESTAMPTZ');
}

router.get('/', requireAuth, async (req, res) => {
  try {
    await ensureViewColumn();
    await ensureShopFollowsTable();

    const [totalsResult, chatsResult, savesResult, followersResult, listingsResult] = await Promise.all([
      pool.query(
        `SELECT
           COALESCE(SUM(view_count), 0)::int AS views,
           COUNT(*) FILTER (WHERE status = 'active')::int AS active
         FROM services
         WHERE vendor_id = $1`,
        [req.userId]
      ),
      pool.query(
        `SELECT COUNT(DISTINCT sender_id)::int AS chats
         FROM messages
         WHERE receiver_id = $1`,
        [req.userId]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS saves
         FROM favorites f
         JOIN services s ON s.id = f.service_id
         WHERE s.vendor_id = $1`,
        [req.userId]
      ),
      pool.query(
        'SELECT COUNT(*)::int AS followers FROM shop_follows WHERE shop_id = $1',
        [req.userId]
      ),
      pool.query(
        `SELECT
           s.id, s.title, s.price, s.photos, s.status, s.view_count, s.boosted_until,
           (SELECT COUNT(*)::int FROM favorites f WHERE f.service_id = s.id) AS saves,
           (SELECT COUNT(DISTINCT m.sender_id)::int
            FROM messages m
            WHERE m.service_id = s.id
              AND m.sender_id <> s.vendor_id) AS chats
         FROM services s
         WHERE s.vendor_id = $1 AND s.status = 'active'
         ORDER BY s.date_posted DESC`,
        [req.userId]
      ),
    ]);

    const listings = listingsResult.rows.map((row) => ({
      ...row,
      view_count: row.view_count || 0,
      is_boosted: row.boosted_until && new Date(row.boosted_until) > new Date(),
    }));

    res.json({
      views: totalsResult.rows[0]?.views || 0,
      chats: chatsResult.rows[0]?.chats || 0,
      saves: savesResult.rows[0]?.saves || 0,
      followers: followersResult.rows[0]?.followers || 0,
      active: totalsResult.rows[0]?.active || 0,
      listings,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load shop insights.' });
  }
});

module.exports = router;
