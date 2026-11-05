// src/screens/bots/BotAnalyticsScreen.tsx
// Phase 5 — owner-facing analytics (GET /api/v1/bots/analytics/),
// filterable by bot and a date-range preset. CSV export and the
// richer per-workflow/per-event breakdowns are left to the web
// Bot Platform dashboard — this screen covers the practical,
// at-a-glance numbers an owner wants while on the go, per the same
// filters the web export uses, so nothing shown here can disagree
// with what the web dashboard reports for the same filter choice.
import React, { useCallback, useEffect, useState } from 'react';
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

type BotSummary = { id: string; name: string };

type Analytics = {
  events_received: number;
  executions: { total: number; succeeded: number; failed: number; denied: number; skipped: number; avg_duration_seconds: number | null };
  action_counts: Record<string, number>;
  webhooks: { deliveries: number; delivered: number; failed: number; dead_letter: number; total_retry_attempts: number };
  approvals: { total: number; pending: number; approved: number; declined: number; expired: number };
  suspensions: number;
  rate_limit_events: number;
  ai: {
    total_requests: number; error_requests: number;
    by_provider_model: { provider: string; model: string; requests: number }[];
    total_prompt_tokens: number; total_completion_tokens: number; billing_note: string;
  };
  knowledge: { total_sources: number; by_status: Record<string, number> };
  memory: { bots_with_memory_enabled: number; total_entries: number };
};

const RANGE_OPTIONS: { key: string; label: string; days: number | null }[] = [
  { key: '7d', label: '7 days', days: 7 },
  { key: '30d', label: '30 days', days: 30 },
  { key: '90d', label: '90 days', days: 90 },
  { key: 'all', label: 'All time', days: null },
];

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

