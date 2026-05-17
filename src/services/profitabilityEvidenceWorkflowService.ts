import billingRoutes from '@/network/routes/billingRoutes';
import { getRequest } from '@/network/get';

export type ProfitabilityEvidenceWorkflowPlan = {
  enabled: false;
  access: string;
  workflow_mode: string;
  evidence_console: Record<string, any>;
  approval_states: string[];
  reviewer_roles: Array<Record<string, string>>;
  evidence_areas: Record<string, any>;
  model_plan: Record<string, any>;
  audit_model_plan: Record<string, any>;
  audit_event_types: string[];
  redacted_serializer_contract: Record<string, any>;
  reminder_policy: Record<string, any>;
  guardrails: Record<string, boolean>;
  next_readiness_steps: string[];
};

export const LOCAL_EVIDENCE_WORKFLOW_PLAN: ProfitabilityEvidenceWorkflowPlan = {
  enabled: false,
  access: 'staff_read_only_local_fallback',
  workflow_mode: 'planned_no_migrations_created',
  evidence_console: { go_no_go: 'no_go_local_fallback', readiness_percent: 0 },
  approval_states: ['draft', 'submitted', 'needs_changes', 'approved', 'rejected', 'expired', 'revoked'],
  reviewer_roles: [
    { key: 'legal_reviewer', label: 'Legal reviewer' },
    { key: 'payment_reviewer', label: 'Payment reviewer' },
    { key: 'release_manager', label: 'Release manager' },
  ],
  evidence_areas: {
    legal_review: { label: 'Legal review', default_state: 'draft' },
    flutterwave_sandbox_proof: { label: 'Flutterwave sandbox proof', requires_private_media_reference: true },
    rollback_proof: { label: 'Rollback proof', requires_private_media_reference: true },
  },
  model_plan: { model_name: 'RevenueLaunchEvidenceRecord', migration_status: 'planned_not_created' },
  audit_model_plan: { model_name: 'RevenueLaunchEvidenceAuditEvent', migration_status: 'planned_not_created', immutable: true },
  audit_event_types: ['evidence_record_created', 'evidence_record_approved', 'evidence_record_revoked'],
  redacted_serializer_contract: {
    serializer_name: 'RevenueLaunchEvidenceRecordStaffSerializer',
    status: 'planned_not_created',
    raw_document_storage: false,
    raw_provider_payload_storage: false,
  },
  reminder_policy: { status: 'planned_not_scheduled', review_windows_days: [30, 14, 7, 1] },
  guardrails: {
    no_database_migration_created: true,
    staff_only: true,
    read_only: true,
    private_media_references_only: true,
    no_raw_documents: true,
    no_raw_provider_payloads: true,
    no_payment_instrument_collection: true,
    no_live_charges: true,
    no_entitlement_enforcement: true,
  },
  next_readiness_steps: [
    'Create migrations only after staff access, audit, and private media rules are reviewed.',
    'Use private MediaAsset references and signed access only.',
  ],
};

export const fetchProfitabilityEvidenceWorkflowPlan =
  async (): Promise<ProfitabilityEvidenceWorkflowPlan> => {
    const response = await getRequest(billingRoutes.profitabilityEvidenceWorkflowPlan, {
      forceNetwork: true,
      errorMessage: 'Unable to load evidence workflow plan.',
    });
    return response?.success && response.data
      ? response.data
      : LOCAL_EVIDENCE_WORKFLOW_PLAN;
  };
