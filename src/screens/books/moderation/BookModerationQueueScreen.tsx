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

type Props = NativeStackScreenProps<RootStackParamList, 'BookModerationQueue'>;

type QueueRow = {
  id: string;
  title: string;
  author_name: string;
  owner: { id: string; email: string | null };
  status: string;
  conversion_status: string | null;
  submitted_at: string | null;
  author_open_restrictions: number;
};

export default function BookModerationQueueScreen({ navigation }: Props) {
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const sp = layout.pageGutter;

  const [rows, setRows] = useState<QueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    const res: any = await getRequest(ROUTES.books.adminQueue());
    if (res?.success) {
      setRows(res.data?.books || []);
      setError(null);
    } else {
      setError(res?.message || 'You do not have book moderation access.');
    }
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { fetchQueue(); }, [fetchQueue]));

  const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: palette.bg },
    header: { flexDirection: 'row', alignItems: 'center', padding: sp, gap: 10 },
    headerTitle: { fontSize: 18, fontWeight: '700', color: palette.text, flex: 1 },
    scroll: { flex: 1, padding: sp },
    row: { backgroundColor: palette.card, borderRadius: 12, padding: 14, marginBottom: 10, gap: 4 },
    rowTitle: { fontSize: 15, fontWeight: '700', color: palette.text },
    meta: { fontSize: 12, color: palette.subtext },
    badge: { fontSize: 12, fontWeight: '700', color: palette.primary },
    warnBadge: { fontSize: 12, fontWeight: '700', color: '#B23B3B' },
    empty: { textAlign: 'center', color: palette.subtext, padding: sp * 2 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  });

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} accessibilityLabel="Go back">
          <KISIcon name="back" size={22} color={palette.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Books Moderation Queue</Text>
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={palette.primary} /></View>
      ) : error ? (
        <View style={styles.centered}><Text style={{ color: '#B23B3B', padding: sp }}>{error}</Text></View>
      ) : (
        <ScrollView style={styles.scroll}>
          {rows.length === 0 ? (
            <Text style={styles.empty}>No books currently awaiting review.</Text>
          ) : (
            rows.map((row) => (
              <Pressable key={row.id} style={styles.row} onPress={() => navigation.navigate('BookModerationReader', { id: row.id })}>
                <Text style={styles.rowTitle}>{row.title}</Text>
                <Text style={styles.meta}>by {row.author_name} · {row.owner.email}</Text>
                <Text style={styles.badge}>{row.status.replace(/_/g, ' ')}</Text>
                {row.conversion_status === 'failed' && <Text style={styles.warnBadge}>Conversion failed</Text>}
                {row.author_open_restrictions > 0 && (
                  <Text style={styles.warnBadge}>{row.author_open_restrictions} open restriction(s) on this author</Text>
                )}
              </Pressable>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
