export const DAY_KEYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;
export type DayKey = typeof DAY_KEYS[number];

type RawTimeInput = string | number | null | undefined;

export type DayAvailability = {
  enabled: boolean;
  all_day: boolean;
  times: string[];
};

export type ServiceAvailability = {
  timezone: string;
  slot_duration_minutes: number;
  date_range: {
    start_date: string;
    end_date: string;
  } | null;
  days: Record<DayKey, DayAvailability>;
  specific_dates: Record<string, DayAvailability>;
};

const DEFAULT_SLOT_DURATION_MINUTES = 60;

export const normalizeTimeToken = (token: RawTimeInput): string => {
  const normalized = String(token ?? "").trim();
  if (!normalized) return "";
  const parts = normalized.split(":").map((part) => part.trim());
  if (parts.length !== 2) return "";
  const hour = Number(parts[0]);
  const minute = Number(parts[1]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return "";
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return "";
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
};

export const normalizeTimeList = (values: Iterable<RawTimeInput> = []): string[] => {
  const set = new Set<string>();
  for (const value of values) {
    const token = normalizeTimeToken(value);
    if (token) {
      set.add(token);
    }
  }
  return [...set].sort();
};

const ensureDayAvailability = (config: Partial<DayAvailability> = {}): DayAvailability => {
  const normalizedTimes = normalizeTimeList(config.times ?? []);
  return {
    enabled: config.enabled ?? true,
    all_day: config.all_day ?? normalizedTimes.length === 0,
    times: normalizedTimes,
  };
};

export const normalizeDayAvailability = (config: Partial<DayAvailability> = {}): DayAvailability => ensureDayAvailability(config);

const buildDays = (source?: Record<string, unknown>): Record<DayKey, DayAvailability> => {
  const days: Record<DayKey, DayAvailability> = {} as Record<DayKey, DayAvailability>;
  for (const day of DAY_KEYS) {
    days[day] = ensureDayAvailability();
  }
  if (!source) {
    return days;
  }
  for (const [rawKey, value] of Object.entries(source)) {
    const key = String(rawKey).toLowerCase();
    if (DAY_KEYS.includes(key as DayKey)) {
      days[key as DayKey] = ensureDayAvailability(value as Partial<DayAvailability>);
    }
  }
  return days;
};

const buildSpecificDates = (source?: Record<string, unknown>): Record<string, DayAvailability> => {
  const specific: Record<string, DayAvailability> = {};
  if (!source) {
    return specific;
  }
  for (const [rawDate, value] of Object.entries(source)) {
    const key = String(rawDate).trim();
    if (!key) continue;
    specific[key] = ensureDayAvailability(value as Partial<DayAvailability>);
  }
  return specific;
};

export const createDefaultAvailability = (overrides?: Partial<ServiceAvailability>): ServiceAvailability => {
  const timezone = overrides?.timezone?.trim() || "UTC";
  const slotDuration = Number(overrides?.slot_duration_minutes ?? DEFAULT_SLOT_DURATION_MINUTES);
  const dateRange = overrides?.date_range ?? null;
  return {
    timezone,
    slot_duration_minutes: slotDuration > 0 ? slotDuration : DEFAULT_SLOT_DURATION_MINUTES,
    date_range: dateRange ? { start_date: String(dateRange.start_date), end_date: String(dateRange.end_date) } : null,
    days: buildDays(overrides?.days as Record<string, unknown>),
    specific_dates: buildSpecificDates(overrides?.specific_dates as Record<string, unknown>),
  };
};

const parseJson = (value: unknown): unknown => {
  if (typeof value === "string") {
    try {
      return JSON.parse(value || "{}");
    } catch {
      return {};
    }
  }
  return value ?? {};
};

export const normalizeAvailabilityPayload = (value?: unknown): ServiceAvailability => {
  const parsed = parseJson(value);
  if (typeof parsed !== "object" || parsed === null) {
    return createDefaultAvailability();
  }
  const payload = parsed as Record<string, unknown>;
  const timezone = String(payload.timezone ?? "UTC").trim() || "UTC";
  const slotDuration = Number(payload.slot_duration_minutes ?? DEFAULT_SLOT_DURATION_MINUTES);
  const rawRange = payload.date_range;
  let dateRange: ServiceAvailability["date_range"] = null;
  if (rawRange && typeof rawRange === "object") {
    const start = String((rawRange as any).start_date || "").trim();
    const end = String((rawRange as any).end_date || "").trim();
    if (start && end) {
      dateRange = { start_date: start, end_date: end };
    }
  }
  return {
    timezone,
    slot_duration_minutes: slotDuration > 0 ? slotDuration : DEFAULT_SLOT_DURATION_MINUTES,
    date_range: dateRange,
    days: buildDays(payload.days as Record<string, unknown>),
    specific_dates: buildSpecificDates(payload.specific_dates as Record<string, unknown>),
  };
};

export const formatDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

export const getDayKey = (date: Date): DayKey => {
  const mapping: DayKey[] = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  return mapping[date.getDay()] as DayKey;
};
