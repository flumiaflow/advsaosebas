import axios from 'axios';

export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true
});

let accessToken: string | null = null;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

// Injeta o access token em todas as requisições
api.interceptors.request.use((config) => {
  if (accessToken && config.headers) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// Trata 401 para tentar o silent refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // Evita loop infinito caso a própria rota de refresh retorne 401
    if (error.response?.status === 401 && !originalRequest._retry && originalRequest.url !== '/auth/refresh') {
      console.warn('Interceptor 401 trigger for:', originalRequest.url);
      originalRequest._retry = true;
      try {
        const { data } = await axios.post('http://localhost:4000/api/auth/refresh', {}, { withCredentials: true });
        setAccessToken(data.accessToken);
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(originalRequest); // Refaz a requisição original
      } catch (refreshError) {
        console.error('Silent refresh failed, triggering auth:logout', refreshError);
        setAccessToken(null);
        window.dispatchEvent(new Event('auth:logout'));
        return Promise.reject(refreshError);
      }
    }
    console.error('API Error not 401, or is refresh:', error.response?.status, originalRequest?.url);
    return Promise.reject(error);
  }
);
