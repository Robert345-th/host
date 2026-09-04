const express = require('express');
const router = express.Router();
const pool = require('./db');
const requireAuth = require('./middleware');
const { sendPushNotification } = require('./notifications');

const MAX_SEARCHES = 8;
let tableReady = null;

async function ensureSavedSearchesTable() {
  if (!tableReady) {
    tableReady = pool
      .query(`
        CREATE TABLE IF NOT EXISTS saved_searches (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          query TEXT,
          category TEXT,
          city TEXT,
          max_price NUMERIC,
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

function cleanText(value, max) {
  return String(value || '').trim().slice(0, max);
}

async function notifySavedSearches(service) {
  try {
    await ensureSavedSearchesTable();
    const rows = await pool.query(
      `SELECT DISTINCT user_id, query, category, city, max_price
       FROM saved_searches
       WHERE user_id <> $1
       LIMIT 400`,
      [service.vendor_id]
    );
    const title = String(service.title || '').toLowerCase();
    const desc = String(service.description || '').toLowerCase();
    const category = String(service.category || '');
    const city = String(service.location_label || '').toLowerCase();
    const price = Number(service.price);

    for (const row of rows.rows) {
      const q = String(row.query || '').toLowerCase();
      const cat = String(row.category || '');
      const rowCity = String(row.city || '').toLowerCase();
      if (q && !title.includes(q) && !desc.includes(q)) continue;
      if (cat && cat !== 'All' && category && cat !== category) continue;
      if (rowCity && city && !city.includes(rowCity)) continue;
      if (row.max_price && Number.isFinite(price) && price > Number(row.max_price)) continue;
      sendPushNotification(
        row.user_id,
        'New match',
        `${service.title || 'A new service'} matches a search you saved.`
      );
    }
  } catch (err) {
    console.error('notifySavedSearches failed:', err);
  }
}

router.get('/', requireAuth, async (req, res) => {
  try {
    await ensureSavedSearchesTable();
    const result = await pool.query(
      `SELECT id, query, category, city, max_price, created_at
       FROM saved_searches WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load saved searches.' });
  }
});

router.post('/', requireAuth, async (req, res) => {
  const query = cleanText(req.body.query, 80);
  const category = cleanText(req.body.category, 40) || 'All';
  const city = cleanText(req.body.city, 60);
  const maxPriceRaw = parseFloat(req.body.max_price);
  const maxPrice = Number.isFinite(maxPriceRaw) && maxPriceRaw > 0 ? maxPriceRaw : null;

  if (!query && (!category || category === 'All') && !city && !maxPrice) {
    return res.status(400).json({ error: 'Add a search, category, city, or max price first.' });
  }

  try {
    await ensureSavedSearchesTable();
    const count = await pool.query(
      'SELECT COUNT(*)::int AS n FROM saved_searches WHERE user_id = $1',
      [req.userId]
    );
    if ((count.rows[0]?.n || 0) >= MAX_SEARCHES) {
      return res.status(400).json({ error: 'You can save up to 8 searches. Delete one to add another.' });
    }

    const dup = await pool.query(
      `SELECT id FROM saved_searches
       WHERE user_id = $1
         AND COALESCE(query, '') = $2
         AND COALESCE(category, 'All') = $3
         AND COALESCE(city, '') = $4
         AND COALESCE(max_price, 0) = COALESCE($5, 0)
       LIMIT 1`,
      [req.userId, query, category, city, maxPrice]
    );
    if (dup.rows.length) {
      return res.json(dup.rows[0]);
    }

    const result = await pool.query(
      `INSERT INTO saved_searches (user_id, query, category, city, max_price)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, query, category, city, max_price, created_at`,
      [req.userId, query, category, city, maxPrice]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not save this search.' });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    await ensureSavedSearchesTable();
    await pool.query('DELETE FROM saved_searches WHERE id = $1 AND user_id = $2', [
      req.params.id,
      req.userId,
    ]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not delete saved search.' });
  }
});

module.exports = { router, notifySavedSearches, ensureSavedSearchesTable };
