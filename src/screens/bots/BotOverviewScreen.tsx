// src/screens/bots/BotOverviewScreen.tsx
// Phase 5 — owner dashboard landing page. One aggregation call
// (GET /api/v1/bots/overview/) across every bot this user owns:
// status counts, recent executions, pending approvals, recent
// security events, webhook delivery health, AI usage, knowledge and
// memory status. Every number here comes straight from that response
// — nothing is computed or guessed on-device.
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { KISIcon } from '@/constants/kisIcons';
import KISButton from '@/constants/KISButton';

type Overview = {
  bots: { total: number; active: number; paused: number; suspended: number; disconnected: number; draft: number };
  executions: {
    succeeded_7d: number;
    failed_7d: number;
    recent: { id: string; bot_id: string; bot_name: string; workflow_name: string; trigger_event: string; status: string; started_at: string }[];
  };
  pending_approvals: { id: string; bot_id: string; bot_name: string; action: string; created_at: string }[];
  recent_security_events: { id: string; bot_id: string; bot_name: string; action: string; created_at: string }[];
  webhooks: { bots_with_webhook: number; pending: number; failed: number; dead_letter: number };
  ai_usage: { bots_with_ai_connected: number; calls_7d: number; errors_7d: number };
  knowledge: { total_sources: number; ready: number; processing: number; error: number };
  memory: { bots_with_memory_enabled: number; total_entries: number };
};

function StatRow({ label, value, danger, palette }: { label: string; value: number | string; danger?: boolean; palette: any }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
      <Text style={{ fontSize: 13, color: palette.subtext }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: '800', color: danger ? palette.danger : palette.text }}>{value}</Text>
    </View>
  );
}

function SectionCard({ title, children, palette }: { title: string; children: React.ReactNode; palette: any }) {
  return (
    <View
      style={{
        borderWidth: 1, borderColor: palette.divider, backgroundColor: palette.card,
        borderRadius: 18, padding: 14, gap: 4,
      }}
    >
      <Text style={{ fontSize: 14, fontWeight: '900', color: palette.text, marginBottom: 4 }}>{title}</Text>
      {children}
    </View>
  );
}

