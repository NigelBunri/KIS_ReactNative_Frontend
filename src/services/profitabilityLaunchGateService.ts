import billingRoutes from '@/network/routes/billingRoutes';
import { getRequest } from '@/network/get';

export type ProfitabilityLaunchGateSummary = {
  enabled: false;
  go_no_go: string;
  readiness_percent: number;
  ready_count: number;
  total_count: number;
  blockers: string[];
  checklist: Record<string, {
    label: string;
    owner: string;
    status: string;
    ready: boolean;
    evidence_required: string[];
    evidence_attached: string[];
    flags?: Record<string, boolean>;
    risky_enabled_flags?: string[];
  }>;
  production_feature_flags: {
    flags: Record<string, boolean>;
    ready: boolean;
    status: string;
    risky_enabled_flags: string[];
    note: string;
  };
  billing_status: Record<string, any>;
  profitability_command_center: Record<string, any>;
  guardrails: Record<string, boolean>;
  next_readiness_steps: string[];
};

export const LOCAL_PROFITABILITY_LAUNCH_GATE: ProfitabilityLaunchGateSummary = {
  enabled: false,
  go_no_go: 'no_go_local_fallback',
  readiness_percent: 0,
  ready_count: 0,
  total_count: 12,
  blockers: [
    'Live charges are disabled.',
    'Subscriptions are disabled.',
    'Entitlement enforcement is disabled.',
    'Conversion tracking is disabled.',
  ],
  checklist: {
    legal_review: {
      label: 'Legal review',
      owner: 'legal_counsel',
      status: 'evidence_required',
      ready: false,
      evidence_required: ['pricing terms approved', 'refund/cancellation policy approved'],
      evidence_attached: [],
    },
    flutterwave_direct_payment_proof: {
      label: 'Flutterwave/direct-payment proof',
      owner: 'payments',
      status: 'evidence_required',
      ready: false,
      evidence_required: ['sandbox payment link proof', 'signed webhook proof'],
      evidence_attached: [],
    },
    production_feature_flag_state: {
      label: 'Production feature flag state',
      owner: 'release_management',
      status: 'safe_preview_flags_off',
      ready: true,
      evidence_required: ['production env flag screenshot/redacted export'],
      evidence_attached: [],
      flags: {},
      risky_enabled_flags: [],
    },
  },
  production_feature_flags: {
    flags: {},
    ready: true,
    status: 'safe_preview_flags_off',
    risky_enabled_flags: [],
    note: 'All launch-sensitive monetization flags should remain off until go/no-go approval.',
  },
  billing_status: {},
  profitability_command_center: { tracking_live: false },
  guardrails: {
    no_live_charges: true,
    no_subscriptions_enabled: true,
    no_entitlement_enforcement: true,
    no_promotion_checkout: true,
    no_enterprise_lead_capture: true,
    no_conversion_tracking: true,
    promotional_credits_non_cash: true,
  },
  next_readiness_steps: [
    'Attach legal, pastoral/child-safety, tax/accounting, and privacy approvals.',
    'Attach Flutterwave sandbox payment and signed webhook evidence.',
  ],
};

export const fetchProfitabilityLaunchGateSummary =
  async (): Promise<ProfitabilityLaunchGateSummary> => {
    const response = await getRequest(billingRoutes.profitabilityLaunchGate, {
      forceNetwork: true,
      errorMessage: 'Unable to load profitability launch gate.',
    });
    return response?.success && response.data
      ? response.data
      : LOCAL_PROFITABILITY_LAUNCH_GATE;
  };
