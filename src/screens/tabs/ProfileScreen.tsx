// src/screens/tabs/profile/ProfileScreen.tsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  DeviceEventEmitter,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKISTheme } from '@/theme/useTheme';
import { useStatusBarStyle } from '@/theme/useStatusBarStyle';
import { useRawTopInset } from '@/hooks/useSafeTopInset';
import { useResponsiveLayout } from '@/theme/responsive';
import {
  useFocusEffect,
  useNavigation,
  useRoute,
  RouteProp,
} from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import KISButton from '@/constants/KISButton';
import { MainTabStateBlock } from '@/components/common/MainTabScaffold';
import Skeleton from '@/components/common/Skeleton';
import MonetizationSafetyCard from '@/components/dashboard/MonetizationSafetyCard';
import ProfitabilityCommandCenterCard from '@/components/dashboard/ProfitabilityCommandCenterCard';
import ProfitabilityLaunchGateCard from '@/components/dashboard/ProfitabilityLaunchGateCard';
import ProfitabilitySubscriptionLifecycleCard from '@/components/dashboard/ProfitabilitySubscriptionLifecycleCard';
import RevenueOpsEvidenceCard from '@/components/dashboard/RevenueOpsEvidenceCard';
import RevenueEvidenceAdminPanel from '@/components/dashboard/RevenueEvidenceAdminPanel';
import LaunchOpsReadinessCard from '@/components/dashboard/LaunchOpsReadinessCard';
import SafetyCommandCenterCard from '@/components/dashboard/SafetyCommandCenterCard';
import SecurityLaunchGateCard from '@/components/dashboard/SecurityLaunchGateCard';
import PartnerCreateSlide from '@/components/partners/CreatePartnerScreen';
import { KISIcon } from '@/constants/kisIcons';
import { useAuth } from '../../../App';
import { launchImageLibrary, Asset } from 'react-native-image-picker';
import { profileLayout, styles } from './profile/profile.styles';
import { useProfileController } from './profile/useProfileController';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { patchRequest } from '@/network/patch';
import { enqueueMutation } from '@/services/pendingMutationsQueue';
import { deleteRequest } from '@/network/delete';
import {
  fetchInAppNotifications,
  IN_APP_NOTIFICATIONS_UPDATED_EVENT,
  type InAppNotification,
} from '@/services/inAppNotificationService';
import EvidenceWorkflowPlanCard from '@/components/dashboard/EvidenceWorkflowPlanCard';
import { filterInstitutionsForVisibleRoles } from '@/screens/health/accessControl';
import FeedComposerSheet, {
  type FeedComposerPayload,
} from '@/components/feeds/FeedComposerSheet';
import { prepareBroadcastVideoPayload } from '@/components/feeds/videoAttachmentHelpers';
import {
  VerificationCenterSheet,
  VerificationStaffConsole,
  VerificationStatusCard,
  normalizeVerificationSummary,
} from '@/components/verification';
import type {
  VerificationSubjectRef,
  VerificationSummary,
} from '@/services/verificationService';
import {
  fetchFamilyAccessibilityPreferences,
  saveFamilyAccessibilityPreferences,
  type FamilyAccessibilityPayload,
  type KISAgeMode,
} from '@/services/familyAccessibilityService';
import { useGoldenSectionContent } from '@/contexts/GoldenSectionContext';
import { useContextPanelContent, TabletCard } from '@/components/shell';
import ReanimatedScroll, { useAnimatedReaction, useSharedValue, withTiming } from 'react-native-reanimated';
import { useCollapsingGoldHeader } from '@/hooks/useCollapsingGoldHeader';
import { useAgeMode } from '@/theme/ageModeContext';
import { useThemeMode, type KISThemeMode } from '@/theme/themeModeContext';
import {
  isPINEnabled,
  getLockTimeout,
  setLockTimeout,
  clearPIN,
} from '@/services/QuickLockService';

import BottomSheet from './profile/sheets/BottomSheet';
import SheetHeader from './profile/sheets/SheetHeader';
import {
  PartnerProfilesSection,
  LogoutSection,
} from '@/screens/tabs/profile-screen-sections';
import type {
  BroadcastProfileKey,
  MainTabsParamList,
  RootStackParamList,
} from '@/navigation/types';

const APPOINTMENTS_CACHE_KEY = 'kis_appointments_cache_v1';
const SHOPS_CACHE_KEY = 'kis_shops_cache_v1';
const ORDERS_CACHE_KEY = 'kis_orders_cache_v1';

const ESCROW_PENDING_STATUSES = new Set([
  'pending',
  'awaiting_satisfaction',
  'dispute',
]);
const CANCELLED_BOOKING_STATUSES = new Set([
  'cancelled',
  'canceled',
  'rejected',
  'void',
]);
type VerificationCenterTarget = {
  subject: VerificationSubjectRef;
  title: string;
  subtitle?: string;
  summary?: VerificationSummary | null;
};

type AdvancedFeedChannelContext = {
  channelId?: string;
  channelHandle?: string;
  channelName?: string;
} | null;

const getBookingServiceId = (booking: any) => {
  if (!booking) return null;
  return (
    booking?.service_details?.id ||
    (booking?.service_id ? String(booking.service_id) : null) ||
    (booking?.service && typeof booking.service.id === 'string'
      ? booking.service.id
      : null) ||
    (booking?.service ? String(booking.service) : null) ||
    null
  );
};

const dedupeBookingsByService = (bookings: any[]) => {
  const seen = new Map<string, any>();
  bookings.forEach(booking => {
    if (!booking) return;
    const fallbackId =
      booking?.id ?? booking?.booking_id ?? booking?.reference ?? '';
    const serviceId =
      getBookingServiceId(booking) || (fallbackId ? String(fallbackId) : '');
    if (!serviceId) return;
    if (!seen.has(serviceId)) {
      seen.set(serviceId, booking);
    }
  });
  return Array.from(seen.values());
};
import {
  BROADCAST_PROFILE_DEFINITIONS,
  EditItemModal,
  EditProfileModal,
  FeedManagementModal,
  MarketManagementModal,
  EducationManagementModal,
  PrivacyModal,
  UpgradeModal,
  WalletModal,
  buildDefaultFeedMediaOptions,
  getSheetTitle,
  PROFILE_MANAGEMENT_TYPE,
} from './profile-screen';
import type {
  EducationFormState,
  FeedMediaType,
  FeedMediaOptions,
  HealthInstitutionType,
  MarketFormState,
  ShopStatus,
} from './profile-screen';
import { HealthManagementModal } from './profile-screen/HealthManagementModal';
import ShopEditorDrawer from '@/screens/market/ShopEditorDrawer';
import { resolveShopImageUri } from '@/utils/shopAssets';
import { backendOrderTotalToFrontendKisc } from '@/utils/currency';
import { useLanguage } from '@/languages';
import {
  AppointmentSummaryCard,
  HERO_COLLAPSE_DISTANCE,
  ImpactSnapshotCard,
  LanguageSelectorCard,
  MarketplaceOrdersSummary,
  PartnerOrganizationSummary,
  ProfileHeroCard,
  QuickActionGrid,
  RecentActivityTimeline,
  WalletSummaryCard,
  WorkspaceLauncherSection,
} from './profile/components/dashboard';
import { createProfileDashboardTheme } from './profile/profileDashboardTheme';
import {
  buildImpactSnapshotStats,
  buildRecentActivityItems,
} from './profile/profileDashboardData';

const DEFAULT_MARKET_FORM: MarketFormState = {
  name: '',
  description: '',
  employeeSlots: '1',
  status: 'active',
  featuredImage: '',
  featuredImageFile: null,
  slug: '',
};

const getShopPreviewUri = (shop?: any) => resolveShopImageUri(shop);

