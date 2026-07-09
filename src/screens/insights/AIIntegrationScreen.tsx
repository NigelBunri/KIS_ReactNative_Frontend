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
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { patchRequest } from '@/network/patch';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';

// ─── Types ────────────────────────────────────────────────────────────────────

type AIModel = {
  id: string;
  name?: string;
  type?: string;
  status?: 'active' | 'inactive' | string;
  description?: string;
  capabilities?: string[];
  metadata?: Record<string, any>;
};

type AIJob = {
  id: string;
  name?: string;
  type?: string;
  status?: 'pending' | 'running' | 'completed' | 'failed' | string;
  created_at?: string;
  progress?: number;
  logs?: string;
  error?: string;
  metadata?: Record<string, any>;
};

type QnASession = {
  id: string;
  question?: string;
  answer?: string;
  model_used?: string;
  created_at?: string;
  rating?: number;
  messages?: { role: string; content: string }[];
};

type Tab = 'Models' | 'Jobs' | 'QnA Sessions' | 'Schedules' | 'Pipelines';
const TABS: Tab[] = ['Models', 'Jobs', 'QnA Sessions', 'Schedules', 'Pipelines'];

// ─── Status helpers ───────────────────────────────────────────────────────────

const makeJobStatusColors = (palette: any): Record<string, string> => ({
  pending: palette.primary,
  running: palette.gold,
  completed: palette.success,
  failed: palette.danger,
});

const jobStatusColor = (status?: string, palette?: any) =>
  (palette ? makeJobStatusColors(palette) : {})[status?.toLowerCase() ?? ''] ?? palette?.subtext;

// ─── Models Tab ───────────────────────────────────────────────────────────────

