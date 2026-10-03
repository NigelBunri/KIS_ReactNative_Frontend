import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { useKISTheme } from '@/theme/useTheme';
import KISButton from '@/constants/KISButton';
import { KISIcon } from '@/constants/kisIcons';
import type { RootStackParamList } from '@/navigation/types';
import { useSafeTopInset } from '@/hooks/useSafeTopInset';

type CreateNavigation = NativeStackNavigationProp<RootStackParamList, 'ReturnRequestCreate'>;
type CreateRoute = RouteProp<RootStackParamList, 'ReturnRequestCreate'>;

const REASONS: Array<{ value: string; label: string }> = [
  { value: 'damaged', label: 'Arrived damaged' },
  { value: 'wrong_item', label: 'Wrong item' },
  { value: 'not_as_described', label: 'Not as described' },
  { value: 'defective', label: 'Defective / doesn\'t work' },
  { value: 'no_longer_needed', label: 'No longer needed' },
  { value: 'other', label: 'Other' },
];

export default function ReturnRequestCreatePage() {
  const { palette } = useKISTheme();
  const topInset = useSafeTopInset();
  const navigation = useNavigation<CreateNavigation>();
  const route = useRoute<CreateRoute>();
  const { orderId } = route.params;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [selectedQty, setSelectedQty] = useState<Record<string, number>>({});
  const [reason, setReason] = useState('damaged');
  const [explanation, setExplanation] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const response = await getRequest(ROUTES.commerce.marketplaceOrder(orderId), {
      errorMessage: 'Unable to load this order.',
    });
    if (response.success) {
      const orderItems = response.data?.items || [];
      setItems(orderItems);
    } else {
      setError(response.message ?? 'Unable to load this order.');
    }
    setLoading(false);
  }, [orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleItem = useCallback((item: any) => {
    setSelectedQty((prev) => {
      const next = { ...prev };
      if (next[item.id]) {
        delete next[item.id];
      } else {
        next[item.id] = 1;
      }
      return next;
    });
  }, []);

  const adjustQty = useCallback((item: any, delta: number) => {
    setSelectedQty((prev) => {
      const current = prev[item.id] || 0;
      const next = Math.max(1, Math.min(item.quantity, current + delta));
      return { ...prev, [item.id]: next };
    });
  }, []);

  const selectedCount = useMemo(() => Object.keys(selectedQty).length, [selectedQty]);

  const handleSubmit = useCallback(async () => {
    if (!selectedCount) {
      Alert.alert('Request a return', 'Select at least one item to return.');
      return;
    }
    setSubmitting(true);
    const response = await postRequest(ROUTES.commerce.returns, {
      order_id: orderId,
      reason,
      explanation,
      items: Object.entries(selectedQty).map(([order_item_id, quantity]) => ({ order_item_id, quantity })),
    }, { errorMessage: 'Unable to submit this return request.' });
    setSubmitting(false);
    if (!response.success) {
      Alert.alert('Request a return', response.message || 'Unable to submit this return request.');
      return;
    }
    Alert.alert('Return requested', 'The seller has been notified and will review your request.', [
      { text: 'OK', onPress: () => navigation.replace('MyReturns') },
    ]);
  }, [selectedCount, orderId, reason, explanation, selectedQty, navigation]);

  return (
    <View style={[styles.root, { backgroundColor: palette.bg, paddingTop: topInset }]}>
      <View style={[styles.header, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <KISIcon name="arrow-left" size={18} color={palette.text} />
        </Pressable>
        <Text style={[styles.title, { color: palette.text }]}>Request a return</Text>
        <View style={{ width: 32 }} />
      </View>

      {loading ? (
        <View style={styles.loader}><ActivityIndicator color={palette.primaryStrong} /></View>
      ) : error ? (
        <View style={styles.loader}>
          <Text style={{ color: palette.danger, textAlign: 'center' }}>{error}</Text>
          <KISButton title="Try again" size="sm" variant="ghost" onPress={load} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          <Text style={[styles.sectionLabel, { color: palette.subtext }]}>Which items are you returning?</Text>
          {items.map((item) => {
            const checked = Boolean(selectedQty[item.id]);
            return (
              <View key={item.id} style={[styles.itemCard, { borderColor: palette.divider, backgroundColor: palette.surfaceElevated }]}>
                <Pressable style={styles.itemRow} onPress={() => toggleItem(item)}>
                  <KISIcon name={checked ? 'checkmark-circle' : 'checkmark-circle-outline'} size={20} color={checked ? palette.primaryStrong : palette.subtext} />
                  <Text style={[styles.itemName, { color: palette.text }]} numberOfLines={2}>
                    {item.product_name || item.product_id} (ordered {item.quantity})
                  </Text>
                </Pressable>
                {checked ? (
                  <View style={styles.qtyRow}>
                    <KISButton title="-" size="xs" variant="ghost" onPress={() => adjustQty(item, -1)} />
                    <Text style={[styles.qtyValue, { color: palette.text }]}>{selectedQty[item.id]}</Text>
                    <KISButton title="+" size="xs" variant="ghost" onPress={() => adjustQty(item, 1)} />
                  </View>
                ) : null}
              </View>
            );
          })}
          {!items.length ? (
            <Text style={{ color: palette.subtext }}>This order has no items eligible for return.</Text>
          ) : null}

          <Text style={[styles.sectionLabel, { color: palette.subtext, marginTop: 20 }]}>Reason</Text>
          <View style={styles.reasonGrid}>
            {REASONS.map((r) => (
              <Pressable
                key={r.value}
                onPress={() => setReason(r.value)}
                style={[
                  styles.reasonChip,
                  {
                    borderColor: reason === r.value ? palette.primaryStrong : palette.divider,
                    backgroundColor: reason === r.value ? palette.primarySoft : palette.surfaceElevated,
                  },
                ]}
              >
                <Text style={{ color: reason === r.value ? palette.primaryStrong : palette.text, fontSize: 12 }}>{r.label}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.sectionLabel, { color: palette.subtext, marginTop: 20 }]}>Tell us more (optional)</Text>
          <TextInput
            style={[styles.input, { borderColor: palette.divider, color: palette.text }]}
            placeholder="Add any details that will help the seller review this request"
            placeholderTextColor={palette.subtext}
            value={explanation}
            onChangeText={setExplanation}
            multiline
          />

          <KISButton
            title={submitting ? 'Submitting…' : 'Submit return request'}
            loading={submitting}
            onPress={handleSubmit}
            disabled={submitting || !selectedCount}
            style={{ marginTop: 24 }}
          />
        </ScrollView>
      )}
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
  title: { fontSize: 16, fontWeight: '800', flex: 1, textAlign: 'center' },
  body: { paddingHorizontal: 16, paddingBottom: 48 },
  sectionLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  itemCard: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 8 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemName: { flex: 1, fontSize: 13 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8, marginLeft: 30 },
  qtyValue: { fontSize: 14, fontWeight: '700', minWidth: 20, textAlign: 'center' },
  reasonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reasonChip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, minHeight: 90, textAlignVertical: 'top' },
  loader: { marginTop: 40, alignItems: 'center', paddingHorizontal: 24, gap: 10 },
});
