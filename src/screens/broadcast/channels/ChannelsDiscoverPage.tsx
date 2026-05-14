import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { KISIcon } from '@/constants/kisIcons';
import { useKISTheme } from '@/theme/useTheme';
import { useChannelsData } from '@/screens/broadcast/channels/hooks/useChannelsData';
import type { RootStackParamList } from '@/navigation/types';
import type { BroadcastChannelSummary } from '@/screens/broadcast/channels/api/channels.types';

type Props = {
  searchTerm?: string;
  searchContext?: string;
};

const CATEGORY_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'video', label: 'Video' },
  { key: 'shorts', label: 'Shorts' },
  { key: 'live', label: 'Live' },
  { key: 'audio', label: 'Music / Audio' },
  { key: 'documents', label: 'Documents' },
  { key: 'education', label: 'Education' },
  { key: 'market', label: 'Market' },
  { key: 'health', label: 'Health' },
  { key: 'partners', label: 'Partners' },
];

const GOLD = '#B98A22';
const INK = '#17140F';

const initialsFor = (channel: BroadcastChannelSummary) =>
  String(channel.display_name || channel.handle || 'KC')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('') || 'KC';

const compactNumber = (value?: number) => {
  const num = Number(value || 0);
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return String(num);
};

function ChannelAvatar({ channel, size = 48 }: { channel: BroadcastChannelSummary; size?: number }) {
  const { palette } = useKISTheme();
  if (channel.avatar_url) {
    return (
      <Image
        source={{ uri: channel.avatar_url }}
        style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: '#FFFFFF' }}
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#F8F2E4',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#FFFFFF',
      }}
    >
      <Text style={{ color: palette.primaryStrong, fontWeight: '900' }}>{initialsFor(channel)}</Text>
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  const { palette } = useKISTheme();
  return (
    <View style={styles.metricBox}>
      <Text style={[styles.metricValue, { color: palette.text }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: palette.subtext }]}>{label}</Text>
    </View>
  );
}

function FeaturedChannelCard({ channel, onOpen }: { channel: BroadcastChannelSummary; onOpen: (channel: BroadcastChannelSummary) => void }) {
  const { palette } = useKISTheme();
  return (
    <Pressable onPress={() => onOpen(channel)} style={[styles.featuredCard, { backgroundColor: palette.surface, borderColor: '#E6D7B2' }]}> 
      <View style={styles.bannerWrap}>
        {channel.banner_url ? (
          <Image source={{ uri: channel.banner_url }} style={styles.bannerImage} />
        ) : (
          <LinearGradient
            colors={['#17140F', '#6D5320', '#F7ECD2']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
        )}
        <LinearGradient
          colors={['rgba(0,0,0,0.04)', 'rgba(0,0,0,0.45)']}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.featuredTopLine}>
          <View style={styles.goldBadge}>
            <Text style={styles.goldBadgeText}>{channel.is_broadcast ? 'ON AIR' : 'CHANNEL'}</Text>
          </View>
          {channel.is_verified ? <KISIcon name="check" size={16} color="#FFFFFF" /> : null}
        </View>
        <View style={styles.avatarLift}><ChannelAvatar channel={channel} size={58} /></View>
      </View>
      <View style={styles.featuredBody}>
        <Text numberOfLines={1} style={[styles.featuredTitle, { color: palette.text }]}>{channel.display_name}</Text>
        <Text numberOfLines={1} style={[styles.handleText, { color: palette.subtext }]}>@{channel.handle}</Text>
        <Text numberOfLines={2} style={[styles.descriptionText, { color: palette.subtext }]}>{channel.description || 'Curated broadcasts, live updates, and original KIS channel content.'}</Text>
        <View style={styles.metricsRow}>
          <Metric label="Subscribers" value={compactNumber(channel.subscriber_count)} />
          <Metric label="Posts" value={compactNumber(channel.content_count)} />
        </View>
      </View>
    </Pressable>
  );
}

