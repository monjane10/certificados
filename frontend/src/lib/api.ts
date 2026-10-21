import { API_URL, apiRequest } from './http';

export const api = {
  me() {
    return apiRequest('/api/me');
  },
  getProfile() {
    return apiRequest('/api/profile');
  },
  updateProfile(patch: {
    organization_name?: string;
    phone?: string;
    logo_path?: string | null;
    assinatura_path?: string | null;
    responsavel_nome?: string | null;
    responsavel_cargo?: string | null;
  }) {
    return apiRequest('/api/profile', { method: 'PATCH', body: patch });
  },
  adminOverview() {
    return apiRequest('/api/admin/overview');
  },
};

export { API_URL };
