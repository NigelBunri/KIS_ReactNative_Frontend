import { API_BASE_URL } from '../config';

// apps.bots (Django) — KIS Bot Platform, Phase 1: bot identity/ownership,
// OAuth2 client-credentials issuance, resource grants (owner-authorized
// connections to a Group/Channel/Community/Partner/direct conversation),
// webhook subscriptions, optional AI provider connection, activity log,
// and human-approval workflow for sensitive bot actions. Eligibility
// (Business tier and above) and every permission check happen
// server-side on every call — this client never decides what it's
// allowed to do.
const botsRoutes = {
  list: `${API_BASE_URL}/api/v1/bots/`,
  // Phase 5 — owner dashboard overview and analytics, scoped across
  // every bot this user owns (not a single-bot-id path).
  overview: `${API_BASE_URL}/api/v1/bots/overview/`,
  analytics: `${API_BASE_URL}/api/v1/bots/analytics/`,
  analyticsExport: `${API_BASE_URL}/api/v1/bots/analytics/export/`,
  detail: (id: string) => `${API_BASE_URL}/api/v1/bots/${id}/`,
  activate: (id: string) => `${API_BASE_URL}/api/v1/bots/${id}/activate/`,
  pause: (id: string) => `${API_BASE_URL}/api/v1/bots/${id}/pause/`,
  resume: (id: string) => `${API_BASE_URL}/api/v1/bots/${id}/resume/`,
  disconnect: (id: string) => `${API_BASE_URL}/api/v1/bots/${id}/disconnect/`,
  credential: (id: string) => `${API_BASE_URL}/api/v1/bots/${id}/credential/`,
  resourceGrants: (id: string) => `${API_BASE_URL}/api/v1/bots/${id}/resource-grants/`,
  resourceGrantDetail: (id: string, grantId: string) =>
    `${API_BASE_URL}/api/v1/bots/${id}/resource-grants/${grantId}/`,
  webhook: (id: string) => `${API_BASE_URL}/api/v1/bots/${id}/webhook/`,
  webhookRotateSecret: (id: string) => `${API_BASE_URL}/api/v1/bots/${id}/webhook/rotate-secret/`,
  webhookDeliveries: (id: string) => `${API_BASE_URL}/api/v1/bots/${id}/webhook/deliveries/`,
  webhookDeliveryRetry: (id: string, deliveryId: string) =>
    `${API_BASE_URL}/api/v1/bots/${id}/webhook/deliveries/${deliveryId}/retry/`,
  aiConnection: (id: string) => `${API_BASE_URL}/api/v1/bots/${id}/ai-connection/`,
  activity: (id: string) => `${API_BASE_URL}/api/v1/bots/${id}/activity/`,
  approvals: (id: string) => `${API_BASE_URL}/api/v1/bots/${id}/approvals/`,
  decideApproval: (approvalId: string) => `${API_BASE_URL}/api/v1/bots/approvals/${approvalId}/decide/`,
  // Phase 2 — no-code workflow builder
  workflows: (id: string) => `${API_BASE_URL}/api/v1/bots/${id}/workflows/`,
  workflowDetail: (id: string, workflowId: string) => `${API_BASE_URL}/api/v1/bots/${id}/workflows/${workflowId}/`,
  workflowTest: (id: string, workflowId: string) => `${API_BASE_URL}/api/v1/bots/${id}/workflows/${workflowId}/test/`,
  workflowPublish: (id: string, workflowId: string) => `${API_BASE_URL}/api/v1/bots/${id}/workflows/${workflowId}/publish/`,
  workflowPause: (id: string, workflowId: string) => `${API_BASE_URL}/api/v1/bots/${id}/workflows/${workflowId}/pause/`,
  workflowResume: (id: string, workflowId: string) => `${API_BASE_URL}/api/v1/bots/${id}/workflows/${workflowId}/resume/`,
  workflowVersions: (id: string, workflowId: string) => `${API_BASE_URL}/api/v1/bots/${id}/workflows/${workflowId}/versions/`,
  workflowRuns: (id: string, workflowId: string) => `${API_BASE_URL}/api/v1/bots/${id}/workflows/${workflowId}/runs/`,
  // Phase 4 — Knowledge and Memory
  knowledgeSources: (id: string) => `${API_BASE_URL}/api/v1/bots/${id}/knowledge/`,
  knowledgeSourceDetail: (id: string, sourceId: string) => `${API_BASE_URL}/api/v1/bots/${id}/knowledge/${sourceId}/`,
  knowledgeSourceDeactivate: (id: string, sourceId: string) => `${API_BASE_URL}/api/v1/bots/${id}/knowledge/${sourceId}/deactivate/`,
  knowledgeSourceReactivate: (id: string, sourceId: string) => `${API_BASE_URL}/api/v1/bots/${id}/knowledge/${sourceId}/reactivate/`,
  knowledgeTestRetrieval: (id: string) => `${API_BASE_URL}/api/v1/bots/${id}/knowledge/test-retrieval/`,
  memoryConfig: (id: string) => `${API_BASE_URL}/api/v1/bots/${id}/memory-config/`,
  memoryEntries: (id: string) => `${API_BASE_URL}/api/v1/bots/${id}/memory/`,
  memoryEntryDetail: (id: string, entryId: string) => `${API_BASE_URL}/api/v1/bots/${id}/memory/${entryId}/`,
};

export default botsRoutes;
