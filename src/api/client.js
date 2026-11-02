import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = 'https://api.univerin.in/api';

const client = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000, // 30 seconds timeout (Railway cold start can take 20+ seconds)
});

// Auto-attach JWT token to every request
client.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle slow network / timeout errors + auto-retry once on network failure (Railway cold start)
client.interceptors.response.use(
  response => response,
  async error => {
    const config = error.config;
    if (
      config &&
      !error.response &&
      !config._retry &&
      ['get', 'head', 'options'].includes((config.method || '').toLowerCase())
    ) {
      config._retry = true;
      console.log('Network error - retrying request once after 3s delay...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      return client(config);
    }
    if (error.code === 'ECONNABORTED') {
      error.message = 'Request timed out. Please check your internet connection.';
    } else if (!error.response) {
      error.message = 'Network Error';
    }
    return Promise.reject(error);
  }
);

export default client;
