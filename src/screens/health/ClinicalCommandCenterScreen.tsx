import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { KISIcon } from '@/constants/kisIcons';
import { RootStackParamList } from '@/navigation/types';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { patchRequest } from '@/network/patch';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import {
  getHealthThemeBorders,
  getHealthThemeColors,
  HEALTH_THEME_SPACING,
  HEALTH_THEME_TYPOGRAPHY,
} from '@/theme/health';
import { useKISTheme } from '@/theme/useTheme';
import type { KISPalette } from '@/theme/constants';

type Props = NativeStackScreenProps<RootStackParamList, 'ClinicalCommandCenter'>;

type TabId = 'overview' | 'tasks' | 'escalations' | 'triage' | 'referrals' | 'workflow';

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'escalations', label: 'Escalations' },
  { id: 'triage', label: 'Triage' },
  { id: 'referrals', label: 'Referrals' },
  { id: 'workflow', label: 'Workflow' },
];

// ─── colour helpers ────────────────────────────────────────────────────────

const makePriorityColors = (p: KISPalette): Record<string, string> => ({
  high: p.danger,
  medium: p.gold,
  low: p.success,
});

const makeSeverityColors = (p: KISPalette): Record<string, string> => ({
  critical: p.danger,
  urgent: p.gold,
  routine: p.primary,
});

const makeTriageColors = (p: KISPalette): Record<number, string> => ({
  1: p.danger,
  2: p.gold,
  3: p.gold,
  4: p.success,
  5: p.primary,
});

const makeReferralStatusColors = (p: KISPalette): Record<string, string> => ({
  pending: p.gold,
  accepted: p.success,
  completed: p.primary,
  declined: p.danger,
});

// Workflow phase pipeline — ordered list of phases with display metadata.
type WorkflowPhase =
  | 'admission'
  | 'assessment'
  | 'treatment'
  | 'pharmacy'
  | 'billing'
  | 'discharged';

const makeWorkflowPhases = (p: KISPalette): Array<{ key: WorkflowPhase; label: string; color: string }> => [
  { key: 'admission',   label: 'Admission',   color: p.primary },
  { key: 'assessment',  label: 'Assessment',  color: p.gold },
  { key: 'treatment',   label: 'Treatment',   color: p.success },
  { key: 'pharmacy',    label: 'Pharmacy',    color: p.primary },
  { key: 'billing',     label: 'Billing',     color: p.gold },
  { key: 'discharged',  label: 'Discharged',  color: p.subtext },
];

const NEXT_PHASE: Record<WorkflowPhase, WorkflowPhase | null> = {
  admission:  'assessment',
  assessment: 'treatment',
  treatment:  'pharmacy',
  pharmacy:   'billing',
  billing:    'discharged',
  discharged: null,
};

// ─── small shared components ──────────────────────────────────────────────

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <View style={[badgeStyles.container, { backgroundColor: color + '22', borderColor: color + '66' }]}>
      <Text style={[badgeStyles.text, { color }]}>{label}</Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  container: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 99,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
});

function StatCard({
  label,
  value,
  accentColor,
  palette,
}: {
  label: string;
  value: string | number;
  accentColor: string;
  palette: ReturnType<typeof getHealthThemeColors>;
}) {
  return (
    <View
      style={[
        statStyles.card,
        {
          backgroundColor: palette.card,
          borderColor: accentColor + '44',
        },
      ]}
    >
      <Text style={[statStyles.value, { color: accentColor, fontSize: HEALTH_THEME_TYPOGRAPHY.h2.fontSize }]}>{value}</Text>
      <Text style={[statStyles.label, { color: palette.subtext, fontSize: HEALTH_THEME_TYPOGRAPHY.caption.fontSize }]}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 120,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    margin: 4,
  },
  value: {
    fontSize: 26,
    fontWeight: '800',
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 4,
  },
});

// ─── task filter chips ────────────────────────────────────────────────────

type TaskFilter = 'all' | 'open' | 'in_progress' | 'completed';

const TASK_FILTERS: { id: TaskFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'completed', label: 'Completed' },
];

// ─── main screen ──────────────────────────────────────────────────────────

