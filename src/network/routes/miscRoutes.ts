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
    launchOpsReadiness: `${API_BASE_URL}/api/v1/core/admin/launch-ops-readiness/`,
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
  surveys: {
    list: `${API_BASE_URL}/api/v1/surveys/`,
    detail: (id: string) => `${API_BASE_URL}/api/v1/surveys/${id}/`,
    questions: `${API_BASE_URL}/api/v1/questions/`,
    question: (id: string) => `${API_BASE_URL}/api/v1/questions/${id}/`,
    responses: `${API_BASE_URL}/api/v1/responses/`,
    response: (id: string) => `${API_BASE_URL}/api/v1/responses/${id}/`,
  },
  bridge: {
    accounts: `${API_BASE_URL}/api/v1/bridge/accounts/`,
    account: (id: string) => `${API_BASE_URL}/api/v1/bridge/accounts/${id}/`,
    threads: `${API_BASE_URL}/api/v1/bridge/threads/`,
    thread: (id: string) => `${API_BASE_URL}/api/v1/bridge/threads/${id}/`,
    messages: `${API_BASE_URL}/api/v1/bridge/messages/`,
    message: (id: string) => `${API_BASE_URL}/api/v1/bridge/messages/${id}/`,
    automations: `${API_BASE_URL}/api/v1/bridge/automations/`,
    automation: (id: string) => `${API_BASE_URL}/api/v1/bridge/automations/${id}/`,
    accountSync: (id: string) => `${API_BASE_URL}/api/v1/bridge/accounts/${id}/sync/`,
    threadArchive: (id: string) => `${API_BASE_URL}/api/v1/bridge/threads/${id}/archive/`,
    analytics: `${API_BASE_URL}/api/v1/bridge/analytics/`,
  },
  aiIntegration: {
    models: `${API_BASE_URL}/api/v1/ai-models/`,
    jobs: `${API_BASE_URL}/api/v1/ai-jobs/`,
    translations: `${API_BASE_URL}/api/v1/translations/`,
    qnaSessions: `${API_BASE_URL}/api/v1/qna-sessions/`,
    schedules: `${API_BASE_URL}/api/v1/schedules/`,
    schedule: (id: string) => `${API_BASE_URL}/api/v1/schedules/${id}/`,
    pipelines: `${API_BASE_URL}/api/v1/pipelines/`,
    pipeline: (id: string) => `${API_BASE_URL}/api/v1/pipelines/${id}/`,
  },
  mediaAssets: {
    assets: `${API_BASE_URL}/api/v1/media/assets/`,
    asset: (id: string) => `${API_BASE_URL}/api/v1/media/assets/${id}/`,
    jobs: `${API_BASE_URL}/api/v1/media/jobs/`,
    safetyScan: (id: string) => `${API_BASE_URL}/api/v1/media/media-safety-scans/${id}/`,
  },
};

export default miscRoutes;
