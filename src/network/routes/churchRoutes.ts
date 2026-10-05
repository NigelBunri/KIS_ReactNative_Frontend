import { API_BASE_URL } from '../config';

// NOTE: these paths were previously out of sync with apps/church/urls.py on the
// backend (wrong prefixes, hyphens in place of nested segments, singular vs
// plural) — every endpoint below was re-derived from the actual router
// registrations/@action url_paths and corrected to match.
const churchRoutes = {
  church: {
    giving: API_BASE_URL + "/api/v1/church/giving/givings/",
    givingStats: API_BASE_URL + "/api/v1/church/giving/stats/",
    givingStatement: API_BASE_URL + "/api/v1/church/giving/statement/",
    pledges: API_BASE_URL + "/api/v1/church/giving/pledges/",
    campaigns: API_BASE_URL + "/api/v1/church/giving/campaigns/",
    campaign: (id: string) => API_BASE_URL + "/api/v1/church/giving/campaigns/" + id + "/",
    memberships: API_BASE_URL + "/api/v1/church/membership/",
    membership: (id: string) => API_BASE_URL + "/api/v1/church/membership/" + id + "/",
    attendanceCheckin: API_BASE_URL + "/api/v1/church/attendance/checkin/",
    attendance: API_BASE_URL + "/api/v1/church/attendance/",
    lifeEvents: API_BASE_URL + "/api/v1/church/life-events/",
    groups: API_BASE_URL + "/api/v1/church/groups/",
    group: (id: string) => API_BASE_URL + "/api/v1/church/groups/" + id + "/",
    groupJoin: (id: string) => API_BASE_URL + "/api/v1/church/groups/" + id + "/join/",
    groupLeave: (id: string) => API_BASE_URL + "/api/v1/church/groups/" + id + "/leave/",
    discipleship: API_BASE_URL + "/api/v1/church/discipleship/journeys/",
    discipleshipGifts: API_BASE_URL + "/api/v1/church/discipleship/gifts/submit/",
    accountability: API_BASE_URL + "/api/v1/church/discipleship/accountability/",
    prayerRequests: API_BASE_URL + "/api/v1/church/prayer/requests/",
    prayerPray: (id: string) => API_BASE_URL + "/api/v1/church/prayer/requests/" + id + "/pray/",
    prayerWall: API_BASE_URL + "/api/v1/church/prayer/wall/",
    fasting: API_BASE_URL + "/api/v1/church/prayer/fasting/",
    songs: API_BASE_URL + "/api/v1/church/worship/songs/",
    song: (id: string) => API_BASE_URL + "/api/v1/church/worship/songs/" + id + "/",
    setlists: API_BASE_URL + "/api/v1/church/worship/setlists/",
    departments: API_BASE_URL + "/api/v1/church/ministry/departments/",
    volunteers: API_BASE_URL + "/api/v1/church/ministry/volunteers/",
    evangelism: API_BASE_URL + "/api/v1/church/outreach/evangelism/",
    evangelismImpact: API_BASE_URL + "/api/v1/church/outreach/evangelism/impact/",
  },
};

export default churchRoutes;
