import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useKISTheme } from '@/theme/useTheme';
import KISButton from '@/constants/KISButton';
import { getRequest } from '@/network/get';
import ROUTES from '@/network';
import type { RootStackParamList } from '@/navigation/types';
import {
  KIS_COIN_CODE,
  KIS_TO_USD_RATE,
} from '@/screens/market/market.constants';
import { collectProductImageUris } from '@/utils/productImages';

const fallbackCover = require('@/assets/logo-light.png');

type ShopServicesRoute = RouteProp<RootStackParamList, 'ShopServices'>;
type ShopServicesNavigation = NativeStackNavigationProp<
  RootStackParamList,
  'ShopServices'
>;

type ShopService = {
  id?: string | number;
  name?: string;
  short_summary?: string;
  description?: string;
  price?: number | string;
  currency?: string;
  compare_at_price?: number | string;
  duration_minutes?: number;
  availability_rules?: Array<{ times?: string[]; targets?: string[] }>;
  coverage?: string[];
  delivery_modes?: string[];
  service_type?: string;
  catalog_categories?: Array<{ id?: string | number; name?: string }>;
  images?: Array<
    | string
    | {
        image_url?: string | null;
        image_file?: string | null;
        url?: string | null;
      }
  >;
  image_url?: string | null;
  image_file?: string | null;
};

const titleForShop = (name?: string) =>
  name ? `${name} · services` : 'Shop services';

const formatAvailabilityLabel = (rule?: {
  targets?: string[];
  times?: string[];
}) => {
  if (!rule) return 'Availability TBD';
  const target = rule.targets?.[0];
  const time = rule.times?.[0];
  const formattedDate = target ? new Date(target).toLocaleDateString() : null;
  if (formattedDate && time) return `${formattedDate} · ${time}`;
  if (formattedDate) return formattedDate;
  if (time) return time;
  return 'Availability TBD';
};

const formatCoverageLabel = (coverage?: string[]) => {
  if (!coverage?.length) return 'Coverage unspecified';
  return coverage.slice(0, 3).join(', ');
};

