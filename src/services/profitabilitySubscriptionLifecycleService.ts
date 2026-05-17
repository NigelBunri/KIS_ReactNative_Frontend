import billingRoutes from '@/network/routes/billingRoutes';
import { getRequest } from '@/network/get';

export type ProfitabilitySubscriptionLifecycleSummary = {
  enabled: false;
  mode: string;
  provider: string;
  provider_links_enabled: boolean;
  billing_enabled: boolean;
  entitlements_enforced: boolean;
  trials_enabled: boolean;
  payment_instruments_collected: boolean;
  production_provider_connected: boolean;
  subscription_lifecycle_states: Record<string, any>;
  provider_sandbox_checks: Record<string, any>;
  one_time_billing_readiness: Record<string, any>;
  invoice_receipt_readiness: Record<string, any>;
  support_escalation: Record<string, any>;
  launch_gate: Record<string, any>;
  catalog_snapshot: Record<string, any>;
  guardrails: Record<string, boolean>;
  next_readiness_steps: string[];
};

export const LOCAL_PROFITABILITY_SUBSCRIPTION_LIFECYCLE: ProfitabilitySubscriptionLifecycleSummary = {
  enabled: false,
  mode: 'local_fallback_sandbox_readiness_preview_only',
  provider: 'flutterwave',
  provider_links_enabled: false,
  billing_enabled: false,
  entitlements_enforced: false,
  trials_enabled: false,
  payment_instruments_collected: false,
  production_provider_connected: false,
  subscription_lifecycle_states: {
    trial_ready: { label: 'Trial readiness', status: 'planned_not_enabled', enabled: false },
    active_subscription: { label: 'Active subscription', status: 'planned_not_enabled', enabled: false },
    grace_period: { label: 'Grace period', status: 'planned_not_enabled', enabled: false },
    cancelled: { label: 'Cancellation', status: 'planned_not_enabled', enabled: false },
  },
  provider_sandbox_checks: {
    flutterwave_sandbox_keys: { label: 'Flutterwave sandbox credentials', status: 'not_connected_for_billing', ready: false },
    webhook_signature_verification: { label: 'Webhook signature verification', status: 'planned_not_enabled', ready: false },
  },
  one_time_billing_readiness: {
    promotion_campaign_billing: { label: 'Promotion campaign billing', status: 'preview_only', enabled: false },
    verification_processing_fee: { label: 'Verification processing fee', status: 'preview_only', enabled: false },
  },
  invoice_receipt_readiness: { status: 'planned_not_enabled' },
  support_escalation: { status: 'planned_not_enabled', queues: [] },
  launch_gate: { go_no_go: 'no_go_local_fallback', readiness_percent: 0 },
  catalog_snapshot: {},
  guardrails: {
    no_live_charges: true,
    no_production_provider_connection: true,
    no_payment_instrument_collection: true,
    no_entitlement_enforcement: true,
    no_kis_credit_cash_value: true,
    usd_direct_provider_first: true,
  },
  next_readiness_steps: [
    'Capture Flutterwave sandbox payment-link and signed webhook evidence.',
    'Define subscription state machine and entitlement downgrade rules.',
  ],
};

export const fetchProfitabilitySubscriptionLifecycleSummary =
  async (): Promise<ProfitabilitySubscriptionLifecycleSummary> => {
    const response = await getRequest(billingRoutes.profitabilitySubscriptionLifecycle, {
      forceNetwork: true,
      errorMessage: 'Unable to load subscription lifecycle readiness.',
    });
    return response?.success && response.data
      ? response.data
      : LOCAL_PROFITABILITY_SUBSCRIPTION_LIFECYCLE;
  };
