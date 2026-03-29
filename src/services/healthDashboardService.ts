import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { patchRequest } from '@/network/patch';
import { postRequest } from '@/network/post';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Asset } from 'react-native-image-picker';
import type { InsightPayload, TimeRange } from '@/api/insights/types';
import {
  aggregateInstitutionAnalytics,
  fetchInstitutionAnalyticsQueryPayload,
  mapHealthDashboardAnalyticsToInsightPayload,
} from '@/features/health-dashboard/analytics';
import type {
  HealthDashboardInstitutionType,
  InstitutionDashboardSchema,
  InstitutionProfileEditorDraft,
} from '@/features/health-dashboard/models';
import {
  HEALTH_DASHBOARD_DEFAULT_OPERATIONAL_MODULES,
  HEALTH_DASHBOARD_DEFAULT_SERVICES,
} from '@/features/health-dashboard/defaults';
import {
  fetchHealthProfileState,
  updateHealthInstitutions,
} from '@/services/healthProfileService';

type CreateInstitutionDashboardPayload = {
  institutionId: string;
  type: HealthDashboardInstitutionType;
};

export type InstitutionLandingPageRecord = {
  exists: boolean;
  isPublished: boolean;
  draft: Partial<InstitutionProfileEditorDraft>;
  raw: Record<string, unknown>;
};

let healthDashboardApiUnavailable = false;
let uploadBlockedUntil = 0;
const PROFILE_EDITOR_CACHE_PREFIX = 'kis_health_dashboard_profile_editor_v1:';
const logHealthDashboard = (...args: any[]) => {
  console.log('[healthDashboardService]', ...args);
};

const createEmptyAnalyticsHeader = () => ({
  revenue: { today: 0, week: 0, month: 0 },
  bookingsCount: 0,
  completedConsultations: 0,
  pendingSchedules: 0,
  cancellationRate: 0,
  conversion: { views: 0, bookings: 0, rate: 0 },
  averageRating: 0,
  patientReturnRate: 0,
  paymentBreakdown: { cash: 0, insurance: 0, online: 0 },
});

const createEmptyAnalyticsBundle = () => ({
  bookingsOverTime: [],
  revenueBreakdown: [],
  serviceUsageDistribution: [],
  topServices: [],
  topPatients: [],
  paymentMethodBreakdown: [],
});

const createEmptySchedulePayload = () => ({
  today: 0,
  upcoming: 0,
  past: 0,
  entries: [],
});

const createEmptyFinancialPayload = () => ({
  totalRevenueCents: 0,
  insuranceRevenueCents: 0,
  directRevenueCents: 0,
  pendingPaymentsCents: 0,
  refundsCents: 0,
  disputesCount: 0,
});

const createEmptyCompliancePayload = () => ({
  auditLogCount: 0,
  pendingCredentialReviews: 0,
  licenseExpiringSoonCount: 0,
  activeConsents: 0,
  pendingDocuments: 0,
});

const createEmptyServicesPayload = () => ({
  services: [],
  service_availability: {},
});

const toFiniteNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseDateOnly = (value: string): Date | null => {
  const [y, m, d] = String(value || '').split('-').map((part) => Number(part));
  if (!y || !m || !d) return null;
  const parsed = new Date(y, m - 1, d);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const readCalendarStatuses = (raw: any): Record<string, string> => {
  const source =
    raw?.calendar_statuses ??
    raw?.calendarStatuses ??
    raw?.date_statuses ??
    raw?.dateStatuses ??
    {};
  if (!source || typeof source !== 'object' || Array.isArray(source)) return {};
  return source as Record<string, string>;
};

const readCalendarTimes = (raw: any): Record<string, string> => {
  const source =
    raw?.calendar_times ??
    raw?.calendarTimes ??
    raw?.date_times ??
    raw?.dateTimes ??
    {};
  if (!source || typeof source !== 'object' || Array.isArray(source)) return {};
  return source as Record<string, string>;
};

const readCalendarTimeLists = (raw: any): Record<string, string[]> => {
  const source =
    raw?.calendar_time_lists ??
    raw?.calendarTimeLists ??
    raw?.day_time_lists ??
    raw?.dayTimeLists ??
    {};
  if (!source || typeof source !== 'object' || Array.isArray(source)) return {};
  const map: Record<string, string[]> = {};
  Object.entries(source).forEach(([dateKey, value]) => {
    const normalized = normalizeTimeList(value);
    if (!normalized.length) return;
    map[dateKey] = normalized;
  });
  return map;
};

const toModeToken = (value: unknown) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

const isAllDayValue = (value: unknown) => {
  const mode = toModeToken(value);
  return mode === 'all_day' || mode === 'allday' || mode === 'full_day';
};

const normalizeTimeList = (value: unknown): string[] => {
  const isTimeText = (entry: string) => /^\d{2}:\d{2}$/.test(entry);
  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value
          .map((entry) => String(entry || '').trim())
          .filter((entry) => isTimeText(entry)),
      ),
    ).sort();
  }
  const raw = String(value || '').trim();
  if (!raw) return [];
  if (isAllDayValue(raw)) return [];
  if (isTimeText(raw)) return [raw];
  return Array.from(
    new Set(
      raw
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => isTimeText(entry)),
    ),
  ).sort();
};