export default function BotOverviewScreen() {
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const navigation = useNavigation<any>();

  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    const res = await getRequest(ROUTES.bots.overview, { forceNetwork: isRefresh });
    if (res?.success) setData(res.data);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }}>
      <View
        style={{
          flexDirection: 'row', alignItems: 'center',
          paddingHorizontal: responsive.pageGutter, paddingTop: 10, paddingBottom: 14,
          borderBottomWidth: 1, borderBottomColor: palette.divider,
        }}
      >
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={{ padding: 4 }}>
          <KISIcon name="arrow-left" size={20} color={palette.text} />
        </Pressable>
        <Text style={{ flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '900', color: palette.text }}>
          Dashboard
        </Text>
        <Pressable onPress={() => navigation.navigate('BotAnalytics')} hitSlop={10} style={{ padding: 4 }}>
          <KISIcon name="bar-chart" size={20} color={palette.text} />
        </Pressable>
      </View>

      {loading && !data ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={palette.primaryStrong} />
        </View>
      ) : !data ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: responsive.pageGutter }}>
          <Text style={{ color: palette.subtext, textAlign: 'center' }}>Could not load the dashboard. Pull down to try again.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: responsive.pageGutter, gap: responsive.cardGap }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        >
          <SectionCard title="Bots" palette={palette}>
            <StatRow label="Total" value={data.bots.total} palette={palette} />
            <StatRow label="Active" value={data.bots.active} palette={palette} />
            <StatRow label="Paused" value={data.bots.paused} palette={palette} />
            <StatRow label="Suspended" value={data.bots.suspended} danger={data.bots.suspended > 0} palette={palette} />
            <StatRow label="Disconnected" value={data.bots.disconnected} palette={palette} />
            <StatRow label="Draft" value={data.bots.draft} palette={palette} />
          </SectionCard>

          <SectionCard title="Executions (last 7 days)" palette={palette}>
            <StatRow label="Succeeded" value={data.executions.succeeded_7d} palette={palette} />
            <StatRow label="Failed" value={data.executions.failed_7d} danger={data.executions.failed_7d > 0} palette={palette} />
            {data.executions.recent.length === 0 ? (
              <Text style={{ fontSize: 12, color: palette.subtext, marginTop: 6 }}>No executions yet.</Text>
            ) : (
              <View style={{ marginTop: 6, gap: 6 }}>
                {data.executions.recent.slice(0, 6).map((r) => (
                  <Pressable
                    key={r.id}
                    onPress={() => navigation.navigate('BotDetail', { botId: r.bot_id, name: r.bot_name })}
                    style={{ borderTopWidth: 1, borderTopColor: palette.divider, paddingTop: 6 }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: palette.text }}>
                      {r.bot_name} · {r.workflow_name}
                    </Text>
                    <Text style={{ fontSize: 11, color: r.status === 'failed' ? palette.danger : palette.subtext }}>
                      {r.trigger_event} · {r.status} · {new Date(r.started_at).toLocaleString()}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </SectionCard>

          {data.pending_approvals.length > 0 ? (
            <SectionCard title="Pending approvals" palette={palette}>
              {data.pending_approvals.map((a) => (
                <Pressable
                  key={a.id}
                  onPress={() => navigation.navigate('BotDetail', { botId: a.bot_id, name: a.bot_name })}
                  style={{ borderTopWidth: 1, borderTopColor: palette.divider, paddingTop: 6, marginTop: 6 }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: palette.text }}>
                    {a.bot_name}: {a.action.replace(/_/g, ' ')}
                  </Text>
                  <Text style={{ fontSize: 11, color: palette.subtext }}>{new Date(a.created_at).toLocaleString()}</Text>
                </Pressable>
              ))}
            </SectionCard>
          ) : null}

          {data.recent_security_events.length > 0 ? (
            <SectionCard title="Recent security events" palette={palette}>
              {data.recent_security_events.slice(0, 8).map((e) => (
                <Pressable
                  key={e.id}
                  onPress={() => navigation.navigate('BotDetail', { botId: e.bot_id, name: e.bot_name })}
                  style={{ borderTopWidth: 1, borderTopColor: palette.divider, paddingTop: 6, marginTop: 6 }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: palette.danger }}>
                    {e.bot_name}: {e.action.replace(/_/g, ' ')}
                  </Text>
                  <Text style={{ fontSize: 11, color: palette.subtext }}>{new Date(e.created_at).toLocaleString()}</Text>
                </Pressable>
              ))}
            </SectionCard>
          ) : null}

          <SectionCard title="Webhooks" palette={palette}>
            <StatRow label="Bots with an active webhook" value={data.webhooks.bots_with_webhook} palette={palette} />
            <StatRow label="Pending deliveries" value={data.webhooks.pending} palette={palette} />
            <StatRow label="Failed deliveries" value={data.webhooks.failed} danger={data.webhooks.failed > 0} palette={palette} />
            <StatRow label="Dead-lettered" value={data.webhooks.dead_letter} danger={data.webhooks.dead_letter > 0} palette={palette} />
          </SectionCard>

          <SectionCard title="AI usage (last 7 days)" palette={palette}>
            <StatRow label="Bots with AI connected" value={data.ai_usage.bots_with_ai_connected} palette={palette} />
            <StatRow label="Calls" value={data.ai_usage.calls_7d} palette={palette} />
            <StatRow label="Errors" value={data.ai_usage.errors_7d} danger={data.ai_usage.errors_7d > 0} palette={palette} />
            <Text style={{ fontSize: 11, color: palette.subtext, marginTop: 6 }}>
              Any AI usage is paid by you through your own connected provider, never by KIS.
            </Text>
          </SectionCard>

          <SectionCard title="Knowledge sources" palette={palette}>
            <StatRow label="Total" value={data.knowledge.total_sources} palette={palette} />
            <StatRow label="Ready" value={data.knowledge.ready} palette={palette} />
            <StatRow label="Processing" value={data.knowledge.processing} palette={palette} />
            <StatRow label="Failed" value={data.knowledge.error} danger={data.knowledge.error > 0} palette={palette} />
          </SectionCard>

          <SectionCard title="Memory" palette={palette}>
            <StatRow label="Bots with memory enabled" value={data.memory.bots_with_memory_enabled} palette={palette} />
            <StatRow label="Total stored entries" value={data.memory.total_entries} palette={palette} />
          </SectionCard>

          <KISButton title="View detailed analytics" variant="outline" onPress={() => navigation.navigate('BotAnalytics')} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
