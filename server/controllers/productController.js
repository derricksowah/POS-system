const productService = require('../services/productService');
const { logActivity } = require('../middleware/activityLogger');
const { HTTP_STATUS } = require('../config/constants');

async function list(req, res, next) {
  try {
    const { search = '', includeInactive, page, limit } = req.query;
    const result = await productService.getAll({
      search,
      includeInactive: includeInactive === 'true',
      page:  parseInt(page)  || 1,
      limit: parseInt(limit) || 50,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const product = await productService.getById(parseInt(req.params.id));
    if (!product) return res.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Product not found.' });
    res.json(product);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const product = await productService.create(req.body);
    await logActivity({ userId: req.user.id, action: 'CREATE_PRODUCT', entity: 'products', entityId: product.id, ipAddress: req.ip });
    res.status(HTTP_STATUS.CREATED).json(product);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const product = await productService.update(parseInt(req.params.id), req.body);
    if (!product) return res.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Product not found.' });
    await logActivity({ userId: req.user.id, action: 'UPDATE_PRODUCT', entity: 'products', entityId: product.id, ipAddress: req.ip });
    res.json(product);
  } catch (err) {
    next(err);
  }
}

async function deactivate(req, res, next) {
  try {
    const product = await productService.deactivate(parseInt(req.params.id));
    if (!product) return res.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Product not found.' });
    await logActivity({ userId: req.user.id, action: 'DEACTIVATE_PRODUCT', entity: 'products', entityId: product.id, ipAddress: req.ip });
    res.json({ message: 'Product deactivated.' });
  } catch (err) {
    next(err);
  }
}

async function activate(req, res, next) {
  try {
    const product = await productService.activate(parseInt(req.params.id));
    if (!product) return res.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Product not found.' });
    res.json({ message: 'Product activated.' });
  } catch (err) {
    next(err);
  }
}

async function deleteProduct(req, res, next) {
  try {
    const product = await productService.deleteProduct(parseInt(req.params.id));
    await logActivity({ userId: req.user.id, action: 'DELETE_PRODUCT', entity: 'products', entityId: req.params.id, ipAddress: req.ip });
    res.json({ message: `"${product.name}" moved to recycle bin.` });
  } catch (err) {
    next(err);
  }
}

async function getDeleted(req, res, next) {
  try {
    const products = await productService.getDeleted();
    res.json({ products });
  } catch (err) {
    next(err);
  }
}

async function restoreProduct(req, res, next) {
  try {
    const product = await productService.restoreProduct(parseInt(req.params.id));
    await logActivity({ userId: req.user.id, action: 'RESTORE_PRODUCT', entity: 'products', entityId: req.params.id, ipAddress: req.ip });
    res.json({ message: `"${product.name}" restored successfully.` });
  } catch (err) {
    next(err);
  }
}

async function permanentDelete(req, res, next) {
  try {
    const product = await productService.permanentDelete(parseInt(req.params.id));
    await logActivity({ userId: req.user.id, action: 'PERMANENT_DELETE_PRODUCT', entity: 'products', entityId: req.params.id, ipAddress: req.ip });
    res.json({ message: `"${product.name}" permanently deleted.` });
  } catch (err) {
    next(err);
  }
}

async function lowStock(req, res, next) {
  try {
    const items = await productService.getLowStock();
    res.json(items);
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getOne, create, update, deactivate, activate, deleteProduct, getDeleted, restoreProduct, permanentDelete, lowStock };
