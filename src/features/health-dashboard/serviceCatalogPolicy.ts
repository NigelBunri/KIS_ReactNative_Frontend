import type { ServiceDefinition } from './models';

type ServiceWithEngines = ServiceDefinition & {
  availableEngines?: string[];
};

const normalizeEngineLabel = (value: unknown) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

export const HEALTH_ENGINE_CONTACT_NOTICE =
  'If you want this service, contact KIS from the KCNI partner account, then open the KIS Features group.';

export const REMOVED_HEALTH_ENGINE_NAMES = ['My test medium'] as const;

export const COMING_SOON_HEALTH_ENGINE_NAMES = [
  'Emergency Dispatch Engine',
  'Home Logistics Engine',
  'Imaging Order Engine',
  'Lab Order Engine',
  'Surgery Scheduling Engine',
] as const;

const REMOVED_ENGINE_SET = new Set(REMOVED_HEALTH_ENGINE_NAMES.map(normalizeEngineLabel));
const BLOCKED_SERVICE_ENGINE_SET = new Set(
  [...REMOVED_HEALTH_ENGINE_NAMES, ...COMING_SOON_HEALTH_ENGINE_NAMES].map(normalizeEngineLabel),
);
const BLOCKED_BOOKING_ENGINE_KEYS = new Set(['lab', 'surgery', 'emergency', 'logistics']);

const cleanStringList = (values: unknown): string[] => {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => String(value || '').trim())
    .filter(Boolean);
};

export const isRemovedHealthEngineName = (value: unknown) =>
  REMOVED_ENGINE_SET.has(normalizeEngineLabel(value));

export const isComingSoonHealthEngineName = (value: unknown) =>
  COMING_SOON_HEALTH_ENGINE_NAMES.some(
    (engineName) => normalizeEngineLabel(engineName) === normalizeEngineLabel(value),
  );

export const blocksHealthServiceMapping = (value: unknown) =>
  BLOCKED_SERVICE_ENGINE_SET.has(normalizeEngineLabel(value));

export const filterHealthEngineNames = (values: unknown): string[] =>
  cleanStringList(values).filter((value) => !blocksHealthServiceMapping(value));

export const filterBookingEngineKeys = (values: unknown): string[] =>
  cleanStringList(values).filter((value) => !BLOCKED_BOOKING_ENGINE_KEYS.has(normalizeEngineLabel(value)));

export const sanitizeServiceEngineFields = <T extends ServiceWithEngines>(service: T): T | null => {
  const rawMediumNames = cleanStringList(service.mediumNames);
  const rawAvailableEngines = cleanStringList(service.availableEngines);
  const mediumNames = filterHealthEngineNames(rawMediumNames);
  const availableEngines = filterBookingEngineKeys(rawAvailableEngines);
  const hadExplicitEngines = rawMediumNames.length > 0 || rawAvailableEngines.length > 0;
  const hasRemainingExplicitEngines = mediumNames.length > 0 || availableEngines.length > 0;

  if (hadExplicitEngines && !hasRemainingExplicitEngines) {
    return null;
  }

  return {
    ...service,
    mediumNames,
    availableEngines,
  };
};

export const sanitizeServiceList = <T extends ServiceWithEngines>(services: T[]): T[] =>
  services
    .map((service) => sanitizeServiceEngineFields(service))
    .filter(Boolean) as T[];
