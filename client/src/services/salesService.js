import api from './api';

export const createSale = (dataOrItems, amount_tendered, payment_method = 'cash') => {
  const data = Array.isArray(dataOrItems)
    ? { items: dataOrItems, amount_tendered: amount_tendered ?? null, payment_method }
    : dataOrItems;
  return api.post('/sales', data).then((r) => r.data);
};

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
