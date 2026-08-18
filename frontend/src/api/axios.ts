import axios from 'axios';

// Instância base com credentials para enviar o HttpOnly cookie
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api',
  withCredentials: true
});

// Interceptor para injetar o Access Token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Tratamento global de expiração de token (Logout forçado se der 401)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Se tivermos um sistema de silent refresh, chamaríamos aqui.
      // Como o MVP foca no Access Token + Refresh Cookie (que é tratado no backend),
      // Se a rota falhou com 401, o token está inválido/expirado
      localStorage.removeItem('access_token');
      // window.location.href = '/login'; // Opcional: força redirect
    }
    return Promise.reject(error);
  }
);

export default api;
