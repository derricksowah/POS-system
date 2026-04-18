const router = require('express').Router();
const ctrl   = require('../controllers/reportController');
const { authenticate } = require('../middleware/auth');
const { authorize }    = require('../middleware/rbac');

router.use(authenticate);

router.get('/dashboard',                authorize('admin'),            ctrl.dashboard);
router.get('/sales/:format(json|pdf|excel)', authorize('admin'),       ctrl.salesReport);
router.get('/inventory/:format(json|pdf|excel)', authorize('admin'),   ctrl.inventoryReport);
router.get('/today',                                                    ctrl.todaySummary);
router.get('/daily-trend',              authorize('admin'),             ctrl.dailyTrend);

module.exports = router;