const readCalendarTimeModes = (raw: any): Record<string, 'slots' | 'all_day'> => {
  const source =
    raw?.calendar_time_modes ??
    raw?.calendarTimeModes ??
    raw?.day_time_modes ??
    raw?.dayTimeModes ??
    {};
  const allDayDates = Array.isArray(raw?.all_day_dates)
    ? raw.all_day_dates
    : Array.isArray(raw?.allDayDates)
    ? raw.allDayDates
    : [];
  const legacyTimes = readCalendarTimes(raw);
  const map: Record<string, 'slots' | 'all_day'> = {};
  if (source && typeof source === 'object' && !Array.isArray(source)) {
    Object.entries(source).forEach(([dateKey, value]) => {
      map[dateKey] = isAllDayValue(value) ? 'all_day' : 'slots';
    });
  }
  allDayDates.forEach((dateKey: any) => {
    const normalized = String(dateKey || '').trim();
    if (!normalized) return;
    map[normalized] = 'all_day';
  });
  Object.entries(legacyTimes).forEach(([dateKey, value]) => {
    if (map[dateKey]) return;
    if (isAllDayValue(value)) {
      map[dateKey] = 'all_day';
    }
  });
  return map;
};

const parseDateTime = (dateKey: string, time: string): Date | null => {
  const date = parseDateOnly(dateKey);
  if (!date) return null;
  const [hh, mm] = String(time || '').split(':').map((part) => Number(part));
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  const parsed = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hh, mm, 0, 0);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const deriveScheduleSummaryFromStatuses = (
  statuses: Record<string, string>,
  calendar_times: Record<string, string>,
  calendar_time_lists: Record<string, string[]> = {},
  calendar_time_modes: Record<string, 'slots' | 'all_day'> = {},
) => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  let today = 0;
  let upcoming = 0;
  let past = 0;

  Object.keys(statuses).forEach((dateKey) => {
    const date = parseDateOnly(dateKey);
    if (!date) return;

    if (date < todayStart) {
      past += 1;
      return;
    }
    if (date >= tomorrowStart) {
      upcoming += 1;
      return;
    }

    if (calendar_time_modes?.[dateKey] === 'all_day') {
      today += 1;
      return;
    }

    const explicitSlots = normalizeTimeList(calendar_time_lists?.[dateKey]);
    const slots = explicitSlots.length > 0
      ? explicitSlots
      : normalizeTimeList(calendar_times?.[dateKey]);
    if (!slots.length) {
      today += 1;
      return;
    }

    const hasFutureSlot = slots.some((slot) => {
      const slotDate = parseDateTime(dateKey, slot);
      return !!slotDate && slotDate >= now;
    });
    if (hasFutureSlot) {
      today += 1;
      return;
    }
    past += 1;
  });

  return { today, upcoming, past };
};

const editorCacheKey = (institutionId: string) =>
  `${PROFILE_EDITOR_CACHE_PREFIX}${institutionId}`;

const readProfileEditorCache = async (
  institutionId: string,
): Promise<InstitutionProfileEditorDraft | null> => {
  try {
    const raw = await AsyncStorage.getItem(editorCacheKey(institutionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed as InstitutionProfileEditorDraft;
    }
    return null;
  } catch {
    return null;
  }
};

const writeProfileEditorCache = async (
  institutionId: string,
  draft: Partial<InstitutionProfileEditorDraft> | null | undefined,
) => {
  if (!draft || typeof draft !== 'object') return;
  try {
    await AsyncStorage.setItem(editorCacheKey(institutionId), JSON.stringify(draft));
    logHealthDashboard('profileEditorCache:write', {
      institutionId,
      keys: Object.keys(draft).slice(0, 20),
    });
  } catch {}
};

const toStringList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item ?? '').trim())
    .filter(Boolean);
};

const resolveLocalLandingPreview = (institution: any) =>
  institution?.landing_preview ??
  institution?.landingPreview ??
  institution?.dashboard?.landing_preview ??
  institution?.dashboard?.landingPreview ??
  null;

const toOptionalBoolean = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return null;
    if (['true', '1', 'yes', 'published', 'active'].includes(normalized)) return true;
    if (['false', '0', 'no', 'unpublished', 'inactive'].includes(normalized)) return false;
  }
  return null;
};

const resolveLandingPublished = (...values: unknown[]): boolean => {
  for (const value of values) {
    const parsed = toOptionalBoolean(value);
    if (parsed !== null) return parsed;
  }
  return false;
};

const resolveInstitutionLandingPublished = (source: any): boolean => {
  if (!source || typeof source !== 'object') return false;
  return resolveLandingPublished(
    source?.isPublished,
    source?.is_published,
    source?.published,
    source?.landing_is_published,
    source?.landingIsPublished,
    source?.landing_page_is_published,
    source?.landingPageIsPublished,
    source?.landing_page?.isPublished,
    source?.landing_page?.is_published,
    source?.landingPage?.isPublished,
    source?.landingPage?.is_published,
  );
};

const resolveLandingPagePayload = (raw: any): Record<string, unknown> => {
  if (!raw || typeof raw !== 'object') return {};
  const direct = raw?.landing_page ?? raw?.landingPage;
  if (direct && typeof direct === 'object' && !Array.isArray(direct)) {
    return direct as Record<string, unknown>;
  }
  const nested = raw?.data;
  if (nested && nested !== raw && typeof nested === 'object' && !Array.isArray(nested)) {
    const nestedDirect = nested?.landing_page ?? nested?.landingPage;
    if (nestedDirect && typeof nestedDirect === 'object' && !Array.isArray(nestedDirect)) {
      return nestedDirect as Record<string, unknown>;
    }
  }
  return raw as Record<string, unknown>;
};

