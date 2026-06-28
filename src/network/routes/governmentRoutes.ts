import { API_BASE_URL } from '../config';

const governmentRoutes = {
  government: {
    petitions: API_BASE_URL + "/api/v1/government/petitions/",
    petition: (id: string) => API_BASE_URL + "/api/v1/government/petitions/" + id + "/",
    petitionSign: (id: string) => API_BASE_URL + "/api/v1/government/petitions/" + id + "/sign/",
    polls: API_BASE_URL + "/api/v1/government/polls/",
    poll: (id: string) => API_BASE_URL + "/api/v1/government/polls/" + id + "/",
    pollVote: (id: string) => API_BASE_URL + "/api/v1/government/polls/" + id + "/vote/",
    pollResults: (id: string) => API_BASE_URL + "/api/v1/government/polls/" + id + "/results/",
    legalAid: API_BASE_URL + "/api/v1/government/legal-aid/",
    legalTemplates: API_BASE_URL + "/api/v1/government/legal-documents/",
    diaspora: API_BASE_URL + "/api/v1/government/diaspora/",
    diasporaCommunity: (id: string) => API_BASE_URL + "/api/v1/government/diaspora/" + id + "/",
    diasporaJoin: (id: string) => API_BASE_URL + "/api/v1/government/diaspora/" + id + "/join/",
    ngoProfiles: API_BASE_URL + "/api/v1/government/ngos/",
    grants: API_BASE_URL + "/api/v1/government/grants/",
    compliance: API_BASE_URL + "/api/v1/government/compliance/",
    whistleblowerSubmit: API_BASE_URL + "/api/v1/government/whistleblower/submit/",
    whistleblowerStatus: API_BASE_URL + "/api/v1/government/whistleblower/status/",
    elections: API_BASE_URL + "/api/v1/government/elections/",
    electionVote: (id: string) => API_BASE_URL + "/api/v1/government/elections/" + id + "/vote/",
    resolutions: API_BASE_URL + "/api/v1/government/resolutions/",
  },
};

export default governmentRoutes;
