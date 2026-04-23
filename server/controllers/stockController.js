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
    const { productId, from, to, search, page, limit } = req.query;
    const result = await stockService.getStockIns({
      productId: productId ? parseInt(productId) : undefined,
      from, to,
      search,
      page:  parseInt(page)  || 1,
      limit: parseInt(limit) || 50,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function updateStockIn(req, res, next) {
  try {
    const { quantity, supplier, reference, note } = req.body;
    const record = await stockService.updateStockIn(parseInt(req.params.id), {
      quantity,
      supplier,
      reference,
      note,
      userId: req.user.id,
    });
    await logActivity({
      userId: req.user.id, action: 'UPDATE_STOCK_IN',
      entity: 'stock_ins', entityId: record.id,
      details: { quantity: record.quantity },
      ipAddress: req.ip,
    });
    res.json(record);
  } catch (err) {
    next(err);
  }
}

async function deleteStockIn(req, res, next) {
  try {
    const record = await stockService.deleteStockIn(parseInt(req.params.id), req.user.id);
    await logActivity({
      userId: req.user.id, action: 'DELETE_STOCK_IN',
      entity: 'stock_ins', entityId: record.id,
      details: { product_id: record.product_id, quantity: record.quantity },
      ipAddress: req.ip,
    });
    res.json({ message: `Stock-in for "${record.product_name}" deleted and stock reversed.` });
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

module.exports = { stockIn, getStockIns, updateStockIn, deleteStockIn, currentStock };