export default function ClinicalCommandCenterScreen({ route, navigation }: Props) {
  const { institutionId, institutionName } = route.params;
  const scheme = useColorScheme();
  const palette = getHealthThemeColors(scheme === 'light' ? 'light' : 'dark');
  const borders = getHealthThemeBorders(palette);
  const { palette: kisPalette } = useKISTheme();
  const PRIORITY_COLORS = makePriorityColors(kisPalette);
  const SEVERITY_COLORS = makeSeverityColors(kisPalette);
  const TRIAGE_COLORS = makeTriageColors(kisPalette);
  const REFERRAL_STATUS_COLORS = makeReferralStatusColors(kisPalette);
  const WORKFLOW_PHASES = makeWorkflowPhases(kisPalette);

  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // ── overview ──
  const [commandData, setCommandData] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewRefreshing, setOverviewRefreshing] = useState(false);

  // ── tasks ──
  const [tasks, setTasks] = useState<any[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksRefreshing, setTasksRefreshing] = useState(false);
  const [taskFilter, setTaskFilter] = useState<TaskFilter>('all');
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [taskModalVisible, setTaskModalVisible] = useState(false);
  const [taskUpdating, setTaskUpdating] = useState(false);

  // ── escalations ──
  const [escalations, setEscalations] = useState<any[]>([]);
  const [escalationsLoading, setEscalationsLoading] = useState(false);
  const [escalationsRefreshing, setEscalationsRefreshing] = useState(false);
  const [selectedEscalation, setSelectedEscalation] = useState<any>(null);
  const [escalationModalVisible, setEscalationModalVisible] = useState(false);
  const [escalationUpdating, setEscalationUpdating] = useState(false);

  // ── triage ──
  const [triageQueue, setTriageQueue] = useState<any[]>([]);
  const [triageLoading, setTriageLoading] = useState(false);
  const [triageRefreshing, setTriageRefreshing] = useState(false);
  const [selectedTriage, setSelectedTriage] = useState<any>(null);
  const [triageModalVisible, setTriageModalVisible] = useState(false);

  // ── referrals ──
  const [referrals, setReferrals] = useState<any[]>([]);
  const [referralsLoading, setReferralsLoading] = useState(false);
  const [referralsRefreshing, setReferralsRefreshing] = useState(false);
  const [selectedReferral, setSelectedReferral] = useState<any>(null);
  const [referralModalVisible, setReferralModalVisible] = useState(false);

  // ── workflow ──
  const [workflowSessions, setWorkflowSessions] = useState<any[]>([]);
  const [workflowLoading, setWorkflowLoading] = useState(false);
  const [workflowRefreshing, setWorkflowRefreshing] = useState(false);
  const [advancingSessionId, setAdvancingSessionId] = useState<string | null>(null);

  // ── analytics ──
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // ── compliance ──
  const [complianceData, setComplianceData] = useState<any>(null);
  const [complianceLoading, setComplianceLoading] = useState(false);

  // ── data fetchers ──

  const fetchAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const res = await getRequest(ROUTES.analytics.clinicalReports);
      setAnalyticsData(res?.data ?? res ?? null);
    } catch {
      // non-blocking — analytics is supplementary
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  const fetchCompliance = useCallback(async () => {
    setComplianceLoading(true);
    try {
      const [auditRes, credRes] = await Promise.all([
        getRequest(ROUTES.compliance.auditLogs),
        getRequest(ROUTES.compliance.credentials),
      ]);
      setComplianceData({
        auditLogs: Array.isArray(auditRes?.data) ? auditRes.data : [],
        credentials: Array.isArray(credRes?.data) ? credRes.data : [],
      });
    } catch {
      // non-blocking
    } finally {
      setComplianceLoading(false);
    }
  }, []);

  const fetchOverview = useCallback(async (refreshing = false) => {
    if (refreshing) setOverviewRefreshing(true);
    else setOverviewLoading(true);
    try {
      const [cmdRes, eventsRes] = await Promise.all([
        getRequest(ROUTES.clinical.commandCenter),
        getRequest(ROUTES.clinical.events),
      ]);
      setCommandData(cmdRes?.data ?? cmdRes ?? null);
      const evList = Array.isArray(eventsRes?.data)
        ? eventsRes.data
        : Array.isArray(eventsRes)
        ? eventsRes
        : [];
      setEvents(evList);
      setLastRefresh(new Date());
    } catch (e: any) {
      if (!refreshing) Alert.alert('Overview', e?.message || 'Failed to load overview.');
    } finally {
      setOverviewLoading(false);
      setOverviewRefreshing(false);
    }
    // Fetch analytics + compliance in parallel (non-blocking)
    void fetchAnalytics();
    void fetchCompliance();
  }, [fetchAnalytics, fetchCompliance]);

  const fetchTasks = useCallback(async (refreshing = false) => {
    if (refreshing) setTasksRefreshing(true);
    else setTasksLoading(true);
    try {
      const res = await getRequest(ROUTES.clinical.tasks);
      const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
      setTasks(list);
      setLastRefresh(new Date());
    } catch (e: any) {
      if (!refreshing) Alert.alert('Tasks', e?.message || 'Failed to load tasks.');
    } finally {
      setTasksLoading(false);
      setTasksRefreshing(false);
    }
  }, []);

  const fetchEscalations = useCallback(async (refreshing = false) => {
    if (refreshing) setEscalationsRefreshing(true);
    else setEscalationsLoading(true);
    try {
      const res = await getRequest(ROUTES.clinical.escalations);
      const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
      setEscalations(list);
      setLastRefresh(new Date());
    } catch (e: any) {
      if (!refreshing) Alert.alert('Escalations', e?.message || 'Failed to load escalations.');
    } finally {
      setEscalationsLoading(false);
      setEscalationsRefreshing(false);
    }
  }, []);

  const fetchTriage = useCallback(async (refreshing = false) => {
    if (refreshing) setTriageRefreshing(true);
    else setTriageLoading(true);
    try {
      const res = await getRequest(ROUTES.clinical.triage);
      const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
      setTriageQueue(list);
      setLastRefresh(new Date());
    } catch (e: any) {
      if (!refreshing) Alert.alert('Triage', e?.message || 'Failed to load triage queue.');
    } finally {
      setTriageLoading(false);
      setTriageRefreshing(false);
    }
  }, []);

  const fetchReferrals = useCallback(async (refreshing = false) => {
    if (refreshing) setReferralsRefreshing(true);
    else setReferralsLoading(true);
    try {
      const res = await getRequest(ROUTES.clinical.referrals);
      const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
      setReferrals(list);
      setLastRefresh(new Date());
    } catch (e: any) {
      if (!refreshing) Alert.alert('Referrals', e?.message || 'Failed to load referrals.');
    } finally {
      setReferralsLoading(false);
      setReferralsRefreshing(false);
    }
  }, []);

  const fetchWorkflowSessions = useCallback(async (refreshing = false) => {
    if (refreshing) setWorkflowRefreshing(true);
    else setWorkflowLoading(true);
    try {
      const res = await getRequest(ROUTES.clinical.sessions);
      const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
      setWorkflowSessions(list);
      setLastRefresh(new Date());
    } catch (e: any) {
      if (!refreshing) Alert.alert('Workflow', e?.message || 'Failed to load workflow sessions.');
    } finally {
      setWorkflowLoading(false);
      setWorkflowRefreshing(false);
    }
  }, []);

  const handleAdvancePhase = useCallback(
    async (sessionId: string, nextPhase: WorkflowPhase) => {
      setAdvancingSessionId(sessionId);
      try {
        const res = await patchRequest(
          ROUTES.clinical.sessionAdvancePhase(sessionId),
          { next_phase: nextPhase },
        );
        if (res?.success === false) {
          throw new Error(res?.message || 'Failed to advance phase.');
        }
        // Update local state optimistically.
        setWorkflowSessions(prev =>
          prev.map(s =>
            String(s.id) === sessionId ? { ...s, current_phase: nextPhase } : s,
          ),
        );
        Alert.alert('Workflow', `Moved to ${nextPhase.charAt(0).toUpperCase() + nextPhase.slice(1)}.`);
      } catch (e: any) {
        Alert.alert('Workflow', e?.message || 'Failed to advance phase.');
      } finally {
        setAdvancingSessionId(null);
      }
    },
    [],
  );

  // Load data when tab changes
  useEffect(() => {
    if (activeTab === 'overview') fetchOverview();
    else if (activeTab === 'tasks') fetchTasks();
    else if (activeTab === 'escalations') fetchEscalations();
    else if (activeTab === 'triage') fetchTriage();
    else if (activeTab === 'referrals') fetchReferrals();
    else if (activeTab === 'workflow') fetchWorkflowSessions();
  }, [activeTab, fetchEscalations, fetchOverview, fetchReferrals, fetchTasks, fetchTriage, fetchWorkflowSessions]);

  // ── task actions ──

  const handleMarkTaskComplete = useCallback(async () => {
    if (!selectedTask?.id) return;
    setTaskUpdating(true);
    try {
      const res = await patchRequest(ROUTES.clinical.task(String(selectedTask.id)), {
        status: 'completed',
      });
      if (!res?.success) throw new Error(res?.message || 'Failed to update task.');
      setTasks((prev) =>
        prev.map((t) => (t.id === selectedTask.id ? { ...t, status: 'completed' } : t)),
      );
      setSelectedTask((prev: any) => ({ ...prev, status: 'completed' }));
      Alert.alert('Task', 'Marked as complete.');
    } catch (e: any) {
      Alert.alert('Task', e?.message || 'Failed to update task.');
    } finally {
      setTaskUpdating(false);
    }
  }, [selectedTask]);

  // ── escalation actions ──

  const handleEscalationAction = useCallback(
    async (status: 'acknowledged' | 'resolved') => {
      if (!selectedEscalation?.id) return;
      setEscalationUpdating(true);
      try {
        const res = await patchRequest(
          ROUTES.clinical.escalation(String(selectedEscalation.id)),
          { status },
        );
        if (!res?.success) throw new Error(res?.message || 'Failed to update escalation.');
        setEscalations((prev) =>
          prev.map((e) => (e.id === selectedEscalation.id ? { ...e, status } : e)),
        );
        setSelectedEscalation((prev: any) => ({ ...prev, status }));
        Alert.alert('Escalation', status === 'acknowledged' ? 'Acknowledged.' : 'Resolved.');
      } catch (e: any) {
        Alert.alert('Escalation', e?.message || 'Failed to update escalation.');
      } finally {
        setEscalationUpdating(false);
      }
    },
    [selectedEscalation],
  );

  // ── derived data ──

  const filteredTasks = taskFilter === 'all'
    ? tasks
    : tasks.filter((t) => t.status === taskFilter);

  const formatTime = (date: Date) =>
    date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const elapsedLabel = (isoString: string): string => {
    if (!isoString) return '';
    const ms = Date.now() - new Date(isoString).getTime();
    const min = Math.floor(ms / 60000);
    if (min < 60) return `${min}m ago`;
    const hrs = Math.floor(min / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  // ─── render tabs ──────────────────────────────────────────────────────────

  const renderTabBar = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[tabStyles.bar, { borderBottomColor: palette.divider }]}
    >
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <TouchableOpacity
            key={tab.id}
            onPress={() => setActiveTab(tab.id)}
            style={[
              tabStyles.tab,
              isActive && { borderBottomColor: palette.accentPrimary },
            ]}
          >
            <Text
              style={[
                tabStyles.tabText,
                { color: isActive ? palette.accentPrimary : palette.subtext },
                isActive && { fontWeight: '700' },
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  // ─── overview ─────────────────────────────────────────────────────────────

  const renderOverview = () => {
    if (overviewLoading) {
      return (
        <View style={sharedStyles.center}>
          <ActivityIndicator color={palette.accentPrimary} />
        </View>
      );
    }

    const stats = commandData ?? {};
    const openTasks = stats.open_tasks ?? stats.openTasks ?? tasks.length;
    const activeEscalations = stats.active_escalations ?? stats.activeEscalations ?? escalations.length;
    const triageLength = stats.triage_queue_length ?? stats.triageQueueLength ?? triageQueue.length;
    const pendingReferrals = stats.pending_referrals ?? stats.pendingReferrals ?? referrals.filter((r) => r.status === 'pending').length;

    return (
      <ScrollView
        contentContainerStyle={sharedStyles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={overviewRefreshing}
            onRefresh={() => fetchOverview(true)}
            tintColor={palette.accentPrimary}
          />
        }
      >
        <Text style={[HEALTH_THEME_TYPOGRAPHY.h3, { color: palette.text, marginBottom: HEALTH_THEME_SPACING.sm }]}>
          At a glance
        </Text>
        <View style={sharedStyles.statsRow}>
          <StatCard label="Open Tasks" value={openTasks} accentColor={kisPalette.danger} palette={palette} />
          <StatCard label="Active Escalations" value={activeEscalations} accentColor={kisPalette.gold} palette={palette} />
        </View>
        <View style={sharedStyles.statsRow}>
          <StatCard label="Triage Queue" value={triageLength} accentColor={kisPalette.gold} palette={palette} />
          <StatCard label="Pending Referrals" value={pendingReferrals} accentColor={kisPalette.primary} palette={palette} />
        </View>

        <Text
          style={[
            HEALTH_THEME_TYPOGRAPHY.h3,
            { color: palette.text, marginTop: HEALTH_THEME_SPACING.lg, marginBottom: HEALTH_THEME_SPACING.sm },
          ]}
        >
          Recent clinical events
        </Text>
        {events.length === 0 ? (
          <Text style={[HEALTH_THEME_TYPOGRAPHY.body, { color: palette.subtext }]}>
            No recent events.
          </Text>
        ) : (
          events.slice(0, 15).map((ev, idx) => (
            <View
              key={ev.id ?? idx}
              style={[
                sharedStyles.listItem,
                {
                  backgroundColor: palette.card,
                  borderColor: palette.divider,
                },
              ]}
            >
              <Text style={[HEALTH_THEME_TYPOGRAPHY.body, { color: palette.text, fontWeight: '600' }]}>
                {ev.title ?? ev.event_type ?? ev.type ?? 'Event'}
              </Text>
              {(ev.description ?? ev.detail) ? (
                <Text style={[HEALTH_THEME_TYPOGRAPHY.body, { color: palette.subtext, marginTop: 2 }]}>
                  {ev.description ?? ev.detail}
                </Text>
              ) : null}
              {ev.created_at ?? ev.timestamp ? (
                <Text style={[sharedStyles.meta, { color: palette.subtext }]}>
                  {elapsedLabel(ev.created_at ?? ev.timestamp)}
                </Text>
              ) : null}
            </View>
          ))
        )}

        {/* ── Analytics section ── */}
        <Text
          style={[
            HEALTH_THEME_TYPOGRAPHY.h3,
            { color: palette.text, marginTop: HEALTH_THEME_SPACING.lg, marginBottom: HEALTH_THEME_SPACING.sm },
          ]}
        >
          Analytics
        </Text>
        {analyticsLoading ? (
          <ActivityIndicator color={palette.accentPrimary} style={{ marginVertical: 8 }} />
        ) : analyticsData ? (
          <>
            <View style={sharedStyles.statsRow}>
              <StatCard
                label="Total Patients"
                value={
                  analyticsData.total_patients ??
                  analyticsData.totalPatients ??
                  analyticsData.patient_count ??
                  '—'
                }
                accentColor={kisPalette.primary}
                palette={palette}
              />
              <StatCard
                label="Satisfaction Score"
                value={
                  analyticsData.satisfaction_score != null
                    ? `${Number(analyticsData.satisfaction_score).toFixed(1)}`
                    : analyticsData.avg_satisfaction != null
                    ? `${Number(analyticsData.avg_satisfaction).toFixed(1)}`
                    : '—'
                }
                accentColor={kisPalette.success}
                palette={palette}
              />
            </View>
            <View style={sharedStyles.statsRow}>
              <StatCard
                label="Outcome Benchmark"
                value={
                  analyticsData.outcome_benchmark ??
                  analyticsData.benchmark_score ??
                  analyticsData.outcomes ??
                  '—'
                }
                accentColor={kisPalette.primary}
                palette={palette}
              />
              <StatCard
                label="Reports"
                value={
                  Array.isArray(analyticsData.reports)
                    ? analyticsData.reports.length
                    : analyticsData.report_count ?? analyticsData.count ?? '—'
                }
                accentColor={kisPalette.gold}
                palette={palette}
              />
            </View>
          </>
        ) : (
          <Text style={[HEALTH_THEME_TYPOGRAPHY.body, { color: palette.subtext }]}>
            No analytics data available.
          </Text>
        )}

        {/* ── Compliance section ── */}
        <Text
          style={[
            HEALTH_THEME_TYPOGRAPHY.h3,
            { color: palette.text, marginTop: HEALTH_THEME_SPACING.lg, marginBottom: HEALTH_THEME_SPACING.sm },
          ]}
        >
          Compliance
        </Text>
        {complianceLoading ? (
          <ActivityIndicator color={palette.accentPrimary} style={{ marginVertical: 8 }} />
        ) : complianceData ? (
          <>
            <View style={sharedStyles.statsRow}>
              <StatCard
                label="Audit Logs"
                value={complianceData.auditLogs?.length ?? 0}
                accentColor={kisPalette.gold}
                palette={palette}
              />
              <StatCard
                label="Credentials"
                value={complianceData.credentials?.length ?? 0}
                accentColor={kisPalette.primary}
                palette={palette}
              />
            </View>
            {complianceData.credentials?.length > 0 && (
              <View
                style={[
                  sharedStyles.listItem,
                  { backgroundColor: palette.card, borderColor: palette.divider, marginTop: 4 },
                ]}
              >
                <Text style={[HEALTH_THEME_TYPOGRAPHY.body, { color: palette.text, fontWeight: '600' }]}>
                  Credential status
                </Text>
                {complianceData.credentials.slice(0, 3).map((cred: any, idx: number) => (
                  <Text key={cred.id ?? idx} style={[sharedStyles.meta, { color: palette.subtext, marginTop: 2 }]}>
                    {cred.name ?? cred.credential_type ?? `Credential ${idx + 1}`}
                    {cred.status ? ` · ${cred.status}` : ''}
                    {cred.expires_at ? ` · expires ${cred.expires_at}` : ''}
                  </Text>
                ))}
              </View>
            )}
          </>
        ) : (
          <Text style={[HEALTH_THEME_TYPOGRAPHY.body, { color: palette.subtext }]}>
            No compliance data available.
          </Text>
        )}
      </ScrollView>
    );
  };

  // ─── tasks ────────────────────────────────────────────────────────────────

  const renderTaskItem = ({ item }: { item: any }) => {
    const priority: string = (item.priority ?? 'low').toLowerCase();
    const status: string = item.status ?? '';
    return (
      <TouchableOpacity
        onPress={() => {
          setSelectedTask(item);
          setTaskModalVisible(true);
        }}
        style={[sharedStyles.listItem, { backgroundColor: palette.card, borderColor: palette.divider }]}
      >
        <View style={sharedStyles.rowBetween}>
          <Text
            style={[HEALTH_THEME_TYPOGRAPHY.body, { color: palette.text, fontWeight: '600', flex: 1 }]}
            numberOfLines={1}
          >
            {item.title ?? item.name ?? 'Task'}
          </Text>
          <Badge label={priority} color={PRIORITY_COLORS[priority] ?? kisPalette.subtext} />
        </View>
        {item.assignee ? (
          <Text style={[sharedStyles.meta, { color: palette.subtext }]}>
            Assigned to: {item.assignee}
          </Text>
        ) : null}
        <View style={[sharedStyles.rowBetween, { marginTop: 4 }]}>
          <Text style={[sharedStyles.meta, { color: palette.subtext }]}>
            {status.replace('_', ' ')}
          </Text>
          {item.due_date ?? item.dueDate ? (
            <Text style={[sharedStyles.meta, { color: palette.subtext }]}>
              Due: {item.due_date ?? item.dueDate}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  const renderTasks = () => {
    if (tasksLoading) {
      return (
        <View style={sharedStyles.center}>
          <ActivityIndicator color={palette.accentPrimary} />
        </View>
      );
    }

    return (
      <>
        {/* filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}
        >
          {TASK_FILTERS.map((f) => {
            const active = taskFilter === f.id;
            return (
              <TouchableOpacity
                key={f.id}
                onPress={() => setTaskFilter(f.id)}
                style={[
                  chipStyles.chip,
                  {
                    backgroundColor: active ? palette.accentPrimary : palette.card,
                    borderColor: palette.divider,
                  },
                ]}
              >
                <Text
                  style={[
                    chipStyles.chipText,
                    { color: active ? palette.bg : palette.subtext },
                  ]}
                >
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <FlatList
          data={filteredTasks}
          keyExtractor={(item, idx) => String(item.id ?? idx)}
          renderItem={renderTaskItem}
          contentContainerStyle={sharedStyles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={tasksRefreshing}
              onRefresh={() => fetchTasks(true)}
              tintColor={palette.accentPrimary}
            />
          }
          ListEmptyComponent={
            <Text style={[HEALTH_THEME_TYPOGRAPHY.body, { color: palette.subtext, textAlign: 'center', marginTop: 32 }]}>
              No tasks found.
            </Text>
          }
        />
      </>
    );
  };

  // ─── escalations ──────────────────────────────────────────────────────────

  const renderEscalationItem = ({ item }: { item: any }) => {
    const severity: string = (item.severity ?? 'routine').toLowerCase();
    return (
      <TouchableOpacity
        onPress={() => {
          setSelectedEscalation(item);
          setEscalationModalVisible(true);
        }}
        style={[sharedStyles.listItem, { backgroundColor: palette.card, borderColor: palette.divider }]}
      >
        <View style={sharedStyles.rowBetween}>
          <Text
            style={[HEALTH_THEME_TYPOGRAPHY.body, { color: palette.text, fontWeight: '600', flex: 1 }]}
            numberOfLines={1}
          >
            {item.patient_name ?? item.patientName ?? item.case_name ?? item.caseName ?? 'Patient'}
          </Text>
          <Badge label={severity} color={SEVERITY_COLORS[severity] ?? kisPalette.subtext} />
        </View>
        {item.escalated_by ?? item.escalatedBy ? (
          <Text style={[sharedStyles.meta, { color: palette.subtext }]}>
            Escalated by: {item.escalated_by ?? item.escalatedBy}
          </Text>
        ) : null}
        {item.created_at ?? item.escalated_at ? (
          <Text style={[sharedStyles.meta, { color: palette.subtext }]}>
            {elapsedLabel(item.created_at ?? item.escalated_at)}
          </Text>
        ) : null}
      </TouchableOpacity>
    );
  };

  const renderEscalations = () => {
    if (escalationsLoading) {
      return (
        <View style={sharedStyles.center}>
          <ActivityIndicator color={palette.accentPrimary} />
        </View>
      );
    }

    return (
      <FlatList
        data={escalations}
        keyExtractor={(item, idx) => String(item.id ?? idx)}
        renderItem={renderEscalationItem}
        contentContainerStyle={sharedStyles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={escalationsRefreshing}
            onRefresh={() => fetchEscalations(true)}
            tintColor={palette.accentPrimary}
          />
        }
        ListEmptyComponent={
          <Text style={[HEALTH_THEME_TYPOGRAPHY.body, { color: palette.subtext, textAlign: 'center', marginTop: 32 }]}>
            No escalations found.
          </Text>
        }
      />
    );
  };

  // ─── triage ───────────────────────────────────────────────────────────────

  const renderTriageItem = ({ item }: { item: any }) => {
    const level: number = Number(item.triage_level ?? item.triageLevel ?? 5);
    const levelColor = TRIAGE_COLORS[level] ?? kisPalette.subtext;
    return (
      <TouchableOpacity
        onPress={() => {
          setSelectedTriage(item);
          setTriageModalVisible(true);
        }}
        style={[sharedStyles.listItem, { backgroundColor: palette.card, borderColor: palette.divider }]}
      >
        <View style={sharedStyles.rowBetween}>
          <Text
            style={[HEALTH_THEME_TYPOGRAPHY.body, { color: palette.text, fontWeight: '600', flex: 1 }]}
            numberOfLines={1}
          >
            {item.patient_name ?? item.patientName ?? 'Patient'}
          </Text>
          <View
            style={[
              triageStyles.levelBadge,
              { backgroundColor: levelColor + '22', borderColor: levelColor + '66' },
            ]}
          >
            <Text style={[triageStyles.levelText, { color: levelColor }]}>L{level}</Text>
          </View>
        </View>
        {item.chief_complaint ?? item.chiefComplaint ? (
          <Text style={[sharedStyles.meta, { color: palette.subtext }]}>
            {item.chief_complaint ?? item.chiefComplaint}
          </Text>
        ) : null}
        <View style={[sharedStyles.rowBetween, { marginTop: 4 }]}>
          {item.wait_time ?? item.waitTime ? (
            <Text style={[sharedStyles.meta, { color: palette.subtext }]}>
              Wait: {item.wait_time ?? item.waitTime}
            </Text>
          ) : null}
          {item.assigned_clinician ?? item.assignedClinician ? (
            <Text style={[sharedStyles.meta, { color: palette.subtext }]}>
              {item.assigned_clinician ?? item.assignedClinician}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  const renderTriage = () => {
    if (triageLoading) {
      return (
        <View style={sharedStyles.center}>
          <ActivityIndicator color={palette.accentPrimary} />
        </View>
      );
    }

    return (
      <FlatList
        data={triageQueue}
        keyExtractor={(item, idx) => String(item.id ?? idx)}
        renderItem={renderTriageItem}
        contentContainerStyle={sharedStyles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={triageRefreshing}
            onRefresh={() => fetchTriage(true)}
            tintColor={palette.accentPrimary}
          />
        }
        ListEmptyComponent={
          <Text style={[HEALTH_THEME_TYPOGRAPHY.body, { color: palette.subtext, textAlign: 'center', marginTop: 32 }]}>
            Triage queue is empty.
          </Text>
        }
      />
    );
  };

  // ─── referrals ────────────────────────────────────────────────────────────

  const renderReferralItem = ({ item }: { item: any }) => {
    const status: string = (item.status ?? 'pending').toLowerCase();
    return (
      <TouchableOpacity
        onPress={() => {
          setSelectedReferral(item);
          setReferralModalVisible(true);
        }}
        style={[sharedStyles.listItem, { backgroundColor: palette.card, borderColor: palette.divider }]}
      >
        <View style={sharedStyles.rowBetween}>
          <Text
            style={[HEALTH_THEME_TYPOGRAPHY.body, { color: palette.text, fontWeight: '600', flex: 1 }]}
            numberOfLines={1}
          >
            {item.patient_name ?? item.patientName ?? 'Patient'}
          </Text>
          <Badge label={status} color={REFERRAL_STATUS_COLORS[status] ?? kisPalette.subtext} />
        </View>
        <Text style={[sharedStyles.meta, { color: palette.subtext }]}>
          {item.from_clinician ?? item.fromClinician ?? '—'} → {item.to_clinician ?? item.toClinician ?? '—'}
        </Text>
        {item.reason ? (
          <Text style={[sharedStyles.meta, { color: palette.subtext }]} numberOfLines={1}>
            {item.reason}
          </Text>
        ) : null}
        {item.date ?? item.created_at ? (
          <Text style={[sharedStyles.meta, { color: palette.subtext }]}>
            {item.date ?? elapsedLabel(item.created_at)}
          </Text>
        ) : null}
      </TouchableOpacity>
    );
  };

  const renderReferrals = () => {
    if (referralsLoading) {
      return (
        <View style={sharedStyles.center}>
          <ActivityIndicator color={palette.accentPrimary} />
        </View>
      );
    }

    return (
      <FlatList
        data={referrals}
        keyExtractor={(item, idx) => String(item.id ?? idx)}
        renderItem={renderReferralItem}
        contentContainerStyle={sharedStyles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={referralsRefreshing}
            onRefresh={() => fetchReferrals(true)}
            tintColor={palette.accentPrimary}
          />
        }
        ListEmptyComponent={
          <Text style={[HEALTH_THEME_TYPOGRAPHY.body, { color: palette.subtext, textAlign: 'center', marginTop: 32 }]}>
            No referrals found.
          </Text>
        }
      />
    );
  };

  // ─── workflow ─────────────────────────────────────────────────────────────

  const renderWorkflowPhasePipeline = (currentPhase: string) => {
    const normalised = (currentPhase ?? '').toLowerCase() as WorkflowPhase;
    const currentIndex = WORKFLOW_PHASES.findIndex(p => p.key === normalised);
    return (
      <View style={{ marginTop: 8 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            {WORKFLOW_PHASES.map((phase, idx) => {
              const isActive = idx === currentIndex;
              const isPast = idx < currentIndex;
              const color = phase.color;
              return (
                <React.Fragment key={phase.key}>
                  <View
                    style={[
                      workflowStyles.phaseChip,
                      {
                        backgroundColor: isActive
                          ? color
                          : isPast
                          ? color + '55'
                          : palette.surface,
                        borderColor: isActive ? color : isPast ? color + '88' : palette.divider,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        workflowStyles.phaseChipText,
                        {
                          color: isActive
                            ? kisPalette.onPrimary
                            : isPast
                            ? color
                            : palette.subtext,
                          fontWeight: isActive ? '800' : '600',
                        },
                      ]}
                    >
                      {phase.label}
                    </Text>
                  </View>
                  {idx < WORKFLOW_PHASES.length - 1 ? (
                    <Text style={{ color: palette.divider, fontSize: 16 }}>›</Text>
                  ) : null}
                </React.Fragment>
              );
            })}
          </View>
        </ScrollView>
      </View>
    );
  };

  const renderWorkflowSessionCard = ({ item }: { item: any }) => {
    const sessionId = String(item.id ?? '');
    const currentPhase = (item.current_phase ?? item.phase ?? 'admission').toLowerCase() as WorkflowPhase;
    const patientName = item.patient_name ?? item.patientName ?? item.patient ?? 'Patient';
    const nextPhase = NEXT_PHASE[currentPhase];
    const nextPhaseMeta = nextPhase ? WORKFLOW_PHASES.find(p => p.key === nextPhase) : null;
    const advancing = advancingSessionId === sessionId;
    const isComplete = currentPhase === 'discharged';

    return (
      <View
        style={[
          sharedStyles.listItem,
          { backgroundColor: palette.card, borderColor: palette.divider },
        ]}
      >
        <View style={sharedStyles.rowBetween}>
          <Text
            style={[HEALTH_THEME_TYPOGRAPHY.body, { color: palette.text, fontWeight: '700', flex: 1 }]}
            numberOfLines={1}
          >
            {patientName}
          </Text>
          {item.session_id ?? item.sessionId ? (
            <Text style={[sharedStyles.meta, { color: palette.subtext }]} numberOfLines={1}>
              #{String(item.session_id ?? item.sessionId).slice(-6)}
            </Text>
          ) : null}
        </View>
        {renderWorkflowPhasePipeline(currentPhase)}
        {isComplete ? (
          <View
            style={[
              workflowStyles.advanceButton,
              { backgroundColor: `${kisPalette.subtext}22`, borderColor: `${kisPalette.subtext}66`, borderWidth: 1, marginTop: 10 },
            ]}
          >
            <Text style={{ color: kisPalette.subtext, fontWeight: '700', fontSize: 13 }}>Discharged</Text>
          </View>
        ) : nextPhaseMeta ? (
          <TouchableOpacity
            onPress={() => handleAdvancePhase(sessionId, nextPhase!)}
            disabled={advancing}
            style={[
              workflowStyles.advanceButton,
              { backgroundColor: nextPhaseMeta.color, marginTop: 10 },
            ]}
          >
            {advancing ? (
              <ActivityIndicator color={kisPalette.onPrimary} size="small" />
            ) : (
              <Text style={{ color: kisPalette.onPrimary, fontWeight: '700', fontSize: 13 }}>
                Advance to {nextPhaseMeta.label}
              </Text>
            )}
          </TouchableOpacity>
        ) : null}
        {item.created_at ?? item.admitted_at ? (
          <Text style={[sharedStyles.meta, { color: palette.subtext, marginTop: 6 }]}>
            {elapsedLabel(item.created_at ?? item.admitted_at)}
          </Text>
        ) : null}
      </View>
    );
  };

  const renderWorkflow = () => {
    if (workflowLoading) {
      return (
        <View style={sharedStyles.center}>
          <ActivityIndicator color={palette.accentPrimary} />
        </View>
      );
    }

    return (
      <FlatList
        data={workflowSessions}
        keyExtractor={(item, idx) => String(item.id ?? idx)}
        renderItem={renderWorkflowSessionCard}
        contentContainerStyle={sharedStyles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={workflowRefreshing}
            onRefresh={() => fetchWorkflowSessions(true)}
            tintColor={palette.accentPrimary}
          />
        }
        ListHeaderComponent={
          <Text
            style={[
              HEALTH_THEME_TYPOGRAPHY.h3,
              { color: palette.text, marginBottom: HEALTH_THEME_SPACING.sm },
            ]}
          >
            Active Patient Workflows
          </Text>
        }
        ListEmptyComponent={
          <Text
            style={[
              HEALTH_THEME_TYPOGRAPHY.body,
              { color: palette.subtext, textAlign: 'center', marginTop: 32 },
            ]}
          >
            No active workflow sessions.
          </Text>
        }
      />
    );
  };

  // ─── modals ───────────────────────────────────────────────────────────────

  const renderTaskModal = () => {
    if (!selectedTask) return null;
    const priority: string = (selectedTask.priority ?? 'low').toLowerCase();
    const isComplete = selectedTask.status === 'completed';
    return (
      <Modal
        visible={taskModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setTaskModalVisible(false)}
      >
        <LinearGradient colors={[palette.gradientStart, palette.gradientEnd]} style={{ flex: 1 }}>
          <SafeAreaView style={{ flex: 1, paddingTop: 40 }}>
            <View style={modalStyles.header}>
              <Text style={[HEALTH_THEME_TYPOGRAPHY.h2, { color: palette.text, flex: 1 }]}>
                Task detail
              </Text>
              <TouchableOpacity onPress={() => setTaskModalVisible(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <KISIcon name="close" size={22} color={palette.text} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={modalStyles.body}>
              <Text style={[HEALTH_THEME_TYPOGRAPHY.h3, { color: palette.text }]}>
                {selectedTask.title ?? selectedTask.name ?? 'Task'}
              </Text>
              <View style={{ marginVertical: 8 }}>
                <Badge label={priority} color={PRIORITY_COLORS[priority] ?? kisPalette.subtext} />
              </View>
              {selectedTask.description ? (
                <Text style={[HEALTH_THEME_TYPOGRAPHY.body, { color: palette.subtext, marginTop: 8 }]}>
                  {selectedTask.description}
                </Text>
              ) : null}
              {selectedTask.assignee ? (
                <Text style={[sharedStyles.meta, { color: palette.subtext, marginTop: 8 }]}>
                  Assigned to: {selectedTask.assignee}
                </Text>
              ) : null}
              <Text style={[sharedStyles.meta, { color: palette.subtext, marginTop: 4 }]}>
                Status: {String(selectedTask.status ?? '').replace('_', ' ')}
              </Text>
              {selectedTask.due_date ?? selectedTask.dueDate ? (
                <Text style={[sharedStyles.meta, { color: palette.subtext, marginTop: 4 }]}>
                  Due: {selectedTask.due_date ?? selectedTask.dueDate}
                </Text>
              ) : null}
              {!isComplete && (
                <TouchableOpacity
                  onPress={handleMarkTaskComplete}
                  disabled={taskUpdating}
                  style={[
                    modalStyles.actionButton,
                    { backgroundColor: palette.accentPrimary, marginTop: 24 },
                  ]}
                >
                  {taskUpdating ? (
                    <ActivityIndicator color={palette.bg} />
                  ) : (
                    <Text style={[modalStyles.actionButtonText, { color: palette.bg }]}>
                      Mark Complete
                    </Text>
                  )}
                </TouchableOpacity>
              )}
              {isComplete && (
                <View
                  style={[
                    modalStyles.actionButton,
                    { backgroundColor: `${kisPalette.success}22`, borderColor: `${kisPalette.success}66`, borderWidth: 1, marginTop: 24 },
                  ]}
                >
                  <Text style={[modalStyles.actionButtonText, { color: kisPalette.success }]}>
                    Completed
                  </Text>
                </View>
              )}
            </ScrollView>
          </SafeAreaView>
        </LinearGradient>
      </Modal>
    );
  };

  const renderEscalationModal = () => {
    if (!selectedEscalation) return null;
    const severity: string = (selectedEscalation.severity ?? 'routine').toLowerCase();
    const isAcknowledged = ['acknowledged', 'resolved'].includes(selectedEscalation.status ?? '');
    const isResolved = selectedEscalation.status === 'resolved';
    return (
      <Modal
        visible={escalationModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEscalationModalVisible(false)}
      >
        <LinearGradient colors={[palette.gradientStart, palette.gradientEnd]} style={{ flex: 1 }}>
          <SafeAreaView style={{ flex: 1, paddingTop: 40 }}>
            <View style={modalStyles.header}>
              <Text style={[HEALTH_THEME_TYPOGRAPHY.h2, { color: palette.text, flex: 1 }]}>
                Escalation detail
              </Text>
              <TouchableOpacity onPress={() => setEscalationModalVisible(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <KISIcon name="close" size={22} color={palette.text} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={modalStyles.body}>
              <Text style={[HEALTH_THEME_TYPOGRAPHY.h3, { color: palette.text }]}>
                {selectedEscalation.patient_name ?? selectedEscalation.patientName ??
                  selectedEscalation.case_name ?? selectedEscalation.caseName ?? 'Patient'}
              </Text>
              <View style={{ marginVertical: 8 }}>
                <Badge label={severity} color={SEVERITY_COLORS[severity] ?? kisPalette.subtext} />
              </View>
              {selectedEscalation.description ? (
                <Text style={[HEALTH_THEME_TYPOGRAPHY.body, { color: palette.subtext, marginTop: 8 }]}>
                  {selectedEscalation.description}
                </Text>
              ) : null}
              {selectedEscalation.escalated_by ?? selectedEscalation.escalatedBy ? (
                <Text style={[sharedStyles.meta, { color: palette.subtext, marginTop: 8 }]}>
                  Escalated by: {selectedEscalation.escalated_by ?? selectedEscalation.escalatedBy}
                </Text>
              ) : null}
              <Text style={[sharedStyles.meta, { color: palette.subtext, marginTop: 4 }]}>
                Status: {String(selectedEscalation.status ?? '')}
              </Text>
              {selectedEscalation.created_at ?? selectedEscalation.escalated_at ? (
                <Text style={[sharedStyles.meta, { color: palette.subtext, marginTop: 4 }]}>
                  {elapsedLabel(selectedEscalation.created_at ?? selectedEscalation.escalated_at)}
                </Text>
              ) : null}
              {!isAcknowledged && (
                <TouchableOpacity
                  onPress={() => handleEscalationAction('acknowledged')}
                  disabled={escalationUpdating}
                  style={[
                    modalStyles.actionButton,
                    { backgroundColor: kisPalette.primary, marginTop: 24 },
                  ]}
                >
                  {escalationUpdating ? (
                    <ActivityIndicator color={kisPalette.onPrimary} />
                  ) : (
                    <Text style={[modalStyles.actionButtonText, { color: kisPalette.onPrimary }]}>
                      Acknowledge
                    </Text>
                  )}
                </TouchableOpacity>
              )}
              {!isResolved && (
                <TouchableOpacity
                  onPress={() => handleEscalationAction('resolved')}
                  disabled={escalationUpdating}
                  style={[
                    modalStyles.actionButton,
                    { backgroundColor: kisPalette.success, marginTop: 12 },
                  ]}
                >
                  {escalationUpdating ? (
                    <ActivityIndicator color={kisPalette.onPrimary} />
                  ) : (
                    <Text style={[modalStyles.actionButtonText, { color: kisPalette.onPrimary }]}>
                      Resolve
                    </Text>
                  )}
                </TouchableOpacity>
              )}
              {isResolved && (
                <View
                  style={[
                    modalStyles.actionButton,
                    { backgroundColor: `${kisPalette.success}22`, borderColor: `${kisPalette.success}66`, borderWidth: 1, marginTop: 24 },
                  ]}
                >
                  <Text style={[modalStyles.actionButtonText, { color: kisPalette.success }]}>
                    Resolved
                  </Text>
                </View>
              )}
            </ScrollView>
          </SafeAreaView>
        </LinearGradient>
      </Modal>
    );
  };

  const renderTriageModal = () => {
    if (!selectedTriage) return null;
    const level: number = Number(selectedTriage.triage_level ?? selectedTriage.triageLevel ?? 5);
    const levelColor = TRIAGE_COLORS[level] ?? kisPalette.subtext;
    return (
      <Modal
        visible={triageModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setTriageModalVisible(false)}
      >
        <LinearGradient colors={[palette.gradientStart, palette.gradientEnd]} style={{ flex: 1 }}>
          <SafeAreaView style={{ flex: 1, paddingTop: 40 }}>
            <View style={modalStyles.header}>
              <Text style={[HEALTH_THEME_TYPOGRAPHY.h2, { color: palette.text, flex: 1 }]}>
                Triage detail
              </Text>
              <TouchableOpacity onPress={() => setTriageModalVisible(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <KISIcon name="close" size={22} color={palette.text} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={modalStyles.body}>
              <Text style={[HEALTH_THEME_TYPOGRAPHY.h3, { color: palette.text }]}>
                {selectedTriage.patient_name ?? selectedTriage.patientName ?? 'Patient'}
              </Text>
              <View style={[triageStyles.levelBadge, { backgroundColor: levelColor + '22', borderColor: levelColor + '66', marginVertical: 8 }]}>
                <Text style={[triageStyles.levelText, { color: levelColor }]}>
                  Triage Level {level}
                </Text>
              </View>
              {selectedTriage.chief_complaint ?? selectedTriage.chiefComplaint ? (
                <Text style={[HEALTH_THEME_TYPOGRAPHY.body, { color: palette.subtext, marginTop: 8 }]}>
                  Chief complaint: {selectedTriage.chief_complaint ?? selectedTriage.chiefComplaint}
                </Text>
              ) : null}
              {selectedTriage.wait_time ?? selectedTriage.waitTime ? (
                <Text style={[sharedStyles.meta, { color: palette.subtext, marginTop: 8 }]}>
                  Wait time: {selectedTriage.wait_time ?? selectedTriage.waitTime}
                </Text>
              ) : null}
              {selectedTriage.assigned_clinician ?? selectedTriage.assignedClinician ? (
                <Text style={[sharedStyles.meta, { color: palette.subtext, marginTop: 4 }]}>
                  Clinician: {selectedTriage.assigned_clinician ?? selectedTriage.assignedClinician}
                </Text>
              ) : null}
              {selectedTriage.notes ? (
                <Text style={[HEALTH_THEME_TYPOGRAPHY.body, { color: palette.subtext, marginTop: 12 }]}>
                  {selectedTriage.notes}
                </Text>
              ) : null}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
                <TouchableOpacity
                  onPress={() => {
                    if (!selectedTriage?.id) return;
                    Alert.alert(
                      'Update triage level',
                      'Select new acuity level:',
                      [
                        {
                          text: 'Routine',
                          onPress: async () => {
                            await patchRequest(ROUTES.clinical.triageDetail(String(selectedTriage.id)), { acuity_level: 'routine' }).catch(() => undefined);
                            setTriageQueue((prev: any[]) => prev.map((t) => t.id === selectedTriage.id ? { ...t, acuity_level: 'routine' } : t));
                            setTriageModalVisible(false);
                          },
                        },
                        {
                          text: 'Elevated',
                          onPress: async () => {
                            await patchRequest(ROUTES.clinical.triageDetail(String(selectedTriage.id)), { acuity_level: 'elevated' }).catch(() => undefined);
                            setTriageQueue((prev: any[]) => prev.map((t) => t.id === selectedTriage.id ? { ...t, acuity_level: 'elevated' } : t));
                            setTriageModalVisible(false);
                          },
                        },
                        {
                          text: 'Urgent',
                          style: 'destructive',
                          onPress: async () => {
                            await patchRequest(ROUTES.clinical.triageDetail(String(selectedTriage.id)), { acuity_level: 'urgent' }).catch(() => undefined);
                            setTriageQueue((prev: any[]) => prev.map((t) => t.id === selectedTriage.id ? { ...t, acuity_level: 'urgent' } : t));
                            setTriageModalVisible(false);
                          },
                        },
                        { text: 'Cancel', style: 'cancel' },
                      ],
                    );
                  }}
                  style={{ flex: 1, backgroundColor: kisPalette.gold + '22', borderWidth: 1, borderColor: kisPalette.gold, borderRadius: 10, padding: 12, alignItems: 'center', minHeight: 44, justifyContent: 'center' }}
                >
                  <Text style={[HEALTH_THEME_TYPOGRAPHY.label, { color: kisPalette.gold }]}>Update Level</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    if (!selectedTriage?.id) return;
                    Alert.prompt(
                      'Reassign clinician',
                      'Enter clinician name or ID:',
                      async (clinicianName: string) => {
                        if (!clinicianName?.trim()) return;
                        const meta = { ...(selectedTriage.metadata ?? {}), reassigned_to: clinicianName.trim() };
                        await patchRequest(ROUTES.clinical.triageDetail(String(selectedTriage.id)), { metadata: meta }).catch(() => undefined);
                        setTriageQueue((prev: any[]) => prev.map((t) => t.id === selectedTriage.id ? { ...t, metadata: meta } : t));
                        setTriageModalVisible(false);
                      },
                      'plain-text',
                    );
                  }}
                  style={{ flex: 1, backgroundColor: kisPalette.info + '22', borderWidth: 1, borderColor: kisPalette.info, borderRadius: 10, padding: 12, alignItems: 'center', minHeight: 44, justifyContent: 'center' }}
                >
                  <Text style={[HEALTH_THEME_TYPOGRAPHY.label, { color: kisPalette.info }]}>Reassign</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </SafeAreaView>
        </LinearGradient>
      </Modal>
    );
  };

  const renderReferralModal = () => {
    if (!selectedReferral) return null;
    const status: string = (selectedReferral.status ?? 'pending').toLowerCase();
    return (
      <Modal
        visible={referralModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setReferralModalVisible(false)}
      >
        <LinearGradient colors={[palette.gradientStart, palette.gradientEnd]} style={{ flex: 1 }}>
          <SafeAreaView style={{ flex: 1, paddingTop: 40 }}>
            <View style={modalStyles.header}>
              <Text style={[HEALTH_THEME_TYPOGRAPHY.h2, { color: palette.text, flex: 1 }]}>
                Referral detail
              </Text>
              <TouchableOpacity onPress={() => setReferralModalVisible(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <KISIcon name="close" size={22} color={palette.text} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={modalStyles.body}>
              <Text style={[HEALTH_THEME_TYPOGRAPHY.h3, { color: palette.text }]}>
                {selectedReferral.patient_name ?? selectedReferral.patientName ?? 'Patient'}
              </Text>
              <View style={{ marginVertical: 8 }}>
                <Badge label={status} color={REFERRAL_STATUS_COLORS[status] ?? kisPalette.subtext} />
              </View>
              <Text style={[sharedStyles.meta, { color: palette.subtext, marginTop: 8 }]}>
                From: {selectedReferral.from_clinician ?? selectedReferral.fromClinician ?? '—'}
              </Text>
              <Text style={[sharedStyles.meta, { color: palette.subtext, marginTop: 4 }]}>
                To: {selectedReferral.to_clinician ?? selectedReferral.toClinician ?? '—'}
              </Text>
              {selectedReferral.reason ? (
                <Text style={[HEALTH_THEME_TYPOGRAPHY.body, { color: palette.subtext, marginTop: 12 }]}>
                  Reason: {selectedReferral.reason}
                </Text>
              ) : null}
              {selectedReferral.date ?? selectedReferral.created_at ? (
                <Text style={[sharedStyles.meta, { color: palette.subtext, marginTop: 8 }]}>
                  Date: {selectedReferral.date ?? selectedReferral.created_at}
                </Text>
              ) : null}
              {selectedReferral.notes ? (
                <Text style={[HEALTH_THEME_TYPOGRAPHY.body, { color: palette.subtext, marginTop: 12 }]}>
                  {selectedReferral.notes}
                </Text>
              ) : null}
              {(selectedReferral.status ?? 'pending').toLowerCase() === 'pending' && (
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
                  <TouchableOpacity
                    onPress={async () => {
                      try {
                        await patchRequest(ROUTES.clinical.referral(String(selectedReferral.id)), { status: 'accepted' });
                        setReferrals((prev) =>
                          prev.map((r) => (r.id === selectedReferral.id ? { ...r, status: 'accepted' } : r)),
                        );
                        setSelectedReferral((prev: any) => ({ ...prev, status: 'accepted' }));
                        setReferralModalVisible(false);
                      } catch (e: any) {
                        Alert.alert('Accept referral', e?.message || 'Failed to accept referral. Please try again.');
                      }
                    }}
                    style={{ flex: 1, backgroundColor: kisPalette.success + '22', borderWidth: 1, borderColor: kisPalette.success, borderRadius: 10, padding: 12, alignItems: 'center', minHeight: 44, justifyContent: 'center' }}
                  >
                    <Text style={[HEALTH_THEME_TYPOGRAPHY.label, { color: kisPalette.success }]}>Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={async () => {
                      try {
                        await patchRequest(ROUTES.clinical.referral(String(selectedReferral.id)), { status: 'declined' });
                        setReferrals((prev) =>
                          prev.map((r) => (r.id === selectedReferral.id ? { ...r, status: 'declined' } : r)),
                        );
                        setSelectedReferral((prev: any) => ({ ...prev, status: 'declined' }));
                        setReferralModalVisible(false);
                      } catch (e: any) {
                        Alert.alert('Decline referral', e?.message || 'Failed to decline referral. Please try again.');
                      }
                    }}
                    style={{ flex: 1, backgroundColor: kisPalette.danger + '22', borderWidth: 1, borderColor: kisPalette.danger, borderRadius: 10, padding: 12, alignItems: 'center', minHeight: 44, justifyContent: 'center' }}
                  >
                    <Text style={[HEALTH_THEME_TYPOGRAPHY.label, { color: kisPalette.danger }]}>Decline</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </SafeAreaView>
        </LinearGradient>
      </Modal>
    );
  };

  // ─── root render ──────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg, }}>
      <LinearGradient colors={[palette.gradientStart, palette.gradientEnd]} style={{ flex: 1 }}>
        {/* Header */}
        <View
          style={[
            headerStyles.container,
            { borderBottomColor: palette.divider },
          ]}
        >
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={headerStyles.backButton}
            accessibilityLabel="Go back"
            hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
          >
            <KISIcon name="arrowleft" size={22} color={palette.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[HEALTH_THEME_TYPOGRAPHY.h2, { color: palette.text }]} numberOfLines={1}>
              Clinical Command Center
            </Text>
            {institutionName ? (
              <Text style={[sharedStyles.meta, { color: palette.subtext }]} numberOfLines={1}>
                {institutionName}
              </Text>
            ) : null}
          </View>
          <Text style={[sharedStyles.meta, { color: palette.subtext, marginLeft: 8 }]}>
            {formatTime(lastRefresh)}
          </Text>
        </View>

        {/* Tab bar */}
        {renderTabBar()}

        {/* Tab content */}
        <View style={{ flex: 1 }}>
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'tasks' && renderTasks()}
          {activeTab === 'escalations' && renderEscalations()}
          {activeTab === 'triage' && renderTriage()}
          {activeTab === 'referrals' && renderReferrals()}
          {activeTab === 'workflow' && renderWorkflow()}
        </View>
      </LinearGradient>

      {/* Modals */}
      {renderTaskModal()}
      {renderEscalationModal()}
      {renderTriageModal()}
      {renderReferralModal()}
    </SafeAreaView>
  );
}

// ─── styles ───────────────────────────────────────────────────────────────

const sharedStyles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  listItem: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  meta: {
    fontSize: 12,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 0,
    marginBottom: 0,
  },
});

const headerStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  backButton: {
    padding: 4,
  },
});

const tabStyles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 44,
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
  },
});

const chipStyles = StyleSheet.create({
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: 99,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
});

const triageStyles = StyleSheet.create({
  levelBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 99,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  levelText: {
    fontSize: 12,
    fontWeight: '800',
  },
});

const modalStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  body: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  actionButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
});

const workflowStyles = StyleSheet.create({
  phaseChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phaseChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  advanceButton: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
