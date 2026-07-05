import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import type { RootStackParamList } from '@/navigation/types';
import {
  fetchWatchHistory,
  removeFromWatchHistory,
  fetchWatchHistorySettings,
  updateWatchHistorySettings,
  fetchChannelContentDetail,
} from '@/screens/broadcast/channels/hooks/useChannelsData';

type HistoryEntry = {
  content_id: string;
  progress_seconds: number;
  completed: boolean;
  last_viewed_at: string;
  title?: string;
};

function formatProgress(seconds: number): string {
  if (!seconds || seconds <= 0) return '';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function WatchHistoryScreen() {
  const { palette } = useKISTheme();
  const { pageGutter, minTouchTarget, bodyFontSize, labelFontSize, headerTitleSize } = useResponsiveLayout();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [pauseLoading, setPauseLoading] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
      setPage(1);
      setHasMore(true);
    } else {
      setLoading(true);
    }
    try {
      const [rows, settings] = await Promise.all([
        fetchWatchHistory(),
        fetchWatchHistorySettings(),
      ]);
      // Enrich with content titles (first 20 entries for perf)
      const enriched = await Promise.all(
        rows.slice(0, 20).map(async entry => {
          try {
            const detail = await fetchChannelContentDetail(entry.content_id);
            return { ...entry, title: detail?.title || detail?.text_plain_preview || undefined };
          } catch {
            return entry;
          }
        }),
      );
      setHistory([...enriched, ...rows.slice(20)]);
      setIsPaused(settings.is_paused);
      // fetchWatchHistory returns all rows; no server pagination — disable further loads
      setHasMore(false);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleTogglePause = useCallback(async () => {
    if (pauseLoading) return;
    setPauseLoading(true);
    const next = !isPaused;
    setIsPaused(next);
    try {
      await updateWatchHistorySettings(next);
    } catch {
      setIsPaused(!next);
    } finally {
      setPauseLoading(false);
    }
  }, [isPaused, pauseLoading]);

  const handleRemove = useCallback((contentId: string) => {
    Alert.alert('Remove from history', 'Remove this item from your watch history?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await removeFromWatchHistory(contentId);
          setHistory(prev => prev.filter(e => e.content_id !== contentId));
        },
      },
    ]);
  }, []);

  const handleClearAll = useCallback(() => {
    if (!history.length) return;
    Alert.alert('Clear history', 'Remove all items from your watch history?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear all',
        style: 'destructive',
        onPress: async () => {
          for (const entry of history) {
            await removeFromWatchHistory(entry.content_id);
          }
          setHistory([]);
        },
      },
    ]);
  }, [history]);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: palette.bg, marginTop: 25 }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: palette.border, paddingHorizontal: pageGutter }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={[styles.backBtn, { minWidth: minTouchTarget, minHeight: minTouchTarget, alignItems: 'center', justifyContent: 'center' }]}>
          <KISIcon name="arrow-left" size={20} color={palette.text} />
        </Pressable>
        <Text style={[styles.title, { color: palette.text, fontSize: headerTitleSize * 0.75 }]}>Watch History</Text>
        <Pressable
          onPress={handleTogglePause}
          disabled={pauseLoading}
          style={[styles.pausePill, { backgroundColor: isPaused ? palette.primaryStrong : palette.surface, borderColor: isPaused ? palette.primaryStrong : palette.border }]}
        >
          <Text style={[styles.pausePillText, { color: isPaused ? palette.surface : palette.subtext }]}>
            {isPaused ? 'Paused' : 'Active'}
          </Text>
        </Pressable>
        {history.length > 0 && (
          <Pressable onPress={handleClearAll} hitSlop={10} style={{ minHeight: minTouchTarget, justifyContent: 'center' }}>
            <Text style={[styles.clearBtn, { color: palette.primaryStrong, fontSize: labelFontSize }]}>Clear all</Text>
          </Pressable>
        )}
      </View>
      {isPaused && (
        <View style={[styles.pauseBanner, { backgroundColor: palette.primarySoft, borderBottomColor: palette.primaryStrong }]}>
          <KISIcon name="pause" size={14} color={palette.primaryStrong} />
          <Text style={[styles.pauseBannerText, { color: palette.primaryStrong }]}>
            Watch history is paused — new views won't be saved
          </Text>
        </View>
      )}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={palette.primaryStrong} />
        </View>
      ) : history.length === 0 ? (
        <View style={styles.centered}>
          <KISIcon name="play" size={36} color={palette.border} />
          <Text style={[styles.emptyText, { color: palette.subtext }]}>No watch history yet</Text>
        </View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={item => item.content_id}
          contentContainerStyle={{ paddingBottom: 32 }}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 48 }}>
              <Text style={{ color: palette.subtext, fontSize: 14, textAlign: 'center' }}>
                No watch history yet
              </Text>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor={palette.primaryStrong}
            />
          }
          onEndReached={() => { if (hasMore) setPage(p => p + 1); }}
          onEndReachedThreshold={0.3}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => navigation.navigate('ChannelContentDetail', { contentId: item.content_id })}
              style={[styles.row, { borderBottomColor: palette.border, backgroundColor: palette.surface }]}
            >
              <View style={[styles.iconWrap, { backgroundColor: palette.primarySoft }]}>
                <KISIcon name={item.completed ? 'check' : 'play'} size={16} color={palette.primaryStrong} />
              </View>
              <View style={styles.rowInfo}>
                <Text style={[styles.contentId, { color: palette.text, fontSize: bodyFontSize }]} numberOfLines={2}>
                  {item.title || `Content ${item.content_id.slice(0, 8)}…`}
                </Text>
                <View style={styles.rowMeta}>
                  {item.progress_seconds > 0 && !item.completed && (
                    <Text style={[styles.metaText, { color: palette.subtext }]}>
                      Stopped at {formatProgress(item.progress_seconds)}
                    </Text>
                  )}
                  {item.completed && (
                    <Text style={[styles.metaText, { color: palette.primaryStrong }]}>Completed</Text>
                  )}
                  <Text style={[styles.metaText, { color: palette.subtext }]}>
                    {timeAgo(item.last_viewed_at)}
                  </Text>
                </View>
                {item.progress_seconds > 0 && !item.completed && (
                  <View style={[styles.progressBar, { backgroundColor: palette.border, flexDirection: 'row' }]}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          backgroundColor: palette.primaryStrong,
                          flex: Math.min(100, (item.progress_seconds / 3600) * 100),
                        },
                      ]}
                    />
                    <View style={{ flex: 100 - Math.min(100, (item.progress_seconds / 3600) * 100) }} />
                  </View>
                )}
              </View>
              <Pressable onPress={() => handleRemove(item.content_id)} hitSlop={10} style={styles.removeBtn}>
                <KISIcon name="close" size={16} color={palette.subtext} />
              </Pressable>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  backBtn: { padding: 2 },
  title: { flex: 1, fontSize: 18, fontWeight: '900' },
  clearBtn: { fontSize: 13, fontWeight: '700' },
  pausePill: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5 },
  pausePillText: { fontSize: 11, fontWeight: '800' },
  pauseBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  pauseBannerText: { fontSize: 13, fontWeight: '700', flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontSize: 14, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rowInfo: { flex: 1, gap: 4 },
  contentId: { fontSize: 14, fontWeight: '700' },
  rowMeta: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  metaText: { fontSize: 12, fontWeight: '600' },
  progressBar: {
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 4,
  },
  progressFill: { height: 3, borderRadius: 2 },
  removeBtn: { padding: 4, flexShrink: 0, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
