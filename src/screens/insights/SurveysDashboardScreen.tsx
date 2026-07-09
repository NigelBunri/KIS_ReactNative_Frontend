import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import type { RootStackParamList } from '@/navigation/types';

type SurveyItem = {
  id: string;
  title?: string;
  description?: string;
  question_count?: number;
  response_count?: number;
  created_at?: string;
};

export default function SurveysDashboardScreen() {
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [surveys, setSurveys] = useState<SurveyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const res = await getRequest(ROUTES.surveys.list, { errorMessage: 'Unable to load surveys.' });
      const items: SurveyItem[] = res.data?.results ?? res.data ?? [];
      setSurveys(items);
    } catch (e: any) {
      setError(e?.message || 'Unable to load surveys.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.bg, }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: palette.divider }]}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: palette.text }]}>Surveys</Text>
            <Text style={[styles.subtitle, { color: palette.subtext }]}>
              Response rates, question performance, and sentiment trends.
            </Text>
          </View>
          <Pressable
            onPress={() => navigation.navigate('SurveyManager')}
            style={[styles.manageBtn, { backgroundColor: palette.primaryStrong }]}
          >
            <Text style={{ color: palette.onPrimary, fontSize: 13, fontWeight: '700' }}>Manage</Text>
          </Pressable>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={palette.primaryStrong} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={{ color: palette.danger, textAlign: 'center' }}>{error}</Text>
          <Pressable onPress={() => load()} style={[styles.retryBtn, { backgroundColor: palette.primaryStrong }]}>
            <Text style={{ color: palette.onPrimary, fontWeight: '700' }}>Retry</Text>
          </Pressable>
        </View>
      ) : surveys.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ color: palette.subtext }}>No surveys yet.</Text>
        </View>
      ) : (
        <FlatList
          data={surveys}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={[styles.list, { paddingHorizontal: responsive.pageGutter }]}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 48 }}>
              <Text style={{ color: palette.subtext, fontSize: 14, textAlign: 'center' }}>
                No surveys yet
              </Text>
            </View>
          }
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={palette.primaryStrong} colors={[palette.primaryStrong]} />}
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.divider }]}>
              <Text style={[styles.cardTitle, { color: palette.text }]}>{item.title || 'Untitled survey'}</Text>
              {item.description ? (
                <Text style={[styles.cardSub, { color: palette.subtext }]} numberOfLines={2}>
                  {item.description}
                </Text>
              ) : null}
              <View style={styles.cardRow}>
                <Text style={[styles.cardMeta, { color: palette.subtext }]}>
                  {item.question_count ?? 0} questions
                </Text>
                <Text style={[styles.cardMeta, { color: palette.subtext }]}>
                  {item.response_count ?? 0} responses
                </Text>
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 20, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  manageBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 4 },
  subtitle: { fontSize: 13 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  list: { padding: 16, gap: 12 },
  card: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  cardSub: { fontSize: 13 },
  cardRow: { flexDirection: 'row', gap: 16 },
  cardMeta: { fontSize: 12 },
});
