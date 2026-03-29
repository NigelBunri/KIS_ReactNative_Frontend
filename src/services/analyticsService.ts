import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';

export const fetchClinicalAnalyticsReports = (params?: Record<string, any>) =>
  getRequest(ROUTES.analytics.clinicalReports, {
    params,
    errorMessage: 'Unable to load analytics reports.',
  });

export const computeClinicalAnalyticsReports = (profileId?: string) =>
  postRequest(ROUTES.analytics.computeClinicalReports, { profile_id: profileId }, {
    errorMessage: 'Unable to refresh analytics reports.',
  });

export const fetchRiskStratifications = (params?: Record<string, any>) =>
  getRequest(ROUTES.analytics.riskStratifications, {
    params,
    errorMessage: 'Unable to load risk stratification data.',
  });

export const computeRiskStratification = () =>
  postRequest(ROUTES.analytics.computeRisk, {}, {
    errorMessage: 'Unable to compute risk stratification.',
  });

export const fetchOutcomeBenchmarks = (params?: Record<string, any>) =>
  getRequest(ROUTES.analytics.outcomeBenchmarks, {
    params,
    errorMessage: 'Unable to load outcome benchmarks.',
  });

export const createOutcomeBenchmark = (payload: Record<string, any>) =>
  postRequest(ROUTES.analytics.outcomeBenchmarks, payload, {
    errorMessage: 'Unable to create outcome benchmark.',
  });

export const fetchPatientSatisfactionScores = (params?: Record<string, any>) =>
  getRequest(ROUTES.analytics.patientSatisfaction, {
    params,
    errorMessage: 'Unable to load satisfaction scores.',
  });

export const createPatientSatisfactionScore = (payload: Record<string, any>) =>
  postRequest(ROUTES.analytics.patientSatisfaction, payload, {
    errorMessage: 'Unable to record satisfaction score.',
  });

export const fetchOutreachCampaigns = (params?: Record<string, any>) =>
  getRequest(ROUTES.analytics.outreachCampaigns, {
    params,
    errorMessage: 'Unable to load outreach campaigns.',
  });

export const createOutreachCampaign = (payload: Record<string, any>) =>
  postRequest(ROUTES.analytics.outreachCampaigns, payload, {
    errorMessage: 'Unable to create outreach campaign.',
  });

export const setOutreachCampaignStatus = (campaignId: string, status: string) =>
  postRequest(ROUTES.analytics.outreachSetStatus(campaignId), { status }, {
    errorMessage: 'Unable to update campaign status.',
  });

export const fetchWellnessChallenges = (params?: Record<string, any>) =>
  getRequest(ROUTES.analytics.wellnessChallenges, {
    params,
    errorMessage: 'Unable to load wellness challenges.',
  });

export const createWellnessChallenge = (payload: Record<string, any>) =>
  postRequest(ROUTES.analytics.wellnessChallenges, payload, {
    errorMessage: 'Unable to create wellness challenge.',
  });

export const fetchHabitTrackingEntries = (params?: Record<string, any>) =>
  getRequest(ROUTES.analytics.habitEntries, {
    params,
    errorMessage: 'Unable to load habit tracking data.',
  });

export const createHabitTrackingEntry = (payload: Record<string, any>) =>
  postRequest(ROUTES.analytics.habitEntries, payload, {
    errorMessage: 'Unable to log habit entry.',
  });
