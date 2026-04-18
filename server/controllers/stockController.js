const stockService = require('../services/stockService');
const { logActivity } = require('../middleware/activityLogger');
const { HTTP_STATUS } = require('../config/constants');

async function stockIn(req, res, next) {
  try {
    const { product_id, quantity, supplier, reference, note } = req.body;
    const record = await stockService.stockIn({ productId: product_id, quantity, supplier, reference, note, userId: req.user.id });
    await logActivity({
      userId:   req.user.id, action: 'STOCK_IN',
      entity:   'stock_ins', entityId: record.id,
      details:  { product_id: req.body.product_id, quantity: req.body.quantity },
      ipAddress: req.ip,
    });
    res.status(HTTP_STATUS.CREATED).json(record);
  } catch (err) {
    next(err);
  }
}

async function getStockIns(req, res, next) {
  try {
    const { productId, from, to, page, limit } = req.query;
    const result = await stockService.getStockIns({
      productId: productId ? parseInt(productId) : undefined,
      from, to,
      page:  parseInt(page)  || 1,
      limit: parseInt(limit) || 50,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function currentStock(req, res, next) {
  try {
    const data = await stockService.getCurrentStock();
    res.json(data);
  } catch (err) {
    next(err);
  }
}

module.exports = { stockIn, getStockIns, currentStock };
