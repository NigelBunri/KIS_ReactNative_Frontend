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
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import {
  useFocusEffect,
  useNavigation,
  useRoute,
  RouteProp,
} from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import KISButton from '@/constants/KISButton';
import Skeleton from '@/components/common/Skeleton';
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
import { deleteRequest } from '@/network/delete';
import {
  deleteInAppNotification,
  fetchInAppNotifications,
  IN_APP_NOTIFICATIONS_UPDATED_EVENT,
  markInAppNotificationAsRead,
  type InAppNotification,
} from '@/services/inAppNotificationService';
import { filterInstitutionsForVisibleRoles } from '@/screens/health/accessControl';

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
  ImpactSnapshotCard,
  LanguageSelectorCard,
  MarketplaceOrdersSummary,
  NotificationSummaryCard,
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

export default function ProfileScreen() {
  const { palette, tone } = useKISTheme();
  const dashboardTheme = useMemo(
    () => createProfileDashboardTheme(palette, tone),
    [palette, tone],
  );
  const { language, languages, setLanguage } = useLanguage();
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
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [, setDeletingNotificationId] = useState<string | null>(null);
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
    setLoadingNotifications(true);
    try {
      const list = await fetchInAppNotifications();
      setInAppNotifications(list);
    } finally {
      setLoadingNotifications(false);
    }
  }, []);

  const userId = useMemo(() => c.profile?.user?.id, [c.profile?.user?.id]);
  const loadAppointments = useCallback(async () => {
    if (!userId) return;
    setAppointmentsLoading(true);
    setAppointmentsError(null);
    try {
      const response = await getRequest(ROUTES.commerce.serviceBookings, {
        errorMessage: 'Unable to load appointments.',
        forceNetwork: true,
      });
      if (response?.success) {
        const payload = response.data ?? response ?? {};
        const records = Array.isArray(payload)
          ? payload
          : Array.isArray((payload as any).results)
          ? (payload as any).results
          : [];
        const normalizedUserId = String(userId);
        const activeRecords = records.filter((booking: any) => {
          const status = ((booking?.status ?? '') as string).toLowerCase();
          return !CANCELLED_BOOKING_STATUSES.has(status);
        });
        const payerBookings = dedupeBookingsByService(
          activeRecords.filter(
            (booking: any) => String(booking?.user) === normalizedUserId,
          ),
        );
        const providerBookings = dedupeBookingsByService(
          activeRecords.filter(
            (booking: any) =>
              String(booking?.provider_details?.id) === normalizedUserId,
          ),
        );
        setAppointments(payerBookings);
        setProviderAppointments(providerBookings);
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
  }, [userId]);

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
  const kisWalletLabel = String(c.kisWallet?.balance_label ?? '0.00 KISC');
  const kisWalletUsdLabel = String(c.kisWallet?.usd_label ?? '$0.00');
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
    const sub = DeviceEventEmitter.addListener(
      'wallet.open',
      (payload: any) => {
        const normalizedMode = String(payload?.mode || '')
          .trim()
          .toLowerCase();
        const mappedMode =
          normalizedMode === 'transfer' ? 'transfer' : 'add_kisc';
        openWalletSheet('wallet');
        setWalletForm((prev: any) => ({
          ...prev,
          mode: mappedMode,
          amount: payload?.amount ? String(payload.amount) : prev.amount,
          reference: payload?.reference
            ? String(payload.reference)
            : prev.reference,
        }));
      },
    );
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

  const handleDeleteNotification = useCallback(
    (item: InAppNotification) => {
      Alert.alert('Delete notification', 'This will remove the notification.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setDeletingNotificationId(item.id);
            deleteInAppNotification(item.id)
              .then(() => loadInAppNotifications())
              .catch((error: any) => {
                Alert.alert(
                  'Notifications',
                  error?.message || 'Unable to delete notification.',
                );
              })
              .finally(() => setDeletingNotificationId(null));
          },
        },
      ]);
    },
    [loadInAppNotifications],
  );

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

  const handleBroadcastCTA = useCallback(
    (def: (typeof BROADCAST_PROFILE_DEFINITIONS)[number]) => {
      openManagementPanel(def.profileKey);
    },
    [openManagementPanel],
  );

  const rootNavigation =
    tabsNavigation.getParent<NativeStackNavigationProp<RootStackParamList>>();

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
    } catch (error: any) {
      console.warn('Unable to load commerce shops:', error?.message ?? error);
      setCommerceShops([]);
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
  const currentLanguageLabel =
    languages.find(entry => entry.code === language)?.label ?? 'English';

  const walletDashboardActions = useMemo(
    () => [
      {
        key: 'wallet-add',
        title: 'Add Funds',
        icon: 'plus' as const,
        tone: 'primary' as const,
        onPress: () => {
          openWalletSheet('wallet');
          setWalletForm((prev: any) => ({ ...prev, mode: 'add_kisc' }));
        },
      },
      {
        key: 'wallet-transfer',
        title: 'Transfer',
        icon: 'arrow-left' as const,
        tone: 'info' as const,
        onPress: () => {
          openWalletSheet('wallet');
          setWalletForm((prev: any) => ({ ...prev, mode: 'transfer' }));
        },
      },
      {
        key: 'upgrade-account',
        title: 'Upgrade Account',
        icon: 'star' as const,
        tone: 'primary' as const,
        onPress: () => c.openSheet('upgrade'),
      },
      {
        key: 'wallet-history',
        title: 'History',
        icon: 'calendar' as const,
        tone: 'warning' as const,
        onPress: () => c.openSheet('wallet'),
      },
    ],
    [c, openWalletSheet, setWalletForm],
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
    ],
    [
      c.openCreatePartner,
      canCreatePartner,
      openManagementPanel,
      openShopEditorForCreate,
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

  const notificationDashboardItems = useMemo(
    () =>
      inAppNotifications.slice(0, 5).map(item => ({
        id: item.id,
        title: item.title,
        body: item.body,
        createdAt: item.createdAt
          ? new Date(item.createdAt).toLocaleString()
          : undefined,
        read: !!item.readAt,
        onPress: () => {
          markInAppNotificationAsRead(item.id).catch(() => undefined);
          rootNavigation?.navigate('ProfileNotificationDetail', {
            notificationId: item.id,
            notification: item,
          });
        },
      })),
    [inAppNotifications, rootNavigation],
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

  const handleMarketFormSave = useCallback(async () => {
    const name = marketForm.name.trim();
    if (!name) {
      Alert.alert('Market profile', 'Provide a shop name.');
      return;
    }
    const employeeSlotCount = Math.max(
      1,
      Number.parseInt(marketForm.employeeSlots, 10) || 1,
    );
    if (!marketForm.id && !marketForm.featuredImageFile) {
      Alert.alert('Market profile', 'Upload a shop image before publishing.');
      return;
    }
    const formData = new FormData();
    formData.append('name', name);
    formData.append('description', marketForm.description.trim());
    formData.append('employee_slots', String(employeeSlotCount));
    formData.append('status', marketForm.status);
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
        throw new Error(response?.message || 'Unable to save shop.');
      }
      await loadCommerceShops();
      Alert.alert(
        'Market profile',
        marketForm.id ? 'Shop updated.' : 'Shop created.',
      );
      resetMarketForm();
      closeShopEditor();
    } catch (error: any) {
      Alert.alert('Market profile', error?.message || 'Unable to save shop.');
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

  return (
    <View style={[styles.wrap, { backgroundColor: palette.bg }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            gap: 18,
            paddingBottom: 44,
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
          <View style={[styles.card, { backgroundColor: palette.card }]}>
            <Text style={[styles.title, { color: palette.text }]}>
              Profile not available
            </Text>
            <Text
              style={[styles.subtext, { color: palette.subtext, marginTop: 6 }]}
            >
              Pull to refresh or try again.
            </Text>
            <View style={{ marginTop: 12 }}>
              <KISButton title="Retry" onPress={c.loadProfile} />
            </View>
          </View>
        ) : (
          <>
            <ProfileHeroCard
              coverUrl={c.profile.profile?.cover_url}
              avatarUrl={c.profile.profile?.avatar_url}
              displayName={profileDisplayName}
              handle={profileHandle}
              headline={
                c.profile.profile?.headline || 'Add a headline that sells you'
              }
              tierLabel={tierLabel || accountTier?.name || 'Free'}
              completionLabel={`${profileCompletion}% complete`}
              onEdit={c.openEditProfile}
              onNotificationsPress={() =>
                rootNavigation?.navigate('ProfileNotifications')
              }
              onSettingsPress={() => c.openSheet('privacy')}
              notificationCount={unreadNotifications.length}
            />
            <View style={{ top: -82, paddingHorizontal: 18, gap: 12 }}>
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: dashboardTheme.isDark
                      ? 'rgba(13, 20, 36, 0.94)'
                      : 'rgba(255,255,255,0.98)',
                    borderColor: dashboardTheme.isDark
                      ? 'rgba(255,255,255,0.08)'
                      : 'rgba(230,222,247,0.95)',
                    borderWidth: 1,
                    borderRadius: 24,
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
                <View style={styles.headerRow}>
                  <Text style={[styles.title, { color: palette.text }]}>
                    Profile overview
                  </Text>
                  <Text style={[styles.subtext, { color: palette.subtext }]}>
                    {c.profile.profile?.industry || 'Industry not set'}
                  </Text>
                </View>
                <Text
                  style={{ fontSize: 14, lineHeight: 21, color: palette.text }}
                >
                  {c.profile.profile?.bio ||
                    'Add a short bio that explains your work.'}
                </Text>
                <View style={[styles.actionRow, { gap: 10, flexWrap: 'wrap' }]}>
                  <KISButton
                    title="Complete Profile"
                    onPress={c.openEditProfile}
                  />
                  <KISButton
                    title="Privacy"
                    variant="outline"
                    onPress={() => c.openSheet('privacy')}
                  />
                </View>
              </View>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
                <View style={{ flex: 1, minWidth: 280 }}>
                  <WalletSummaryCard
                    balanceLabel={kisWalletLabel}
                    usdLabel={kisWalletUsdLabel}
                    tierLabel={`${
                      tierLabel || accountTier?.name || 'Free'
                    } • ${points} pts`}
                    actions={walletDashboardActions}
                    onViewAll={() => c.openSheet('wallet')}
                  />
                </View>
                <View style={{ flex: 1, minWidth: 280 }}>
                  <QuickActionGrid
                    title="Quick actions"
                    items={quickActionItems}
                  />
                </View>
              </View>

              <RecentActivityTimeline
                items={recentActivityItems}
                onViewAll={() =>
                  rootNavigation?.navigate('ProfileRecentActivity')
                }
              />

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
                <View style={{ flex: 1, minWidth: 280 }}>
                  <ImpactSnapshotCard
                    periodLabel="This month"
                    stats={impactSnapshotStats}
                    onViewAll={() =>
                      rootNavigation?.navigate('ProfileImpactSnapshot')
                    }
                  />
                </View>
                <View style={{ flex: 1, minWidth: 280 }}>
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
                  style={{ color: palette.error || '#E53935', marginTop: -4 }}
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
                  style={{ color: palette.error || '#E53935', marginTop: -4 }}
                >
                  {marketplaceOrdersError}
                </Text>
              ) : null}

              <NotificationSummaryCard
                unreadCount={unreadNotifications.length}
                items={notificationDashboardItems}
                onViewAll={() =>
                  rootNavigation?.navigate('ProfileNotifications')
                }
                onDeleteItem={id => {
                  const target = inAppNotifications.find(
                    item => item.id === id,
                  );
                  if (target) handleDeleteNotification(target);
                }}
              />
              {loadingNotifications ? (
                <Text style={{ color: palette.subtext, marginTop: -4 }}>
                  Loading notifications...
                </Text>
              ) : null}

              <WorkspaceLauncherSection items={workspaceLaunchers} />

              <LanguageSelectorCard
                currentLabel={currentLanguageLabel}
                languages={languages}
                currentCode={language}
                onSelect={code => {
                  setLanguage(code as any).catch(() => undefined);
                }}
              />
            </View>

            <LogoutSection palette={palette} onLogout={c.logout} />
          </>
        )}
      </ScrollView>

      {/* Partner slide */}
      {c.showCreatePartner && (
        <Animated.View
          style={[
            styles.slideContainer,
            {
              backgroundColor: palette.bg,
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
    </View>
  );
}
