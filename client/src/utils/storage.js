const TOKEN_KEY = 'drift_bottle_token';
const USER_KEY = 'drift_bottle_user';

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function removeToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function setUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getUser() {
  const userStr = localStorage.getItem(USER_KEY);
  return userStr ? JSON.parse(userStr) : null;
}

export function removeUser() {
  localStorage.removeItem(USER_KEY);
}

export function clearAuth() {
  removeToken();
  removeUser();
}
