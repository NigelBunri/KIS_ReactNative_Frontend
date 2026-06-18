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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { KISIcon } from '@/constants/kisIcons';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KIS_ROYAL_GRADIENTS } from '@/theme/constants';
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

function ChannelAvatar({
  channel,
  size = 48,
}: {
  channel: BroadcastChannelSummary;
  size?: number;
}) {
  const { palette, tone } = useKISTheme();
  if (channel.avatar_url) {
    return (
      <Image
        source={{ uri: channel.avatar_url }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 2,
          borderColor: palette.ivory,
        }}
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: palette.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: palette.ivory,
      }}
    >
      <Text style={{ color: palette.primaryStrong, fontWeight: '900', fontSize: size * 0.33 }}>
        {initialsFor(channel)}
      </Text>
    </View>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  const { palette, tone } = useKISTheme();
  return (
    <View
      style={[
        styles.statPill,
        {
          backgroundColor: palette.primarySoft,
          borderColor: palette.goldMuted ?? palette.border,
        },
      ]}
    >
      <Text style={[styles.statValue, { color: palette.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: palette.subtext }]}>{label}</Text>
    </View>
  );
}

function FeaturedChannelCard({
  channel,
  onOpen,
}: {
  channel: BroadcastChannelSummary;
  onOpen: (channel: BroadcastChannelSummary) => void;
}) {
  const { palette, tone } = useKISTheme();
  const responsive = useResponsiveLayout();
  const compact = responsive.isWatch || responsive.isCompactPhone;
  const cardWidth = compact
    ? Math.max(200, responsive.width - responsive.pageGutter * 3)
    : 270;
  const bannerFallbackGradient =
    tone === 'dark' ? KIS_ROYAL_GRADIENTS.goldDark : KIS_ROYAL_GRADIENTS.goldLight;

  return (
    <Pressable
      onPress={() => onOpen(channel)}
      style={({ pressed }) => [
        styles.featuredCard,
        {
          backgroundColor: palette.surface,
          borderColor: palette.goldMuted ?? palette.border,
          width: cardWidth,
          opacity: pressed ? 0.92 : 1,
        },
      ]}
    >
      {/* Banner */}
      <View style={styles.bannerWrap}>
        {channel.banner_url ? (
          <Image source={{ uri: channel.banner_url }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
        ) : (
          <LinearGradient
            colors={[...bannerFallbackGradient]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
        )}
        {/* Bottom fade */}
        <LinearGradient
          colors={['transparent', palette.overlay]}
          style={[StyleSheet.absoluteFillObject, { top: '40%' }]}
        />
        {/* Live / verified badge top-right */}
        <View style={styles.bannerTopRight}>
          {channel.is_broadcast ? (
            <View style={[styles.livePill, { backgroundColor: palette.danger }]}>
              <View style={[styles.liveDot, { backgroundColor: palette.ivory }]} />
              <Text style={[styles.livePillText, { color: palette.ivory }]}>LIVE</Text>
            </View>
          ) : channel.is_verified ? (
            <View style={[styles.verifiedPill, { backgroundColor: palette.ivory }]}>
              <KISIcon name="check" size={11} color={palette.royalInk} />
              <Text style={[styles.verifiedPillText, { color: palette.royalInk }]}>Verified</Text>
            </View>
          ) : null}
        </View>
        {/* Subscriber count overlay bottom-right */}
        <View style={[styles.bannerSubCount, { backgroundColor: palette.overlay }]}>
          <KISIcon name="person" size={11} color={palette.ivory} />
          <Text style={[styles.bannerSubCountText, { color: palette.ivory }]}>
            {compactNumber(channel.subscriber_count)}
          </Text>
        </View>
        {/* Avatar lift */}
        <View style={styles.avatarLift}>
          <ChannelAvatar channel={channel} size={compact ? 54 : 62} />
        </View>
      </View>

      {/* Body */}
      <View style={[styles.featuredBody, { paddingTop: compact ? 32 : 38 }]}>
        <View style={styles.featuredNameRow}>
          <Text numberOfLines={1} style={[styles.featuredTitle, { color: palette.text, fontSize: compact ? 14 : 16 }]}>
            {channel.display_name}
          </Text>
          {channel.is_verified && !channel.is_broadcast ? (
            <KISIcon name="check" size={14} color={palette.gold} />
          ) : null}
        </View>
        <Text numberOfLines={1} style={[styles.handleText, { color: palette.subtext }]}>
          @{channel.handle}
        </Text>
        <Text numberOfLines={2} style={[styles.descriptionText, { color: palette.subtext, marginTop: 6 }]}>
          {channel.description || 'Curated broadcasts and original KIS channel content.'}
        </Text>

        <View style={styles.featuredFooter}>
          {channel.category ? (
            <Text
              style={[
                styles.categoryTag,
                {
                  backgroundColor: palette.primarySoft ?? palette.surface,
                  color: tone === 'dark' ? palette.primaryStrong : palette.gold,
                },
              ]}
            >
              {String(channel.category).toUpperCase()}
            </Text>
          ) : null}
          <View style={styles.postCount}>
            <KISIcon name="play" size={11} color={palette.subtext} />
            <Text style={[styles.postCountText, { color: palette.subtext }]}>
              {compactNumber(channel.content_count)} posts
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function ChannelListRow({
  channel,
  onOpen,
}: {
  channel: BroadcastChannelSummary;
  onOpen: (channel: BroadcastChannelSummary) => void;
}) {
  const { palette, tone } = useKISTheme();
  return (
    <Pressable
      onPress={() => onOpen(channel)}
      style={({ pressed }) => [
        styles.listRow,
        {
          backgroundColor: palette.surface,
          borderColor: palette.goldMuted ?? palette.border,
          opacity: pressed ? 0.88 : 1,
        },
      ]}
    >
      <ChannelAvatar channel={channel} size={48} />
      <View style={styles.listRowContent}>
        <View style={styles.listRowTitleLine}>
          <Text numberOfLines={1} style={[styles.listRowTitle, { color: palette.text }]}>
            {channel.display_name}
          </Text>
          {channel.is_verified ? (
            <KISIcon name="check" size={13} color={palette.gold} />
          ) : null}
        </View>
        <Text numberOfLines={1} style={[styles.handleText, { color: palette.subtext }]}>
          @{channel.handle} · {compactNumber(channel.subscriber_count)} subscribers
        </Text>
        {channel.description ? (
          <Text numberOfLines={1} style={[styles.descriptionText, { color: palette.subtext, marginTop: 3 }]}>
            {channel.description}
          </Text>
        ) : null}
        {channel.category ? (
          <Text
            style={[
              styles.categoryTag,
              {
                backgroundColor: palette.primarySoft ?? palette.surface,
                color: tone === 'dark' ? palette.primaryStrong : palette.gold,
                marginTop: 6,
                alignSelf: 'flex-start',
              },
            ]}
          >
            {String(channel.category).toUpperCase()}
          </Text>
        ) : null}
      </View>
      <View
        style={[
          styles.listRowChevron,
          {
            backgroundColor: palette.primarySoft ?? palette.surface,
            borderColor: palette.goldMuted ?? palette.border,
          },
        ]}
      >
        <KISIcon name="chevron-right" size={16} color={tone === 'dark' ? palette.primaryStrong : palette.gold} />
      </View>
    </Pressable>
  );
}

function RecommendationChip({
  item,
  onOpen,
}: {
  item: RecommendationItem;
  onOpen: (item: RecommendationItem) => void;
}) {
  const { palette, tone } = useKISTheme();
  return (
    <Pressable
      onPress={() => onOpen(item)}
      style={({ pressed }) => [
        styles.recommendationChip,
        {
          backgroundColor: palette.primarySoft ?? palette.surface,
          borderColor: palette.goldMuted ?? palette.border,
          opacity: pressed ? 0.76 : 1,
        },
      ]}
    >
      <Text style={[styles.recommendationKind, { color: tone === 'dark' ? palette.primaryStrong : palette.gold }]}>
        {String(item.kind || '').replace(/_/g, ' ').toUpperCase()}
      </Text>
      <Text numberOfLines={2} style={[styles.recommendationTitle, { color: palette.text }]}>
        {item.title}
      </Text>
      {item.subtitle ? (
        <Text numberOfLines={1} style={[styles.recommendationSubtitle, { color: palette.subtext }]}>
          {item.subtitle}
        </Text>
      ) : null}
      <View style={styles.recommendationOpenRow}>
        <Text style={[styles.recommendationAction, { color: tone === 'dark' ? palette.primaryStrong : palette.gold }]}>
          Open
        </Text>
        <KISIcon name="arrow-right" size={10} color={tone === 'dark' ? palette.primaryStrong : palette.gold} />
      </View>
    </Pressable>
  );
}

export default function ChannelsDiscoverPage({ searchTerm = '', searchContext = 'all' }: Props) {
  const { palette, tone } = useKISTheme();
  const insets = useSafeAreaInsets();
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
  const rest = channels.slice(6);

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

  const openChannel = useCallback(
    (channel: BroadcastChannelSummary) => {
      navigation.navigate('ChannelHome', { channelId: channel.id, handle: channel.handle, channel });
    },
    [navigation],
  );

  const openRecommendation = useCallback(
    (item: RecommendationItem) => {
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
    },
    [navigation],
  );

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

  const hasChannels = channels.length > 0;
  const isSafe = recommendations?.controls?.christian_content_safe_ranking;

  return (
    <View style={[styles.container, { marginTop: compact ? 6 : 10, paddingBottom: insets.bottom + 24 }]}>

      {/* ── Hero strip ─────────────────────────────────────────── */}
      <View
        style={[
          styles.heroStrip,
          {
            backgroundColor: palette.surface,
            borderColor: palette.goldMuted ?? palette.border,
          },
        ]}
      >
        <View style={styles.heroLeft}>
          <View style={styles.heroEyebrowRow}>
            <Text style={[styles.eyebrow, { color: tone === 'dark' ? palette.primaryStrong : palette.gold }]}>
              KIS CHANNELS
            </Text>
            {isSafe ? (
              <View style={[styles.safeBadge, { backgroundColor: palette.primarySoft ?? palette.surface }]}>
                <KISIcon name="shield" size={11} color={tone === 'dark' ? palette.primaryStrong : palette.gold} />
                <Text style={[styles.safeBadgeText, { color: tone === 'dark' ? palette.primaryStrong : palette.gold }]}>
                  Safe
                </Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.heroTitle, { color: palette.text, fontSize: compact ? 16 : 19 }]}>
            Creator-owned broadcast spaces
          </Text>
          <Text style={[styles.heroCopy, { color: palette.subtext }]}>
            Video, live, audio, docs and community channels.
          </Text>
        </View>
        <View style={styles.heroStats}>
          <StatPill label="Channels" value={loading && !hasChannels ? '…' : compactNumber(channels.length)} />
          {loading && !refreshing ? (
            <ActivityIndicator size="small" color={palette.primaryStrong} style={{ marginTop: 6 }} />
          ) : null}
        </View>
      </View>

      {/* ── For your journey (recommendations) ─────────────────── */}
      {recommendedItems.length > 0 ? (
        <View
          style={[
            styles.recommendationPanel,
            {
              backgroundColor: palette.surface,
              borderColor: palette.goldMuted ?? palette.border,
            },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: palette.text, fontSize: compact ? 14 : 16 }]}>
            For your journey
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.recommendationRow}
          >
            {recommendedItems.map(item => (
              <RecommendationChip
                key={`${item.kind}-${item.target_type}-${item.target_id}`}
                item={item}
                onOpen={openRecommendation}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}

      {/* ── Featured channels ───────────────────────────────────── */}
      <View style={styles.sectionHeaderRow}>
        <View>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Featured channels</Text>
          <Text style={[styles.sectionSubtitle, { color: palette.subtext }]}>
            Premium creator spaces and live-ready homes.
          </Text>
        </View>
      </View>

      {featured.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.featuredRow}
        >
          {featured.map(channel => (
            <FeaturedChannelCard key={channel.id} channel={channel} onOpen={openChannel} />
          ))}
        </ScrollView>
      ) : !loading ? (
        <View
          style={[
            styles.emptyState,
            { backgroundColor: palette.surface, borderColor: palette.goldMuted ?? palette.border },
          ]}
        >
          <KISIcon name="sub-channel" size={28} color={palette.primaryStrong} />
          <Text style={[styles.emptyTitle, { color: palette.text }]}>No channels yet</Text>
          <Text style={[styles.emptyText, { color: palette.subtext }]}>
            {error || 'Channels will appear here as creators publish public channel homes.'}
          </Text>
        </View>
      ) : (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="large" color={palette.primaryStrong} />
        </View>
      )}

      {/* ── All channels list ───────────────────────────────────── */}
      {(rest.length > 0 || (featured.length > 0)) ? (
        <>
          <View style={[styles.sectionHeaderRow, { marginTop: 20 }]}>
            <View>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>All channels</Text>
              <Text style={[styles.sectionSubtitle, { color: palette.subtext }]}>
                Scan and discover channels quickly.
              </Text>
            </View>
          </View>
          <View style={{ gap: 10 }}>
            {(rest.length ? rest : featured).map(channel => (
              <ChannelListRow key={`row-${channel.id}`} channel={channel} onOpen={openChannel} />
            ))}
          </View>
          {channels.length >= 6 ? (
            <Pressable
              onPress={loadMore}
              style={({ pressed }) => [
                styles.loadMoreBtn,
                {
                  borderColor: palette.goldMuted ?? palette.border,
                  backgroundColor: pressed
                    ? (palette.primarySoft ?? palette.surface)
                    : palette.surface,
                },
              ]}
            >
              <Text style={{ color: palette.primaryStrong, fontWeight: '900', fontSize: 14 }}>
                Load more channels
              </Text>
            </Pressable>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 10 },

  // Hero
  heroStrip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    gap: 12,
    elevation: 2,
  },
  heroLeft: { flex: 1, gap: 4 },
  heroEyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  safeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  safeBadgeText: { fontSize: 10, fontWeight: '900' },
  heroTitle: { fontSize: 19, fontWeight: '900', lineHeight: 24, letterSpacing: -0.3 },
  heroCopy: { fontSize: 12, fontWeight: '700', lineHeight: 17 },
  heroStats: { alignItems: 'flex-end', gap: 6 },
  statPill: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    minWidth: 72,
  },
  statValue: { fontSize: 15, fontWeight: '900' },
  statLabel: { fontSize: 9, fontWeight: '800', marginTop: 1 },

  // Recommendations
  recommendationPanel: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  recommendationRow: { gap: 8, paddingTop: 10, paddingRight: 8 },
  recommendationChip: {
    width: 158,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 2,
  },
  recommendationKind: { fontSize: 9, fontWeight: '900', letterSpacing: 0.6 },
  recommendationTitle: { fontSize: 13, fontWeight: '900', lineHeight: 18, marginTop: 4 },
  recommendationSubtitle: { fontSize: 11, fontWeight: '700', marginTop: 2 },
  recommendationOpenRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 8 },
  recommendationAction: { fontSize: 11, fontWeight: '900' },

  // Section headers
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginTop: 4,
  },
  sectionTitle: { fontSize: 17, fontWeight: '900', letterSpacing: -0.2 },
  sectionSubtitle: { marginTop: 2, fontSize: 11, fontWeight: '700', lineHeight: 15 },

  // Featured cards
  featuredRow: { paddingRight: 12, gap: 12 },
  featuredCard: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 3,
  },
  bannerWrap: { height: 120, overflow: 'visible', position: 'relative' },
  bannerTopRight: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    gap: 6,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  livePillText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  verifiedPillText: { fontSize: 9, fontWeight: '900' },
  bannerSubCount: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  bannerSubCountText: { fontSize: 11, fontWeight: '900' },
  avatarLift: { position: 'absolute', left: 14, bottom: -30 },
  featuredBody: { paddingHorizontal: 14, paddingBottom: 14, gap: 2 },
  featuredNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  featuredTitle: { fontSize: 16, fontWeight: '900', flex: 1 },
  handleText: { fontSize: 11, fontWeight: '700' },
  descriptionText: { fontSize: 12, lineHeight: 17, fontWeight: '600' },
  featuredFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  categoryTag: {
    overflow: 'hidden',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 9,
    fontWeight: '900',
  },
  postCount: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  postCountText: { fontSize: 11, fontWeight: '700' },

  // List rows
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    elevation: 1,
  },
  listRowContent: { flex: 1, minWidth: 0 },
  listRowTitleLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  listRowTitle: { flex: 1, fontSize: 14, fontWeight: '900' },
  listRowChevron: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Empty / loading
  emptyState: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: { fontSize: 15, fontWeight: '900', marginTop: 6 },
  emptyText: { fontSize: 12, textAlign: 'center', lineHeight: 18, fontWeight: '600' },
  loadingRow: { paddingVertical: 32, alignItems: 'center' },

  // Load more
  loadMoreBtn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 12,
  },
});
