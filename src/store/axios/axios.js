import axios from 'axios';
import { logout } from '../slices/authSlice';
import {
  getIframeLocationId,
  withLocationIdParams,
} from '../../utils/iframeContext';

const BASE_URL = import.meta.env.VITE_API_URL || 'https://site.cleanonthego.com/api';
export const ADMIN_USERNAME = import.meta.env.VITE_ADMIN_USERNAME
export const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD
export const USER_PASSWORD = import.meta.env.VITE_USER_PASSWORD

// Create axios instance
export const axiosInstance = axios.create({
  baseURL: BASE_URL,
});

// axiosBaseQuery.js
export const axiosBaseQuery =
  ({ baseUrl = '' } = {}) =>
  async ({ url, method, data, params }) => {
    try {
      const result = await axiosInstance({
        url: baseUrl + (url || ''),
        method,
        data,
        params,
      });
      return { data: result.data };
    } catch (axiosError) {
      return {
        error: {
          status: axiosError.response?.status,
          data: axiosError.response?.data || axiosError.message,
        },
      };
    }
  };


// Named export for BASE_URL
export { BASE_URL };


axiosInstance.interceptors.request.use(
  (config) => {
    const accessToken = localStorage.getItem('access');

    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    const locationId = getIframeLocationId();
    if (locationId) {
      // Query param only — backend reads location_id from params; avoids extra CORS header preflight.
      config.params = withLocationIdParams(config.params || {});
    }

    return config;
  },
  (error) => Promise.reject(error)
);


// response interceptor
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Prevent infinite loop: skip if this is the refresh request itself
    if (
      (error.response?.status === 401 || error.response?.status === 403) &&
      !originalRequest._retry &&
      !originalRequest.url.includes('/auth/refresh/')
    ) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refresh');
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }

        const response = await axios.post(`${BASE_URL}/service/auth/refresh/`, {
          refresh: refreshToken,
        });

        const newAccessToken = response.data.access;
        localStorage.setItem('access', newAccessToken);

        // const newRefreshToken = response.data.refresh;
        // localStorage.setItem('refresh', newRefreshToken);

        // Update the original request with new token and retry
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        localStorage.removeItem('access');
        
        // Store current location before token expires (for automatic logout scenarios)
        // Only store if not already on login page and returnTo doesn't already exist
        if (typeof window !== 'undefined') {
          const currentPath = window.location.pathname + window.location.search;
          if (!currentPath.includes('/admin/login')) {
            const existingReturnTo = localStorage.getItem('returnTo');
            // Only store if there's no existing returnTo (to preserve the original page)
            if (!existingReturnTo) {
              localStorage.setItem('returnTo', currentPath);
              console.log('Stored returnTo in axios interceptor (token expired):', currentPath);
            }
          }
        }
        
        // store.dispatch(logout());
        // window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);
