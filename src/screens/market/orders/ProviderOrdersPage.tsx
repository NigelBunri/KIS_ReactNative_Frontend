import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useKISTheme } from '@/theme/useTheme';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { KISIcon } from '@/constants/kisIcons';
import KISButton from '@/constants/KISButton';
import type { RootStackParamList } from '@/navigation/types';
import { backendOrderTotalToFrontendKisc } from '@/utils/currency';

type ProviderOrdersNavigation = NativeStackNavigationProp<
  RootStackParamList,
  'MarketplaceReceivedOrders'
>;

type MarketplaceOrderSummary = {
  id: string;
  total_amount: number | string;
  currency?: string;
  status: string;
  buyer?: { username?: string } | string;
  shop?: { name?: string } | string;
  created_at?: string;
  items?: any[];
};

export default function ProviderOrdersPage() {
  const { palette } = useKISTheme();
  const navigation = useNavigation<ProviderOrdersNavigation>();
  const [orders, setOrders] = useState<MarketplaceOrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getRequest(ROUTES.commerce.marketplaceProviderOrders, {
        errorMessage: 'Unable to load received orders.',
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
        setError(response.message ?? 'Unable to load received orders.');
      }
    } catch (err: any) {
      setError(err?.message ?? 'Unable to load received orders.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadOrders();
    setRefreshing(false);
  }, [loadOrders]);

  const labelStatus = useCallback((status: string) => {
    if (!status) return 'Unknown';
    return status.charAt(0).toUpperCase() + status.slice(1);
  }, []);

  const handleComplete = useCallback(
    async (orderId: string) => {
      setActionLoading(orderId);
      try {
        const response = await postRequest(
          ROUTES.commerce.marketplaceOrderComplete(orderId),
          undefined,
          { errorMessage: 'Unable to mark order complete.' },
        );
        if (!response.success) {
          throw new Error(response.message || 'Unable to mark order complete.');
        }
        Alert.alert('Order completed', response.message || 'Order marked as completed.');
        await loadOrders();
      } catch (err: any) {
        Alert.alert('Complete order', err?.message || 'Unable to complete order.');
      } finally {
        setActionLoading(null);
      }
    },
    [loadOrders],
  );

  const renderOrder = ({ item }: { item: MarketplaceOrderSummary }) => {
    const total = backendOrderTotalToFrontendKisc(item.total_amount);
    const buyerName = typeof item.buyer === 'string' ? item.buyer : item.buyer?.username ?? 'Buyer';
    const status = labelStatus(item.status);
    const canComplete = item.status !== 'completed' && item.status !== 'cancelled';
    const loading = actionLoading === item.id;

    return (
      <View style={[styles.card, { borderColor: palette.divider, backgroundColor: palette.surfaceElevated }]}> 
        <Pressable
          onPress={() =>
            navigation.navigate('MarketplaceOrderDetail', { orderId: item.id, mode: 'provider' })
          }
        >
          <View style={styles.header}>
            <Text style={[styles.shopName, { color: palette.text }]} numberOfLines={1}>
              {typeof item.shop === 'string' ? item.shop : item.shop?.name ?? 'Shop'}
            </Text>
            <KISIcon name="arrow-right" size={16} color={palette.subtext} />
          </View>
          <Text style={[styles.meta, { color: palette.subtext }]}>Buyer · {buyerName}</Text>
          <Text style={[styles.meta, { color: palette.subtext }]}>
            {status} · {total.toFixed(2)} {item.currency ?? 'KISC'}
          </Text>
        </Pressable>
        <View style={styles.actions}> 
          {canComplete ? (
            <KISButton
              title={loading ? 'Completing…' : 'Mark completed'}
              size="xs"
              onPress={() => handleComplete(item.id)}
              loading={loading}
            />
          ) : null}
          <KISButton
            title="View"
            size="xs"
            variant="ghost"
            onPress={() =>
              navigation.navigate('MarketplaceOrderDetail', { orderId: item.id, mode: 'provider' })
            }
          />
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: palette.bg }]}> 
      <View style={[styles.headerSection, { borderColor: palette.divider, backgroundColor: palette.surface }]}> 
        <Text style={[styles.title, { color: palette.text }]}>Received orders</Text>
        <KISButton title="Refresh" size="sm" variant="ghost" onPress={handleRefresh} />
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
              <Text style={{ color: palette.subtext }}>No orders received yet.</Text>
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
  headerSection: {
    borderWidth: 1,
    borderRadius: 24,
    margin: 16,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  card: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 16,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  shopName: {
    fontSize: 16,
    fontWeight: '800',
    flex: 1,
  },
  meta: {
    fontSize: 12,
    marginTop: 6,
  },
  actions: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 8,
  },
  loader: {
    marginTop: 40,
    alignItems: 'center',
  },
});
