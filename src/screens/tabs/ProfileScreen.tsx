// src/screens/tabs/profile/ProfileScreen.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  DeviceEventEmitter,
  Image,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
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

import HeroHeader from './profile/components/HeroHeader';
import AccountCreditsCard from './profile/components/AccountCreditsCard';

import BottomSheet from './profile/sheets/BottomSheet';
import SheetHeader from './profile/sheets/SheetHeader';
import {
  BroadcastProfilesSection,
  ImpactSnapshotSection,
  PartnerProfilesSection,
  LogoutSection,
} from '@/screens/tabs/profile-screen-sections';
import type {
  BroadcastProfileKey,
  MainTabsParamList,
  RootStackParamList,
} from '@/navigation/types';

const ESCROW_PENDING_STATUSES = new Set(['pending', 'awaiting_satisfaction', 'dispute']);
const CANCELLED_BOOKING_STATUSES = new Set(['cancelled', 'canceled', 'rejected', 'void']);

const getBookingServiceId = (booking: any) => {
  if (!booking) return null;
  return (
    booking?.service_details?.id ||
    (booking?.service_id ? String(booking.service_id) : null) ||
    (booking?.service && typeof booking.service.id === 'string' ? booking.service.id : null) ||
    (booking?.service ? String(booking.service) : null) ||
    null
  );
};

