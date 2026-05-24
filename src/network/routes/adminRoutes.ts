import { API_BASE_URL } from '../config';

const ADMIN_BASE = `${API_BASE_URL}/control/admin`;

const adminRoutes = {
  // ── Admin Control — live platform stats ───────────────────────────────
  control: {
    dashboardOverview: `${ADMIN_BASE}/dashboard/overview/`,
    liveMetrics: `${ADMIN_BASE}/live/metrics/`,
    auditEntries: `${ADMIN_BASE}/audit/entries/`,
    activityStream: `${ADMIN_BASE}/activity/stream/`,
    suspiciousFlags: `${ADMIN_BASE}/activity/flags/`,
    monitoringAlerts: `${ADMIN_BASE}/monitoring/alerts/`,
    performance: `${ADMIN_BASE}/monitoring/performance/`,
    microApps: `${ADMIN_BASE}/micro/apps/`,
  },

  // ── User management ───────────────────────────────────────────────────
  users: {
    list: `${ADMIN_BASE}/users/`,
    platformStats: `${ADMIN_BASE}/users/platform-stats/`,
    detail: (id: string) => `${ADMIN_BASE}/users/${id}/`,
    ban: (id: string) => `${ADMIN_BASE}/users/${id}/ban/`,
    unban: (id: string) => `${ADMIN_BASE}/users/${id}/unban/`,
    setTier: (id: string) => `${ADMIN_BASE}/users/${id}/set-tier/`,
  },

  // ── Content moderation ────────────────────────────────────────────────
  content: {
    queue: `${ADMIN_BASE}/content/queue/`,
    summary: `${ADMIN_BASE}/content/summary/`,
    trends: `${ADMIN_BASE}/content/trends/`,
    flagAction: (flagId: string) => `${ADMIN_BASE}/content/flags/${flagId}/action/`,
  },

  // ── Partner oversight (admin-scoped, separate from broadcastRoutes.partners) ──
  adminPartners: {
    list: `${ADMIN_BASE}/partners/`,
    stats: `${ADMIN_BASE}/partners/stats/`,
    detail: (id: string) => `${ADMIN_BASE}/partners/${id}/`,
  },

  // ── Platform analytics ────────────────────────────────────────────────
  analytics: {
    revenue: `${ADMIN_BASE}/analytics/revenue/`,
    engagement: `${ADMIN_BASE}/analytics/engagement/`,
    partnerStats: `${ADMIN_BASE}/partners/stats/`,
    adminPartnerStats: `${ADMIN_BASE}/partners/stats/`,
    userStats: `${ADMIN_BASE}/users/platform-stats/`,
    contentTrends: `${ADMIN_BASE}/content/trends/`,
  },

  // ── Legacy keys (kept for backward compat with existing screens) ──────
  events: {
    list: `${API_BASE_URL}/api/v1/events/`,
    create: `${API_BASE_URL}/api/v1/events/`,
    tickets: `${API_BASE_URL}/api/v1/events/tickets/`,
    attendances: `${API_BASE_URL}/api/v1/events/attendances/`,
  },
  surveys: {
    surveys: `${API_BASE_URL}/api/v1/surveys/`,
    questions: `${API_BASE_URL}/api/v1/surveys/questions/`,
    responses: `${API_BASE_URL}/api/v1/surveys/responses/`,
  },
  media: {
    assets: `${API_BASE_URL}/api/v1/media/`,
    safetyScans: `${API_BASE_URL}/api/v1/media/safety-scans/`,
  },
  notifications: {
    notifications: `${API_BASE_URL}/api/v1/notifications/`,
    templates: `${API_BASE_URL}/api/v1/notifications/templates/`,
    rules: `${API_BASE_URL}/api/v1/notifications/rules/`,
    deviceTokens: `${API_BASE_URL}/api/v1/notifications/device-tokens/`,
    deviceTokenRegister: `${API_BASE_URL}/api/v1/notifications/device-tokens/register/`,
    deviceTokenUnregister: `${API_BASE_URL}/api/v1/notifications/device-tokens/unregister/`,
    unreadCount: `${API_BASE_URL}/api/v1/notifications/unread-count/`,
    mainTabBadgeCounts: `${API_BASE_URL}/api/v1/notifications/main-tab-badge-counts/`,
    markSourceRead: `${API_BASE_URL}/api/v1/notifications/mark-source-read/`,
    markAllRead: `${API_BASE_URL}/api/v1/notifications/mark-all-read/`,
    attentionSummary: `${API_BASE_URL}/api/v1/notifications/attention-summary/`,
    attentionPreferences: `${API_BASE_URL}/api/v1/notifications/attention-preferences/`,
  },
};

export default adminRoutes;
