import AsyncStorage from '@react-native-async-storage/async-storage';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import { isAnalyticsEnabled } from '@/services/consentService';

const PENDING_ANALYTICS_KEY = 'KIS_PENDING_ANALYTICS';

type PendingAnalyticsItem = {
  id: string;
  url: string;
  payload: Record<string, any>;
  createdAt: string;
};

async function enqueueAnalytics(url: string, payload: Record<string, any>): Promise<void> {
  const raw = await AsyncStorage.getItem(PENDING_ANALYTICS_KEY).catch(() => null);
  const queue: PendingAnalyticsItem[] = raw ? JSON.parse(raw) : [];
  queue.push({
    id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
    url,
    payload,
    createdAt: new Date().toISOString(),
  });
  await AsyncStorage.setItem(PENDING_ANALYTICS_KEY, JSON.stringify(queue));
}

export async function flushPendingAnalytics(): Promise<void> {
  const raw = await AsyncStorage.getItem(PENDING_ANALYTICS_KEY).catch(() => null);
  if (!raw) return;
  let queue: PendingAnalyticsItem[];
  try {
    queue = JSON.parse(raw);
  } catch {
    return;
  }
  if (!queue.length) return;
  const remaining: PendingAnalyticsItem[] = [];
  for (const item of queue) {
    try {
      const res = await postRequest(item.url, item.payload);
      if (!res?.success) {
        remaining.push(item);
      }
    } catch {
      remaining.push(item);
    }
  }
  if (remaining.length) {
    await AsyncStorage.setItem(PENDING_ANALYTICS_KEY, JSON.stringify(remaining));
  } else {
    await AsyncStorage.removeItem(PENDING_ANALYTICS_KEY);
  }
}

// Auto-flush on module load if items are pending and network is available
(async () => {
  try {
    const raw = await AsyncStorage.getItem(PENDING_ANALYTICS_KEY);
    if (!raw) return;
    const queue: PendingAnalyticsItem[] = JSON.parse(raw);
    if (!queue.length) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const NetInfo = require('@react-native-community/netinfo').default;
      const state = await NetInfo.fetch();
      if (state.isConnected) {
        await flushPendingAnalytics();
      }
    } catch {
      // NetInfo unavailable — skip auto-flush
    }
  } catch { /* silent */ }
})();

export const fetchClinicalAnalyticsReports = (params?: Record<string, any>) =>
  getRequest(ROUTES.analytics.clinicalReports, {
    params,
    errorMessage: 'Unable to load analytics reports.',
  });

export const computeClinicalAnalyticsReports = async (profileId?: string) => {
  if (!isAnalyticsEnabled()) return null;
  try {
    return await postRequest(ROUTES.analytics.computeClinicalReports, { profile_id: profileId }, {
      errorMessage: 'Unable to refresh analytics reports.',
    });
  } catch (err) {
    await enqueueAnalytics(ROUTES.analytics.computeClinicalReports, { profile_id: profileId });
    throw err;
  }
};

export const fetchRiskStratifications = (params?: Record<string, any>) =>
  getRequest(ROUTES.analytics.riskStratifications, {
    params,
    errorMessage: 'Unable to load risk stratification data.',
  });

export const computeRiskStratification = async () => {
  if (!isAnalyticsEnabled()) return null;
  try {
    return await postRequest(ROUTES.analytics.computeRisk, {}, {
      errorMessage: 'Unable to compute risk stratification.',
    });
  } catch (err) {
    await enqueueAnalytics(ROUTES.analytics.computeRisk, {});
    throw err;
  }
};

export const fetchOutcomeBenchmarks = (params?: Record<string, any>) =>
  getRequest(ROUTES.analytics.outcomeBenchmarks, {
    params,
    errorMessage: 'Unable to load outcome benchmarks.',
  });

export const createOutcomeBenchmark = async (payload: Record<string, any>) => {
  if (!isAnalyticsEnabled()) return null;
  try {
    return await postRequest(ROUTES.analytics.outcomeBenchmarks, payload, {
      errorMessage: 'Unable to create outcome benchmark.',
    });
  } catch (err) {
    await enqueueAnalytics(ROUTES.analytics.outcomeBenchmarks, payload);
    throw err;
  }
};

export const fetchPatientSatisfactionScores = (params?: Record<string, any>) =>
  getRequest(ROUTES.analytics.patientSatisfaction, {
    params,
    errorMessage: 'Unable to load satisfaction scores.',
  });

export const createPatientSatisfactionScore = async (payload: Record<string, any>) => {
  if (!isAnalyticsEnabled()) return null;
  try {
    return await postRequest(ROUTES.analytics.patientSatisfaction, payload, {
      errorMessage: 'Unable to record satisfaction score.',
    });
  } catch (err) {
    await enqueueAnalytics(ROUTES.analytics.patientSatisfaction, payload);
    throw err;
  }
};

export const fetchOutreachCampaigns = (params?: Record<string, any>) =>
  getRequest(ROUTES.analytics.outreachCampaigns, {
    params,
    errorMessage: 'Unable to load outreach campaigns.',
  });

export const createOutreachCampaign = async (payload: Record<string, any>) => {
  if (!isAnalyticsEnabled()) return null;
  try {
    return await postRequest(ROUTES.analytics.outreachCampaigns, payload, {
      errorMessage: 'Unable to create outreach campaign.',
    });
  } catch (err) {
    await enqueueAnalytics(ROUTES.analytics.outreachCampaigns, payload);
    throw err;
  }
};

export const setOutreachCampaignStatus = async (campaignId: string, status: string) => {
  if (!isAnalyticsEnabled()) return null;
  try {
    return await postRequest(ROUTES.analytics.outreachSetStatus(campaignId), { status }, {
      errorMessage: 'Unable to update campaign status.',
    });
  } catch (err) {
    await enqueueAnalytics(ROUTES.analytics.outreachSetStatus(campaignId), { status });
    throw err;
  }
};

export const fetchWellnessChallenges = (params?: Record<string, any>) =>
  getRequest(ROUTES.analytics.wellnessChallenges, {
    params,
    errorMessage: 'Unable to load wellness challenges.',
  });

export const createWellnessChallenge = async (payload: Record<string, any>) => {
  if (!isAnalyticsEnabled()) return null;
  try {
    return await postRequest(ROUTES.analytics.wellnessChallenges, payload, {
      errorMessage: 'Unable to create wellness challenge.',
    });
  } catch (err) {
    await enqueueAnalytics(ROUTES.analytics.wellnessChallenges, payload);
    throw err;
  }
};

export const fetchHabitTrackingEntries = (params?: Record<string, any>) =>
  getRequest(ROUTES.analytics.habitEntries, {
    params,
    errorMessage: 'Unable to load habit tracking data.',
  });

export const createHabitTrackingEntry = async (payload: Record<string, any>) => {
  if (!isAnalyticsEnabled()) return null;
  try {
    return await postRequest(ROUTES.analytics.habitEntries, payload, {
      errorMessage: 'Unable to log habit entry.',
    });
  } catch (err) {
    await enqueueAnalytics(ROUTES.analytics.habitEntries, payload);
    throw err;
  }
};