function ModelsTab({ palette }: { palette: any }) {
  const responsive = useResponsiveLayout();
  const [models, setModels] = useState<AIModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getRequest(ROUTES.aiIntegration.models, {
        errorMessage: 'Unable to load AI models.',
      });
      setModels(res.data?.results ?? res.data ?? []);
    } catch (e: any) {
      setError(e?.message ?? 'Unable to load AI models.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleStatus = useCallback(async (model: AIModel) => {
    const newStatus = model.status === 'active' ? 'inactive' : 'active';
    setToggling(model.id);
    try {
      await patchRequest(`${ROUTES.aiIntegration.models}${model.id}/`, { status: newStatus });
      setModels(prev =>
        prev.map(m => m.id === model.id ? { ...m, status: newStatus } : m),
      );
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to update model status.');
    } finally {
      setToggling(null);
    }
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={palette.primaryStrong} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={{ color: palette.danger, textAlign: 'center' }}>{error}</Text>
        <Pressable onPress={load} style={[styles.retryBtn, { backgroundColor: palette.primaryStrong }]}>
          <Text style={{ color: palette.onPrimary, fontWeight: '700' }}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (models.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={{ color: palette.subtext }}>No AI models found.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={models}
      keyExtractor={item => String(item.id)}
      contentContainerStyle={[styles.listContent, { paddingHorizontal: responsive.pageGutter }]}
      renderItem={({ item }) => {
        const isActive = item.status === 'active';
        return (
          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.divider }]}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: palette.text }]} numberOfLines={1}>
                  {item.name ?? `Model ${item.id}`}
                </Text>
                {item.type ? (
                  <Text style={[styles.cardChip, { color: palette.subtext }]}>{item.type}</Text>
                ) : null}
              </View>
              <Pressable
                onPress={() => toggleStatus(item)}
                disabled={toggling === item.id}
                style={[
                  styles.statusToggle,
                  { backgroundColor: isActive ? palette.success : palette.divider },
                ]}
              >
                {toggling === item.id
                  ? <ActivityIndicator size="small" color={palette.onPrimary} />
                  : <Text style={[styles.statusToggleText, { color: palette.onPrimary }]}>{isActive ? 'Active' : 'Inactive'}</Text>
                }
              </Pressable>
            </View>
            {item.description ? (
              <Text style={[styles.cardDesc, { color: palette.subtext }]} numberOfLines={3}>
                {item.description}
              </Text>
            ) : null}
            {item.capabilities && item.capabilities.length > 0 ? (
              <View style={styles.capsRow}>
                {item.capabilities.map((cap, i) => (
                  <View key={i} style={[styles.capChip, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
                    <Text style={[styles.capChipText, { color: palette.subtext }]}>{cap}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        );
      }}
    />
  );
}

// ─── Jobs Tab ─────────────────────────────────────────────────────────────────

function JobsTab({ palette }: { palette: any }) {
  const [jobs, setJobs] = useState<AIJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AIJob | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await getRequest(ROUTES.aiIntegration.jobs, {
        errorMessage: 'Unable to load AI jobs.',
      });
      setJobs(res.data?.results ?? res.data ?? []);
    } catch (e: any) {
      setError(e?.message ?? 'Unable to load AI jobs.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={palette.primaryStrong} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={{ color: palette.danger, textAlign: 'center' }}>{error}</Text>
        <Pressable onPress={() => load()} style={[styles.retryBtn, { backgroundColor: palette.primaryStrong }]}>
          <Text style={{ color: palette.onPrimary, fontWeight: '700' }}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <>
      <FlatList
        data={jobs}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={palette.primary} />
        }
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={{ color: palette.subtext }}>No processing jobs found.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const statusColor = jobStatusColor(item.status, palette);
          return (
            <Pressable
              onPress={() => setSelected(item)}
              style={[styles.card, { backgroundColor: palette.card, borderColor: palette.divider }]}
            >
              <View style={styles.cardHeader}>
                <Text style={[styles.cardTitle, { color: palette.text, flex: 1 }]} numberOfLines={1}>
                  {item.name ?? `Job ${item.id}`}
                </Text>
                <View style={[styles.statusBadge, { backgroundColor: statusColor + '22', borderColor: statusColor }]}>
                  <Text style={[styles.statusBadgeText, { color: statusColor }]}>
                    {item.status ?? 'unknown'}
                  </Text>
                </View>
              </View>
              {item.type ? (
                <Text style={[styles.cardChip, { color: palette.subtext }]}>{item.type}</Text>
              ) : null}
              {item.progress !== undefined && item.progress !== null ? (
                <View style={styles.progressRow}>
                  <View style={[styles.progressBar, { backgroundColor: palette.divider }]}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${Math.min(100, item.progress)}%` as any, backgroundColor: statusColor },
                      ]}
                    />
                  </View>
                  <Text style={[styles.progressText, { color: palette.subtext }]}>{item.progress}%</Text>
                </View>
              ) : null}
              {item.created_at ? (
                <Text style={[styles.cardMeta, { color: palette.subtext }]}>
                  {new Date(item.created_at).toLocaleString()}
                </Text>
              ) : null}
            </Pressable>
          );
        }}
      />

      {/* Job Detail Modal */}
      <Modal
        visible={!!selected}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelected(null)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg, paddingTop: 40 }}>
          <View style={[styles.modalHeader, { borderBottomColor: palette.divider }]}>
            <Text style={[styles.modalTitle, { color: palette.text }]} numberOfLines={1}>
              {selected?.name ?? `Job ${selected?.id}`}
            </Text>
            <Pressable onPress={() => setSelected(null)} style={styles.modalClose}>
              <Text style={{ color: palette.primaryStrong, fontWeight: '700', fontSize: 16 }}>Done</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            {selected ? (
              <>
                <DetailRow label="ID" value={selected.id} palette={palette} />
                <DetailRow label="Type" value={selected.type} palette={palette} />
                <DetailRow label="Status" value={selected.status} palette={palette} />
                <DetailRow
                  label="Progress"
                  value={selected.progress !== undefined ? `${selected.progress}%` : undefined}
                  palette={palette}
                />
                <DetailRow
                  label="Created"
                  value={selected.created_at ? new Date(selected.created_at).toLocaleString() : undefined}
                  palette={palette}
                />
                {selected.error ? (
                  <View style={[styles.logBox, { backgroundColor: palette.dangerSoft, borderColor: palette.danger }]}>
                    <Text style={[styles.logLabel, { color: palette.danger }]}>Error</Text>
                    <Text style={{ color: palette.danger, fontSize: 13 }}>{selected.error}</Text>
                  </View>
                ) : null}
                {selected.logs ? (
                  <View style={[styles.logBox, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
                    <Text style={[styles.logLabel, { color: palette.subtext }]}>Logs</Text>
                    <Text style={{ color: palette.text, fontSize: 12, fontFamily: 'monospace' }}>{selected.logs}</Text>
                  </View>
                ) : null}
              </>
            ) : null}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

// ─── QnA Sessions Tab ─────────────────────────────────────────────────────────

function QnASessionsTab({ palette }: { palette: any }) {
  const [sessions, setSessions] = useState<QnASession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<QnASession | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newQuestion, setNewQuestion] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getRequest(ROUTES.aiIntegration.qnaSessions, {
        errorMessage: 'Unable to load QnA sessions.',
      });
      setSessions(res.data?.results ?? res.data ?? []);
    } catch (e: any) {
      setError(e?.message ?? 'Unable to load QnA sessions.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const submitNewSession = useCallback(async () => {
    if (!newQuestion.trim()) return;
    setSubmitting(true);
    try {
      await postRequest(ROUTES.aiIntegration.qnaSessions, { question: newQuestion.trim() });
      setNewQuestion('');
      setShowNew(false);
      load();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to start QnA session.');
    } finally {
      setSubmitting(false);
    }
  }, [newQuestion, load]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={palette.primaryStrong} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={{ color: palette.danger, textAlign: 'center' }}>{error}</Text>
        <Pressable onPress={load} style={[styles.retryBtn, { backgroundColor: palette.primaryStrong }]}>
          <Text style={{ color: palette.onPrimary, fontWeight: '700' }}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <>
      <FlatList
        data={sessions}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={{ color: palette.subtext }}>No QnA sessions yet.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => setSelected(item)}
            style={[styles.card, { backgroundColor: palette.card, borderColor: palette.divider }]}
          >
            <Text style={[styles.cardTitle, { color: palette.text }]} numberOfLines={2}>
              {item.question ?? 'No question'}
            </Text>
            {item.answer ? (
              <Text style={[styles.cardDesc, { color: palette.subtext }]} numberOfLines={2}>
                {item.answer}
              </Text>
            ) : null}
            <View style={styles.cardFooter}>
              {item.model_used ? (
                <View style={[styles.capChip, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
                  <Text style={[styles.capChipText, { color: palette.subtext }]}>{item.model_used}</Text>
                </View>
              ) : null}
              {item.rating !== undefined && item.rating !== null ? (
                <Text style={[styles.cardMeta, { color: palette.subtext }]}>Rating: {item.rating}</Text>
              ) : null}
              {item.created_at ? (
                <Text style={[styles.cardMeta, { color: palette.subtext }]}>
                  {new Date(item.created_at).toLocaleDateString()}
                </Text>
              ) : null}
            </View>
          </Pressable>
        )}
      />

      {/* FAB – New Session */}
      <Pressable
        onPress={() => setShowNew(true)}
        style={[styles.fab, { backgroundColor: palette.primaryStrong, shadowColor: palette.royalInk }]}
      >
        <Text style={[styles.fabText, { color: palette.onPrimary }]}>+ New Session</Text>
      </Pressable>

      {/* New Session Modal */}
      <Modal
        visible={showNew}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowNew(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg, paddingTop: 40 }}>
          <View style={[styles.modalHeader, { borderBottomColor: palette.divider }]}>
            <Text style={[styles.modalTitle, { color: palette.text }]}>New QnA Session</Text>
            <Pressable onPress={() => setShowNew(false)} style={styles.modalClose}>
              <Text style={{ color: palette.primaryStrong, fontWeight: '700', fontSize: 16 }}>Cancel</Text>
            </Pressable>
          </View>
          <View style={styles.modalContent}>
            <Text style={[styles.fieldLabel, { color: palette.subtext }]}>Your question</Text>
            <TextInput
              style={[styles.textArea, { backgroundColor: palette.surface, borderColor: palette.divider, color: palette.text }]}
              multiline
              numberOfLines={5}
              placeholder="Ask anything..."
              placeholderTextColor={palette.subtext}
              value={newQuestion}
              onChangeText={setNewQuestion}
              textAlignVertical="top"
            />
            <Pressable
              onPress={submitNewSession}
              disabled={submitting || !newQuestion.trim()}
              style={[
                styles.submitBtn,
                { backgroundColor: newQuestion.trim() ? palette.primaryStrong : palette.divider },
              ]}
            >
              {submitting
                ? <ActivityIndicator color={palette.onPrimary} />
                : <Text style={[styles.submitBtnText, { color: palette.onPrimary }]}>Start Session</Text>
              }
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Session Detail Modal */}
      <Modal
        visible={!!selected}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelected(null)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg, paddingTop: 40 }}>
          <View style={[styles.modalHeader, { borderBottomColor: palette.divider }]}>
            <Text style={[styles.modalTitle, { color: palette.text }]}>Session Detail</Text>
            <Pressable onPress={() => setSelected(null)} style={styles.modalClose}>
              <Text style={{ color: palette.primaryStrong, fontWeight: '700', fontSize: 16 }}>Done</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            {selected ? (
              <>
                <DetailRow label="Model" value={selected.model_used} palette={palette} />
                <DetailRow label="Rating" value={selected.rating !== undefined ? String(selected.rating) : undefined} palette={palette} />
                <DetailRow
                  label="Date"
                  value={selected.created_at ? new Date(selected.created_at).toLocaleString() : undefined}
                  palette={palette}
                />
                <View style={[styles.qaBlock, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
                  <Text style={[styles.qaRole, { color: palette.primaryStrong }]}>Question</Text>
                  <Text style={[styles.qaText, { color: palette.text }]}>{selected.question ?? '—'}</Text>
                </View>
                <View style={[styles.qaBlock, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
                  <Text style={[styles.qaRole, { color: palette.success }]}>Answer</Text>
                  <Text style={[styles.qaText, { color: palette.text }]}>{selected.answer ?? '—'}</Text>
                </View>
                {selected.messages && selected.messages.length > 0 ? (
                  <>
                    <Text style={[styles.sectionLabel, { color: palette.text }]}>Full Thread</Text>
                    {selected.messages.map((msg, i) => (
                      <View
                        key={i}
                        style={[
                          styles.qaBlock,
                          { backgroundColor: palette.surface, borderColor: palette.divider },
                        ]}
                      >
                        <Text style={[styles.qaRole, { color: msg.role === 'user' ? palette.primaryStrong : palette.success }]}>
                          {msg.role}
                        </Text>
                        <Text style={[styles.qaText, { color: palette.text }]}>{msg.content}</Text>
                      </View>
                    ))}
                  </>
                ) : null}
              </>
            ) : null}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

// ─── Schedules Tab ────────────────────────────────────────────────────────────

type AISchedule = {
  id: string;
  name?: string;
  cron?: string;
  model_id?: string;
  status?: 'active' | 'inactive' | string;
  next_run?: string;
  last_run?: string;
};

function SchedulesTab({ palette }: { palette: any }) {
  const [schedules, setSchedules] = useState<AISchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCron, setNewCron] = useState('');
  const [newModelId, setNewModelId] = useState('');

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError(null);
    try {
      const res = await getRequest(ROUTES.aiIntegration.schedules, { errorMessage: 'Unable to load schedules.' });
      if (res.success) {
        setSchedules(res.data?.results ?? res.data ?? []);
      } else {
        setError(res.message || 'Unable to load schedules.');
      }
    } catch (e: any) {
      setError(e?.message || 'Unable to load schedules.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!newName.trim()) { Alert.alert('Validation', 'Name is required.'); return; }
    if (!newCron.trim()) { Alert.alert('Validation', 'Cron expression is required.'); return; }
    setSaving(true);
    try {
      const res = await postRequest(ROUTES.aiIntegration.schedules, { name: newName.trim(), cron: newCron.trim(), model_id: newModelId.trim() || undefined }, { errorMessage: 'Failed to create schedule.' });
      if (res.success) {
        setShowModal(false);
        setNewName(''); setNewCron(''); setNewModelId('');
        load();
      } else {
        Alert.alert('Error', res.message || 'Failed to create schedule.');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to create schedule.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (item: AISchedule) => {
    try {
      await patchRequest(ROUTES.aiIntegration.schedule(item.id), { status: item.status === 'active' ? 'inactive' : 'active' }, { errorMessage: 'Failed to update.' });
      load(true);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to update.');
    }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={palette.primaryStrong} /></View>;
  }
  if (error) {
    return (
      <View style={styles.center}>
        <Text style={{ color: palette.danger }}>{error}</Text>
        <Pressable onPress={() => load()} style={[styles.retryBtn, { backgroundColor: palette.primaryStrong }]}>
          <Text style={{ color: palette.onPrimary, fontWeight: '600' }}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <>
      <FlatList
        data={schedules}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} />}
        ListEmptyComponent={<View style={styles.center}><Text style={{ color: palette.subtext }}>No schedules yet.</Text></View>}
        ListFooterComponent={
          <Pressable onPress={() => setShowModal(true)} style={[styles.card, { backgroundColor: palette.primaryWeak, borderColor: palette.primaryStrong, alignItems: 'center' }]}>
            <Text style={{ color: palette.primaryStrong, fontWeight: '700', fontSize: 14 }}>+ New Schedule</Text>
          </Pressable>
        }
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.divider }]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: palette.text, flex: 1 }]}>{item.name ?? item.id}</Text>
              <Pressable onPress={() => handleToggle(item)} style={[styles.statusToggle, { backgroundColor: item.status === 'active' ? palette.success + '22' : palette.divider }]}>
                <Text style={[styles.cardChip, { color: item.status === 'active' ? palette.success : palette.subtext }]}>{item.status ?? 'inactive'}</Text>
              </Pressable>
            </View>
            {!!item.cron && <Text style={[styles.cardMeta, { color: palette.subtext }]}>Cron: {item.cron}</Text>}
            {!!item.next_run && <Text style={[styles.cardMeta, { color: palette.subtext }]}>Next: {item.next_run}</Text>}
            {!!item.last_run && <Text style={[styles.cardMeta, { color: palette.subtext }]}>Last: {item.last_run}</Text>}
          </View>
        )}
      />
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View style={{ backgroundColor: palette.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, gap: 14 }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: palette.text }}>New Schedule</Text>
            <TextInput placeholder="Name" placeholderTextColor={palette.subtext} value={newName} onChangeText={setNewName} style={{ borderWidth: 1, borderColor: palette.divider, borderRadius: 10, padding: 12, color: palette.text, backgroundColor: palette.inputBg }} />
            <TextInput placeholder="Cron (e.g. 0 9 * * 1)" placeholderTextColor={palette.subtext} value={newCron} onChangeText={setNewCron} style={{ borderWidth: 1, borderColor: palette.divider, borderRadius: 10, padding: 12, color: palette.text, backgroundColor: palette.inputBg }} />
            <TextInput placeholder="Model ID (optional)" placeholderTextColor={palette.subtext} value={newModelId} onChangeText={setNewModelId} style={{ borderWidth: 1, borderColor: palette.divider, borderRadius: 10, padding: 12, color: palette.text, backgroundColor: palette.inputBg }} />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable onPress={() => setShowModal(false)} style={[styles.retryBtn, { flex: 1, backgroundColor: palette.divider, alignItems: 'center' }]}>
                <Text style={{ color: palette.text, fontWeight: '600' }}>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleCreate} disabled={saving} style={[styles.retryBtn, { flex: 1, backgroundColor: palette.primaryStrong, alignItems: 'center' }]}>
                <Text style={{ color: palette.onPrimary, fontWeight: '600' }}>{saving ? 'Saving…' : 'Create'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

// ─── Pipelines Tab ────────────────────────────────────────────────────────────

type AIPipeline = {
  id: string;
  name?: string;
  description?: string;
  steps?: any[];
  status?: string;
};

function PipelinesTab({ palette }: { palette: any }) {
  const [pipelines, setPipelines] = useState<AIPipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError(null);
    try {
      const res = await getRequest(ROUTES.aiIntegration.pipelines, { errorMessage: 'Unable to load pipelines.' });
      if (res.success) {
        setPipelines(res.data?.results ?? res.data ?? []);
      } else {
        setError(res.message || 'Unable to load pipelines.');
      }
    } catch (e: any) {
      setError(e?.message || 'Unable to load pipelines.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!newName.trim()) { Alert.alert('Validation', 'Name is required.'); return; }
    setSaving(true);
    try {
      const res = await postRequest(ROUTES.aiIntegration.pipelines, { name: newName.trim(), description: newDesc.trim() || undefined }, { errorMessage: 'Failed to create pipeline.' });
      if (res.success) {
        setShowModal(false);
        setNewName(''); setNewDesc('');
        load();
      } else {
        Alert.alert('Error', res.message || 'Failed to create pipeline.');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to create pipeline.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={palette.primaryStrong} /></View>;
  }
  if (error) {
    return (
      <View style={styles.center}>
        <Text style={{ color: palette.danger }}>{error}</Text>
        <Pressable onPress={() => load()} style={[styles.retryBtn, { backgroundColor: palette.primaryStrong }]}>
          <Text style={{ color: palette.onPrimary, fontWeight: '600' }}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <>
      <FlatList
        data={pipelines}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} />}
        ListEmptyComponent={<View style={styles.center}><Text style={{ color: palette.subtext }}>No pipelines yet.</Text></View>}
        ListFooterComponent={
          <Pressable onPress={() => setShowModal(true)} style={[styles.card, { backgroundColor: palette.primaryWeak, borderColor: palette.primaryStrong, alignItems: 'center' }]}>
            <Text style={{ color: palette.primaryStrong, fontWeight: '700', fontSize: 14 }}>+ New Pipeline</Text>
          </Pressable>
        }
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.divider }]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: palette.text, flex: 1 }]}>{item.name ?? item.id}</Text>
              {!!item.status && (
                <View style={{ backgroundColor: palette.primaryWeak, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 2 }}>
                  <Text style={[styles.cardChip, { color: palette.primaryStrong }]}>{item.status}</Text>
                </View>
              )}
            </View>
            {!!item.description && <Text style={[styles.cardDesc, { color: palette.subtext }]}>{item.description}</Text>}
            {Array.isArray(item.steps) && (
              <Text style={[styles.cardMeta, { color: palette.subtext }]}>{item.steps.length} step{item.steps.length !== 1 ? 's' : ''}</Text>
            )}
          </View>
        )}
      />
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View style={{ backgroundColor: palette.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, gap: 14 }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: palette.text }}>New Pipeline</Text>
            <TextInput placeholder="Name" placeholderTextColor={palette.subtext} value={newName} onChangeText={setNewName} style={{ borderWidth: 1, borderColor: palette.divider, borderRadius: 10, padding: 12, color: palette.text, backgroundColor: palette.inputBg }} />
            <TextInput placeholder="Description (optional)" placeholderTextColor={palette.subtext} value={newDesc} onChangeText={setNewDesc} multiline numberOfLines={3} style={{ borderWidth: 1, borderColor: palette.divider, borderRadius: 10, padding: 12, color: palette.text, backgroundColor: palette.inputBg, height: 80 }} />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable onPress={() => setShowModal(false)} style={[styles.retryBtn, { flex: 1, backgroundColor: palette.divider, alignItems: 'center' }]}>
                <Text style={{ color: palette.text, fontWeight: '600' }}>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleCreate} disabled={saving} style={[styles.retryBtn, { flex: 1, backgroundColor: palette.primaryStrong, alignItems: 'center' }]}>
                <Text style={{ color: palette.onPrimary, fontWeight: '600' }}>{saving ? 'Saving…' : 'Create'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function DetailRow({ label, value, palette }: { label: string; value?: string; palette: any }) {
  if (!value) return null;
  return (
    <View style={[styles.detailRow, { borderBottomColor: palette.divider }]}>
      <Text style={[styles.detailLabel, { color: palette.subtext }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: palette.text }]}>{value}</Text>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function AIIntegrationScreen() {
  const { palette } = useKISTheme();
  const [activeTab, setActiveTab] = useState<Tab>('Models');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg, }} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: palette.divider }]}>
        <Text style={[styles.screenTitle, { color: palette.text }]}>AI Integration</Text>
        <Text style={[styles.screenSubtitle, { color: palette.subtext }]}>
          Models, processing jobs, and Q&A sessions.
        </Text>
      </View>

      {/* Tab bar */}
      <View style={[styles.tabBar, { borderBottomColor: palette.divider }]}>
        {TABS.map(tab => (
          <Pressable
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[
              styles.tabItem,
              activeTab === tab && [styles.tabItemActive, { borderBottomColor: palette.primaryStrong }],
            ]}
          >
            <Text
              style={[
                styles.tabLabel,
                { color: activeTab === tab ? palette.primaryStrong : palette.subtext },
              ]}
            >
              {tab}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Tab content */}
      <View style={{ flex: 1 }}>
        {activeTab === 'Models' && <ModelsTab palette={palette} />}
        {activeTab === 'Jobs' && <JobsTab palette={palette} />}
        {activeTab === 'QnA Sessions' && <QnASessionsTab palette={palette} />}
        {activeTab === 'Schedules' && <SchedulesTab palette={palette} />}
        {activeTab === 'Pipelines' && <PipelinesTab palette={palette} />}
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  screenTitle: { fontSize: 22, fontWeight: '800', marginBottom: 2 },
  screenSubtitle: { fontSize: 13 },

  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {},
  tabLabel: { fontSize: 13, fontWeight: '600' },

  listContent: { padding: 16, gap: 12, paddingBottom: 100 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },

  card: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 8 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  cardChip: { fontSize: 12 },
  cardDesc: { fontSize: 13, lineHeight: 18 },
  cardMeta: { fontSize: 12 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },

  statusToggle: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 20,
    minWidth: 72,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusToggleText: { fontSize: 12, fontWeight: '700' },

  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusBadgeText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },

  capsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  capChip: { borderRadius: 6, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2 },
  capChipText: { fontSize: 11 },

  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressBar: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 4, borderRadius: 2 },
  progressText: { fontSize: 11, minWidth: 32, textAlign: 'right' },

  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 28,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 4,
  },
  fabText: { fontWeight: '700', fontSize: 14 },

  // Modal
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', flex: 1 },
  modalClose: { paddingLeft: 12, paddingVertical: 10, minHeight: 44, justifyContent: 'center' },
  modalContent: { padding: 20, gap: 12 },

  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  detailLabel: { fontSize: 13, fontWeight: '600', minWidth: 80 },
  detailValue: { fontSize: 13, flex: 1, textAlign: 'right' },

  logBox: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    gap: 6,
    marginTop: 8,
  },
  logLabel: { fontSize: 12, fontWeight: '700' },

  qaBlock: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 14,
    gap: 6,
  },
  qaRole: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  qaText: { fontSize: 14, lineHeight: 20 },

  sectionLabel: { fontSize: 15, fontWeight: '700', marginTop: 8 },

  fieldLabel: { fontSize: 13, fontWeight: '600', marginBottom: 4 },
  textArea: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    fontSize: 15,
    minHeight: 120,
  },
  submitBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnText: { fontWeight: '700', fontSize: 15 },
});
