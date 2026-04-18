import api from './api';

export const getUsers = () =>
  api.get('/users').then((r) => r.data.users);

export const createUser = (data) =>
  api.post('/users', data).then((r) => r.data.user);

export const changeUsername = (id, username) =>
  api.patch(`/users/${id}/username`, { username }).then((r) => r.data.user);

export const adminChangePassword = (id, new_password) =>
  api.patch(`/users/${id}/password`, { new_password }).then((r) => r.data);

export const toggleUserActive = (id) =>
  api.patch(`/users/${id}/toggle-active`).then((r) => r.data.user);
