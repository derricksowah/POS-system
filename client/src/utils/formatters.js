/**
 * Format a number as currency.
 */
export function formatCurrency(amount, currency = 'GHS') {
  return `${currency} ${Number(amount || 0).toFixed(2)}`;
}

/**
 * Format a date string to a human-readable form.
 */
export function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

/**
 * Format a datetime string with time.
 */
export function formatDateTime(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

/**
 * Today's date as YYYY-MM-DD.
 */
export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Extract error message from axios error or plain Error.
 */
export function getErrorMessage(err) {
  return (
    err?.response?.data?.error ||
    err?.response?.data?.fields?.[0] ||
    err?.message ||
    'An unexpected error occurred.'
  );
}
