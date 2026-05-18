import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { KISIcon } from '@/constants/kisIcons';
import { resolveBackendAssetUrl } from '@/network';
import type { RootStackParamList } from '@/navigation/types';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import type { BroadcastChannelContent, BroadcastChannelDetail, BroadcastChannelPlaylist, BroadcastChannelSummary } from '@/screens/broadcast/channels/api/channels.types';
import {
  fetchChannelContents,
  fetchChannelDetail,
  fetchChannelPlaylists,
} from '@/screens/broadcast/channels/hooks/useChannelsData';
import SubscribeBellButton from '@/screens/broadcast/channels/components/SubscribeBellButton';
import PlaylistRail from '@/screens/broadcast/channels/components/PlaylistRail';

type TabId = 'home' | 'videos' | 'shorts' | 'posts' | 'live' | 'playlists' | 'about';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'home', label: 'Home' },
  { id: 'videos', label: 'Videos' },
  { id: 'shorts', label: 'Shorts' },
  { id: 'posts', label: 'Posts' },
  { id: 'live', label: 'Live' },
  { id: 'playlists', label: 'Playlists' },
  { id: 'about', label: 'About' },
];

const compactNumber = (value?: number) => {
  const num = Number(value || 0);
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return String(num);
};

const initialsFor = (channel?: BroadcastChannelSummary | null) =>
  String(channel?.display_name || channel?.handle || 'KC')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('') || 'KC';

const assetUrlFor = (content: BroadcastChannelContent) =>
  resolveBackendAssetUrl(
    content.thumbnail_url ||
      content.first_asset?.thumbnail_url ||
      content.first_asset?.url ||
      content.assets?.[0]?.thumbnail_url ||
      content.assets?.[0]?.url ||
      '',
  );

const contentLabel = (type?: string) => {
  switch (type) {
    case 'short_video':
      return 'Short';
    case 'rich_text':
      return 'Post';
    case 'live_stream':
      return 'Live';
    default:
      return String(type || 'Post').replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
  }
};

function ChannelAvatar({ channel, size }: { channel?: BroadcastChannelSummary | null; size: number }) {
  const { palette } = useKISTheme();
  const url = channel?.avatar_url ? resolveBackendAssetUrl(channel.avatar_url) : '';
  if (url) return <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  return (
    <View style={[styles.avatarFallback, { width: size, height: size, borderRadius: size / 2, backgroundColor: palette.primarySoft, borderColor: palette.surface }]}>
      <Text style={{ color: palette.primaryStrong, fontWeight: '900', fontSize: Math.max(16, size * 0.28) }}>{initialsFor(channel)}</Text>
    </View>
  );
}

const formatDuration = (seconds?: number) => {
  if (!seconds || seconds <= 0) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
};

