import billingRoutes from '@/network/routes/billingRoutes';
import { getRequest } from '@/network/get';

export type BetaCohortState = 'ready' | 'paused' | 'blocked' | string;

export type BetaOperationsCohort = {
  key: string;
  label: string;
  state: BetaCohortState;
  reason: string;
  module_state: string;
  audience: string;
  invite_policy: {
    mode: string;
    public_invites_enabled: false;
    max_initial_cohort_size: number;
    eligible_when: string[];
    blocked_when: string[];
  };
  owner_tracking: {
    support_owner_role: string;
    rollback_owner_role: string;
    incident_owner_role: string;
    owner_assignment_status: string;
    requires_named_people_before_beta: boolean;
  };
  support_readiness: {
    playbook_key: string;
    status: string;
    checklist: string[];
  };
  rollback_readiness: {
    playbook_key: string;
    status: string;
    checklist: string[];
  };
  incident_escalation: {
    severity_levels: string[];
    first_response_target_minutes: number;
    escalate_immediately_for: string[];
  };
  missing_evidence_areas: string[];
  frontend_indicator: {
    label: string;
    tone: string;
  };
};

export type ProfitabilityBetaOperationsSummary = {
  enabled: false;
  access: string;
  mode: string;
  go_no_go: string;
  readiness_percent: number;
  ready_count: number;
  paused_count: number;
  blocked_count: number;
  total_count: number;
  cohorts: Record<string, BetaOperationsCohort>;
  global_invite_rules: string[];
  operations_checklist: string[];
  support_templates: Record<string, string>;
  final_beta_readiness?: Record<string, {
    state: string;
    required_before_invites?: boolean;
    summary: string;
  }>;
  guardrails: Record<string, boolean>;
  source_beta_plan: {
    status?: string;
    readiness_percent?: number;
    ready_count?: number;
    total_count?: number;
  };
  next_readiness_steps: string[];
};

export const LOCAL_BETA_OPERATIONS: ProfitabilityBetaOperationsSummary = {
  enabled: false,
  access: 'staff_read_only_local_fallback',
  mode: 'beta_cohort_operations_plan_live_charges_gated',
  go_no_go: 'no_go_local_fallback',
  readiness_percent: 0,
  ready_count: 0,
  paused_count: 0,
  blocked_count: 0,
  total_count: 0,
  cohorts: {},
  global_invite_rules: [
    'Invite-only; no public beta signup.',
    'Keep live charges, payment instruments, and entitlement enforcement disabled.',
  ],
  operations_checklist: [
    'Reconnect to the backend beta operations endpoint before beta approval.',
  ],
  support_templates: {},
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
  source_beta_plan: {
    status: 'unavailable',
    readiness_percent: 0,
    ready_count: 0,
    total_count: 0,
  },
  next_readiness_steps: [
    'Use the backend beta operations summary before inviting any cohort.',
  ],
};

export const fetchProfitabilityBetaOperations =
  async (): Promise<ProfitabilityBetaOperationsSummary> => {
    const response = await getRequest(billingRoutes.profitabilityBetaOperations, {
      forceNetwork: true,
      errorMessage: 'Unable to load beta cohort operations plan.',
    });
    return response?.success && response.data
      ? response.data
      : LOCAL_BETA_OPERATIONS;
  };