const normalizeLandingPageDraft = (raw: any): Partial<InstitutionProfileEditorDraft> => {
  if (!raw || typeof raw !== 'object') return {};
  const payload = resolveLandingPagePayload(raw);
  const directDraft =
    payload?.draft ??
    payload?.profile_editor ??
    payload?.profileEditor ??
    payload?.landing_preview ??
    payload?.landingPreview ??
    null;
  if (directDraft && typeof directDraft === 'object' && !Array.isArray(directDraft)) {
    return directDraft as Partial<InstitutionProfileEditorDraft>;
  }

  const fallback: Partial<InstitutionProfileEditorDraft> = {};
  const hero = payload?.hero;
  if (hero && typeof hero === 'object' && !Array.isArray(hero)) {
    fallback.hero = {
      imageUrl: String((hero as any)?.imageUrl || (hero as any)?.image_url || ''),
      title: String((hero as any)?.title || ''),
      slogan: String((hero as any)?.slogan || (hero as any)?.subtitle || ''),
      ctaLabel: String((hero as any)?.ctaLabel || (hero as any)?.cta_label || 'Book Now'),
      ctaUrl: String((hero as any)?.ctaUrl || (hero as any)?.cta_url || ''),
    };
  }
  if (typeof payload?.about === 'string') {
    fallback.about = payload.about;
  }
  if (Array.isArray(payload?.gallery)) {
    fallback.gallery = payload.gallery.map((item) => String(item || '')).filter(Boolean);
  }
  if (Array.isArray(payload?.sections)) {
    fallback.sections = payload.sections as any;
  }
  if (payload?.contact && typeof payload.contact === 'object' && !Array.isArray(payload.contact)) {
    fallback.contact = {
      phone: String((payload.contact as any)?.phone || ''),
      email: String((payload.contact as any)?.email || ''),
      address: String((payload.contact as any)?.address || ''),
    };
  }
  fallback.landingBackgroundImageUrl = String(
    payload?.landingBackgroundImageUrl || payload?.landing_background_image_url || '',
  );
  fallback.landingBackgroundColorKey = String(
    payload?.landingBackgroundColorKey || payload?.landing_background_color_key || '',
  );
  fallback.landingLogoUrl = String(payload?.landingLogoUrl || payload?.landing_logo_url || '');
  return fallback;
};

const normalizeInstitutionLandingPageRecord = (raw: any): InstitutionLandingPageRecord => {
  const payload = resolveLandingPagePayload(raw);
  const draft = normalizeLandingPageDraft(payload);
  const isPublished = resolveLandingPublished(
    payload?.isPublished,
    payload?.is_published,
    payload?.published,
    raw?.isPublished,
    raw?.is_published,
    raw?.published,
  );
  const withPublish = {
    ...(draft || {}),
    isPublished,
  } as Partial<InstitutionProfileEditorDraft>;
  const exists = Object.keys(payload || {}).length > 0 || Object.keys(withPublish || {}).length > 1;
  return {
    exists,
    isPublished,
    draft: withPublish,
    raw: payload || {},
  };
};

const hasInstitutionEditableData = (institution: any): boolean => {
  if (!institution || typeof institution !== 'object') return false;
  const landing = resolveLocalLandingPreview(institution);
  const editor =
    institution?.profile_editor ??
    institution?.profileEditor ??
    institution?.dashboard?.profile_editor ??
    institution?.dashboard?.profileEditor;
  return Boolean(
    (landing && typeof landing === 'object' && Object.keys(landing).length > 0) ||
      (editor && typeof editor === 'object' && Object.keys(editor).length > 0),
  );
};

