import { API_BASE_URL } from '../config';

const miscRoutes = {
  moderation: {
    flags: `${API_BASE_URL}/api/v1/flags/`,
    flagsQueueSummary: `${API_BASE_URL}/api/v1/flags/queue-summary/`,
    auditLogs: `${API_BASE_URL}/api/v1/audit-logs/`,
    userBlocks: `${API_BASE_URL}/api/v1/user-blocks/`,
  },
};

export default miscRoutes;
