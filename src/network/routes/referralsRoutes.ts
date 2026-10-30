import { API_BASE_URL } from '../config';

// apps.referrals — own code plus qualified/rewarded/reversed history for
// everyone referred with it. Built for ReferralScreen.tsx (Phase 8 of the
// billing/rewards project); no mobile screen read this API before.
//
// commissions/payoutAccount* below are the separate lifetime cash-
// commission system (apps.referrals.commission_services) — built for
// ReferralCommissionsScreen.tsx, an additive, independent reward track
// from the KIS-Coins one above (see that screen's own header comment).
const referralsRoutes = {
  me: `${API_BASE_URL}/api/v1/referrals/me/`,
  commissions: `${API_BASE_URL}/api/v1/referrals/commissions/`,
  payoutAccountFlutterwave: `${API_BASE_URL}/api/v1/referrals/payout-account/flutterwave/`,
  payoutAccountStripe: `${API_BASE_URL}/api/v1/referrals/payout-account/stripe/`,
};

export default referralsRoutes;
