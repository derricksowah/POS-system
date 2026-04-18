import api from './api';

export const login = (username, password) =>
  api.post('/auth/login', { username, password }).then((r) => r.data);

export const logout = (refreshToken) =>
  api.post('/auth/logout', { refresh_token: refreshToken }).catch(() => {});

export const changePassword = (current_password, new_password) =>
  api.post('/auth/change-password', { current_password, new_password }).then((r) => r.data);

export const getMe = () =>
  api.get('/auth/me').then((r) => r.data);
