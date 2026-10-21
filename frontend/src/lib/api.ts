import { API_URL, apiRequest } from './http';

export const api = {
  me() {
    return apiRequest('/api/me');
  },
  getProfile() {
    return apiRequest('/api/profile');
  },
  updateProfile(patch: { organization_name?: string; phone?: string }) {
    return apiRequest('/api/profile', { method: 'PATCH', body: patch });
  },
  adminOverview() {
    return apiRequest('/api/admin/overview');
  },
};

export { API_URL };
