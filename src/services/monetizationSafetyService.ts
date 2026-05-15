import ROUTES from '@/network';
import { getRequest } from '@/network/get';

export type MonetizationSafetyCheck = {
  key: string;
  label: string;
  status: 'pass' | 'fail' | string;
  severity: 'critical' | 'warning' | string;
  detail: string;
};

export type MonetizationSafetySummary = {
  version: string;
  principles: {
    platform_currency: string;
    direct_provider_first: boolean;
    primary_payment_provider: string;
    promotional_credits_label: string;
    promotional_credits_non_cash: boolean;
    promotional_credits_non_transferable: boolean;
    promotional_credits_non_withdrawable: boolean;
    promotional_credits_not_exchange_rated: boolean;
    historical_wallet_records_read_only: boolean;
  };
  legacy_flags: Record<string, boolean>;
  provider_readiness: Record<string, boolean | string>;
  monetization_surfaces: Record<string, Record<string, boolean | string>>;
  copy_guard: {
    required_public_wording: string[];
    forbidden_public_wording: string[];
  };
  checks: MonetizationSafetyCheck[];
  summary: {
    go_live_status: 'go' | 'conditional' | 'blocked' | string;
    total_checks: number;
    passed: number;
    critical_failures: number;
    warnings: number;
  };
  privacy: Record<string, boolean>;
};

export const fetchMonetizationSafetySummary =
  async (): Promise<MonetizationSafetySummary | null> => {
    const response = await getRequest(ROUTES.monetization.safetySummary, {
      forceNetwork: true,
      errorMessage: 'Unable to load monetization safety summary.',
    });
    if (!response.success) {
      throw new Error(response.message || 'Unable to load monetization safety summary.');
    }
    return response.data || null;
  };
