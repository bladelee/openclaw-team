import axios, { AxiosError } from 'axios';
import { auth as liumaAuth } from '../auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

export const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器 - 添加 token（优先使用 Liuma token）
api.interceptors.request.use(
  async (config) => {
    if (typeof window !== 'undefined') {
      // Try to get Liuma token first
      try {
        const session = await liumaAuth.getSession();
        if (session?.token) {
          config.headers.Authorization = `Bearer ${session.token}`;
          config.headers['X-Auth-Method'] = 'liuma';
          return config;
        }
      } catch {
        // Liuma auth failed, try legacy token
      }

      // Fallback to legacy token
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        config.headers['X-Auth-Method'] = 'legacy';
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 响应拦截器 - 处理 401
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      // Token 过期，尝试刷新 Liuma token
      try {
        const newToken = await liumaAuth.refreshToken();
        if (newToken) {
          // Retry request with new token
          if (error.config) {
            error.config.headers.Authorization = `Bearer ${newToken}`;
            return api.request(error.config);
          }
        }
      } catch {
        // Refresh failed, clear all auth
      }

      // Clear all authentication storage
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('openclaw-auth-storage');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('signature');

      // Logout from Liuma
      await liumaAuth.logout().catch(() => {
        // Ignore logout errors
      });

      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