// Cache-busts an image URL with a version stamp. Needed because the backend
// (S3) can return the exact same URL for a user's avatar/cover across
// uploads (stable per-user key), which would otherwise leave stale cached
// image bytes on screen even though the underlying content changed.
const appendCacheBust = (url?: string | null, version?: number) => {
  if (!url) return url;
  if (!version) return url;
  return `${url}${url.includes('?') ? '&' : '?'}cb=${version}`;
};

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  // Opts out of the app-wide GLOBAL_TOP_PADDING dial (useSafeTopInset) — this
  // is one of the 5 main-tab gold-header screens with its own hand-tuned
  // spacing, so it reads the raw (corrected) device inset instead.
  const topInset = useRawTopInset();
  const { palette, tone } = useKISTheme();
  useStatusBarStyle(tone);   // light-content on dark bg, dark-content on light bg
  const responsive = useResponsiveLayout();
  // Drives the gold section's collapsing hero — see ProfileHeroCard.
  // ProfileHeroCard keeps its own bespoke collapseStyle/stickyBarStyle (its
  // two-state crossfade needs a seeded natural-height to avoid an on-mount
  // stutter, which the hook's own collapseStyle doesn't support).
  const { scrollY: profileScrollY, onScroll: profileScrollHandler } = useCollapsingGoldHeader(HERO_COLLAPSE_DISTANCE);
  // ProfileHeroCard's collapse animates a real layout property (maxHeight) on
  // a box that sits above this same ScrollView as a normal-flow flex sibling
  // (the gold header is no longer a position:absolute overlay), so shrinking
  // it resizes the ScrollView's own container — which perturbs its content
  // offset and re-fires the scroll handler on literally every touch-move
  // frame. On a slow drag there's time for each correction to land before the
  // next touch-move, so it reads as the whole screen vibrating in place and
  // barely moving; a fast flick outruns the loop and looks fine (this is
  // exactly what made it "only move on a fast release"). Unlike the other
  // gold-header screens (search bar / banner text — cheap to relayout),
  // ProfileHeroCard's collapsing box contains real network Images (cover +
  // avatar), which makes each resize expensive enough for the loop's timing
  // to become visible. profileHeaderY breaks the loop by only retargeting
  // once the raw offset has moved a few pixels, then easing to it — coarse
  // enough that the container resize can no longer fire on every frame. The
  // real ScrollView's own scrolling stays driven by the raw, un-eased
  // profileScrollY above, so the page itself never lags behind your finger —
  // only the hero's own collapse animation is deliberately smoothed.
  const profileHeaderY = useSharedValue(0);
  useAnimatedReaction(
    () => profileScrollY.value,
    (current) => {
      if (Math.abs(current - profileHeaderY.value) > 6) {
        profileHeaderY.value = withTiming(current, { duration: 160 });
      }
    },
  );
  const compactProfile = responsive.isWatch || responsive.isCompactPhone;
  const tinyProfile = responsive.isWatch;
  const dashboardTheme = useMemo(
    () => createProfileDashboardTheme(palette, tone),
    [palette, tone],
  );
  const { language, languages, setLanguage, downloadingLanguage } = useLanguage();
  const { themeMode, setThemeMode } = useThemeMode();
  const { setAgeMode: setGlobalAgeMode } = useAgeMode();
  const { setAuth, setPhone, callingCode } = useAuth();
  const c = useProfileController({
    setAuth,
    setPhone,
    locationCallingCode: callingCode,
  });
  const tabsNavigation =
    useNavigation<BottomTabNavigationProp<MainTabsParamList, 'Profile'>>();
  const route = useRoute<RouteProp<MainTabsParamList, 'Profile'>>();
  const broadcastProfiles = c.broadcastProfiles;
  const upgradeTiers = useMemo(
    () =>
      c.tierCatalog && c.tierCatalog.length
        ? c.tierCatalog
        : c.profile?.tiers || [],
    [c.tierCatalog, c.profile?.tiers],
  );
  const requestedBroadcastProfileKey =
    route.params?.broadcastProfileKey ?? null;
  const [managementPanelKey, setManagementPanelKey] =
    useState<BroadcastProfileKey | null>(null);
  const [panelFeedItemTitle, setPanelFeedItemTitle] = useState('');
  const [panelFeedItemSummary, setPanelFeedItemSummary] = useState('');
  const [panelFeedMediaType, setPanelFeedMediaType] =
    useState<FeedMediaType>('video');
  const [panelFeedMediaOptions, setPanelFeedMediaOptions] =
    useState<FeedMediaOptions>(() => buildDefaultFeedMediaOptions());
  const [panelFeedAssets, setPanelFeedAssets] = useState<Asset[]>([]);
  const [panelFeedExistingAttachments, setPanelFeedExistingAttachments] =
    useState<any[]>([]);
  const [panelFeedAdding, setPanelFeedAdding] = useState(false);
  const [panelAttachmentUploading, setPanelAttachmentUploading] =
    useState(false);
  const [editingFeedItemId, setEditingFeedItemId] = useState<string | null>(
    null,
  );
  const [panelFeedDeletingId, setPanelFeedDeletingId] = useState<string | null>(
    null,
  );
  const [panelFeedBroadcastingId, setPanelFeedBroadcastingId] = useState<
    string | null
  >(null);
  const [advancedFeedComposerVisible, setAdvancedFeedComposerVisible] =
    useState(false);
  const [advancedFeedChannelContext, setAdvancedFeedChannelContext] =
    useState<AdvancedFeedChannelContext>(null);
  const managementPanelOffset = useRef(
    new Animated.Value(profileLayout.SCREEN_WIDTH),
  ).current;
  const [marketForm, setMarketForm] =
    useState<MarketFormState>(DEFAULT_MARKET_FORM);
  const [marketFormMode, setMarketFormMode] = useState<'add' | 'edit'>('add');
  const [marketFormLoading, setMarketFormLoading] = useState(false);
  const [shopEditorVisible, setShopEditorVisible] = useState(false);
  const [shopEditorMode, setShopEditorMode] = useState<'create' | 'edit'>(
    'create',
  );
  const [activeShop, setActiveShop] = useState<any | null>(null);
  const [commerceShops, setCommerceShops] = useState<any[]>([]);
  const [commerceShopsLoading, setCommerceShopsLoading] = useState(false);
  const [marketplaceOrders, setMarketplaceOrders] = useState<any[]>([]);
  const [marketplaceOrdersLoading, setMarketplaceOrdersLoading] =
    useState(false);
  const [marketplaceOrdersError, setMarketplaceOrdersError] = useState<
    string | null
  >(null);
  const currentUserId = useMemo(() => {
    const userId = c.profile?.user?.id;
    return userId ? String(userId) : null;
  }, [c.profile?.user?.id]);
  const activeShopOwnerId = useMemo(() => {
    const ownerId = activeShop?.owner;
    return ownerId ? String(ownerId) : null;
  }, [activeShop?.owner]);
  const canDeleteActiveShop = useMemo(() => {
    return Boolean(
      activeShopOwnerId && currentUserId && activeShopOwnerId === currentUserId,
    );
  }, [activeShopOwnerId, currentUserId]);
  const updateMarketFormField = useCallback(
    (changes: Partial<MarketFormState>) => {
      setMarketForm(prev => ({ ...prev, ...changes }));
    },
    [],
  );
  const [educationForm, setEducationForm] = useState<EducationFormState>({
    title: '',
    summary: '',
  });
  const [educationFormMode, setEducationFormMode] = useState<'add' | 'edit'>(
    'add',
  );
  const [educationFormLoading, setEducationFormLoading] = useState(false);
  const [educationModuleForm, setEducationModuleForm] = useState({
    title: '',
    summary: '',
    resource_url: '',
  });
  const [educationModuleSubmitting, setEducationModuleSubmitting] =
    useState(false);
  const [educationLessonsData, setEducationLessonsData] = useState<any[]>([]);
  const [educationAnalyticsLoading, setEducationAnalyticsLoading] =
    useState(false);
  const [educationAnalyticsError, setEducationAnalyticsError] = useState<
    string | null
  >(null);
  const [inAppNotifications, setInAppNotifications] = useState<
    InAppNotification[]
  >([]);
  const [deletingGalleryItemId, setDeletingGalleryItemId] = useState<
    string | null
  >(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [providerAppointments, setProviderAppointments] = useState<any[]>([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [appointmentsError, setAppointmentsError] = useState<string | null>(
    null,
  );

  const loadInAppNotifications = useCallback(async () => {
    const list = await fetchInAppNotifications();
    setInAppNotifications(list);
  }, []);

  const userId = useMemo(() => c.profile?.user?.id, [c.profile?.user?.id]);
  const applyAppointmentRecords = useCallback(
    (records: any[], normalizedUserId: string) => {
      const activeRecords = records.filter((booking: any) => {
        const status = ((booking?.status ?? '') as string).toLowerCase();
        return !CANCELLED_BOOKING_STATUSES.has(status);
      });
      setAppointments(
        dedupeBookingsByService(
          activeRecords.filter(
            (b: any) => String(b?.user) === normalizedUserId,
          ),
        ),
      );
      setProviderAppointments(
        dedupeBookingsByService(
          activeRecords.filter(
            (b: any) => String(b?.provider_details?.id) === normalizedUserId,
          ),
        ),
      );
    },
    [],
  );

  const loadAppointments = useCallback(async () => {
    if (!userId) return;
    const normalizedUserId = String(userId);

    // Show cached data immediately so the screen renders without a wait
    try {
      const cached = await AsyncStorage.getItem(APPOINTMENTS_CACHE_KEY);
      if (cached) {
        const { payer, provider } = JSON.parse(cached);
        if (Array.isArray(payer)) setAppointments(payer);
        if (Array.isArray(provider)) setProviderAppointments(provider);
      }
    } catch {}

    setAppointmentsLoading(true);
    setAppointmentsError(null);
    try {
      const response = await getRequest(ROUTES.commerce.serviceBookings, {
        errorMessage: 'Unable to load appointments.',
      });
      if (response?.success) {
        const payload = response.data ?? response ?? {};
        const records = Array.isArray(payload)
          ? payload
          : Array.isArray((payload as any).results)
          ? (payload as any).results
          : [];
        applyAppointmentRecords(records, normalizedUserId);
        // Persist for next visit
        const payer = dedupeBookingsByService(
          records
            .filter((b: any) => {
              const s = ((b?.status ?? '') as string).toLowerCase();
              return !CANCELLED_BOOKING_STATUSES.has(s);
            })
            .filter((b: any) => String(b?.user) === normalizedUserId),
        );
        const provider = dedupeBookingsByService(
          records
            .filter((b: any) => {
              const s = ((b?.status ?? '') as string).toLowerCase();
              return !CANCELLED_BOOKING_STATUSES.has(s);
            })
            .filter(
              (b: any) => String(b?.provider_details?.id) === normalizedUserId,
            ),
        );
        AsyncStorage.setItem(
          APPOINTMENTS_CACHE_KEY,
          JSON.stringify({ payer, provider }),
        ).catch(() => {});
      } else {
        setAppointmentsError(
          response?.message || 'Unable to load appointments.',
        );
      }
    } catch (error: any) {
      setAppointmentsError(error?.message || 'Unable to load appointments.');
    } finally {
      setAppointmentsLoading(false);
    }
  }, [userId, applyAppointmentRecords]);

  const pendingServicePayments = useMemo(
    () =>
      appointments.filter(booking =>
        ESCROW_PENDING_STATUSES.has(booking?.escrow_status),
      ),
    [appointments],
  );
  const pendingReceivePayments = useMemo(
    () =>
      providerAppointments.filter(booking =>
        ESCROW_PENDING_STATUSES.has(booking?.escrow_status),
      ),
    [providerAppointments],
  );
  const confirmedAppointments = useMemo(
    () =>
      appointments.filter(
        booking =>
          String(booking?.status || '')
            .trim()
            .toLowerCase() === 'confirmed',
      ),
    [appointments],
  );
  const unreadNotifications = useMemo(
    () => inAppNotifications.filter(item => !item.readAt),
    [inAppNotifications],
  );

  const detectMediaTypeFromAsset = useCallback(
    (asset?: Asset | null): FeedMediaType => {
      if (!asset?.type) return 'file';
      const mime = asset.type.toLowerCase();
      if (mime.startsWith('video/')) return 'video';
      if (mime.startsWith('audio/')) return 'audio';
      if (mime.startsWith('image/')) return 'image';
      return 'file';
    },
    [],
  );

  const handlePickFeedMedia = useCallback(async () => {
    const result = await launchImageLibrary({
      mediaType: 'mixed',
      selectionLimit: 5,
      quality: 0.9,
    });
    if (result.didCancel || !result.assets?.length) return;
    const assets = result.assets.filter(asset => asset?.uri) as Asset[];
    if (!assets.length) return;
    setPanelFeedAssets(prev => [...prev, ...assets]);
    setPanelFeedMediaType(detectMediaTypeFromAsset(assets[0]));
  }, [detectMediaTypeFromAsset]);

  const removeTemporaryFeedAsset = useCallback((index: number) => {
    setPanelFeedAssets(prev => prev.filter((_, idx) => idx !== index));
  }, []);

  const handleAttachProfileFile = useCallback(async () => {
    if (!managementPanelKey) return;
    setPanelAttachmentUploading(true);
    try {
      const result = await launchImageLibrary({
        mediaType: 'mixed',
        selectionLimit: 1,
        quality: 1,
      });
      if (result.didCancel || !result.assets?.length) return;
      const asset = result.assets[0];
      if (!asset?.uri) return;
      const attachment = await c.uploadProfileAttachment(
        asset,
        managementPanelKey,
      );
      if (!attachment) {
        throw new Error('Unable to upload attachment.');
      }
      if (managementPanelKey === 'broadcast_feed') return;
      const profileType = PROFILE_MANAGEMENT_TYPE[managementPanelKey];
      await c.manageProfileSection(profileType, { attachments: [attachment] });
      Alert.alert('Attachment uploaded', 'It has been added to the profile.');
    } catch (error: any) {
      Alert.alert(
        'Attachment',
        error?.message || 'Unable to upload attachment.',
      );
    } finally {
      setPanelAttachmentUploading(false);
    }
  }, [managementPanelKey, c]);

  const accountTier = c.profile?.account?.tier;
  const points = c.profile?.account?.points ?? 0;
  const kisWalletLabel = String(c.kisWallet?.balance_label ?? '0 promotional credits');
  const currentTier =
    accountTier || c.profile?.tier || c.profile?.subscription?.tier;
  const tierLabel =
    currentTier?.name ??
    currentTier?.label ??
    currentTier?.tier_label ??
    currentTier?.tierName ??
    null;
  const partnerProfiles = c.profile?.partner_profiles || [];
  const partnerProfilesLimitLabel = c.profile?.partner_profiles_limit_label;
  const partnerProfilesLimitValue =
    c.profile?.partner_profiles_limit_value ?? 0;
  const partnerProfilesIsUnlimited = !!c.profile?.partner_profiles_is_unlimited;
  const canCreatePartner = !!c.profile?.partner_profiles_can_create;
  const [verificationCenterTarget, setVerificationCenterTarget] =
    useState<VerificationCenterTarget | null>(null);
  const [verificationStaffConsoleVisible, setVerificationStaffConsoleVisible] = useState(false);
  const [familyAccessibility, setFamilyAccessibility] = useState<FamilyAccessibilityPayload | null>(null);
  const [familyAccessibilitySaving, setFamilyAccessibilitySaving] = useState(false);
  const [pinEnabled, setPinEnabled] = useState(false);
  const [lockTimeoutMinutes, setLockTimeoutMinutes] = useState(5);
  const userVerificationSummary = useMemo(
    () =>
      normalizeVerificationSummary(c.profile?.user) ||
      normalizeVerificationSummary(c.profile?.profile) ||
      normalizeVerificationSummary(c.profile),
    [c.profile],
  );
  const profileUserAny = c.profile?.user as any;
  const profileAccountAny = c.profile?.account as any;
  const canOpenVerificationStaffConsole = Boolean(
    profileUserAny?.is_staff ||
      profileUserAny?.is_superuser ||
      profileUserAny?.is_admin ||
      profileAccountAny?.is_staff,
  );
  useEffect(() => {
    let active = true;
    fetchFamilyAccessibilityPreferences()
      .then(payload => {
        if (!active) return;
        setFamilyAccessibility(payload);
        // Sync backend age mode into the global context so the entire app
        // immediately reflects the user's previously-saved preference.
        const storedMode = payload?.preferences?.age_mode;
        if (storedMode) setGlobalAgeMode(storedMode);
      })
      .catch(() => {
        if (active) setFamilyAccessibility(null);
      });
    return () => {
      active = false;
    };
  }, [setGlobalAgeMode]);

  const refreshPINState = useCallback(async () => {
    const [enabled, timeout] = await Promise.all([isPINEnabled(), getLockTimeout()]);
    setPinEnabled(enabled);
    setLockTimeoutMinutes(timeout);
    // Restore lock_timeout_minutes from backend for cross-device consistency
    getRequest(ROUTES.profilePreferences.me, { errorMessage: '' })
      .then(res => {
        if (res?.success && res.data?.lock_timeout_minutes != null) {
          setLockTimeoutMinutes(res.data.lock_timeout_minutes);
        }
      })
      .catch(() => null);
  }, []);

  useEffect(() => {
    void refreshPINState();
  }, [refreshPINState]);

  const applyAgeMode = useCallback(async (ageMode: KISAgeMode) => {
    setFamilyAccessibilitySaving(true);
    // Apply immediately to the global context so every screen updates at once.
    setGlobalAgeMode(ageMode);
    try {
      const payload = await saveFamilyAccessibilityPreferences({ age_mode: ageMode });
      setFamilyAccessibility(payload);
    } catch (error: any) {
      Alert.alert('Family experience', error?.message || 'Unable to save family accessibility settings.');
    } finally {
      setFamilyAccessibilitySaving(false);
    }
  }, [setGlobalAgeMode]);
  const editGalleryItems = useMemo(() => {
    const gallery: Array<{
      id: string;
      uri: string;
      kind: 'image' | 'video';
      title: string;
      section: string;
      itemType?: any;
      itemId?: string;
      deletable?: boolean;
    }> = [];

    const pushItem = (
      id: string,
      uri: unknown,
      hint: string,
      section: string,
      forceKind?: 'image' | 'video',
      itemType?: any,
      itemId?: string,
      deletable?: boolean,
    ) => {
      const value = String(uri || '').trim();
      if (!value) return;
      const lower = value.toLowerCase();
      const isVideo =
        forceKind === 'video' ||
        /\.(mp4|mov|webm|m3u8|mkv|avi)(\?|$)/i.test(lower) ||
        lower.includes('video');
      gallery.push({
        id,
        uri: value,
        kind: isVideo ? 'video' : 'image',
        title: hint,
        section,
        itemType,
        itemId,
        deletable: !!deletable,
      });
    };

    pushItem(
      'cover_preview',
      c.profile?.profile?.cover_url,
      'Cover image',
      'Cover',
    );
    pushItem(
      'avatar_preview',
      c.profile?.profile?.avatar_url,
      'Profile image',
      'Avatar',
    );

    const showcases = c.profile?.sections?.showcases || {};
    const orderedTypes = [
      'portfolio',
      'case_study',
      'testimonial',
      'certification',
      'intro_video',
      'highlight',
    ];
    orderedTypes.forEach(typeKey => {
      const rows = Array.isArray((showcases as any)?.[typeKey])
        ? (showcases as any)[typeKey]
        : [];
      rows.forEach((row: any, index: number) => {
        const rowId = String(row?.id || `${typeKey}_${index}`);
        const uri =
          row?.file_url || row?.file || row?.cover_url || row?.payload?.url;
        const title = String(
          row?.title || row?.name || row?.summary || typeKey.replace(/_/g, ' '),
        );
        const forceKind = typeKey === 'intro_video' ? 'video' : undefined;
        pushItem(
          rowId,
          uri,
          title,
          typeKey.replace(/_/g, ' '),
          forceKind,
          typeKey,
          rowId,
          !!row?.id,
        );
      });
    });
    return gallery;
  }, [
    c.profile?.profile?.avatar_url,
    c.profile?.profile?.cover_url,
    c.profile?.sections?.showcases,
  ]);

  const handleDeleteGalleryItem = useCallback(
    async (item: any) => {
      const itemType = item?.itemType;
      const itemId = String(item?.itemId || '').trim();
      if (!itemType || !itemId) return;
      setDeletingGalleryItemId(itemId);
      try {
        await c.deleteItem(itemType, itemId);
      } finally {
        setDeletingGalleryItemId(null);
      }
    },
    [c],
  );

  const sheetTitle = useMemo(
    () => getSheetTitle(c.activeSheet),
    [c.activeSheet],
  );

  const openWalletSheet = c.openSheet;
  const setWalletForm = c.setWalletForm;

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('wallet.open', () => {
      openWalletSheet('wallet');
      setWalletForm((prev: any) => ({ ...prev, mode: 'history' }));
    });
    return () => sub.remove();
  }, [openWalletSheet, setWalletForm]);

  useEffect(() => {
    loadInAppNotifications().catch(() => undefined);
    const sub = DeviceEventEmitter.addListener(
      IN_APP_NOTIFICATIONS_UPDATED_EVENT,
      () => {
        loadInAppNotifications().catch(() => undefined);
      },
    );
    return () => sub.remove();
  }, [loadInAppNotifications]);

  const openManagementPanel = useCallback(
    (key: BroadcastProfileKey) => {
      setManagementPanelKey(key);
      Animated.timing(managementPanelOffset, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start();
    },
    [managementPanelOffset],
  );

  const closeManagementPanel = useCallback(() => {
    Animated.timing(managementPanelOffset, {
      toValue: profileLayout.SCREEN_WIDTH,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      setManagementPanelKey(null);
    });
  }, [managementPanelOffset]);

  const resetFeedForm = useCallback(() => {
    setPanelFeedItemTitle('');
    setPanelFeedItemSummary('');
    setPanelFeedMediaType('video');
    setEditingFeedItemId(null);
    setPanelFeedAssets([]);
    setPanelFeedExistingAttachments([]);
    setPanelFeedMediaOptions(buildDefaultFeedMediaOptions());
  }, []);

  const updatePanelFeedMediaOptions = useCallback(
    (
      type: FeedMediaType,
      updates: Partial<FeedMediaOptions[FeedMediaType]>,
    ) => {
      setPanelFeedMediaOptions(prev => ({
        ...prev,
        [type]: {
          ...prev[type],
          ...updates,
        },
      }));
    },
    [],
  );

  const handleSubmitFeedItem = useCallback(async () => {
    if (!managementPanelKey) return;
    const title = panelFeedItemTitle.trim();
    if (!title) {
      Alert.alert('Title required', 'Give the broadcast item a short title.');
      return;
    }

    setPanelFeedAdding(true);
    const attachmentsPayload = panelFeedAssets
      .filter(asset => asset?.uri)
      .map(asset => ({
        uri: asset.uri!,
        name: asset.fileName || `feed-${Date.now()}`,
        type: asset.type || 'application/octet-stream',
      }));
    const mediaOptionsPayload = panelFeedMediaOptions[panelFeedMediaType];

    try {
      if (editingFeedItemId) {
        await c.updateBroadcastFeedEntry(
          editingFeedItemId,
          title,
          panelFeedItemSummary.trim(),
          panelFeedMediaType,
          attachmentsPayload,
          panelFeedExistingAttachments,
          mediaOptionsPayload,
        );
      } else {
        await c.addBroadcastFeedEntry(
          title,
          panelFeedItemSummary.trim(),
          panelFeedMediaType,
          attachmentsPayload,
          mediaOptionsPayload,
        );
      }
      resetFeedForm();
    } catch (error: any) {
      Alert.alert(
        'Broadcast item',
        error?.message || 'Unable to save this item.',
      );
    } finally {
      setPanelFeedAdding(false);
    }
  }, [
    c,
    editingFeedItemId,
    managementPanelKey,
    panelFeedAssets,
    panelFeedExistingAttachments,
    panelFeedItemSummary,
    panelFeedItemTitle,
    panelFeedMediaOptions,
    panelFeedMediaType,
    resetFeedForm,
  ]);

  const openAdvancedFeedComposer = useCallback(
    (channel?: { id?: string; handle?: string; display_name?: string } | null) => {
      setAdvancedFeedChannelContext(
        channel?.id
          ? {
              channelId: String(channel.id),
              channelHandle: channel.handle ? String(channel.handle) : undefined,
              channelName: channel.display_name ? String(channel.display_name) : undefined,
            }
          : null,
      );
      setAdvancedFeedComposerVisible(true);
    },
    [],
  );

  const handleAdvancedFeedSubmit = useCallback(
    async (payload: FeedComposerPayload) => {
      const prepared = await prepareBroadcastVideoPayload(payload);
      if (!prepared) return;

      const composerType = prepared.composerType ?? 'text';
      const mediaType: FeedMediaType =
        composerType === 'image'
          ? 'image'
          : composerType === 'video' || composerType === 'short_video'
          ? 'video'
          : composerType === 'audio'
          ? 'audio'
          : composerType === 'document'
          ? 'file'
          : 'text';
      const attachments = Array.isArray(prepared.attachments)
        ? prepared.attachments
        : [];
      const localAttachments = attachments
        .map(attachment => {
          const uri = attachment?.uri ?? attachment?.url;
          if (!uri || /^https?:\/\//i.test(String(uri))) return null;
          return {
            uri: String(uri),
            name:
              attachment?.originalName ??
              attachment?.name ??
              `feed-${Date.now()}`,
            type:
              attachment?.mimeType ??
              attachment?.type ??
              'application/octet-stream',
          };
        })
        .filter(
          (
            attachment,
          ): attachment is { uri: string; name: string; type: string } =>
            Boolean(attachment),
        );
      const remoteAttachments = attachments.filter(attachment => {
        const uri = attachment?.uri ?? attachment?.url;
        return !uri || /^https?:\/\//i.test(String(uri));
      });
      const summary =
        prepared.textPlain?.trim() ||
        prepared.textPreview?.trim() ||
        prepared.event?.title?.trim?.() ||
        prepared.poll?.question?.trim?.() ||
        prepared.link?.trim() ||
        '';
      const title =
        summary.split(/\n+/)[0]?.slice(0, 80).trim() ||
        (composerType === 'poll'
          ? 'Poll'
          : composerType === 'event'
          ? 'Event'
          : composerType === 'link'
          ? 'Link'
          : 'Broadcast update');

      await c.addBroadcastFeedEntry(
        title,
        summary,
        mediaType,
        localAttachments,
        buildDefaultFeedMediaOptions()[mediaType],
        {
          ...prepared,
          attachmentPayloads: remoteAttachments,
        },
      );
      setAdvancedFeedComposerVisible(false);
      setAdvancedFeedChannelContext(null);
      Alert.alert('Broadcast item', 'Advanced feed item saved to your queue.');
    },
    [c],
  );

  const handleEditFeedItem = useCallback((item: any) => {
    setEditingFeedItemId(item.id);
    setPanelFeedItemTitle(item.title || '');
    setPanelFeedItemSummary(item.summary || '');
    const entryType = (item.media_type as FeedMediaType) || 'text';
    setPanelFeedMediaType(entryType);
    const attachments = (
      Array.isArray(item.attachments) ? item.attachments : []
    ).filter(Boolean);
    const baseAttachments =
      attachments.length > 0
        ? attachments
        : item.attachment
        ? [item.attachment]
        : [];
    setPanelFeedExistingAttachments(baseAttachments);
    setPanelFeedAssets([]);
    const nextOptions = buildDefaultFeedMediaOptions();
    const existingOptions = item.media_options;
    if (existingOptions && typeof existingOptions === 'object') {
      nextOptions[entryType] = {
        ...nextOptions[entryType],
        ...existingOptions,
      };
    }
    setPanelFeedMediaOptions(nextOptions);
  }, []);

  const handleCancelFeedEdit = useCallback(() => {
    resetFeedForm();
  }, [resetFeedForm]);

  const handleDeleteFeedItem = useCallback(
    async (id: string) => {
      setPanelFeedDeletingId(id);
      try {
        await c.deleteBroadcastFeedEntry(id);
        if (editingFeedItemId === id) {
          resetFeedForm();
        }
      } catch (error: any) {
        Alert.alert(
          'Delete item',
          error?.message || 'Unable to delete the item.',
        );
      } finally {
        setPanelFeedDeletingId(null);
      }
    },
    [c, editingFeedItemId, resetFeedForm],
  );

  const handleBroadcastFeedItem = useCallback(
    async (feed: any) => {
      setPanelFeedBroadcastingId(feed?.id ?? null);
      try {
        await c.broadcastFeedEntry(feed.id);
        Alert.alert('Broadcast', 'This item was broadcasted to your feed.');
      } catch (error: any) {
        Alert.alert(
          'Broadcast',
          error?.message || 'Unable to broadcast the item.',
        );
      } finally {
        setPanelFeedBroadcastingId(prev => (prev === feed.id ? null : prev));
      }
    },
    [c],
  );

  const handleRemoveBroadcastFeedItem = useCallback(
    async (feed: any) => {
      setPanelFeedBroadcastingId(feed?.id ?? null);
      try {
        await c.unbroadcastFeedEntry(feed.id);
        Alert.alert('Broadcast', 'This item was removed from your feed.');
      } catch (error: any) {
        Alert.alert(
          'Broadcast',
          error?.message || 'Unable to remove the item from broadcast.',
        );
      } finally {
        setPanelFeedBroadcastingId(prev => (prev === feed.id ? null : prev));
      }
    },
    [c],
  );

  const handleBroadcastCTA = useCallback(
    (def: (typeof BROADCAST_PROFILE_DEFINITIONS)[number]) => {
      openManagementPanel(def.profileKey);
    },
    [openManagementPanel],
  );

  const rootNavigation =
    tabsNavigation.getParent<NativeStackNavigationProp<RootStackParamList>>();

  const [openToWork, setOpenToWork] = useState(false);
  const [openToWorkLoading, setOpenToWorkLoading] = useState(false);

  useEffect(() => {
    if (c.profile?.profile?.open_to_work !== undefined) {
      setOpenToWork(Boolean(c.profile.profile.open_to_work));
    }
  }, [c.profile?.profile?.open_to_work]);

  const handleOpenToWorkToggle = useCallback(async (value: boolean) => {
    setOpenToWork(value);
    setOpenToWorkLoading(true);
    try {
      const res = await postRequest(ROUTES.profiles.openToWork, { open_to_work: value });
      if (!res?.success) throw new Error(res?.message || 'Failed');
    } catch {
      // Queue for retry; keep optimistic state (don't revert)
      await enqueueMutation({ method: 'POST', url: ROUTES.profiles.openToWork, payload: { open_to_work: value } }).catch(() => {});
    } finally {
      setOpenToWorkLoading(false);
    }
  }, []);

  const openBookingDetails = useCallback(
    (bookingId: string) => {
      if (!bookingId) return;
      rootNavigation?.navigate('ServiceBookingDetails', { bookingId });
    },
    [rootNavigation],
  );

  useEffect(() => {
    const requestedKey = requestedBroadcastProfileKey;
    if (!requestedKey) return;
    if (requestedKey !== managementPanelKey) {
      openManagementPanel(requestedKey);
    }
    tabsNavigation.setParams({ broadcastProfileKey: undefined });
  }, [
    tabsNavigation,
    managementPanelKey,
    openManagementPanel,
    requestedBroadcastProfileKey,
  ]);

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(
      'profile.reopenManagementPanel',
      (key?: BroadcastProfileKey | null) => {
        if (!key) return;
        openManagementPanel(key);
      },
    );
    return () => subscription.remove();
  }, [openManagementPanel]);

  const openMarketLandingBuilder = useCallback(
    (shop?: any) => {
      rootNavigation?.navigate('ProfileLandingEditor', {
        kind: 'market',
        profileLabel: shop?.name
          ? `${shop.name} landing page`
          : 'Market Profile',
        shopId: shop?.id,
        shopName: shop?.name,
      });
    },
    [rootNavigation],
  );

  const handleViewShopDashboard = useCallback(
    (shop: any) => {
      if (!shop) return;
      rootNavigation?.navigate('ShopDashboard', { shop });
    },
    [rootNavigation],
  );

  const openEducationLandingBuilder = useCallback(
    (institution?: any) => {
      rootNavigation?.navigate('ProfileLandingEditor', {
        kind: 'education',
        profileLabel: institution?.name || 'Education Profile',
        returnBroadcastProfileKey: 'education',
      });
    },
    [rootNavigation],
  );

  const openPartnerLandingBuilder = useCallback(
    (partnerId: string, partnerName?: string | null) => {
      if (!partnerId) return;
      rootNavigation?.navigate('ProfileLandingEditor', {
        kind: 'partner',
        partnerId,
        profileLabel: partnerName || 'Partner Profile',
      });
    },
    [rootNavigation],
  );

  const handleViewInstitution = useCallback(
    (inst: any) => {
      if (!inst?.id || !inst?.type) return;
      rootNavigation?.navigate('HealthInstitutionDetail', {
        institutionId: inst.id,
        institutionType: inst.type,
        institutionName: inst.name,
      });
    },
    [rootNavigation],
  );

  const handleEditInstitution = useCallback(
    (inst: any) => {
      if (!inst?.id) return;
      rootNavigation?.navigate('HealthInstitutionManagement', {
        institutionId: inst.id,
        institutionName: inst.name,
        institutionType: (inst.type as HealthInstitutionType) ?? 'clinic',
        employees: Math.max(
          1,
          Array.isArray(inst.employees) ? inst.employees.length : 1,
        ),
      });
    },
    [rootNavigation],
  );

  const handleAddInstitution = useCallback(() => {
    rootNavigation?.navigate('HealthInstitutionManagement', {
      institutionType: 'clinic',
    });
  }, [rootNavigation]);

  const managementPanelData = managementPanelKey
    ? broadcastProfiles?.[managementPanelKey]
    : null;
  const managementPanelDefinition =
    managementPanelKey &&
    BROADCAST_PROFILE_DEFINITIONS.find(
      def => def.profileKey === managementPanelKey,
    );

  const resetMarketForm = useCallback(() => {
    setMarketForm(DEFAULT_MARKET_FORM);
    setMarketFormMode('add');
    setActiveShop(null);
    setShopEditorMode('create');
  }, []);

  const resetEducationForm = useCallback(() => {
    setEducationForm({
      title: '',
      summary: '',
    });
    setEducationFormMode('add');
  }, []);

  const resetEducationModuleForm = useCallback(() => {
    setEducationModuleForm({
      title: '',
      summary: '',
      resource_url: '',
    });
  }, []);

  const unwrapList = useCallback((payload: any) => {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.results)) return payload.results;
    return [];
  }, []);

  const manageableRoles = useMemo(
    () => new Set(['owner', 'manager', 'admin']),
    [],
  );

  const manageableShops = useMemo(() => {
    if (!currentUserId) {
      return [];
    }
    return commerceShops.reduce<any[]>((list, shop) => {
      if (!shop) return list;
      const ownerId = shop.owner ? String(shop.owner) : '';
      const isOwner = ownerId === currentUserId;
      const members = Array.isArray(shop.team_members) ? shop.team_members : [];
      let isManager = false;
      let isAdmin = false;
      let hasRole = false;
      for (const member of members) {
        if (!member) continue;
        const memberUserId = member.user ? String(member.user) : '';
        if (memberUserId !== currentUserId) continue;
        const role = ((member.role || '') as string).toLowerCase();
        if (role === 'manager') {
          isManager = true;
        }
        if (role === 'admin') {
          isAdmin = true;
        }
        if (manageableRoles.has(role)) {
          hasRole = true;
        }
      }
      if (isOwner || hasRole || isAdmin) {
        list.push({
          ...shop,
          canEdit: isOwner || isManager,
        });
      }
      return list;
    }, []);
  }, [commerceShops, currentUserId, manageableRoles]);

  const loadCommerceShops = useCallback(async () => {
    if (!currentUserId) {
      setCommerceShops([]);
      return;
    }

    try {
      const cached = await AsyncStorage.getItem(SHOPS_CACHE_KEY);
      if (cached) {
        const shops = JSON.parse(cached);
        if (Array.isArray(shops)) setCommerceShops(shops);
      }
    } catch {}

    setCommerceShopsLoading(true);
    try {
      const queryWithOwner = `${ROUTES.commerce.shops}`;
      const ownerParams = { owner: currentUserId };
      const response = await getRequest(queryWithOwner, {
        params: ownerParams,
        errorMessage: 'Unable to load your shops.',
      });
      let shops = response?.success ? unwrapList(response.data) : [];
      if (!shops.length) {
        const fallbackResponse = await getRequest(queryWithOwner, {
          errorMessage: 'Unable to load your shops.',
        });
        if (fallbackResponse?.success) {
          shops = unwrapList(fallbackResponse.data);
        } else {
          if (fallbackResponse?.message) {
            console.warn(
              'Unable to load commerce shops:',
              fallbackResponse.message,
            );
          }
        }
      } else if (!response?.success && response?.message) {
        console.warn('Unable to load commerce shops:', response.message);
      }
      if (shops.length) {
        let revenueByShopId = new Map<string, number>();
        try {
          const providerOrdersRes = await getRequest(
            ROUTES.commerce.marketplaceProviderOrders,
            {
              errorMessage: 'Unable to load shop revenue.',
            },
          );
          const providerOrders = providerOrdersRes?.success
            ? unwrapList(providerOrdersRes.data)
            : [];
          revenueByShopId = providerOrders.reduce(
            (map: Map<string, number>, order: any) => {
              const shopId =
                order?.shop_info?.id ??
                order?.shop?.id ??
                order?.shop_id ??
                null;
              const status = String(order?.status ?? '').toLowerCase();
              if (!shopId || status === 'cancelled' || status === 'canceled') {
                return map;
              }
              const orderTotal = backendOrderTotalToFrontendKisc(
                order?.total_amount ?? order?.amount ?? 0,
              );
              map.set(
                String(shopId),
                (map.get(String(shopId)) ?? 0) + orderTotal,
              );
              return map;
            },
            new Map<string, number>(),
          );
        } catch {
          revenueByShopId = new Map<string, number>();
        }
        shops = await Promise.all(
          shops.map(async (shop: any) => {
            const shopId = shop?.id;
            if (!shopId) return shop;
            try {
              const [productsRes, servicesRes] = await Promise.all([
                getRequest(ROUTES.commerce.products, {
                  params: { shop: shopId },
                  errorMessage: 'Unable to load shop products.',
                }),
                getRequest(ROUTES.commerce.shopServices, {
                  params: { shop: shopId },
                  errorMessage: 'Unable to load shop services.',
                }),
              ]);
              const products = productsRes?.success
                ? unwrapList(productsRes.data)
                : [];
              const services = servicesRes?.success
                ? unwrapList(servicesRes.data)
                : [];
              return {
                ...shop,
                products_count: products.length,
                services_count: services.length,
                revenue_total:
                  revenueByShopId.get(String(shopId)) ??
                  Number(shop?.revenue_total ?? shop?.revenue ?? 0),
              };
            } catch {
              return {
                ...shop,
                revenue_total:
                  revenueByShopId.get(String(shopId)) ??
                  Number(shop?.revenue_total ?? shop?.revenue ?? 0),
              };
            }
          }),
        );
      }
      setCommerceShops(shops);
      AsyncStorage.setItem(SHOPS_CACHE_KEY, JSON.stringify(shops)).catch(() => {});
    } catch (error: any) {
      console.warn('Unable to load commerce shops:', error?.message ?? error);
    } finally {
      setCommerceShopsLoading(false);
    }
  }, [currentUserId, unwrapList]);

  useFocusEffect(
    useCallback(() => {
      void loadCommerceShops();
    }, [loadCommerceShops]),
  );

  useFocusEffect(
    useCallback(() => {
      void loadAppointments();
    }, [loadAppointments]),
  );

  useEffect(() => {
    if (!currentUserId) {
      setCommerceShops([]);
    }
  }, [currentUserId]);

  const handleEducationFormTitleChange = useCallback((value: string) => {
    setEducationForm(prev => ({ ...prev, title: value }));
  }, []);

  const handleEducationFormSummaryChange = useCallback((value: string) => {
    setEducationForm(prev => ({ ...prev, summary: value }));
  }, []);

  const handleEducationModuleTitleChange = useCallback((value: string) => {
    setEducationModuleForm(prev => ({ ...prev, title: value }));
  }, []);

  const handleEducationModuleSummaryChange = useCallback((value: string) => {
    setEducationModuleForm(prev => ({ ...prev, summary: value }));
  }, []);

  const handleEducationModuleResourceChange = useCallback((value: string) => {
    setEducationModuleForm(prev => ({ ...prev, resource_url: value }));
  }, []);

  const resolveAttachmentUrl = useCallback((attachment: any) => {
    return (
      attachment?.url ??
      attachment?.link ??
      attachment?.resource_url ??
      attachment?.source_url ??
      attachment?.uri ??
      null
    );
  }, []);

  const attachmentKey = useCallback(
    (attachment: any) => {
      return (
        attachment?.key ??
        attachment?.file_key ??
        attachment?.id ??
        attachment?.name ??
        resolveAttachmentUrl(attachment) ??
        null
      );
    },
    [resolveAttachmentUrl],
  );

  const handleRemoveFeedAttachment = useCallback(
    async (feed: any, attachment: any) => {
      const attachments: any[] = [
        feed.attachment,
        ...(Array.isArray(feed.attachments) ? feed.attachments : []),
      ].filter(Boolean);
      const targetKey = attachmentKey(attachment);
      if (!targetKey) {
        Alert.alert('Attachment', 'Unable to identify this attachment.');
        return;
      }

      try {
        await c.removeBroadcastFeedAttachment(feed.id, targetKey);
        Alert.alert('Attachment', 'Attachment removed.');
      } catch (error: any) {
        const message = error?.message ?? 'Unable to remove attachment.';
        if (message.toLowerCase().includes('not found')) {
          const retainAttachments = attachments.filter(
            att => attachmentKey(att) !== targetKey,
          );
          try {
            await c.updateBroadcastFeedEntry(
              feed.id,
              feed.title ?? '',
              feed.summary ?? '',
              (feed.media_type as FeedMediaType) ?? 'text',
              [],
              retainAttachments,
              feed.media_options ?? {},
            );
            Alert.alert('Attachment', 'Attachment removed.');
          } catch (innerError: any) {
            Alert.alert(
              'Attachment',
              innerError?.message || 'Unable to remove attachment.',
            );
          }
        } else {
          Alert.alert('Attachment', message);
        }
      } finally {
        if (editingFeedItemId === feed.id) {
          setPanelFeedExistingAttachments(prev =>
            prev.filter(att => attachmentKey(att) !== targetKey),
          );
        }
      }
    },
    [attachmentKey, c, editingFeedItemId, setPanelFeedExistingAttachments],
  );

  const openModuleResource = useCallback(async (url?: string | null) => {
    if (!url) {
      Alert.alert('Module', 'No resource link provided.');
      return;
    }
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      Alert.alert('Module', 'Unable to open the resource URL.');
      return;
    }
    Linking.openURL(url);
  }, []);

  const beginMarketEdit = useCallback((shop: any) => {
    const previewUri = getShopPreviewUri(shop);
    setMarketForm({
      id: shop.id,
      name: shop.name ?? '',
      description: shop.description ?? '',
      employeeSlots: String(shop.employee_slots ?? 1),
      status: (shop.status as ShopStatus) ?? 'active',
      featuredImage: previewUri,
      featuredImageFile: null,
      slug: shop.slug ?? '',
    });
    setMarketFormMode('edit');
    setActiveShop(shop);
  }, []);

  const openShopEditorForCreate = useCallback(() => {
    resetMarketForm();
    setShopEditorMode('create');
    setShopEditorVisible(true);
  }, [resetMarketForm]);

  const openShopEditorForEdit = useCallback(
    (shop: any) => {
      beginMarketEdit(shop);
      setShopEditorMode('edit');
      setShopEditorVisible(true);
    },
    [beginMarketEdit],
  );

  const closeShopEditor = useCallback(() => {
    setShopEditorVisible(false);
    setActiveShop(null);
    resetMarketForm();
  }, [resetMarketForm]);

  const formatLessonTime = useCallback((value?: string | null) => {
    if (!value) return 'Starts soon';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'TBD';
    return date.toLocaleString();
  }, []);

  const loadEducationAnalytics = useCallback(async () => {
    setEducationAnalyticsLoading(true);
    try {
      const lessonRes = await getRequest(ROUTES.broadcasts.lessons, {
        errorMessage: 'Unable to load lessons.',
      });
      if (lessonRes.success) {
        const lessons = unwrapList(lessonRes.data);
        setEducationLessonsData(lessons);
        setEducationAnalyticsError(null);
      } else {
        setEducationAnalyticsError(lessonRes.message ?? null);
      }
    } catch (error: any) {
      setEducationAnalyticsError(
        error?.message || 'Unable to load lesson insights.',
      );
    } finally {
      setEducationAnalyticsLoading(false);
    }
  }, [unwrapList]);

  const loadMarketplaceOrders = useCallback(async () => {
    try {
      const cached = await AsyncStorage.getItem(ORDERS_CACHE_KEY);
      if (cached) {
        const orders = JSON.parse(cached);
        if (Array.isArray(orders)) setMarketplaceOrders(orders);
      }
    } catch {}

    setMarketplaceOrdersLoading(true);
    setMarketplaceOrdersError(null);
    try {
      const response = await getRequest(ROUTES.commerce.marketplaceOrders, {
        errorMessage: 'Unable to load marketplace orders.',
      });
      if (response.success) {
        const payload = response.data;
        const orders = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.results)
          ? payload.results
          : [];
        setMarketplaceOrders(orders);
        AsyncStorage.setItem(ORDERS_CACHE_KEY, JSON.stringify(orders)).catch(() => {});
      } else {
        setMarketplaceOrdersError(
          response.message ?? 'Unable to load your marketplace orders.',
        );
      }
    } catch (loadError: any) {
      setMarketplaceOrdersError(
        loadError?.message ?? 'Unable to load your marketplace orders.',
      );
    } finally {
      setMarketplaceOrdersLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadMarketplaceOrders();
    }, [loadMarketplaceOrders]),
  );

  useEffect(() => {
    if (managementPanelKey === 'education') {
      void loadEducationAnalytics();
    }
  }, [managementPanelKey, loadEducationAnalytics]);

  const upcomingLessons = useMemo(() => {
    const now = Date.now();
    return educationLessonsData
      .filter(lesson => {
        if (!lesson?.starts_at) return false;
        const startsAt = new Date(lesson.starts_at).getTime();
        return !Number.isNaN(startsAt) && startsAt >= now;
      })
      .sort(
        (a, b) =>
          new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
      );
  }, [educationLessonsData]);

  const totalEnrollments = useMemo(
    () =>
      educationLessonsData.reduce<number>((sum, lesson) => {
        const count = Number(lesson?.enrollment_count ?? 0);
        return sum + (Number.isFinite(count) ? count : 0);
      }, 0),
    [educationLessonsData],
  );

  const nextLesson = upcomingLessons[0] ?? null;

  const recentMarketplaceOrders = useMemo(() => {
    const sorted = [...marketplaceOrders];
    sorted.sort((a, b) => {
      const aDate = new Date(a?.created_at || a?.createdAt || '').getTime();
      const bDate = new Date(b?.created_at || b?.createdAt || '').getTime();
      return bDate - aDate;
    });
    return sorted.slice(0, 3);
  }, [marketplaceOrders]);
  const marketplaceOrderSummary = useMemo(() => {
    const summary = {
      pending: 0,
      completed: 0,
      disputed: 0,
    };
    marketplaceOrders.forEach(order => {
      const status = String(order?.status || order?.order_status || '')
        .trim()
        .toLowerCase();
      if (
        [
          'pending',
          'processing',
          'awaiting_payment',
          'awaiting_confirmation',
        ].includes(status)
      ) {
        summary.pending += 1;
      } else if (['completed', 'delivered', 'fulfilled'].includes(status)) {
        summary.completed += 1;
      } else if (
        ['dispute', 'disputed', 'refunded', 'cancelled', 'canceled'].includes(
          status,
        )
      ) {
        summary.disputed += 1;
      }
    });
    return summary;
  }, [marketplaceOrders]);

  const profileDisplayName = c.profile?.user?.display_name || 'Your name';
  const profileHandle = `@${profileDisplayName
    .toLowerCase()
    .replace(/\s+/g, '')}`;
  const profileCompletion = c.profile?.profile?.completion_score ?? 0;
  const currentLanguageEntry = languages.find(entry => entry.code === language);
  const currentLanguageLabel =
    (currentLanguageEntry?.nativeName ?? currentLanguageEntry?.label) ?? 'English';

  const walletDashboardActions = useMemo(
    () => [
      {
        key: 'upgrade-account',
        title: 'Upgrade',
        icon: 'star' as const,
        tone: 'primary' as const,
        onPress: () => c.openSheet('upgrade'),
      },
      {
        key: 'wallet-history',
        title: 'History',
        icon: 'calendar' as const,
        tone: 'warning' as const,
        onPress: () => {
          openWalletSheet('wallet');
          setWalletForm((prev: any) => ({ ...prev, mode: 'history' }));
        },
      },
      {
        key: 'profile-notifications',
        title: 'Alerts',
        icon: 'bell' as const,
        tone: 'info' as const,
        onPress: () => rootNavigation?.navigate('ProfileNotifications'),
      },
    ],
    [c, openWalletSheet, rootNavigation, setWalletForm],
  );

  const quickActionItems = useMemo(
    () => [
      {
        key: 'create-partner',
        title: 'Create Partner',
        subtitle: canCreatePartner
          ? 'Launch an organization profile'
          : 'Partner limit reached',
        icon: 'people' as const,
        tone: 'primary' as const,
        onPress: canCreatePartner ? c.openCreatePartner : undefined,
      },
      {
        key: 'create-broadcast',
        title: 'Create Broadcast',
        subtitle: 'Open your broadcast feed studio',
        icon: 'megaphone' as const,
        tone: 'warning' as const,
        onPress: () => openManagementPanel('broadcast_feed'),
      },
      {
        key: 'create-course',
        title: 'Create Course',
        subtitle: 'Open the education workspace',
        icon: 'school' as const,
        tone: 'success' as const,
        onPress: () => openManagementPanel('education'),
      },
      {
        key: 'create-shop',
        title: 'Create Shop',
        subtitle: 'Open commerce setup',
        icon: 'cart' as const,
        tone: 'info' as const,
        onPress: openShopEditorForCreate,
      },
      {
        key: 'view-events',
        title: 'Community Events',
        subtitle: 'Browse and RSVP to events',
        icon: 'calendar' as const,
        tone: 'primary' as const,
        onPress: () => rootNavigation?.navigate('Events'),
      },
      {
        key: 'my-applications',
        title: 'My Applications',
        subtitle: 'Track your job applications',
        icon: 'list' as const,
        tone: 'info' as const,
        onPress: () => rootNavigation?.navigate('MyApplications'),
      },
      {
        key: 'my-network',
        title: 'My Network',
        subtitle: (() => {
          const connectionCount = (c.profile?.profile?.connection_count ?? 0) as number;
          return connectionCount > 0 ? `${connectionCount} connection${connectionCount !== 1 ? 's' : ''}` : 'Manage connections';
        })(),
        icon: 'people' as const,
        tone: 'success' as const,
        onPress: () => rootNavigation?.navigate('Connections', {}),
      },
      {
        key: 'testimony-network',
        title: 'Testimony Network',
        subtitle: 'Your seasons & testimonies',
        icon: 'heart' as const,
        tone: 'primary' as const,
        onPress: () => rootNavigation?.navigate('TestimonyHub'),
      },
    ],
    [
      c.openCreatePartner,
      c.profile?.profile?.connection_count,
      canCreatePartner,
      openManagementPanel,
      openShopEditorForCreate,
      rootNavigation,
    ],
  );

  const recentActivityItems = useMemo(
    () =>
      buildRecentActivityItems(c.profile, appointments, openBookingDetails, 4),
    [c.profile, appointments, openBookingDetails],
  );

  const impactSnapshotStats = useMemo(
    () => buildImpactSnapshotStats(c.profile, 'month'),
    [c.profile],
  );

  const appointmentSummaryStats = useMemo(
    () => [
      { key: 'active', label: 'Active', value: appointments.length },
      {
        key: 'confirmed',
        label: 'Confirmed',
        value: confirmedAppointments.length,
      },
      {
        key: 'pending',
        label: 'Payment pending',
        value: pendingServicePayments.length,
      },
      {
        key: 'payout',
        label: 'Awaiting payout',
        value: pendingReceivePayments.length,
      },
    ],
    [
      appointments.length,
      confirmedAppointments.length,
      pendingServicePayments.length,
      pendingReceivePayments.length,
    ],
  );

  const appointmentDashboardItems = useMemo(
    () =>
      appointments.slice(0, 3).map((booking: any, index: number) => {
        const scheduledAt = booking?.scheduled_at
          ? new Date(booking.scheduled_at)
          : null;
        const dateLabel =
          scheduledAt && !Number.isNaN(scheduledAt.getTime())
            ? scheduledAt.toLocaleString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })
            : undefined;
        return {
          id: String(booking?.id || `appointment-${index}`),
          title: booking?.service_name || 'Service appointment',
          provider: booking?.shop_name || 'Provider',
          dateLabel,
          status: booking?.status || 'pending',
          paymentStatus:
            booking?.deposit_cents && booking?.status === 'confirmed'
              ? 'Paid'
              : 'Pending',
          meetingLink: booking?.remote_meeting_link,
          onPress: booking?.id
            ? () => openBookingDetails(String(booking.id))
            : undefined,
        };
      }),
    [appointments, openBookingDetails],
  );

  const marketplaceSummaryStats = useMemo(
    () => [
      {
        key: 'pending',
        label: 'Pending',
        value: marketplaceOrderSummary.pending,
      },
      {
        key: 'completed',
        label: 'Completed',
        value: marketplaceOrderSummary.completed,
      },
      {
        key: 'disputed',
        label: 'Disputed / closed',
        value: marketplaceOrderSummary.disputed,
      },
    ],
    [
      marketplaceOrderSummary.completed,
      marketplaceOrderSummary.disputed,
      marketplaceOrderSummary.pending,
    ],
  );

  const marketplaceDashboardOrders = useMemo(
    () =>
      recentMarketplaceOrders.map(order => ({
        id: String(order?.id || order?.reference || order?.title || 'order'),
        label:
          order?.product_name ||
          order?.service_name ||
          order?.title ||
          order?.reference ||
          'Marketplace order',
        status: String(
          order?.status || order?.order_status || 'pending',
        ).replace(/_/g, ' '),
        date:
          order?.created_at || order?.createdAt
            ? new Date(order.created_at || order.createdAt).toLocaleDateString()
            : undefined,
      })),
    [recentMarketplaceOrders],
  );

  const workspaceLaunchers = useMemo(
    () =>
      BROADCAST_PROFILE_DEFINITIONS.map(def => {
        const profileData = broadcastProfiles?.[def.profileKey];
        const summaryText = profileData
          ? def.summary(profileData)
          : def.emptySummary;
        return {
          key: def.profileKey,
          title: def.label,
          helper: def.helper,
          icon: def.icon as any,
          meta: summaryText,
          verificationSummary: normalizeVerificationSummary(profileData),
          onPress: () => handleBroadcastCTA(def),
        };
      }),
    [broadcastProfiles, handleBroadcastCTA],
  );

  const handleEducationModuleSave = useCallback(async () => {
    const title = educationModuleForm.title.trim();
    if (!title) {
      Alert.alert('Module', 'Please provide a title for the module.');
      return;
    }
    setEducationModuleSubmitting(true);
    try {
      await c.manageProfileSection('education_profile', {
        modules: [
          {
            title,
            summary: educationModuleForm.summary.trim(),
            resource_url: educationModuleForm.resource_url.trim(),
          },
        ],
      });
      Alert.alert('Module', 'Module joined your education profile.');
      resetEducationModuleForm();
    } catch (error: any) {
      Alert.alert('Module', error?.message || 'Unable to add module.');
    } finally {
      setEducationModuleSubmitting(false);
    }
  }, [educationModuleForm, c, resetEducationModuleForm]);

  const handleMarketFormSave = useCallback(async (draft: boolean) => {
    const name = marketForm.name.trim();
    if (!name) {
      Alert.alert('Market profile', 'Provide a shop name.');
      return;
    }
    const employeeSlotCount = Math.max(
      1,
      Number.parseInt(marketForm.employeeSlots, 10) || 1,
    );
    if (!draft && !marketForm.id && !marketForm.featuredImageFile) {
      Alert.alert('Market profile', 'Upload a shop image before publishing.');
      return;
    }
    const effectiveStatus = draft ? 'draft' : (marketForm.status === 'draft' ? 'active' : marketForm.status);
    const formData = new FormData();
    formData.append('name', name);
    formData.append('description', marketForm.description.trim());
    formData.append('employee_slots', String(employeeSlotCount));
    formData.append('status', effectiveStatus);
    if (marketForm.featuredImageFile) {
      formData.append('image_file', marketForm.featuredImageFile as any);
    }
    setMarketFormLoading(true);
    try {
      const endpoint = marketForm.id
        ? `${ROUTES.commerce.shops}${marketForm.id}/`
        : ROUTES.commerce.shops;
      const response = marketForm.id
        ? await patchRequest(endpoint, formData, {
            errorMessage: 'Unable to update shop.',
          })
        : await postRequest(endpoint, formData, {
            errorMessage: 'Unable to create shop.',
          });
      if (!response?.success) {
        Alert.alert(
          'Unable to save shop',
          response?.message || 'Check the shop details and try again.',
        );
        return;
      }
      await loadCommerceShops();
      Alert.alert(
        'Market profile',
        marketForm.id ? 'Shop updated.' : 'Shop created.',
      );
      resetMarketForm();
      closeShopEditor();
    } catch {
      // Queue the JSON-serialisable fields for retry when connectivity returns.
      // FormData (with binary images) cannot be queued — text fields are queued
      // instead so the backend is updated once reconnected. A new image upload
      // will still require the user to re-submit, but text changes are safe.
      const endpoint = marketForm.id
        ? `${ROUTES.commerce.shops}${marketForm.id}/`
        : ROUTES.commerce.shops;
      const jsonPayload: Record<string, any> = {
        name: marketForm.name.trim(),
        description: marketForm.description.trim(),
        employee_slots: Math.max(1, Number.parseInt(marketForm.employeeSlots, 10) || 1),
        status: marketForm.status,
      };
      enqueueMutation({
        method: marketForm.id ? 'PATCH' : 'POST',
        url: endpoint,
        payload: jsonPayload,
      }).catch(() => {});
      Alert.alert(
        'Market profile',
        'Changes saved locally — will sync when online.',
      );
    } finally {
      setMarketFormLoading(false);
    }
  }, [marketForm, resetMarketForm, closeShopEditor, loadCommerceShops]);

  const handleMarketFormDelete = useCallback(async () => {
    if (!marketForm.id) return;
    if (!canDeleteActiveShop) {
      Alert.alert(
        'Market profile',
        'Only the shop owner can delete this shop.',
      );
      return;
    }
    setMarketFormLoading(true);
    try {
      const res = await deleteRequest(
        `${ROUTES.commerce.shops}${marketForm.id}/`,
        {
          errorMessage: 'Unable to delete shop.',
        },
      );
      if (!res?.success) {
        throw new Error(res?.message || 'Unable to delete shop.');
      }
      await loadCommerceShops();
      Alert.alert('Market profile', 'Shop deleted.');
      resetMarketForm();
      closeShopEditor();
    } catch (error: any) {
      Alert.alert('Market profile', error?.message || 'Unable to delete shop.');
    } finally {
      setMarketFormLoading(false);
    }
  }, [
    marketForm.id,
    resetMarketForm,
    closeShopEditor,
    loadCommerceShops,
    canDeleteActiveShop,
  ]);

  const handleEducationFormSave = useCallback(async () => {
    const title = educationForm.title.trim();
    if (!title) {
      Alert.alert('Education profile', 'Provide a course title.');
      return;
    }
    const courses = managementPanelData?.courses ?? [];
    const nextCourses =
      educationFormMode === 'edit' && educationForm.id
        ? courses.map((course: any) =>
            course.id === educationForm.id
              ? { ...course, title, summary: educationForm.summary.trim() }
              : course,
          )
        : [...courses, { title, summary: educationForm.summary.trim() }];

    setEducationFormLoading(true);
    try {
      await c.manageProfileSection('education_profile', {
        courses: nextCourses,
      });
      resetEducationForm();
    } catch (error: any) {
      Alert.alert(
        'Education profile',
        error?.message || 'Unable to update courses.',
      );
    } finally {
      setEducationFormLoading(false);
    }
  }, [
    c,
    educationForm,
    educationFormMode,
    managementPanelData,
    resetEducationForm,
  ]);

  const handleEducationFormDelete = useCallback(async () => {
    if (!educationForm.id) return;
    const courses = managementPanelData?.courses ?? [];
    const nextCourses = courses.filter(
      (course: any) => course.id !== educationForm.id,
    );
    setEducationFormLoading(true);
    try {
      await c.manageProfileSection('education_profile', {
        courses: nextCourses,
      });
      resetEducationForm();
    } catch (error: any) {
      Alert.alert(
        'Education profile',
        error?.message || 'Unable to delete course.',
      );
    } finally {
      setEducationFormLoading(false);
    }
  }, [c, educationForm.id, managementPanelData, resetEducationForm]);

  const renderManagementPanelContent = () => {
    if (!managementPanelKey) return null;
    const isEmpty = !managementPanelData;

    const panelTitle = managementPanelDefinition?.label ?? 'Profile manager';
    const panelHint = isEmpty
      ? 'Use the create modal to start this profile, then return here to manage it.'
      : managementPanelDefinition?.helper;

    const attachments = Array.isArray(managementPanelData?.attachments)
      ? managementPanelData.attachments
      : [];

    if (managementPanelKey === 'broadcast_feed') {
      const feeds: any[] = Array.isArray(managementPanelData?.feeds)
        ? managementPanelData.feeds
        : [];
      const expiresAt = managementPanelData?.expires_at
        ? new Date(managementPanelData.expires_at).toString()
        : 'N/A';
      return (
        <FeedManagementModal
          palette={palette}
          title={panelTitle}
          subtitle={panelHint ?? ''}
          feeds={feeds}
          expiresAt={expiresAt}
          panelFeedItemTitle={panelFeedItemTitle}
          panelFeedItemSummary={panelFeedItemSummary}
          panelFeedMediaType={panelFeedMediaType}
          panelFeedAssets={panelFeedAssets}
          panelFeedExistingAttachments={panelFeedExistingAttachments}
          panelFeedAdding={panelFeedAdding}
          editingFeedItemId={editingFeedItemId}
          panelFeedDeletingId={panelFeedDeletingId}
          handlePickFeedMedia={handlePickFeedMedia}
          removeTemporaryFeedAsset={removeTemporaryFeedAsset}
          handleSubmitFeedItem={handleSubmitFeedItem}
          handleCancelFeedEdit={handleCancelFeedEdit}
          handleEditFeedItem={handleEditFeedItem}
          handleDeleteFeedItem={handleDeleteFeedItem}
          handleBroadcastFeedItem={handleBroadcastFeedItem}
          handleRemoveBroadcastFeedItem={handleRemoveBroadcastFeedItem}
          onOpenAdvancedComposer={openAdvancedFeedComposer}
          panelFeedBroadcastingId={panelFeedBroadcastingId}
          setPanelFeedExistingAttachments={setPanelFeedExistingAttachments}
          setPanelFeedMediaType={setPanelFeedMediaType}
          setPanelFeedItemTitle={setPanelFeedItemTitle}
          setPanelFeedItemSummary={setPanelFeedItemSummary}
          panelFeedMediaOptions={panelFeedMediaOptions}
          onUpdateMediaOptions={updatePanelFeedMediaOptions}
          onRemoveAttachment={handleRemoveFeedAttachment}
        />
      );
    }

    if (managementPanelKey === 'health') {
      const institutionsRaw: any[] = Array.isArray(
        managementPanelData?.institutions,
      )
        ? managementPanelData.institutions
        : [];
      const institutions = filterInstitutionsForVisibleRoles(institutionsRaw, {
        id: c.profile?.user?.id ? String(c.profile.user.id) : undefined,
        phone: String(c.profile?.user?.phone || '').trim() || undefined,
        email: String(c.profile?.user?.email || '').trim() || undefined,
      });
      return (
        <HealthManagementModal
          palette={palette}
          title={panelTitle}
          subtitle={panelHint ?? ''}
          institutions={institutions}
          currentUser={{
            id: c.profile?.user?.id ? String(c.profile.user.id) : undefined,
            phone: String(c.profile?.user?.phone || '').trim() || undefined,
            email: String(c.profile?.user?.email || '').trim() || undefined,
          }}
          onManageInstitution={handleEditInstitution}
          onViewInstitution={handleViewInstitution}
          onAddInstitution={handleAddInstitution}
          onOpenVerificationCenter={(institution: any) =>
            setVerificationCenterTarget({
              subject: { type: 'health_institution', id: institution?.id },
              title: 'Health institution verification',
              subtitle: 'Submit licensing, accreditation, and authorization metadata using private media references.',
              summary: normalizeVerificationSummary(institution),
            })
          }
        />
      );
    }

    if (managementPanelKey === 'market') {
      return (
        <MarketManagementModal
          palette={palette}
          title={panelTitle}
          subtitle={panelHint ?? ''}
          shops={manageableShops}
          loading={commerceShopsLoading}
          onCreateShop={openShopEditorForCreate}
          onEditShop={openShopEditorForEdit}
          onViewDashboard={handleViewShopDashboard}
          onOpenLandingBuilder={openMarketLandingBuilder}
          onRefresh={loadCommerceShops}
          onOpenVerificationCenter={(shop: any) =>
            setVerificationCenterTarget({
              subject: { type: 'shop', id: shop?.id },
              title: 'Shop verification',
              subtitle: 'Submit business identity and storefront proof through private media references.',
              summary: normalizeVerificationSummary(shop),
            })
          }
        />
      );
    }

    if (managementPanelKey === 'education') {
      const courses: any[] = Array.isArray(managementPanelData?.courses)
        ? managementPanelData.courses
        : [];
      const modules: any[] = Array.isArray(managementPanelData?.modules)
        ? managementPanelData.modules
        : [];
      return (
        <EducationManagementModal
          palette={palette}
          title={panelTitle}
          subtitle={panelHint ?? ''}
          managementData={managementPanelData}
          tierLabel={tierLabel}
          courses={courses}
          modules={modules}
          educationForm={educationForm}
          educationFormMode={educationFormMode}
          educationFormLoading={educationFormLoading}
          educationModuleForm={educationModuleForm}
          educationModuleSubmitting={educationModuleSubmitting}
          handleEducationFormSave={handleEducationFormSave}
          handleEducationFormDelete={handleEducationFormDelete}
          resetEducationForm={resetEducationForm}
          handleEducationModuleSave={handleEducationModuleSave}
          resetEducationModuleForm={resetEducationModuleForm}
          openModuleResource={openModuleResource}
          onEducationFormTitleChange={handleEducationFormTitleChange}
          onEducationFormSummaryChange={handleEducationFormSummaryChange}
          onEducationModuleTitleChange={handleEducationModuleTitleChange}
          onEducationModuleSummaryChange={handleEducationModuleSummaryChange}
          onEducationModuleResourceChange={handleEducationModuleResourceChange}
          loadEducationAnalytics={loadEducationAnalytics}
          educationAnalyticsLoading={educationAnalyticsLoading}
          educationAnalyticsError={educationAnalyticsError}
          upcomingLessons={upcomingLessons}
          totalEnrollments={totalEnrollments}
          nextLesson={nextLesson}
          formatLessonTime={formatLessonTime}
          attachments={attachments}
          panelAttachmentUploading={panelAttachmentUploading}
          handleAttachProfileFile={handleAttachProfileFile}
          onOpenLandingBuilder={openEducationLandingBuilder}
          onOpenVerificationCenter={(institution: any) =>
            setVerificationCenterTarget({
              subject: { type: 'education_institution', id: institution?.id },
              title: 'Education verification',
              subtitle: 'Submit accreditation and authorization metadata using private media references.',
              summary: normalizeVerificationSummary(institution),
            })
          }
        />
      );
    }

    return (
      <View style={styles.managementPanelBody}>
        <Text style={[styles.managementPanelTitle, { color: palette.text }]}>
          {panelTitle}
        </Text>
        <Text
          style={[styles.managementPanelSubtitle, { color: palette.subtext }]}
        >
          {panelHint}
        </Text>
        <Text style={{ color: palette.subtext, marginTop: 8 }}>
          Profile not created yet.
        </Text>
      </View>
    );
  };

  // Tablet-shell right-hand Context Panel — reuses profileCompletion,
  // unreadNotifications, and the same action handlers (c.openEditProfile,
  // c.openSheet, rootNavigation) already wired to ProfileHeroCard below, so
  // there's no new data or new navigation targets. "Achievements" and
  // "Recent visitors" from the reference mockup are omitted: no such data
  // exists anywhere in this app today (confirmed via search) — see
  // MessagesScreen.tsx's context-panel comment for the same no-fake-data
  // principle applied to the sidebar's omitted "Saved" item.
  useContextPanelContent(
    <>
      <TabletCard>
        <Text style={{ fontSize: 15, fontWeight: '800', color: palette.text }}>Profile Completion</Text>
        <View style={{ height: 8, borderRadius: 4, backgroundColor: palette.selectedBg, marginTop: 12, overflow: 'hidden' }}>
          <View
            style={{
              height: '100%',
              width: `${Math.max(0, Math.min(100, profileCompletion))}%`,
              borderRadius: 4,
              backgroundColor: palette.goldReadable,
            }}
          />
        </View>
        <Text style={{ fontSize: 13, fontWeight: '700', color: palette.subtext, marginTop: 8 }}>
          {profileCompletion}% complete
        </Text>
        {profileCompletion < 100 ? (
          <Pressable onPress={c.openEditProfile} style={{ marginTop: 10 }}>
            <Text style={{ fontSize: 13, fontWeight: '800', color: palette.goldReadable }}>Complete your profile ›</Text>
          </Pressable>
        ) : null}
      </TabletCard>

      <TabletCard>
        <Text style={{ fontSize: 15, fontWeight: '800', color: palette.text }}>Quick Actions</Text>
        <View style={{ gap: 12, marginTop: 12 }}>
          <Pressable onPress={c.openEditProfile} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <KISIcon name="edit" size={16} color={palette.goldReadable} />
            <Text style={{ fontSize: 13, fontWeight: '700', color: palette.text }}>Edit profile</Text>
          </Pressable>
          <Pressable
            onPress={() => rootNavigation?.navigate('ProfileNotifications')}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
          >
            <KISIcon name="bell" size={16} color={palette.goldReadable} />
            <Text style={{ fontSize: 13, fontWeight: '700', color: palette.text }}>
              Notifications{unreadNotifications.length > 0 ? ` (${unreadNotifications.length})` : ''}
            </Text>
          </Pressable>
          <Pressable onPress={() => c.openSheet('privacy')} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <KISIcon name="settings" size={16} color={palette.goldReadable} />
            <Text style={{ fontSize: 13, fontWeight: '700', color: palette.text }}>Privacy settings</Text>
          </Pressable>
        </View>
      </TabletCard>
    </>,
  );

  useGoldenSectionContent({
    content: (
      <ProfileHeroCard
        coverUrl={c.profile?.profile?.cover_url}
        avatarUrl={appendCacheBust(c.profile?.profile?.avatar_url, c.avatarVersion)}
        displayName={profileDisplayName}
        handle={profileHandle}
        headline={c.profile?.profile?.headline || 'Add a headline that sells you'}
        tierLabel={tierLabel || accountTier?.name || 'Free'}
        completionLabel={`${profileCompletion}% complete`}
        onEdit={c.openEditProfile}
        onNotificationsPress={() => rootNavigation?.navigate('ProfileNotifications')}
        onSettingsPress={() => c.openSheet('privacy')}
        notificationCount={unreadNotifications.length}
        verificationSummary={userVerificationSummary}
        onVerificationPress={() =>
          setVerificationCenterTarget({
            subject: { type: 'user' },
            title: 'User verification',
            subtitle: 'Verify your identity and show trusted badges on your profile.',
            summary: userVerificationSummary,
          })
        }
        topInset={topInset}
        scrollY={profileHeaderY}
      />
    ),
  });

  return (
    <View style={[styles.wrap, { backgroundColor: palette.bg}]}>
      <ReanimatedScroll.ScrollView
        onScroll={profileScrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={[
          styles.scroll,
          {
            gap: responsive.cardGap,
            paddingTop: compactProfile ? 8 : 12,
            paddingBottom: (compactProfile ? 32 : 44) + insets.bottom,
          },
        ]}
      >
        {c.loading && !c.profile ? (
          <View style={{ gap: 16 }}>
            <View style={[styles.card, { backgroundColor: palette.card }]}>
              <Skeleton height={160} radius={18} />
              <View style={{ marginTop: 16, gap: 10 }}>
                <Skeleton height={18} width={200} />
                <Skeleton height={12} width={160} />
                <Skeleton height={12} width={220} />
              </View>
            </View>
            <View style={[styles.card, { backgroundColor: palette.card }]}>
              <Skeleton height={18} width={180} />
              <View style={{ marginTop: 14, gap: 10 }}>
                <Skeleton height={46} radius={12} />
                <Skeleton height={46} radius={12} />
                <Skeleton height={46} radius={12} />
              </View>
            </View>
          </View>
        ) : !c.profile ? (
          <MainTabStateBlock
            title="Profile not available"
            message="Pull to refresh or try again."
            icon="person"
            actionLabel="Retry"
            onAction={c.loadProfile}
          />
        ) : (
          <>
            <View
              style={{
                marginTop: 10,
                paddingHorizontal: compactProfile ? 0 : 18,
                paddingBottom: compactProfile ? 12 : 18,
                gap: responsive.cardGap,
              }}
            >
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: palette.surfaceElevated,
                    borderColor: palette.borderMuted,
                    borderWidth: 1,
                    borderRadius: compactProfile ? 18 : 24,
                    shadowColor: palette.shadow,
                    shadowOpacity: dashboardTheme.isDark ? 0.22 : 0.08,
                    shadowRadius: dashboardTheme.isDark ? 22 : 14,
                    shadowOffset: {
                      width: 0,
                      height: dashboardTheme.isDark ? 14 : 8,
                    },
                    elevation: dashboardTheme.isDark ? 8 : 4,
                  },
                ]}
              >
                <View style={[styles.headerRow, compactProfile && styles.wrapRow]}>
                  <Text style={[styles.title, { color: palette.text }]}>
                    Profile overview
                  </Text>
                  <Text style={[styles.subtext, { color: palette.subtext }]}>
                    {c.profile.profile?.industry || 'Industry not set'}
                  </Text>
                </View>
                <Text
                  style={{
                    fontSize: responsive.bodyFontSize,
                    lineHeight: responsive.bodyFontSize * 1.5,
                    color: palette.text,
                  }}
                >
                  {c.profile.profile?.bio ||
                    'Add a short bio that explains your work.'}
                </Text>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: 10,
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: palette.divider,
                    marginTop: 8,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontSize: responsive.bodyFontSize, fontWeight: '600', color: palette.text }}>
                      Open to Work
                    </Text>
                    {openToWork ? (
                      <View style={{ backgroundColor: palette.successSoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 }}>
                        <Text style={{ color: palette.success, fontSize: responsive.labelFontSize, fontWeight: '700' }}>Active</Text>
                      </View>
                    ) : null}
                  </View>
                  {openToWorkLoading ? (
                    <ActivityIndicator size="small" color={palette.primary} />
                  ) : (
                    <Switch
                      value={openToWork}
                      onValueChange={handleOpenToWorkToggle}
                      trackColor={{ true: palette.primary }}
                      thumbColor={openToWork ? palette.primaryStrong : palette.subtext}
                    />
                  )}
                </View>
                <View
                  style={[
                    styles.actionRow,
                    {
                      alignItems: 'stretch',
                      gap: 10,
                      flexWrap: 'wrap',
                    },
                  ]}
                >
                  <VerificationStatusCard
                    palette={palette}
                    summary={userVerificationSummary}
                    title="Profile verification"
                    subtitle="Submit private evidence references for staff/provider review."
                    onOpen={() =>
                      setVerificationCenterTarget({
                        subject: { type: 'user' },
                        title: 'User verification',
                        subtitle: 'Verify your identity and unlock trusted profile badges.',
                        summary: userVerificationSummary,
                      })
                    }
                  />
                  <KISButton
                    title="Complete Profile"
                    onPress={c.openEditProfile}
                   style={{ flexGrow: 1, flexBasis: '47%', minWidth: 120 }}
                  />
                  <KISButton
                    title="Privacy"
                    variant="outline"
                    onPress={() => c.openSheet('privacy')}
                    style={{ flexGrow: 1, flexBasis: '47%', minWidth: 120 }}
                  />
                  <KISButton
                    title="KIS Principles"
                    variant="outline"
                    onPress={() => rootNavigation?.navigate('KISPrinciples')}
                    style={{ flexGrow: 1, flexBasis: '47%', minWidth: 148 }}
                  />
                  {canOpenVerificationStaffConsole ? (
                    <KISButton
                      title="Verification review"
                      variant="secondary"
                      onPress={() => setVerificationStaffConsoleVisible(true)}
                      style={{ flexGrow: 1, flexBasis: '47%', minWidth: 168 }}
                    />
                  ) : null}
                </View>
                <View
                  style={{
                    borderWidth: 1,
                    borderColor: palette.goldBorder || palette.divider,
                    borderRadius: 18,
                    backgroundColor: palette.surface,
                    marginTop: 15,
                    padding: 14,
                    gap: 10,
                  }}
                >
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
                    <View
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 14,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: palette.primarySoft,
                      }}
                    >
                      <KISIcon name="shield" size={20} color={palette.primaryStrong} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.title, { color: palette.text, fontSize: 15 }]}>
                        Family and accessibility mode
                      </Text>
                      <Text style={[styles.subtext, { color: palette.subtext }]}>
                        {familyAccessibility?.preferences?.age_mode
                          ? `${familyAccessibility.preferences.age_mode.replace('_', ' ')} mode · ${familyAccessibility.accessibility.min_touch_target}px tap targets`
                          : 'Family-safe defaults, larger tap targets, and simpler journeys.'}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.actionRow, { gap: 8, flexWrap: 'wrap' }]}>
                    {(['child', 'youth', 'adult', 'older_adult'] as KISAgeMode[]).map(mode => (
                      <KISButton
                        key={mode}
                        title={mode === 'older_adult' ? 'Older adult' : mode.charAt(0).toUpperCase() + mode.slice(1)}
                        size="sm"
                        variant={familyAccessibility?.preferences?.age_mode === mode ? 'secondary' : 'outline'}
                        disabled={familyAccessibilitySaving}
                        onPress={() => applyAgeMode(mode)}
                      />
                    ))}
                  </View>
                  <Text style={[styles.subtext, { color: palette.subtext }]}>
                    KIS keeps explicit content blocked, safe recommendations on, and child mode guided by default.
                  </Text>
                </View>
                {canOpenVerificationStaffConsole ? (
                  <>
                    <KISButton
                      title="Moderation console"
                      variant="secondary"
                      onPress={() => rootNavigation?.navigate('ModerationConsole')}
                      style={{ marginBottom: 4 }}
                    />
                    <KISButton
                      title="User Management"
                      variant="secondary"
                      onPress={() => rootNavigation?.navigate('AdminUserManagement')}
                      style={{ marginBottom: 4 }}
                    />
                    <RevenueEvidenceAdminPanel />
                    <MonetizationSafetyCard />
                    <ProfitabilityCommandCenterCard />
                    <ProfitabilityLaunchGateCard />
                    <ProfitabilitySubscriptionLifecycleCard />
                    <RevenueOpsEvidenceCard />
                    <EvidenceWorkflowPlanCard />
                    <SafetyCommandCenterCard />
                    <SecurityLaunchGateCard />
                    <LaunchOpsReadinessCard />
                  </>
                ) : null}
              </View>

              <View style={{ gap: responsive.cardGap }}>
                <WalletSummaryCard
                  balanceLabel={kisWalletLabel}
                  tierLabel={`${
                    tierLabel || accountTier?.name || 'Free'
                  } • ${points} pts`}
                  actions={walletDashboardActions}
                  onViewAll={() => c.openSheet('wallet')}
                />
                <QuickActionGrid
                  title="Quick actions"
                  items={quickActionItems}
                />
              </View>

              <RecentActivityTimeline
                items={recentActivityItems}
                onViewAll={() =>
                  rootNavigation?.navigate('ProfileRecentActivity')
                }
              />

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: responsive.cardGap }}>
                <View style={{ flex: 1, minWidth: tinyProfile ? 0 : compactProfile ? 220 : 280 }}>
                  <ImpactSnapshotCard
                    periodLabel="This month"
                    stats={impactSnapshotStats}
                    onViewAll={() =>
                      rootNavigation?.navigate('ProfileImpactSnapshot')
                    }
                  />
                </View>
                <View style={{ flex: 1, minWidth: tinyProfile ? 0 : compactProfile ? 220 : 280 }}>
                  {partnerProfiles.length === 0 ? (
                    <PartnerOrganizationSummary
                      summary="No organizations yet. Create your first partner organization and open its landing page."
                      ctaTitle={
                        canCreatePartner
                          ? 'Create Organization'
                          : 'Partner Limit Reached'
                      }
                      onPress={
                        canCreatePartner ? c.openCreatePartner : undefined
                      }
                    />
                  ) : (
                    <PartnerProfilesSection
                      palette={palette}
                      partners={partnerProfiles}
                      limitLabel={partnerProfilesLimitLabel}
                      limitValue={partnerProfilesLimitValue}
                      isUnlimited={partnerProfilesIsUnlimited}
                      canCreate={canCreatePartner}
                      actionLoadingId={c.partnerActionId}
                      onDeactivate={c.deactivatePartnerProfile}
                      onReactivate={c.reactivatePartnerProfile}
                      onDelete={c.deletePartnerProfile}
                      onOpenLandingBuilder={openPartnerLandingBuilder}
                    />
                  )}
                </View>
              </View>

              <AppointmentSummaryCard
                summary={appointmentSummaryStats}
                items={
                  appointmentsLoading || appointmentsError
                    ? []
                    : appointmentDashboardItems
                }
              />
              {appointmentsLoading ? (
                <Text style={{ color: palette.subtext, marginTop: -4 }}>
                  Loading appointments...
                </Text>
              ) : appointmentsError ? (
                <Text
                  style={{ color: palette.danger, marginTop: -4 }}
                >
                  {appointmentsError}
                </Text>
              ) : null}

              <MarketplaceOrdersSummary
                summary={marketplaceSummaryStats}
                recentOrders={marketplaceDashboardOrders}
                onViewOrders={() =>
                  rootNavigation?.navigate('MarketplaceOrders')
                }
                onViewReceivedOrders={() =>
                  rootNavigation?.navigate('MarketplaceProviderOrders')
                }
              />
              {marketplaceOrdersLoading ? (
                <ActivityIndicator
                  color={palette.primaryStrong}
                  style={{ marginTop: -4 }}
                />
              ) : marketplaceOrdersError ? (
                <Text
                  style={{ color: palette.danger, marginTop: -4 }}
                >
                  {marketplaceOrdersError}
                </Text>
              ) : null}

              <WorkspaceLauncherSection items={workspaceLaunchers} />

              <View
                style={[
                  billingLinksStyles.section,
                  { borderColor: palette.divider },
                ]}
              >
                <Text
                  style={[
                    billingLinksStyles.sectionTitle,
                    { color: palette.text },
                  ]}
                >
                  Billing &amp; Rewards
                </Text>
                <Pressable
                  style={[
                    billingLinksStyles.link,
                    { borderBottomColor: palette.divider },
                  ]}
                  onPress={() => rootNavigation?.navigate('InvoiceList')}
                >
                  <Text
                    style={[
                      billingLinksStyles.linkText,
                      { color: palette.text },
                    ]}
                  >
                    Invoices
                  </Text>
                  <KISIcon name="chevron-right" size={16} color={palette.subtext} />
                </Pressable>
                <Pressable
                  style={[
                    billingLinksStyles.link,
                    { borderBottomColor: palette.divider },
                  ]}
                  onPress={() => rootNavigation?.navigate('Loyalty')}
                >
                  <Text
                    style={[
                      billingLinksStyles.linkText,
                      { color: palette.text },
                    ]}
                  >
                    Loyalty &amp; Points
                  </Text>
                  <KISIcon name="chevron-right" size={16} color={palette.subtext} />
                </Pressable>
                <Pressable
                  style={[
                    billingLinksStyles.link,
                    { borderBottomColor: palette.divider },
                  ]}
                  onPress={() => rootNavigation?.navigate('PromoCode')}
                >
                  <Text
                    style={[
                      billingLinksStyles.linkText,
                      { color: palette.text },
                    ]}
                  >
                    Promo Codes
                  </Text>
                  <KISIcon name="chevron-right" size={16} color={palette.subtext} />
                </Pressable>
                <Pressable
                  style={[
                    billingLinksStyles.link,
                    { borderBottomColor: palette.divider },
                  ]}
                  onPress={() => rootNavigation?.navigate('Wallet')}
                >
                  <Text
                    style={[
                      billingLinksStyles.linkText,
                      { color: palette.text },
                    ]}
                  >
                    KIS Coins
                  </Text>
                  <KISIcon name="chevron-right" size={16} color={palette.subtext} />
                </Pressable>
                <Pressable
                  style={billingLinksStyles.link}
                  onPress={() => rootNavigation?.navigate('SubscriptionManagement')}
                >
                  <Text
                    style={[
                      billingLinksStyles.linkText,
                      { color: palette.text },
                    ]}
                  >
                    Subscription
                  </Text>
                  <KISIcon name="chevron-right" size={16} color={palette.subtext} />
                </Pressable>
              </View>

              <LanguageSelectorCard
                currentLabel={currentLanguageLabel}
                languages={languages}
                currentCode={language}
                downloadingCode={downloadingLanguage}
                onSelect={code => {
                  setLanguage(code).catch(() => {
                    Alert.alert(
                      'Download failed',
                      "Couldn't download this language. Check your connection and try again.",
                    );
                  });
                }}
              />
            </View>

            {/* ── Appearance ─────────────────────────────────────────────── */}
            <View
              style={{
                marginHorizontal: 18,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: palette.divider,
                backgroundColor: palette.surface,
                overflow: 'hidden',
              }}
            >
              <Text
                style={{
                  fontSize: responsive.labelFontSize,
                  fontWeight: '700',
                  color: palette.subtext,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  paddingHorizontal: 16,
                  paddingTop: 14,
                  paddingBottom: 8,
                }}
              >
                Appearance
              </Text>
              <View
                style={{
                  paddingHorizontal: 16,
                  paddingBottom: 14,
                  gap: 8,
                }}
              >
                <Text style={{ fontSize: responsive.labelFontSize, color: palette.subtext, marginBottom: 4 }}>
                  App theme
                </Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {(
                    [
                      { key: 'system', label: 'System' },
                      { key: 'light', label: 'Light' },
                      { key: 'dark', label: 'Dark' },
                    ] as { key: KISThemeMode; label: string }[]
                  ).map(option => {
                    const active = themeMode === option.key;
                    return (
                      <Pressable
                        key={option.key}
                        onPress={() => setThemeMode(option.key)}
                        style={({ pressed }) => ({
                          flex: 1,
                          alignItems: 'center',
                          justifyContent: 'center',
                          minHeight: responsive.minTouchTarget,
                          paddingVertical: 10,
                          borderRadius: 12,
                          borderWidth: 1.5,
                          borderColor: active ? palette.primaryStrong : palette.divider,
                          backgroundColor: active
                            ? palette.primarySoft ?? palette.primary + '18'
                            : pressed
                            ? palette.surfaceElevated
                            : palette.bg,
                        })}
                      >
                        <Text
                          style={{
                            fontSize: responsive.labelFontSize,
                            fontWeight: active ? '800' : '500',
                            color: active ? palette.primaryStrong : palette.subtext,
                          }}
                        >
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>

            <View
              style={{
                marginHorizontal: 18,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: palette.divider,
                backgroundColor: palette.surface,
                overflow: 'hidden',
              }}
            >
              <Text
                style={{
                  fontSize: responsive.labelFontSize,
                  fontWeight: '700',
                  color: palette.subtext,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  paddingHorizontal: 16,
                  paddingTop: 14,
                  paddingBottom: 8,
                }}
              >
                Account Security
              </Text>
              {[
                {
                  label: 'Privacy & Compliance',
                  route: 'ComplianceSettings' as const,
                  danger: false,
                },
                {
                  label: 'Notification Settings',
                  route: 'NotificationSettings' as const,
                  danger: false,
                },
                {
                  label: 'Change Password',
                  route: 'PasswordChange' as const,
                  danger: false,
                },
                {
                  label: 'Manage Devices',
                  route: 'DeviceManagement' as const,
                  danger: false,
                },
                {
                  label: 'Delete Account',
                  route: 'AccountDeletion' as const,
                  danger: true,
                },
              ].map((item, index) => (
                <Pressable
                  key={item.route}
                  onPress={() => rootNavigation?.navigate(item.route)}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    backgroundColor: pressed ? palette.surfaceElevated : 'transparent',
                    borderTopWidth: index > 0 ? 0.5 : 0,
                    borderTopColor: palette.divider,
                  })}
                >
                  <Text
                    style={{
                      fontSize: responsive.bodyFontSize,
                      fontWeight: '600',
                      color: item.danger ? palette.danger : palette.text,
                    }}
                  >
                    {item.label}
                  </Text>
                  <KISIcon
                    name="chevron-right"
                    size={16}
                    color={item.danger ? palette.danger : palette.subtext}
                  />
                </Pressable>
              ))}

              {/* Quick Lock PIN row */}
              <Pressable
                onPress={() => {
                  if (!pinEnabled) {
                    rootNavigation?.navigate('SetupPIN');
                  } else {
                    Alert.alert('Quick Lock (PIN)', 'What would you like to do?', [
                      {
                        text: 'Change PIN',
                        onPress: () => rootNavigation?.navigate('SetupPIN'),
                      },
                      {
                        text: 'Disable PIN',
                        style: 'destructive',
                        onPress: () => {
                          Alert.alert('Disable PIN', 'Remove Quick Lock PIN?', [
                            {
                              text: 'Remove',
                              style: 'destructive',
                              onPress: async () => {
                                await clearPIN();
                                void refreshPINState();
                              },
                            },
                            { text: 'Cancel', style: 'cancel' },
                          ]);
                        },
                      },
                      { text: 'Cancel', style: 'cancel' },
                    ]);
                  }
                }}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  backgroundColor: pressed ? palette.surfaceElevated : 'transparent',
                  borderTopWidth: 0.5,
                  borderTopColor: palette.divider,
                })}
              >
                <View>
                  <Text style={{ fontSize: responsive.bodyFontSize, fontWeight: '600', color: palette.text }}>
                    Quick Lock (PIN)
                  </Text>
                  <Text style={{ fontSize: responsive.labelFontSize, color: palette.subtext, marginTop: 2 }}>
                    {pinEnabled ? 'Enabled — tap to change or disable' : 'Set a 6-digit PIN to lock the app'}
                  </Text>
                </View>
                <KISIcon name="chevron-right" size={16} color={palette.subtext} />
              </Pressable>

              {/* Lock Timeout row */}
              <Pressable
                onPress={() => {
                  const options = [
                    { label: '1 minute', value: 1 },
                    { label: '5 minutes', value: 5 },
                    { label: '15 minutes', value: 15 },
                    { label: '30 minutes', value: 30 },
                    { label: 'Never', value: 0 },
                  ];
                  Alert.alert(
                    'Lock Timeout',
                    'Lock the app after being in the background for:',
                    options.map(opt => ({
                      text: opt.label + (opt.value === lockTimeoutMinutes ? ' ✓' : ''),
                      onPress: async () => {
                        await setLockTimeout(opt.value);
                        setLockTimeoutMinutes(opt.value);
                        patchRequest(ROUTES.profilePreferences.me, { lock_timeout_minutes: opt.value }).catch(() => null);
                      },
                    })).concat([{ text: 'Cancel', onPress: () => undefined, style: 'cancel' } as any]),
                  );
                }}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  backgroundColor: pressed ? palette.surfaceElevated : 'transparent',
                  borderTopWidth: 0.5,
                  borderTopColor: palette.divider,
                })}
              >
                <View>
                  <Text style={{ fontSize: responsive.bodyFontSize, fontWeight: '600', color: palette.text }}>
                    Lock Timeout
                  </Text>
                  <Text style={{ fontSize: responsive.labelFontSize, color: palette.subtext, marginTop: 2 }}>
                    {lockTimeoutMinutes === 0
                      ? 'Never auto-lock'
                      : `Auto-lock after ${lockTimeoutMinutes} min${lockTimeoutMinutes === 1 ? '' : 's'} in background`}
                  </Text>
                </View>
                <KISIcon name="chevron-right" size={16} color={palette.subtext} />
              </Pressable>
            </View>

            <LogoutSection palette={palette} onLogout={c.logout} loading={c.logoutLoading} />
          </>
        )}
      </ReanimatedScroll.ScrollView>

      {/* Partner slide */}
      <VerificationStaffConsole
        visible={verificationStaffConsoleVisible}
        palette={palette}
        onClose={() => setVerificationStaffConsoleVisible(false)}
      />

      {verificationCenterTarget ? (
        <VerificationCenterSheet
          visible={Boolean(verificationCenterTarget)}
          palette={palette}
          subject={verificationCenterTarget.subject}
          title={verificationCenterTarget.title}
          subtitle={verificationCenterTarget.subtitle}
          initialSummary={verificationCenterTarget.summary}
          onClose={() => setVerificationCenterTarget(null)}
        />
      ) : null}

      {/*
       * These four overlays (partner-create slide, management panel, shop
       * drawer, bottom sheet) are plain absolutely-positioned Views mounted
       * deep inside this screen's own tree — i.e. inside the main
       * navigator's subtree, which App.tsx wraps at zIndex:1, a *sibling* of
       * the GoldenSection header overlay (zIndex:5). In React Native, zIndex
       * only orders siblings within the same parent stacking context, so no
       * local zIndex/elevation on these overlays can ever out-stack
       * GoldenSection — they'd render underneath it. Hosting them inside a
       * single native Modal escapes that stacking context entirely (a
       * Modal paints in its own top-level native layer), which is how every
       * other "modal" in the app already avoids this problem. animationType
       * is "none" because each overlay drives its own translateX/translateY
       * entrance animation.
       */}
      <Modal
        transparent
        animationType="none"
        visible={Boolean(
          c.showCreatePartner || managementPanelKey || shopEditorVisible || c.activeSheet,
        )}
        onRequestClose={() => {
          if (c.activeSheet) c.closeSheet();
          else if (shopEditorVisible) closeShopEditor();
          else if (managementPanelKey) closeManagementPanel();
          else if (c.showCreatePartner) c.closeCreatePartner();
        }}
      >
        {c.showCreatePartner && (
          <Animated.View
            style={[
              styles.slideContainer,
              {
                backgroundColor: palette.bg,
                width: responsive.width,
                transform: [{ translateX: c.slideX }],
              },
            ]}
          >
            <PartnerCreateSlide onClose={c.closeCreatePartner} />
          </Animated.View>
        )}

        {managementPanelKey && (
          <Animated.View
            style={[
              styles.managementPanel,
              {
                transform: [{ translateX: managementPanelOffset }],
                backgroundColor: palette.surface,
                width: responsive.width,
              },
            ]}
          >
            <View style={styles.managementPanelHeader}>
              <View style={{ flex: 1 }}>
                <Text
                  style={[styles.managementPanelTitle, { color: palette.text }]}
                >
                  {managementPanelDefinition?.managementLabel ??
                    managementPanelDefinition?.label ??
                    'Profile console'}
                </Text>
                <Text
                  style={[
                    styles.managementPanelSubtitle,
                    { color: palette.subtext },
                  ]}
                >
                  {managementPanelDefinition?.helper}
                </Text>
              </View>
              <Pressable
                onPress={closeManagementPanel}
                style={styles.managementClose}
              >
                <KISIcon name="close" size={28} color={palette.subtext} />
              </Pressable>
            </View>
            {renderManagementPanelContent()}
          </Animated.View>
        )}

        <ShopEditorDrawer
          visible={shopEditorVisible}
          mode={shopEditorMode}
          marketForm={marketForm}
          loading={marketFormLoading}
          onChangeField={updateMarketFormField}
          onClose={closeShopEditor}
          onSave={handleMarketFormSave}
          onDelete={
            marketFormMode === 'edit' && canDeleteActiveShop
              ? handleMarketFormDelete
              : undefined
          }
          activeShop={activeShop}
          canDeleteShop={canDeleteActiveShop}
        />

        {/* Bottom Sheet host */}
        {c.activeSheet && (
          <BottomSheet sheetY={c.sheetY} onBackdropPress={c.closeSheet}>
            <SheetHeader title={sheetTitle} onClose={c.closeSheet} />

            <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
              {c.activeSheet === 'editProfile' && (
                <EditProfileModal
                  palette={palette}
                  draftProfile={c.draftProfile}
                  setDraftProfile={c.setDraftProfile}
                  pickImage={c.pickImage}
                  saving={c.saving}
                  saveProfile={c.saveProfile}
                  imageUploadStatus={c.imageUploadStatus}
                  sections={c.sectionList}
                  onAddSectionItem={type => {
                    if (type === 'portfolio' || type === 'intro_video') {
                      c.addGalleryMedia();
                      return;
                    }
                    c.openItemEditor(type);
                  }}
                  onEditSectionItem={(type, item) => c.openItemEditor(type, item)}
                  onDeleteSectionItem={(type, id) => c.deleteItem(type, id)}
                  galleryItems={editGalleryItems}
                  onAddGalleryMedia={c.addGalleryMedia}
                  addingGalleryMedia={c.addingGalleryMedia}
                  onDeleteGalleryItem={handleDeleteGalleryItem}
                  deletingGalleryItemId={deletingGalleryItemId}
                />
              )}

              {c.activeSheet === 'privacy' && (
                <PrivacyModal
                  palette={palette}
                  draftPrivacy={c.draftPrivacy}
                  setDraftPrivacy={c.setDraftPrivacy}
                  saving={c.saving}
                  savePrivacy={c.savePrivacy}
                  profile={c.profile}
                />
              )}

              {c.activeSheet === 'editItem' && c.draftItem && (
                <EditItemModal
                  palette={palette}
                  draftItem={c.draftItem}
                  setDraftItem={c.setDraftItem}
                  pickShowcaseFile={c.pickShowcaseFile}
                  saving={c.saving}
                  saveItem={c.saveItem}
                />
              )}

              {c.activeSheet === 'wallet' && (
                <WalletModal
                  palette={palette}
                  walletForm={c.walletForm}
                  setWalletForm={c.setWalletForm}
                  setWalletRecipient={c.setWalletRecipient}
                  walletRecipientVerification={c.walletRecipientVerification}
                  verifyWalletRecipient={c.verifyWalletRecipient}
                  saving={c.saving}
                  submitWalletAction={c.submitWalletAction}
                  lastWalletPaymentUrl={c.lastWalletPaymentUrl}
                />
              )}

              {c.activeSheet === 'upgrade' && (
                <UpgradeModal
                  tiers={upgradeTiers}
                  accountTier={accountTier}
                  saving={c.saving}
                  onUpgrade={c.upgradeTier}
                  subscription={
                    c.billingHistory?.subscription ?? c.profile?.subscription
                  }
                  billingHistory={c.billingHistory}
                  usage={c.billingHistory?.usage || c.profile?.stats}
                  onCancel={c.cancelSubscription}
                  onResume={c.resumeSubscription}
                  onDowngrade={c.downgradeTier}
                  onRetry={c.retryTransaction}
                />
              )}
            </ScrollView>
          </BottomSheet>
        )}
      </Modal>
      <FeedComposerSheet
        visible={advancedFeedComposerVisible}
        onClose={() => {
          setAdvancedFeedComposerVisible(false);
          setAdvancedFeedChannelContext(null);
        }}
        onSubmit={handleAdvancedFeedSubmit}
        channelContext={advancedFeedChannelContext ?? undefined}
      />
    </View>
  );
}

const billingLinksStyles = StyleSheet.create({
  section: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  linkText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
