const { HTTP_STATUS } = require('../config/constants');

/**
 * Joi validation middleware factory.
 * Usage: validate(schema) — validates req.body by default.
 *        validate(schema, 'query') — validates req.query.
 */
function validate(schema, target = 'body') {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[target], {
      abortEarly:    false,
      stripUnknown:  true,
      convert:       true,
    });

    if (error) {
      const messages = error.details.map((d) => d.message);
      return res.status(HTTP_STATUS.UNPROCESSABLE_ENTITY).json({
        error:  'Validation failed.',
        fields: messages,
      });
    }

    req[target] = value;
    next();
  };
}

module.exports = { validate };
