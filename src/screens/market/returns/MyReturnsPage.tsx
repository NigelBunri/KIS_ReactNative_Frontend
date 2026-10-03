import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { useKISTheme } from '@/theme/useTheme';
import KISButton from '@/constants/KISButton';
import { KISIcon } from '@/constants/kisIcons';
import type { RootStackParamList } from '@/navigation/types';
import { useSafeTopInset } from '@/hooks/useSafeTopInset';

type MyReturnsNavigation = NativeStackNavigationProp<RootStackParamList, 'MyReturns'>;

const STATUS_LABELS: Record<string, string> = {
  requested: 'Requested — waiting on seller',
  approved: 'Approved — ship it back',
  rejected: 'Declined',
  return_shipped: 'On its way back',
  received: 'Received — being inspected',
  completed: 'Completed & refunded',
  cancelled: 'Cancelled',
};

export default function MyReturnsPage() {
  const { palette } = useKISTheme();
  const insets = useSafeAreaInsets();
  const topInset = useSafeTopInset();
  const navigation = useNavigation<MyReturnsNavigation>();
  const [returns, setReturns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [shipModalFor, setShipModalFor] = useState<any | null>(null);
  const [carrierName, setCarrierName] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [shipSubmitting, setShipSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const response = await getRequest(ROUTES.commerce.returns, { errorMessage: 'Unable to load your returns.' });
    if (response.success) {
      const payload = response.data;
      setReturns(Array.isArray(payload) ? payload : payload?.results ?? []);
    } else {
      setError(response.message ?? 'Unable to load your returns.');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const runAction = useCallback(async (item: any, url: string, label: string) => {
    setBusyId(item.id);
    const response = await postRequest(url, {}, { errorMessage: label });
    setBusyId(null);
    if (!response.success) {
      Alert.alert('Return', response.message || `Unable to: ${label}`);
      return;
    }
    await load();
  }, [load]);

  const openShipModal = useCallback((item: any) => {
    setCarrierName('');
    setTrackingNumber('');
    setShipModalFor(item);
  }, []);

  const handleMarkShipped = useCallback(async () => {
    if (!shipModalFor) return;
    setShipSubmitting(true);
    const response = await postRequest(ROUTES.commerce.returnShip(shipModalFor.id), {
      carrier_name: carrierName,
      tracking_number: trackingNumber,
    }, { errorMessage: 'Unable to mark this return as shipped.' });
    setShipSubmitting(false);
    if (!response.success) {
      Alert.alert('Return', response.message || 'Unable to mark this return as shipped.');
      return;
    }
    setShipModalFor(null);
    await load();
  }, [shipModalFor, carrierName, trackingNumber, load]);

  const renderItem = ({ item }: { item: any }) => {
    const canShip = item.status === 'approved';
    const canCancel = ['requested', 'approved'].includes(item.status);
    const refund = (item.refunds || []).find((r: any) => r.status === 'succeeded');
    return (
      <View style={[styles.card, { borderColor: palette.surfaceDark, backgroundColor: palette.surfaceElevated }]}>
        <Text style={[styles.shopName, { color: palette.subtext }]}>{item.shop_name}</Text>
        <Text style={[styles.status, { color: palette.primaryStrong }]}>
          {STATUS_LABELS[item.status] || item.status}
        </Text>
        <Text style={[styles.meta, { color: palette.text }]}>
          {(item.items || []).map((ri: any) => `${ri.quantity}x ${ri.product_name}`).join(', ')}
        </Text>
        <Text style={[styles.meta, { color: palette.subtext }]}>Reason: {String(item.reason).replace(/_/g, ' ')}</Text>
        {item.rejection_reason ? (
          <Text style={[styles.meta, { color: palette.danger }]}>Seller note: {item.rejection_reason}</Text>
        ) : null}
        {refund ? (
          <Text style={[styles.meta, { color: palette.success }]}>
            Refunded {(refund.amount_cents / 100).toFixed(2)} {item.currency || ''}
          </Text>
        ) : null}
        <View style={styles.cardFooter}>
          {canShip ? (
            <KISButton title="Mark as shipped" size="xs" onPress={() => openShipModal(item)} disabled={Boolean(busyId)} />
          ) : null}
          {canCancel ? (
            <KISButton
              title="Cancel request" size="xs" variant="ghost" loading={busyId === item.id}
              onPress={() => runAction(item, ROUTES.commerce.returnCancel(item.id), 'Cancel return request')}
              disabled={Boolean(busyId)}
            />
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: palette.bg, paddingTop: topInset }]}>
      <View style={[styles.header, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <KISIcon name="arrow-left" size={18} color={palette.text} />
        </Pressable>
        <Text style={[styles.title, { color: palette.text }]}>My returns</Text>
        <KISButton title="Refresh" size="sm" variant="ghost" onPress={handleRefresh} disabled={loading} />
      </View>
      {loading ? (
        <View style={styles.loader}><ActivityIndicator color={palette.primaryStrong} /></View>
      ) : error ? (
        <View style={styles.loader}>
          <Text style={{ color: palette.danger, textAlign: 'center' }}>{error}</Text>
          <KISButton title="Try again" size="sm" variant="ghost" onPress={load} />
        </View>
      ) : (
        <FlatList
          data={returns}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={[styles.list, { paddingBottom: Math.max(insets.bottom, 32) }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          ListEmptyComponent={() => (
            <View style={styles.loader}>
              <Text style={{ color: palette.subtext, textAlign: 'center' }}>
                You have no return requests. Open an order from "My Orders" and choose "Request a return" if eligible.
              </Text>
            </View>
          )}
        />
      )}

      <Modal visible={Boolean(shipModalFor)} animationType="slide" onRequestClose={() => setShipModalFor(null)} transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: palette.surface }]}>
            <Text style={[styles.title, { color: palette.text }]}>Mark as shipped</Text>
            <ScrollView>
              <TextInput
                style={[styles.input, { borderColor: palette.divider, color: palette.text }]}
                placeholder="Carrier name (optional)"
                placeholderTextColor={palette.subtext}
                value={carrierName}
                onChangeText={setCarrierName}
              />
              <TextInput
                style={[styles.input, { borderColor: palette.divider, color: palette.text }]}
                placeholder="Tracking number (optional)"
                placeholderTextColor={palette.subtext}
                value={trackingNumber}
                onChangeText={setTrackingNumber}
              />
            </ScrollView>
            <View style={styles.modalActions}>
              <KISButton title="Cancel" variant="ghost" onPress={() => setShipModalFor(null)} />
              <KISButton title={shipSubmitting ? 'Saving…' : 'Confirm shipped'} loading={shipSubmitting} onPress={handleMarkShipped} disabled={shipSubmitting} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    borderWidth: 1, borderRadius: 24, padding: 16, margin: 16,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12,
  },
  backButton: { padding: 4 },
  title: { fontSize: 16, fontWeight: '800', flex: 1 },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  card: { borderWidth: 0, borderRadius: 14, padding: 14, marginBottom: 12, gap: 4, elevation: 2, shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 8 } },
  shopName: { fontSize: 11 },
  status: { fontSize: 14, fontWeight: '800' },
  meta: { fontSize: 12 },
  cardFooter: { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  loader: { marginTop: 40, alignItems: 'center', paddingHorizontal: 24, gap: 10 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  modalCard: { borderRadius: 16, padding: 20, maxHeight: '70%' },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 10, fontSize: 14 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 },
});
