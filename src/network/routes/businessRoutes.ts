import { API_BASE_URL } from '../config';

const businessRoutes = {
  business: {
    jobs: API_BASE_URL + "/api/v1/business/jobs/",
    job: (id: string) => API_BASE_URL + "/api/v1/business/jobs/" + id + "/",
    jobApplications: API_BASE_URL + "/api/v1/business/job-applications/",
    myApplications: API_BASE_URL + "/api/v1/business/jobs/my-applications/",
    crowdfund: API_BASE_URL + "/api/v1/business/crowdfund/",
    crowdfundDetail: (id: string) => API_BASE_URL + "/api/v1/business/crowdfund/" + id + "/",
    crowdfundContribute: (id: string) => API_BASE_URL + "/api/v1/business/crowdfund/" + id + "/contribute/",
    savingsGroups: API_BASE_URL + "/api/v1/business/savings/",
    savingsGroup: (id: string) => API_BASE_URL + "/api/v1/business/savings/" + id + "/",
    savingsGroupJoin: (id: string) => API_BASE_URL + "/api/v1/business/savings/" + id + "/join/",
    mentorship: API_BASE_URL + "/api/v1/business/mentorship/",
    mentorshipMatch: (id: string) => API_BASE_URL + "/api/v1/business/mentorship/" + id + "/match/",
    coworking: API_BASE_URL + "/api/v1/business/coworking/",
    certifications: API_BASE_URL + "/api/v1/business/certifications/",
    certificationVerify: API_BASE_URL + "/api/v1/business/certifications/verify/",
    impactGenerate: API_BASE_URL + "/api/v1/business/impact/generate/",
    dashboard: API_BASE_URL + "/api/v1/business/dashboard/",
  },
};

export default businessRoutes;
