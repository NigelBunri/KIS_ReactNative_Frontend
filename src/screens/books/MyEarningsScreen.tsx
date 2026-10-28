import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import { getRequest } from '@/network/get';
import ROUTES from '@/network';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'MyEarnings'>;

type RoyaltyRecord = {
  id: string;
  book_title: string;
  gross_amount_cents: number;
  commission_cents: number;
  net_royalty_cents: number;
  status: 'earned' | 'reversed';
  created_at: string;
};

const formatCents = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export default function MyEarningsScreen({ navigation }: Props) {
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const sp = layout.pageGutter;

  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<RoyaltyRecord[]>([]);
  const [lifetimeNet, setLifetimeNet] = useState(0);
  const [lifetimeReversed, setLifetimeReversed] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    const res: any = await getRequest(ROUTES.books.royaltiesMine);
    if (res?.success) {
      setRecords(res.data?.records || []);
      setLifetimeNet(res.data?.lifetime_net_earned_cents || 0);
      setLifetimeReversed(res.data?.lifetime_reversed_cents || 0);
    }
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: palette.bg },
    header: { flexDirection: 'row', alignItems: 'center', padding: sp, gap: 10 },
    headerTitle: { fontSize: 18, fontWeight: '700', color: palette.text, flex: 1 },
    scroll: { flex: 1, padding: sp },
    summaryCard: { backgroundColor: palette.primarySoft, borderRadius: 14, padding: 16, gap: 4, marginBottom: 16 },
    summaryLabel: { fontSize: 12, color: palette.subtext, fontWeight: '700' },
    summaryValue: { fontSize: 28, fontWeight: '800', color: palette.text },
    summarySub: { fontSize: 12, color: palette.subtext },
    row: { backgroundColor: palette.card, borderRadius: 12, padding: 14, marginBottom: 8, gap: 2 },
    rowTitle: { fontSize: 14, fontWeight: '700', color: palette.text },
    rowAmount: { fontSize: 15, fontWeight: '800', color: palette.text },
    rowMeta: { fontSize: 12, color: palette.subtext },
    reversedTag: { fontSize: 11, fontWeight: '700', color: '#B23B3B' },
    empty: { textAlign: 'center', color: palette.subtext, padding: sp * 2 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  });

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} accessibilityLabel="Go back">
          <KISIcon name="back" size={22} color={palette.text} />
        </Pressable>
        <Text style={styles.headerTitle}>My Earnings</Text>
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={palette.primary} /></View>
      ) : (
        <ScrollView style={styles.scroll}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>LIFETIME NET EARNINGS</Text>
            <Text style={styles.summaryValue}>{formatCents(lifetimeNet)}</Text>
            {lifetimeReversed > 0 && (
              <Text style={styles.summarySub}>{formatCents(lifetimeReversed)} reversed from refunds</Text>
            )}
          </View>

          {records.length === 0 ? (
            <Text style={styles.empty}>No sales yet. Earnings from paid book purchases will appear here.</Text>
          ) : (
            records.map((r) => (
              <View key={r.id} style={styles.row}>
                <Text style={styles.rowTitle}>{r.book_title}</Text>
                <Text style={styles.rowAmount}>
                  {r.status === 'reversed' ? '—' : '+'}{formatCents(r.net_royalty_cents)}
                  {r.status === 'reversed' && <Text style={styles.reversedTag}>  REFUNDED</Text>}
                </Text>
                <Text style={styles.rowMeta}>
                  {formatCents(r.gross_amount_cents)} gross · {formatCents(r.commission_cents)} platform fee
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
