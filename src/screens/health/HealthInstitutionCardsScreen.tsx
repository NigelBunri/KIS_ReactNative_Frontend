import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import LinearGradient from 'react-native-linear-gradient';
import { RootStackParamList } from '@/navigation/types';
import { KISIcon } from '@/constants/kisIcons';
import KISButton from '@/constants/KISButton';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { resolveBackendAssetUrl } from '@/network';
import {
  fetchHealthProfileState,
} from '@/services/healthProfileService';
import {
  fetchInstitutionAvailability,
  fetchInstitutionProfileEditor,
  fetchInstitutionLandingPage,
} from '@/services/healthDashboardService';
import { HEALTH_DASHBOARD_DEFAULT_SERVICES } from '@/features/health-dashboard/defaults';
import {
  HEALTH_DASHBOARD_INSTITUTION_TYPES,
  type HealthDashboardInstitutionType,
} from '@/features/health-dashboard/models';
import {
  filterHealthEngineNames,
  sanitizeServiceEngineFields,
  sanitizeServiceList,
} from '@/features/health-dashboard/serviceCatalogPolicy';
import {
  normalizeBookingEngineKey,
  resolveBookingEnginesFromKeys,
  type BookingEngineDescriptor,
} from '@/features/health-dashboard/bookingEngines';
import { fetchServiceEngineMappings } from '@/services/healthOpsWorkflowService';
import {
  getHealthThemeBorders,
  getHealthThemeColors,
  HEALTH_THEME_SPACING,
  HEALTH_THEME_TYPOGRAPHY,
} from '@/theme/health';

type Props = NativeStackScreenProps<RootStackParamList, 'HealthInstitutionCards'>;

type MemberRole = 'owner' | 'admin' | 'manager' | 'staff' | 'analyst' | 'member' | 'unassigned';

type ServiceDefinition = {
  id: string;
  name: string;
  description: string;
  active: boolean;
  basePriceCents?: number;
  mediumNames?: string[];
  availableEngines?: string[];
};

type ServiceRatingEntry = {
  id: string;
  serviceId: string;
  serviceName: string;
  userId: string;
  userName: string;
  rating: number;
  createdAt: string;
  updatedAt: string;
};

type HealthCardRow = {
  id: string;
  dateKey: string;
  timeValue: string;
  timeOptions: string[];
  accessMode: 'slots' | 'all_day';
  statusKey: string;
  statusLabel: string;
  statusColor: string;
  service: ServiceDefinition;
  isBroadcasted?: boolean;
};

type CardFilterKey = 'today' | 'upcoming' | 'past';
type CardTemporalBucket = CardFilterKey;

const STATUS_META: Record<string, { label: string; color: string }> = {
  available: { label: 'Available', color: '#10B981' },
  limited: { label: 'Limited', color: '#F59E0B' },
  fully_booked: { label: 'Booked', color: '#EF4444' },
  on_call: { label: 'On call', color: '#3B82F6' },
  holiday: { label: 'Holiday', color: '#8B5CF6' },
  blocked: { label: 'Blocked', color: '#6B7280' },
};

const BOOKING_ENGINE_TO_FLOW_KEY: Record<string, string> = {
  appointment: 'appointment',
  video: 'video',
  lab: 'clinical',
  prescription: 'pharmacy',
  payment: 'billing',
  surgery: 'admission',
  admission: 'admission',
  emergency: 'emergency',
  wellness: 'wellness',
  logistics: 'home_logistics',
};

const resolveConfiguredEngineFlowKeys = (engines: BookingEngineDescriptor[]): string[] =>
  Array.from(
    new Set(
      engines
        .map((engine) => BOOKING_ENGINE_TO_FLOW_KEY[String(engine?.key || '').trim().toLowerCase()])
        .filter((value): value is string => !!value),
    ),
  );

const normalizeStringList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || '').trim())
    .filter(Boolean);
};

const extractServiceEngineTokensFromRaw = (raw: any): string[] => {
  if (!raw || typeof raw !== 'object') return [];
  const tokens: string[] = [
    ...normalizeStringList(raw?.engineNames),
    ...normalizeStringList(raw?.engine_names),
    ...normalizeStringList(raw?.mediumNames),
    ...normalizeStringList(raw?.medium_names),
  ];
  if (Array.isArray(raw?.medium_links)) {
    raw.medium_links.forEach((link: any) => {
      const mediumName = String(link?.medium?.name || link?.name || '').trim();
      if (mediumName) tokens.push(mediumName);
    });
  }
  if (Array.isArray(raw?.mediumLinks)) {
    raw.mediumLinks.forEach((link: any) => {
      const mediumName = String(link?.medium?.name || link?.name || '').trim();
      if (mediumName) tokens.push(mediumName);
    });
  }
  return Array.from(new Set(filterHealthEngineNames(tokens)));
};

const resolveServiceEngineDescriptors = (service: ServiceDefinition): BookingEngineDescriptor[] => {
  const tokens = [
    ...normalizeStringList(service?.availableEngines),
    ...normalizeStringList(service?.mediumNames),
  ];
  if (!tokens.length) return [];
  return resolveBookingEnginesFromKeys(tokens);
};

const resolveServiceConfiguredFlowKeys = (service: ServiceDefinition): string[] => {
  const tokens = [
    ...normalizeStringList(service?.availableEngines),
    ...normalizeStringList(service?.mediumNames),
  ];
  if (!tokens.length) return [];
  const flowKeys: string[] = [];
  tokens.forEach((token) => {
    const engineKey = normalizeBookingEngineKey(token);
    const flowKey = engineKey ? BOOKING_ENGINE_TO_FLOW_KEY[engineKey] : '';
    if (flowKey && !flowKeys.includes(flowKey)) {
      flowKeys.push(flowKey);
    }
  });
  return flowKeys;
};

const isTimeValue = (value: unknown): value is string => /^\d{2}:\d{2}$/.test(String(value || ''));
const toNormalizedMode = (value: unknown) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
const isAllDayValue = (value: unknown) => {
  const normalized = toNormalizedMode(value);
  return normalized === 'all_day' || normalized === 'allday' || normalized === 'full_day';
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
        .map((entry: string) => entry.trim())
        .filter((entry: string) => isTimeText(entry)),
    ),
  ).sort();
};

const normalizeRole = (value: unknown): MemberRole => {
  const role = String(value || '').trim().toLowerCase();
  if (role === 'owner' || role === 'admin' || role === 'manager' || role === 'staff' || role === 'analyst' || role === 'member' || role === 'unassigned') {
    return role;
  }
  return 'unassigned';
};

const clampDiscount = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 10;
  const rounded = Math.round(parsed);
  return Math.max(10, Math.min(100, rounded));
};

const normalizeService = (raw: any, index: number): ServiceDefinition | null => {
  if (!raw || typeof raw !== 'object') return null;
  const id = String(raw.id ?? raw.service_id ?? raw.key ?? `service_${index + 1}`).trim();
  const name = String(raw.name ?? raw.title ?? raw.label ?? '').trim();
  if (!name) return null;
  const description = String(raw.description ?? raw.summary ?? '').trim();
  const centsRaw = raw.basePriceCents ?? raw.base_price_cents;
  const cents = Number.isFinite(Number(centsRaw)) ? Number(centsRaw) : undefined;
  const mediumNames = Array.from(
    new Set([
      ...normalizeStringList(raw?.mediumNames),
      ...normalizeStringList(raw?.medium_names),
      ...extractServiceEngineTokensFromRaw({ medium_links: raw?.medium_links, mediumLinks: raw?.mediumLinks }),
    ]),
  );
  const availableEngines = Array.from(
    new Set([
      ...normalizeStringList(raw?.availableEngines),
      ...normalizeStringList(raw?.available_engines),
      ...normalizeStringList(raw?.engineNames),
      ...normalizeStringList(raw?.engine_names),
    ]),
  );
  return sanitizeServiceEngineFields({
    id,
    name,
    description,
    active: raw.active !== false,
    basePriceCents: typeof cents === 'number' && cents >= 0 ? cents : undefined,
    mediumNames,
    availableEngines,
  });
};

const resolveInstitutionServices = (institution: any): ServiceDefinition[] => {
  const candidates = [
    institution?.services,
    institution?.service_templates,
    institution?.serviceTemplates,
    institution?.dashboard?.services,
  ];
  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue;
    const mapped = candidate
      .map((entry, index) => normalizeService(entry, index))
      .filter(Boolean) as ServiceDefinition[];
    if (mapped.length > 0) return mapped;
  }
  const normalizedType = (() => {
    const type = String(institution?.type || '').trim().toLowerCase();
    if (type === 'diagnostics_center') return 'diagnostics';
    if (type === 'laboratory') return 'lab';
    if (HEALTH_DASHBOARD_INSTITUTION_TYPES.includes(type as HealthDashboardInstitutionType)) {
      return type as HealthDashboardInstitutionType;
    }
    return 'clinic' as HealthDashboardInstitutionType;
  })();
  return sanitizeServiceList([...(HEALTH_DASHBOARD_DEFAULT_SERVICES[normalizedType] || [])]);
};

