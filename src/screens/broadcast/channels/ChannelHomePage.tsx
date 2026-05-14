import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
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

function ContentTile({ content, mode = 'grid', onPress }: { content: BroadcastChannelContent; mode?: 'grid' | 'wide'; onPress: () => void }) {
  const { palette } = useKISTheme();
  const imageUrl = assetUrlFor(content);
  const counts = content.engagement_counts || {};
  return (
    <Pressable onPress={onPress} style={[mode === 'wide' ? styles.wideTile : styles.contentTile, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <View style={mode === 'wide' ? styles.wideMedia : styles.tileMedia}>
        {imageUrl ? <Image source={{ uri: imageUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" /> : <LinearGradient colors={[palette.primarySoft, palette.surfaceElevated, palette.surface]} style={StyleSheet.absoluteFillObject} />}
        <View style={styles.mediaScrim} />
        <View style={styles.mediaBadge}>
          <KISIcon name={content.content_type === 'audio' ? 'audio' : content.content_type === 'document' ? 'file' : 'play'} size={13} color="#fff" />
          <Text style={styles.mediaBadgeText}>{contentLabel(content.content_type)}</Text>
        </View>
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
  const insets = useSafeAreaInsets();
  const themed = useMemo(() => makeStyles(palette), [palette]);
  const initialChannel = route.params?.channel || null;
  const channelKey = route.params?.channelId || route.params?.handle || initialChannel?.id || initialChannel?.handle || '';

  const [channel, setChannel] = useState<BroadcastChannelDetail | BroadcastChannelSummary | null>(initialChannel);
  const [contents, setContents] = useState<BroadcastChannelContent[]>([]);
  const [playlists, setPlaylists] = useState<BroadcastChannelPlaylist[]>([]);
  const [activeTab, setActiveTab] = useState<TabId>('home');
  const [loading, setLoading] = useState(true);


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

  const bannerUrl = channel?.banner_url ? resolveBackendAssetUrl(channel.banner_url) : '';
  const featured = contents[0];
  const latest = contents.slice(0, 12);
  const shorts = contents.filter(item => item.content_type === 'short_video');
  const videos = contents.filter(item => ['video', 'short_video'].includes(item.content_type));
  const posts = contents.filter(item => ['text', 'rich_text', 'post', 'image', 'gallery', 'document', 'audio'].includes(item.content_type));
  const live = contents.filter(item => item.content_type === 'live_stream' || item.status === 'scheduled');

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
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 28 }}>
        <View style={styles.heroWrap}>
          <View style={styles.banner}>
            {bannerUrl ? <Image source={{ uri: bannerUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" /> : <LinearGradient colors={[palette.primarySoft, palette.surfaceElevated, palette.surface]} style={StyleSheet.absoluteFillObject} />}
            <View style={styles.heroShade} />
          </View>
          <Pressable onPress={() => navigation.goBack()} style={[styles.backButton, { top: insets.top + 8 }]}>
            <KISIcon name="arrow-left" size={20} color="#fff" />
          </Pressable>
        </View>

        <View style={themed.headerCard}>
          <View style={styles.avatarOverlap}><ChannelAvatar channel={channel} size={88} /></View>
          <View style={styles.headerTopRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <View style={styles.titleRow}>
                <Text numberOfLines={1} style={[styles.channelTitle, { color: palette.text }]}>{channel?.display_name || 'KIS Channel'}</Text>
                {channel?.is_verified ? <KISIcon name="check" size={16} color={palette.primaryStrong} /> : null}
              </View>
              <Text style={[styles.handle, { color: palette.subtext }]}>@{channel?.handle || 'channel'}</Text>
              <Text style={[styles.metrics, { color: palette.text }]}>{compactNumber(channel?.subscriber_count)} subscribers · {compactNumber(channel?.content_count || contents.length)} posts</Text>
            </View>
            <SubscribeBellButton channelId={channel?.id} initialSubscribed={Boolean(channel?.is_subscribed)} />
          </View>
          <Text numberOfLines={3} style={[styles.channelDescription, { color: palette.subtext }]}>{channel?.description || 'Original broadcasts, live sessions, posts, files, and updates from this KIS channel.'}</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
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
          <View style={[styles.aboutBox, { backgroundColor: palette.surface, borderColor: palette.border }]}> 
            <Text style={[styles.sectionTitle, { color: palette.text }]}>About</Text>
            <Text style={[styles.aboutText, { color: palette.subtext }]}>{channel?.description || 'No public channel description yet.'}</Text>
            <Text style={[styles.aboutMetric, { color: palette.text }]}>{compactNumber(channel?.subscriber_count)} subscribers</Text>
          </View>
        ) : activeTab === 'playlists' ? (
          <View style={styles.sectionBlock}>
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
              <Pressable onPress={() => openContent(featured)} style={[styles.featuredHero, { backgroundColor: palette.surface, borderColor: palette.border }]}> 
                <View style={styles.featuredMedia}>{assetUrlFor(featured) ? <Image source={{ uri: assetUrlFor(featured) }} style={StyleSheet.absoluteFillObject} resizeMode="cover" /> : <LinearGradient colors={[palette.primarySoft, palette.surfaceElevated, palette.surface]} style={StyleSheet.absoluteFillObject} />}</View>
                <View style={styles.featuredCopy}>
                  <Text style={[styles.eyebrow, { color: palette.primaryStrong }]}>Featured</Text>
                  <Text numberOfLines={2} style={[styles.featuredTitle, { color: palette.text }]}>{featured.title || featured.text_plain_preview || 'Channel feature'}</Text>
                  <Text numberOfLines={2} style={[styles.channelDescription, { color: palette.subtext }]}>{featured.description_preview || featured.text_plain_preview || 'Open this channel item for the full experience.'}</Text>
                </View>
              </Pressable>
            ) : null}

            {activeTab === 'home' ? <PlaylistRail playlists={playlists} onSeeAll={() => setActiveTab('playlists')} /> : null}
            <View style={styles.sectionBlock}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>{activeTab === 'home' ? 'Latest uploads' : TABS.find(tab => tab.id === activeTab)?.label}</Text>
              {tabContents.length ? (
                <FlatList
                  data={tabContents}
                  keyExtractor={item => item.id}
                  numColumns={2}
                  scrollEnabled={false}
                  columnWrapperStyle={styles.gridRow}
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
