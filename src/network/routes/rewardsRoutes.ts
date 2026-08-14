import { API_BASE_URL } from '../config';

// apps.rewards — the KIS Coins ledger built in the billing/rewards project.
// Distinct from the legacy apps.commerce loyalty-balance endpoints
// (billingRoutes.loyalty*), which LoyaltyScreen used before Phase 8's
// consolidation and which do not reflect redemption/referral activity.
const rewardsRoutes = {
  balance: `${API_BASE_URL}/api/v1/rewards/balance/`,
  history: `${API_BASE_URL}/api/v1/rewards/history/`,
  achievements: `${API_BASE_URL}/api/v1/rewards/achievements/`,
};

export default rewardsRoutes;
