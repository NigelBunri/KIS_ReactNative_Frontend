import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import { resolveBackendAssetUrl } from '@/network';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import type { RootStackParamList } from '@/navigation/types';
import {
  fetchContinueWatchingItems,
  fetchChannelContentDetail,
} from '@/screens/broadcast/channels/hooks/useChannelsData';

type ContinueItem = {
  content_id: string;
  progress_seconds: number;
  completed: boolean;
  last_viewed_at: string;
  title?: string;
  thumbnail_url?: string;
  duration_seconds?: number;
};

function formatProgress(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function progressPercent(progress: number, duration?: number): number {
  if (!duration || duration <= 0) return 0;
  return Math.min(1, progress / duration);
}

function ContinueCard({ item, onPress }: { item: ContinueItem; onPress: () => void }) {
  const { palette } = useKISTheme();
  const thumbUrl = item.thumbnail_url ? resolveBackendAssetUrl(item.thumbnail_url) : '';
  const pct = progressPercent(item.progress_seconds, item.duration_seconds);

  return (
    <Pressable onPress={onPress} style={[styles.continueCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <View style={styles.continueThumb}>
        {thumbUrl ? (
          <Image source={{ uri: thumbUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center' }]}>
            <KISIcon name="play" size={22} color={palette.primaryStrong} />
          </View>
        )}
        {pct > 0 && (
          <View style={styles.progressTrack}>
            <View style={[styles.progressBar, { width: `${pct * 100}%` as any, backgroundColor: palette.primaryStrong }]} />
          </View>
        )}
        <View style={styles.progressLabel}>
          <Text style={styles.progressText}>{formatProgress(item.progress_seconds)}</Text>
        </View>
      </View>
      <Text style={[styles.continueTitle, { color: palette.text }]} numberOfLines={2}>
        {item.title || 'Continue watching'}
      </Text>
    </Pressable>
  );
}

const LIBRARY_SECTIONS: Array<{
  key: string;
  label: string;
  icon: string;
  screen: keyof RootStackParamList;
  hint: string;
}> = [
  { key: 'history', label: 'Watch History', icon: 'call-history', screen: 'WatchHistory', hint: 'Your viewed content' },
  { key: 'liked', label: 'Liked Videos', icon: 'heart', screen: 'LikedVideosScreen', hint: 'Videos you liked' },
  { key: 'playlists', label: 'Playlists', icon: 'list', screen: 'PlaylistList', hint: 'Your collections' },
  { key: 'subscriptions', label: 'Subscriptions', icon: 'people', screen: 'SubscriptionsScreen', hint: 'Channels you follow' },
  { key: 'downloads', label: 'Downloads', icon: 'download', screen: 'DownloadsScreen', hint: 'Saved for offline' },
  { key: 'shorts', label: 'Shorts', icon: 'play', screen: 'ShortsScreen', hint: 'Short-form videos' },
];

export default function LibraryScreen() {
  const { palette } = useKISTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [continueItems, setContinueItems] = useState<ContinueItem[]>([]);
  const [continueLoading, setContinueLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [trending, setTrending] = useState<any[]>([]);

  const loadContinue = useCallback(async () => {
    try {
      const raw = await fetchContinueWatchingItems();
      // Enrich with metadata in parallel (first 6 only for performance)
      const enriched = await Promise.all(
        raw.slice(0, 6).map(async entry => {
          try {
            const detail = await fetchChannelContentDetail(entry.content_id);
            return {
              ...entry,
              title: detail?.title || detail?.text_plain_preview,
              thumbnail_url: detail?.thumbnail_url || detail?.first_asset?.thumbnail_url || detail?.first_asset?.url,
              duration_seconds: detail?.duration_seconds,
            } as ContinueItem;
          } catch {
            return entry as ContinueItem;
          }
        }),
      );
      setContinueItems(enriched);
    } finally {
      setContinueLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void loadContinue(); }, [loadContinue]);

  useEffect(() => {
    getRequest(`${ROUTES.broadcasts.broadcastsTrending}?limit=10`, { errorMessage: '' })
      .then(res => setTrending(Array.isArray(res?.results) ? res.results : []))
      .catch(() => {});
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadContinue();
  }, [loadContinue]);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: palette.bg }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: palette.border }]}>
        <Text style={[styles.headerTitle, { color: palette.text }]}>Library</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.primaryStrong} />
        }
      >
        {/* Trending */}
        {trending.length > 0 && (
          <View style={{ marginBottom: 16, marginTop: 16 }}>
            <Text style={{ color: palette.text, fontWeight: '900', fontSize: 15, paddingHorizontal: 16, marginBottom: 8 }}>
              Trending
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
              {trending.map(item => (
                <Pressable
                  key={item.id}
                  onPress={() => navigation.navigate('ChannelContentDetail', { contentId: item.id })}
                  style={{ width: 160 }}
                >
                  {item.thumbnail_url ? (
                    <Image source={{ uri: item.thumbnail_url }} style={{ width: 160, height: 90, borderRadius: 10, marginBottom: 6 }} resizeMode="cover" />
                  ) : (
                    <View style={{ width: 160, height: 90, borderRadius: 10, backgroundColor: palette.card, marginBottom: 6, alignItems: 'center', justifyContent: 'center' }}>
                      <KISIcon name="video" size={24} color={palette.border} />
                    </View>
                  )}
                  <Text style={{ color: palette.text, fontWeight: '800', fontSize: 12 }} numberOfLines={2}>{item.title}</Text>
                  <Text style={{ color: palette.subtext, fontWeight: '600', fontSize: 11 }} numberOfLines={1}>{item.channel?.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Continue Watching */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Continue Watching</Text>
            {continueItems.length > 0 && (
              <Pressable onPress={() => navigation.navigate('WatchHistory')}>
                <Text style={[styles.seeAll, { color: palette.primaryStrong }]}>See all</Text>
              </Pressable>
            )}
          </View>
          {continueLoading ? (
            <ActivityIndicator color={palette.primaryStrong} style={{ marginVertical: 16 }} />
          ) : continueItems.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <KISIcon name="play" size={28} color={palette.border} />
              <Text style={[styles.emptyCardText, { color: palette.subtext }]}>No videos in progress</Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
              {continueItems.map(item => (
                <ContinueCard
                  key={item.content_id}
                  item={item}
                  onPress={() => navigation.navigate('ChannelContentDetail', { contentId: item.content_id })}
                />
              ))}
            </ScrollView>
          )}
        </View>

        {/* Quick Access Grid */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: palette.text, paddingHorizontal: 16, marginBottom: 10 }]}>Your Library</Text>
          <View style={styles.grid}>
            {LIBRARY_SECTIONS.map(section => (
              <Pressable
                key={section.key}
                onPress={() => navigation.navigate(section.screen as any)}
                style={[styles.gridCell, { backgroundColor: palette.surface, borderColor: palette.border }]}
              >
                <View style={[styles.gridIcon, { backgroundColor: palette.primarySoft }]}>
                  <KISIcon name={section.icon} size={22} color={palette.primaryStrong} />
                </View>
                <Text style={[styles.gridLabel, { color: palette.text }]}>{section.label}</Text>
                <Text style={[styles.gridHint, { color: palette.subtext }]}>{section.hint}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 22, fontWeight: '900' },
  section: { marginTop: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '900' },
  seeAll: { fontSize: 13, fontWeight: '700' },
  emptyCard: { marginHorizontal: 16, borderWidth: 1, borderRadius: 12, padding: 28, alignItems: 'center', gap: 8 },
  emptyCardText: { fontSize: 13, fontWeight: '600' },
  continueCard: { width: 160, borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  continueThumb: { height: 92, backgroundColor: '#111' },
  progressTrack: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, backgroundColor: 'rgba(255,255,255,0.3)' },
  progressBar: { height: 3 },
  progressLabel: { position: 'absolute', bottom: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  progressText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  continueTitle: { fontSize: 12, fontWeight: '800', padding: 8, lineHeight: 17 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 8 },
  gridCell: { width: '47%', borderWidth: 1, borderRadius: 16, padding: 16, marginHorizontal: '1.5%', gap: 8 },
  gridIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  gridLabel: { fontSize: 14, fontWeight: '900', marginTop: 2 },
  gridHint: { fontSize: 11, fontWeight: '600' },
});
