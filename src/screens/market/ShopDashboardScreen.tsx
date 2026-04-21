import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  DeviceEventEmitter,
  Image,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useKISTheme } from '@/theme/useTheme';
import KISButton from '@/constants/KISButton';
import { LineChart, BarChart, DonutChart, TopItemsList } from '@/components/insights';
import type { RootStackParamList } from '@/navigation/types';
import ProductEditorDrawer from './ProductEditorDrawer';
import ServiceEditorDrawer from './ServiceEditorDrawer';
import { getRequest } from '@/network/get';
import { patchRequest } from '@/network/patch';
import { postRequest } from '@/network/post';
import { deleteRequest } from '@/network/delete';
import ROUTES from '@/network';
import { CATEGORY_SELECTION_LIMIT, KIS_COIN_CODE } from '@/screens/market/market.constants';
import type { KISPalette } from '@/theme/constants';
import { KISIcon } from '@/constants/kisIcons';
import AddContactsPage from '@/Module/AddContacts/AddContactsPage';
import type { KISContact } from '@/Module/AddContacts/contactsService';
import { getUserData } from '@/network/cache';
import { resolveShopImageUri } from '@/utils/shopAssets';
import { buildShopLandingPreview } from '@/utils/landingPreview';
import { collectProductImageUris } from '@/utils/productImages';

type PickedImage = { uri: string; name: string; type: string };
const toUploadFile = (picked: PickedImage) => ({
  uri: picked.uri,
  name: picked.name,
  type: picked.type,
});

const LOCAL_IMAGE_SCHEMES = ['file://', 'content://', 'assets-library://', 'ph://', 'blob://', 'data:'];
const isLocalImageUri = (uri?: string) => {
  if (!uri) return false;
  const lower = uri.toLowerCase();
  return LOCAL_IMAGE_SCHEMES.some((scheme) => lower.startsWith(scheme));
};

const AVAILABILITY_RULE_SCOPES = ['year', 'month', 'week', 'day'] as const;
type AvailabilityRuleScope = typeof AVAILABILITY_RULE_SCOPES[number];
const normalizeAvailabilityTime = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const [hourPart = '', minutePart = ''] = trimmed.split(':');
  const hour = Number(hourPart);
  const minute = Number(minutePart);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return '';
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return '';
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};
const parseAvailabilityList = (value: unknown) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};
const normalizeAvailabilityRulesPayload = (value: unknown) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((rule) => {
      if (!rule || typeof rule !== 'object') return null;
      const scopeCandidate = String((rule as any).scope ?? 'day').toLowerCase();
      const scope: AvailabilityRuleScope = AVAILABILITY_RULE_SCOPES.includes(
        scopeCandidate as AvailabilityRuleScope,
      )
        ? (scopeCandidate as AvailabilityRuleScope)
        : 'day';
      const targets = parseAvailabilityList((rule as any).targets);
      const times = parseAvailabilityList((rule as any).times)
        .map(normalizeAvailabilityTime)
        .filter(Boolean);
      if (!targets.length && !times.length) return null;
      return { scope, targets, times };
    })
    .filter(Boolean);
};

const extractDigits = (value?: string | null) => {
  if (!value) return null;
  const digits = String(value).replace(/[^0-9]/g, '');
  return digits.length ? digits : null;
};

const serializeJsonField = (value: unknown) => {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const stripCountryCodePrefix = (digits: string, countryCode?: string | null) => {
  const prefix = extractDigits(countryCode);
  if (prefix && digits.startsWith(prefix)) {
    const stripped = digits.slice(prefix.length);
    return stripped.length ? stripped : digits;
  }
  return digits;
};

const resolvePhoneNumber = (
  source?: {
    phone?: string | null;
    phone_number?: string | null;
    phone_country_code?: string | null;
    country_code?: string | null;
    mobile?: string | null;
  } | null,
) => {
  if (!source) return null;
  const fromPhoneNumber = extractDigits(source.phone_number);
  if (fromPhoneNumber) return fromPhoneNumber;
  const fromPhone = extractDigits(source.phone) ?? extractDigits(source.mobile);
  if (!fromPhone) return null;
  return stripCountryCodePrefix(fromPhone, source.phone_country_code ?? source.country_code);
};

const PHONE_SEQUENCE_MATCH_LENGTH = 7;

const buildDigitSequences = (digits: string, length: number) => {
  const sequences = new Set<string>();
  if (!digits || digits.length < length) return sequences;
  for (let i = 0; i <= digits.length - length; i += 1) {
    const slice = digits.slice(i, i + length);
    if (slice.length === length) sequences.add(slice);
  }
  return sequences;
};

const phoneNumbersMatch = (first?: string | null, second?: string | null, matchLength = PHONE_SEQUENCE_MATCH_LENGTH) => {
  if (!first || !second) return false;
  const left = first.trim();
  const right = second.trim();
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.length < matchLength || right.length < matchLength) return false;
  const shorter = left.length <= right.length ? left : right;
  const longer = shorter === left ? right : left;
  const sequences = buildDigitSequences(shorter, matchLength);
  for (const seq of sequences) {
    if (seq && longer.includes(seq)) return true;
  }
  return false;
};

const unwrapMemberUser = (member?: any) => member?.user_details ?? member?.user ?? member ?? null;

const TAB_DEFINITIONS = [
  { key: 'overview', label: 'Overview' },
  { key: 'products', label: 'Products' },
  { key: 'services', label: 'Services' },
  { key: 'members', label: 'Members' },
  { key: 'analytics', label: 'Analytics' },
  { key: 'landing', label: 'Landing' },
];

const ROLE_POSITION_MAP: Record<string, number> = {
  owner: 0,
  manager: 0,
  admin: 50,
  member: 100,
};

const POSITION_ROLE_MAP: Record<number, string> = {
  0: 'manager',
  50: 'admin',
  100: 'member',
};

const ROLE_OPTIONS = [
  { value: 'owner', label: 'Owner' },
  { value: 'manager', label: 'Manager' },
  { value: 'admin', label: 'Admin' },
  { value: 'member', label: 'Member' },
];

const ROLE_LABELS = ROLE_OPTIONS.reduce<Record<string, string>>((acc, option) => {
  acc[option.value] = option.label;
  return acc;
}, {});

const getRoleLabel = (role?: string) => ROLE_LABELS[role ?? 'member'] ?? 'Member';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const normalizeList = (payload: any): any[] => {
  const source = payload?.data ?? payload ?? {};
  const results = source?.results ?? source;
  if (!Array.isArray(results)) {
    return [];
  }
  return results.map((entry) => {
    if (entry?.data) return entry.data;
    if (entry?.service) return entry.service;
    return entry;
  });
};

type Props = NativeStackScreenProps<RootStackParamList, 'ShopDashboard'>;

const clampPercentage = (value: number) => Math.max(5, Math.min(100, Math.round(value)));
const normalizeNumber = (value: any) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const isProductBroadcasted = (product: any) => {
  if (!product) return false;
  if (product.isBroadcasted || product.is_broadcasted || product.broadcasted) return true;
  if (product.broadcast_item_id || product.broadcast_id) return true;
  const status = String(product?.status ?? '').trim().toLowerCase();
  if (!status) return false;
  return status !== 'unpublished';
};

const isServiceBroadcasted = (service: any) => {
  if (!service) return false;
  return Boolean(
    service?.isBroadcasted ||
      service?.is_broadcasted ||
      service?.broadcasted ||
      service?.broadcast_item_id ||
      service?.broadcast_item_id,
  );
};

const toBooleanValue = (value: any): boolean => {
  if (value === true) return true;
  if (value === false || value === null || value === undefined) return false;
  if (typeof value === 'string') {
    const normalized = value.toLowerCase().trim();
    return normalized === 'true' || normalized === '1';
  }
  return Boolean(value);
};

const resolveLandingVisibility = (shop?: any) => {
  if (!shop) return false;
  const landing = shop?.landing_page ?? shop?.landingPage ?? {};
  const candidates = [
    landing?.is_public,
    landing?.isPublic,
    landing?.is_published,
    landing?.isPublished,
    landing?.public,
    landing?.published,
    shop?.landing_is_public,
    shop?.landing_is_published,
    shop?.landingPublic,
    shop?.landingPublished,
  ];
  return candidates.some((value) => toBooleanValue(value));
};

