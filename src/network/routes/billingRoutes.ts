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
  profitabilityEntitlements: `${API_BASE_URL}/api/v1/billing/profitability-entitlements/`,
  profitabilityCommandCenter: `${API_BASE_URL}/api/v1/billing/profitability-command-center/`,
  profitabilityLaunchGate: `${API_BASE_URL}/api/v1/billing/profitability-launch-gate/`,
  profitabilitySubscriptionLifecycle: `${API_BASE_URL}/api/v1/billing/profitability-subscription-lifecycle/`,
  profitabilityRevenueOpsEvidence: `${API_BASE_URL}/api/v1/billing/profitability-revenue-ops-evidence/`,
  profitabilityEvidenceWorkflowPlan: `${API_BASE_URL}/api/v1/billing/profitability-evidence-workflow-plan/`,
  profitabilityRevenueReadiness: `${API_BASE_URL}/api/v1/billing/profitability-revenue-readiness/`,
  profitabilityStagingProofWorkflows: `${API_BASE_URL}/api/v1/billing/profitability-staging-proof-workflows/`,
  profitabilityProductionGoNoGo: `${API_BASE_URL}/api/v1/billing/profitability-production-go-no-go/`,
  profitabilityBetaLaunchPlan: `${API_BASE_URL}/api/v1/billing/profitability-beta-launch-plan/`,
  profitabilityBetaOperations: `${API_BASE_URL}/api/v1/billing/profitability-beta-operations/`,
  revenueLaunchEvidence: `${API_BASE_URL}/api/v1/billing/revenue-launch-evidence/`,
  revenueLaunchEvidenceDetail: (id: string) => `${API_BASE_URL}/api/v1/billing/revenue-launch-evidence/${id}/`,
  revenueLaunchEvidenceSubmit: (id: string) => `${API_BASE_URL}/api/v1/billing/revenue-launch-evidence/${id}/submit/`,
  revenueLaunchEvidenceApprove: (id: string) => `${API_BASE_URL}/api/v1/billing/revenue-launch-evidence/${id}/approve/`,
  revenueLaunchEvidenceNeedsChanges: (id: string) => `${API_BASE_URL}/api/v1/billing/revenue-launch-evidence/${id}/needs-changes/`,
  revenueLaunchEvidenceReject: (id: string) => `${API_BASE_URL}/api/v1/billing/revenue-launch-evidence/${id}/reject/`,
  revenueLaunchEvidenceRevoke: (id: string) => `${API_BASE_URL}/api/v1/billing/revenue-launch-evidence/${id}/revoke/`,
  walletReceipt: `${API_BASE_URL}/api/v1/wallet/receipt/`,
  walletRefund: `${API_BASE_URL}/api/v1/wallet/refund/`,
  walletTransactions: `${API_BASE_URL}/api/v1/wallet/transactions/`,
  walletTransactionDelete: (id: string) => `${API_BASE_URL}/api/v1/wallet/transactions/${id}/`,
  walletTransactionEmailReceipt: (id: string) => `${API_BASE_URL}/api/v1/wallet/transactions/${id}/email-receipt/`,
  // /api/v1/invoices/ was dead (apps.tiers' quarantined placeholder, never
  // routed — see config/urls.py). Real invoices are a formatted view over
  // paid MarketplaceOrders; see apps.commerce.InvoiceListView/
  // InvoiceDetailView.
  invoices: `${API_BASE_URL}/api/v1/commerce/invoices/`,
  invoice: (id: string) => `${API_BASE_URL}/api/v1/commerce/invoices/${id}/`,
  loyalty: `${API_BASE_URL}/api/v1/commerce/loyalty/`,
  loyaltyBalance: `${API_BASE_URL}/api/v1/commerce/loyalty/balance/`,
  loyaltyRules: `${API_BASE_URL}/api/v1/commerce/loyalty/rules/`,
  loyaltyRedeem: `${API_BASE_URL}/api/v1/commerce/loyalty/redeem/`,
  promoCodes: `${API_BASE_URL}/api/v1/promo-codes/`,
  promoCode: (id: string) => `${API_BASE_URL}/api/v1/promo-codes/${id}/`,
  promoCodeValidate: `${API_BASE_URL}/api/v1/promo-codes/validate/`,
  promoCodeRedeem: `${API_BASE_URL}/api/v1/promo-codes/redeem-code/`,
  directPaymentIntents: `${API_BASE_URL}/api/v1/direct-payments/intents/`,
  directPaymentAudit: `${API_BASE_URL}/api/v1/direct-payment-audit/`,
  // apps.tiers' /plans/ was quarantined (dead, unrouted — see
  // config/urls.py) and superseded by apps.accounts' AccountTier, exposed
  // at /tiers/. This pointed at the dead URL, so the admin "Manage
  // subscription tiers" dashboard always 404'd with an empty plans list.
  tierPlans: `${API_BASE_URL}/api/v1/tiers/`,
  tierPlan: (id: string) => `${API_BASE_URL}/api/v1/tiers/${id}/`,
  tierSubscriptions: `${API_BASE_URL}/api/v1/subscriptions/`,
  tierSubscription: (id: string) => `${API_BASE_URL}/api/v1/subscriptions/${id}/`,
  tierEntitlements: `${API_BASE_URL}/api/v1/entitlements/`,
  tierUsage: `${API_BASE_URL}/api/v1/usage/`,
  tierCampaigns: `${API_BASE_URL}/api/v1/campaigns/`,
  tierCampaign: (id: string) => `${API_BASE_URL}/api/v1/campaigns/${id}/`,
};

export default billingRoutes;