const buildDraftFromInstitution = (
  institution: any,
  fallback: Partial<InstitutionProfileEditorDraft> = {},
): InstitutionProfileEditorDraft => {
  const institutionType = (institution?.type || 'clinic') as HealthDashboardInstitutionType;
  const defaultServices = HEALTH_DASHBOARD_DEFAULT_SERVICES[institutionType] || [];
  const base: InstitutionProfileEditorDraft = {
    isPublished: resolveInstitutionLandingPublished(institution),
    hero: {
      imageUrl: '',
      title: institution?.name || '',
      slogan: '',
      ctaLabel: 'Book Now',
      ctaUrl: '',
    },
    about: '',
    gallery: [],
    servicesVisibility: Object.fromEntries(defaultServices.map((service) => [service.id, true])),
    staffDisplayEnabled: true,
    certifications: [],
    faqs: [],
    seo: {
      title: '',
      description: '',
      keywords: [],
    },
    contact: {
      phone: '',
      email: '',
      address: '',
    },
    socialLinks: [],
    emergencyBanner: {
      enabled: false,
      message: '',
    },
    operatingHours: [],
    pricingVisibilityEnabled: true,
    landingBackgroundImageUrl: '',
    landingBackgroundColorKey: '',
    landingLogoUrl: '',
  };

  const profileEditor =
    institution?.profile_editor ??
    institution?.profileEditor ??
    institution?.dashboard?.profile_editor ??
    institution?.dashboard?.profileEditor ??
    {};
  const landing = resolveLocalLandingPreview(institution) || {};

  const servicesOverview = toStringList(landing?.servicesOverview);
  const servicesVisibilityFromLanding = servicesOverview.length
    ? Object.fromEntries(
        defaultServices.map((service) => [
          service.id,
          servicesOverview.includes(service.name),
        ]),
      )
    : {};

  return {
    ...base,
    ...fallback,
    ...(profileEditor || {}),
    isPublished: resolveLandingPublished(
      profileEditor?.isPublished,
      profileEditor?.is_published,
      fallback?.isPublished,
      (fallback as any)?.is_published,
      institution?.landing_is_published,
      institution?.landingIsPublished,
      institution?.landing_page_is_published,
      institution?.landingPageIsPublished,
    ),
    hero: {
      ...base.hero,
      ...(fallback?.hero || {}),
      ...(profileEditor?.hero || {}),
      ...(landing?.hero || {}),
      title:
        landing?.hero?.title ||
        profileEditor?.hero?.title ||
        institution?.name ||
        fallback?.hero?.title ||
        base.hero.title,
    },
    about:
      landing?.about ??
      profileEditor?.about ??
      fallback?.about ??
      base.about,
    gallery:
      (Array.isArray(landing?.gallery) && landing.gallery) ||
      (Array.isArray(profileEditor?.gallery) && profileEditor.gallery) ||
      (Array.isArray(fallback?.gallery) && fallback.gallery) ||
      base.gallery,
    servicesVisibility: {
      ...base.servicesVisibility,
      ...(fallback?.servicesVisibility || {}),
      ...(profileEditor?.servicesVisibility || {}),
      ...(servicesVisibilityFromLanding || {}),
    },
    certifications:
      toStringList(landing?.certifications).length > 0
        ? toStringList(landing?.certifications)
        : toStringList(profileEditor?.certifications),
    contact: {
      ...base.contact,
      ...(fallback?.contact || {}),
      ...(profileEditor?.contact || {}),
    },
    emergencyBanner: {
      ...base.emergencyBanner,
      ...(fallback?.emergencyBanner || {}),
      ...(profileEditor?.emergencyBanner || {}),
      message:
        landing?.emergencyNotice ||
        profileEditor?.emergencyBanner?.message ||
        fallback?.emergencyBanner?.message ||
        base.emergencyBanner.message,
    },
    operatingHours:
      toStringList(landing?.operatingHours).length > 0
        ? toStringList(landing?.operatingHours)
        : toStringList(profileEditor?.operatingHours),
    seo: {
      ...base.seo,
      ...(fallback?.seo || {}),
      ...(profileEditor?.seo || {}),
    },
    socialLinks:
      toStringList(profileEditor?.socialLinks).length > 0
        ? toStringList(profileEditor?.socialLinks)
        : toStringList(fallback?.socialLinks),
    faqs: Array.isArray(profileEditor?.faqs) ? profileEditor.faqs : (fallback?.faqs || []),
    staffDisplayEnabled:
      profileEditor?.staffDisplayEnabled ?? fallback?.staffDisplayEnabled ?? base.staffDisplayEnabled,
    pricingVisibilityEnabled:
      profileEditor?.pricingVisibilityEnabled ??
      fallback?.pricingVisibilityEnabled ??
      base.pricingVisibilityEnabled,
    landingBackgroundImageUrl:
      profileEditor?.landingBackgroundImageUrl ??
      fallback?.landingBackgroundImageUrl ??
      base.landingBackgroundImageUrl,
    landingBackgroundColorKey:
      profileEditor?.landingBackgroundColorKey ??
      fallback?.landingBackgroundColorKey ??
      base.landingBackgroundColorKey,
    landingLogoUrl:
      profileEditor?.landingLogoUrl ??
      fallback?.landingLogoUrl ??
      base.landingLogoUrl,
  };
};

const getHealthInstitutionContext = async (institutionId: string) => {
  const state = await fetchHealthProfileState();
  const institutions = Array.isArray(state.profile?.institutions) ? state.profile!.institutions : [];
  const index = institutions.findIndex((item: any) => String(item?.id) === String(institutionId));
  const institution = index >= 0 ? institutions[index] : null;
  logHealthDashboard('getHealthInstitutionContext', {
    institutionId,
    exists: !!institution,
    index,
    institutionsCount: institutions.length,
    institutionKeys: institution && typeof institution === 'object' ? Object.keys(institution).slice(0, 20) : [],
  });
  return { institutions, institution, index };
};

const readLocalProfileEditorDraft = async (institutionId: string): Promise<InstitutionProfileEditorDraft | null> => {
  const { institution } = await getHealthInstitutionContext(institutionId);
  const cached = await readProfileEditorCache(institutionId);
  if (!institution) {
    return cached;
  }
  const hasEditableData = hasInstitutionEditableData(institution);
  const draft = buildDraftFromInstitution(institution);
  if (!hasEditableData && cached) {
    logHealthDashboard('readLocalProfileEditorDraft:using-cached-over-minimal-institution', {
      institutionId,
      institutionKeys: Object.keys(institution).slice(0, 20),
    });
    return cached;
  }
  await writeProfileEditorCache(institutionId, draft);
  return draft;
};

const writeLocalProfileEditorDraft = async (
  institutionId: string,
  updates: Partial<InstitutionProfileEditorDraft>,
) => {
  const existingDraft: Partial<InstitutionProfileEditorDraft> =
    (await readProfileEditorCache(institutionId)) ??
    (await readLocalProfileEditorDraft(institutionId)) ??
    {};
  const nextDraft = {
    ...(existingDraft || {}),
    ...(updates || {}),
    hero: {
      ...(existingDraft?.hero || {}),
      ...(updates?.hero || {}),
    },
    seo: {
      ...(existingDraft?.seo || {}),
      ...(updates?.seo || {}),
    },
    contact: {
      ...(existingDraft?.contact || {}),
      ...(updates?.contact || {}),
    },
    emergencyBanner: {
      ...(existingDraft?.emergencyBanner || {}),
      ...(updates?.emergencyBanner || {}),
    },
    servicesVisibility: {
      ...(existingDraft?.servicesVisibility || {}),
      ...(updates?.servicesVisibility || {}),
    },
  };
  await writeProfileEditorCache(institutionId, nextDraft as Partial<InstitutionProfileEditorDraft>);
  return {
    success: true,
    status: 200,
    data: { profile_editor: nextDraft },
    message: 'Profile editor draft saved locally while API is unavailable.',
  };
};

