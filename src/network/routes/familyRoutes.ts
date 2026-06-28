import { API_BASE_URL } from '../config';

const familyRoutes = {
  family: {
    accounts: API_BASE_URL + "/api/v1/family/accounts/",
    account: (id: string) => API_BASE_URL + "/api/v1/family/accounts/" + id + "/",
    accountJoin: API_BASE_URL + "/api/v1/family/accounts/join/",
    accountTree: (id: string) => API_BASE_URL + "/api/v1/family/accounts/" + id + "/tree/",
    members: API_BASE_URL + "/api/v1/family/members/",
    member: (id: string) => API_BASE_URL + "/api/v1/family/members/" + id + "/",
    parentalControls: API_BASE_URL + "/api/v1/family/parental-controls/",
    parentalControl: (id: string) => API_BASE_URL + "/api/v1/family/parental-controls/" + id + "/",
    sos: API_BASE_URL + "/api/v1/family/sos/",
    events: API_BASE_URL + "/api/v1/family/events/",
    albums: API_BASE_URL + "/api/v1/family/albums/",
    photos: API_BASE_URL + "/api/v1/family/photos/",
    memorials: API_BASE_URL + "/api/v1/family/memorials/",
    memorial: (id: string) => API_BASE_URL + "/api/v1/family/memorials/" + id + "/",
    milestones: API_BASE_URL + "/api/v1/family/milestones/",
    timeCapsules: API_BASE_URL + "/api/v1/family/capsules/",
    timeCapsule: (id: string) => API_BASE_URL + "/api/v1/family/capsules/" + id + "/",
    prayers: API_BASE_URL + "/api/v1/family/prayers/",
    notices: API_BASE_URL + "/api/v1/family/notices/",
    griefGroups: API_BASE_URL + "/api/v1/family/grief-groups/",
    griefGroupJoin: (id: string) => API_BASE_URL + "/api/v1/family/grief-groups/" + id + "/join/",
  },
};

export default familyRoutes;
