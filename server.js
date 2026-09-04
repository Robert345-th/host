require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const bcrypt = require('bcrypt');
const pool = require('./db');
const { sendPushNotification } = require('./notifications');

const app = express();
app.use(cors());
app.use(express.json());

const authRoutes = require('./auth');
app.use('/auth', authRoutes);

const servicesRoutes = require('./services');
app.use('/services', servicesRoutes);

const messagesRoutes = require('./messages');
app.use('/messages', messagesRoutes);

const adminRoutes = require('./admin');
app.use('/admin', adminRoutes);

const { router: notificationsRoutes } = require('./notifications');
app.use('/notifications', notificationsRoutes);

const userReportsRoutes = require('./user-reports');
app.use('/user-reports', userReportsRoutes);

const favoritesRoutes = require('./favorites');
app.use('/favorites', favoritesRoutes);

const reviewsRoutes = require('./reviews');
app.use('/reviews', reviewsRoutes);

app.get('/', (req, res) => {
  res.send('ZedEvents server is running.');
});

// Runs once a day — only notifies users who have favorited at least one service,
// telling them about new services in the categories they've shown interest in.
// Users with no favorites are skipped entirely (no generic/noise notifications).
async function sendDailyDigests() {
  try {
    const usersResult = await pool.query(
      `SELECT DISTINCT u.id
       FROM users u
       JOIN favorites f ON f.user_id = u.id
       WHERE u.digest_enabled = true
       AND u.push_token IS NOT NULL
       AND (u.is_deleted = false OR u.is_deleted IS NULL)
       AND (u.last_digest_sent IS NULL OR u.last_digest_sent < NOW() - INTERVAL '20 hours')`
    );

    let sentCount = 0;

    for (const user of usersResult.rows) {
      const categoriesResult = await pool.query(
        `SELECT DISTINCT c.name
         FROM favorites f
         JOIN services s ON f.service_id = s.id
         JOIN categories c ON s.category_id = c.id
         WHERE f.user_id = $1`,
        [user.id]
      );
      const favoriteCategories = categoriesResult.rows.map((r) => r.name);

      if (favoriteCategories.length === 0) {
        continue;
      }

      const countResult = await pool.query(
        `SELECT COUNT(*), c.name AS category
         FROM services s
         JOIN categories c ON s.category_id = c.id
         WHERE s.status = 'active'
         AND s.date_posted > NOW() - INTERVAL '1 day'
         AND c.name = ANY($1)
         GROUP BY c.name
         ORDER BY COUNT(*) DESC
         LIMIT 1`,
        [favoriteCategories]
      );

      if (countResult.rows.length > 0 && parseInt(countResult.rows[0].count) > 0) {
        const topCategory = countResult.rows[0];
        const message = `🔔 ${topCategory.count} new ${topCategory.category} service${topCategory.count === '1' ? '' : 's'} posted today — check them out!`;
        sendPushNotification(user.id, '📦 ZedEvents Digest', message);
        sentCount++;
        await pool.query(`UPDATE users SET last_digest_sent = NOW() WHERE id = $1`, [user.id]);
      }
    }

    if (sentCount > 0) {
      console.log(`Sent ${sentCount} daily digest(s).`);
    }
  } catch (err) {
    console.error('Daily digest job failed:', err);
  }
}

cron.schedule('0 18 * * *', sendDailyDigests);

async function ensureConfiguredAdmin() {
  const adminPhone = '0978012009';
  const adminPass = adminPhone;
  try {
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code TEXT');
  } catch (err) {
    console.error('Could not ensure email columns:', err);
  }
  try {
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code TEXT');
    const found = await pool.query(
      `SELECT id, phone FROM users
       WHERE regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g')
             IN ('0978012009', '978012009', '260978012009')
       ORDER BY CASE WHEN is_deleted IS TRUE THEN 1 ELSE 0 END, id
       LIMIT 1`
    );
    const passwordHash = await bcrypt.hash(adminPass, 10);
    if (found.rows.length > 0) {
      await pool.query(
        `UPDATE users
         SET is_admin = true,
             phone = $1,
             phone_verified = true,
             is_deleted = false,
             deleted_at = NULL,
             password_hash = $2
         WHERE id = $3`,
        [adminPhone, passwordHash, found.rows[0].id]
      );
      console.log(`Admin access ready for ${adminPhone}.`);
      return;
    }
    const referralCode = 'A' + Date.now().toString(36).slice(-6).toUpperCase();
    await pool.query(
      `INSERT INTO users (name, phone, password_hash, phone_verified, is_admin, referral_code)
       VALUES ($1, $2, $3, true, true, $4)`,
      ['Robert zulu', adminPhone, passwordHash, referralCode]
    );
    console.log(`Admin account created for ${adminPhone}.`);
  } catch (err) {
    console.error('Could not ensure admin user:', err);
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  ensureConfiguredAdmin();
});
