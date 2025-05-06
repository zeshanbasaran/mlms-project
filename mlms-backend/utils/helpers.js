const pool = require('../db');

async function logUserActivity(userId, activity) {
  if (!userId || !activity) return;
  try {
    await pool.query(
      'INSERT INTO user_activity (user_id, activity, timestamp) VALUES (?, ?, NOW())',
      [userId, activity]
    );
  } catch (err) {
    console.error('Activity log failed:', err.message);
  }
}

async function getTrackTitle(trackId) {
  const [[track]] = await pool.query('SELECT title FROM tracks WHERE track_id = ?', [trackId]);
  return track?.title || `ID ${trackId}`;
}

module.exports = { logUserActivity, getTrackTitle };
