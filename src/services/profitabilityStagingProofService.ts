import billingRoutes from '@/network/routes/billingRoutes';
import { getRequest } from '@/network/get';

export type StagingProofWorkflow = {
  key: string;
  area: string;
  title: string;
  owner_role: string;
  required_reviewer_role: string;
  private_media_required: boolean;
  redacted_summary_template: string;
  checklist: string[];
  live_provider_call: boolean;
  stores_raw_payload: boolean;
  stores_payment_instrument: boolean;
};

export type StagingProofWorkflowSummary = {
  enabled: false;
  access: string;
  mode: string;
  workflows: Record<string, StagingProofWorkflow>;
  readiness: Record<string, any>;
  guardrails: Record<string, boolean>;
  next_readiness_steps: string[];
};

export const LOCAL_STAGING_PROOF_WORKFLOWS: StagingProofWorkflowSummary = {
  enabled: false,
  access: 'staff_read_only_local_fallback',
  mode: 'staging_evidence_capture_templates_only',
  workflows: {},
  readiness: { go_no_go: 'no_go_local_fallback', readiness_percent: 0 },
  guardrails: {
    staging_only: true,
    templates_only: true,
    no_live_charges: true,
    no_production_provider_calls: true,
    no_entitlement_enforcement: true,
    private_media_references_only: true,
    no_raw_provider_payloads: true,
    no_payment_instrument_collection: true,
    no_private_health_payment_verification_data: true,
  },
  next_readiness_steps: [
    'Run approved staging sandbox checks outside this endpoint.',
    'Create evidence using redacted summaries and private MediaAsset ids only.',
  ],
};

export const fetchStagingProofWorkflows =
  async (): Promise<StagingProofWorkflowSummary> => {
    const response = await getRequest(billingRoutes.profitabilityStagingProofWorkflows, {
      forceNetwork: true,
      errorMessage: 'Unable to load staging proof workflows.',
    });
    return response?.success && response.data
      ? response.data
      : LOCAL_STAGING_PROOF_WORKFLOWS;
  };
