import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import { getRequest } from '@/network/get';
import ROUTES from '@/network';
import type { RootStackParamList } from '@/navigation/types';
import { useProfileController } from '@/screens/tabs/profile/useProfileController';
import { useAuth } from '../../../App';

const CATEGORY_LABELS: Record<string, string> = {
  health: 'Health & Medical',
  finances: 'Financial Hardship',
  relationships: 'Relationships & Marriage',
  faith: 'Faith & Spirituality',
  business: 'Business & Career',
  grief: 'Loss & Grief',
  addiction: 'Addiction & Recovery',
  family: 'Family & Parenting',
  mental_health: 'Mental Health',
  other: 'Other',
};
const CATEGORIES = Object.keys(CATEGORY_LABELS);
const CATEGORY_EMOJI: Record<string, string> = {
  health: '🏥',
  finances: '💰',
  relationships: '💑',
  faith: '🙏',
  business: '💼',
  grief: '🕊️',
  addiction: '🌱',
  family: '👨‍👩‍👧',
  mental_health: '🧠',
  other: '💙',
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function SeasonsBrowserScreen() {
  const { palette } = useKISTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'SeasonsBrowser'>>();
  const { setAuth, setPhone, callingCode } = useAuth();
  const c = useProfileController({ setAuth, setPhone, locationCallingCode: callingCode });
  const currentUserId = useMemo(() => {
    const uid = c.profile?.user?.id;
    return uid ? String(uid) : null;
  }, [c.profile?.user?.id]);

  const [selectedCategory, setSelectedCategory] = useState<string | null>(route.params?.category ?? null);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [reachedOutSeasonIds, setReachedOutSeasonIds] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);

  const styles = useMemo(() => makeStyles(palette), [palette]);

  const loadData = useCallback(async () => {
    const params: Record<string, string> = {};
    if (selectedCategory) params.category = selectedCategory;

    const [seasonsRes, reachRes] = await Promise.allSettled([
      getRequest(ROUTES.testimony.seasons, { params }),
      getRequest(ROUTES.testimony.reach),
    ]);

    if (seasonsRes.status === 'fulfilled' && seasonsRes.value?.success) {
      const data = seasonsRes.value.data;
      const list = Array.isArray(data) ? data : Array.isArray(data?.results) ? data.results : [];
      setSeasons(list.filter((s: any) => s?.is_active !== false));
    }
    if (reachRes.status === 'fulfilled' && reachRes.value?.success) {
      const data = reachRes.value.data;
      const list = Array.isArray(data) ? data : Array.isArray(data?.results) ? data.results : [];
      const ids = new Set<string>(
        list
          .filter((r: any) => String(r?.from_user?.id) === currentUserId)
          .map((r: any) => String(r?.season?.id ?? r?.season_id ?? '')),
      );
      setReachedOutSeasonIds(ids);
    }
  }, [selectedCategory, currentUserId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const renderSeasonCard = useCallback(
    ({ item }: { item: any }) => {
      const firstName = item?.user?.display_name?.split(' ')[0] ?? 'Someone';
      const initials = (item?.user?.display_name ?? '?')[0].toUpperCase();
      const alreadyReachedOut = reachedOutSeasonIds.has(String(item.id));
      const snippet = item?.description?.slice(0, 120);

      return (
        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.cardRow}>
            {item?.user?.avatar_url ? (
              <Image source={{ uri: item.user.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, { backgroundColor: palette.primary }]}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
            )}
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[styles.name, { color: palette.text }]}>{firstName}</Text>
              <View style={[styles.chip, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                <Text style={[styles.chipText, { color: palette.subtext }]}>
                  {CATEGORY_EMOJI[item.category] ?? '💙'} {CATEGORY_LABELS[item.category] ?? item.category}
                </Text>
              </View>
            </View>
            {alreadyReachedOut ? (
              <View style={[styles.reachedOutChip, { backgroundColor: '#E8F5E9' }]}>
                <Text style={[styles.reachedOutText]}>Reached out ✓</Text>
              </View>
            ) : (
              <Pressable
                onPress={() =>
                  navigation.navigate('ReachOutSheet', {
                    seasonId: String(item.id),
                    seasonTitle: item.title,
                    seasonCategory: item.category,
                  })
                }
                style={[styles.reachBtn, { backgroundColor: palette.primary }]}
              >
                <Text style={styles.reachBtnText}>I've been there</Text>
              </Pressable>
            )}
          </View>
          <Text style={[styles.cardTitle, { color: palette.text }]}>{item.title}</Text>
          {snippet ? (
            <Text style={[styles.cardSnippet, { color: palette.subtext }]}>{snippet}{(item?.description?.length ?? 0) > 120 ? '…' : ''}</Text>
          ) : null}
          {item.created_at ? (
            <Text style={[styles.timeAgo, { color: palette.subtext }]}>{timeAgo(item.created_at)}</Text>
          ) : null}
        </View>
      );
    },
    [palette, navigation, reachedOutSeasonIds, styles],
  );

  return (
    <SafeAreaView style={[{ flex: 1, backgroundColor: palette.bg }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: palette.bg }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
          <KISIcon name="arrow-left" size={22} color={palette.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: palette.text }]}>People Who Need Help</Text>
          <Text style={[styles.headerSubtitle, { color: palette.subtext }]}>Browse seasons. Reach out if you've been there.</Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterScroll}
        style={[styles.filterBar, { backgroundColor: palette.bg }]}
      >
        <Pressable
          onPress={() => setSelectedCategory(null)}
          style={[
            styles.filterChip,
            selectedCategory === null
              ? { backgroundColor: palette.primary }
              : { backgroundColor: palette.surface, borderColor: palette.border, borderWidth: 1 },
          ]}
        >
          <Text style={[styles.filterChipText, { color: selectedCategory === null ? '#fff' : palette.text }]}>All</Text>
        </Pressable>
        {CATEGORIES.map(cat => (
          <Pressable
            key={cat}
            onPress={() => setSelectedCategory(cat)}
            style={[
              styles.filterChip,
              selectedCategory === cat
                ? { backgroundColor: palette.primary }
                : { backgroundColor: palette.surface, borderColor: palette.border, borderWidth: 1 },
            ]}
          >
            <Text style={[styles.filterChipText, { color: selectedCategory === cat ? '#fff' : palette.text }]}>
              {CATEGORY_EMOJI[cat]} {CATEGORY_LABELS[cat]}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <FlatList
        data={seasons}
        keyExtractor={item => String(item.id)}
        renderItem={renderSeasonCard}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.primary} colors={[palette.primary]} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🕊️</Text>
            <Text style={[styles.emptyText, { color: palette.subtext }]}>No one has declared this season yet.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

function makeStyles(palette: any) {
  return StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
    backBtn: { padding: 4 },
    headerTitle: { fontSize: 18, fontWeight: '800' },
    headerSubtitle: { fontSize: 13, marginTop: 2 },
    filterBar: { maxHeight: 56 },
    filterScroll: { paddingHorizontal: 16, gap: 8, alignItems: 'center', paddingVertical: 8 },
    filterChip: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
    filterChipText: { fontSize: 13, fontWeight: '600' },
    list: { paddingHorizontal: 16, paddingBottom: 80, gap: 12, paddingTop: 8 },
    card: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 8 },
    cardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    avatarText: { color: '#fff', fontWeight: '800', fontSize: 18 },
    name: { fontSize: 15, fontWeight: '700' },
    chip: { alignSelf: 'flex-start', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
    chipText: { fontSize: 12 },
    reachBtn: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, alignSelf: 'flex-start' },
    reachBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
    reachedOutChip: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, alignSelf: 'flex-start' },
    reachedOutText: { color: '#2E7D32', fontWeight: '700', fontSize: 13 },
    cardTitle: { fontSize: 15, fontWeight: '700' },
    cardSnippet: { fontSize: 13, lineHeight: 18 },
    timeAgo: { fontSize: 12 },
    emptyState: { alignItems: 'center', paddingTop: 80, gap: 12 },
    emptyEmoji: { fontSize: 40 },
    emptyText: { fontSize: 15, textAlign: 'center' },
  });
}
