const userService = require('../services/userService');
const { logActivity } = require('../middleware/activityLogger');
const { HTTP_STATUS } = require('../config/constants');

async function list(req, res, next) {
  try {
    const users = await userService.listUsers();
    res.json({ users });
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const user = await userService.createUser(req.body);
    await logActivity({ userId: req.user.id, action: 'CREATE_USER', details: `Created user: ${user.username}`, ipAddress: req.ip });
    res.status(HTTP_STATUS.CREATED).json({ user });
  } catch (err) { next(err); }
}

async function changeUsername(req, res, next) {
  try {
    const user = await userService.changeUsername(Number(req.params.id), req.body.username, req.user.id);
    await logActivity({ userId: req.user.id, action: 'CHANGE_USERNAME', details: `Changed username to: ${user.username}`, ipAddress: req.ip });
    res.json({ user });
  } catch (err) { next(err); }
}

async function changePassword(req, res, next) {
  try {
    await userService.adminChangePassword(Number(req.params.id), req.body.new_password, req.user.id);
    await logActivity({ userId: req.user.id, action: 'ADMIN_CHANGE_PASSWORD', details: `Reset password for user id: ${req.params.id}`, ipAddress: req.ip });
    res.json({ message: 'Password updated successfully.' });
  } catch (err) { next(err); }
}

async function toggleActive(req, res, next) {
  try {
    const user = await userService.toggleActive(Number(req.params.id), req.user.id);
    await logActivity({ userId: req.user.id, action: 'TOGGLE_USER_ACTIVE', details: `User ${user.username} is now ${user.is_active ? 'active' : 'inactive'}`, ipAddress: req.ip });
    res.json({ user });
  } catch (err) { next(err); }
}

module.exports = { list, create, changeUsername, changePassword, toggleActive };
