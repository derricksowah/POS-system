const router = require('express').Router();
const ctrl   = require('../controllers/printController');
const { authenticate } = require('../middleware/auth');
const { authorize }    = require('../middleware/rbac');

router.use(authenticate);

// Print a receipt by sale ID — cashiers and admins
router.post('/receipt',  authorize('admin', 'cashier'), ctrl.printReceipt);

// List all printers visible to Windows — admin or cashier
router.get('/printers',  authorize('admin', 'cashier'), ctrl.listPrinters);

// Check printer status
router.get('/status',    authorize('admin', 'cashier'), ctrl.printerStatus);

module.exports = router;
