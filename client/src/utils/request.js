import axios from 'axios';
import { showToast } from 'vant';
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
      showToast(res.message || '请求失败');
      return Promise.reject(res);
    }
  },
  error => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      clearAuth();
      window.location.href = '#/login';
      showToast('请先登录');
      return Promise.reject(error);
    }
    const message = error.response?.data?.message || error.message || '网络错误';
    showToast(message);
    return Promise.reject(error);
  }
);

export default request;
