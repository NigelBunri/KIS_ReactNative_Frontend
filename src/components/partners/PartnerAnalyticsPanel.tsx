// src/components/partners/PartnerAnalyticsPanel.tsx
//
// Analytics & Insights — one partner's own real data, not the KCAN-staff
// platform-wide dashboard (that's AdminAnalyticsPanel.tsx). Backed by the
// /api/v1/partners/<id>/analytics/ action, which already existed with a
// basic members/posts/engagement/revenue summary and no frontend anywhere
// — extended (see apps/partners/views.py) with top contributors, content
// performance, growth funnel, participation depth, channel health (task
// throughput per channel), and a weekday activity heatmap, all computed
// from data that already exists. A few of the settings catalog's 15
// analytics entries (message velocity, campaign tracking, response times,
// event uptake, resource downloads, retention) have no real data source
// anywhere yet — the "unavailable_metrics" the endpoint returns are shown
// honestly rather than faked.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, ScrollView, Text, View } from 'react-native';
import styles from '@/components/partners/partnersStyles';
import { useKISTheme } from '@/theme/useTheme';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';

type Props = {
  isOpen: boolean;
  panelWidth: number;
  panelTranslateX: Animated.Value;
  partnerId?: string | null;
  onClose: () => void;
};

type Contributor = { user_id: string; display_name: string; posts: number; comments: number; total: number };
type TopPost = { id: string; text_preview: string; reactions: number; comments: number; created_at: string };
type ReactionRow = { emoji: string; n: number };
type ChannelHealthRow = { channel_id: string; channel_name: string; tasks_created: number; tasks_completed: number };
type HeatmapRow = { weekday: string; total: number };
type Analytics = {
  window_days: number;
  members: { total: number; active: number };
  posts: { total: number; period_new: number };
  engagement: { period_reactions: number; period_comments: number };
  top_contributors: Contributor[];
  content_performance: TopPost[];
  reaction_breakdown: ReactionRow[];
  growth_funnel: { applied: number; approved: number; rejected: number; active_members: number };
  participation_depth: number;
  channel_health: ChannelHealthRow[];
  community_heatmap: HeatmapRow[];
  unavailable_metrics: string[];
};

const METRIC_TITLES: Record<string, string> = {
  message_velocity: 'Message Velocity',
  campaign_tracking: 'Campaign Tracking',
  response_times: 'Response Times',
  event_uptake: 'Event Uptake',
  resource_downloads: 'Resource Downloads',
  retention: 'Member Retention',
};

function Tile({ label, value, palette }: { label: string; value: string | number; palette: any }) {
  return (
    <View style={[styles.overviewCard, { borderColor: palette.borderMuted, backgroundColor: palette.surface }]}>
      <Text style={[styles.overviewValue, { color: palette.text }]}>{value}</Text>
      <Text style={[styles.overviewLabel, { color: palette.subtext }]}>{label}</Text>
    </View>
  );
}
function SectionTitle({ children, palette }: { children: React.ReactNode; palette: any }) {
  return <Text style={[styles.settingsSectionTitle, { color: palette.text, marginBottom: 8, marginTop: 4 }]}>{children}</Text>;
}
function Bar({ label, value, max, palette }: { label: string; value: number; max: number; palette: any }) {
  const pct = max > 0 ? Math.max(0.04, value / max) : 0;
  return (
    <View style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text style={{ color: palette.text, fontSize: 12 }} numberOfLines={1}>{label}</Text>
        <Text style={{ color: palette.subtext, fontSize: 12 }}>{value}</Text>
      </View>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: palette.borderMuted, overflow: 'hidden' }}>
        <View style={{ height: 6, borderRadius: 3, width: `${pct * 100}%`, backgroundColor: palette.primary }} />
      </View>
    </View>
  );
}

