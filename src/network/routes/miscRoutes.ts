import { API_BASE_URL } from '../config';

const miscRoutes = {
  uploads: {
    file: `${API_BASE_URL}/uploads/file`,
  },
  moderation: {
    flags: `${API_BASE_URL}/api/v1/flags/`,
    flagsQueueSummary: `${API_BASE_URL}/api/v1/flags/queue-summary/`,
    auditLogs: `${API_BASE_URL}/api/v1/audit-logs/`,
    userBlocks: `${API_BASE_URL}/api/v1/user-blocks/`,
  },
};

export default miscRoutes;
