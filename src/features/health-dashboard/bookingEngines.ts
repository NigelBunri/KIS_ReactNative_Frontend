import type { KISIconName } from '@/constants/kisIcons';
import {
  blocksHealthServiceMapping,
  filterBookingEngineKeys,
} from './serviceCatalogPolicy';

export type BookingEngineKey =
  | 'appointment'
  | 'video'
  | 'lab'
  | 'prescription'
  | 'payment'
  | 'surgery'
  | 'admission'
  | 'emergency'
  | 'wellness'
  | 'logistics';

export type BookingEngineDescriptor = {
  key: BookingEngineKey;
  label: string;
  subtitle: string;
  icon: KISIconName;
  color: string;
  bgTint: string;
};

const ENGINE_ORDER: BookingEngineKey[] = [
  'appointment',
  'video',
  'lab',
  'prescription',
  'payment',
  'surgery',
  'admission',
  'emergency',
  'wellness',
  'logistics',
];

const MEDIUM_NAME_ENGINE_MAP: Record<string, BookingEngineKey> = {
  'appointment engine': 'appointment',
  'video consultation engine': 'video',
  'secure messaging / chat engine': 'appointment',
  'e-prescription engine': 'prescription',
  'lab order engine': 'lab',
  'imaging order engine': 'lab',
  'admission & bed management engine': 'admission',
  'surgery scheduling engine': 'surgery',
  'emergency dispatch engine': 'emergency',
  'pharmacy & fulfillment engine': 'prescription',
  'payment & billing engine': 'payment',
  'ehr / health records engine': 'appointment',
  'home logistics engine': 'logistics',
  'wellness program engine': 'wellness',
  'notification & reminder engine': 'appointment',
};

const ENGINE_META: Record<BookingEngineKey, Omit<BookingEngineDescriptor, 'key'>> = {
  appointment: {
    label: 'Appointment',
    subtitle: 'Slot + queue',
    icon: 'calendar',
    color: '#2563EB',
    bgTint: '#DBEAFE',
  },
  video: {
    label: 'Video',
    subtitle: 'Remote consult',
    icon: 'video',
    color: '#0284C7',
    bgTint: '#E0F2FE',
  },
  lab: {
    label: 'Lab',
    subtitle: 'Tests + results',
    icon: 'file',
    color: '#7C3AED',
    bgTint: '#EDE9FE',
  },
  prescription: {
    label: 'Prescription',
    subtitle: 'Rx workflow',
    icon: 'file',
    color: '#0EA5A4',
    bgTint: '#CCFBF1',
  },
  payment: {
    label: 'Billing',
    subtitle: 'Credits + payout',
    icon: 'cart',
    color: '#EA580C',
    bgTint: '#FFEDD5',
  },
  surgery: {
    label: 'Surgery',
    subtitle: 'Procedure path',
    icon: 'calendar',
    color: '#DC2626',
    bgTint: '#FEE2E2',
  },
  admission: {
    label: 'Admission',
    subtitle: 'Bed + intake',
    icon: 'list',
    color: '#4F46E5',
    bgTint: '#E0E7FF',
  },
  emergency: {
    label: 'Emergency',
    subtitle: 'Rapid dispatch',
    icon: 'bell',
    color: '#B91C1C',
    bgTint: '#FEE2E2',
  },
  wellness: {
    label: 'Wellness',
    subtitle: 'Program track',
    icon: 'heart',
    color: '#16A34A',
    bgTint: '#DCFCE7',
  },
  logistics: {
    label: 'Logistics',
    subtitle: 'Home flow',
    icon: 'list',
    color: '#0891B2',
    bgTint: '#CFFAFE',
  },
};

const normalizeInstitutionType = (value: unknown) => {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'laboratory') return 'lab';
  if (raw === 'diagnostics_center') return 'diagnostics';
  return raw;
};

const normalizeEngineToken = (value: unknown) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

export const normalizeBookingEngineKey = (value: unknown): BookingEngineKey | null => {
  const normalized = normalizeEngineToken(value);
  if (!normalized) return null;
  if (ENGINE_ORDER.includes(normalized as BookingEngineKey)) {
    return normalized as BookingEngineKey;
  }

  const aliasMap: Record<string, BookingEngineKey> = {
    'appointment-engine': 'appointment',
    'video-consultation-engine': 'video',
    'secure-messaging-chat-engine': 'appointment',
    'e-prescription-engine': 'prescription',
    'lab-order-engine': 'lab',
    'imaging-order-engine': 'lab',
    'admission-bed-management-engine': 'admission',
    'surgery-scheduling-engine': 'surgery',
    'emergency-dispatch-engine': 'emergency',
    'pharmacy-fulfillment-engine': 'prescription',
    'payment-billing-engine': 'payment',
    'ehr-health-records-engine': 'appointment',
    'home-logistics-engine': 'logistics',
    'wellness-program-engine': 'wellness',
    'notification-reminder-engine': 'appointment',
  };
  if (aliasMap[normalized]) return aliasMap[normalized];

  if (normalized.includes('video')) return 'video';
  if (normalized.includes('billing') || normalized.includes('payment') || normalized.includes('wallet')) return 'payment';
  if (normalized.includes('lab') || normalized.includes('imaging') || normalized.includes('diagnostic')) return 'lab';
  if (normalized.includes('prescription') || normalized.includes('pharmacy') || normalized.includes('medication')) return 'prescription';
  if (normalized.includes('admission') || normalized.includes('bed') || normalized.includes('ward')) return 'admission';
  if (normalized.includes('emergency') || normalized.includes('dispatch') || normalized.includes('triage')) return 'emergency';
  if (normalized.includes('wellness') || normalized.includes('habit') || normalized.includes('fitness')) return 'wellness';
  if (normalized.includes('logistics') || normalized.includes('delivery') || normalized.includes('pickup')) return 'logistics';
  if (normalized.includes('surgery') || normalized.includes('operative')) return 'surgery';
  if (normalized.includes('appointment') || normalized.includes('consult') || normalized.includes('schedule')) return 'appointment';
  return null;
};

