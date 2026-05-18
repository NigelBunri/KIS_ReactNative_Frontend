import { API_BASE_URL } from '../config';

const miscRoutes = {
  uploads: {
    file: `${API_BASE_URL}/uploads/file`,
  },
  search: {
    unified: `${API_BASE_URL}/api/v1/core/search/unified/`,
  },
  recommendations: {
    foundation: `${API_BASE_URL}/api/v1/core/recommendations/foundation/`,
  },
  dashboards: {
    unified: `${API_BASE_URL}/api/v1/core/dashboards/unified/`,
    safetyCommandCenter: `${API_BASE_URL}/api/v1/core/admin/safety-command-center/`,
    securityLaunchGate: `${API_BASE_URL}/api/v1/core/admin/security-launch-gate/`,
  },
  performance: {
    offlinePolicy: `${API_BASE_URL}/api/v1/core/performance/offline-policy/`,
  },
  monetization: {
    safetySummary: `${API_BASE_URL}/api/v1/core/monetization/safety-summary/`,
  },
  ai: {
    safetyPolicy: `${API_BASE_URL}/api/v1/core/ai/safety-policy/`,
  },
  moderation: {
    flags: `${API_BASE_URL}/api/v1/flags/`,
    flag: (id: string) => `${API_BASE_URL}/api/v1/flags/${id}/`,
    flagReview: (id: string) => `${API_BASE_URL}/api/v1/flags/${id}/review/`,
    flagResolve: (id: string) => `${API_BASE_URL}/api/v1/flags/${id}/resolve/`,
    flagsQueueSummary: `${API_BASE_URL}/api/v1/flags/queue-summary/`,
    auditLogs: `${API_BASE_URL}/api/v1/audit-logs/`,
    userBlocks: `${API_BASE_URL}/api/v1/user-blocks/`,
    staffOperationsQueue: `${API_BASE_URL}/api/v1/moderation/staff/operations-queue/`,
    staffOperationAction: `${API_BASE_URL}/api/v1/moderation/staff/operation-action/`,
    moderationActions: `${API_BASE_URL}/api/v1/actions/`,
    userReputation: `${API_BASE_URL}/api/v1/user-reputation/`,
  },
  adminUsers: {
    list: `${API_BASE_URL}/api/v1/users/`,
    detail: (id: string) => `${API_BASE_URL}/api/v1/users/${id}/`,
    suspend: (id: string) => `${API_BASE_URL}/api/v1/users/${id}/suspend/`,
    recalcTrust: (id: string) => `${API_BASE_URL}/api/v1/users/${id}/recalc_trust/`,
  },
  linkPreview: `${API_BASE_URL}/api/v1/link-preview/`,
  translate: `${API_BASE_URL}/api/v1/translate/`,
};

export default miscRoutes;