const ShopServicesPage = () => {
  const route = useRoute<ShopServicesRoute>();
  const navigation = useNavigation<ShopServicesNavigation>();
  const { palette } = useKISTheme();
  const shopId = route.params?.shopId;
  const shopName = route.params?.shopName;

  const [services, setServices] = useState<ShopService[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextPage, setNextPage] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizeListResponse = (payload: any) => {
    if (!payload) return { items: [], next: null };
    const fromData = Array.isArray(payload)
      ? payload
      : Array.isArray(payload.results)
      ? payload.results
      : Array.isArray(payload.data?.results)
      ? payload.data.results
      : [];
    const next = payload.next ?? payload?.data?.next ?? null;
    return { items: fromData, next };
  };

  const loadServices = useCallback(
    async (targetUrl?: string, reset = false) => {
      if (!shopId) {
        setError('Shop identifier missing.');
        return;
      }
      if (reset) setLoading(true);
      else setLoadingMore(true);
      try {
        const url = targetUrl ?? ROUTES.commerce.shopServices;
        const response = await getRequest(url, {
          params: targetUrl ? undefined : { shop: shopId },
          forceNetwork: true,
          errorMessage: 'Unable to load shop services.',
        });
        if (!response.success) {
          throw new Error(response.message || 'Unable to load shop services.');
        }
        const payload = response.data ?? response ?? {};
        const normalized = normalizeListResponse(payload);
        setServices(prev =>
          reset ? normalized.items : [...prev, ...normalized.items],
        );
        setNextPage(normalized.next || null);
        setError(null);
      } catch (loadError: any) {
        setError(loadError?.message ?? 'Unable to load shop services.');
      } finally {
        if (reset) setLoading(false);
        else setLoadingMore(false);
      }
    },
    [shopId],
  );

  useEffect(() => {
    setServices([]);
    setNextPage(null);
    setError(null);
    if (shopId) {
      void loadServices(undefined, true);
    }
  }, [shopId, loadServices]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void loadServices(undefined, true).finally(() => setRefreshing(false));
  }, [loadServices]);

  const handleLoadMore = useCallback(() => {
    if (!nextPage || loadingMore) return;
    void loadServices(nextPage, false);
  }, [loadingMore, loadServices, nextPage]);

  const openServiceBooking = useCallback(
    (serviceId?: string | number, serviceName?: string) => {
      if (!serviceId) return;
      navigation.navigate('ServiceBooking', {
        serviceId: String(serviceId),
        serviceName,
      });
    },
    [navigation],
  );

  const renderServiceItem = useCallback(
    ({ item }: { item: ShopService }) => {
      const priceValue = Number(item.price ?? 0);
      const currency = item.currency ?? KIS_COIN_CODE;
      const comparePrice = Number(item.compare_at_price ?? 0);
      const imageUri = collectProductImageUris(item)[0] ?? null;
      const durationText = item.duration_minutes
        ? `${item.duration_minutes} min`
        : 'Duration TBD';
      const availabilityLabel = formatAvailabilityLabel(
        item.availability_rules?.[0],
      );
      const coverageLabel = formatCoverageLabel(item.coverage);
      const categoryLabel =
        item.catalog_categories?.[0]?.name ?? item.service_type ?? 'Service';
      return (
        <View
          style={[
            serviceStyles.card,
            { backgroundColor: palette.surface, borderColor: palette.divider },
          ]}
        >
          <View style={serviceStyles.cardBody}>
            <Image
              source={imageUri ? { uri: imageUri } : fallbackCover}
              style={serviceStyles.cardImage}
              resizeMode="cover"
            />
            <View style={serviceStyles.cardContent}>
              <View>
                <Text
                  style={[serviceStyles.cardTitle, { color: palette.text }]}
                  numberOfLines={2}
                >
                  {item.name ?? 'Service'}
                </Text>
                <Text
                  style={[
                    serviceStyles.cardSubtitle,
                    { color: palette.subtext },
                  ]}
                  numberOfLines={2}
                >
                  {item.short_summary ??
                    item.description ??
                    'No description yet.'}
                </Text>
                <Text
                  style={[
                    serviceStyles.secondaryText,
                    { color: palette.subtext },
                  ]}
                >
                  {categoryLabel}
                </Text>
              </View>
              <View style={serviceStyles.priceRow}>
                <Text
                  style={[
                    serviceStyles.priceTag,
                    { color: palette.primaryStrong },
                  ]}
                >
                  {`${priceValue.toFixed(2)} ${currency}`}
                </Text>
                {comparePrice > priceValue ? (
                  <Text
                    style={[
                      serviceStyles.secondaryText,
                      { color: palette.subtext },
                    ]}
                  >
                    {`${comparePrice.toFixed(2)} ${currency}`}
                  </Text>
                ) : null}
                <Text
                  style={[
                    serviceStyles.secondaryText,
                    { color: palette.subtext },
                  ]}
                >
                  ≈ ${(priceValue * KIS_TO_USD_RATE).toFixed(2)} USD
                </Text>
              </View>
              <Text
                style={[
                  serviceStyles.secondaryText,
                  { color: palette.subtext },
                ]}
              >{`${durationText} · ${availabilityLabel}`}</Text>
              <Text
                style={[
                  serviceStyles.secondaryText,
                  { color: palette.subtext },
                ]}
              >
                {coverageLabel}
              </Text>
            </View>
          </View>
          <View style={serviceStyles.actionRow}>
            <KISButton
              title="Book service"
              size="xs"
              variant="secondary"
              style={serviceStyles.actionButton}
              onPress={() => openServiceBooking(item.id, item.name)}
            />
          </View>
        </View>
      );
    },
    [
      openServiceBooking,
      palette.primaryStrong,
      palette.surface,
      palette.subtext,
      palette.text,
      palette.divider,
    ],
  );

  const titleText = titleForShop(shopName);

  if (!shopId) {
    return (
      <View style={[serviceStyles.root, { backgroundColor: palette.bg }]}>
        <Text
          style={[
            serviceStyles.errorText,
            { color: palette.error || '#E53935' },
          ]}
        >
          Shop not specified.
        </Text>
      </View>
    );
  }

  return (
    <View style={[serviceStyles.root, { backgroundColor: palette.bg }]}>
      <View
        style={[
          serviceStyles.header,
          { backgroundColor: palette.surface, borderColor: palette.divider },
        ]}
      >
        <View style={serviceStyles.headerBack}>
          <KISButton
            title="Back"
            size="xs"
            variant="outline"
            onPress={() => navigation.goBack()}
          />
        </View>
        <View style={serviceStyles.headerTitleWrap}>
          <Text
            style={[serviceStyles.headerTitle, { color: palette.text }]}
            numberOfLines={1}
          >
            {titleText}
          </Text>
          <Text
            style={[serviceStyles.headerSubtitle, { color: palette.subtext }]}
          >
            Services from this shop
          </Text>
        </View>
      </View>
      {error ? (
        <View style={serviceStyles.errorBox}>
          <Text
            style={[
              serviceStyles.errorText,
              { color: palette.error || '#E53935' },
            ]}
          >
            {error}
          </Text>
          <KISButton
            title="Retry"
            size="sm"
            onPress={() => loadServices(undefined, true)}
          />
        </View>
      ) : null}
      {loading && !services.length ? (
        <View style={serviceStyles.loader}>
          <ActivityIndicator color={palette.primaryStrong} />
        </View>
      ) : (
        <FlatList
          data={services}
          keyExtractor={(item, index) => String(item.id ?? `service-${index}`)}
          renderItem={renderServiceItem}
          contentContainerStyle={serviceStyles.listContent}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            !loading ? (
              <View style={serviceStyles.emptyState}>
                <Text
                  style={[serviceStyles.emptyText, { color: palette.subtext }]}
                >
                  No services published by this shop yet.
                </Text>
              </View>
            ) : null
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={serviceStyles.footer}>
                <ActivityIndicator color={palette.primaryStrong} />
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
};

const serviceStyles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  headerBack: {
    marginRight: 8,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  listContent: {
    padding: 12,
    paddingBottom: 80,
  },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    marginBottom: 12,
    padding: 12,
    gap: 10,
  },
  cardBody: {
    flexDirection: 'row',
    gap: 12,
  },
  cardImage: {
    width: 90,
    height: 90,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
  },
  cardContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  cardSubtitle: {
    fontSize: 12,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginTop: 4,
  },
  priceTag: {
    fontSize: 18,
    fontWeight: '900',
  },
  secondaryText: {
    fontSize: 12,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
  },
  actionButton: {
    marginRight: 8,
    marginTop: 6,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 40,
  },
  footer: {
    padding: 14,
    alignItems: 'center',
  },
  errorBox: {
    padding: 14,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyState: {
    paddingTop: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default ShopServicesPage;
