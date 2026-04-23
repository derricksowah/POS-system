/**
 * Format a number as currency.
 */
const APP_TIME_ZONE = 'Africa/Accra';

export function formatCurrency(amount, currency = 'GHS') {
  return `${currency} ${Number(amount || 0).toFixed(2)}`;
}

/**
 * Format a date string to a human-readable form.
 */
export function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    timeZone: APP_TIME_ZONE,
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

/**
 * Format a datetime string with time.
 */
export function formatDateTime(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleString('en-GB', {
    timeZone: APP_TIME_ZONE,
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

/**
 * Today's date as YYYY-MM-DD.
 */
export function todayISO() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const part = (type) => parts.find((p) => p.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
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
