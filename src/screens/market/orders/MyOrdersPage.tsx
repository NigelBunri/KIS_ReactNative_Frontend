import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { deleteRequest } from '@/network/delete';
import { postRequest } from '@/network/post';
import RNFS from 'react-native-fs';
import { useKISTheme } from '@/theme/useTheme';
import KISButton from '@/constants/KISButton';
import { KISIcon } from '@/constants/kisIcons';
import { getAccessToken } from '@/security/authStorage';
import type { RootStackParamList } from '@/navigation/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { deleteShopCart } from '@/screens/market/cart/shopCartManager';
import { backendOrderTotalToFrontendKisc } from '@/utils/currency';

type MyOrdersNavigation = NativeStackNavigationProp<RootStackParamList, 'MarketplaceOrders'>;

type MarketplaceOrder = {
  id: string;
  total_amount: number | string;
  currency?: string;
  status: string;
  created_at?: string;
  shop_info?: { id?: string; name?: string } | null;
  shop?: { name?: string } | string;
  items?: Array<{ id?: string }>; 
};

export default function MyOrdersPage() {
  const { palette } = useKISTheme();
  const navigation = useNavigation<MyOrdersNavigation>();
  const [orders, setOrders] = useState<MarketplaceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<Record<string, string>>({});

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getRequest(ROUTES.commerce.marketplaceOrders, {
        errorMessage: 'Unable to load marketplace orders.',
      });
      if (response.success) {
        const payload = response.data;
        const data = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.results)
          ? payload.results
          : [];
        setOrders(data);
      } else {
        setError(response.message ?? 'Unable to load your orders.');
      }
    } catch (loadError: any) {
      setError(loadError?.message ?? 'Unable to load your orders.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadOrders();
    setRefreshing(false);
  }, [loadOrders]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const statusLabel = useCallback((order: MarketplaceOrder) => {
    if (!order?.status) return 'unknown';
    return order.status.charAt(0).toUpperCase() + order.status.slice(1);
  }, []);

  const handleAction = useCallback(
    async (orderId: string, endpoint: string, key: string, message: string, method: 'post' | 'delete' = 'post') => {
      setActionLoading((prev) => ({ ...prev, [orderId]: key }));
      try {
        const response =
          method === 'post'
            ? await postRequest(endpoint, undefined, { errorMessage: message })
            : await deleteRequest(endpoint, { errorMessage: message });
        if (!response.success) {
          throw new Error(response.message || message);
        }
        Alert.alert('Order updated', response.message || 'Order status updated.');
        await loadOrders();
      } catch (err: any) {
        Alert.alert('Order action failed', err?.message || message);
      } finally {
        setActionLoading((prev) => {
          const next = { ...prev };
          delete next[orderId];
          return next;
        });
      }
    },
    [loadOrders],
  );

  const downloadReceipt = useCallback(async (orderId: string) => {
    setActionLoading((prev) => ({ ...prev, [orderId]: 'receipt' }));
    try {
      const token = await getAccessToken();
      const deviceId = await AsyncStorage.getItem('device_id');
      const toFile = `${RNFS.DocumentDirectoryPath}/marketplace-order-${orderId}.pdf`;
      const headers: Record<string, string> = { Accept: '*/*' };
      if (token) headers.Authorization = `Bearer ${token}`;
      if (deviceId) headers['X-Device-Id'] = deviceId;
      const download = RNFS.downloadFile({
        fromUrl: ROUTES.commerce.marketplaceOrderReceipt(orderId),
        toFile,
        headers,
      });
      const res = await download.promise;
      if (res.statusCode && res.statusCode >= 400) {
        throw new Error('Unable to download receipt.');
      }
      const uri = Platform.OS === 'android' ? `file://${toFile}` : toFile;
      await Linking.openURL(uri);
    } catch (err: any) {
      Alert.alert('Receipt', err?.message || 'Unable to download receipt.');
    } finally {
      setActionLoading((prev) => {
        const next = { ...prev };
        delete next[orderId];
        return next;
      });
    }
  }, []);

  const renderOrder = ({ item }: { item: MarketplaceOrder }) => {
    const total = backendOrderTotalToFrontendKisc(item.total_amount);
    const currency = item.currency ?? 'KISC';
    const status = statusLabel(item);
    const canCancel = item.status === 'temporal';
    const canSatisfy = item.status === 'temporal' || item.status === 'awaiting_satisfaction';
    const canDelete = item.status === 'cancelled' || item.status === 'satisfied';
    const isAwaitingSatisfaction = item.status === 'awaiting_satisfaction';

    const loadingKey = actionLoading[item.id];

  return (
        <View style={[styles.card, { borderColor: palette.surfaceDark, backgroundColor: palette.surfaceElevated }]}> 
          <Pressable
            onPress={() =>
              navigation.navigate('MarketplaceOrderDetail', { orderId: item.id, mode: 'buyer' })
            }
          >
            {isAwaitingSatisfaction ? (
              <View style={[styles.awaitingBanner, { borderColor: palette.primaryLight }]}>
                <Text style={[styles.awaitingBannerText, { color: palette.primaryStrong }]}>
                  Provider marked this order complete. You have 3 days to confirm satisfaction or file a complaint.
                </Text>
              </View>
            ) : null}
            <View style={styles.cardHeader}> 
              <View style={styles.shopBadge}> 
                <Text style={[styles.shopName, { color: palette.text }]} numberOfLines={1}>
              {item.shop_info?.name ?? (typeof item.shop === 'string' ? item.shop : item.shop?.name) ?? 'Your shop'}
            </Text>
          </View>
          <View style={[styles.statusBadge, { borderColor: palette.primaryLight }]}> 
            <Text style={[styles.statusText, { color: palette.primaryStrong }]}>{status}</Text>
          </View>
        </View>
        <View style={styles.orderMetaRow}> 
          <Text style={[styles.metaLabel, { color: palette.subtext }]} numberOfLines={1}>Order · {item.id.slice(0, 8)}</Text>
          <Text style={[styles.metaLabel, { color: palette.subtext }]}>
            {item.created_at ? new Date(item.created_at).toLocaleString() : '—'}
          </Text>
        </View>
        <View style={styles.amountRow}> 
          <View>
            <Text style={[styles.amountLabel, { color: palette.subtext }]}>Total</Text>
            <Text style={[styles.amountValue, { color: palette.primaryStrong }]}>
              {total.toFixed(2)} {currency}
            </Text>
          </View>
          <View style={styles.itemCount}> 
            <Text style={[styles.itemCountText, { color: palette.subtext }]}>Items</Text>
            <Text style={[styles.itemCountValue, { color: palette.text }]}>
              {item.items?.length ?? 0}
            </Text>
          </View>
        </View>
      </Pressable>
      <View style={styles.cardFooter}> 
        <KISButton
          title="View items"
          size="xs"
          variant="ghost"
          onPress={() =>
            navigation.navigate('MarketplaceOrderDetail', { orderId: item.id, mode: 'buyer' })
          }
        />
        {canCancel ? (
          <KISButton
            title={loadingKey === 'cancel' ? 'Cancelling…' : 'Cancel'}
            size="xs"
            variant="outline"
            onPress={() =>
              handleAction(
                item.id,
                ROUTES.commerce.marketplaceOrderCancel(item.id),
                'cancel',
                'Unable to cancel order.',
              )
            }
            disabled={Boolean(loadingKey)}
          />
        ) : null}
        {canSatisfy ? (
          <KISButton
            title={loadingKey === 'satisfy' ? 'Confirming…' : 'Satisfied'}
            size="xs"
            variant="secondary"
            onPress={() =>
              (async () => {
                await handleAction(
                  item.id,
                  ROUTES.commerce.marketplaceOrderSatisfy(item.id),
                  'satisfy',
                  'Unable to mark satisfied.',
                );
                if (item.shop_info?.id) {
                  await deleteShopCart(item.shop_info.id);
                }
              })()
            }
            disabled={Boolean(loadingKey)}
          />
        ) : null}
        {canDelete ? (
          <KISButton
            title={loadingKey === 'delete' ? 'Deleting…' : 'Delete'}
            size="xs"
            variant="ghost"
      onPress={() =>
        (async () => {
          await handleAction(
            item.id,
            ROUTES.commerce.marketplaceOrderDelete(item.id),
            'delete',
            'Unable to delete order.',
            'delete',
          );
          if (item.shop_info?.id) {
            await deleteShopCart(item.shop_info.id);
          }
        })()
      }
            disabled={Boolean(loadingKey)}
          />
        ) : null}
        <KISButton
          title={loadingKey === 'receipt' ? 'Downloading…' : 'Receipt'}
          size="xs"
          variant="ghost"
          onPress={() => downloadReceipt(item.id)}
          disabled={Boolean(loadingKey)}
        />
      </View>
    </View>
  );
};

  return (
    <View style={[styles.root, { backgroundColor: palette.bg }]}> 
      <View style={[styles.header, { backgroundColor: palette.surface, borderColor: palette.divider }]}> 
        <View>
          <Text style={[styles.title, { color: palette.text }]}>My orders</Text>
          <Text style={[styles.subtitle, { color: palette.subtext }]}>All marketplace orders</Text>
        </View>
        <KISButton title="Refresh" size="sm" variant="ghost" onPress={handleRefresh} disabled={loading} />
      </View>
      {loading ? (
        <View style={styles.loader}> 
          <ActivityIndicator color={palette.primaryStrong} />
        </View>
      ) : error ? (
        <View style={styles.loader}> 
          <Text style={{ color: palette.error || '#E53935' }}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          renderItem={renderOrder}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          ListEmptyComponent={() => (
            <View style={styles.loader}>
              <Text style={{ color: palette.subtext }}>No marketplace orders yet.</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 16,
    margin: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 4,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  card: {
    borderWidth: 0,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    gap: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 8 },
  },
  awaitingBanner: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
  },
  awaitingBannerText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  shopName: {
    fontSize: 16,
    fontWeight: '800',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  cardBody: {
    gap: 6,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  amountLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  amountValue: {
    fontSize: 16,
    fontWeight: '900',
  },
  cardMeta: {
    fontSize: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  shopBadge: {
    flex: 1,
    paddingRight: 12,
  },
  orderMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    marginBottom: 4,
  },
  metaLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  itemCount: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  itemCountText: {
    fontSize: 10,
    letterSpacing: 0.5,
  },
  itemCountValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  loader: {
    marginTop: 40,
    alignItems: 'center',
  },
});
