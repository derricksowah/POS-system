const bcrypt = require('bcryptjs');
const { query } = require('../config/database');

async function listUsers() {
  const res = await query(
    `SELECT id, username, role, is_active, created_at FROM users ORDER BY role, username`
  );
  return res.rows;
}

async function createUser({ username, password, role }) {
  const lower = username.toLowerCase().trim();

  // Check uniqueness
  const exists = await query(`SELECT id FROM users WHERE username = $1`, [lower]);
  if (exists.rows.length) {
    throw Object.assign(new Error('Username already taken.'), { status: 409 });
  }

  const rounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
  const hash   = await bcrypt.hash(password, rounds);

  const res = await query(
    `INSERT INTO users (username, password_hash, role, is_active)
     VALUES ($1, $2, $3, TRUE)
     RETURNING id, username, role, is_active, created_at`,
    [lower, hash, role]
  );
  return res.rows[0];
}

async function changeUsername(targetId, newUsername, requesterId) {
  // Admin cannot change their own username via this endpoint (use profile for that)
  // Actually we allow it — just prevent changing the last admin's username to something weird
  const lower = newUsername.toLowerCase().trim();

  const exists = await query(`SELECT id FROM users WHERE username = $1 AND id != $2`, [lower, targetId]);
  if (exists.rows.length) {
    throw Object.assign(new Error('Username already taken.'), { status: 409 });
  }

  const res = await query(
    `UPDATE users SET username = $1, updated_at = NOW() WHERE id = $2
     RETURNING id, username, role, is_active`,
    [lower, targetId]
  );
  if (!res.rows.length) throw Object.assign(new Error('User not found.'), { status: 404 });

  // Revoke all refresh tokens so they must log in again with new username
  await query(`UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = $1`, [targetId]);

  return res.rows[0];
}

async function adminChangePassword(targetId, newPassword, requesterId) {
  const userRes = await query(`SELECT id FROM users WHERE id = $1`, [targetId]);
  if (!userRes.rows.length) throw Object.assign(new Error('User not found.'), { status: 404 });

  const rounds  = parseInt(process.env.BCRYPT_ROUNDS) || 12;
  const newHash = await bcrypt.hash(newPassword, rounds);

  await query(
    `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
    [newHash, targetId]
  );

  // Revoke all refresh tokens — forces re-login
  await query(`UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = $1`, [targetId]);
}

async function toggleActive(targetId, requesterId) {
  // Prevent admin from deactivating themselves
  if (targetId === requesterId) {
    throw Object.assign(new Error('You cannot deactivate your own account.'), { status: 400 });
  }

  const res = await query(
    `UPDATE users SET is_active = NOT is_active, updated_at = NOW() WHERE id = $1
     RETURNING id, username, role, is_active`,
    [targetId]
  );
  if (!res.rows.length) throw Object.assign(new Error('User not found.'), { status: 404 });

  // If deactivating, revoke their tokens
  if (!res.rows[0].is_active) {
    await query(`UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = $1`, [targetId]);
  }

  return res.rows[0];
}

module.exports = { listUsers, createUser, changeUsername, adminChangePassword, toggleActive };
