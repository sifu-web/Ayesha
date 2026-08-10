import axios from 'axios';

/**
 * Central Axios instance.
 * withCredentials ensures the httpOnly JWT cookie is sent on every request.
 * The X-Requested-With header adds a second, simple CSRF signal that pairs
 * with the backend's origin-check middleware.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  withCredentials: true,
  headers: {
    'X-Requested-With': 'XMLHttpRequest',
  },
});

export default api;