function ChannelListRow({ channel, onOpen }: { channel: BroadcastChannelSummary; onOpen: (channel: BroadcastChannelSummary) => void }) {
  const { palette } = useKISTheme();
  return (
    <Pressable onPress={() => onOpen(channel)} style={[styles.listRow, { backgroundColor: palette.surface, borderColor: '#E8DDC7' }]}> 
      <View style={styles.rowBannerSlot}>
        {channel.banner_url ? <Image source={{ uri: channel.banner_url }} style={styles.rowBanner} /> : <View style={styles.rowBannerFallback} />}
        <View style={styles.rowAvatar}><ChannelAvatar channel={channel} size={48} /></View>
      </View>
      <View style={styles.rowContent}>
        <View style={styles.rowTitleLine}>
          <Text numberOfLines={1} style={[styles.rowTitle, { color: palette.text }]}>{channel.display_name}</Text>
          {channel.is_verified ? <KISIcon name="check" size={14} color={GOLD} /> : null}
        </View>
        <Text numberOfLines={1} style={[styles.handleText, { color: palette.subtext }]}>@{channel.handle} · {compactNumber(channel.subscriber_count)} subscribers</Text>
        <Text numberOfLines={2} style={[styles.descriptionText, { color: palette.subtext }]}>{channel.description || channel.category || 'Channel'}</Text>
        <View style={styles.rowTags}>
          {channel.category ? <Text style={styles.rowTag}>{String(channel.category).toUpperCase()}</Text> : null}
          {channel.is_broadcast ? <Text style={styles.rowTag}>BROADCASTING</Text> : null}
        </View>
      </View>
      <KISIcon name="chevron-right" size={18} color={palette.subtext} />
    </Pressable>
  );
}

