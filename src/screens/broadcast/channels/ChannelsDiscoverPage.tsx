import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useResponsiveLayout } from '@/theme/responsive';
import { useChannelsData } from '@/screens/broadcast/channels/hooks/useChannelsData';
import {
  fetchSocialRecommendationFoundation,
  type RecommendationItem,
  type SocialRecommendationFoundation,
} from '@/services/socialRecommendationService';
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
  const { palette, tone } = useKISTheme();
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
        backgroundColor: tone === 'dark' ? palette.primarySoft : '#F8F2E4',
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
  const { palette, tone } = useKISTheme();
  return (
    <View
      style={[
        styles.metricBox,
        {
          backgroundColor: tone === 'dark' ? palette.primarySoft : '#FFFCF5',
          borderColor: tone === 'dark' ? palette.goldMuted : '#E8DDC7',
        },
      ]}
    >
      <Text style={[styles.metricValue, { color: palette.text }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: palette.subtext }]}>{label}</Text>
    </View>
  );
}

function FeaturedChannelCard({ channel, onOpen }: { channel: BroadcastChannelSummary; onOpen: (channel: BroadcastChannelSummary) => void }) {
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const compact = responsive.isWatch || responsive.isCompactPhone;
  return (
    <Pressable onPress={() => onOpen(channel)} style={[styles.featuredCard, { backgroundColor: palette.surface, borderColor: '#E6D7B2', width: compact ? Math.max(190, responsive.width - responsive.pageGutter * 3) : 258 }]}> 
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
  const { palette, tone } = useKISTheme();
  const responsive = useResponsiveLayout();
  const compact = responsive.isWatch || responsive.isCompactPhone;
  return (
    <Pressable onPress={() => onOpen(channel)} style={[styles.listRow, { backgroundColor: palette.surface, borderColor: tone === 'dark' ? palette.goldMuted : '#E8DDC7', padding: compact ? 8 : 10 }]}> 
      {responsive.isWatch ? null : (
      <View style={styles.rowBannerSlot}>
        {channel.banner_url ? <Image source={{ uri: channel.banner_url }} style={styles.rowBanner} /> : <View style={[styles.rowBannerFallback, { backgroundColor: tone === 'dark' ? palette.primarySoft : '#F5EBD3' }]} />}
        <View style={styles.rowAvatar}><ChannelAvatar channel={channel} size={compact ? 40 : 48} /></View>
      </View>
      )}
      <View style={styles.rowContent}>
        <View style={styles.rowTitleLine}>
          <Text numberOfLines={1} style={[styles.rowTitle, { color: palette.text }]}>{channel.display_name}</Text>
          {channel.is_verified ? <KISIcon name="check" size={14} color={GOLD} /> : null}
        </View>
        <Text numberOfLines={1} style={[styles.handleText, { color: palette.subtext }]}>@{channel.handle} · {compactNumber(channel.subscriber_count)} subscribers</Text>
        <Text numberOfLines={2} style={[styles.descriptionText, { color: palette.subtext }]}>{channel.description || channel.category || 'Channel'}</Text>
        <View style={styles.rowTags}>
          {channel.category ? <Text style={[styles.rowTag, { backgroundColor: tone === 'dark' ? palette.primarySoft : '#FFF8E7', color: tone === 'dark' ? palette.primaryStrong : GOLD }]}>{String(channel.category).toUpperCase()}</Text> : null}
          {channel.is_broadcast ? <Text style={[styles.rowTag, { backgroundColor: tone === 'dark' ? palette.primarySoft : '#FFF8E7', color: tone === 'dark' ? palette.primaryStrong : GOLD }]}>BROADCASTING</Text> : null}
        </View>
      </View>
      <KISIcon name="chevron-right" size={18} color={palette.subtext} />
    </Pressable>
  );
}

function RecommendationChip({ item, onOpen }: { item: RecommendationItem; onOpen: (item: RecommendationItem) => void }) {
  const { palette, tone } = useKISTheme();
  return (
    <Pressable
      onPress={() => onOpen(item)}
      style={({ pressed }) => [
        styles.recommendationChip,
        {
          backgroundColor: tone === 'dark' ? palette.primarySoft : '#FFF8E7',
          borderColor: tone === 'dark' ? palette.goldMuted : '#E6D7B2',
          opacity: pressed ? 0.76 : 1,
        },
      ]}
    >
      <Text style={[styles.recommendationKind, { color: tone === 'dark' ? palette.primaryStrong : GOLD }]}>{String(item.kind || '').replace(/_/g, ' ').toUpperCase()}</Text>
      <Text numberOfLines={1} style={[styles.recommendationTitle, { color: palette.text }]}>{item.title}</Text>
      {item.subtitle ? <Text numberOfLines={1} style={[styles.recommendationSubtitle, { color: palette.subtext }]}>{item.subtitle}</Text> : null}
      <Text style={[styles.recommendationAction, { color: tone === 'dark' ? palette.primaryStrong : GOLD }]}>Open</Text>
    </Pressable>
  );
}

export default function ChannelsDiscoverPage({ searchTerm = '', searchContext = 'all' }: Props) {
  const { palette, tone } = useKISTheme();
  const responsive = useResponsiveLayout();
  const compact = responsive.isWatch || responsive.isCompactPhone;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [recommendations, setRecommendations] = useState<SocialRecommendationFoundation | null>(null);
  const activeCategory = searchContext || 'all';
  const { channels, loading, refreshing, error, loadMore } = useChannelsData({
    q: searchTerm,
    category: activeCategory,
  });
  const featured = channels.slice(0, 6);
  const recommended = channels.slice(6);
  const recommendedItems = useMemo(() => {
    const sections = recommendations?.sections || {};
    return [
      ...(sections.channels || []),
      ...(sections.bible || []),
      ...(sections.education || []),
      ...(sections.commerce || []),
      ...(sections.health || []),
      ...(sections.partners || []),
      ...(sections.people || []),
    ].slice(0, 8);
  }, [recommendations?.sections]);
  const openChannel = useCallback((channel: BroadcastChannelSummary) => {
    navigation.navigate('ChannelHome', { channelId: channel.id, handle: channel.handle, channel });
  }, [navigation]);

  const openRecommendation = useCallback((item: RecommendationItem) => {
    const kind = String(item.kind || item.target_type || '').toLowerCase();
    const id = String(item.target_id || '');
    const metadata = item.metadata || {};
    if (!id) return;
    if (kind.includes('channel')) {
      navigation.navigate('ChannelHome', { channelId: id, handle: String(metadata.handle || '') || undefined });
      return;
    }
    if (kind.includes('product')) {
      navigation.navigate('ProductDetail', { productId: id });
      return;
    }
    if (kind.includes('shop') || kind.includes('commerce')) {
      (navigation as any).navigate('MainTabs', { screen: 'Broadcast', params: { focusTab: 'market' } });
      return;
    }
    if (kind.includes('course') || kind.includes('education')) {
      (navigation as any).navigate('MainTabs', { screen: 'Broadcast', params: { focusTab: 'education' } });
      return;
    }
    if (kind.includes('health')) {
      navigation.navigate('HealthInstitutionDetail', {
        institutionId: id,
        institutionType: (metadata.institution_type || 'clinic') as any,
        institutionName: item.title,
      });
      return;
    }
    if (kind.includes('partner')) {
      (navigation as any).navigate('MainTabs', { screen: 'Partners' });
      return;
    }
    if (kind.includes('bible') || kind.includes('meditation')) {
      (navigation as any).navigate('MainTabs', { screen: 'Bible' });
      return;
    }
    (navigation as any).navigate('GlobalSearch');
  }, [navigation]);

  useEffect(() => {
    let active = true;
    fetchSocialRecommendationFoundation(8)
      .then(payload => {
        if (active) setRecommendations(payload);
      })
      .catch(() => {
        if (active) setRecommendations(null);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <View style={[styles.container, { marginTop: compact ? 6 : 10 }]}>
      <View style={[styles.heroPanel, { backgroundColor: palette.surface, borderColor: '#E6D7B2', padding: compact ? 11 : 16 }]}> 
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

      <View style={[styles.recommendationPanel, { backgroundColor: palette.surface, borderColor: '#E6D7B2', padding: compact ? 10 : 14 }]}>
        <View style={styles.sectionHeaderCompact}>
          <View>
            <Text style={[styles.sectionTitle, { color: palette.text, fontSize: compact ? 15 : 17 }]}>For your kingdom journey</Text>
            <Text style={[styles.sectionSubtitle, { color: palette.subtext }]}>
              Privacy-safe suggestions using public, family-safe, and blocked-user-aware signals.
            </Text>
          </View>
          {recommendations?.controls?.christian_content_safe_ranking ? (
            <View style={[styles.safeBadge, { backgroundColor: tone === 'dark' ? palette.primarySoft : '#FFF8E7' }]}>
              <KISIcon name="shield" size={13} color={tone === 'dark' ? palette.primaryStrong : GOLD} />
              <Text style={[styles.safeBadgeText, { color: tone === 'dark' ? palette.primaryStrong : GOLD }]}>Safe</Text>
            </View>
          ) : null}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recommendationRow}>
          {recommendedItems.length ? recommendedItems.map(item => (
            <RecommendationChip key={`${item.kind}-${item.target_type}-${item.target_id}`} item={item} onOpen={openRecommendation} />
          )) : (
            <Text style={[styles.emptyText, { color: palette.subtext }]}>{compact ? 'No recommendations yet.' : 'No recommendations match your current safe discovery settings yet.'}</Text>
          )}
        </ScrollView>
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
                  backgroundColor: active ? (tone === 'dark' ? palette.primarySoft : '#F8F2E4') : palette.surface,
                  borderColor: active ? GOLD : palette.border,
                },
              ]}
            >
              <Text style={{ color: active ? (tone === 'dark' ? palette.primaryStrong : INK) : palette.text, fontWeight: '900', fontSize: 12 }}>{item.label}</Text>
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
      <View style={[styles.liveStrip, { backgroundColor: tone === 'dark' ? palette.primarySoft : '#FFF8E7', borderColor: tone === 'dark' ? palette.goldMuted : '#E6D7B2' }]}> 
        <View style={[styles.liveIconFrame, { backgroundColor: tone === 'dark' ? palette.surface : '#FFFFFF' }]}><KISIcon name="play" size={18} color={tone === 'dark' ? palette.primaryStrong : GOLD} /></View>
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
  recommendationPanel: { borderWidth: 1, borderRadius: 8, padding: 14, marginBottom: 12 },
  sectionHeaderCompact: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  safeBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 6 },
  safeBadgeText: { fontSize: 10, fontWeight: '900' },
  recommendationRow: { gap: 8, paddingTop: 10, paddingRight: 10 },
  recommendationChip: { width: 172, minHeight: 78, borderWidth: 1, borderRadius: 8, padding: 10 },
  recommendationKind: { fontSize: 9, fontWeight: '900' },
  recommendationTitle: { marginTop: 5, fontSize: 13, fontWeight: '900' },
  recommendationSubtitle: { marginTop: 3, fontSize: 11, fontWeight: '700' },
  recommendationAction: { marginTop: 8, fontSize: 10, fontWeight: '900' },
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
