import axios from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Production backend URL connected to server
const getBackendUrl = () => {
  return 'https://warehouse.vanikicrop.com/api';
};

const API_BASE_URL = getBackendUrl();

let activeToken = 'mobile_wms_session_token';

const mobileApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${activeToken}`
  }
});

// Interceptor to ensure Authorization header is ALWAYS included
mobileApi.interceptors.request.use((config) => {
  config.headers['Authorization'] = `Bearer ${activeToken || 'mobile_wms_session_token'}`;
  return config;
}, (error) => Promise.reject(error));

export const setAuthToken = (token) => {
  activeToken = token || 'mobile_wms_session_token';
  mobileApi.defaults.headers.common['Authorization'] = `Bearer ${activeToken}`;
};

export default mobileApi;
