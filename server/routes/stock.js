const router = require('express').Router();
const ctrl   = require('../controllers/stockController');
const { authenticate } = require('../middleware/auth');
const { authorize }    = require('../middleware/rbac');
const { validate }     = require('../middleware/validate');
const schemas          = require('../validators/schemas');

router.use(authenticate);

router.get('/current',      ctrl.currentStock);
router.post('/reconcile',   authorize('admin'), validate(schemas.stockReconciliation), ctrl.reconcileStock);
router.get('/in',           authorize('admin'), ctrl.getStockIns);
router.post('/in',          authorize('admin'), validate(schemas.stockIn), ctrl.stockIn);
router.put('/in/:id',       authorize('admin'), validate(schemas.stockInUpdate), ctrl.updateStockIn);
router.delete('/in/:id',    authorize('admin'), ctrl.deleteStockIn);

module.exports = router;
