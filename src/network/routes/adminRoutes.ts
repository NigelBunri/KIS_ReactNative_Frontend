import { API_BASE_URL } from '../config';

const adminRoutes = {
  analytics: {
    metrics: `${API_BASE_URL}/api/v1/metrics/`,
    events: `${API_BASE_URL}/api/v1/events/`,
    dashboards: `${API_BASE_URL}/api/v1/dashboards/`,
    settings: `${API_BASE_URL}/api/v1/settings/`,
    flags: `${API_BASE_URL}/api/v1/flags/`,
    alerts: `${API_BASE_URL}/api/v1/alerts/`,
    engagement: `${API_BASE_URL}/api/v1/engagement/`,
  },
  events: {
    list: `${API_BASE_URL}/api/v1/api/events/`,
    tickets: `${API_BASE_URL}/api/v1/api/tickets/`,
    attendances: `${API_BASE_URL}/api/v1/api/attendances/`,
  },
  content: {
    contents: `${API_BASE_URL}/api/v1/contents/`,
    comments: `${API_BASE_URL}/api/v1/comments/`,
    tags: `${API_BASE_URL}/api/v1/tags/`,
  },
  surveys: {
    surveys: `${API_BASE_URL}/api/v1/surveys/`,
    questions: `${API_BASE_URL}/api/v1/questions/`,
    responses: `${API_BASE_URL}/api/v1/responses/`,
  },
  media: {
    assets: `${API_BASE_URL}/api/v1/assets/`,
    jobs: `${API_BASE_URL}/api/v1/jobs/`,
  },
  bridge: {
    accounts: `${API_BASE_URL}/api/v1/accounts/`,
    threads: `${API_BASE_URL}/api/v1/threads/`,
    messages: `${API_BASE_URL}/api/v1/messages/`,
    automations: `${API_BASE_URL}/api/v1/automations/`,
    analytics: `${API_BASE_URL}/api/v1/analytics/`,
  },
  tiers: {
    users: `${API_BASE_URL}/api/v1/users/`,
    organizations: `${API_BASE_URL}/api/v1/organizations/`,
    plans: `${API_BASE_URL}/api/v1/plans/`,
    subscriptions: `${API_BASE_URL}/api/v1/subscriptions/`,
    entitlements: `${API_BASE_URL}/api/v1/entitlements/`,
    usage: `${API_BASE_URL}/api/v1/usage/`,
    invoices: `${API_BASE_URL}/api/v1/invoices/`,
    flags: `${API_BASE_URL}/api/v1/flags/`,
    planFeatures: `${API_BASE_URL}/api/v1/plan-features/`,
    partnerSettings: `${API_BASE_URL}/api/v1/partner-settings/`,
    impactSettings: `${API_BASE_URL}/api/v1/impact-settings/`,
    campaigns: `${API_BASE_URL}/api/v1/campaigns/`,
    tickets: `${API_BASE_URL}/api/v1/tickets/`,
    holograms: `${API_BASE_URL}/api/v1/holograms/`,
    quantum: `${API_BASE_URL}/api/v1/quantum/`,
  },
  notifications: {
    notifications: `${API_BASE_URL}/api/v1/notifications/`,
    templates: `${API_BASE_URL}/api/v1/notification-templates/`,
    rules: `${API_BASE_URL}/api/v1/notification-rules/`,
  },
};

export default adminRoutes;
