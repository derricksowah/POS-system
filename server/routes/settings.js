const router = require('express').Router();
const ctrl   = require('../controllers/settingsController');
const { authenticate } = require('../middleware/auth');
const { authorize }    = require('../middleware/rbac');
const { validate }     = require('../middleware/validate');
const schemas          = require('../validators/schemas');
const { upload }       = require('../middleware/upload');

router.use(authenticate);

router.get('/',        ctrl.getSettings);
router.put('/',        authorize('admin'), validate(schemas.settings), ctrl.updateSettings);
router.post('/logo',   authorize('admin'), upload.single('logo'), ctrl.uploadLogo);
router.delete('/logo', authorize('admin'), ctrl.deleteLogo);

module.exports = router;
