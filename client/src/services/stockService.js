import api from './api';

export const getCurrentStock = () =>
  api.get('/stock/current').then((r) => r.data);

export const reconcileStock = (adjustments) =>
  api.post('/stock/reconcile', { adjustments }).then((r) => r.data);
