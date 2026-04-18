import api from './api';

export const createSale = (items) =>
  api.post('/sales', { items }).then((r) => r.data);

export const getSales = (params = {}) =>
  api.get('/sales', { params }).then((r) => r.data);

export const getSale = (id) =>
  api.get(`/sales/${id}`).then((r) => r.data);

export const editSale = (id, data) =>
  api.put(`/sales/${id}`, data).then((r) => r.data);

export const voidSale = (id) =>
  api.patch(`/sales/${id}/void`).then((r) => r.data);

export const permanentDeleteSale = (id) =>
  api.delete(`/sales/${id}/permanent`).then((r) => r.data);
