import api from './api';

export const getDashboard = () =>
  api.get('/reports/dashboard').then((r) => r.data);

export const getSalesReport = (params = {}) =>
  api.get('/reports/sales/json', { params }).then((r) => r.data);

export const getInventoryReport = () =>
  api.get('/reports/inventory/json').then((r) => r.data);

export const getTodaySummary = () =>
  api.get('/reports/today').then((r) => r.data);

export const getDailyTrend = (days = 30) =>
  api.get('/reports/daily-trend', { params: { days } }).then((r) => r.data);

/**
 * Fetch a file blob through Axios (includes JWT token) and trigger browser download.
 */
async function downloadBlob(url, params, filename) {
  const response = await api.get(url, { params, responseType: 'blob' });
  const blob = new Blob([response.data], { type: response.headers['content-type'] });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
}

export const downloadSalesReportPDF = (params = {}) =>
  downloadBlob('/reports/sales/pdf', params, `sales-report-${params.from ?? 'all'}.pdf`);

export const downloadSalesReportExcel = (params = {}) =>
  downloadBlob('/reports/sales/excel', params, `sales-report-${params.from ?? 'all'}.xlsx`);

export const downloadInventoryReportPDF = () =>
  downloadBlob('/reports/inventory/pdf', {}, 'inventory-report.pdf');

export const downloadInventoryReportExcel = () =>
  downloadBlob('/reports/inventory/excel', {}, 'inventory-report.xlsx');