const resolveAvailability = (institution: any) =>
  institution?.availability ?? institution?.dashboard?.availability ?? {};

const readStatuses = (raw: any): Record<string, string> => {
  const source =
    raw?.calendar_statuses ?? raw?.calendarStatuses ?? raw?.date_statuses ?? raw?.dateStatuses ?? {};
  if (!source || typeof source !== 'object' || Array.isArray(source)) return {};
  return source as Record<string, string>;
};

const readTimes = (raw: any): Record<string, string> => {
  const source =
    raw?.calendar_times ?? raw?.calendarTimes ?? raw?.date_times ?? raw?.dateTimes ?? {};
  if (!source || typeof source !== 'object' || Array.isArray(source)) return {};
  return source as Record<string, string>;
};

const readTimeLists = (raw: any): Record<string, string[]> => {
  const source =
    raw?.calendar_time_lists ??
    raw?.calendarTimeLists ??
    raw?.day_time_lists ??
    raw?.dayTimeLists ??
    {};
  const legacy = readTimes(raw);
  const map: Record<string, string[]> = {};
  if (source && typeof source === 'object' && !Array.isArray(source)) {
    Object.entries(source).forEach(([dateKey, value]) => {
      const times = normalizeTimeList(value);
      if (!times.length) return;
      map[dateKey] = times;
    });
  }
  Object.entries(legacy).forEach(([dateKey, value]) => {
    if (map[dateKey]?.length) return;
    const times = normalizeTimeList(value);
    if (!times.length) return;
    map[dateKey] = times;
  });
  return map;
};

const readTimeModes = (raw: any): Record<string, 'slots' | 'all_day'> => {
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
  const legacyTimes = readTimes(raw);
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

const readServiceIds = (raw: any): Record<string, string[]> => {
  const source =
    raw?.calendar_service_ids ??
    raw?.calendarServiceIds ??
    raw?.date_service_ids ??
    raw?.dateServiceIds ??
    {};
  if (!source || typeof source !== 'object' || Array.isArray(source)) return {};
  const map: Record<string, string[]> = {};
  Object.entries(source).forEach(([dateKey, ids]) => {
    if (!Array.isArray(ids)) return;
    map[dateKey] = ids.map((item) => String(item || '').trim()).filter(Boolean);
  });
  return map;
};

const prettifyServiceId = (value: string) =>
  String(value || '')
    .trim()
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
    .trim();

const parseDateOnly = (value: string): Date | null => {
  const [y, m, d] = String(value || '').split('-').map((part) => Number(part));
  if (!y || !m || !d) return null;
  const parsed = new Date(y, m - 1, d, 0, 0, 0, 0);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const parseDateTime = (dateKey: string, timeValue: string): Date | null => {
  if (!isTimeValue(timeValue)) return null;
  const base = parseDateOnly(dateKey);
  if (!base) return null;
  const [hh, mm] = timeValue.split(':').map((part) => Number(part));
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  const parsed = new Date(base.getFullYear(), base.getMonth(), base.getDate(), hh, mm, 0, 0);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const getCardTimeOptions = (card: Pick<HealthCardRow, 'accessMode' | 'timeOptions' | 'timeValue'>): string[] => {
  if (card.accessMode === 'all_day') return [];
  if (Array.isArray(card.timeOptions) && card.timeOptions.length > 0) {
    return normalizeTimeList(card.timeOptions);
  }
  return normalizeTimeList(card.timeValue);
};

const getCardSortTimestamp = (card: Pick<HealthCardRow, 'dateKey' | 'accessMode' | 'timeOptions' | 'timeValue'>) => {
  const date = parseDateOnly(card.dateKey);
  if (!date) return Number.MAX_SAFE_INTEGER;
  if (card.accessMode === 'all_day') return date.getTime();
  const firstSlot = getCardTimeOptions(card)[0];
  const slotDate = firstSlot ? parseDateTime(card.dateKey, firstSlot) : null;
  return slotDate ? slotDate.getTime() : date.getTime();
};

const getCardLatestSlotDateTime = (
  card: Pick<HealthCardRow, 'dateKey' | 'accessMode' | 'timeOptions' | 'timeValue'>,
): Date | null => {
  if (card.accessMode === 'all_day') return null;
  const slots = getCardTimeOptions(card);
  if (!slots.length) return null;
  const slotDates = slots
    .map((slot) => parseDateTime(card.dateKey, slot))
    .filter((value): value is Date => !!value);
  if (!slotDates.length) return null;
  return slotDates.reduce((latest, value) => (value > latest ? value : latest), slotDates[0]);
};

const classifyCardTemporalBucket = (
  card: Pick<HealthCardRow, 'dateKey' | 'accessMode' | 'timeOptions' | 'timeValue'>,
  now: Date,
): CardTemporalBucket | null => {
  const day = parseDateOnly(card.dateKey);
  if (!day) return null;
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  if (day < todayStart) return 'past';
  if (day >= tomorrowStart) return 'upcoming';
  if (card.accessMode === 'all_day') return 'today';

  const latestSlotDateTime = getCardLatestSlotDateTime(card);
  if (!latestSlotDateTime) return 'today';
  return latestSlotDateTime >= now ? 'today' : 'past';
};

const extractRows = (payload: any, preferredKeys: string[]): any[] => {
  const queue: any[] = [payload];
  const visited = new Set<any>();
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    if (Array.isArray(current)) return current;
    if (typeof current !== 'object') continue;
    if (visited.has(current)) continue;
    visited.add(current);

    for (const key of preferredKeys) {
      const candidate = current?.[key];
      if (Array.isArray(candidate)) return candidate;
      if (candidate && typeof candidate === 'object') {
        queue.push(candidate);
      }
    }

    const nested = [current?.data, current?.payload, current?.result, current?.response];
    nested.forEach((entry) => {
      if (entry && typeof entry === 'object') queue.push(entry);
    });
  }
  return [];
};

const extractConfiguredEngineKeys = (payload: any): string[] => {
  const rows = extractRows(payload, ['results', 'items', 'mappings', 'engines']);
  if (!rows.length) return [];
  const keys = new Set<string>();
  rows.forEach((row) => {
    if (!row || typeof row !== 'object') return;
    const candidates = [
      row?.engine_key,
      row?.engineKey,
      row?.engine_code,
      row?.engineCode,
      row?.engine_name,
      row?.engineName,
      row?.key,
      row?.slug,
      row?.name,
      row?.code,
      row?.engine?.key,
      row?.engine?.slug,
      row?.engine?.name,
      row?.engine?.code,
    ];
    candidates.forEach((value) => {
      const normalized = String(value || '').trim();
      if (normalized) keys.add(normalized);
    });
  });
  return Array.from(keys);
};

const toCardIdVariants = (value: unknown): string[] => {
  const raw = String(value || '').trim();
  if (!raw) return [];
  const variants = new Set<string>([raw]);
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})[:-](.+)[:-](\d+)$/);
  if (match) {
    const [, dateKey, serviceId, index] = match;
    variants.add(`${dateKey}:${serviceId}:${index}`);
    variants.add(`${dateKey}-${serviceId}-${index}`);
  }
  return Array.from(variants);
};

const extractCardIdentityKey = (value: unknown): string => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const colonMatch = raw.match(/^(\d{4}-\d{2}-\d{2}):(.+):(\d+)$/);
  if (colonMatch) {
    const [, dateKey, serviceId] = colonMatch;
    return `${dateKey}:${serviceId}`;
  }
  const dashMatch = raw.match(/^(\d{4}-\d{2}-\d{2})-(.+)-(\d+)$/);
  if (dashMatch) {
    const [, dateKey, serviceId] = dashMatch;
    return `${dateKey}:${serviceId}`;
  }
  return '';
};

const cardIdsMatchForSession = (left: unknown, right: unknown): boolean => {
  const leftVariants = new Set(toCardIdVariants(left));
  const rightVariants = toCardIdVariants(right);
  if (rightVariants.some((value) => leftVariants.has(value))) return true;
  const leftIdentity = extractCardIdentityKey(left);
  const rightIdentity = extractCardIdentityKey(right);
  if (leftIdentity && rightIdentity && leftIdentity === rightIdentity) return true;
  return false;
};

const addBroadcastedCardId = (target: Set<string>, value: unknown) => {
  toCardIdVariants(value).forEach((entry) => target.add(entry));
};

