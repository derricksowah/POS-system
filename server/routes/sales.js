const router = require('express').Router();
const ctrl   = require('../controllers/salesController');
const { authenticate } = require('../middleware/auth');
const { authorize }    = require('../middleware/rbac');
const { validate }     = require('../middleware/validate');
const schemas          = require('../validators/schemas');

router.use(authenticate);

router.post('/',                    validate(schemas.createSale), ctrl.createSale);
router.get('/',                     authorize('admin', 'cashier'),            ctrl.listSales);
router.get('/:id',                  ctrl.getSale);
router.put('/:id',                  authorize('admin'), validate(schemas.editSale), ctrl.editSale);
router.patch('/:id/void',           authorize('admin'), ctrl.voidSale);
router.delete('/:id/permanent',     authorize('admin', 'cashier'), ctrl.permanentDeleteSale);

module.exports = router;
