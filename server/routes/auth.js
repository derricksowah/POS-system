const router = require('express').Router();
const ctrl   = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { validate }     = require('../middleware/validate');
const { authLimiter }  = require('../middleware/rateLimiter');
const schemas          = require('../validators/schemas');

router.post('/login',           authLimiter, validate(schemas.login),         ctrl.login);
router.post('/refresh',         validate(schemas.refreshToken),               ctrl.refresh);
router.post('/logout',          authenticate,                                  ctrl.logout);
router.post('/change-password', authenticate, validate(schemas.changePassword), ctrl.changePassword);
router.get('/me',               authenticate,                                  ctrl.me);

module.exports = router;
