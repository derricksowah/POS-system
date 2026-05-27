import api from './api';

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

export const getProducts = (params = {}) =>
  api.get('/products', { params }).then((r) => r.data);

export const getProduct = (id) =>
  api.get(`/products/${id}`).then((r) => r.data);

export const createProduct = (data) =>
  api.post('/products', data).then((r) => r.data);

export const updateProduct = (id, data) =>
  api.put(`/products/${id}`, data).then((r) => r.data);

export const deactivateProduct = (id) =>
  api.patch(`/products/${id}/deactivate`).then((r) => r.data);

export const activateProduct = (id) =>
  api.patch(`/products/${id}/activate`).then((r) => r.data);

export const deleteProduct = (id) =>
  api.delete(`/products/${id}`).then((r) => r.data);

export const getDeletedProducts = () =>
  api.get('/products/recycle-bin').then((r) => r.data.products);

export const restoreProduct = (id) =>
  api.patch(`/products/${id}/restore`).then((r) => r.data);

export const permanentDeleteProduct = (id) =>
  api.delete(`/products/${id}/permanent`).then((r) => r.data);

export const getLowStock = () =>
  api.get('/products/low-stock').then((r) => r.data);

export const downloadProductCatalogPDF = (params = {}) =>
  downloadBlob('/products/export/pdf', params, `product-catalog.pdf`);

export const downloadProductCatalogExcel = (params = {}) =>
  downloadBlob('/products/export/excel', params, `product-catalog.xlsx`);