export default function BotAnalyticsScreen() {
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const navigation = useNavigation<any>();

  const [bots, setBots] = useState<BotSummary[]>([]);
  const [selectedBotId, setSelectedBotId] = useState<string | null>(null);
  const [range, setRange] = useState('30d');
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await getRequest(ROUTES.bots.list);
      if (res?.success) setBots((res.data ?? []).map((b: any) => ({ id: b.id, name: b.name })));
    })();
  }, []);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    const preset = RANGE_OPTIONS.find((r) => r.key === range);
    const params: Record<string, any> = {};
    if (selectedBotId) params.bot_id = selectedBotId;
    if (preset?.days) {
      const from = new Date();
      from.setDate(from.getDate() - preset.days);
      params.date_from = from.toISOString();
    }
    const res = await getRequest(ROUTES.bots.analytics, { params, forceNetwork: isRefresh });
    if (res?.success) setData(res.data);
    setLoading(false);
    setRefreshing(false);
  }, [selectedBotId, range]);

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
          Analytics
        </Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={{ paddingHorizontal: responsive.pageGutter, paddingTop: 12, gap: 8 }}>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          {RANGE_OPTIONS.map((option) => {
            const selected = range === option.key;
            return (
              <Pressable
                key={option.key}
                onPress={() => setRange(option.key)}
                style={{
                  paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
                  borderWidth: 1.5, borderColor: selected ? palette.primaryStrong : palette.divider,
                  backgroundColor: selected ? palette.primarySoft : 'transparent',
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: '700', color: selected ? palette.primaryStrong : palette.subtext }}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {bots.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <Pressable
                onPress={() => setSelectedBotId(null)}
                style={{
                  paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
                  borderWidth: 1.5, borderColor: !selectedBotId ? palette.primaryStrong : palette.divider,
                  backgroundColor: !selectedBotId ? palette.primarySoft : 'transparent',
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: '700', color: !selectedBotId ? palette.primaryStrong : palette.subtext }}>
                  All bots
                </Text>
              </Pressable>
              {bots.map((b) => {
                const selected = selectedBotId === b.id;
                return (
                  <Pressable
                    key={b.id}
                    onPress={() => setSelectedBotId(b.id)}
                    style={{
                      paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
                      borderWidth: 1.5, borderColor: selected ? palette.primaryStrong : palette.divider,
                      backgroundColor: selected ? palette.primarySoft : 'transparent',
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '700', color: selected ? palette.primaryStrong : palette.subtext }} numberOfLines={1}>
                      {b.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        ) : null}
      </View>

      {loading && !data ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={palette.primaryStrong} />
        </View>
      ) : !data ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: responsive.pageGutter }}>
          <Text style={{ color: palette.subtext, textAlign: 'center' }}>Could not load analytics. Pull down to try again.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: responsive.pageGutter, gap: responsive.cardGap }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        >
          <SectionCard title="Executions" palette={palette}>
            <StatRow label="Events received" value={data.events_received} palette={palette} />
            <StatRow label="Succeeded" value={data.executions.succeeded} palette={palette} />
            <StatRow label="Failed" value={data.executions.failed} danger={data.executions.failed > 0} palette={palette} />
            <StatRow label="Denied" value={data.executions.denied} palette={palette} />
            <StatRow label="Skipped" value={data.executions.skipped} palette={palette} />
            <StatRow
              label="Avg duration"
              value={data.executions.avg_duration_seconds != null ? `${data.executions.avg_duration_seconds.toFixed(1)}s` : '—'}
              palette={palette}
            />
          </SectionCard>

          {Object.keys(data.action_counts).length > 0 ? (
            <SectionCard title="Actions performed" palette={palette}>
              {Object.entries(data.action_counts).map(([action, count]) => (
                <StatRow key={action} label={action.replace(/_/g, ' ')} value={count} palette={palette} />
              ))}
            </SectionCard>
          ) : null}

          <SectionCard title="Webhook deliveries" palette={palette}>
            <StatRow label="Total" value={data.webhooks.deliveries} palette={palette} />
            <StatRow label="Delivered" value={data.webhooks.delivered} palette={palette} />
            <StatRow label="Failed" value={data.webhooks.failed} danger={data.webhooks.failed > 0} palette={palette} />
            <StatRow label="Dead-lettered" value={data.webhooks.dead_letter} danger={data.webhooks.dead_letter > 0} palette={palette} />
            <StatRow label="Retry attempts" value={data.webhooks.total_retry_attempts} palette={palette} />
          </SectionCard>

          <SectionCard title="Approvals" palette={palette}>
            <StatRow label="Total" value={data.approvals.total} palette={palette} />
            <StatRow label="Pending" value={data.approvals.pending} palette={palette} />
            <StatRow label="Approved" value={data.approvals.approved} palette={palette} />
            <StatRow label="Declined" value={data.approvals.declined} palette={palette} />
            <StatRow label="Expired" value={data.approvals.expired} palette={palette} />
          </SectionCard>

          <SectionCard title="Security" palette={palette}>
            <StatRow label="Suspensions" value={data.suspensions} danger={data.suspensions > 0} palette={palette} />
            <StatRow label="Rate-limit events" value={data.rate_limit_events} danger={data.rate_limit_events > 0} palette={palette} />
          </SectionCard>

          <SectionCard title="AI usage" palette={palette}>
            <StatRow label="Total requests" value={data.ai.total_requests} palette={palette} />
            <StatRow label="Errors" value={data.ai.error_requests} danger={data.ai.error_requests > 0} palette={palette} />
            <StatRow label="Prompt tokens" value={data.ai.total_prompt_tokens} palette={palette} />
            <StatRow label="Completion tokens" value={data.ai.total_completion_tokens} palette={palette} />
            {data.ai.by_provider_model.map((row, idx) => (
              <StatRow key={idx} label={`${row.provider} · ${row.model || 'default model'}`} value={row.requests} palette={palette} />
            ))}
            <Text style={{ fontSize: 11, color: palette.subtext, marginTop: 6 }}>{data.ai.billing_note}</Text>
          </SectionCard>

          <SectionCard title="Knowledge" palette={palette}>
            <StatRow label="Total sources" value={data.knowledge.total_sources} palette={palette} />
            {Object.entries(data.knowledge.by_status).map(([status, count]) => (
              <StatRow key={status} label={status} value={count} palette={palette} />
            ))}
          </SectionCard>

          <SectionCard title="Memory" palette={palette}>
            <StatRow label="Bots with memory enabled" value={data.memory.bots_with_memory_enabled} palette={palette} />
            <StatRow label="Total stored entries" value={data.memory.total_entries} palette={palette} />
          </SectionCard>

          <Text style={{ fontSize: 11, color: palette.subtext, textAlign: 'center' }}>
            Need a CSV export or per-event breakdown? Open the Bot Platform dashboard on the web.
          </Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