const readLocalAvailabilityDraft = async (institutionId: string) => {
  const { institution } = await getHealthInstitutionContext(institutionId);
  const draft =
    institution?.availability ??
    institution?.dashboard?.availability ??
    null;
  return draft && typeof draft === 'object' ? draft : {};
};

const writeLocalAvailabilityDraft = async (
  institutionId: string,
  payload: Record<string, unknown>,
) => {
  const existing = await readLocalAvailabilityDraft(institutionId);
  const nextAvailability = {
    ...(existing || {}),
    ...(payload || {}),
  };
  return {
    success: true,
    status: 200,
    data: nextAvailability,
    message: 'Availability draft saved locally while API is unavailable.',
  };
};

const syncAvailabilityToHealthProfile = async (
  institutionId: string,
  payload: Record<string, unknown>,
) => {
  try {
    const state = await fetchHealthProfileState();
    const institutions = Array.isArray(state?.profile?.institutions) ? state.profile.institutions : [];
    if (!institutions.length) return;

    const index = institutions.findIndex(
      (institution: any) => String(institution?.id || '').trim() === String(institutionId || '').trim(),
    );
    if (index < 0) return;

    const currentInstitution = institutions[index] ?? {};
    const existingAvailability =
      (currentInstitution?.availability && typeof currentInstitution.availability === 'object'
        ? currentInstitution.availability
        : null) ??
      (currentInstitution?.dashboard?.availability && typeof currentInstitution.dashboard.availability === 'object'
        ? currentInstitution.dashboard.availability
        : {}) ??
      {};
    const nextAvailability = {
      ...(existingAvailability as Record<string, unknown>),
      ...(payload || {}),
    };

    const normalizedAvailability = {
      ...nextAvailability,
      calendar_statuses:
        nextAvailability?.calendar_statuses ??
        nextAvailability?.calendarStatuses ??
        nextAvailability?.date_statuses ??
        nextAvailability?.dateStatuses ??
        {},
      calendar_times:
        nextAvailability?.calendar_times ??
        nextAvailability?.calendarTimes ??
        nextAvailability?.date_times ??
        nextAvailability?.dateTimes ??
        {},
      calendar_time_lists:
        nextAvailability?.calendar_time_lists ??
        nextAvailability?.calendarTimeLists ??
        nextAvailability?.day_time_lists ??
        nextAvailability?.dayTimeLists ??
        {},
      calendar_time_modes:
        nextAvailability?.calendar_time_modes ??
        nextAvailability?.calendarTimeModes ??
        nextAvailability?.day_time_modes ??
        nextAvailability?.dayTimeModes ??
        {},
      calendar_service_ids:
        nextAvailability?.calendar_service_ids ??
        nextAvailability?.calendarServiceIds ??
        nextAvailability?.date_service_ids ??
        nextAvailability?.dateServiceIds ??
        {},
    };

    const nextInstitutions = [...institutions];
    nextInstitutions[index] = {
      ...currentInstitution,
      availability: normalizedAvailability,
      dashboard: {
        ...(currentInstitution?.dashboard || {}),
        availability: normalizedAvailability,
      },
    };
    await updateHealthInstitutions(nextInstitutions);
  } catch {
    // Keep health-dashboard save successful even if profile sync fails transiently.
  }
};

export const buildInitialDashboardSchema = (
  payload: CreateInstitutionDashboardPayload,
): InstitutionDashboardSchema => {
  const now = new Date().toISOString();
  const defaults = HEALTH_DASHBOARD_DEFAULT_SERVICES[payload.type];
  const modules = HEALTH_DASHBOARD_DEFAULT_OPERATIONAL_MODULES[payload.type];

  return {
    institutionId: payload.institutionId,
    type: payload.type,
    analyticsHeader: createEmptyAnalyticsHeader(),
    analytics: createEmptyAnalyticsBundle(),
    landingPreview: {
      hero: {
        imageUrl: '',
        title: '',
        slogan: '',
        ctaLabel: '',
        ctaUrl: '',
      },
      about: '',
      servicesOverview: defaults.map((item) => item.name),
      careTeamPreviewEnabled: true,
      gallery: [],
      testimonials: [],
      certifications: [],
      operatingHours: [],
    },
    services: defaults,
    operationalModules: modules,
    schedule: { today: 0, upcoming: 0, past: 0 },
    financial: {
      totalRevenueCents: 0,
      insuranceRevenueCents: 0,
      directRevenueCents: 0,
      pendingPaymentsCents: 0,
      refundsCents: 0,
      disputesCount: 0,
    },
    compliance: {
      auditLogCount: 0,
      pendingCredentialReviews: 0,
      licenseExpiringSoonCount: 0,
      activeConsents: 0,
      pendingDocuments: 0,
    },
    createdAt: now,
    updatedAt: now,
  };
};

export const fetchInstitutionDashboard = async (institutionId: string) => {
  if (healthDashboardApiUnavailable) {
    return { success: false, status: 404, message: 'Health dashboard API is unavailable.' };
  }
  return getRequest(ROUTES.healthDashboard.institution(institutionId));
};

export const createInstitutionDashboard = async (payload: CreateInstitutionDashboardPayload) => {
  if (healthDashboardApiUnavailable) {
    return { success: false, status: 404, message: 'Health dashboard API is unavailable.' };
  }
  const schema = buildInitialDashboardSchema(payload);
  const response = await postRequest(ROUTES.healthDashboard.institutions, schema);
  if (Number(response?.status) === 404) {
    healthDashboardApiUnavailable = true;
  }
  return response;
};

