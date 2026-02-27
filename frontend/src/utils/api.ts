import axios from 'axios';

const API_BASE = '/api';

const api = axios.create({ baseURL: API_BASE });

// Attach JWT to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 — try refresh token
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const { data } = await axios.post(`${API_BASE}/auth/refresh`, { refreshToken });
          localStorage.setItem('accessToken', data.accessToken);
          originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
          return api(originalRequest);
        } catch {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: (userId: string, password: string) =>
    api.post('/auth/login', { userId, password }).then(r => r.data),
  changePassword: (currentPassword: string, newPassword: string, confirmPassword: string) =>
    api.put('/auth/change-password', { currentPassword, newPassword, confirmPassword }).then(r => r.data),
  me: () => api.get('/auth/me').then(r => r.data),
};

// Rooms API
export const roomsApi = {
  getAll: () => api.get('/rooms').then(r => r.data),
  getById: (id: number) => api.get(`/rooms/${id}`).then(r => r.data),
  getTypes: () => api.get('/rooms/types').then(r => r.data),
  create: (data: any) => api.post('/rooms', data).then(r => r.data),
  update: (id: number, data: any) => api.put(`/rooms/${id}`, data).then(r => r.data),
  updateStatus: (id: number, status: string) =>
    api.put(`/rooms/${id}/status`, { status }).then(r => r.data),
  getDashboardStatus: () => api.get('/dashboard/status').then(r => r.data),
};

// Bookings API
export const bookingsApi = {
  getAll: (params?: Record<string, string>) =>
    api.get('/bookings', { params }).then(r => r.data),
  getById: (id: number) => api.get(`/bookings/${id}`).then(r => r.data),
  create: (data: any) => api.post('/bookings', data).then(r => r.data),
  checkIn: (id: number) => api.post(`/bookings/${id}/check-in`).then(r => r.data),
  checkOut: (id: number, data: any) => api.post(`/bookings/${id}/check-out`, data).then(r => r.data),
  processPayment: (id: number, data: any) => api.post(`/bookings/${id}/payment`, data).then(r => r.data),
  getReceipt: (id: number) => api.get(`/bookings/${id}/receipt`).then(r => r.data),
  search: (query: string) => api.get('/bookings', { params: { search: query } }).then(r => r.data),
};

// Admin API
export const adminApi = {
  getCompany: () => api.get('/admin/company').then(r => r.data),
  updateCompany: (data: any) => api.put('/admin/company', data).then(r => r.data),
  getUsers: () => api.get('/admin/users').then(r => r.data),
  createUser: (data: any) => api.post('/admin/users', data).then(r => r.data),
  resetUser: (userId: string) => api.put(`/admin/users/${userId}/reset`).then(r => r.data),
  getModuleAccess: () => api.get('/admin/module-access').then(r => r.data),
};

// Reports API
export const reportsApi = {
  daily: (date: string) => api.get('/reports/daily', { params: { date } }).then(r => r.data),
  weekly: (startDate: string, endDate: string) =>
    api.get('/reports/weekly', { params: { startDate, endDate } }).then(r => r.data),
  shift: (date: string, userId?: string) =>
    api.get('/reports/shift', { params: { date, userId } }).then(r => r.data),
};

export default api;