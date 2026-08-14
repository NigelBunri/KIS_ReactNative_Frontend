import { API_BASE_URL } from '../config';

// apps.referrals — own code plus qualified/rewarded/reversed history for
// everyone referred with it. Built for ReferralScreen.tsx (Phase 8 of the
// billing/rewards project); no mobile screen read this API before.
const referralsRoutes = {
  me: `${API_BASE_URL}/api/v1/referrals/me/`,
};

export default referralsRoutes;
