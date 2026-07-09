import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import LinearGradient from 'react-native-linear-gradient';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import { getRequest } from '@/network/get';
import ROUTES from '@/network';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Podcasts'>;

type PodcastChannel = {
  id: string;
  title: string;
  creator: string;
  category: string;
  episode_count: number;
  description?: string;
};

type Episode = {
  id: string;
  title: string;
  duration?: string;
  published_at?: string;
  audio_url?: string;
  stream_url?: string;
};

const ALL_CATEGORY = 'All';

export default function PodcastsScreen({ navigation }: Props) {
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const sp = layout.pageGutter;

  const [channels, setChannels] = useState<PodcastChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORY);
  const [expandedChannelId, setExpandedChannelId] = useState<string | null>(null);
  const [episodes, setEpisodes] = useState<Record<string, Episode[]>>({});
  const [loadingEpisodes, setLoadingEpisodes] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      getRequest(ROUTES.mediaExtended.podcastChannels)
        .then((res: any) => {
          if (active) setChannels(res?.data ?? res ?? []);
        })
        .catch(() => {})
        .finally(() => { if (active) setLoading(false); });
      return () => { active = false; };
    }, []),
  );

  const categories = [ALL_CATEGORY, ...Array.from(new Set(channels.map((c) => c.category).filter(Boolean)))];

  const filtered = selectedCategory === ALL_CATEGORY
    ? channels
    : channels.filter((c) => c.category === selectedCategory);

  const handleChannelPress = async (channel: PodcastChannel) => {
    if (expandedChannelId === channel.id) {
      setExpandedChannelId(null);
      return;
    }
    setExpandedChannelId(channel.id);
    if (!episodes[channel.id]) {
      setLoadingEpisodes(channel.id);
      try {
        const res: any = await getRequest(ROUTES.mediaExtended.podcastEpisodes + `?channel=${channel.id}`);
        setEpisodes((prev) => ({ ...prev, [channel.id]: res?.data ?? res ?? [] }));
      } catch {}
      setLoadingEpisodes(null);
    }
  };

  const numCols = 2;
  const cardGap = 10;
  const cardWidth = (layout.width - sp * 2 - cardGap) / numCols;

  const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: palette.bg, },
    header: { padding: sp, paddingBottom: sp + 4 },
    backBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, minHeight: 44 },
    backLabel: { fontSize: 16, color: palette.ivory, marginLeft: 4 },
    headerTitle: { fontSize: 24, fontWeight: '700', color: palette.ivory },
    scroll: { flex: 1 },
    categoryBar: { paddingHorizontal: sp, paddingVertical: 10 },
    chipRow: { flexDirection: 'row', gap: 8 },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 20,
      borderWidth: 1,
      minHeight: 34,
      justifyContent: 'center',
    },
    chipText: { fontSize: 13, fontWeight: '500' },
    grid: { flexDirection: 'row', flexWrap: 'wrap', padding: sp, gap: cardGap },
    channelCard: {
      width: cardWidth,
      backgroundColor: palette.card,
      borderRadius: 12,
      padding: 12,
      alignItems: 'center',
    },
    channelCardActive: { borderWidth: 2, borderColor: palette.primary },
    avatar: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: palette.primarySoft,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 8,
    },
    channelTitle: { fontSize: 14, fontWeight: '600', color: palette.text, textAlign: 'center', marginBottom: 2 },
    channelCreator: { fontSize: 12, color: palette.subtext, textAlign: 'center', marginBottom: 4 },
    episodeCount: { fontSize: 12, color: palette.primary },
    episodeSection: {
      marginHorizontal: sp,
      marginBottom: 16,
      backgroundColor: palette.card,
      borderRadius: 12,
      overflow: 'hidden',
    },
    episodeSectionTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: palette.text,
      padding: sp,
      borderBottomWidth: 1,
      borderBottomColor: palette.divider,
    },
    episodeItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: sp,
      borderBottomWidth: 1,
      borderBottomColor: palette.divider,
      minHeight: 56,
      gap: 12,
    },
    episodeInfo: { flex: 1 },
    episodeTitle: { fontSize: 14, color: palette.text, fontWeight: '500' },
    episodeMeta: { fontSize: 12, color: palette.subtext, marginTop: 2 },
    episodeLoadingWrap: { padding: sp, alignItems: 'center' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    content: { paddingBottom: 80 },
    empty: { textAlign: 'center', color: palette.subtext, padding: sp * 2 },
  });

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={palette.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient colors={[palette.gradientStart, palette.gradientEnd]} style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
          <KISIcon name="chevron-back-outline" size={22} color={palette.ivory} />
          <Text style={styles.backLabel}>Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Podcasts</Text>
      </LinearGradient>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryBar}>
        <View style={styles.chipRow}>
          {categories.map((cat) => {
            const active = selectedCategory === cat;
            return (
              <Pressable
                key={cat}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? palette.primary : palette.surface,
                    borderColor: active ? palette.primary : palette.divider,
                  },
                ]}
                onPress={() => setSelectedCategory(cat)}
                hitSlop={4}
              >
                <Text style={[styles.chipText, { color: active ? palette.ivory : palette.text }]}>
                  {cat}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {filtered.length === 0 && (
          <Text style={styles.empty}>No podcast channels found.</Text>
        )}

        <View style={styles.grid}>
          {filtered.map((channel) => {
            const isExpanded = expandedChannelId === channel.id;
            return (
              <Pressable
                key={channel.id}
                style={[styles.channelCard, isExpanded && styles.channelCardActive]}
                onPress={() => handleChannelPress(channel)}
                hitSlop={4}
              >
                <View style={styles.avatar}>
                  <KISIcon name="mic-outline" size={28} color={palette.primary} />
                </View>
                <Text style={styles.channelTitle} numberOfLines={2}>{channel.title}</Text>
                <Text style={styles.channelCreator} numberOfLines={1}>{channel.creator}</Text>
                <Text style={styles.episodeCount}>{channel.episode_count ?? 0} episodes</Text>
              </Pressable>
            );
          })}
        </View>

        {expandedChannelId && (
          <View style={styles.episodeSection}>
            <Text style={styles.episodeSectionTitle}>
              {filtered.find((c) => c.id === expandedChannelId)?.title} — Episodes
            </Text>
            {loadingEpisodes === expandedChannelId ? (
              <View style={styles.episodeLoadingWrap}>
                <ActivityIndicator size="small" color={palette.primary} />
              </View>
            ) : (episodes[expandedChannelId] ?? []).length === 0 ? (
              <Text style={[styles.empty, { padding: 16 }]}>No episodes yet.</Text>
            ) : (
              (episodes[expandedChannelId] ?? []).map((ep) => (
                <Pressable
                  key={ep.id}
                  style={({ pressed }) => [styles.episodeItem, { opacity: pressed ? 0.75 : 1 }]}
                  onPress={() => {
                    const url = ep.audio_url ?? ep.stream_url;
                    if (url) {
                      Linking.openURL(url).catch(() =>
                        Alert.alert('Error', 'Could not open episode.'),
                      );
                    } else {
                      Alert.alert(ep.title, 'No audio stream available for this episode yet.');
                    }
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Play ${ep.title}`}
                >
                  <KISIcon name="play-circle-outline" size={24} color={palette.primary} />
                  <View style={styles.episodeInfo}>
                    <Text style={styles.episodeTitle} numberOfLines={2}>{ep.title}</Text>
                    <Text style={styles.episodeMeta}>
                      {ep.duration ?? ''}
                      {ep.duration && ep.published_at ? ' · ' : ''}
                      {ep.published_at ? new Date(ep.published_at).toLocaleDateString() : ''}
                    </Text>
                  </View>
                </Pressable>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
