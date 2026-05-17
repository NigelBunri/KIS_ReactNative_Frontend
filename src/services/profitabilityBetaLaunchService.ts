import billingRoutes from '@/network/routes/billingRoutes';
import { getRequest } from '@/network/get';

export type ProfitabilityBetaModule = {
  key: string;
  label: string;
  audience: string;
  state: 'beta_not_ready' | 'beta_ready' | 'blocked' | string;
  reason: string;
  ready: boolean;
  support_playbook: string;
  rollback_playbook: string;
  required_evidence: Array<{
    area: string;
    label: string;
    state: string;
    ready: boolean;
    latest_record_id?: string;
    required_reviewer_role?: string;
  }>;
  missing_or_blocked_evidence: Array<{
    area: string;
    label: string;
    state: string;
    ready: boolean;
  }>;
  production_blockers: string[];
  live_charges_enabled: false;
  entitlements_enforced: false;
  payment_instruments_collected: false;
  eligibility_summary: string[];
};

export type ProfitabilityBetaLaunchSummary = {
  enabled: false;
  access: string;
  mode: string;
  go_no_go: string;
  readiness_percent: number;
  ready_count: number;
  blocked_count: number;
  not_ready_count: number;
  total_count: number;
  modules: Record<string, ProfitabilityBetaModule>;
  eligibility_rules: string[];
  support_playbooks: Record<string, string[]>;
  rollback_playbooks: Record<string, string[]>;
  guardrails: Record<string, boolean>;
  production_go_no_go: {
    status?: string;
    readiness_percent?: number;
    blocked_checks?: string[];
  };
  evidence_readiness: {
    status?: string;
    readiness_percent?: number;
    ready_count?: number;
    total_count?: number;
  };
  next_readiness_steps: string[];
};

export const LOCAL_BETA_LAUNCH_PLAN: ProfitabilityBetaLaunchSummary = {
  enabled: false,
  access: 'staff_read_only_local_fallback',
  mode: 'limited_beta_plan_live_charges_gated',
  go_no_go: 'no_go_local_fallback',
  readiness_percent: 0,
  ready_count: 0,
  blocked_count: 0,
  not_ready_count: 0,
  total_count: 0,
  modules: {},
  eligibility_rules: [
    'Keep beta invite-only and staff-approved.',
    'Keep live charges, provider calls, and entitlement enforcement disabled.',
  ],
  support_playbooks: {},
  rollback_playbooks: {},
  guardrails: {
    no_live_charges: true,
    no_production_provider_calls: true,
    no_entitlement_enforcement: true,
    no_payment_instrument_collection: true,
    no_promotion_checkout: true,
    no_enterprise_lead_capture: true,
    staff_only: true,
    read_only: true,
  },
  production_go_no_go: {
    status: 'unavailable',
    readiness_percent: 0,
    blocked_checks: ['local_fallback'],
  },
  evidence_readiness: {
    status: 'unavailable',
    readiness_percent: 0,
    ready_count: 0,
    total_count: 0,
  },
  next_readiness_steps: [
    'Reconnect to the backend beta launch plan endpoint before beta approval.',
  ],
};

export const fetchProfitabilityBetaLaunchPlan =
  async (): Promise<ProfitabilityBetaLaunchSummary> => {
    const response = await getRequest(billingRoutes.profitabilityBetaLaunchPlan, {
      forceNetwork: true,
      errorMessage: 'Unable to load limited beta monetization plan.',
    });
    return response?.success && response.data
      ? response.data
      : LOCAL_BETA_LAUNCH_PLAN;
  };