const ProductCard = ({
  product,
  palette,
  onEdit,
  onDelete,
  onRate,
  onBroadcast,
  memberDiscount,
  isBroadcasted,
  broadcastLoading,
  landingPublic,
  shopName,
  onOpenLanding,
  isService,
  onBook,
  existingBooking,
  onOpenBookingDetails,
}: {
  product: any;
  palette: KISPalette;
  onEdit: () => void;
  onDelete: () => void;
  onRate: (score: number) => Promise<void>;
  onBroadcast?: (product: any, currentlyBroadcasted: boolean) => void;
  memberDiscount?: number;
  isBroadcasted?: boolean;
  broadcastLoading?: boolean;
  landingPublic?: boolean;
  shopName?: string;
  onOpenLanding?: () => void;
  isService?: boolean;
  onBook?: () => void;
  existingBooking?: any;
  onOpenBookingDetails?: (bookingId: string) => void;
}) => {
  const [activeImage, setActiveImage] = useState('');
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const [imageFailed, setImageFailed] = useState(false);

  const galleryImages = useMemo(() => collectProductImageUris(product), [product]);

  useEffect(() => {
    const defaultImage = galleryImages[0] ?? '';
    setActiveImage(defaultImage);
    setImageFailed(false);
  }, [product.id, galleryImages]);

  const salePriceValue = Number(product?.sale_price ?? NaN);
  const regularPriceValue = Number(product?.price ?? product?.list_price ?? 0);
  const price = Number.isFinite(salePriceValue) ? salePriceValue : regularPriceValue;
  const comparePriceValue = Number(product?.compare_at_price ?? product?.compareAtPrice ?? NaN);
  const rawStock =
    product?.stock_qty ?? product?.stock ?? product?.inventory ?? product?.quantity ?? 0;
  const stock = Number.isFinite(Number(rawStock)) ? Number(rawStock) : 0;
  const durationMinutes = Number(product?.duration_minutes ?? 0);
  const categoryLabel =
    product?.catalog_categories?.[0]?.name ??
    product?.category?.name ??
    product?.service_type ??
    (isService ? 'Service' : 'Product');
  const baseRating = Number.isFinite(Number(product?.rating_avg)) ? Number(product.rating_avg) : 0;
  const ratingCountFromData = Number.isFinite(Number(product?.rating_count)) ? Number(product.rating_count) : 0;
  const status = product?.status ?? 'Unpublished';
  const [ratingAvg, setRatingAvg] = useState(baseRating);
  const [ratingCount, setRatingCount] = useState(ratingCountFromData);
  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [ratingDraft, setRatingDraft] = useState('5');
  const [ratingSaving, setRatingSaving] = useState(false);
  useEffect(() => {
    setRatingAvg(baseRating);
    setRatingCount(ratingCountFromData);
  }, [baseRating, ratingCountFromData]);

  const showFullScreen = (uri: string) => {
    if (!uri) return;
    setFullScreenImage(uri);
  };
  const closeRatingSheet = () => {
    setRatingDraft('5');
    setRatingModalVisible(false);
  };
  const handleRatingSave = async () => {
    const score = Math.min(5, Math.max(1, Number(ratingDraft) || 0));
    if (!score) return;
    setRatingSaving(true);
    try {
      await onRate(score);
      closeRatingSheet();
    } catch (error: any) {
      Alert.alert('Rating', error?.message || 'Unable to submit rating.');
    } finally {
      setRatingSaving(false);
    }
  };

  return (
    <View style={[styles.productCard, { backgroundColor: palette.surface, borderColor: palette.divider }]}> 
      {landingPublic && shopName && onOpenLanding ? (
        <Pressable
          style={[styles.broadcastShopBadgeLarge, { borderColor: palette.divider, backgroundColor: `${palette.primaryStrong}10` }]}
          onPress={onOpenLanding}
          hitSlop={{ top: 6, bottom: 6, left: 10, right: 10 }}
        >
          <Text style={[styles.broadcastShopLabelLarge, { color: palette.primaryStrong }]} numberOfLines={1}>
            {shopName}
          </Text>
        </Pressable>
      ) : null}
      <View style={styles.productHero}>
        <Pressable
          onPress={() => showFullScreen(activeImage)}
          style={styles.productImageWrapper}
        >
          {activeImage && !imageFailed ? (
            <Image
              source={{ uri: activeImage }}
              style={[styles.productMainImage, { backgroundColor: palette.surface }]}
              resizeMode="cover"
              onError={() => setImageFailed(true)}
              onLoad={() => setImageFailed(false)}
            />
          ) : (
            <View style={[styles.productMainImage, { backgroundColor: palette.surfaceElevated, justifyContent: 'center', alignItems: 'center' }]}>
              <Text style={{ color: palette.subtext }}>No image yet</Text>
            </View>
          )}
        </Pressable>
        {galleryImages.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbnailRow}>
            {galleryImages.map((uri) => (
              <Pressable
                key={uri}
                onPress={() => setActiveImage(uri)}
                style={[
                  styles.thumbnailWrapper,
                  activeImage === uri ? { borderColor: palette.primaryStrong } : { borderColor: palette.divider },
                ]}
              >
                <Image
                  source={{ uri }}
                  style={styles.thumbnailImage}
                  resizeMode="cover"
                />
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
      </View>
      <View style={styles.productInfo}>
      <View style={styles.productMetaRow}>
        <Text style={[styles.cardTitle, { color: palette.text }]}>{product.name ?? 'Untitled product'}</Text>
        <Text style={[styles.meta, { color: palette.primaryStrong }]}>{isBroadcasted ? 'Published' : status}</Text>
      </View>
        <Text style={[styles.meta, { color: palette.subtext }]}>
          {categoryLabel}
        </Text>
        <Text style={[styles.productDescription, { color: palette.subtext }]} numberOfLines={2}>
          {isService
            ? product.short_summary ?? product.description ?? 'No description yet.'
            : product.description ?? 'No description yet.'}
        </Text>
        <View style={styles.priceRow}>
          <View>
            <Text style={[styles.priceTag, { color: palette.primaryStrong }]}>
              {Number.isFinite(price) ? price.toLocaleString() : '0'} {KIS_COIN_CODE}
            </Text>
            {Number.isFinite(salePriceValue) && Number.isFinite(regularPriceValue) && salePriceValue < regularPriceValue ? (
              <Text style={[styles.originalPrice, { color: palette.subtext }]}>
                {regularPriceValue.toLocaleString()} {KIS_COIN_CODE}
              </Text>
            ) : null}
            {!Number.isFinite(salePriceValue) &&
            Number.isFinite(comparePriceValue) &&
            comparePriceValue > price ? (
              <Text style={[styles.originalPrice, { color: palette.subtext }]}>
                {comparePriceValue.toLocaleString()} {KIS_COIN_CODE}
              </Text>
            ) : null}
          </View>
          {memberDiscount ? (
            <View style={[styles.discountBadge, { borderColor: palette.primaryStrong }]}>
              <Text style={[styles.discountText, { color: palette.primaryStrong }]}>Members save {memberDiscount}%</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.gridRow}>
          <View style={styles.gridItem}>
            <Text style={[styles.statValue, { color: palette.text }]}>
              {isService ? (durationMinutes > 0 ? durationMinutes : 'TBD') : stock}
            </Text>
            <Text style={[styles.statLabel, { color: palette.subtext }]}>
              {isService ? 'Minutes' : 'Stock'}
            </Text>
          </View>
          <View style={styles.gridItem}>
            <Text style={[styles.statValue, { color: palette.text }]}>{ratingAvg.toFixed(1)}</Text>
            <Text style={[styles.statLabel, { color: palette.subtext }]}>Rating</Text>
          </View>
        </View>
        <View style={styles.ratingRow}>
          <Pressable
            style={[
              styles.ratingIcon,
              { borderColor: palette.primaryStrong, backgroundColor: `${palette.primaryStrong}22` },
            ]}
            onPress={() => setRatingModalVisible(true)}
          >
            <KISIcon name="add" size={16} color={palette.primaryStrong} />
          </Pressable>
          <View style={{ flexDirection: 'row' }}>
            {Array.from({ length: 5 }).map((_, index) => (
              <Text
                key={index}
                style={[
                  styles.star,
                  index < Math.round(ratingAvg) ? { color: palette.primaryStrong } : { color: palette.subtext },
                ]}
              >
                ★
              </Text>
            ))}
          </View>
          <Text style={[styles.meta, { color: palette.subtext, marginLeft: 6 }]}>({ratingCount} reviews)</Text>
        </View>
        <View style={[styles.actionRow, { justifyContent: 'space-between', flexWrap: 'wrap', marginTop: 12 }]}>  
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {existingBooking && existingBooking.id ? (
              <KISButton
                title="Details"
                size="xs"
                variant="outline"
                onPress={() => onOpenBookingDetails?.(String(existingBooking.id))}
              />
            ) : onBook ? (
              <KISButton title="Book service" size="xs" variant="secondary" onPress={onBook} />
            ) : null}
            <KISButton
              title={isBroadcasted ? 'Remove broadcast' : 'Broadcast'}
              size="xs"
              variant={isBroadcasted ? 'outline' : 'secondary'}
              onPress={() => onBroadcast?.(product, Boolean(isBroadcasted), Boolean(isService))}
              loading={broadcastLoading}
              disabled={broadcastLoading}
            />
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <KISButton title="Edit" size="xs" variant="outline" onPress={onEdit} />
            <KISButton title="Delete" size="xs" variant="danger" onPress={onDelete} />
          </View>
        </View>
      </View>
      <Modal visible={Boolean(fullScreenImage)} transparent onRequestClose={() => setFullScreenImage(null)}>
        <Pressable style={styles.fullscreenOverlay} onPress={() => setFullScreenImage(null)}>
          {fullScreenImage ? (
            <Image
              source={{ uri: fullScreenImage }}
              style={styles.fullscreenImage}
              resizeMode="contain"
            />
          ) : null}
        </Pressable>
      </Modal>
      <Modal visible={ratingModalVisible} transparent animationType="fade" onRequestClose={closeRatingSheet}>
        <Pressable style={styles.ratingModalOverlay} onPress={closeRatingSheet}>
          <View style={[styles.card, { width: '90%', maxWidth: 360, padding: 20 }]}>
            <Text style={[styles.cardTitle, { marginBottom: 6 }]}>
              {isService ? 'Rate this service' : 'Rate this product'}
            </Text>
            <Text style={[styles.meta, { color: palette.subtext }]}>
              Tap a star to set your rating.
            </Text>
            <View style={[styles.ratingRow, { justifyContent: 'center', marginTop: 12 }]}>
              {Array.from({ length: 5 }).map((_, index) => (
                <Pressable
                  key={`modal-star-${index}`}
                  onPress={() => setRatingDraft(String(index + 1))}
                  style={{ padding: 4 }}
                >
                  <Text
                    style={[
                      styles.star,
                      { fontSize: 32 },
                      index < Number(ratingDraft) ? { color: palette.primaryStrong } : { color: palette.subtext },
                    ]}
                  >
                    ★
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={[styles.actionRow, styles.ratingModalActions]}>
              <KISButton title="Submit" size="sm" loading={ratingSaving} onPress={handleRatingSave} />
              <KISButton title="Cancel" size="sm" variant="ghost" onPress={closeRatingSheet} />
            </View>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
};

export default function ShopDashboardScreen({ route, navigation }: Props) {
  const { palette } = useKISTheme();
  const initialShop = route.params.shop;
  const [shop, setShop] = useState(initialShop);
  const shopId = shop?.id;
  const landingVisibilityFlag = useMemo(() => resolveLandingVisibility(shop), [shop]);
  const [landingPublic, setLandingPublic] = useState(landingVisibilityFlag);
  useEffect(() => {
    setLandingPublic(landingVisibilityFlag);
  }, [landingVisibilityFlag]);
  const heroImageUri = useMemo(() => resolveShopImageUri(shop), [shop]);
  const [landingVisibilitySaving, setLandingVisibilitySaving] = useState(false);
  const [activeTab, setActiveTab] = useState(TAB_DEFINITIONS[0].key);
  const [memberDiscount, setMemberDiscount] = useState(() => clampPercentage(initialShop?.membership_discount_pct ?? 5));
  const [membershipPublic, setMembershipPublic] = useState(() => Boolean(initialShop?.membership_public));
  const [membershipPublicSaving, setMembershipPublicSaving] = useState(false);
  const [discountSaving, setDiscountSaving] = useState(false);
  const [productDrawerVisible, setProductDrawerVisible] = useState(false);
  const [productEditorMode, setProductEditorMode] = useState<'create' | 'edit'>('create');
  const [activeProduct, setActiveProduct] = useState<any | null>(null);
  const [serviceDrawerVisible, setServiceDrawerVisible] = useState(false);
  const [serviceEditorMode, setServiceEditorMode] = useState<'create' | 'edit'>('create');
  const [activeService, setActiveService] = useState<any | null>(null);
  const [serviceLoading, setServiceLoading] = useState(false);
  const [productLoading, setProductLoading] = useState(false);
  const [broadcastingProductId, setBroadcastingProductId] = useState<string | null>(null);
  const [productsList, setProductsList] = useState<any[]>([]);
  const [servicesList, setServicesList] = useState<any[]>([]);
  const [serviceBookings, setServiceBookings] = useState<any[]>([]);
  const [shopMembers, setShopMembers] = useState<any[]>(() =>
    Array.isArray(initialShop?.members) ? initialShop.members : [],
  );
  const [membersLoading, setMembersLoading] = useState(false);
  const [contactsPickerOpen, setContactsPickerOpen] = useState(false);
  const [addingMember, setAddingMember] = useState(false);
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [roleSliderValues, setRoleSliderValues] = useState<Record<string, number>>({});

  const safeMembers = useMemo(() => shopMembers, [shopMembers]);
  const owner = useMemo(() => safeMembers.find((member) => member?.role === 'owner'), [safeMembers]);
  const ownerPhone = useMemo(() => resolvePhoneNumber(unwrapMemberUser(owner)), [owner]);
  const ownerId = shop?.owner?.id ?? shop?.owner_id ?? shop?.owner;
  const managers = useMemo(() => safeMembers.filter((member) => member?.role === 'manager'), [safeMembers]);
  const admins = useMemo(() => safeMembers.filter((member) => member?.role === 'admin'), [safeMembers]);
  const members = useMemo(() => safeMembers.filter((member) => member?.role === 'member'), [safeMembers]);
  const fallbackUserProfile = useMemo(() => {
    const ownerUser = unwrapMemberUser(owner);
    const fallbackPhone =
      resolvePhoneNumber(ownerUser) ?? ownerPhone ?? null;
    return {
      id: ownerUser?.id ?? owner?.user_id ?? ownerId ?? null,
      phone: fallbackPhone,
      phone_number: fallbackPhone,
    } as any;
  }, [owner, ownerPhone, ownerId]);
  const [cachedStorageUser, setCachedStorageUser] = useState<any | null>(fallbackUserProfile);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { user: storedUser } = await getUserData();
        if (!mounted) return;
        setCachedStorageUser(storedUser ?? fallbackUserProfile);
      } catch {
        if (mounted) setCachedStorageUser(fallbackUserProfile);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [fallbackUserProfile]);
 
  const cachedUserProfile = useMemo(() => cachedStorageUser?.user ?? cachedStorageUser ?? null, [cachedStorageUser]);
  const formatMemberTitle = useCallback((member: any) => {
    const user = member?.user_details ?? member?.user ?? {};
    return user.display_name ?? user.phone ?? 'Member';
  }, []);
  const currentUserPhone = useMemo(() => resolvePhoneNumber(cachedUserProfile), [cachedUserProfile]);
  const currentUserId = cachedUserProfile?.id ?? cachedUserProfile?.user_id;
  const currentUserRole = useMemo(() => {
    if (currentUserId && ownerId && currentUserId === ownerId) {
      return 'owner';
    }
    if (ownerPhone && currentUserPhone && phoneNumbersMatch(ownerPhone, currentUserPhone)) {
      return 'owner';
    }
    const membership = safeMembers.find((member) => {
      const memberPhone = resolvePhoneNumber(unwrapMemberUser(member));
      const memberUserId = member?.user_details?.id ?? member?.user?.id ?? member?.user_id;
      if (memberUserId && currentUserId && memberUserId === currentUserId) {
        return true;
      }
      return memberPhone && currentUserPhone && phoneNumbersMatch(memberPhone, currentUserPhone);
    });
    return membership?.role ?? null;
  }, [safeMembers, ownerPhone, currentUserPhone, currentUserId, ownerId]);

  const canManageMembers = currentUserRole === 'owner' || currentUserRole === 'manager';
  const canToggleLandingVisibility = currentUserRole === 'owner' && Boolean(shopId);
  const openShopLandingPage = useCallback(() => {
    if (!shopId || !shop) return;
    const { landingDraft, heroImage, previewGalleryImageUris } = buildShopLandingPreview(shop);
    navigation.navigate('InstitutionLandingPreview', {
      institutionId: shopId,
      institutionName: shop?.name ?? 'Shop',
      draft: landingDraft,
      previewHeroImageUri: heroImage || undefined,
      previewGalleryImageUris,
    });
  }, [navigation, shopId, shop]);
  const openServiceBooking = useCallback(
    (serviceId?: string, serviceName?: string) => {
      if (!serviceId) return;
      navigation.navigate('ServiceBooking', { serviceId, serviceName });
    },
    [navigation],
  );
  const toggleLandingVisibility = useCallback(async () => {
    if (!shopId) return;
    const nextValue = !landingPublic;
    setLandingVisibilitySaving(true);
    try {
      const payload = {
        landing_is_public: nextValue,
        landing_is_published: nextValue,
        landing_page_is_public: nextValue,
        landing_page_is_published: nextValue,
        landing_page: {
          ...(shop?.landing_page ?? {}),
          is_public: nextValue,
          is_published: nextValue,
          public: nextValue,
        },
      };
      const response = await patchRequest(`${ROUTES.commerce.shops}${shopId}/`, payload, {
        errorMessage: 'Unable to update landing visibility.',
      });
      if (!response?.success) {
        throw new Error(response?.message || 'Unable to update landing visibility.');
      }
      setLandingPublic(nextValue);
      setShop((prev) => ({
        ...prev,
        landing_page: {
          ...(prev?.landing_page ?? {}),
          is_public: nextValue,
          is_published: nextValue,
          public: nextValue,
        },
      }));
      await loadShopDetails();
      DeviceEventEmitter.emit('broadcast.refresh');
      Alert.alert(
        'Landing page',
        nextValue ? 'Landing page is now public.' : 'Landing page is private.',
      );
    } catch (error: any) {
      Alert.alert('Landing page', error?.message || 'Unable to update landing visibility.');
    } finally {
      setLandingVisibilitySaving(false);
    }
  }, [landingPublic, shopId, shop, setShop, loadShopDetails]);
  useEffect(() => {
    const map: Record<string, number> = {};
    safeMembers.forEach((member) => {
      const key = member?.id;
      if (!key) return;
      const role = member?.role ?? 'member';
      map[key] = ROLE_POSITION_MAP[role] ?? 100;
    });
    setRoleSliderValues(map);
  }, [safeMembers]);
  useEffect(() => {
    setMemberDiscount(clampPercentage(shop?.membership_discount_pct ?? 5));
    setMembershipPublic(Boolean(shop?.membership_public));
  }, [shop?.membership_discount_pct, shop?.membership_public]);
  const loadShopServices = useCallback(async () => {
    if (!shopId) {
      setServicesList([]);
      return;
    }
    try {
      const response = await getRequest(ROUTES.commerce.shopServices, {
        params: { shop: shopId },
        errorMessage: 'Unable to load shop services.',
      });
      if (response?.success) {
        setServicesList(normalizeList(response.data));
      } else {
        console.warn('Unable to load shop services:', response?.message);
        setServicesList([]);
      }
    } catch (error: any) {
      console.warn('Unable to load shop services:', error?.message ?? error);
      setServicesList([]);
    }
  }, [shopId]);

  const loadServiceBookings = useCallback(async () => {
    try {
      const response = await getRequest(ROUTES.commerce.serviceBookings, {
        forceNetwork: true,
        errorMessage: 'Unable to load service bookings.',
      });
      if (response?.success) {
        const payload = response.data ?? [];
        const records = Array.isArray(payload)
          ? payload
          : Array.isArray((payload as any).results)
          ? (payload as any).results
          : [];
        setServiceBookings(records);
      } else {
        setServiceBookings([]);
      }
    } catch (error) {
      console.warn('Unable to load service bookings:', error);
      setServiceBookings([]);
    }
  }, []);

  const updateServiceBroadcastStateLocal = useCallback(
    (serviceId: string, broadcasted: boolean) => {
      setServicesList((prev) =>
        prev.map((entry) => {
          if (entry?.id !== serviceId) return entry;
          const nextEntry = {
            ...entry,
            isBroadcasted: broadcasted,
            is_broadcasted: broadcasted,
            broadcasted: broadcasted,
            broadcast_item_id: broadcasted ? entry.broadcast_item_id ?? entry.id : null,
          };
          return nextEntry;
        }),
      );
      setProductsList((prev) =>
        prev.map((entry) => {
          if (entry?.id !== serviceId) return entry;
          return {
            ...entry,
            isBroadcasted: broadcasted,
            is_broadcasted: broadcasted,
            broadcasted: broadcasted,
            broadcast_item_id: broadcasted ? entry.broadcast_item_id ?? entry.id : null,
          };
        }),
      );
      setShop((prev) => {
        if (!prev) return prev;
        const services = Array.isArray(prev.services) ? prev.services : [];
        let changed = false;
        const updatedServices = services.map((entry) => {
          if (entry?.id !== serviceId) return entry;
          changed = true;
          return {
            ...entry,
            isBroadcasted: broadcasted,
            is_broadcasted: broadcasted,
            broadcasted: broadcasted,
            broadcast_item_id: broadcasted ? entry.broadcast_item_id ?? entry.id : null,
          };
        });
        if (!changed) return prev;
        return { ...prev, services: updatedServices };
      });
    },
    [setProductsList, setServicesList, setShop],
  );

  const updateProductBroadcastStateLocal = useCallback(
    (productId: string, broadcasted: boolean) => {
      setProductsList((prev) =>
        prev.map((entry) => {
          if (entry?.id !== productId) return entry;
          return {
            ...entry,
            isBroadcasted: broadcasted,
            is_broadcasted: broadcasted,
            broadcasted: broadcasted,
            broadcast_item_id: broadcasted ? entry.broadcast_item_id ?? entry.id : null,
          };
        }),
      );
      setShop((prev) => {
        if (!prev) return prev;
        const products = Array.isArray(prev.products) ? prev.products : [];
        let changed = false;
        const updatedProducts = products.map((entry) => {
          if (entry?.id !== productId) return entry;
          changed = true;
          return {
            ...entry,
            isBroadcasted: broadcasted,
            is_broadcasted: broadcasted,
            broadcasted: broadcasted,
            broadcast_item_id: broadcasted ? entry.broadcast_item_id ?? entry.id : null,
          };
        });
        if (!changed) return prev;
        return { ...prev, products: updatedProducts };
      });
    },
    [setProductsList, setShop],
  );

  const loadProducts = useCallback(async () => {
    if (!shopId) {
      setProductsList([]);
      return;
    }
    const res = await getRequest(ROUTES.commerce.products, {
      params: { shop: shopId },
      errorMessage: 'Unable to load shop products.',
    });
    if (res.success) {
      setProductsList(normalizeList(res.data));
    } else {
      console.warn('Unable to load shop products:', res.message);
      setProductsList([]);
    }
  }, [shopId]);

  const loadShopMembers = useCallback(async () => {
    if (!shopId) {
      setShopMembers([]);
      return;
    }
    setMembersLoading(true);
    try {
      const response = await getRequest(ROUTES.commerce.shopTeamMembers, {
        params: { shop: shopId },
        errorMessage: 'Unable to load shop members.',
      });
      if (response?.success) {
        const members = normalizeList(response.data).filter((member) => member?.is_active);
        setShopMembers(members);
      } else {
        console.warn('Unable to load shop members:', response?.message);
        setShopMembers([]);
      }
    } catch (error: any) {
      console.warn('Unable to load shop members:', error?.message ?? error);
      setShopMembers([]);
    } finally {
      setMembersLoading(false);
    }
  }, [shopId]);

  const handleAddMemberByContact = useCallback(
    async (contact: KISContact) => {
      setContactsPickerOpen(false);
      if (!contact?.userId) {
        Alert.alert('Members', 'This contact is not registered yet. Ask them to join KIS first.');
        return;
      }
      if (!shopId) {
        Alert.alert('Members', 'Shop not selected.');
        return;
      }
      if (!canManageMembers) {
        Alert.alert('Members', 'Only owners or managers can add new members.');
        return;
      }
      setAddingMember(true);
      try {
        const response = await postRequest(
          ROUTES.commerce.shopTeamMembers,
          { shop: shopId, user: contact.userId, role: 'member' },
          { errorMessage: 'Unable to add member.' },
        );
        if (!response?.success) {
          throw new Error(response?.message || 'Unable to add member.');
        }
        Alert.alert('Members', 'Member added to the shop.');
        await loadShopMembers();
      } catch (error: any) {
        Alert.alert('Members', error?.message || 'Unable to add member.');
      } finally {
        setAddingMember(false);
      }
    },
    [loadShopMembers, shopId],
  );

  const handleUpdateMemberRole = useCallback(
    async (memberId: string, role: string) => {
      if (!shopId || !memberId || !role) return;
      if (!canManageMembers) {
        Alert.alert('Roles', 'Only owners or managers can change member roles.');
        return;
      }
      const position = ROLE_POSITION_MAP[role] ?? 100;
      setRoleSliderValues((prev) => ({ ...prev, [memberId]: position }));
      setUpdatingMemberId(memberId);
      try {
        const response = await patchRequest(
          ROUTES.commerce.shopTeamMember(memberId),
          { role },
          { errorMessage: 'Unable to update member role.' },
        );
        if (!response?.success) {
          throw new Error(response?.message || 'Unable to update member role.');
        }
        Alert.alert('Roles', 'Role updated.');
        await loadShopMembers();
      } catch (error: any) {
        Alert.alert('Roles', error?.message || 'Unable to update member role.');
      } finally {
        setUpdatingMemberId(null);
      }
    },
    [loadShopMembers, shopId],
  );

  const handleRemoveMember = useCallback(
    async (memberId: string) => {
      if (!shopId || !memberId) return;
      if (!canManageMembers) {
        Alert.alert('Members', 'Only owners or managers can remove members.');
        return;
      }
      setRemovingMemberId(memberId);
      try {
        const response = await deleteRequest(
          ROUTES.commerce.shopTeamMember(memberId),
          { errorMessage: 'Unable to remove member.' },
        );
        if (!response?.success) {
          throw new Error(response?.message || 'Unable to remove member.');
        }
        Alert.alert('Members', 'Member removed.');
        await loadShopMembers();
      } catch (error: any) {
        Alert.alert('Members', error?.message || 'Unable to remove member.');
      } finally {
        setRemovingMemberId(null);
      }
    },
    [loadShopMembers, shopId],
  );

  const loadShopDetails = useCallback(async () => {
    if (!shopId) {
      return;
    }
    try {
      const response = await getRequest(`${ROUTES.commerce.shops}${shopId}/`, {
        forceNetwork: true,
        errorMessage: 'Unable to refresh shop details.',
      });
      if (response?.success && response.data) {
        setShop((prev) => ({ ...prev, ...response.data }));
      }
    } catch (error: any) {
      console.warn('Unable to refresh shop details:', error?.message ?? error);
    }
  }, [shopId]);

  const toggleMembershipVisibility = useCallback(async () => {
    if (!shopId) {
      Alert.alert('Membership', 'Select a shop before updating membership visibility.');
      return;
    }
    const nextValue = !membershipPublic;
    setMembershipPublicSaving(true);
    try {
      const response = await patchRequest(
        `${ROUTES.commerce.shops}${shopId}/`,
        { membership_public: nextValue },
        { errorMessage: 'Unable to update membership visibility.' },
      );
      if (!response?.success) {
        throw new Error(response?.message || 'Unable to update membership settings.');
      }
      const updatedData = response?.data ?? {};
      setMembershipPublic(nextValue);
      setShop((prev) => ({ ...prev, ...updatedData, membership_public: nextValue }));
      Alert.alert('Membership', `Membership is now ${nextValue ? 'public' : 'private'}.`);
      await loadShopDetails();
    } catch (error: any) {
      Alert.alert('Membership', error?.message || 'Unable to update membership settings.');
    } finally {
      setMembershipPublicSaving(false);
    }
  }, [loadShopDetails, membershipPublic, shopId]);

  const handleSaveDiscount = useCallback(
    async (value: number) => {
      if (!shopId) {
        Alert.alert('Members', 'Select a shop before setting discounts.');
        return;
      }
      setDiscountSaving(true);
      try {
        const response = await patchRequest(
          `${ROUTES.commerce.shops}${shopId}/`,
          { membership_discount_pct: value },
          { errorMessage: 'Unable to save discount.' },
        );
        if (!response?.success) {
          throw new Error(response?.message || 'Unable to save discount.');
        }
        const updatedData = response?.data ?? {};
        setMemberDiscount(value);
        setShop((prev) => ({ ...prev, ...updatedData, membership_discount_pct: value }));
        Alert.alert('Members', `Discount floor set to ${value}%.`);
        await loadShopDetails();
      } catch (error: any) {
        Alert.alert('Members', error?.message || 'Unable to save discount.');
      } finally {
        setDiscountSaving(false);
      }
    },
    [loadShopDetails, shopId],
  );

  useEffect(() => {
    loadProducts();
    loadShopServices();
    loadShopMembers();
  }, [loadProducts, loadShopServices, loadShopMembers]);

  useFocusEffect(
    useCallback(() => {
      void loadShopDetails();
      void loadShopMembers();
      void loadShopServices();
      void loadServiceBookings();
    }, [loadShopDetails, loadShopMembers, loadShopServices, loadServiceBookings]),
  );

  const bookingByService = useMemo(() => {
    const map: Record<string, any> = {};
    serviceBookings.forEach((booking) => {
      const serviceId =
        booking?.service_details?.id ||
        (booking?.service ? String(booking.service) : null) ||
        null;
      if (!serviceId) return;
      if (!map[serviceId]) {
        map[serviceId] = booking;
      }
    });
    return map;
  }, [serviceBookings]);

  const openBookingDetails = useCallback(
    (bookingId?: string) => {
      if (!bookingId) return;
      navigation.navigate('ServiceBookingDetails', { bookingId });
    },
    [navigation],
  );

  const metrics = useMemo(() => {
    const raw = shop?.metrics ?? {};
    const parsePercentage = (candidate: any) => {
      const numeric = Number(candidate);
      return Number.isFinite(numeric) ? numeric : 0;
    };
    return {
      revenue: normalizeNumber(raw.revenue_total ?? raw.revenue ?? 0),
      orders: normalizeNumber(raw.order_count ?? raw.orders ?? 0),
      bookings: normalizeNumber(raw.booking_count ?? raw.bookings ?? 0),
      growth: parsePercentage(raw.growth_rate ?? raw.growth ?? 0),
      conversion: parsePercentage(raw.conversion_rate ?? raw.conversion ?? 0),
      repeat: normalizeNumber(raw.repeat_buyers ?? raw.repeat ?? 0),
      landing: normalizeNumber(raw.landing_page_visits ?? raw.landing_visits ?? 0),
    };
  }, [shop]);

  const shopProductsSource = useMemo(() => {
    if (productsList.length) return productsList;
    return Array.isArray(shop?.products) ? shop.products : [];
  }, [productsList, shop?.products]);
  const derivedServiceProducts = useMemo(
    () => shopProductsSource.filter((product) => (product?.inventory_type ?? 'PHYSICAL') === 'SERVICE'),
    [shopProductsSource],
  );
  const filteredProductEntries = useMemo(
    () => shopProductsSource.filter((product) => (product?.inventory_type ?? 'PHYSICAL') !== 'SERVICE'),
    [shopProductsSource],
  );
  const backendServiceEntries = useMemo(() => {
    if (servicesList.length) {
      return servicesList;
    }
    return Array.isArray(shop?.services) ? shop.services : [];
  }, [servicesList, shop?.services]);
  const safeServices = useMemo(() => {
    if (!backendServiceEntries.length) {
      return derivedServiceProducts;
    }
    const seen = new Set<string>();
    const combined: any[] = [];
    backendServiceEntries.forEach((service, index) => {
      const key = String(
        service?.id ?? service?.slug ?? service?.sku ?? service?.name ?? `backend-service-${index}`,
      );
      if (!seen.has(key)) {
        seen.add(key);
        combined.push(service);
      }
    });
    derivedServiceProducts.forEach((service, index) => {
      const key = String(
        service?.id ?? service?.slug ?? service?.sku ?? service?.name ?? `derived-service-${index}`,
      );
      if (!seen.has(key)) {
        seen.add(key);
        combined.push(service);
      }
    });
    return combined;
  }, [backendServiceEntries, derivedServiceProducts]);
  const safeProducts = filteredProductEntries;
  const lowStockCount = useMemo(
    () =>
      safeProducts.reduce((sum, product) => {
        const stock = normalizeNumber(product?.stock ?? product?.inventory ?? 0);
        return sum + (stock < 10 ? 1 : 0);
      }, 0),
    [safeProducts],
  );
  const readyServicesCount = useMemo(
    () => safeServices.filter((service) => service?.status !== 'draft').length,
    [safeServices],
  );
  const activityFeed = useMemo(() => {
    if (Array.isArray(shop?.activity_feed) && shop.activity_feed.length) return shop.activity_feed;
    if (Array.isArray(shop?.recent_activity) && shop.recent_activity.length) return shop.recent_activity;
    return [
      { id: 'act-safe-1', title: 'Shop synchronized', detail: 'All settings mirrored to the storefront', time: 'Just now' },
      { id: 'act-safe-2', title: 'Members growing', detail: 'You gained +12 members this week', time: '2h ago' },
      { id: 'act-safe-3', title: 'Landing page refreshed', detail: 'Hero CTA updated automatically', time: 'Yesterday' },
    ];
  }, [shop]);

  const insights = useMemo(() => {
    return [
      {
        title: 'Stock health',
        detail: lowStockCount
          ? `${lowStockCount} item${lowStockCount > 1 ? 's' : ''} are under 10 units — restock recommended.`
          : 'All featured products have healthy inventory.',
      },
      {
        title: 'Service availability',
        detail: readyServicesCount
          ? `${readyServicesCount} live service${readyServicesCount > 1 ? 's' : ''} with booking open.`
          : 'No services published yet.',
      },
      {
        title: 'Member retention',
        detail: safeMembers.length
          ? `${safeMembers.length} member${safeMembers.length > 1 ? 's' : ''} engaged this month.`
          : 'Invite members to unlock discounts.',
      },
      {
        title: 'Conversion pulse',
        detail: metrics.conversion
          ? `Conversion is ${metrics.conversion}% — consider promoting top sellers.`
          : 'Conversion tracking is pending.',
      },
    ];
  }, [lowStockCount, readyServicesCount, safeMembers, metrics]);

  const kpiCards = useMemo(
    () => [
      { label: 'Revenue', value: `$${metrics.revenue.toLocaleString()}` },
      { label: 'Orders', value: metrics.orders },
      { label: 'Bookings', value: metrics.bookings },
      { label: 'Growth', value: `${metrics.growth}%` },
      { label: 'Conversion', value: `${metrics.conversion}%` },
      { label: 'Repeat buyers', value: metrics.repeat },
    ],
    [metrics],
  );

  const overviewStats = useMemo(
    () => [
      { label: 'Active orders', value: metrics.orders },
      { label: 'Bookings', value: metrics.bookings },
      { label: 'Avg order value', value: metrics.orders ? `$${Math.round(metrics.revenue / metrics.orders).toLocaleString()}` : '$0' },
      { label: 'Conversion', value: `${metrics.conversion}%` },
    ],
    [metrics],
  );

  const orderSummary = useMemo(
    () => [
      { label: 'Orders', value: metrics.orders },
      { label: 'Bookings', value: metrics.bookings },
      { label: 'Landing visits', value: metrics.landing },
      { label: 'Repeat buyers', value: metrics.repeat },
    ],
    [metrics],
  );

  const trendSeries = useMemo(() => {
    const base = Math.max(1, metrics.revenue);
    const data = Array.from({ length: 5 }, (_, index) => ({
      x: `Day ${index + 1}`,
      y: Math.round(base * (0.65 + index * 0.08)),
    }));
    return [
      {
        id: 'revenue-trend',
        name: 'Revenue trend',
        data,
        color: '#6366F1',
      },
    ];
  }, [metrics.revenue]);

  const breakdownData = useMemo(
    () => [
      { label: 'Orders', value: metrics.orders, color: palette.primaryStrong },
      { label: 'Bookings', value: metrics.bookings, color: '#EF4444' },
      { label: 'Testimonials', value: normalizeNumber(shop?.landing_page?.testimonials?.length ?? 0), color: '#F59E0B' },
    ],
    [metrics, palette.primaryStrong, shop],
  );

  const distributionData = useMemo(() => {
    const repeat = metrics.repeat;
    const newcomers = Math.max(metrics.orders - repeat, 0);
    return [
      { label: 'Members', value: safeMembers.length, color: '#10B981' },
      { label: 'Repeat buyers', value: repeat, color: '#6366F1' },
      { label: 'New customers', value: newcomers, color: '#F97316' },
    ];
  }, [metrics, safeMembers.length]);

  const toCategoryLabel = (value: any, fallback: string) => {
    if (!value) return fallback;
    if (typeof value === 'string') return value;
    if (Array.isArray(value?.catalog_categories)) {
      const first = value.catalog_categories[0];
      if (first?.name) return first.name;
    }
    if (typeof value === 'object' && value?.name) return value.name;
    return fallback;
  };

  const topProductItems = useMemo(() => {
    const enriched = safeProducts
      .map((product, index) => {
        const score = normalizeNumber(product?.sales ?? product?.orders ?? product?.units_sold ?? 0);
        return {
          id: product.id ?? product.sku ?? `${product?.category ?? 'product'}-${index}`,
          title: product.name ?? 'Product',
          subtitle: toCategoryLabel(product.category, 'Product'),
          metric: `${score} sold`,
          score,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(({ score, ...rest }) => rest);
    return enriched;
  }, [safeProducts]);

  const topServiceItems = useMemo(() => {
    const enriched = safeServices
      .map((service, index) => {
        const score = normalizeNumber(service?.bookings ?? service?.reservations ?? service?.orders ?? 0);
        return {
          id: service.id ?? service.slug ?? `${service?.category ?? 'service'}-${index}`,
          title: service.name ?? 'Service',
          subtitle: toCategoryLabel(service, 'Services'),
          metric: `${score} bookings`,
          score,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(({ score, ...rest }) => rest);
    return enriched;
  }, [safeServices]);

  const globalReadiness = useMemo(() => {
    const languages = Array.isArray(shop?.languages)
      ? shop.languages
      : shop?.language
        ? [shop.language]
        : ['English'];
    const currencies = Array.isArray(shop?.currencies)
      ? shop.currencies
      : shop?.currency
        ? [shop.currency]
        : [KIS_COIN_CODE];
    const regions =
      Array.isArray(shop?.regions) && shop.regions.length ? shop.regions : shop?.region ? [shop.region] : ['Global'];
    const timezones =
      Array.isArray(shop?.timezones) && shop.timezones.length
        ? shop.timezones
        : shop?.timezone
          ? [shop.timezone]
          : shop?.timezone_offset
            ? [shop.timezone_offset]
            : ['UTC'];
    const deliveryModes = Array.isArray(shop?.delivery_modes)
      ? shop.delivery_modes
      : shop?.delivery_mode
        ? [shop.delivery_mode]
        : ['Standard'];
    return { languages, currencies, regions, timezones, deliveryModes };
  }, [shop]);


  const openProductEditor = (mode: 'create' | 'edit', product?: any | null) => {
    setProductEditorMode(mode);
    setActiveProduct(product ?? null);
    setProductDrawerVisible(true);
  };
  const closeProductEditor = () => {
    setProductDrawerVisible(false);
    setActiveProduct(null);
  };

  const openServiceEditor = (mode: 'create' | 'edit', service?: any | null) => {
    setServiceEditorMode(mode);
    setActiveService(service ?? null);
    setServiceDrawerVisible(true);
  };
  const closeServiceEditor = () => {
    setServiceDrawerVisible(false);
    setActiveService(null);
  };

  const handleProductSave = useCallback(
    async (payload: any) => {
      if (!shop?.id) {
        Alert.alert('Products', 'Link a shop before saving products.');
        return;
      }
      const trimmedName = String(payload.name ?? '').trim();
      if (!trimmedName) {
        Alert.alert('Products', 'Provide a product name before saving.');
        return;
      }
      setProductLoading(true);
      try {
        const formData = new FormData();
        formData.append('shop', shop.id);
        formData.append('name', trimmedName);
        formData.append('description', String(payload.description ?? '').trim());
        const priceValue = String(payload.price ?? '').trim();
        formData.append('price', priceValue || '0');
        const currencyValue = String(payload.currency ?? KIS_COIN_CODE).trim() || KIS_COIN_CODE;
        formData.append('currency', currencyValue);
        const stockValue = String(
          payload.stock_qty ?? payload.stock ?? payload.stockQty ?? '',
        ).trim();
        formData.append('stock_qty', stockValue || '0');
        const inventoryTypeValue = String(
          payload.inventory_type ?? payload.inventoryType ?? 'PHYSICAL',
        ).trim() || 'PHYSICAL';
        formData.append('inventory_type', inventoryTypeValue);
        const normalizeIdList = (
          value?: string | number | null | (string | number)[],
        ) => {
          if (value === undefined || value === null) {
            return [];
          }
          const iterable = Array.isArray(value) ? value : [value];
          return iterable
            .map((entry) => String(entry ?? '').trim())
            .filter(Boolean);
        };
        const candidateCategoryIds = [
          ...normalizeIdList(payload.catalog_category_ids),
          ...normalizeIdList(payload.category_ids),
          ...normalizeIdList(payload.categoryIds),
        ];
        const normalizedCategoryIds = Array.from(
          new Set(candidateCategoryIds),
        ).slice(0, CATEGORY_SELECTION_LIMIT);
        normalizedCategoryIds.forEach((categoryId: string) => {
          formData.append('category_ids', categoryId);
          formData.append('catalog_category_ids', categoryId);
        });
        const primaryCategoryId =
          normalizedCategoryIds[0] ??
          normalizeIdList(payload.category_id)[0] ??
          normalizeIdList(payload.categoryId)[0];
        if (primaryCategoryId) {
          formData.append('category_id', primaryCategoryId);
        }
        const appendIfValue = (field: string, value?: string | number | null) => {
          const trimmed = value === undefined || value === null ? '' : String(value).trim();
          if (trimmed) {
            formData.append(field, trimmed);
          }
        };
        const appendBoolean = (field: string, value?: boolean | null) => {
          if (typeof value === 'boolean') {
            formData.append(field, value ? 'true' : 'false');
          }
        };
        const appendListField = (field: string, values?: string[] | null) => {
          const normalized = (values ?? []).map((item) => String(item ?? '').trim()).filter(Boolean);
          if (!normalized.length) {
            return;
          }
          normalized.forEach((item) => formData.append(field, item));
        };
        appendIfValue('sku', payload.sku);
        appendIfValue('slug', payload.slug);
        appendIfValue('brand', payload.brand);
        appendIfValue('condition', payload.condition);
        appendIfValue('sale_price', payload.sale_price ?? payload.salePrice);
        appendIfValue('compare_at_price', payload.compare_at_price ?? payload.compareAtPrice);
        appendIfValue('material', payload.material);
        appendIfValue('fit', payload.fit);
        appendIfValue('size_guide', payload.size_guide ?? payload.sizeGuide);
        appendListField(
          'available_sizes',
          payload.available_sizes ?? payload.availableSizes ?? payload.availableSizesList,
        );
        appendListField(
          'available_colors',
          payload.available_colors ?? payload.availableColors ?? payload.availableColorsList,
        );
        appendIfValue('weight', payload.weight);
        appendIfValue('length', payload.length);
        appendIfValue('width', payload.width);
        appendIfValue('height', payload.height);
        appendIfValue(
          'low_stock_threshold',
          payload.low_stock_threshold ?? payload.lowStockThreshold,
        );
        appendBoolean('is_active', payload.is_active ?? payload.isActive);
        appendBoolean('is_featured', payload.is_featured ?? payload.isFeatured);
        appendBoolean(
          'requires_shipping',
          payload.requires_shipping ?? payload.requiresShipping,
        );
        appendBoolean(
          'pickup_available',
          payload.pickup_available ?? payload.pickupAvailable,
        );
        appendBoolean(
          'allow_backorder',
          payload.allow_backorder ?? payload.allowBackorder,
        );
        formData.append('variants', JSON.stringify(payload.variants ?? []));
        const attributesPayload = payload.attributes ?? {};
        formData.append('attributes', JSON.stringify(attributesPayload));

        const selectedImages: PickedImage[] = Array.isArray(payload.images)
          ? payload.images
          : Array.isArray(payload.gallery_images)
            ? payload.gallery_images
            : [];
        const uploads = selectedImages.filter((image) => isLocalImageUri(image.uri));
        if (!payload.id && uploads.length === 0) {
          throw new Error('Please add at least one image for the product.');
        }
        if (uploads.length) {
          const [primary, ...rest] = uploads;
          formData.append('image_file', toUploadFile(primary) as any);
          rest.forEach((image) => formData.append('images', toUploadFile(image) as any));
        }
        if (payload.main_image && isLocalImageUri(payload.main_image.uri)) {
          formData.append('main_image', toUploadFile(payload.main_image) as any);
        }

        const endpoint = payload.id
          ? `${ROUTES.commerce.products}${payload.id}/`
          : ROUTES.commerce.products;
        const response = payload.id
          ? await patchRequest(endpoint, formData, { errorMessage: 'Unable to update product.' })
          : await postRequest(endpoint, formData, { errorMessage: 'Unable to add product.' });
        if (!response?.success) {
          throw new Error(response?.message || 'Unable to save product.');
        }
        await loadProducts();
        Alert.alert('Products', payload.id ? 'Product updated.' : 'Product created.');
        closeProductEditor();
      } catch (error: any) {
        Alert.alert('Products', error?.message || 'Unable to save product listing.');
      } finally {
        setProductLoading(false);
      }
    },
    [closeProductEditor, shop?.id],
  );

  const handleProductRating = useCallback(
    async (productId: string, score: number) => {
      const response = await postRequest(
        ROUTES.commerce.productRatings,
        { product: productId, score },
        { errorMessage: 'Unable to submit rating.' },
      );
      if (!response?.success) {
        throw new Error(response?.message || 'Unable to submit rating.');
      }
      await loadProducts();
    },
    [loadProducts],
  );

  const handleProductBroadcast = useCallback(
    async (product: any, currentlyBroadcasted: boolean, isService = false) => {
      if (!product?.id) return;
      setBroadcastingProductId(product.id);
      try {
        const endpoint = isService
          ? ROUTES.commerce.shopServiceBroadcast(product.id)
          : ROUTES.commerce.productBroadcast(product.id);
        const response = currentlyBroadcasted
          ? await deleteRequest(endpoint, { errorMessage: 'Unable to remove broadcast.' })
          : await postRequest(endpoint, {}, {
              errorMessage: isService ? 'Unable to broadcast service.' : 'Unable to broadcast product.',
            });
        if (!response?.success) {
          throw new Error(response?.message || 'Unable to update broadcast status.');
        }
        const newBroadcastedState = !currentlyBroadcasted;
        if (isService) {
          updateServiceBroadcastStateLocal(product.id, newBroadcastedState);
        } else {
          updateProductBroadcastStateLocal(product.id, newBroadcastedState);
        }
        const refreshers = [loadProducts()];
        if (isService) {
          refreshers.push(loadShopServices());
        }
        await Promise.all(refreshers);
        DeviceEventEmitter.emit('broadcast.refresh');
        const message = currentlyBroadcasted ? 'Broadcast removed.' : isService ? 'Service broadcasted.' : 'Product broadcasted.';
        Alert.alert(isService ? 'Services' : 'Products', message);
      } catch (error: any) {
        Alert.alert(isService ? 'Services' : 'Products', error?.message || 'Unable to update broadcast status.');
      } finally {
        setBroadcastingProductId(null);
      }
    },
    [loadProducts, loadShopServices, updateServiceBroadcastStateLocal],
  );

  const handleServiceSave = useCallback(
    async (payload: any) => {
      if (!shop?.id) {
        Alert.alert('Services', 'Link a shop before saving services.');
        return;
      }
      const trimmedName = String(payload.name ?? '').trim();
      if (!trimmedName) {
        Alert.alert('Services', 'Provide a name for the service.');
        return;
      }
      const normalizedCategoryIds = (Array.isArray(payload.categoryIds) ? payload.categoryIds : [])
        .map((id) => String(id ?? '').trim())
        .filter(Boolean)
        .slice(0, 5);
      if (!normalizedCategoryIds.length) {
        Alert.alert('Services', 'Please select at least one category.');
        return;
      }
      setServiceLoading(true);
      try {
        const formData = new FormData();
        const appendTrimmed = (field: string, value?: string | number | null) => {
          const trimmed = value === undefined || value === null ? '' : String(value).trim();
          if (trimmed) {
            formData.append(field, trimmed);
          }
        };
        const appendBoolean = (field: string, value?: boolean | null) => {
          if (typeof value === 'boolean') {
            formData.append(field, value ? 'true' : 'false');
          }
        };
        const appendStringList = (field: string, value?: unknown) => {
          const items = Array.isArray(value)
            ? value.map((item) => String(item ?? '').trim()).filter(Boolean)
            : [];
          items.forEach((item) => formData.append(field, item));
        };
        const toServicePackagePayload = (item: any) => ({
          id: item?.id,
          name: String(item?.name ?? '').trim(),
          description: String(item?.description ?? '').trim(),
          price: String(item?.price ?? '').trim(),
          duration_minutes: Number(String(item?.durationMinutes ?? '').trim() || 0),
          revisions: Number(String(item?.revisions ?? '').trim() || 0),
        });
        const toServiceAddonPayload = (item: any) => ({
          id: item?.id,
          name: String(item?.name ?? '').trim(),
          description: String(item?.description ?? '').trim(),
          price: String(item?.price ?? '').trim(),
        });
        const toServiceRequirementPayload = (item: any) => ({
          id: item?.id,
          label: String(item?.label ?? '').trim(),
          type: String(item?.type ?? 'text').trim() || 'text',
          required: Boolean(item?.required),
        });
        formData.append('shop', shop.id);
        formData.append('name', trimmedName);
        const slugBase = trimmedName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '') || `service-${Date.now()}`;
        formData.append('slug', slugBase);
        const description = String(payload.description ?? '').trim();
        formData.append('description', description);
        const priceValue = String(payload.price ?? '').trim();
        formData.append('price', priceValue || '0');
        appendTrimmed('short_summary', payload.shortSummary);
        appendTrimmed('pricing_model', payload.pricingModel);
        appendTrimmed('compare_at_price', payload.compareAtPrice);
        appendTrimmed('deposit_amount', payload.depositAmount);
        appendTrimmed('deposit_percent', payload.depositPercent);
        appendTrimmed('minimum_charge', payload.minimumCharge);
        appendTrimmed('duration_minutes', payload.durationMinutes);
        appendTrimmed('prep_buffer_minutes', payload.prepBufferMinutes);
        appendTrimmed('cleanup_buffer_minutes', payload.cleanupBufferMinutes);
        appendTrimmed('turnaround_hours', payload.turnaroundHours);
        appendTrimmed('max_bookings_per_slot', payload.maxBookingsPerSlot);
        appendTrimmed('max_participants', payload.maxParticipants);
        appendTrimmed('staff_required', payload.staffRequired);
        appendTrimmed('min_notice_hours', payload.minNoticeHours);
        appendTrimmed('max_advance_booking_days', payload.maxAdvanceBookingDays);
        appendTrimmed('cancellation_window_hours', payload.cancellationWindowHours);
        appendTrimmed('reschedule_window_hours', payload.rescheduleWindowHours);
        appendTrimmed('remote_meeting_link', payload.remoteMeetingLink);
        appendTrimmed('address_line1', payload.addressLine1);
        appendTrimmed('address_line2', payload.addressLine2);
        appendTrimmed('city', payload.city);
        appendTrimmed('state', payload.state);
        appendTrimmed('country', payload.country);
        appendTrimmed('postal_code', payload.postalCode);
        appendTrimmed('travel_radius_km', payload.travelRadiusKm);
        appendTrimmed('timezone', payload.timezone);
        appendTrimmed('refund_policy', payload.refundPolicy);
        appendTrimmed('warranty_policy', payload.warrantyPolicy);
        appendTrimmed('service_terms', payload.serviceTerms);
        appendTrimmed('seo_title', payload.seoTitle);
        appendTrimmed('seo_description', payload.seoDescription);
        appendTrimmed('visibility', payload.visibility);
        appendTrimmed('status', payload.draft ? 'draft' : payload.status);
        appendBoolean('negotiable', payload.negotiable);
        appendBoolean('tax_inclusive', payload.taxInclusive);
        appendBoolean('quote_required', payload.quoteRequired);
        appendBoolean('group_booking_allowed', payload.groupBookingAllowed);
        appendBoolean('allow_multiple_attendees_per_slot', payload.allowMultipleAttendeesPerSlot);
        appendBoolean('auto_confirm_booking', payload.autoConfirmBooking);
        appendBoolean('approval_required', payload.approvalRequired);
        appendBoolean('featured', payload.featured);
        appendBoolean('is_featured', payload.featured);
        appendBoolean('remove_featured_image', payload.remove_featured_image);
        normalizedCategoryIds.forEach((categoryId) => {
          formData.append('category_ids', categoryId);
          formData.append('catalog_category_ids', categoryId);
        });
        const primaryCategoryId = normalizedCategoryIds[0];
        if (primaryCategoryId) {
          formData.append('category_id', primaryCategoryId);
        }
        const availabilityValue = serializeJsonField(payload.availability ?? '');
        if (availabilityValue) {
          formData.append('availability', availabilityValue);
        }
        appendStringList('delivery_modes', payload.deliveryModes);
        appendStringList('coverage', payload.coverage);
        appendStringList('remote_regions', payload.remoteRegions);
        appendStringList('tags', payload.tags);
        appendStringList('blackout_dates', payload.blackoutDates);
        appendStringList('remove_image_ids', payload.remove_image_ids);
        const serviceTypeValue = String(payload.serviceType ?? '').trim();
        if (serviceTypeValue) {
          formData.append('service_type', serviceTypeValue);
        }
        const normalizedAvailabilityRules = normalizeAvailabilityRulesPayload(payload.availabilityRules);
        formData.append('availability_rules', JSON.stringify(normalizedAvailabilityRules));
        const parsePercentage = (value: string | number | null | undefined) => {
          if (value === null || value === undefined || value === '') return undefined;
          const candidate = Number(String(value).trim());
          if (!Number.isFinite(candidate)) return undefined;
          return Math.min(100, Math.max(0, candidate));
        };
        const percentageDiscount = parsePercentage(payload.otherShopsDiscount);
        if (percentageDiscount !== undefined) {
          formData.append('other_shops_discount', String(percentageDiscount));
        }
        formData.append(
          'packages',
          JSON.stringify(
            (Array.isArray(payload.packages) ? payload.packages : [])
              .map(toServicePackagePayload)
              .filter((item) => item.name),
          ),
        );
        formData.append(
          'addons',
          JSON.stringify(
            (Array.isArray(payload.addons) ? payload.addons : [])
              .map(toServiceAddonPayload)
              .filter((item) => item.name),
          ),
        );
        formData.append(
          'requirements',
          JSON.stringify(
            (Array.isArray(payload.requirements) ? payload.requirements : [])
              .map(toServiceRequirementPayload)
              .filter((item) => item.label),
          ),
        );

        const featuredImage = payload.featuredImageAsset;
        const featuredUpload =
          featuredImage && isLocalImageUri(featuredImage.uri)
            ? featuredImage
            : null;
        const selectedImages: PickedImage[] = Array.isArray(payload.gallery_images)
          ? payload.gallery_images
          : Array.isArray(payload.images)
            ? payload.images
            : [];
        const galleryUploads = selectedImages.filter((image) => isLocalImageUri(image.uri));
        const effectiveFeaturedUpload = featuredUpload ?? galleryUploads[0] ?? null;
        const effectiveGalleryUploads = effectiveFeaturedUpload
          ? galleryUploads.filter((image) => image.uri !== effectiveFeaturedUpload.uri)
          : galleryUploads;
        if (!payload.id && !effectiveFeaturedUpload && effectiveGalleryUploads.length === 0) {
          throw new Error('Please add at least one image for the service.');
        }
        if (effectiveFeaturedUpload) {
          formData.append('image_file', toUploadFile(effectiveFeaturedUpload) as any);
        }
        effectiveGalleryUploads.forEach((image) => formData.append('images', toUploadFile(image) as any));

        const endpoint = payload.id
          ? ROUTES.commerce.shopService(payload.id)
          : ROUTES.commerce.shopServices;
        const response = payload.id
          ? await patchRequest(endpoint, formData, { errorMessage: 'Unable to update service.' })
          : await postRequest(endpoint, formData, { errorMessage: 'Unable to add service.' });
        if (!response?.success) {
          throw new Error(response?.message || 'Unable to save service.');
        }
        await Promise.all([loadShopServices(), loadShopDetails()]);
        Alert.alert('Services', `${trimmedName ? 'Saved' : 'Draft saved'} service listing.`);
        closeServiceEditor();
      } catch (error: any) {
        Alert.alert('Services', error?.message || 'Unable to save service listing.');
      } finally {
        setServiceLoading(false);
      }
    },
    [closeServiceEditor, loadShopDetails, loadShopServices, shop?.id],
  );

  const handleServiceDelete = useCallback(
    async (serviceId: string) => {
      if (!serviceId) return;
      setServiceLoading(true);
      try {
        const response = await deleteRequest(ROUTES.commerce.shopService(serviceId), {
          errorMessage: 'Unable to delete service.',
        });
        if (!response?.success) {
          throw new Error(response?.message || 'Unable to delete service.');
        }
        Alert.alert('Services', 'Service deleted successfully.');
        await loadShopServices();
      } catch (error: any) {
        Alert.alert('Services', error?.message || 'Unable to delete service.');
      } finally {
        setServiceLoading(false);
      }
    },
    [loadShopServices],
  );

  const confirmServiceDelete = useCallback(
    (serviceId: string, serviceName?: string) => {
      if (!serviceId) return;
      Alert.alert(
        'Delete service',
        `Are you sure you want to delete ${serviceName ? `${serviceName}` : 'this service'}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: () => handleServiceDelete(serviceId) },
        ],
      );
    },
    [handleServiceDelete],
  );

  const handleOpenLandingPage = () => {
    navigation.navigate('ProfileLandingEditor', {
      kind: 'market',
      profileLabel: `${shop?.name || 'Shop'} landing page`,
      shopId: shop?.id,
      shopName: shop?.name,
    });
  };

  const renderOverviewTab = () => (
    <View style={{ gap: 14 }}>
      <View style={[styles.card, { backgroundColor: palette.surface }]}>
        <Text style={[styles.cardTitle, { color: palette.text }]}>Overview</Text>
        <Text style={[styles.meta, { color: palette.subtext }]}>
          Operate with clarity, insight, and confidence.
        </Text>
        <View style={styles.statRow}>
          {overviewStats.map((stat) => (
            <View key={stat.label} style={styles.statItem}>
              <Text style={[styles.statValue, { color: palette.text }]}>{stat.value}</Text>
              <Text style={[styles.statLabel, { color: palette.subtext }]}>{stat.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: palette.surface }]}>
        <Text style={[styles.cardTitle, { color: palette.text }]}>Orders & bookings summary</Text>
        <View style={styles.gridRow}>
          {orderSummary.map((stat) => (
            <View key={stat.label} style={styles.gridItem}>
              <Text style={[styles.statValue, { color: palette.text }]}>{stat.value}</Text>
              <Text style={[styles.statLabel, { color: palette.subtext }]}>{stat.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: palette.surface }]}>
        <Text style={[styles.cardTitle, { color: palette.text }]}>Activity feed</Text>
        {activityFeed.slice(0, 4).map((item) => (
          <View key={item.id} style={styles.activityItem}>
            <Text style={[styles.cardTitle, { fontSize: 16, color: palette.text }]}>{item.title}</Text>
            <Text style={[styles.meta, { color: palette.subtext }]}>{item.detail}</Text>
            <Text style={[styles.meta, { color: palette.primaryStrong, fontSize: 12 }]}>{item.time}</Text>
          </View>
        ))}
      </View>

      <View style={[styles.card, { backgroundColor: palette.surface }]}>
        <Text style={[styles.cardTitle, { color: palette.text }]}>Smart insights</Text>
        {insights.map((insight) => (
          <View key={insight.title} style={styles.insightRow}>
            <Text style={[styles.statLabel, { color: palette.text }]}>{insight.title}</Text>
            <Text style={[styles.meta, { color: palette.subtext }]}>{insight.detail}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  const renderProductsTab = () => (
    <View style={{ gap: 12 }}>
      {/** Ensure we show shop landing link only when landing page is public */}
      {safeProducts.length ? (
        safeProducts.map((product) => {
          const broadcasted = isProductBroadcasted(product);
          return (
            <ProductCard
              key={product.id ?? product.sku ?? product.name}
              product={product}
              palette={palette}
              onEdit={() => openProductEditor('edit', product)}
              onDelete={() => Alert.alert('Products', 'Delete flow coming soon.')}
              onRate={(score) => {
                if (!product.id) {
                  return Promise.reject(new Error('Invalid product'));
                }
                return handleProductRating(product.id, score);
              }}
              onBroadcast={handleProductBroadcast}
              memberDiscount={memberDiscount}
              isBroadcasted={broadcasted}
              landingPublic={landingPublic}
              shopName={shop?.name ?? 'Shop'}
              onOpenLanding={openShopLandingPage}
              broadcastLoading={broadcastingProductId === product.id}
            />
          );
        })
      ) : (
        <View style={[styles.emptyCard, { borderColor: palette.divider, backgroundColor: palette.card }]}>
          <Text style={[styles.emptyLabel, { color: palette.subtext }]}>No products yet.</Text>
          <KISButton title="Add product" onPress={() => openProductEditor('create')} />
        </View>
      )}
      <View style={{ alignItems: 'center' }}>
        <KISButton title="Add product" size="sm" variant="outline" onPress={() => openProductEditor('create')} />
      </View>
    </View>
  );

  const renderServicesTab = () => (
    <View style={{ gap: 12 }}>
        {safeServices.length ? (
          safeServices.map((service) => {
            const serviceId = service?.id ? String(service.id) : '';
            const existingBooking = serviceId ? bookingByService[serviceId] : null;
            return (
              <ProductCard
                key={service.id ?? service.slug ?? service.name}
                product={service}
                palette={palette}
                onEdit={() => openServiceEditor('edit', service)}
                onDelete={() => confirmServiceDelete(service.id, service.name)}
                onRate={(score) => {
                  if (!service?.id) {
                    return Promise.reject(new Error('Invalid service'));
                  }
                  return handleProductRating(service.id, score);
                }}
                onBroadcast={handleProductBroadcast}
                memberDiscount={memberDiscount}
                isBroadcasted={isServiceBroadcasted(service)}
                broadcastLoading={broadcastingProductId === service.id}
                landingPublic={landingPublic}
                shopName={shop?.name ?? 'Shop'}
                onOpenLanding={openShopLandingPage}
                isService
                onBook={() => openServiceBooking(service.id, service.name)}
                existingBooking={existingBooking}
                onOpenBookingDetails={openBookingDetails}
              />
            );
          })
      ) : (
        <View style={[styles.emptyCard, { borderColor: palette.divider, backgroundColor: palette.card }]}> 
          <Text style={[styles.emptyLabel, { color: palette.subtext }]}>No services yet.</Text>
          <KISButton title="Add service" onPress={() => openServiceEditor('create')} />
        </View>
      )}
      <View style={{ alignItems: 'center' }}>
        <KISButton title="Add service" size="sm" variant="outline" onPress={() => openServiceEditor('create')} />
      </View>
    </View>
  );

  const renderMembersTab = () => (
    <View style={{ gap: 16 }}>
      <View style={[styles.card, { backgroundColor: palette.surface }]}>
        <Text style={[styles.cardTitle, { color: palette.text }]}>Member discount rule</Text>
        <Text style={[styles.meta, { color: palette.subtext }]}>Members always receive at least 5% off.</Text>
        <Slider
          style={{ width: '100%', height: 40 }}
          minimumValue={5}
          maximumValue={100}
          step={1}
          value={memberDiscount}
          minimumTrackTintColor={palette.primaryStrong}
          maximumTrackTintColor={palette.inputBorder}
          onValueChange={(value) => setMemberDiscount(clampPercentage(value))}
        />
        <Text style={[styles.meta, { color: palette.subtext }]}>Current discount: {memberDiscount}%</Text>
        <KISButton
          title="Save discount"
          size="sm"
          loading={discountSaving}
          onPress={() => handleSaveDiscount(clampPercentage(memberDiscount))}
        />
        <KISButton
          title={membershipPublic ? 'Set membership private' : 'Make membership public'}
          size="sm"
          variant={membershipPublic ? 'outline' : 'secondary'}
          loading={membershipPublicSaving}
          onPress={toggleMembershipVisibility}
        />
      </View>

      <View style={[styles.card, { backgroundColor: palette.surface }]}>
        <Text style={[styles.cardTitle, { color: palette.text }]}>Member perks</Text>
        <View style={styles.sectionRow}>
          {['Priority offers', 'Free delivery', 'Service slots', 'Exclusive buys'].map((perk) => (
            <View key={perk} style={[styles.sectionPill, { borderColor: palette.divider }]}>
              <Text style={{ color: palette.text, fontSize: 12 }}>{perk}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: palette.surface }]}> 
        <Text style={[styles.cardTitle, { color: palette.text }]}>Members</Text>
        <View style={[styles.sectionRow, { justifyContent: 'space-between', marginTop: 10, flexWrap: 'wrap', gap: 12 }]}> 
          <View>
            <Text style={[styles.meta, { color: palette.subtext }]}>Owner</Text>
            <Text style={[styles.cardTitle, { color: palette.text }]}>
              {owner ? formatMemberTitle(owner) : 'No owner yet'}
            </Text>
          </View>
          <View>
            <Text style={[styles.meta, { color: palette.subtext }]}>Managers</Text>
            <Text style={[styles.cardTitle, { color: palette.text }]}>{managers.length}</Text>
          </View>
          <View>
            <Text style={[styles.meta, { color: palette.subtext }]}>Admins</Text>
            <Text style={[styles.cardTitle, { color: palette.text }]}>{admins.length}</Text>
          </View>
          <View>
            <Text style={[styles.meta, { color: palette.subtext }]}>Members</Text>
            <Text style={[styles.cardTitle, { color: palette.text }]}>{members.length}</Text>
          </View>
        </View>
        <View style={[styles.actionRow, styles.memberActionRow]}>
          <KISButton
            title="Add member from contacts"
            size="sm"
            variant="outline"
            onPress={() => setContactsPickerOpen(true)}
            loading={addingMember}
            disabled={!canManageMembers}
          />
          {!canManageMembers && (
            <Text style={[styles.meta, { color: palette.subtext }]}>
              Only owners and managers can invite or remove members.
            </Text>
          )}
        </View>
        {membersLoading ? (
          <ActivityIndicator size="small" color={palette.primaryStrong} style={{ marginTop: 12 }} />
        ) : safeMembers.length ? (
          safeMembers.map((member) => {
            const user = member?.user_details ?? member?.user ?? {};
            const memberId = member?.id ?? '';
            const sliderValue = memberId
              ? roleSliderValues[memberId] ?? ROLE_POSITION_MAP[member?.role ?? 'member'] ?? 100
              : ROLE_POSITION_MAP[member?.role ?? 'member'] ?? 100;
            const isOwner = member?.role === 'owner';
            return (
              <View
                key={memberId || user.id || user.phone || 'member'}
                style={[styles.memberRow, { marginTop: 12 }]}
              >
                <View>
                  <Text style={[styles.cardTitle, { color: palette.text }]} numberOfLines={1}>
                    {user.display_name ?? 'Member'}
                  </Text>
                  <Text style={[styles.meta, { color: palette.subtext }]}>
                    {user.phone ?? user.email ?? 'No contact info'}
                  </Text>
                </View>
                <View style={styles.memberSliderRow}>
                  <Slider
                    minimumValue={0}
                    maximumValue={100}
                    step={50}
                    value={sliderValue}
                    minimumTrackTintColor={palette.primaryStrong}
                    maximumTrackTintColor={palette.inputBorder}
                    thumbTintColor={palette.primaryStrong}
                    onValueChange={(value) => {
                      if (!memberId) return;
                      setRoleSliderValues((prev) => ({ ...prev, [memberId]: value }));
                    }}
                    onSlidingComplete={(value) => {
                      if (!memberId) return;
                      const normalized = Math.round(value / 50) * 50;
                      const targetRole = POSITION_ROLE_MAP[normalized] ?? 'member';
                      if (targetRole !== member?.role) {
                        handleUpdateMemberRole(memberId, targetRole);
                      }
                    }}
                    disabled={!canManageMembers || isOwner}
                    style={{ width: 160 }}
                  />
                  <View style={styles.sliderLabelsRow}>
                    <Text style={[styles.sliderLabel, { color: palette.subtext }]}>Manager</Text>
                    <Text style={[styles.sliderLabel, { color: palette.subtext }]}>Admin</Text>
                    <Text style={[styles.sliderLabel, { color: palette.subtext }]}>Member</Text>
                  </View>
                  <Text style={[styles.meta, { color: palette.subtext }]}>
                    {isOwner ? 'Owner' : getRoleLabel(member?.role)}
                  </Text>
                  {canManageMembers && !isOwner && (
                    <KISButton
                      title="Remove"
                      size="xs"
                      variant="danger"
                      onPress={() => handleRemoveMember(memberId)}
                      loading={removingMemberId === memberId}
                    />
                  )}
                </View>
              </View>
            );
          })
        ) : (
          <Text style={[styles.meta, { color: palette.subtext, marginTop: 8 }]}>
            No members added yet.
          </Text>
        )}
        {!membershipPublic && (
          <View style={{ marginTop: 12 }}>
            <Text style={[styles.meta, { color: palette.subtext }]}>
              Membership is closed. Invite registered contacts to the shop.
            </Text>
          </View>
        )}
      </View>
    </View>
  );

  const renderAnalyticsTab = () => (
    <View style={{ gap: 14 }}>
      <View style={[styles.card, { backgroundColor: palette.surface }]}>
        <Text style={[styles.cardTitle, { color: palette.text }]}>Analytics snapshot</Text>
        <View style={styles.statRow}>
          {[
            { label: 'Landing visits', value: metrics.landing },
            { label: 'Conversion', value: `${metrics.conversion}%` },
            { label: 'Repeat buyers', value: metrics.repeat },
            { label: 'Members online', value: safeMembers.length },
          ].map((stat) => (
            <View key={stat.label} style={styles.statItem}>
              <Text style={[styles.statValue, { color: palette.text }]}>{stat.value}</Text>
              <Text style={[styles.statLabel, { color: palette.subtext }]}>{stat.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: palette.surface }]}>
        <Text style={[styles.chartTitle, { color: palette.text }]}>Revenue trend</Text>
        <LineChart series={trendSeries} height={140} />
      </View>

      <View style={[styles.card, { backgroundColor: palette.surface }]}>
        <Text style={[styles.chartTitle, { color: palette.text }]}>Engagement breakdown</Text>
        <BarChart data={breakdownData} width={300} height={140} />
      </View>

      <View style={[styles.card, { backgroundColor: palette.surface, alignItems: 'center' }]}>
        <Text style={[styles.chartTitle, { color: palette.text }]}>Customer mix</Text>
        <DonutChart data={distributionData} size={150} />
      </View>

      {topProductItems.length ? (
        <TopItemsList title="Top products" items={topProductItems} />
      ) : null}
      {topServiceItems.length ? (
        <TopItemsList title="Top services" items={topServiceItems} />
      ) : null}

      <View style={[styles.card, { backgroundColor: palette.surface }]}>
        <Text style={[styles.cardTitle, { color: palette.text }]}>Global readiness</Text>
        <View style={styles.globalRow}>
          <Text style={[styles.globalLabel, { color: palette.subtext }]}>Languages</Text>
          <Text style={[styles.globalValue, { color: palette.text }]}>{globalReadiness.languages.join(', ')}</Text>
        </View>
        <View style={styles.globalRow}>
          <Text style={[styles.globalLabel, { color: palette.subtext }]}>Currencies</Text>
          <Text style={[styles.globalValue, { color: palette.text }]}>{globalReadiness.currencies.join(', ')}</Text>
        </View>
        <View style={styles.globalRow}>
          <Text style={[styles.globalLabel, { color: palette.subtext }]}>Regions</Text>
          <Text style={[styles.globalValue, { color: palette.text }]}>{globalReadiness.regions.join(', ')}</Text>
        </View>
        <View style={styles.globalRow}>
          <Text style={[styles.globalLabel, { color: palette.subtext }]}>Timezones</Text>
          <Text style={[styles.globalValue, { color: palette.text }]}>{globalReadiness.timezones.join(', ')}</Text>
        </View>
        <View style={styles.globalRow}>
          <Text style={[styles.globalLabel, { color: palette.subtext }]}>Delivery</Text>
          <Text style={[styles.globalValue, { color: palette.text }]}>{globalReadiness.deliveryModes.join(', ')}</Text>
        </View>
      </View>

    </View>
  );

  const renderLandingTab = () => (
    <View style={{ gap: 14 }}>
      <View style={[styles.card, { backgroundColor: palette.surface }]}>
        <Text style={[styles.cardTitle, { color: palette.text }]}>Landing page hero</Text>
        <Text style={[styles.meta, { color: palette.subtext }]}>
          {shop?.landing_page?.headline || 'Feature your most trusted offerings.'}
        </Text>
        <Text style={[styles.meta, { color: palette.subtext }]}>
          {shop?.landing_page?.subheadline || 'Add testimonials, highlights, and member-exclusive perks without code.'}
        </Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
          <View>
            <Text style={[styles.cardTitle, { color: palette.text, fontSize: 14 }]}>Landing visibility</Text>
            <Text style={[styles.meta, { color: palette.subtext, fontSize: 12 }]}>
              {landingPublic ? 'Landing page is visible to shoppers.' : 'Landing page is currently private.'}
            </Text>
          </View>
          {canToggleLandingVisibility ? (
            <KISButton
              title={landingPublic ? 'Set landing private' : 'Make landing public'}
              size="sm"
              variant={landingPublic ? 'outline' : 'secondary'}
              loading={landingVisibilitySaving}
              onPress={toggleLandingVisibility}
              disabled={landingVisibilitySaving}
            />
          ) : (
            <Text style={[styles.meta, { color: palette.subtext, fontSize: 12 }]}>
              Only the owner can set visibility.
            </Text>
          )}
        </View>
        <KISButton title="Edit landing page" variant="outline" onPress={handleOpenLandingPage} />
      </View>

      <View style={[styles.card, { backgroundColor: palette.surface }]}>
        <Text style={[styles.cardTitle, { color: palette.text }]}>Landing page sections</Text>
        <View style={styles.sectionRow}>
          {['Hero', 'Products', 'Services', 'Testimonials', 'Contact', 'FAQs'].map((section) => (
            <View key={section} style={[styles.sectionPill, { borderColor: palette.primaryStrong }]}>
              <Text style={{ color: palette.primaryStrong, fontSize: 12 }}>{section}</Text>
            </View>
          ))}
        </View>
        <Text style={[styles.meta, { color: palette.subtext }]}>
          Manage each section content, styles, and SEO separately per shop.
        </Text>
      </View>
    </View>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'products':
        return renderProductsTab();
      case 'services':
        return renderServicesTab();
      case 'members':
        return renderMembersTab();
      case 'analytics':
        return renderAnalyticsTab();
      case 'landing':
        return renderLandingTab();
      case 'overview':
      default:
        return renderOverviewTab();
    }
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: palette.bg }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.hero, { backgroundColor: palette.surface }]}>
          <View style={styles.heroRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.heroTitle, { color: palette.text }]}>{shop?.name}</Text>
              <Text style={[styles.meta, { color: palette.subtext }]}>
                {shop?.tagline || 'Build a premium global storefront.'}
              </Text>
              <Text style={[styles.meta, { color: palette.subtext }]}>
                {shop?.category || 'Global commerce'} · {(shop?.business_type ?? 'products').toString().toUpperCase()}
              </Text>
            </View>
            {heroImageUri ? (
              <Image
                source={{ uri: heroImageUri }}
                style={[
                  styles.heroImage,
                  { borderColor: palette.divider, backgroundColor: palette.inputBg },
                ]}
                resizeMode="cover"
              />
            ) : (
              <View
                style={[
                  styles.heroImageFallback,
                  { borderColor: palette.divider, backgroundColor: palette.inputBg },
                ]}
              >
                <KISIcon name="cart" size={32} color={palette.primaryStrong} />
              </View>
            )}
          </View>
        </View>

        <View style={styles.kpiRow}>
          {kpiCards.map((item) => (
            <View key={item.label} style={[styles.kpiCard, { backgroundColor: palette.card }]}>
              <Text style={[styles.kpiValue, { color: palette.text }]}>{item.value}</Text>
              <Text style={[styles.kpiLabel, { color: palette.subtext }]}>{item.label}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.tabBar, { backgroundColor: palette.surface }]}>
          {TAB_DEFINITIONS.map((tab) => (
            <Pressable key={tab.key} onPress={() => setActiveTab(tab.key)} style={styles.tabButton}>
              <Text
                style={{
                  color: activeTab === tab.key ? palette.primaryStrong : palette.subtext,
                  fontWeight: activeTab === tab.key ? '700' : '500',
                }}
              >
                {tab.label}
              </Text>
              {activeTab === tab.key && <View style={[styles.tabUnderline, { backgroundColor: palette.primaryStrong }]} />}
            </Pressable>
          ))}
        </View>

        <View style={styles.tabContent}>{renderTabContent()}</View>
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
            onSelectKISContact={handleAddMemberByContact}
          />
        </View>
      ) : null}
      <ProductEditorDrawer
        visible={productDrawerVisible}
        mode={productEditorMode}
        shop={shop}
        product={activeProduct}
        onClose={closeProductEditor}
        onSave={handleProductSave}
        loading={productLoading}
      />
      <ServiceEditorDrawer
        visible={serviceDrawerVisible}
        mode={serviceEditorMode}
        shop={shop}
        service={activeService}
        onClose={closeServiceEditor}
        onSave={handleServiceSave}
        loading={serviceLoading}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scroll: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  hero: {
    borderRadius: 24,
    padding: 20,
    gap: 12,
    minHeight: 140,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroImage: {
    width: 96,
    height: 96,
    borderRadius: 16,
    borderWidth: 1,
  },
  heroImageFallback: {
    width: 96,
    height: 96,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
  },
  heroActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  heroSecondaryActions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 6,
  },
  kpiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  kpiCard: {
    borderRadius: 18,
    padding: 14,
    flex: 1,
    minWidth: 140,
    borderWidth: 1,
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  meta: {
    fontSize: 13,
    fontWeight: '500',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  tabBar: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tabButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  tabUnderline: {
    marginTop: 4,
    height: 3,
    borderRadius: 2,
    width: '100%',
  },
  tabContent: {
    gap: 14,
  },
  emptyCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
    gap: 10,
  },
  emptyLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  productCard: {
    borderRadius: 22,
    borderWidth: 1.5,
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  productHero: {
    gap: 12,
  },
  productImageWrapper: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  productMainImage: {
    width: '100%',
    height: 210,
    borderRadius: 16,
  },
  thumbnailRow: {
    flexDirection: 'row',
    gap: 10,
  },
  thumbnailWrapper: {
    width: 64,
    height: 64,
    borderRadius: 12,
    borderWidth: 2,
    overflow: 'hidden',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  productInfo: {
    gap: 6,
  },
  productDescription: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
  },
  productMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
    flexWrap: 'wrap',
  },
  priceTag: {
    fontSize: 22,
    fontWeight: '700',
  },
  originalPrice: {
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'line-through',
    marginTop: 2,
  },
  discountBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  discountText: {
    fontSize: 12,
    fontWeight: '600',
  },
  fullscreenOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  fullscreenImage: {
    width: '100%',
    height: '80%',
    borderRadius: 16,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  star: {
    fontSize: 16,
  },
  ratingIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  ratingModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  ratingModalActions: {
    marginTop: 16,
    justifyContent: 'flex-end',
  },
  broadcastShopBadge: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  broadcastShopLabel: {
    fontSize: 18,
    fontWeight: '700',
  },
  broadcastShopBadgeLarge: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
  },
  broadcastShopLabelLarge: {
    fontSize: 20,
    fontWeight: '800',
  },
  memberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  statItem: {
    flex: 1,
    minWidth: 120,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  gridItem: {
    flex: 1,
    minWidth: 120,
  },
  activityItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#cccccc33',
    paddingVertical: 10,
  },
  insightRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#cccccc22',
  },
  sectionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  sectionPill: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  globalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  globalLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  globalValue: {
    fontSize: 13,
  },
  memberActionRow: {
    flexWrap: 'wrap',
    marginTop: 8,
  },
  memberSliderRow: {
    marginTop: 10,
    gap: 6,
  },
  sliderLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sliderLabel: {
    fontSize: 10,
  },
});
