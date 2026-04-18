/**
 * Input sanitization helpers to prevent XSS and injection.
 */

/**
 * Strip HTML tags and trim whitespace.
 */
function sanitizeString(val) {
  if (typeof val !== 'string') return val;
  return val
    .replace(/<[^>]*>/g, '')   // strip HTML tags
    .replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;',
    }[c]))
    .trim();
}

/**
 * Recursively sanitize all string fields in an object.
 */
function sanitizeObject(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return sanitizeString(obj);
  if (Array.isArray(obj)) return obj.map(sanitizeObject);
  if (typeof obj === 'object') {
    const result = {};
    for (const [k, v] of Object.entries(obj)) {
      result[k] = sanitizeObject(v);
    }
    return result;
  }
  return obj;
}

module.exports = { sanitizeString, sanitizeObject };
