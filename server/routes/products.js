const router = require('express').Router();
const ctrl   = require('../controllers/productController');
const { authenticate } = require('../middleware/auth');
const { authorize }    = require('../middleware/rbac');
const { validate }     = require('../middleware/validate');
const schemas          = require('../validators/schemas');

router.use(authenticate);

router.get('/',              ctrl.list);
router.get('/low-stock',     ctrl.lowStock);
router.get('/recycle-bin',   authorize('admin'), ctrl.getDeleted);
router.get('/:id',           ctrl.getOne);
router.post('/',             authorize('admin'), validate(schemas.product),       ctrl.create);
router.put('/:id',           authorize('admin'), validate(schemas.productUpdate), ctrl.update);
router.patch('/:id/deactivate',  authorize('admin'), ctrl.deactivate);
router.patch('/:id/activate',    authorize('admin'), ctrl.activate);
router.delete('/:id',            authorize('admin'), ctrl.deleteProduct);
router.patch('/:id/restore',     authorize('admin'), ctrl.restoreProduct);
router.delete('/:id/permanent',  authorize('admin'), ctrl.permanentDelete);

module.exports = router;