export const updateInstitutionDashboard = async (
  institutionId: string,
  updates: Partial<InstitutionDashboardSchema>,
) => {
  return patchRequest(ROUTES.healthDashboard.institution(institutionId), updates);
};

export const ensureInstitutionDashboardExists = async (
  institutionId: string,
  type: HealthDashboardInstitutionType,
) => {
  if (healthDashboardApiUnavailable) {
    return {
      success: true,
      status: 200,
      data: buildInitialDashboardSchema({ institutionId, type }),
      message: 'Using local fallback dashboard schema.',
    };
  }
  const existing = await fetchInstitutionDashboard(institutionId);
  if (existing?.success) return existing;
  if (Number(existing?.status) === 404) {
    const created = await createInstitutionDashboard({ institutionId, type });
    if (Number(created?.status) === 404) {
      healthDashboardApiUnavailable = true;
      return {
        success: true,
        status: 200,
        data: buildInitialDashboardSchema({ institutionId, type }),
        message: 'Using local fallback dashboard schema.',
      };
    }
    return created;
  }
  return createInstitutionDashboard({ institutionId, type });
};

export const fetchInstitutionProfileEditor = async (institutionId: string) => {
  logHealthDashboard('fetchInstitutionProfileEditor:start', {
    institutionId,
    healthDashboardApiUnavailable,
  });
  if (healthDashboardApiUnavailable) {
    const draft = await readLocalProfileEditorDraft(institutionId);
    logHealthDashboard('fetchInstitutionProfileEditor:fallback-local', {
      institutionId,
      hasDraft: !!draft,
      draftKeys: draft ? Object.keys(draft).slice(0, 20) : [],
    });
    return { success: true, status: 200, data: { profile_editor: draft ?? {} } };
  }
  const response = await getRequest(ROUTES.healthDashboard.profileEditor(institutionId));
  logHealthDashboard('fetchInstitutionProfileEditor:api-response', {
    status: response?.status,
    success: response?.success,
    message: response?.message,
    dataKeys: response?.data && typeof response.data === 'object' ? Object.keys(response.data).slice(0, 20) : [],
  });
  if (Number(response?.status) === 404) {
    healthDashboardApiUnavailable = true;
    const draft = await readLocalProfileEditorDraft(institutionId);
    logHealthDashboard('fetchInstitutionProfileEditor:api-404-fallback-local', {
      institutionId,
      hasDraft: !!draft,
    });
    return { success: true, status: 200, data: { profile_editor: draft ?? {} } };
  }
  if (response?.success) {
    const { institution } = await getHealthInstitutionContext(institutionId);
    if (institution) {
      const localDraft = buildDraftFromInstitution(
        institution,
        (response?.data?.profile_editor ??
          response?.data?.draft ??
          response?.data ??
          {}) as Partial<InstitutionProfileEditorDraft>,
      );
      await writeProfileEditorCache(institutionId, localDraft);
      logHealthDashboard('fetchInstitutionProfileEditor:merged-with-institution', {
        institutionId,
        hasInstitution: true,
        draftHeroTitle: localDraft?.hero?.title,
      });
      return { success: true, status: 200, data: { profile_editor: localDraft } };
    }
    const apiDraft =
      (response?.data?.profile_editor ??
        response?.data?.draft ??
        response?.data ??
        null) as Partial<InstitutionProfileEditorDraft> | null;
    if (apiDraft) {
      await writeProfileEditorCache(institutionId, apiDraft);
      logHealthDashboard('fetchInstitutionProfileEditor:using-api-draft-directly', {
        institutionId,
        draftKeys: Object.keys(apiDraft).slice(0, 20),
      });
      return { success: true, status: Number(response?.status ?? 200), data: { profile_editor: apiDraft } };
    }
  }
  const cached = await readProfileEditorCache(institutionId);
  if (cached) {
    logHealthDashboard('fetchInstitutionProfileEditor:using-cached-draft', {
      institutionId,
      draftKeys: Object.keys(cached).slice(0, 20),
    });
    return { success: true, status: 200, data: { profile_editor: cached } };
  }
  logHealthDashboard('fetchInstitutionProfileEditor:returning-raw-response');
  return response;
};

export const updateInstitutionProfileEditor = async (
  institutionId: string,
  updates: Partial<InstitutionProfileEditorDraft>,
) => {
  logHealthDashboard('updateInstitutionProfileEditor:start', {
    institutionId,
    updateKeys: updates && typeof updates === 'object' ? Object.keys(updates).slice(0, 20) : [],
    healthDashboardApiUnavailable,
  });
  const existingCache = await readProfileEditorCache(institutionId);
  const nextCache = {
    ...(existingCache || {}),
    ...(updates || {}),
    hero: {
      ...(existingCache?.hero || {}),
      ...(updates?.hero || {}),
    },
    seo: {
      ...(existingCache?.seo || {}),
      ...(updates?.seo || {}),
    },
    contact: {
      ...(existingCache?.contact || {}),
      ...(updates?.contact || {}),
    },
    emergencyBanner: {
      ...(existingCache?.emergencyBanner || {}),
      ...(updates?.emergencyBanner || {}),
    },
    servicesVisibility: {
      ...(existingCache?.servicesVisibility || {}),
      ...(updates?.servicesVisibility || {}),
    },
  };
  await writeProfileEditorCache(institutionId, nextCache as Partial<InstitutionProfileEditorDraft>);

  if (healthDashboardApiUnavailable) {
    logHealthDashboard('updateInstitutionProfileEditor:fallback-local-write');
    return writeLocalProfileEditorDraft(institutionId, updates);
  }
  const response = await patchRequest(ROUTES.healthDashboard.profileEditor(institutionId), updates);
  logHealthDashboard('updateInstitutionProfileEditor:api-response', {
    status: response?.status,
    success: response?.success,
    message: response?.message,
  });
  if (Number(response?.status) === 404) {
    healthDashboardApiUnavailable = true;
    logHealthDashboard('updateInstitutionProfileEditor:api-404-fallback-local-write');
    return writeLocalProfileEditorDraft(institutionId, updates);
  }
  if (response?.success) {
    await writeProfileEditorCache(institutionId, nextCache as Partial<InstitutionProfileEditorDraft>);
  }
  return response;
};

