// src/screens/bots/WorkflowDetailScreen.tsx
// A single workflow's management screen (Phase 2) — status controls
// (publish/pause/resume/delete), a test-before-publish action, and an
// execution history list with per-run error detail. Every control here
// calls a real backend endpoint; publish/pause/resume re-verify the
// underlying resource grant server-side, exactly like any other bot
// action.
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { deleteRequest } from '@/network/delete';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { KISIcon } from '@/constants/kisIcons';
import KISButton from '@/constants/KISButton';

type Workflow = {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'active' | 'paused' | 'deleted';
  version: number;
  trigger_type: string;
  last_run_at: string | null;
  published_at: string | null;
};

type Run = {
  id: string;
  status: string;
  trigger_event: string;
  condition_result: boolean | null;
  steps_log: any[];
  error_message: string;
  started_at: string;
};

const STATUS_LABEL: Record<string, string> = {
  running: 'Running', succeeded: 'Succeeded', failed: 'Failed',
  denied: 'Denied', pending_approval: 'Needs approval', skipped: 'Skipped',
};

const STATUS_COLOR: Record<string, 'success' | 'danger' | 'gold' | 'subtext'> = {
  succeeded: 'success', failed: 'danger', denied: 'danger',
  pending_approval: 'gold', skipped: 'subtext', running: 'subtext',
};

