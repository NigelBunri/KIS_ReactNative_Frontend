import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import { KISIcon } from '@/constants/kisIcons';
import KISButton from '@/constants/KISButton';

type Props = NativeStackScreenProps<RootStackParamList, 'ChurchPledge'>;

type Pledge = {
  id: string;
  amount: string | number;
  currency: string;
  period: 'monthly' | 'annual';
  fulfilled_amount: string | number;
  start_date: string;
  end_date?: string | null;
  is_active: boolean;
};

const PERIODS: { value: 'monthly' | 'annual'; label: string }[] = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'annual', label: 'Annual' },
];

function formatCurrency(amount: string | number, currency: string) {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount;
  return `${currency} ${Number.isFinite(n) ? n.toFixed(2) : '0.00'}`;
}

export default function ChurchPledgeScreen({ navigation: _navigation }: Props) {
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const [pledges, setPledges] = useState<Pledge[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formAmount, setFormAmount] = useState('');
  const [formPeriod, setFormPeriod] = useState<'monthly' | 'annual'>('monthly');
  const [formStartDate, setFormStartDate] = useState('');
  const [saving, setSaving] = useState(false);

  const styles = useMemo(() => makeStyles(palette, layout), [palette, layout]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      getRequest(ROUTES.church.pledges)
        .then((res: any) => {
          if (!active) return;
          const raw = res?.data;
          setPledges(Array.isArray(raw) ? raw : raw?.results ?? []);
        })
        .catch(() => { if (active) setPledges([]); })
        .finally(() => { if (active) setLoading(false); });
      return () => { active = false; };
    }, []),
  );

  async function handleCreate() {
    const parsed = parseFloat(formAmount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      Alert.alert('Enter a valid pledge amount');
      return;
    }
    if (!formStartDate.trim()) {
      Alert.alert('A start date is required');
      return;
    }
    setSaving(true);
    try {
      const createdResult = await postRequest(ROUTES.church.pledges, {
        amount: parsed.toFixed(2),
        period: formPeriod,
        start_date: formStartDate.trim(),
      });
      const created = (createdResult?.data ?? createdResult) as Pledge;
      setPledges((prev) => [created, ...prev]);
      setShowForm(false);
      setFormAmount('');
      setFormStartDate('');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to create pledge');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator style={styles.flex} color={palette.gold} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.screenTitle}>My Pledges</Text>

        {pledges.length === 0 ? (
          <View style={styles.emptyState}>
            <KISIcon name="hand-left-outline" size={48} color={palette.subtext} />
            <Text style={styles.emptyText}>You haven't made a pledge yet</Text>
          </View>
        ) : (
          pledges.map((p) => {
            const fulfilled = typeof p.fulfilled_amount === 'string' ? parseFloat(p.fulfilled_amount) : p.fulfilled_amount;
            const total = typeof p.amount === 'string' ? parseFloat(p.amount) : p.amount;
            const pct = total > 0 ? Math.min(100, Math.round((fulfilled / total) * 100)) : 0;
            return (
              <View key={p.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardAmount}>{formatCurrency(p.amount, p.currency)}</Text>
                  <View style={[styles.periodBadge, !p.is_active && styles.periodBadgeInactive]}>
                    <Text style={styles.periodText}>{p.period === 'monthly' ? 'Monthly' : 'Annual'}</Text>
                  </View>
                </View>
                <Text style={styles.cardDates}>
                  Since {p.start_date}{p.end_date ? ` – ${p.end_date}` : ''}
                </Text>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${pct}%` as any }]} />
                </View>
                <Text style={styles.progressLabel}>
                  {formatCurrency(p.fulfilled_amount, p.currency)} fulfilled of {formatCurrency(p.amount, p.currency)} ({pct}%)
                </Text>
                {!p.is_active && <Text style={styles.inactiveLabel}>No longer active</Text>}
              </View>
            );
          })
        )}
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => setShowForm(true)} activeOpacity={0.85}>
        <KISIcon name="add" size={28} color={palette.bg} />
      </TouchableOpacity>

      <Modal visible={showForm} animationType="slide" transparent onRequestClose={() => setShowForm(false)}>
        <View style={styles.modalOverlay}>
          <ScrollView>
            <View style={styles.modalSheet}>
              <Text style={styles.modalTitle}>Make a Pledge</Text>

              <TextInput
                style={styles.input}
                placeholder="Amount"
                placeholderTextColor={palette.subtext}
                value={formAmount}
                onChangeText={setFormAmount}
                keyboardType="decimal-pad"
              />

              <View style={styles.periodRow}>
                {PERIODS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.periodOption, formPeriod === opt.value && styles.periodOptionActive]}
                    onPress={() => setFormPeriod(opt.value)}
                  >
                    <Text style={[styles.periodOptionText, formPeriod === opt.value && styles.periodOptionTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                style={styles.input}
                placeholder="Start date (YYYY-MM-DD)"
                placeholderTextColor={palette.subtext}
                value={formStartDate}
                onChangeText={setFormStartDate}
              />

              <View style={styles.modalActions}>
                <KISButton title="Cancel" variant="ghost" onPress={() => setShowForm(false)} style={{ flex: 1 }} />
                <KISButton
                  title={saving ? 'Saving…' : 'Pledge'}
                  onPress={handleCreate}
                  disabled={saving}
                  loading={saving}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function makeStyles(palette: any, layout: any) {
  const sp = layout.pageGutter;
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: palette.bg },
    flex: { flex: 1 },
    scroll: { paddingHorizontal: sp, paddingTop: 20, paddingBottom: 80 },
    screenTitle: { fontSize: 22, fontWeight: '700', color: palette.text, marginBottom: 20 },
    card: {
      backgroundColor: palette.card,
      borderColor: palette.divider,
      borderWidth: 1,
      borderRadius: 14,
      padding: 14,
      marginBottom: 14,
      gap: 6,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    cardAmount: { fontSize: 18, fontWeight: '700', color: palette.text },
    periodBadge: { backgroundColor: palette.primarySoft, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
    periodBadgeInactive: { backgroundColor: palette.surface },
    periodText: { fontSize: 11, fontWeight: '700', color: palette.gold },
    cardDates: { fontSize: 13, color: palette.subtext },
    progressTrack: { height: 6, borderRadius: 3, backgroundColor: palette.surface, overflow: 'hidden', marginTop: 4 },
    progressFill: { height: 6, borderRadius: 3, backgroundColor: palette.gold },
    progressLabel: { fontSize: 12, color: palette.subtext },
    inactiveLabel: { fontSize: 12, color: palette.subtext, fontStyle: 'italic' },
    emptyState: { alignItems: 'center', paddingTop: 60, gap: 12 },
    emptyText: { fontSize: 15, color: palette.subtext },
    fab: {
      position: 'absolute',
      bottom: 28,
      right: 24,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: palette.gold,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 6,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.2,
      shadowRadius: 6,
    },
    modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
    modalSheet: { backgroundColor: palette.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, gap: 12 },
    modalTitle: { fontSize: 18, fontWeight: '700', color: palette.text, marginBottom: 4 },
    input: {
      borderWidth: 1,
      borderColor: palette.divider,
      backgroundColor: palette.card,
      color: palette.text,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      minHeight: 48,
    },
    periodRow: { flexDirection: 'row', gap: 8 },
    periodOption: {
      flex: 1,
      borderWidth: 1,
      borderColor: palette.divider,
      borderRadius: 10,
      paddingVertical: 10,
      alignItems: 'center',
    },
    periodOptionActive: { borderColor: palette.gold, backgroundColor: palette.primarySoft },
    periodOptionText: { fontSize: 14, color: palette.subtext },
    periodOptionTextActive: { color: palette.gold, fontWeight: '700' },
    modalActions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  });
}
