const authService = require('../services/authService');
const { logActivity } = require('../middleware/activityLogger');
const { HTTP_STATUS } = require('../config/constants');

async function login(req, res, next) {
  try {
    const { username, password } = req.body;
    const result = await authService.login(username, password);

    await logActivity({
      userId:    result.user.id,
      action:    'LOGIN',
      ipAddress: req.ip,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function refresh(req, res, next) {
  try {
    const { refresh_token } = req.body;
    const result = await authService.refresh(refresh_token);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function logout(req, res, next) {
  try {
    const { refresh_token } = req.body;
    await authService.logout(refresh_token);

    await logActivity({
      userId:    req.user?.id,
      action:    'LOGOUT',
      ipAddress: req.ip,
    });

    res.status(HTTP_STATUS.NO_CONTENT).send();
  } catch (err) {
    next(err);
  }
}

async function changePassword(req, res, next) {
  try {
    const { current_password, new_password } = req.body;
    await authService.changePassword(req.user.id, current_password, new_password);

    await logActivity({
      userId:    req.user.id,
      action:    'CHANGE_PASSWORD',
      ipAddress: req.ip,
    });

    res.json({ message: 'Password changed successfully.' });
  } catch (err) {
    next(err);
  }
}

async function me(req, res) {
  res.json({ user: req.user });
}

module.exports = { login, refresh, logout, changePassword, me };
