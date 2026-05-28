import { API_BASE_URL } from '../config';

const testimonyRoutes = {
  testimony: {
    seasons: `${API_BASE_URL}/api/v1/seasons/`,
    seasonsMine: `${API_BASE_URL}/api/v1/seasons/mine/`,
    seasonDetail: (id: string | number) => `${API_BASE_URL}/api/v1/seasons/${id}/`,
    testimonies: `${API_BASE_URL}/api/v1/testimonies/`,
    testimonyDetail: (id: string | number) => `${API_BASE_URL}/api/v1/testimonies/${id}/`,
    testimonyEndorse: (id: string | number) => `${API_BASE_URL}/api/v1/testimonies/${id}/endorse/`,
    reach: `${API_BASE_URL}/api/v1/testimony-reach/`,
    reachDetail: (id: string | number) => `${API_BASE_URL}/api/v1/testimony-reach/${id}/`,
  },
};

export default testimonyRoutes;
