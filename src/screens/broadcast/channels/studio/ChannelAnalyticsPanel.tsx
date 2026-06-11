import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { KISIcon } from '@/constants/kisIcons';
import { useKISTheme } from '@/theme/useTheme';
import type { BroadcastChannelContent, ChannelAnalyticsSummary } from '@/screens/broadcast/channels/api/channels.types';
import { fetchChannelAnalytics } from '@/screens/broadcast/channels/hooks/useChannelsData';
import ImpressionsAnalyticsPanel from '@/screens/broadcast/channels/studio/ImpressionsAnalyticsPanel';
import TrafficSourcesPanel from '@/screens/broadcast/channels/studio/TrafficSourcesPanel';

const compact = (value: number) => value >= 1000 ? `${(value / 1000).toFixed(1)}K` : String(value);
const timeLabel = (seconds: number) => seconds >= 3600 ? `${Math.round(seconds / 3600)}h` : `${Math.round(seconds / 60)}m`;

type Props = { channelId?: string; queued: number; live: number; subscribers?: number };

export default function ChannelAnalyticsPanel({ channelId, queued, live, subscribers = 0 }: Props) {
  const { palette } = useKISTheme();
  const [summary, setSummary] = useState<ChannelAnalyticsSummary | null>(null);
  const [topContent, setTopContent] = useState<BroadcastChannelContent[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!channelId) return undefined;
    setLoading(true);
    fetchChannelAnalytics(channelId)
      .then(result => {
        if (!alive) return;
        setSummary(result.summary);
        setTopContent(result.topContent);
      })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [channelId]);

  const cards = useMemo(() => [
    { label: 'Subscribers', value: compact(Number(summary?.subscribers ?? subscribers)), icon: 'people' },
    { label: 'Published', value: compact(Number(summary?.published_count ?? live)), icon: 'send' },
    { label: 'Views', value: compact(Number(summary?.views ?? 0)), icon: 'play' },
    { label: 'Watch time', value: timeLabel(Number(summary?.watch_time_seconds ?? 0)), icon: 'play' },
    { label: 'Comments', value: compact(Number(summary?.comments ?? 0)), icon: 'comment' },
    { label: 'Draft queue', value: compact(queued), icon: 'layers' },
  ], [live, queued, subscribers, summary]);

  return (
    <View style={styles.wrap}>
      {loading ? <ActivityIndicator color={palette.primaryStrong} style={styles.loader} /> : null}
      <View style={styles.grid}>
        {cards.map(card => (
          <View key={card.label} style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}> 
            <KISIcon name={card.icon} size={17} color={palette.primaryStrong} />
            <Text style={[styles.value, { color: palette.text }]}>{card.value}</Text>
            <Text style={[styles.label, { color: palette.subtext }]}>{card.label}</Text>
          </View>
        ))}
      </View>
      <View style={[styles.table, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <Text style={[styles.heading, { color: palette.text }]}>Top content</Text>
        {topContent.length ? topContent.slice(0, 5).map(item => (
          <View key={item.id} style={[styles.row, { borderColor: palette.border }]}>
            <Text numberOfLines={1} style={[styles.rowTitle, { color: palette.text }]}>{item.title || item.text_plain_preview || 'Untitled content'}</Text>
            <Text style={[styles.rowMeta, { color: palette.subtext }]}>{compact(Number(item.engagement_counts?.views ?? item.stats?.views ?? 0))} views</Text>
          </View>
        )) : <Text style={[styles.empty, { color: palette.subtext }]}>Analytics will appear after viewers interact with channel content.</Text>}
      </View>

      {channelId ? (
        <>
          <Text style={[styles.sectionHeader, { color: palette.text, borderColor: palette.border }]}>
            Impressions &amp; CTR
          </Text>
          <ImpressionsAnalyticsPanel channelId={channelId} />

          <Text style={[styles.sectionHeader, { color: palette.text, borderColor: palette.border }]}>
            Traffic Sources
          </Text>
          <TrafficSourcesPanel channelId={channelId} />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  loader: { alignSelf: 'flex-start', marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  card: { width: '47.5%', borderWidth: 1, borderRadius: 8, padding: 12 },
  value: { marginTop: 8, fontSize: 20, fontWeight: '900' },
  label: { marginTop: 2, fontSize: 11, fontWeight: '800' },
  table: { borderWidth: 1, borderRadius: 8, padding: 12 },
  heading: { fontSize: 14, fontWeight: '900', marginBottom: 8 },
  row: { borderTopWidth: 1, paddingVertical: 9 },
  rowTitle: { fontSize: 12, fontWeight: '900' },
  rowMeta: { marginTop: 2, fontSize: 11, fontWeight: '700' },
  empty: { fontSize: 12, lineHeight: 18, fontWeight: '700' },
  sectionHeader: {
    fontSize: 15,
    fontWeight: '900',
    marginTop: 18,
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
});
