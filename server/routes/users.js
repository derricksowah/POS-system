const router = require('express').Router();
const ctrl   = require('../controllers/userController');
const { authenticate } = require('../middleware/auth');
const { authorize }    = require('../middleware/rbac');
const { validate }     = require('../middleware/validate');
const schemas          = require('../validators/schemas');

router.use(authenticate);
router.use(authorize('admin'));

router.get('/',                    ctrl.list);
router.post('/',                   validate(schemas.createUser), ctrl.create);
router.patch('/:id/username',      validate(schemas.changeUsername), ctrl.changeUsername);
router.patch('/:id/password',      validate(schemas.adminChangePassword), ctrl.changePassword);
router.patch('/:id/toggle-active', ctrl.toggleActive);

module.exports = router;
