import api from './api';

export const getSettings = () =>
  api.get('/settings').then((r) => r.data);

export const updateSettings = (data) =>
  api.put('/settings', data).then((r) => r.data);

export const uploadLogo = (file) => {
  const form = new FormData();
  form.append('logo', file);
  return api.post('/settings/logo', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((r) => r.data);
};

export const deleteLogo = () =>
  api.delete('/settings/logo').then((r) => r.data);

export const stockIn = (data) =>
  api.post('/stock/in', data).then((r) => r.data);

export const getStockIns = (params = {}) =>
  api.get('/stock/in', { params }).then((r) => r.data);

export const updateStockIn = (id, data) =>
  api.put(`/stock/in/${id}`, data).then((r) => r.data);

export const deleteStockIn = (id) =>
  api.delete(`/stock/in/${id}`).then((r) => r.data);
