const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { query, withTransaction } = require('../config/database');

const ACCESS_SECRET  = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const ACCESS_EXP     = process.env.JWT_EXPIRES_IN         || '15m';
const REFRESH_EXP    = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

function signAccess(user) {
  return jwt.sign(
    { sub: user.id, username: user.username, role: user.role },
    ACCESS_SECRET,
    { expiresIn: ACCESS_EXP }
  );
}

function signRefresh(user) {
  return jwt.sign(
    { sub: user.id },
    REFRESH_SECRET,
    { expiresIn: REFRESH_EXP }
  );
}

async function login(username, password) {
  const res = await query(
    `SELECT id, username, password_hash, role, is_active FROM users WHERE username = $1`,
    [username.toLowerCase().trim()]
  );
  const user = res.rows[0];
  if (!user) throw Object.assign(new Error('Invalid credentials.'), { status: 401 });
  if (!user.is_active) throw Object.assign(new Error('Account is deactivated.'), { status: 403 });

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) throw Object.assign(new Error('Invalid credentials.'), { status: 401 });

  const accessToken  = signAccess(user);
  const refreshToken = signRefresh(user);

  // Store hashed refresh token
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
    [user.id, tokenHash, expiresAt]
  );

  return {
    accessToken,
    refreshToken,
    user: { id: user.id, username: user.username, role: user.role },
  };
}

async function refresh(refreshToken) {
  let payload;
  try {
    payload = jwt.verify(refreshToken, REFRESH_SECRET);
  } catch {
    throw Object.assign(new Error('Invalid refresh token.'), { status: 401 });
  }

  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  const res = await query(
    `SELECT id, user_id, revoked, expires_at FROM refresh_tokens
     WHERE token_hash = $1 AND revoked = FALSE AND expires_at > NOW()`,
    [tokenHash]
  );
  const record = res.rows[0];
  if (!record) throw Object.assign(new Error('Refresh token revoked or expired.'), { status: 401 });

  const userRes = await query(
    `SELECT id, username, role, is_active FROM users WHERE id = $1`,
    [record.user_id]
  );
  const user = userRes.rows[0];
  if (!user || !user.is_active) throw Object.assign(new Error('User not found.'), { status: 401 });

  const newAccessToken  = signAccess(user);
  const newRefreshToken = signRefresh(user);

  // Rotate: revoke old, store new
  await withTransaction(async (client) => {
    await client.query(`UPDATE refresh_tokens SET revoked = TRUE WHERE id = $1`, [record.id]);
    const newHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex');
    const newExp  = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await client.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
      [user.id, newHash, newExp]
    );
  });

  return {
    accessToken:  newAccessToken,
    refreshToken: newRefreshToken,
    user: { id: user.id, username: user.username, role: user.role },
  };
}

async function logout(refreshToken) {
  if (!refreshToken) return;
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  await query(`UPDATE refresh_tokens SET revoked = TRUE WHERE token_hash = $1`, [tokenHash]);
}

async function changePassword(userId, currentPassword, newPassword) {
  const res = await query(`SELECT password_hash FROM users WHERE id = $1`, [userId]);
  const user = res.rows[0];
  if (!user) throw Object.assign(new Error('User not found.'), { status: 404 });

  const match = await bcrypt.compare(currentPassword, user.password_hash);
  if (!match) throw Object.assign(new Error('Current password is incorrect.'), { status: 401 });

  const rounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
  const newHash = await bcrypt.hash(newPassword, rounds);
  await query(`UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`, [newHash, userId]);

  // Revoke all refresh tokens for this user
  await query(`UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = $1`, [userId]);
}

module.exports = { login, refresh, logout, changePassword };
