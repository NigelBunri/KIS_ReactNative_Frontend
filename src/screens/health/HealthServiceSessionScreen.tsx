import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import LinearGradient from 'react-native-linear-gradient';
import KISButton from '@/constants/KISButton';
import { KISIcon, type KISIconName } from '@/constants/kisIcons';
import ROUTES from '@/network';
import {
  endHealthOpsAdmissionSession,
  endHealthOpsEmergencySession,
  fetchHealthOpsAdmissionSession,
  fetchHealthOpsEmergencySession,
  HEALTH_OPS_ADMISSION_STEP_KEYS,
  HEALTH_OPS_EMERGENCY_STEP_KEYS,
  startHealthOpsAdmissionSession,
  type HealthOpsEmergencyStepKey,
  startHealthOpsEmergencySession,
  updateHealthOpsAdmissionStep,
  updateHealthOpsEmergencyTracking,
  updateHealthOpsEmergencyStep,
} from '@/services/healthOpsPhase4Service';
import {
  endHealthOpsBillingSession,
  endHealthOpsHomeLogisticsSession,
  endHealthOpsPharmacySession,
  fetchHealthOpsBillingSession,
  fetchHealthOpsHomeLogisticsSession,
  fetchHealthOpsPharmacySession,
  HEALTH_OPS_BILLING_STEP_KEYS,
  HEALTH_OPS_HOME_LOGISTICS_STEP_KEYS,
  HEALTH_OPS_PHARMACY_STEP_KEYS,
  startHealthOpsBillingSession,
  startHealthOpsHomeLogisticsSession,
  startHealthOpsPharmacySession,
  updateHealthOpsBillingStep,
  updateHealthOpsHomeLogisticsStep,
  updateHealthOpsHomeLogisticsTracking,
  updateHealthOpsPharmacyStep,
  updateHealthOpsPharmacyTracking,
} from '@/services/healthOpsPhase5Service';
import {
  endHealthOpsReminderSession,
  endHealthOpsWellnessSession,
  fetchHealthOpsReminderSession,
  fetchHealthOpsWellnessSession,
  HEALTH_OPS_REMINDER_STEP_KEYS,
  HEALTH_OPS_WELLNESS_STEP_KEYS,
  startHealthOpsReminderSession,
  startHealthOpsWellnessSession,
  updateHealthOpsReminderDelivery,
  updateHealthOpsReminderStep,
  updateHealthOpsWellnessActivity,
  updateHealthOpsWellnessStep,
} from '@/services/healthOpsPhase6Service';
import {
  endHealthOpsClinicalSession,
  endHealthOpsMessagingSession,
  fetchHealthOpsClinicalSession,
  fetchHealthOpsMessagingSession,
  HEALTH_OPS_CLINICAL_ENGINE_CODES,
  HEALTH_OPS_CLINICAL_STEP_META,
  type HealthOpsClinicalEngineCode,
  type HealthOpsMessagingStepKey,
  sendHealthOpsMessage,
  startHealthOpsClinicalSession,
  startHealthOpsMessagingSession,
  updateHealthOpsClinicalStep,
  updateHealthOpsMessagingStep,
} from '@/services/healthOpsClinicalService';
import {
  createEngineSessionVideoItemComment,
  endHealthOpsVideoSession,
  fetchEngineSessionVideoItemComments,
  fetchEngineSessionVideoItems,
  fetchHealthOpsVideoSession,
  type HealthOpsVideoStepKey,
  likeEngineSessionVideoItem,
  startHealthOpsVideoSession,
  unlikeEngineSessionVideoItem,
  updateEngineSessionVideoItemProgress,
  updateHealthOpsVideoStep,
} from '@/services/healthOpsVideoService';
import { fetchHealthOpsWorkflowSession } from '@/services/healthOpsWorkflowService';
import {
  cancelAppointmentBooking,
  fetchAppointmentBooking,
  rescheduleAppointmentBooking,
  startHealthServiceSession,
} from '@/services/healthcareService';
import {
  getHealthThemeBorders,
  getHealthThemeColors,
  HEALTH_THEME_SPACING,
  HEALTH_THEME_TYPOGRAPHY,
} from '@/theme/health';
import { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'HealthServiceSession'>;

const toMoney = (cents?: number) => {
  if (!Number.isFinite(Number(cents))) return 'Not set';
  const kisc = Number(cents) / 10000;
  return `${kisc.toFixed(3).replace(/\.?0+$/, '')} KISC`;
};

const toKisc = (micro?: number) => {
  if (!Number.isFinite(Number(micro))) return '0.000';
  return (Number(micro) / 100000).toFixed(3);
};

const toDateLabel = (isoDate?: string) => {
  const [y, m, d] = String(isoDate || '')
    .split('-')
    .map(part => Number(part));
  if (!y || !m || !d) return String(isoDate || '');
  return new Date(y, m - 1, d).toDateString();
};

const toDateTimeLabel = (isoValue?: string) => {
  const raw = String(isoValue || '').trim();
  if (!raw) return 'Not set';
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleString();
};

const VIDEO_STEP_META: Array<{
  key: HealthOpsVideoStepKey;
  label: string;
  subtitle: string;
  icon: 'person' | 'camera' | 'check' | 'video' | 'file';
}> = [
  {
    key: 'confirm_identity',
    label: 'Confirm Identity',
    subtitle: 'Verify participant identity.',
    icon: 'person',
  },
  {
    key: 'test_mic_camera',
    label: 'Test Mic/Camera',
    subtitle: 'Run pre-session device checks.',
    icon: 'camera',
  },
  {
    key: 'confirm_consent',
    label: 'Confirm Consent',
    subtitle: 'Capture telemedicine consent.',
    icon: 'check',
  },
  {
    key: 'join_session',
    label: 'Join Session',
    subtitle: 'Join the consultation room.',
    icon: 'video',
  },
  {
    key: 'post_session_summary',
    label: 'Post Summary',
    subtitle: 'Submit post-session summary.',
    icon: 'file',
  },
];

const MESSAGING_STEP_META: Array<{
  key: HealthOpsMessagingStepKey;
  label: string;
  subtitle: string;
  icon: 'chat' | 'send' | 'file' | 'check';
}> = [
  {
    key: 'open_thread',
    label: 'Open Thread',
    subtitle: 'Open secure case thread.',
    icon: 'chat',
  },
  {
    key: 'send_message',
    label: 'Send Message',
    subtitle: 'Send first secure message.',
    icon: 'send',
  },
  {
    key: 'attach_files',
    label: 'Attach Files',
    subtitle: 'Upload supporting files or voice notes.',
    icon: 'file',
  },
  {
    key: 'close_thread',
    label: 'Close Thread',
    subtitle: 'Close conversation after resolution.',
    icon: 'check',
  },
];

const CLINICAL_ENGINE_META: Record<
  HealthOpsClinicalEngineCode,
  {
    title: string;
    subtitle: string;
    icon: 'file' | 'list' | 'image';
  }
> = {
  ehr_records: {
    title: 'EHR / Records Engine',
    subtitle: 'Timeline, notes, and documents',
    icon: 'file',
  },
  lab_order: {
    title: 'Lab Order Engine',
    subtitle: 'Test selection and sample workflow',
    icon: 'list',
  },
  imaging_order: {
    title: 'Imaging Engine',
    subtitle: 'Scan selection and report tracking',
    icon: 'image',
  },
};

const ADMISSION_STEP_META: Array<{
  key: string;
  label: string;
  subtitle: string;
}> = [
  {
    key: 'admission_reason',
    label: 'Admission Reason',
    subtitle: 'Capture reason and initial context.',
  },
  {
    key: 'insurance_verification',
    label: 'Insurance Verification',
    subtitle: 'Verify insurance and billing path.',
  },
  {
    key: 'bed_assignment',
    label: 'Bed Assignment',
    subtitle: 'Assign ward and bed details.',
  },
  {
    key: 'admission_confirmation',
    label: 'Admission Confirmation',
    subtitle: 'Confirm admission and handover.',
  },
];

const EMERGENCY_STEP_META: Array<{
  key: HealthOpsEmergencyStepKey;
  label: string;
  subtitle: string;
}> = [
  {
    key: 'capture_location',
    label: 'Capture Location',
    subtitle: 'Capture incident coordinates.',
  },
  {
    key: 'triage_form',
    label: 'Triage Form',
    subtitle: 'Assess urgency and patient condition.',
  },
  {
    key: 'dispatch_ambulance',
    label: 'Dispatch Ambulance',
    subtitle: 'Assign response unit.',
  },
  {
    key: 'track_response',
    label: 'Track Response',
    subtitle: 'Track movement and arrival.',
  },
];

const PHARMACY_STEP_META: Array<{
  key: string;
  label: string;
  subtitle: string;
}> = [
  {
    key: 'verify_prescription',
    label: 'Verify Prescription',
    subtitle: 'Validate prescription and patient profile.',
  },
  {
    key: 'validate_inventory',
    label: 'Validate Inventory',
    subtitle: 'Confirm stock and substitution policy.',
  },
  {
    key: 'confirm_delivery',
    label: 'Confirm Delivery',
    subtitle: 'Choose pickup or home delivery.',
  },
  {
    key: 'fulfillment_tracking',
    label: 'Fulfillment Tracking',
    subtitle: 'Track packing, dispatch, and delivery.',
  },
];

const BILLING_STEP_META: Array<{
  key: string;
  label: string;
  subtitle: string;
}> = [
  {
    key: 'review_charges',
    label: 'Review Charges',
    subtitle: 'Review line items and insurance offsets.',
  },
  {
    key: 'select_payment_method',
    label: 'Confirm KIS Wallet',
    subtitle: 'Use your profile KIS Coin wallet as the payment source.',
  },
  {
    key: 'authorize_payment',
    label: 'Authorize Wallet Payment',
    subtitle: 'Authorize and confirm wallet debit.',
  },
  {
    key: 'issue_receipt',
    label: 'Issue Receipt',
    subtitle: 'Generate invoice and receipt.',
  },
];

const HOME_LOGISTICS_STEP_META: Array<{
  key: string;
  label: string;
  subtitle: string;
}> = [
  {
    key: 'select_logistics_mode',
    label: 'Select Mode',
    subtitle: 'Select nurse visit, pickup, or delivery.',
  },
  {
    key: 'schedule_window',
    label: 'Schedule Window',
    subtitle: 'Set preferred service window.',
  },
  {
    key: 'assign_route',
    label: 'Assign Route',
    subtitle: 'Assign rider, route, or nurse.',
  },
  {
    key: 'track_eta',
    label: 'Track ETA',
    subtitle: 'Track transit and arrival updates.',
  },
];

const WELLNESS_STEP_META: Array<{
  key: string;
  label: string;
  subtitle: string;
}> = [
  {
    key: 'enroll_program',
    label: 'Enroll Program',
    subtitle: 'Enroll user into the wellness program.',
  },
  {
    key: 'set_goals',
    label: 'Set Goals',
    subtitle: 'Set milestones and measurable goals.',
  },
  {
    key: 'track_habits',
    label: 'Track Habits',
    subtitle: 'Log streaks and habit completion.',
  },
  {
    key: 'review_progress',
    label: 'Review Progress',
    subtitle: 'Review and confirm progress outcomes.',
  },
];

const REMINDER_STEP_META: Array<{
  key: string;
  label: string;
  subtitle: string;
}> = [
  {
    key: 'select_channels',
    label: 'Select Channels',
    subtitle: 'Pick SMS, email, push, or WhatsApp channels.',
  },
  {
    key: 'configure_rules',
    label: 'Configure Rules',
    subtitle: 'Configure recurrence and reminder rules.',
  },
  {
    key: 'schedule_reminders',
    label: 'Schedule Reminders',
    subtitle: 'Schedule reminder windows.',
  },
  {
    key: 'confirm_delivery',
    label: 'Confirm Delivery',
    subtitle: 'Confirm reminder delivery operations.',
  },
];

const toMessageTime = (value?: string) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const toStepLabel = (key: string) =>
  String(key || '')
    .split('_')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const toClinicalMap = <T,>(
  value: T,
): Record<HealthOpsClinicalEngineCode, T> => ({
  ehr_records: value,
  lab_order: value,
  imaging_order: value,
});

type HealthOpsEngineFlowKey =
  | 'appointment'
  | 'video'
  | 'messaging'
  | 'clinical'
  | 'admission'
  | 'emergency'
  | 'pharmacy'
  | 'billing'
  | 'home_logistics'
  | 'wellness'
  | 'reminder';

const HEALTH_OPS_ENGINE_FLOW: Array<{
  key: HealthOpsEngineFlowKey;
  title: string;
  subtitle: string;
  icon: KISIconName;
}> = [
  {
    key: 'appointment',
    title: 'Appointment',
    subtitle: 'Booking and schedule confirmation',
    icon: 'calendar',
  },
  {
    key: 'video',
    title: 'Video',
    subtitle: 'Consultation room checks and join flow',
    icon: 'video',
  },
  {
    key: 'messaging',
    title: 'Messaging',
    subtitle: 'Secure thread and attachments',
    icon: 'chat',
  },
  {
    key: 'clinical',
    title: 'Clinical',
    subtitle: 'EHR, lab, and imaging workflows',
    icon: 'file',
  },
  {
    key: 'admission',
    title: 'Admission',
    subtitle: 'Ward and bed operations',
    icon: 'people',
  },
  {
    key: 'emergency',
    title: 'Emergency',
    subtitle: 'Dispatch and response tracking',
    icon: 'bell',
  },
  {
    key: 'pharmacy',
    title: 'Pharmacy',
    subtitle: 'Fulfillment and delivery operations',
    icon: 'cart',
  },
  {
    key: 'billing',
    title: 'Billing',
    subtitle: 'Charges and payment confirmation',
    icon: 'check',
  },
  {
    key: 'home_logistics',
    title: 'Logistics',
    subtitle: 'Home service routing and ETA',
    icon: 'list',
  },
  {
    key: 'wellness',
    title: 'Wellness',
    subtitle: 'Program and progress workflow',
    icon: 'heart',
  },
  {
    key: 'reminder',
    title: 'Reminder',
    subtitle: 'Reminder rules and delivery',
    icon: 'bell',
  },
];

const ENGINE_CODE_TO_FLOW_KEY: Record<string, HealthOpsEngineFlowKey> = {
  appointment: 'appointment',
  video: 'video',
  secure_messaging: 'messaging',
  ehr_records: 'clinical',
  lab_order: 'clinical',
  imaging_order: 'clinical',
  admission_bed: 'admission',
  emergency_dispatch: 'emergency',
  pharmacy_fulfillment: 'pharmacy',
  payment_billing: 'billing',
  home_logistics: 'home_logistics',
  wellness_program: 'wellness',
  notification_reminder: 'reminder',
};

const FLOW_KEY_ALIAS: Record<string, HealthOpsEngineFlowKey> = {
  appointment: 'appointment',
  video: 'video',
  messaging: 'messaging',
  secure_messaging: 'messaging',
  'secure-messaging': 'messaging',
  clinical: 'clinical',
  lab: 'clinical',
  lab_order: 'clinical',
  'lab-order': 'clinical',
  imaging_order: 'clinical',
  'imaging-order': 'clinical',
  ehr_records: 'clinical',
  'ehr-records': 'clinical',
  admission: 'admission',
  admission_bed: 'admission',
  'admission-bed': 'admission',
  surgery: 'admission',
  emergency: 'emergency',
  emergency_dispatch: 'emergency',
  'emergency-dispatch': 'emergency',
  pharmacy: 'pharmacy',
  prescription: 'pharmacy',
  pharmacy_fulfillment: 'pharmacy',
  'pharmacy-fulfillment': 'pharmacy',
  billing: 'billing',
  payment: 'billing',
  payment_billing: 'billing',
  'payment-billing': 'billing',
  logistics: 'home_logistics',
  home_logistics: 'home_logistics',
  'home-logistics': 'home_logistics',
  wellness: 'wellness',
  wellness_program: 'wellness',
  'wellness-program': 'wellness',
  reminder: 'reminder',
  notification_reminder: 'reminder',
  'notification-reminder': 'reminder',
};

const normalizeFlowKeyToken = (
  value: unknown,
): HealthOpsEngineFlowKey | null => {
  const raw = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s/]+/g, '_')
    .replace(/[^a-z0-9_-]/g, '')
    .replace(/_+/g, '_')
    .replace(/-+/g, '-')
    .replace(/^[_-]+|[_-]+$/g, '');
  if (!raw) return null;
  if (FLOW_KEY_ALIAS[raw]) return FLOW_KEY_ALIAS[raw];

  const dashed = raw.replace(/_/g, '-');
  if (FLOW_KEY_ALIAS[dashed]) return FLOW_KEY_ALIAS[dashed];

  const stripped = raw.replace(/(_engine|-engine)$/, '');
  if (FLOW_KEY_ALIAS[stripped]) return FLOW_KEY_ALIAS[stripped];
  const strippedDashed = stripped.replace(/_/g, '-');
  if (FLOW_KEY_ALIAS[strippedDashed]) return FLOW_KEY_ALIAS[strippedDashed];
  return null;
};

const formatSecondsRemaining = (seconds?: number | null) => {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0)
    return '';
  const total = Math.max(0, Math.floor(seconds));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
};

