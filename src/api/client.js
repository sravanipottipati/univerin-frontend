import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = 'https://api.univerin.in/api';

const client = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

// Separate client prevents refresh requests from entering
// the main client's response interceptors.
const refreshClient = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
});

// Public OTP requests must not depend on an existing user session.
const PUBLIC_AUTH_ENDPOINTS = [
  '/users/send-login-otp/',
  '/users/verify-login-otp/',
  '/users/send-register-otp/',
  '/users/verify-register-otp/',
];

function isPublicAuthRequest(config) {
  if (!config?.url) return false;

  const path = config.url.split('?')[0];

  return PUBLIC_AUTH_ENDPOINTS.some(
    endpoint => path === endpoint || path.endsWith(endpoint)
  );
}

let refreshPromise = null;

async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refreshToken = await AsyncStorage.getItem('refresh_token');

      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await refreshClient.post('/users/token/refresh/', {
        refresh: refreshToken,
      });

      const { access, refresh } = response.data;

      if (!access) {
        throw new Error('Refresh response missing access token');
      }

      await AsyncStorage.setItem('access_token', access);

      // Supports SimpleJWT refresh-token rotation.
      if (refresh) {
        await AsyncStorage.setItem('refresh_token', refresh);
      }

      return access;
    })().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

// Attach access token to requests.
client.interceptors.request.use(async (config) => {
  // OTP endpoints are public: never send a saved JWT.
  if (isPublicAuthRequest(config)) {
    if (config.headers) {
      delete config.headers.Authorization;
    }
    return config;
  }

  // A retried request already has its new Authorization header.
  if (config._authRetry) {
    return config;
  }

  const token = await AsyncStorage.getItem('access_token');

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

client.interceptors.response.use(
  response => response,
  async error => {
    const config = error.config;

    // Refresh expired access tokens and retry once.
    if (
      error.response?.status === 401 &&
      config &&
      !config._authRetry &&
      !isPublicAuthRequest(config) &&
      !config.url?.includes('/users/token/refresh/')
    ) {
      config._authRetry = true;

      try {
        const access = await refreshAccessToken();
        config.headers.Authorization = `Bearer ${access}`;
        return client(config);
      } catch (refreshError) {
        console.warn(
          '[AUTH] Token refresh failed:',
          refreshError.response?.status ?? refreshError.message
        );
        // A network failure during refresh does not prove that
        // the user's saved session is invalid.
        if (!refreshError.response) {
          return Promise.reject(refreshError);
        }

        // A definitive authentication failure invalidates the session.
        if ([400, 401, 403].includes(refreshError.response.status)) {
          return Promise.reject(refreshError);
        }

        // Other server errors should not erase stored credentials.
        return Promise.reject(refreshError);
      }
    }

    // Preserve existing retry behavior for safe HTTP methods only.
    if (
      config &&
      !error.response &&
      !config._retry &&
      ['get', 'head', 'options'].includes(
        (config.method || '').toLowerCase()
      )
    ) {
      config._retry = true;

      console.log('Network error - retrying request once after 3s delay...');

      await new Promise(resolve => setTimeout(resolve, 3000));
      return client(config);
    }

    if (error.code === 'ECONNABORTED') {
      error.message =
        'Request timed out. Please check your internet connection.';
    } else if (!error.response) {
      error.message = 'Network Error';
    }

    return Promise.reject(error);
  }
);

export default client;