const collectBroadcastedCardIds = (...sources: any[]): Set<string> => {
  const ids = new Set<string>();

  const collectFrom = (source: any) => {
    if (!source) return;

    if (Array.isArray(source)) {
      source.forEach((item) => addBroadcastedCardId(ids, item));
      return;
    }

    if (typeof source !== 'object') return;

    const directArrays = [
      source?.broadcasted_card_ids,
      source?.broadcastedCardIds,
      source?.broadcasted_health_cards,
      source?.broadcastedHealthCards,
    ];
    directArrays.forEach((value) => collectFrom(value));

    if (Array.isArray(source?.cards)) {
      source.cards.forEach((card: any) => {
        const flagged = !!(card?.isBroadcasted || card?.is_broadcasted || card?.broadcasted);
        if (!flagged) return;
        addBroadcastedCardId(ids, card?.id);
      });
    }

    if (source?.institution && typeof source.institution === 'object') {
      collectFrom(source.institution);
    }
  };

  sources.forEach((source) => collectFrom(source));
  return ids;
};

const isCardIdBroadcasted = (cardId: unknown, broadcastedSet: Set<string>) =>
  toCardIdVariants(cardId).some((value) => broadcastedSet.has(value));

const buildCards = (institution: any, availabilityOverride?: Record<string, unknown> | null): HealthCardRow[] => {
  const availability =
    availabilityOverride && typeof availabilityOverride === 'object'
      ? availabilityOverride
      : resolveAvailability(institution);
  const statuses = readStatuses(availability);
  const times = readTimes(availability);
  const timeLists = readTimeLists(availability);
  const timeModes = readTimeModes(availability);
  const dateServiceIds = readServiceIds(availability);
  const services = resolveInstitutionServices(institution).filter((service) => service.active !== false);
  const serviceById = new Map(services.map((service) => [String(service.id), service]));
  const broadcastedCardIds = collectBroadcastedCardIds(institution);

  const rows: HealthCardRow[] = [];
  Object.entries(dateServiceIds).forEach(([dateKey, ids]) => {
    const statusKey = String(statuses[dateKey] || 'available');
    const status = STATUS_META[statusKey] || STATUS_META.available;
    const accessMode: 'slots' | 'all_day' = timeModes[dateKey] === 'all_day' ? 'all_day' : 'slots';
    const timeOptions = accessMode === 'slots'
      ? normalizeTimeList(timeLists[dateKey] || times[dateKey])
      : [];
    const timeValue = accessMode === 'all_day' ? 'All day' : timeOptions.join(', ');
    ids.forEach((serviceId, serviceIndex) => {
      const normalizedServiceId = String(serviceId || '').trim();
      if (!normalizedServiceId) return;
      let service = serviceById.get(normalizedServiceId);
      if (!service) {
        service = {
          id: normalizedServiceId,
          name: prettifyServiceId(normalizedServiceId) || 'Health Service',
          description: '',
          active: true,
        };
        serviceById.set(normalizedServiceId, service);
      }
      const cardId = `${dateKey}:${service.id}:${serviceIndex}`;
      rows.push({
        id: cardId,
        dateKey,
        timeValue,
        timeOptions,
        accessMode,
        statusKey,
        statusLabel: status.label,
        statusColor: status.color,
        isBroadcasted: isCardIdBroadcasted(cardId, broadcastedCardIds),
        service,
      });
    });
  });

  rows.sort((a, b) => {
    const delta = getCardSortTimestamp(a) - getCardSortTimestamp(b);
    if (delta !== 0) return delta;
    return String(a.service.name || '').localeCompare(String(b.service.name || ''));
  });

  return rows;
};

const enrichCardsWithAvailability = (
  cards: HealthCardRow[],
  availability: Record<string, unknown> | null | undefined,
): HealthCardRow[] => {
  if (!availability || typeof availability !== 'object') return cards;
  const times = readTimes(availability);
  const timeLists = readTimeLists(availability);
  const timeModes = readTimeModes(availability);
  return cards.map((card) => {
    const dateKey = String(card.dateKey || '').trim();
    if (!dateKey) return card;
    const modeFromAvailability = timeModes[dateKey];
    const accessMode: 'slots' | 'all_day' =
      modeFromAvailability === 'all_day'
        ? 'all_day'
        : card.accessMode;
    const options = accessMode === 'slots'
      ? normalizeTimeList(
          timeLists[dateKey]?.length
            ? timeLists[dateKey]
            : card.timeOptions?.length
            ? card.timeOptions
            : times[dateKey] || card.timeValue,
        )
      : [];
    return {
      ...card,
      accessMode,
      timeOptions: options,
      timeValue: accessMode === 'all_day' ? 'All day' : options.join(', '),
    };
  });
};

const toCardScheduleKey = (card: Pick<HealthCardRow, 'dateKey' | 'service'>) =>
  `${String(card?.dateKey || '').trim()}:${String(card?.service?.id || '').trim()}`;

const mergeCardRows = (
  primary: HealthCardRow[],
  secondary: HealthCardRow[],
): HealthCardRow[] => {
  const map = new Map<string, HealthCardRow>();

  const upsert = (row: HealthCardRow, source: 'primary' | 'secondary', index: number) => {
    const dateKey = String(row?.dateKey || '').trim();
    const serviceId = String(row?.service?.id || '').trim();
    if (!dateKey || !serviceId) return;
    const key = `${dateKey}:${serviceId}`;
    const accessMode: 'slots' | 'all_day' = row.accessMode === 'all_day' ? 'all_day' : 'slots';
    const timeOptions = accessMode === 'slots' ? getCardTimeOptions(row) : [];
    const normalizedService =
      sanitizeServiceEngineFields({
        id: serviceId,
        name: String(row?.service?.name || '').trim() || prettifyServiceId(serviceId) || 'Health Service',
        description: String(row?.service?.description || '').trim(),
        active: row?.service?.active !== false,
        basePriceCents: Number.isFinite(Number(row?.service?.basePriceCents))
          ? Number(row?.service?.basePriceCents)
          : undefined,
        mediumNames: normalizeStringList(row?.service?.mediumNames),
        availableEngines: normalizeStringList(row?.service?.availableEngines),
      }) || {
        id: serviceId,
        name: String(row?.service?.name || '').trim() || prettifyServiceId(serviceId) || 'Health Service',
        description: String(row?.service?.description || '').trim(),
        active: row?.service?.active !== false,
        basePriceCents: Number.isFinite(Number(row?.service?.basePriceCents))
          ? Number(row?.service?.basePriceCents)
          : undefined,
      };
    const normalizedRow: HealthCardRow = {
      ...row,
      id: String(row?.id || `${key}:${index}`).trim() || `${key}:${index}`,
      dateKey,
      accessMode,
      timeOptions,
      timeValue: accessMode === 'all_day' ? 'All day' : timeOptions.join(', '),
      service: normalizedService,
    };

    const existing = map.get(key);
    if (!existing) {
      map.set(key, normalizedRow);
      return;
    }

    const mergedAccessMode: 'slots' | 'all_day' =
      existing.accessMode === 'all_day' || normalizedRow.accessMode === 'all_day'
        ? 'all_day'
        : 'slots';
    const mergedTimes =
      mergedAccessMode === 'all_day'
        ? []
        : normalizeTimeList([
            ...(existing.timeOptions || []),
            ...(normalizedRow.timeOptions || []),
            existing.timeValue,
            normalizedRow.timeValue,
          ]);
    const shouldUseSecondaryService =
      source === 'secondary' &&
      (String(existing.service?.name || '').trim() === '' ||
        String(existing.service?.name || '').trim() === 'Health Service' ||
        String(existing.service?.name || '').trim() === prettifyServiceId(existing.service.id));
    const existingBasePrice = Number(existing.service?.basePriceCents);
    const nextBasePrice = Number(normalizedRow.service?.basePriceCents);
    const mergedBasePrice = Number.isFinite(existingBasePrice)
      ? existingBasePrice
      : Number.isFinite(nextBasePrice)
      ? nextBasePrice
      : undefined;
    const mergedMediumNames = Array.from(
      new Set([
        ...normalizeStringList(existing.service?.mediumNames),
        ...normalizeStringList(normalizedRow.service?.mediumNames),
      ]),
    );
    const mergedAvailableEngines = Array.from(
      new Set([
        ...normalizeStringList(existing.service?.availableEngines),
        ...normalizeStringList(normalizedRow.service?.availableEngines),
      ]),
    );
    const mergedService =
      sanitizeServiceEngineFields({
        ...(shouldUseSecondaryService ? normalizedRow.service : existing.service),
        basePriceCents: mergedBasePrice,
        mediumNames: mergedMediumNames,
        availableEngines: mergedAvailableEngines,
      }) || {
        ...(shouldUseSecondaryService ? normalizedRow.service : existing.service),
        basePriceCents: mergedBasePrice,
      };

    map.set(key, {
      ...existing,
      ...(source === 'secondary' && normalizedRow.id ? { id: normalizedRow.id } : {}),
      service: mergedService,
      isBroadcasted: !!existing.isBroadcasted || !!normalizedRow.isBroadcasted,
      accessMode: mergedAccessMode,
      timeOptions: mergedTimes,
      timeValue: mergedAccessMode === 'all_day' ? 'All day' : mergedTimes.join(', '),
    });
  };

  primary.forEach((card, index) => upsert(card, 'primary', index));
  secondary.forEach((card, index) => upsert(card, 'secondary', index + primary.length));

  return Array.from(map.values()).sort((a, b) => {
    const delta = getCardSortTimestamp(a) - getCardSortTimestamp(b);
    if (delta !== 0) return delta;
    return String(a.service.name || '').localeCompare(String(b.service.name || ''));
  });
};

