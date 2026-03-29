import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import type { AnalyticsQueryPayload, AnalyticsTimeRange } from './types';
let analyticsEndpointUnavailable = false;

const asArray = <T>(value: unknown): T[] => {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === 'object') {
    const results = (value as Record<string, unknown>).results;
    if (Array.isArray(results)) return results as T[];
  }
  return [];
};

const toNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizePayload = (data: Record<string, any> | null | undefined): AnalyticsQueryPayload => {
  const payload = data ?? {};
  return {
    bookings: asArray(payload.bookings),
    consultations: asArray(payload.consultations),
    schedules: asArray(payload.schedules),
    payments: asArray(payload.payments),
    ratings: asArray(payload.ratings),
    traffic: {
      views: toNumber(payload.traffic?.views ?? payload.views ?? payload.impressions ?? 0, 0),
    },
  };
};

export const fetchInstitutionAnalyticsQueryPayload = async (
  institutionId: string,
  timeRange: AnalyticsTimeRange = '30d',
): Promise<AnalyticsQueryPayload> => {
  if (analyticsEndpointUnavailable) {
    return normalizePayload(null);
  }
  try {
    const response = await getRequest(ROUTES.healthDashboard.analytics(institutionId), {
      params: { time_range: timeRange },
      errorMessage: 'Unable to load institution analytics.',
    });
    if (!response?.success && Number(response?.status) === 404) {
      analyticsEndpointUnavailable = true;
      return normalizePayload(null);
    }
    return normalizePayload(response?.data);
  } catch {
    return normalizePayload(null);
  }
};
