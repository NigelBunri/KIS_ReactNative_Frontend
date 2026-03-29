import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';

export const fetchStaffProfiles = (params?: Record<string, any>) =>
  getRequest(ROUTES.core.staff, {
    params,
    errorMessage: 'Unable to load staff roster.',
  });

export const assignStaffRole = (id: string, payload: Record<string, any>) =>
  postRequest(ROUTES.core.staffAssignRole(id), payload, {
    errorMessage: 'Unable to update staff role.',
  });

export const assignStaffShift = (id: string, shifts: any[]) =>
  postRequest(ROUTES.core.staffAssignShift(id), { shifts }, {
    errorMessage: 'Unable to assign shifts.',
  });

export const fetchStaffAudits = (params?: Record<string, any>) =>
  getRequest(ROUTES.core.staffAudits, {
    params,
    errorMessage: 'Unable to load staff audit log.',
  });
