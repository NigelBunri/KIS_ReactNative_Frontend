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
import { getRequest } from '@/network/get';
import { deleteRequest } from '@/network/delete';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import { collectProductImageUris } from '@/utils/productImages';
import type { RootStackParamList } from '@/navigation/types';
import KISButton from '@/constants/KISButton';
import { KISIcon } from '@/constants/kisIcons';
import { formatKiscAmount } from '@/utils/currency';
import { KIS_COIN_CODE, KIS_TO_USD_RATE } from '@/screens/market/market.constants';
import { resolveShopDescription, resolveShopImageUri } from '@/utils/shopAssets';
import { buildShopLandingPreview } from '@/utils/landingPreview';
import { useAuth } from '../../../../App';
import {
  buildCartProductIndex,
  cartHasProduct,
  getShopCartState,
  refreshShopCartFromBackend,
  subscribeToShopCart,
} from '@/screens/market/cart/shopCartManager';

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
    images?: (string | { image_url?: string | null })[];
    stock_qty?: number;
    stock?: number;
    availability?: string;
    coverage?: string[];
    requires_shipping?: boolean;
    inventory_type?: string;
    delivery_modes?: string[];
    delivery_mode?: string;
    category?: { name?: string };
    catalog_categories?: Array<{ id?: string; name?: string; slug?: string }>;
    condition?: string;
    sale_price?: number | string;
    compare_at_price?: number | string;
    membership_discount_pct?: number;
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
  landingPublic,
  shopId,
  shopName,
  shopImageUri,
  shopDescription,
  onOpenLanding,
  isProductInCart,
}: {
  item: MarketBroadcastItem;
  landingPublic?: boolean;
  shopId?: string | number;
  shopName?: string;
  shopImageUri?: string;
  shopDescription?: string;
  onOpenLanding?: () => void;
  isProductInCart?: boolean;
}) => {
  const { palette } = useKISTheme();
  const product = item.product ?? {};
  const source = item.source ?? {};
  const gallery = useMemo(() => collectProductImageUris(product), [product]);
  const primaryImage = gallery[0] ?? '';
  const [activeImage, setActiveImage] = useState(primaryImage);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  useEffect(() => {
    setActiveImage(primaryImage);
  }, [primaryImage]);

  const regularPriceValue = Number(product?.price ?? 0);
  const salePriceValue = Number(product?.sale_price ?? product?.salePrice ?? NaN);
  const displayPrice = Number.isFinite(salePriceValue) && salePriceValue < regularPriceValue ? salePriceValue : regularPriceValue;
  const usdValue = Number.isFinite(displayPrice) ? (displayPrice * KIS_TO_USD_RATE).toFixed(2) : '0.00';
  const comparePriceValue = Number(
    product.compare_at_price ??
      product.compareAtPrice ??
      product.sale_price ??
      product.salePrice ??
      0,
  );
  const hasComparePrice = Number.isFinite(comparePriceValue) && comparePriceValue > displayPrice;
  const showSalePrice = Number.isFinite(salePriceValue) && salePriceValue < regularPriceValue;
  const rating = Number.isFinite(Number(product?.rating_avg ?? 0)) ? Number(product?.rating_avg ?? 0) : 0;
  const ratingCount = Number.isFinite(Number(product?.rating_count ?? 0)) ? Number(product?.rating_count ?? 0) : 0;
  const viewerIsMember = Boolean(source.viewer_is_member);
  const memberDiscount = Number(source.membership_discount_pct ?? product.membership_discount_pct ?? 5);
  const viewerCanSubmitRating = useMemo(() => {
    const roles = Array.isArray(source.viewer_roles)
      ? source.viewer_roles.map((role) => String(role ?? '').toLowerCase())
      : [];
    const elevated = new Set(['owner', 'admin', 'manager']);
    const hasElevatedRole = roles.some((role) => elevated.has(role));
    return (
      viewerIsMember ||
      hasElevatedRole ||
      Boolean(source.viewer_is_owner || source.viewer_is_admin || source.viewer_is_manager)
    );
  }, [source, viewerIsMember]);
  const handleRateProduct = useCallback(() => {
    Alert.alert('Rate product', 'Rating capability will open soon.');
  }, []);

  const stockQty = Number.isFinite(Number(product?.stock_qty ?? product?.stock ?? 0))
    ? Number(product?.stock_qty ?? product?.stock ?? 0)
    : 0;
  const availabilityLabel =
    typeof product.availability === 'string' && product.availability.trim()
      ? product.availability
      : stockQty > 0
      ? 'In stock'
      : 'Out of stock';
  const shippingLabel = product.requires_shipping === false ? 'Pickup only' : 'Ships';
  const conditionLabel = product.condition ? product.condition : 'Condition TBD';
  const productTypeLabel =
    product.catalog_categories?.[0]?.name ?? product.inventory_type ?? 'Product';

  const deliveryModes = Array.isArray(product.delivery_modes)
    ? product.delivery_modes
    : product.delivery_mode
    ? [product.delivery_mode]
    : [];

  const productMetaItems = [
    { label: 'Availability', value: availabilityLabel },
    { label: 'Shipping', value: shippingLabel },
    { label: 'Condition', value: conditionLabel },
  ];

  const navigation = useNavigation<MarketPageNavigationProp>();
  const productShopLabel = shopName ?? source.name ?? 'Shop';
  const resolvedShopId = shopId ?? source.id;
  const handleOpenDetail = () => {
    if (!product?.id) return;
    navigation.navigate('ProductDetail', { productId: String(product.id) });
  };
  const handleAddToCart = () => {
    handleOpenDetail();
  };
  const handleViewShopProducts = () => {
    if (!resolvedShopId) {
      Alert.alert('Shop unavailable', 'Unable to identify the shop for this product.');
      return;
    }
    navigation.navigate('ShopProducts', {
      shopId: String(resolvedShopId),
      shopName: productShopLabel,
    });
  };

  const openFullScreen = (uri: string) => {
    if (!uri) return;
    setFullscreenImage(uri);
  };

  return (
    <View style={[styles.productCard, { borderColor: palette.primaryStrong }]}> 
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
              {product?.name ?? 'Untitled product'}
            </Text>
            <Text style={[styles.secondaryText, { color: palette.subtext }]} numberOfLines={2}>
              {productTypeLabel}
            </Text>
          </View>
          <View style={[styles.statusBadge, { borderColor: palette.primaryStrong, backgroundColor: `${palette.primaryStrong}15` }]}>
            <Text style={[styles.statusLabel, { color: palette.primaryStrong }]}>Product</Text>
          </View>
        </View>
        <Text style={[styles.productDescription, { color: palette.subtext }]} numberOfLines={3}>
          {product?.description ?? 'No description yet.'}
        </Text>
        <View style={[styles.productMetaRow, { marginTop: 10 }]}>
          <View>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
                <View>
                  <Text style={[styles.priceTag, { color: palette.primaryStrong }]}>
                    {formatKiscAmount(displayPrice, { suffix: product.currency ?? KIS_COIN_CODE })}
                  </Text>
                  {showSalePrice ? (
                    <Text style={[styles.originalPrice, { color: palette.subtext }]}>
                      {formatKiscAmount(regularPriceValue, { suffix: product.currency ?? KIS_COIN_CODE })}
                    </Text>
                  ) : null}
                </View>
                {hasComparePrice ? (
                  <Text style={[styles.comparePrice, { color: palette.subtext }]}>
                    Compare at {formatKiscAmount(comparePriceValue, { suffix: product.currency ?? KIS_COIN_CODE })}
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
          {productMetaItems.map((entry) => (
            <Text key={entry.label} style={[styles.secondaryText, { color: palette.subtext }]}>
              {`${entry.label} · ${entry.value}`}
            </Text>
          ))}
        </View>
        <View style={[styles.ratingRow, viewerCanSubmitRating && { alignItems: 'center', gap: 8 }]}> 
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[styles.secondaryText, { color: palette.text }]}>⭐ {rating.toFixed(1)} / 5</Text>
            <Text style={[styles.secondaryText, { color: palette.subtext }]}>({ratingCount} review{ratingCount === 1 ? '' : 's'})</Text>
          </View>
          {viewerCanSubmitRating ? (
            <Pressable
              style={[styles.rateAction, { borderColor: palette.primaryStrong }]}
              onPress={handleRateProduct}
            >
              <Text style={[styles.rateActionText, { color: palette.primaryStrong }]}>+</Text>
            </Pressable>
          ) : null}
        </View>
        <View style={[styles.actionRow, { justifyContent: 'flex-start', marginTop: 12 }]}> 
          {landingPublic && onOpenLanding ? (
            <KISButton
              title="View shop landing"
              size="xs"
              variant="secondary"
              style={styles.actionButton}
              onPress={onOpenLanding}
            />
          ) : null}
          <KISButton
            title="View details"
            size="xs"
            variant="secondary"
            style={styles.actionButton}
            onPress={handleOpenDetail}
          />
          {!isProductInCart ? (
            <KISButton
              title="Add to cart"
              size="xs"
              style={styles.actionButton}
              onPress={handleAddToCart}
            />
          ) : null}
          <KISButton
            title="View other products by this shop"
            size="xs"
            variant="secondary"
            style={styles.actionButton}
            onPress={handleViewShopProducts}
          />
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
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const service = item.service ?? {};
  const source = item.source ?? {};
  const resolvedShopId = source.id ? String(source.id) : undefined;
  const resolvedShopTitle = shopName ?? source.name ?? 'Shop';
  const handleViewShopServices = () => {
    if (!resolvedShopId) {
      Alert.alert('Shop unavailable', 'Unable to identify the shop for this service.');
      return;
    }
    navigation.navigate('ShopServices', { shopId: resolvedShopId, shopName: resolvedShopTitle });
  };
  const gallery = useMemo(() => collectProductImageUris(service), [service]);
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
    <View style={[styles.productCard, { borderColor: palette.primaryStrong }]}> 
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
          <KISButton
            title="View other services by this shop"
            size="xs"
            variant="secondary"
            style={styles.actionButton}
            onPress={handleViewShopServices}
          />
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
  const [cartState, setCartState] = useState(getShopCartState());
  const cartProductIndex = useMemo(() => buildCartProductIndex(cartState), [cartState]);

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

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('service-booking.refresh', () => {
      void loadServiceBookings();
    });
    return () => subscription.remove();
  }, [loadServiceBookings]);

  useEffect(() => {
    const unsubscribe = subscribeToShopCart(setCartState);
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    void refreshShopCartFromBackend();
  }, []);

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
      <View style={styles.listWrapper}> 
        {loading && !filteredProducts.length ? (
          <View style={styles.loader}>
            <ActivityIndicator color={palette.primaryStrong} />
          </View>
        ) : filteredProducts.length ? (
          <ScrollView contentContainerStyle={styles.productsList} showsVerticalScrollIndicator={false}>
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
              const productId = item.product?.id ? String(item.product.id) : '';
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
                    landingPublic={landingPublic}
                    shopId={source.id}
                    shopName={shopName}
                    shopImageUri={shopImageUri}
                    shopDescription={shopDescription}
                    onOpenLanding={landingPublic ? onOpenLanding : undefined}
                    isProductInCart={Boolean(productId && cartHasProduct(cartProductIndex, productId))}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 12,
    position: 'relative',
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
  listWrapper: {
    flex: 1,
    marginBottom: 60,
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
  productImageWrapper: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  productMainImage: {
    width: '100%',
    height: 210,
    borderRadius: 16,
  },
  emptyImage: {
    justifyContent: 'center',
    alignItems: 'center',
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
  originalPrice: {
    fontSize: 16,
    fontWeight: '600',
    textDecorationLine: 'line-through',
    marginTop: 2,
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
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  actionButton: {
    marginRight: 8,
    marginTop: 6,
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