export default function HealthServiceSessionScreen({
  route,
  navigation,
}: Props) {
  const {
    institutionId,
    institutionName,
    cardId,
    workflowSessionId,
    appointmentBookingId,
    sessionSource,
    serviceId,
    serviceName,
    serviceDescription,
    configuredEngineFlowKeys,
    statusLabel,
    dateKey,
    timeValue,
    basePriceCents,
    memberPriceCents,
    ownerPreview,
  } = route.params;

  const scheme = useColorScheme();
  const palette = getHealthThemeColors(scheme === 'light' ? 'light' : 'dark');
  const spacing = HEALTH_THEME_SPACING;
  const borders = getHealthThemeBorders(palette);
  const typography = HEALTH_THEME_TYPOGRAPHY;

  const initialSessionSource: 'broadcasts' | 'health_ops' =
    sessionSource === 'health_ops' ? 'health_ops' : 'broadcasts';
  // Only trust explicit `workflowSessionId` for health-ops runtime calls.
  const initialWorkflowSessionId = String(workflowSessionId || '').trim();

  const [resolvedSessionSource, setResolvedSessionSource] = useState<
    'broadcasts' | 'health_ops'
  >(initialSessionSource);
  const [resolvedWorkflowSessionId, setResolvedWorkflowSessionId] = useState(
    initialWorkflowSessionId,
  );
  const [workflowContextLoading, setWorkflowContextLoading] = useState(false);
  const [workflowContextError, setWorkflowContextError] = useState('');
  const [workflowContextResolvedOnce, setWorkflowContextResolvedOnce] =
    useState(false);

  const cleanServiceId = String(serviceId || '').trim();
  const cleanWorkflowSessionId = String(resolvedWorkflowSessionId || '').trim();
  const [appointmentBooking, setAppointmentBooking] = useState<any | null>(
    null,
  );
  const [appointmentLoading, setAppointmentLoading] = useState(false);
  const [appointmentError, setAppointmentError] = useState('');

  const [busy, setBusy] = useState(false);
  const [workflowRuntimeLoading, setWorkflowRuntimeLoading] = useState(false);
  const [workflowRuntime, setWorkflowRuntime] = useState<any | null>(null);
  const [viewerWalletMicro] = useState<number | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoBusy, setVideoBusy] = useState(false);
  const [videoError, setVideoError] = useState('');
  const [videoSession, setVideoSession] = useState<any | null>(null);
  const [videoItemsLoading, setVideoItemsLoading] = useState(false);
  const [videoItemsError, setVideoItemsError] = useState('');
  const [videoItems, setVideoItems] = useState<any[]>([]);
  const [videoCommentsByItem, setVideoCommentsByItem] = useState<
    Record<string, any[]>
  >({});
  const [videoCommentDraftByItem, setVideoCommentDraftByItem] = useState<
    Record<string, string>
  >({});
  const [videoEngineMapped, setVideoEngineMapped] = useState<boolean | null>(
    null,
  );
  const [messagingLoading, setMessagingLoading] = useState(false);
  const [messagingBusy, setMessagingBusy] = useState(false);
  const [messagingError, setMessagingError] = useState('');
  const [messagingSession, setMessagingSession] = useState<any | null>(null);
  const [messagingEngineMapped, setMessagingEngineMapped] = useState<
    boolean | null
  >(null);
  const [messagingMessages, setMessagingMessages] = useState<any[]>([]);
  const [messagingUnreadCount, setMessagingUnreadCount] = useState(0);
  const [messageDraft, setMessageDraft] = useState('');
  const [clinicalLoading, setClinicalLoading] = useState<
    Record<HealthOpsClinicalEngineCode, boolean>
  >(() => toClinicalMap(false));
  const [clinicalBusy, setClinicalBusy] = useState<
    Record<HealthOpsClinicalEngineCode, boolean>
  >(() => toClinicalMap(false));
  const [clinicalErrors, setClinicalErrors] = useState<
    Record<HealthOpsClinicalEngineCode, string>
  >(() => toClinicalMap(''));
  const [clinicalSessions, setClinicalSessions] = useState<
    Record<HealthOpsClinicalEngineCode, any | null>
  >(() => toClinicalMap(null));
  const [clinicalEngineMapped, setClinicalEngineMapped] = useState<
    Record<HealthOpsClinicalEngineCode, boolean | null>
  >(() => toClinicalMap(null));
  const [admissionLoading, setAdmissionLoading] = useState(false);
  const [admissionBusy, setAdmissionBusy] = useState(false);
  const [admissionError, setAdmissionError] = useState('');
  const [admissionEngineMapped, setAdmissionEngineMapped] = useState<
    boolean | null
  >(null);
  const [admissionSession, setAdmissionSession] = useState<any | null>(null);
  const [admissionWardDraft, setAdmissionWardDraft] = useState('');
  const [admissionBedDraft, setAdmissionBedDraft] = useState('');
  const [emergencyLoading, setEmergencyLoading] = useState(false);
  const [emergencyBusy, setEmergencyBusy] = useState(false);
  const [emergencyError, setEmergencyError] = useState('');
  const [emergencyEngineMapped, setEmergencyEngineMapped] = useState<
    boolean | null
  >(null);
  const [emergencySession, setEmergencySession] = useState<any | null>(null);
  const [emergencyTrackingEvents, setEmergencyTrackingEvents] = useState<any[]>(
    [],
  );
  const [emergencyEtaDraft, setEmergencyEtaDraft] = useState('');
  const [emergencyNoteDraft, setEmergencyNoteDraft] = useState('');
  const [pharmacyLoading, setPharmacyLoading] = useState(false);
  const [pharmacyBusy, setPharmacyBusy] = useState(false);
  const [pharmacyError, setPharmacyError] = useState('');
  const [pharmacyEngineMapped, setPharmacyEngineMapped] = useState<
    boolean | null
  >(null);
  const [pharmacySession, setPharmacySession] = useState<any | null>(null);
  const [pharmacyTrackingEvents, setPharmacyTrackingEvents] = useState<any[]>(
    [],
  );
  const [pharmacyEtaDraft, setPharmacyEtaDraft] = useState('');
  const [pharmacyNoteDraft, setPharmacyNoteDraft] = useState('');
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingBusy, setBillingBusy] = useState(false);
  const [billingError, setBillingError] = useState('');
  const [billingEngineMapped, setBillingEngineMapped] = useState<
    boolean | null
  >(null);
  const [billingSession, setBillingSession] = useState<any | null>(null);
  const [homeLogisticsLoading, setHomeLogisticsLoading] = useState(false);
  const [homeLogisticsBusy, setHomeLogisticsBusy] = useState(false);
  const [homeLogisticsError, setHomeLogisticsError] = useState('');
  const [homeLogisticsEngineMapped, setHomeLogisticsEngineMapped] = useState<
    boolean | null
  >(null);
  const [homeLogisticsSession, setHomeLogisticsSession] = useState<any | null>(
    null,
  );
  const [homeLogisticsTrackingEvents, setHomeLogisticsTrackingEvents] =
    useState<any[]>([]);
  const [homeLogisticsEtaDraft, setHomeLogisticsEtaDraft] = useState('');
  const [homeLogisticsNoteDraft, setHomeLogisticsNoteDraft] = useState('');
  const [wellnessLoading, setWellnessLoading] = useState(false);
  const [wellnessBusy, setWellnessBusy] = useState(false);
  const [wellnessError, setWellnessError] = useState('');
  const [wellnessEngineMapped, setWellnessEngineMapped] = useState<
    boolean | null
  >(null);
  const [wellnessSession, setWellnessSession] = useState<any | null>(null);
  const [wellnessActivityEvents, setWellnessActivityEvents] = useState<any[]>(
    [],
  );
  const [wellnessProgramDraft, setWellnessProgramDraft] = useState('');
  const [wellnessNoteDraft, setWellnessNoteDraft] = useState('');
  const [wellnessCompletionDraft, setWellnessCompletionDraft] = useState('');
  const [reminderLoading, setReminderLoading] = useState(false);
  const [reminderBusy, setReminderBusy] = useState(false);
  const [reminderError, setReminderError] = useState('');
  const [reminderEngineMapped, setReminderEngineMapped] = useState<
    boolean | null
  >(null);
  const [reminderSession, setReminderSession] = useState<any | null>(null);
  const [reminderDeliveryEvents, setReminderDeliveryEvents] = useState<any[]>(
    [],
  );
  const [reminderNextRunDraft, setReminderNextRunDraft] = useState('');
  const [reminderNoteDraft, setReminderNoteDraft] = useState('');
  const [activeEngineKey, setActiveEngineKey] =
    useState<HealthOpsEngineFlowKey>('appointment');
  const hasWorkflowRuntimeEngines =
    Array.isArray(workflowRuntime?.engines) &&
    workflowRuntime.engines.length > 0;
  const isHealthOpsSession =
    resolvedSessionSource === 'health_ops' ||
    !!cleanWorkflowSessionId ||
    hasWorkflowRuntimeEngines;
  const videoSessionId = String(videoSession?.id || '').trim();
  const videoStatus = String(videoSession?.status || '')
    .trim()
    .toLowerCase();
  const videoStepState =
    videoSession?.step_state &&
    typeof videoSession.step_state === 'object' &&
    !Array.isArray(videoSession.step_state)
      ? videoSession.step_state
      : {};
  const videoJoinUrl = String(
    videoSession?.participant_join_url || videoSession?.host_join_url || '',
  ).trim();
  const messagingSessionId = String(messagingSession?.id || '').trim();
  const messagingStatus = String(messagingSession?.status || '')
    .trim()
    .toLowerCase();
  const messagingStepState =
    messagingSession?.step_state &&
    typeof messagingSession.step_state === 'object' &&
    !Array.isArray(messagingSession.step_state)
      ? messagingSession.step_state
      : {};
  const latestMessages = useMemo(
    () => (Array.isArray(messagingMessages) ? messagingMessages.slice(-6) : []),
    [messagingMessages],
  );
  const messagingIsClosed =
    messagingStatus === 'completed' ||
    messagingStatus === 'closed' ||
    messagingStatus === 'cancelled';
  const admissionSessionId = String(admissionSession?.id || '').trim();
  const admissionStatus = String(admissionSession?.status || '')
    .trim()
    .toLowerCase();
  const admissionStepState =
    admissionSession?.step_state &&
    typeof admissionSession.step_state === 'object' &&
    !Array.isArray(admissionSession.step_state)
      ? admissionSession.step_state
      : {};
  const admissionIsClosed =
    admissionStatus === 'completed' || admissionStatus === 'cancelled';
  const emergencySessionId = String(emergencySession?.id || '').trim();
  const emergencyStatus = String(emergencySession?.status || '')
    .trim()
    .toLowerCase();
  const emergencyStepState =
    emergencySession?.step_state &&
    typeof emergencySession.step_state === 'object' &&
    !Array.isArray(emergencySession.step_state)
      ? emergencySession.step_state
      : {};
  const emergencyIsClosed =
    emergencyStatus === 'resolved' || emergencyStatus === 'cancelled';
  const recentEmergencyEvents = useMemo(
    () =>
      Array.isArray(emergencyTrackingEvents)
        ? emergencyTrackingEvents.slice(-8)
        : [],
    [emergencyTrackingEvents],
  );
  const pharmacySessionId = String(pharmacySession?.id || '').trim();
  const pharmacyStatus = String(pharmacySession?.status || '')
    .trim()
    .toLowerCase();
  const pharmacyStepState =
    pharmacySession?.step_state &&
    typeof pharmacySession.step_state === 'object' &&
    !Array.isArray(pharmacySession.step_state)
      ? pharmacySession.step_state
      : {};
  const pharmacyIsClosed =
    pharmacyStatus === 'completed' || pharmacyStatus === 'cancelled';
  const recentPharmacyEvents = useMemo(
    () =>
      Array.isArray(pharmacyTrackingEvents)
        ? pharmacyTrackingEvents.slice(-8)
        : [],
    [pharmacyTrackingEvents],
  );
  const billingSessionId = String(billingSession?.id || '').trim();
  const billingStatus = String(billingSession?.status || '')
    .trim()
    .toLowerCase();
  const billingStepState =
    billingSession?.step_state &&
    typeof billingSession.step_state === 'object' &&
    !Array.isArray(billingSession.step_state)
      ? billingSession.step_state
      : {};
  const billingIsClosed =
    billingStatus === 'completed' ||
    billingStatus === 'failed' ||
    billingStatus === 'cancelled';
  const homeLogisticsSessionId = String(homeLogisticsSession?.id || '').trim();
  const homeLogisticsStatus = String(homeLogisticsSession?.status || '')
    .trim()
    .toLowerCase();
  const homeLogisticsStepState =
    homeLogisticsSession?.step_state &&
    typeof homeLogisticsSession.step_state === 'object' &&
    !Array.isArray(homeLogisticsSession.step_state)
      ? homeLogisticsSession.step_state
      : {};
  const homeLogisticsIsClosed =
    homeLogisticsStatus === 'completed' || homeLogisticsStatus === 'cancelled';
  const recentHomeLogisticsEvents = useMemo(
    () =>
      Array.isArray(homeLogisticsTrackingEvents)
        ? homeLogisticsTrackingEvents.slice(-8)
        : [],
    [homeLogisticsTrackingEvents],
  );
  const wellnessSessionId = String(wellnessSession?.id || '').trim();
  const wellnessStatus = String(wellnessSession?.status || '')
    .trim()
    .toLowerCase();
  const wellnessStepState =
    wellnessSession?.step_state &&
    typeof wellnessSession.step_state === 'object' &&
    !Array.isArray(wellnessSession.step_state)
      ? wellnessSession.step_state
      : {};
  const wellnessIsClosed =
    wellnessStatus === 'completed' || wellnessStatus === 'cancelled';
  const recentWellnessEvents = useMemo(
    () =>
      Array.isArray(wellnessActivityEvents)
        ? wellnessActivityEvents.slice(-8)
        : [],
    [wellnessActivityEvents],
  );
  const reminderSessionId = String(reminderSession?.id || '').trim();
  const reminderStatus = String(reminderSession?.status || '')
    .trim()
    .toLowerCase();
  const reminderStepState =
    reminderSession?.step_state &&
    typeof reminderSession.step_state === 'object' &&
    !Array.isArray(reminderSession.step_state)
      ? reminderSession.step_state
      : {};
  const reminderIsClosed =
    reminderStatus === 'completed' ||
    reminderStatus === 'disabled' ||
    reminderStatus === 'cancelled';
  const recentReminderEvents = useMemo(
    () =>
      Array.isArray(reminderDeliveryEvents)
        ? reminderDeliveryEvents.slice(-8)
        : [],
    [reminderDeliveryEvents],
  );
  const runtimeEngines = useMemo(
    () =>
      Array.isArray(workflowRuntime?.engines) ? workflowRuntime.engines : [],
    [workflowRuntime],
  );
  const runtimeByFlowKey = useMemo(() => {
    const out = new Map<HealthOpsEngineFlowKey, any>();
    runtimeEngines.forEach((row: any) => {
      const engineCode = String(row?.engine_code || '')
        .trim()
        .toLowerCase();
      const flowKey = ENGINE_CODE_TO_FLOW_KEY[engineCode];
      if (flowKey && !out.has(flowKey)) {
        out.set(flowKey, row);
      }
    });
    return out;
  }, [runtimeEngines]);
  const cleanBookingId = String(
    appointmentBooking?.id ||
      appointmentBooking?.booking_id ||
      appointmentBookingId ||
      workflowRuntime?.appointment_booking_id ||
      workflowRuntime?.appointmentBookingId ||
      '',
  ).trim();
  const appointmentStatus = String(
    appointmentBooking?.status ||
      appointmentBooking?.booking_status ||
      workflowRuntime?.appointment_status ||
      '',
  ).trim();
  const appointmentCanMutate = !['cancelled', 'completed', 'no_show'].includes(
    appointmentStatus.toLowerCase(),
  );
  const bookingRows = useMemo(
    () =>
      [
        `Patient: ${
          appointmentBooking?.patient_name ||
          appointmentBooking?.patient ||
          'Current user'
        }`,
        `Date: ${toDateLabel(
          appointmentBooking?.date || appointmentBooking?.date_key || dateKey,
        )}`,
        `Time: ${
          appointmentBooking?.time ||
          appointmentBooking?.time_value ||
          timeValue ||
          'Not set'
        }`,
        `Status: ${(appointmentStatus || 'started').toUpperCase()}`,
      ].filter(Boolean),
    [appointmentBooking, appointmentStatus, dateKey, timeValue],
  );
  const configuredFlowKeysFromRoute = useMemo(() => {
    if (
      !Array.isArray(configuredEngineFlowKeys) ||
      configuredEngineFlowKeys.length <= 0
    ) {
      return [] as HealthOpsEngineFlowKey[];
    }
    const seen = new Set<HealthOpsEngineFlowKey>();
    const ordered: HealthOpsEngineFlowKey[] = [];
    configuredEngineFlowKeys.forEach(token => {
      const key = normalizeFlowKeyToken(token);
      if (!key || seen.has(key)) return;
      seen.add(key);
      ordered.push(key);
    });
    return ordered;
  }, [configuredEngineFlowKeys]);
  const effectiveEngineFlow = useMemo(() => {
    if (runtimeByFlowKey.size > 0) {
      const configuredKeySet =
        configuredFlowKeysFromRoute.length > 0
          ? new Set<HealthOpsEngineFlowKey>(configuredFlowKeysFromRoute)
          : null;
      const rows: Array<{
        key: HealthOpsEngineFlowKey;
        title: string;
        subtitle: string;
        icon: KISIconName;
      }> = [];
      runtimeByFlowKey.forEach((_value, flowKey) => {
        if (configuredKeySet && !configuredKeySet.has(flowKey)) {
          return;
        }
        const meta = HEALTH_OPS_ENGINE_FLOW.find(row => row.key === flowKey);
        if (meta) rows.push(meta);
      });
      rows.sort((a, b) => {
        const left = Number(runtimeByFlowKey.get(a.key)?.execution_order || 0);
        const right = Number(runtimeByFlowKey.get(b.key)?.execution_order || 0);
        return left - right;
      });
      if (rows.length > 0) return rows;
    }

    if (configuredFlowKeysFromRoute.length > 0) {
      const order = new Map<HealthOpsEngineFlowKey, number>();
      configuredFlowKeysFromRoute.forEach((key, index) => {
        order.set(key, index);
      });
      const rows = HEALTH_OPS_ENGINE_FLOW.filter(row => order.has(row.key));
      rows.sort(
        (a, b) => Number(order.get(a.key) || 0) - Number(order.get(b.key) || 0),
      );
      if (rows.length > 0) return rows;
    }

    return [HEALTH_OPS_ENGINE_FLOW[0]];
  }, [configuredFlowKeysFromRoute, runtimeByFlowKey]);
  const activeEngineIndex = Math.max(
    0,
    effectiveEngineFlow.findIndex(engine => engine.key === activeEngineKey),
  );
  const activeEngineMeta =
    effectiveEngineFlow[activeEngineIndex] ??
    effectiveEngineFlow[0] ??
    HEALTH_OPS_ENGINE_FLOW[0];
  const completedEngineCount = useMemo(
    () =>
      effectiveEngineFlow.filter(
        engine =>
          String(runtimeByFlowKey.get(engine.key)?.state || '') === 'completed',
      ).length,
    [effectiveEngineFlow, runtimeByFlowKey],
  );
  const flowProgressPercent =
    effectiveEngineFlow.length > 0
      ? Math.round((completedEngineCount / effectiveEngineFlow.length) * 100)
      : 0;
  const hasPreviousEngine = activeEngineIndex > 0;
  const hasNextEngine = activeEngineIndex < effectiveEngineFlow.length - 1;
  const activeEngineRuntime =
    runtimeByFlowKey.get(activeEngineMeta.key) || null;
  const activeEngineState = String(
    activeEngineRuntime?.state || '',
  ).toLowerCase();
  const activeEngineTimeLeft = formatSecondsRemaining(
    activeEngineRuntime?.remaining_seconds,
  );
  const nextEngineMeta = hasNextEngine
    ? effectiveEngineFlow[activeEngineIndex + 1]
    : null;
  const nextEngineState = String(
    (nextEngineMeta ? runtimeByFlowKey.get(nextEngineMeta.key) : null)?.state ||
      '',
  ).toLowerCase();
  const nextEngineBlocked =
    nextEngineState === 'locked' || nextEngineState === 'expired';
  const videoEngineRuntime = runtimeByFlowKey.get('video') || null;
  const videoEngineSessionId = String(
    videoEngineRuntime?.engine_session_id || '',
  ).trim();

  const openEngineFlow = useCallback(
    (flowKey: HealthOpsEngineFlowKey) => {
      const runtimeRow = runtimeByFlowKey.get(flowKey);
      const state = String(runtimeRow?.state || '').toLowerCase();
      if (state === 'locked') {
        Alert.alert(
          'Engine locked',
          'Complete previous required engines first.',
        );
        return;
      }
      if (state === 'expired') {
        Alert.alert('Engine expired', 'This engine access window has expired.');
        return;
      }
      setActiveEngineKey(flowKey);
    },
    [runtimeByFlowKey],
  );

  const goToPreviousEngine = useCallback(() => {
    if (!hasPreviousEngine) return;
    const previous = effectiveEngineFlow[activeEngineIndex - 1];
    if (previous) openEngineFlow(previous.key);
  }, [
    activeEngineIndex,
    effectiveEngineFlow,
    hasPreviousEngine,
    openEngineFlow,
  ]);

  const goToNextEngine = useCallback(() => {
    if (!hasNextEngine) return;
    const next = effectiveEngineFlow[activeEngineIndex + 1];
    if (next) openEngineFlow(next.key);
  }, [activeEngineIndex, effectiveEngineFlow, hasNextEngine, openEngineFlow]);

  useEffect(() => {
    if (!isHealthOpsSession) return;
    if (!effectiveEngineFlow.some(engine => engine.key === activeEngineKey)) {
      setActiveEngineKey(effectiveEngineFlow[0]?.key || 'appointment');
    }
  }, [activeEngineKey, effectiveEngineFlow, isHealthOpsSession]);

  useEffect(() => {
    if (!isHealthOpsSession) return;
    const currentEngineSessionId = String(
      workflowRuntime?.current_engine_session_id || '',
    ).trim();
    if (!currentEngineSessionId) return;
    const currentRuntime = runtimeEngines.find(
      (row: any) =>
        String(row?.engine_session_id || '').trim() === currentEngineSessionId,
    );
    const currentCode = String(currentRuntime?.engine_code || '')
      .trim()
      .toLowerCase();
    const nextFlowKey = ENGINE_CODE_TO_FLOW_KEY[currentCode];
    if (
      nextFlowKey &&
      effectiveEngineFlow.some(engine => engine.key === nextFlowKey)
    ) {
      setActiveEngineKey(nextFlowKey);
    }
  }, [
    effectiveEngineFlow,
    isHealthOpsSession,
    runtimeEngines,
    workflowRuntime,
  ]);

  const featureRows = useMemo(
    () =>
      [
        `Status: ${statusLabel || 'Available'}`,
        `Scheduled: ${toDateLabel(dateKey)}${
          timeValue ? ` · ${timeValue}` : ''
        }`,
        `Standard price: ${toMoney(basePriceCents)}`,
        Number.isFinite(Number(memberPriceCents))
          ? `Member price: ${toMoney(memberPriceCents)}`
          : '',
      ].filter(Boolean),
    [basePriceCents, dateKey, memberPriceCents, statusLabel, timeValue],
  );

  const resolveWorkflowContext = useCallback(
    async ({ quiet = false }: { quiet?: boolean } = {}) => {
      if (cleanWorkflowSessionId || !cleanServiceId) return;
      if (!quiet) setWorkflowContextLoading(true);
      try {
        const start = await startHealthServiceSession({
          institutionId,
          cardId,
          serviceId: cleanServiceId,
          date: dateKey,
          time: timeValue,
          ownerPreview,
        });
        if (!start?.success) {
          throw new Error(
            start?.message || 'Unable to prepare workflow context.',
          );
        }

        const nextWorkflowSessionId = String(
          start?.data?.session?.id || '',
        ).trim();
        const nextSource =
          String(start?.source || '')
            .trim()
            .toLowerCase() === 'health_ops' || !!nextWorkflowSessionId
            ? 'health_ops'
            : 'broadcasts';

        if (nextWorkflowSessionId) {
          setResolvedWorkflowSessionId(nextWorkflowSessionId);
        }
        const booking =
          start?.data?.booking ||
          start?.booking ||
          start?.data?.appointment ||
          start?.appointment;
        if (booking && typeof booking === 'object') {
          setAppointmentBooking(booking);
        }
        setResolvedSessionSource(nextSource);
        setWorkflowContextError('');
      } catch (error: any) {
        const message = error?.message || 'Unable to prepare workflow context.';
        setWorkflowContextError(message);
        if (!quiet) {
          Alert.alert('Service session', message);
        }
      } finally {
        if (!quiet) setWorkflowContextLoading(false);
      }
    },
    [
      cardId,
      cleanServiceId,
      cleanWorkflowSessionId,
      dateKey,
      institutionId,
      ownerPreview,
      timeValue,
    ],
  );

  useEffect(() => {
    // Avoid re-booking/upgrade attempts for sessions that already came from legacy broadcast mode.
    if (initialSessionSource !== 'health_ops') return;
    if (
      cleanWorkflowSessionId ||
      workflowContextResolvedOnce ||
      !cleanServiceId
    )
      return;
    setWorkflowContextResolvedOnce(true);
    setWorkflowContextLoading(true);
    resolveWorkflowContext({ quiet: true }).finally(() => {
      setWorkflowContextLoading(false);
    });
  }, [
    cleanServiceId,
    cleanWorkflowSessionId,
    initialSessionSource,
    resolveWorkflowContext,
    workflowContextResolvedOnce,
  ]);

  const loadWorkflowRuntime = useCallback(
    async ({ quiet = false }: { quiet?: boolean } = {}) => {
      if (!isHealthOpsSession || !cleanWorkflowSessionId) return;
      if (!quiet) setWorkflowRuntimeLoading(true);
      try {
        const response = await fetchHealthOpsWorkflowSession(
          cleanWorkflowSessionId,
        );
        if (!response?.success) {
          throw new Error(
            response?.message || 'Unable to load workflow runtime.',
          );
        }
        const session = response?.data?.session || response?.session;
        const runtime =
          session?.runtime && typeof session.runtime === 'object'
            ? session.runtime
            : null;
        setWorkflowRuntime(runtime);
      } catch (error: any) {
        if (!quiet) {
          Alert.alert(
            'Workflow',
            error?.message || 'Unable to load workflow runtime.',
          );
        }
      } finally {
        if (!quiet) setWorkflowRuntimeLoading(false);
      }
    },
    [cleanWorkflowSessionId, isHealthOpsSession],
  );

  useEffect(() => {
    if (!isHealthOpsSession || !cleanWorkflowSessionId) return;
    loadWorkflowRuntime().catch(() => undefined);
    const timer = setInterval(() => {
      loadWorkflowRuntime({ quiet: true }).catch(() => undefined);
    }, 15000);
    return () => clearInterval(timer);
  }, [cleanWorkflowSessionId, isHealthOpsSession, loadWorkflowRuntime]);

  const loadVideoItems = useCallback(
    async ({ quiet = false }: { quiet?: boolean } = {}) => {
      if (!videoEngineSessionId) return;
      if (!quiet) setVideoItemsLoading(true);
      try {
        const response = await fetchEngineSessionVideoItems(
          videoEngineSessionId,
        );
        if (!response?.success) {
          throw new Error(response?.message || 'Unable to load video items.');
        }
        const rows = Array.isArray(response?.data?.results)
          ? response.data.results
          : [];
        setVideoItems(rows);
        setVideoItemsError('');
      } catch (error: any) {
        const message = error?.message || 'Unable to load video items.';
        setVideoItemsError(message);
        if (!quiet) {
          Alert.alert('Video Engine', message);
        }
      } finally {
        if (!quiet) setVideoItemsLoading(false);
      }
    },
    [videoEngineSessionId],
  );

  useEffect(() => {
    if (!videoEngineSessionId) {
      setVideoItems([]);
      return;
    }
    loadVideoItems().catch(() => undefined);
  }, [loadVideoItems, videoEngineSessionId]);

  const markVideoItemWatched = useCallback(
    async (itemId: string, watchedSeconds?: number) => {
      if (!videoEngineSessionId || !itemId) return;
      const response = await updateEngineSessionVideoItemProgress(
        videoEngineSessionId,
        itemId,
        {
          isCompleted: true,
          watchedSeconds:
            typeof watchedSeconds === 'number' ? watchedSeconds : undefined,
        },
      );
      if (!response?.success) {
        throw new Error(
          response?.message || 'Unable to update video progress.',
        );
      }
      await Promise.all([
        loadVideoItems({ quiet: true }),
        loadWorkflowRuntime({ quiet: true }),
      ]);
    },
    [loadVideoItems, loadWorkflowRuntime, videoEngineSessionId],
  );

  const toggleVideoItemLike = useCallback(
    async (item: any) => {
      if (!videoEngineSessionId) return;
      const itemId = String(item?.id || '').trim();
      if (!itemId) return;
      const viewerLiked = !!item?.viewer_liked;
      const response = viewerLiked
        ? await unlikeEngineSessionVideoItem(videoEngineSessionId, itemId)
        : await likeEngineSessionVideoItem(videoEngineSessionId, itemId);
      if (!response?.success) {
        throw new Error(response?.message || 'Unable to update video like.');
      }
      await loadVideoItems({ quiet: true });
    },
    [loadVideoItems, videoEngineSessionId],
  );

  const loadVideoItemComments = useCallback(
    async (itemId: string) => {
      if (!videoEngineSessionId || !itemId) return;
      const response = await fetchEngineSessionVideoItemComments(
        videoEngineSessionId,
        itemId,
      );
      if (!response?.success) {
        throw new Error(response?.message || 'Unable to load comments.');
      }
      const rows = Array.isArray(response?.data?.results)
        ? response.data.results
        : [];
      setVideoCommentsByItem(prev => ({ ...prev, [itemId]: rows }));
    },
    [videoEngineSessionId],
  );

  const addVideoItemComment = useCallback(
    async (itemId: string) => {
      if (!videoEngineSessionId || !itemId) return;
      const draft = String(videoCommentDraftByItem[itemId] || '').trim();
      if (!draft) return;
      const response = await createEngineSessionVideoItemComment(
        videoEngineSessionId,
        itemId,
        draft,
      );
      if (!response?.success) {
        throw new Error(response?.message || 'Unable to post comment.');
      }
      setVideoCommentDraftByItem(prev => ({ ...prev, [itemId]: '' }));
      await Promise.all([
        loadVideoItemComments(itemId),
        loadVideoItems({ quiet: true }),
      ]);
    },
    [
      loadVideoItemComments,
      loadVideoItems,
      videoCommentDraftByItem,
      videoEngineSessionId,
    ],
  );

  const bootstrapVideoSession = useCallback(
    async ({ quiet = false }: { quiet?: boolean } = {}) => {
      if (!isHealthOpsSession || !cleanWorkflowSessionId) return;
      setVideoLoading(true);
      try {
        const response = await startHealthOpsVideoSession({
          workflowSessionId: cleanWorkflowSessionId,
          appointmentBookingId: cleanBookingId || undefined,
          metadata: {
            source: 'mobile_app',
            screen: 'HealthServiceSession',
          },
        });
        if (!response?.success) {
          if (Number(response?.status) === 404) {
            setVideoEngineMapped(false);
            setVideoError('Video engine is not mapped to this workflow yet.');
            return;
          }
          throw new Error(
            response?.message || 'Unable to prepare video consultation.',
          );
        }
        const nextVideoSession =
          response?.data?.video_session || response?.video_session;
        if (nextVideoSession && typeof nextVideoSession === 'object') {
          setVideoSession(nextVideoSession);
        }
        setVideoEngineMapped(true);
        setVideoError('');
      } catch (error: any) {
        const message =
          error?.message || 'Unable to prepare video consultation.';
        setVideoError(message);
        if (!quiet) {
          Alert.alert('Video consultation', message);
        }
      } finally {
        setVideoLoading(false);
      }
    },
    [cleanBookingId, cleanWorkflowSessionId, isHealthOpsSession],
  );

  const refreshVideoSession = useCallback(
    async ({ quiet = false }: { quiet?: boolean } = {}) => {
      if (!isHealthOpsSession) return;
      if (!videoSessionId) {
        await bootstrapVideoSession({ quiet });
        return;
      }
      setVideoLoading(true);
      try {
        const response = await fetchHealthOpsVideoSession(videoSessionId);
        if (!response?.success) {
          throw new Error(
            response?.message || 'Unable to refresh video consultation.',
          );
        }
        const nextVideoSession =
          response?.data?.video_session || response?.video_session;
        if (nextVideoSession && typeof nextVideoSession === 'object') {
          setVideoSession(nextVideoSession);
        }
        setVideoEngineMapped(true);
        setVideoError('');
      } catch (error: any) {
        const message =
          error?.message || 'Unable to refresh video consultation.';
        setVideoError(message);
        if (!quiet) {
          Alert.alert('Video consultation', message);
        }
      } finally {
        setVideoLoading(false);
      }
    },
    [bootstrapVideoSession, isHealthOpsSession, videoSessionId],
  );

  useEffect(() => {
    if (!isHealthOpsSession || !cleanWorkflowSessionId) return;
    bootstrapVideoSession({ quiet: true }).catch(() => undefined);
  }, [bootstrapVideoSession, cleanWorkflowSessionId, isHealthOpsSession]);

  const completeVideoStep = useCallback(
    async (stepKey: HealthOpsVideoStepKey) => {
      if (!videoSessionId) {
        Alert.alert('Video consultation', 'Video session is not ready yet.');
        return;
      }
      setVideoBusy(true);
      try {
        const response = await updateHealthOpsVideoStep(
          videoSessionId,
          stepKey,
          {
            source: 'mobile_app',
            completed_at: new Date().toISOString(),
          },
          true,
        );
        if (!response?.success) {
          throw new Error(
            response?.message || 'Unable to update video progress.',
          );
        }
        const nextVideoSession =
          response?.data?.video_session || response?.video_session;
        if (nextVideoSession && typeof nextVideoSession === 'object') {
          setVideoSession(nextVideoSession);
        }
        setVideoError('');
      } catch (error: any) {
        Alert.alert(
          'Video consultation',
          error?.message || 'Unable to update video progress.',
        );
      } finally {
        setVideoBusy(false);
      }
    },
    [videoSessionId],
  );

  const endVideoSession = useCallback(
    async (status: 'completed' | 'cancelled') => {
      if (!videoSessionId) {
        Alert.alert('Video consultation', 'Video session is not ready yet.');
        return;
      }
      setVideoBusy(true);
      try {
        const response = await endHealthOpsVideoSession(videoSessionId, {
          status,
          summary:
            status === 'completed'
              ? 'Completed via mobile health service session screen.'
              : 'Cancelled via mobile health service session screen.',
          metadata: { source: 'mobile_app' },
        });
        if (!response?.success) {
          throw new Error(response?.message || 'Unable to end video session.');
        }
        const nextVideoSession =
          response?.data?.video_session || response?.video_session;
        if (nextVideoSession && typeof nextVideoSession === 'object') {
          setVideoSession(nextVideoSession);
        }
        setVideoError('');
      } catch (error: any) {
        Alert.alert(
          'Video consultation',
          error?.message || 'Unable to end video session.',
        );
      } finally {
        setVideoBusy(false);
      }
    },
    [videoSessionId],
  );

  const openVideoJoinLink = useCallback(async () => {
    if (!videoJoinUrl) {
      Alert.alert('Video consultation', 'Join link is unavailable.');
      return;
    }
    try {
      const canOpen = await Linking.canOpenURL(videoJoinUrl).catch(() => false);
      if (!canOpen) {
        throw new Error('Join link is unavailable on this device.');
      }
      await Linking.openURL(videoJoinUrl);
    } catch (error: any) {
      Alert.alert(
        'Video consultation',
        error?.message || 'Unable to open join link.',
      );
    }
  }, [videoJoinUrl]);

  const setClinicalLoadingFor = useCallback(
    (engineCode: HealthOpsClinicalEngineCode, value: boolean) => {
      setClinicalLoading(prev => ({ ...prev, [engineCode]: value }));
    },
    [],
  );

  const setClinicalBusyFor = useCallback(
    (engineCode: HealthOpsClinicalEngineCode, value: boolean) => {
      setClinicalBusy(prev => ({ ...prev, [engineCode]: value }));
    },
    [],
  );

  const setClinicalErrorFor = useCallback(
    (engineCode: HealthOpsClinicalEngineCode, value: string) => {
      setClinicalErrors(prev => ({ ...prev, [engineCode]: value }));
    },
    [],
  );

  const setClinicalSessionFor = useCallback(
    (engineCode: HealthOpsClinicalEngineCode, session: any | null) => {
      setClinicalSessions(prev => ({ ...prev, [engineCode]: session }));
    },
    [],
  );

  const setClinicalMappedFor = useCallback(
    (engineCode: HealthOpsClinicalEngineCode, value: boolean | null) => {
      setClinicalEngineMapped(prev => ({ ...prev, [engineCode]: value }));
    },
    [],
  );

  const bootstrapMessagingSession = useCallback(
    async ({
      quiet = false,
      markRead = false,
    }: { quiet?: boolean; markRead?: boolean } = {}) => {
      if (!isHealthOpsSession || !cleanWorkflowSessionId) return;
      setMessagingLoading(true);
      try {
        const response = await startHealthOpsMessagingSession({
          workflowSessionId: cleanWorkflowSessionId,
          appointmentBookingId: cleanBookingId || undefined,
          metadata: {
            source: 'mobile_app',
            screen: 'HealthServiceSession',
          },
        });
        if (!response?.success) {
          if (Number(response?.status) === 404) {
            setMessagingEngineMapped(false);
            setMessagingError(
              'Secure messaging engine is not mapped to this workflow yet.',
            );
            return;
          }
          throw new Error(
            response?.message || 'Unable to prepare secure messaging.',
          );
        }
        const nextSession =
          response?.data?.messaging_session || response?.messaging_session;
        if (nextSession && typeof nextSession === 'object') {
          setMessagingSession(nextSession);
        }
        const fetchedSessionId = String(nextSession?.id || '').trim();
        if (fetchedSessionId) {
          const detail = await fetchHealthOpsMessagingSession(
            fetchedSessionId,
            {
              limit: 50,
              markRead,
            },
          );
          if (detail?.success) {
            const detailedSession =
              detail?.data?.messaging_session || detail?.messaging_session;
            if (detailedSession && typeof detailedSession === 'object') {
              setMessagingSession(detailedSession);
            }
            const rows = Array.isArray(detail?.data?.messages)
              ? detail.data.messages
              : Array.isArray(detail?.messages)
              ? detail.messages
              : [];
            setMessagingMessages(rows);
            setMessagingUnreadCount(
              Number(detail?.data?.unread_count || detail?.unread_count || 0),
            );
          }
        }
        setMessagingEngineMapped(true);
        setMessagingError('');
      } catch (error: any) {
        const message = error?.message || 'Unable to prepare secure messaging.';
        setMessagingError(message);
        if (!quiet) {
          Alert.alert('Secure messaging', message);
        }
      } finally {
        setMessagingLoading(false);
      }
    },
    [cleanBookingId, cleanWorkflowSessionId, isHealthOpsSession],
  );

  const refreshMessagingSession = useCallback(
    async ({
      quiet = false,
      markRead = false,
    }: { quiet?: boolean; markRead?: boolean } = {}) => {
      if (!isHealthOpsSession) return;
      if (!messagingSessionId) {
        await bootstrapMessagingSession({ quiet, markRead });
        return;
      }
      setMessagingLoading(true);
      try {
        const response = await fetchHealthOpsMessagingSession(
          messagingSessionId,
          {
            limit: 50,
            markRead,
          },
        );
        if (!response?.success) {
          throw new Error(
            response?.message || 'Unable to refresh secure messaging.',
          );
        }
        const nextSession =
          response?.data?.messaging_session || response?.messaging_session;
        if (nextSession && typeof nextSession === 'object') {
          setMessagingSession(nextSession);
        }
        const rows = Array.isArray(response?.data?.messages)
          ? response.data.messages
          : Array.isArray(response?.messages)
          ? response.messages
          : [];
        setMessagingMessages(rows);
        setMessagingUnreadCount(
          Number(response?.data?.unread_count || response?.unread_count || 0),
        );
        setMessagingEngineMapped(true);
        setMessagingError('');
      } catch (error: any) {
        const message = error?.message || 'Unable to refresh secure messaging.';
        setMessagingError(message);
        if (!quiet) {
          Alert.alert('Secure messaging', message);
        }
      } finally {
        setMessagingLoading(false);
      }
    },
    [bootstrapMessagingSession, isHealthOpsSession, messagingSessionId],
  );

  useEffect(() => {
    if (!isHealthOpsSession || !cleanWorkflowSessionId) return;
    bootstrapMessagingSession({ quiet: true, markRead: false }).catch(
      () => undefined,
    );
  }, [bootstrapMessagingSession, cleanWorkflowSessionId, isHealthOpsSession]);

  const completeMessagingStep = useCallback(
    async (stepKey: HealthOpsMessagingStepKey) => {
      if (!messagingSessionId) {
        Alert.alert('Secure messaging', 'Messaging session is not ready yet.');
        return;
      }
      setMessagingBusy(true);
      try {
        const response = await updateHealthOpsMessagingStep(
          messagingSessionId,
          stepKey,
          {
            source: 'mobile_app',
            completed_at: new Date().toISOString(),
          },
          true,
        );
        if (!response?.success) {
          throw new Error(
            response?.message || 'Unable to update messaging step.',
          );
        }
        const nextSession =
          response?.data?.messaging_session || response?.messaging_session;
        if (nextSession && typeof nextSession === 'object') {
          setMessagingSession(nextSession);
        }
        setMessagingError('');
      } catch (error: any) {
        Alert.alert(
          'Secure messaging',
          error?.message || 'Unable to update messaging step.',
        );
      } finally {
        setMessagingBusy(false);
      }
    },
    [messagingSessionId],
  );

  const sendMessage = useCallback(async () => {
    const body = String(messageDraft || '').trim();
    if (!body) {
      Alert.alert('Secure messaging', 'Enter a message before sending.');
      return;
    }
    if (!messagingSessionId) {
      Alert.alert('Secure messaging', 'Messaging session is not ready yet.');
      return;
    }
    setMessagingBusy(true);
    try {
      const response = await sendHealthOpsMessage(messagingSessionId, {
        messageType: 'text',
        body,
        metadata: {
          source: 'mobile_app',
        },
      });
      if (!response?.success) {
        throw new Error(response?.message || 'Unable to send secure message.');
      }
      const nextSession =
        response?.data?.messaging_session || response?.messaging_session;
      if (nextSession && typeof nextSession === 'object') {
        setMessagingSession(nextSession);
      }
      const row = response?.data?.message || response?.message;
      if (row && typeof row === 'object') {
        setMessagingMessages(prev => [...prev, row]);
      }
      setMessageDraft('');
      setMessagingError('');
    } catch (error: any) {
      Alert.alert(
        'Secure messaging',
        error?.message || 'Unable to send secure message.',
      );
    } finally {
      setMessagingBusy(false);
    }
  }, [messageDraft, messagingSessionId]);

  const endMessagingSession = useCallback(
    async (status: 'completed' | 'closed') => {
      if (!messagingSessionId) {
        Alert.alert('Secure messaging', 'Messaging session is not ready yet.');
        return;
      }
      setMessagingBusy(true);
      try {
        const response = await endHealthOpsMessagingSession(
          messagingSessionId,
          {
            status,
            summary:
              status === 'completed'
                ? 'Completed via mobile health service session screen.'
                : 'Closed via mobile health service session screen.',
            metadata: { source: 'mobile_app' },
          },
        );
        if (!response?.success) {
          throw new Error(
            response?.message || 'Unable to end secure messaging session.',
          );
        }
        const nextSession =
          response?.data?.messaging_session || response?.messaging_session;
        if (nextSession && typeof nextSession === 'object') {
          setMessagingSession(nextSession);
        }
        setMessagingError('');
      } catch (error: any) {
        Alert.alert(
          'Secure messaging',
          error?.message || 'Unable to end secure messaging session.',
        );
      } finally {
        setMessagingBusy(false);
      }
    },
    [messagingSessionId],
  );

  const bootstrapClinicalSession = useCallback(
    async (
      engineCode: HealthOpsClinicalEngineCode,
      { quiet = false }: { quiet?: boolean } = {},
    ) => {
      if (!isHealthOpsSession || !cleanWorkflowSessionId) return;
      setClinicalLoadingFor(engineCode, true);
      try {
        const response = await startHealthOpsClinicalSession({
          workflowSessionId: cleanWorkflowSessionId,
          engineCode,
          appointmentBookingId: cleanBookingId || undefined,
          metadata: {
            source: 'mobile_app',
            screen: 'HealthServiceSession',
          },
        });
        if (!response?.success) {
          if (Number(response?.status) === 404) {
            setClinicalMappedFor(engineCode, false);
            setClinicalErrorFor(
              engineCode,
              `${CLINICAL_ENGINE_META[engineCode].title} is not mapped to this workflow yet.`,
            );
            return;
          }
          throw new Error(
            response?.message ||
              `Unable to prepare ${CLINICAL_ENGINE_META[engineCode].title}.`,
          );
        }
        const nextSession =
          response?.data?.clinical_session || response?.clinical_session;
        if (nextSession && typeof nextSession === 'object') {
          setClinicalSessionFor(engineCode, nextSession);
        }
        setClinicalMappedFor(engineCode, true);
        setClinicalErrorFor(engineCode, '');
      } catch (error: any) {
        const message =
          error?.message ||
          `Unable to prepare ${CLINICAL_ENGINE_META[engineCode].title}.`;
        setClinicalErrorFor(engineCode, message);
        if (!quiet) {
          Alert.alert(CLINICAL_ENGINE_META[engineCode].title, message);
        }
      } finally {
        setClinicalLoadingFor(engineCode, false);
      }
    },
    [
      cleanBookingId,
      cleanWorkflowSessionId,
      isHealthOpsSession,
      setClinicalErrorFor,
      setClinicalLoadingFor,
      setClinicalMappedFor,
      setClinicalSessionFor,
    ],
  );

  const refreshClinicalSession = useCallback(
    async (
      engineCode: HealthOpsClinicalEngineCode,
      { quiet = false }: { quiet?: boolean } = {},
    ) => {
      if (!isHealthOpsSession) return;
      const clinicalSessionId = String(
        clinicalSessions[engineCode]?.id || '',
      ).trim();
      if (!clinicalSessionId) {
        await bootstrapClinicalSession(engineCode, { quiet });
        return;
      }
      setClinicalLoadingFor(engineCode, true);
      try {
        const response = await fetchHealthOpsClinicalSession(clinicalSessionId);
        if (!response?.success) {
          throw new Error(
            response?.message ||
              `Unable to refresh ${CLINICAL_ENGINE_META[engineCode].title}.`,
          );
        }
        const nextSession =
          response?.data?.clinical_session || response?.clinical_session;
        if (nextSession && typeof nextSession === 'object') {
          setClinicalSessionFor(engineCode, nextSession);
        }
        setClinicalMappedFor(engineCode, true);
        setClinicalErrorFor(engineCode, '');
      } catch (error: any) {
        const message =
          error?.message ||
          `Unable to refresh ${CLINICAL_ENGINE_META[engineCode].title}.`;
        setClinicalErrorFor(engineCode, message);
        if (!quiet) {
          Alert.alert(CLINICAL_ENGINE_META[engineCode].title, message);
        }
      } finally {
        setClinicalLoadingFor(engineCode, false);
      }
    },
    [
      bootstrapClinicalSession,
      clinicalSessions,
      isHealthOpsSession,
      setClinicalErrorFor,
      setClinicalLoadingFor,
      setClinicalMappedFor,
      setClinicalSessionFor,
    ],
  );

  useEffect(() => {
    if (!isHealthOpsSession || !cleanWorkflowSessionId) return;
    HEALTH_OPS_CLINICAL_ENGINE_CODES.forEach(engineCode => {
      bootstrapClinicalSession(engineCode, { quiet: true }).catch(
        () => undefined,
      );
    });
  }, [bootstrapClinicalSession, cleanWorkflowSessionId, isHealthOpsSession]);

  const completeClinicalStep = useCallback(
    async (engineCode: HealthOpsClinicalEngineCode, stepKey: string) => {
      const clinicalSessionId = String(
        clinicalSessions[engineCode]?.id || '',
      ).trim();
      if (!clinicalSessionId) {
        Alert.alert(
          CLINICAL_ENGINE_META[engineCode].title,
          'Clinical engine session is not ready yet.',
        );
        return;
      }
      setClinicalBusyFor(engineCode, true);
      try {
        const response = await updateHealthOpsClinicalStep(
          clinicalSessionId,
          stepKey,
          {
            isCompleted: true,
            payload: {
              source: 'mobile_app',
              completed_at: new Date().toISOString(),
            },
          },
        );
        if (!response?.success) {
          throw new Error(
            response?.message ||
              `Unable to update ${CLINICAL_ENGINE_META[engineCode].title} step.`,
          );
        }
        const nextSession =
          response?.data?.clinical_session || response?.clinical_session;
        if (nextSession && typeof nextSession === 'object') {
          setClinicalSessionFor(engineCode, nextSession);
        }
        setClinicalErrorFor(engineCode, '');
      } catch (error: any) {
        Alert.alert(
          CLINICAL_ENGINE_META[engineCode].title,
          error?.message || 'Unable to update clinical step.',
        );
      } finally {
        setClinicalBusyFor(engineCode, false);
      }
    },
    [
      clinicalSessions,
      setClinicalBusyFor,
      setClinicalErrorFor,
      setClinicalSessionFor,
    ],
  );

  const finishClinicalSession = useCallback(
    async (
      engineCode: HealthOpsClinicalEngineCode,
      status: 'completed' | 'cancelled',
    ) => {
      const clinicalSessionId = String(
        clinicalSessions[engineCode]?.id || '',
      ).trim();
      if (!clinicalSessionId) {
        Alert.alert(
          CLINICAL_ENGINE_META[engineCode].title,
          'Clinical engine session is not ready yet.',
        );
        return;
      }
      setClinicalBusyFor(engineCode, true);
      try {
        const response = await endHealthOpsClinicalSession(clinicalSessionId, {
          status,
          summary:
            status === 'completed'
              ? `Completed ${CLINICAL_ENGINE_META[engineCode].title} via mobile app.`
              : `Cancelled ${CLINICAL_ENGINE_META[engineCode].title} via mobile app.`,
          metadata: { source: 'mobile_app' },
        });
        if (!response?.success) {
          throw new Error(
            response?.message ||
              `Unable to finish ${CLINICAL_ENGINE_META[engineCode].title}.`,
          );
        }
        const nextSession =
          response?.data?.clinical_session || response?.clinical_session;
        if (nextSession && typeof nextSession === 'object') {
          setClinicalSessionFor(engineCode, nextSession);
        }
        setClinicalErrorFor(engineCode, '');
      } catch (error: any) {
        Alert.alert(
          CLINICAL_ENGINE_META[engineCode].title,
          error?.message || 'Unable to finish clinical engine session.',
        );
      } finally {
        setClinicalBusyFor(engineCode, false);
      }
    },
    [
      clinicalSessions,
      setClinicalBusyFor,
      setClinicalErrorFor,
      setClinicalSessionFor,
    ],
  );

  const bootstrapAdmissionSession = useCallback(
    async ({ quiet = false }: { quiet?: boolean } = {}) => {
      if (!isHealthOpsSession || !cleanWorkflowSessionId) return;
      setAdmissionLoading(true);
      try {
        const response = await startHealthOpsAdmissionSession({
          workflowSessionId: cleanWorkflowSessionId,
          appointmentBookingId: cleanBookingId || undefined,
          metadata: {
            source: 'mobile_app',
            screen: 'HealthServiceSession',
          },
        });
        if (!response?.success) {
          if (Number(response?.status) === 404) {
            setAdmissionEngineMapped(false);
            setAdmissionError(
              'Admission engine is not mapped to this workflow yet.',
            );
            return;
          }
          throw new Error(
            response?.message || 'Unable to prepare admission session.',
          );
        }
        const nextSession =
          response?.data?.admission_session || response?.admission_session;
        if (nextSession && typeof nextSession === 'object') {
          setAdmissionSession(nextSession);
          setAdmissionWardDraft(String(nextSession?.ward_name || ''));
          setAdmissionBedDraft(String(nextSession?.bed_code || ''));
        }
        setAdmissionEngineMapped(true);
        setAdmissionError('');
      } catch (error: any) {
        const message =
          error?.message || 'Unable to prepare admission session.';
        setAdmissionError(message);
        if (!quiet) {
          Alert.alert('Admission & bed', message);
        }
      } finally {
        setAdmissionLoading(false);
      }
    },
    [cleanBookingId, cleanWorkflowSessionId, isHealthOpsSession],
  );

  const refreshAdmissionSession = useCallback(
    async ({ quiet = false }: { quiet?: boolean } = {}) => {
      if (!isHealthOpsSession) return;
      if (!admissionSessionId) {
        await bootstrapAdmissionSession({ quiet });
        return;
      }
      setAdmissionLoading(true);
      try {
        const response = await fetchHealthOpsAdmissionSession(
          admissionSessionId,
        );
        if (!response?.success) {
          throw new Error(
            response?.message || 'Unable to refresh admission session.',
          );
        }
        const nextSession =
          response?.data?.admission_session || response?.admission_session;
        if (nextSession && typeof nextSession === 'object') {
          setAdmissionSession(nextSession);
          setAdmissionWardDraft(String(nextSession?.ward_name || ''));
          setAdmissionBedDraft(String(nextSession?.bed_code || ''));
        }
        setAdmissionEngineMapped(true);
        setAdmissionError('');
      } catch (error: any) {
        const message =
          error?.message || 'Unable to refresh admission session.';
        setAdmissionError(message);
        if (!quiet) {
          Alert.alert('Admission & bed', message);
        }
      } finally {
        setAdmissionLoading(false);
      }
    },
    [admissionSessionId, bootstrapAdmissionSession, isHealthOpsSession],
  );

  useEffect(() => {
    if (!isHealthOpsSession || !cleanWorkflowSessionId) return;
    bootstrapAdmissionSession({ quiet: true }).catch(() => undefined);
  }, [bootstrapAdmissionSession, cleanWorkflowSessionId, isHealthOpsSession]);

  const completeAdmissionStep = useCallback(
    async (stepKey: string) => {
      if (!admissionSessionId) {
        Alert.alert('Admission & bed', 'Admission session is not ready yet.');
        return;
      }
      setAdmissionBusy(true);
      try {
        const response = await updateHealthOpsAdmissionStep(
          admissionSessionId,
          stepKey,
          {
            isCompleted: true,
            payload: {
              ward_name: admissionWardDraft,
              bed_code: admissionBedDraft,
              source: 'mobile_app',
              completed_at: new Date().toISOString(),
            },
          },
        );
        if (!response?.success) {
          throw new Error(
            response?.message || 'Unable to update admission step.',
          );
        }
        const nextSession =
          response?.data?.admission_session || response?.admission_session;
        if (nextSession && typeof nextSession === 'object') {
          setAdmissionSession(nextSession);
          setAdmissionWardDraft(String(nextSession?.ward_name || ''));
          setAdmissionBedDraft(String(nextSession?.bed_code || ''));
        }
        setAdmissionError('');
      } catch (error: any) {
        Alert.alert(
          'Admission & bed',
          error?.message || 'Unable to update admission step.',
        );
      } finally {
        setAdmissionBusy(false);
      }
    },
    [admissionBedDraft, admissionSessionId, admissionWardDraft],
  );

  const finishAdmissionSession = useCallback(
    async (status: 'completed' | 'cancelled') => {
      if (!admissionSessionId) {
        Alert.alert('Admission & bed', 'Admission session is not ready yet.');
        return;
      }
      setAdmissionBusy(true);
      try {
        const response = await endHealthOpsAdmissionSession(
          admissionSessionId,
          {
            status,
            summary:
              status === 'completed'
                ? 'Admission completed via mobile health service session screen.'
                : 'Admission cancelled via mobile health service session screen.',
            metadata: {
              source: 'mobile_app',
            },
          },
        );
        if (!response?.success) {
          throw new Error(
            response?.message || 'Unable to end admission session.',
          );
        }
        const nextSession =
          response?.data?.admission_session || response?.admission_session;
        if (nextSession && typeof nextSession === 'object') {
          setAdmissionSession(nextSession);
          setAdmissionWardDraft(String(nextSession?.ward_name || ''));
          setAdmissionBedDraft(String(nextSession?.bed_code || ''));
        }
        setAdmissionError('');
      } catch (error: any) {
        Alert.alert(
          'Admission & bed',
          error?.message || 'Unable to end admission session.',
        );
      } finally {
        setAdmissionBusy(false);
      }
    },
    [admissionSessionId],
  );

  const bootstrapEmergencySession = useCallback(
    async ({ quiet = false }: { quiet?: boolean } = {}) => {
      if (!isHealthOpsSession || !cleanWorkflowSessionId) return;
      setEmergencyLoading(true);
      try {
        const response = await startHealthOpsEmergencySession({
          workflowSessionId: cleanWorkflowSessionId,
          appointmentBookingId: cleanBookingId || undefined,
          metadata: {
            source: 'mobile_app',
            screen: 'HealthServiceSession',
          },
        });
        if (!response?.success) {
          if (Number(response?.status) === 404) {
            setEmergencyEngineMapped(false);
            setEmergencyError(
              'Emergency dispatch engine is not mapped to this workflow yet.',
            );
            return;
          }
          throw new Error(
            response?.message ||
              'Unable to prepare emergency dispatch session.',
          );
        }
        const nextSession =
          response?.data?.emergency_session || response?.emergency_session;
        if (nextSession && typeof nextSession === 'object') {
          setEmergencySession(nextSession);
        }
        const events = Array.isArray(response?.data?.tracking_events)
          ? response.data.tracking_events
          : Array.isArray(response?.tracking_events)
          ? response.tracking_events
          : [];
        setEmergencyTrackingEvents(events);
        setEmergencyEngineMapped(true);
        setEmergencyError('');
      } catch (error: any) {
        const message =
          error?.message || 'Unable to prepare emergency dispatch session.';
        setEmergencyError(message);
        if (!quiet) {
          Alert.alert('Emergency dispatch', message);
        }
      } finally {
        setEmergencyLoading(false);
      }
    },
    [cleanBookingId, cleanWorkflowSessionId, isHealthOpsSession],
  );

  const refreshEmergencySession = useCallback(
    async ({ quiet = false }: { quiet?: boolean } = {}) => {
      if (!isHealthOpsSession) return;
      if (!emergencySessionId) {
        await bootstrapEmergencySession({ quiet });
        return;
      }
      setEmergencyLoading(true);
      try {
        const response = await fetchHealthOpsEmergencySession(
          emergencySessionId,
          60,
        );
        if (!response?.success) {
          throw new Error(
            response?.message ||
              'Unable to refresh emergency dispatch session.',
          );
        }
        const nextSession =
          response?.data?.emergency_session || response?.emergency_session;
        if (nextSession && typeof nextSession === 'object') {
          setEmergencySession(nextSession);
        }
        const events = Array.isArray(response?.data?.tracking_events)
          ? response.data.tracking_events
          : Array.isArray(response?.tracking_events)
          ? response.tracking_events
          : [];
        setEmergencyTrackingEvents(events);
        setEmergencyEngineMapped(true);
        setEmergencyError('');
      } catch (error: any) {
        const message =
          error?.message || 'Unable to refresh emergency dispatch session.';
        setEmergencyError(message);
        if (!quiet) {
          Alert.alert('Emergency dispatch', message);
        }
      } finally {
        setEmergencyLoading(false);
      }
    },
    [bootstrapEmergencySession, emergencySessionId, isHealthOpsSession],
  );

  useEffect(() => {
    if (!isHealthOpsSession || !cleanWorkflowSessionId) return;
    bootstrapEmergencySession({ quiet: true }).catch(() => undefined);
  }, [bootstrapEmergencySession, cleanWorkflowSessionId, isHealthOpsSession]);

  const completeEmergencyStep = useCallback(
    async (stepKey: string) => {
      if (!emergencySessionId) {
        Alert.alert(
          'Emergency dispatch',
          'Emergency session is not ready yet.',
        );
        return;
      }
      setEmergencyBusy(true);
      try {
        const response = await updateHealthOpsEmergencyStep(
          emergencySessionId,
          stepKey,
          {
            isCompleted: true,
            payload: {
              source: 'mobile_app',
              completed_at: new Date().toISOString(),
            },
          },
        );
        if (!response?.success) {
          throw new Error(
            response?.message || 'Unable to update emergency step.',
          );
        }
        const nextSession =
          response?.data?.emergency_session || response?.emergency_session;
        if (nextSession && typeof nextSession === 'object') {
          setEmergencySession(nextSession);
        }
        const events = Array.isArray(response?.data?.tracking_events)
          ? response.data.tracking_events
          : Array.isArray(response?.tracking_events)
          ? response.tracking_events
          : [];
        setEmergencyTrackingEvents(events);
        setEmergencyError('');
      } catch (error: any) {
        Alert.alert(
          'Emergency dispatch',
          error?.message || 'Unable to update emergency step.',
        );
      } finally {
        setEmergencyBusy(false);
      }
    },
    [emergencySessionId],
  );

  const sendEmergencyTrackingPing = useCallback(async () => {
    if (!emergencySessionId) {
      Alert.alert('Emergency dispatch', 'Emergency session is not ready yet.');
      return;
    }
    const etaValue = Number(String(emergencyEtaDraft || '').trim());
    setEmergencyBusy(true);
    try {
      const response = await updateHealthOpsEmergencyTracking(
        emergencySessionId,
        {
          ...(Number.isFinite(etaValue) && etaValue >= 0
            ? { etaMinutes: Math.floor(etaValue) }
            : {}),
          ...(emergencyNoteDraft.trim()
            ? { note: emergencyNoteDraft.trim() }
            : {}),
          status: emergencyStatus === 'dispatched' ? 'in_transit' : undefined,
          payload: {
            source: 'mobile_app',
            ping_at: new Date().toISOString(),
          },
        },
      );
      if (!response?.success) {
        throw new Error(
          response?.message || 'Unable to update emergency tracking.',
        );
      }
      const nextSession =
        response?.data?.emergency_session || response?.emergency_session;
      if (nextSession && typeof nextSession === 'object') {
        setEmergencySession(nextSession);
      }
      const events = Array.isArray(response?.data?.tracking_events)
        ? response.data.tracking_events
        : Array.isArray(response?.tracking_events)
        ? response.tracking_events
        : [];
      setEmergencyTrackingEvents(events);
      setEmergencyError('');
      setEmergencyNoteDraft('');
    } catch (error: any) {
      Alert.alert(
        'Emergency dispatch',
        error?.message || 'Unable to update emergency tracking.',
      );
    } finally {
      setEmergencyBusy(false);
    }
  }, [
    emergencyEtaDraft,
    emergencyNoteDraft,
    emergencySessionId,
    emergencyStatus,
  ]);

  const finishEmergencySession = useCallback(
    async (status: 'resolved' | 'cancelled') => {
      if (!emergencySessionId) {
        Alert.alert(
          'Emergency dispatch',
          'Emergency session is not ready yet.',
        );
        return;
      }
      setEmergencyBusy(true);
      try {
        const response = await endHealthOpsEmergencySession(
          emergencySessionId,
          {
            status,
            summary:
              status === 'resolved'
                ? 'Emergency dispatch resolved via mobile app.'
                : 'Emergency dispatch cancelled via mobile app.',
            metadata: {
              source: 'mobile_app',
            },
          },
        );
        if (!response?.success) {
          throw new Error(
            response?.message || 'Unable to end emergency dispatch session.',
          );
        }
        const nextSession =
          response?.data?.emergency_session || response?.emergency_session;
        if (nextSession && typeof nextSession === 'object') {
          setEmergencySession(nextSession);
        }
        const events = Array.isArray(response?.data?.tracking_events)
          ? response.data.tracking_events
          : Array.isArray(response?.tracking_events)
          ? response.tracking_events
          : [];
        setEmergencyTrackingEvents(events);
        setEmergencyError('');
      } catch (error: any) {
        Alert.alert(
          'Emergency dispatch',
          error?.message || 'Unable to end emergency dispatch session.',
        );
      } finally {
        setEmergencyBusy(false);
      }
    },
    [emergencySessionId],
  );

  const bootstrapPharmacySession = useCallback(
    async ({ quiet = false }: { quiet?: boolean } = {}) => {
      if (!isHealthOpsSession || !cleanWorkflowSessionId) return;
      setPharmacyLoading(true);
      try {
        const response = await startHealthOpsPharmacySession({
          workflowSessionId: cleanWorkflowSessionId,
          appointmentBookingId: cleanBookingId || undefined,
          metadata: {
            source: 'mobile_app',
            screen: 'HealthServiceSession',
          },
        });
        if (!response?.success) {
          if (Number(response?.status) === 404) {
            setPharmacyEngineMapped(false);
            setPharmacyError(
              'Pharmacy fulfillment engine is not mapped to this workflow yet.',
            );
            return;
          }
          throw new Error(
            response?.message ||
              'Unable to prepare pharmacy fulfillment session.',
          );
        }
        const nextSession =
          response?.data?.pharmacy_session || response?.pharmacy_session;
        if (nextSession && typeof nextSession === 'object') {
          setPharmacySession(nextSession);
        }
        const events = Array.isArray(response?.data?.tracking_events)
          ? response.data.tracking_events
          : Array.isArray(response?.tracking_events)
          ? response.tracking_events
          : [];
        setPharmacyTrackingEvents(events);
        setPharmacyEngineMapped(true);
        setPharmacyError('');
      } catch (error: any) {
        const message =
          error?.message || 'Unable to prepare pharmacy fulfillment session.';
        setPharmacyError(message);
        if (!quiet) {
          Alert.alert('Pharmacy fulfillment', message);
        }
      } finally {
        setPharmacyLoading(false);
      }
    },
    [cleanBookingId, cleanWorkflowSessionId, isHealthOpsSession],
  );

  const refreshPharmacySession = useCallback(
    async ({ quiet = false }: { quiet?: boolean } = {}) => {
      if (!isHealthOpsSession) return;
      if (!pharmacySessionId) {
        await bootstrapPharmacySession({ quiet });
        return;
      }
      setPharmacyLoading(true);
      try {
        const response = await fetchHealthOpsPharmacySession(
          pharmacySessionId,
          60,
        );
        if (!response?.success) {
          throw new Error(
            response?.message ||
              'Unable to refresh pharmacy fulfillment session.',
          );
        }
        const nextSession =
          response?.data?.pharmacy_session || response?.pharmacy_session;
        if (nextSession && typeof nextSession === 'object') {
          setPharmacySession(nextSession);
        }
        const events = Array.isArray(response?.data?.tracking_events)
          ? response.data.tracking_events
          : Array.isArray(response?.tracking_events)
          ? response.tracking_events
          : [];
        setPharmacyTrackingEvents(events);
        setPharmacyEngineMapped(true);
        setPharmacyError('');
      } catch (error: any) {
        const message =
          error?.message || 'Unable to refresh pharmacy fulfillment session.';
        setPharmacyError(message);
        if (!quiet) {
          Alert.alert('Pharmacy fulfillment', message);
        }
      } finally {
        setPharmacyLoading(false);
      }
    },
    [bootstrapPharmacySession, isHealthOpsSession, pharmacySessionId],
  );

  useEffect(() => {
    if (!isHealthOpsSession || !cleanWorkflowSessionId) return;
    bootstrapPharmacySession({ quiet: true }).catch(() => undefined);
  }, [bootstrapPharmacySession, cleanWorkflowSessionId, isHealthOpsSession]);

  const completePharmacyStep = useCallback(
    async (stepKey: string) => {
      if (!pharmacySessionId) {
        Alert.alert(
          'Pharmacy fulfillment',
          'Pharmacy session is not ready yet.',
        );
        return;
      }
      setPharmacyBusy(true);
      try {
        const response = await updateHealthOpsPharmacyStep(
          pharmacySessionId,
          stepKey,
          {
            isCompleted: true,
            payload: {
              source: 'mobile_app',
              completed_at: new Date().toISOString(),
            },
          },
        );
        if (!response?.success) {
          throw new Error(
            response?.message || 'Unable to update pharmacy step.',
          );
        }
        const nextSession =
          response?.data?.pharmacy_session || response?.pharmacy_session;
        if (nextSession && typeof nextSession === 'object') {
          setPharmacySession(nextSession);
        }
        const events = Array.isArray(response?.data?.tracking_events)
          ? response.data.tracking_events
          : Array.isArray(response?.tracking_events)
          ? response.tracking_events
          : [];
        setPharmacyTrackingEvents(events);
        setPharmacyError('');
      } catch (error: any) {
        Alert.alert(
          'Pharmacy fulfillment',
          error?.message || 'Unable to update pharmacy step.',
        );
      } finally {
        setPharmacyBusy(false);
      }
    },
    [pharmacySessionId],
  );

  const sendPharmacyTrackingPing = useCallback(async () => {
    if (!pharmacySessionId) {
      Alert.alert('Pharmacy fulfillment', 'Pharmacy session is not ready yet.');
      return;
    }
    const etaValue = Number(String(pharmacyEtaDraft || '').trim());
    setPharmacyBusy(true);
    try {
      const response = await updateHealthOpsPharmacyTracking(
        pharmacySessionId,
        {
          ...(Number.isFinite(etaValue) && etaValue >= 0
            ? { etaMinutes: Math.floor(etaValue) }
            : {}),
          ...(pharmacyNoteDraft.trim()
            ? { note: pharmacyNoteDraft.trim() }
            : {}),
          status:
            pharmacyStatus === 'inventory_confirmed'
              ? 'fulfillment_in_progress'
              : undefined,
          payload: {
            source: 'mobile_app',
            ping_at: new Date().toISOString(),
          },
        },
      );
      if (!response?.success) {
        throw new Error(
          response?.message || 'Unable to update pharmacy tracking.',
        );
      }
      const nextSession =
        response?.data?.pharmacy_session || response?.pharmacy_session;
      if (nextSession && typeof nextSession === 'object') {
        setPharmacySession(nextSession);
      }
      const events = Array.isArray(response?.data?.tracking_events)
        ? response.data.tracking_events
        : Array.isArray(response?.tracking_events)
        ? response.tracking_events
        : [];
      setPharmacyTrackingEvents(events);
      setPharmacyError('');
      setPharmacyNoteDraft('');
    } catch (error: any) {
      Alert.alert(
        'Pharmacy fulfillment',
        error?.message || 'Unable to update pharmacy tracking.',
      );
    } finally {
      setPharmacyBusy(false);
    }
  }, [pharmacyEtaDraft, pharmacyNoteDraft, pharmacySessionId, pharmacyStatus]);

  const finishPharmacySession = useCallback(
    async (status: 'completed' | 'cancelled') => {
      if (!pharmacySessionId) {
        Alert.alert(
          'Pharmacy fulfillment',
          'Pharmacy session is not ready yet.',
        );
        return;
      }
      setPharmacyBusy(true);
      try {
        const response = await endHealthOpsPharmacySession(pharmacySessionId, {
          status,
          summary:
            status === 'completed'
              ? 'Pharmacy fulfillment completed via mobile app.'
              : 'Pharmacy fulfillment cancelled via mobile app.',
          metadata: {
            source: 'mobile_app',
          },
        });
        if (!response?.success) {
          throw new Error(
            response?.message || 'Unable to end pharmacy session.',
          );
        }
        const nextSession =
          response?.data?.pharmacy_session || response?.pharmacy_session;
        if (nextSession && typeof nextSession === 'object') {
          setPharmacySession(nextSession);
        }
        const events = Array.isArray(response?.data?.tracking_events)
          ? response.data.tracking_events
          : Array.isArray(response?.tracking_events)
          ? response.tracking_events
          : [];
        setPharmacyTrackingEvents(events);
        setPharmacyError('');
      } catch (error: any) {
        Alert.alert(
          'Pharmacy fulfillment',
          error?.message || 'Unable to end pharmacy session.',
        );
      } finally {
        setPharmacyBusy(false);
      }
    },
    [pharmacySessionId],
  );

  const bootstrapBillingSession = useCallback(
    async ({ quiet = false }: { quiet?: boolean } = {}) => {
      if (!isHealthOpsSession || !cleanWorkflowSessionId) return;
      setBillingLoading(true);
      try {
        const response = await startHealthOpsBillingSession({
          workflowSessionId: cleanWorkflowSessionId,
          appointmentBookingId: cleanBookingId || undefined,
          metadata: {
            source: 'mobile_app',
            screen: 'HealthServiceSession',
          },
        });
        if (!response?.success) {
          if (Number(response?.status) === 404) {
            setBillingEngineMapped(false);
            setBillingError(
              'Payment & billing engine is not mapped to this workflow yet.',
            );
            return;
          }
          throw new Error(
            response?.message || 'Unable to prepare billing session.',
          );
        }
        const nextSession =
          response?.data?.billing_session || response?.billing_session;
        if (nextSession && typeof nextSession === 'object') {
          setBillingSession(nextSession);
        }
        setBillingEngineMapped(true);
        setBillingError('');
      } catch (error: any) {
        const message = error?.message || 'Unable to prepare billing session.';
        setBillingError(message);
        if (!quiet) {
          Alert.alert('Payment & billing', message);
        }
      } finally {
        setBillingLoading(false);
      }
    },
    [cleanBookingId, cleanWorkflowSessionId, isHealthOpsSession],
  );

  const refreshBillingSession = useCallback(
    async ({ quiet = false }: { quiet?: boolean } = {}) => {
      if (!isHealthOpsSession) return;
      if (!billingSessionId) {
        await bootstrapBillingSession({ quiet });
        return;
      }
      setBillingLoading(true);
      try {
        const response = await fetchHealthOpsBillingSession(billingSessionId);
        if (!response?.success) {
          throw new Error(
            response?.message || 'Unable to refresh billing session.',
          );
        }
        const nextSession =
          response?.data?.billing_session || response?.billing_session;
        if (nextSession && typeof nextSession === 'object') {
          setBillingSession(nextSession);
        }
        setBillingEngineMapped(true);
        setBillingError('');
      } catch (error: any) {
        const message = error?.message || 'Unable to refresh billing session.';
        setBillingError(message);
        if (!quiet) {
          Alert.alert('Payment & billing', message);
        }
      } finally {
        setBillingLoading(false);
      }
    },
    [billingSessionId, bootstrapBillingSession, isHealthOpsSession],
  );

  useEffect(() => {
    if (!isHealthOpsSession || !cleanWorkflowSessionId) return;
    bootstrapBillingSession({ quiet: true }).catch(() => undefined);
  }, [bootstrapBillingSession, cleanWorkflowSessionId, isHealthOpsSession]);

  const completeBillingStep = useCallback(
    async (stepKey: string) => {
      if (!billingSessionId) {
        Alert.alert('Payment & billing', 'Billing session is not ready yet.');
        return;
      }
      setBillingBusy(true);
      try {
        const nextPayload: Record<string, any> = {
          source: 'mobile_app',
          completed_at: new Date().toISOString(),
        };
        if (stepKey === 'select_payment_method') {
          nextPayload.payment_provider = 'kis_wallet';
          nextPayload.payment_method = 'wallet_balance';
        }
        if (stepKey === 'authorize_payment') {
          const payableMicro = Math.max(
            0,
            Math.floor(Number(billingSession?.payable_amount_micro || 0)),
          );
          nextPayload.payment_provider = 'kis_wallet';
          nextPayload.payment_method = 'wallet_balance';
          nextPayload.amount_paid_micro = payableMicro;
          nextPayload.amount_paid_kisc = toKisc(payableMicro);
        }
        const response = await updateHealthOpsBillingStep(
          billingSessionId,
          stepKey,
          {
            isCompleted: true,
            payload: nextPayload,
          },
        );
        if (!response?.success) {
          throw new Error(
            response?.message || 'Unable to update billing step.',
          );
        }
        const nextSession =
          response?.data?.billing_session || response?.billing_session;
        if (nextSession && typeof nextSession === 'object') {
          setBillingSession(nextSession);
        }
        setBillingError('');
      } catch (error: any) {
        Alert.alert(
          'Payment & billing',
          error?.message || 'Unable to update billing step.',
        );
      } finally {
        setBillingBusy(false);
      }
    },
    [billingSession?.payable_amount_micro, billingSessionId],
  );

  const finishBillingSession = useCallback(
    async (status: 'completed' | 'failed' | 'cancelled') => {
      if (!billingSessionId) {
        Alert.alert('Payment & billing', 'Billing session is not ready yet.');
        return;
      }
      setBillingBusy(true);
      try {
        const response = await endHealthOpsBillingSession(billingSessionId, {
          status,
          summary:
            status === 'completed'
              ? 'Billing completed via mobile app.'
              : status === 'failed'
              ? 'Billing marked failed via mobile app.'
              : 'Billing cancelled via mobile app.',
          metadata: {
            source: 'mobile_app',
          },
        });
        if (!response?.success) {
          throw new Error(
            response?.message || 'Unable to end billing session.',
          );
        }
        const nextSession =
          response?.data?.billing_session || response?.billing_session;
        if (nextSession && typeof nextSession === 'object') {
          setBillingSession(nextSession);
        }
        setBillingError('');
      } catch (error: any) {
        Alert.alert(
          'Payment & billing',
          error?.message || 'Unable to end billing session.',
        );
      } finally {
        setBillingBusy(false);
      }
    },
    [billingSessionId],
  );

  const bootstrapHomeLogisticsSession = useCallback(
    async ({ quiet = false }: { quiet?: boolean } = {}) => {
      if (!isHealthOpsSession || !cleanWorkflowSessionId) return;
      setHomeLogisticsLoading(true);
      try {
        const response = await startHealthOpsHomeLogisticsSession({
          workflowSessionId: cleanWorkflowSessionId,
          appointmentBookingId: cleanBookingId || undefined,
          metadata: {
            source: 'mobile_app',
            screen: 'HealthServiceSession',
          },
        });
        if (!response?.success) {
          if (Number(response?.status) === 404) {
            setHomeLogisticsEngineMapped(false);
            setHomeLogisticsError(
              'Home logistics engine is not mapped to this workflow yet.',
            );
            return;
          }
          throw new Error(
            response?.message || 'Unable to prepare home logistics session.',
          );
        }
        const nextSession =
          response?.data?.home_logistics_session ||
          response?.home_logistics_session;
        if (nextSession && typeof nextSession === 'object') {
          setHomeLogisticsSession(nextSession);
        }
        const events = Array.isArray(response?.data?.tracking_events)
          ? response.data.tracking_events
          : Array.isArray(response?.tracking_events)
          ? response.tracking_events
          : [];
        setHomeLogisticsTrackingEvents(events);
        setHomeLogisticsEngineMapped(true);
        setHomeLogisticsError('');
      } catch (error: any) {
        const message =
          error?.message || 'Unable to prepare home logistics session.';
        setHomeLogisticsError(message);
        if (!quiet) {
          Alert.alert('Home logistics', message);
        }
      } finally {
        setHomeLogisticsLoading(false);
      }
    },
    [cleanBookingId, cleanWorkflowSessionId, isHealthOpsSession],
  );

  const refreshHomeLogisticsSession = useCallback(
    async ({ quiet = false }: { quiet?: boolean } = {}) => {
      if (!isHealthOpsSession) return;
      if (!homeLogisticsSessionId) {
        await bootstrapHomeLogisticsSession({ quiet });
        return;
      }
      setHomeLogisticsLoading(true);
      try {
        const response = await fetchHealthOpsHomeLogisticsSession(
          homeLogisticsSessionId,
          60,
        );
        if (!response?.success) {
          throw new Error(
            response?.message || 'Unable to refresh home logistics session.',
          );
        }
        const nextSession =
          response?.data?.home_logistics_session ||
          response?.home_logistics_session;
        if (nextSession && typeof nextSession === 'object') {
          setHomeLogisticsSession(nextSession);
        }
        const events = Array.isArray(response?.data?.tracking_events)
          ? response.data.tracking_events
          : Array.isArray(response?.tracking_events)
          ? response.tracking_events
          : [];
        setHomeLogisticsTrackingEvents(events);
        setHomeLogisticsEngineMapped(true);
        setHomeLogisticsError('');
      } catch (error: any) {
        const message =
          error?.message || 'Unable to refresh home logistics session.';
        setHomeLogisticsError(message);
        if (!quiet) {
          Alert.alert('Home logistics', message);
        }
      } finally {
        setHomeLogisticsLoading(false);
      }
    },
    [bootstrapHomeLogisticsSession, homeLogisticsSessionId, isHealthOpsSession],
  );

  useEffect(() => {
    if (!isHealthOpsSession || !cleanWorkflowSessionId) return;
    bootstrapHomeLogisticsSession({ quiet: true }).catch(() => undefined);
  }, [
    bootstrapHomeLogisticsSession,
    cleanWorkflowSessionId,
    isHealthOpsSession,
  ]);

  const completeHomeLogisticsStep = useCallback(
    async (stepKey: string) => {
      if (!homeLogisticsSessionId) {
        Alert.alert(
          'Home logistics',
          'Home logistics session is not ready yet.',
        );
        return;
      }
      setHomeLogisticsBusy(true);
      try {
        const response = await updateHealthOpsHomeLogisticsStep(
          homeLogisticsSessionId,
          stepKey,
          {
            isCompleted: true,
            payload: {
              source: 'mobile_app',
              completed_at: new Date().toISOString(),
            },
          },
        );
        if (!response?.success) {
          throw new Error(
            response?.message || 'Unable to update home logistics step.',
          );
        }
        const nextSession =
          response?.data?.home_logistics_session ||
          response?.home_logistics_session;
        if (nextSession && typeof nextSession === 'object') {
          setHomeLogisticsSession(nextSession);
        }
        const events = Array.isArray(response?.data?.tracking_events)
          ? response.data.tracking_events
          : Array.isArray(response?.tracking_events)
          ? response.tracking_events
          : [];
        setHomeLogisticsTrackingEvents(events);
        setHomeLogisticsError('');
      } catch (error: any) {
        Alert.alert(
          'Home logistics',
          error?.message || 'Unable to update home logistics step.',
        );
      } finally {
        setHomeLogisticsBusy(false);
      }
    },
    [homeLogisticsSessionId],
  );

  const sendHomeLogisticsTrackingPing = useCallback(async () => {
    if (!homeLogisticsSessionId) {
      Alert.alert('Home logistics', 'Home logistics session is not ready yet.');
      return;
    }
    const etaValue = Number(String(homeLogisticsEtaDraft || '').trim());
    setHomeLogisticsBusy(true);
    try {
      const response = await updateHealthOpsHomeLogisticsTracking(
        homeLogisticsSessionId,
        {
          ...(Number.isFinite(etaValue) && etaValue >= 0
            ? { etaMinutes: Math.floor(etaValue) }
            : {}),
          ...(homeLogisticsNoteDraft.trim()
            ? { note: homeLogisticsNoteDraft.trim() }
            : {}),
          status:
            homeLogisticsStatus === 'route_assigned' ? 'in_transit' : undefined,
          payload: {
            source: 'mobile_app',
            ping_at: new Date().toISOString(),
          },
        },
      );
      if (!response?.success) {
        throw new Error(
          response?.message || 'Unable to update home logistics tracking.',
        );
      }
      const nextSession =
        response?.data?.home_logistics_session ||
        response?.home_logistics_session;
      if (nextSession && typeof nextSession === 'object') {
        setHomeLogisticsSession(nextSession);
      }
      const events = Array.isArray(response?.data?.tracking_events)
        ? response.data.tracking_events
        : Array.isArray(response?.tracking_events)
        ? response.tracking_events
        : [];
      setHomeLogisticsTrackingEvents(events);
      setHomeLogisticsError('');
      setHomeLogisticsNoteDraft('');
    } catch (error: any) {
      Alert.alert(
        'Home logistics',
        error?.message || 'Unable to update home logistics tracking.',
      );
    } finally {
      setHomeLogisticsBusy(false);
    }
  }, [
    homeLogisticsEtaDraft,
    homeLogisticsNoteDraft,
    homeLogisticsSessionId,
    homeLogisticsStatus,
  ]);

  const finishHomeLogisticsSession = useCallback(
    async (status: 'completed' | 'cancelled') => {
      if (!homeLogisticsSessionId) {
        Alert.alert(
          'Home logistics',
          'Home logistics session is not ready yet.',
        );
        return;
      }
      setHomeLogisticsBusy(true);
      try {
        const response = await endHealthOpsHomeLogisticsSession(
          homeLogisticsSessionId,
          {
            status,
            summary:
              status === 'completed'
                ? 'Home logistics completed via mobile app.'
                : 'Home logistics cancelled via mobile app.',
            metadata: {
              source: 'mobile_app',
            },
          },
        );
        if (!response?.success) {
          throw new Error(
            response?.message || 'Unable to end home logistics session.',
          );
        }
        const nextSession =
          response?.data?.home_logistics_session ||
          response?.home_logistics_session;
        if (nextSession && typeof nextSession === 'object') {
          setHomeLogisticsSession(nextSession);
        }
        const events = Array.isArray(response?.data?.tracking_events)
          ? response.data.tracking_events
          : Array.isArray(response?.tracking_events)
          ? response.tracking_events
          : [];
        setHomeLogisticsTrackingEvents(events);
        setHomeLogisticsError('');
      } catch (error: any) {
        Alert.alert(
          'Home logistics',
          error?.message || 'Unable to end home logistics session.',
        );
      } finally {
        setHomeLogisticsBusy(false);
      }
    },
    [homeLogisticsSessionId],
  );

  const bootstrapWellnessSession = useCallback(
    async ({ quiet = false }: { quiet?: boolean } = {}) => {
      if (!isHealthOpsSession || !cleanWorkflowSessionId) return;
      setWellnessLoading(true);
      try {
        const response = await startHealthOpsWellnessSession({
          workflowSessionId: cleanWorkflowSessionId,
          appointmentBookingId: cleanBookingId || undefined,
          programName: wellnessProgramDraft.trim() || undefined,
          metadata: {
            source: 'mobile_app',
            screen: 'HealthServiceSession',
          },
        });
        if (!response?.success) {
          if (Number(response?.status) === 404) {
            setWellnessEngineMapped(false);
            setWellnessError(
              'Wellness program engine is not mapped to this workflow yet.',
            );
            return;
          }
          throw new Error(
            response?.message || 'Unable to prepare wellness session.',
          );
        }
        const nextSession =
          response?.data?.wellness_session || response?.wellness_session;
        if (nextSession && typeof nextSession === 'object') {
          setWellnessSession(nextSession);
          setWellnessProgramDraft(String(nextSession?.program_name || ''));
        }
        const events = Array.isArray(response?.data?.activity_events)
          ? response.data.activity_events
          : Array.isArray(response?.activity_events)
          ? response.activity_events
          : [];
        setWellnessActivityEvents(events);
        setWellnessEngineMapped(true);
        setWellnessError('');
      } catch (error: any) {
        const message = error?.message || 'Unable to prepare wellness session.';
        setWellnessError(message);
        if (!quiet) {
          Alert.alert('Wellness program', message);
        }
      } finally {
        setWellnessLoading(false);
      }
    },
    [
      cleanBookingId,
      cleanWorkflowSessionId,
      isHealthOpsSession,
      wellnessProgramDraft,
    ],
  );

  const refreshWellnessSession = useCallback(
    async ({ quiet = false }: { quiet?: boolean } = {}) => {
      if (!isHealthOpsSession) return;
      if (!wellnessSessionId) {
        await bootstrapWellnessSession({ quiet });
        return;
      }
      setWellnessLoading(true);
      try {
        const response = await fetchHealthOpsWellnessSession(
          wellnessSessionId,
          60,
        );
        if (!response?.success) {
          throw new Error(
            response?.message || 'Unable to refresh wellness session.',
          );
        }
        const nextSession =
          response?.data?.wellness_session || response?.wellness_session;
        if (nextSession && typeof nextSession === 'object') {
          setWellnessSession(nextSession);
          setWellnessProgramDraft(String(nextSession?.program_name || ''));
        }
        const events = Array.isArray(response?.data?.activity_events)
          ? response.data.activity_events
          : Array.isArray(response?.activity_events)
          ? response.activity_events
          : [];
        setWellnessActivityEvents(events);
        setWellnessEngineMapped(true);
        setWellnessError('');
      } catch (error: any) {
        const message = error?.message || 'Unable to refresh wellness session.';
        setWellnessError(message);
        if (!quiet) {
          Alert.alert('Wellness program', message);
        }
      } finally {
        setWellnessLoading(false);
      }
    },
    [bootstrapWellnessSession, isHealthOpsSession, wellnessSessionId],
  );

  useEffect(() => {
    if (!isHealthOpsSession || !cleanWorkflowSessionId) return;
    bootstrapWellnessSession({ quiet: true }).catch(() => undefined);
  }, [bootstrapWellnessSession, cleanWorkflowSessionId, isHealthOpsSession]);

  const completeWellnessStep = useCallback(
    async (stepKey: string) => {
      if (!wellnessSessionId) {
        Alert.alert('Wellness program', 'Wellness session is not ready yet.');
        return;
      }
      setWellnessBusy(true);
      try {
        const completionValue = Number(
          String(wellnessCompletionDraft || '').trim(),
        );
        const response = await updateHealthOpsWellnessStep(
          wellnessSessionId,
          stepKey,
          {
            isCompleted: true,
            payload: {
              source: 'mobile_app',
              completed_at: new Date().toISOString(),
              program_name: wellnessProgramDraft.trim(),
              ...(Number.isFinite(completionValue)
                ? {
                    completion_percent: Math.max(
                      0,
                      Math.min(100, Math.floor(completionValue)),
                    ),
                  }
                : {}),
            },
          },
        );
        if (!response?.success) {
          throw new Error(
            response?.message || 'Unable to update wellness step.',
          );
        }
        const nextSession =
          response?.data?.wellness_session || response?.wellness_session;
        if (nextSession && typeof nextSession === 'object') {
          setWellnessSession(nextSession);
          setWellnessProgramDraft(String(nextSession?.program_name || ''));
        }
        const events = Array.isArray(response?.data?.activity_events)
          ? response.data.activity_events
          : Array.isArray(response?.activity_events)
          ? response.activity_events
          : [];
        setWellnessActivityEvents(events);
        setWellnessError('');
      } catch (error: any) {
        Alert.alert(
          'Wellness program',
          error?.message || 'Unable to update wellness step.',
        );
      } finally {
        setWellnessBusy(false);
      }
    },
    [wellnessCompletionDraft, wellnessProgramDraft, wellnessSessionId],
  );

  const sendWellnessActivityPing = useCallback(async () => {
    if (!wellnessSessionId) {
      Alert.alert('Wellness program', 'Wellness session is not ready yet.');
      return;
    }
    const completionValue = Number(
      String(wellnessCompletionDraft || '').trim(),
    );
    setWellnessBusy(true);
    try {
      const response = await updateHealthOpsWellnessActivity(
        wellnessSessionId,
        {
          eventType: 'manual_ping',
          note: wellnessNoteDraft.trim(),
          ...(Number.isFinite(completionValue)
            ? {
                completionPercent: Math.max(
                  0,
                  Math.min(100, Math.floor(completionValue)),
                ),
              }
            : {}),
          payload: {
            source: 'mobile_app',
            ping_at: new Date().toISOString(),
            program_name: wellnessProgramDraft.trim(),
          },
        },
      );
      if (!response?.success) {
        throw new Error(
          response?.message || 'Unable to update wellness activity.',
        );
      }
      const nextSession =
        response?.data?.wellness_session || response?.wellness_session;
      if (nextSession && typeof nextSession === 'object') {
        setWellnessSession(nextSession);
        setWellnessProgramDraft(String(nextSession?.program_name || ''));
      }
      const events = Array.isArray(response?.data?.activity_events)
        ? response.data.activity_events
        : Array.isArray(response?.activity_events)
        ? response.activity_events
        : [];
      setWellnessActivityEvents(events);
      setWellnessError('');
      setWellnessNoteDraft('');
    } catch (error: any) {
      Alert.alert(
        'Wellness program',
        error?.message || 'Unable to update wellness activity.',
      );
    } finally {
      setWellnessBusy(false);
    }
  }, [
    wellnessCompletionDraft,
    wellnessNoteDraft,
    wellnessProgramDraft,
    wellnessSessionId,
  ]);

  const finishWellnessSession = useCallback(
    async (status: 'completed' | 'cancelled') => {
      if (!wellnessSessionId) {
        Alert.alert('Wellness program', 'Wellness session is not ready yet.');
        return;
      }
      setWellnessBusy(true);
      try {
        const response = await endHealthOpsWellnessSession(wellnessSessionId, {
          status,
          summary:
            status === 'completed'
              ? 'Wellness program completed via mobile app.'
              : 'Wellness program cancelled via mobile app.',
          metadata: {
            source: 'mobile_app',
          },
        });
        if (!response?.success) {
          throw new Error(
            response?.message || 'Unable to end wellness session.',
          );
        }
        const nextSession =
          response?.data?.wellness_session || response?.wellness_session;
        if (nextSession && typeof nextSession === 'object') {
          setWellnessSession(nextSession);
          setWellnessProgramDraft(String(nextSession?.program_name || ''));
        }
        const events = Array.isArray(response?.data?.activity_events)
          ? response.data.activity_events
          : Array.isArray(response?.activity_events)
          ? response.activity_events
          : [];
        setWellnessActivityEvents(events);
        setWellnessError('');
      } catch (error: any) {
        Alert.alert(
          'Wellness program',
          error?.message || 'Unable to end wellness session.',
        );
      } finally {
        setWellnessBusy(false);
      }
    },
    [wellnessSessionId],
  );

  const bootstrapReminderSession = useCallback(
    async ({ quiet = false }: { quiet?: boolean } = {}) => {
      if (!isHealthOpsSession || !cleanWorkflowSessionId) return;
      setReminderLoading(true);
      try {
        const response = await startHealthOpsReminderSession({
          workflowSessionId: cleanWorkflowSessionId,
          appointmentBookingId: cleanBookingId || undefined,
          metadata: {
            source: 'mobile_app',
            screen: 'HealthServiceSession',
          },
        });
        if (!response?.success) {
          if (Number(response?.status) === 404) {
            setReminderEngineMapped(false);
            setReminderError(
              'Notification reminder engine is not mapped to this workflow yet.',
            );
            return;
          }
          throw new Error(
            response?.message || 'Unable to prepare reminder session.',
          );
        }
        const nextSession =
          response?.data?.notification_session ||
          response?.notification_session;
        if (nextSession && typeof nextSession === 'object') {
          setReminderSession(nextSession);
          setReminderNextRunDraft(String(nextSession?.next_run_at || ''));
        }
        const events = Array.isArray(response?.data?.delivery_events)
          ? response.data.delivery_events
          : Array.isArray(response?.delivery_events)
          ? response.delivery_events
          : [];
        setReminderDeliveryEvents(events);
        setReminderEngineMapped(true);
        setReminderError('');
      } catch (error: any) {
        const message = error?.message || 'Unable to prepare reminder session.';
        setReminderError(message);
        if (!quiet) {
          Alert.alert('Notification reminder', message);
        }
      } finally {
        setReminderLoading(false);
      }
    },
    [cleanBookingId, cleanWorkflowSessionId, isHealthOpsSession],
  );

  const refreshReminderSession = useCallback(
    async ({ quiet = false }: { quiet?: boolean } = {}) => {
      if (!isHealthOpsSession) return;
      if (!reminderSessionId) {
        await bootstrapReminderSession({ quiet });
        return;
      }
      setReminderLoading(true);
      try {
        const response = await fetchHealthOpsReminderSession(
          reminderSessionId,
          60,
        );
        if (!response?.success) {
          throw new Error(
            response?.message || 'Unable to refresh reminder session.',
          );
        }
        const nextSession =
          response?.data?.notification_session ||
          response?.notification_session;
        if (nextSession && typeof nextSession === 'object') {
          setReminderSession(nextSession);
          setReminderNextRunDraft(String(nextSession?.next_run_at || ''));
        }
        const events = Array.isArray(response?.data?.delivery_events)
          ? response.data.delivery_events
          : Array.isArray(response?.delivery_events)
          ? response.delivery_events
          : [];
        setReminderDeliveryEvents(events);
        setReminderEngineMapped(true);
        setReminderError('');
      } catch (error: any) {
        const message = error?.message || 'Unable to refresh reminder session.';
        setReminderError(message);
        if (!quiet) {
          Alert.alert('Notification reminder', message);
        }
      } finally {
        setReminderLoading(false);
      }
    },
    [bootstrapReminderSession, isHealthOpsSession, reminderSessionId],
  );

  useEffect(() => {
    if (!isHealthOpsSession || !cleanWorkflowSessionId) return;
    bootstrapReminderSession({ quiet: true }).catch(() => undefined);
  }, [bootstrapReminderSession, cleanWorkflowSessionId, isHealthOpsSession]);

  const completeReminderStep = useCallback(
    async (stepKey: string) => {
      if (!reminderSessionId) {
        Alert.alert(
          'Notification reminder',
          'Reminder session is not ready yet.',
        );
        return;
      }
      setReminderBusy(true);
      try {
        const response = await updateHealthOpsReminderStep(
          reminderSessionId,
          stepKey,
          {
            isCompleted: true,
            payload: {
              source: 'mobile_app',
              completed_at: new Date().toISOString(),
              ...(reminderNextRunDraft.trim()
                ? { next_run_at: reminderNextRunDraft.trim() }
                : {}),
            },
          },
        );
        if (!response?.success) {
          throw new Error(
            response?.message || 'Unable to update reminder step.',
          );
        }
        const nextSession =
          response?.data?.notification_session ||
          response?.notification_session;
        if (nextSession && typeof nextSession === 'object') {
          setReminderSession(nextSession);
          setReminderNextRunDraft(String(nextSession?.next_run_at || ''));
        }
        const events = Array.isArray(response?.data?.delivery_events)
          ? response.data.delivery_events
          : Array.isArray(response?.delivery_events)
          ? response.delivery_events
          : [];
        setReminderDeliveryEvents(events);
        setReminderError('');
      } catch (error: any) {
        Alert.alert(
          'Notification reminder',
          error?.message || 'Unable to update reminder step.',
        );
      } finally {
        setReminderBusy(false);
      }
    },
    [reminderNextRunDraft, reminderSessionId],
  );

  const sendReminderDeliveryPing = useCallback(async () => {
    if (!reminderSessionId) {
      Alert.alert(
        'Notification reminder',
        'Reminder session is not ready yet.',
      );
      return;
    }
    setReminderBusy(true);
    try {
      const response = await updateHealthOpsReminderDelivery(
        reminderSessionId,
        {
          ...(reminderNextRunDraft.trim()
            ? { nextRunAt: reminderNextRunDraft.trim() }
            : {}),
          sent: true,
          note: reminderNoteDraft.trim(),
          status: reminderStatus === 'configuring' ? 'active' : undefined,
          payload: {
            source: 'mobile_app',
            ping_at: new Date().toISOString(),
          },
        },
      );
      if (!response?.success) {
        throw new Error(
          response?.message || 'Unable to update reminder delivery.',
        );
      }
      const nextSession =
        response?.data?.notification_session || response?.notification_session;
      if (nextSession && typeof nextSession === 'object') {
        setReminderSession(nextSession);
        setReminderNextRunDraft(String(nextSession?.next_run_at || ''));
      }
      const events = Array.isArray(response?.data?.delivery_events)
        ? response.data.delivery_events
        : Array.isArray(response?.delivery_events)
        ? response.delivery_events
        : [];
      setReminderDeliveryEvents(events);
      setReminderError('');
      setReminderNoteDraft('');
    } catch (error: any) {
      Alert.alert(
        'Notification reminder',
        error?.message || 'Unable to update reminder delivery.',
      );
    } finally {
      setReminderBusy(false);
    }
  }, [
    reminderNextRunDraft,
    reminderNoteDraft,
    reminderSessionId,
    reminderStatus,
  ]);

  const finishReminderSession = useCallback(
    async (status: 'completed' | 'disabled' | 'cancelled') => {
      if (!reminderSessionId) {
        Alert.alert(
          'Notification reminder',
          'Reminder session is not ready yet.',
        );
        return;
      }
      setReminderBusy(true);
      try {
        const response = await endHealthOpsReminderSession(reminderSessionId, {
          status,
          summary:
            status === 'completed'
              ? 'Reminder automation completed via mobile app.'
              : status === 'disabled'
              ? 'Reminder automation disabled via mobile app.'
              : 'Reminder automation cancelled via mobile app.',
          metadata: {
            source: 'mobile_app',
          },
        });
        if (!response?.success) {
          throw new Error(
            response?.message || 'Unable to end reminder session.',
          );
        }
        const nextSession =
          response?.data?.notification_session ||
          response?.notification_session;
        if (nextSession && typeof nextSession === 'object') {
          setReminderSession(nextSession);
          setReminderNextRunDraft(String(nextSession?.next_run_at || ''));
        }
        const events = Array.isArray(response?.data?.delivery_events)
          ? response.data.delivery_events
          : Array.isArray(response?.delivery_events)
          ? response.delivery_events
          : [];
        setReminderDeliveryEvents(events);
        setReminderError('');
      } catch (error: any) {
        Alert.alert(
          'Notification reminder',
          error?.message || 'Unable to end reminder session.',
        );
      } finally {
        setReminderBusy(false);
      }
    },
    [reminderSessionId],
  );

  const loadAppointmentBooking = useCallback(async () => {
    if (!cleanBookingId) return;
    setAppointmentLoading(true);
    try {
      const response = await fetchAppointmentBooking(cleanBookingId);
      if (!response?.success) {
        throw new Error(
          response?.message || 'Unable to load appointment booking.',
        );
      }
      const booking =
        response?.data?.booking ||
        response?.booking ||
        response?.data?.appointment ||
        response?.appointment;
      if (booking && typeof booking === 'object') {
        setAppointmentBooking(booking);
      }
      setAppointmentError('');
    } catch (error: any) {
      setAppointmentError(
        error?.message || 'Unable to load appointment booking.',
      );
    } finally {
      setAppointmentLoading(false);
    }
  }, [cleanBookingId]);

  const openAppointmentICS = useCallback(async () => {
    if (!cleanBookingId) return;
    await Linking.openURL(ROUTES.healthOps.appointmentIcs(cleanBookingId));
  }, [cleanBookingId]);

  const rescheduleToNextAvailable = useCallback(async () => {
    if (!cleanBookingId || !cleanServiceId) return;
    setBusy(true);
    try {
      const response = await rescheduleAppointmentBooking(cleanBookingId, {
        service_id: cleanServiceId,
        date: dateKey,
        time: timeValue,
        strategy: 'next_available',
      });
      if (!response?.success) {
        throw new Error(
          response?.message || 'Unable to reschedule appointment.',
        );
      }
      const booking =
        response?.data?.booking ||
        response?.booking ||
        response?.data?.appointment ||
        response?.appointment;
      if (booking && typeof booking === 'object') {
        setAppointmentBooking(booking);
      }
      setAppointmentError('');
      Alert.alert(
        'Appointment',
        'Appointment reschedule request was submitted.',
      );
    } catch (error: any) {
      Alert.alert(
        'Appointment',
        error?.message || 'Unable to reschedule appointment.',
      );
    } finally {
      setBusy(false);
    }
  }, [cleanBookingId, cleanServiceId, dateKey, timeValue]);

  const cancelBooking = useCallback(async () => {
    if (!cleanBookingId) {
      Alert.alert('Appointment', 'Booking reference is unavailable.');
      return;
    }
    setBusy(true);
    try {
      const response = await cancelAppointmentBooking(
        cleanBookingId,
        'Cancelled by user',
      );
      if (!response?.success) {
        throw new Error(response?.message || 'Unable to cancel appointment.');
      }
      const booking = response?.data?.booking || response?.booking;
      if (booking && typeof booking === 'object') {
        setAppointmentBooking(booking);
      }
      setAppointmentError('');
      Alert.alert(
        'Appointment cancelled',
        'Your appointment has been cancelled.',
      );
    } catch (error: any) {
      Alert.alert(
        'Appointment',
        error?.message || 'Unable to cancel appointment.',
      );
    } finally {
      setBusy(false);
    }
  }, [cleanBookingId]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }}>
      <LinearGradient
        colors={[palette.gradientStart, palette.gradientEnd]}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{
            padding: spacing.lg,
            paddingBottom: spacing.xl,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <View style={{ flex: 1, paddingRight: spacing.sm }}>
              <Text style={{ ...typography.h1, color: palette.text }}>
                Service Session
              </Text>
              <Text
                style={{
                  ...typography.body,
                  color: palette.subtext,
                  marginTop: spacing.xs,
                }}
              >
                {institutionName || 'Institution'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={{
                borderWidth: 1,
                borderColor: palette.divider,
                borderRadius: 999,
                padding: spacing.xs,
              }}
            >
              <KISIcon name="close" size={20} color={palette.text} />
            </TouchableOpacity>
          </View>

          <View
            style={{
              marginTop: spacing.md,
              borderRadius: spacing.lg,
              padding: spacing.md,
              backgroundColor: palette.card,
              ...borders.card,
            }}
          >
            <Text style={{ ...typography.h3, color: palette.text }}>
              {serviceName}
            </Text>
            <Text
              style={{
                ...typography.body,
                color: palette.subtext,
                marginTop: spacing.xs,
              }}
            >
              {serviceDescription || 'No additional service details.'}
            </Text>
            <View style={{ marginTop: spacing.sm, gap: spacing.xs }}>
              {featureRows.map((feature, index) => (
                <Text
                  key={`feature-${index}`}
                  style={{ ...typography.body, color: palette.text }}
                >
                  • {feature}
                </Text>
              ))}
            </View>
            {cleanWorkflowSessionId ? (
              <Text
                style={{
                  ...typography.caption,
                  color: palette.subtext,
                  marginTop: spacing.sm,
                }}
              >
                Workflow session: {cleanWorkflowSessionId}
              </Text>
            ) : null}
            <Text
              style={{
                ...typography.caption,
                color: palette.subtext,
                marginTop: 4,
              }}
            >
              Session status:{' '}
              {(
                appointmentStatus ||
                activeEngineState ||
                'started'
              ).toUpperCase()}
            </Text>
            {ownerPreview ? (
              <Text
                style={{
                  ...typography.caption,
                  color: palette.accentPrimary,
                  marginTop: 4,
                }}
              >
                Owner preview mode: payment bypass is active.
              </Text>
            ) : null}
            {viewerWalletMicro !== null ? (
              <Text
                style={{
                  ...typography.caption,
                  color: palette.subtext,
                  marginTop: 4,
                }}
              >
                Remaining KISC: {toKisc(viewerWalletMicro)} KISC
              </Text>
            ) : null}
          </View>

          <View
            style={{
              marginTop: spacing.md,
              borderRadius: spacing.lg,
              padding: spacing.md,
              backgroundColor: palette.card,
              ...borders.card,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Text style={{ ...typography.h3, color: palette.text }}>
                Engine Workflow
              </Text>
              <Text style={{ ...typography.caption, color: palette.subtext }}>
                {activeEngineIndex + 1}/{effectiveEngineFlow.length}
              </Text>
            </View>
            {!isHealthOpsSession ? (
              <Text
                style={{
                  ...typography.caption,
                  color: palette.subtext,
                  marginTop: 4,
                }}
              >
                Workflow runtime is not linked for this session yet. This
                service is currently running legacy mode.
              </Text>
            ) : null}
            {!cleanWorkflowSessionId ? (
              <View style={{ marginTop: 4, gap: spacing.xs }}>
                <Text style={{ ...typography.caption, color: palette.subtext }}>
                  {workflowContextLoading
                    ? 'Preparing workflow context...'
                    : workflowContextError ||
                      'Workflow context is not linked yet for this service session.'}
                </Text>
                <KISButton
                  title={
                    workflowContextLoading
                      ? 'Preparing...'
                      : 'Retry Workflow Setup'
                  }
                  size="xs"
                  variant="outline"
                  onPress={() => {
                    resolveWorkflowContext().catch(() => undefined);
                  }}
                  disabled={
                    workflowContextLoading ||
                    !cleanServiceId ||
                    initialSessionSource !== 'health_ops'
                  }
                />
              </View>
            ) : null}
            <Text
              style={{
                ...typography.body,
                color: palette.subtext,
                marginTop: spacing.xs,
              }}
            >
              Current engine: {activeEngineMeta.title}
            </Text>
            {activeEngineState ? (
              <Text
                style={{
                  ...typography.caption,
                  color: palette.subtext,
                  marginTop: 2,
                }}
              >
                State: {activeEngineState.toUpperCase()}
                {activeEngineTimeLeft ? ` • ${activeEngineTimeLeft}` : ''}
              </Text>
            ) : null}
            {workflowRuntimeLoading ? (
              <Text
                style={{
                  ...typography.caption,
                  color: palette.subtext,
                  marginTop: 2,
                }}
              >
                Refreshing workflow...
              </Text>
            ) : null}

            <View
              style={{
                marginTop: spacing.sm,
                height: 8,
                borderRadius: 999,
                backgroundColor: `${palette.subtext}22`,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  width: `${flowProgressPercent}%`,
                  height: '100%',
                  backgroundColor: palette.accentPrimary,
                }}
              />
            </View>
            <Text
              style={{
                ...typography.caption,
                color: palette.subtext,
                marginTop: 6,
              }}
            >
              Progress: {flowProgressPercent}% complete
            </Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ marginTop: spacing.sm, gap: spacing.xs }}
            >
              {effectiveEngineFlow.map((engine, index) => {
                const isActive = engine.key === activeEngineKey;
                const runtimeRow = runtimeByFlowKey.get(engine.key);
                const state = String(runtimeRow?.state || '').toLowerCase();
                const isPassed =
                  state === 'completed' || index < activeEngineIndex;
                const isLocked = state === 'locked';
                const isExpired = state === 'expired';
                const timeLeft = formatSecondsRemaining(
                  runtimeRow?.remaining_seconds,
                );
                return (
                  <TouchableOpacity
                    key={engine.key}
                    onPress={() => {
                      openEngineFlow(engine.key);
                    }}
                    style={{
                      minWidth: 140,
                      borderRadius: 14,
                      borderWidth: 1,
                      opacity: isLocked ? 0.55 : 1,
                      borderColor: isActive
                        ? `${palette.accentPrimary}AA`
                        : isExpired
                        ? '#D64B4B'
                        : isPassed
                        ? `${palette.accentPrimary}55`
                        : palette.divider,
                      backgroundColor: isActive
                        ? `${palette.accentPrimary}20`
                        : isExpired
                        ? 'rgba(214, 75, 75, 0.14)'
                        : isPassed
                        ? `${palette.accentPrimary}12`
                        : palette.surface,
                      paddingHorizontal: spacing.sm,
                      paddingVertical: spacing.xs,
                      marginRight: spacing.xs,
                    }}
                  >
                    <View
                      style={{ flexDirection: 'row', alignItems: 'center' }}
                    >
                      <View
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 11,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor:
                            isActive || isPassed
                              ? `${palette.accentPrimary}33`
                              : `${palette.subtext}22`,
                        }}
                      >
                        <KISIcon
                          name={engine.icon}
                          size={12}
                          color={
                            isActive || isPassed
                              ? palette.accentPrimary
                              : palette.subtext
                          }
                        />
                      </View>
                      <Text
                        style={{
                          ...typography.label,
                          color: palette.text,
                          marginLeft: spacing.xs,
                        }}
                      >
                        {engine.title}
                      </Text>
                    </View>
                    <Text
                      style={{
                        ...typography.caption,
                        color: palette.subtext,
                        marginTop: 4,
                      }}
                      numberOfLines={1}
                    >
                      {isExpired
                        ? 'Expired'
                        : isLocked
                        ? 'Locked'
                        : timeLeft || engine.subtitle}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={{ marginTop: spacing.sm, gap: spacing.xs }}>
              <KISButton
                title="Previous Engine"
                variant="outline"
                onPress={goToPreviousEngine}
                disabled={!hasPreviousEngine}
              />
              <KISButton
                title={
                  hasNextEngine
                    ? `Next: ${
                        effectiveEngineFlow[activeEngineIndex + 1]?.title ||
                        'Engine'
                      }`
                    : 'Final Engine Reached'
                }
                onPress={goToNextEngine}
                disabled={!hasNextEngine || nextEngineBlocked}
              />
            </View>
          </View>

          {isHealthOpsSession && activeEngineKey === 'appointment' ? (
            <View
              style={{
                marginTop: spacing.md,
                borderRadius: spacing.lg,
                padding: spacing.md,
                backgroundColor: palette.card,
                ...borders.card,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Text style={{ ...typography.h3, color: palette.text }}>
                  Appointment Booking
                </Text>
                <View
                  style={{
                    borderRadius: 999,
                    backgroundColor: `${palette.accentPrimary}22`,
                    paddingHorizontal: spacing.sm,
                    paddingVertical: 4,
                  }}
                >
                  <Text
                    style={{
                      ...typography.caption,
                      color: palette.accentPrimary,
                    }}
                  >
                    Polling
                  </Text>
                </View>
              </View>
              <Text
                style={{
                  ...typography.caption,
                  color: palette.subtext,
                  marginTop: spacing.xs,
                }}
              >
                Booking reference: {cleanBookingId || 'Unavailable'}
              </Text>

              {appointmentLoading ? (
                <View
                  style={{
                    marginTop: spacing.sm,
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}
                >
                  <ActivityIndicator
                    size="small"
                    color={palette.accentPrimary}
                  />
                  <Text
                    style={{
                      ...typography.body,
                      color: palette.subtext,
                      marginLeft: spacing.xs,
                    }}
                  >
                    Loading appointment details...
                  </Text>
                </View>
              ) : null}

              {appointmentError ? (
                <Text
                  style={{
                    ...typography.caption,
                    color: '#EF4444',
                    marginTop: spacing.xs,
                  }}
                >
                  {appointmentError}
                </Text>
              ) : null}

              <View style={{ marginTop: spacing.sm, gap: spacing.xs }}>
                {bookingRows.map((row, index) => (
                  <Text
                    key={`booking-row-${index}`}
                    style={{ ...typography.body, color: palette.text }}
                  >
                    • {row}
                  </Text>
                ))}
              </View>

              <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
                <KISButton
                  title={
                    appointmentLoading ? 'Refreshing...' : 'Refresh Booking'
                  }
                  variant="outline"
                  onPress={() => {
                    loadAppointmentBooking().catch(() => undefined);
                  }}
                  disabled={appointmentLoading || busy || !cleanBookingId}
                />
                <KISButton
                  title="Download Calendar (.ics)"
                  variant="outline"
                  onPress={() => {
                    openAppointmentICS().catch(() => undefined);
                  }}
                  disabled={busy || !cleanBookingId}
                />
                {appointmentCanMutate ? (
                  <KISButton
                    title={
                      busy ? 'Processing...' : 'Reschedule (Next Available)'
                    }
                    onPress={() => {
                      rescheduleToNextAvailable().catch(() => undefined);
                    }}
                    disabled={busy || !cleanBookingId || !cleanServiceId}
                  />
                ) : null}
                {appointmentCanMutate ? (
                  <KISButton
                    title={busy ? 'Processing...' : 'Cancel Appointment'}
                    variant="outline"
                    onPress={() => {
                      cancelBooking().catch(() => undefined);
                    }}
                    disabled={busy || !cleanBookingId}
                  />
                ) : null}
              </View>
            </View>
          ) : null}

          {isHealthOpsSession && activeEngineKey === 'video' ? (
            <View
              style={{
                marginTop: spacing.md,
                borderRadius: spacing.lg,
                padding: spacing.md,
                backgroundColor: palette.card,
                ...borders.card,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Text style={{ ...typography.h3, color: palette.text }}>
                  Video Consultation Engine
                </Text>
                <View
                  style={{
                    borderRadius: 999,
                    backgroundColor: `${palette.accentPrimary}22`,
                    paddingHorizontal: spacing.sm,
                    paddingVertical: 4,
                  }}
                >
                  <Text
                    style={{
                      ...typography.caption,
                      color: palette.accentPrimary,
                    }}
                  >
                    Polling
                  </Text>
                </View>
              </View>

              {videoEngineMapped === false ? (
                <Text
                  style={{
                    ...typography.body,
                    color: palette.subtext,
                    marginTop: spacing.sm,
                  }}
                >
                  Video engine is not mapped to this service workflow yet.
                </Text>
              ) : null}

              {videoSession ? (
                <View style={{ marginTop: spacing.sm, gap: spacing.xs }}>
                  <Text style={{ ...typography.body, color: palette.text }}>
                    Room:{' '}
                    {String(videoSession?.room_code || '').trim() ||
                      'Unavailable'}
                  </Text>
                  <Text style={{ ...typography.body, color: palette.text }}>
                    Status: {(videoStatus || 'waiting_room').toUpperCase()}
                  </Text>
                  <Text
                    style={{ ...typography.caption, color: palette.subtext }}
                  >
                    Token expiry:{' '}
                    {toDateTimeLabel(videoSession?.token_expires_at)}
                  </Text>
                </View>
              ) : null}

              {videoLoading ? (
                <View
                  style={{
                    marginTop: spacing.sm,
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}
                >
                  <ActivityIndicator
                    size="small"
                    color={palette.accentPrimary}
                  />
                  <Text
                    style={{
                      ...typography.body,
                      color: palette.subtext,
                      marginLeft: spacing.xs,
                    }}
                  >
                    Loading video consultation...
                  </Text>
                </View>
              ) : null}

              {videoError ? (
                <Text
                  style={{
                    ...typography.caption,
                    color: '#EF4444',
                    marginTop: spacing.xs,
                  }}
                >
                  {videoError}
                </Text>
              ) : null}

              <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
                <KISButton
                  title={
                    videoLoading
                      ? 'Preparing...'
                      : videoSessionId
                      ? 'Refresh Video Session'
                      : 'Prepare Video Session'
                  }
                  variant="outline"
                  onPress={() => {
                    refreshVideoSession().catch(() => undefined);
                  }}
                  disabled={
                    videoLoading || videoBusy || !cleanWorkflowSessionId
                  }
                />
                <KISButton
                  title="Open Join Link"
                  variant="outline"
                  onPress={() => {
                    openVideoJoinLink().catch(() => undefined);
                  }}
                  disabled={!videoJoinUrl || videoBusy || videoLoading}
                />
              </View>

              {videoEngineMapped !== false ? (
                <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
                  {VIDEO_STEP_META.map(step => {
                    const isCompleted =
                      !!videoStepState?.[step.key]?.is_completed;
                    return (
                      <View
                        key={step.key}
                        style={{
                          borderWidth: 1,
                          borderColor: isCompleted
                            ? `${palette.accentPrimary}66`
                            : palette.divider,
                          borderRadius: 12,
                          padding: spacing.sm,
                          backgroundColor: isCompleted
                            ? `${palette.accentPrimary}11`
                            : palette.surface,
                          flexDirection: 'row',
                          alignItems: 'center',
                        }}
                      >
                        <View
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 14,
                            backgroundColor: isCompleted
                              ? `${palette.accentPrimary}33`
                              : `${palette.subtext}22`,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <KISIcon
                            name={step.icon}
                            size={14}
                            color={
                              isCompleted
                                ? palette.accentPrimary
                                : palette.subtext
                            }
                          />
                        </View>
                        <View style={{ flex: 1, marginLeft: spacing.sm }}>
                          <Text
                            style={{ ...typography.label, color: palette.text }}
                          >
                            {step.label}
                          </Text>
                          <Text
                            style={{
                              ...typography.caption,
                              color: palette.subtext,
                            }}
                          >
                            {step.subtitle}
                          </Text>
                        </View>
                        <KISButton
                          title={isCompleted ? 'Done' : 'Mark Done'}
                          size="xs"
                          variant={isCompleted ? 'outline' : 'primary'}
                          onPress={() => {
                            completeVideoStep(step.key).catch(() => undefined);
                          }}
                          disabled={
                            videoBusy ||
                            videoLoading ||
                            !videoSessionId ||
                            isCompleted ||
                            videoStatus === 'cancelled'
                          }
                        />
                      </View>
                    );
                  })}
                </View>
              ) : null}

              {videoEngineMapped !== false ? (
                <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ ...typography.h3, color: palette.text }}>
                      Video Content
                    </Text>
                    <KISButton
                      title={videoItemsLoading ? 'Loading...' : 'Reload'}
                      size="xs"
                      variant="outline"
                      onPress={() => {
                        loadVideoItems().catch(() => undefined);
                      }}
                      disabled={videoItemsLoading || !videoEngineSessionId}
                    />
                  </View>

                  {videoItemsError ? (
                    <Text style={{ ...typography.caption, color: '#EF4444' }}>
                      {videoItemsError}
                    </Text>
                  ) : null}

                  {videoItemsLoading ? (
                    <View
                      style={{ flexDirection: 'row', alignItems: 'center' }}
                    >
                      <ActivityIndicator
                        size="small"
                        color={palette.accentPrimary}
                      />
                      <Text
                        style={{
                          ...typography.caption,
                          color: palette.subtext,
                          marginLeft: spacing.xs,
                        }}
                      >
                        Loading video items...
                      </Text>
                    </View>
                  ) : null}

                  {videoItems.map((item: any) => {
                    const itemId = String(item?.id || '').trim();
                    const comments = Array.isArray(videoCommentsByItem[itemId])
                      ? videoCommentsByItem[itemId]
                      : [];
                    const commentDraft = String(
                      videoCommentDraftByItem[itemId] || '',
                    );
                    const itemCompleted = !!item?.viewer_completed;
                    return (
                      <View
                        key={itemId || String(item?.title || 'video-item')}
                        style={{
                          borderWidth: 1,
                          borderColor: itemCompleted
                            ? `${palette.accentPrimary}66`
                            : palette.divider,
                          borderRadius: 12,
                          padding: spacing.sm,
                          backgroundColor: itemCompleted
                            ? `${palette.accentPrimary}11`
                            : palette.surface,
                          gap: spacing.xs,
                        }}
                      >
                        <Text
                          style={{ ...typography.label, color: palette.text }}
                        >
                          {String(item?.title || 'Video item')}
                        </Text>
                        <Text
                          style={{
                            ...typography.caption,
                            color: palette.subtext,
                          }}
                        >
                          {String(item?.description || '') || 'No description'}
                        </Text>
                        <Text
                          style={{
                            ...typography.caption,
                            color: palette.subtext,
                          }}
                        >
                          {itemCompleted ? 'Completed' : 'Not completed'} •{' '}
                          {Number(item?.likes_count || 0)} likes •{' '}
                          {Number(item?.comments_count || 0)} comments
                        </Text>
                        <View
                          style={{
                            flexDirection: 'row',
                            flexWrap: 'wrap',
                            gap: spacing.xs,
                          }}
                        >
                          <KISButton
                            title={item?.viewer_liked ? 'Unlike' : 'Like'}
                            size="xs"
                            variant="outline"
                            onPress={() => {
                              toggleVideoItemLike(item).catch(() => undefined);
                            }}
                            disabled={!videoEngineSessionId}
                          />
                          <KISButton
                            title={itemCompleted ? 'Watched' : 'Mark Watched'}
                            size="xs"
                            onPress={() => {
                              markVideoItemWatched(
                                itemId,
                                Number(item?.duration_seconds || 0),
                              ).catch(() => undefined);
                            }}
                            disabled={!videoEngineSessionId || itemCompleted}
                          />
                          <KISButton
                            title="Load Comments"
                            size="xs"
                            variant="outline"
                            onPress={() => {
                              loadVideoItemComments(itemId).catch(
                                () => undefined,
                              );
                            }}
                            disabled={!videoEngineSessionId}
                          />
                        </View>

                        {comments.length > 0 ? (
                          <View style={{ gap: 4 }}>
                            {comments
                              .slice(-3)
                              .map((comment: any, commentIndex: number) => (
                                <Text
                                  key={String(
                                    comment?.id ||
                                      `${itemId}-comment-${commentIndex}`,
                                  )}
                                  style={{
                                    ...typography.caption,
                                    color: palette.subtext,
                                  }}
                                >
                                  {String(comment?.body || '')}
                                </Text>
                              ))}
                          </View>
                        ) : null}

                        <TextInput
                          value={commentDraft}
                          onChangeText={text =>
                            setVideoCommentDraftByItem(prev => ({
                              ...prev,
                              [itemId]: text,
                            }))
                          }
                          placeholder="Write comment"
                          placeholderTextColor={palette.subtext}
                          style={{
                            borderWidth: 1,
                            borderColor: palette.divider,
                            borderRadius: 10,
                            color: palette.text,
                            paddingHorizontal: spacing.sm,
                            paddingVertical: spacing.xs,
                            backgroundColor: palette.cardAccent,
                          }}
                        />
                        <KISButton
                          title="Post Comment"
                          size="xs"
                          variant="outline"
                          onPress={() => {
                            addVideoItemComment(itemId).catch(() => undefined);
                          }}
                          disabled={
                            !videoEngineSessionId || !commentDraft.trim()
                          }
                        />
                      </View>
                    );
                  })}

                  {!videoItemsLoading && videoItems.length === 0 ? (
                    <Text
                      style={{ ...typography.caption, color: palette.subtext }}
                    >
                      No video content has been added for this engine yet.
                    </Text>
                  ) : null}
                </View>
              ) : null}

              {videoEngineMapped !== false ? (
                <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
                  <KISButton
                    title={
                      videoBusy ? 'Processing...' : 'Complete Video Session'
                    }
                    onPress={() => {
                      endVideoSession('completed').catch(() => undefined);
                    }}
                    disabled={
                      videoBusy ||
                      videoLoading ||
                      !videoSessionId ||
                      videoStatus === 'completed' ||
                      videoStatus === 'cancelled'
                    }
                  />
                  <KISButton
                    title={videoBusy ? 'Processing...' : 'Cancel Video Session'}
                    variant="outline"
                    onPress={() => {
                      endVideoSession('cancelled').catch(() => undefined);
                    }}
                    disabled={
                      videoBusy ||
                      videoLoading ||
                      !videoSessionId ||
                      videoStatus === 'completed' ||
                      videoStatus === 'cancelled'
                    }
                  />
                </View>
              ) : null}
            </View>
          ) : null}

          {isHealthOpsSession && activeEngineKey === 'messaging' ? (
            <View
              style={{
                marginTop: spacing.md,
                borderRadius: spacing.lg,
                padding: spacing.md,
                backgroundColor: palette.card,
                ...borders.card,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Text style={{ ...typography.h3, color: palette.text }}>
                  Secure Messaging Engine
                </Text>
                <View
                  style={{
                    borderRadius: 999,
                    backgroundColor: `${palette.accentPrimary}22`,
                    paddingHorizontal: spacing.sm,
                    paddingVertical: 4,
                  }}
                >
                  <Text
                    style={{
                      ...typography.caption,
                      color: palette.accentPrimary,
                    }}
                  >
                    Polling
                  </Text>
                </View>
              </View>

              {messagingEngineMapped === false ? (
                <Text
                  style={{
                    ...typography.body,
                    color: palette.subtext,
                    marginTop: spacing.sm,
                  }}
                >
                  Secure messaging engine is not mapped to this service workflow
                  yet.
                </Text>
              ) : null}

              {messagingSession ? (
                <View style={{ marginTop: spacing.sm, gap: spacing.xs }}>
                  <Text style={{ ...typography.body, color: palette.text }}>
                    Thread:{' '}
                    {String(messagingSession?.thread_code || '').trim() ||
                      'Unavailable'}
                  </Text>
                  <Text style={{ ...typography.body, color: palette.text }}>
                    Status: {(messagingStatus || 'waiting').toUpperCase()}
                  </Text>
                  <Text
                    style={{ ...typography.caption, color: palette.subtext }}
                  >
                    Unread messages: {messagingUnreadCount}
                  </Text>
                </View>
              ) : null}

              {messagingLoading ? (
                <View
                  style={{
                    marginTop: spacing.sm,
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}
                >
                  <ActivityIndicator
                    size="small"
                    color={palette.accentPrimary}
                  />
                  <Text
                    style={{
                      ...typography.body,
                      color: palette.subtext,
                      marginLeft: spacing.xs,
                    }}
                  >
                    Loading secure messaging...
                  </Text>
                </View>
              ) : null}

              {messagingError ? (
                <Text
                  style={{
                    ...typography.caption,
                    color: '#EF4444',
                    marginTop: spacing.xs,
                  }}
                >
                  {messagingError}
                </Text>
              ) : null}

              <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
                <KISButton
                  title={
                    messagingLoading
                      ? 'Preparing...'
                      : messagingSessionId
                      ? 'Refresh Messaging'
                      : 'Prepare Messaging'
                  }
                  variant="outline"
                  onPress={() => {
                    refreshMessagingSession({ markRead: false }).catch(
                      () => undefined,
                    );
                  }}
                  disabled={
                    messagingLoading || messagingBusy || !cleanWorkflowSessionId
                  }
                />
                <KISButton
                  title="Mark Messages Read"
                  variant="outline"
                  onPress={() => {
                    refreshMessagingSession({ markRead: true }).catch(
                      () => undefined,
                    );
                  }}
                  disabled={
                    messagingLoading || messagingBusy || !messagingSessionId
                  }
                />
              </View>

              {latestMessages.length ? (
                <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
                  {latestMessages.map((row: any) => (
                    <View
                      key={String(
                        row?.id ||
                          `${row?.created_at || ''}-${row?.body || ''}`,
                      )}
                      style={{
                        borderWidth: 1,
                        borderColor: palette.divider,
                        borderRadius: 12,
                        padding: spacing.sm,
                        backgroundColor: palette.surface,
                      }}
                    >
                      <Text
                        style={{
                          ...typography.caption,
                          color: palette.subtext,
                        }}
                      >
                        {String(row?.message_type || 'text').toUpperCase()} ·{' '}
                        {toMessageTime(row?.created_at || row?.delivered_at)}
                      </Text>
                      <Text
                        style={{
                          ...typography.body,
                          color: palette.text,
                          marginTop: 4,
                        }}
                      >
                        {String(row?.body || '').trim() || 'Attachment message'}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {messagingEngineMapped !== false ? (
                <View style={{ marginTop: spacing.md }}>
                  <TextInput
                    value={messageDraft}
                    onChangeText={setMessageDraft}
                    editable={
                      !messagingBusy && !messagingLoading && !messagingIsClosed
                    }
                    placeholder="Type a secure message..."
                    placeholderTextColor={palette.subtext}
                    style={{
                      borderWidth: 1,
                      borderColor: palette.divider,
                      borderRadius: 12,
                      paddingHorizontal: spacing.sm,
                      paddingVertical: spacing.sm,
                      color: palette.text,
                      backgroundColor: palette.surface,
                    }}
                  />
                  <View style={{ marginTop: spacing.xs }}>
                    <KISButton
                      title={messagingBusy ? 'Sending...' : 'Send Message'}
                      onPress={() => {
                        sendMessage().catch(() => undefined);
                      }}
                      disabled={
                        messagingBusy ||
                        messagingLoading ||
                        !messagingSessionId ||
                        messagingIsClosed
                      }
                    />
                  </View>
                </View>
              ) : null}

              {messagingEngineMapped !== false ? (
                <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
                  {MESSAGING_STEP_META.map(step => {
                    const isCompleted =
                      !!messagingStepState?.[step.key]?.is_completed;
                    return (
                      <View
                        key={step.key}
                        style={{
                          borderWidth: 1,
                          borderColor: isCompleted
                            ? `${palette.accentPrimary}66`
                            : palette.divider,
                          borderRadius: 12,
                          padding: spacing.sm,
                          backgroundColor: isCompleted
                            ? `${palette.accentPrimary}11`
                            : palette.surface,
                          flexDirection: 'row',
                          alignItems: 'center',
                        }}
                      >
                        <View
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 14,
                            backgroundColor: isCompleted
                              ? `${palette.accentPrimary}33`
                              : `${palette.subtext}22`,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <KISIcon
                            name={step.icon}
                            size={14}
                            color={
                              isCompleted
                                ? palette.accentPrimary
                                : palette.subtext
                            }
                          />
                        </View>
                        <View style={{ flex: 1, marginLeft: spacing.sm }}>
                          <Text
                            style={{ ...typography.label, color: palette.text }}
                          >
                            {step.label}
                          </Text>
                          <Text
                            style={{
                              ...typography.caption,
                              color: palette.subtext,
                            }}
                          >
                            {step.subtitle}
                          </Text>
                        </View>
                        <KISButton
                          title={isCompleted ? 'Done' : 'Mark Done'}
                          size="xs"
                          variant={isCompleted ? 'outline' : 'primary'}
                          onPress={() => {
                            completeMessagingStep(step.key).catch(
                              () => undefined,
                            );
                          }}
                          disabled={
                            messagingBusy ||
                            messagingLoading ||
                            !messagingSessionId ||
                            isCompleted ||
                            messagingIsClosed
                          }
                        />
                      </View>
                    );
                  })}
                </View>
              ) : null}

              {messagingEngineMapped !== false ? (
                <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
                  <KISButton
                    title={
                      messagingBusy
                        ? 'Processing...'
                        : 'Complete Messaging Session'
                    }
                    onPress={() => {
                      endMessagingSession('completed').catch(() => undefined);
                    }}
                    disabled={
                      messagingBusy ||
                      messagingLoading ||
                      !messagingSessionId ||
                      messagingIsClosed
                    }
                  />
                  <KISButton
                    title={
                      messagingBusy
                        ? 'Processing...'
                        : 'Close Messaging Session'
                    }
                    variant="outline"
                    onPress={() => {
                      endMessagingSession('closed').catch(() => undefined);
                    }}
                    disabled={
                      messagingBusy ||
                      messagingLoading ||
                      !messagingSessionId ||
                      messagingIsClosed
                    }
                  />
                </View>
              ) : null}
            </View>
          ) : null}

          {isHealthOpsSession && activeEngineKey === 'clinical' ? (
            <View
              style={{
                marginTop: spacing.md,
                borderRadius: spacing.lg,
                padding: spacing.md,
                backgroundColor: palette.card,
                ...borders.card,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Text style={{ ...typography.h3, color: palette.text }}>
                  Clinical Engines
                </Text>
                <View
                  style={{
                    borderRadius: 999,
                    backgroundColor: `${palette.accentPrimary}22`,
                    paddingHorizontal: spacing.sm,
                    paddingVertical: 4,
                  }}
                >
                  <Text
                    style={{
                      ...typography.caption,
                      color: palette.accentPrimary,
                    }}
                  >
                    Polling
                  </Text>
                </View>
              </View>

              <View style={{ marginTop: spacing.md, gap: spacing.md }}>
                {HEALTH_OPS_CLINICAL_ENGINE_CODES.map(engineCode => {
                  const session = clinicalSessions[engineCode];
                  const clinicalSessionRef = String(session?.id || '').trim();
                  const statusText = String(session?.status || '')
                    .trim()
                    .toLowerCase();
                  const stepState =
                    session?.step_state &&
                    typeof session.step_state === 'object' &&
                    !Array.isArray(session.step_state)
                      ? session.step_state
                      : {};
                  const mapped = clinicalEngineMapped[engineCode];
                  const engineTitle = CLINICAL_ENGINE_META[engineCode].title;
                  const engineSubtitle =
                    CLINICAL_ENGINE_META[engineCode].subtitle;
                  const stepKeys = Object.keys(stepState).length
                    ? Object.keys(stepState)
                    : [...HEALTH_OPS_CLINICAL_STEP_META[engineCode]];
                  const isClosed =
                    statusText === 'completed' || statusText === 'cancelled';

                  return (
                    <View
                      key={engineCode}
                      style={{
                        borderWidth: 1,
                        borderColor: palette.divider,
                        borderRadius: 14,
                        padding: spacing.sm,
                        backgroundColor: palette.surface,
                      }}
                    >
                      <View
                        style={{ flexDirection: 'row', alignItems: 'center' }}
                      >
                        <View
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 16,
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: `${palette.accentPrimary}22`,
                          }}
                        >
                          <KISIcon
                            name={CLINICAL_ENGINE_META[engineCode].icon}
                            size={16}
                            color={palette.accentPrimary}
                          />
                        </View>
                        <View style={{ flex: 1, marginLeft: spacing.sm }}>
                          <Text
                            style={{ ...typography.label, color: palette.text }}
                          >
                            {engineTitle}
                          </Text>
                          <Text
                            style={{
                              ...typography.caption,
                              color: palette.subtext,
                            }}
                          >
                            {engineSubtitle}
                          </Text>
                        </View>
                      </View>

                      {mapped === false ? (
                        <Text
                          style={{
                            ...typography.caption,
                            color: palette.subtext,
                            marginTop: spacing.xs,
                          }}
                        >
                          {engineTitle} is not mapped to this workflow yet.
                        </Text>
                      ) : null}

                      {session ? (
                        <View style={{ marginTop: spacing.xs, gap: 2 }}>
                          <Text
                            style={{
                              ...typography.caption,
                              color: palette.subtext,
                            }}
                          >
                            Session: {clinicalSessionRef || 'Unavailable'}
                          </Text>
                          <Text
                            style={{
                              ...typography.caption,
                              color: palette.subtext,
                            }}
                          >
                            Status: {(statusText || 'waiting').toUpperCase()}
                          </Text>
                        </View>
                      ) : null}

                      {clinicalLoading[engineCode] ? (
                        <View
                          style={{
                            marginTop: spacing.sm,
                            flexDirection: 'row',
                            alignItems: 'center',
                          }}
                        >
                          <ActivityIndicator
                            size="small"
                            color={palette.accentPrimary}
                          />
                          <Text
                            style={{
                              ...typography.caption,
                              color: palette.subtext,
                              marginLeft: spacing.xs,
                            }}
                          >
                            Loading {engineTitle.toLowerCase()}...
                          </Text>
                        </View>
                      ) : null}

                      {clinicalErrors[engineCode] ? (
                        <Text
                          style={{
                            ...typography.caption,
                            color: '#EF4444',
                            marginTop: spacing.xs,
                          }}
                        >
                          {clinicalErrors[engineCode]}
                        </Text>
                      ) : null}

                      <View style={{ marginTop: spacing.sm, gap: spacing.xs }}>
                        <KISButton
                          title={
                            clinicalLoading[engineCode]
                              ? 'Preparing...'
                              : clinicalSessionRef
                              ? 'Refresh Engine'
                              : 'Prepare Engine'
                          }
                          variant="outline"
                          onPress={() => {
                            refreshClinicalSession(engineCode).catch(
                              () => undefined,
                            );
                          }}
                          disabled={
                            clinicalLoading[engineCode] ||
                            clinicalBusy[engineCode] ||
                            !cleanWorkflowSessionId
                          }
                        />
                      </View>

                      {mapped !== false ? (
                        <View
                          style={{ marginTop: spacing.sm, gap: spacing.xs }}
                        >
                          {stepKeys.map(stepKey => {
                            const isCompleted =
                              !!stepState?.[stepKey]?.is_completed;
                            return (
                              <View
                                key={`${engineCode}-${stepKey}`}
                                style={{
                                  borderWidth: 1,
                                  borderColor: isCompleted
                                    ? `${palette.accentPrimary}66`
                                    : palette.divider,
                                  borderRadius: 12,
                                  padding: spacing.sm,
                                  backgroundColor: isCompleted
                                    ? `${palette.accentPrimary}11`
                                    : palette.surface,
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                }}
                              >
                                <View style={{ flex: 1 }}>
                                  <Text
                                    style={{
                                      ...typography.label,
                                      color: palette.text,
                                    }}
                                  >
                                    {toStepLabel(stepKey)}
                                  </Text>
                                </View>
                                <KISButton
                                  title={isCompleted ? 'Done' : 'Mark Done'}
                                  size="xs"
                                  variant={isCompleted ? 'outline' : 'primary'}
                                  onPress={() => {
                                    completeClinicalStep(
                                      engineCode,
                                      stepKey,
                                    ).catch(() => undefined);
                                  }}
                                  disabled={
                                    clinicalBusy[engineCode] ||
                                    clinicalLoading[engineCode] ||
                                    !clinicalSessionRef ||
                                    isCompleted ||
                                    isClosed
                                  }
                                />
                              </View>
                            );
                          })}
                        </View>
                      ) : null}

                      {mapped !== false ? (
                        <View
                          style={{ marginTop: spacing.sm, gap: spacing.xs }}
                        >
                          <KISButton
                            title={
                              clinicalBusy[engineCode]
                                ? 'Processing...'
                                : 'Complete Engine'
                            }
                            onPress={() => {
                              finishClinicalSession(
                                engineCode,
                                'completed',
                              ).catch(() => undefined);
                            }}
                            disabled={
                              clinicalBusy[engineCode] ||
                              clinicalLoading[engineCode] ||
                              !clinicalSessionRef ||
                              isClosed
                            }
                          />
                          <KISButton
                            title={
                              clinicalBusy[engineCode]
                                ? 'Processing...'
                                : 'Cancel Engine'
                            }
                            variant="outline"
                            onPress={() => {
                              finishClinicalSession(
                                engineCode,
                                'cancelled',
                              ).catch(() => undefined);
                            }}
                            disabled={
                              clinicalBusy[engineCode] ||
                              clinicalLoading[engineCode] ||
                              !clinicalSessionRef ||
                              isClosed
                            }
                          />
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </View>
          ) : null}

          {isHealthOpsSession && activeEngineKey === 'admission' ? (
            <View
              style={{
                marginTop: spacing.md,
                borderRadius: spacing.lg,
                padding: spacing.md,
                backgroundColor: palette.card,
                ...borders.card,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Text style={{ ...typography.h3, color: palette.text }}>
                  Admission & Bed Engine
                </Text>
                <View
                  style={{
                    borderRadius: 999,
                    backgroundColor: `${palette.accentPrimary}22`,
                    paddingHorizontal: spacing.sm,
                    paddingVertical: 4,
                  }}
                >
                  <Text
                    style={{
                      ...typography.caption,
                      color: palette.accentPrimary,
                    }}
                  >
                    Polling
                  </Text>
                </View>
              </View>

              {admissionEngineMapped === false ? (
                <Text
                  style={{
                    ...typography.body,
                    color: palette.subtext,
                    marginTop: spacing.sm,
                  }}
                >
                  Admission engine is not mapped to this service workflow yet.
                </Text>
              ) : null}

              {admissionSession ? (
                <View style={{ marginTop: spacing.sm, gap: spacing.xs }}>
                  <Text style={{ ...typography.body, color: palette.text }}>
                    Status: {(admissionStatus || 'waiting').toUpperCase()}
                  </Text>
                  <Text
                    style={{ ...typography.caption, color: palette.subtext }}
                  >
                    Ward:{' '}
                    {String(admissionSession?.ward_name || '').trim() ||
                      'Not assigned'}
                  </Text>
                  <Text
                    style={{ ...typography.caption, color: palette.subtext }}
                  >
                    Bed:{' '}
                    {String(admissionSession?.bed_code || '').trim() ||
                      'Not assigned'}
                  </Text>
                </View>
              ) : null}

              {admissionLoading ? (
                <View
                  style={{
                    marginTop: spacing.sm,
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}
                >
                  <ActivityIndicator
                    size="small"
                    color={palette.accentPrimary}
                  />
                  <Text
                    style={{
                      ...typography.body,
                      color: palette.subtext,
                      marginLeft: spacing.xs,
                    }}
                  >
                    Loading admission session...
                  </Text>
                </View>
              ) : null}

              {admissionError ? (
                <Text
                  style={{
                    ...typography.caption,
                    color: '#EF4444',
                    marginTop: spacing.xs,
                  }}
                >
                  {admissionError}
                </Text>
              ) : null}

              <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
                <KISButton
                  title={
                    admissionLoading
                      ? 'Preparing...'
                      : admissionSessionId
                      ? 'Refresh Admission'
                      : 'Prepare Admission'
                  }
                  variant="outline"
                  onPress={() => {
                    refreshAdmissionSession().catch(() => undefined);
                  }}
                  disabled={
                    admissionLoading || admissionBusy || !cleanWorkflowSessionId
                  }
                />
              </View>

              {admissionEngineMapped !== false ? (
                <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
                  <TextInput
                    value={admissionWardDraft}
                    onChangeText={setAdmissionWardDraft}
                    editable={
                      !admissionBusy && !admissionLoading && !admissionIsClosed
                    }
                    placeholder="Ward name"
                    placeholderTextColor={palette.subtext}
                    style={{
                      borderWidth: 1,
                      borderColor: palette.divider,
                      borderRadius: 12,
                      paddingHorizontal: spacing.sm,
                      paddingVertical: spacing.sm,
                      color: palette.text,
                      backgroundColor: palette.surface,
                    }}
                  />
                  <TextInput
                    value={admissionBedDraft}
                    onChangeText={setAdmissionBedDraft}
                    editable={
                      !admissionBusy && !admissionLoading && !admissionIsClosed
                    }
                    placeholder="Bed code"
                    placeholderTextColor={palette.subtext}
                    style={{
                      borderWidth: 1,
                      borderColor: palette.divider,
                      borderRadius: 12,
                      paddingHorizontal: spacing.sm,
                      paddingVertical: spacing.sm,
                      color: palette.text,
                      backgroundColor: palette.surface,
                    }}
                  />
                </View>
              ) : null}

              {admissionEngineMapped !== false ? (
                <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
                  {(Object.keys(admissionStepState).length
                    ? Object.keys(admissionStepState)
                    : [...HEALTH_OPS_ADMISSION_STEP_KEYS]
                  ).map(stepKey => {
                    const isCompleted =
                      !!admissionStepState?.[stepKey]?.is_completed;
                    const meta = ADMISSION_STEP_META.find(
                      row => row.key === stepKey,
                    );
                    return (
                      <View
                        key={`admission-step-${stepKey}`}
                        style={{
                          borderWidth: 1,
                          borderColor: isCompleted
                            ? `${palette.accentPrimary}66`
                            : palette.divider,
                          borderRadius: 12,
                          padding: spacing.sm,
                          backgroundColor: isCompleted
                            ? `${palette.accentPrimary}11`
                            : palette.surface,
                          flexDirection: 'row',
                          alignItems: 'center',
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text
                            style={{ ...typography.label, color: palette.text }}
                          >
                            {meta?.label || toStepLabel(stepKey)}
                          </Text>
                          <Text
                            style={{
                              ...typography.caption,
                              color: palette.subtext,
                            }}
                          >
                            {meta?.subtitle ||
                              'Complete this admission workflow step.'}
                          </Text>
                        </View>
                        <KISButton
                          title={isCompleted ? 'Done' : 'Mark Done'}
                          size="xs"
                          variant={isCompleted ? 'outline' : 'primary'}
                          onPress={() => {
                            completeAdmissionStep(stepKey).catch(
                              () => undefined,
                            );
                          }}
                          disabled={
                            admissionBusy ||
                            admissionLoading ||
                            !admissionSessionId ||
                            isCompleted ||
                            admissionIsClosed
                          }
                        />
                      </View>
                    );
                  })}
                </View>
              ) : null}

              {admissionEngineMapped !== false ? (
                <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
                  <KISButton
                    title={
                      admissionBusy ? 'Processing...' : 'Complete Admission'
                    }
                    onPress={() => {
                      finishAdmissionSession('completed').catch(
                        () => undefined,
                      );
                    }}
                    disabled={
                      admissionBusy ||
                      admissionLoading ||
                      !admissionSessionId ||
                      admissionIsClosed
                    }
                  />
                  <KISButton
                    title={admissionBusy ? 'Processing...' : 'Cancel Admission'}
                    variant="outline"
                    onPress={() => {
                      finishAdmissionSession('cancelled').catch(
                        () => undefined,
                      );
                    }}
                    disabled={
                      admissionBusy ||
                      admissionLoading ||
                      !admissionSessionId ||
                      admissionIsClosed
                    }
                  />
                </View>
              ) : null}
            </View>
          ) : null}

          {isHealthOpsSession && activeEngineKey === 'emergency' ? (
            <View
              style={{
                marginTop: spacing.md,
                borderRadius: spacing.lg,
                padding: spacing.md,
                backgroundColor: palette.card,
                ...borders.card,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Text style={{ ...typography.h3, color: palette.text }}>
                  Emergency Dispatch Engine
                </Text>
                <View
                  style={{
                    borderRadius: 999,
                    backgroundColor: `${palette.accentPrimary}22`,
                    paddingHorizontal: spacing.sm,
                    paddingVertical: 4,
                  }}
                >
                  <Text
                    style={{
                      ...typography.caption,
                      color: palette.accentPrimary,
                    }}
                  >
                    Polling
                  </Text>
                </View>
              </View>

              {emergencyEngineMapped === false ? (
                <Text
                  style={{
                    ...typography.body,
                    color: palette.subtext,
                    marginTop: spacing.sm,
                  }}
                >
                  Emergency dispatch engine is not mapped to this service
                  workflow yet.
                </Text>
              ) : null}

              {emergencySession ? (
                <View style={{ marginTop: spacing.sm, gap: spacing.xs }}>
                  <Text style={{ ...typography.body, color: palette.text }}>
                    Dispatch:{' '}
                    {String(emergencySession?.dispatch_code || '').trim() ||
                      'Unavailable'}
                  </Text>
                  <Text style={{ ...typography.body, color: palette.text }}>
                    Status: {(emergencyStatus || 'waiting').toUpperCase()}
                  </Text>
                  <Text
                    style={{ ...typography.caption, color: palette.subtext }}
                  >
                    ETA:{' '}
                    {Number.isFinite(
                      Number(emergencySession?.current_eta_minutes),
                    )
                      ? `${Number(emergencySession.current_eta_minutes)} min`
                      : 'Not set'}
                  </Text>
                </View>
              ) : null}

              {emergencyLoading ? (
                <View
                  style={{
                    marginTop: spacing.sm,
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}
                >
                  <ActivityIndicator
                    size="small"
                    color={palette.accentPrimary}
                  />
                  <Text
                    style={{
                      ...typography.body,
                      color: palette.subtext,
                      marginLeft: spacing.xs,
                    }}
                  >
                    Loading emergency dispatch...
                  </Text>
                </View>
              ) : null}

              {emergencyError ? (
                <Text
                  style={{
                    ...typography.caption,
                    color: '#EF4444',
                    marginTop: spacing.xs,
                  }}
                >
                  {emergencyError}
                </Text>
              ) : null}

              <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
                <KISButton
                  title={
                    emergencyLoading
                      ? 'Preparing...'
                      : emergencySessionId
                      ? 'Refresh Emergency'
                      : 'Prepare Emergency'
                  }
                  variant="outline"
                  onPress={() => {
                    refreshEmergencySession().catch(() => undefined);
                  }}
                  disabled={
                    emergencyLoading || emergencyBusy || !cleanWorkflowSessionId
                  }
                />
              </View>

              {emergencyEngineMapped !== false ? (
                <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
                  {(Object.keys(emergencyStepState).length
                    ? Object.keys(emergencyStepState)
                    : [...HEALTH_OPS_EMERGENCY_STEP_KEYS]
                  ).map(stepKey => {
                    const isCompleted =
                      !!emergencyStepState?.[stepKey]?.is_completed;
                    const meta = EMERGENCY_STEP_META.find(
                      row => row.key === stepKey,
                    );
                    return (
                      <View
                        key={`emergency-step-${stepKey}`}
                        style={{
                          borderWidth: 1,
                          borderColor: isCompleted
                            ? `${palette.accentPrimary}66`
                            : palette.divider,
                          borderRadius: 12,
                          padding: spacing.sm,
                          backgroundColor: isCompleted
                            ? `${palette.accentPrimary}11`
                            : palette.surface,
                          flexDirection: 'row',
                          alignItems: 'center',
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text
                            style={{ ...typography.label, color: palette.text }}
                          >
                            {meta?.label || toStepLabel(stepKey)}
                          </Text>
                          <Text
                            style={{
                              ...typography.caption,
                              color: palette.subtext,
                            }}
                          >
                            {meta?.subtitle ||
                              'Complete this emergency workflow step.'}
                          </Text>
                        </View>
                        <KISButton
                          title={isCompleted ? 'Done' : 'Mark Done'}
                          size="xs"
                          variant={isCompleted ? 'outline' : 'primary'}
                          onPress={() => {
                            completeEmergencyStep(stepKey).catch(
                              () => undefined,
                            );
                          }}
                          disabled={
                            emergencyBusy ||
                            emergencyLoading ||
                            !emergencySessionId ||
                            isCompleted ||
                            emergencyIsClosed
                          }
                        />
                      </View>
                    );
                  })}
                </View>
              ) : null}

              {emergencyEngineMapped !== false ? (
                <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
                  <TextInput
                    value={emergencyEtaDraft}
                    onChangeText={setEmergencyEtaDraft}
                    editable={
                      !emergencyBusy && !emergencyLoading && !emergencyIsClosed
                    }
                    placeholder="ETA minutes (optional)"
                    placeholderTextColor={palette.subtext}
                    keyboardType="numeric"
                    style={{
                      borderWidth: 1,
                      borderColor: palette.divider,
                      borderRadius: 12,
                      paddingHorizontal: spacing.sm,
                      paddingVertical: spacing.sm,
                      color: palette.text,
                      backgroundColor: palette.surface,
                    }}
                  />
                  <TextInput
                    value={emergencyNoteDraft}
                    onChangeText={setEmergencyNoteDraft}
                    editable={
                      !emergencyBusy && !emergencyLoading && !emergencyIsClosed
                    }
                    placeholder="Tracking note"
                    placeholderTextColor={palette.subtext}
                    style={{
                      borderWidth: 1,
                      borderColor: palette.divider,
                      borderRadius: 12,
                      paddingHorizontal: spacing.sm,
                      paddingVertical: spacing.sm,
                      color: palette.text,
                      backgroundColor: palette.surface,
                    }}
                  />
                  <KISButton
                    title={emergencyBusy ? 'Sending...' : 'Send Tracking Ping'}
                    onPress={() => {
                      sendEmergencyTrackingPing().catch(() => undefined);
                    }}
                    disabled={
                      emergencyBusy ||
                      emergencyLoading ||
                      !emergencySessionId ||
                      emergencyIsClosed
                    }
                  />
                </View>
              ) : null}

              {recentEmergencyEvents.length ? (
                <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
                  {recentEmergencyEvents.map((event: any, idx: number) => (
                    <View
                      key={`emergency-event-${idx}-${String(
                        event?.timestamp || '',
                      )}`}
                      style={{
                        borderWidth: 1,
                        borderColor: palette.divider,
                        borderRadius: 12,
                        padding: spacing.sm,
                        backgroundColor: palette.surface,
                      }}
                    >
                      <Text
                        style={{
                          ...typography.caption,
                          color: palette.subtext,
                        }}
                      >
                        {String(event?.type || 'update').toUpperCase()} ·{' '}
                        {toDateTimeLabel(event?.timestamp)}
                      </Text>
                      <Text
                        style={{
                          ...typography.caption,
                          color: palette.subtext,
                          marginTop: 2,
                        }}
                      >
                        {String(event?.status || '').toUpperCase() || 'UNKNOWN'}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {emergencyEngineMapped !== false ? (
                <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
                  <KISButton
                    title={
                      emergencyBusy ? 'Processing...' : 'Resolve Emergency'
                    }
                    onPress={() => {
                      finishEmergencySession('resolved').catch(() => undefined);
                    }}
                    disabled={
                      emergencyBusy ||
                      emergencyLoading ||
                      !emergencySessionId ||
                      emergencyIsClosed
                    }
                  />
                  <KISButton
                    title={emergencyBusy ? 'Processing...' : 'Cancel Emergency'}
                    variant="outline"
                    onPress={() => {
                      finishEmergencySession('cancelled').catch(
                        () => undefined,
                      );
                    }}
                    disabled={
                      emergencyBusy ||
                      emergencyLoading ||
                      !emergencySessionId ||
                      emergencyIsClosed
                    }
                  />
                </View>
              ) : null}
            </View>
          ) : null}

          {isHealthOpsSession && activeEngineKey === 'pharmacy' ? (
            <View
              style={{
                marginTop: spacing.md,
                borderRadius: spacing.lg,
                padding: spacing.md,
                backgroundColor: palette.card,
                ...borders.card,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Text style={{ ...typography.h3, color: palette.text }}>
                  Pharmacy & Fulfillment Engine
                </Text>
                <View
                  style={{
                    borderRadius: 999,
                    backgroundColor: `${palette.accentPrimary}22`,
                    paddingHorizontal: spacing.sm,
                    paddingVertical: 4,
                  }}
                >
                  <Text
                    style={{
                      ...typography.caption,
                      color: palette.accentPrimary,
                    }}
                  >
                    Polling
                  </Text>
                </View>
              </View>

              {pharmacyEngineMapped === false ? (
                <Text
                  style={{
                    ...typography.body,
                    color: palette.subtext,
                    marginTop: spacing.sm,
                  }}
                >
                  Pharmacy fulfillment engine is not mapped to this service
                  workflow yet.
                </Text>
              ) : null}

              {pharmacySession ? (
                <View style={{ marginTop: spacing.sm, gap: spacing.xs }}>
                  <Text style={{ ...typography.body, color: palette.text }}>
                    Status: {(pharmacyStatus || 'waiting').toUpperCase()}
                  </Text>
                  <Text
                    style={{ ...typography.caption, color: palette.subtext }}
                  >
                    Delivery mode:{' '}
                    {String(pharmacySession?.delivery_mode || '').trim() ||
                      'Not set'}
                  </Text>
                  <Text
                    style={{ ...typography.caption, color: palette.subtext }}
                  >
                    Payment ref:{' '}
                    {String(pharmacySession?.payment_reference || '').trim() ||
                      'Not set'}
                  </Text>
                </View>
              ) : null}

              {pharmacyLoading ? (
                <View
                  style={{
                    marginTop: spacing.sm,
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}
                >
                  <ActivityIndicator
                    size="small"
                    color={palette.accentPrimary}
                  />
                  <Text
                    style={{
                      ...typography.body,
                      color: palette.subtext,
                      marginLeft: spacing.xs,
                    }}
                  >
                    Loading pharmacy fulfillment...
                  </Text>
                </View>
              ) : null}

              {pharmacyError ? (
                <Text
                  style={{
                    ...typography.caption,
                    color: '#EF4444',
                    marginTop: spacing.xs,
                  }}
                >
                  {pharmacyError}
                </Text>
              ) : null}

              <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
                <KISButton
                  title={
                    pharmacyLoading
                      ? 'Preparing...'
                      : pharmacySessionId
                      ? 'Refresh Pharmacy'
                      : 'Prepare Pharmacy'
                  }
                  variant="outline"
                  onPress={() => {
                    refreshPharmacySession().catch(() => undefined);
                  }}
                  disabled={
                    pharmacyLoading || pharmacyBusy || !cleanWorkflowSessionId
                  }
                />
              </View>

              {pharmacyEngineMapped !== false ? (
                <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
                  {(Object.keys(pharmacyStepState).length
                    ? Object.keys(pharmacyStepState)
                    : [...HEALTH_OPS_PHARMACY_STEP_KEYS]
                  ).map(stepKey => {
                    const isCompleted =
                      !!pharmacyStepState?.[stepKey]?.is_completed;
                    const meta = PHARMACY_STEP_META.find(
                      row => row.key === stepKey,
                    );
                    return (
                      <View
                        key={`pharmacy-step-${stepKey}`}
                        style={{
                          borderWidth: 1,
                          borderColor: isCompleted
                            ? `${palette.accentPrimary}66`
                            : palette.divider,
                          borderRadius: 12,
                          padding: spacing.sm,
                          backgroundColor: isCompleted
                            ? `${palette.accentPrimary}11`
                            : palette.surface,
                          flexDirection: 'row',
                          alignItems: 'center',
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text
                            style={{ ...typography.label, color: palette.text }}
                          >
                            {meta?.label || toStepLabel(stepKey)}
                          </Text>
                          <Text
                            style={{
                              ...typography.caption,
                              color: palette.subtext,
                            }}
                          >
                            {meta?.subtitle ||
                              'Complete this pharmacy workflow step.'}
                          </Text>
                        </View>
                        <KISButton
                          title={isCompleted ? 'Done' : 'Mark Done'}
                          size="xs"
                          variant={isCompleted ? 'outline' : 'primary'}
                          onPress={() => {
                            completePharmacyStep(stepKey).catch(
                              () => undefined,
                            );
                          }}
                          disabled={
                            pharmacyBusy ||
                            pharmacyLoading ||
                            !pharmacySessionId ||
                            isCompleted ||
                            pharmacyIsClosed
                          }
                        />
                      </View>
                    );
                  })}
                </View>
              ) : null}

              {pharmacyEngineMapped !== false ? (
                <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
                  <TextInput
                    value={pharmacyEtaDraft}
                    onChangeText={setPharmacyEtaDraft}
                    editable={
                      !pharmacyBusy && !pharmacyLoading && !pharmacyIsClosed
                    }
                    placeholder="ETA minutes (optional)"
                    placeholderTextColor={palette.subtext}
                    keyboardType="numeric"
                    style={{
                      borderWidth: 1,
                      borderColor: palette.divider,
                      borderRadius: 12,
                      paddingHorizontal: spacing.sm,
                      paddingVertical: spacing.sm,
                      color: palette.text,
                      backgroundColor: palette.surface,
                    }}
                  />
                  <TextInput
                    value={pharmacyNoteDraft}
                    onChangeText={setPharmacyNoteDraft}
                    editable={
                      !pharmacyBusy && !pharmacyLoading && !pharmacyIsClosed
                    }
                    placeholder="Fulfillment note"
                    placeholderTextColor={palette.subtext}
                    style={{
                      borderWidth: 1,
                      borderColor: palette.divider,
                      borderRadius: 12,
                      paddingHorizontal: spacing.sm,
                      paddingVertical: spacing.sm,
                      color: palette.text,
                      backgroundColor: palette.surface,
                    }}
                  />
                  <KISButton
                    title={
                      pharmacyBusy ? 'Sending...' : 'Send Fulfillment Ping'
                    }
                    onPress={() => {
                      sendPharmacyTrackingPing().catch(() => undefined);
                    }}
                    disabled={
                      pharmacyBusy ||
                      pharmacyLoading ||
                      !pharmacySessionId ||
                      pharmacyIsClosed
                    }
                  />
                </View>
              ) : null}

              {recentPharmacyEvents.length ? (
                <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
                  {recentPharmacyEvents.map((event: any, idx: number) => (
                    <View
                      key={`pharmacy-event-${idx}-${String(
                        event?.timestamp || '',
                      )}`}
                      style={{
                        borderWidth: 1,
                        borderColor: palette.divider,
                        borderRadius: 12,
                        padding: spacing.sm,
                        backgroundColor: palette.surface,
                      }}
                    >
                      <Text
                        style={{
                          ...typography.caption,
                          color: palette.subtext,
                        }}
                      >
                        {String(event?.type || 'update').toUpperCase()} ·{' '}
                        {toDateTimeLabel(event?.timestamp)}
                      </Text>
                      <Text
                        style={{
                          ...typography.caption,
                          color: palette.subtext,
                          marginTop: 2,
                        }}
                      >
                        {String(event?.status || '').toUpperCase() || 'UNKNOWN'}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {pharmacyEngineMapped !== false ? (
                <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
                  <KISButton
                    title={
                      pharmacyBusy ? 'Processing...' : 'Complete Fulfillment'
                    }
                    onPress={() => {
                      finishPharmacySession('completed').catch(() => undefined);
                    }}
                    disabled={
                      pharmacyBusy ||
                      pharmacyLoading ||
                      !pharmacySessionId ||
                      pharmacyIsClosed
                    }
                  />
                  <KISButton
                    title={
                      pharmacyBusy ? 'Processing...' : 'Cancel Fulfillment'
                    }
                    variant="outline"
                    onPress={() => {
                      finishPharmacySession('cancelled').catch(() => undefined);
                    }}
                    disabled={
                      pharmacyBusy ||
                      pharmacyLoading ||
                      !pharmacySessionId ||
                      pharmacyIsClosed
                    }
                  />
                </View>
              ) : null}
            </View>
          ) : null}

          {isHealthOpsSession && activeEngineKey === 'billing' ? (
            <View
              style={{
                marginTop: spacing.md,
                borderRadius: spacing.lg,
                padding: spacing.md,
                backgroundColor: palette.card,
                ...borders.card,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Text style={{ ...typography.h3, color: palette.text }}>
                  Payment & Billing Engine
                </Text>
                <View
                  style={{
                    borderRadius: 999,
                    backgroundColor: `${palette.accentPrimary}22`,
                    paddingHorizontal: spacing.sm,
                    paddingVertical: 4,
                  }}
                >
                  <Text
                    style={{
                      ...typography.caption,
                      color: palette.accentPrimary,
                    }}
                  >
                    Polling
                  </Text>
                </View>
              </View>

              {billingEngineMapped === false ? (
                <Text
                  style={{
                    ...typography.body,
                    color: palette.subtext,
                    marginTop: spacing.sm,
                  }}
                >
                  Payment & billing engine is not mapped to this service
                  workflow yet.
                </Text>
              ) : null}

              {billingSession ? (
                <View style={{ marginTop: spacing.sm, gap: spacing.xs }}>
                  <Text style={{ ...typography.body, color: palette.text }}>
                    Status: {(billingStatus || 'waiting').toUpperCase()}
                  </Text>
                  <Text
                    style={{ ...typography.caption, color: palette.subtext }}
                  >
                    Payable:{' '}
                    {toKisc(Number(billingSession?.payable_amount_micro || 0))}{' '}
                    KISC
                  </Text>
                  <Text
                    style={{ ...typography.caption, color: palette.subtext }}
                  >
                    Payment source: KIS Coin wallet (profile account)
                  </Text>
                  {String(billingSession?.payment_reference || '').trim() ? (
                    <Text
                      style={{ ...typography.caption, color: palette.subtext }}
                    >
                      Payment ref:{' '}
                      {String(billingSession?.payment_reference || '').trim()}
                    </Text>
                  ) : null}
                </View>
              ) : null}

              {billingLoading ? (
                <View
                  style={{
                    marginTop: spacing.sm,
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}
                >
                  <ActivityIndicator
                    size="small"
                    color={palette.accentPrimary}
                  />
                  <Text
                    style={{
                      ...typography.body,
                      color: palette.subtext,
                      marginLeft: spacing.xs,
                    }}
                  >
                    Loading billing session...
                  </Text>
                </View>
              ) : null}

              {billingError ? (
                <Text
                  style={{
                    ...typography.caption,
                    color: '#EF4444',
                    marginTop: spacing.xs,
                  }}
                >
                  {billingError}
                </Text>
              ) : null}

              <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
                <KISButton
                  title={
                    billingLoading
                      ? 'Preparing...'
                      : billingSessionId
                      ? 'Refresh Billing'
                      : 'Prepare Billing'
                  }
                  variant="outline"
                  onPress={() => {
                    refreshBillingSession().catch(() => undefined);
                  }}
                  disabled={
                    billingLoading || billingBusy || !cleanWorkflowSessionId
                  }
                />
              </View>

              {billingEngineMapped !== false ? (
                <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
                  {(Object.keys(billingStepState).length
                    ? Object.keys(billingStepState)
                    : [...HEALTH_OPS_BILLING_STEP_KEYS]
                  ).map(stepKey => {
                    const isCompleted =
                      !!billingStepState?.[stepKey]?.is_completed;
                    const meta = BILLING_STEP_META.find(
                      row => row.key === stepKey,
                    );
                    return (
                      <View
                        key={`billing-step-${stepKey}`}
                        style={{
                          borderWidth: 1,
                          borderColor: isCompleted
                            ? `${palette.accentPrimary}66`
                            : palette.divider,
                          borderRadius: 12,
                          padding: spacing.sm,
                          backgroundColor: isCompleted
                            ? `${palette.accentPrimary}11`
                            : palette.surface,
                          flexDirection: 'row',
                          alignItems: 'center',
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text
                            style={{ ...typography.label, color: palette.text }}
                          >
                            {meta?.label || toStepLabel(stepKey)}
                          </Text>
                          <Text
                            style={{
                              ...typography.caption,
                              color: palette.subtext,
                            }}
                          >
                            {meta?.subtitle ||
                              'Complete this billing workflow step.'}
                          </Text>
                        </View>
                        <KISButton
                          title={isCompleted ? 'Done' : 'Mark Done'}
                          size="xs"
                          variant={isCompleted ? 'outline' : 'primary'}
                          onPress={() => {
                            completeBillingStep(stepKey).catch(() => undefined);
                          }}
                          disabled={
                            billingBusy ||
                            billingLoading ||
                            !billingSessionId ||
                            isCompleted ||
                            billingIsClosed
                          }
                        />
                      </View>
                    );
                  })}
                </View>
              ) : null}

              {billingEngineMapped !== false ? (
                <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
                  <KISButton
                    title={billingBusy ? 'Processing...' : 'Complete Billing'}
                    onPress={() => {
                      finishBillingSession('completed').catch(() => undefined);
                    }}
                    disabled={
                      billingBusy ||
                      billingLoading ||
                      !billingSessionId ||
                      billingIsClosed
                    }
                  />
                  <KISButton
                    title={
                      billingBusy ? 'Processing...' : 'Mark Billing Failed'
                    }
                    variant="outline"
                    onPress={() => {
                      finishBillingSession('failed').catch(() => undefined);
                    }}
                    disabled={
                      billingBusy ||
                      billingLoading ||
                      !billingSessionId ||
                      billingIsClosed
                    }
                  />
                  <KISButton
                    title={billingBusy ? 'Processing...' : 'Cancel Billing'}
                    variant="outline"
                    onPress={() => {
                      finishBillingSession('cancelled').catch(() => undefined);
                    }}
                    disabled={
                      billingBusy ||
                      billingLoading ||
                      !billingSessionId ||
                      billingIsClosed
                    }
                  />
                </View>
              ) : null}
            </View>
          ) : null}

          {isHealthOpsSession && activeEngineKey === 'home_logistics' ? (
            <View
              style={{
                marginTop: spacing.md,
                borderRadius: spacing.lg,
                padding: spacing.md,
                backgroundColor: palette.card,
                ...borders.card,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Text style={{ ...typography.h3, color: palette.text }}>
                  Home Logistics Engine
                </Text>
                <View
                  style={{
                    borderRadius: 999,
                    backgroundColor: `${palette.accentPrimary}22`,
                    paddingHorizontal: spacing.sm,
                    paddingVertical: 4,
                  }}
                >
                  <Text
                    style={{
                      ...typography.caption,
                      color: palette.accentPrimary,
                    }}
                  >
                    Polling
                  </Text>
                </View>
              </View>

              {homeLogisticsEngineMapped === false ? (
                <Text
                  style={{
                    ...typography.body,
                    color: palette.subtext,
                    marginTop: spacing.sm,
                  }}
                >
                  Home logistics engine is not mapped to this service workflow
                  yet.
                </Text>
              ) : null}

              {homeLogisticsSession ? (
                <View style={{ marginTop: spacing.sm, gap: spacing.xs }}>
                  <Text style={{ ...typography.body, color: palette.text }}>
                    Logistics code:{' '}
                    {String(
                      homeLogisticsSession?.logistics_code || '',
                    ).trim() || 'Unavailable'}
                  </Text>
                  <Text style={{ ...typography.body, color: palette.text }}>
                    Status: {(homeLogisticsStatus || 'waiting').toUpperCase()}
                  </Text>
                  <Text
                    style={{ ...typography.caption, color: palette.subtext }}
                  >
                    ETA:{' '}
                    {Number.isFinite(
                      Number(homeLogisticsSession?.current_eta_minutes),
                    )
                      ? `${Number(
                          homeLogisticsSession.current_eta_minutes,
                        )} min`
                      : 'Not set'}
                  </Text>
                  <Text
                    style={{ ...typography.caption, color: palette.subtext }}
                  >
                    Route:{' '}
                    {String(
                      homeLogisticsSession?.route_reference || '',
                    ).trim() || 'Not assigned'}
                  </Text>
                </View>
              ) : null}

              {homeLogisticsLoading ? (
                <View
                  style={{
                    marginTop: spacing.sm,
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}
                >
                  <ActivityIndicator
                    size="small"
                    color={palette.accentPrimary}
                  />
                  <Text
                    style={{
                      ...typography.body,
                      color: palette.subtext,
                      marginLeft: spacing.xs,
                    }}
                  >
                    Loading home logistics...
                  </Text>
                </View>
              ) : null}

              {homeLogisticsError ? (
                <Text
                  style={{
                    ...typography.caption,
                    color: '#EF4444',
                    marginTop: spacing.xs,
                  }}
                >
                  {homeLogisticsError}
                </Text>
              ) : null}

              <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
                <KISButton
                  title={
                    homeLogisticsLoading
                      ? 'Preparing...'
                      : homeLogisticsSessionId
                      ? 'Refresh Logistics'
                      : 'Prepare Logistics'
                  }
                  variant="outline"
                  onPress={() => {
                    refreshHomeLogisticsSession().catch(() => undefined);
                  }}
                  disabled={
                    homeLogisticsLoading ||
                    homeLogisticsBusy ||
                    !cleanWorkflowSessionId
                  }
                />
              </View>

              {homeLogisticsEngineMapped !== false ? (
                <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
                  {(Object.keys(homeLogisticsStepState).length
                    ? Object.keys(homeLogisticsStepState)
                    : [...HEALTH_OPS_HOME_LOGISTICS_STEP_KEYS]
                  ).map(stepKey => {
                    const isCompleted =
                      !!homeLogisticsStepState?.[stepKey]?.is_completed;
                    const meta = HOME_LOGISTICS_STEP_META.find(
                      row => row.key === stepKey,
                    );
                    return (
                      <View
                        key={`home-logistics-step-${stepKey}`}
                        style={{
                          borderWidth: 1,
                          borderColor: isCompleted
                            ? `${palette.accentPrimary}66`
                            : palette.divider,
                          borderRadius: 12,
                          padding: spacing.sm,
                          backgroundColor: isCompleted
                            ? `${palette.accentPrimary}11`
                            : palette.surface,
                          flexDirection: 'row',
                          alignItems: 'center',
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text
                            style={{ ...typography.label, color: palette.text }}
                          >
                            {meta?.label || toStepLabel(stepKey)}
                          </Text>
                          <Text
                            style={{
                              ...typography.caption,
                              color: palette.subtext,
                            }}
                          >
                            {meta?.subtitle ||
                              'Complete this home logistics workflow step.'}
                          </Text>
                        </View>
                        <KISButton
                          title={isCompleted ? 'Done' : 'Mark Done'}
                          size="xs"
                          variant={isCompleted ? 'outline' : 'primary'}
                          onPress={() => {
                            completeHomeLogisticsStep(stepKey).catch(
                              () => undefined,
                            );
                          }}
                          disabled={
                            homeLogisticsBusy ||
                            homeLogisticsLoading ||
                            !homeLogisticsSessionId ||
                            isCompleted ||
                            homeLogisticsIsClosed
                          }
                        />
                      </View>
                    );
                  })}
                </View>
              ) : null}

              {homeLogisticsEngineMapped !== false ? (
                <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
                  <TextInput
                    value={homeLogisticsEtaDraft}
                    onChangeText={setHomeLogisticsEtaDraft}
                    editable={
                      !homeLogisticsBusy &&
                      !homeLogisticsLoading &&
                      !homeLogisticsIsClosed
                    }
                    placeholder="ETA minutes (optional)"
                    placeholderTextColor={palette.subtext}
                    keyboardType="numeric"
                    style={{
                      borderWidth: 1,
                      borderColor: palette.divider,
                      borderRadius: 12,
                      paddingHorizontal: spacing.sm,
                      paddingVertical: spacing.sm,
                      color: palette.text,
                      backgroundColor: palette.surface,
                    }}
                  />
                  <TextInput
                    value={homeLogisticsNoteDraft}
                    onChangeText={setHomeLogisticsNoteDraft}
                    editable={
                      !homeLogisticsBusy &&
                      !homeLogisticsLoading &&
                      !homeLogisticsIsClosed
                    }
                    placeholder="Logistics note"
                    placeholderTextColor={palette.subtext}
                    style={{
                      borderWidth: 1,
                      borderColor: palette.divider,
                      borderRadius: 12,
                      paddingHorizontal: spacing.sm,
                      paddingVertical: spacing.sm,
                      color: palette.text,
                      backgroundColor: palette.surface,
                    }}
                  />
                  <KISButton
                    title={
                      homeLogisticsBusy ? 'Sending...' : 'Send Logistics Ping'
                    }
                    onPress={() => {
                      sendHomeLogisticsTrackingPing().catch(() => undefined);
                    }}
                    disabled={
                      homeLogisticsBusy ||
                      homeLogisticsLoading ||
                      !homeLogisticsSessionId ||
                      homeLogisticsIsClosed
                    }
                  />
                </View>
              ) : null}

              {recentHomeLogisticsEvents.length ? (
                <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
                  {recentHomeLogisticsEvents.map((event: any, idx: number) => (
                    <View
                      key={`home-logistics-event-${idx}-${String(
                        event?.timestamp || '',
                      )}`}
                      style={{
                        borderWidth: 1,
                        borderColor: palette.divider,
                        borderRadius: 12,
                        padding: spacing.sm,
                        backgroundColor: palette.surface,
                      }}
                    >
                      <Text
                        style={{
                          ...typography.caption,
                          color: palette.subtext,
                        }}
                      >
                        {String(event?.type || 'update').toUpperCase()} ·{' '}
                        {toDateTimeLabel(event?.timestamp)}
                      </Text>
                      <Text
                        style={{
                          ...typography.caption,
                          color: palette.subtext,
                          marginTop: 2,
                        }}
                      >
                        {String(event?.status || '').toUpperCase() || 'UNKNOWN'}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {homeLogisticsEngineMapped !== false ? (
                <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
                  <KISButton
                    title={
                      homeLogisticsBusy ? 'Processing...' : 'Complete Logistics'
                    }
                    onPress={() => {
                      finishHomeLogisticsSession('completed').catch(
                        () => undefined,
                      );
                    }}
                    disabled={
                      homeLogisticsBusy ||
                      homeLogisticsLoading ||
                      !homeLogisticsSessionId ||
                      homeLogisticsIsClosed
                    }
                  />
                  <KISButton
                    title={
                      homeLogisticsBusy ? 'Processing...' : 'Cancel Logistics'
                    }
                    variant="outline"
                    onPress={() => {
                      finishHomeLogisticsSession('cancelled').catch(
                        () => undefined,
                      );
                    }}
                    disabled={
                      homeLogisticsBusy ||
                      homeLogisticsLoading ||
                      !homeLogisticsSessionId ||
                      homeLogisticsIsClosed
                    }
                  />
                </View>
              ) : null}
            </View>
          ) : null}

          {isHealthOpsSession && activeEngineKey === 'wellness' ? (
            <View
              style={{
                marginTop: spacing.md,
                borderRadius: spacing.lg,
                padding: spacing.md,
                backgroundColor: palette.card,
                ...borders.card,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Text style={{ ...typography.h3, color: palette.text }}>
                  Wellness Program Engine
                </Text>
                <View
                  style={{
                    borderRadius: 999,
                    backgroundColor: `${palette.accentPrimary}22`,
                    paddingHorizontal: spacing.sm,
                    paddingVertical: 4,
                  }}
                >
                  <Text
                    style={{
                      ...typography.caption,
                      color: palette.accentPrimary,
                    }}
                  >
                    Polling
                  </Text>
                </View>
              </View>

              {wellnessEngineMapped === false ? (
                <Text
                  style={{
                    ...typography.body,
                    color: palette.subtext,
                    marginTop: spacing.sm,
                  }}
                >
                  Wellness program engine is not mapped to this service workflow
                  yet.
                </Text>
              ) : null}

              {wellnessSession ? (
                <View style={{ marginTop: spacing.sm, gap: spacing.xs }}>
                  <Text style={{ ...typography.body, color: palette.text }}>
                    Status: {(wellnessStatus || 'waiting').toUpperCase()}
                  </Text>
                  <Text
                    style={{ ...typography.caption, color: palette.subtext }}
                  >
                    Program:{' '}
                    {String(wellnessSession?.program_name || '').trim() ||
                      'Not set'}
                  </Text>
                  <Text
                    style={{ ...typography.caption, color: palette.subtext }}
                  >
                    Streak: {Number(wellnessSession?.current_streak || 0)}
                  </Text>
                  <Text
                    style={{ ...typography.caption, color: palette.subtext }}
                  >
                    Completion:{' '}
                    {Number(wellnessSession?.completion_percent || 0)}%
                  </Text>
                </View>
              ) : null}

              {wellnessLoading ? (
                <View
                  style={{
                    marginTop: spacing.sm,
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}
                >
                  <ActivityIndicator
                    size="small"
                    color={palette.accentPrimary}
                  />
                  <Text
                    style={{
                      ...typography.body,
                      color: palette.subtext,
                      marginLeft: spacing.xs,
                    }}
                  >
                    Loading wellness session...
                  </Text>
                </View>
              ) : null}

              {wellnessError ? (
                <Text
                  style={{
                    ...typography.caption,
                    color: '#EF4444',
                    marginTop: spacing.xs,
                  }}
                >
                  {wellnessError}
                </Text>
              ) : null}

              <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
                <KISButton
                  title={
                    wellnessLoading
                      ? 'Preparing...'
                      : wellnessSessionId
                      ? 'Refresh Wellness'
                      : 'Prepare Wellness'
                  }
                  variant="outline"
                  onPress={() => {
                    refreshWellnessSession().catch(() => undefined);
                  }}
                  disabled={
                    wellnessLoading || wellnessBusy || !cleanWorkflowSessionId
                  }
                />
              </View>

              {wellnessEngineMapped !== false ? (
                <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
                  <TextInput
                    value={wellnessProgramDraft}
                    onChangeText={setWellnessProgramDraft}
                    editable={
                      !wellnessBusy && !wellnessLoading && !wellnessIsClosed
                    }
                    placeholder="Wellness program name"
                    placeholderTextColor={palette.subtext}
                    style={{
                      borderWidth: 1,
                      borderColor: palette.divider,
                      borderRadius: 12,
                      paddingHorizontal: spacing.sm,
                      paddingVertical: spacing.sm,
                      color: palette.text,
                      backgroundColor: palette.surface,
                    }}
                  />
                  <TextInput
                    value={wellnessCompletionDraft}
                    onChangeText={setWellnessCompletionDraft}
                    editable={
                      !wellnessBusy && !wellnessLoading && !wellnessIsClosed
                    }
                    placeholder="Completion % (optional)"
                    placeholderTextColor={palette.subtext}
                    keyboardType="numeric"
                    style={{
                      borderWidth: 1,
                      borderColor: palette.divider,
                      borderRadius: 12,
                      paddingHorizontal: spacing.sm,
                      paddingVertical: spacing.sm,
                      color: palette.text,
                      backgroundColor: palette.surface,
                    }}
                  />
                  <TextInput
                    value={wellnessNoteDraft}
                    onChangeText={setWellnessNoteDraft}
                    editable={
                      !wellnessBusy && !wellnessLoading && !wellnessIsClosed
                    }
                    placeholder="Wellness note"
                    placeholderTextColor={palette.subtext}
                    style={{
                      borderWidth: 1,
                      borderColor: palette.divider,
                      borderRadius: 12,
                      paddingHorizontal: spacing.sm,
                      paddingVertical: spacing.sm,
                      color: palette.text,
                      backgroundColor: palette.surface,
                    }}
                  />
                </View>
              ) : null}

              {wellnessEngineMapped !== false ? (
                <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
                  {(Object.keys(wellnessStepState).length
                    ? Object.keys(wellnessStepState)
                    : [...HEALTH_OPS_WELLNESS_STEP_KEYS]
                  ).map(stepKey => {
                    const isCompleted =
                      !!wellnessStepState?.[stepKey]?.is_completed;
                    const meta = WELLNESS_STEP_META.find(
                      row => row.key === stepKey,
                    );
                    return (
                      <View
                        key={`wellness-step-${stepKey}`}
                        style={{
                          borderWidth: 1,
                          borderColor: isCompleted
                            ? `${palette.accentPrimary}66`
                            : palette.divider,
                          borderRadius: 12,
                          padding: spacing.sm,
                          backgroundColor: isCompleted
                            ? `${palette.accentPrimary}11`
                            : palette.surface,
                          flexDirection: 'row',
                          alignItems: 'center',
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text
                            style={{ ...typography.label, color: palette.text }}
                          >
                            {meta?.label || toStepLabel(stepKey)}
                          </Text>
                          <Text
                            style={{
                              ...typography.caption,
                              color: palette.subtext,
                            }}
                          >
                            {meta?.subtitle ||
                              'Complete this wellness workflow step.'}
                          </Text>
                        </View>
                        <KISButton
                          title={isCompleted ? 'Done' : 'Mark Done'}
                          size="xs"
                          variant={isCompleted ? 'outline' : 'primary'}
                          onPress={() => {
                            completeWellnessStep(stepKey).catch(
                              () => undefined,
                            );
                          }}
                          disabled={
                            wellnessBusy ||
                            wellnessLoading ||
                            !wellnessSessionId ||
                            isCompleted ||
                            wellnessIsClosed
                          }
                        />
                      </View>
                    );
                  })}
                </View>
              ) : null}

              {wellnessEngineMapped !== false ? (
                <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
                  <KISButton
                    title={wellnessBusy ? 'Sending...' : 'Send Wellness Ping'}
                    onPress={() => {
                      sendWellnessActivityPing().catch(() => undefined);
                    }}
                    disabled={
                      wellnessBusy ||
                      wellnessLoading ||
                      !wellnessSessionId ||
                      wellnessIsClosed
                    }
                  />
                </View>
              ) : null}

              {recentWellnessEvents.length ? (
                <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
                  {recentWellnessEvents.map((event: any, idx: number) => (
                    <View
                      key={`wellness-event-${idx}-${String(
                        event?.timestamp || '',
                      )}`}
                      style={{
                        borderWidth: 1,
                        borderColor: palette.divider,
                        borderRadius: 12,
                        padding: spacing.sm,
                        backgroundColor: palette.surface,
                      }}
                    >
                      <Text
                        style={{
                          ...typography.caption,
                          color: palette.subtext,
                        }}
                      >
                        {String(event?.type || 'update').toUpperCase()} ·{' '}
                        {toDateTimeLabel(event?.timestamp)}
                      </Text>
                      <Text
                        style={{
                          ...typography.caption,
                          color: palette.subtext,
                          marginTop: 2,
                        }}
                      >
                        {String(event?.status || '').toUpperCase() || 'UNKNOWN'}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {wellnessEngineMapped !== false ? (
                <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
                  <KISButton
                    title={wellnessBusy ? 'Processing...' : 'Complete Wellness'}
                    onPress={() => {
                      finishWellnessSession('completed').catch(() => undefined);
                    }}
                    disabled={
                      wellnessBusy ||
                      wellnessLoading ||
                      !wellnessSessionId ||
                      wellnessIsClosed
                    }
                  />
                  <KISButton
                    title={wellnessBusy ? 'Processing...' : 'Cancel Wellness'}
                    variant="outline"
                    onPress={() => {
                      finishWellnessSession('cancelled').catch(() => undefined);
                    }}
                    disabled={
                      wellnessBusy ||
                      wellnessLoading ||
                      !wellnessSessionId ||
                      wellnessIsClosed
                    }
                  />
                </View>
              ) : null}
            </View>
          ) : null}

          {isHealthOpsSession && activeEngineKey === 'reminder' ? (
            <View
              style={{
                marginTop: spacing.md,
                borderRadius: spacing.lg,
                padding: spacing.md,
                backgroundColor: palette.card,
                ...borders.card,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Text style={{ ...typography.h3, color: palette.text }}>
                  Notification & Reminder Engine
                </Text>
                <View
                  style={{
                    borderRadius: 999,
                    backgroundColor: `${palette.accentPrimary}22`,
                    paddingHorizontal: spacing.sm,
                    paddingVertical: 4,
                  }}
                >
                  <Text
                    style={{
                      ...typography.caption,
                      color: palette.accentPrimary,
                    }}
                  >
                    Polling
                  </Text>
                </View>
              </View>

              {reminderEngineMapped === false ? (
                <Text
                  style={{
                    ...typography.body,
                    color: palette.subtext,
                    marginTop: spacing.sm,
                  }}
                >
                  Reminder engine is not mapped to this service workflow yet.
                </Text>
              ) : null}

              {reminderSession ? (
                <View style={{ marginTop: spacing.sm, gap: spacing.xs }}>
                  <Text style={{ ...typography.body, color: palette.text }}>
                    Status: {(reminderStatus || 'waiting').toUpperCase()}
                  </Text>
                  <Text
                    style={{ ...typography.caption, color: palette.subtext }}
                  >
                    Next run:{' '}
                    {String(reminderSession?.next_run_at || '').trim() ||
                      'Not set'}
                  </Text>
                  <Text
                    style={{ ...typography.caption, color: palette.subtext }}
                  >
                    Sent: {Number(reminderSession?.sent_count || 0)} · Failed:{' '}
                    {Number(reminderSession?.failed_count || 0)}
                  </Text>
                </View>
              ) : null}

              {reminderLoading ? (
                <View
                  style={{
                    marginTop: spacing.sm,
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}
                >
                  <ActivityIndicator
                    size="small"
                    color={palette.accentPrimary}
                  />
                  <Text
                    style={{
                      ...typography.body,
                      color: palette.subtext,
                      marginLeft: spacing.xs,
                    }}
                  >
                    Loading reminder session...
                  </Text>
                </View>
              ) : null}

              {reminderError ? (
                <Text
                  style={{
                    ...typography.caption,
                    color: '#EF4444',
                    marginTop: spacing.xs,
                  }}
                >
                  {reminderError}
                </Text>
              ) : null}

              <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
                <KISButton
                  title={
                    reminderLoading
                      ? 'Preparing...'
                      : reminderSessionId
                      ? 'Refresh Reminder'
                      : 'Prepare Reminder'
                  }
                  variant="outline"
                  onPress={() => {
                    refreshReminderSession().catch(() => undefined);
                  }}
                  disabled={
                    reminderLoading || reminderBusy || !cleanWorkflowSessionId
                  }
                />
              </View>

              {reminderEngineMapped !== false ? (
                <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
                  {(Object.keys(reminderStepState).length
                    ? Object.keys(reminderStepState)
                    : [...HEALTH_OPS_REMINDER_STEP_KEYS]
                  ).map(stepKey => {
                    const isCompleted =
                      !!reminderStepState?.[stepKey]?.is_completed;
                    const meta = REMINDER_STEP_META.find(
                      row => row.key === stepKey,
                    );
                    return (
                      <View
                        key={`reminder-step-${stepKey}`}
                        style={{
                          borderWidth: 1,
                          borderColor: isCompleted
                            ? `${palette.accentPrimary}66`
                            : palette.divider,
                          borderRadius: 12,
                          padding: spacing.sm,
                          backgroundColor: isCompleted
                            ? `${palette.accentPrimary}11`
                            : palette.surface,
                          flexDirection: 'row',
                          alignItems: 'center',
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text
                            style={{ ...typography.label, color: palette.text }}
                          >
                            {meta?.label || toStepLabel(stepKey)}
                          </Text>
                          <Text
                            style={{
                              ...typography.caption,
                              color: palette.subtext,
                            }}
                          >
                            {meta?.subtitle ||
                              'Complete this reminder workflow step.'}
                          </Text>
                        </View>
                        <KISButton
                          title={isCompleted ? 'Done' : 'Mark Done'}
                          size="xs"
                          variant={isCompleted ? 'outline' : 'primary'}
                          onPress={() => {
                            completeReminderStep(stepKey).catch(
                              () => undefined,
                            );
                          }}
                          disabled={
                            reminderBusy ||
                            reminderLoading ||
                            !reminderSessionId ||
                            isCompleted ||
                            reminderIsClosed
                          }
                        />
                      </View>
                    );
                  })}
                </View>
              ) : null}

              {reminderEngineMapped !== false ? (
                <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
                  <TextInput
                    value={reminderNextRunDraft}
                    onChangeText={setReminderNextRunDraft}
                    editable={
                      !reminderBusy && !reminderLoading && !reminderIsClosed
                    }
                    placeholder="Next run ISO datetime (optional)"
                    placeholderTextColor={palette.subtext}
                    style={{
                      borderWidth: 1,
                      borderColor: palette.divider,
                      borderRadius: 12,
                      paddingHorizontal: spacing.sm,
                      paddingVertical: spacing.sm,
                      color: palette.text,
                      backgroundColor: palette.surface,
                    }}
                  />
                  <TextInput
                    value={reminderNoteDraft}
                    onChangeText={setReminderNoteDraft}
                    editable={
                      !reminderBusy && !reminderLoading && !reminderIsClosed
                    }
                    placeholder="Reminder note"
                    placeholderTextColor={palette.subtext}
                    style={{
                      borderWidth: 1,
                      borderColor: palette.divider,
                      borderRadius: 12,
                      paddingHorizontal: spacing.sm,
                      paddingVertical: spacing.sm,
                      color: palette.text,
                      backgroundColor: palette.surface,
                    }}
                  />
                  <KISButton
                    title={reminderBusy ? 'Sending...' : 'Send Delivery Ping'}
                    onPress={() => {
                      sendReminderDeliveryPing().catch(() => undefined);
                    }}
                    disabled={
                      reminderBusy ||
                      reminderLoading ||
                      !reminderSessionId ||
                      reminderIsClosed
                    }
                  />
                </View>
              ) : null}

              {recentReminderEvents.length ? (
                <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
                  {recentReminderEvents.map((event: any, idx: number) => (
                    <View
                      key={`reminder-event-${idx}-${String(
                        event?.timestamp || '',
                      )}`}
                      style={{
                        borderWidth: 1,
                        borderColor: palette.divider,
                        borderRadius: 12,
                        padding: spacing.sm,
                        backgroundColor: palette.surface,
                      }}
                    >
                      <Text
                        style={{
                          ...typography.caption,
                          color: palette.subtext,
                        }}
                      >
                        {String(event?.type || 'update').toUpperCase()} ·{' '}
                        {toDateTimeLabel(event?.timestamp)}
                      </Text>
                      <Text
                        style={{
                          ...typography.caption,
                          color: palette.subtext,
                          marginTop: 2,
                        }}
                      >
                        {String(event?.status || '').toUpperCase() || 'UNKNOWN'}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {reminderEngineMapped !== false ? (
                <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
                  <KISButton
                    title={reminderBusy ? 'Processing...' : 'Complete Reminder'}
                    onPress={() => {
                      finishReminderSession('completed').catch(() => undefined);
                    }}
                    disabled={
                      reminderBusy ||
                      reminderLoading ||
                      !reminderSessionId ||
                      reminderIsClosed
                    }
                  />
                  <KISButton
                    title={reminderBusy ? 'Processing...' : 'Disable Reminder'}
                    variant="outline"
                    onPress={() => {
                      finishReminderSession('disabled').catch(() => undefined);
                    }}
                    disabled={
                      reminderBusy ||
                      reminderLoading ||
                      !reminderSessionId ||
                      reminderIsClosed
                    }
                  />
                  <KISButton
                    title={reminderBusy ? 'Processing...' : 'Cancel Reminder'}
                    variant="outline"
                    onPress={() => {
                      finishReminderSession('cancelled').catch(() => undefined);
                    }}
                    disabled={
                      reminderBusy ||
                      reminderLoading ||
                      !reminderSessionId ||
                      reminderIsClosed
                    }
                  />
                </View>
              ) : null}
            </View>
          ) : null}

          {isHealthOpsSession ? (
            <View
              style={{
                marginTop: spacing.md,
                borderRadius: spacing.lg,
                padding: spacing.md,
                backgroundColor: palette.card,
                ...borders.card,
              }}
            >
              <Text style={{ ...typography.caption, color: palette.subtext }}>
                Engine {activeEngineIndex + 1} of {effectiveEngineFlow.length}
              </Text>
              <View style={{ marginTop: spacing.xs, gap: spacing.xs }}>
                <KISButton
                  title="Previous Engine"
                  variant="outline"
                  onPress={goToPreviousEngine}
                  disabled={!hasPreviousEngine}
                />
                <KISButton
                  title={
                    hasNextEngine
                      ? `Continue to ${
                          effectiveEngineFlow[activeEngineIndex + 1]?.title ||
                          'Next'
                        }`
                      : 'You are on the final engine'
                  }
                  onPress={goToNextEngine}
                  disabled={!hasNextEngine}
                />
              </View>
            </View>
          ) : null}
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}
