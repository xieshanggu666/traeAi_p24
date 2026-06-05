import axios from 'axios';
import { getToken, clearAuth } from './storage';

const request = axios.create({
  baseURL: '/api',
  timeout: 10000
});

request.interceptors.request.use(
  config => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

request.interceptors.response.use(
  response => {
    const res = response.data;
    if (res.success) {
      return res.data;
    } else {
      const err = new Error(res.message || '请求失败');
      err.isBusinessError = true;
      err.businessMessage = res.message || '请求失败';
      return Promise.reject(err);
    }
  },
  error => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      clearAuth();
      window.location.href = '#/login';
      return Promise.reject(error);
    }
    const msg = error.response?.data?.message || error.message || '网络错误';
    const err = new Error(msg);
    err.isHttpError = true;
    err.httpMessage = msg;
    return Promise.reject(err);
  }
);

export default request;
