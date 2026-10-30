import { API_BASE_URL } from '../config';

// apps.prayer (Django) — the Prayer Calendar's 24 permanent global prayer
// watches. Backend is authoritative for scheduling/stage/leadership; this
// client only ever renders what these endpoints return, never advances a
// stage or decides a leadership outcome locally.
const prayerRoutes = {
  watches: `${API_BASE_URL}/api/v1/prayer/watches/`,
  watch: (hour: number) => `${API_BASE_URL}/api/v1/prayer/watches/${hour}/`,
  claimLeadership: (hour: number) => `${API_BASE_URL}/api/v1/prayer/watches/${hour}/leadership/claim/`,
  releaseLeadership: (hour: number) => `${API_BASE_URL}/api/v1/prayer/watches/${hour}/leadership/release/`,
  adminClaimLeadership: (hour: number) => `${API_BASE_URL}/api/v1/prayer/watches/${hour}/leadership/admin-claim/`,
  shareRequest: (hour: number) => `${API_BASE_URL}/api/v1/prayer/watches/${hour}/leadership/share-request/`,
  shareRespond: (hour: number) => `${API_BASE_URL}/api/v1/prayer/watches/${hour}/leadership/share-respond/`,
  overrideLeadership: (hour: number) => `${API_BASE_URL}/api/v1/prayer/watches/${hour}/leadership/override/`,
  participationMode: (hour: number) => `${API_BASE_URL}/api/v1/prayer/watches/${hour}/participation-mode/`,
  prayerPoints: (hour: number) => `${API_BASE_URL}/api/v1/prayer/watches/${hour}/prayer-points/`,
  admins: (hour: number) => `${API_BASE_URL}/api/v1/prayer/watches/${hour}/admins/`,
  myActivity: `${API_BASE_URL}/api/v1/prayer/my-activity/`,
};

export default prayerRoutes;
