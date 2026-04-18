const salesService = require('../services/salesService');
const { logActivity } = require('../middleware/activityLogger');
const { HTTP_STATUS } = require('../config/constants');

async function createSale(req, res, next) {
  try {
    const sale = await salesService.createSale({
      cashierId: req.user.id,
      items:     req.body.items,
    });
    await logActivity({
      userId: req.user.id, action: 'CREATE_SALE',
      entity: 'sales', entityId: sale.id,
      details: { receipt_number: sale.receipt_number, grand_total: sale.grand_total },
      ipAddress: req.ip,
    });
    res.status(HTTP_STATUS.CREATED).json(sale);
  } catch (err) {
    next(err);
  }
}

async function listSales(req, res, next) {
  try {
    const { from, to, cashierId, status, page, limit } = req.query;

    // Cashiers can only see their own sales; admins can see all
    const filteredCashierId = req.user.role === 'cashier' ? req.user.id : (cashierId ? parseInt(cashierId) : undefined);

    const result = await salesService.getSales({
      from, to,
      cashierId: filteredCashierId,
      status,
      page:  parseInt(page)  || 1,
      limit: parseInt(limit) || 50,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getSale(req, res, next) {
  try {
    const sale = await salesService.getSaleById(parseInt(req.params.id));
    if (!sale) return res.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Sale not found.' });
    // Cashiers can only view their own sales; admins can view any
    if (req.user.role !== 'admin' && sale.cashier_id !== req.user.id) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({ error: 'Access denied.' });
    }
    res.json(sale);
  } catch (err) {
    next(err);
  }
}

async function editSale(req, res, next) {
  try {
    const sale = await salesService.editSale(
      parseInt(req.params.id),
      req.body,
      req.user.id
    );
    await logActivity({
      userId: req.user.id, action: 'EDIT_SALE',
      entity: 'sales', entityId: sale.id,
      ipAddress: req.ip,
    });
    res.json(sale);
  } catch (err) {
    next(err);
  }
}

async function voidSale(req, res, next) {
  try {
    const result = await salesService.voidSale(parseInt(req.params.id), req.user.id);
    await logActivity({
      userId: req.user.id, action: 'VOID_SALE',
      entity: 'sales', entityId: result.id,
      ipAddress: req.ip,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function permanentDeleteSale(req, res, next) {
  try {
    const result = await salesService.permanentDeleteSale(parseInt(req.params.id), req.user.id);
    await logActivity({
      userId: req.user.id, action: 'PERMANENT_DELETE_SALE',
      entity: 'sales', entityId: result.id,
      ipAddress: req.ip,
    });
    res.json({ message: `Sale ${result.receipt_number} permanently deleted.` });
  } catch (err) {
    next(err);
  }
}

module.exports = { createSale, listSales, getSale, editSale, voidSale, permanentDeleteSale };
