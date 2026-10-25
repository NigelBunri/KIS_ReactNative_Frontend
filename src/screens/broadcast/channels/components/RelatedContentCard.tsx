// src/screens/broadcast/channels/components/RelatedContentCard.tsx
//
// A single card in the YouTube-style related-content feed shown below the
// live-watch player (see RelatedContentFeed.tsx). Deliberately a standalone
// component rather than reusing ChannelHomePage.tsx's private ContentTile -
// that one isn't exported, and this card's layout (fixed-width horizontal
// rail item vs. a grid tile) is different enough to not be a clean fit.

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { KISIcon } from '@/constants/kisIcons';
import { resolveBackendAssetUrl } from '@/network';
import PermanentRemoteImage from '@/components/media/PermanentRemoteImage';
import type { BroadcastChannelContent } from '../api/channels.types';

const CARD_WIDTH = 220;

const compactNumber = (value?: number) => {
  const num = Number(value || 0);
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return String(num);
};

const formatDuration = (seconds?: number) => {
  if (!seconds || seconds <= 0) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
};

const timeAgo = (iso?: string) => {
  if (!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) return '';
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
};

const assetUrlFor = (content: BroadcastChannelContent) =>
  resolveBackendAssetUrl(
    content.thumbnail_url ||
      content.first_asset?.thumbnail_url ||
      content.first_asset?.url ||
      content.assets?.[0]?.thumbnail_url ||
      content.assets?.[0]?.url ||
      '',
  );

export default function RelatedContentCard({
  content,
  palette,
  onPress,
}: {
  content: BroadcastChannelContent;
  palette: any;
  onPress: () => void;
}) {
  const imageUrl = assetUrlFor(content);
  const isLive = content.content_type === 'live_stream' && content.live_stream_status === 'live';
  const isUpcoming = content.content_type === 'live_stream' && content.live_stream_status === 'scheduled';
  const duration = formatDuration(content.duration_seconds);
  const views = content.engagement_counts?.views ?? content.stats?.views;

  return (
    <Pressable
      onPress={onPress}
      style={[styles.card, { width: CARD_WIDTH }]}
      accessibilityRole="button"
      accessibilityLabel={content.title || 'Open content'}
    >
      <View style={styles.thumbWrap}>
        {imageUrl ? (
          <PermanentRemoteImage
            uri={imageUrl}
            domain="Broadcast"
            stableKey={`related_${content.id}_${imageUrl}`}
            containerStyle={StyleSheet.absoluteFillObject}
          />
        ) : (
          <LinearGradient
            colors={[palette.primarySoft ?? palette.surface, palette.surfaceElevated ?? palette.surface, palette.surface]}
            style={StyleSheet.absoluteFillObject}
          />
        )}
        {!imageUrl && (
          <View style={styles.thumbFallbackIcon} pointerEvents="none">
            <KISIcon name={content.content_type === 'live_stream' ? 'broadcast' : 'play'} size={22} color={palette.subtext} />
          </View>
        )}
        {isLive && (
          <View style={[styles.badge, styles.liveBadge, { backgroundColor: palette.danger }]}>
            <Text style={[styles.badgeText, { color: palette.onPrimary }]}>LIVE</Text>
          </View>
        )}
        {isUpcoming && (
          <View style={[styles.badge, { backgroundColor: 'rgba(0,0,0,0.72)' }]}>
            <Text style={[styles.badgeText, { color: '#fff' }]}>UPCOMING</Text>
          </View>
        )}
        {duration && !isLive && !isUpcoming && (
          <View style={[styles.badge, { backgroundColor: 'rgba(0,0,0,0.72)' }]}>
            <Text style={[styles.badgeText, { color: '#fff' }]}>{duration}</Text>
          </View>
        )}
      </View>
      <View style={styles.body}>
        <Text numberOfLines={2} style={[styles.title, { color: palette.text }]}>
          {content.title || content.text_plain_preview || 'Untitled'}
        </Text>
        <Text numberOfLines={1} style={[styles.channel, { color: palette.subtext }]}>
          {content.channel?.display_name || ''}
        </Text>
        <Text numberOfLines={1} style={[styles.meta, { color: palette.subtext }]}>
          {[
            views != null ? `${compactNumber(views)} views` : null,
            isLive ? 'Live now' : timeAgo(content.published_at),
          ].filter(Boolean).join(' · ')}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginRight: 12,
  },
  thumbWrap: {
    width: '100%',
    height: 124,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  thumbFallbackIcon: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  liveBadge: {
    left: 6,
    right: undefined,
    bottom: undefined,
    top: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  body: {
    marginTop: 8,
    gap: 2,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  channel: {
    fontSize: 12,
    fontWeight: '600',
  },
  meta: {
    fontSize: 11,
    fontWeight: '500',
  },
});
