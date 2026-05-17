import billingRoutes from '@/network/routes/billingRoutes';
import { getRequest } from '@/network/get';

export type RevenueReadinessArea = {
  label: string;
  owner: string;
  required_reviewer_role: string;
  state: 'approved' | 'expired' | 'blocked' | 'missing' | string;
  ready: boolean;
  can_current_user_review: boolean;
  record_count: number;
  approved_count: number;
  expired_count: number;
  latest_record_id: string;
  latest_status: string;
  latest_expires_at: string;
  reminder?: Record<string, any>;
};

export type ProfitabilityRevenueReadinessSummary = {
  enabled: false;
  access: string;
  go_no_go: string;
  readiness_percent: number;
  ready_count: number;
  total_count: number;
  blocked_count: number;
  expired_count: number;
  missing_count: number;
  areas: Record<string, RevenueReadinessArea>;
  reviewer_roles: Record<string, string>;
  guardrails: Record<string, boolean>;
  next_readiness_steps: string[];
};

export const LOCAL_REVENUE_READINESS: ProfitabilityRevenueReadinessSummary = {
  enabled: false,
  access: 'staff_read_only_local_fallback',
  go_no_go: 'no_go_evidence_incomplete',
  readiness_percent: 0,
  ready_count: 0,
  total_count: 12,
  blocked_count: 0,
  expired_count: 0,
  missing_count: 12,
  areas: {},
  reviewer_roles: {},
  guardrails: {
    staff_only: true,
    read_only_summary: true,
    role_checked_reviews: true,
    expiry_aware: true,
    no_live_charges: true,
    no_payment_instrument_collection: true,
    no_private_health_payment_verification_data: true,
  },
  next_readiness_steps: [
    'Assign reviewer roles through staff groups or user metadata before approvals.',
    'Approve every required area with non-expired evidence before launch.',
  ],
};

export const fetchProfitabilityRevenueReadiness =
  async (): Promise<ProfitabilityRevenueReadinessSummary> => {
    const response = await getRequest(billingRoutes.profitabilityRevenueReadiness, {
      forceNetwork: true,
      errorMessage: 'Unable to load revenue readiness.',
    });
    return response?.success && response.data
      ? response.data
      : LOCAL_REVENUE_READINESS;
  };
