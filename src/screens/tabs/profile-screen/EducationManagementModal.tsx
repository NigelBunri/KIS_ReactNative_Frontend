import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import DocumentPicker from 'react-native-document-picker';
import RNFS from 'react-native-fs';
import Video from 'react-native-video';
import Pdf from 'react-native-pdf';
import AddContactsPage from '@/Module/AddContacts/AddContactsPage';
import type { KISContact } from '@/Module/AddContacts/contactsService';
import KISButton from '@/constants/KISButton';
import KISTextInput from '@/constants/KISTextInput';
import { deleteRequest } from '@/network/delete';
import { getRequest } from '@/network/get';
import { patchRequest } from '@/network/patch';
import { postRequest } from '@/network/post';
import ROUTES, { resolveBackendAssetUrl } from '@/network';
import type { KISPalette } from '@/theme/constants';
import { styles } from '../profile/profile.styles';
import type { EducationFormState } from './types';
import KISDateTimeInput from '@/constants/KISDateTimeInput';
import {
  EducationActionButton,
  EducationEmptyState,
  EducationListCard,
  EducationMetricTile,
  EducationScreenScaffold,
  EducationSectionCard,
  EducationStatusBadge,
  EducationTimelineItem,
  EducationWorkspaceHeader,
} from './education-dashboard';

type EducationManagementModalProps = {
  palette: KISPalette;
  title: string;
  subtitle: string;
  managementData: any;
  tierLabel: string | null;
  courses: any[];
  modules: any[];
  educationForm: EducationFormState;
  educationFormMode: 'add' | 'edit';
  educationFormLoading: boolean;
  educationModuleForm: { title: string; summary: string; resource_url: string };
  educationModuleSubmitting: boolean;
  handleEducationFormSave: () => Promise<void>;
  handleEducationFormDelete: () => Promise<void>;
  resetEducationForm: () => void;
  handleEducationModuleSave: () => Promise<void>;
  resetEducationModuleForm: () => void;
  openModuleResource: (url?: string | null) => void;
  onEducationFormTitleChange: (value: string) => void;
  onEducationFormSummaryChange: (value: string) => void;
  onEducationModuleTitleChange: (value: string) => void;
  onEducationModuleSummaryChange: (value: string) => void;
  onEducationModuleResourceChange: (value: string) => void;
  loadEducationAnalytics: () => Promise<void>;
  educationAnalyticsLoading: boolean;
  educationAnalyticsError: string | null;
  upcomingLessons: any[];
  totalEnrollments: number;
  nextLesson: any | null;
  formatLessonTime: (value?: string | null) => string;
  attachments: any[];
  panelAttachmentUploading: boolean;
  handleAttachProfileFile: () => Promise<void>;
  onOpenLandingBuilder?: (institution?: any) => void;
};

type EducationInstitution = {
  id: string;
  name?: string;
  description?: string;
  institution_type?: string;
  membership_policy?: string;
  active_member_count?: number;
  pending_application_count?: number;
  can_manage?: boolean;
  current_membership?: { role?: string; status?: string } | null;
  branding?: {
    logo_url?: string;
    image_url?: string;
  };
  settings?: {
    landing_page?: {
      is_public?: boolean;
    };
  };
};

type EducationHubPayload = {
  institutions?: EducationInstitution[];
  quick_stats?: {
    institution_count?: number;
    active_member_count?: number;
    pending_application_count?: number;
    published_broadcast_count?: number;
  };
  recent_broadcasts?: Array<{
    id: string;
    title?: string;
    summary?: string;
    broadcast_kind?: string;
  }>;
};

type EducationDashboardPayload = {
  institution?: EducationInstitution;
  current_membership?: { role?: string; status?: string } | null;
  metrics?: Record<string, number>;
  modules?: Array<{ key: string; label: string; enabled?: boolean }>;
  recent_courses?: Array<{
    id?: string;
    title?: string;
    summary?: string;
    status?: string;
  }>;
  recent_broadcasts?: Array<{
    id: string;
    title?: string;
    summary?: string;
    broadcast_kind?: string;
  }>;
};

type EducationDetailSummaryPayload = {
  eyebrow?: string;
  module?: string;
  title?: string;
  subtitle?: string;
  description?: string;
  status?: string;
  highlights?: Array<{ label?: string; value?: string | number }>;
  sections?: Array<{
    title?: string;
    items?: Array<{ label?: string; value?: string | number }>;
  }>;
};

type EducationModuleKey =
  | 'overview'
  | 'programs'
  | 'courses'
  | 'lessons'
  | 'classes'
  | 'materials'
  | 'exams'
  | 'events'
  | 'students'
  | 'staff'
  | 'memberships'
  | 'enrollments'
  | 'broadcasts'
  | 'bookings'
  | 'analytics'
  | 'settings';

type InstitutionFormState = {
  name: string;
  description: string;
  logoUrl: string;
  logoPreviewUri: string;
  logoAsset: any | null;
};

const EMPTY_FORM: InstitutionFormState = {
  name: '',
  description: '',
  logoUrl: '',
  logoPreviewUri: '',
  logoAsset: null,
};

const emptyCourseModuleForm = () => ({
  title: '',
  summary: '',
  module_order: '0',
  is_preview: false,
  status: 'draft',
});

const emptyCourseModuleItemForm = () => ({
  module_id: '',
  item_type: 'lesson',
  item_order: '0',
  title_override: '',
  summary_override: '',
  estimated_minutes: '0',
  lesson_id: '',
  material_id: '',
  class_session_id: '',
  assessment_id: '',
  event_id: '',
  broadcast_id: '',
});

const uploadInstitutionLogo = async (asset: any): Promise<string> => {
  const form = new FormData();
  form.append('context', 'education_institution_logo');
  form.append('attachment', {
    uri: asset.fileCopyUri || asset.uri,
    type: asset.type || 'image/jpeg',
    name: asset.fileName || `education-logo-${Date.now()}.jpg`,
  } as any);
  const res = await postRequest(ROUTES.broadcasts.profileAttachment, form, {
    errorMessage: 'Unable to upload institution logo.',
  });
  if (!res?.success) {
    throw new Error(res?.message || 'Unable to upload institution logo.');
  }
  const url =
    res?.data?.attachment?.url ??
    res?.data?.url ??
    res?.data?.attachment_url ??
    '';
  const normalized = String(url || '').trim();
  if (!normalized) {
    throw new Error('Institution logo upload did not return a URL.');
  }
  return normalized;
};

const uploadEducationAttachment = async (
  asset: any,
  context: string,
): Promise<string> => {
  const form = new FormData();
  form.append('context', context);
  form.append('attachment', {
    uri: asset.fileCopyUri || asset.uri,
    type: asset.type || 'application/octet-stream',
    name: asset.fileName || asset.name || `education-attachment-${Date.now()}`,
  } as any);
  const res = await postRequest(ROUTES.broadcasts.profileAttachment, form, {
    errorMessage: 'Unable to upload attachment.',
  });
  if (!res?.success) {
    throw new Error(res?.message || 'Unable to upload attachment.');
  }
  const url =
    res?.data?.attachment?.url ??
    res?.data?.url ??
    res?.data?.attachment_url ??
    '';
  const normalized = String(url || '').trim();
  if (!normalized) {
    throw new Error('Attachment upload did not return a URL.');
  }
  return normalized;
};

const stripFileScheme = (value?: string | null) =>
  String(value || '').replace(/^file:\/\//, '');

const persistEducationMaterialFile = async (asset: {
  uri?: string | null;
  fileCopyUri?: string | null;
  name?: string | null;
  fileName?: string | null;
}) => {
  const sourceUri = String(asset.fileCopyUri || asset.uri || '').trim();
  if (!sourceUri || !sourceUri.startsWith('file://')) return sourceUri;
  const sourcePath = stripFileScheme(sourceUri);
  const fileName =
    String(
      asset.fileName || asset.name || `education-material-${Date.now()}`,
    ).trim() || `education-material-${Date.now()}`;
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const targetDir = `${RNFS.DocumentDirectoryPath}/education-materials`;
  const targetPath = `${targetDir}/${Date.now()}-${safeName}`;
  const sourceExists = await RNFS.exists(sourcePath);
  if (!sourceExists) {
    throw new Error(
      `The selected file is no longer available. Please pick it again.`,
    );
  }
  const dirExists = await RNFS.exists(targetDir);
  if (!dirExists) {
    await RNFS.mkdir(targetDir);
  }
  await RNFS.copyFile(sourcePath, targetPath);
  return `file://${targetPath}`;
};

const MODULE_LABELS: Record<string, string> = {
  overview: 'Overview',
  programs: 'Programs',
  courses: 'Courses',
  lessons: 'Lessons',
  classes: 'Classes',
  materials: 'Materials',
  exams: 'Exams',
  events: 'Events',
  students: 'Students',
  staff: 'Staff',
  memberships: 'Memberships',
  enrollments: 'Enrollments',
  broadcasts: 'Broadcasts',
  bookings: 'Bookings & Payments',
  analytics: 'Analytics',
  settings: 'Settings',
};

const MODULE_DESCRIPTIONS: Record<string, string> = {
  overview: 'Institution summary, recent courses, and recent broadcasts.',
  programs: 'Manage programs and departments inside this institution.',
  courses: 'Create and maintain institution-owned courses.',
  lessons: 'Build lessons and connect them to courses.',
  classes: 'Schedule live or in-person class sessions.',
  materials: 'Upload and link learning materials and resources.',
  exams: 'Create assessments, exams, and evaluation records.',
  events: 'Manage education events and training sessions.',
  students: 'Review student memberships in this institution.',
  staff: 'Review lecturers, admins, managers, and academic staff.',
  memberships: 'Approve, reject, and manage institution membership records.',
  enrollments: 'View course and broadcast enrollments.',
  broadcasts: 'Create and manage structured education broadcasts.',
  bookings: 'Track bookings and payment-related records.',
  analytics: 'Institution metrics and operational summary.',
  settings: 'Update institution information and policies.',
};

const MANAGEABLE_MODULES: EducationModuleKey[] = [
  'programs',
  'courses',
  'lessons',
  'classes',
  'materials',
  'exams',
  'events',
  'broadcasts',
];

const IMAGE_ENABLED_EDUCATION_MODULES: EducationModuleKey[] = [
  'programs',
  'courses',
  'lessons',
  'classes',
  'materials',
  'exams',
  'events',
];

const BROADCASTABLE_EDUCATION_MODULES: EducationModuleKey[] = [
  'programs',
  'courses',
  'lessons',
  'classes',
  'events',
];

const MODULE_SINGULAR_LABELS: Partial<Record<EducationModuleKey, string>> = {
  overview: 'Overview',
  programs: 'Program',
  courses: 'Course',
  lessons: 'Lesson',
  classes: 'Class',
  materials: 'Material',
  exams: 'Exam',
  events: 'Event',
  students: 'Student',
  staff: 'Staff',
  memberships: 'Membership',
  enrollments: 'Enrollment',
  broadcasts: 'Broadcast',
  bookings: 'Booking',
  analytics: 'Analytics',
  settings: 'Settings',
};

const EDUCATION_STAFF_ROLE_OPTIONS = [
  { value: 'academic_staff', label: 'Academic staff' },
  { value: 'lecturer', label: 'Lecturer' },
  { value: 'administrator', label: 'Administrator' },
  { value: 'manager', label: 'Manager' },
] as const;

type EducationFlowStep = {
  key: string;
  label: string;
};

const getModuleSingularLabel = (moduleKey: EducationModuleKey | null) => {
  if (!moduleKey) return 'Item';
  return (
    MODULE_SINGULAR_LABELS[moduleKey] ?? MODULE_LABELS[moduleKey] ?? 'Item'
  );
};

const isArchivedEducationStatus = (value: any) =>
  toText(value).toLowerCase() === 'archived';

const formatMetricLabel = (key: string) =>
  key.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());

const getInstitutionBrandingUri = (
  institution?: EducationInstitution | null,
) => {
  const raw = String(
    institution?.branding?.logo_url || institution?.branding?.image_url || '',
  ).trim();
  return raw ? resolveBackendAssetUrl(raw) || raw : '';
};

const summarizeByField = (rows: any[] | undefined, field: string) => {
  const counts = new Map<string, number>();
  (Array.isArray(rows) ? rows : []).forEach(row => {
    const key = toText(row?.[field] || 'unknown').toLowerCase();
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return Array.from(counts.entries()).map(([key, value]) => ({
    key,
    label: formatMetricLabel(key),
    value,
  }));
};

const isLandingPublic = (institution?: EducationInstitution | null) =>
  Boolean(institution?.settings?.landing_page?.is_public);

const buildInstitutionForm = (
  institution?: EducationInstitution | null,
): InstitutionFormState => ({
  name: institution?.name ?? '',
  description: institution?.description ?? '',
  logoUrl: institution?.branding?.logo_url ?? '',
  logoPreviewUri: institution?.branding?.logo_url ?? '',
  logoAsset: null,
});

const SectionCard = ({
  palette,
  title,
  subtitle,
  right,
  children,
}: {
  palette: KISPalette;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <View
    style={{
      borderWidth: 1,
      borderColor: palette.divider,
      backgroundColor: palette.surface,
      borderRadius: 20,
      padding: 14,
      gap: 12,
    }}
  >
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 12,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ color: palette.text, fontSize: 17, fontWeight: '800' }}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={{ color: palette.subtext, marginTop: 4 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
    {children}
  </View>
);

const normalizeList = (payload: any, key: string) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.[key])) return payload[key];
  return [];
};

const moduleListKey = (moduleKey: EducationModuleKey) => {
  switch (moduleKey) {
    case 'programs':
      return 'programs';
    case 'courses':
      return 'courses';
    case 'lessons':
      return 'lessons';
    case 'classes':
      return 'class_sessions';
    case 'materials':
      return 'materials';
    case 'exams':
      return 'assessments';
    case 'events':
      return 'events';
    case 'memberships':
    case 'students':
    case 'staff':
      return 'memberships';
    case 'enrollments':
      return 'enrollments';
    case 'broadcasts':
      return 'broadcasts';
    case 'bookings':
      return 'bookings';
    default:
      return 'results';
  }
};

const emptyModuleForm = () => ({
  title: '',
  name: '',
  code: '',
  summary: '',
  description: '',
  content: '',
  status: '',
  program_id: '',
  course_id: '',
  lesson_id: '',
  class_session_id: '',
  assessment_id: '',
  program_ids: [],
  course_ids: [],
  lesson_ids: [],
  class_session_ids: [],
  assessment_ids: [],
  event_id: '',
  starts_at: '',
  ends_at: '',
  timezone_name: 'UTC',
  delivery_mode: 'online',
  location_text: '',
  meeting_url: '',
  seat_limit: '',
  cover_image_url: '',
  cover_image_preview_uri: '',
  cover_image_asset: null,
  resource_url: '',
  resource_name: '',
  resource_type: '',
  resource_asset: null,
  kind: 'document',
  is_downloadable: true,
  assessment_type: 'mcq',
  duration_minutes: '',
  max_attempts: '',
  passing_score_percent: '',
  lesson_order: '',
  is_preview: false,
  instructions: '',
  event_type: 'event',
  broadcast_kind: 'course',
  booking_enabled: false,
  price_amount: '',
  price_currency: 'KISC',
  membership_policy: 'application',
  institution_type: 'academy',
});

const toText = (value: any) => String(value ?? '').trim();

const resolveEducationCoverImage = (item: any) =>
  toText(
    item?.cover_image_url ||
      item?.coverUrl ||
      item?.cover_url ||
      item?.image_url ||
      item?.imageUrl,
  );

const normalizeDetailSummaryItems = (items: any[] | undefined) =>
  (Array.isArray(items) ? items : [])
    .map(item => ({
      label: toText(item?.label),
      value: toText(item?.value),
    }))
    .filter(item => item.label && item.value);

const getRecordDetailSummary = (
  payload: any,
  keys: string[] = [],
): EducationDetailSummaryPayload | null => {
  const direct = payload?.detailSummary ?? payload?.detail_summary;
  if (direct) return direct;
  for (const key of keys) {
    const nested =
      payload?.[key]?.detailSummary ?? payload?.[key]?.detail_summary;
    if (nested) return nested;
  }
  return null;
};

const formatEducationDateTime = (value: any) => {
  const raw = toText(value);
  if (!raw) return '';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString();
};