export const fetchInstitutionLandingPage = async (
  institutionId: string,
): Promise<{
  success: boolean;
  status?: number;
  message?: string;
  data?: InstitutionLandingPageRecord;
}> => {
  const response = await getRequest(ROUTES.healthDashboard.landingPage(institutionId));
  if (Number(response?.status) === 404) {
    return {
      success: true,
      status: 200,
      data: {
        exists: false,
        isPublished: false,
        draft: { isPublished: false },
        raw: {},
      },
    };
  }
  if (!response?.success) {
    return response as any;
  }
  return {
    ...response,
    data: normalizeInstitutionLandingPageRecord(response?.data ?? {}),
  };
};

export const upsertInstitutionLandingPage = async (
  institutionId: string,
  updates: {
    isPublished?: boolean;
    draft?: Partial<InstitutionProfileEditorDraft>;
  },
): Promise<{
  success: boolean;
  status?: number;
  message?: string;
  data?: InstitutionLandingPageRecord;
}> => {
  const payload: Record<string, unknown> = {};
  const publish = toOptionalBoolean(updates?.isPublished);
  if (publish !== null) {
    payload.isPublished = publish;
    payload.is_published = publish;
  }
  if (updates?.draft && typeof updates.draft === 'object') {
    payload.draft = updates.draft;
    payload.profile_editor = updates.draft;
  }

  const patchRes = await patchRequest(ROUTES.healthDashboard.landingPage(institutionId), payload);
  if (Number(patchRes?.status) !== 404) {
    if (!patchRes?.success) {
      return patchRes as any;
    }
    return {
      ...patchRes,
      data: normalizeInstitutionLandingPageRecord(patchRes?.data ?? payload),
    };
  }

  const postRes = await postRequest(ROUTES.healthDashboard.landingPage(institutionId), payload);
  if (!postRes?.success) {
    return postRes as any;
  }
  return {
    ...postRes,
    data: normalizeInstitutionLandingPageRecord(postRes?.data ?? payload),
  };
};

export const fetchInstitutionAvailability = async (institutionId: string) => {
  if (healthDashboardApiUnavailable) {
    const draft = await readLocalAvailabilityDraft(institutionId);
    return { success: true, status: 200, data: draft };
  }
  const response = await getRequest(ROUTES.healthDashboard.availability(institutionId));
  if (Number(response?.status) === 404) {
    healthDashboardApiUnavailable = true;
    const draft = await readLocalAvailabilityDraft(institutionId);
    return { success: true, status: 200, data: draft };
  }
  return response;
};

export const updateInstitutionAvailability = async (institutionId: string, payload: Record<string, unknown>) => {
  if (healthDashboardApiUnavailable) {
    const localResult = await writeLocalAvailabilityDraft(institutionId, payload);
    if (localResult?.success) {
      await syncAvailabilityToHealthProfile(institutionId, payload);
    }
    return localResult;
  }
  const response = await patchRequest(ROUTES.healthDashboard.availability(institutionId), payload);
  if (Number(response?.status) === 404) {
    healthDashboardApiUnavailable = true;
    const localResult = await writeLocalAvailabilityDraft(institutionId, payload);
    if (localResult?.success) {
      await syncAvailabilityToHealthProfile(institutionId, payload);
    }
    return localResult;
  }
  if (response?.success) {
    await syncAvailabilityToHealthProfile(institutionId, payload);
  }
  return response;
};

export const fetchInstitutionSchedule = async (institutionId: string) => {
  if (healthDashboardApiUnavailable) {
    return { success: true, status: 200, data: createEmptySchedulePayload() };
  }
  const response = await getRequest(ROUTES.healthDashboard.schedule(institutionId));
  if (Number(response?.status) === 404) {
    healthDashboardApiUnavailable = true;
    return { success: true, status: 200, data: createEmptySchedulePayload() };
  }
  return response;
};

export const updateInstitutionSchedule = async (
  institutionId: string,
  payload: Record<string, unknown>,
) => {
  if (healthDashboardApiUnavailable) {
    return { success: false, status: 404, message: 'Health dashboard API is unavailable.' };
  }
  return patchRequest(ROUTES.healthDashboard.schedule(institutionId), payload);
};

export const fetchInstitutionServices = async (institutionId: string) => {
  if (healthDashboardApiUnavailable) {
    return { success: true, status: 200, data: createEmptyServicesPayload() };
  }
  const response = await getRequest(ROUTES.healthDashboard.services(institutionId));
  if (Number(response?.status) === 404) {
    healthDashboardApiUnavailable = true;
    return { success: true, status: 200, data: createEmptyServicesPayload() };
  }
  return response;
};

export const updateInstitutionServices = async (
  institutionId: string,
  payload: Record<string, unknown>,
) => {
  if (healthDashboardApiUnavailable) {
    return { success: false, status: 404, message: 'Health dashboard API is unavailable.' };
  }
  return patchRequest(ROUTES.healthDashboard.services(institutionId), payload);
};

