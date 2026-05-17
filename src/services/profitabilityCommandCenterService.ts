import billingRoutes from '@/network/routes/billingRoutes';
import { getRequest } from '@/network/get';

export type ProfitabilityCommandCenterSummary = {
  enabled: false;
  tracking_live: false;
  privacy_mode: string;
  plan_interest_events: Record<string, any>;
  upgrade_prompt_impressions: Record<string, any>;
  usage_meter_summary: Record<string, any>;
  direct_usd_payment_readiness: {
    provider: string;
    provider_links_enabled: boolean;
    live_payment_provider_connected: boolean;
    intent_status_counts: Record<string, number>;
    total_intents: number;
    private_payment_data_exposed: boolean;
  };
  module_revenue_potential: Record<string, any>;
  conversion_funnel: Record<string, any>;
  guardrails: Record<string, boolean>;
  next_readiness_steps: string[];
};

export const LOCAL_PROFITABILITY_COMMAND_CENTER: ProfitabilityCommandCenterSummary = {
  enabled: false,
  tracking_live: false,
  privacy_mode: 'local_fallback_aggregate_placeholders_only',
  plan_interest_events: {},
  upgrade_prompt_impressions: { total: 0, status: 'local_fallback' },
  usage_meter_summary: {},
  direct_usd_payment_readiness: {
    provider: 'flutterwave',
    provider_links_enabled: false,
    live_payment_provider_connected: false,
    intent_status_counts: {},
    total_intents: 0,
    private_payment_data_exposed: false,
  },
  module_revenue_potential: {
    profile: { preview_only: true },
    bible: { preview_only: true },
    messaging: { preview_only: true },
    broadcast_channels: { preview_only: true },
    partners: { preview_only: true },
    commerce: { preview_only: true },
    education: { preview_only: true },
    health: { preview_only: true },
    verification: { preview_only: true },
    public_web: { preview_only: true },
  },
  conversion_funnel: { status: 'local_fallback_not_tracking' },
  guardrails: {
    no_live_charges: true,
    no_intrusive_tracking: true,
    no_dark_patterns: true,
    no_private_health_data: true,
    no_private_verification_documents: true,
    no_payment_instrument_data: true,
    promotional_credits_non_cash: true,
  },
  next_readiness_steps: [
    'Define privacy-safe event schema.',
    'Add explicit analytics settings before tracking.',
  ],
};

export const fetchProfitabilityCommandCenterSummary =
  async (): Promise<ProfitabilityCommandCenterSummary> => {
    const response = await getRequest(billingRoutes.profitabilityCommandCenter, {
      forceNetwork: true,
      errorMessage: 'Unable to load profitability command center.',
    });
    return response?.success && response.data
      ? response.data
      : LOCAL_PROFITABILITY_COMMAND_CENTER;
  };
