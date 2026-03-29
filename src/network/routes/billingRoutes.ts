import { API_BASE_URL } from '../config';

const billingRoutes = {
  reconciliations: `${API_BASE_URL}/api/v1/billing/reconciliations/`,
  reconciliation: (id: string) => `${API_BASE_URL}/api/v1/billing/reconciliations/${id}/`,
  reconcile: (id: string) => `${API_BASE_URL}/api/v1/billing/reconciliations/${id}/reconcile/`,
  claims: `${API_BASE_URL}/api/v1/billing/claims/`,
  claim: (id: string) => `${API_BASE_URL}/api/v1/billing/claims/${id}/`,
  claimStatus: (id: string) => `${API_BASE_URL}/api/v1/billing/claims/${id}/update_status/`,
  disputes: `${API_BASE_URL}/api/v1/billing/disputes/`,
  dispute: (id: string) => `${API_BASE_URL}/api/v1/billing/disputes/${id}/`,
  disputeResolve: (id: string) => `${API_BASE_URL}/api/v1/billing/disputes/${id}/resolve/`,
  pricingInsights: `${API_BASE_URL}/api/v1/billing/pricing-insights/`,
  walletReceipt: `${API_BASE_URL}/api/v1/billing/wallet/receipt/`,
};

export default billingRoutes;
