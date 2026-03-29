import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';

export const fetchHealthcareContext = () =>
  getRequest(ROUTES.core.context, {
    errorMessage: 'Unable to load healthcare context.',
  });

export const setActiveMedicalProfile = (profileId: string) =>
  postRequest(ROUTES.core.setActiveProfile(profileId), {}, { errorMessage: 'Unable to activate profile.' });
