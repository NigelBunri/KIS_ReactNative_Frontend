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
    // Public app-level dashboards — accessible to all authenticated users.
    // Used by PartnerInsightsScreen via fetchDashboardInsights().
    dashboards: `${API_BASE_URL}/api/v1/dashboards/`,
    // Admin-scoped analytics (superuser / staff only)
    adminDashboards: `${ADMIN_BASE}/analytics/dashboards/`,
    revenue: `${ADMIN_BASE}/analytics/revenue/`,
    engagement: `${ADMIN_BASE}/analytics/engagement/`,
    partnerStats: `${ADMIN_BASE}/partners/stats/`,
    adminPartnerStats: `${ADMIN_BASE}/partners/stats/`,
    userStats: `${ADMIN_BASE}/users/platform-stats/`,
    contentTrends: `${ADMIN_BASE}/content/trends/`,
  },

  // ── Legacy keys (kept for backward compat with existing screens) ──────
  // IMPORTANT: these keys overlap with socialRoutes — the spread in index.tsx
  // means adminRoutes wins. All keys from socialRoutes.events/surveys must be
  // present here so they survive the spread collision.
  events: {
    list: `${API_BASE_URL}/api/v1/events/`,
    create: `${API_BASE_URL}/api/v1/events/`,
    detail: (id: string) => `${API_BASE_URL}/api/v1/events/${id}/`,
    rsvp: `${API_BASE_URL}/api/v1/attendances/`,
    tickets: `${API_BASE_URL}/api/v1/events/tickets/`,
    attendances: `${API_BASE_URL}/api/v1/events/attendances/`,
  },
  surveys: {
    list: `${API_BASE_URL}/api/v1/surveys/`,
    surveys: `${API_BASE_URL}/api/v1/surveys/`,
    detail: (id: string) => `${API_BASE_URL}/api/v1/surveys/${id}/`,
    questions: `${API_BASE_URL}/api/v1/questions/`,
    question: (id: string) => `${API_BASE_URL}/api/v1/questions/${id}/`,
    responses: `${API_BASE_URL}/api/v1/responses/`,
    response: (id: string) => `${API_BASE_URL}/api/v1/responses/${id}/`,
  },
  media: {
    assets: `${API_BASE_URL}/api/v1/media/assets/`,
    safetyScans: `${API_BASE_URL}/api/v1/media/media-safety-scans/`,
  },
  notifications: {
    notifications: `${API_BASE_URL}/api/v1/notifications/`,
    templates: `${API_BASE_URL}/api/v1/notification-templates/`,
    rules: `${API_BASE_URL}/api/v1/notification-rules/`,
    deviceTokens: `${API_BASE_URL}/api/v1/notification-device-tokens/`,
    deviceTokenRegister: `${API_BASE_URL}/api/v1/notification-device-tokens/register/`,
    deviceTokenUnregister: `${API_BASE_URL}/api/v1/notification-device-tokens/unregister/`,
    unreadCount: `${API_BASE_URL}/api/v1/notifications/unread-count/`,
    mainTabBadgeCounts: `${API_BASE_URL}/api/v1/notifications/main-tab-badge-counts/`,
    markSourceRead: `${API_BASE_URL}/api/v1/notifications/mark-source-read/`,
    markAllRead: `${API_BASE_URL}/api/v1/notifications/mark-all-read/`,
    attentionSummary: `${API_BASE_URL}/api/v1/notifications/attention-summary/`,
    attentionPreferences: `${API_BASE_URL}/api/v1/notifications/attention-preferences/`,
    mention: `${API_BASE_URL}/api/v1/notifications/mention/`,
  },
};

export default adminRoutes;