export default function ChannelsDiscoverPage({ searchTerm = '', searchContext = 'all' }: Props) {
  const { palette } = useKISTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const activeCategory = searchContext || 'all';
  const { channels, loading, refreshing, error, loadMore } = useChannelsData({
    q: searchTerm,
    category: activeCategory,
  });
  const featured = channels.slice(0, 6);
  const recommended = channels.slice(6);
  const openChannel = useCallback((channel: BroadcastChannelSummary) => {
    navigation.navigate('ChannelHome', { channelId: channel.id, handle: channel.handle, channel });
  }, [navigation]);

  return (
    <View style={styles.container}>
      <View style={[styles.heroPanel, { backgroundColor: palette.surface, borderColor: '#E6D7B2' }]}> 
        <View style={styles.heroTextBlock}>
          <Text style={styles.eyebrow}>KIS CHANNELS</Text>
          <Text style={[styles.heroTitle, { color: palette.text }]}>Creator channels built for video, files, live, and feeds.</Text>
          <Text style={[styles.heroCopy, { color: palette.subtext }]}>Discover verified creators, institutions, shops, health providers, education hubs, and partners.</Text>
        </View>
        <View style={styles.heroStats}>
          <Metric label="Channels" value={compactNumber(channels.length)} />
          <Metric label="Featured" value={compactNumber(featured.length)} />
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
        {CATEGORY_FILTERS.map(item => {
          const active = item.key === activeCategory;
          return (
            <View
              key={item.key}
              style={[
                styles.categoryPill,
                {
                  backgroundColor: active ? '#F8F2E4' : palette.surface,
                  borderColor: active ? GOLD : palette.border,
                },
              ]}
            >
              <Text style={{ color: active ? INK : palette.text, fontWeight: '900', fontSize: 12 }}>{item.label}</Text>
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.sectionHeader}>
        <View>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Featured channels</Text>
          <Text style={[styles.sectionSubtitle, { color: palette.subtext }]}>Premium creator spaces and live-ready channel homes.</Text>
        </View>
        {loading && !refreshing ? <ActivityIndicator size="small" color={palette.primaryStrong} /> : null}
      </View>
      {featured.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.featuredRow}>
          {featured.map(channel => <FeaturedChannelCard key={channel.id} channel={channel} onOpen={openChannel} />)}
        </ScrollView>
      ) : (
        <View style={[styles.emptyState, { backgroundColor: palette.surface, borderColor: palette.border }]}> 
          <KISIcon name="sub-channel" size={24} color={palette.primaryStrong} />
          <Text style={[styles.emptyTitle, { color: palette.text }]}>No channels yet</Text>
          <Text style={[styles.emptyText, { color: palette.subtext }]}>{error || 'Channels will appear here as creators publish public channel homes.'}</Text>
        </View>
      )}

      <View style={styles.sectionHeader}>
        <View>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Live and premieres</Text>
          <Text style={[styles.sectionSubtitle, { color: palette.subtext }]}>A reserved rail for streams, replays, and premieres.</Text>
        </View>
      </View>
      <View style={[styles.liveStrip, { backgroundColor: '#FFF8E7', borderColor: '#E6D7B2' }]}> 
        <View style={styles.liveIconFrame}><KISIcon name="play" size={18} color={GOLD} /></View>
        <Text style={[styles.liveText, { color: palette.text }]}>Live streams, premieres, and replays will collect here as channels publish them.</Text>
      </View>

      <View style={styles.sectionHeader}>
        <View>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Recommended channels</Text>
          <Text style={[styles.sectionSubtitle, { color: palette.subtext }]}>A refined list for scanning channels quickly.</Text>
        </View>
      </View>
      {(recommended.length ? recommended : featured).map(channel => <ChannelListRow key={`row-${channel.id}`} channel={channel} onOpen={openChannel} />)}
      {channels.length ? (
        <Pressable onPress={loadMore} style={[styles.loadMore, { borderColor: '#E6D7B2', backgroundColor: palette.surface }]}> 
          <Text style={{ color: palette.primaryStrong, fontWeight: '900' }}>Load more channels</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 10, paddingBottom: 22 },
  heroPanel: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  heroTextBlock: { gap: 5 },
  eyebrow: { color: GOLD, fontSize: 10, fontWeight: '900', letterSpacing: 0 },
  heroTitle: { fontSize: 20, lineHeight: 25, fontWeight: '900' },
  heroCopy: { fontSize: 12, lineHeight: 18, fontWeight: '700' },
  heroStats: { flexDirection: 'row', gap: 10, marginTop: 14 },
  categoryRow: { paddingVertical: 6, paddingRight: 10 },
  categoryPill: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginRight: 8 },
  sectionHeader: { marginTop: 18, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 17, fontWeight: '900' },
  sectionSubtitle: { marginTop: 2, fontSize: 11, lineHeight: 15, fontWeight: '700' },
  featuredRow: { paddingRight: 12 },
  featuredCard: { width: 258, borderWidth: 1, borderRadius: 8, overflow: 'hidden', marginRight: 12, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 3 },
  bannerWrap: { height: 104, overflow: 'hidden' },
  bannerImage: { width: '100%', height: '100%' },
  featuredTopLine: { position: 'absolute', top: 10, left: 10, right: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  goldBadge: { backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  goldBadgeText: { color: INK, fontSize: 9, fontWeight: '900' },
  avatarLift: { position: 'absolute', left: 14, bottom: -28 },
  featuredBody: { paddingHorizontal: 14, paddingTop: 34, paddingBottom: 14 },
  featuredTitle: { fontSize: 16, fontWeight: '900' },
  handleText: { fontSize: 11, fontWeight: '700', marginTop: 2 },
  descriptionText: { fontSize: 12, lineHeight: 17, marginTop: 6, fontWeight: '700' },
  metricsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  metricBox: { minWidth: 78, borderWidth: 1, borderColor: '#E8DDC7', backgroundColor: '#FFFCF5', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  metricValue: { fontSize: 14, fontWeight: '900' },
  metricLabel: { marginTop: 1, fontSize: 9, fontWeight: '800' },
  emptyState: { borderWidth: 1, borderRadius: 8, padding: 18, alignItems: 'center' },
  emptyTitle: { marginTop: 8, fontSize: 15, fontWeight: '900' },
  emptyText: { marginTop: 4, fontSize: 12, textAlign: 'center', lineHeight: 18 },
  liveStrip: { borderWidth: 1, borderRadius: 8, padding: 12, flexDirection: 'row', alignItems: 'center' },
  liveIconFrame: { width: 34, height: 34, borderRadius: 8, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  liveText: { flex: 1, fontSize: 12, fontWeight: '800', lineHeight: 18 },
  listRow: { borderWidth: 1, borderRadius: 8, padding: 10, flexDirection: 'row', alignItems: 'center', marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 1 },
  rowBannerSlot: { width: 78, height: 64, borderRadius: 8, overflow: 'visible', marginRight: 12 },
  rowBanner: { width: 78, height: 52, borderRadius: 8 },
  rowBannerFallback: { width: 78, height: 52, borderRadius: 8, backgroundColor: '#F5EBD3' },
  rowAvatar: { position: 'absolute', left: 6, bottom: 0 },
  rowContent: { flex: 1, minWidth: 0 },
  rowTitleLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowTitle: { flex: 1, fontSize: 14, fontWeight: '900' },
  rowTags: { flexDirection: 'row', gap: 6, marginTop: 7, flexWrap: 'wrap' },
  rowTag: { overflow: 'hidden', borderRadius: 8, backgroundColor: '#FFF8E7', color: GOLD, paddingHorizontal: 7, paddingVertical: 3, fontSize: 9, fontWeight: '900' },
  loadMore: { borderWidth: 1, borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginTop: 4 },
});
