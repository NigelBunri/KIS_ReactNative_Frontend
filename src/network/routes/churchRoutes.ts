import { API_BASE_URL } from '../config';

const churchRoutes = {
  church: {
    giving: API_BASE_URL + "/api/v1/church/giving/",
    givingStats: API_BASE_URL + "/api/v1/church/giving/stats/",
    givingStatement: API_BASE_URL + "/api/v1/church/giving/statement/",
    pledges: API_BASE_URL + "/api/v1/church/pledges/",
    campaigns: API_BASE_URL + "/api/v1/church/campaigns/",
    campaign: (id: string) => API_BASE_URL + "/api/v1/church/campaigns/" + id + "/",
    memberships: API_BASE_URL + "/api/v1/church/memberships/",
    membership: (id: string) => API_BASE_URL + "/api/v1/church/memberships/" + id + "/",
    attendanceCheckin: API_BASE_URL + "/api/v1/church/attendance/checkin/",
    attendance: API_BASE_URL + "/api/v1/church/attendance/",
    lifeEvents: API_BASE_URL + "/api/v1/church/life-events/",
    groups: API_BASE_URL + "/api/v1/church/groups/",
    group: (id: string) => API_BASE_URL + "/api/v1/church/groups/" + id + "/",
    groupJoin: (id: string) => API_BASE_URL + "/api/v1/church/groups/" + id + "/join/",
    groupLeave: (id: string) => API_BASE_URL + "/api/v1/church/groups/" + id + "/leave/",
    discipleship: API_BASE_URL + "/api/v1/church/discipleship/",
    discipleshipGifts: API_BASE_URL + "/api/v1/church/discipleship/gifts/submit/",
    accountability: API_BASE_URL + "/api/v1/church/accountability/",
    prayerRequests: API_BASE_URL + "/api/v1/church/prayer-requests/",
    prayerPray: (id: string) => API_BASE_URL + "/api/v1/church/prayer-requests/" + id + "/pray/",
    prayerWall: API_BASE_URL + "/api/v1/church/prayer-wall/",
    fasting: API_BASE_URL + "/api/v1/church/fasting/",
    songs: API_BASE_URL + "/api/v1/church/songs/",
    song: (id: string) => API_BASE_URL + "/api/v1/church/songs/" + id + "/",
    setlists: API_BASE_URL + "/api/v1/church/setlists/",
    departments: API_BASE_URL + "/api/v1/church/departments/",
    volunteers: API_BASE_URL + "/api/v1/church/volunteers/",
    evangelism: API_BASE_URL + "/api/v1/church/evangelism/",
    evangelismImpact: API_BASE_URL + "/api/v1/church/outreach/impact/",
  },
};

export default churchRoutes;
