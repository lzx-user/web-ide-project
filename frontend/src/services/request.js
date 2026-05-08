import axios from 'axios';

/**
 * Axios 统一请求封装
 * 职责：
 * 1. 统一 baseURL，不用每次写 http://localhost:3000/api
 * 2. 统一拦截请求，自动注入 JWT Token
 * 3. 统一处理网络超时或错误
 */

// 1. 创建一个独立的 Axios 实例
const request = axios.create({
  // 使用 Vite 特有的 import.meta.env 来读取环境变量
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api',
  timeout: 5000,                        // 设置超时时间（5秒）
});

// 2. 请求拦截器：在真正发请求前“拦住”，塞点东西进去
request.interceptors.request.use(
  (config) => {
    // 从本地存储拿取你在 Login 成功后存入的 token
    const token = localStorage.getItem('ide_token');

    // 如果有 token，就自动塞进请求头里
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }

    return config; // 放行请求
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 3. 响应拦截器：在拿到后端数据前“拦住”，统一处理报错
request.interceptors.response.use(
  (response) => {
    // 正常返回，直接把 response 交给后续的业务代码
    return response;
  },
  (error) => {
    // 这里可以统一处理 401 未授权、500 服务器错误等
    if (error.response && error.response.status === 401) {
      console.error('Token 可能已过期，请重新登录');
      // 可选：在这里加上清除 token 和跳转登录页的逻辑
    }
    return Promise.reject(error);
  }
);

export default request;