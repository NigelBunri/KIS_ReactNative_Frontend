import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DeviceEventEmitter,
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useKISTheme } from '@/theme/useTheme';
import { resolveBackendAssetUrl } from '@/network';
import { getRequest } from '@/network/get';
import { deleteRequest } from '@/network/delete';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import type { RootStackParamList } from '@/navigation/types';
import KISButton from '@/constants/KISButton';
import { KISIcon } from '@/constants/kisIcons';
import { KIS_COIN_CODE, KIS_TO_USD_RATE } from '@/screens/market/market.constants';
import { resolveShopDescription, resolveShopImageUri } from '@/utils/shopAssets';
import { buildShopLandingPreview } from '@/utils/landingPreview';
import { useAuth } from '../../../../App';

type Props = {
  searchTerm?: string;
};

type MarketBroadcastItem = {
  id: string;
  source_type: string;
  source?: {
    name?: string;
    id?: string;
    type?: string;
    membership_open?: boolean;
    viewer_is_member?: boolean;
    membership_discount_pct?: number;
    landing_is_public?: boolean;
    landing_is_published?: boolean;
    landingIsPublished?: boolean;
    landing_page_is_public?: boolean;
    landing_page_is_published?: boolean;
    landingPageIsPublished?: boolean;
    landing_page?: {
      isPublished?: boolean;
      is_published?: boolean;
      is_public?: boolean;
      public?: boolean;
    };
  };
  product?: {
    id?: string;
    name?: string;
    description?: string;
    price?: string | number;
    currency?: string;
    rating_avg?: number | string;
    rating_count?: number | string;
    images?: string[];
  };
  service?: {
    id?: string;
    name?: string;
    short_summary?: string;
    description?: string;
    price?: string | number;
    currency?: string;
    service_type?: string;
    delivery_modes?: string[];
    duration_minutes?: number;
    coverage?: string[];
    availability_rules?: Array<{ targets?: string[]; times?: string[] }>;
    status?: string;
    visibility?: string;
    rating_avg?: number;
    rating_count?: number;
    images?: string[];
    membership_discount_pct?: number;
  };
  is_deleted?: boolean;
};

const DELIVERY_MODE_ICON_MAP: Record<string, string> = {
  onsite: 'map-pin',
  on_site: 'map-pin',
  onsite_visit: 'map-pin',
  remote: 'video',
  online: 'video',
  virtual: 'video',
  video: 'video',
  store: 'shop',
  shop: 'shop',
  delivery: 'truck',
  pickup: 'truck',
  shipping: 'truck',
};

const formatAvailabilityLabel = (rule?: { targets?: string[]; times?: string[] }) => {
  if (!rule) return 'Availability TBD';
  const date = rule.targets?.[0];
  const time = rule.times?.[0];
  const formattedDate = date ? new Date(date).toLocaleDateString() : null;
  if (formattedDate && time) return `${formattedDate} @ ${time}`;
  if (formattedDate) return formattedDate;
  if (time) return time;
  return 'Availability TBD';
};

const formatCoverageLabel = (coverage?: string[]) => {
  if (!coverage?.length) return 'Coverage unspecified';
  return coverage.slice(0, 3).join(', ');
};

type MarketPageNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'trending', label: 'Trending' },
  { key: 'drops', label: 'Drops' },
  { key: 'broadcasted', label: 'Broadcasted' },
];

const resolveProductImageUri = (value?: string | null) => {
  if (!value) return '';
  const trimmed = String(value).trim();
  if (!trimmed) return '';
  return resolveBackendAssetUrl(trimmed) ?? trimmed;
};

const resolveServiceGalleryUris = (images?: string[]) => {
  if (!Array.isArray(images)) return [];
  return [...new Set(images.filter(Boolean))]
    .map((uri) => resolveProductImageUri(uri))
    .filter(Boolean);
};

const isBroadcastActive = (item?: MarketBroadcastItem) => item && item.is_deleted === false;



const resolveShopLandingVisibility = (shop?: any) => {
  if (!shop) return false;
  const landing = shop?.landing_page ?? shop?.landingPage ?? {};
  return resolveLandingPublished(
    landing?.is_published,
    landing?.isPublished,
    landing?.is_public,
    landing?.public,
    shop?.landing_is_public,
    shop?.landing_is_published,
    shop?.landingPublic,
    shop?.landingPublished,
  );
};

const resolveLandingPublished = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return value !== 0;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['true', '1', 'yes', 'published', 'active'].includes(normalized)) return true;
      if (['false', '0', 'no', 'unpublished', 'inactive'].includes(normalized)) return false;
    }
  }
  return false;
};

