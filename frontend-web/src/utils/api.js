import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 120000,
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('vaniki_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Only an explicit "your session is not valid" ends the session. Timeouts,
    // offline errors and 500s are surfaced to the caller instead.
    if (error.response?.status === 401) {
      localStorage.removeItem('vaniki_token');
      localStorage.removeItem('vaniki_user');
      if (window.location.pathname !== '/login') {
        window.location.replace('/login');
      }
    }
    return Promise.reject(error);
  }
);

// Message worth showing a user, from any axios failure.
export const errorMessage = (err, fallback = 'Something went wrong. Please try again.') => {
  if (err?.response?.data?.message) return err.response.data.message;
  if (err?.code === 'ECONNABORTED') return 'The server took too long to respond. Please retry.';
  if (!err?.response) return 'Cannot reach the server. Check your connection.';
  return fallback;
};

export default api;
