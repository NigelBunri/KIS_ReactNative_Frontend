import { API_BASE_URL } from '../config';

const localizationRoutes = {
  localization: {
    languageFile: (code: string) => `${API_BASE_URL}/api/v1/localization/languages/${code}/`,
  },
};

export default localizationRoutes;
