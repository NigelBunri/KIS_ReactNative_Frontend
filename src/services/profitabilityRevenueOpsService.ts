import billingRoutes from '@/network/routes/billingRoutes';
import { getRequest } from '@/network/get';

export type ProfitabilityRevenueOpsEvidenceSummary = {
  enabled: false;
  access: string;
  go_no_go: string;
  ready_count: number;
  total_count: number;
  readiness_percent: number;
  evidence_areas: Record<string, any>;
  launch_gate: Record<string, any>;
  subscription_lifecycle: Record<string, any>;
  guardrails: Record<string, boolean>;
  next_readiness_steps: string[];
};

export const LOCAL_REVENUE_OPS_EVIDENCE: ProfitabilityRevenueOpsEvidenceSummary = {
  enabled: false,
  access: 'staff_read_only_local_fallback',
  go_no_go: 'no_go_evidence_required',
  ready_count: 0,
  total_count: 12,
  readiness_percent: 0,
  evidence_areas: {
    legal_review: { label: 'Legal review', status: 'evidence_required', ready: false },
    pastoral_child_safety_review: { label: 'Pastoral and child-safety review', status: 'evidence_required', ready: false },
    flutterwave_sandbox_proof: { label: 'Flutterwave sandbox proof', status: 'evidence_required', ready: false },
    rollback_proof: { label: 'Rollback proof', status: 'evidence_required', ready: false },
  },
  launch_gate: { go_no_go: 'no_go_local_fallback', readiness_percent: 0 },
  subscription_lifecycle: { mode: 'local_fallback_sandbox_readiness_preview_only', provider: 'flutterwave' },
  guardrails: {
    staff_only: true,
    read_only: true,
    no_live_charges: true,
    no_payment_instrument_collection: true,
    no_entitlement_enforcement: true,
    no_private_health_payment_verification_data: true,
    no_raw_provider_payloads: true,
    promotional_credits_non_cash: true,
  },
  next_readiness_steps: [
    'Define evidence storage model with private attachments and audit history.',
    'Attach Flutterwave sandbox payment-link and webhook replay proof before monetization launch.',
  ],
};

export const fetchProfitabilityRevenueOpsEvidence =
  async (): Promise<ProfitabilityRevenueOpsEvidenceSummary> => {
    const response = await getRequest(billingRoutes.profitabilityRevenueOpsEvidence, {
      forceNetwork: true,
      errorMessage: 'Unable to load revenue operations evidence.',
    });
    return response?.success && response.data
      ? response.data
      : LOCAL_REVENUE_OPS_EVIDENCE;
  };
