import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://warehouse.vanikicrop.com/api';

const TOKEN_KEY = 'vaniki_token';
const USER_KEY = 'vaniki_user';

// Kept in memory so every request is synchronous, and mirrored to AsyncStorage so
// the session survives an app restart (this is why the app used to log out each launch).
let activeToken = null;
let onUnauthorized = null;

const mobileApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' }
});

mobileApi.interceptors.request.use((config) => {
  if (activeToken) config.headers.Authorization = `Bearer ${activeToken}`;
  else delete config.headers.Authorization;
  console.log(`[MobileAPI ➔] ${config.method?.toUpperCase()} ${config.url}`, config.params ? JSON.stringify(config.params) : '');
  return config;
});

mobileApi.interceptors.response.use(
  (response) => {
    console.log(`[MobileAPI ✓] ${response.config.method?.toUpperCase()} ${response.config.url} - Status ${response.status}`);
    return response;
  },
  async (error) => {
    console.error(`[MobileAPI ✗] ${error.config?.method?.toUpperCase()} ${error.config?.url}:`, error.response?.data?.message || error.message);
    if (error.response?.status === 401) {
      await clearSession();
      if (onUnauthorized) onUnauthorized();
    }
    return Promise.reject(error);
  }
);

export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

export const saveSession = async (token, user) => {
  activeToken = token || null;
  await AsyncStorage.multiSet([[TOKEN_KEY, token || ''], [USER_KEY, JSON.stringify(user || null)]]);
};

export const loadSession = async () => {
  try {
    const [[, token], [, rawUser]] = await AsyncStorage.multiGet([TOKEN_KEY, USER_KEY]);
    activeToken = token || null;
    return { token: activeToken, user: rawUser ? JSON.parse(rawUser) : null };
  } catch (err) {
    console.warn('Session restore failed:', err.message);
    return { token: null, user: null };
  }
};

export const clearSession = async () => {
  activeToken = null;
  await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
};

export const getToken = () => activeToken;

// Turns an axios failure into something worth showing a warehouse operator.
export const errorMessage = (err, fallback = 'Something went wrong. Please try again.') => {
  if (err?.response?.data?.message) return err.response.data.message;
  if (err?.code === 'ECONNABORTED') return 'The server took too long to respond. Check your connection and retry.';
  if (!err?.response) return 'Cannot reach the server. Check your internet connection.';
  return fallback;
};

export default mobileApi;
