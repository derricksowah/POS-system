const Joi = require('joi');

const login = Joi.object({
  username: Joi.string().min(1).max(50).required(),
  password: Joi.string().min(1).required(),
});

const changePassword = Joi.object({
  current_password: Joi.string().required(),
  new_password:     Joi.string().min(8).max(100).required(),
});

const refreshToken = Joi.object({
  refresh_token: Joi.string().required(),
});

const product = Joi.object({
  code:                Joi.string().trim().max(50).optional(),
  name:                Joi.string().trim().max(200).required(),
  price:               Joi.number().min(0).required(),
  unit:                Joi.string().trim().max(50).default('pcs'),
  opening_stock:       Joi.number().min(0).default(0),
  low_stock_threshold: Joi.number().min(0).default(5),
});

const productUpdate = Joi.object({
  name:                Joi.string().trim().max(200).required(),
  price:               Joi.number().min(0).required(),
  unit:                Joi.string().trim().max(50).default('pcs'),
  low_stock_threshold: Joi.number().min(0).default(5),
});

const stockIn = Joi.object({
  product_id: Joi.number().integer().positive().required(),
  quantity:   Joi.number().positive().required(),
  supplier:   Joi.string().trim().max(200).allow('', null).optional(),
  reference:  Joi.string().trim().max(100).allow('', null).optional(),
  note:       Joi.string().trim().max(500).allow('', null).optional(),
});

const saleItem = Joi.object({
  product_id: Joi.number().integer().positive().required(),
  quantity:   Joi.number().positive().required(),
  unit_price: Joi.number().min(0).optional(),
});

const createSale = Joi.object({
  items:           Joi.array().items(saleItem).min(1).required(),
  amount_tendered: Joi.number().min(0).optional().allow(null),
});

const editSale = Joi.object({
  items: Joi.array().items(saleItem).min(1).required(),
  notes: Joi.string().trim().max(500).allow('', null).optional(),
});

const dateRange = Joi.object({
  from:  Joi.date().iso().optional(),
  to:    Joi.date().iso().min(Joi.ref('from')).optional(),
  page:  Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(500).default(50),
});

const settings = Joi.object({
  shop_name:      Joi.string().trim().max(200).required(),
  shop_address:   Joi.string().trim().max(500).allow('', null).optional(),
  phone_number:   Joi.string().trim().max(30).allow('', null).optional(),
  phone_number_2: Joi.string().trim().max(30).allow('', null).optional(),
  currency:       Joi.string().trim().max(10).default('GHS'),
  receipt_header: Joi.string().trim().max(500).allow('', null).optional(),
  receipt_footer: Joi.string().trim().max(500).allow('', null).optional(),
  printer_name:   Joi.string().trim().max(200).allow('', null).optional(),
  // logo_url is set via POST /settings/logo (file upload) — not accepted in this body
});

const createUser = Joi.object({
  username: Joi.string().trim().alphanum().min(3).max(50).required(),
  password: Joi.string().min(8).max(100).required(),
  role:     Joi.string().valid('admin', 'cashier').required(),
});

const changeUsername = Joi.object({
  username: Joi.string().trim().alphanum().min(3).max(50).required(),
});

const adminChangePassword = Joi.object({
  new_password: Joi.string().min(8).max(100).required(),
});

module.exports = {
  login,
  changePassword,
  createUser,
  changeUsername,
  adminChangePassword,
  refreshToken,
  product,
  productUpdate,
  stockIn,
  createSale,
  editSale,
  dateRange,
  settings,
};