function ContentTile({ content, mode = 'grid', onPress }: { content: BroadcastChannelContent; mode?: 'grid' | 'wide'; onPress: () => void }) {
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const compact = responsive.isWatch || responsive.isCompactPhone;
  const imageUrl = assetUrlFor(content);
  const counts = content.engagement_counts || {};
  const duration = formatDuration(content.duration_seconds);
  const isLive = content.content_type === 'live_stream' || content.status === 'live';
  return (
    <Pressable onPress={onPress} style={[mode === 'wide' ? styles.wideTile : styles.contentTile, { backgroundColor: palette.surface, borderColor: palette.border, marginBottom: compact ? 10 : 12 }]}>
      <View style={[mode === 'wide' ? styles.wideMedia : styles.tileMedia, { height: mode === 'wide' ? (compact ? 150 : 196) : (compact ? 106 : 126) }]}>
        {imageUrl ? <Image source={{ uri: imageUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" /> : <LinearGradient colors={[palette.primarySoft, palette.surfaceElevated, palette.surface]} style={StyleSheet.absoluteFillObject} />}
        <View style={styles.mediaScrim} />
        <View style={styles.mediaBadge}>
          <KISIcon name={content.content_type === 'audio' ? 'audio' : content.content_type === 'document' ? 'file' : 'play'} size={13} color="#fff" />
          <Text style={styles.mediaBadgeText}>{contentLabel(content.content_type)}</Text>
        </View>
        {isLive && (
          <View style={[styles.liveBadge, { backgroundColor: '#e74c3c' }]}>
            <Text style={styles.liveBadgeText}>LIVE</Text>
          </View>
        )}
        {duration && !isLive && (
          <View style={styles.durationBadge}>
            <Text style={styles.durationText}>{duration}</Text>
          </View>
        )}
      </View>
      <View style={mode === 'wide' ? styles.wideBody : styles.tileBody}>
        <Text numberOfLines={2} style={[styles.tileTitle, { color: palette.text }]}>{content.title || content.text_plain_preview || 'Untitled content'}</Text>
        <Text numberOfLines={mode === 'wide' ? 2 : 1} style={[styles.tileMeta, { color: palette.subtext }]}>
          {compactNumber(counts.views)} views · {content.published_at ? new Date(content.published_at).toLocaleDateString() : 'Draft'}
        </Text>
      </View>
    </Pressable>
  );
}

export default function ChannelHomePage() {
  const route = useRoute<RouteProp<RootStackParamList, 'ChannelHome'>>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'ChannelHome'>>();
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const compact = responsive.isWatch || responsive.isCompactPhone;
  const columns = compact ? 1 : responsive.isTablet && responsive.isLandscape ? 3 : 2;
  const insets = useSafeAreaInsets();
  const themed = useMemo(() => makeStyles(palette), [palette]);
  const initialChannel = route.params?.channel || null;
  const channelKey = route.params?.channelId || route.params?.handle || initialChannel?.id || initialChannel?.handle || '';

  const [channel, setChannel] = useState<BroadcastChannelDetail | BroadcastChannelSummary | null>(initialChannel);
  const [contents, setContents] = useState<BroadcastChannelContent[]>([]);
  const [playlists, setPlaylists] = useState<BroadcastChannelPlaylist[]>([]);
  const [activeTab, setActiveTab] = useState<TabId>('home');
  const [loading, setLoading] = useState(true);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');


  const load = useCallback(async () => {
    if (!channelKey) return;
    setLoading(true);
    try {
      const detail = await fetchChannelDetail(channelKey);
      const resolved = detail || initialChannel;
      if (resolved) {
        setChannel(resolved);
        const [contentRows, playlistRows] = await Promise.all([
          fetchChannelContents(resolved.id, { limit: 36 }),
          fetchChannelPlaylists(resolved.id),
        ]);
        setContents(contentRows.contents);
        setPlaylists(playlistRows);
      }
    } finally {
      setLoading(false);
    }
  }, [channelKey, initialChannel]);

  useEffect(() => {
    void load();
  }, [load]);

  const openContent = useCallback((content: BroadcastChannelContent) => {
    navigation.navigate('ChannelContentDetail', { contentId: content.id, item: content, channel });
  }, [channel, navigation]);

  const handleShare = useCallback(async () => {
    const url = `https://kis.app/channels/${channel?.handle || channel?.id}`;
    try {
      await Share.share({ message: `${channel?.display_name || 'KIS Channel'} - ${url}`, url, title: channel?.display_name });
    } catch { /* ignore */ }
  }, [channel]);

  const bannerUrl = channel?.banner_url ? resolveBackendAssetUrl(channel.banner_url) : '';
  const featured = contents[0];
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return contents;
    const q = searchQuery.toLowerCase();
    return contents.filter(c =>
      (c.title || '').toLowerCase().includes(q) ||
      (c.text_plain_preview || '').toLowerCase().includes(q),
    );
  }, [contents, searchQuery]);
  const latest = filtered.slice(0, 12);
  const shorts = filtered.filter(item => item.content_type === 'short_video');
  const videos = filtered.filter(item => ['video', 'short_video'].includes(item.content_type));
  const posts = filtered.filter(item => ['text', 'rich_text', 'post', 'image', 'gallery', 'document', 'audio'].includes(item.content_type));
  const live = filtered.filter(item => item.content_type === 'live_stream' || item.status === 'scheduled' || item.status === 'live');

  const tabContents = activeTab === 'videos' ? videos : activeTab === 'shorts' ? shorts : activeTab === 'posts' ? posts : activeTab === 'live' ? live : latest;

  if (loading && !channel) {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: palette.background }]}>
        <ActivityIndicator color={palette.primaryStrong} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: palette.background }]} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + (compact ? 18 : 28) }}>
        <View style={[styles.heroWrap, { height: compact ? 144 : 184 }]}>
          <View style={[styles.banner, { height: compact ? 144 : 184 }]}>
            {bannerUrl ? <Image source={{ uri: bannerUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" /> : <LinearGradient colors={[palette.primarySoft, palette.surfaceElevated, palette.surface]} style={StyleSheet.absoluteFillObject} />}
            <View style={styles.heroShade} />
          </View>
          <Pressable onPress={() => navigation.goBack()} style={[styles.backButton, { top: insets.top + 8 }]}>
            <KISIcon name="arrow-left" size={20} color="#fff" />
          </Pressable>
        </View>

        <View style={[themed.headerCard, { marginHorizontal: responsive.pageGutter, paddingHorizontal: compact ? 12 : 16, paddingBottom: compact ? 12 : 16 }]}>
          <View style={[styles.avatarOverlap, { marginTop: compact ? -38 : -50 }]}><ChannelAvatar channel={channel} size={compact ? 68 : 88} /></View>
          <View style={[styles.headerTopRow, compact && { flexWrap: 'wrap', gap: 10 }]}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <View style={styles.titleRow}>
                <Text numberOfLines={compact ? 2 : 1} style={[styles.channelTitle, { color: palette.text, fontSize: compact ? 20 : 26 }]}>{channel?.display_name || 'KIS Channel'}</Text>
                {channel?.is_verified ? <KISIcon name="check" size={16} color={palette.primaryStrong} /> : null}
              </View>
              <Text style={[styles.handle, { color: palette.subtext }]}>@{channel?.handle || 'channel'}</Text>
              <Text style={[styles.metrics, { color: palette.text }]}>{compactNumber(channel?.subscriber_count)} subscribers · {compactNumber(channel?.content_count || contents.length)} posts</Text>
            </View>
            <SubscribeBellButton channelId={channel?.id} initialSubscribed={Boolean(channel?.is_subscribed)} />
          </View>
          <Text numberOfLines={3} style={[styles.channelDescription, { color: palette.subtext }]}>{channel?.description || 'Original broadcasts, live sessions, posts, files, and updates from this KIS channel.'}</Text>
          <View style={styles.channelActions}>
            <Pressable onPress={handleShare} style={[styles.actionChip, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <KISIcon name="share" size={14} color={palette.text} />
              <Text style={[styles.actionChipText, { color: palette.text }]}>Share</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setSearchVisible(v => !v);
                if (searchVisible) setSearchQuery('');
              }}
              style={[styles.actionChip, { backgroundColor: searchVisible ? palette.primarySoft : palette.surface, borderColor: searchVisible ? palette.primary : palette.border }]}
            >
              <KISIcon name="search" size={14} color={searchVisible ? palette.primaryStrong : palette.text} />
              <Text style={[styles.actionChipText, { color: searchVisible ? palette.primaryStrong : palette.text }]}>Search</Text>
            </Pressable>
          </View>
          {searchVisible && (
            <TextInput
              autoFocus
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search this channel…"
              placeholderTextColor={palette.subtext}
              style={[styles.searchInput, { backgroundColor: palette.bar, color: palette.text, borderColor: palette.border }]}
            />
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.tabRow, { paddingHorizontal: responsive.pageGutter, paddingVertical: compact ? 10 : 14 }]}>
          {TABS.map(tab => {
            const active = activeTab === tab.id;
            return (
              <Pressable key={tab.id} onPress={() => setActiveTab(tab.id)} style={[styles.tabPill, { backgroundColor: active ? palette.primarySoft : palette.surface, borderColor: active ? palette.primary : palette.border }]}> 
                <Text style={{ color: active ? palette.primaryStrong : palette.text, fontWeight: '900', fontSize: 12 }}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {activeTab === 'about' ? (
          <View style={[styles.aboutBox, { backgroundColor: palette.surface, borderColor: palette.border, marginHorizontal: responsive.pageGutter, padding: compact ? 12 : 16 }]}> 
            <Text style={[styles.sectionTitle, { color: palette.text }]}>About</Text>
            <Text style={[styles.aboutText, { color: palette.subtext }]}>{channel?.description || 'No public channel description yet.'}</Text>
            <Text style={[styles.aboutMetric, { color: palette.text }]}>{compactNumber(channel?.subscriber_count)} subscribers</Text>
          </View>
        ) : activeTab === 'playlists' ? (
          <View style={[styles.sectionBlock, { paddingHorizontal: responsive.pageGutter }]}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Playlists</Text>
            {playlists.length ? playlists.map(item => (
              <View key={item.id} style={[styles.playlistCard, { backgroundColor: palette.surface, borderColor: palette.border }]}> 
                <KISIcon name="list" size={18} color={palette.primaryStrong} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.playlistTitle, { color: palette.text }]}>{item.title}</Text>
                  <Text numberOfLines={2} style={[styles.tileMeta, { color: palette.subtext }]}>{item.description || 'Curated channel collection'}</Text>
                </View>
              </View>
            )) : <Text style={[styles.emptyText, { color: palette.subtext }]}>No public playlists yet.</Text>}
          </View>
        ) : (
          <>
            {activeTab === 'home' && featured ? (
              <Pressable onPress={() => openContent(featured)} style={[styles.featuredHero, { backgroundColor: palette.surface, borderColor: palette.border, marginHorizontal: responsive.pageGutter }]}> 
                <View style={[styles.featuredMedia, { height: compact ? 150 : 190 }]}>{assetUrlFor(featured) ? <Image source={{ uri: assetUrlFor(featured) }} style={StyleSheet.absoluteFillObject} resizeMode="cover" /> : <LinearGradient colors={[palette.primarySoft, palette.surfaceElevated, palette.surface]} style={StyleSheet.absoluteFillObject} />}</View>
                <View style={styles.featuredCopy}>
                  <Text style={[styles.eyebrow, { color: palette.primaryStrong }]}>Featured</Text>
                  <Text numberOfLines={2} style={[styles.featuredTitle, { color: palette.text }]}>{featured.title || featured.text_plain_preview || 'Channel feature'}</Text>
                  <Text numberOfLines={2} style={[styles.channelDescription, { color: palette.subtext }]}>{featured.description_preview || featured.text_plain_preview || 'Open this channel item for the full experience.'}</Text>
                </View>
              </Pressable>
            ) : null}

            {activeTab === 'home' ? <PlaylistRail playlists={playlists} onSeeAll={() => setActiveTab('playlists')} /> : null}
            <View style={[styles.sectionBlock, { paddingHorizontal: responsive.pageGutter }]}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>{activeTab === 'home' ? 'Latest uploads' : TABS.find(tab => tab.id === activeTab)?.label}</Text>
              {tabContents.length ? (
                <FlatList
                  data={tabContents}
                  keyExtractor={item => item.id}
                  numColumns={columns}
                  scrollEnabled={false}
                  columnWrapperStyle={columns > 1 ? styles.gridRow : undefined}
                  renderItem={({ item }) => <ContentTile content={item} onPress={() => openContent(item)} />}
                />
              ) : <Text style={[styles.emptyText, { color: palette.subtext }]}>Nothing published here yet.</Text>}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  heroWrap: { height: 184 },
  banner: { height: 184, overflow: 'hidden' },
  heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.18)' },
  backButton: { position: 'absolute', left: 16, width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.34)' },
  avatarOverlap: { marginTop: -50, marginBottom: 12 },
  avatarFallback: { borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  headerTopRow: { flexDirection: 'row', alignItems: 'flex-start' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  channelTitle: { flex: 1, fontSize: 26, fontWeight: '900', letterSpacing: 0 },
  handle: { marginTop: 3, fontSize: 13, fontWeight: '700' },
  metrics: { marginTop: 6, fontSize: 12, fontWeight: '800' },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  subscribeButton: { minHeight: 38, borderRadius: 8, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  roundAction: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  channelDescription: { marginTop: 12, fontSize: 13, lineHeight: 19, fontWeight: '600' },
  tabRow: { paddingHorizontal: 16, paddingVertical: 14, gap: 8 },
  tabPill: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 13, paddingVertical: 8 },
  sectionBlock: { paddingHorizontal: 16, marginTop: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '900', marginBottom: 12 },
  featuredHero: { marginHorizontal: 16, borderWidth: 1, borderRadius: 8, overflow: 'hidden', marginBottom: 18 },
  featuredMedia: { height: 190, overflow: 'hidden' },
  featuredCopy: { padding: 14 },
  eyebrow: { fontSize: 11, textTransform: 'uppercase', fontWeight: '900', marginBottom: 5 },
  featuredTitle: { fontSize: 20, fontWeight: '900', letterSpacing: 0 },
  gridRow: { gap: 10 },
  contentTile: { flex: 1, minWidth: 0, borderWidth: 1, borderRadius: 8, overflow: 'hidden', marginBottom: 12 },
  wideTile: { borderWidth: 1, borderRadius: 8, overflow: 'hidden', marginBottom: 12 },
  tileMedia: { height: 126, overflow: 'hidden' },
  wideMedia: { height: 196, overflow: 'hidden' },
  mediaScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.08)' },
  mediaBadge: { position: 'absolute', left: 8, bottom: 8, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  mediaBadgeText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  tileBody: { padding: 10 },
  wideBody: { padding: 12 },
  tileTitle: { fontSize: 13, lineHeight: 18, fontWeight: '900' },
  tileMeta: { marginTop: 5, fontSize: 11, fontWeight: '700' },
  aboutBox: { marginHorizontal: 16, borderWidth: 1, borderRadius: 8, padding: 16 },
  aboutText: { fontSize: 13, lineHeight: 20, fontWeight: '600' },
  aboutMetric: { marginTop: 14, fontSize: 13, fontWeight: '900' },
  playlistCard: { borderWidth: 1, borderRadius: 8, padding: 13, marginBottom: 10, flexDirection: 'row', alignItems: 'center' },
  playlistTitle: { fontSize: 14, fontWeight: '900' },
  emptyText: { fontSize: 13, lineHeight: 19, fontWeight: '700' },
  liveBadge: { position: 'absolute', left: 8, top: 8, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5 },
  liveBadgeText: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  durationBadge: { position: 'absolute', right: 8, bottom: 8, backgroundColor: 'rgba(0,0,0,0.75)', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 5 },
  durationText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  channelActions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  actionChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  actionChipText: { fontSize: 13, fontWeight: '800' },
  searchInput: { marginTop: 10, borderRadius: 8, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14 },
});

const makeStyles = (palette: ReturnType<typeof useKISTheme>['palette']) => StyleSheet.create({
  headerCard: {
    marginHorizontal: 16,
    marginTop: -26,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    shadowColor: palette.shadow ?? '#000',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
});
