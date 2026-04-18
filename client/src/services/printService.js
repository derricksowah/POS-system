import api from './api.js';

export async function printReceiptById(saleId) {
  const { data } = await api.post('/print/receipt', { sale_id: saleId });
  return data;
}

export async function getPrinterStatus() {
  const { data } = await api.get('/print/status');
  return data; // { ready: bool, configured: string|null }
}

export async function listPrinters() {
  const { data } = await api.get('/print/printers');
  return data; // { printers: string[], configured: string|null }
}
