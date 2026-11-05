// src/screens/bots/BotWebhookDeliveriesScreen.tsx
// Phase 5 — one bot's webhook delivery history
// (GET /api/v1/bots/{id}/webhook/deliveries/) with a manual retry
// action for anything FAILED or DEAD_LETTER
// (POST .../deliveries/{id}/retry/). The backend itself refuses to
// retry an already-DELIVERED row (services.retry_webhook_delivery),
// so the retry control here is simply hidden for those rows rather
// than duplicating that rule on-device.
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { KISIcon } from '@/constants/kisIcons';
import { MainTabStateBlock } from '@/components/common/MainTabScaffold';

type Delivery = {
  id: string;
  event: string;
  event_id: string;
  status: 'pending' | 'delivered' | 'failed' | 'dead_letter';
  attempt_count: number;
  response_code: number | null;
  error_message: string;
  next_retry_at: string | null;
  created_at: string;
  updated_at: string;
};

const STATUS_COLOR: Record<string, 'success' | 'subtext' | 'danger' | 'gold'> = {
  delivered: 'success',
  pending: 'gold',
  failed: 'danger',
  dead_letter: 'danger',
};

export default function BotWebhookDeliveriesScreen() {
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const botId: string = route.params?.botId;
  const botName: string | undefined = route.params?.botName;

  const [deliveries, setDeliveries] = useState<Delivery[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    const res = await getRequest(ROUTES.bots.webhookDeliveries(botId), { forceNetwork: isRefresh });
    if (res?.success) setDeliveries(res.data ?? []);
    else setDeliveries((prev) => prev ?? []);
    setLoading(false);
    setRefreshing(false);
  }, [botId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const statusColor = (status: string) => (palette as any)[STATUS_COLOR[status] ?? 'subtext'] ?? palette.subtext;

  const handleRetry = async (delivery: Delivery) => {
    setRetryingId(delivery.id);
    const res = await postRequest(ROUTES.bots.webhookDeliveryRetry(botId, delivery.id), {});
    setRetryingId(null);
    if (res?.success) {
      setDeliveries((prev) => (prev ?? []).map((d) => (d.id === delivery.id ? res.data : d)));
    } else {
      Alert.alert('Could not retry delivery', res?.message || 'Please try again.');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }}>
      <View
        style={{
          flexDirection: 'row', alignItems: 'center',
          paddingHorizontal: responsive.pageGutter, paddingTop: 10, paddingBottom: 14,
          borderBottomWidth: 1, borderBottomColor: palette.divider,
        }}
      >
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={{ padding: 4 }}>
          <KISIcon name="arrow-left" size={20} color={palette.text} />
        </Pressable>
        <Text style={{ flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '900', color: palette.text }} numberOfLines={1}>
          {botName ? `${botName} · Deliveries` : 'Webhook deliveries'}
        </Text>
        <View style={{ width: 28 }} />
      </View>

      {loading && deliveries === null ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={palette.primaryStrong} />
        </View>
      ) : (
        <FlatList
          data={deliveries ?? []}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
          contentContainerStyle={{ padding: responsive.pageGutter, gap: responsive.cardGap, flexGrow: 1 }}
          ListEmptyComponent={
            <MainTabStateBlock
              icon="sparkles"
              title="No deliveries yet"
              message="Once events start firing for this bot's webhook, delivery attempts will show up here."
            />
          }
          renderItem={({ item }) => {
            const canRetry = item.status === 'failed' || item.status === 'dead_letter';
            return (
              <View
                style={{
                  borderWidth: 1, borderColor: palette.divider, borderRadius: 18,
                  backgroundColor: palette.card, padding: 14, gap: 6,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ flex: 1, fontSize: 13, fontWeight: '800', color: palette.text }}>{item.event}</Text>
                  <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: `${statusColor(item.status)}1A` }}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: statusColor(item.status) }}>
                      {item.status.replace('_', ' ')}
                    </Text>
                  </View>
                </View>
                <Text style={{ fontSize: 11, color: palette.subtext }}>
                  Attempt {item.attempt_count} · {item.response_code ?? 'no response'} · {new Date(item.created_at).toLocaleString()}
                </Text>
                {item.error_message ? (
                  <Text style={{ fontSize: 11, color: palette.danger }} numberOfLines={3}>{item.error_message}</Text>
                ) : null}
                {item.next_retry_at ? (
                  <Text style={{ fontSize: 11, color: palette.subtext }}>
                    Next automatic retry: {new Date(item.next_retry_at).toLocaleString()}
                  </Text>
                ) : null}
                {canRetry ? (
                  <Pressable
                    onPress={() => handleRetry(item)}
                    disabled={retryingId === item.id}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 4 }}
                  >
                    {retryingId === item.id ? (
                      <ActivityIndicator size="small" color={palette.primaryStrong} />
                    ) : (
                      <KISIcon name="refresh-cw" size={14} color={palette.primaryStrong} />
                    )}
                    <Text style={{ fontSize: 12, fontWeight: '700', color: palette.primaryStrong }}>Retry now</Text>
                  </Pressable>
                ) : null}
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
