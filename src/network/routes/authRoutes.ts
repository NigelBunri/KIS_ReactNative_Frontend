import { API_BASE_URL } from '../config';

const authRoutes = {
  auth: {
    login: `${API_BASE_URL}/api/v1/auth/login/`,
    register: `${API_BASE_URL}/api/v1/auth/register/`,
    logout: `${API_BASE_URL}/api/v1/auth/logout/`,
    checkLogin: `${API_BASE_URL}/api/v1/users/me/`,
    otp: `${API_BASE_URL}/api/v1/auth/otp/initiate/`,
    sendDeviceCode: `${API_BASE_URL}/api/v1/auth/otp/verify/`,
    status: `${API_BASE_URL}/api/v1/auth/otp/status`,
    forgotPassword: `${API_BASE_URL}/api/v1/auth/password/forgot/`,
    resetPassword: `${API_BASE_URL}/api/v1/auth/password/reset/`,
    e2eeRegisterKeys: `${API_BASE_URL}/api/v1/auth/e2ee/keys/`,
    e2eeFetchBundle: (userId: string) => `${API_BASE_URL}/api/v1/auth/e2ee/keys/${userId}/`,
    checkContact: `${API_BASE_URL}/api/v1/users/check-contacts/`,
  },
  user: {
    profile: `${API_BASE_URL}/user-info/`,
    updateProfile: `${API_BASE_URL}/user-info/update/`,
    preferences: `${API_BASE_URL}/privacy-settings/`,
    detail: (id: string) => `${API_BASE_URL}/api/v1/users/${id}/`,
    resolveHandle: `${API_BASE_URL}/api/v1/users/resolve-handle/`,
  },
  profiles: {
    me: `${API_BASE_URL}/api/v1/profiles/me/`,
    view: (id: string) => `${API_BASE_URL}/api/v1/profiles/${id}/view/`,
    update: (id: string) => `${API_BASE_URL}/api/v1/profiles/${id}/`,
  },
  profilePrivacy: {
    list: `${API_BASE_URL}/api/v1/profile-privacy/`,
    detail: (id: string) => `${API_BASE_URL}/api/v1/profile-privacy/${id}/`,
  },
  profileArticles: {
    list: `${API_BASE_URL}/api/v1/profile-articles/`,
    detail: (id: string) => `${API_BASE_URL}/api/v1/profile-articles/${id}/`,
  },
  profilePreferences: {
    list: `${API_BASE_URL}/api/v1/profile-preferences/`,
    detail: (id: string) => `${API_BASE_URL}/api/v1/profile-preferences/${id}/`,
    me: `${API_BASE_URL}/api/v1/profile-preferences/me/`,
  },
  profileShowcases: {
    list: `${API_BASE_URL}/api/v1/profile-showcases/`,
    detail: (id: string) => `${API_BASE_URL}/api/v1/profile-showcases/${id}/`,
  },
  profileLanguages: {
    list: `${API_BASE_URL}/api/v1/profile-languages/`,
    detail: (id: string) => `${API_BASE_URL}/api/v1/profile-languages/${id}/`,
    sync: `${API_BASE_URL}/api/v1/profile-languages/sync/`,
  },
  profileItems: {
    experiences: `${API_BASE_URL}/api/v1/experiences/`,
    educations: `${API_BASE_URL}/api/v1/educations/`,
    skills: `${API_BASE_URL}/api/v1/skills/`,
    projects: `${API_BASE_URL}/api/v1/projects/`,
    recommendations: `${API_BASE_URL}/api/v1/recommendations/`,
  },
  subscriptions: {
    list: `${API_BASE_URL}/api/v1/subscriptions/`,
    detail: (id: string) => `${API_BASE_URL}/api/v1/subscriptions/${id}/`,
    create: `${API_BASE_URL}/api/v1/subscriptions/`,
  },
  contacts: {
    check: `${API_BASE_URL}/api/v1/users/check-contacts/`,
  },
};

export default authRoutes;