export const fetchInstitutionFinancial = async (institutionId: string) => {
  if (healthDashboardApiUnavailable) {
    return { success: true, status: 200, data: createEmptyFinancialPayload() };
  }
  const response = await getRequest(ROUTES.healthDashboard.financial(institutionId));
  if (Number(response?.status) === 404) {
    healthDashboardApiUnavailable = true;
    return { success: true, status: 200, data: createEmptyFinancialPayload() };
  }
  return response;
};

export const updateInstitutionFinancial = async (
  institutionId: string,
  payload: Record<string, unknown>,
) => {
  if (healthDashboardApiUnavailable) {
    return { success: false, status: 404, message: 'Health dashboard API is unavailable.' };
  }
  return patchRequest(ROUTES.healthDashboard.financial(institutionId), payload);
};

export const fetchInstitutionCompliance = async (institutionId: string) => {
  if (healthDashboardApiUnavailable) {
    return { success: true, status: 200, data: createEmptyCompliancePayload() };
  }
  const response = await getRequest(ROUTES.healthDashboard.compliance(institutionId));
  if (Number(response?.status) === 404) {
    healthDashboardApiUnavailable = true;
    return { success: true, status: 200, data: createEmptyCompliancePayload() };
  }
  return response;
};

export const updateInstitutionCompliance = async (
  institutionId: string,
  payload: Record<string, unknown>,
) => {
  if (healthDashboardApiUnavailable) {
    return { success: false, status: 404, message: 'Health dashboard API is unavailable.' };
  }
  return patchRequest(ROUTES.healthDashboard.compliance(institutionId), payload);
};

export const uploadHealthDashboardImage = async (
  asset: Asset,
  context = 'health_dashboard',
) => {
  if (!asset?.uri) throw new Error('Image asset is missing URI.');
  if (Date.now() < uploadBlockedUntil) {
    throw new Error('Image uploads are temporarily rate-limited. Please wait and try again.');
  }
  const form = new FormData();
  form.append('attachment', {
    uri: asset.uri,
    name: asset.fileName || `image-${Date.now()}.jpg`,
    type: asset.type || 'image/jpeg',
  } as any);
  form.append('context', context);
  const res = await postRequest(ROUTES.broadcasts.profileAttachment, form);
  if (Number(res?.status) === 429) {
    uploadBlockedUntil = Date.now() + 60 * 1000;
  }
  if (!res?.success) throw new Error(res?.message || 'Unable to upload image.');
  return res.data?.attachment ?? null;
};

export type InstitutionDashboardAnalyticsResult = {
  analyticsHeader: InstitutionDashboardSchema['analyticsHeader'];
  analytics: InstitutionDashboardSchema['analytics'];
  insightPayload: InsightPayload;
};

export const fetchInstitutionDashboardAnalytics = async (
  institutionId: string,
  timeRange: TimeRange = '30d',
): Promise<InstitutionDashboardAnalyticsResult> => {
  const queryPayload = healthDashboardApiUnavailable
    ? {
        bookings: [],
        consultations: [],
        schedules: [],
        payments: [],
        ratings: [],
        traffic: { views: 0 },
      }
    : await fetchInstitutionAnalyticsQueryPayload(institutionId, timeRange);
  const aggregated = aggregateInstitutionAnalytics(queryPayload, timeRange);
  let analyticsHeader = aggregated.analyticsHeader;

  try {
    const [scheduleRes, financialRes, _complianceRes, availabilityRes] = await Promise.all([
      fetchInstitutionSchedule(institutionId),
      fetchInstitutionFinancial(institutionId),
      fetchInstitutionCompliance(institutionId),
      fetchInstitutionAvailability(institutionId),
    ]);

    const schedulePayload = scheduleRes?.data ?? {};
    const fromSchedule = {
      today: toFiniteNumber((schedulePayload as any)?.today, 0),
      upcoming: toFiniteNumber((schedulePayload as any)?.upcoming, 0),
      past: toFiniteNumber((schedulePayload as any)?.past, 0),
    };
    const hasScheduleValues =
      fromSchedule.today > 0 || fromSchedule.upcoming > 0 || fromSchedule.past > 0;

    let scheduleSummary = fromSchedule;
    if (!hasScheduleValues) {
      const availabilityPayload = availabilityRes?.data?.availability ?? availabilityRes?.data ?? {};
      const calendarStatuses = readCalendarStatuses(availabilityPayload);
      if (Object.keys(calendarStatuses).length > 0) {
        const calendarTimes = readCalendarTimes(availabilityPayload);
        const calendarTimeLists = readCalendarTimeLists(availabilityPayload);
        const calendarTimeModes = readCalendarTimeModes(availabilityPayload);
        scheduleSummary = deriveScheduleSummaryFromStatuses(
          calendarStatuses,
          calendarTimes,
          calendarTimeLists,
          calendarTimeModes,
        );
      }
    }

    const financialPayload = financialRes?.data ?? {};
    const totalRevenueCents = toFiniteNumber((financialPayload as any)?.totalRevenueCents, 0);

    analyticsHeader = {
      ...aggregated.analyticsHeader,
      revenue: {
        today: totalRevenueCents,
        week: totalRevenueCents,
        month: totalRevenueCents,
      },
      pendingSchedules: scheduleSummary.today,
      bookingsCount: scheduleSummary.upcoming,
      completedConsultations: scheduleSummary.past,
    };
  } catch {
    analyticsHeader = aggregated.analyticsHeader;
  }

  return {
    analyticsHeader,
    analytics: aggregated.analytics,
    insightPayload: mapHealthDashboardAnalyticsToInsightPayload(
      analyticsHeader,
      aggregated.analytics,
    ),
  };
};