const toDateLabel = (isoDate: string) => {
  const [y, m, d] = String(isoDate || '').split('-').map((part) => Number(part));
  if (!y || !m || !d) return isoDate;
  return new Date(y, m - 1, d).toDateString();
};

const toMoney = (cents?: number) => {
  if (!Number.isFinite(Number(cents))) return 'Not set';
  const kisc = Number(cents) / 10000;
  return `${kisc.toFixed(3).replace(/\.?0+$/, '')} KISC`;
};

const toKisc = (micro?: number) => {
  if (!Number.isFinite(Number(micro))) return '0.000';
  return (Number(micro) / 100000).toFixed(3);
};

const getCardPrimaryTime = (card: Pick<HealthCardRow, 'accessMode' | 'timeOptions' | 'timeValue'>) => {
  if (card.accessMode === 'all_day') return '';
  const options = getCardTimeOptions(card);
  return options[0] || '';
};

const getCardScheduleLabel = (card: Pick<HealthCardRow, 'accessMode' | 'timeOptions' | 'timeValue'>) => {
  if (card.accessMode === 'all_day') return 'All day access';
  const options = getCardTimeOptions(card);
  if (!options.length) return '';
  if (options.length === 1) return options[0];
  return `${options.length} slots`;
};

const resolveLandingDraft = (institution: any) => {
  const fromEditor = institution?.profile_editor ?? institution?.profileEditor;
  if (fromEditor && typeof fromEditor === 'object') return fromEditor;
  const fromPreview = institution?.landing_preview ?? institution?.landingPreview;
  if (fromPreview && typeof fromPreview === 'object') return fromPreview;
  const fromDashboard = institution?.dashboard?.profile_editor ?? institution?.dashboard?.profileEditor;
  if (fromDashboard && typeof fromDashboard === 'object') return fromDashboard;
  return {};
};

const resolveLandingPublished = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return value !== 0;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['true', '1', 'yes', 'published', 'active'].includes(normalized)) return true;
      if (['false', '0', 'no', 'unpublished', 'inactive'].includes(normalized)) return false;
    }
  }
  return false;
};

const normalizeRatings = (raw: any): ServiceRatingEntry[] => {
  if (!Array.isArray(raw)) return [];
  const rows: ServiceRatingEntry[] = [];
  raw.forEach((item, index) => {
    if (!item || typeof item !== 'object') return;
    const serviceId = String(item.serviceId ?? item.service_id ?? '').trim();
    const userId = String(item.userId ?? item.user_id ?? '').trim();
    const rating = Number(item.rating ?? item.score);
    if (!serviceId || !userId || !Number.isFinite(rating) || rating < 1 || rating > 5) return;
    rows.push({
      id: String(item.id ?? `rating_${index + 1}`),
      serviceId,
      serviceName: String(item.serviceName ?? item.service_name ?? '').trim(),
      userId,
      userName: String(item.userName ?? item.user_name ?? 'User').trim() || 'User',
      rating: Math.round(rating),
      createdAt: String(item.createdAt ?? item.created_at ?? new Date().toISOString()),
      updatedAt: String(item.updatedAt ?? item.updated_at ?? new Date().toISOString()),
    });
  });
  return rows;
};

const resolveMembershipSettings = (institution: any) => {
  const settings = institution?.membership_settings ?? institution?.membershipSettings ?? {};
  const openValue =
    settings?.open ??
    settings?.is_open ??
    institution?.membership_open ??
    institution?.membershipOpen ??
    false;
  const discountValue =
    settings?.discountPercent ??
    settings?.discount_percent ??
    institution?.membership_discount_pct ??
    institution?.membershipDiscountPct ??
    10;
  return {
    open: !!openValue,
    discountPercent: clampDiscount(discountValue),
  };
};

