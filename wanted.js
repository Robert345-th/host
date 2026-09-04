const express = require('express');
const router = express.Router();
const pool = require('./db');
const requireAuth = require('./middleware');
const { sendPushNotification } = require('./notifications');

let tableReady = null;

async function ensureWantedTable() {
  if (!tableReady) {
    tableReady = pool
      .query(`
        CREATE TABLE IF NOT EXISTS wanted_posts (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          description TEXT,
          category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
          budget NUMERIC,
          location_label TEXT,
          photos TEXT[] DEFAULT '{}',
          status TEXT NOT NULL DEFAULT 'open',
          date_posted TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `)
      .catch((err) => {
        tableReady = null;
        throw err;
      });
  }
  await tableReady;
}

function normalizePhotos(photos) {
  if (!Array.isArray(photos)) return [];
  return photos
    .filter((url) => typeof url === 'string' && url.startsWith('https://'))
    .slice(0, 3);
}

function parseBudget(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

async function notifyMatchingVendors(wantedPost, posterUserId) {
  const { id, title, category_id: categoryId, budget } = wantedPost;
  if (!title || !categoryId) return { notified: 0 };

  const vendorsResult = await pool.query(
    `
    SELECT DISTINCT s.vendor_id
    FROM services s
    JOIN users u ON s.vendor_id = u.id
    WHERE s.category_id = $1
      AND s.status = 'active'
      AND s.vendor_id <> $2
      AND (u.is_deleted = false OR u.is_deleted IS NULL)
      AND (u.is_suspended = false OR u.is_suspended IS NULL)
    LIMIT 80
    `,
    [categoryId, posterUserId]
  );

  const posterResult = await pool.query(
    `SELECT COALESCE(NULLIF(TRIM(business_name), ''), name) AS display_name
     FROM users WHERE id = $1`,
    [posterUserId]
  );
  const posterName = posterResult.rows[0]?.display_name || 'Someone';
  const budgetText = budget ? ` · Budget K${budget}` : '';
  const preview = `${title}${budgetText}`.slice(0, 120);

  let notified = 0;
  for (const row of vendorsResult.rows) {
    await sendPushNotification(
      row.vendor_id,
      'New wanted post',
      `${posterName} is looking for: ${preview}`,
      { type: 'wanted', wantedId: id, url: '/wanted.html' }
    );
    notified += 1;
  }
  return { notified };
}

router.get('/', async (req, res) => {
  try {
    await ensureWantedTable();
    const result = await pool.query(
      `SELECT w.id, w.title, w.description, w.budget, w.location_label, w.date_posted,
              w.user_id, w.photos, c.name AS category,
              COALESCE(NULLIF(TRIM(u.business_name), ''), u.name) AS poster_name
       FROM wanted_posts w
       LEFT JOIN categories c ON w.category_id = c.id
       JOIN users u ON w.user_id = u.id
       WHERE w.status = 'open'
         AND (u.is_deleted = false OR u.is_deleted IS NULL)
         AND (u.is_suspended = false OR u.is_suspended IS NULL)
       ORDER BY w.date_posted DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load wanted posts.' });
  }
});

router.get('/mine', requireAuth, async (req, res) => {
  try {
    await ensureWantedTable();
    const result = await pool.query(
      `SELECT w.id, w.title, w.description, w.budget, w.location_label, w.date_posted, w.status,
              w.photos, c.name AS category
       FROM wanted_posts w
       LEFT JOIN categories c ON w.category_id = c.id
       WHERE w.user_id = $1
       ORDER BY w.date_posted DESC`,
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load your wanted posts.' });
  }
});

router.post('/', requireAuth, async (req, res) => {
  const { title, description, category_id, budget, location_label, photos } = req.body;
  const photoUrls = normalizePhotos(photos);

  if (!title || !String(title).trim()) {
    return res.status(400).json({ error: 'Please describe what you are looking for.' });
  }

  try {
    await ensureWantedTable();
    const result = await pool.query(
      `INSERT INTO wanted_posts (user_id, title, description, category_id, budget, location_label, photos)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        req.userId,
        String(title).trim().slice(0, 160),
        description ? String(description).trim().slice(0, 800) : null,
        category_id || null,
        parseBudget(budget),
        location_label ? String(location_label).trim().slice(0, 120) : null,
        photoUrls,
      ]
    );

    const categoryResult = category_id
      ? await pool.query('SELECT name FROM categories WHERE id = $1', [category_id])
      : { rows: [] };

    const created = {
      ...result.rows[0],
      category: categoryResult.rows[0]?.name || null,
    };

    notifyMatchingVendors(created, req.userId).catch((err) => {
      console.error('Wanted vendor alerts failed:', err.message);
    });

    res.status(201).json(created);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not create wanted post.' });
  }
});

router.put('/:id/close', requireAuth, async (req, res) => {
  try {
    await ensureWantedTable();
    const check = await pool.query('SELECT user_id FROM wanted_posts WHERE id = $1', [req.params.id]);

    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found.' });
    }

    if (Number(check.rows[0].user_id) !== Number(req.userId)) {
      return res.status(403).json({ error: 'You can only close your own posts.' });
    }

    await pool.query(`UPDATE wanted_posts SET status = 'closed' WHERE id = $1`, [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not close post.' });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    await ensureWantedTable();
    const check = await pool.query('SELECT user_id FROM wanted_posts WHERE id = $1', [req.params.id]);

    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found.' });
    }

    if (Number(check.rows[0].user_id) !== Number(req.userId)) {
      return res.status(403).json({ error: 'You can only delete your own posts.' });
    }

    await pool.query('DELETE FROM wanted_posts WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not delete post.' });
  }
});

module.exports = router;
module.exports.ensureWantedTable = ensureWantedTable;
