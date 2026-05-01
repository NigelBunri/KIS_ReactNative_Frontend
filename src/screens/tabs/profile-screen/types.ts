import type {
  BroadcastCreationType,
  BroadcastProfileKey,
  BroadcastTabId,
} from '@/navigation/types';

export type HealthInstitutionType =
  | 'clinic'
  | 'hospital'
  | 'lab'
  | 'diagnostics'
  | 'specialist_center'
  | 'telemedicine_provider'
  | 'urgent_care_center'
  | 'laboratory'
  | 'diagnostics_center'
  | 'rehabilitation_center'
  | 'physiotherapy_center'
  | 'pharmacy'
  | 'medical_supply_store'
  | 'wellness_center'
  | 'mental_health_center'
  | 'nutrition_center'
  | 'fitness_health_partner'
  | 'home_care_provider'
  | 'community_health_center'
  | 'elderly_care_facility'
  | 'palliative_care_center'
  | 'emergency_response_unit'
  | 'ambulance_service'
  | 'trauma_center'
  | 'insurance_provider'
  | 'health_management_organization'
  | 'government_health_agency'
  | 'regulatory_body'
  | 'accreditation_body';

export type HealthFormState = {
  id?: string;
  name: string;
  type: HealthInstitutionType;
  employees: string;
};

export type ShopBusinessType = 'products' | 'services' | 'both';

export type ShopStatus = 'draft' | 'active' | 'paused';

export type MarketFormState = {
  id?: string;
  name: string;
  description: string;
  employeeSlots: string;
  status: ShopStatus;
  featuredImage: string;
  featuredImageFile?: {
    uri: string;
    name: string;
    type: string;
  } | null;
  slug?: string;
};

export type EducationFormState = {
  id?: string;
  title: string;
  summary: string;
};

export type BroadcastProfileDefinition = {
  profileKey: BroadcastProfileKey;
  label: string;
  helper: string;
  ownershipLabel?: string;
  managementLabel?: string;
  icon: string;
  tab: BroadcastTabId;
  creationType: BroadcastCreationType;
  summary: (data: Record<string, any>) => string;
  emptySummary: string;
};

export const FEED_MEDIA_TYPES = ['video', 'audio', 'image', 'file', 'text'] as const;
export type FeedMediaType = (typeof FEED_MEDIA_TYPES)[number];

type FeedTextOptions = {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  alignment: 'left' | 'center' | 'right';
  fontSize: 'sm' | 'md' | 'lg';
  highlightColor: string;
};

type FeedVideoOptions = {
  thumbnailLabel: string;
  thumbnailAttachmentKey: string;
  autoPlay: boolean;
  showBadge: boolean;
};

type FeedAudioOptions = {
  waveformStyle: 'classic' | 'modern' | 'minimal';
  episodeNotes: string;
  audioMood: string;
  hasTranscript: boolean;
};

type FeedImageOptions = {
  borderStyle: 'none' | 'rounded' | 'shadow';
  layout: 'portrait' | 'landscape' | 'square';
  captionTone: string;
  overlayColor: string;
};

type FeedFileOptions = {
  categoryLabel: string;
  secureDownload: boolean;
  visibilityNote: string;
  expiryDays: string;
};

export type FeedMediaOptions = {
  video: FeedVideoOptions;
  audio: FeedAudioOptions;
  image: FeedImageOptions;
  file: FeedFileOptions;
  text: FeedTextOptions;
};

export const buildDefaultFeedMediaOptions = (): FeedMediaOptions => ({
  video: {
    thumbnailLabel: '',
    thumbnailAttachmentKey: '',
    autoPlay: false,
    showBadge: true,
  },
  audio: {
    waveformStyle: 'classic',
    episodeNotes: '',
    audioMood: 'uplifting',
    hasTranscript: true,
  },
  image: {
    borderStyle: 'none',
    layout: 'portrait',
    captionTone: '',
    overlayColor: 'transparent',
  },
  file: {
    categoryLabel: 'General resources',
    secureDownload: false,
    visibilityNote: '',
    expiryDays: '7',
  },
  text: {
    bold: false,
    italic: false,
    underline: false,
    strikethrough: false,
    alignment: 'left',
    fontSize: 'md',
    highlightColor: 'transparent',
  },
});