export default function WorkflowDetailScreen() {
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const botId: string = route.params?.botId;
  const workflowId: string = route.params?.workflowId;

  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    const [wfRes, runsRes] = await Promise.all([
      getRequest(ROUTES.bots.workflowDetail(botId, workflowId), { forceNetwork: isRefresh }),
      getRequest(ROUTES.bots.workflowRuns(botId, workflowId), { forceNetwork: isRefresh }),
    ]);
    if (wfRes?.success) setWorkflow(wfRes.data);
    if (runsRes?.success) setRuns(Array.isArray(runsRes.data) ? runsRes.data : []);
    setLoading(false);
  }, [botId, workflowId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const handleTest = async () => {
    setBusy(true);
    const res = await postRequest(ROUTES.bots.workflowTest(botId, workflowId), { sample_payload: {} });
    setBusy(false);
    if (res?.success) {
      const actions = res.data.would_run_actions ?? [];
      const summary = actions.length
        ? actions.map((a: any) => `• ${a.type}${a.params?.text ? `: "${a.params.text}"` : ''}`).join('\n')
        : 'No actions would run for this sample.';
      Alert.alert(
        res.data.condition_result ? 'Conditions matched' : 'Conditions did not match',
        summary,
      );
    } else {
      Alert.alert('Could not test workflow', res?.message || 'Please try again.');
    }
  };

  const handlePublish = async () => {
    setBusy(true);
    const res = await postRequest(ROUTES.bots.workflowPublish(botId, workflowId), {});
    setBusy(false);
    if (res?.success) setWorkflow(res.data);
    else Alert.alert('Could not publish', res?.message || 'Please try again.');
  };

  const handlePause = async () => {
    setBusy(true);
    const res = await postRequest(ROUTES.bots.workflowPause(botId, workflowId), {});
    setBusy(false);
    if (res?.success) setWorkflow(res.data);
    else Alert.alert('Could not pause', res?.message || 'Please try again.');
  };

  const handleResume = async () => {
    setBusy(true);
    const res = await postRequest(ROUTES.bots.workflowResume(botId, workflowId), {});
    setBusy(false);
    if (res?.success) setWorkflow(res.data);
    else Alert.alert('Could not resume', res?.message || 'Please try again.');
  };

  const handleDelete = () => {
    Alert.alert('Delete this workflow?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          const res = await deleteRequest(ROUTES.bots.workflowDetail(botId, workflowId));
          if (res?.success || res === undefined) navigation.goBack();
          else Alert.alert('Could not delete workflow', res?.message || 'Please try again.');
        },
      },
    ]);
  };

  if (loading && !workflow) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={palette.primaryStrong} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }}>
      <View
        style={{
          flexDirection: 'row', alignItems: 'center', paddingHorizontal: responsive.pageGutter,
          paddingTop: 10, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: palette.divider,
        }}
      >
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={{ padding: 4 }}>
          <KISIcon name="arrow-left" size={20} color={palette.text} />
        </Pressable>
        <Text style={{ flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '900', color: palette.text }} numberOfLines={1}>
          {workflow?.name ?? route.params?.name ?? 'Workflow'}
        </Text>
        {workflow && workflow.status !== 'active' ? (
          <Pressable onPress={() => navigation.navigate('WorkflowBuilder', { botId, workflowId })} hitSlop={8} style={{ padding: 4 }}>
            <KISIcon name="edit" size={18} color={palette.text} />
          </Pressable>
        ) : (
          <View style={{ width: 28 }} />
        )}
      </View>

      <ScrollView contentContainerStyle={{ padding: responsive.pageGutter, gap: responsive.cardGap }}>
        {workflow ? (
          <View style={{ borderWidth: 1, borderColor: palette.divider, borderRadius: 18, backgroundColor: palette.card, padding: 14, gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: `${palette.primaryStrong}1A` }}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: palette.primaryStrong }}>{workflow.status}</Text>
              </View>
              <Text style={{ fontSize: 12, color: palette.subtext }}>v{workflow.version}</Text>
            </View>
            {workflow.description ? <Text style={{ fontSize: 13, color: palette.subtext }}>{workflow.description}</Text> : null}

            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <KISButton title="Test" size="sm" variant="outline" onPress={handleTest} disabled={busy} />
              {workflow.status === 'draft' || workflow.status === 'paused' ? (
                <KISButton title="Publish" size="sm" onPress={handlePublish} disabled={busy} />
              ) : null}
              {workflow.status === 'active' ? (
                <KISButton title="Pause" size="sm" variant="outline" onPress={handlePause} disabled={busy} />
              ) : null}
              {workflow.status === 'paused' ? (
                <KISButton title="Resume" size="sm" onPress={handleResume} disabled={busy} />
              ) : null}
              <KISButton title="Delete" size="sm" variant="danger" onPress={handleDelete} disabled={busy} />
            </View>
          </View>
        ) : null}

        <View style={{ gap: 10 }}>
          <Text style={{ fontSize: 14, fontWeight: '900', color: palette.text }}>Execution history</Text>
          {runs.length === 0 ? (
            <Text style={{ fontSize: 12, color: palette.subtext }}>No runs yet.</Text>
          ) : (
            runs.map((run) => {
              const expanded = expandedRun === run.id;
              const color = (palette as any)[STATUS_COLOR[run.status] ?? 'subtext'] ?? palette.subtext;
              return (
                <Pressable
                  key={run.id}
                  onPress={() => setExpandedRun(expanded ? null : run.id)}
                  style={{ borderWidth: 1, borderColor: palette.divider, borderRadius: 14, padding: 12, gap: 6 }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: palette.text }}>
                      {new Date(run.started_at).toLocaleString()}
                    </Text>
                    <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: `${color}1A` }}>
                      <Text style={{ fontSize: 11, fontWeight: '800', color }}>{STATUS_LABEL[run.status] ?? run.status}</Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 12, color: palette.subtext }}>
                    {run.condition_result === null ? 'Conditions not evaluated' : run.condition_result ? 'Conditions matched' : 'Conditions did not match'}
                  </Text>
                  {expanded ? (
                    <View style={{ gap: 4, marginTop: 4 }}>
                      {run.error_message ? (
                        <Text style={{ fontSize: 12, color: palette.danger }}>{run.error_message}</Text>
                      ) : null}
                      {(run.steps_log ?? []).map((step: any, i: number) => (
                        <Text key={i} style={{ fontSize: 11, color: palette.subtext }}>
                          {step.action}: {step.status}{step.error ? ` — ${step.error}` : ''}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                </Pressable>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
