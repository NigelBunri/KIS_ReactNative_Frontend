import billingRoutes from '@/network/routes/billingRoutes';
import { getRequest } from '@/network/get';

export type ProductionGoNoGoSummary = {
  enabled: false;
  access: string;
  go_no_go: string;
  readiness_percent: number;
  ready_count: number;
  total_count: number;
  blocked_checks: string[];
  checks: Record<string, any>;
  guardrails: Record<string, boolean>;
  next_readiness_steps: string[];
};

export const LOCAL_PRODUCTION_GO_NO_GO: ProductionGoNoGoSummary = {
  enabled: false,
  access: 'staff_read_only_local_fallback',
  go_no_go: 'no_go_local_fallback',
  readiness_percent: 0,
  ready_count: 0,
  total_count: 7,
  blocked_checks: ['approved_evidence_coverage', 'rollback_readiness'],
  checks: {},
  guardrails: {
    no_live_charges: true,
    no_production_provider_calls: true,
    no_entitlement_enforcement: true,
    no_payment_instrument_collection: true,
    no_private_health_payment_verification_data: true,
    staff_only: true,
    read_only: true,
  },
  next_readiness_steps: [
    'Keep all monetization and legacy money flags disabled until explicit release approval.',
    'Approve all evidence areas, including rollback proof, before production monetization review.',
  ],
};

export const fetchProductionGoNoGoSummary =
  async (): Promise<ProductionGoNoGoSummary> => {
    const response = await getRequest(billingRoutes.profitabilityProductionGoNoGo, {
      forceNetwork: true,
      errorMessage: 'Unable to load production monetization go/no-go.',
    });
    return response?.success && response.data
      ? response.data
      : LOCAL_PRODUCTION_GO_NO_GO;
  };