const formatEducationAmount = (amountCents: any, currency: any) => {
  const amount = Number(amountCents || 0);
  const code = toText(currency || 'KISC');
  if (!amount) return `Free · ${code}`;
  return `${code} ${(amount / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const toLowerText = (value: any) => toText(value).toLowerCase();

const inferMaterialMimeType = (value: {
  mime?: string | null;
  type?: string | null;
  name?: string | null;
  url?: string | null;
  kind?: string | null;
}) => {
  const rawMime = toLowerText(value.mime || value.type);
  if (rawMime) return rawMime;
  const rawName = toLowerText(value.name || value.url);
  if (rawName.endsWith('.pdf')) return 'application/pdf';
  if (/\.(png|jpg|jpeg|gif|webp|bmp|heic|heif|svg)$/.test(rawName))
    return 'image/*';
  if (/\.(mp4|mov|m4v|webm|avi|mkv|m3u8)$/.test(rawName)) return 'video/*';
  if (/\.(mp3|wav|aac|m4a|ogg|oga|flac)$/.test(rawName)) return 'audio/*';
  if (/\.(doc|docx|rtf|odt)$/.test(rawName)) return 'application/msword';
  if (/\.(txt|md|csv|tsv|json|xml|html|htm|log)$/.test(rawName))
    return 'text/plain';
  return toLowerText(value.kind);
};

const inferMaterialKind = (value: {
  mime?: string | null;
  type?: string | null;
  name?: string | null;
  url?: string | null;
  kind?: string | null;
}) => {
  const mime = inferMaterialMimeType(value);
  if (mime.includes('image')) return 'image';
  if (mime.includes('video')) return 'video';
  if (mime.includes('audio')) return 'audio';
  return 'document';
};

const isPdfMimeType = (mime: string) => mime.includes('pdf');
const isWordMimeType = (mime: string) =>
  mime.includes('msword') ||
  mime.includes('wordprocessingml') ||
  mime.includes('officedocument') ||
  mime.includes('rtf') ||
  mime.includes('opendocument');
const isTextMimeType = (mime: string) =>
  mime.startsWith('text/') ||
  mime.includes('json') ||
  mime.includes('xml') ||
  mime.includes('csv') ||
  mime.includes('tsv') ||
  mime.includes('html') ||
  mime.includes('markdown');

const validateMaterialAsset = (asset: {
  type?: string | null;
  name?: string | null;
  uri?: string | null;
  kind?: string | null;
}) => {
  const mime = inferMaterialMimeType({
    mime: asset.type,
    name: asset.name,
    url: asset.uri,
    kind: asset.kind,
  });
  const kind = inferMaterialKind({
    mime,
    name: asset.name,
    url: asset.uri,
    kind: asset.kind,
  });
  if (kind === 'document' && !isPdfMimeType(mime)) {
    if (isWordMimeType(mime)) {
      throw new Error(
        'Word documents are not supported directly. Please convert the file to PDF before uploading.',
      );
    }
    if (isTextMimeType(mime)) {
      throw new Error(
        'Text-based files must be converted to PDF before uploading.',
      );
    }
    throw new Error(
      'Only PDF files are supported for document materials. Please upload a PDF, image, video, or audio file.',
    );
  }
  return { kind, mime };
};

const buildViewerSource = (uri?: string | null) => (uri ? { uri } : undefined);

export function EducationManagementModal(props: EducationManagementModalProps) {
  const { palette, title, subtitle, tierLabel, onOpenLandingBuilder } = props;

  const [hubData, setHubData] = useState<EducationHubPayload | null>(null);
  const [dashboardData, setDashboardData] =
    useState<EducationDashboardPayload | null>(null);
  const [hubLoading, setHubLoading] = useState(false);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hubError, setHubError] = useState<string | null>(null);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [selectedInstitutionId, setSelectedInstitutionId] = useState<
    string | null
  >(null);
  const [screen, setScreen] = useState<
    'hub' | 'form' | 'dashboard' | 'module' | 'detail'
  >('hub');
  const [editingInstitutionId, setEditingInstitutionId] = useState<
    string | null
  >(null);
  const [institutionForm, setInstitutionForm] =
    useState<InstitutionFormState>(EMPTY_FORM);
  const [institutionSubmitting, setInstitutionSubmitting] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [activeModuleKey, setActiveModuleKey] =
    useState<EducationModuleKey | null>(null);
  const [moduleRecords, setModuleRecords] = useState<any[]>([]);
  const [moduleLoading, setModuleLoading] = useState(false);
  const [moduleError, setModuleError] = useState<string | null>(null);
  const [moduleEditorVisible, setModuleEditorVisible] = useState(false);
  const [moduleSubmitting, setModuleSubmitting] = useState(false);
  const [editingModuleItemId, setEditingModuleItemId] = useState<string | null>(
    null,
  );
  const [moduleForm, setModuleForm] = useState<Record<string, any>>(
    emptyModuleForm(),
  );
  const [bookingStatusFilter, setBookingStatusFilter] = useState<
    'all' | 'pending' | 'confirmed' | 'waitlisted' | 'cancelled'
  >('all');
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailPayload, setDetailPayload] = useState<any | null>(null);
  const [detailRecordId, setDetailRecordId] = useState<string | null>(null);
  const [, setDetailStack] = useState<
    Array<{
      moduleKey: EducationModuleKey;
      payload: any;
      recordId: string | null;
    }>
  >([]);
  const [moduleLookups, setModuleLookups] = useState<{
    programs: any[];
    courses: any[];
    lessons: any[];
    classSessions: any[];
    assessments: any[];
    events: any[];
    materials: any[];
    broadcasts: any[];
    staffMemberships: any[];
  }>({
    programs: [],
    courses: [],
    lessons: [],
    classSessions: [],
    assessments: [],
    events: [],
    materials: [],
    broadcasts: [],
    staffMemberships: [],
  });
  const [courseModuleEditorVisible, setCourseModuleEditorVisible] =
    useState(false);
  const [courseModuleSubmitting, setCourseModuleSubmitting] = useState(false);
  const [editingCourseModuleId, setEditingCourseModuleId] = useState<
    string | null
  >(null);
  const [courseModuleForm, setCourseModuleForm] = useState<Record<string, any>>(
    emptyCourseModuleForm(),
  );
  const [courseModuleItemEditorVisible, setCourseModuleItemEditorVisible] =
    useState(false);
  const [editingCourseModuleItemId, setEditingCourseModuleItemId] = useState<
    string | null
  >(null);
  const [courseModuleItemForm, setCourseModuleItemForm] = useState<
    Record<string, any>
  >(emptyCourseModuleItemForm());
  const [contactsPickerOpen, setContactsPickerOpen] = useState(false);
  const [addingStaffMember, setAddingStaffMember] = useState(false);
  const [updatingStaffRole, setUpdatingStaffRole] = useState<string | null>(
    null,
  );

  const institutions = useMemo(
    () => hubData?.institutions ?? [],
    [hubData?.institutions],
  );
  const quickStats = useMemo(
    () => hubData?.quick_stats ?? {},
    [hubData?.quick_stats],
  );
  const selectedInstitution = useMemo(
    () =>
      institutions.find(row => row.id === selectedInstitutionId) ??
      dashboardData?.institution ??
      null,
    [dashboardData?.institution, institutions, selectedInstitutionId],
  );
  const currentEducationRole = useMemo(
    () =>
      toText(
        dashboardData?.current_membership?.role ||
          selectedInstitution?.current_membership?.role,
      ).toLowerCase(),
    [
      dashboardData?.current_membership?.role,
      selectedInstitution?.current_membership?.role,
    ],
  );
  const canInviteEducationStaff =
    currentEducationRole === 'owner' ||
    currentEducationRole === 'administrator' ||
    currentEducationRole === 'admin';
  const canManageEducationStaffRoles =
    currentEducationRole === 'owner' ||
    currentEducationRole === 'administrator';

  const fetchHub = useCallback(async () => {
    setHubLoading(true);
    try {
      const response = await getRequest(ROUTES.broadcasts.educationHub, {
        errorMessage: 'Unable to load education hub.',
        forceNetwork: true,
      });
      if (!response?.success) {
        throw new Error(response?.message || 'Unable to load education hub.');
      }
      const payload = (response.data ?? {}) as EducationHubPayload;
      setHubData(payload);
      setHubError(null);
      setSelectedInstitutionId(current => {
        if (current && payload?.institutions?.some(row => row.id === current))
          return current;
        return payload?.institutions?.[0]?.id ?? null;
      });
    } catch (error: any) {
      setHubError(error?.message || 'Unable to load education hub.');
    } finally {
      setHubLoading(false);
    }
  }, []);

  const fetchDashboard = useCallback(async (institutionId: string) => {
    setDashboardLoading(true);
    try {
      const response = await getRequest(
        ROUTES.broadcasts.educationInstitutionDashboard(institutionId),
        {
          errorMessage: 'Unable to load institution dashboard.',
          forceNetwork: true,
        },
      );
      if (!response?.success) {
        throw new Error(
          response?.message || 'Unable to load institution dashboard.',
        );
      }
      setDashboardData((response.data ?? {}) as EducationDashboardPayload);
      setDashboardError(null);
    } catch (error: any) {
      setDashboardData(null);
      setDashboardError(
        error?.message || 'Unable to load institution dashboard.',
      );
    } finally {
      setDashboardLoading(false);
    }
  }, []);

  const fetchModuleLookups = useCallback(async (institutionId: string) => {
    try {
      const [
        programsRes,
        coursesRes,
        lessonsRes,
        classRes,
        assessmentsRes,
        eventsRes,
        materialsRes,
        broadcastsRes,
        membershipsRes,
      ] = await Promise.all([
        getRequest(
          ROUTES.broadcasts.educationInstitutionPrograms(institutionId),
          { forceNetwork: true },
        ),
        getRequest(
          ROUTES.broadcasts.educationInstitutionCourses(institutionId),
          { forceNetwork: true },
        ),
        getRequest(
          ROUTES.broadcasts.educationInstitutionLessons(institutionId),
          { forceNetwork: true },
        ),
        getRequest(
          ROUTES.broadcasts.educationInstitutionClassSessions(institutionId),
          { forceNetwork: true },
        ),
        getRequest(
          ROUTES.broadcasts.educationInstitutionAssessments(institutionId),
          { forceNetwork: true },
        ),
        getRequest(
          ROUTES.broadcasts.educationInstitutionEvents(institutionId),
          { forceNetwork: true },
        ),
        getRequest(
          ROUTES.broadcasts.educationInstitutionMaterials(institutionId),
          { forceNetwork: true },
        ),
        getRequest(
          ROUTES.broadcasts.educationInstitutionBroadcasts(institutionId),
          { forceNetwork: true },
        ),
        getRequest(
          ROUTES.broadcasts.educationInstitutionMemberships(institutionId),
          { forceNetwork: true },
        ),
      ]);
      const memberships = membershipsRes?.success
        ? normalizeList(membershipsRes.data, 'memberships')
        : [];
      setModuleLookups({
        programs: programsRes?.success
          ? normalizeList(programsRes.data, 'programs')
          : [],
        courses: coursesRes?.success
          ? normalizeList(coursesRes.data, 'courses')
          : [],
        lessons: lessonsRes?.success
          ? normalizeList(lessonsRes.data, 'lessons')
          : [],
        classSessions: classRes?.success
          ? normalizeList(classRes.data, 'class_sessions')
          : [],
        assessments: assessmentsRes?.success
          ? normalizeList(assessmentsRes.data, 'assessments')
          : [],
        events: eventsRes?.success
          ? normalizeList(eventsRes.data, 'events')
          : [],
        materials: materialsRes?.success
          ? normalizeList(materialsRes.data, 'materials')
          : [],
        broadcasts: broadcastsRes?.success
          ? normalizeList(broadcastsRes.data, 'broadcasts')
          : [],
        staffMemberships: memberships.filter(
          (row: any) => row?.role && row.role !== 'student',
        ),
      });
    } catch {
      setModuleLookups({
        programs: [],
        courses: [],
        lessons: [],
        classSessions: [],
        assessments: [],
        events: [],
        materials: [],
        broadcasts: [],
        staffMemberships: [],
      });
    }
  }, []);

  const getModuleRoute = useCallback(
    (moduleKey: EducationModuleKey, institutionId: string) => {
      switch (moduleKey) {
        case 'programs':
          return ROUTES.broadcasts.educationInstitutionPrograms(institutionId);
        case 'courses':
          return ROUTES.broadcasts.educationInstitutionCourses(institutionId);
        case 'lessons':
          return ROUTES.broadcasts.educationInstitutionLessons(institutionId);
        case 'classes':
          return ROUTES.broadcasts.educationInstitutionClassSessions(
            institutionId,
          );
        case 'materials':
          return ROUTES.broadcasts.educationInstitutionMaterials(institutionId);
        case 'exams':
          return ROUTES.broadcasts.educationInstitutionAssessments(
            institutionId,
          );
        case 'events':
          return ROUTES.broadcasts.educationInstitutionEvents(institutionId);
        case 'memberships':
        case 'students':
        case 'staff':
          return ROUTES.broadcasts.educationInstitutionMemberships(
            institutionId,
          );
        case 'enrollments':
          return ROUTES.broadcasts.educationInstitutionEnrollments(
            institutionId,
          );
        case 'broadcasts':
          return ROUTES.broadcasts.educationInstitutionBroadcasts(
            institutionId,
          );
        case 'bookings':
          return ROUTES.broadcasts.educationInstitutionBookings(institutionId);
        default:
          return '';
      }
    },
    [],
  );

  const loadModuleRecords = useCallback(
    async (moduleKey: EducationModuleKey, institutionId: string) => {
      if (
        moduleKey === 'overview' ||
        moduleKey === 'analytics' ||
        moduleKey === 'settings'
      ) {
        setModuleRecords([]);
        setModuleError(null);
        return;
      }
      const route = getModuleRoute(moduleKey, institutionId);
      if (!route) return;
      setModuleLoading(true);
      try {
        const response = await getRequest(route, {
          forceNetwork: true,
          errorMessage: `Unable to load ${MODULE_LABELS[
            moduleKey
          ].toLowerCase()}.`,
        });
        if (!response?.success) {
          throw new Error(
            response?.message ||
              `Unable to load ${MODULE_LABELS[moduleKey].toLowerCase()}.`,
          );
        }
        let records = normalizeList(response.data, moduleListKey(moduleKey));
        if (moduleKey === 'students') {
          records = records.filter((row: any) => row?.role === 'student');
        } else if (moduleKey === 'staff') {
          records = records.filter((row: any) => row?.role !== 'student');
        }
        setModuleRecords(records);
        setModuleError(null);
      } catch (error: any) {
        setModuleRecords([]);
        setModuleError(
          error?.message ||
            `Unable to load ${MODULE_LABELS[moduleKey].toLowerCase()}.`,
        );
      } finally {
        setModuleLoading(false);
      }
    },
    [getModuleRoute],
  );

  useEffect(() => {
    void fetchHub();
  }, [fetchHub]);

  useEffect(() => {
    if (!selectedInstitutionId) {
      setDashboardData(null);
      return;
    }
    void fetchDashboard(selectedInstitutionId);
    void fetchModuleLookups(selectedInstitutionId);
  }, [fetchDashboard, fetchModuleLookups, selectedInstitutionId]);

  useEffect(() => {
    if (activeModuleKey !== 'bookings' && bookingStatusFilter !== 'all') {
      setBookingStatusFilter('all');
    }
  }, [activeModuleKey, bookingStatusFilter]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchHub();
      if (selectedInstitutionId) {
        await fetchDashboard(selectedInstitutionId);
      }
    } finally {
      setRefreshing(false);
    }
  }, [fetchDashboard, fetchHub, selectedInstitutionId]);

  const openCreateInstitution = useCallback(() => {
    setEditingInstitutionId(null);
    setInstitutionForm(EMPTY_FORM);
    setScreen('form');
  }, []);

  const openEditInstitution = useCallback(
    (institution?: EducationInstitution | null) => {
      if (!institution?.id) return;
      setEditingInstitutionId(institution.id);
      setInstitutionForm(buildInstitutionForm(institution));
      setScreen('form');
    },
    [],
  );

  const closeForm = useCallback(() => {
    setScreen('hub');
    setEditingInstitutionId(null);
    setInstitutionForm(EMPTY_FORM);
  }, []);

  const openDashboard = useCallback(
    (institution?: EducationInstitution | null) => {
      if (!institution?.id) return;
      setSelectedInstitutionId(institution.id);
      setScreen('dashboard');
    },
    [],
  );

  const closeDashboard = useCallback(() => {
    setScreen('hub');
  }, []);

  const openModule = useCallback(
    async (moduleKey: EducationModuleKey) => {
      if (!selectedInstitutionId) return;
      setActiveModuleKey(moduleKey);
      setModuleEditorVisible(false);
      setEditingModuleItemId(null);
      setModuleForm(emptyModuleForm());
      setScreen('module');
      await loadModuleRecords(moduleKey, selectedInstitutionId);
    },
    [loadModuleRecords, selectedInstitutionId],
  );

  const closeModule = useCallback(() => {
    setScreen('dashboard');
    setActiveModuleKey(null);
    setModuleEditorVisible(false);
    setEditingModuleItemId(null);
    setModuleForm(emptyModuleForm());
    setModuleError(null);
    setDetailPayload(null);
    setDetailRecordId(null);
    setDetailError(null);
    setDetailStack([]);
  }, []);

  const getDetailTargetId = useCallback(
    (moduleKey: EducationModuleKey, item: any) => {
      if (!item) return '';
      if (
        (moduleKey === 'memberships' ||
          moduleKey === 'students' ||
          moduleKey === 'staff') &&
        item?.membership_id
      ) {
        return String(item.membership_id);
      }
      return String(item?.id || '');
    },
    [],
  );

  const getModuleDetailRoute = useCallback(
    (moduleKey: EducationModuleKey, institutionId: string, item: any) => {
      const targetId = getDetailTargetId(moduleKey, item);
      if (!targetId) return '';
      switch (moduleKey) {
        case 'memberships':
          return item?.role === 'student'
            ? ROUTES.broadcasts.educationInstitutionStudentMembershipDetail(
                institutionId,
                targetId,
              )
            : ROUTES.broadcasts.educationInstitutionStaffMembershipDetail(
                institutionId,
                targetId,
              );
        case 'programs':
          return ROUTES.broadcasts.educationInstitutionProgramDetail(
            institutionId,
            targetId,
          );
        case 'courses':
          return ROUTES.broadcasts.educationInstitutionCourseDetail(
            institutionId,
            targetId,
          );
        case 'lessons':
          return ROUTES.broadcasts.educationInstitutionLessonDetail(
            institutionId,
            targetId,
          );
        case 'classes':
          return ROUTES.broadcasts.educationInstitutionClassSessionDetail(
            institutionId,
            targetId,
          );
        case 'materials':
          return ROUTES.broadcasts.educationInstitutionMaterial(
            institutionId,
            targetId,
          );
        case 'exams':
          return ROUTES.broadcasts.educationInstitutionAssessment(
            institutionId,
            targetId,
          );
        case 'events':
          return ROUTES.broadcasts.educationInstitutionEvent(
            institutionId,
            targetId,
          );
        case 'broadcasts':
          return ROUTES.broadcasts.educationInstitutionBroadcast(
            institutionId,
            targetId,
          );
        case 'enrollments':
          return ROUTES.broadcasts.educationInstitutionEnrollmentDetail(
            institutionId,
            targetId,
          );
        case 'bookings':
          return ROUTES.broadcasts.educationInstitutionBookingDetail(
            institutionId,
            targetId,
          );
        case 'students':
          return ROUTES.broadcasts.educationInstitutionStudentMembershipDetail(
            institutionId,
            targetId,
          );
        case 'staff':
          return ROUTES.broadcasts.educationInstitutionStaffMembershipDetail(
            institutionId,
            targetId,
          );
        default:
          return '';
      }
    },
    [getDetailTargetId],
  );

  const openDetailForModule = useCallback(
    async (
      moduleKey: EducationModuleKey,
      item: any,
      nested: boolean = false,
    ) => {
      if (!selectedInstitutionId) return;
      const route = getModuleDetailRoute(
        moduleKey,
        selectedInstitutionId,
        item,
      );
      if (!route) return;
      const previousSnapshot =
        nested && activeModuleKey && detailPayload
          ? {
              moduleKey: activeModuleKey,
              payload: detailPayload,
              recordId: detailRecordId,
            }
          : null;
      if (previousSnapshot) {
        setDetailStack(prev => [...prev, previousSnapshot]);
      } else if (!nested) {
        setDetailStack([]);
      }
      setDetailLoading(true);
      setDetailError(null);
      setDetailPayload(null);
      setDetailRecordId(getDetailTargetId(moduleKey, item) || null);
      setActiveModuleKey(moduleKey);
      setScreen('detail');
      try {
        const response = await getRequest(route, {
          forceNetwork: true,
          errorMessage: `Unable to load ${MODULE_LABELS[
            moduleKey
          ].toLowerCase()} details.`,
        });
        if (!response?.success) {
          throw new Error(
            response?.message ||
              `Unable to load ${MODULE_LABELS[
                moduleKey
              ].toLowerCase()} details.`,
          );
        }
        setDetailPayload(response.data ?? null);
      } catch (error: any) {
        if (previousSnapshot) {
          setDetailStack(prev => prev.slice(0, -1));
          setActiveModuleKey(previousSnapshot.moduleKey);
          setDetailPayload(previousSnapshot.payload);
          setDetailRecordId(previousSnapshot.recordId);
        }
        setDetailError(
          error?.message ||
            `Unable to load ${MODULE_LABELS[moduleKey].toLowerCase()} details.`,
        );
      } finally {
        setDetailLoading(false);
      }
    },
    [
      activeModuleKey,
      detailPayload,
      detailRecordId,
      getDetailTargetId,
      getModuleDetailRoute,
      selectedInstitutionId,
    ],
  );

  const openModuleDetail = useCallback(
    async (item: any) => {
      if (!activeModuleKey) return;
      await openDetailForModule(activeModuleKey, item, false);
    },
    [activeModuleKey, openDetailForModule],
  );

  const closeDetail = useCallback(() => {
    setDetailError(null);
    setDetailLoading(false);
    setDetailStack(prev => {
      if (!prev.length) {
        setScreen('module');
        setDetailPayload(null);
        setDetailRecordId(null);
        return prev;
      }
      const next = [...prev];
      const previous = next.pop();
      if (previous) {
        setActiveModuleKey(previous.moduleKey);
        setDetailPayload(previous.payload);
        setDetailRecordId(previous.recordId);
        setScreen('detail');
      }
      return next;
    });
  }, []);

  const openModuleEditor = useCallback((item?: any | null) => {
    const next = emptyModuleForm();
    if (item) {
      next.title = toText(item.title);
      next.name = toText(item.name);
      next.code = toText(item.code);
      next.summary = toText(item.summary);
      next.description = toText(item.description);
      next.content = toText(item.content);
      next.status = toText(item.status);
      next.program_id = toText(item.program_id);
      next.course_id = toText(item.course_id);
      next.lesson_id = toText(item.lesson_id);
      next.class_session_id = toText(item.class_session_id);
      next.assessment_id = toText(item.assessment_id);
      next.program_ids = Array.isArray(item.program_ids)
        ? item.program_ids.map((value: any) => toText(value)).filter(Boolean)
        : toText(item.program_id)
        ? [toText(item.program_id)]
        : [];
      next.course_ids = Array.isArray(item.course_ids)
        ? item.course_ids.map((value: any) => toText(value)).filter(Boolean)
        : toText(item.course_id)
        ? [toText(item.course_id)]
        : [];
      next.lesson_ids = Array.isArray(item.lesson_ids)
        ? item.lesson_ids.map((value: any) => toText(value)).filter(Boolean)
        : toText(item.lesson_id)
        ? [toText(item.lesson_id)]
        : [];
      next.class_session_ids = Array.isArray(item.class_session_ids)
        ? item.class_session_ids
            .map((value: any) => toText(value))
            .filter(Boolean)
        : toText(item.class_session_id)
        ? [toText(item.class_session_id)]
        : [];
      next.assessment_ids = Array.isArray(item.assessment_ids)
        ? item.assessment_ids.map((value: any) => toText(value)).filter(Boolean)
        : toText(item.assessment_id)
        ? [toText(item.assessment_id)]
        : [];
      next.event_id = toText(item.event_id);
      next.starts_at = toText(item.starts_at);
      next.ends_at = toText(item.ends_at);
      next.timezone_name = toText(item.timezone_name) || 'UTC';
      next.delivery_mode = toText(item.delivery_mode) || 'online';
      next.location_text = toText(item.location_text);
      next.meeting_url = toText(item.meeting_url);
      next.seat_limit = toText(item.seat_limit);
      next.cover_image_url = resolveEducationCoverImage(item);
      next.cover_image_preview_uri = resolveEducationCoverImage(item);
      next.cover_image_asset = null;
      next.resource_url = toText(item.resource_url);
      next.resource_name = toText(
        item.resource_name || item.name || item.file_name,
      );
      next.resource_type = toText(item.resource_type || item.mime_type);
      next.resource_asset = null;
      next.kind = toText(item.kind) || 'document';
      next.is_downloadable = Boolean(item.is_downloadable);
      next.assessment_type = toText(item.assessment_type) || 'mcq';
      next.duration_minutes = toText(item.duration_minutes);
      next.max_attempts = toText(item.max_attempts);
      next.passing_score_percent = toText(item.passing_score_percent);
      next.lesson_order = toText(item.lesson_order);
      next.is_preview = Boolean(item.is_preview);
      next.instructions = toText(item.instructions);
      next.event_type = toText(item.event_type) || 'event';
      next.broadcast_kind = toText(item.broadcast_kind) || 'course';
      next.booking_enabled = Boolean(item.booking_enabled);
      next.price_amount = toText(item.price_amount);
      next.price_currency = toText(item.price_currency) || 'KISC';
    }
    setEditingModuleItemId(item?.id ?? null);
    setModuleForm(next);
    setModuleEditorVisible(true);
  }, []);

  const openModuleEditorForModule = useCallback(
    async (moduleKey: EducationModuleKey, item?: any | null) => {
      if (!selectedInstitutionId) return;
      setActiveModuleKey(moduleKey);
      setScreen('module');
      await loadModuleRecords(moduleKey, selectedInstitutionId);
      openModuleEditor(item);
    },
    [loadModuleRecords, openModuleEditor, selectedInstitutionId],
  );

  const findAssociatedBroadcast = useCallback(
    (sourceModule: EducationModuleKey, item: any) => {
      const itemId = toText(item?.id);
      if (!itemId) return null;
      return (
        moduleLookups.broadcasts.find((broadcast: any) => {
          switch (sourceModule) {
            case 'programs':
              return toText(broadcast?.program_id) === itemId;
            case 'courses':
              return toText(broadcast?.course_id) === itemId;
            case 'lessons':
              return toText(broadcast?.lesson_id) === itemId;
            case 'classes':
              return toText(broadcast?.class_session_id) === itemId;
            case 'events':
              return toText(broadcast?.event_id) === itemId;
            default:
              return false;
          }
        }) ?? null
      );
    },
    [moduleLookups.broadcasts],
  );

  const openBroadcastComposerForItem = useCallback(
    (sourceModule: EducationModuleKey, item: any) => {
      if (!selectedInstitutionId || !item?.id) return;
      const existingBroadcast = findAssociatedBroadcast(sourceModule, item);
      const next = emptyModuleForm();
      if (existingBroadcast) {
        next.title = toText(
          existingBroadcast.title || item.title || item.name || 'Untitled',
        );
        next.summary = toText(existingBroadcast.summary || item.summary);
        next.description = toText(
          existingBroadcast.description || item.description || item.content,
        );
        next.broadcast_kind =
          toText(existingBroadcast.broadcast_kind) || 'course';
        next.program_id = toText(
          existingBroadcast.program_id || item.program_id,
        );
        next.course_id = toText(existingBroadcast.course_id || item.course_id);
        next.lesson_id = toText(existingBroadcast.lesson_id || item.lesson_id);
        next.class_session_id = toText(
          existingBroadcast.class_session_id || item.class_session_id,
        );
        next.event_id = toText(existingBroadcast.event_id || item.event_id);
        next.starts_at = toText(existingBroadcast.starts_at || item.starts_at);
        next.ends_at = toText(existingBroadcast.ends_at || item.ends_at);
        next.timezone_name =
          toText(existingBroadcast.timezone_name || item.timezone_name) ||
          'UTC';
        next.seat_limit = toText(
          existingBroadcast.seat_limit || item.seat_limit,
        );
        next.booking_enabled = Boolean(existingBroadcast.booking_enabled);
        next.price_amount = toText(existingBroadcast.price_amount);
        next.price_currency =
          toText(existingBroadcast.price_currency) || 'KISC';
        next.status = isArchivedEducationStatus(existingBroadcast.status)
          ? 'published'
          : toText(existingBroadcast.status) || 'published';
      } else {
        next.title = `Broadcast: ${toText(
          item.title || item.name || 'Untitled',
        )}`;
        next.summary = toText(item.summary);
        next.description = toText(item.description || item.content);
        next.starts_at = toText(item.starts_at);
        next.ends_at = toText(item.ends_at);
        next.timezone_name = toText(item.timezone_name) || 'UTC';
        next.seat_limit = toText(item.seat_limit);
        next.price_currency = 'KISC';
        switch (sourceModule) {
          case 'programs':
            next.broadcast_kind = 'program';
            next.program_id = toText(item.id);
            break;
          case 'courses':
            next.broadcast_kind = 'course';
            next.program_id = toText(item.program_id);
            next.course_id = toText(item.id);
            next.seat_limit = toText(item.seat_limit);
            break;
          case 'lessons':
            next.broadcast_kind = 'lesson';
            next.course_id = toText(item.course_id);
            next.lesson_id = toText(item.id);
            break;
          case 'classes':
            next.broadcast_kind = 'class_session';
            next.course_id = toText(item.course_id);
            next.lesson_id = toText(item.lesson_id);
            next.class_session_id = toText(item.id);
            break;
          case 'events':
            next.broadcast_kind =
              toText(item.event_type) === 'training_session'
                ? 'training_session'
                : 'event';
            next.program_id = toText(item.program_id);
            next.course_id = toText(item.course_id);
            next.class_session_id = toText(item.class_session_id);
            next.event_id = toText(item.id);
            break;
          default:
            return;
        }
      }
      setActiveModuleKey('broadcasts');
      setScreen('module');
      setEditingModuleItemId(existingBroadcast?.id ?? null);
      setModuleForm(next);
      setModuleEditorVisible(true);
      void loadModuleRecords('broadcasts', selectedInstitutionId);
    },
    [findAssociatedBroadcast, loadModuleRecords, selectedInstitutionId],
  );

  const handleArchiveBroadcast = useCallback(
    async (broadcast: any, sourceLabel?: string) => {
      if (!selectedInstitutionId || !broadcast?.id) return;
      Alert.alert(
        'Remove broadcast',
        'This broadcast will be marked as removed and hidden from the education broadcast tab until you publish it again.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: async () => {
              try {
                const response = await patchRequest(
                  ROUTES.broadcasts.educationInstitutionBroadcast(
                    selectedInstitutionId,
                    broadcast.id,
                  ),
                  { status: 'archived' },
                  { errorMessage: 'Unable to remove broadcast.' },
                );
                if (!response?.success) {
                  throw new Error(
                    response?.message || 'Unable to remove broadcast.',
                  );
                }
                await fetchModuleLookups(selectedInstitutionId);
                if (activeModuleKey) {
                  await loadModuleRecords(
                    activeModuleKey,
                    selectedInstitutionId,
                  );
                }
                await fetchDashboard(selectedInstitutionId);
                if (screen === 'detail' && activeModuleKey === 'broadcasts') {
                  await openDetailForModule(
                    'broadcasts',
                    { id: broadcast.id },
                    false,
                  );
                }
                Alert.alert(
                  sourceLabel || 'Broadcasts',
                  'Broadcast marked as removed. You can publish it again later by editing the saved record.',
                );
              } catch (error: any) {
                Alert.alert(
                  sourceLabel || 'Broadcasts',
                  error?.message || 'Unable to remove broadcast.',
                );
              }
            },
          },
        ],
      );
    },
    [
      activeModuleKey,
      fetchDashboard,
      fetchModuleLookups,
      loadModuleRecords,
      openDetailForModule,
      screen,
      selectedInstitutionId,
    ],
  );

  const closeModuleEditor = useCallback(() => {
    setModuleEditorVisible(false);
    setEditingModuleItemId(null);
    setModuleForm(emptyModuleForm());
  }, []);

  const handlePickMaterialResource = useCallback(async () => {
    try {
      const normalizedKind = toText(moduleForm.kind).toLowerCase();
      if (normalizedKind === 'image') {
        const result = await launchImageLibrary({
          mediaType: 'photo',
          selectionLimit: 1,
          quality: 1,
        });
        if (result.didCancel || !result.assets?.length) return;
        const asset = result.assets[0];
        if (!asset?.uri) throw new Error('Please pick a valid image.');
        const { kind, mime } = validateMaterialAsset({
          uri: asset.uri,
          type: asset.type,
          name: asset.fileName,
          kind: normalizedKind,
        });
        setModuleForm(prev => ({
          ...prev,
          resource_asset: asset,
          resource_url: asset.uri,
          resource_name: asset.fileName || 'image',
          resource_type: mime || asset.type || 'image/jpeg',
          kind,
        }));
        return;
      }
      if (normalizedKind === 'video') {
        const result = await launchImageLibrary({
          mediaType: 'video',
          selectionLimit: 1,
        });
        if (result.didCancel || !result.assets?.length) return;
        const asset = result.assets[0];
        if (!asset?.uri) throw new Error('Please pick a valid video.');
        const { kind, mime } = validateMaterialAsset({
          uri: asset.uri,
          type: asset.type,
          name: asset.fileName,
          kind: normalizedKind,
        });
        setModuleForm(prev => ({
          ...prev,
          resource_asset: asset,
          resource_url: asset.uri,
          resource_name: asset.fileName || 'video',
          resource_type: mime || asset.type || 'video/mp4',
          kind,
        }));
        return;
      }
      const document = await DocumentPicker.pickSingle({
        type:
          normalizedKind === 'audio'
            ? [DocumentPicker.types.audio]
            : [DocumentPicker.types.allFiles],
        copyTo: 'documentDirectory',
      });
      const persistedDocumentUri =
        document.fileCopyUri || (await persistEducationMaterialFile(document));
      const pickedDocumentUri = persistedDocumentUri || document.uri;
      if (!pickedDocumentUri) throw new Error('Please pick a valid file.');
      const { kind, mime } = validateMaterialAsset({
        uri: pickedDocumentUri,
        type: document.type,
        name: document.name,
        kind: normalizedKind,
      });
      setModuleForm(prev => ({
        ...prev,
        resource_asset: {
          ...document,
          uri: pickedDocumentUri,
          fileCopyUri: pickedDocumentUri,
        },
        resource_url: pickedDocumentUri,
        resource_name: document.name || 'attachment',
        resource_type: mime || document.type || 'application/octet-stream',
        kind,
      }));
    } catch (error: any) {
      if (DocumentPicker.isCancel?.(error)) return;
      Alert.alert('Materials', error?.message || 'Unable to pick file.');
    }
  }, [moduleForm.kind]);

  const handleSaveInstitution = useCallback(async () => {
    const trimmedName = institutionForm.name.trim();
    if (!trimmedName) {
      Alert.alert('Institution', 'Institution name is required.');
      return;
    }
    setInstitutionSubmitting(true);
    try {
      if (institutionForm.logoAsset) {
        setLogoUploading(true);
      }
      const logoUrl = institutionForm.logoAsset
        ? await uploadInstitutionLogo(institutionForm.logoAsset)
        : institutionForm.logoUrl.trim();
      const payload = {
        name: trimmedName,
        description: institutionForm.description.trim() || undefined,
        branding: {
          logo_url: logoUrl || '',
        },
      };
      const response = editingInstitutionId
        ? await patchRequest(
            ROUTES.broadcasts.educationInstitution(editingInstitutionId),
            payload,
            {
              errorMessage: 'Unable to update institution.',
            },
          )
        : await postRequest(ROUTES.broadcasts.educationInstitutions, payload, {
            errorMessage: 'Unable to create institution.',
          });
      if (!response?.success) {
        throw new Error(response?.message || 'Unable to save institution.');
      }
      const institutionId =
        response?.data?.institution?.id ??
        response?.data?.id ??
        editingInstitutionId ??
        null;
      await fetchHub();
      if (institutionId) {
        setSelectedInstitutionId(institutionId);
        await fetchDashboard(institutionId);
      }
      closeForm();
      Alert.alert(
        'Institution',
        editingInstitutionId ? 'Institution updated.' : 'Institution created.',
      );
    } catch (error: any) {
      Alert.alert(
        'Institution',
        error?.message || 'Unable to save institution.',
      );
    } finally {
      setLogoUploading(false);
      setInstitutionSubmitting(false);
    }
  }, [
    closeForm,
    editingInstitutionId,
    fetchDashboard,
    fetchHub,
    institutionForm,
  ]);

  const handlePickInstitutionLogo = useCallback(async () => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 1,
        selectionLimit: 1,
      });
      if (result.didCancel) return;
      const asset = result.assets?.[0];
      if (!asset?.uri) {
        throw new Error('Please pick a valid image.');
      }
      setInstitutionForm(prev => ({
        ...prev,
        logoAsset: asset,
        logoPreviewUri: asset.uri || '',
        logoUrl: prev.logoAsset ? '' : prev.logoUrl,
      }));
    } catch (error: any) {
      Alert.alert(
        'Institution logo',
        error?.message || 'Unable to pick institution logo.',
      );
    }
  }, []);

  const handlePickModuleCoverImage = useCallback(async () => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 1,
        selectionLimit: 1,
      });
      if (result.didCancel) return;
      const asset = result.assets?.[0];
      if (!asset?.uri) {
        throw new Error('Please pick a valid image.');
      }
      setModuleForm(prev => ({
        ...prev,
        cover_image_asset: asset,
        cover_image_preview_uri: asset.uri || '',
        cover_image_url: prev.cover_image_asset ? '' : prev.cover_image_url,
      }));
    } catch (error: any) {
      Alert.alert(
        'Module image',
        error?.message || 'Unable to pick module image.',
      );
    }
  }, []);

  const handleDeleteInstitution = useCallback(
    (institution?: EducationInstitution | null) => {
      if (!institution?.id) return;
      Alert.alert(
        'Delete institution',
        `Delete ${institution.name || 'this institution'}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              setInstitutionSubmitting(true);
              try {
                const response = await deleteRequest(
                  ROUTES.broadcasts.educationInstitution(institution.id),
                  {
                    errorMessage: 'Unable to delete institution.',
                  },
                );
                if (!response?.success) {
                  throw new Error(
                    response?.message || 'Unable to delete institution.',
                  );
                }
                if (selectedInstitutionId === institution.id) {
                  setSelectedInstitutionId(null);
                  setDashboardData(null);
                }
                await fetchHub();
                Alert.alert('Institution', 'Institution deleted.');
              } catch (error: any) {
                Alert.alert(
                  'Institution',
                  error?.message || 'Unable to delete institution.',
                );
              } finally {
                setInstitutionSubmitting(false);
              }
            },
          },
        ],
      );
    },
    [fetchHub, selectedInstitutionId],
  );

  const handleSaveModuleRecord = useCallback(async () => {
    if (!selectedInstitutionId || !activeModuleKey) return;
    const trimmedTitle = toText(moduleForm.title || moduleForm.name);
    const parseOptionalInt = (value: any) => {
      const numeric = Number(value);
      return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
    };
    let coverImageUrl = toText(moduleForm.cover_image_url);
    if (
      IMAGE_ENABLED_EDUCATION_MODULES.includes(activeModuleKey) &&
      moduleForm.cover_image_asset
    ) {
      coverImageUrl = await uploadEducationAttachment(
        moduleForm.cover_image_asset,
        'education_module_cover_image',
      );
    }
    let payload: Record<string, any> = {};
    let createRoute = '';
    let detailRoute = '';
    switch (activeModuleKey) {
      case 'programs':
        if (!trimmedTitle)
          return Alert.alert('Programs', 'Program title is required.');
        payload = {
          title: trimmedTitle,
          code: toText(moduleForm.code),
          summary: toText(moduleForm.summary),
          description: toText(moduleForm.description),
          cover_image_url: coverImageUrl,
          status: toText(moduleForm.status) || 'draft',
        };
        createRoute = ROUTES.broadcasts.educationInstitutionPrograms(
          selectedInstitutionId,
        );
        detailRoute = editingModuleItemId
          ? ROUTES.broadcasts.educationInstitutionProgram(
              selectedInstitutionId,
              editingModuleItemId,
            )
          : '';
        break;
      case 'courses':
        if (!trimmedTitle)
          return Alert.alert('Courses', 'Course title is required.');
        payload = {
          title: trimmedTitle,
          code: toText(moduleForm.code),
          summary: toText(moduleForm.summary),
          description: toText(moduleForm.description),
          cover_image_url: coverImageUrl,
          status: toText(moduleForm.status) || 'draft',
          duration_minutes: Number(moduleForm.duration_minutes || 0) || 0,
          seat_limit: parseOptionalInt(moduleForm.seat_limit),
          program_id: toText(moduleForm.program_id) || undefined,
        };
        createRoute = ROUTES.broadcasts.educationInstitutionCourses(
          selectedInstitutionId,
        );
        detailRoute = editingModuleItemId
          ? ROUTES.broadcasts.educationInstitutionCourse(
              selectedInstitutionId,
              editingModuleItemId,
            )
          : '';
        break;
      case 'lessons':
        if (!trimmedTitle)
          return Alert.alert('Lessons', 'Lesson title is required.');
        if (!toText(moduleForm.course_id))
          return Alert.alert('Lessons', 'Select a course first.');
        payload = {
          title: trimmedTitle,
          summary: toText(moduleForm.summary),
          content: toText(moduleForm.content),
          cover_image_url: coverImageUrl,
          status: toText(moduleForm.status) || 'draft',
          lesson_order: Number(moduleForm.lesson_order || 0) || 0,
          duration_minutes: Number(moduleForm.duration_minutes || 0) || 0,
          is_preview: Boolean(moduleForm.is_preview),
          course_id: toText(moduleForm.course_id),
        };
        createRoute = ROUTES.broadcasts.educationInstitutionLessons(
          selectedInstitutionId,
        );
        detailRoute = editingModuleItemId
          ? ROUTES.broadcasts.educationInstitutionLesson(
              selectedInstitutionId,
              editingModuleItemId,
            )
          : '';
        break;
      case 'classes':
        if (!trimmedTitle)
          return Alert.alert('Classes', 'Class session title is required.');
        if (!toText(moduleForm.starts_at) || !toText(moduleForm.ends_at)) {
          return Alert.alert('Classes', 'Starts at and ends at are required.');
        }
        payload = {
          title: trimmedTitle,
          summary: toText(moduleForm.summary),
          cover_image_url: coverImageUrl,
          starts_at: toText(moduleForm.starts_at),
          ends_at: toText(moduleForm.ends_at),
          timezone_name: toText(moduleForm.timezone_name) || 'UTC',
          delivery_mode: toText(moduleForm.delivery_mode) || 'online',
          location_text: toText(moduleForm.location_text),
          meeting_url: toText(moduleForm.meeting_url),
          seat_limit: parseOptionalInt(moduleForm.seat_limit),
          status: toText(moduleForm.status) || 'scheduled',
          course_id: toText(moduleForm.course_id) || undefined,
          lesson_id: toText(moduleForm.lesson_id) || undefined,
        };
        createRoute = ROUTES.broadcasts.educationInstitutionClassSessions(
          selectedInstitutionId,
        );
        detailRoute = editingModuleItemId
          ? ROUTES.broadcasts.educationInstitutionClassSession(
              selectedInstitutionId,
              editingModuleItemId,
            )
          : '';
        break;
      case 'materials':
        if (!trimmedTitle)
          return Alert.alert('Materials', 'Material title is required.');
        {
          const normalizedMime = inferMaterialMimeType({
            mime: moduleForm.resource_type,
            name: moduleForm.resource_name,
            url: moduleForm.resource_url,
            kind: moduleForm.kind,
          });
          const normalizedKind = inferMaterialKind({
            mime: normalizedMime,
            name: moduleForm.resource_name,
            url: moduleForm.resource_url,
            kind: moduleForm.kind,
          });
          validateMaterialAsset({
            uri: moduleForm.resource_url,
            type: normalizedMime,
            name: moduleForm.resource_name,
            kind: normalizedKind,
          });
          let resourceUrl = toText(moduleForm.resource_url);
          if (moduleForm.resource_asset) {
            resourceUrl = await uploadEducationAttachment(
              moduleForm.resource_asset,
              'education_material',
            );
          }
          payload = {
            title: trimmedTitle,
            summary: toText(moduleForm.summary),
            cover_image_url: coverImageUrl,
            kind: normalizedKind || 'document',
            resource_url: resourceUrl,
            resource_name: toText(moduleForm.resource_name),
            resource_mime_type: normalizedMime,
            is_downloadable: Boolean(moduleForm.is_downloadable),
            status: toText(moduleForm.status) || 'draft',
            program_ids: Array.isArray(moduleForm.program_ids)
              ? moduleForm.program_ids.filter(Boolean)
              : [],
            course_ids: Array.isArray(moduleForm.course_ids)
              ? moduleForm.course_ids.filter(Boolean)
              : [],
            lesson_ids: Array.isArray(moduleForm.lesson_ids)
              ? moduleForm.lesson_ids.filter(Boolean)
              : [],
            class_session_ids: Array.isArray(moduleForm.class_session_ids)
              ? moduleForm.class_session_ids.filter(Boolean)
              : [],
            assessment_ids: Array.isArray(moduleForm.assessment_ids)
              ? moduleForm.assessment_ids.filter(Boolean)
              : [],
          };
        }
        createRoute = ROUTES.broadcasts.educationInstitutionMaterials(
          selectedInstitutionId,
        );
        detailRoute = editingModuleItemId
          ? ROUTES.broadcasts.educationInstitutionMaterial(
              selectedInstitutionId,
              editingModuleItemId,
            )
          : '';
        break;
      case 'exams':
        if (!trimmedTitle)
          return Alert.alert('Exams', 'Assessment title is required.');
        payload = {
          title: trimmedTitle,
          summary: toText(moduleForm.summary),
          instructions: toText(moduleForm.instructions),
          cover_image_url: coverImageUrl,
          assessment_type: toText(moduleForm.assessment_type) || 'mcq',
          status: toText(moduleForm.status) || 'draft',
          duration_minutes: Number(moduleForm.duration_minutes || 0) || 0,
          max_attempts: Number(moduleForm.max_attempts || 1) || 1,
          passing_score_percent:
            Number(moduleForm.passing_score_percent || 0) || 0,
          course_id: toText(moduleForm.course_id) || undefined,
          lesson_id: toText(moduleForm.lesson_id) || undefined,
          class_session_id: toText(moduleForm.class_session_id) || undefined,
          starts_at: toText(moduleForm.starts_at) || undefined,
          ends_at: toText(moduleForm.ends_at) || undefined,
        };
        createRoute = ROUTES.broadcasts.educationInstitutionAssessments(
          selectedInstitutionId,
        );
        detailRoute = editingModuleItemId
          ? ROUTES.broadcasts.educationInstitutionAssessment(
              selectedInstitutionId,
              editingModuleItemId,
            )
          : '';
        break;
      case 'events':
        if (!trimmedTitle)
          return Alert.alert('Events', 'Event title is required.');
        if (!toText(moduleForm.starts_at) || !toText(moduleForm.ends_at)) {
          return Alert.alert('Events', 'Starts at and ends at are required.');
        }
        payload = {
          title: trimmedTitle,
          summary: toText(moduleForm.summary),
          description: toText(moduleForm.description),
          cover_image_url: coverImageUrl,
          event_type: toText(moduleForm.event_type) || 'event',
          starts_at: toText(moduleForm.starts_at),
          ends_at: toText(moduleForm.ends_at),
          timezone_name: toText(moduleForm.timezone_name) || 'UTC',
          delivery_mode: toText(moduleForm.delivery_mode) || 'online',
          location_text: toText(moduleForm.location_text),
          meeting_url: toText(moduleForm.meeting_url),
          seat_limit: parseOptionalInt(moduleForm.seat_limit),
          status: toText(moduleForm.status) || 'draft',
          program_id: toText(moduleForm.program_id) || undefined,
          course_id: toText(moduleForm.course_id) || undefined,
          class_session_id: toText(moduleForm.class_session_id) || undefined,
        };
        createRoute = ROUTES.broadcasts.educationInstitutionEvents(
          selectedInstitutionId,
        );
        detailRoute = editingModuleItemId
          ? ROUTES.broadcasts.educationInstitutionEvent(
              selectedInstitutionId,
              editingModuleItemId,
            )
          : '';
        break;
      case 'broadcasts':
        if (!trimmedTitle)
          return Alert.alert('Broadcasts', 'Broadcast title is required.');
        payload = {
          title: trimmedTitle,
          summary: toText(moduleForm.summary),
          description: toText(moduleForm.description),
          broadcast_kind: toText(moduleForm.broadcast_kind) || 'course',
          program_id: toText(moduleForm.program_id) || undefined,
          course_id: toText(moduleForm.course_id) || undefined,
          lesson_id: toText(moduleForm.lesson_id) || undefined,
          class_session_id: toText(moduleForm.class_session_id) || undefined,
          event_id: toText(moduleForm.event_id) || undefined,
          starts_at: toText(moduleForm.starts_at) || undefined,
          ends_at: toText(moduleForm.ends_at) || undefined,
          timezone_name: toText(moduleForm.timezone_name) || 'UTC',
          seat_limit: parseOptionalInt(moduleForm.seat_limit),
          booking_enabled: Boolean(moduleForm.booking_enabled),
          price_amount: toText(moduleForm.price_amount) || undefined,
          price_currency: toText(moduleForm.price_currency) || 'KISC',
          status: toText(moduleForm.status) || 'published',
        };
        createRoute = ROUTES.broadcasts.educationInstitutionBroadcasts(
          selectedInstitutionId,
        );
        detailRoute = editingModuleItemId
          ? ROUTES.broadcasts.educationInstitutionBroadcast(
              selectedInstitutionId,
              editingModuleItemId,
            )
          : '';
        break;
      default:
        return;
    }
    setModuleSubmitting(true);
    try {
      const response = editingModuleItemId
        ? await patchRequest(detailRoute, payload, {
            errorMessage: `Unable to update ${MODULE_LABELS[
              activeModuleKey
            ].toLowerCase()}.`,
          })
        : await postRequest(createRoute, payload, {
            errorMessage: `Unable to create ${MODULE_LABELS[
              activeModuleKey
            ].toLowerCase()}.`,
          });
      if (!response?.success) {
        throw new Error(
          response?.message ||
            `Unable to save ${MODULE_LABELS[activeModuleKey].toLowerCase()}.`,
        );
      }
      await fetchModuleLookups(selectedInstitutionId);
      await loadModuleRecords(activeModuleKey, selectedInstitutionId);
      await fetchDashboard(selectedInstitutionId);
      closeModuleEditor();
    } catch (error: any) {
      Alert.alert(
        MODULE_LABELS[activeModuleKey],
        error?.message || 'Unable to save item.',
      );
    } finally {
      setModuleSubmitting(false);
    }
  }, [
    activeModuleKey,
    closeModuleEditor,
    editingModuleItemId,
    fetchDashboard,
    fetchModuleLookups,
    loadModuleRecords,
    moduleForm,
    selectedInstitutionId,
  ]);

  const renderMaterialPreviewCard = useCallback(
    (material: any) => {
      const resourceUrl = toText(material?.resource_url);
      const mime = inferMaterialMimeType({
        mime:
          material?.resource_mime_type ||
          material?.resource_type ||
          material?.mime_type,
        name: material?.resource_name || material?.name || material?.title,
        url: resourceUrl,
        kind: material?.kind,
      });
      const kind = inferMaterialKind({
        mime,
        name: material?.resource_name || material?.name,
        url: resourceUrl,
        kind: material?.kind,
      });
      const videoSource = buildViewerSource(resourceUrl);
      const pdfSource = buildViewerSource(resourceUrl);
      const imageSource = buildViewerSource(resourceUrl);

      return (
        <View
          style={{
            gap: 10,
            borderWidth: 1,
            borderColor: palette.divider,
            borderRadius: 20,
            padding: 14,
            backgroundColor: palette.surface,
          }}
        >
          <View style={{ gap: 4 }}>
            <Text
              style={{ color: palette.text, fontWeight: '900', fontSize: 16 }}
            >
              {toText(material?.title || material?.resource_name) || 'Material'}
            </Text>
            <Text style={{ color: palette.subtext, fontSize: 12 }}>
              {[
                toText(kind || 'document'),
                toText(material?.resource_name),
                toText(mime),
              ]
                .filter(Boolean)
                .join(' • ')}
            </Text>
            {toText(material?.summary || material?.description) ? (
              <Text style={{ color: palette.subtext, lineHeight: 18 }}>
                {toText(material?.summary || material?.description)}
              </Text>
            ) : null}
          </View>

          {resourceUrl && kind === 'image' ? (
            <Image
              source={imageSource}
              style={{
                width: '100%',
                height: 220,
                borderRadius: 18,
                backgroundColor: palette.background,
              }}
              resizeMode="contain"
            />
          ) : null}
          {resourceUrl && kind === 'video' ? (
            <Video
              source={videoSource}
              style={{
                width: '100%',
                height: 220,
                borderRadius: 18,
                backgroundColor: '#000',
              }}
              controls
            />
          ) : null}
          {resourceUrl && kind === 'audio' ? (
            <Video
              source={videoSource}
              style={{
                width: '100%',
                height: 72,
                borderRadius: 18,
                backgroundColor: '#000',
              }}
              controls
              audioOnly
            />
          ) : null}
          {resourceUrl && isPdfMimeType(mime) ? (
            <View style={{ height: 420, borderRadius: 18, overflow: 'hidden' }}>
              <Pdf
                source={pdfSource ?? { uri: resourceUrl }}
                style={{ flex: 1 }}
              />
            </View>
          ) : null}
          {!resourceUrl ? (
            <Text style={{ color: palette.subtext }}>
              No resource URL is attached to this material yet.
            </Text>
          ) : null}
          {resourceUrl &&
          !isPdfMimeType(mime) &&
          !mime.includes('image') &&
          !mime.includes('video') &&
          !mime.includes('audio') ? (
            <Text style={{ color: palette.subtext }}>
              This file type is not supported for inline preview. Only PDF,
              image, video, and audio materials can be previewed in the app.
            </Text>
          ) : null}

          {resourceUrl ? (
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <KISButton
                title="Open in device"
                size="xs"
                variant="outline"
                onPress={() => {
                  Linking.openURL(resourceUrl).catch(() => {
                    Alert.alert(
                      'Materials',
                      'Unable to open this resource on the device.',
                    );
                  });
                }}
              />
            </View>
          ) : null}
        </View>
      );
    },
    [
      palette.background,
      palette.divider,
      palette.subtext,
      palette.surface,
      palette.text,
    ],
  );

  const handleDeleteModuleRecord = useCallback(
    (item: any) => {
      if (!selectedInstitutionId || !activeModuleKey || !item?.id) return;
      let route = '';
      switch (activeModuleKey) {
        case 'programs':
          route = ROUTES.broadcasts.educationInstitutionProgram(
            selectedInstitutionId,
            item.id,
          );
          break;
        case 'courses':
          route = ROUTES.broadcasts.educationInstitutionCourse(
            selectedInstitutionId,
            item.id,
          );
          break;
        case 'lessons':
          route = ROUTES.broadcasts.educationInstitutionLesson(
            selectedInstitutionId,
            item.id,
          );
          break;
        case 'classes':
          route = ROUTES.broadcasts.educationInstitutionClassSession(
            selectedInstitutionId,
            item.id,
          );
          break;
        case 'materials':
          route = ROUTES.broadcasts.educationInstitutionMaterial(
            selectedInstitutionId,
            item.id,
          );
          break;
        case 'exams':
          route = ROUTES.broadcasts.educationInstitutionAssessment(
            selectedInstitutionId,
            item.id,
          );
          break;
        case 'events':
          route = ROUTES.broadcasts.educationInstitutionEvent(
            selectedInstitutionId,
            item.id,
          );
          break;
        case 'broadcasts':
          route = ROUTES.broadcasts.educationInstitutionBroadcast(
            selectedInstitutionId,
            item.id,
          );
          break;
        default:
          return;
      }
      Alert.alert('Delete item', 'Are you sure you want to delete this item?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await deleteRequest(route, {
                errorMessage: `Unable to delete ${MODULE_LABELS[
                  activeModuleKey
                ].toLowerCase()}.`,
              });
              if (!response?.success && response !== undefined) {
                throw new Error(response?.message || 'Delete failed.');
              }
              await fetchModuleLookups(selectedInstitutionId);
              await loadModuleRecords(activeModuleKey, selectedInstitutionId);
              await fetchDashboard(selectedInstitutionId);
            } catch (error: any) {
              Alert.alert(
                'Delete item',
                error?.message || 'Unable to delete item.',
              );
            }
          },
        },
      ]);
    },
    [
      activeModuleKey,
      fetchDashboard,
      fetchModuleLookups,
      loadModuleRecords,
      selectedInstitutionId,
    ],
  );

  const handleMembershipAction = useCallback(
    async (membershipId: string, action: 'approve' | 'reject' | 'remove') => {
      if (!selectedInstitutionId) return;
      try {
        const response = await postRequest(
          ROUTES.broadcasts.educationInstitutionMembershipAction(
            selectedInstitutionId,
            membershipId,
          ),
          { action },
          { errorMessage: `Unable to ${action} membership.` },
        );
        if (!response?.success) {
          throw new Error(
            response?.message || `Unable to ${action} membership.`,
          );
        }
        if (activeModuleKey) {
          await loadModuleRecords(activeModuleKey, selectedInstitutionId);
        }
        await fetchDashboard(selectedInstitutionId);
        await fetchHub();
      } catch (error: any) {
        Alert.alert(
          'Membership',
          error?.message || `Unable to ${action} membership.`,
        );
      }
    },
    [
      activeModuleKey,
      fetchDashboard,
      fetchHub,
      loadModuleRecords,
      selectedInstitutionId,
    ],
  );

  const handleAddStaffByContact = useCallback(
    async (contact: KISContact) => {
      setContactsPickerOpen(false);
      if (!contact?.userId) {
        Alert.alert(
          'Staff',
          'This contact is not registered yet. Ask them to join KIS first.',
        );
        return;
      }
      if (!selectedInstitutionId) {
        Alert.alert('Staff', 'No institution selected.');
        return;
      }
      if (!canInviteEducationStaff) {
        Alert.alert(
          'Staff',
          'Only the owner or an administrator can add staff members.',
        );
        return;
      }
      setAddingStaffMember(true);
      try {
        const response = await postRequest(
          ROUTES.broadcasts.educationInstitutionMemberships(
            selectedInstitutionId,
          ),
          {
            user_id: contact.userId,
            role: 'academic_staff',
            status: 'active',
          },
          { errorMessage: 'Unable to add staff member.' },
        );
        if (!response?.success) {
          throw new Error(response?.message || 'Unable to add staff member.');
        }
        Alert.alert('Staff', 'Staff member added from contacts.');
        await fetchModuleLookups(selectedInstitutionId);
        if (activeModuleKey === 'staff') {
          await loadModuleRecords('staff', selectedInstitutionId);
        }
        await fetchDashboard(selectedInstitutionId);
        await fetchHub();
      } catch (error: any) {
        Alert.alert('Staff', error?.message || 'Unable to add staff member.');
      } finally {
        setAddingStaffMember(false);
      }
    },
    [
      activeModuleKey,
      canInviteEducationStaff,
      fetchDashboard,
      fetchHub,
      fetchModuleLookups,
      loadModuleRecords,
      selectedInstitutionId,
    ],
  );

  const handleUpdateStaffMembershipRole = useCallback(
    async (membership: any, role: string) => {
      const membershipId = toText(membership?.id);
      const userId = toText(membership?.user_id);
      if (!selectedInstitutionId || !membershipId || !userId) {
        Alert.alert('Staff', 'Unable to update this staff member right now.');
        return;
      }
      if (!canManageEducationStaffRoles) {
        Alert.alert(
          'Staff',
          'Only the owner or an administrator can assign staff roles.',
        );
        return;
      }
      if (toText(membership?.role) === role) {
        return;
      }
      setUpdatingStaffRole(role);
      try {
        const response = await postRequest(
          ROUTES.broadcasts.educationInstitutionMemberships(
            selectedInstitutionId,
          ),
          {
            user_id: userId,
            role,
            status: toText(membership?.status) || 'active',
            title: toText(membership?.title),
            permissions: Array.isArray(membership?.permissions)
              ? membership.permissions
              : [],
            metadata:
              membership?.metadata &&
              typeof membership.metadata === 'object' &&
              !Array.isArray(membership.metadata)
                ? membership.metadata
                : {},
          },
          { errorMessage: 'Unable to update staff role.' },
        );
        if (!response?.success) {
          throw new Error(response?.message || 'Unable to update staff role.');
        }
        if (activeModuleKey) {
          await loadModuleRecords(activeModuleKey, selectedInstitutionId);
        }
        await fetchDashboard(selectedInstitutionId);
        await fetchHub();
        if (screen === 'detail' && activeModuleKey) {
          await openDetailForModule(
            activeModuleKey,
            { ...membership, role },
            false,
          );
        }
      } catch (error: any) {
        Alert.alert('Staff', error?.message || 'Unable to update staff role.');
      } finally {
        setUpdatingStaffRole(null);
      }
    },
    [
      activeModuleKey,
      canManageEducationStaffRoles,
      fetchDashboard,
      fetchHub,
      loadModuleRecords,
      openDetailForModule,
      screen,
      selectedInstitutionId,
    ],
  );

  const handleEnrollmentAction = useCallback(
    async (
      enrollmentId: string,
      action: 'pending' | 'enroll' | 'waitlist' | 'cancel' | 'complete',
    ) => {
      if (!selectedInstitutionId) return;
      try {
        const response = await postRequest(
          ROUTES.broadcasts.educationInstitutionEnrollmentAction(
            selectedInstitutionId,
            enrollmentId,
          ),
          { action },
          { errorMessage: `Unable to ${action} enrollment.` },
        );
        if (!response?.success) {
          throw new Error(
            response?.message || `Unable to ${action} enrollment.`,
          );
        }
        if (
          screen === 'detail' &&
          detailPayload?.enrollment?.id === enrollmentId &&
          activeModuleKey
        ) {
          await openDetailForModule(
            activeModuleKey,
            detailPayload.enrollment,
            false,
          );
        } else if (activeModuleKey) {
          await loadModuleRecords(activeModuleKey, selectedInstitutionId);
        }
        await fetchDashboard(selectedInstitutionId);
      } catch (error: any) {
        Alert.alert(
          'Enrollments',
          error?.message || `Unable to ${action} enrollment.`,
        );
      }
    },
    [
      activeModuleKey,
      detailPayload,
      fetchDashboard,
      loadModuleRecords,
      openDetailForModule,
      screen,
      selectedInstitutionId,
    ],
  );

  const handleBookingAction = useCallback(
    async (
      bookingId: string,
      action:
        | 'pending'
        | 'payment_pending'
        | 'confirm'
        | 'waitlist'
        | 'cancel'
        | 'expire',
    ) => {
      if (!selectedInstitutionId) return;
      try {
        const response = await postRequest(
          ROUTES.broadcasts.educationInstitutionBookingAction(
            selectedInstitutionId,
            bookingId,
          ),
          { action },
          { errorMessage: `Unable to ${action} booking.` },
        );
        if (!response?.success) {
          throw new Error(response?.message || `Unable to ${action} booking.`);
        }
        if (
          screen === 'detail' &&
          detailPayload?.booking?.id === bookingId &&
          activeModuleKey
        ) {
          await openDetailForModule(
            activeModuleKey,
            detailPayload.booking,
            false,
          );
        } else if (activeModuleKey) {
          await loadModuleRecords(activeModuleKey, selectedInstitutionId);
        }
        await fetchDashboard(selectedInstitutionId);
      } catch (error: any) {
        Alert.alert(
          'Bookings',
          error?.message || `Unable to ${action} booking.`,
        );
      }
    },
    [
      activeModuleKey,
      detailPayload,
      fetchDashboard,
      loadModuleRecords,
      openDetailForModule,
      screen,
      selectedInstitutionId,
    ],
  );

  const handleToggleLandingVisibility = useCallback(
    async (institution?: EducationInstitution | null) => {
      if (!institution?.id) return;
      const nextValue = !isLandingPublic(institution);
      setInstitutionSubmitting(true);
      try {
        const response = await patchRequest(
          ROUTES.broadcasts.educationInstitution(institution.id),
          {
            settings: {
              ...(institution.settings ?? {}),
              landing_page: {
                ...(institution.settings?.landing_page ?? {}),
                is_public: nextValue,
              },
            },
          },
          { errorMessage: 'Unable to update landing visibility.' },
        );
        if (!response?.success) {
          throw new Error(
            response?.message || 'Unable to update landing visibility.',
          );
        }
        await fetchHub();
        if (selectedInstitutionId === institution.id) {
          await fetchDashboard(institution.id);
        }
        Alert.alert(
          'Landing page',
          nextValue
            ? 'Landing page is now public.'
            : 'Landing page is now private.',
        );
      } catch (error: any) {
        Alert.alert(
          'Landing page',
          error?.message || 'Unable to update landing visibility.',
        );
      } finally {
        setInstitutionSubmitting(false);
      }
    },
    [fetchDashboard, fetchHub, selectedInstitutionId],
  );

  const selectedInstitutionLogoUri = useMemo(
    () => getInstitutionBrandingUri(selectedInstitution),
    [selectedInstitution],
  );
  const selectedInstitutionDetailSummary = useMemo(
    () => getRecordDetailSummary(selectedInstitution),
    [selectedInstitution],
  );

  const heroMetrics = useMemo(
    () => [
      {
        label: 'Institutions',
        value: String(quickStats?.institution_count ?? institutions.length),
      },
      { label: 'Members', value: String(quickStats?.active_member_count ?? 0) },
      {
        label: 'Pending',
        value: String(quickStats?.pending_application_count ?? 0),
      },
      {
        label: 'Broadcasts',
        value: String(quickStats?.published_broadcast_count ?? 0),
      },
    ],
    [institutions.length, quickStats],
  );

  const activeModuleLabel = activeModuleKey
    ? MODULE_LABELS[activeModuleKey] ?? activeModuleKey
    : 'Module';
  const activeModuleSingularLabel = useMemo(
    () => getModuleSingularLabel(activeModuleKey),
    [activeModuleKey],
  );

  const buildFlowSteps = useCallback(
    (options?: {
      moduleLabel?: string | null;
      detailLabel?: string | null;
      showEditor?: boolean;
      editing?: boolean;
      editorLabel?: string | null;
    }): EducationFlowStep[] => {
      const steps: EducationFlowStep[] = [
        { key: 'dashboard', label: 'Dashboard' },
      ];
      if (options?.moduleLabel) {
        steps.push({ key: 'module', label: options.moduleLabel });
      }
      if (options?.showEditor) {
        steps.push({
          key: options.editing ? 'edit' : 'create',
          label:
            options.editorLabel || (options.editing ? 'Edit item' : 'New item'),
        });
      } else if (options?.detailLabel) {
        steps.push({ key: 'detail', label: options.detailLabel });
      }
      return steps;
    },
    [],
  );

  const renderStickyInstitutionHeader = useCallback(
    (
      title: string,
      subtitle: string,
      onBack: () => void,
      steps: EducationFlowStep[],
    ) => {
      const safeSteps = steps.length
        ? steps
        : [{ key: 'dashboard', label: 'Dashboard' }];
      const activeIndex = safeSteps.length - 1;
      return (
        <View
          style={{
            backgroundColor: palette.background ?? palette.surface,
            paddingTop: 6,
            paddingBottom: 12,
            gap: 10,
            borderBottomWidth: 1,
            borderBottomColor: palette.divider,
            marginBottom: 12,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Text
                style={{ color: palette.text, fontWeight: '900', fontSize: 18 }}
              >
                {title}
              </Text>
              <Text style={{ color: palette.subtext, fontSize: 12 }}>
                {subtitle}
              </Text>
            </View>
            <KISButton
              title="← Back"
              size="xs"
              variant="outline"
              onPress={onBack}
            />
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {safeSteps.map((step, index) => {
              const isComplete = index < activeIndex;
              const isActive = index === activeIndex;
              const fillColor =
                isComplete || isActive
                  ? palette.primaryStrong
                  : palette.divider;
              const textColor = isActive ? palette.text : palette.subtext;
              return (
                <View
                  key={step.key}
                  style={{ flex: 1, gap: 6, alignItems: 'center' }}
                >
                  <View
                    style={{
                      width: '100%',
                      height: 6,
                      borderRadius: 999,
                      backgroundColor: fillColor,
                      opacity: isActive ? 1 : isComplete ? 0.85 : 0.45,
                    }}
                  />
                  <Text
                    style={{
                      color: textColor,
                      fontSize: 11,
                      fontWeight: isActive ? '800' : '600',
                      textAlign: 'center',
                    }}
                    numberOfLines={2}
                  >
                    {step.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      );
    },
    [
      palette.background,
      palette.divider,
      palette.primaryStrong,
      palette.subtext,
      palette.surface,
      palette.text,
    ],
  );

  const getLookupLabel = useCallback((item: any) => {
    return toText(
      item?.title ||
        item?.name ||
        item?.display_name ||
        item?.summary ||
        item?.code ||
        item?.id,
    );
  }, []);

  const renderLookupSelector = useCallback(
    (
      label: string,
      selectedValue: string,
      options: any[],
      onSelect: (value: string) => void,
      emptyText: string,
      allowClear: boolean = true,
    ) => {
      const selected = options.find(
        row => String(row?.id || '') === selectedValue,
      );
      return (
        <View style={{ gap: 8 }}>
          <Text style={{ color: palette.text, fontWeight: '800' }}>
            {label}
          </Text>
          {selected ? (
            <View
              style={{
                borderWidth: 1,
                borderColor: palette.divider,
                borderRadius: 14,
                padding: 12,
                backgroundColor: palette.card,
                gap: 8,
              }}
            >
              <Text style={{ color: palette.text, fontWeight: '700' }}>
                {getLookupLabel(selected)}
              </Text>
              {allowClear ? (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <KISButton
                    title="Clear"
                    size="xs"
                    variant="secondary"
                    onPress={() => onSelect('')}
                  />
                </View>
              ) : null}
            </View>
          ) : (
            <Text style={{ color: palette.subtext, fontSize: 12 }}>
              {emptyText}
            </Text>
          )}
          {options.length ? (
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {options.map(option => {
                const value = String(option?.id || '');
                const isSelected = value === selectedValue;
                return (
                  <Pressable
                    key={value}
                    onPress={() => onSelect(value)}
                    style={{
                      borderWidth: 1,
                      borderColor: isSelected
                        ? palette.primaryStrong
                        : palette.divider,
                      borderRadius: 999,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      backgroundColor: isSelected
                        ? palette.primarySoft
                        : palette.card,
                    }}
                  >
                    <Text
                      style={{
                        color: palette.text,
                        fontSize: 12,
                        fontWeight: isSelected ? '800' : '600',
                      }}
                    >
                      {getLookupLabel(option)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <Text style={{ color: palette.subtext, fontSize: 12 }}>
              No options available yet.
            </Text>
          )}
        </View>
      );
    },
    [
      getLookupLabel,
      palette.card,
      palette.divider,
      palette.primarySoft,
      palette.primaryStrong,
      palette.subtext,
      palette.text,
    ],
  );

  const renderMultiLookupSelector = useCallback(
    (
      label: string,
      selectedValues: string[],
      options: any[],
      onChange: (values: string[]) => void,
      emptyText: string,
    ) => {
      const normalizedValues = Array.isArray(selectedValues)
        ? selectedValues
        : [];
      const selectedItems = options.filter(row =>
        normalizedValues.includes(String(row?.id || '')),
      );
      const toggleValue = (value: string) => {
        if (!value) return;
        if (normalizedValues.includes(value)) {
          onChange(normalizedValues.filter(entry => entry !== value));
          return;
        }
        onChange([...normalizedValues, value]);
      };
      return (
        <View style={{ gap: 8 }}>
          <Text style={{ color: palette.text, fontWeight: '800' }}>
            {label}
          </Text>
          {selectedItems.length ? (
            <View
              style={{
                borderWidth: 1,
                borderColor: palette.divider,
                borderRadius: 14,
                padding: 12,
                backgroundColor: palette.card,
                gap: 8,
              }}
            >
              <Text style={{ color: palette.subtext, fontSize: 12 }}>
                Selected {selectedItems.length}
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                {selectedItems.map(item => (
                  <View
                    key={String(item?.id || '')}
                    style={{
                      borderWidth: 1,
                      borderColor: palette.primaryStrong,
                      borderRadius: 999,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      backgroundColor: palette.primarySoft,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Text
                      style={{
                        color: palette.text,
                        fontSize: 12,
                        fontWeight: '700',
                      }}
                    >
                      {getLookupLabel(item)}
                    </Text>
                    <Pressable
                      onPress={() => toggleValue(String(item?.id || ''))}
                    >
                      <Text
                        style={{
                          color: palette.primaryStrong,
                          fontWeight: '900',
                        }}
                      >
                        ×
                      </Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <Text style={{ color: palette.subtext, fontSize: 12 }}>
              {emptyText}
            </Text>
          )}
          {options.length ? (
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {options.map(option => {
                const value = String(option?.id || '');
                const isSelected = normalizedValues.includes(value);
                return (
                  <Pressable
                    key={value}
                    onPress={() => toggleValue(value)}
                    style={{
                      borderWidth: 1,
                      borderColor: isSelected
                        ? palette.primaryStrong
                        : palette.divider,
                      borderRadius: 999,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      backgroundColor: isSelected
                        ? palette.primarySoft
                        : palette.card,
                    }}
                  >
                    <Text
                      style={{
                        color: palette.text,
                        fontSize: 12,
                        fontWeight: isSelected ? '800' : '600',
                      }}
                    >
                      {getLookupLabel(option)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <Text style={{ color: palette.subtext, fontSize: 12 }}>
              No options available yet.
            </Text>
          )}
        </View>
      );
    },
    [
      getLookupLabel,
      palette.card,
      palette.divider,
      palette.primarySoft,
      palette.primaryStrong,
      palette.subtext,
      palette.text,
    ],
  );

  const renderSummaryCards = useCallback(
    (
      items: Array<{ label: string; value: string | number }> | undefined,
      emptyText?: string,
    ) => {
      const list = Array.isArray(items)
        ? items.filter(
            item => item && item.value !== undefined && item.value !== null,
          )
        : [];
      if (!list.length) {
        return emptyText ? (
          <Text style={{ color: palette.subtext }}>{emptyText}</Text>
        ) : null;
      }
      return (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {list.map((item, index) => {
            const isPrimary = index === 0;
            return (
              <View
                key={`${item.label}-${item.value}`}
                style={{
                  minWidth: '47%',
                  flexGrow: 1,
                  borderWidth: 1,
                  borderColor: isPrimary
                    ? palette.primaryStrong
                    : palette.divider,
                  borderRadius: 18,
                  padding: 14,
                  backgroundColor: isPrimary
                    ? palette.primarySoft ?? palette.card
                    : palette.card,
                  gap: 6,
                }}
              >
                <Text
                  style={{
                    color: palette.text,
                    fontWeight: '900',
                    fontSize: isPrimary ? 22 : 18,
                  }}
                >
                  {String(item.value)}
                </Text>
                <Text
                  style={{
                    color: palette.subtext,
                    fontSize: 12,
                    fontWeight: '700',
                  }}
                >
                  {item.label}
                </Text>
              </View>
            );
          })}
        </View>
      );
    },
    [
      palette.card,
      palette.divider,
      palette.primarySoft,
      palette.primaryStrong,
      palette.subtext,
      palette.text,
    ],
  );

  const renderDetailSummaryCard = useCallback(
    (summary?: EducationDetailSummaryPayload | null) => {
      if (!summary) return null;
      const highlights = normalizeDetailSummaryItems(summary.highlights);
      const sections = (Array.isArray(summary.sections) ? summary.sections : [])
        .map(section => ({
          title: toText(section?.title),
          items: normalizeDetailSummaryItems(section?.items),
        }))
        .filter(section => section.title && section.items.length);

      if (
        !summary.title &&
        !summary.description &&
        !highlights.length &&
        !sections.length
      )
        return null;

      return (
        <View
          style={{
            borderWidth: 1,
            borderColor: palette.primaryStrong,
            borderRadius: 22,
            padding: 16,
            backgroundColor: palette.card,
            gap: 12,
          }}
        >
          <View style={{ gap: 5 }}>
            <Text
              style={{
                color: palette.primaryStrong,
                fontSize: 11,
                fontWeight: '900',
                textTransform: 'uppercase',
              }}
            >
              {summary.eyebrow || summary.module || 'Entered details'}
            </Text>
            {summary.title ? (
              <Text
                style={{ color: palette.text, fontWeight: '900', fontSize: 20 }}
              >
                {summary.title}
              </Text>
            ) : null}
            {summary.subtitle ? (
              <Text style={{ color: palette.subtext, fontWeight: '700' }}>
                {summary.subtitle}
              </Text>
            ) : null}
            {summary.description ? (
              <Text style={{ color: palette.subtext, lineHeight: 20 }}>
                {summary.description}
              </Text>
            ) : null}
          </View>
          {highlights.length ? renderSummaryCards(highlights) : null}
          {sections.map(section => (
            <View key={section.title} style={{ gap: 8 }}>
              <Text style={{ color: palette.text, fontWeight: '800' }}>
                {section.title}
              </Text>
              <View style={{ gap: 7 }}>
                {section.items.map(summaryItem => (
                  <View
                    key={`${section.title}-${summaryItem.label}-${summaryItem.value}`}
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      gap: 12,
                    }}
                  >
                    <Text style={{ color: palette.subtext, flex: 1 }}>
                      {summaryItem.label}
                    </Text>
                    <Text
                      style={{
                        color: palette.text,
                        fontWeight: '700',
                        flex: 1,
                        textAlign: 'right',
                      }}
                    >
                      {summaryItem.value}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      );
    },
    [
      palette.card,
      palette.primaryStrong,
      palette.subtext,
      palette.text,
      renderSummaryCards,
    ],
  );

  const getBookingLookupTarget = useCallback(
    (item: any) => {
      const lookupPairs = [
        { id: item?.event_id, rows: moduleLookups.events, type: 'event' },
        {
          id: item?.class_session_id,
          rows: moduleLookups.classSessions,
          type: 'class session',
        },
        { id: item?.course_id, rows: moduleLookups.courses, type: 'course' },
        { id: item?.program_id, rows: moduleLookups.programs, type: 'program' },
        {
          id: item?.broadcast_id,
          rows: moduleLookups.broadcasts,
          type: 'broadcast',
        },
      ];
      for (const pair of lookupPairs) {
        const id = toText(pair.id);
        if (!id) continue;
        const record = pair.rows.find((row: any) => toText(row?.id) === id);
        if (record) return { ...record, booked_item_type: pair.type };
      }
      return null;
    },
    [
      moduleLookups.broadcasts,
      moduleLookups.classSessions,
      moduleLookups.courses,
      moduleLookups.events,
      moduleLookups.programs,
    ],
  );

  const renderBookingPrimary = useCallback(
    (item: any) => {
      const lookupTarget = getBookingLookupTarget(item);
      return toText(
        item?.booked_item_title ||
          item?.targetLabel ||
          item?.target_label ||
          item?.broadcast_title ||
          lookupTarget?.title ||
          lookupTarget?.name ||
          'Booked education item',
      );
    },
    [getBookingLookupTarget],
  );

  const renderBookingSummary = useCallback(
    (item: any) => {
      const lookupTarget = getBookingLookupTarget(item);
      const targetType = toText(
        item?.booked_item_type || lookupTarget?.booked_item_type,
      ).replace(/_/g, ' ');
      const learnerName = toText(
        item?.learner_display_name ||
          item?.user_display_name ||
          item?.display_name,
      );
      const startsAt = item?.booked_item_starts_at || lookupTarget?.starts_at;
      const parts = [
        targetType ? formatMetricLabel(targetType) : '',
        learnerName ? `Learner: ${learnerName}` : '',
        toText(item?.status)
          ? `Status: ${formatMetricLabel(toText(item.status))}`
          : '',
        `Seats: ${Number(item?.seat_count || 1)}`,
        formatEducationAmount(item?.amount_cents, item?.currency),
        startsAt ? `Starts: ${formatEducationDateTime(startsAt)}` : '',
      ];
      return parts.filter(Boolean).join(' • ');
    },
    [getBookingLookupTarget],
  );

  const getRelatedLookupTarget = useCallback(
    (item: any) => {
      const lookupPairs = [
        { id: item?.event_id, rows: moduleLookups.events, type: 'event' },
        {
          id: item?.class_session_id,
          rows: moduleLookups.classSessions,
          type: 'class session',
        },
        { id: item?.lesson_id, rows: moduleLookups.lessons, type: 'lesson' },
        { id: item?.course_id, rows: moduleLookups.courses, type: 'course' },
        { id: item?.program_id, rows: moduleLookups.programs, type: 'program' },
        {
          id: item?.broadcast_id,
          rows: moduleLookups.broadcasts,
          type: 'broadcast',
        },
      ];
      for (const pair of lookupPairs) {
        const id = toText(pair.id);
        if (!id) continue;
        const record = pair.rows.find((row: any) => toText(row?.id) === id);
        if (record) return { ...record, related_item_type: pair.type };
      }
      return null;
    },
    [
      moduleLookups.broadcasts,
      moduleLookups.classSessions,
      moduleLookups.courses,
      moduleLookups.events,
      moduleLookups.lessons,
      moduleLookups.programs,
    ],
  );

  const getEducationPersonName = useCallback(
    (item: any, fallback = 'Institution member') => {
      return (
        toText(
          item?.display_name ||
            item?.user?.display_name ||
            item?.learner_display_name ||
            item?.user_display_name,
        ) || fallback
      );
    },
    [],
  );

  const getEducationRecordTitle = useCallback(
    (item: any, fallback = 'Untitled record') => {
      return (
        toText(
          item?.title || item?.name || item?.prompt || item?.display_name,
        ) || fallback
      );
    },
    [],
  );

  const renderRelatedPrimary = useCallback(
    (moduleKey: EducationModuleKey | undefined, item: any) => {
      if (moduleKey === 'bookings') return renderBookingPrimary(item);
      if (moduleKey === 'enrollments') {
        const target = getRelatedLookupTarget(item);
        const title = toText(
          target?.title ||
            target?.name ||
            item?.content_title ||
            item?.target_title,
        );
        return title ? `Enrollment: ${title}` : 'Enrollment';
      }
      if (
        moduleKey === 'staff' ||
        moduleKey === 'students' ||
        moduleKey === 'memberships'
      ) {
        return getEducationPersonName(item);
      }
      return getEducationRecordTitle(item);
    },
    [
      getEducationPersonName,
      getEducationRecordTitle,
      getRelatedLookupTarget,
      renderBookingPrimary,
    ],
  );

  const renderRelatedSummary = useCallback(
    (moduleKey: EducationModuleKey | undefined, item: any) => {
      if (moduleKey === 'bookings') return renderBookingSummary(item);
      if (moduleKey === 'enrollments') {
        const target = getRelatedLookupTarget(item);
        const targetType = toText(target?.related_item_type).replace(/_/g, ' ');
        const learnerName = toText(
          item?.learner_display_name ||
            item?.user_display_name ||
            item?.display_name,
        );
        const parts = [
          targetType ? formatMetricLabel(targetType) : '',
          learnerName ? `Learner: ${learnerName}` : '',
          toText(item?.status)
            ? `Status: ${formatMetricLabel(toText(item.status))}`
            : '',
          item?.enrolled_at
            ? `Enrolled: ${formatEducationDateTime(item.enrolled_at)}`
            : '',
          item?.completed_at
            ? `Completed: ${formatEducationDateTime(item.completed_at)}`
            : '',
        ];
        return parts.filter(Boolean).join(' • ');
      }
      if (moduleKey === 'classes') {
        return [
          formatEducationDateTime(item?.starts_at),
          toText(item?.delivery_mode),
          toText(item?.status),
        ]
          .filter(Boolean)
          .join(' • ');
      }
      if (moduleKey === 'materials') {
        return [
          toText(item?.kind),
          toText(item?.resource_name || item?.resource_url),
          toText(item?.status),
        ]
          .filter(Boolean)
          .join(' • ');
      }
      if (moduleKey === 'exams') {
        return [
          toText(item?.assessment_type),
          toText(item?.status),
          item?.duration_minutes ? `${item.duration_minutes} min` : '',
        ]
          .filter(Boolean)
          .join(' • ');
      }
      if (
        moduleKey === 'staff' ||
        moduleKey === 'students' ||
        moduleKey === 'memberships'
      ) {
        return [toText(item?.role), toText(item?.status), toText(item?.title)]
          .filter(Boolean)
          .join(' • ');
      }
      return toText(item?.summary || item?.description || item?.status);
    },
    [getRelatedLookupTarget, renderBookingSummary],
  );

  const renderModuleSummary = (item: any) => {
    if (!activeModuleKey) return '';
    switch (activeModuleKey) {
      case 'programs':
      case 'courses':
      case 'events':
      case 'broadcasts':
        return toText(item.summary || item.description || item.status);
      case 'lessons':
        return toText(item.summary || item.status || 'Lesson');
      case 'classes':
        return [
          toText(item.starts_at),
          toText(item.delivery_mode),
          toText(item.status),
        ]
          .filter(Boolean)
          .join(' • ');
      case 'materials':
        return [
          toText(item.kind),
          toText(item.resource_name || item.resource_url),
          toText(item.status),
        ]
          .filter(Boolean)
          .join(' • ');
      case 'exams':
        return [
          toText(item.assessment_type),
          toText(item.status),
          toText(item.duration_minutes),
        ]
          .filter(Boolean)
          .join(' • ');
      case 'memberships':
      case 'students':
      case 'staff':
        return [toText(item.role), toText(item.status), toText(item.title)]
          .filter(Boolean)
          .join(' • ');
      case 'enrollments': {
        const target = getRelatedLookupTarget(item);
        return [
          toText(item.status),
          toText(
            target?.title ||
              target?.name ||
              item?.content_title ||
              item?.target_title,
          ),
        ]
          .filter(Boolean)
          .join(' • ');
      }
      case 'bookings':
        return renderBookingSummary(item);
      default:
        return toText(item.summary || item.description || item.status);
    }
  };

  const renderModulePrimary = (item: any) => {
    if (
      activeModuleKey === 'memberships' ||
      activeModuleKey === 'students' ||
      activeModuleKey === 'staff'
    ) {
      return getEducationPersonName(item);
    }
    if (activeModuleKey === 'bookings') {
      return renderBookingPrimary(item);
    }
    return getEducationRecordTitle(item);
  };

  const canOpenDetail = useMemo(
    () =>
      [
        'memberships',
        'programs',
        'courses',
        'lessons',
        'classes',
        'materials',
        'exams',
        'events',
        'broadcasts',
        'enrollments',
        'bookings',
        'students',
        'staff',
      ].includes(activeModuleKey || ''),
    [activeModuleKey],
  );

  const moduleOperationalSummary = useMemo(() => {
    if (activeModuleKey === 'enrollments') {
      return summarizeByField(moduleRecords, 'status');
    }
    if (activeModuleKey === 'bookings') {
      return summarizeByField(moduleRecords, 'status');
    }
    if (
      activeModuleKey === 'memberships' ||
      activeModuleKey === 'students' ||
      activeModuleKey === 'staff'
    ) {
      return summarizeByField(moduleRecords, 'status');
    }
    return [];
  }, [activeModuleKey, moduleRecords]);

  const filteredModuleRecords = useMemo(() => {
    if (activeModuleKey !== 'bookings' || bookingStatusFilter === 'all')
      return moduleRecords;
    return moduleRecords.filter(item => {
      const status = toText(item?.status).toLowerCase();
      if (bookingStatusFilter === 'waitlisted')
        return status === 'waitlisted' || status === 'waitlist';
      return status === bookingStatusFilter;
    });
  }, [activeModuleKey, bookingStatusFilter, moduleRecords]);

  const bookingSummaryCards = useMemo(() => {
    if (activeModuleKey !== 'bookings') return [];
    const counts = {
      pending: 0,
      confirmed: 0,
      waitlisted: 0,
      cancelled: 0,
    };
    let totalKisc = 0;
    moduleRecords.forEach(item => {
      const status = toText(item?.status).toLowerCase();
      if (status === 'pending' || status === 'payment_pending')
        counts.pending += 1;
      if (status === 'confirmed') counts.confirmed += 1;
      if (status === 'waitlisted' || status === 'waitlist')
        counts.waitlisted += 1;
      if (status === 'cancelled') counts.cancelled += 1;
      totalKisc += Number(
        item?.amount_paid_cents ??
          item?.amount_cents ??
          item?.price_amount ??
          0,
      );
    });
    return [
      {
        label: 'Pending payment',
        value: String(counts.pending),
        hint: 'Needs review',
        tone: counts.pending > 0 ? ('warning' as const) : ('muted' as const),
      },
      {
        label: 'Confirmed',
        value: String(counts.confirmed),
        hint: 'Ready to attend',
        tone: counts.confirmed > 0 ? ('success' as const) : ('muted' as const),
      },
      {
        label: 'Waitlist',
        value: String(counts.waitlisted),
        hint: 'Queued',
        tone: counts.waitlisted > 0 ? ('warning' as const) : ('muted' as const),
      },
      {
        label: 'KISC volume',
        value: totalKisc
          ? `KISC ${(totalKisc / 100).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`
          : 'Free',
        hint: 'Current records',
        tone: totalKisc > 0 ? ('accent' as const) : ('muted' as const),
      },
    ];
  }, [activeModuleKey, moduleRecords]);

  const analyticsGroups = useMemo(() => {
    const metrics = dashboardData?.metrics ?? {};
    return [
      {
        title: 'Academic content',
        description:
          'Structure and delivery across programs, courses, lessons, classes, materials, and assessments.',
        items: [
          { label: 'Programs', value: String(metrics.program_count ?? 0) },
          { label: 'Courses', value: String(metrics.course_count ?? 0) },
          { label: 'Lessons', value: String(metrics.lesson_count ?? 0) },
          { label: 'Classes', value: String(metrics.class_session_count ?? 0) },
          { label: 'Materials', value: String(metrics.material_count ?? 0) },
          {
            label: 'Assessments',
            value: String(metrics.assessment_count ?? 0),
          },
        ],
      },
      {
        title: 'People',
        description:
          'Learners, staff, and pending approvals in the institution.',
        items: [
          {
            label: 'Learners',
            value: String(metrics.active_student_count ?? 0),
          },
          { label: 'Staff', value: String(metrics.staff_count ?? 0) },
          {
            label: 'Pending approvals',
            value: String(metrics.pending_application_count ?? 0),
          },
        ],
      },
      {
        title: 'Engagement',
        description:
          'Events, broadcasts, bookings, and enrollments touching the institution.',
        items: [
          { label: 'Events', value: String(metrics.event_count ?? 0) },
          { label: 'Broadcasts', value: String(metrics.broadcast_count ?? 0) },
          {
            label: 'Enrollments',
            value: String(metrics.enrollment_count ?? 0),
          },
          { label: 'Bookings', value: String(metrics.booking_count ?? 0) },
        ],
      },
    ];
  }, [dashboardData?.metrics]);

  const analyticsSummary = useMemo(() => {
    const metrics = dashboardData?.metrics ?? {};
    return [
      {
        label: 'Academic Records',
        value: (
          Number(metrics.program_count || 0) +
          Number(metrics.course_count || 0) +
          Number(metrics.lesson_count || 0) +
          Number(metrics.assessment_count || 0)
        ).toString(),
      },
      {
        label: 'Live Delivery',
        value: (
          Number(metrics.class_session_count || 0) +
          Number(metrics.event_count || 0)
        ).toString(),
      },
      {
        label: 'Engagement Actions',
        value: (
          Number(metrics.broadcast_count || 0) +
          Number(metrics.booking_count || 0) +
          Number(metrics.enrollment_count || 0)
        ).toString(),
      },
      {
        label: 'People',
        value: (
          Number(metrics.active_student_count || 0) +
          Number(metrics.staff_count || 0)
        ).toString(),
      },
      {
        label: 'Open Approvals',
        value: Number(metrics.pending_application_count || 0).toString(),
      },
    ];
  }, [dashboardData?.metrics]);

  const workspaceHomeMetrics = useMemo(() => {
    const metrics = dashboardData?.metrics ?? {};
    const pendingBookings = Number(
      metrics.pending_booking_count ??
        metrics.payment_pending_booking_count ??
        metrics.booking_pending_count ??
        0,
    );
    const revenueValue = Number(
      metrics.revenue_kisc ??
        metrics.kisc_revenue ??
        metrics.revenue_total_kisc ??
        metrics.revenue_total ??
        0,
    );
    const fourthMetric =
      revenueValue > 0
        ? {
            label: 'KISC Revenue',
            value: `KISC ${revenueValue.toLocaleString()}`,
            hint: 'Recorded value',
            tone: 'accent' as const,
          }
        : pendingBookings > 0
        ? {
            label: 'Bookings Pending',
            value: pendingBookings.toString(),
            hint: 'Needs action',
            tone: 'warning' as const,
          }
        : {
            label: 'Pending Approvals',
            value: String(metrics.pending_application_count ?? 0),
            hint: 'Membership requests',
            tone:
              Number(metrics.pending_application_count ?? 0) > 0
                ? ('warning' as const)
                : ('muted' as const),
          };

    return [
      {
        label: 'Courses',
        value: String(metrics.course_count ?? 0),
        hint: 'Active catalogue',
        tone: 'accent' as const,
      },
      {
        label: 'Learners',
        value: String(metrics.active_student_count ?? 0),
        hint: 'Active students',
        tone: 'default' as const,
      },
      {
        label: pendingBookings > 0 ? 'Bookings Pending' : 'Bookings',
        value: String(
          pendingBookings > 0 ? pendingBookings : metrics.booking_count ?? 0,
        ),
        hint: pendingBookings > 0 ? 'Needs action' : 'All bookings',
        tone: pendingBookings > 0 ? ('warning' as const) : ('default' as const),
      },
      fourthMetric,
    ];
  }, [dashboardData?.metrics]);

  const workspaceSections = useMemo(() => {
    const metrics = dashboardData?.metrics ?? {};
    const enabledModules = new Set(
      (dashboardData?.modules ?? [])
        .filter(module => module?.enabled)
        .map(module => String(module.key)),
    );
    const sections = [
      {
        key: 'programs',
        moduleKey: 'programs' as EducationModuleKey,
        title: 'Programs',
        description: 'Manage departments, pathways, and program groupings.',
        meta: `${Number(metrics.program_count ?? 0)} programs`,
      },
      {
        key: 'courses',
        moduleKey: 'courses' as EducationModuleKey,
        title: 'Courses',
        description: 'Create and manage institution-owned courses.',
        meta: `${Number(metrics.course_count ?? 0)} courses`,
      },
      {
        key: 'lessons',
        moduleKey: 'lessons' as EducationModuleKey,
        title: 'Lessons',
        description: 'Build lessons and connect them to course flow.',
        meta: `${Number(metrics.lesson_count ?? 0)} lessons`,
      },
      {
        key: 'classes',
        moduleKey: 'classes' as EducationModuleKey,
        title: 'Classes',
        description: 'Schedule and manage live or in-person sessions.',
        meta: `${Number(metrics.class_session_count ?? 0)} classes`,
      },
      {
        key: 'materials',
        moduleKey: 'materials' as EducationModuleKey,
        title: 'Materials',
        description: 'Add, edit, connect, and disconnect learning materials.',
        meta: `${Number(metrics.material_count ?? 0)} materials`,
      },
      {
        key: 'exams',
        moduleKey: 'exams' as EducationModuleKey,
        title: 'Assessments',
        description: 'Create exams, quizzes, and evaluation records.',
        meta: `${Number(metrics.assessment_count ?? 0)} assessments`,
      },
      {
        key: 'events',
        moduleKey: 'events' as EducationModuleKey,
        title: 'Events',
        description: 'Manage workshops, events, and training sessions.',
        meta: `${Number(metrics.event_count ?? 0)} events`,
      },
      {
        key: 'students',
        moduleKey: 'students' as EducationModuleKey,
        title: 'Learners',
        description: 'Review active student members in this institution.',
        meta: `${Number(metrics.active_student_count ?? 0)} active`,
      },
      {
        key: 'staff',
        moduleKey: 'staff' as EducationModuleKey,
        title: 'Staff',
        description: 'Manage lecturers, admins, and academic staff.',
        meta: `${Number(metrics.staff_count ?? 0)} staff`,
      },
      {
        key: 'memberships',
        moduleKey: 'memberships' as EducationModuleKey,
        title: 'Memberships',
        description:
          'Approve, reject, and manage institution membership records.',
        meta: `${Number(metrics.pending_application_count ?? 0)} pending`,
      },
      {
        key: 'enrollments',
        moduleKey: 'enrollments' as EducationModuleKey,
        title: 'Enrollments',
        description:
          'Track who joined courses, broadcasts, and learning paths.',
        meta: `${Number(metrics.enrollment_count ?? 0)} enrollments`,
      },
      {
        key: 'broadcasts',
        moduleKey: 'broadcasts' as EducationModuleKey,
        title: 'Broadcasts',
        description: 'Manage public-facing learning offers and notices.',
        meta: `${Number(metrics.broadcast_count ?? 0)} live`,
      },
      {
        key: 'bookings',
        moduleKey: 'bookings' as EducationModuleKey,
        title: 'Bookings & Payments',
        description:
          'Review booking flow, payment state, and attendance readiness.',
        meta: `${Number(metrics.booking_count ?? 0)} bookings`,
      },
      {
        key: 'analytics',
        moduleKey: 'analytics' as EducationModuleKey,
        title: 'Analytics',
        description:
          'See institution metrics grouped into clean operational views.',
        meta: `${Number(metrics.enrollment_count ?? 0)} enrollments`,
      },
      {
        key: 'settings',
        moduleKey: 'settings' as EducationModuleKey,
        title: 'Settings',
        description:
          'Update visibility, landing page, profile, and institution controls.',
        meta: isLandingPublic(selectedInstitution)
          ? 'Public landing'
          : 'Private landing',
      },
    ];
    const filteredSections = sections.filter(
      section =>
        enabledModules.size === 0 || enabledModules.has(section.moduleKey),
    );
    return filteredSections;
  }, [dashboardData?.metrics, dashboardData?.modules, selectedInstitution]);

  const workspaceTimelineItems = useMemo(() => {
    const courseItems = (dashboardData?.recent_courses ?? []).map(course => ({
      key: `course-${course.id || course.title}`,
      title: toText(course.title) || 'Course updated',
      description:
        toText(course.summary || course.status) ||
        'Course activity recorded in this workspace.',
      timestamp: toText(course.status) || 'Course',
      tone: 'accent' as const,
    }));
    const broadcastItems = (dashboardData?.recent_broadcasts ?? []).map(
      broadcast => ({
        key: `broadcast-${broadcast.id}`,
        title: toText(broadcast.title) || 'Broadcast updated',
        description:
          toText(broadcast.summary) ||
          'Public education activity was published from this workspace.',
        timestamp: formatMetricLabel(
          toText(broadcast.broadcast_kind) || 'broadcast',
        ),
        tone: 'default' as const,
      }),
    );
    return [...courseItems, ...broadcastItems].slice(0, 6);
  }, [dashboardData?.recent_broadcasts, dashboardData?.recent_courses]);

  const detailSummary = useMemo(() => {
    const sections: Array<{ label: string; value: string | number }> = [];
    if (!detailPayload) return sections;
    if (
      Array.isArray(detailPayload.enrollments) &&
      detailPayload.enrollments.length
    ) {
      sections.push(
        ...summarizeByField(detailPayload.enrollments, 'status').map(row => ({
          label: `Enrollments: ${row.label}`,
          value: row.value,
        })),
      );
    }
    if (
      Array.isArray(detailPayload.bookings) &&
      detailPayload.bookings.length
    ) {
      sections.push(
        ...summarizeByField(detailPayload.bookings, 'status').map(row => ({
          label: `Bookings: ${row.label}`,
          value: row.value,
        })),
      );
    }
    if (
      Array.isArray(detailPayload.assessment_submissions) &&
      detailPayload.assessment_submissions.length
    ) {
      sections.push(
        ...summarizeByField(detailPayload.assessment_submissions, 'status').map(
          row => ({ label: `Submissions: ${row.label}`, value: row.value }),
        ),
      );
    }
    if (
      Array.isArray(detailPayload.staff_assignments) &&
      detailPayload.staff_assignments.length
    ) {
      sections.push(
        ...summarizeByField(detailPayload.staff_assignments, 'role').map(
          row => ({ label: `Assignments: ${row.label}`, value: row.value }),
        ),
      );
    }
    return sections.slice(0, 8);
  }, [detailPayload]);

  const detailRecordSummary = useMemo(
    () =>
      getRecordDetailSummary(detailPayload, [
        'program',
        'course',
        'lesson',
        'class_session',
        'material',
        'assessment',
        'event',
        'broadcast',
        'enrollment',
        'booking',
        'membership',
      ]),
    [detailPayload],
  );

  const refreshActiveCourseDetail = useCallback(async () => {
    if (
      activeModuleKey !== 'courses' ||
      !detailPayload?.course ||
      !selectedInstitutionId
    )
      return;
    await openDetailForModule('courses', detailPayload.course, false);
  }, [
    activeModuleKey,
    detailPayload,
    openDetailForModule,
    selectedInstitutionId,
  ]);

  const openCourseModuleEditor = useCallback((module?: any | null) => {
    setEditingCourseModuleId(module?.id ?? null);
    setCourseModuleForm({
      title: toText(module?.title),
      summary: toText(module?.summary),
      module_order: String(module?.module_order ?? '0'),
      is_preview: Boolean(module?.is_preview),
      status: toText(module?.status) || 'draft',
    });
    setCourseModuleEditorVisible(true);
  }, []);

  const closeCourseModuleEditor = useCallback(() => {
    setCourseModuleEditorVisible(false);
    setEditingCourseModuleId(null);
    setCourseModuleForm(emptyCourseModuleForm());
  }, []);

  const openCourseModuleItemEditor = useCallback(
    (moduleId: string, item?: any | null) => {
      setEditingCourseModuleItemId(item?.id ?? null);
      setCourseModuleItemForm({
        module_id: moduleId || toText(item?.module_id),
        item_type: toText(item?.item_type || item?.type) || 'lesson',
        item_order: String(item?.item_order ?? '0'),
        title_override: toText(item?.title_override),
        summary_override: toText(item?.summary_override),
        estimated_minutes: String(
          item?.estimated_minutes ?? item?.duration_minutes ?? '0',
        ),
        lesson_id: toText(item?.lesson_id || item?.target?.lesson_id),
        material_id: toText(item?.material_id || item?.target?.material_id),
        class_session_id: toText(
          item?.class_session_id || item?.target?.class_session_id,
        ),
        assessment_id: toText(
          item?.assessment_id || item?.target?.assessment_id,
        ),
        event_id: toText(item?.event_id || item?.target?.event_id),
        broadcast_id: toText(item?.broadcast_id || item?.target?.broadcast_id),
      });
      setCourseModuleItemEditorVisible(true);
    },
    [],
  );

  const closeCourseModuleItemEditor = useCallback(() => {
    setCourseModuleItemEditorVisible(false);
    setEditingCourseModuleItemId(null);
    setCourseModuleItemForm(emptyCourseModuleItemForm());
  }, []);

  const handleSaveCourseModule = useCallback(async () => {
    if (!selectedInstitutionId || !detailPayload?.course?.id) return;
    const title = toText(courseModuleForm.title);
    if (!title)
      return Alert.alert('Course modules', 'Module title is required.');
    const payload = {
      title,
      summary: toText(courseModuleForm.summary),
      module_order: Number(courseModuleForm.module_order || 0) || 0,
      is_preview: Boolean(courseModuleForm.is_preview),
      status: toText(courseModuleForm.status) || 'draft',
    };
    const courseId = detailPayload.course.id;
    setCourseModuleSubmitting(true);
    try {
      const response = editingCourseModuleId
        ? await patchRequest(
            ROUTES.broadcasts.educationInstitutionCourseModule(
              selectedInstitutionId,
              courseId,
              editingCourseModuleId,
            ),
            payload,
            { errorMessage: 'Unable to update course module.' },
          )
        : await postRequest(
            ROUTES.broadcasts.educationInstitutionCourseModules(
              selectedInstitutionId,
              courseId,
            ),
            payload,
            { errorMessage: 'Unable to create course module.' },
          );
      if (!response?.success)
        throw new Error(response?.message || 'Unable to save course module.');
      await refreshActiveCourseDetail();
      closeCourseModuleEditor();
    } catch (error: any) {
      Alert.alert(
        'Course modules',
        error?.message || 'Unable to save course module.',
      );
    } finally {
      setCourseModuleSubmitting(false);
    }
  }, [
    closeCourseModuleEditor,
    courseModuleForm,
    detailPayload,
    editingCourseModuleId,
    refreshActiveCourseDetail,
    selectedInstitutionId,
  ]);

  const handleDeleteCourseModule = useCallback(
    (module: any) => {
      if (!selectedInstitutionId || !detailPayload?.course?.id || !module?.id)
        return;
      Alert.alert(
        'Course modules',
        `Delete ${toText(module.title) || 'this module'}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                const response = await deleteRequest(
                  ROUTES.broadcasts.educationInstitutionCourseModule(
                    selectedInstitutionId,
                    detailPayload.course.id,
                    module.id,
                  ),
                  { errorMessage: 'Unable to delete course module.' },
                );
                if (!response?.success)
                  throw new Error(
                    response?.message || 'Unable to delete course module.',
                  );
                await refreshActiveCourseDetail();
              } catch (error: any) {
                Alert.alert(
                  'Course modules',
                  error?.message || 'Unable to delete course module.',
                );
              }
            },
          },
        ],
      );
    },
    [detailPayload, refreshActiveCourseDetail, selectedInstitutionId],
  );

  const handleSaveCourseModuleItem = useCallback(async () => {
    if (!selectedInstitutionId || !detailPayload?.course?.id) return;
    const moduleId = toText(courseModuleItemForm.module_id);
    if (!moduleId) return Alert.alert('Module items', 'Select a module first.');
    const itemType = toText(courseModuleItemForm.item_type) || 'lesson';
    const payload: any = {
      item_type: itemType,
      item_order: Number(courseModuleItemForm.item_order || 0) || 0,
      title_override: toText(courseModuleItemForm.title_override),
      summary_override: toText(courseModuleItemForm.summary_override),
      estimated_minutes:
        Number(courseModuleItemForm.estimated_minutes || 0) || 0,
    };
    const keyMap: Record<string, string> = {
      lesson: 'lesson_id',
      material: 'material_id',
      class_session: 'class_session_id',
      assessment: 'assessment_id',
      event: 'event_id',
      broadcast: 'broadcast_id',
    };
    const targetKey = keyMap[itemType];
    const targetValue = toText(courseModuleItemForm[targetKey]);
    if (!targetValue)
      return Alert.alert('Module items', 'Select the linked learning item.');
    payload[targetKey] = targetValue;
    setCourseModuleSubmitting(true);
    try {
      const response = editingCourseModuleItemId
        ? await patchRequest(
            ROUTES.broadcasts.educationInstitutionCourseModuleItem(
              selectedInstitutionId,
              detailPayload.course.id,
              moduleId,
              editingCourseModuleItemId,
            ),
            payload,
            { errorMessage: 'Unable to update module item.' },
          )
        : await postRequest(
            ROUTES.broadcasts.educationInstitutionCourseModuleItems(
              selectedInstitutionId,
              detailPayload.course.id,
              moduleId,
            ),
            payload,
            { errorMessage: 'Unable to create module item.' },
          );
      if (!response?.success)
        throw new Error(response?.message || 'Unable to save module item.');
      await refreshActiveCourseDetail();
      closeCourseModuleItemEditor();
    } catch (error: any) {
      Alert.alert(
        'Module items',
        error?.message || 'Unable to save module item.',
      );
    } finally {
      setCourseModuleSubmitting(false);
    }
  }, [
    closeCourseModuleItemEditor,
    courseModuleItemForm,
    detailPayload,
    editingCourseModuleItemId,
    refreshActiveCourseDetail,
    selectedInstitutionId,
  ]);

  const handleDeleteCourseModuleItem = useCallback(
    (moduleId: string, item: any) => {
      if (
        !selectedInstitutionId ||
        !detailPayload?.course?.id ||
        !moduleId ||
        !item?.id
      )
        return;
      Alert.alert(
        'Module items',
        `Delete ${toText(item.title || item.title_override) || 'this item'}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                const response = await deleteRequest(
                  ROUTES.broadcasts.educationInstitutionCourseModuleItem(
                    selectedInstitutionId,
                    detailPayload.course.id,
                    moduleId,
                    item.id,
                  ),
                  { errorMessage: 'Unable to delete module item.' },
                );
                if (!response?.success)
                  throw new Error(
                    response?.message || 'Unable to delete module item.',
                  );
                await refreshActiveCourseDetail();
              } catch (error: any) {
                Alert.alert(
                  'Module items',
                  error?.message || 'Unable to delete module item.',
                );
              }
            },
          },
        ],
      );
    },
    [detailPayload, refreshActiveCourseDetail, selectedInstitutionId],
  );

  const renderCourseModuleWorkspace = useCallback(() => {
    if (!detailPayload?.course) return null;
    const modules = Array.isArray(detailPayload.modules)
      ? detailPayload.modules
      : [];
    const itemTypeLookup: Record<string, any[]> = {
      lesson: moduleLookups.lessons.filter(
        (row: any) =>
          !toText(detailPayload?.course?.id) ||
          toText(row.course_id) === toText(detailPayload.course.id),
      ),
      material: moduleLookups.materials.filter((row: any) =>
        Array.isArray(row.course_ids)
          ? row.course_ids.includes(detailPayload.course.id)
          : toText(row.course_id) === toText(detailPayload.course.id),
      ),
      class_session: moduleLookups.classSessions.filter(
        (row: any) =>
          !toText(detailPayload?.course?.id) ||
          toText(row.course_id) === toText(detailPayload.course.id),
      ),
      assessment: moduleLookups.assessments.filter(
        (row: any) =>
          !toText(detailPayload?.course?.id) ||
          toText(row.course_id) === toText(detailPayload.course.id),
      ),
      event: moduleLookups.events.filter(
        (row: any) =>
          !toText(detailPayload?.course?.id) ||
          toText(row.course_id) === toText(detailPayload.course.id),
      ),
      broadcast: moduleLookups.broadcasts.filter(
        (row: any) =>
          !toText(detailPayload?.course?.id) ||
          toText(row.course_id) === toText(detailPayload.course.id),
      ),
    };
    const targetKeyMap: Record<string, string> = {
      lesson: 'lesson_id',
      material: 'material_id',
      class_session: 'class_session_id',
      assessment: 'assessment_id',
      event: 'event_id',
      broadcast: 'broadcast_id',
    };
    const currentType = toText(courseModuleItemForm.item_type) || 'lesson';
    return (
      <View style={{ gap: 12 }}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <Text
            style={{ color: palette.text, fontWeight: '900', fontSize: 16 }}
          >
            Course modules
          </Text>
          <KISButton
            title={
              courseModuleEditorVisible ? 'Close module editor' : 'New module'
            }
            size="xs"
            variant="outline"
            onPress={() =>
              courseModuleEditorVisible
                ? closeCourseModuleEditor()
                : openCourseModuleEditor()
            }
          />
        </View>
        {courseModuleEditorVisible ? (
          <View
            style={{
              borderWidth: 1,
              borderColor: palette.divider,
              borderRadius: 18,
              padding: 14,
              backgroundColor: palette.surface,
              gap: 10,
            }}
          >
            <KISTextInput
              label="Module title"
              value={courseModuleForm.title}
              onChange={value =>
                setCourseModuleForm(prev => ({ ...prev, title: value }))
              }
            />
            <KISTextInput
              label="Summary"
              value={courseModuleForm.summary}
              onChange={value =>
                setCourseModuleForm(prev => ({ ...prev, summary: value }))
              }
              multiline
              style={{ minHeight: 70 }}
            />
            <KISTextInput
              label="Order"
              value={courseModuleForm.module_order}
              onChange={value =>
                setCourseModuleForm(prev => ({ ...prev, module_order: value }))
              }
              keyboardType="numeric"
            />
            <KISTextInput
              label="Status"
              value={courseModuleForm.status}
              onChange={value =>
                setCourseModuleForm(prev => ({ ...prev, status: value }))
              }
            />
            <KISButton
              title={
                courseModuleForm.is_preview
                  ? 'Preview enabled'
                  : 'Preview disabled'
              }
              size="xs"
              variant="outline"
              onPress={() =>
                setCourseModuleForm(prev => ({
                  ...prev,
                  is_preview: !prev.is_preview,
                }))
              }
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <KISButton
                title={
                  courseModuleSubmitting
                    ? 'Saving…'
                    : editingCourseModuleId
                    ? 'Save module'
                    : 'Create module'
                }
                onPress={() => void handleSaveCourseModule()}
                disabled={courseModuleSubmitting}
              />
              <KISButton
                title="Cancel"
                variant="secondary"
                onPress={closeCourseModuleEditor}
                disabled={courseModuleSubmitting}
              />
            </View>
          </View>
        ) : null}
        {modules.length ? (
          modules.map((module: any, index: number) => (
            <View
              key={module.id || `course-module-${index}`}
              style={{
                borderWidth: 1,
                borderColor: palette.divider,
                borderRadius: 18,
                padding: 14,
                backgroundColor: palette.surface,
                gap: 10,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 10,
                }}
              >
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ color: palette.text, fontWeight: '900' }}>
                    {module.title || `Module ${index + 1}`}
                  </Text>
                  <Text style={{ color: palette.subtext, fontSize: 12 }}>
                    {module.summary || `${module.items?.length || 0} items`}
                  </Text>
                  <Text style={{ color: palette.subtext, fontSize: 11 }}>
                    {module.item_count || module.items?.length || 0} items •{' '}
                    {module.duration_minutes || 0} min
                  </Text>
                </View>
                <View
                  style={{
                    flexDirection: 'row',
                    gap: 8,
                    flexWrap: 'wrap',
                    justifyContent: 'flex-end',
                  }}
                >
                  <KISButton
                    title="Edit"
                    size="xs"
                    variant="outline"
                    onPress={() => openCourseModuleEditor(module)}
                  />
                  <KISButton
                    title="Add item"
                    size="xs"
                    variant="outline"
                    onPress={() => openCourseModuleItemEditor(module.id)}
                  />
                  <KISButton
                    title="Delete"
                    size="xs"
                    variant="secondary"
                    onPress={() => handleDeleteCourseModule(module)}
                  />
                </View>
              </View>
              {(module.items || []).length ? (
                (module.items || []).map((item: any, itemIndex: number) => (
                  <View
                    key={item.id || `${module.id}-item-${itemIndex}`}
                    style={{
                      borderWidth: 1.5,
                      borderColor: `${palette.primaryStrong}66`,
                      borderRadius: 14,
                      padding: 12,
                      backgroundColor: palette.card,
                      gap: 6,
                    }}
                  >
                    <Text style={{ color: palette.text, fontWeight: '800' }}>
                      {item.title || `Item ${itemIndex + 1}`}
                    </Text>
                    <Text style={{ color: palette.subtext, fontSize: 12 }}>
                      {item.summary ||
                        `${item.type || 'item'} • ${
                          item.duration_minutes || 0
                        } min`}
                    </Text>
                    <View
                      style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}
                    >
                      <KISButton
                        title="Edit item"
                        size="xs"
                        variant="outline"
                        onPress={() =>
                          openCourseModuleItemEditor(module.id, item)
                        }
                      />
                      <KISButton
                        title="Delete item"
                        size="xs"
                        variant="secondary"
                        onPress={() =>
                          handleDeleteCourseModuleItem(module.id, item)
                        }
                      />
                    </View>
                  </View>
                ))
              ) : (
                <View
                  style={{
                    borderRadius: 14,
                    padding: 12,
                    backgroundColor: palette.card,
                    borderWidth: 1.5,
                    borderColor: `${palette.primaryStrong}55`,
                  }}
                >
                  <Text style={{ color: palette.subtext }}>
                    No learning items in this module yet.
                  </Text>
                </View>
              )}
            </View>
          ))
        ) : (
          <View
            style={{
              borderRadius: 16,
              padding: 14,
              backgroundColor: palette.card,
              borderWidth: 1.5,
              borderColor: `${palette.primaryStrong}55`,
            }}
          >
            <Text style={{ color: palette.subtext }}>
              No course modules yet. Create the first module to start
              structuring learner flow.
            </Text>
          </View>
        )}
        {courseModuleItemEditorVisible ? (
          <View
            style={{
              borderWidth: 1,
              borderColor: palette.divider,
              borderRadius: 18,
              padding: 14,
              backgroundColor: palette.surface,
              gap: 10,
            }}
          >
            {renderLookupSelector(
              'Module',
              toText(courseModuleItemForm.module_id),
              modules.map((row: any) => ({
                id: row.id,
                title: row.title,
                summary: row.summary,
              })),
              value =>
                setCourseModuleItemForm(prev => ({
                  ...prev,
                  module_id: value,
                })),
              'Choose the module that should contain this learning item.',
              false,
            )}
            <KISTextInput
              label="Item type"
              value={courseModuleItemForm.item_type}
              onChange={value =>
                setCourseModuleItemForm(prev => ({
                  ...prev,
                  item_type: value,
                  lesson_id: '',
                  material_id: '',
                  class_session_id: '',
                  assessment_id: '',
                  event_id: '',
                  broadcast_id: '',
                }))
              }
              placeholder="lesson, material, class_session, assessment, event, broadcast"
            />
            {renderLookupSelector(
              'Linked item',
              toText(
                courseModuleItemForm[targetKeyMap[currentType] || 'lesson_id'],
              ),
              itemTypeLookup[currentType] || [],
              value =>
                setCourseModuleItemForm(prev => ({
                  ...prev,
                  [targetKeyMap[currentType] || 'lesson_id']: value,
                })),
              'Choose the content record to place in this module.',
              false,
            )}
            <KISTextInput
              label="Order"
              value={courseModuleItemForm.item_order}
              onChange={value =>
                setCourseModuleItemForm(prev => ({
                  ...prev,
                  item_order: value,
                }))
              }
              keyboardType="numeric"
            />
            <KISTextInput
              label="Display title override"
              value={courseModuleItemForm.title_override}
              onChange={value =>
                setCourseModuleItemForm(prev => ({
                  ...prev,
                  title_override: value,
                }))
              }
            />
            <KISTextInput
              label="Summary override"
              value={courseModuleItemForm.summary_override}
              onChange={value =>
                setCourseModuleItemForm(prev => ({
                  ...prev,
                  summary_override: value,
                }))
              }
              multiline
              style={{ minHeight: 70 }}
            />
            <KISTextInput
              label="Estimated minutes"
              value={courseModuleItemForm.estimated_minutes}
              onChange={value =>
                setCourseModuleItemForm(prev => ({
                  ...prev,
                  estimated_minutes: value,
                }))
              }
              keyboardType="numeric"
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <KISButton
                title={
                  courseModuleSubmitting
                    ? 'Saving…'
                    : editingCourseModuleItemId
                    ? 'Save item'
                    : 'Create item'
                }
                onPress={() => void handleSaveCourseModuleItem()}
                disabled={courseModuleSubmitting}
              />
              <KISButton
                title="Cancel"
                variant="secondary"
                onPress={closeCourseModuleItemEditor}
                disabled={courseModuleSubmitting}
              />
            </View>
          </View>
        ) : null}
      </View>
    );
  }, [
    closeCourseModuleEditor,
    closeCourseModuleItemEditor,
    courseModuleEditorVisible,
    courseModuleForm,
    courseModuleItemEditorVisible,
    courseModuleItemForm,
    courseModuleSubmitting,
    detailPayload,
    editingCourseModuleId,
    editingCourseModuleItemId,
    handleDeleteCourseModule,
    handleDeleteCourseModuleItem,
    handleSaveCourseModule,
    handleSaveCourseModuleItem,
    moduleLookups,
    openCourseModuleEditor,
    openCourseModuleItemEditor,
    palette.card,
    palette.divider,
    palette.primaryStrong,
    palette.subtext,
    palette.surface,
    palette.text,
    renderLookupSelector,
  ]);

  const renderDetailCollection = useCallback(
    (
      label: string,
      rows: any[] | undefined,
      pickTitle?: (row: any) => string,
      pickSummary?: (row: any) => string,
      detailModuleKey?: EducationModuleKey,
    ) => {
      const list = Array.isArray(rows) ? rows : [];
      if (!list.length) return null;
      const sectionLabel = label.replace(/^Related\s+/i, '');
      return (
        <View
          style={{
            gap: 12,
            borderWidth: 1,
            borderColor: palette.divider,
            borderRadius: 20,
            padding: 16,
            backgroundColor: palette.surface,
          }}
        >
          <View style={{ gap: 4 }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <Text
                style={{ color: palette.text, fontWeight: '900', fontSize: 16 }}
              >
                {sectionLabel}
              </Text>
              <View
                style={{
                  borderRadius: 999,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  backgroundColor: palette.background,
                }}
              >
                <Text
                  style={{
                    color: palette.subtext,
                    fontSize: 11,
                    fontWeight: '800',
                  }}
                >
                  {list.length} record{list.length === 1 ? '' : 's'}
                </Text>
              </View>
            </View>
            <Text style={{ color: palette.subtext, fontSize: 12 }}>
              {sectionLabel} connected to this workspace.
            </Text>
          </View>
          {list.map((row, index) => (
            <View
              key={
                row.id ||
                `${label}-${pickTitle?.(row) || row.title || row.name || 'row'}`
              }
              style={{
                borderWidth: 1.5,
                borderColor: `${palette.primaryStrong}66`,
                borderRadius: 18,
                padding: 14,
                backgroundColor: palette.card,
                gap: 8,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  gap: 12,
                  alignItems: 'flex-start',
                }}
              >
                {resolveEducationCoverImage(row) ? (
                  <Image
                    source={{ uri: resolveEducationCoverImage(row) }}
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 16,
                      backgroundColor: palette.background,
                      borderWidth: 1,
                      borderColor: `${palette.primaryStrong}44`,
                    }}
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 12,
                      backgroundColor: palette.primarySoft ?? palette.surface,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text
                      style={{
                        color: palette.primaryStrong,
                        fontWeight: '900',
                      }}
                    >
                      {index + 1}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1, gap: 5 }}>
                  <Text style={{ color: palette.text, fontWeight: '800' }}>
                    {(detailModuleKey
                      ? renderRelatedPrimary(detailModuleKey, row)
                      : pickTitle
                      ? pickTitle(row)
                      : getEducationRecordTitle(row, 'Record')) || 'Record'}
                  </Text>
                  <Text
                    style={{
                      color: palette.subtext,
                      fontSize: 12,
                      lineHeight: 18,
                    }}
                  >
                    {(detailModuleKey
                      ? renderRelatedSummary(detailModuleKey, row)
                      : pickSummary
                      ? pickSummary(row)
                      : toText(row.summary || row.description || row.status)) ||
                      'No details yet.'}
                  </Text>
                </View>
              </View>
              {detailModuleKey ? (
                <View
                  style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}
                >
                  <KISButton
                    title="Open workspace"
                    size="xs"
                    variant="outline"
                    onPress={() =>
                      void openDetailForModule(detailModuleKey, row, true)
                    }
                  />
                </View>
              ) : null}
            </View>
          ))}
        </View>
      );
    },
    [
      getEducationRecordTitle,
      openDetailForModule,
      palette.background,
      palette.card,
      palette.divider,
      palette.primarySoft,
      palette.primaryStrong,
      palette.subtext,
      palette.surface,
      palette.text,
      renderRelatedPrimary,
      renderRelatedSummary,
    ],
  );

  const renderDetailMetricsBlock = useCallback(
    (metrics: Record<string, any>) => {
      if (!Object.keys(metrics || {}).length) return null;
      return (
        <View style={{ gap: 8 }}>
          <Text
            style={{ color: palette.text, fontWeight: '900', fontSize: 15 }}
          >
            Workspace metrics
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {Object.entries(metrics).map(([key, value], index) => {
              const isPrimary = index < 2;
              return (
                <View
                  key={key}
                  style={{
                    minWidth: '47%',
                    flexGrow: 1,
                    borderWidth: 1,
                    borderColor: isPrimary
                      ? palette.primaryStrong
                      : palette.divider,
                    borderRadius: 18,
                    padding: 14,
                    backgroundColor: isPrimary
                      ? palette.primarySoft ?? palette.card
                      : palette.card,
                    gap: 6,
                  }}
                >
                  <Text
                    style={{
                      color: palette.text,
                      fontWeight: '900',
                      fontSize: isPrimary ? 22 : 18,
                    }}
                  >
                    {String(value)}
                  </Text>
                  <Text
                    style={{
                      color: palette.subtext,
                      fontSize: 12,
                      fontWeight: '700',
                    }}
                  >
                    {formatMetricLabel(key)}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      );
    },
    [
      palette.card,
      palette.divider,
      palette.primarySoft,
      palette.primaryStrong,
      palette.subtext,
      palette.text,
    ],
  );

  const renderDetailInsightsBlock = useCallback(() => {
    if (!detailSummary.length) return null;
    return (
      <View style={{ gap: 8 }}>
        <Text style={{ color: palette.text, fontWeight: '800' }}>
          Operational insights
        </Text>
        {renderSummaryCards(detailSummary)}
      </View>
    );
  }, [detailSummary, palette.text, renderSummaryCards]);

  const renderEnrollmentActionsBlock = useCallback(
    (enrollment: any) => {
      if (!enrollment?.id) return null;
      return (
        <View style={{ gap: 8 }}>
          <Text style={{ color: palette.text, fontWeight: '800' }}>
            Enrollment actions
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {enrollment.status !== 'enrolled' ? (
              <KISButton
                title="Enroll"
                size="xs"
                variant="outline"
                onPress={() =>
                  void handleEnrollmentAction(enrollment.id, 'enroll')
                }
              />
            ) : null}
            {enrollment.status !== 'waitlisted' ? (
              <KISButton
                title="Waitlist"
                size="xs"
                variant="outline"
                onPress={() =>
                  void handleEnrollmentAction(enrollment.id, 'waitlist')
                }
              />
            ) : null}
            {enrollment.status !== 'completed' ? (
              <KISButton
                title="Complete"
                size="xs"
                variant="outline"
                onPress={() =>
                  void handleEnrollmentAction(enrollment.id, 'complete')
                }
              />
            ) : null}
            {enrollment.status !== 'cancelled' ? (
              <KISButton
                title="Cancel"
                size="xs"
                variant="secondary"
                onPress={() =>
                  void handleEnrollmentAction(enrollment.id, 'cancel')
                }
              />
            ) : null}
          </View>
        </View>
      );
    },
    [handleEnrollmentAction, palette.text],
  );

  const renderBookingActionsBlock = useCallback(
    (booking: any) => {
      if (!booking?.id) return null;
      return (
        <View style={{ gap: 8 }}>
          <Text style={{ color: palette.text, fontWeight: '800' }}>
            Booking actions
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {booking.status !== 'confirmed' ? (
              <KISButton
                title="Confirm"
                size="xs"
                variant="outline"
                onPress={() => void handleBookingAction(booking.id, 'confirm')}
              />
            ) : null}
            {booking.status !== 'payment_pending' ? (
              <KISButton
                title="Mark payment pending"
                size="xs"
                variant="outline"
                onPress={() =>
                  void handleBookingAction(booking.id, 'payment_pending')
                }
              />
            ) : null}
            {booking.status !== 'waitlisted' ? (
              <KISButton
                title="Waitlist"
                size="xs"
                variant="outline"
                onPress={() => void handleBookingAction(booking.id, 'waitlist')}
              />
            ) : null}
            {booking.status !== 'cancelled' ? (
              <KISButton
                title="Cancel"
                size="xs"
                variant="secondary"
                onPress={() => void handleBookingAction(booking.id, 'cancel')}
              />
            ) : null}
            {booking.status !== 'expired' ? (
              <KISButton
                title="Expire"
                size="xs"
                variant="secondary"
                onPress={() => void handleBookingAction(booking.id, 'expire')}
              />
            ) : null}
          </View>
        </View>
      );
    },
    [handleBookingAction, palette.text],
  );

  const renderStaffAssignmentCards = useCallback(
    (assignments: any[]) => {
      return (
        <View
          style={{
            gap: 10,
            borderWidth: 1,
            borderColor: palette.divider,
            borderRadius: 16,
            padding: 12,
            backgroundColor: palette.card,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <Text style={{ color: palette.text, fontWeight: '800' }}>
              Staff assignments
            </Text>
          </View>
          {assignments?.length ? (
            <View style={{ gap: 8 }}>
              {assignments.map((assignment: any) => (
                <View
                  key={assignment.id}
                  style={{
                    borderWidth: 1,
                    borderColor: palette.divider,
                    borderRadius: 14,
                    padding: 12,
                    backgroundColor: palette.background,
                    gap: 6,
                  }}
                >
                  <Text style={{ color: palette.text, fontWeight: '700' }}>
                    {toText(assignment.role || 'Assignment')}
                  </Text>
                  <Text style={{ color: palette.subtext, fontSize: 12 }}>
                    {[
                      toText(assignment.status),
                      toText(
                        assignment.course_id ||
                          assignment.class_session_id ||
                          assignment.event_id ||
                          assignment.assessment_id ||
                          assignment.program_id,
                      ),
                    ]
                      .filter(Boolean)
                      .join(' • ') || 'No linked record yet.'}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={{ color: palette.subtext }}>
              No staff assignments yet.
            </Text>
          )}
        </View>
      );
    },
    [
      palette.background,
      palette.card,
      palette.divider,
      palette.subtext,
      palette.text,
    ],
  );

  const renderProgramDetail = useCallback(
    (metrics: Record<string, any>) => (
      <View style={{ gap: 12 }}>
        {renderDetailSummaryCard(detailRecordSummary)}
        {renderDetailMetricsBlock(metrics)}
        {renderDetailInsightsBlock()}
        {renderDetailCollection(
          'Courses',
          detailPayload.courses,
          undefined,
          undefined,
          'courses',
        )}
        {renderDetailCollection(
          'Materials',
          detailPayload.materials,
          undefined,
          undefined,
          'materials',
        )}
        {renderDetailCollection(
          'Events',
          detailPayload.events,
          undefined,
          undefined,
          'events',
        )}
        {renderDetailCollection(
          'Broadcasts',
          detailPayload.broadcasts,
          undefined,
          undefined,
          'broadcasts',
        )}
        {renderDetailCollection(
          'Enrollments',
          detailPayload.enrollments,
          undefined,
          row =>
            toText(row.status || row.related_item_type || row.content_type),
          'enrollments',
        )}
        {renderDetailCollection(
          'Bookings',
          detailPayload.bookings,
          undefined,
          row =>
            toText(row.status || row.currency || row.event_id || row.course_id),
          'bookings',
        )}
        {renderDetailCollection(
          'Staff assignments',
          detailPayload.staff_assignments,
          row => toText(row.display_name || row.role),
          row => toText(row.role || row.status),
          'staff',
        )}
      </View>
    ),
    [
      detailPayload,
      detailRecordSummary,
      renderDetailCollection,
      renderDetailInsightsBlock,
      renderDetailMetricsBlock,
      renderDetailSummaryCard,
    ],
  );

  const renderCourseDetail = useCallback(
    (metrics: Record<string, any>) => (
      <View style={{ gap: 12 }}>
        {renderDetailSummaryCard(detailRecordSummary)}
        {renderDetailMetricsBlock(metrics)}
        {renderDetailInsightsBlock()}
        {renderDetailCollection(
          'Course outline',
          detailPayload.course_outline,
          row => getEducationRecordTitle(row, 'Module'),
          row =>
            toText(
              `${row.item_count || 0} items • ${row.duration_minutes || 0} min`,
            ),
        )}
        {renderCourseModuleWorkspace()}
        {renderDetailCollection(
          'Lessons',
          detailPayload.lessons,
          undefined,
          undefined,
          'lessons',
        )}
        {renderDetailCollection(
          'Class sessions',
          detailPayload.class_sessions,
          undefined,
          undefined,
          'classes',
        )}
        {renderDetailCollection(
          'Materials',
          detailPayload.materials,
          undefined,
          undefined,
          'materials',
        )}
        {renderDetailCollection(
          'Assessments',
          detailPayload.assessments,
          undefined,
          undefined,
          'exams',
        )}
        {renderDetailCollection(
          'Events',
          detailPayload.events,
          undefined,
          undefined,
          'events',
        )}
        {renderDetailCollection(
          'Broadcasts',
          detailPayload.broadcasts,
          undefined,
          undefined,
          'broadcasts',
        )}
        {renderDetailCollection(
          'Enrollments',
          detailPayload.enrollments,
          undefined,
          row => toText(row.status || row.lesson_id || row.class_session_id),
          'enrollments',
        )}
        {renderDetailCollection(
          'Bookings',
          detailPayload.bookings,
          undefined,
          row => toText(row.status || row.currency || row.class_session_id),
          'bookings',
        )}
        {renderDetailCollection(
          'Staff assignments',
          detailPayload.staff_assignments,
          row => toText(row.display_name || row.role),
          row => toText(row.role || row.status),
          'staff',
        )}
      </View>
    ),
    [
      detailPayload,
      detailRecordSummary,
      getEducationRecordTitle,
      renderCourseModuleWorkspace,
      renderDetailCollection,
      renderDetailInsightsBlock,
      renderDetailMetricsBlock,
      renderDetailSummaryCard,
    ],
  );

  const renderMaterialDetail = useCallback(() => {
    const material = detailPayload?.material;
    if (!material) return null;
    const pickLinkedRows = (
      rows: any[],
      ids: any[] | undefined,
      singleId?: any,
    ) => {
      const allIds = [
        ...(Array.isArray(ids) ? ids : []),
        ...(singleId ? [singleId] : []),
      ]
        .map(value => toText(value))
        .filter(Boolean);
      if (!allIds.length) return [];
      return rows.filter(row => allIds.includes(toText(row?.id)));
    };
    const linkedPrograms = pickLinkedRows(
      moduleLookups.programs,
      material.program_ids,
      material.program_id,
    );
    const linkedCourses = pickLinkedRows(
      moduleLookups.courses,
      material.course_ids,
      material.course_id,
    );
    const linkedLessons = pickLinkedRows(
      moduleLookups.lessons,
      material.lesson_ids,
      material.lesson_id,
    );
    const linkedClasses = pickLinkedRows(
      moduleLookups.classSessions,
      material.class_session_ids,
      material.class_session_id,
    );
    const linkedAssessments = pickLinkedRows(
      moduleLookups.assessments,
      material.assessment_ids,
      material.assessment_id,
    );

    return (
      <View style={{ gap: 12 }}>
        {renderDetailSummaryCard(detailRecordSummary)}
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <EducationActionButton
            palette={palette}
            label="Edit material"
            onPress={() =>
              void openModuleEditorForModule('materials', material)
            }
          />
          <EducationActionButton
            palette={palette}
            label="Delete material"
            variant="ghost"
            onPress={() => handleDeleteModuleRecord(material)}
          />
        </View>
        <EducationSectionCard
          palette={palette}
          eyebrow="Material links"
          title="Where this material appears"
          description="Use edit material to add this file to more learning items or remove it from any linked item."
        >
          <View style={{ gap: 10 }}>
            {renderSummaryCards([
              { label: 'Programs', value: String(linkedPrograms.length) },
              { label: 'Courses', value: String(linkedCourses.length) },
              { label: 'Lessons', value: String(linkedLessons.length) },
              { label: 'Classes', value: String(linkedClasses.length) },
              { label: 'Assessments', value: String(linkedAssessments.length) },
            ])}
          </View>
        </EducationSectionCard>
        {renderDetailCollection(
          'Programs',
          linkedPrograms,
          undefined,
          undefined,
          'programs',
        )}
        {renderDetailCollection(
          'Courses',
          linkedCourses,
          undefined,
          undefined,
          'courses',
        )}
        {renderDetailCollection(
          'Lessons',
          linkedLessons,
          undefined,
          undefined,
          'lessons',
        )}
        {renderDetailCollection(
          'Class sessions',
          linkedClasses,
          undefined,
          undefined,
          'classes',
        )}
        {renderDetailCollection(
          'Assessments',
          linkedAssessments,
          undefined,
          undefined,
          'exams',
        )}
        {renderMaterialPreviewCard(material)}
      </View>
    );
  }, [
    detailPayload,
    detailRecordSummary,
    handleDeleteModuleRecord,
    moduleLookups.assessments,
    moduleLookups.classSessions,
    moduleLookups.courses,
    moduleLookups.lessons,
    moduleLookups.programs,
    openModuleEditorForModule,
    palette,
    renderDetailCollection,
    renderDetailSummaryCard,
    renderMaterialPreviewCard,
    renderSummaryCards,
  ]);

  const renderEnrollmentDetail = useCallback(
    () => (
      <View style={{ gap: 12 }}>
        {renderDetailSummaryCard(detailRecordSummary)}
        {renderDetailCollection(
          'Related bookings',
          detailPayload.bookings,
          undefined,
          row => toText(row.status || row.currency || row.payment_method),
          'bookings',
        )}
        {renderDetailCollection(
          'Assessment submissions',
          detailPayload.assessment_submissions,
          row => getEducationPersonName(row, 'Submission'),
          row => toText(row.status || row.score_percent),
        )}
        {renderEnrollmentActionsBlock(detailPayload.enrollment)}
      </View>
    ),
    [
      detailPayload,
      detailRecordSummary,
      getEducationPersonName,
      renderDetailCollection,
      renderDetailSummaryCard,
      renderEnrollmentActionsBlock,
    ],
  );

  const renderBookingDetail = useCallback(() => {
    const booking = detailPayload?.booking;
    const bookingTarget = booking ? getBookingLookupTarget(booking) : null;
    const learnerName =
      toText(
        booking?.learner_display_name ||
          booking?.user_display_name ||
          booking?.display_name,
      ) || 'Unknown learner';
    return (
      <View style={{ gap: 12 }}>
        {renderDetailSummaryCard(detailRecordSummary)}
        <View
          style={{
            gap: 10,
            borderWidth: 1,
            borderColor: palette.divider,
            borderRadius: 16,
            padding: 12,
            backgroundColor: palette.card,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              gap: 10,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: palette.text, fontWeight: '800' }}>
              Booking details
            </Text>
            <EducationStatusBadge
              palette={palette}
              label={formatMetricLabel(toText(booking?.status || 'unknown'))}
              tone={
                ['confirmed'].includes(toText(booking?.status).toLowerCase())
                  ? 'success'
                  : [
                      'pending',
                      'payment_pending',
                      'waitlisted',
                      'waitlist',
                    ].includes(toText(booking?.status).toLowerCase())
                  ? 'warning'
                  : ['cancelled', 'expired'].includes(
                      toText(booking?.status).toLowerCase(),
                    )
                  ? 'danger'
                  : 'muted'
              }
            />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {[
              { label: 'Learner', value: learnerName },
              { label: 'Booked item', value: renderBookingPrimary(booking) },
              {
                label: 'Type',
                value: formatMetricLabel(
                  toText(
                    booking?.booked_item_type ||
                      bookingTarget?.booked_item_type ||
                      'education item',
                  ),
                ),
              },
              {
                label: 'Seats',
                value: String(Number(booking?.seat_count || 1)),
              },
            ].map(item => (
              <View
                key={item.label}
                style={{
                  minWidth: '47%',
                  flexGrow: 1,
                  borderWidth: 1,
                  borderColor: palette.divider,
                  borderRadius: 14,
                  padding: 12,
                  backgroundColor: palette.background,
                  gap: 4,
                }}
              >
                <Text style={{ color: palette.subtext, fontSize: 12 }}>
                  {item.label}
                </Text>
                <Text style={{ color: palette.text, fontWeight: '800' }}>
                  {item.value}
                </Text>
              </View>
            ))}
          </View>
          {bookingTarget ? (
            <Text
              style={{ color: palette.subtext, fontSize: 12, lineHeight: 18 }}
            >
              {toText(bookingTarget.summary || bookingTarget.description) ||
                'This booking is linked to a live education item in the institution workspace.'}
            </Text>
          ) : null}
        </View>
        <View
          style={{
            gap: 10,
            borderWidth: 1,
            borderColor: palette.divider,
            borderRadius: 16,
            padding: 12,
            backgroundColor: palette.card,
          }}
        >
          <Text style={{ color: palette.text, fontWeight: '800' }}>
            Payment and timing
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {[
              {
                label: 'Status',
                value: formatMetricLabel(toText(booking?.status || 'unknown')),
              },
              {
                label: 'Amount',
                value: formatEducationAmount(
                  booking?.amount_paid_cents ??
                    booking?.amount_cents ??
                    booking?.price_amount,
                  booking?.currency || booking?.price_currency,
                ),
              },
              {
                label: 'Payment',
                value: formatMetricLabel(
                  toText(
                    booking?.payment_method ||
                      booking?.payment_status ||
                      'Not set',
                  ),
                ),
              },
              {
                label: 'When',
                value:
                  formatEducationDateTime(
                    booking?.starts_at ||
                      booking?.created_at ||
                      booking?.booked_at,
                  ) || 'Not scheduled',
              },
            ].map(item => (
              <View
                key={item.label}
                style={{
                  minWidth: '47%',
                  flexGrow: 1,
                  borderWidth: 1,
                  borderColor: palette.divider,
                  borderRadius: 14,
                  padding: 12,
                  backgroundColor: palette.background,
                  gap: 4,
                }}
              >
                <Text style={{ color: palette.subtext, fontSize: 12 }}>
                  {item.label}
                </Text>
                <Text style={{ color: palette.text, fontWeight: '800' }}>
                  {item.value}
                </Text>
              </View>
            ))}
          </View>
        </View>
        {detailPayload?.enrollment
          ? renderDetailCollection(
              'Linked enrollment',
              [detailPayload.enrollment],
              undefined,
              row =>
                toText(row.status || row.related_item_type || row.content_type),
              'enrollments',
            )
          : null}
        {renderBookingActionsBlock(booking)}
      </View>
    );
  }, [
    detailPayload,
    detailRecordSummary,
    getBookingLookupTarget,
    palette,
    renderBookingActionsBlock,
    renderBookingPrimary,
    renderDetailCollection,
    renderDetailSummaryCard,
  ]);

  const renderBroadcastDetail = useCallback(
    (metrics: Record<string, any>) => (
      <View style={{ gap: 12 }}>
        {renderDetailSummaryCard(detailRecordSummary)}
        {renderDetailMetricsBlock(metrics)}
        {renderDetailInsightsBlock()}
        {renderDetailCollection(
          'Enrollments',
          detailPayload.enrollments,
          undefined,
          row =>
            toText(row.status || row.related_item_type || row.content_type),
          'enrollments',
        )}
        {renderDetailCollection(
          'Bookings',
          detailPayload.bookings,
          undefined,
          row => toText(row.status || row.currency || row.payment_method),
          'bookings',
        )}
        {renderDetailCollection(
          'Staff assignments',
          detailPayload.staff_assignments,
          row => toText(row.display_name || row.role),
          row => toText(row.role || row.status),
          'staff',
        )}
      </View>
    ),
    [
      detailPayload,
      detailRecordSummary,
      renderDetailCollection,
      renderDetailInsightsBlock,
      renderDetailMetricsBlock,
      renderDetailSummaryCard,
    ],
  );

  const renderMembershipDetail = useCallback(() => {
    const membership = detailPayload?.membership;
    const isStaffDetail = activeModuleKey === 'staff';
    return (
      <View style={{ gap: 12 }}>
        {renderDetailSummaryCard(detailRecordSummary)}
        {!isStaffDetail ? (
          <>
            {renderDetailCollection(
              'Enrollments',
              detailPayload.enrollments,
              undefined,
              row =>
                toText(row.status || row.related_item_type || row.content_type),
              'enrollments',
            )}
            {renderDetailCollection(
              'Bookings',
              detailPayload.bookings,
              undefined,
              row => toText(row.status || row.currency || row.event_id),
            )}
            {renderDetailCollection(
              'Assessment submissions',
              detailPayload.assessment_submissions,
              row => getEducationPersonName(row, 'Submission'),
              row => toText(row.status || row.score_percent),
            )}
          </>
        ) : null}
        {isStaffDetail ? (
          <View
            style={{
              gap: 10,
              borderWidth: 1,
              borderColor: palette.divider,
              borderRadius: 16,
              padding: 12,
              backgroundColor: palette.card,
            }}
          >
            <Text style={{ color: palette.text, fontWeight: '800' }}>
              Staff member details
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {[
                {
                  label: 'Name',
                  value: toText(membership?.display_name) || 'Unknown member',
                },
                {
                  label: 'Current role',
                  value: formatMetricLabel(
                    toText(membership?.role || 'unknown'),
                  ),
                },
                {
                  label: 'Status',
                  value: formatMetricLabel(
                    toText(membership?.status || 'unknown'),
                  ),
                },
                {
                  label: 'Phone',
                  value: toText(membership?.phone) || 'No phone number',
                },
                {
                  label: 'Email',
                  value: toText(membership?.email) || 'No email address',
                },
              ].map(item => (
                <View
                  key={item.label}
                  style={{
                    minWidth: '47%',
                    flexGrow: 1,
                    borderWidth: 1,
                    borderColor: palette.divider,
                    borderRadius: 14,
                    padding: 12,
                    backgroundColor: palette.background,
                    gap: 4,
                  }}
                >
                  <Text style={{ color: palette.subtext, fontSize: 12 }}>
                    {item.label}
                  </Text>
                  <Text style={{ color: palette.text, fontWeight: '800' }}>
                    {item.value}
                  </Text>
                </View>
              ))}
              {toText(membership?.title) ? (
                <View
                  style={{
                    width: '100%',
                    borderWidth: 1,
                    borderColor: palette.divider,
                    borderRadius: 14,
                    padding: 12,
                    backgroundColor: palette.background,
                    gap: 4,
                  }}
                >
                  <Text style={{ color: palette.subtext, fontSize: 12 }}>
                    Title
                  </Text>
                  <Text style={{ color: palette.text, fontWeight: '700' }}>
                    {toText(membership?.title)}
                  </Text>
                </View>
              ) : null}
            </View>
            {toText(membership?.role) === 'owner' ? (
              <Text style={{ color: palette.subtext, fontSize: 12 }}>
                The institution owner role is locked and cannot be changed or
                removed.
              </Text>
            ) : (
              <View style={{ gap: 8 }}>
                <Text style={{ color: palette.text, fontWeight: '800' }}>
                  Assign role
                </Text>
                <View
                  style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}
                >
                  {EDUCATION_STAFF_ROLE_OPTIONS.map(option => {
                    const active = toText(membership?.role) === option.value;
                    return (
                      <KISButton
                        key={option.value}
                        title={option.label}
                        size="xs"
                        variant={active ? 'secondary' : 'outline'}
                        onPress={() =>
                          void handleUpdateStaffMembershipRole(
                            membership,
                            option.value,
                          )
                        }
                        disabled={
                          !canManageEducationStaffRoles ||
                          updatingStaffRole !== null
                        }
                        loading={updatingStaffRole === option.value}
                      />
                    );
                  })}
                </View>
                {!canManageEducationStaffRoles ? (
                  <Text style={{ color: palette.subtext, fontSize: 12 }}>
                    Only the owner or an administrator can assign staff roles.
                  </Text>
                ) : null}
              </View>
            )}
          </View>
        ) : null}
        {isStaffDetail || Boolean(detailPayload?.staff_assignments)
          ? renderDetailCollection(
              'Staff assignments',
              detailPayload.staff_assignments,
              row => toText(row.display_name || row.role),
              row => toText(row.role || row.status),
            )
          : null}
        {isStaffDetail || Boolean(detailPayload?.broadcasts)
          ? renderDetailCollection('Broadcasts', detailPayload.broadcasts)
          : null}
        {isStaffDetail || Boolean(detailPayload?.staff_assignments)
          ? renderStaffAssignmentCards(detailPayload?.staff_assignments ?? [])
          : null}
      </View>
    );
  }, [
    activeModuleKey,
    canManageEducationStaffRoles,
    detailPayload,
    detailRecordSummary,
    getEducationPersonName,
    handleUpdateStaffMembershipRole,
    palette.background,
    palette.card,
    palette.divider,
    palette.subtext,
    palette.text,
    renderDetailCollection,
    renderDetailSummaryCard,
    renderStaffAssignmentCards,
    updatingStaffRole,
  ]);

  const renderGenericDetail = useCallback(
    (metrics: Record<string, any>) => (
      <View style={{ gap: 12 }}>
        {renderDetailSummaryCard(detailRecordSummary)}
        {detailPayload?.lesson ||
        detailPayload?.class_session ||
        detailPayload?.assessment ||
        detailPayload?.event
          ? renderDetailMetricsBlock(metrics)
          : null}
        {detailPayload?.lesson ||
        detailPayload?.class_session ||
        detailPayload?.assessment ||
        detailPayload?.event
          ? renderDetailInsightsBlock()
          : null}
        {detailPayload?.lesson
          ? renderDetailCollection(
              'Materials',
              detailPayload.materials,
              undefined,
              undefined,
              'materials',
            )
          : null}
        {detailPayload?.lesson
          ? renderDetailCollection(
              'Class sessions',
              detailPayload.class_sessions,
              undefined,
              undefined,
              'classes',
            )
          : null}
        {detailPayload?.lesson
          ? renderDetailCollection(
              'Assessments',
              detailPayload.assessments,
              undefined,
              undefined,
              'exams',
            )
          : null}
        {detailPayload?.lesson
          ? renderDetailCollection(
              'Broadcasts',
              detailPayload.broadcasts,
              undefined,
              undefined,
              'broadcasts',
            )
          : null}
        {detailPayload?.lesson
          ? renderDetailCollection(
              'Enrollments',
              detailPayload.enrollments,
              undefined,
              row => toText(row.status || row.class_session_id),
              'enrollments',
            )
          : null}

        {detailPayload?.class_session
          ? renderDetailCollection(
              'Materials',
              detailPayload.materials,
              undefined,
              undefined,
              'materials',
            )
          : null}
        {detailPayload?.class_session
          ? renderDetailCollection(
              'Assessments',
              detailPayload.assessments,
              undefined,
              undefined,
              'exams',
            )
          : null}
        {detailPayload?.class_session
          ? renderDetailCollection(
              'Events',
              detailPayload.events,
              undefined,
              undefined,
              'events',
            )
          : null}
        {detailPayload?.class_session
          ? renderDetailCollection(
              'Broadcasts',
              detailPayload.broadcasts,
              undefined,
              undefined,
              'broadcasts',
            )
          : null}
        {detailPayload?.class_session
          ? renderDetailCollection(
              'Enrollments',
              detailPayload.enrollments,
              undefined,
              row =>
                toText(row.status || row.related_item_type || row.content_type),
              'enrollments',
            )
          : null}
        {detailPayload?.class_session
          ? renderDetailCollection(
              'Bookings',
              detailPayload.bookings,
              undefined,
              row => toText(row.status || row.currency),
              'bookings',
            )
          : null}
        {detailPayload?.class_session
          ? renderDetailCollection(
              'Staff assignments',
              detailPayload.staff_assignments,
              row => toText(row.display_name || row.role),
              row => toText(row.role || row.status),
              'staff',
            )
          : null}

        {detailPayload?.assessment
          ? renderDetailCollection(
              'Questions',
              detailPayload.questions,
              row => getEducationRecordTitle(row, 'Question'),
              row => toText(row.question_type || row.points_possible),
            )
          : null}
        {detailPayload?.assessment
          ? renderDetailCollection(
              'Materials',
              detailPayload.materials,
              undefined,
              undefined,
              'materials',
            )
          : null}
        {detailPayload?.assessment
          ? renderDetailCollection(
              'Submissions',
              detailPayload.submissions,
              row => getEducationPersonName(row, 'Submission'),
              row => toText(row.status || row.score_percent),
            )
          : null}
        {detailPayload?.assessment
          ? renderDetailCollection(
              'Staff assignments',
              detailPayload.staff_assignments,
              row => toText(row.display_name || row.role),
              row => toText(row.role || row.status),
              'staff',
            )
          : null}

        {detailPayload?.event
          ? renderDetailCollection(
              'Materials',
              detailPayload.materials,
              undefined,
              undefined,
              'materials',
            )
          : null}
        {detailPayload?.material
          ? renderMaterialPreviewCard(detailPayload.material)
          : null}
        {detailPayload?.event
          ? renderDetailCollection(
              'Broadcasts',
              detailPayload.broadcasts,
              undefined,
              undefined,
              'broadcasts',
            )
          : null}
        {detailPayload?.event
          ? renderDetailCollection(
              'Enrollments',
              detailPayload.enrollments,
              undefined,
              row =>
                toText(row.status || row.related_item_type || row.content_type),
              'enrollments',
            )
          : null}
        {detailPayload?.event
          ? renderDetailCollection(
              'Bookings',
              detailPayload.bookings,
              undefined,
              row => toText(row.status || row.currency || row.payment_method),
              'bookings',
            )
          : null}
        {detailPayload?.event
          ? renderDetailCollection(
              'Staff assignments',
              detailPayload.staff_assignments,
              row => toText(row.display_name || row.role),
              row => toText(row.role || row.status),
              'staff',
            )
          : null}
      </View>
    ),
    [
      detailPayload,
      detailRecordSummary,
      getEducationPersonName,
      getEducationRecordTitle,
      renderDetailCollection,
      renderDetailInsightsBlock,
      renderDetailMetricsBlock,
      renderDetailSummaryCard,
      renderMaterialPreviewCard,
    ],
  );

  const getEducationToneForStatus = useCallback((value: any) => {
    const status = toText(value).toLowerCase();
    if (!status) return 'muted';
    if (
      [
        'confirmed',
        'enrolled',
        'completed',
        'active',
        'published',
        'approved',
        'success',
      ].includes(status)
    )
      return 'success';
    if (
      [
        'pending',
        'payment_pending',
        'waitlisted',
        'draft',
        'scheduled',
      ].includes(status)
    )
      return 'warning';
    if (
      [
        'cancelled',
        'rejected',
        'expired',
        'archived',
        'removed',
        'failed',
      ].includes(status)
    )
      return 'danger';
    if (
      ['owner', 'administrator', 'manager', 'private', 'public'].includes(
        status,
      )
    )
      return 'accent';
    return 'muted';
  }, []);

  const getModuleCardStatus = useCallback(
    (item: any) => {
      if (!activeModuleKey) return '';
      switch (activeModuleKey) {
        case 'bookings':
        case 'enrollments':
        case 'memberships':
        case 'students':
        case 'staff':
        case 'programs':
        case 'courses':
        case 'lessons':
        case 'classes':
        case 'materials':
        case 'exams':
        case 'events':
        case 'broadcasts':
          return formatMetricLabel(toText(item?.status || item?.role || ''));
        default:
          return '';
      }
    },
    [activeModuleKey],
  );

  const getModuleCardMetaItems = useCallback(
    (item: any) => {
      if (!activeModuleKey) return [];
      switch (activeModuleKey) {
        case 'bookings':
          return [
            toText(
              item?.learner_display_name ||
                item?.user_display_name ||
                item?.display_name,
            ),
            formatEducationAmount(
              item?.amount_paid_cents ??
                item?.amount_cents ??
                item?.price_amount,
              item?.currency || item?.price_currency,
            ),
            formatEducationDateTime(
              item?.starts_at || item?.booked_at || item?.created_at,
            ),
          ].filter(Boolean);
        case 'enrollments':
          return [
            toText(
              item?.learner_display_name ||
                item?.user_display_name ||
                item?.display_name,
            ),
            formatMetricLabel(
              toText(item?.related_item_type || item?.content_type || ''),
            ),
            formatEducationDateTime(item?.enrolled_at || item?.created_at),
          ].filter(Boolean);
        case 'memberships':
        case 'students':
        case 'staff':
          return [
            formatMetricLabel(toText(item?.role)),
            toText(item?.title),
            formatEducationDateTime(item?.created_at || item?.joined_at),
          ].filter(Boolean);
        case 'classes':
        case 'events':
          return [
            formatEducationDateTime(item?.starts_at),
            formatMetricLabel(toText(item?.delivery_mode || item?.event_type)),
          ].filter(Boolean);
        case 'courses':
        case 'programs':
        case 'lessons':
        case 'materials':
        case 'exams':
        case 'broadcasts':
          return [
            toText(item?.code),
            formatEducationDateTime(item?.created_at || item?.published_at),
          ].filter(Boolean);
        default:
          return [];
      }
    },
    [activeModuleKey],
  );

  const renderModulePrimaryAction = useCallback(
    (item: any) => {
      if (activeModuleKey === 'bookings') {
        return (
          <EducationActionButton
            palette={palette}
            label="View"
            onPress={() => void openModuleDetail(item)}
          />
        );
      }
      if (canOpenDetail) {
        return (
          <EducationActionButton
            palette={palette}
            label="Open"
            onPress={() => void openModuleDetail(item)}
          />
        );
      }
      if (MANAGEABLE_MODULES.includes(activeModuleKey as EducationModuleKey)) {
        return (
          <EducationActionButton
            palette={palette}
            label="Edit"
            onPress={() => openModuleEditor(item)}
          />
        );
      }
      return null;
    },
    [
      activeModuleKey,
      canOpenDetail,
      openModuleDetail,
      openModuleEditor,
      palette,
    ],
  );

  const renderModuleSecondaryAction = useCallback(
    (item: any, linkedBroadcast: any) => {
      if (!activeModuleKey) return null;
      if (
        activeModuleKey === 'memberships' ||
        activeModuleKey === 'students' ||
        activeModuleKey === 'staff'
      ) {
        if (item.status === 'pending') {
          return (
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <EducationActionButton
                palette={palette}
                label="Approve"
                variant="secondary"
                onPress={() => void handleMembershipAction(item.id, 'approve')}
              />
              <EducationActionButton
                palette={palette}
                label="Reject"
                variant="ghost"
                onPress={() => void handleMembershipAction(item.id, 'reject')}
              />
            </View>
          );
        }
        if (item.status === 'active' && item.role !== 'owner') {
          return (
            <EducationActionButton
              palette={palette}
              label="Remove"
              variant="ghost"
              onPress={() => void handleMembershipAction(item.id, 'remove')}
            />
          );
        }
        return null;
      }
      if (activeModuleKey === 'enrollments') {
        if (item.status !== 'enrolled') {
          return (
            <EducationActionButton
              palette={palette}
              label="Enroll"
              variant="secondary"
              onPress={() => void handleEnrollmentAction(item.id, 'enroll')}
            />
          );
        }
        if (item.status !== 'completed') {
          return (
            <EducationActionButton
              palette={palette}
              label="Complete"
              variant="secondary"
              onPress={() => void handleEnrollmentAction(item.id, 'complete')}
            />
          );
        }
        return null;
      }
      if (activeModuleKey === 'bookings') {
        if (item.status !== 'confirmed') {
          return (
            <EducationActionButton
              palette={palette}
              label="Confirm"
              variant="secondary"
              onPress={() => void handleBookingAction(item.id, 'confirm')}
            />
          );
        }
        if (item.status !== 'payment_pending') {
          return (
            <EducationActionButton
              palette={palette}
              label="Mark Pending"
              variant="ghost"
              onPress={() =>
                void handleBookingAction(item.id, 'payment_pending')
              }
            />
          );
        }
        return null;
      }
      if (MANAGEABLE_MODULES.includes(activeModuleKey as EducationModuleKey)) {
        return (
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <EducationActionButton
              palette={palette}
              label="Edit"
              variant="secondary"
              onPress={() => openModuleEditor(item)}
            />
            {BROADCASTABLE_EDUCATION_MODULES.includes(
              activeModuleKey as EducationModuleKey,
            ) ? (
              <EducationActionButton
                palette={palette}
                label={
                  linkedBroadcast
                    ? isArchivedEducationStatus(linkedBroadcast?.status)
                      ? 'Broadcast Again'
                      : 'Edit Broadcast'
                    : 'Broadcast'
                }
                variant="ghost"
                onPress={() =>
                  openBroadcastComposerForItem(
                    activeModuleKey as EducationModuleKey,
                    item,
                  )
                }
              />
            ) : null}
            {BROADCASTABLE_EDUCATION_MODULES.includes(
              activeModuleKey as EducationModuleKey,
            ) &&
            linkedBroadcast &&
            !isArchivedEducationStatus(linkedBroadcast?.status) ? (
              <EducationActionButton
                palette={palette}
                label="Remove Broadcast"
                variant="ghost"
                onPress={() =>
                  void handleArchiveBroadcast(
                    linkedBroadcast,
                    activeModuleLabel,
                  )
                }
              />
            ) : null}
            {activeModuleKey === 'broadcasts' &&
            !isArchivedEducationStatus(item.status) ? (
              <EducationActionButton
                palette={palette}
                label="Remove Broadcast"
                variant="ghost"
                onPress={() => void handleArchiveBroadcast(item, 'Broadcasts')}
              />
            ) : null}
            {activeModuleKey === 'broadcasts' &&
            isArchivedEducationStatus(item.status) ? (
              <EducationActionButton
                palette={palette}
                label="Broadcast Again"
                variant="ghost"
                onPress={() =>
                  openModuleEditor({ ...item, status: 'published' })
                }
              />
            ) : null}
          </View>
        );
      }
      return null;
    },
    [
      activeModuleKey,
      activeModuleLabel,
      handleArchiveBroadcast,
      handleBookingAction,
      handleEnrollmentAction,
      handleMembershipAction,
      openBroadcastComposerForItem,
      openModuleEditor,
      palette,
    ],
  );

  const renderModuleCoverImageField = useCallback(
    (label: string, description: string) => (
      <View style={{ gap: 8 }}>
        <Text style={{ color: palette.text, fontWeight: '800' }}>{label}</Text>
        <Text style={{ color: palette.subtext, fontSize: 13 }}>
          {description}
        </Text>
        {moduleForm.cover_image_preview_uri ? (
          <View
            style={{
              borderWidth: 1,
              borderColor: palette.divider,
              borderRadius: 16,
              padding: 12,
              backgroundColor: palette.card,
              gap: 12,
            }}
          >
            <Image
              source={{ uri: moduleForm.cover_image_preview_uri }}
              style={{
                width: '100%',
                height: 180,
                borderRadius: 18,
                backgroundColor: palette.background,
              }}
              resizeMode="cover"
            />
            <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
              <KISButton
                title="Change image"
                size="xs"
                variant="outline"
                onPress={() => void handlePickModuleCoverImage()}
                disabled={moduleSubmitting}
              />
              <KISButton
                title="Remove image"
                size="xs"
                variant="secondary"
                onPress={() =>
                  setModuleForm(prev => ({
                    ...prev,
                    cover_image_url: '',
                    cover_image_preview_uri: '',
                    cover_image_asset: null,
                  }))
                }
                disabled={moduleSubmitting}
              />
            </View>
          </View>
        ) : (
          <KISButton
            title="Pick image from device"
            size="xs"
            variant="outline"
            onPress={() => void handlePickModuleCoverImage()}
            disabled={moduleSubmitting}
          />
        )}
      </View>
    ),
    [
      handlePickModuleCoverImage,
      moduleForm.cover_image_preview_uri,
      moduleSubmitting,
      palette.background,
      palette.card,
      palette.divider,
      palette.subtext,
      palette.text,
    ],
  );

  if (screen === 'form') {
    return (
      <ScrollView contentContainerStyle={styles.managementPanelBody}>
        <SectionCard
          palette={palette}
          title={
            editingInstitutionId ? 'Edit institution' : 'Create institution'
          }
          subtitle="This is a separate institution page, not the main education hub."
          right={
            <KISButton
              title="Back"
              size="xs"
              variant="outline"
              onPress={closeForm}
              disabled={institutionSubmitting}
            />
          }
        >
          <KISTextInput
            label="Institution name"
            value={institutionForm.name}
            onChangeText={value =>
              setInstitutionForm(prev => ({ ...prev, name: value }))
            }
          />
          <KISTextInput
            label="Description"
            value={institutionForm.description}
            onChangeText={value =>
              setInstitutionForm(prev => ({ ...prev, description: value }))
            }
            multiline
            style={{ minHeight: 80 }}
          />
          <View style={{ gap: 8 }}>
            <Text style={{ color: palette.text, fontWeight: '800' }}>
              Institution logo
            </Text>
            <Text style={{ color: palette.subtext, fontSize: 13 }}>
              Pick an image from your device. It will be uploaded only when you
              save the institution.
            </Text>
            {institutionForm.logoPreviewUri ? (
              <View
                style={{
                  borderWidth: 1,
                  borderColor: palette.divider,
                  borderRadius: 16,
                  padding: 12,
                  backgroundColor: palette.card,
                  gap: 12,
                }}
              >
                <Image
                  source={{ uri: institutionForm.logoPreviewUri }}
                  style={{
                    width: 96,
                    height: 96,
                    borderRadius: 22,
                    backgroundColor: palette.background,
                  }}
                  resizeMode="cover"
                />
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <KISButton
                    title="Change logo"
                    size="xs"
                    variant="outline"
                    onPress={() => void handlePickInstitutionLogo()}
                    disabled={institutionSubmitting}
                  />
                  <KISButton
                    title="Remove logo"
                    size="xs"
                    variant="secondary"
                    onPress={() =>
                      setInstitutionForm(prev => ({
                        ...prev,
                        logoUrl: '',
                        logoPreviewUri: '',
                        logoAsset: null,
                      }))
                    }
                    disabled={institutionSubmitting}
                  />
                </View>
              </View>
            ) : (
              <KISButton
                title="Pick logo from device"
                size="xs"
                variant="outline"
                onPress={() => void handlePickInstitutionLogo()}
                disabled={institutionSubmitting}
              />
            )}
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <KISButton
              title={
                institutionSubmitting || logoUploading
                  ? 'Saving…'
                  : editingInstitutionId
                  ? 'Save changes'
                  : 'Create institution'
              }
              onPress={handleSaveInstitution}
              disabled={institutionSubmitting}
            />
            <KISButton
              title="Cancel"
              variant="secondary"
              onPress={closeForm}
              disabled={institutionSubmitting}
            />
          </View>
        </SectionCard>
      </ScrollView>
    );
  }

  if (screen === 'module') {
    const canCreate = Boolean(
      activeModuleKey && MANAGEABLE_MODULES.includes(activeModuleKey),
    );
    const isReadOnlyDashboardModule =
      activeModuleKey === 'overview' ||
      activeModuleKey === 'analytics' ||
      activeModuleKey === 'settings';
    return (
      <>
        <ScrollView
          contentContainerStyle={styles.managementPanelBody}
          stickyHeaderIndices={[0]}
        >
          {renderStickyInstitutionHeader(
            activeModuleLabel,
            activeModuleKey
              ? MODULE_DESCRIPTIONS[activeModuleKey]
              : 'Institution module',
            closeModule,
            buildFlowSteps({
              moduleLabel: activeModuleLabel,
              showEditor: moduleEditorVisible,
              editing: Boolean(editingModuleItemId),
              editorLabel: moduleEditorVisible
                ? editingModuleItemId
                  ? `Edit ${activeModuleSingularLabel}`
                  : `New ${activeModuleSingularLabel}`
                : null,
            }),
          )}
          <SectionCard
            palette={palette}
            title={activeModuleLabel}
            subtitle={
              activeModuleKey
                ? MODULE_DESCRIPTIONS[activeModuleKey]
                : 'Institution module'
            }
          >
            <EducationSectionCard
              palette={palette}
              eyebrow="Section Controls"
              title={activeModuleLabel}
              description="One clean section page for this education module."
            >
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                {canCreate ? (
                  <EducationActionButton
                    palette={palette}
                    label={
                      moduleEditorVisible
                        ? 'Close Editor'
                        : `New ${activeModuleSingularLabel}`
                    }
                    variant={moduleEditorVisible ? 'secondary' : 'primary'}
                    onPress={() =>
                      moduleEditorVisible
                        ? closeModuleEditor()
                        : openModuleEditor()
                    }
                  />
                ) : null}
                {activeModuleKey === 'staff' ? (
                  <EducationActionButton
                    palette={palette}
                    label="Add From Contacts"
                    variant="secondary"
                    onPress={() => setContactsPickerOpen(true)}
                    disabled={!canInviteEducationStaff || addingStaffMember}
                  />
                ) : null}
                <EducationActionButton
                  palette={palette}
                  label="Refresh"
                  variant="ghost"
                  onPress={() =>
                    selectedInstitutionId && activeModuleKey
                      ? void loadModuleRecords(
                          activeModuleKey,
                          selectedInstitutionId,
                        )
                      : undefined
                  }
                  disabled={
                    !selectedInstitutionId || !activeModuleKey || moduleLoading
                  }
                />
              </View>
              {activeModuleKey === 'staff' && !canInviteEducationStaff ? (
                <Text style={{ color: palette.subtext, fontSize: 12 }}>
                  Only the owner or an administrator can add staff members.
                </Text>
              ) : null}
            </EducationSectionCard>

            {activeModuleKey === 'overview' ? (
              <View style={{ gap: 14 }}>
                <View
                  style={{
                    borderRadius: 22,
                    padding: 16,
                    backgroundColor: palette.card,
                    borderWidth: 1,
                    borderColor: palette.divider,
                    gap: 14,
                  }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      gap: 14,
                      alignItems: 'center',
                    }}
                  >
                    {selectedInstitutionLogoUri ? (
                      <Image
                        source={{ uri: selectedInstitutionLogoUri }}
                        style={{
                          width: 76,
                          height: 76,
                          borderRadius: 22,
                          backgroundColor: palette.background,
                        }}
                        resizeMode="cover"
                      />
                    ) : (
                      <View
                        style={{
                          width: 76,
                          height: 76,
                          borderRadius: 22,
                          backgroundColor:
                            palette.primarySoft ?? palette.surface,
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderWidth: 1,
                          borderColor: palette.divider,
                        }}
                      >
                        <Text
                          style={{
                            color: palette.primaryStrong,
                            fontWeight: '900',
                            fontSize: 24,
                          }}
                        >
                          {toText(selectedInstitution?.name)
                            .slice(0, 1)
                            .toUpperCase() || 'I'}
                        </Text>
                      </View>
                    )}
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text
                        style={{
                          color: palette.text,
                          fontWeight: '900',
                          fontSize: 20,
                        }}
                      >
                        {selectedInstitution?.name || 'Institution overview'}
                      </Text>
                      <Text
                        style={{
                          color: palette.subtext,
                          fontSize: 13,
                          lineHeight: 18,
                        }}
                      >
                        {selectedInstitution?.description ||
                          'This institution dashboard brings together academic structure, people, operations, and broadcasts in one place.'}
                      </Text>
                      <View
                        style={{
                          flexDirection: 'row',
                          gap: 8,
                          flexWrap: 'wrap',
                          marginTop: 4,
                        }}
                      >
                        <View
                          style={{
                            borderRadius: 999,
                            paddingHorizontal: 10,
                            paddingVertical: 5,
                            backgroundColor:
                              palette.primarySoft ?? palette.surface,
                          }}
                        >
                          <Text
                            style={{
                              color: palette.primaryStrong,
                              fontSize: 11,
                              fontWeight: '800',
                            }}
                          >
                            {(
                              selectedInstitution?.current_membership?.role ||
                              dashboardData?.current_membership?.role ||
                              'owner'
                            )
                              .toString()
                              .replace(/_/g, ' ')}
                          </Text>
                        </View>
                        <View
                          style={{
                            borderRadius: 999,
                            paddingHorizontal: 10,
                            paddingVertical: 5,
                            backgroundColor: palette.background,
                          }}
                        >
                          <Text
                            style={{
                              color: palette.text,
                              fontSize: 11,
                              fontWeight: '700',
                            }}
                          >
                            {isLandingPublic(selectedInstitution)
                              ? 'Public landing'
                              : 'Private landing'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  <View
                    style={{
                      borderRadius: 18,
                      padding: 14,
                      backgroundColor: palette.background,
                      borderWidth: 1,
                      borderColor: palette.divider,
                      gap: 6,
                    }}
                  >
                    <Text style={{ color: palette.text, fontWeight: '800' }}>
                      Overview snapshot
                    </Text>
                    <Text
                      style={{
                        color: palette.subtext,
                        fontSize: 12,
                        lineHeight: 18,
                      }}
                    >
                      Track courses, learner activity, broadcasts, and
                      institution momentum from this workspace before drilling
                      into each module.
                    </Text>
                  </View>
                </View>

                {renderDetailSummaryCard(selectedInstitutionDetailSummary)}

                <View
                  style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}
                >
                  {Object.entries(dashboardData?.metrics ?? {}).map(
                    ([key, value], index) => {
                      const isPrimary = index < 2;
                      return (
                        <View
                          key={key}
                          style={{
                            minWidth: '47%',
                            flexGrow: 1,
                            borderWidth: 1,
                            borderColor: isPrimary
                              ? palette.primaryStrong
                              : palette.divider,
                            borderRadius: 18,
                            padding: 14,
                            backgroundColor: isPrimary
                              ? palette.primarySoft ?? palette.surface
                              : palette.card,
                            gap: 6,
                          }}
                        >
                          <Text
                            style={{
                              color: palette.text,
                              fontWeight: '900',
                              fontSize: isPrimary ? 24 : 20,
                            }}
                          >
                            {value}
                          </Text>
                          <Text
                            style={{
                              color: palette.subtext,
                              fontSize: 12,
                              fontWeight: '700',
                            }}
                          >
                            {formatMetricLabel(key)}
                          </Text>
                        </View>
                      );
                    },
                  )}
                </View>

                <View style={{ gap: 12 }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <Text
                      style={{
                        color: palette.text,
                        fontWeight: '900',
                        fontSize: 16,
                      }}
                    >
                      Recent courses
                    </Text>
                    <Text style={{ color: palette.subtext, fontSize: 12 }}>
                      Latest learning structure
                    </Text>
                  </View>
                  {(dashboardData?.recent_courses ?? []).length ? (
                    (dashboardData?.recent_courses ?? []).map(
                      (course, index) => (
                        <View
                          key={course.id || course.title}
                          style={{
                            borderWidth: 1,
                            borderColor: palette.divider,
                            borderRadius: 18,
                            padding: 14,
                            backgroundColor: palette.card,
                            flexDirection: 'row',
                            gap: 12,
                          }}
                        >
                          <View
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: 12,
                              backgroundColor:
                                palette.primarySoft ?? palette.surface,
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Text
                              style={{
                                color: palette.primaryStrong,
                                fontWeight: '900',
                              }}
                            >
                              {index + 1}
                            </Text>
                          </View>
                          <View style={{ flex: 1, gap: 4 }}>
                            <Text
                              style={{ color: palette.text, fontWeight: '800' }}
                            >
                              {course.title || 'Course'}
                            </Text>
                            <Text
                              style={{
                                color: palette.subtext,
                                fontSize: 12,
                                lineHeight: 18,
                              }}
                            >
                              {course.summary ||
                                course.status ||
                                'No summary yet.'}
                            </Text>
                          </View>
                        </View>
                      ),
                    )
                  ) : (
                    <View
                      style={{
                        borderRadius: 18,
                        padding: 16,
                        backgroundColor: palette.card,
                        borderWidth: 1,
                        borderColor: palette.divider,
                      }}
                    >
                      <Text style={{ color: palette.subtext }}>
                        No courses yet.
                      </Text>
                    </View>
                  )}
                </View>

                <View style={{ gap: 12 }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <Text
                      style={{
                        color: palette.text,
                        fontWeight: '900',
                        fontSize: 16,
                      }}
                    >
                      Recent broadcasts
                    </Text>
                    <Text style={{ color: palette.subtext, fontSize: 12 }}>
                      Latest public-facing activity
                    </Text>
                  </View>
                  {(dashboardData?.recent_broadcasts ?? []).length ? (
                    (dashboardData?.recent_broadcasts ?? []).map(row => (
                      <View
                        key={row.id}
                        style={{
                          borderWidth: 1,
                          borderColor: palette.divider,
                          borderRadius: 18,
                          padding: 14,
                          backgroundColor: palette.card,
                          gap: 6,
                        }}
                      >
                        <View
                          style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            gap: 10,
                            alignItems: 'center',
                          }}
                        >
                          <Text
                            style={{
                              color: palette.text,
                              fontWeight: '800',
                              flex: 1,
                            }}
                          >
                            {row.title || 'Broadcast'}
                          </Text>
                          <View
                            style={{
                              borderRadius: 999,
                              paddingHorizontal: 10,
                              paddingVertical: 5,
                              backgroundColor: palette.background,
                            }}
                          >
                            <Text
                              style={{
                                color: palette.subtext,
                                fontSize: 11,
                                fontWeight: '800',
                              }}
                            >
                              {toText(row.broadcast_kind || 'notice').replace(
                                /_/g,
                                ' ',
                              )}
                            </Text>
                          </View>
                        </View>
                        <Text
                          style={{
                            color: palette.subtext,
                            fontSize: 12,
                            lineHeight: 18,
                          }}
                        >
                          {row.summary || 'No summary yet.'}
                        </Text>
                      </View>
                    ))
                  ) : (
                    <View
                      style={{
                        borderRadius: 18,
                        padding: 16,
                        backgroundColor: palette.card,
                        borderWidth: 1,
                        borderColor: palette.divider,
                      }}
                    >
                      <Text style={{ color: palette.subtext }}>
                        No broadcasts yet.
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            ) : null}

            {activeModuleKey === 'analytics' ? (
              <View style={{ gap: 12 }}>
                <EducationSectionCard
                  palette={palette}
                  eyebrow="Analytics"
                  title="Institution performance"
                  description="Grouped operational metrics powered by the existing dashboard payload."
                >
                  <View
                    style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}
                  >
                    {analyticsSummary.map((item, index) => (
                      <EducationMetricTile
                        key={item.label}
                        palette={palette}
                        label={item.label}
                        value={item.value}
                        hint={index === 0 ? 'Top summary' : undefined}
                        tone={index === 0 ? 'accent' : 'default'}
                      />
                    ))}
                  </View>
                </EducationSectionCard>
                {analyticsGroups.map(group => (
                  <EducationSectionCard
                    key={group.title}
                    palette={palette}
                    title={group.title}
                    description={group.description}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        flexWrap: 'wrap',
                        gap: 10,
                      }}
                    >
                      {group.items.map(item => (
                        <EducationMetricTile
                          key={`${group.title}-${item.label}`}
                          palette={palette}
                          label={item.label}
                          value={item.value}
                          tone="muted"
                        />
                      ))}
                    </View>
                  </EducationSectionCard>
                ))}
              </View>
            ) : null}

            {activeModuleKey === 'settings' ? (
              <View style={{ gap: 12 }}>
                <EducationSectionCard
                  palette={palette}
                  eyebrow="Settings"
                  title="Institution profile"
                  description="Update the institution identity, description, and branding used across the workspace."
                >
                  <View
                    style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}
                  >
                    <EducationActionButton
                      palette={palette}
                      label="Edit Institution"
                      onPress={() => openEditInstitution(selectedInstitution)}
                    />
                  </View>
                </EducationSectionCard>

                <EducationSectionCard
                  palette={palette}
                  title="Public visibility"
                  description="Control whether the institution landing page is visible to the public."
                  badge={
                    isLandingPublic(selectedInstitution) ? 'Public' : 'Private'
                  }
                >
                  <View
                    style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}
                  >
                    <EducationActionButton
                      palette={palette}
                      label={
                        isLandingPublic(selectedInstitution)
                          ? 'Make Private'
                          : 'Make Public'
                      }
                      variant="secondary"
                      onPress={() =>
                        void handleToggleLandingVisibility(selectedInstitution)
                      }
                    />
                  </View>
                </EducationSectionCard>

                <EducationSectionCard
                  palette={palette}
                  title="Landing page"
                  description="Open the landing builder for public messaging, layout, and discovery presentation."
                >
                  <View
                    style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}
                  >
                    <EducationActionButton
                      palette={palette}
                      label="Open Landing Page"
                      variant="secondary"
                      onPress={() =>
                        onOpenLandingBuilder?.(selectedInstitution)
                      }
                    />
                  </View>
                </EducationSectionCard>

                <EducationSectionCard
                  palette={palette}
                  title="Policies"
                  description="Institution roles, approvals, and learner access still follow the current backend rules."
                  badge="Read only"
                >
                  <Text style={{ color: palette.subtext, lineHeight: 20 }}>
                    Permissions, approvals, and booking behavior remain
                    connected to the existing education backend. This section is
                    intentionally informational for now so the UI stays clear
                    without hiding the current rules.
                  </Text>
                </EducationSectionCard>

                <EducationSectionCard
                  palette={palette}
                  title="Danger zone"
                  description="Sensitive institution actions should remain deliberate and separate from daily management."
                  badge="Protected"
                >
                  <Text style={{ color: palette.subtext, lineHeight: 20 }}>
                    Destructive institution controls are not exposed in this
                    redesign pass. Existing backend protections remain
                    unchanged.
                  </Text>
                </EducationSectionCard>
              </View>
            ) : null}

            {!isReadOnlyDashboardModule && moduleEditorVisible ? (
              <View
                style={{
                  gap: 10,
                  borderWidth: 1,
                  borderColor: palette.divider,
                  borderRadius: 16,
                  padding: 12,
                  backgroundColor: palette.card,
                }}
              >
                <Text style={{ color: palette.text, fontWeight: '800' }}>
                  {editingModuleItemId
                    ? `Edit ${activeModuleLabel}`
                    : `Create ${activeModuleLabel}`}
                </Text>
                {[
                  'programs',
                  'courses',
                  'lessons',
                  'classes',
                  'materials',
                  'exams',
                  'events',
                  'broadcasts',
                ].includes(activeModuleKey || '') ? (
                  <>
                    {activeModuleKey === 'programs' ? (
                      <>
                        <KISTextInput
                          label="Title"
                          value={moduleForm.title}
                          onChange={value =>
                            setModuleForm(prev => ({ ...prev, title: value }))
                          }
                        />
                        <KISTextInput
                          label="Code"
                          value={moduleForm.code}
                          onChange={value =>
                            setModuleForm(prev => ({ ...prev, code: value }))
                          }
                        />
                        <KISTextInput
                          label="Summary"
                          value={moduleForm.summary}
                          onChange={value =>
                            setModuleForm(prev => ({ ...prev, summary: value }))
                          }
                          multiline
                          style={{ minHeight: 70 }}
                        />
                        <KISTextInput
                          label="Description"
                          value={moduleForm.description}
                          onChange={value =>
                            setModuleForm(prev => ({
                              ...prev,
                              description: value,
                            }))
                          }
                          multiline
                          style={{ minHeight: 90 }}
                        />
                        {renderModuleCoverImageField(
                          'Program image',
                          'Used when this program is advertised on public broadcast and discovery pages.',
                        )}
                        <KISTextInput
                          label="Status"
                          value={moduleForm.status}
                          onChange={value =>
                            setModuleForm(prev => ({ ...prev, status: value }))
                          }
                          placeholder="draft"
                        />
                      </>
                    ) : null}
                    {activeModuleKey === 'courses' ? (
                      <>
                        <KISTextInput
                          label="Title"
                          value={moduleForm.title}
                          onChange={value =>
                            setModuleForm(prev => ({ ...prev, title: value }))
                          }
                        />
                        <KISTextInput
                          label="Code"
                          value={moduleForm.code}
                          onChange={value =>
                            setModuleForm(prev => ({ ...prev, code: value }))
                          }
                        />
                        <KISTextInput
                          label="Summary"
                          value={moduleForm.summary}
                          onChange={value =>
                            setModuleForm(prev => ({ ...prev, summary: value }))
                          }
                          multiline
                          style={{ minHeight: 70 }}
                        />
                        <KISTextInput
                          label="Description"
                          value={moduleForm.description}
                          onChange={value =>
                            setModuleForm(prev => ({
                              ...prev,
                              description: value,
                            }))
                          }
                          multiline
                          style={{ minHeight: 90 }}
                        />
                        {renderModuleCoverImageField(
                          'Course image',
                          'Used to advertise this course in the broadcast discovery experience.',
                        )}
                        <KISTextInput
                          label="Status"
                          value={moduleForm.status}
                          onChange={value =>
                            setModuleForm(prev => ({ ...prev, status: value }))
                          }
                          placeholder="draft"
                        />
                        <KISTextInput
                          label="Duration minutes"
                          value={moduleForm.duration_minutes}
                          onChange={value =>
                            setModuleForm(prev => ({
                              ...prev,
                              duration_minutes: value,
                            }))
                          }
                          keyboardType="numeric"
                        />
                        <KISTextInput
                          label="Seat limit"
                          value={moduleForm.seat_limit}
                          onChange={value =>
                            setModuleForm(prev => ({
                              ...prev,
                              seat_limit: value,
                            }))
                          }
                          keyboardType="numeric"
                        />
                        {renderLookupSelector(
                          'Program',
                          toText(moduleForm.program_id),
                          moduleLookups.programs,
                          value =>
                            setModuleForm(prev => ({
                              ...prev,
                              program_id: value,
                            })),
                          'Choose the parent program for this course.',
                        )}
                      </>
                    ) : null}
                    {activeModuleKey === 'lessons' ? (
                      <>
                        {renderLookupSelector(
                          'Course',
                          toText(moduleForm.course_id),
                          moduleLookups.courses,
                          value =>
                            setModuleForm(prev => ({
                              ...prev,
                              course_id: value,
                            })),
                          'Choose the parent course for this lesson.',
                          false,
                        )}
                        <KISTextInput
                          label="Title"
                          value={moduleForm.title}
                          onChange={value =>
                            setModuleForm(prev => ({ ...prev, title: value }))
                          }
                        />
                        <KISTextInput
                          label="Summary"
                          value={moduleForm.summary}
                          onChange={value =>
                            setModuleForm(prev => ({ ...prev, summary: value }))
                          }
                          multiline
                          style={{ minHeight: 70 }}
                        />
                        <KISTextInput
                          label="Content"
                          value={moduleForm.content}
                          onChange={value =>
                            setModuleForm(prev => ({ ...prev, content: value }))
                          }
                          multiline
                          style={{ minHeight: 100 }}
                        />
                        {renderModuleCoverImageField(
                          'Lesson image',
                          'Used to visually advertise this lesson anywhere it is broadcast publicly.',
                        )}
                        <KISTextInput
                          label="Lesson order"
                          value={moduleForm.lesson_order}
                          onChange={value =>
                            setModuleForm(prev => ({
                              ...prev,
                              lesson_order: value,
                            }))
                          }
                          keyboardType="numeric"
                        />
                        <KISTextInput
                          label="Duration minutes"
                          value={moduleForm.duration_minutes}
                          onChange={value =>
                            setModuleForm(prev => ({
                              ...prev,
                              duration_minutes: value,
                            }))
                          }
                          keyboardType="numeric"
                        />
                        <KISTextInput
                          label="Status"
                          value={moduleForm.status}
                          onChange={value =>
                            setModuleForm(prev => ({ ...prev, status: value }))
                          }
                          placeholder="draft"
                        />
                      </>
                    ) : null}
                    {activeModuleKey === 'classes' ? (
                      <>
                        <KISTextInput
                          label="Title"
                          value={moduleForm.title}
                          onChange={value =>
                            setModuleForm(prev => ({ ...prev, title: value }))
                          }
                        />
                        <KISTextInput
                          label="Summary"
                          value={moduleForm.summary}
                          onChange={value =>
                            setModuleForm(prev => ({ ...prev, summary: value }))
                          }
                          multiline
                          style={{ minHeight: 70 }}
                        />
                        {renderModuleCoverImageField(
                          'Class image',
                          'Used on public education cards for this class session.',
                        )}
                        {renderLookupSelector(
                          'Course',
                          toText(moduleForm.course_id),
                          moduleLookups.courses,
                          value =>
                            setModuleForm(prev => ({
                              ...prev,
                              course_id: value,
                              lesson_id: '',
                            })),
                          'Choose the parent course for this class session.',
                        )}
                        {renderLookupSelector(
                          'Lesson',
                          toText(moduleForm.lesson_id),
                          moduleLookups.lessons.filter(
                            row =>
                              !toText(moduleForm.course_id) ||
                              toText(row.course_id) ===
                                toText(moduleForm.course_id),
                          ),
                          value =>
                            setModuleForm(prev => ({
                              ...prev,
                              lesson_id: value,
                            })),
                          'Optionally link this class session to a lesson.',
                        )}
                        <KISDateTimeInput
                          label="Starts at"
                          value={moduleForm.starts_at}
                          mode="datetime"
                          onChange={value =>
                            setModuleForm(prev => ({
                              ...prev,
                              starts_at: value,
                            }))
                          }
                        />
                        <KISDateTimeInput
                          label="Ends at"
                          value={moduleForm.ends_at}
                          mode="datetime"
                          onChange={value =>
                            setModuleForm(prev => ({ ...prev, ends_at: value }))
                          }
                        />
                        <KISTextInput
                          label="Timezone"
                          value={moduleForm.timezone_name}
                          onChange={value =>
                            setModuleForm(prev => ({
                              ...prev,
                              timezone_name: value,
                            }))
                          }
                        />
                        <KISTextInput
                          label="Delivery mode"
                          value={moduleForm.delivery_mode}
                          onChange={value =>
                            setModuleForm(prev => ({
                              ...prev,
                              delivery_mode: value,
                            }))
                          }
                        />
                        <KISTextInput
                          label="Location"
                          value={moduleForm.location_text}
                          onChange={value =>
                            setModuleForm(prev => ({
                              ...prev,
                              location_text: value,
                            }))
                          }
                        />
                        <KISTextInput
                          label="Meeting URL"
                          value={moduleForm.meeting_url}
                          onChange={value =>
                            setModuleForm(prev => ({
                              ...prev,
                              meeting_url: value,
                            }))
                          }
                        />
                        <KISTextInput
                          label="Seat limit"
                          value={moduleForm.seat_limit}
                          onChange={value =>
                            setModuleForm(prev => ({
                              ...prev,
                              seat_limit: value,
                            }))
                          }
                          keyboardType="numeric"
                        />
                        <KISTextInput
                          label="Status"
                          value={moduleForm.status}
                          onChange={value =>
                            setModuleForm(prev => ({ ...prev, status: value }))
                          }
                          placeholder="scheduled"
                        />
                      </>
                    ) : null}
                    {activeModuleKey === 'materials' ? (
                      <>
                        <View
                          style={{
                            gap: 12,
                            borderWidth: 1,
                            borderColor: palette.divider,
                            borderRadius: 18,
                            padding: 14,
                            backgroundColor: palette.background,
                          }}
                        >
                          <Text
                            style={{
                              color: palette.text,
                              fontWeight: '900',
                              fontSize: 15,
                            }}
                          >
                            Material basics
                          </Text>
                          <KISTextInput
                            label="Title"
                            value={moduleForm.title}
                            onChange={value =>
                              setModuleForm(prev => ({ ...prev, title: value }))
                            }
                          />
                          <KISTextInput
                            label="Summary"
                            value={moduleForm.summary}
                            onChange={value =>
                              setModuleForm(prev => ({
                                ...prev,
                                summary: value,
                              }))
                            }
                            multiline
                            style={{ minHeight: 70 }}
                          />
                          {renderModuleCoverImageField(
                            'Material image',
                            'Used to advertise this material in education lists and related broadcasts.',
                          )}
                          <KISTextInput
                            label="Kind"
                            value={moduleForm.kind}
                            onChange={value =>
                              setModuleForm(prev => ({ ...prev, kind: value }))
                            }
                            placeholder="document"
                          />
                          <KISTextInput
                            label="Status"
                            value={moduleForm.status}
                            onChange={value =>
                              setModuleForm(prev => ({
                                ...prev,
                                status: value,
                              }))
                            }
                            placeholder="draft"
                          />
                        </View>

                        <View
                          style={{
                            gap: 12,
                            borderWidth: 1,
                            borderColor: palette.divider,
                            borderRadius: 18,
                            padding: 14,
                            backgroundColor: palette.background,
                          }}
                        >
                          <Text
                            style={{
                              color: palette.text,
                              fontWeight: '900',
                              fontSize: 15,
                            }}
                          >
                            Link this material
                          </Text>
                          <Text
                            style={{ color: palette.subtext, fontSize: 12 }}
                          >
                            A single material can be linked to multiple
                            programs, courses, lessons, classes, and
                            assessments. Deselect any linked item here to remove
                            this material from it.
                          </Text>
                          {renderMultiLookupSelector(
                            'Programs',
                            Array.isArray(moduleForm.program_ids)
                              ? moduleForm.program_ids
                              : [],
                            moduleLookups.programs,
                            values =>
                              setModuleForm(prev => ({
                                ...prev,
                                program_ids: values,
                              })),
                            'Select one or more programs.',
                          )}
                          {renderMultiLookupSelector(
                            'Courses',
                            Array.isArray(moduleForm.course_ids)
                              ? moduleForm.course_ids
                              : [],
                            moduleLookups.courses,
                            values =>
                              setModuleForm(prev => ({
                                ...prev,
                                course_ids: values,
                              })),
                            'Select one or more courses.',
                          )}
                          {renderMultiLookupSelector(
                            'Lessons',
                            Array.isArray(moduleForm.lesson_ids)
                              ? moduleForm.lesson_ids
                              : [],
                            moduleLookups.lessons.filter(row => {
                              const selectedCourseIds = Array.isArray(
                                moduleForm.course_ids,
                              )
                                ? moduleForm.course_ids
                                : [];
                              return (
                                !selectedCourseIds.length ||
                                selectedCourseIds.includes(
                                  toText(row.course_id),
                                )
                              );
                            }),
                            values =>
                              setModuleForm(prev => ({
                                ...prev,
                                lesson_ids: values,
                              })),
                            'Select one or more lessons.',
                          )}
                          {renderMultiLookupSelector(
                            'Class sessions',
                            Array.isArray(moduleForm.class_session_ids)
                              ? moduleForm.class_session_ids
                              : [],
                            moduleLookups.classSessions.filter(row => {
                              const selectedCourseIds = Array.isArray(
                                moduleForm.course_ids,
                              )
                                ? moduleForm.course_ids
                                : [];
                              return (
                                !selectedCourseIds.length ||
                                selectedCourseIds.includes(
                                  toText(row.course_id),
                                )
                              );
                            }),
                            values =>
                              setModuleForm(prev => ({
                                ...prev,
                                class_session_ids: values,
                              })),
                            'Select one or more class sessions.',
                          )}
                          {renderMultiLookupSelector(
                            'Assessments',
                            Array.isArray(moduleForm.assessment_ids)
                              ? moduleForm.assessment_ids
                              : [],
                            moduleLookups.assessments.filter(row => {
                              const selectedCourseIds = Array.isArray(
                                moduleForm.course_ids,
                              )
                                ? moduleForm.course_ids
                                : [];
                              return (
                                !selectedCourseIds.length ||
                                selectedCourseIds.includes(
                                  toText(row.course_id),
                                )
                              );
                            }),
                            values =>
                              setModuleForm(prev => ({
                                ...prev,
                                assessment_ids: values,
                              })),
                            'Select one or more assessments.',
                          )}
                        </View>

                        <View
                          style={{
                            gap: 12,
                            borderWidth: 1,
                            borderColor: palette.divider,
                            borderRadius: 18,
                            padding: 14,
                            backgroundColor: palette.background,
                          }}
                        >
                          <Text
                            style={{
                              color: palette.text,
                              fontWeight: '900',
                              fontSize: 15,
                            }}
                          >
                            Material file
                          </Text>
                          <Text
                            style={{ color: palette.subtext, fontSize: 13 }}
                          >
                            Pick the file from the device. PDFs open inline as
                            documents. Images, videos, and audio are supported.
                            Word and text-style files must be converted to PDF
                            before upload.
                          </Text>
                          <View
                            style={{
                              flexDirection: 'row',
                              gap: 8,
                              flexWrap: 'wrap',
                            }}
                          >
                            <KISButton
                              title="Pick from device"
                              size="xs"
                              variant="outline"
                              onPress={() => void handlePickMaterialResource()}
                            />
                            {moduleForm.resource_url ||
                            moduleForm.resource_asset ? (
                              <KISButton
                                title="Remove file"
                                size="xs"
                                variant="secondary"
                                onPress={() =>
                                  setModuleForm(prev => ({
                                    ...prev,
                                    resource_url: '',
                                    resource_name: '',
                                    resource_type: '',
                                    resource_asset: null,
                                  }))
                                }
                              />
                            ) : null}
                          </View>
                          {moduleForm.resource_url ? (
                            <View
                              style={{
                                borderWidth: 1,
                                borderColor: palette.divider,
                                borderRadius: 14,
                                padding: 12,
                                backgroundColor: palette.card,
                                gap: 8,
                              }}
                            >
                              {String(moduleForm.kind || '').toLowerCase() ===
                              'image' ? (
                                <Image
                                  source={{ uri: moduleForm.resource_url }}
                                  style={{
                                    width: 88,
                                    height: 88,
                                    borderRadius: 14,
                                    backgroundColor: palette.background,
                                  }}
                                  resizeMode="cover"
                                />
                              ) : null}
                              <Text
                                style={{
                                  color: palette.text,
                                  fontWeight: '700',
                                }}
                              >
                                {moduleForm.resource_name || 'Selected file'}
                              </Text>
                              <Text
                                style={{ color: palette.subtext, fontSize: 12 }}
                              >
                                {moduleForm.resource_asset
                                  ? 'Selected from device'
                                  : 'Current saved file'}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      </>
                    ) : null}
                    {activeModuleKey === 'exams' ? (
                      <>
                        <KISTextInput
                          label="Title"
                          value={moduleForm.title}
                          onChange={value =>
                            setModuleForm(prev => ({ ...prev, title: value }))
                          }
                        />
                        <KISTextInput
                          label="Summary"
                          value={moduleForm.summary}
                          onChange={value =>
                            setModuleForm(prev => ({ ...prev, summary: value }))
                          }
                          multiline
                          style={{ minHeight: 70 }}
                        />
                        <KISTextInput
                          label="Instructions"
                          value={moduleForm.instructions}
                          onChange={value =>
                            setModuleForm(prev => ({
                              ...prev,
                              instructions: value,
                            }))
                          }
                          multiline
                          style={{ minHeight: 90 }}
                        />
                        {renderModuleCoverImageField(
                          'Assessment image',
                          'Used when this assessment is highlighted or advertised through education broadcasts.',
                        )}
                        <KISTextInput
                          label="Assessment type"
                          value={moduleForm.assessment_type}
                          onChange={value =>
                            setModuleForm(prev => ({
                              ...prev,
                              assessment_type: value,
                            }))
                          }
                          placeholder="mcq"
                        />
                        {renderLookupSelector(
                          'Course',
                          toText(moduleForm.course_id),
                          moduleLookups.courses,
                          value =>
                            setModuleForm(prev => ({
                              ...prev,
                              course_id: value,
                              lesson_id: '',
                              class_session_id: '',
                            })),
                          'Optionally link this exam to a course.',
                        )}
                        {renderLookupSelector(
                          'Lesson',
                          toText(moduleForm.lesson_id),
                          moduleLookups.lessons.filter(
                            row =>
                              !toText(moduleForm.course_id) ||
                              toText(row.course_id) ===
                                toText(moduleForm.course_id),
                          ),
                          value =>
                            setModuleForm(prev => ({
                              ...prev,
                              lesson_id: value,
                            })),
                          'Optionally link this exam to a lesson.',
                        )}
                        {renderLookupSelector(
                          'Class session',
                          toText(moduleForm.class_session_id),
                          moduleLookups.classSessions.filter(
                            row =>
                              !toText(moduleForm.course_id) ||
                              toText(row.course_id) ===
                                toText(moduleForm.course_id),
                          ),
                          value =>
                            setModuleForm(prev => ({
                              ...prev,
                              class_session_id: value,
                            })),
                          'Optionally link this exam to a class session.',
                        )}
                        <KISDateTimeInput
                          label="Starts at"
                          value={moduleForm.starts_at}
                          mode="datetime"
                          onChange={value =>
                            setModuleForm(prev => ({
                              ...prev,
                              starts_at: value,
                            }))
                          }
                        />
                        <KISDateTimeInput
                          label="Ends at"
                          value={moduleForm.ends_at}
                          mode="datetime"
                          onChange={value =>
                            setModuleForm(prev => ({ ...prev, ends_at: value }))
                          }
                        />
                        <KISTextInput
                          label="Duration minutes"
                          value={moduleForm.duration_minutes}
                          onChange={value =>
                            setModuleForm(prev => ({
                              ...prev,
                              duration_minutes: value,
                            }))
                          }
                          keyboardType="numeric"
                        />
                        <KISTextInput
                          label="Max attempts"
                          value={moduleForm.max_attempts}
                          onChange={value =>
                            setModuleForm(prev => ({
                              ...prev,
                              max_attempts: value,
                            }))
                          }
                          keyboardType="numeric"
                        />
                        <KISTextInput
                          label="Passing score %"
                          value={moduleForm.passing_score_percent}
                          onChange={value =>
                            setModuleForm(prev => ({
                              ...prev,
                              passing_score_percent: value,
                            }))
                          }
                          keyboardType="numeric"
                        />
                        <KISTextInput
                          label="Status"
                          value={moduleForm.status}
                          onChange={value =>
                            setModuleForm(prev => ({ ...prev, status: value }))
                          }
                          placeholder="draft"
                        />
                      </>
                    ) : null}
                    {activeModuleKey === 'events' ? (
                      <>
                        <KISTextInput
                          label="Title"
                          value={moduleForm.title}
                          onChange={value =>
                            setModuleForm(prev => ({ ...prev, title: value }))
                          }
                        />
                        <KISTextInput
                          label="Summary"
                          value={moduleForm.summary}
                          onChange={value =>
                            setModuleForm(prev => ({ ...prev, summary: value }))
                          }
                          multiline
                          style={{ minHeight: 70 }}
                        />
                        <KISTextInput
                          label="Description"
                          value={moduleForm.description}
                          onChange={value =>
                            setModuleForm(prev => ({
                              ...prev,
                              description: value,
                            }))
                          }
                          multiline
                          style={{ minHeight: 90 }}
                        />
                        {renderModuleCoverImageField(
                          'Event image',
                          'Used to advertise this event or training session on public broadcast pages.',
                        )}
                        {renderLookupSelector(
                          'Program',
                          toText(moduleForm.program_id),
                          moduleLookups.programs,
                          value =>
                            setModuleForm(prev => ({
                              ...prev,
                              program_id: value,
                            })),
                          'Optionally link this event to a program.',
                        )}
                        {renderLookupSelector(
                          'Course',
                          toText(moduleForm.course_id),
                          moduleLookups.courses,
                          value =>
                            setModuleForm(prev => ({
                              ...prev,
                              course_id: value,
                              class_session_id: '',
                            })),
                          'Optionally link this event to a course.',
                        )}
                        {renderLookupSelector(
                          'Class session',
                          toText(moduleForm.class_session_id),
                          moduleLookups.classSessions.filter(
                            row =>
                              !toText(moduleForm.course_id) ||
                              toText(row.course_id) ===
                                toText(moduleForm.course_id),
                          ),
                          value =>
                            setModuleForm(prev => ({
                              ...prev,
                              class_session_id: value,
                            })),
                          'Optionally link this event to a class session.',
                        )}
                        <KISTextInput
                          label="Event type"
                          value={moduleForm.event_type}
                          onChange={value =>
                            setModuleForm(prev => ({
                              ...prev,
                              event_type: value,
                            }))
                          }
                          placeholder="event"
                        />
                        <KISDateTimeInput
                          label="Starts at"
                          value={moduleForm.starts_at}
                          mode="datetime"
                          onChange={value =>
                            setModuleForm(prev => ({
                              ...prev,
                              starts_at: value,
                            }))
                          }
                        />
                        <KISDateTimeInput
                          label="Ends at"
                          value={moduleForm.ends_at}
                          mode="datetime"
                          onChange={value =>
                            setModuleForm(prev => ({ ...prev, ends_at: value }))
                          }
                        />
                        <KISTextInput
                          label="Timezone"
                          value={moduleForm.timezone_name}
                          onChange={value =>
                            setModuleForm(prev => ({
                              ...prev,
                              timezone_name: value,
                            }))
                          }
                        />
                        <KISTextInput
                          label="Delivery mode"
                          value={moduleForm.delivery_mode}
                          onChange={value =>
                            setModuleForm(prev => ({
                              ...prev,
                              delivery_mode: value,
                            }))
                          }
                        />
                        <KISTextInput
                          label="Location"
                          value={moduleForm.location_text}
                          onChange={value =>
                            setModuleForm(prev => ({
                              ...prev,
                              location_text: value,
                            }))
                          }
                        />
                        <KISTextInput
                          label="Meeting URL"
                          value={moduleForm.meeting_url}
                          onChange={value =>
                            setModuleForm(prev => ({
                              ...prev,
                              meeting_url: value,
                            }))
                          }
                        />
                        <KISTextInput
                          label="Seat limit"
                          value={moduleForm.seat_limit}
                          onChange={value =>
                            setModuleForm(prev => ({
                              ...prev,
                              seat_limit: value,
                            }))
                          }
                          keyboardType="numeric"
                        />
                        <KISTextInput
                          label="Status"
                          value={moduleForm.status}
                          onChange={value =>
                            setModuleForm(prev => ({ ...prev, status: value }))
                          }
                          placeholder="draft"
                        />
                      </>
                    ) : null}
                    {activeModuleKey === 'broadcasts' ? (
                      <>
                        <KISTextInput
                          label="Title"
                          value={moduleForm.title}
                          onChange={value =>
                            setModuleForm(prev => ({ ...prev, title: value }))
                          }
                        />
                        <KISTextInput
                          label="Summary"
                          value={moduleForm.summary}
                          onChange={value =>
                            setModuleForm(prev => ({ ...prev, summary: value }))
                          }
                          multiline
                          style={{ minHeight: 70 }}
                        />
                        <KISTextInput
                          label="Description"
                          value={moduleForm.description}
                          onChange={value =>
                            setModuleForm(prev => ({
                              ...prev,
                              description: value,
                            }))
                          }
                          multiline
                          style={{ minHeight: 90 }}
                        />
                        <KISTextInput
                          label="Broadcast kind"
                          value={moduleForm.broadcast_kind}
                          onChange={value =>
                            setModuleForm(prev => ({
                              ...prev,
                              broadcast_kind: value,
                            }))
                          }
                          placeholder="program, course, lesson, class_session, event, training_session, institution_notice"
                        />
                        {renderLookupSelector(
                          'Program',
                          toText(moduleForm.program_id),
                          moduleLookups.programs,
                          value =>
                            setModuleForm(prev => ({
                              ...prev,
                              program_id: value,
                            })),
                          'Optionally target a program.',
                        )}
                        {renderLookupSelector(
                          'Course',
                          toText(moduleForm.course_id),
                          moduleLookups.courses,
                          value =>
                            setModuleForm(prev => ({
                              ...prev,
                              course_id: value,
                              lesson_id: '',
                              class_session_id: '',
                            })),
                          'Optionally target a course.',
                        )}
                        {renderLookupSelector(
                          'Lesson',
                          toText(moduleForm.lesson_id),
                          moduleLookups.lessons.filter(
                            row =>
                              !toText(moduleForm.course_id) ||
                              toText(row.course_id) ===
                                toText(moduleForm.course_id),
                          ),
                          value =>
                            setModuleForm(prev => ({
                              ...prev,
                              lesson_id: value,
                            })),
                          'Optionally target a lesson.',
                        )}
                        {renderLookupSelector(
                          'Class session',
                          toText(moduleForm.class_session_id),
                          moduleLookups.classSessions.filter(
                            row =>
                              !toText(moduleForm.course_id) ||
                              toText(row.course_id) ===
                                toText(moduleForm.course_id),
                          ),
                          value =>
                            setModuleForm(prev => ({
                              ...prev,
                              class_session_id: value,
                            })),
                          'Optionally target a class session.',
                        )}
                        {renderLookupSelector(
                          'Event',
                          toText(moduleForm.event_id),
                          moduleLookups.events,
                          value =>
                            setModuleForm(prev => ({
                              ...prev,
                              event_id: value,
                            })),
                          'Optionally target an event or training session.',
                        )}
                        <KISDateTimeInput
                          label="Starts at"
                          value={moduleForm.starts_at}
                          mode="datetime"
                          onChange={value =>
                            setModuleForm(prev => ({
                              ...prev,
                              starts_at: value,
                            }))
                          }
                        />
                        <KISDateTimeInput
                          label="Ends at"
                          value={moduleForm.ends_at}
                          mode="datetime"
                          onChange={value =>
                            setModuleForm(prev => ({ ...prev, ends_at: value }))
                          }
                        />
                        <KISTextInput
                          label="Timezone"
                          value={moduleForm.timezone_name}
                          onChange={value =>
                            setModuleForm(prev => ({
                              ...prev,
                              timezone_name: value,
                            }))
                          }
                        />
                        <KISTextInput
                          label="Seat limit"
                          value={moduleForm.seat_limit}
                          onChange={value =>
                            setModuleForm(prev => ({
                              ...prev,
                              seat_limit: value,
                            }))
                          }
                          keyboardType="numeric"
                        />
                        <KISTextInput
                          label="Price amount"
                          value={moduleForm.price_amount}
                          onChange={value =>
                            setModuleForm(prev => ({
                              ...prev,
                              price_amount: value,
                            }))
                          }
                          keyboardType="numeric"
                        />
                        <KISTextInput
                          label="Price currency"
                          value={moduleForm.price_currency}
                          onChange={value =>
                            setModuleForm(prev => ({
                              ...prev,
                              price_currency: value,
                            }))
                          }
                        />
                        <KISTextInput
                          label="Status"
                          value={moduleForm.status}
                          onChange={value =>
                            setModuleForm(prev => ({ ...prev, status: value }))
                          }
                          placeholder="published"
                        />
                      </>
                    ) : null}
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <KISButton
                        title={
                          moduleSubmitting
                            ? 'Saving…'
                            : editingModuleItemId
                            ? 'Save changes'
                            : 'Create'
                        }
                        onPress={handleSaveModuleRecord}
                        disabled={moduleSubmitting}
                      />
                      <KISButton
                        title="Cancel"
                        variant="secondary"
                        onPress={closeModuleEditor}
                        disabled={moduleSubmitting}
                      />
                    </View>
                  </>
                ) : null}
              </View>
            ) : null}

            {!isReadOnlyDashboardModule && moduleLoading ? (
              <EducationSectionCard
                palette={palette}
                title={`Loading ${activeModuleLabel}`}
                description={`Fetching the latest ${activeModuleLabel.toLowerCase()} records.`}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <ActivityIndicator
                    size="small"
                    color={palette.primaryStrong}
                  />
                  <Text style={{ color: palette.subtext }}>
                    Loading {activeModuleLabel.toLowerCase()}…
                  </Text>
                </View>
              </EducationSectionCard>
            ) : null}

            {!isReadOnlyDashboardModule && moduleError ? (
              <EducationSectionCard
                palette={palette}
                title={`${activeModuleLabel} unavailable`}
                description={moduleError}
                badge="Needs attention"
              >
                <EducationActionButton
                  palette={palette}
                  label="Try Again"
                  onPress={() =>
                    selectedInstitutionId && activeModuleKey
                      ? void loadModuleRecords(
                          activeModuleKey,
                          selectedInstitutionId,
                        )
                      : undefined
                  }
                />
              </EducationSectionCard>
            ) : null}

            {!isReadOnlyDashboardModule && !moduleLoading && !moduleError ? (
              filteredModuleRecords.length ||
              (activeModuleKey === 'bookings' && moduleRecords.length) ? (
                <View style={{ gap: 10 }}>
                  {activeModuleKey === 'bookings' ? (
                    <EducationSectionCard
                      palette={palette}
                      eyebrow="Bookings"
                      title="Payments snapshot"
                      description="Track booking health before opening individual records."
                    >
                      <View
                        style={{
                          flexDirection: 'row',
                          flexWrap: 'wrap',
                          gap: 12,
                        }}
                      >
                        {bookingSummaryCards.map(item => (
                          <EducationMetricTile
                            key={item.label}
                            palette={palette}
                            label={item.label}
                            value={item.value}
                            hint={item.hint}
                            tone={item.tone}
                          />
                        ))}
                      </View>
                      <View
                        style={{
                          flexDirection: 'row',
                          gap: 8,
                          flexWrap: 'wrap',
                        }}
                      >
                        {[
                          { key: 'all', label: 'All' },
                          { key: 'pending', label: 'Pending' },
                          { key: 'confirmed', label: 'Confirmed' },
                          { key: 'waitlisted', label: 'Waitlist' },
                          { key: 'cancelled', label: 'Cancelled' },
                        ].map(chip => (
                          <EducationActionButton
                            key={chip.key}
                            palette={palette}
                            label={chip.label}
                            variant={
                              bookingStatusFilter === chip.key
                                ? 'secondary'
                                : 'ghost'
                            }
                            onPress={() =>
                              setBookingStatusFilter(
                                chip.key as typeof bookingStatusFilter,
                              )
                            }
                          />
                        ))}
                      </View>
                    </EducationSectionCard>
                  ) : null}
                  {(activeModuleKey === 'enrollments' ||
                    activeModuleKey === 'bookings' ||
                    activeModuleKey === 'memberships' ||
                    activeModuleKey === 'students' ||
                    activeModuleKey === 'staff') &&
                  moduleOperationalSummary.length ? (
                    <EducationSectionCard
                      palette={palette}
                      eyebrow="Snapshot"
                      title="Operational summary"
                      description="A quick read of the current section before you open individual records."
                    >
                      {renderSummaryCards(moduleOperationalSummary)}
                    </EducationSectionCard>
                  ) : null}
                  {filteredModuleRecords.map(item =>
                    (() => {
                      const linkedBroadcast =
                        activeModuleKey &&
                        BROADCASTABLE_EDUCATION_MODULES.includes(
                          activeModuleKey,
                        )
                          ? findAssociatedBroadcast(activeModuleKey, item)
                          : null;
                      const linkedBroadcastArchived = isArchivedEducationStatus(
                        linkedBroadcast?.status,
                      );
                      return (
                        <EducationListCard
                          key={
                            item.id ||
                            `${renderModulePrimary(item)}-${renderModuleSummary(
                              item,
                            )}`
                          }
                          palette={palette}
                          eyebrow={activeModuleSingularLabel}
                          title={renderModulePrimary(item)}
                          subtitle={
                            renderModuleSummary(item) || 'No details yet.'
                          }
                          imageUrl={
                            resolveEducationCoverImage(item) || undefined
                          }
                          statusLabel={getModuleCardStatus(item)}
                          statusTone={getEducationToneForStatus(
                            item?.status || item?.role,
                          )}
                          metaItems={getModuleCardMetaItems(item)}
                          onPress={
                            canOpenDetail
                              ? () => void openModuleDetail(item)
                              : undefined
                          }
                          primaryAction={renderModulePrimaryAction(item)}
                          secondaryAction={renderModuleSecondaryAction(
                            item,
                            linkedBroadcast,
                          )}
                        >
                          {linkedBroadcast ? (
                            <EducationStatusBadge
                              palette={palette}
                              label={`Broadcast ${formatMetricLabel(
                                toText(linkedBroadcast.status || 'draft'),
                              )}`}
                              tone={
                                linkedBroadcastArchived ? 'muted' : 'accent'
                              }
                            />
                          ) : null}
                          {MANAGEABLE_MODULES.includes(
                            activeModuleKey as EducationModuleKey,
                          ) && activeModuleKey !== 'broadcasts' ? (
                            <View style={{ marginTop: 2 }}>
                              <EducationActionButton
                                palette={palette}
                                label="Delete"
                                variant="ghost"
                                onPress={() => handleDeleteModuleRecord(item)}
                              />
                            </View>
                          ) : null}
                        </EducationListCard>
                      );
                    })(),
                  )}
                </View>
              ) : (
                <EducationEmptyState
                  palette={palette}
                  title={
                    activeModuleKey === 'bookings' && moduleRecords.length
                      ? 'No bookings match this filter'
                      : `No ${activeModuleLabel.toLowerCase()} yet`
                  }
                  description={
                    activeModuleKey === 'bookings' && moduleRecords.length
                      ? 'Try another booking filter to see more payment records.'
                      : `This section is ready. New ${activeModuleSingularLabel.toLowerCase()} records will appear here.`
                  }
                  action={
                    activeModuleKey === 'bookings' && moduleRecords.length ? (
                      <EducationActionButton
                        palette={palette}
                        label="Show All"
                        onPress={() => setBookingStatusFilter('all')}
                      />
                    ) : canCreate ? (
                      <EducationActionButton
                        palette={palette}
                        label={`New ${activeModuleSingularLabel}`}
                        onPress={() => openModuleEditor()}
                      />
                    ) : undefined
                  }
                />
              )
            ) : null}
          </SectionCard>
        </ScrollView>
        {contactsPickerOpen ? (
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: palette.background,
              zIndex: 999,
            }}
          >
            <AddContactsPage
              onClose={() => setContactsPickerOpen(false)}
              onOpenChat={() => undefined}
              onSelectKISContact={handleAddStaffByContact}
            />
          </View>
        ) : null}
      </>
    );
  }

  if (screen === 'detail') {
    const detailTitle =
      detailPayload?.program?.title ??
      detailPayload?.course?.title ??
      detailPayload?.lesson?.title ??
      detailPayload?.class_session?.title ??
      detailPayload?.material?.title ??
      detailPayload?.assessment?.title ??
      detailPayload?.event?.title ??
      detailPayload?.broadcast?.title ??
      detailPayload?.enrollment?.id ??
      detailPayload?.booking?.id ??
      detailPayload?.membership?.display_name ??
      'Details';
    const detailMetrics = detailPayload?.metrics ?? {};
    const renderDetailContent = () => {
      if (detailPayload?.program) return renderProgramDetail(detailMetrics);
      if (detailPayload?.course) return renderCourseDetail(detailMetrics);
      if (detailPayload?.material) return renderMaterialDetail();
      if (detailPayload?.booking) return renderBookingDetail();
      if (detailPayload?.enrollment) return renderEnrollmentDetail();
      if (detailPayload?.broadcast) return renderBroadcastDetail(detailMetrics);
      if (detailPayload?.membership) return renderMembershipDetail();
      return renderGenericDetail(detailMetrics);
    };
    return (
      <ScrollView
        contentContainerStyle={styles.managementPanelBody}
        stickyHeaderIndices={[0]}
      >
        {renderStickyInstitutionHeader(
          detailTitle,
          'Connected academic workspace',
          closeDetail,
          buildFlowSteps({
            moduleLabel: activeModuleLabel,
            detailLabel: detailTitle,
          }),
        )}
        <SectionCard
          palette={palette}
          title={detailTitle}
          subtitle="Connected academic workspace"
        >
          {detailLoading ? (
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
            >
              <ActivityIndicator size="small" color={palette.primaryStrong} />
              <Text style={{ color: palette.subtext }}>Loading details…</Text>
            </View>
          ) : detailError ? (
            <Text style={{ color: palette.danger ?? palette.primaryStrong }}>
              {detailError}
            </Text>
          ) : detailPayload ? (
            renderDetailContent()
          ) : (
            <Text style={{ color: palette.subtext }}>
              No detail payload loaded.
            </Text>
          )}
        </SectionCard>
      </ScrollView>
    );
  }

  if (screen === 'dashboard') {
    return (
      <>
        <EducationScreenScaffold
          palette={palette}
          breadcrumb={`Education -> ${
            toText(selectedInstitution?.name) || 'Institution'
          }`}
          title={
            selectedInstitution?.name
              ? `${selectedInstitution.name} Workspace`
              : 'Institution Workspace'
          }
          subtitle="Simple workspace home for courses, learners, bookings, broadcasts, analytics, and settings."
          onBack={closeDashboard}
          actions={
            <EducationActionButton
              palette={palette}
              label="Refresh"
              onPress={() =>
                selectedInstitutionId
                  ? void fetchDashboard(selectedInstitutionId)
                  : undefined
              }
              variant="ghost"
              disabled={!selectedInstitutionId || dashboardLoading}
            />
          }
          contentContainerStyle={styles.managementPanelBody}
        >
          {!selectedInstitutionId ? (
            <EducationEmptyState
              palette={palette}
              title="Choose an institution"
              description="Open an education institution from the hub to enter its workspace."
            />
          ) : dashboardLoading && !dashboardData ? (
            <EducationSectionCard
              palette={palette}
              title="Loading workspace"
              description="Bringing together courses, people, bookings, and broadcasts."
            >
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
              >
                <ActivityIndicator size="small" color={palette.primaryStrong} />
                <Text style={{ color: palette.subtext }}>
                  Loading institution dashboard…
                </Text>
              </View>
            </EducationSectionCard>
          ) : dashboardError ? (
            <EducationSectionCard
              palette={palette}
              title="Workspace unavailable"
              description={dashboardError}
              badge="Needs attention"
            >
              <EducationActionButton
                palette={palette}
                label="Try again"
                onPress={() =>
                  selectedInstitutionId
                    ? void fetchDashboard(selectedInstitutionId)
                    : undefined
                }
              />
            </EducationSectionCard>
          ) : (
            <>
              <EducationWorkspaceHeader
                palette={palette}
                eyebrow="Education Workspace"
                title={selectedInstitution?.name || 'Institution workspace'}
                subtitle={
                  selectedInstitution?.description ||
                  'Run your institution from one premium workspace home, then open each section only when you need it.'
                }
                imageUrl={selectedInstitutionLogoUri || undefined}
                statusLabel={formatMetricLabel(
                  toText(
                    selectedInstitution?.current_membership?.status ||
                      dashboardData?.current_membership?.status ||
                      'active',
                  ),
                )}
                visibilityLabel={
                  isLandingPublic(selectedInstitution)
                    ? 'Public landing'
                    : 'Private landing'
                }
                roleLabel={formatMetricLabel(
                  toText(
                    selectedInstitution?.current_membership?.role ||
                      dashboardData?.current_membership?.role ||
                      'owner',
                  ),
                )}
                actions={
                  <>
                    <EducationActionButton
                      palette={palette}
                      label="Manage Courses"
                      onPress={() => void openModule('courses')}
                    />
                    <EducationActionButton
                      palette={palette}
                      label="Learners"
                      onPress={() => void openModule('students')}
                      variant="secondary"
                    />
                  </>
                }
                secondaryActions={
                  <>
                    <EducationActionButton
                      palette={palette}
                      label="Bookings"
                      onPress={() => void openModule('bookings')}
                      variant="ghost"
                    />
                    <EducationActionButton
                      palette={palette}
                      label="Edit Institution"
                      onPress={() => openEditInstitution(selectedInstitution)}
                      variant="ghost"
                    />
                    <EducationActionButton
                      palette={palette}
                      label={
                        isLandingPublic(selectedInstitution)
                          ? 'Make Private'
                          : 'Make Public'
                      }
                      onPress={() =>
                        void handleToggleLandingVisibility(selectedInstitution)
                      }
                      variant="ghost"
                      disabled={institutionSubmitting}
                    />
                    <EducationActionButton
                      palette={palette}
                      label="Landing Page"
                      onPress={() =>
                        onOpenLandingBuilder?.(selectedInstitution)
                      }
                      variant="ghost"
                    />
                  </>
                }
              />

              {selectedInstitutionDetailSummary ? (
                <EducationSectionCard
                  palette={palette}
                  title={
                    toText(selectedInstitutionDetailSummary.title) ||
                    'Institution Summary'
                  }
                  description={
                    toText(
                      selectedInstitutionDetailSummary.description ||
                        selectedInstitutionDetailSummary.subtitle,
                    ) || 'Institution context and saved profile information.'
                  }
                  eyebrow={toText(
                    selectedInstitutionDetailSummary.eyebrow || 'Overview',
                  )}
                >
                  <View
                    style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}
                  >
                    {(selectedInstitutionDetailSummary.highlights ?? [])
                      .slice(0, 4)
                      .map((item: any, index: number) => (
                        <EducationStatusBadge
                          key={`${toText(item?.label)}-${index}`}
                          palette={palette}
                          label={[toText(item?.label), toText(item?.value)]
                            .filter(Boolean)
                            .join(': ')}
                          tone="muted"
                        />
                      ))}
                  </View>
                </EducationSectionCard>
              ) : null}

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                {workspaceHomeMetrics.map(item => (
                  <EducationMetricTile
                    key={item.label}
                    palette={palette}
                    label={item.label}
                    value={item.value}
                    hint={item.hint}
                    tone={item.tone}
                  />
                ))}
              </View>

              <EducationSectionCard
                palette={palette}
                eyebrow="Quick Sections"
                title="Workspace Home"
                description="Open the part of the institution you need without getting lost in the old admin-style flow."
              >
                <View style={{ gap: 12 }}>
                  {workspaceSections.map(section => (
                    <EducationListCard
                      key={section.key}
                      palette={palette}
                      title={section.title}
                      subtitle={section.description}
                      metaItems={[section.meta]}
                      onPress={() => void openModule(section.moduleKey)}
                      primaryAction={
                        <EducationActionButton
                          palette={palette}
                          label="Open"
                          onPress={() => void openModule(section.moduleKey)}
                        />
                      }
                    />
                  ))}
                </View>
              </EducationSectionCard>

              <EducationSectionCard
                palette={palette}
                eyebrow="Recent Activity"
                title="What changed recently"
                description="A simple timeline of recent course and broadcast activity from this workspace."
              >
                {workspaceTimelineItems.length ? (
                  <View style={{ gap: 2 }}>
                    {workspaceTimelineItems.map(item => (
                      <EducationTimelineItem
                        key={item.key}
                        palette={palette}
                        title={item.title}
                        description={item.description}
                        timestamp={item.timestamp}
                        tone={item.tone}
                      />
                    ))}
                  </View>
                ) : (
                  <EducationEmptyState
                    palette={palette}
                    title="No recent activity yet"
                    description="Courses and broadcasts created for this institution will appear here."
                  />
                )}
              </EducationSectionCard>
            </>
          )}
        </EducationScreenScaffold>
        {contactsPickerOpen ? (
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: palette.background,
              zIndex: 999,
            }}
          >
            <AddContactsPage
              onClose={() => setContactsPickerOpen(false)}
              onOpenChat={() => undefined}
              onSelectKISContact={handleAddStaffByContact}
            />
          </View>
        ) : null}
      </>
    );
  }

  return (
    <>
      <ScrollView
        contentContainerStyle={styles.managementPanelBody}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={palette.primaryStrong}
          />
        }
      >
        <SectionCard
          palette={palette}
          title={title}
          subtitle={subtitle}
          right={
            <KISButton
              title="Create institution"
              size="xs"
              onPress={openCreateInstitution}
            />
          }
        >
          <Text style={{ color: palette.subtext }}>
            This page is the education hub only. Course creation and other
            academic work belong inside each institution dashboard.
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {heroMetrics.map(metric => (
              <View
                key={metric.label}
                style={{
                  minWidth: '47%',
                  borderWidth: 1,
                  borderColor: palette.divider,
                  borderRadius: 16,
                  padding: 12,
                  backgroundColor: palette.card,
                }}
              >
                <Text
                  style={{
                    color: palette.text,
                    fontWeight: '900',
                    fontSize: 18,
                  }}
                >
                  {metric.value}
                </Text>
                <Text style={{ color: palette.subtext, fontSize: 12 }}>
                  {metric.label}
                </Text>
              </View>
            ))}
          </View>
        </SectionCard>

        <SectionCard
          palette={palette}
          title="Institutions"
          subtitle="Create institutions here, then manage each one in its own dashboard."
        >
          {hubLoading && !hubData ? (
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
            >
              <ActivityIndicator size="small" color={palette.primaryStrong} />
              <Text style={{ color: palette.subtext }}>
                Loading institutions…
              </Text>
            </View>
          ) : hubError ? (
            <Text style={{ color: palette.danger ?? palette.primaryStrong }}>
              {hubError}
            </Text>
          ) : institutions.length === 0 ? (
            <Text style={{ color: palette.subtext }}>
              No institutions yet. Use the create button above to add one.
            </Text>
          ) : (
            institutions.map(institution => {
              const active = institution.id === selectedInstitutionId;
              const landingPublic = isLandingPublic(institution);
              const institutionLogoUri = getInstitutionBrandingUri(institution);
              return (
                <View
                  key={institution.id}
                  style={{
                    borderWidth: 1.5,
                    borderColor: active
                      ? palette.primaryStrong
                      : palette.divider,
                    borderRadius: 18,
                    padding: 12,
                    backgroundColor: active
                      ? palette.primarySoft
                      : palette.card,
                    gap: 10,
                  }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      gap: 12,
                    }}
                  >
                    <View
                      style={{
                        flex: 1,
                        flexDirection: 'row',
                        gap: 12,
                        alignItems: 'flex-start',
                      }}
                    >
                      {institutionLogoUri ? (
                        <Image
                          source={{ uri: institutionLogoUri }}
                          style={{
                            width: 56,
                            height: 56,
                            borderRadius: 14,
                            backgroundColor: palette.background,
                            borderWidth: 1,
                            borderColor: palette.divider,
                          }}
                          resizeMode="cover"
                        />
                      ) : null}
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            color: palette.text,
                            fontWeight: '900',
                            fontSize: 16,
                          }}
                        >
                          {institution.name || 'Institution'}
                        </Text>
                        <Text style={{ color: palette.subtext, fontSize: 12 }}>
                          {institution.description ||
                            institution.institution_type ||
                            'Education institution'}
                        </Text>
                      </View>
                    </View>
                    <Text
                      style={{
                        color: palette.primaryStrong,
                        fontSize: 12,
                        fontWeight: '700',
                      }}
                    >
                      {landingPublic ? 'Public landing' : 'Private landing'}
                    </Text>
                  </View>
                  <View
                    style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}
                  >
                    <Text style={{ color: palette.subtext, fontSize: 12 }}>
                      {institution.active_member_count ?? 0} members
                    </Text>
                    <Text style={{ color: palette.subtext, fontSize: 12 }}>
                      {institution.pending_application_count ?? 0} pending
                    </Text>
                    <Text style={{ color: palette.subtext, fontSize: 12 }}>
                      {institution.membership_policy || 'policy not set'}
                    </Text>
                  </View>
                  <View
                    style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}
                  >
                    <KISButton
                      title="View dashboard"
                      size="xs"
                      onPress={() => openDashboard(institution)}
                    />
                    <KISButton
                      title="Landing page"
                      size="xs"
                      variant="outline"
                      onPress={() => onOpenLandingBuilder?.(institution)}
                    />
                    <KISButton
                      title={landingPublic ? 'Make private' : 'Make public'}
                      size="xs"
                      variant="outline"
                      onPress={() =>
                        void handleToggleLandingVisibility(institution)
                      }
                      disabled={institutionSubmitting}
                    />
                    <KISButton
                      title="Edit"
                      size="xs"
                      variant="outline"
                      onPress={() => openEditInstitution(institution)}
                    />
                    <KISButton
                      title="Delete"
                      size="xs"
                      variant="outline"
                      onPress={() => handleDeleteInstitution(institution)}
                      disabled={institutionSubmitting}
                    />
                  </View>
                  {institutionLogoUri ? (
                    <Text style={{ color: palette.subtext, fontSize: 12 }}>
                      Logo added
                    </Text>
                  ) : (
                    <Text style={{ color: palette.subtext, fontSize: 12 }}>
                      No logo or image yet.
                    </Text>
                  )}
                </View>
              );
            })
          )}
        </SectionCard>

        {tierLabel ? (
          <Text
            style={{
              color: palette.subtext,
              fontSize: 12,
              textAlign: 'center',
            }}
          >
            Current education tier: {tierLabel}
          </Text>
        ) : null}
      </ScrollView>
      {contactsPickerOpen ? (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: palette.background,
            zIndex: 999,
          }}
        >
          <AddContactsPage
            onClose={() => setContactsPickerOpen(false)}
            onOpenChat={() => undefined}
            onSelectKISContact={handleAddStaffByContact}
          />
        </View>
      ) : null}
    </>
  );
}
