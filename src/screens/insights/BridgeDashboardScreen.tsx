import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { useKISTheme } from '@/theme/useTheme';
import type { RootStackParamList } from '@/navigation/types';

type BridgeThread = {
  id: string;
  subject?: string;
  status?: string;
  message_count?: number;
  last_activity?: string;
};

type Props = NativeStackScreenProps<RootStackParamList, 'BridgeDashboard'>;

export default function BridgeDashboardScreen({ navigation }: Props) {
  const { palette } = useKISTheme();
  const [threads, setThreads] = useState<BridgeThread[]>([]);
  const [analytics, setAnalytics] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [threadsRes, analyticsRes] = await Promise.allSettled([
        getRequest(ROUTES.bridge.threads, { errorMessage: 'Unable to load bridge threads.' }),
        getRequest(ROUTES.bridge.analytics, { errorMessage: 'Unable to load bridge analytics.' }),
      ]);
      if (threadsRes.status === 'fulfilled' && threadsRes.value.success) {
        const items: BridgeThread[] = threadsRes.value.data?.results ?? threadsRes.value.data ?? [];
        setThreads(items);
      }
      if (analyticsRes.status === 'fulfilled' && analyticsRes.value.success) {
        setAnalytics(analyticsRes.value.data ?? null);
      }
    } catch (e: any) {
      setError(e?.message || 'Unable to load bridge data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <View style={[styles.container, { backgroundColor: palette.bg }]}>
      <View style={[styles.header, { borderBottomColor: palette.divider }]}>
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: palette.text }]}>Bridge</Text>
          <Pressable
            onPress={() => navigation.navigate('BridgeManagement')}
            style={[styles.manageBtn, { backgroundColor: palette.primaryStrong }]}
          >
            <Text style={styles.manageBtnText}>Manage Bridge</Text>
          </Pressable>
        </View>
        <Text style={[styles.subtitle, { color: palette.subtext }]}>
          Automation, job history, and thread sync metrics.
        </Text>
      </View>

      {analytics ? (
        <View style={[styles.statsRow, { borderBottomColor: palette.divider }]}>
          {Object.entries(analytics).slice(0, 4).map(([key, val]) => (
            <View key={key} style={[styles.statBox, { backgroundColor: palette.surface }]}>
              <Text style={[styles.statVal, { color: palette.text }]}>{String(val ?? '—')}</Text>
              <Text style={[styles.statKey, { color: palette.subtext }]}>
                {key.replace(/_/g, ' ')}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={palette.primaryStrong} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={{ color: '#DC2626', textAlign: 'center' }}>{error}</Text>
          <Pressable onPress={load} style={[styles.retryBtn, { backgroundColor: palette.primaryStrong }]}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>Retry</Text>
          </Pressable>
        </View>
      ) : threads.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ color: palette.subtext }}>No bridge threads found.</Text>
        </View>
      ) : (
        <FlatList
          data={threads}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.divider }]}>
              <Text style={[styles.cardTitle, { color: palette.text }]}>{item.subject || 'Thread'}</Text>
              <View style={styles.cardRow}>
                {item.status ? (
                  <Text style={[styles.cardMeta, { color: palette.subtext }]}>
                    {item.status}
                  </Text>
                ) : null}
                <Text style={[styles.cardMeta, { color: palette.subtext }]}>
                  {item.message_count ?? 0} messages
                </Text>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 20, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  title: { fontSize: 22, fontWeight: '800' },
  manageBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  manageBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  subtitle: { fontSize: 13 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, padding: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  statBox: { flex: 1, minWidth: 80, borderRadius: 10, padding: 12, alignItems: 'center', gap: 4 },
  statVal: { fontSize: 18, fontWeight: '800' },
  statKey: { fontSize: 11, textAlign: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  list: { padding: 16, gap: 12 },
  card: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  cardRow: { flexDirection: 'row', gap: 16 },
  cardMeta: { fontSize: 12 },
});
