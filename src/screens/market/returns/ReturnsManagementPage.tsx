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

type ReturnsManagementNavigation = NativeStackNavigationProp<RootStackParamList, 'ReturnsManagement'>;

const STATUS_LABELS: Record<string, string> = {
  requested: 'Needs your review',
  approved: 'Approved — awaiting shipment',
  rejected: 'Declined',
  return_shipped: 'In transit back to you',
  received: 'Received — inspect & resolve',
  completed: 'Completed & refunded',
  cancelled: 'Cancelled by buyer',
};

export default function ReturnsManagementPage() {
  const { palette } = useKISTheme();
  const insets = useSafeAreaInsets();
  const topInset = useSafeTopInset();
  const navigation = useNavigation<ReturnsManagementNavigation>();
  const [returns, setReturns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectModalFor, setRejectModalFor] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectSubmitting, setRejectSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const response = await getRequest(ROUTES.commerce.returns, { errorMessage: 'Unable to load returns.' });
    if (response.success) {
      const payload = response.data;
      setReturns(Array.isArray(payload) ? payload : payload?.results ?? []);
    } else {
      setError(response.message ?? 'Unable to load returns.');
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

  const openRejectModal = useCallback((item: any) => {
    setRejectReason('');
    setRejectModalFor(item);
  }, []);

  const handleReject = useCallback(async () => {
    if (!rejectModalFor || !rejectReason.trim()) {
      Alert.alert('Decline return', 'Please explain why this return is being declined.');
      return;
    }
    setRejectSubmitting(true);
    const response = await postRequest(ROUTES.commerce.returnReject(rejectModalFor.id), {
      rejection_reason: rejectReason.trim(),
    }, { errorMessage: 'Unable to decline this return.' });
    setRejectSubmitting(false);
    if (!response.success) {
      Alert.alert('Return', response.message || 'Unable to decline this return.');
      return;
    }
    setRejectModalFor(null);
    await load();
  }, [rejectModalFor, rejectReason, load]);

  const renderItem = ({ item }: { item: any }) => {
    const canApprove = item.status === 'requested';
    const canReject = ['requested', 'received'].includes(item.status);
    const canReceive = item.status === 'return_shipped';
    const canComplete = item.status === 'received';
    return (
      <View style={[styles.card, { borderColor: palette.surfaceDark, backgroundColor: palette.surfaceElevated }]}>
        <Text style={[styles.buyerName, { color: palette.subtext }]}>{item.buyer_username}</Text>
        <Text style={[styles.status, { color: palette.primaryStrong }]}>
          {STATUS_LABELS[item.status] || item.status}
        </Text>
        <Text style={[styles.meta, { color: palette.text }]}>
          {(item.items || []).map((ri: any) => `${ri.quantity}x ${ri.product_name}`).join(', ')}
        </Text>
        <Text style={[styles.meta, { color: palette.subtext }]}>Reason: {String(item.reason).replace(/_/g, ' ')}</Text>
        {item.explanation ? (
          <Text style={[styles.meta, { color: palette.subtext }]} numberOfLines={3}>"{item.explanation}"</Text>
        ) : null}
        {item.return_tracking_number ? (
          <Text style={[styles.meta, { color: palette.text }]}>
            Tracking: {item.return_carrier_name || 'Carrier not given'} · {item.return_tracking_number}
          </Text>
        ) : null}
        <View style={styles.cardFooter}>
          {canApprove ? (
            <KISButton
              title="Approve" size="xs" loading={busyId === item.id}
              onPress={() => runAction(item, ROUTES.commerce.returnApprove(item.id), 'Approve return')}
              disabled={Boolean(busyId)}
            />
          ) : null}
          {canReceive ? (
            <KISButton
              title="Mark received" size="xs" loading={busyId === item.id}
              onPress={() => runAction(item, ROUTES.commerce.returnReceive(item.id), 'Mark received')}
              disabled={Boolean(busyId)}
            />
          ) : null}
          {canComplete ? (
            <KISButton
              title="Complete & refund" size="xs" loading={busyId === item.id}
              onPress={() => runAction(item, ROUTES.commerce.returnComplete(item.id), 'Complete return and issue refund')}
              disabled={Boolean(busyId)}
            />
          ) : null}
          {canReject ? (
            <KISButton title="Decline" size="xs" variant="ghost" onPress={() => openRejectModal(item)} disabled={Boolean(busyId)} />
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
        <Text style={[styles.title, { color: palette.text }]}>Returns to manage</Text>
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
            <View style={styles.loader}><Text style={{ color: palette.subtext }}>No return requests right now.</Text></View>
          )}
        />
      )}

      <Modal visible={Boolean(rejectModalFor)} animationType="slide" onRequestClose={() => setRejectModalFor(null)} transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: palette.surface }]}>
            <Text style={[styles.title, { color: palette.text }]}>Decline return</Text>
            <ScrollView>
              <TextInput
                style={[styles.input, styles.multiline, { borderColor: palette.divider, color: palette.text }]}
                placeholder="Explain why this return is being declined"
                placeholderTextColor={palette.subtext}
                value={rejectReason}
                onChangeText={setRejectReason}
                multiline
              />
            </ScrollView>
            <View style={styles.modalActions}>
              <KISButton title="Cancel" variant="ghost" onPress={() => setRejectModalFor(null)} />
              <KISButton title={rejectSubmitting ? 'Saving…' : 'Decline return'} loading={rejectSubmitting} onPress={handleReject} disabled={rejectSubmitting} />
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
  buyerName: { fontSize: 11 },
  status: { fontSize: 14, fontWeight: '800' },
  meta: { fontSize: 12 },
  cardFooter: { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  loader: { marginTop: 40, alignItems: 'center', paddingHorizontal: 24, gap: 10 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  modalCard: { borderRadius: 16, padding: 20, maxHeight: '70%' },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 10, fontSize: 14 },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 },
});
