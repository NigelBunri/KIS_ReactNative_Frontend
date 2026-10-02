import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
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

type FulfillmentQueueNavigation = NativeStackNavigationProp<RootStackParamList, 'FulfillmentQueue'>;

const NEXT_ACTION: Record<string, { label: string; route: (id: string) => string } | null> = {
  pending: { label: 'Accept order', route: ROUTES.commerce.fulfillmentAccept },
  accepted: { label: 'Start processing', route: ROUTES.commerce.fulfillmentStartProcessing },
  processing: { label: 'Mark ready to ship', route: ROUTES.commerce.fulfillmentMarkReady },
  ready_for_shipment: null, // handled via "Create shipment" below instead
  partially_shipped: null,
  shipped: null,
  delivered: null,
  cancelled: null,
  returned: null,
};

const SHIPMENT_NEXT_STATUS: Record<string, string | null> = {
  pending: 'label_created',
  label_created: 'ready_for_pickup',
  ready_for_pickup: 'picked_up',
  picked_up: 'in_transit',
  in_transit: 'out_for_delivery',
  out_for_delivery: 'delivered',
  delivery_failed: 'out_for_delivery',
  delivered: null,
  returned: null,
  cancelled: null,
};

export default function FulfillmentQueuePage() {
  const { palette } = useKISTheme();
  const insets = useSafeAreaInsets();
  const topInset = useSafeTopInset();
  const navigation = useNavigation<FulfillmentQueueNavigation>();
  const [fulfillments, setFulfillments] = useState<any[]>([]);
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
    const response = await getRequest(ROUTES.commerce.fulfillments, { errorMessage: 'Unable to load fulfillment queue.' });
    if (response.success) {
      const payload = response.data;
      setFulfillments(Array.isArray(payload) ? payload : payload?.results ?? []);
    } else {
      setError(response.message ?? 'Unable to load fulfillment queue.');
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

  const runFulfillmentAction = useCallback(async (fulfillment: any, url: string, label: string) => {
    setBusyId(fulfillment.id);
    const response = await postRequest(url, {}, { errorMessage: label });
    setBusyId(null);
    if (!response.success) {
      Alert.alert('Fulfillment', response.message || `Unable to: ${label}`);
      return;
    }
    await load();
  }, [load]);

  const openShipModal = useCallback((fulfillment: any) => {
    setCarrierName('');
    setTrackingNumber('');
    setShipModalFor(fulfillment);
  }, []);

  const handleCreateShipment = useCallback(async () => {
    if (!shipModalFor) return;
    // For this minimal UX, ship every item's full remaining (ordered minus
    // already-shipped) quantity on a single shipment - partial per-item
    // quantity selection is left to a future dashboard iteration; the API
    // already fully supports it (create_shipment accepts any quantity up to
    // what remains).
    const lineItems = shipModalFor.order_line_items || [];
    const items = lineItems
      .map((row: any) => ({
        order_item_id: row.order_item_id,
        quantity: row.quantity - row.shipped_quantity,
      }))
      .filter((row: any) => row.quantity > 0);
    if (!items.length) {
      Alert.alert('Shipment', 'Every item on this order has already been shipped.');
      return;
    }
    setShipSubmitting(true);
    const response = await postRequest(ROUTES.commerce.shipments, {
      fulfillment_id: shipModalFor.id,
      carrier_name: carrierName,
      tracking_number: trackingNumber,
      items,
    }, { errorMessage: 'Unable to create shipment.' });
    setShipSubmitting(false);
    if (!response.success) {
      Alert.alert('Shipment', response.message || 'Unable to create shipment.');
      return;
    }
    setShipModalFor(null);
    await load();
  }, [shipModalFor, carrierName, trackingNumber, load]);

  const advanceShipment = useCallback(async (shipment: any) => {
    const nextStatus = SHIPMENT_NEXT_STATUS[shipment.status];
    if (!nextStatus) return;
    setBusyId(shipment.id);
    const response = await postRequest(ROUTES.commerce.shipmentTransition(shipment.id), { status: nextStatus }, { errorMessage: 'Unable to update shipment.' });
    setBusyId(null);
    if (!response.success) {
      Alert.alert('Shipment', response.message || 'Unable to update shipment.');
      return;
    }
    await load();
  }, [load]);

  const renderItem = ({ item }: { item: any }) => {
    const action = NEXT_ACTION[item.status];
    const canCreateShipment = ['ready_for_shipment', 'partially_shipped'].includes(item.status);
    return (
      <View style={[styles.card, { borderColor: palette.surfaceDark, backgroundColor: palette.surfaceElevated }]}>
        <Text style={[styles.orderId, { color: palette.subtext }]}>Order · {String(item.order).slice(0, 8)}</Text>
        <Text style={[styles.status, { color: palette.primaryStrong }]}>
          {String(item.status).replace(/_/g, ' ')}
        </Text>
        {item.delivery_address_snapshot ? (
          <Text style={[styles.meta, { color: palette.subtext }]} numberOfLines={2}>
            Ship to: {[item.delivery_address_snapshot.city, item.delivery_address_snapshot.state, item.delivery_address_snapshot.country].filter(Boolean).join(', ')}
          </Text>
        ) : null}
        {(item.shipments || []).map((shipment: any) => (
          <View key={shipment.id} style={styles.shipmentRow}>
            <Text style={[styles.meta, { color: palette.text }]}>
              {shipment.reference} · {String(shipment.status).replace(/_/g, ' ')}
            </Text>
            {SHIPMENT_NEXT_STATUS[shipment.status] ? (
              <KISButton
                title={busyId === shipment.id ? 'Updating…' : `Mark ${SHIPMENT_NEXT_STATUS[shipment.status]?.replace(/_/g, ' ')}`}
                size="xs" variant="ghost" loading={busyId === shipment.id}
                onPress={() => advanceShipment(shipment)} disabled={Boolean(busyId)}
              />
            ) : null}
          </View>
        ))}
        <View style={styles.cardFooter}>
          {action ? (
            <KISButton
              title={busyId === item.id ? 'Updating…' : action.label}
              size="xs" loading={busyId === item.id}
              onPress={() => runFulfillmentAction(item, action.route(item.id), action.label)}
              disabled={Boolean(busyId)}
            />
          ) : null}
          {canCreateShipment ? (
            <KISButton title="Create shipment" size="xs" variant="secondary" onPress={() => openShipModal(item)} disabled={Boolean(busyId)} />
          ) : null}
          {['pending', 'accepted', 'processing', 'ready_for_shipment'].includes(item.status) ? (
            <KISButton
              title="Cancel"
              size="xs" variant="ghost" loading={busyId === item.id}
              onPress={() => runFulfillmentAction(item, ROUTES.commerce.fulfillmentCancel(item.id), 'Cancel order')}
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
        <Text style={[styles.title, { color: palette.text }]}>Orders to fulfill</Text>
        <KISButton title="Refresh" size="sm" variant="ghost" onPress={handleRefresh} disabled={loading} />
      </View>
      {loading ? (
        <View style={styles.loader}><ActivityIndicator color={palette.primaryStrong} /></View>
      ) : error ? (
        <View style={styles.loader}><Text style={{ color: palette.danger }}>{error}</Text></View>
      ) : (
        <FlatList
          data={fulfillments}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={[styles.list, { paddingBottom: Math.max(insets.bottom, 32) }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          ListEmptyComponent={() => (
            <View style={styles.loader}><Text style={{ color: palette.subtext }}>No orders to fulfill right now.</Text></View>
          )}
        />
      )}

      <Modal visible={Boolean(shipModalFor)} animationType="slide" onRequestClose={() => setShipModalFor(null)} transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: palette.surface }]}>
            <Text style={[styles.title, { color: palette.text }]}>Create shipment</Text>
            <ScrollView>
              <TextInput
                style={[styles.input, { borderColor: palette.divider, color: palette.text }]}
                placeholder="Carrier name (optional - manual workflow)"
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
              <KISButton title={shipSubmitting ? 'Creating…' : 'Create shipment'} loading={shipSubmitting} onPress={handleCreateShipment} disabled={shipSubmitting} />
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
  orderId: { fontSize: 11 },
  status: { fontSize: 14, fontWeight: '800', textTransform: 'capitalize' },
  meta: { fontSize: 12 },
  shipmentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  cardFooter: { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  loader: { marginTop: 40, alignItems: 'center', paddingHorizontal: 24 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  modalCard: { borderRadius: 16, padding: 20, maxHeight: '70%' },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 10, fontSize: 14 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 },
});