const dedupeBookingsByService = (bookings: any[]) => {
  const seen = new Map<string, any>();
  bookings.forEach((booking) => {
    if (!booking) return;
    const fallbackId = booking?.id ?? booking?.booking_id ?? booking?.reference ?? '';
    const serviceId = getBookingServiceId(booking) || (fallbackId ? String(fallbackId) : '');
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
  const { palette } = useKISTheme();
  const { setAuth, setPhone, callingCode } = useAuth();
  const c = useProfileController({ setAuth, setPhone, locationCallingCode: callingCode });
  const tabsNavigation = useNavigation<BottomTabNavigationProp<MainTabsParamList, 'Profile'>>();
  const route = useRoute<RouteProp<MainTabsParamList, 'Profile'>>();
  const broadcastProfiles = c.broadcastProfiles;
  const requestedBroadcastProfileKey = route.params?.broadcastProfileKey ?? null;
  const [managementPanelKey, setManagementPanelKey] = useState<BroadcastProfileKey | null>(null);
  const [panelFeedItemTitle, setPanelFeedItemTitle] = useState('');
  const [panelFeedItemSummary, setPanelFeedItemSummary] = useState('');
  const [panelFeedMediaType, setPanelFeedMediaType] = useState<FeedMediaType>('video');
  const [panelFeedMediaOptions, setPanelFeedMediaOptions] = useState<FeedMediaOptions>(
    () => buildDefaultFeedMediaOptions(),
  );
  const [panelFeedAssets, setPanelFeedAssets] = useState<Asset[]>([]);
  const [panelFeedExistingAttachments, setPanelFeedExistingAttachments] = useState<any[]>([]);
  const [panelFeedAdding, setPanelFeedAdding] = useState(false);
  const [panelAttachmentUploading, setPanelAttachmentUploading] = useState(false);
  const [editingFeedItemId, setEditingFeedItemId] = useState<string | null>(null);
  const [panelFeedDeletingId, setPanelFeedDeletingId] = useState<string | null>(null);
  const [panelFeedBroadcastingId, setPanelFeedBroadcastingId] = useState<string | null>(null);
  const managementPanelOffset = useRef(new Animated.Value(profileLayout.SCREEN_WIDTH)).current;
  const [marketForm, setMarketForm] = useState<MarketFormState>(DEFAULT_MARKET_FORM);
  const [marketFormMode, setMarketFormMode] = useState<'add' | 'edit'>('add');
  const [marketFormLoading, setMarketFormLoading] = useState(false);
  const [shopEditorVisible, setShopEditorVisible] = useState(false);
  const [shopEditorMode, setShopEditorMode] = useState<'create' | 'edit'>('create');
  const [activeShop, setActiveShop] = useState<any | null>(null);
  const [commerceShops, setCommerceShops] = useState<any[]>([]);
  const [commerceShopsLoading, setCommerceShopsLoading] = useState(false);
  const currentUserId = useMemo(() => {
    const userId = c.profile?.user?.id;
    return userId ? String(userId) : null;
  }, [c.profile?.user?.id]);
  const activeShopOwnerId = useMemo(() => {
    const ownerId = activeShop?.owner;
    return ownerId ? String(ownerId) : null;
  }, [activeShop?.owner]);
  const canDeleteActiveShop = useMemo(() => {
    return Boolean(activeShopOwnerId && currentUserId && activeShopOwnerId === currentUserId);
  }, [activeShopOwnerId, currentUserId]);
  const updateMarketFormField = useCallback(
    (changes: Partial<MarketFormState>) => {
      setMarketForm((prev) => ({ ...prev, ...changes }));
    },
    [],
  );
  const [educationForm, setEducationForm] = useState<EducationFormState>({
    title: '',
    summary: '',
  });
  const [educationFormMode, setEducationFormMode] = useState<'add' | 'edit'>('add');
  const [educationFormLoading, setEducationFormLoading] = useState(false);
  const [educationModuleForm, setEducationModuleForm] = useState({
    title: '',
    summary: '',
    resource_url: '',
  });
  const [educationModuleSubmitting, setEducationModuleSubmitting] = useState(false);
  const [educationLessonsData, setEducationLessonsData] = useState<any[]>([]);
  const [educationAnalyticsLoading, setEducationAnalyticsLoading] = useState(false);
  const [educationAnalyticsError, setEducationAnalyticsError] = useState<string | null>(null);
  const [inAppNotifications, setInAppNotifications] = useState<InAppNotification[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [deletingNotificationId, setDeletingNotificationId] = useState<string | null>(null);
  const [deletingGalleryItemId, setDeletingGalleryItemId] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [providerAppointments, setProviderAppointments] = useState<any[]>([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);

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
          const activeRecords = records.filter((booking) => {
            const status = ((booking?.status ?? '') as string).toLowerCase();
            return !CANCELLED_BOOKING_STATUSES.has(status);
          });
          const payerBookings = dedupeBookingsByService(
            activeRecords.filter((booking) => String(booking?.user) === normalizedUserId),
          );
          const providerBookings = dedupeBookingsByService(
            activeRecords.filter((booking) => String(booking?.provider_details?.id) === normalizedUserId),
          );
          setAppointments(payerBookings);
          setProviderAppointments(providerBookings);
        }
    } catch (error) {
      console.error('Failed to load appointments', error);
    } finally {
      setAppointmentsLoading(false);
    }
  }, [userId]);

  const openRemoteLink = useCallback((url: string) => {
    if (!url) return;
    Linking.openURL(url).catch(() => {
      Alert.alert('Meeting link', 'Unable to open the meeting link.');
    });
  }, []);

  const pendingServicePayments = useMemo(
    () => appointments.filter((booking) => ESCROW_PENDING_STATUSES.has(booking?.escrow_status)),
    [appointments],
  );
  const pendingReceivePayments = useMemo(
    () => providerAppointments.filter((booking) => ESCROW_PENDING_STATUSES.has(booking?.escrow_status)),
    [providerAppointments],
  );

  const detectMediaTypeFromAsset = useCallback((asset?: Asset | null): FeedMediaType => {
    if (!asset?.type) return 'file';
    const mime = asset.type.toLowerCase();
    if (mime.startsWith('video/')) return 'video';
    if (mime.startsWith('audio/')) return 'audio';
    if (mime.startsWith('image/')) return 'image';
    return 'file';
  }, []);

  const handlePickFeedMedia = useCallback(async () => {
    const result = await launchImageLibrary({
      mediaType: 'mixed',
      selectionLimit: 5,
      quality: 0.9,
    });
    if (result.didCancel || !result.assets?.length) return;
    const assets = result.assets.filter((asset) => asset?.uri) as Asset[];
    if (!assets.length) return;
    setPanelFeedAssets((prev) => [...prev, ...assets]);
    setPanelFeedMediaType(detectMediaTypeFromAsset(assets[0]));
  }, [detectMediaTypeFromAsset]);

  const removeTemporaryFeedAsset = useCallback((index: number) => {
    setPanelFeedAssets((prev) => prev.filter((_, idx) => idx !== index));
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
      const attachment = await c.uploadProfileAttachment(asset, managementPanelKey);
      if (!attachment) {
        throw new Error('Unable to upload attachment.');
      }
      if (managementPanelKey === 'broadcast_feed') return;
      const profileType = PROFILE_MANAGEMENT_TYPE[managementPanelKey];
      await c.manageProfileSection(profileType, { attachments: [attachment] });
      Alert.alert('Attachment uploaded', 'It has been added to the profile.');
    } catch (error: any) {
      Alert.alert('Attachment', error?.message || 'Unable to upload attachment.');
    } finally {
      setPanelAttachmentUploading(false);
    }
  }, [managementPanelKey, c]);

  console.log("Kis wallet check from c: ", c)

  const accountTier = c.profile?.account?.tier;
  const points = c.profile?.account?.points ?? 0;
  const kisWalletMicro = Number(c.kisWallet?.balance_micro ?? 0);
  const kisWalletKisc = String(c.kisWallet?.balance_kisc ?? '0.000');
  const kisWalletUsd = String(c.kisWallet?.balance_usd ?? '0.00');
  const currentTier = accountTier || c.profile?.tier || c.profile?.subscription?.tier;
  const tierLabel =
    currentTier?.name ??
    currentTier?.label ??
    currentTier?.tier_label ??
    currentTier?.tierName ??
    null;
  const partnerProfiles = c.profile?.partner_profiles || [];
  const partnerProfilesCount = c.profile?.partner_profiles_count ?? 0;
  const partnerProfilesLimitLabel = c.profile?.partner_profiles_limit_label;
  const partnerProfilesLimitValue = c.profile?.partner_profiles_limit_value ?? 0;
  const partnerProfilesIsUnlimited = !!c.profile?.partner_profiles_is_unlimited;
  const canCreatePartner = !!c.profile?.partner_profiles_can_create;
  const showCreatePartnerButton = canCreatePartner;
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

    pushItem('cover_preview', c.profile?.profile?.cover_url, 'Cover image', 'Cover');
    pushItem('avatar_preview', c.profile?.profile?.avatar_url, 'Profile image', 'Avatar');

    const showcases = c.profile?.sections?.showcases || {};
    const orderedTypes = ['portfolio', 'case_study', 'testimonial', 'certification', 'intro_video', 'highlight'];
    orderedTypes.forEach((typeKey) => {
      const rows = Array.isArray((showcases as any)?.[typeKey]) ? (showcases as any)[typeKey] : [];
      rows.forEach((row: any, index: number) => {
        const rowId = String(row?.id || `${typeKey}_${index}`);
        const uri = row?.file_url || row?.file || row?.cover_url || row?.payload?.url;
        const title = String(
          row?.title ||
            row?.name ||
            row?.summary ||
            typeKey.replace(/_/g, ' '),
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
  }, [c.profile?.profile?.avatar_url, c.profile?.profile?.cover_url, c.profile?.sections?.showcases]);

  const handleDeleteGalleryItem = useCallback(async (item: any) => {
    const itemType = item?.itemType;
    const itemId = String(item?.itemId || '').trim();
    if (!itemType || !itemId) return;
    setDeletingGalleryItemId(itemId);
    try {
      await c.deleteItem(itemType, itemId);
    } finally {
      setDeletingGalleryItemId(null);
    }
  }, [c]);

  const handleDeleteWalletEntry = useCallback((entryId: string) => {
    const id = String(entryId || '').trim();
    if (!id) return;
    Alert.alert(
      'Delete transaction history',
      'This removes the transaction from your history list.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            c.deleteWalletLedgerEntry(id).catch((error: any) => {
              Alert.alert('Wallet', error?.message || 'Unable to delete transaction history.');
            });
          },
        },
      ],
    );
  }, [c]);

  const sheetTitle = useMemo(() => getSheetTitle(c.activeSheet), [c.activeSheet]);

  const openWalletSheet = c.openSheet;
  const setWalletForm = c.setWalletForm;

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('wallet.open', (payload: any) => {
      const rawMode = String(payload?.mode || '').trim().toLowerCase();
      const mappedMode =
        rawMode === 'deposit' || rawMode === 'cash_to_credits' ? 'add_kisc'
        : rawMode === 'credits_to_cash' || rawMode === 'points_to_credits' ? 'spend_kisc'
        : rawMode === 'transfer' ? 'transfer'
        : 'add_kisc';
      openWalletSheet('wallet');
      setWalletForm((prev: any) => ({
        ...prev,
        mode: mappedMode,
        amount: payload?.amount ? String(payload.amount) : prev.amount,
        reference: payload?.reference ? String(payload.reference) : prev.reference,
      }));
    });
    return () => sub.remove();
  }, [openWalletSheet, setWalletForm]);

  useEffect(() => {
    loadInAppNotifications().catch(() => undefined);
    const sub = DeviceEventEmitter.addListener(IN_APP_NOTIFICATIONS_UPDATED_EVENT, () => {
      loadInAppNotifications().catch(() => undefined);
    });
    return () => sub.remove();
  }, [loadInAppNotifications]);

  const handleDeleteNotification = useCallback((item: InAppNotification) => {
    Alert.alert(
      'Delete notification',
      'This will remove the notification.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setDeletingNotificationId(item.id);
            deleteInAppNotification(item.id)
              .then(() => loadInAppNotifications())
              .catch((error: any) => {
                Alert.alert('Notifications', error?.message || 'Unable to delete notification.');
              })
              .finally(() => setDeletingNotificationId(null));
          },
        },
      ],
    );
  }, [loadInAppNotifications]);

  const openManagementPanel = useCallback((key: BroadcastProfileKey) => {
    setManagementPanelKey(key);
    Animated.timing(managementPanelOffset, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [managementPanelOffset]);

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
    (type: FeedMediaType, updates: Partial<FeedMediaOptions[FeedMediaType]>) => {
      setPanelFeedMediaOptions((prev) => ({
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
      .filter((asset) => asset?.uri)
      .map((asset) => ({
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
      Alert.alert('Broadcast item', error?.message || 'Unable to save this item.');
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

  const handleEditFeedItem = useCallback(
    (item: any) => {
      setEditingFeedItemId(item.id);
      setPanelFeedItemTitle(item.title || '');
      setPanelFeedItemSummary(item.summary || '');
      const entryType = (item.media_type as FeedMediaType) || 'text';
      setPanelFeedMediaType(entryType);
      const attachments =
        (Array.isArray(item.attachments) ? item.attachments : []).filter(Boolean);
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
    },
    [],
  );

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
        Alert.alert('Delete item', error?.message || 'Unable to delete the item.');
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
        Alert.alert('Broadcast', error?.message || 'Unable to broadcast the item.');
      } finally {
        setPanelFeedBroadcastingId((prev) => (prev === feed.id ? null : prev));
      }
    },
    [c],
  );

  const handleBroadcastCTA = (def: (typeof BROADCAST_PROFILE_DEFINITIONS)[number]) => {
    openManagementPanel(def.profileKey);
  };

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
  }, [tabsNavigation, managementPanelKey, openManagementPanel, requestedBroadcastProfileKey]);

  const openMarketLandingBuilder = useCallback(
    (shop?: any) => {
      rootNavigation?.navigate('ProfileLandingEditor', {
        kind: 'market',
        profileLabel: shop?.name ? `${shop.name} landing page` : 'Market Profile',
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

  const openEducationLandingBuilder = useCallback(() => {
    rootNavigation?.navigate('ProfileLandingEditor', {
      kind: 'education',
      profileLabel: 'Education Profile',
    });
  }, [rootNavigation]);

  const openPartnerLandingBuilder = useCallback((partnerId: string, partnerName?: string | null) => {
    if (!partnerId) return;
    rootNavigation?.navigate('ProfileLandingEditor', {
      kind: 'partner',
      partnerId,
      profileLabel: partnerName || 'Partner Profile',
    });
  }, [rootNavigation]);

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

  const managementPanelData = managementPanelKey ? broadcastProfiles?.[managementPanelKey] : null;
  const managementPanelDefinition =
    managementPanelKey &&
    BROADCAST_PROFILE_DEFINITIONS.find((def) => def.profileKey === managementPanelKey);

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

  const manageableRoles = useMemo(() => new Set(['owner', 'manager', 'admin']), []);

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
            console.warn('Unable to load commerce shops:', fallbackResponse.message);
          }
        }
      } else if (!response?.success && response?.message) {
        console.warn('Unable to load commerce shops:', response.message);
      }
      if (shops.length) {
        console.log('[ProfileScreen] loaded shop example', shops[0]?.featuredImage ?? shops[0]?.image_url ?? 'no image');
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
    setEducationForm((prev) => ({ ...prev, title: value }));
  }, []);

  const handleEducationFormSummaryChange = useCallback((value: string) => {
    setEducationForm((prev) => ({ ...prev, summary: value }));
  }, []);

  const handleEducationModuleTitleChange = useCallback((value: string) => {
    setEducationModuleForm((prev) => ({ ...prev, title: value }));
  }, []);

  const handleEducationModuleSummaryChange = useCallback((value: string) => {
    setEducationModuleForm((prev) => ({ ...prev, summary: value }));
  }, []);

  const handleEducationModuleResourceChange = useCallback((value: string) => {
    setEducationModuleForm((prev) => ({ ...prev, resource_url: value }));
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

  const attachmentKey = useCallback((attachment: any) => {
    return (
      attachment?.key ??
      attachment?.file_key ??
      attachment?.id ??
      attachment?.name ??
      resolveAttachmentUrl(attachment) ??
      null
    );
  }, [resolveAttachmentUrl]);

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
          const retainAttachments = attachments.filter((att) => attachmentKey(att) !== targetKey);
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
            Alert.alert('Attachment', innerError?.message || 'Unable to remove attachment.');
          }
        } else {
          Alert.alert('Attachment', message);
        }
      } finally {
        if (editingFeedItemId === feed.id) {
          setPanelFeedExistingAttachments((prev) => prev.filter((att) => attachmentKey(att) !== targetKey));
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
      setEducationAnalyticsError(error?.message || 'Unable to load lesson insights.');
    } finally {
      setEducationAnalyticsLoading(false);
    }
  }, [unwrapList]);

  useEffect(() => {
    if (managementPanelKey === 'education') {
      void loadEducationAnalytics();
    }
  }, [managementPanelKey, loadEducationAnalytics]);

  const upcomingLessons = useMemo(() => {
    const now = Date.now();
    return educationLessonsData
      .filter((lesson) => {
        if (!lesson?.starts_at) return false;
        const startsAt = new Date(lesson.starts_at).getTime();
        return !Number.isNaN(startsAt) && startsAt >= now;
      })
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
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
    const employeeSlotCount = Math.max(1, Number.parseInt(marketForm.employeeSlots, 10) || 1);
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
      const endpoint = marketForm.id ? `${ROUTES.commerce.shops}${marketForm.id}/` : ROUTES.commerce.shops;
      const response = marketForm.id
        ? await patchRequest(endpoint, formData, { errorMessage: 'Unable to update shop.' })
        : await postRequest(endpoint, formData, { errorMessage: 'Unable to create shop.' });
      if (!response?.success) {
        throw new Error(response?.message || 'Unable to save shop.');
      }
      await loadCommerceShops();
      Alert.alert('Market profile', marketForm.id ? 'Shop updated.' : 'Shop created.');
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
      Alert.alert('Market profile', 'Only the shop owner can delete this shop.');
      return;
    }
    setMarketFormLoading(true);
    try {
      const res = await deleteRequest(`${ROUTES.commerce.shops}${marketForm.id}/`, {
        errorMessage: 'Unable to delete shop.',
      });
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
  }, [marketForm.id, resetMarketForm, closeShopEditor, loadCommerceShops, canDeleteActiveShop]);

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
            course.id === educationForm.id ? { ...course, title, summary: educationForm.summary.trim() } : course,
          )
        : [...courses, { title, summary: educationForm.summary.trim() }];

    setEducationFormLoading(true);
    try {
      await c.manageProfileSection('education_profile', { courses: nextCourses });
      resetEducationForm();
    } catch (error: any) {
      Alert.alert('Education profile', error?.message || 'Unable to update courses.');
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
    const nextCourses = courses.filter((course: any) => course.id !== educationForm.id);
    setEducationFormLoading(true);
    try {
      await c.manageProfileSection('education_profile', { courses: nextCourses });
      resetEducationForm();
    } catch (error: any) {
      Alert.alert('Education profile', error?.message || 'Unable to delete course.');
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
      const feeds: any[] = Array.isArray(managementPanelData?.feeds) ? managementPanelData.feeds : [];
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
      const institutionsRaw: any[] = Array.isArray(managementPanelData?.institutions)
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
      const courses: any[] = Array.isArray(managementPanelData?.courses) ? managementPanelData.courses : [];
      const modules: any[] = Array.isArray(managementPanelData?.modules) ? managementPanelData.modules : [];
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
        <Text style={[styles.managementPanelTitle, { color: palette.text }]}>{panelTitle}</Text>
        <Text style={[styles.managementPanelSubtitle, { color: palette.subtext }]}>{panelHint}</Text>
        <Text style={{ color: palette.subtext, marginTop: 8 }}>Profile not created yet.</Text>
      </View>
    );
  };

  return (
    <View style={[styles.wrap, { backgroundColor: palette.bg }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
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
            <Text style={[styles.title, { color: palette.text }]}>Profile not available</Text>
            <Text style={[styles.subtext, { color: palette.subtext, marginTop: 6 }]}>
              Pull to refresh or try again.
            </Text>
            <View style={{ marginTop: 12 }}>
              <KISButton title="Retry" onPress={c.loadProfile} />
            </View>
          </View>
        ) : (
          <>
            {/* HERO (matches mock) */}
            <HeroHeader
              coverUrl={c.profile.profile?.cover_url}
              avatarUrl={c.profile.profile?.avatar_url}
              displayName={c.profile.user?.display_name || 'Your name'}
              handle={`@${(c.profile.user?.display_name || 'user')
                .toLowerCase()
                .replace(/\s+/g, '')}`}
              headline={c.profile.profile?.headline || 'Add a headline that sells you'}
              tierName={accountTier?.name || 'Free'}
              completion={c.profile.profile?.completion_score ?? 0}
              onEdit={c.openEditProfile}
            />

            {/* OVERVIEW */}
            <View style={[styles.card, { backgroundColor: palette.card }]}>
              <View style={styles.headerRow}>
                <Text style={[styles.title, { color: palette.text }]}>Profile Overview</Text>
                <Text style={[styles.subtext, { color: palette.subtext }]}>
                  {c.profile.profile?.industry || 'Industry not set'}
                </Text>
              </View>

              <Text style={{ fontSize: 14, lineHeight: 20, color: palette.text }}>
                {c.profile.profile?.bio || 'Add a short bio that explains your work.'}
              </Text>

              <View style={styles.actionRow}>
                <KISButton title="Edit Profile" onPress={c.openEditProfile} />
                <KISButton
                  title="Privacy"
                  variant="outline"
                  onPress={() => c.openSheet('privacy')}
                />
              </View>
            </View>

            {/* ACCOUNT / WALLET / UPGRADE */}
            <AccountCreditsCard
              tierName={accountTier?.name || 'Free'}
              tierPriceCents={accountTier?.price_cents || 0}
              kisBalanceMicro={kisWalletMicro}
              kisBalanceKisc={kisWalletKisc}
              kisBalanceUsd={kisWalletUsd}
              points={points}
              onWallet={() => c.openSheet('wallet')}
              onUpgrade={() => c.openSheet('upgrade')}
              showCreatePartnerButton={showCreatePartnerButton}
              onCreatePartner={c.openCreatePartner}
              walletLedger={c.walletLedger}
              onDeleteWalletEntry={handleDeleteWalletEntry}
              deletingWalletEntryId={c.deletingWalletEntryId}
              partnerProfilesCount={partnerProfilesCount}
              partnerProfilesLimitLabel={partnerProfilesLimitLabel}
              partnerProfilesLimitValue={partnerProfilesLimitValue}
              partnerProfilesIsUnlimited={partnerProfilesIsUnlimited}
              pendingServicePayments={pendingServicePayments}
              pendingReceivePayments={pendingReceivePayments}
              onOpenBookingDetails={openBookingDetails}
            />

            <View
              style={[
                styles.card,
                {
                  borderColor: palette.divider,
                  backgroundColor: palette.surface,
                  borderWidth: 1,
                  marginTop: 12,
                  gap: 10,
                },
              ]}
            >
              <Text style={[styles.title, { color: palette.text }]}>Appointments</Text>
              <Text style={[styles.subtext, { color: palette.subtext }]}>
                Your booked services appear here with confirmed meeting details once payment settles.
              </Text>
              <View style={{ gap: 10 }}>
                {appointmentsLoading ? (
                  <Text style={{ color: palette.subtext }}>Loading appointments...</Text>
                ) : appointments.length ? (
                  appointments.map((booking) => {
                    const scheduledAt = new Date(booking.scheduled_at);
                    const formattedDate = scheduledAt.toLocaleString(undefined, {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    });
                    const paymentStatus = booking.deposit_cents && booking.status === 'confirmed' ? 'Paid' : 'Pending';
                    const remoteAvailable = Boolean(
                      booking.remote_meeting_link && booking.status === 'confirmed',
                    );
                    return (
                      <View
                        key={booking.id}
                        style={{
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: palette.divider,
                          padding: 12,
                          backgroundColor: palette.card,
                        }}
                      >
                        <Text style={{ color: palette.text, fontWeight: '600' }}>
                          {booking.service_name || 'Service appointment'}
                        </Text>
                        <Text style={{ color: palette.subtext, fontSize: 12 }}>
                          {booking.shop_name || 'Provider'} • {formattedDate}
                        </Text>
                        <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 4 }}>
                          Status: {booking.status || 'pending'} • Payment: {paymentStatus} •{' '}
                          {remoteAvailable ? 'Remote' : 'In-person'}
                        </Text>
                        {remoteAvailable && (
                          <Pressable
                            onPress={() => openRemoteLink(booking.remote_meeting_link)}
                            style={{ marginTop: 8 }}
                          >
                            <Text style={{ color: palette.primaryStrong, fontSize: 12, marginBottom: 4 }}>
                              Meeting link (paid)
                            </Text>
                            <Text style={{ color: palette.text, fontSize: 11, opacity: 0.8 }}>
                              {booking.remote_meeting_link}
                            </Text>
                          </Pressable>
                        )}
                        <View style={{ marginTop: 10, flexDirection: 'row' }}>
                          <KISButton
                            title="Details"
                            size="xs"
                            variant="outline"
                            onPress={() => openBookingDetails(String(booking.id))}
                          />
                        </View>
                      </View>
                    );
                  })
                ) : (
                  <Text style={{ color: palette.subtext }}>No appointments booked yet.</Text>
                )}
              </View>
            </View>

            <View
              style={[
                styles.card,
                {
                  borderColor: palette.divider,
                  backgroundColor: palette.surface,
                  borderWidth: 1,
                  marginTop: 12,
                },
              ]}
            >
              <Text style={[styles.title, { color: palette.text }]}>In-app notifications</Text>
              <Text style={[styles.subtext, { color: palette.subtext, marginTop: 4 }]}>
                Appointment and schedule reminders appear here.
              </Text>
              <View style={{ marginTop: 10, gap: 8 }}>
                {loadingNotifications ? (
                  <Text style={{ color: palette.subtext }}>Loading notifications...</Text>
                ) : inAppNotifications.length ? (
                  inAppNotifications.slice(0, 10).map((item) => {
                    const isRead = !!item.readAt;
                    return (
                      <View
                        key={item.id}
                        style={{
                          borderWidth: 1,
                          borderColor: isRead ? palette.divider : palette.primary,
                          borderRadius: 12,
                          padding: 10,
                          backgroundColor: isRead ? palette.card : `${palette.primary}14`,
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                          <Pressable
                            style={{ flex: 1 }}
                            onPress={() => {
                              markInAppNotificationAsRead(item.id).catch(() => undefined);
                            }}
                          >
                            <Text style={{ color: palette.text, fontWeight: isRead ? '600' : '800' }}>
                              {item.title}
                            </Text>
                          </Pressable>
                          <Pressable
                            onPress={() => handleDeleteNotification(item)}
                            disabled={deletingNotificationId === item.id}
                            hitSlop={8}
                          >
                            <KISIcon
                              name="trash"
                              size={16}
                              color={deletingNotificationId === item.id ? palette.subtext : palette.text}
                            />
                          </Pressable>
                        </View>
                        <Text style={{ color: palette.subtext, marginTop: 2 }}>{item.body}</Text>
                        <Text style={{ color: palette.subtext, marginTop: 4, fontSize: 11 }}>
                          {new Date(item.createdAt).toLocaleString()}
                        </Text>
                      </View>
                    );
                  })
                ) : (
                  <Text style={{ color: palette.subtext }}>No in-app notifications yet.</Text>
                )}
              </View>
            </View>

            <BroadcastProfilesSection
              palette={palette}
              broadcastProfiles={broadcastProfiles}
              definitions={BROADCAST_PROFILE_DEFINITIONS}
              onProfileAction={handleBroadcastCTA}
            />

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

            <ImpactSnapshotSection
              palette={palette}
              stats={[
                { label: 'Articles', value: c.profile.sections?.articles?.length || 0 },
                { label: 'Projects', value: c.profile.sections?.projects?.length || 0 },
                {
                  label: 'Testimonials',
                  value: c.profile.sections?.showcases?.testimonial?.length || 0,
                },
                { label: 'Activity', value: c.profile.sections?.activity?.length || 0 },
              ]}
            />

            <LogoutSection palette={palette} onLogout={c.logout} />
          </>
        )}
      </ScrollView>

      {/* Partner slide */}
      {c.showCreatePartner && (
        <Animated.View
          style={[
            styles.slideContainer,
            { backgroundColor: palette.bg, transform: [{ translateX: c.slideX }] },
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
            <Text style={[styles.managementPanelTitle, { color: palette.text }]}> 
              {managementPanelDefinition?.label ?? 'Profile console'}
            </Text>
            <Text style={[styles.managementPanelSubtitle, { color: palette.subtext }]}> 
              {managementPanelDefinition?.helper}
            </Text>
          </View>
          <Pressable onPress={closeManagementPanel} style={styles.managementClose}>
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
        onDelete={marketFormMode === 'edit' && canDeleteActiveShop ? handleMarketFormDelete : undefined}
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
                onAddSectionItem={(type) => {
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
                tiers={c.profile?.tiers || []}
                accountTier={accountTier}
                saving={c.saving}
                onUpgrade={c.upgradeTier}
                subscription={c.billingHistory?.subscription ?? c.profile?.subscription}
                billingHistory={c.billingHistory}
                usage={c.billingHistory?.usage || c.profile?.stats}
                onCancel={c.cancelSubscription}
                onResume={c.resumeSubscription}
                onDowngrade={c.downgradeTier}
                onRetry={c.retryTransaction}
                onDeleteTransaction={c.deleteBillingTransaction}
                deletingTransactionId={c.deletingBillingTransactionId}
              />
            )}
          </ScrollView>
        </BottomSheet>
      )}
    </View>
  );
}