const BroadcastProductCard = ({
  item,
  onRefresh,
  landingPublic,
  shopName,
  shopImageUri,
  shopDescription,
  onOpenLanding,
}: {
  item: MarketBroadcastItem;
  onRefresh?: () => void;
  landingPublic?: boolean;
  shopName?: string;
  shopImageUri?: string;
  shopDescription?: string;
  onOpenLanding?: () => void;
}) => {
  const { palette } = useKISTheme();
  const product = item.product;
  const source = item.source ?? {};
  const viewerIsMember = Boolean(source.viewer_is_member);
  const memberDiscount = Number(source.membership_discount_pct ?? 5);
  const membershipOpen = Boolean(source.membership_open);
  const priceValue = Number(product?.price ?? 0);
  const usdValue = Number.isFinite(priceValue) ? (priceValue * KIS_TO_USD_RATE).toFixed(2) : '0.00';
  const rating = Number.isFinite(Number(product?.rating_avg ?? 0)) ? Number(product?.rating_avg ?? 0) : 0;

  const images = useMemo(() => {
    const gallery = Array.isArray(product?.images) ? product.images.filter(Boolean) : [];
    return [...new Set(gallery)]
      .map((uri) => resolveProductImageUri(uri))
      .filter(Boolean);
  }, [product]);

  const [activeIndex, setActiveIndex] = useState(0);
  const [isFullscreenVisible, setFullscreenVisible] = useState(false);
  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [ratingDraft, setRatingDraft] = useState('5');
  const [ratingSaving, setRatingSaving] = useState(false);
  const [shopImageFailed, setShopImageFailed] = useState(false);

  useEffect(() => {
    setActiveIndex(0);
  }, [images.length]);

  useEffect(() => {
    setShopImageFailed(false);
  }, [shopImageUri]);

  const mainImage = images[activeIndex] ?? '';

  const closeRatingSheet = () => {
    setRatingDraft('5');
    setRatingModalVisible(false);
  };

  const [joiningMembership, setJoiningMembership] = useState(false);

  const handleRatingSubmit = async () => {
    const score = Math.min(5, Math.max(1, Number(ratingDraft) || 0));
    if (!score || !product?.id) return;
    setRatingSaving(true);
    try {
      const response = await postRequest(
        ROUTES.commerce.productRatings,
        { product: product.id, score },
        { errorMessage: 'Unable to submit rating.' },
      );
      if (!response?.success) {
        throw new Error(response?.message || 'Unable to submit rating.');
      }
      closeRatingSheet();
      onRefresh?.();
      Alert.alert('Rating', 'Rating submitted.');
    } catch (error: any) {
      Alert.alert('Rating', error?.message || 'Unable to submit rating.');
    } finally {
      setRatingSaving(false);
    }
  };

  return (
    <View style={[styles.productCard, { backgroundColor: palette.surface, borderColor: palette.primaryStrong }]}> 
      {landingPublic && (shopName || shopDescription) && onOpenLanding ? (
        <Pressable
          style={[
            styles.shopHeader,
            { borderColor: palette.divider, backgroundColor: `${palette.primaryStrong}10` },
          ]}
          onPress={onOpenLanding}
          hitSlop={{ top: 4, bottom: 4, left: 6, right: 6 }}
          accessibilityRole="button"
        >
          <View style={styles.shopHeaderInner}>
            {shopImageUri && !shopImageFailed ? (
              <Image
                source={{ uri: shopImageUri }}
                style={styles.shopHeaderImage}
                resizeMode="cover"
                onError={() => setShopImageFailed(true)}
              />
            ) : (
              <View style={[styles.shopIconFallback, { backgroundColor: `${palette.primaryStrong}22` }]}>
                <KISIcon name="cart" size={18} color={palette.primaryStrong} />
              </View>
            )}
            <View style={styles.shopHeaderText}>
              {shopName ? (
                <Text style={[styles.shopName, { color: palette.primaryStrong }]} numberOfLines={1}>
                  {shopName}
                </Text>
              ) : null}
              {shopDescription ? (
                <Text style={[styles.shopDescription, { color: palette.subtext }]} numberOfLines={2}>
                  {shopDescription}
                </Text>
              ) : null}
            </View>
          </View>
        </Pressable>
      ) : null}
      <View style={styles.productHero}>
        <Pressable
          onPress={() => mainImage && setFullscreenVisible(true)}
          disabled={!mainImage}
          style={{ borderRadius: 16, overflow: 'hidden' }}
        >
          {mainImage ? (
            <Image
              source={{ uri: mainImage }}
              style={[styles.productMainImage, { backgroundColor: palette.inputBg }]}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.productMainImage, { backgroundColor: palette.inputBg, justifyContent: 'center', alignItems: 'center' }]}> 
              <Text style={{ color: palette.subtext }}>No preview</Text>
            </View>
          )}
        </Pressable>

        {images.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbnailRow}>
            {images.map((uri, index) => {
              const isActive = index === activeIndex;
              return (
                <Pressable
                  key={`${uri}-${index}`}
                  onPress={() => setActiveIndex(index)}
                  style={[
                    styles.thumbnailWrapper,
                    { borderColor: isActive ? palette.primaryStrong : palette.divider },
                  ]}
                >
                  <Image source={{ uri }} style={styles.thumbnailImage} resizeMode="cover" />
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>
      <View style={styles.productInfo}>
        <Text style={[styles.productTitle, { color: palette.text }]} numberOfLines={2}>
          {product?.name ?? 'Untitled Product'}
        </Text>
        <Text style={[styles.productDescription, { color: palette.subtext }]} numberOfLines={3}>
          {product?.description ?? 'No description yet.'}
        </Text>
        <View style={styles.productMetaRow}>
          <View style={styles.priceRow}>
            <Text style={[styles.priceTag, { color: palette.primaryStrong }]}>{`${priceValue.toFixed(2)} ${KIS_COIN_CODE}`}</Text>
            <Text style={[styles.secondaryText, { color: palette.text, marginLeft: 6 }]}>≈ ${usdValue} USD</Text>
          </View>
          <View>
            <View
              style={[
                styles.statusBadge,
                {
                  borderColor: palette.primaryStrong,
                  backgroundColor: `${palette.primaryStrong}15`,
                },
              ]}
            >
              <Text style={[styles.statusLabel, { color: palette.primaryStrong }]}>
                {item.source_type === 'market_service' ? 'Service' : 'Product'}
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.memberBadge}>
          <Text style={[styles.memberBadgeText, { color: palette.primaryStrong }]}>
            {viewerIsMember
              ? `You save ${memberDiscount}% as a member`
              : `Members save ${memberDiscount}% — members only`}
          </Text>
        </View>
        <View style={[styles.ratingRow, { alignItems: 'center' }]}> 
          <Text style={[styles.secondaryText, { color: palette.text }]}>⭐ {rating.toFixed(1)} / 5</Text>
          {viewerIsMember && (
            <Pressable
              onPress={() => setRatingModalVisible(true)}
              style={[styles.rateAction, { borderColor: palette.primary }]}
            >
              <Text style={[styles.rateActionText, { color: palette.primaryStrong }]}>＋</Text>
            </Pressable>
          )}
        </View>
        {membershipOpen && !viewerIsMember && (
          <View style={{ marginTop: 10 }}>
            <KISButton
              title="Become a member"
              size="sm"
              loading={joiningMembership}
              onPress={() => {
                if (joiningMembership) return;
                Alert.alert('Join membership', 'Are you sure you want to become a member of this shop?', [
                  { text: 'No', style: 'cancel' },
                  {
                    text: 'Yes',
                    onPress: async () => {
                      if (!source.id) return;
                      setJoiningMembership(true);
                      try {
                        const response = await postRequest(
                          ROUTES.commerce.shopJoin(source.id),
                          {},
                          { errorMessage: 'Unable to join membership.' },
                        );
                        if (!response?.success) {
                          throw new Error(response?.message || 'Unable to join membership.');
                        }
                        Alert.alert('Membership', 'You are now a member of this shop.');
                        onRefresh?.();
                      } catch (error: any) {
                        Alert.alert('Membership', error?.message || 'Unable to join membership.');
                      } finally {
                        setJoiningMembership(false);
                      }
                    },
                  },
                ]);
              }}
            />
          </View>
        )}
      </View>

      <Modal visible={isFullscreenVisible} transparent animationType="fade">
        <Pressable style={styles.fullscreenOverlay} onPress={() => setFullscreenVisible(false)}>
          {mainImage ? (
            <Image
              source={{ uri: mainImage }}
              style={styles.fullscreenImage}
              resizeMode="contain"
            />
          ) : null}
        </Pressable>
      </Modal>

      <Modal visible={ratingModalVisible} transparent animationType="fade">
        <Pressable style={styles.ratingModalOverlay} onPress={closeRatingSheet}>
          <View
            style={[styles.ratingModalCard, { borderColor: palette.divider, backgroundColor: palette.surface }]}
            onStartShouldSetResponder={() => true}
            onResponderTerminationRequest={() => false}
          >
            <Text style={[styles.cardTitle, { color: palette.text, marginBottom: 6 }]}>Rate this product</Text>
            <Text style={[styles.secondaryText, { color: palette.subtext }]}>Tap to choose a star rating.</Text>
            <View style={[styles.ratingRow, { justifyContent: 'center', marginTop: 16 }]}> 
              {Array.from({ length: 5 }).map((_, index) => (
                <Pressable key={`market-star-${index}`} onPress={() => setRatingDraft(String(index + 1))} style={{ padding: 4 }}>
                  <Text
                    style={[
                      styles.ratingStar,
                      index < Number(ratingDraft) ? { color: palette.primaryStrong } : { color: palette.subtext },
                    ]}
                  >
                    ★
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.ratingModalActions}>
              <KISButton title="Submit" size="sm" loading={ratingSaving} onPress={handleRatingSubmit} />
              <KISButton title="Cancel" size="sm" variant="ghost" onPress={closeRatingSheet} />
            </View>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
};

const BroadcastServiceCard = ({
  item,
  onRefresh,
  landingPublic,
  shopName,
  shopImageUri,
  shopDescription,
  onOpenLanding,
  onBook,
  isBroadcasted,
  broadcastLoading,
  onBroadcast,
  existingBooking,
  onOpenBookingDetails,
}: {
  item: MarketBroadcastItem;
  onRefresh?: () => void;
  landingPublic?: boolean;
  shopName?: string;
  shopImageUri?: string;
  shopDescription?: string;
  onOpenLanding?: () => void;
  onBook?: () => void;
  isBroadcasted?: boolean;
  broadcastLoading?: boolean;
  onBroadcast?: (service: any, currentlyBroadcasted: boolean) => void;
  existingBooking?: any;
  onOpenBookingDetails?: (bookingId: string) => void;
}) => {
  const { palette } = useKISTheme();
  const service = item.service ?? {};
  const source = item.source ?? {};
  const gallery = useMemo(() => resolveServiceGalleryUris(service.images ?? []), [service.images]);
  const primaryImage = gallery[0] ?? '';
  const [activeImage, setActiveImage] = useState(primaryImage);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  useEffect(() => {
    setActiveImage(primaryImage);
  }, [service.id, primaryImage]);

  const priceValue = Number(service.price ?? 0);
  const usdValue = Number.isFinite(priceValue) ? (priceValue * KIS_TO_USD_RATE).toFixed(2) : '0.00';
  const comparePriceValue = Number(
    service.compare_at_price ??
      service.compareAtPrice ??
      service.compare_price ??
      service.comparePrice ??
      0,
  );
  const hasComparePrice = Number.isFinite(comparePriceValue) && comparePriceValue > priceValue;
  const rating = Number.isFinite(Number(service.rating_avg ?? 0)) ? Number(service.rating_avg ?? 0) : 0;
  const ratingCount = Number.isFinite(Number(service.rating_count ?? 0)) ? Number(service.rating_count ?? 0) : 0;

  const availabilitySummary = formatAvailabilityLabel(service.availability_rules?.[0]);
  const coverageLabel = formatCoverageLabel(service.coverage);
  const durationText = service.duration_minutes ? `${service.duration_minutes} min` : 'Duration TBD';
  const deliveryModes = Array.isArray(service.delivery_modes) ? service.delivery_modes : [];
  const serviceTypeLabel = String(service.service_type ?? 'Service').replace(/(^|\s)(\w)/g, (match) => match.toUpperCase());

  const viewerIsMember = Boolean(source.viewer_is_member);
  const memberDiscount = Number(source.membership_discount_pct ?? service.membership_discount_pct ?? 5);

  const openFullScreen = (uri: string) => {
    if (!uri) return;
    setFullscreenImage(uri);
  };

  return (
    <View style={[styles.productCard, { backgroundColor: palette.surface, borderColor: palette.primaryStrong }]}>
      {landingPublic && (shopName || shopDescription) && onOpenLanding ? (
        <Pressable
          style={[styles.shopHeader, { borderColor: palette.divider, backgroundColor: `${palette.primaryStrong}08` }]}
          onPress={onOpenLanding}
        >
          <View style={styles.shopHeaderInner}>
            {shopImageUri ? (
              <Image source={{ uri: shopImageUri }} style={styles.shopHeaderImage} />
            ) : (
              <View style={[styles.shopIconFallback, { backgroundColor: `${palette.primaryStrong}22` }]}>
                <KISIcon name="cart" size={16} color={palette.primaryStrong} />
              </View>
            )}
            <View style={styles.shopHeaderText}>
              <Text style={[styles.shopName, { color: palette.primaryStrong }]} numberOfLines={1}>
                {shopName ?? 'Shop'}
              </Text>
              {shopDescription ? (
                <Text style={[styles.shopDescription, { color: palette.subtext }]} numberOfLines={2}>
                  {shopDescription}
                </Text>
              ) : null}
            </View>
          </View>
        </Pressable>
      ) : null}
      <View style={styles.productHero}>
        <Pressable onPress={() => openFullScreen(activeImage)} style={styles.productImageWrapper}>
          {activeImage ? (
            <Image source={{ uri: activeImage }} style={[styles.productMainImage, { backgroundColor: palette.inputBg }]} resizeMode="cover" />
          ) : (
            <View style={[styles.productMainImage, styles.emptyImage, { backgroundColor: palette.inputBg }]}>
              <Text style={{ color: palette.subtext }}>No image yet</Text>
            </View>
          )}
        </Pressable>
        {gallery.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbnailRow}>
            {gallery.map((uri, index) => (
              <Pressable
                key={`${uri}-${index}`}
                onPress={() => setActiveImage(uri)}
                style={[
                  styles.thumbnailWrapper,
                  activeImage === uri
                    ? { borderColor: palette.primaryStrong }
                    : { borderColor: palette.divider },
                ]}
              >
                <Image source={{ uri }} style={styles.thumbnailImage} resizeMode="cover" />
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>
      <View style={styles.productInfo}>
        <View style={styles.productMetaRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.productTitle, { color: palette.text }]} numberOfLines={2}>
              {service.name ?? 'Untitled service'}
            </Text>
            <Text style={[styles.secondaryText, { color: palette.subtext }]}>
              {serviceTypeLabel}
            </Text>
          </View>
          <View style={[styles.statusBadge, { borderColor: palette.primaryStrong, backgroundColor: `${palette.primaryStrong}15` }]}> 
            <Text style={[styles.statusLabel, { color: palette.primaryStrong }]}>Service</Text>
          </View>
        </View>
        <Text style={[styles.productDescription, { color: palette.subtext }]} numberOfLines={2}>
          {service.short_summary ?? 'Short summary missing.'}
        </Text>
        {service.description ? (
          <Text style={[styles.secondaryText, { color: palette.subtext, marginTop: 4 }]} numberOfLines={2}>
            {service.description}
          </Text>
        ) : null}
        <View style={styles.productMetaRow}>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
              <Text style={[styles.priceTag, { color: palette.primaryStrong }]}>{`${priceValue.toFixed(2)} ${service.currency ?? KIS_COIN_CODE}`}</Text>
              {hasComparePrice ? (
                <Text style={[styles.comparePrice, { color: palette.subtext }]}>
                  {`${comparePriceValue.toFixed(2)} ${service.currency ?? KIS_COIN_CODE}`}
                </Text>
              ) : null}
            </View>
            <Text style={[styles.secondaryText, { color: palette.text }]}>≈ ${usdValue} USD</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 6 }}> 
            {deliveryModes.slice(0, 3).map((mode) => (
              <View key={mode} style={styles.deliveryIcon}>
                <KISIcon name={DELIVERY_MODE_ICON_MAP[mode.toLowerCase()] ?? 'map-pin'} size={16} color={palette.text} />
              </View>
            ))}
          </View>
        </View>
        <View style={styles.memberBadge}>
          <Text style={[styles.memberBadgeText, { color: palette.primaryStrong }]}> 
            {viewerIsMember
              ? `You save ${memberDiscount}% as a member`
              : `Members save ${memberDiscount}% — members only`}
          </Text>
        </View>
        <View style={styles.serviceMetaRow}> 
          <Text style={[styles.secondaryText, { color: palette.subtext }]}>Next availability · {availabilitySummary}</Text>
          <Text style={[styles.secondaryText, { color: palette.subtext }]}>Duration · {durationText}</Text>
          <Text style={[styles.secondaryText, { color: palette.subtext }]}>Coverage · {coverageLabel}</Text>
        </View>
        <View style={styles.ratingRow}>
          <Text style={[styles.secondaryText, { color: palette.text }]}>⭐ {rating.toFixed(1)} / 5</Text>
          <Text style={[styles.secondaryText, { color: palette.subtext, marginLeft: 6 }]}>
            ({ratingCount} review{ratingCount === 1 ? '' : 's'})
          </Text>
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
            {onBroadcast ? (
              <KISButton
                title={isBroadcasted ? 'Remove broadcast' : 'Broadcast'}
                size="xs"
                variant={isBroadcasted ? 'outline' : 'secondary'}
                onPress={() => onBroadcast?.(service, Boolean(isBroadcasted))}
                loading={broadcastLoading}
                disabled={broadcastLoading}
              />
            ) : null}
          </View>
        </View>
      </View>
      <Modal visible={Boolean(fullscreenImage)} transparent onRequestClose={() => setFullscreenImage(null)}>
        <Pressable style={styles.fullscreenOverlay} onPress={() => setFullscreenImage(null)}>
          {fullscreenImage ? (
            <Image source={{ uri: fullscreenImage }} style={styles.fullscreenImage} resizeMode="contain" />
          ) : null}
        </Pressable>
      </Modal>
    </View>
  );
};

export default function BroadcastMarketPage({ searchTerm = '' }: Props) {
  const { palette } = useKISTheme();
  const [marketItems, setMarketItems] = useState<MarketBroadcastItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState(FILTERS[0].key);
  const [broadcastingServiceId, setBroadcastingServiceId] = useState<string | null>(null);
  const navigation = useNavigation<MarketPageNavigationProp>();
  const [shopLandingVisibility, setShopLandingVisibility] = useState<Record<string, boolean>>({});
  const [shopDetailCache, setShopDetailCache] = useState<Record<string, any>>({});
  const { user } = useAuth();
  const [serviceBookings, setServiceBookings] = useState<any[]>([]);

  const fetchShopDetail = useCallback(async (shopId: string) => {
    try {
      const response = await getRequest(`${ROUTES.commerce.shops}${shopId}/`, {
        forceNetwork: true,
        errorMessage: 'Unable to load shop details.',
      });
      const data = response?.data ?? response ?? null;
      if (data) {
        setShopLandingVisibility((prev) => ({ ...prev, [shopId]: resolveShopLandingVisibility(data) }));
        setShopDetailCache((prev) => ({ ...prev, [shopId]: data }));
        return data;
      }
    } catch (error) {
      console.warn('Unable to refresh shop detail before opening landing preview:', error);
    }
    return shopDetailCache[shopId];
  }, []);

  const loadServiceBookings = useCallback(async () => {
    if (!user?.id) {
      setServiceBookings([]);
      return;
    }
    try {
      const res = await getRequest(ROUTES.commerce.serviceBookings, {
        errorMessage: 'Unable to load your bookings.',
        forceNetwork: true,
      });
      if (res?.success) {
        const payload = res.data ?? [];
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
      console.warn('Unable to load service bookings', error);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      void loadServiceBookings();
    }, [loadServiceBookings]),
  );

  useEffect(() => {
    void loadServiceBookings();
  }, [loadServiceBookings]);

  const bookingByService = useMemo(() => {
    const map: Record<string, any> = {};
    serviceBookings.forEach((booking) => {
      const serviceId =
        booking?.service_details?.id ||
        (booking?.service_id ? String(booking.service_id) : null) ||
        (booking?.service && typeof booking.service.id === 'string' ? booking.service.id : null) ||
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

  const openLandingForShop = useCallback(
    async (shopId?: string, shopName?: string) => {
      if (!shopId) return;
      const shopDetail = (await fetchShopDetail(shopId)) ?? shopDetailCache[shopId];
      const landingPage = shopDetail?.landing_page ?? shopDetail?.landingPage ?? {};
      const shopData = shopDetail ?? shopDetailCache[shopId];
      const { landingDraft, heroImage, previewGalleryImageUris } = buildShopLandingPreview(shopData ?? {});
      navigation.navigate('InstitutionLandingPreview', {
        institutionId: shopId,
        institutionName: shopName ?? shopData?.name ?? 'Shop',
        draft: landingDraft,
        previewHeroImageUri: heroImage || undefined,
        previewGalleryImageUris,
      });
    },
    [navigation, shopDetailCache, fetchShopDetail],
  );

  const openServiceBooking = useCallback(
    (serviceId?: string, serviceName?: string) => {
      if (!serviceId) return;
      navigation.navigate('ServiceBooking', { serviceId, serviceName });
    },
    [navigation],
  );

  const loadMarketBroadcasts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getRequest(`${ROUTES.broadcasts.list}?source_type=market_all`, {
        errorMessage: 'Unable to load market broadcast.',
      });
      console.log('Fetched market broadcasts:', res);
      const records = res?.data?.results ?? res?.data ?? res ?? [];
      const itemsArray = Array.isArray(records) ? records : [];
      setMarketItems(itemsArray);
      const affectedIds = Array.from(
        new Set(
          itemsArray
            .map((item) => item.source?.id)
            .filter((id): id is string => Boolean(id)),
        ),
      );
      if (affectedIds.length) {
        setShopLandingVisibility((prev) => {
          if (!Object.keys(prev).length) return prev;
          const next = { ...prev };
          affectedIds.forEach((id) => {
            if (next[id] !== undefined) {
              delete next[id];
            }
          });
          return next;
        });
        setShopDetailCache((prev) => {
          if (!Object.keys(prev).length) return prev;
          const next = { ...prev };
          affectedIds.forEach((id) => {
            if (next[id] !== undefined) {
              delete next[id];
            }
          });
          return next;
        });
      }
    } catch (error: any) {
      setMarketItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleServiceBroadcast = useCallback(
    async (serviceId: string, currentlyBroadcasted: boolean) => {
      if (!serviceId) return;
      setBroadcastingServiceId(serviceId);
      try {
        const endpoint = ROUTES.commerce.shopServiceBroadcast(serviceId);
        const response = currentlyBroadcasted
          ? await deleteRequest(endpoint, { errorMessage: 'Unable to remove service broadcast.' })
          : await postRequest(endpoint, {}, { errorMessage: 'Unable to broadcast service.' });
        if (!response?.success) {
          throw new Error(response?.message || 'Unable to update service broadcast.');
        }
        await loadMarketBroadcasts();
        DeviceEventEmitter.emit('broadcast.refresh');
        Alert.alert('Services', currentlyBroadcasted ? 'Service broadcast removed.' : 'Service broadcasted.');
      } catch (error: any) {
        Alert.alert('Services', error?.message || 'Unable to update broadcast status.');
      } finally {
        setBroadcastingServiceId(null);
      }
    },
    [loadMarketBroadcasts],
  );

  const refreshShopLandingVisibility = useCallback(async (shopIds: string[]) => {
    if (!shopIds.length) return;
    try {
      const responses = await Promise.allSettled(
        shopIds.map((id) =>
          getRequest(`${ROUTES.commerce.shops}${id}/`, {
            forceNetwork: true,
            errorMessage: 'Unable to load shop landing visibility.',
          }),
        ),
      );
      const visibilityUpdates: Record<string, boolean> = {};
      const detailUpdates: Record<string, any> = {};
      responses.forEach((result, index) => {
        if (result.status !== 'fulfilled') return;
        const data = result.value?.data ?? result.value;
        if (!data) return;
        const shopId = shopIds[index];
        console.log('checking shop items: ', data)
        visibilityUpdates[shopId] = resolveShopLandingVisibility(data);
        detailUpdates[shopId] = data;
      });
      if (Object.keys(visibilityUpdates).length) {
        setShopLandingVisibility((prev) => ({ ...prev, ...visibilityUpdates }));
      }
      if (Object.keys(detailUpdates).length) {
        setShopDetailCache((prev) => ({ ...prev, ...detailUpdates }));
      }
    } catch (error) {
      console.warn('Unable to refresh landing visibility for shops:', error);
    }
  }, []);

  useEffect(() => {
    loadMarketBroadcasts();
    const subscription = DeviceEventEmitter.addListener('broadcast.refresh', loadMarketBroadcasts);
    return () => subscription.remove();
  }, [loadMarketBroadcasts]);

  useEffect(() => {
    const ids = Array.from(
      new Set(
        marketItems
          .map((item) => item.source?.id)
          .filter((id): id is string => Boolean(id)),
      ),
    );
    const uncachedIds = ids.filter((id) => shopLandingVisibility[id] === undefined);
    if (uncachedIds.length) {
      void refreshShopLandingVisibility(uncachedIds);
    }
  }, [marketItems, refreshShopLandingVisibility, shopLandingVisibility]);

  const filteredProducts = useMemo(() => {
    let list = [...marketItems];
    if (activeFilter === 'trending') {
      list = list.filter((item) => Number(item.product?.rating_avg ?? 0) > 0);
    } else if (activeFilter === 'drops') {
      list = list.filter((item) => String(item.source?.name ?? '').toLowerCase().includes('drop'));
    }
    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      list = list.filter((item) => {
        const hay = `${item.product?.name ?? ''} ${item.product?.description ?? ''}`.toLowerCase();
        return hay.includes(term);
      });
    }
    return list;
  }, [marketItems, activeFilter, searchTerm]);

  console.log('BroadcastMarketPage render: marketItems count:', marketItems.length, 'filteredProducts count:', filteredProducts, 'activeFilter:', activeFilter, 'searchTerm:', searchTerm);
  return (
    <View style={[styles.container, { backgroundColor: palette.bg }]}>
      <View style={[styles.filterSection, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
        <Text style={[styles.filterHeading, { color: palette.text }]}>Filters</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChips}
        >
          {FILTERS.map((filter) => {
            const isActive = filter.key === activeFilter;
            return (
              <Pressable
                key={filter.key}
                style={[
                  styles.filterChip,
                  {
                    borderColor: isActive ? palette.primary : palette.divider,
                    backgroundColor: isActive ? palette.primarySoft : 'transparent',
                  },
                ]}
                onPress={() => setActiveFilter(filter.key)}
              >
                <Text style={{ color: isActive ? palette.primaryStrong : palette.text }}>
                  {filter.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <Text style={[styles.filterPreview, { color: palette.subtext }]}>
          {searchTerm ? `Showing results for “${searchTerm}”` : 'Browse broadcast products'}
        </Text>
      </View>
      {loading && !filteredProducts.length ? (
        <View style={styles.loader}>
          <ActivityIndicator color={palette.primaryStrong} />
        </View>
      ) : filteredProducts.length ? (
        <ScrollView contentContainerStyle={styles.productsList}>
          {filteredProducts.map((item, index) => {
            const source = item.source ?? {};
            const cachedLanding = source.id ? shopLandingVisibility[source.id] : undefined;
            const shopDetail = source.id ? shopDetailCache[source.id] : undefined;
            const landingPublic = cachedLanding ?? resolveShopLandingVisibility(shopDetail ?? source);
            const resolvedShopName = shopDetail?.name ?? source.name ?? 'Shop';
            const shopImageUri = resolveShopImageUri(shopDetail, source);
            const shopDescription = resolveShopDescription(shopDetail, source);
            const onOpenLanding = source.id && landingPublic ? () => openLandingForShop(source.id, resolvedShopName) : undefined;
            const shopName = landingPublic ? resolvedShopName : undefined;
            const service = item.service ?? {};
            const serviceIsBroadcasted = isBroadcastActive(item);
            const serviceId = service?.id ? String(service.id) : '';
            const bookingFromItem = item.booking;
            const existingBooking = serviceId
              ? bookingByService[serviceId] ?? bookingFromItem
              : bookingFromItem ?? null;
            if (item.source_type === 'market_service' && service?.id) {
              return (
                <View
                  key={`${item.id}-${index}`}
                  style={index === filteredProducts.length - 1 ? undefined : styles.cardSpacing}
                >
                  <BroadcastServiceCard
                    item={item}
                    onRefresh={loadMarketBroadcasts}
                    landingPublic={landingPublic}
                    shopName={shopName}
                    shopImageUri={shopImageUri}
                    shopDescription={shopDescription}
                    onOpenLanding={landingPublic ? onOpenLanding : undefined}
                    onBook={() => openServiceBooking(service.id, service.name)}
                    isBroadcasted={serviceIsBroadcasted}
                    broadcastLoading={broadcastingServiceId === service.id}
                    existingBooking={existingBooking}
                    onOpenBookingDetails={openBookingDetails}
                  />
                </View>
              );
            }
            return (
              <View
                key={`${item.id}-${index}`}
                style={index === filteredProducts.length - 1 ? undefined : styles.cardSpacing}
              >
                <BroadcastProductCard
                  item={item}
                  onRefresh={loadMarketBroadcasts}
                  landingPublic={landingPublic}
                  shopName={shopName}
                  shopImageUri={shopImageUri}
                  shopDescription={shopDescription}
                  onOpenLanding={landingPublic ? onOpenLanding : undefined}
                />
              </View>
            );
          })}
        </ScrollView>
      ) : (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: palette.subtext }]}>
            No broadcast products match the current filters.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 12,
  },
  filterSection: {
    borderWidth: 1.5,
    borderRadius: 20,
    padding: 14,
    marginBottom: 12,
  },
  filterHeading: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  filterChips: {
    flexDirection: 'row',
    paddingBottom: 8,
  },
  filterChip: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 10,
  },
  filterPreview: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '500',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  productsList: {
    paddingBottom: 60,
  },
  cardSpacing: {
    marginBottom: 14,
  },
  productCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  productHero: {
    marginBottom: 12,
  },
  productMainImage: {
    width: '100%',
    height: 210,
    borderRadius: 16,
  },
  thumbnailRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  thumbnailImage: {
    width: 72,
    height: 72,
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 8,
  },
  thumbnailWrapper: {
    borderRadius: 12,
    borderWidth: 2,
    marginRight: 8,
    overflow: 'hidden',
    width: 76,
    height: 76,
    justifyContent: 'center',
    alignItems: 'center',
  },
  productInfo: {
    marginTop: 8,
  },
  productTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  productDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  productMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: 8,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  priceTag: {
    fontSize: 22,
    fontWeight: '700',
  },
  comparePrice: {
    fontSize: 14,
    textDecorationLine: 'line-through',
  },
  secondaryText: {
    fontSize: 12,
  },
  memberBadge: {
    marginTop: 8,
    padding: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 12,
  },
  memberBadgeText: {
    fontSize: 12,
    fontWeight: '600',
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
  shopHeader: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 10,
    marginBottom: 10,
  },
  shopHeaderInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shopHeaderImage: {
    width: 40,
    height: 40,
    borderRadius: 12,
  },
  shopIconFallback: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shopHeaderText: {
    flex: 1,
    marginLeft: 10,
  },
  shopName: {
    fontSize: 16,
    fontWeight: '800',
  },
  shopDescription: {
    fontSize: 12,
    marginTop: 2,
  },
  rateAction: {
    width: 32,
    height: 32,
    borderWidth: 1,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  rateActionText: {
    fontSize: 20,
    fontWeight: '900',
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    minWidth: 88,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  ratingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 40,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
  },
  fullscreenOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  fullscreenImage: {
    width: '100%',
    height: '90%',
    maxHeight: '90%',
    borderRadius: 24,
  },
  ratingModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  ratingModalCard: {
    width: '90%',
    maxWidth: 360,
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
  },
  ratingModalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  ratingStar: {
    fontSize: 32,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
});
