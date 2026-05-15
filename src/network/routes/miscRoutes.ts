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
    flagsQueueSummary: `${API_BASE_URL}/api/v1/flags/queue-summary/`,
    auditLogs: `${API_BASE_URL}/api/v1/audit-logs/`,
    userBlocks: `${API_BASE_URL}/api/v1/user-blocks/`,
    staffOperationsQueue: `${API_BASE_URL}/api/v1/moderation/staff/operations-queue/`,
    staffOperationAction: `${API_BASE_URL}/api/v1/moderation/staff/operation-action/`,
  },
};

export default miscRoutes;
