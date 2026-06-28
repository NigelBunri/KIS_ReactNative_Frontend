import { API_BASE_URL } from '../config';

const healthExtendedRoutes = {
  healthExtended: {
    consults: API_BASE_URL + "/api/v1/health/extended/consults/",
    consult: (id: string) => API_BASE_URL + "/api/v1/health/extended/consults/" + id + "/",
    consultStart: (id: string) => API_BASE_URL + "/api/v1/health/extended/consults/" + id + "/start/",
    consultComplete: (id: string) => API_BASE_URL + "/api/v1/health/extended/consults/" + id + "/complete/",
    doctors: API_BASE_URL + "/api/v1/health/extended/doctors/",
    consultReviews: API_BASE_URL + "/api/v1/health/extended/consult-reviews/",
    mentalSessions: API_BASE_URL + "/api/v1/health/extended/mental-sessions/",
    moodEntries: API_BASE_URL + "/api/v1/health/extended/mood/",
    moodTrends: API_BASE_URL + "/api/v1/health/extended/mood/trends/",
    mentalJournals: API_BASE_URL + "/api/v1/health/extended/mental-journals/",
    recoveryGroups: API_BASE_URL + "/api/v1/health/extended/recovery-groups/",
    recoveryGroupJoin: (id: string) => API_BASE_URL + "/api/v1/health/extended/recovery-groups/" + id + "/join/",
    recoveryStreaks: API_BASE_URL + "/api/v1/health/extended/recovery-groups/streaks/",
    recoveryAccountabilityRequest: API_BASE_URL + "/api/v1/health/extended/recovery-groups/accountability-partner/",
    recoveryMilestones: API_BASE_URL + "/api/v1/health/extended/recovery-milestones/",
    pregnancy: API_BASE_URL + "/api/v1/health/extended/pregnancy/",
    babyMilestones: API_BASE_URL + "/api/v1/health/extended/baby-milestones/",
    bloodDonors: API_BASE_URL + "/api/v1/health/extended/blood-registry/donors/",
    bloodRegistry: API_BASE_URL + "/api/v1/health/extended/blood-registry/",
    medications: API_BASE_URL + "/api/v1/health/extended/medications/",
    medicationReminders: API_BASE_URL + "/api/v1/health/extended/medications/?type=reminder",
    healthGoals: API_BASE_URL + "/api/v1/health/extended/health-goals/",
    goalProgress: (id: string) => API_BASE_URL + "/api/v1/health/extended/health-goals/" + id + "/update-progress/",
    sosAlert: API_BASE_URL + "/api/v1/health/extended/emergency/sos/",
    symptomsCheck: API_BASE_URL + "/api/v1/health/extended/symptoms/check/",
    crisisHotlines: API_BASE_URL + "/api/v1/health/extended/crisis/hotlines/",
  },
};

export default healthExtendedRoutes;