export default function PartnerAnalyticsPanel({ isOpen, panelWidth, panelTranslateX, partnerId, onClose }: Props) {
  const { palette } = useKISTheme();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Analytics | null>(null);
  const [windowDays, setWindowDays] = useState(30);

  const backdropOpacity = panelTranslateX.interpolate({ inputRange: [0, panelWidth], outputRange: [1, 0], extrapolate: 'clamp' });

  const load = useCallback(async () => {
    if (!partnerId) return;
    const res = await getRequest(ROUTES.partners.analytics(partnerId, windowDays), { errorMessage: 'Unable to load analytics.' });
    // getRequest resolves (never throws) on failure too, with `data`
    // undefined — the old `?? res` fallback set `data` to the wrapper
    // object, and unguarded reads like `data.members.total` below (not
    // optional-chained) crashed the panel on any network failure.
    const payload = (res?.success ? res?.data : null) as Analytics | null;
    setData(payload);
  }, [partnerId, windowDays]);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [isOpen, load]);

  if (!isOpen) return null;

  const maxContributor = Math.max(1, ...(data?.top_contributors || []).map((c) => c.total));
  const maxChannelHealth = Math.max(1, ...(data?.channel_health || []).map((c) => c.tasks_created));
  const maxHeatmap = Math.max(1, ...(data?.community_heatmap || []).map((h) => h.total));
  const maxReaction = Math.max(1, ...(data?.reaction_breakdown || []).map((r) => r.n));

  return (
    <View style={styles.settingsPanelOverlay} pointerEvents="box-none">
      <Animated.View style={[styles.settingsPanelBackdrop, { backgroundColor: palette.backdrop, opacity: backdropOpacity }]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          styles.settingsPanelContainer,
          { width: panelWidth, backgroundColor: palette.surfaceElevated, borderLeftColor: palette.divider, transform: [{ translateX: panelTranslateX }] },
        ]}
      >
        <View style={[styles.settingsPanelHeader, { borderBottomColor: palette.divider }]}>
          <Pressable onPress={onClose} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            <Text style={{ color: palette.text, fontSize: 18 }}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingsPanelTitle, { color: palette.text }]}>Analytics & Insights</Text>
            <Text style={[styles.settingsPanelDescription, { color: palette.subtext }]}>Your organization's own activity</Text>
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.settingsPanelBody} showsVerticalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 14 }}>
            {[7, 30, 90].map((d) => (
              <Pressable
                key={d}
                onPress={() => setWindowDays(d)}
                style={{ paddingVertical: 5, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: windowDays === d ? palette.primary : palette.borderMuted }}
              >
                <Text style={{ color: windowDays === d ? palette.primary : palette.text, fontSize: 12 }}>{d} days</Text>
              </Pressable>
            ))}
          </View>

          {loading || !data ? (
            <ActivityIndicator size="small" color={palette.primary} />
          ) : (
            <>
              <SectionTitle palette={palette}>Engagement Overview</SectionTitle>
              <View style={styles.overviewGrid}>
                <Tile label="Members" value={data.members.total} palette={palette} />
                <Tile label="Active members" value={data.members.active} palette={palette} />
                <Tile label="Posts" value={data.posts.total} palette={palette} />
                <Tile label={`New posts (${windowDays}d)`} value={data.posts.period_new} palette={palette} />
                <Tile label={`Reactions (${windowDays}d)`} value={data.engagement.period_reactions} palette={palette} />
                <Tile label={`Comments (${windowDays}d)`} value={data.engagement.period_comments} palette={palette} />
                <Tile label="Avg. engagement / post" value={data.participation_depth} palette={palette} />
              </View>

              <SectionTitle palette={palette}>Growth Funnel</SectionTitle>
              <View style={[styles.settingsFeatureRow, { borderColor: palette.borderMuted, backgroundColor: palette.surface, marginBottom: 16 }]}>
                <Bar label="Applied" value={data.growth_funnel.applied} max={Math.max(1, data.growth_funnel.applied)} palette={palette} />
                <Bar label="Approved" value={data.growth_funnel.approved} max={Math.max(1, data.growth_funnel.applied)} palette={palette} />
                <Bar label="Rejected" value={data.growth_funnel.rejected} max={Math.max(1, data.growth_funnel.applied)} palette={palette} />
                <Bar label="Active members (all-time)" value={data.growth_funnel.active_members} max={Math.max(1, data.growth_funnel.active_members)} palette={palette} />
              </View>

              <SectionTitle palette={palette}>Top Contributors</SectionTitle>
              <View style={{ marginBottom: 16 }}>
                {data.top_contributors.length === 0 ? (
                  <Text style={{ color: palette.subtext, fontSize: 12 }}>No activity yet in this window.</Text>
                ) : (
                  data.top_contributors.map((c) => (
                    <Bar key={c.user_id} label={`${c.display_name} (${c.posts}p · ${c.comments}c)`} value={c.total} max={maxContributor} palette={palette} />
                  ))
                )}
              </View>

              <SectionTitle palette={palette}>Content Performance</SectionTitle>
              <View style={{ marginBottom: 16 }}>
                {data.content_performance.length === 0 ? (
                  <Text style={{ color: palette.subtext, fontSize: 12 }}>No posts in this window yet.</Text>
                ) : (
                  data.content_performance.map((p) => (
                    <View key={p.id} style={[styles.settingsFeatureRow, { borderColor: palette.borderMuted, backgroundColor: palette.surface, marginBottom: 6 }]}>
                      <Text style={{ color: palette.text, fontSize: 12 }} numberOfLines={2}>{p.text_preview || '(no preview)'}</Text>
                      <Text style={{ color: palette.subtext, fontSize: 11, marginTop: 4 }}>👍 {p.reactions} · 💬 {p.comments}</Text>
                    </View>
                  ))
                )}
              </View>

              <SectionTitle palette={palette}>Reaction Trends</SectionTitle>
              <View style={{ marginBottom: 16 }}>
                {data.reaction_breakdown.length === 0 ? (
                  <Text style={{ color: palette.subtext, fontSize: 12 }}>No reactions in this window yet.</Text>
                ) : (
                  data.reaction_breakdown.map((r) => (
                    <Bar key={r.emoji} label={r.emoji} value={r.n} max={maxReaction} palette={palette} />
                  ))
                )}
              </View>

              <SectionTitle palette={palette}>Channel Health</SectionTitle>
              <View style={{ marginBottom: 16 }}>
                {data.channel_health.length === 0 ? (
                  <Text style={{ color: palette.subtext, fontSize: 12 }}>No task activity in any channel yet.</Text>
                ) : (
                  data.channel_health.map((c) => (
                    <Bar key={c.channel_id} label={`#${c.channel_name} (${c.tasks_completed} done)`} value={c.tasks_created} max={maxChannelHealth} palette={palette} />
                  ))
                )}
              </View>

              <SectionTitle palette={palette}>Community Heatmap</SectionTitle>
              <View style={{ flexDirection: 'row', gap: 4, marginBottom: 20, alignItems: 'flex-end', height: 70 }}>
                {data.community_heatmap.map((h) => (
                  <View key={h.weekday} style={{ flex: 1, alignItems: 'center' }}>
                    <View style={{ width: '100%', height: 50, justifyContent: 'flex-end' }}>
                      <View style={{ height: Math.max(4, (h.total / maxHeatmap) * 50), backgroundColor: palette.primary, borderRadius: 3 }} />
                    </View>
                    <Text style={{ color: palette.subtext, fontSize: 10, marginTop: 4 }}>{h.weekday}</Text>
                  </View>
                ))}
              </View>

              {data.unavailable_metrics.length > 0 ? (
                <View style={[styles.settingsFeatureRow, { borderColor: palette.borderMuted, backgroundColor: palette.surface, marginBottom: 12 }]}>
                  <Text style={{ color: palette.subtext, fontSize: 11, fontWeight: '700', marginBottom: 4 }}>Not tracked yet</Text>
                  <Text style={{ color: palette.subtext, fontSize: 11, lineHeight: 16 }}>
                    {data.unavailable_metrics.map((k) => METRIC_TITLES[k] || k).join(' · ')} — no real data source exists for these yet.
                  </Text>
                </View>
              ) : null}
            </>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}