export default function HealthInstitutionCardsScreen({ navigation, route }: Props) {
  const institutionId = route.params.institutionId;
  const institutionName = route.params.institutionName ?? 'Health Cards';

  const scheme = useColorScheme();
  const palette = getHealthThemeColors(scheme === 'light' ? 'light' : 'dark');
  const borders = getHealthThemeBorders(palette);
  const spacing = HEALTH_THEME_SPACING;
  const typography = HEALTH_THEME_TYPOGRAPHY;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ratingServiceIdBusy, setRatingServiceIdBusy] = useState('');
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [currentUserId, setCurrentUserId] = useState('');
  const [membershipOpen, setMembershipOpen] = useState(false);
  const [membershipDiscountPercent, setMembershipDiscountPercent] = useState(10);
  const [ratings, setRatings] = useState<ServiceRatingEntry[]>([]);
  const [backendCards, setBackendCards] = useState<HealthCardRow[]>([]);
  const [backendCardsLoaded, setBackendCardsLoaded] = useState(false);
  const [availabilityOverride, setAvailabilityOverride] = useState<Record<string, unknown> | null>(null);
  const availabilitySnapshotRef = useRef<Record<string, unknown> | null>(null);
  const [viewerRole, setViewerRole] = useState<MemberRole>('unassigned');
  const [viewerCanManage, setViewerCanManage] = useState(false);
  const [viewerIsMember, setViewerIsMember] = useState(false);
  const [cardFilter, setCardFilter] = useState<CardFilterKey>('today');
  const [timePickerCard, setTimePickerCard] = useState<HealthCardRow | null>(null);
  const [selectedBookingTime, setSelectedBookingTime] = useState('');
  const [landingPageDraft, setLandingPageDraft] = useState<any>({});
  const [landingPagePublished, setLandingPagePublished] = useState(false);
  const [landingPageResolved, setLandingPageResolved] = useState(false);
  const [configuredServiceEngines, setConfiguredServiceEngines] = useState<Record<string, BookingEngineDescriptor[]>>({});
  const serviceEngineCacheRef = useRef<Record<string, BookingEngineDescriptor[]>>({});

  const institutionIndex = useMemo(
    () => institutions.findIndex((item: any) => String(item?.id) === String(institutionId)),
    [institutionId, institutions],
  );
  const institution = institutionIndex >= 0 ? institutions[institutionIndex] : null;
  const broadcastedCardIds = useMemo(
    () => collectBroadcastedCardIds(institution, { cards: backendCards }),
    [backendCards, institution],
  );
  const isCardBroadcasted = useCallback(
    (card: HealthCardRow | null | undefined) => {
      if (!card) return false;
      if (card.isBroadcasted) return true;
      return isCardIdBroadcasted(card.id, broadcastedCardIds);
    },
    [broadcastedCardIds],
  );

  const localLandingDraft = useMemo(() => resolveLandingDraft(institution), [institution]);
  const effectiveLandingDraft = useMemo(() => {
    if (
      landingPageDraft &&
      typeof landingPageDraft === 'object' &&
      Object.keys(landingPageDraft).length > 0
    ) {
      return landingPageDraft;
    }
    return localLandingDraft;
  }, [landingPageDraft, localLandingDraft]);
  const inferredLandingPublished = useMemo(
    () =>
      resolveLandingPublished(
        localLandingDraft?.isPublished,
        localLandingDraft?.is_published,
        institution?.landing_is_published,
        institution?.landingIsPublished,
        institution?.landing_page_is_published,
        institution?.landingPageIsPublished,
      ),
    [institution, localLandingDraft],
  );
  const landingPublished = landingPageResolved ? landingPagePublished : inferredLandingPublished;

  const logoUrl = useMemo(() => {
    const raw =
      effectiveLandingDraft?.landingLogoUrl ??
      institution?.landingLogoUrl ??
      institution?.profile_editor?.landingLogoUrl ??
      institution?.profileEditor?.landingLogoUrl ??
      '';
    if (!raw) return '';
    return resolveBackendAssetUrl(raw) || raw;
  }, [effectiveLandingDraft, institution]);

  const cards = useMemo(() => {
    const localCards = buildCards(institution, availabilityOverride);
    if (!backendCardsLoaded) return localCards;
    const localScheduleKeys = new Set(localCards.map((card) => toCardScheduleKey(card)));
    const backendForMerge =
      localCards.length > 0
        ? backendCards.filter((card) => localScheduleKeys.has(toCardScheduleKey(card)))
        : backendCards;
    const mergedCards = mergeCardRows(localCards, backendForMerge);
    return mergedCards;
  }, [availabilityOverride, backendCards, backendCardsLoaded, institution]);
  const filteredCards = useMemo(() => {
    const now = new Date();
    return cards.filter((card) => {
      const bucket = classifyCardTemporalBucket(card, now);
      if (!bucket) return false;
      return bucket === cardFilter;
    });
  }, [cardFilter, cards]);

  const actorRole = viewerRole;
  const canManageMembership = viewerCanManage;
  const isCurrentUserMember = viewerIsMember;

  const ratingsByService = useMemo(() => {
    const grouped = new Map<string, ServiceRatingEntry[]>();
    ratings.forEach((entry) => {
      const key = String(entry.serviceId);
      const current = grouped.get(key) || [];
      current.push(entry);
      grouped.set(key, current);
    });
    return grouped;
  }, [ratings]);

  const fetchCardsFromBackend = useCallback(
    async (availabilitySnapshot?: Record<string, unknown> | null) => {
      const url = ROUTES.broadcasts.healthCards(institutionId);
      const response = await getRequest(url, { forceNetwork: true });
      if (!response?.success) {
        setBackendCards([]);
        setBackendCardsLoaded(true);
        throw new Error(response?.message || 'Unable to load health cards.');
      }
      const payload = response?.data ?? {};
      const viewer = payload?.viewer ?? {};
      const membership = payload?.membership ?? {};
      const apiCards = Array.isArray(payload?.cards) ? payload.cards : [];
      const apiBroadcastedCardIds = collectBroadcastedCardIds(payload);
      const rawCards: HealthCardRow[] = apiCards.map((item: any, index: number) => {
        const service =
          normalizeService(item?.service, index) ||
          sanitizeServiceEngineFields({
            id: String(item?.service?.id || `service_${index + 1}`),
            name: String(item?.service?.name || 'Service'),
            description: String(item?.service?.description || ''),
            active: true,
            basePriceCents: Number.isFinite(Number(item?.service?.basePriceCents))
              ? Number(item.service.basePriceCents)
              : undefined,
            mediumNames: [
              ...normalizeStringList(item?.service?.mediumNames),
              ...normalizeStringList(item?.service?.medium_names),
            ],
            availableEngines: [
              ...normalizeStringList(item?.service?.availableEngines),
              ...normalizeStringList(item?.service?.available_engines),
            ],
          }) || {
            id: String(item?.service?.id || `service_${index + 1}`),
            name: String(item?.service?.name || 'Service'),
            description: String(item?.service?.description || ''),
            active: true,
            basePriceCents: Number.isFinite(Number(item?.service?.basePriceCents))
              ? Number(item.service.basePriceCents)
              : undefined,
          };
        const dateKey = String(item?.date || item?.dateKey || '');
        const cardId = String(item?.id || `${dateKey}:${service.id}:${index}`);
        const explicitBroadcasted = !!(item?.isBroadcasted || item?.is_broadcasted || item?.broadcasted);
        const inferredBroadcasted = isCardIdBroadcasted(cardId, apiBroadcastedCardIds);
        const accessModeRaw = item?.access_mode ?? item?.accessMode;
        const rawTimeValue = item?.time ?? item?.timeValue;
        const accessMode: 'slots' | 'all_day' =
          isAllDayValue(accessModeRaw) || isAllDayValue(rawTimeValue) || !!item?.all_day || !!item?.allDay
            ? 'all_day'
            : 'slots';
        const timeOptions = accessMode === 'slots'
          ? normalizeTimeList(item?.time_options ?? item?.timeOptions ?? item?.time ?? item?.timeValue)
          : [];
        return {
          id: cardId,
          dateKey,
          timeValue: accessMode === 'all_day' ? 'All day' : timeOptions.join(', '),
          timeOptions,
          accessMode,
          statusKey: String(item?.statusKey || 'available'),
          statusLabel: String(item?.statusLabel || STATUS_META[String(item?.statusKey || 'available')]?.label || 'Available'),
          statusColor: String(item?.statusColor || STATUS_META[String(item?.statusKey || 'available')]?.color || '#10B981'),
          isBroadcasted: explicitBroadcasted || inferredBroadcasted,
          service,
        };
      });

      const dedupedMap = new Map<string, HealthCardRow>();
      rawCards.forEach((row, index) => {
        const dedupeKey = `${row.dateKey}:${row.service.id}`;
        const existing = dedupedMap.get(dedupeKey);
        if (!existing) {
          dedupedMap.set(dedupeKey, {
            ...row,
            id: row.id || `${row.dateKey}:${row.service.id}:${index}`,
            timeOptions: row.accessMode === 'all_day' ? [] : normalizeTimeList(row.timeOptions),
            timeValue: row.accessMode === 'all_day' ? 'All day' : normalizeTimeList(row.timeOptions).join(', '),
          });
          return;
        }

        const mergedAccessMode: 'slots' | 'all_day' =
          existing.accessMode === 'all_day' || row.accessMode === 'all_day'
            ? 'all_day'
            : 'slots';
        const mergedTimes = mergedAccessMode === 'all_day'
          ? []
          : normalizeTimeList([
              ...(existing.timeOptions || []),
              ...(row.timeOptions || []),
              existing.timeValue,
              row.timeValue,
            ]);

        dedupedMap.set(dedupeKey, {
          ...existing,
          isBroadcasted: !!existing.isBroadcasted || !!row.isBroadcasted,
          accessMode: mergedAccessMode,
          timeOptions: mergedTimes,
          timeValue: mergedAccessMode === 'all_day' ? 'All day' : mergedTimes.join(', '),
        });
      });
      const nextCards = Array.from(dedupedMap.values());
      const enrichedCards = enrichCardsWithAvailability(
        nextCards,
        availabilitySnapshot ?? availabilitySnapshotRef.current,
      ).sort((a, b) => {
        const delta = getCardSortTimestamp(a) - getCardSortTimestamp(b);
        if (delta !== 0) return delta;
        return String(a.service.name || '').localeCompare(String(b.service.name || ''));
      });

      setBackendCards(enrichedCards);
      setBackendCardsLoaded(true);
      setCurrentUserId(String(viewer?.user_id || viewer?.userId || ''));
      setViewerRole(normalizeRole(viewer?.role));
      setViewerCanManage(!!viewer?.can_manage || !!viewer?.canManage);
      setViewerIsMember(!!viewer?.is_member || !!viewer?.isMember);
      setMembershipOpen(!!membership?.open);
      setMembershipDiscountPercent(clampDiscount(membership?.discountPercent));
      setRatings(normalizeRatings(payload?.ratings));
    },
    [institutionId],
  );

  const loadState = useCallback(async (options?: { showLoader?: boolean }) => {
    const showLoader = options?.showLoader ?? true;
    if (showLoader) setLoading(true);
    try {
      const health = await fetchHealthProfileState({ forceNetwork: true });
      const list = Array.isArray(health.profile?.institutions) ? health.profile.institutions : [];
      setInstitutions(list);
      const currentInstitution = list.find((entry: any) => String(entry?.id) === String(institutionId));
      const membership = resolveMembershipSettings(currentInstitution);
      setMembershipOpen(membership.open);
      setMembershipDiscountPercent(membership.discountPercent);
      setRatings(normalizeRatings(currentInstitution?.service_ratings ?? currentInstitution?.serviceRatings));
      const localDraft = resolveLandingDraft(currentInstitution);
      setLandingPageDraft(localDraft);
      setLandingPagePublished(
        resolveLandingPublished(
          localDraft?.isPublished,
          localDraft?.is_published,
          currentInstitution?.landing_is_published,
          currentInstitution?.landingIsPublished,
          currentInstitution?.landing_page_is_published,
          currentInstitution?.landingPageIsPublished,
        ),
      );
      setLandingPageResolved(false);
      try {
        const profileRes = await fetchInstitutionProfileEditor(institutionId);
        const profilePayload = profileRes?.data ?? profileRes ?? {};
        const profileDraft = profilePayload?.profile_editor ?? profilePayload?.draft ?? profilePayload;
        if (
          profileRes?.success &&
          profileDraft &&
          typeof profileDraft === 'object' &&
          !Array.isArray(profileDraft) &&
          Object.keys(profileDraft).length > 0
        ) {
          setLandingPageDraft(profileDraft);
        }
      } catch {
        // keep local draft fallback
      }
      try {
        const landingRes = await fetchInstitutionLandingPage(institutionId);
        if (landingRes?.success && landingRes?.data) {
          setLandingPagePublished(!!landingRes.data.isPublished);
        }
      } catch {
        // keep local draft fallback
      } finally {
        setLandingPageResolved(true);
      }
      try {
        let availabilitySnapshot: Record<string, unknown> | null = null;
        const availabilityRes = await fetchInstitutionAvailability(institutionId);
        const availabilityPayload =
          availabilityRes?.data?.availability ??
          availabilityRes?.data ??
          null;
        if (
          availabilityPayload &&
          typeof availabilityPayload === 'object' &&
          !Array.isArray(availabilityPayload) &&
          Object.keys(availabilityPayload).length > 0
        ) {
          availabilitySnapshot = availabilityPayload as Record<string, unknown>;
          availabilitySnapshotRef.current = availabilitySnapshot;
          setAvailabilityOverride(availabilitySnapshot);
        } else {
          availabilitySnapshot = null;
          availabilitySnapshotRef.current = null;
          setAvailabilityOverride(null);
        }
        await fetchCardsFromBackend(availabilitySnapshot);
      } catch {
        availabilitySnapshotRef.current = null;
        setAvailabilityOverride(null);
        await fetchCardsFromBackend(null);
      }
    } catch (error: any) {
      Alert.alert('Health cards', error?.message || 'Unable to load health cards.');
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [fetchCardsFromBackend, institutionId]);

  useEffect(() => {
    loadState().catch(() => undefined);
  }, [loadState]);

  useEffect(() => {
    const serviceIds = Array.from(
      new Set(
        cards
          .map((card) => String(card?.service?.id || '').trim())
          .filter(Boolean),
      ),
    );
    if (!serviceIds.length) {
      serviceEngineCacheRef.current = {};
      setConfiguredServiceEngines({});
      return;
    }

    let cancelled = false;
    const sync = async () => {
      const cached = { ...serviceEngineCacheRef.current };
      Object.keys(cached).forEach((serviceId) => {
        if (!serviceIds.includes(serviceId)) {
          delete cached[serviceId];
        }
      });

      const missing = serviceIds.filter((serviceId) => !cached[serviceId]);
      if (missing.length > 0) {
        const results = await Promise.all(
          missing.map(async (serviceId): Promise<[string, BookingEngineDescriptor[]]> => {
            try {
              const response = await fetchServiceEngineMappings(serviceId);
              if (!response?.success) return [serviceId, []];
              const keys = extractConfiguredEngineKeys(response?.data ?? response);
              const descriptors = resolveBookingEnginesFromKeys(keys);
              return [serviceId, descriptors];
            } catch {
              return [serviceId, []];
            }
          }),
        );
        results.forEach(([serviceId, descriptors]) => {
          // Cache empty results too so unsupported endpoints don't get retried on every refresh/render.
          cached[serviceId] = descriptors;
        });
      }

      if (cancelled) return;
      const next: Record<string, BookingEngineDescriptor[]> = {};
      serviceIds.forEach((serviceId) => {
        if (cached[serviceId]?.length) {
          next[serviceId] = cached[serviceId];
        }
      });
      serviceEngineCacheRef.current = cached;
      setConfiguredServiceEngines(next);
    };

    sync().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [cards]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadState({ showLoader: false });
    } finally {
      setRefreshing(false);
    }
  }, [loadState]);

  const saveMembershipSettings = useCallback(async () => {
    if (!canManageMembership) {
      Alert.alert('Health cards', 'Your role cannot change membership settings.');
      return;
    }

    setSaving(true);
    try {
      const discount = clampDiscount(membershipDiscountPercent);
      const response = await postRequest(ROUTES.broadcasts.healthCards(institutionId), {
        action: 'set_membership',
        open: membershipOpen,
        discountPercent: discount,
      });
      if (!response?.success) {
        throw new Error(response?.message || 'Unable to save membership settings.');
      }
      setMembershipDiscountPercent(discount);
      await fetchCardsFromBackend();
      Alert.alert('Health cards', 'Membership settings saved.');
    } catch (error: any) {
      Alert.alert('Health cards', error?.message || 'Unable to save membership settings.');
    } finally {
      setSaving(false);
    }
  }, [canManageMembership, fetchCardsFromBackend, institutionId, membershipDiscountPercent, membershipOpen]);

  const handleJoinInstitution = useCallback(async () => {
    if (!membershipOpen) {
      Alert.alert('Membership', 'Membership is currently closed for this institution.');
      return;
    }
    if (!currentUserId) {
      Alert.alert('Membership', 'You must be signed in to join this institution.');
      return;
    }

    if (isCurrentUserMember) {
      Alert.alert('Membership', 'You are already a member of this institution.');
      return;
    }

    setSaving(true);
    try {
      const response = await postRequest(ROUTES.broadcasts.healthCards(institutionId), {
        action: 'join',
      });
      if (!response?.success) {
        throw new Error(response?.message || 'Unable to join this institution.');
      }
      await fetchCardsFromBackend();
      Alert.alert('Membership', 'You are now a member of this institution.');
    } catch (error: any) {
      Alert.alert('Membership', error?.message || 'Unable to join this institution.');
    } finally {
      setSaving(false);
    }
  }, [currentUserId, fetchCardsFromBackend, institutionId, isCurrentUserMember, membershipOpen]);

  const submitServiceRating = useCallback(
    async (service: ServiceDefinition, ratingValue: number) => {
      if (!currentUserId) {
        Alert.alert('Ratings', 'You must be signed in to rate a service.');
        return;
      }

      const safeRating = Math.max(1, Math.min(5, Math.round(ratingValue)));
      setRatingServiceIdBusy(service.id);
      try {
        const response = await postRequest(ROUTES.broadcasts.healthCards(institutionId), {
          action: 'rate',
          serviceId: service.id,
          serviceName: service.name,
          rating: safeRating,
        });
        if (!response?.success) {
          throw new Error(response?.message || 'Unable to save your rating.');
        }
        await fetchCardsFromBackend();
      } catch (error: any) {
        Alert.alert('Ratings', error?.message || 'Unable to save your rating.');
      } finally {
        setRatingServiceIdBusy('');
      }
    },
    [currentUserId, fetchCardsFromBackend, institutionId],
  );

  const startBookingForCard = useCallback(
    async (card: HealthCardRow, selectedTime?: string) => {
      const bookingTime = card.accessMode === 'all_day'
        ? ''
        : String(selectedTime || getCardPrimaryTime(card)).trim();
      const serviceId = String(card.service.id || '').trim();
      const mappedServiceEngines = configuredServiceEngines[serviceId] || [];
      const explicitFlowKeys = resolveServiceConfiguredFlowKeys(card.service);
      const inferredEnginesForFallback = resolveServiceEngineDescriptors(card.service);
      const configuredEngineFlowKeys =
        mappedServiceEngines.length > 0
          ? resolveConfiguredEngineFlowKeys(mappedServiceEngines)
          : explicitFlowKeys.length > 0
            ? explicitFlowKeys
            : resolveConfiguredEngineFlowKeys(inferredEnginesForFallback);
      const sessions = Array.isArray(start?.data?.service_sessions) ? start.data.service_sessions : [];
      const memberPriceCents = Number.isFinite(Number(card.service.basePriceCents))
        ? Math.round((Number(card.service.basePriceCents) * (100 - membershipDiscountPercent)) / 100)
        : undefined;
      navigation.navigate('HealthServiceSession', {
        institutionId,
        institutionType: route.params.institutionType,
        institutionName: institution?.name || institutionName,
        cardId: card.id,
        sessionSource: 'broadcasts',
        serviceId,
        serviceName: card.service.name,
        serviceDescription: card.service.description,
        configuredEngineFlowKeys,
        dateKey: card.dateKey,
        timeValue: bookingTime || undefined,
        statusLabel: card.statusLabel,
        basePriceCents: card.service.basePriceCents,
        memberPriceCents,
      });
    },
    [
      configuredServiceEngines,
      institution?.name,
      institutionId,
      institutionName,
      membershipDiscountPercent,
      navigation,
      route.params.institutionType,
    ],
  );

  const handleBookNow = useCallback(
    (card: HealthCardRow) => {
      if (!card?.id) {
        Alert.alert('Book now', 'Card information is unavailable.');
        return;
      }
      if (card.accessMode === 'slots') {
        const options = getCardTimeOptions(card);
        if (options.length > 1) {
          setTimePickerCard(card);
          setSelectedBookingTime(options[0]);
          return;
        }
        startBookingForCard(card, options[0]).catch((error: any) => {
          Alert.alert('Book now', error?.message || 'Unable to start this session.');
        });
        return;
      }
      startBookingForCard(card, '').catch((error: any) => {
        Alert.alert('Book now', error?.message || 'Unable to start this session.');
      });
    },
    [startBookingForCard],
  );

  const confirmSelectedBookingTime = useCallback(() => {
    if (!timePickerCard) return;
    const chosenTime = String(selectedBookingTime || '').trim();
    if (!chosenTime) {
      Alert.alert('Book now', 'Select a time slot to continue.');
      return;
    }
    const targetCard = timePickerCard;
    setTimePickerCard(null);
    startBookingForCard(targetCard, chosenTime).catch((error: any) => {
      Alert.alert('Book now', error?.message || 'Unable to start this session.');
    });
  }, [selectedBookingTime, startBookingForCard, timePickerCard]);

  const handleOpenLandingPreview = useCallback(() => {
    if (!landingPublished) return;
    navigation.navigate('InstitutionLandingPreview', {
      institutionId: String(institution?.id || institutionId),
      institutionName: institution?.name || institutionName,
      institutionType: route.params.institutionType,
      draft: effectiveLandingDraft,
    });
  }, [
    effectiveLandingDraft,
    institution?.id,
    institution?.name,
    institutionId,
    institutionName,
    landingPublished,
    navigation,
    route.params.institutionType,
  ]);

  const toggleBroadcastCard = useCallback(
    async (card: HealthCardRow) => {
      if (!canManageMembership) return;
      const alreadyBroadcasted = backendCards.some(
        (row) => String(row.id) === String(card.id) && isCardBroadcasted(row),
      );
      if (alreadyBroadcasted) {
        Alert.alert('Broadcast', 'This health card is already broadcasted.');
        return;
      }
      setSaving(true);
      setBackendCards((prev) =>
        prev.map((row) => (row.id === card.id ? { ...row, isBroadcasted: true } : row)),
      );
      try {
        const response = await postRequest(ROUTES.broadcasts.healthCards(institutionId), {
          action: 'broadcast_card',
          cardId: card.id,
          serviceId: card.service.id,
          date: card.dateKey,
          time: getCardPrimaryTime(card),
          enabled: true,
        });
        if (!response?.success) {
          throw new Error(response?.message || 'Unable to update card broadcast status.');
        }
        await fetchCardsFromBackend();
      } catch (error: any) {
        setBackendCards((prev) =>
          prev.map((row) => (row.id === card.id ? { ...row, isBroadcasted: false } : row)),
        );
        Alert.alert('Broadcast', error?.message || 'Unable to update card broadcast status.');
      } finally {
        setSaving(false);
      }
    },
    [backendCards, canManageMembership, fetchCardsFromBackend, institutionId, isCardBroadcasted],
  );

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }}>
        <LinearGradient colors={[palette.gradientStart, palette.gradientEnd]} style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={palette.accentPrimary} />
          <Text style={{ ...typography.body, color: palette.subtext, marginTop: spacing.sm }}>
            Loading health cards...
          </Text>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }}>
      <LinearGradient colors={[palette.gradientStart, palette.gradientEnd]} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1, paddingRight: spacing.sm }}>
              <Text style={{ ...typography.h1, color: palette.text }}>Health Cards</Text>
              {landingPublished ? (
                <TouchableOpacity onPress={handleOpenLandingPreview} accessibilityRole="button">
                  <Text
                    style={{
                      ...typography.body,
                      color: palette.accentPrimary,
                      marginTop: spacing.xs,
                      textDecorationLine: 'underline',
                    }}
                  >
                    {institutionName}
                  </Text>
                  <Text style={{ ...typography.caption, color: palette.accentPrimary }}>
                    Published institution page: tap to open
                  </Text>
                </TouchableOpacity>
              ) : (
                <Text style={{ ...typography.body, color: palette.subtext, marginTop: spacing.xs }}>
                  {institutionName}
                </Text>
              )}
            </View>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={{ borderWidth: 1, borderColor: palette.divider, borderRadius: 999, padding: spacing.xs }}
              accessibilityLabel="Close health cards"
            >
              <KISIcon name="close" size={20} color={palette.text} />
            </TouchableOpacity>
          </View>

          {canManageMembership ? (
            <View style={{ marginTop: spacing.md, borderRadius: spacing.lg, padding: spacing.md, backgroundColor: palette.card, ...borders.card }}>
            <Text style={{ ...typography.h3, color: palette.text }}>Membership Access</Text>
            <Text style={{ ...typography.body, color: palette.subtext, marginTop: spacing.xs }}>
              Open or close institution membership and set member discount (10% to 100%).
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm }}>
              <KISButton
                title="Open"
                size="sm"
                variant={membershipOpen ? 'primary' : 'outline'}
                onPress={() => setMembershipOpen(true)}
                disabled={!canManageMembership || saving}
              />
              <KISButton
                title="Closed"
                size="sm"
                variant={!membershipOpen ? 'primary' : 'outline'}
                onPress={() => setMembershipOpen(false)}
                disabled={!canManageMembership || saving}
              />
            </View>
            <View style={{ marginTop: spacing.sm, flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ ...typography.label, color: palette.text, marginRight: spacing.sm }}>
                Member discount: {membershipDiscountPercent}%
              </Text>
              <TouchableOpacity
                onPress={() => setMembershipDiscountPercent((prev) => clampDiscount(prev - 5))}
                disabled={!canManageMembership || saving}
                style={{ borderWidth: 1, borderColor: palette.divider, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginRight: spacing.xs }}
              >
                <Text style={{ ...typography.label, color: palette.text }}>-5</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setMembershipDiscountPercent((prev) => clampDiscount(prev + 5))}
                disabled={!canManageMembership || saving}
                style={{ borderWidth: 1, borderColor: palette.divider, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}
              >
                <Text style={{ ...typography.label, color: palette.text }}>+5</Text>
              </TouchableOpacity>
            </View>
            <View style={{ marginTop: spacing.sm }}>
              <KISButton
                title={saving ? 'Saving...' : 'Save Membership Settings'}
                onPress={() => {
                  saveMembershipSettings().catch(() => undefined);
                }}
                disabled={saving || !canManageMembership}
              />
            </View>
            <Text style={{ ...typography.caption, color: palette.subtext, marginTop: spacing.xs }}>
              Your role: {actorRole} · Current membership: {membershipOpen ? 'Open' : 'Closed'}
            </Text>
            </View>
          ) : null}

          <View style={{ marginTop: spacing.md, borderRadius: spacing.lg, padding: spacing.sm, backgroundColor: palette.card, ...borders.card }}>
            <Text style={{ ...typography.label, color: palette.text }}>Filter</Text>
            <View style={{ flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs }}>
              {(['today', 'upcoming', 'past'] as CardFilterKey[]).map((filterKey) => (
                <KISButton
                  key={filterKey}
                  title={filterKey[0].toUpperCase() + filterKey.slice(1)}
                  size="sm"
                  variant={cardFilter === filterKey ? 'primary' : 'outline'}
                  onPress={() => setCardFilter(filterKey)}
                />
              ))}
            </View>
          </View>
          <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
            {filteredCards.map((card) => {
              const cardBroadcasted = isCardBroadcasted(card);
              const serviceRatings = ratingsByService.get(String(card.service.id)) || [];
              const average =
                serviceRatings.length > 0
                  ? serviceRatings.reduce((sum, row) => sum + Number(row.rating || 0), 0) / serviceRatings.length
                  : 0;
              const myRating =
                serviceRatings.find((row) => String(row.userId) === String(currentUserId))?.rating || 0;
              const memberPriceCents = Number.isFinite(Number(card.service.basePriceCents))
                ? Math.round((Number(card.service.basePriceCents) * (100 - membershipDiscountPercent)) / 100)
                : undefined;
              const bookingEngines =
                configuredServiceEngines[String(card.service.id)] ||
                resolveServiceEngineDescriptors(card.service);

              return (
                <View
                  key={card.id}
                  style={{
                    borderRadius: spacing.lg,
                    backgroundColor: palette.card,
                    overflow: 'hidden',
                    ...borders.card,
                  }}
                >
                  <View style={{ height: 120, backgroundColor: palette.surface }}>
                    {logoUrl ? (
                      <Image source={{ uri: logoUrl }} resizeMode="cover" style={{ width: '100%', height: '100%' }} />
                    ) : (
                      <View style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                        <KISIcon name="heart" size={28} color={palette.accentPrimary} />
                      </View>
                    )}
                    {landingPublished ? (
                      <TouchableOpacity
                        onPress={handleOpenLandingPreview}
                        accessibilityRole="button"
                        accessibilityLabel="Open institution landing page"
                        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
                      />
                    ) : null}

                    {membershipOpen && !isCurrentUserMember ? (
                      <View style={{ position: 'absolute', left: spacing.sm, top: spacing.sm }}>
                        <KISButton
                          title={saving ? 'Joining...' : 'Join Institution'}
                          size="xs"
                          onPress={() => {
                            handleJoinInstitution().catch(() => undefined);
                          }}
                          disabled={saving}
                        />
                      </View>
                    ) : null}
                  </View>

                  <View style={{ padding: spacing.md }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flex: 1, paddingRight: spacing.sm }}>
                        {landingPublished ? (
                          <TouchableOpacity onPress={handleOpenLandingPreview} accessibilityRole="button">
                            <Text
                              style={{
                                ...typography.h3,
                                color: palette.accentPrimary,
                                textDecorationLine: 'underline',
                              }}
                            >
                              {card.service.name}
                            </Text>
                            <Text style={{ ...typography.caption, color: palette.accentPrimary, marginTop: 2 }}>
                              Tap title to open institution page
                            </Text>
                          </TouchableOpacity>
                        ) : (
                          <Text style={{ ...typography.h3, color: palette.text }}>
                            {card.service.name}
                          </Text>
                        )}
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                        {cardBroadcasted ? (
                          <View
                            style={{
                              borderRadius: 999,
                              backgroundColor: `${palette.accentPrimary}22`,
                              paddingHorizontal: spacing.sm,
                              paddingVertical: 4,
                            }}
                          >
                            <Text style={{ ...typography.caption, color: palette.accentPrimary }}>Broadcasted</Text>
                          </View>
                        ) : null}
                        <View style={{ borderRadius: 999, backgroundColor: `${card.statusColor}22`, paddingHorizontal: spacing.sm, paddingVertical: 4 }}>
                          <Text style={{ ...typography.caption, color: card.statusColor }}>{card.statusLabel}</Text>
                        </View>
                      </View>
                    </View>

                    <Text style={{ ...typography.body, color: palette.subtext, marginTop: 4 }}>
                      {card.service.description || 'No service description yet.'}
                    </Text>

                    <Text style={{ ...typography.caption, color: palette.subtext, marginTop: spacing.xs }}>
                      {toDateLabel(card.dateKey)}
                      {getCardScheduleLabel(card) ? ` · ${getCardScheduleLabel(card)}` : ''}
                    </Text>

                    <View style={{ marginTop: spacing.xs }}>
                      <Text style={{ ...typography.label, color: palette.text }}>
                        Service price: {toMoney(card.service.basePriceCents)}
                      </Text>
                      {isCurrentUserMember ? (
                        <Text style={{ ...typography.caption, color: palette.accentPrimary }}>
                          Member price ({membershipDiscountPercent}% off): {toMoney(memberPriceCents)}
                        </Text>
                      ) : null}
                    </View>

                    <View
                      style={{
                        marginTop: spacing.sm,
                        borderRadius: spacing.md,
                        borderWidth: 1,
                        borderColor: `${palette.accentPrimary}55`,
                        backgroundColor: `${palette.accentPrimary}12`,
                        padding: spacing.sm,
                      }}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ ...typography.label, color: palette.text }}>Booking Engines</Text>
                        <Text style={{ ...typography.caption, color: palette.subtext }}>
                          {bookingEngines.length} ready
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: spacing.xs }}>
                        {bookingEngines.map((engine) => (
                          <View
                            key={`${card.id}-${engine.key}`}
                            style={{
                              borderRadius: spacing.sm,
                              borderWidth: 1,
                              borderColor: `${engine.color}55`,
                              backgroundColor: engine.bgTint,
                              paddingHorizontal: spacing.xs,
                              paddingVertical: spacing.xs,
                              flexDirection: 'row',
                              alignItems: 'center',
                              minWidth: '47%',
                              flexGrow: 1,
                            }}
                          >
                            <View
                              style={{
                                width: 22,
                                height: 22,
                                borderRadius: 11,
                                backgroundColor: '#FFFFFFAA',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <KISIcon name={engine.icon} size={12} color={engine.color} />
                            </View>
                            <View style={{ marginLeft: 8, flex: 1 }}>
                              <Text style={{ ...typography.caption, color: palette.text, fontWeight: '800' }}>
                                {engine.label}
                              </Text>
                              <Text style={{ ...typography.caption, color: palette.subtext, fontSize: 10 }}>
                                {engine.subtitle}
                              </Text>
                            </View>
                          </View>
                        ))}
                      </View>
                      <Text style={{ ...typography.caption, color: palette.subtext, marginTop: 6 }}>
                        Engines auto-run based on the workflow when you tap Book Now.
                      </Text>
                    </View>
                    {canManageMembership && !cardBroadcasted ? (
                      <View style={{ marginTop: spacing.sm }}>
                        <KISButton
                          title="Broadcast Card"
                          size="sm"
                          variant="primary"
                          disabled={saving}
                          onPress={() => {
                            toggleBroadcastCard(card).catch(() => undefined);
                          }}
                        />
                      </View>
                    ) : null}

                    <View style={{ marginTop: spacing.sm }}>
                      <KISButton
                        title="Book Now"
                        size="sm"
                        onPress={() => handleBookNow(card)}
                      />
                    </View>

                    <View style={{ marginTop: spacing.sm }}>
                      <Text style={{ ...typography.label, color: palette.text }}>
                        Rate this service
                      </Text>
                      <View style={{ flexDirection: 'row', marginTop: 6 }}>
                        {[1, 2, 3, 4, 5].map((star) => {
                          const filled = star <= myRating;
                          return (
                            <TouchableOpacity
                              key={`${card.id}-rating-${star}`}
                              onPress={() => {
                                submitServiceRating(card.service, star).catch(() => undefined);
                              }}
                              disabled={ratingServiceIdBusy === card.service.id}
                              style={{ marginRight: 6 }}
                            >
                              <Text style={{ fontSize: 20, color: filled ? '#F59E0B' : palette.subtext }}>★</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                      <Text style={{ ...typography.caption, color: palette.subtext, marginTop: 4 }}>
                        Average rating: {average ? average.toFixed(1) : '0.0'} ({serviceRatings.length})
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>

          {filteredCards.length === 0 ? (
            <View style={{ marginTop: spacing.md, borderRadius: spacing.lg, padding: spacing.md, backgroundColor: palette.card, ...borders.card }}>
              <Text style={{ ...typography.h3, color: palette.text }}>No {cardFilter} health cards</Text>
              <Text style={{ ...typography.body, color: palette.subtext, marginTop: spacing.xs }}>
                Health cards are produced from scheduled availability dates with selected services.
              </Text>
              <View style={{ marginTop: spacing.sm }}>
                <KISButton
                  title="Go to Schedule Management"
                  variant="outline"
                  onPress={() => {
                    if (!route.params.institutionType) {
                      navigation.goBack();
                      return;
                    }
                    navigation.navigate('AvailabilityManagement', {
                      institutionId,
                      institutionType: route.params.institutionType,
                    });
                  }}
                />
              </View>
            </View>
          ) : null}
        </ScrollView>

        {timePickerCard ? (
          <View
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              justifyContent: 'flex-end',
            }}
          >
            <TouchableOpacity
              activeOpacity={1}
              onPress={() => setTimePickerCard(null)}
              style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: '#00000066' }}
            />
            <View
              style={{
                borderTopLeftRadius: spacing.lg,
                borderTopRightRadius: spacing.lg,
                backgroundColor: palette.card,
                padding: spacing.md,
                gap: spacing.sm,
                ...borders.card,
              }}
            >
              <Text style={{ ...typography.h3, color: palette.text }}>Choose booking time</Text>
              <Text style={{ ...typography.caption, color: palette.subtext }}>
                {timePickerCard.service.name} • {toDateLabel(timePickerCard.dateKey)}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                {getCardTimeOptions(timePickerCard).map((time) => {
                  const selected = selectedBookingTime === time;
                  return (
                    <TouchableOpacity
                      key={`pick-${timePickerCard.id}-${time}`}
                      onPress={() => setSelectedBookingTime(time)}
                      style={{
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: selected ? palette.accentPrimary : palette.divider,
                        backgroundColor: selected ? `${palette.accentPrimary}22` : palette.surface,
                        paddingHorizontal: spacing.sm,
                        paddingVertical: spacing.xs,
                      }}
                    >
                      <Text style={{ ...typography.caption, color: palette.text }}>{time}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                <View style={{ flex: 1 }}>
                  <KISButton title="Cancel" variant="outline" onPress={() => setTimePickerCard(null)} />
                </View>
                <View style={{ flex: 1 }}>
                  <KISButton
                    title="Continue"
                    onPress={confirmSelectedBookingTime}
                    disabled={!selectedBookingTime}
                  />
                </View>
              </View>
            </View>
          </View>
        ) : null}
      </LinearGradient>
    </SafeAreaView>
  );
}
