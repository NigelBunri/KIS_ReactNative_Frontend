import { API_BASE_URL } from '../config';

const miscRoutes = {
  moderation: {
    flags: `${API_BASE_URL}/api/v1/flags/`,
    userBlocks: `${API_BASE_URL}/api/v1/user-blocks/`,
  },
};

export default miscRoutes;
