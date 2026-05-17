import billingRoutes from '@/network/routes/billingRoutes';
import { getRequest } from '@/network/get';
import {
  KIS_PROMOTIONAL_CREDIT_SAFETY_COPY,
  PROFITABILITY_ENTITLEMENTS,
  PROFITABILITY_FEATURE_FLAGS,
  PROFITABILITY_PLANS,
  PROFITABILITY_USAGE_METERS,
} from '@/services/profitabilityPricing';

export type ProfitabilityEntitlementCatalog = {
  enabled: false;
  enforcement_enabled: false;
  billing_live: false;
  plans: any[];
  feature_flags: Record<string, any> | any[];
  entitlements: Record<string, any> | any[];
  usage_meters: Record<string, any> | any[];
  billing_status: Record<string, any>;
  policy: {
    preview_only: true;
    hard_blocks_existing_free_behavior: false;
    promotional_credit_safety_copy: string;
    notes?: string[];
  };
};

export const LOCAL_PROFITABILITY_ENTITLEMENT_CATALOG: ProfitabilityEntitlementCatalog = {
  enabled: false,
  enforcement_enabled: false,
  billing_live: false,
  plans: PROFITABILITY_PLANS,
  feature_flags: PROFITABILITY_FEATURE_FLAGS,
  entitlements: PROFITABILITY_ENTITLEMENTS,
  usage_meters: PROFITABILITY_USAGE_METERS,
  billing_status: {
    provider: '',
    live_provider_connected: false,
    subscriptions_enabled: false,
    trials_enabled: false,
    promotion_checkout_enabled: false,
    enterprise_leads_enabled: false,
  },
  policy: {
    preview_only: true,
    hard_blocks_existing_free_behavior: false,
    promotional_credit_safety_copy: KIS_PROMOTIONAL_CREDIT_SAFETY_COPY,
    notes: [
      'No live charges are enabled.',
      'No entitlement enforcement is enabled.',
      'No KIS promotional credit cash value, transfer, withdrawal, or exchange rate is enabled.',
    ],
  },
};

export const fetchProfitabilityEntitlementCatalog = async () => {
  const response = await getRequest(
    billingRoutes.profitabilityEntitlements,
    {
      errorMessage: 'Unable to load profitability entitlement catalog.',
      staleWhileRevalidate: true,
    },
  );
  return response?.success && response.data
    ? response.data
    : LOCAL_PROFITABILITY_ENTITLEMENT_CATALOG;
};