export const resolveBookingEnginesFromKeys = (
  keys: Array<string | BookingEngineKey>,
): BookingEngineDescriptor[] => {
  const detected = new Set<BookingEngineKey>();
  keys.forEach((value) => {
    const normalized = normalizeBookingEngineKey(value);
    if (normalized) detected.add(normalized);
  });
  return ENGINE_ORDER.filter((key) => detected.has(key)).map((key) => ({
    key,
    ...ENGINE_META[key],
  }));
};

const normalizeStringList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || '').trim())
    .filter(Boolean);
};

const extractMediumNames = (service: any): string[] => {
  const names = [
    ...normalizeStringList(service?.mediumNames),
    ...normalizeStringList(service?.medium_names),
  ];
  if (Array.isArray(service?.medium_links)) {
    service.medium_links.forEach((link: any) => {
      const mediumName = String(link?.medium?.name || link?.name || '').trim();
      if (mediumName) names.push(mediumName);
    });
  }
  if (Array.isArray(service?.mediumLinks)) {
    service.mediumLinks.forEach((link: any) => {
      const mediumName = String(link?.medium?.name || link?.name || '').trim();
      if (mediumName) names.push(mediumName);
    });
  }
  return Array.from(
    new Set(
      names
        .filter((name) => !blocksHealthServiceMapping(name))
        .map((name) => name.toLowerCase()),
    ),
  );
};

const extractDeclaredEngines = (service: any): BookingEngineKey[] => {
  const values = filterBookingEngineKeys([
    ...normalizeStringList(service?.availableEngines),
    ...normalizeStringList(service?.available_engines),
  ]);
  const out: BookingEngineKey[] = [];
  values.forEach((value) => {
    const normalized = normalizeBookingEngineKey(value);
    if (!normalized || out.includes(normalized)) return;
    out.push(normalized);
  });
  return out;
};

const inferBookingEngineKeys = (
  service: any,
  institutionType?: string,
): BookingEngineKey[] => {
  const detected = new Set<BookingEngineKey>(extractDeclaredEngines(service));

  extractMediumNames(service).forEach((mediumName) => {
    const mapped = MEDIUM_NAME_ENGINE_MAP[mediumName];
    if (mapped) detected.add(mapped);
  });

  const hay = [
    String(service?.id || service?.service_id || ''),
    String(service?.name || ''),
    String(service?.description || ''),
  ]
    .join(' ')
    .toLowerCase();

  const keywordMap: Record<BookingEngineKey, string[]> = {
    appointment: ['appointment', 'consult', 'booking', 'visit', 'triage', 'follow-up'],
    video: ['video', 'tele', 'virtual', 'remote'],
    lab: ['lab', 'blood', 'test', 'diagnostic', 'scan', 'xray', 'mri', 'ct', 'ultrasound', 'pcr', 'imaging'],
    prescription: ['prescription', 'rx', 'medication', 'pharmacy', 'dispens', 'refill'],
    payment: ['payment', 'billing', 'invoice', 'charge', 'price'],
    surgery: ['surgery', 'procedure', 'operation', 'operative'],
    admission: ['admission', 'inpatient', 'bed', 'ward', 'icu'],
    emergency: ['emergency', 'urgent', 'trauma', 'critical'],
    wellness: ['wellness', 'fitness', 'nutrition', 'mental', 'habit', 'challenge', 'weight'],
    logistics: ['logistics', 'delivery', 'pickup', 'dispatch', 'home sample', 'home delivery'],
  };
  (Object.keys(keywordMap) as BookingEngineKey[]).forEach((engine) => {
    if (keywordMap[engine].some((keyword) => hay.includes(keyword))) {
      detected.add(engine);
    }
  });

  const normalizedType = normalizeInstitutionType(institutionType);
  if (normalizedType === 'lab' || normalizedType === 'diagnostics') {
    detected.add('lab');
    detected.add('payment');
  } else if (normalizedType === 'pharmacy') {
    detected.add('prescription');
    detected.add('payment');
  } else if (normalizedType === 'wellness_center') {
    detected.add('wellness');
    detected.add('payment');
  } else {
    detected.add('appointment');
    detected.add('payment');
  }

  const ordered = ENGINE_ORDER.filter((engine) => detected.has(engine) && filterBookingEngineKeys([engine]).length > 0);
  return ordered.length > 0 ? ordered : ['appointment', 'payment'];
};

export const resolveBookingEngines = (
  service: any,
  institutionType?: string,
): BookingEngineDescriptor[] => {
  const keys = inferBookingEngineKeys(service, institutionType);
  return keys.map((key) => ({
    key,
    ...ENGINE_META[key],
  }));
};
