module.exports = {
  ROLES: {
    ADMIN:   'admin',
    CASHIER: 'cashier',
  },

  STOCK_MOVEMENT_TYPES: {
    OPENING:    'opening',
    PURCHASE:   'purchase',
    SALE:       'sale',
    SALE_EDIT:  'sale_edit',
    ADJUSTMENT: 'adjustment',
  },

  SALE_STATUS: {
    COMPLETED: 'completed',
    EDITED:    'edited',
    VOIDED:    'voided',
  },

  PAGINATION: {
    DEFAULT_PAGE:  1,
    DEFAULT_LIMIT: 50,
    MAX_LIMIT:     500,
  },

  INACTIVITY_TIMEOUT_MS: 15 * 60 * 1000, // 15 minutes

  HTTP_STATUS: {
    OK:                    200,
    CREATED:               201,
    NO_CONTENT:            204,
    BAD_REQUEST:           400,
    UNAUTHORIZED:          401,
    FORBIDDEN:             403,
    NOT_FOUND:             404,
    CONFLICT:              409,
    UNPROCESSABLE_ENTITY:  422,
    INTERNAL_SERVER_ERROR: 500,
  },
};
