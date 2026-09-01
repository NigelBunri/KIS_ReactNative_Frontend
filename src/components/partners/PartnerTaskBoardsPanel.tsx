// src/components/partners/PartnerTaskBoardsPanel.tsx
//
// "Task Boards" — the admin-wide view of every task across every channel
// in the organization (the per-channel board lives in PartnerTasksPanel.tsx,
// opened from a channel's own chat header; this is the cross-channel
// overview reached from Settings > General Tools > Task Boards). Same
// backend model/API as PartnerTasksPanel: the admin-only list endpoint
// (GET /api/v1/partners/:id/tasks/, no channel_id) for the board, plus
// the same per-channel create endpoint PartnerTasksPanel uses
// (POST /api/v1/partners/:id/channels/:channelId/tasks/ — task creation
// always requires a channel, enforced server-side in
// apps.tasks.views.TaskChannelListCreateView.post) for the create form
// here, with a channel picker since this view isn't scoped to one
// channel. Status changes, reassignment, comments, activity, and the
// assignee's own start-work/submit-report flow all behave identically
// to PartnerTasksPanel once you're looking at one task's detail.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Linking,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import DocumentPicker, { DocumentPickerResponse } from 'react-native-document-picker';
import styles from '@/components/partners/partnersStyles';
import { useKISTheme } from '@/theme/useTheme';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { uploadTaskReportMedia, TaskReportUploadProgress } from '@/services/uploadTaskReportMedia';

type ChannelOption = { id: string; name: string };

type Props = {
  isOpen: boolean;
  panelWidth: number;
  panelTranslateX: Animated.Value;
  partnerId?: string | null;
  channels?: ChannelOption[];
  currentUserId?: string | null;
  canManageTasks?: boolean;
  onClose: () => void;
};

type TaskStatusValue =
  | 'not_started' | 'in_progress' | 'submitted' | 'under_review'
  | 'reviewed_pending' | 'completed' | 'not_completed' | 'redo';
type TaskPriorityValue = 'low' | 'medium' | 'high' | 'urgent';

type UserSummary = { id: string; display_name: string; avatar_url: string | null };
type TaskRow = {
  id: string;
  channel: string;
  channel_name: string;
  title: string;
  status: TaskStatusValue;
  priority: TaskPriorityValue;
  assigned_to: UserSummary | null;
  created_by: UserSummary | null;
  due_at: string | null;
  attachment_count: number;
  comment_count: number;
  is_overdue: boolean;
};
type TaskAttachment = {
  id: string; kind: 'reference' | 'report'; uploaded_by: UserSummary | null;
  file_name: string; file_url: string | null; mime_type: string; size_bytes: number; created_at: string;
};
type TaskComment = { id: string; author: UserSummary | null; body: string; created_at: string };
type TaskActivity = {
  id: string; event_type: string; actor: UserSummary | null;
  from_status: TaskStatusValue | null; to_status: TaskStatusValue | null;
  from_assignee: UserSummary | null; to_assignee: UserSummary | null; note: string; created_at: string;
};
type TaskDetail = TaskRow & {
  description: string; review_note: string;
  started_at: string | null; submitted_at: string | null; reviewed_at: string | null; completed_at: string | null;
  attachments: TaskAttachment[]; comments: TaskComment[]; activity: TaskActivity[];
};
type MemberOption = { user_id: string; display_name?: string | null; username?: string | null };

const STATUS_META: Record<TaskStatusValue, { label: string; color: (p: any) => string }> = {
  not_started: { label: 'Not started', color: (p) => p.subtext },
  in_progress: { label: 'In progress', color: (p) => p.info },
  submitted: { label: 'Submitted', color: (p) => p.info },
  under_review: { label: 'Under review', color: (p) => p.warning },
  reviewed_pending: { label: 'Reviewed (pending)', color: (p) => p.warning },
  completed: { label: 'Completed', color: (p) => p.success },
  not_completed: { label: 'Not completed', color: (p) => p.danger },
  redo: { label: 'Redo', color: (p) => p.danger },
};
const PRIORITY_META: Record<TaskPriorityValue, { label: string; color: (p: any) => string }> = {
  low: { label: 'Low', color: (p) => p.subtext },
  medium: { label: 'Medium', color: (p) => p.info },
  high: { label: 'High', color: (p) => p.warning },
  urgent: { label: 'Urgent', color: (p) => p.danger },
};
const ADMIN_STATUS_ACTIONS: { status: TaskStatusValue; label: string }[] = [
  { status: 'under_review', label: 'Mark under review' },
  { status: 'reviewed_pending', label: 'Mark reviewed (pending)' },
  { status: 'completed', label: 'Mark completed' },
  { status: 'not_completed', label: 'Mark not completed' },
  { status: 'redo', label: 'Send back for redo' },
];
const UNDOABLE: TaskStatusValue[] = ['submitted', 'under_review', 'reviewed_pending', 'completed', 'not_completed', 'redo'];
const STATUS_FILTERS: (TaskStatusValue | 'all')[] = [
  'all', 'not_started', 'in_progress', 'submitted', 'under_review', 'reviewed_pending', 'completed', 'not_completed', 'redo',
];
const MEMBER_STARTABLE: TaskStatusValue[] = ['not_started', 'redo'];
const MEMBER_SUBMITTABLE: TaskStatusValue[] = ['not_started', 'in_progress', 'redo'];

const formatDate = (iso?: string | null) => {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return null;
  }
};
const formatBytes = (n: number) => {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

function StatusBadge({ status, palette }: { status: TaskStatusValue; palette: any }) {
  const meta = STATUS_META[status] ?? STATUS_META.not_started;
  const color = meta.color(palette);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: color, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
      <Text style={{ color, fontSize: 11, fontWeight: '700' }}>{meta.label}</Text>
    </View>
  );
}
function PriorityBadge({ priority, palette }: { priority: TaskPriorityValue; palette: any }) {
  const meta = PRIORITY_META[priority] ?? PRIORITY_META.medium;
  return <Text style={{ color: meta.color(palette), fontSize: 11, fontWeight: '700' }}>{meta.label}</Text>;
}
function UserChip({ user, palette, fallback = 'Unassigned' }: { user: UserSummary | null; palette: any; fallback?: string }) {
  if (!user) return <Text style={{ color: palette.subtext, fontSize: 12 }}>{fallback}</Text>;
  const initial = (user.display_name || '?').trim().charAt(0).toUpperCase();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.borderMuted, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: palette.text, fontSize: 10, fontWeight: '700' }}>{initial}</Text>
      </View>
      <Text style={{ color: palette.text, fontSize: 12 }} numberOfLines={1}>{user.display_name}</Text>
    </View>
  );
}
function GhostButton({ label, onPress, disabled, palette, tone }: { label: string; onPress: () => void; disabled?: boolean; palette: any; tone?: string }) {
  const color = tone ?? palette.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1.5, borderColor: color, opacity: pressed || disabled ? 0.5 : 1 }]}
    >
      <Text style={{ color, fontWeight: '700', fontSize: 12 }}>{label}</Text>
    </Pressable>
  );
}
function PrimaryButton({ label, onPress, disabled, palette }: { label: string; onPress: () => void; disabled?: boolean; palette: any }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [{ paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, backgroundColor: palette.royalInk, alignItems: 'center', opacity: pressed || disabled ? 0.6 : 1 }]}
    >
      <Text style={{ color: palette.ivory, fontWeight: '700', fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

export default function PartnerTaskBoardsPanel({
  isOpen, panelWidth, panelTranslateX, partnerId, channels, currentUserId, canManageTasks, onClose,
}: Props) {
  const { palette } = useKISTheme();
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [statusFilter, setStatusFilter] = useState<TaskStatusValue | 'all'>('all');
  const [channelFilter, setChannelFilter] = useState<string | null>(null);
  const [members, setMembers] = useState<MemberOption[]>([]);

  const [showCreate, setShowCreate] = useState(false);
  const [newChannelId, setNewChannelId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPriority, setNewPriority] = useState<TaskPriorityValue>('medium');
  const [newAssigneeId, setNewAssigneeId] = useState<string | null>(null);
  const [newDueAt, setNewDueAt] = useState('');
  const [creating, setCreating] = useState(false);

  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showAssignPicker, setShowAssignPicker] = useState(false);
  const [reviewNote, setReviewNote] = useState('');
  const [commentBody, setCommentBody] = useState('');
  const [postingComment, setPostingComment] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [submitNote, setSubmitNote] = useState('');
  const [pickedFiles, setPickedFiles] = useState<DocumentPickerResponse[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<string, TaskReportUploadProgress>>({});
  const [submitting, setSubmitting] = useState(false);
  const [busy, setBusy] = useState(false);

  const backdropOpacity = panelTranslateX.interpolate({ inputRange: [0, panelWidth], outputRange: [1, 0], extrapolate: 'clamp' });

  const channelOptions = useMemo(() => {
    const map = new Map<string, string>();
    tasks.forEach((t) => { if (t.channel && t.channel_name) map.set(t.channel, t.channel_name); });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [tasks]);

  const createChannelOptions: ChannelOption[] = channels ?? [];

  const loadBoard = useCallback(async () => {
    if (!partnerId) return;
    const params = new URLSearchParams();
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (channelFilter) params.set('channel_id', channelFilter);
    const qs = params.toString();
    const [listRes, summaryRes] = await Promise.all([
      getRequest(`${ROUTES.partners.allTasks(partnerId)}${qs ? `?${qs}` : ''}`, { errorMessage: 'Unable to load tasks.' }),
      getRequest(ROUTES.partners.taskSummary(partnerId), { errorMessage: 'Unable to load task summary.' }),
    ]);
    const listPayload = listRes?.data ?? listRes ?? {};
    setTasks(Array.isArray(listPayload.tasks) ? listPayload.tasks : []);
    const summaryPayload = summaryRes?.data ?? summaryRes ?? {};
    setCounts(summaryPayload.counts ?? {});
  }, [partnerId, statusFilter, channelFilter]);

  const loadMembers = useCallback(async () => {
    if (!partnerId) return;
    const res = await getRequest(`${ROUTES.partners.members(partnerId)}?page=1`, { errorMessage: 'Unable to load members.' });
    const payload = res?.data ?? res ?? {};
    const results = (payload.results ?? payload.members ?? []) as MemberOption[];
    setMembers(Array.isArray(results) ? results : []);
  }, [partnerId]);

  useEffect(() => {
    if (!isOpen) {
      setView('list');
      setDetail(null);
      setShowCreate(false);
      return;
    }
    setLoading(true);
    Promise.all([loadBoard(), loadMembers()]).finally(() => setLoading(false));
  }, [isOpen, loadBoard, loadMembers]);

  const loadDetail = useCallback(async (taskId: string) => {
    setDetailLoading(true);
    const res = await getRequest(ROUTES.tasks.detail(taskId), { errorMessage: 'Unable to load task.' });
    setDetailLoading(false);
    if (!res?.success) {
      Alert.alert('Failed', res?.message ?? 'Unable to load task.');
      return;
    }
    setDetail((res.data ?? res) as TaskDetail);
  }, []);

  const openTask = (taskId: string) => {
    setView('detail');
    setShowAssignPicker(false);
    setReviewNote('');
    setCommentBody('');
    setSubmitNote('');
    setPickedFiles([]);
    setUploadProgress({});
    setShowActivity(false);
    loadDetail(taskId);
  };

  const backToList = () => {
    setView('list');
    setDetail(null);
    loadBoard();
  };

  const memberName = (m: MemberOption) => m.display_name || m.username || 'Member';

  const createTask = async () => {
    if (!partnerId || !newChannelId || !newTitle.trim()) {
      Alert.alert('Missing info', 'Channel and task title are required.');
      return;
    }
    setCreating(true);
    const body: Record<string, unknown> = {
      title: newTitle.trim(),
      description: newDescription.trim(),
      priority: newPriority,
    };
    if (newAssigneeId) body.assigned_to_id = newAssigneeId;
    if (newDueAt.trim()) {
      const parsed = new Date(newDueAt.trim());
      if (!Number.isNaN(parsed.getTime())) body.due_at = parsed.toISOString();
    }
    const res = await postRequest(ROUTES.partners.channelTasks(partnerId, newChannelId), body, { errorMessage: 'Unable to create task.' });
    setCreating(false);
    if (!res?.success) {
      Alert.alert('Failed', res?.message ?? 'Unable to create task.');
      return;
    }
    setNewChannelId(null);
    setNewTitle('');
    setNewDescription('');
    setNewPriority('medium');
    setNewAssigneeId(null);
    setNewDueAt('');
    setShowCreate(false);
    loadBoard();
  };

  const startWork = async () => {
    if (!detail) return;
    setBusy(true);
    const res = await postRequest(ROUTES.tasks.status(detail.id), { status: 'in_progress' }, { errorMessage: 'Unable to start work.' });
    setBusy(false);
    if (!res?.success) {
      Alert.alert('Failed', res?.message ?? 'Unable to start work.');
      return;
    }
    setDetail(res.data ?? res);
  };

  const pickReportFiles = async () => {
    try {
      const result = await DocumentPicker.pick({ type: [DocumentPicker.types.allFiles], allowMultiSelection: true, copyTo: 'cachesDirectory' });
      const arr = Array.isArray(result) ? result : [result];
      setPickedFiles((prev) => [...prev, ...arr]);
    } catch (err: any) {
      if (DocumentPicker.isCancel(err)) return;
      Alert.alert('Unable to pick file', 'Please try again.');
    }
  };

  const removePickedFile = (uri: string) => setPickedFiles((prev) => prev.filter((f) => f.uri !== uri));

  const submitReport = async () => {
    if (!detail) return;
    setSubmitting(true);
    try {
      const assetIds: string[] = [];
      for (const file of pickedFiles) {
        const meta = await uploadTaskReportMedia({
          taskId: detail.id,
          file: { uri: file.fileCopyUri || file.uri, name: file.name, type: file.type, size: file.size },
          onProgress: (p) => setUploadProgress((prev) => ({ ...prev, [file.uri]: p })),
        });
        assetIds.push(meta.mediaId);
      }
      const res = await postRequest(ROUTES.tasks.submit(detail.id), { note: submitNote.trim(), asset_ids: assetIds }, { errorMessage: 'Unable to submit report.' });
      if (!res?.success) {
        Alert.alert('Failed', res?.message ?? 'Unable to submit report.');
        return;
      }
      setDetail(res.data ?? res);
      setSubmitNote('');
      setPickedFiles([]);
      setUploadProgress({});
      Alert.alert('Submitted', 'Your report has been submitted for review.');
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        Alert.alert('Upload failed', err?.message ?? 'Unable to submit report.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const changeStatus = async (status: TaskStatusValue) => {
    if (!detail) return;
    setBusy(true);
    const res = await postRequest(ROUTES.tasks.status(detail.id), { status, note: reviewNote.trim() }, { errorMessage: 'Unable to update status.' });
    setBusy(false);
    if (!res?.success) {
      Alert.alert('Failed', res?.message ?? 'Unable to update status.');
      return;
    }
    setReviewNote('');
    setDetail(res.data ?? res);
  };

  const undoStatus = async () => {
    if (!detail) return;
    setBusy(true);
    const res = await postRequest(ROUTES.tasks.undo(detail.id), {}, { errorMessage: 'Unable to undo.' });
    setBusy(false);
    if (!res?.success) {
      Alert.alert('Failed', res?.message ?? 'Unable to undo.');
      return;
    }
    setDetail(res.data ?? res);
  };

  const reassign = async (userId: string | null) => {
    if (!detail) return;
    setBusy(true);
    const res = await postRequest(ROUTES.tasks.assign(detail.id), { assigned_to_id: userId }, { errorMessage: 'Unable to reassign task.' });
    setBusy(false);
    setShowAssignPicker(false);
    if (!res?.success) {
      Alert.alert('Failed', res?.message ?? 'Unable to reassign task.');
      return;
    }
    setDetail(res.data ?? res);
  };

  const deleteTask = () => {
    if (!detail) return;
    Alert.alert('Delete task?', `"${detail.title}" will be permanently removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { deleteRequest } = await import('@/network/delete');
          const res = await deleteRequest(ROUTES.tasks.detail(detail.id), { errorMessage: 'Unable to delete task.' });
          if (!res?.success) {
            Alert.alert('Failed', res?.message ?? 'Unable to delete task.');
            return;
          }
          backToList();
        },
      },
    ]);
  };

  const postComment = async () => {
    if (!detail || !commentBody.trim()) return;
    setPostingComment(true);
    const res = await postRequest(ROUTES.tasks.comments(detail.id), { body: commentBody.trim() }, { errorMessage: 'Unable to post comment.' });
    setPostingComment(false);
    if (!res?.success) {
      Alert.alert('Failed', res?.message ?? 'Unable to post comment.');
      return;
    }
    setCommentBody('');
    loadDetail(detail.id);
  };

  const summaryTiles = useMemo(() => {
    const order: TaskStatusValue[] = ['not_started', 'in_progress', 'submitted', 'under_review', 'reviewed_pending', 'completed', 'not_completed', 'redo'];
    return order.map((s) => ({ status: s, label: STATUS_META[s].label, value: counts[s] ?? 0 }));
  }, [counts]);

  const isAssignee = !!(detail && currentUserId && detail.assigned_to?.id === currentUserId);

  if (!isOpen) return null;

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
          <Pressable onPress={view === 'detail' ? backToList : onClose} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            <Text style={{ color: palette.text, fontSize: 18 }}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingsPanelTitle, { color: palette.text }]}>{view === 'list' ? 'Task Boards' : (detail?.title ?? 'Task')}</Text>
            <Text style={[styles.settingsPanelDescription, { color: palette.subtext }]}>
              {view === 'list' ? 'Every task across every channel' : detail?.channel_name ? `#${detail.channel_name}` : 'Task details'}
            </Text>
          </View>
          {view === 'detail' ? (
            <Pressable onPress={onClose} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
              <Text style={{ color: palette.subtext, fontSize: 18 }}>✕</Text>
            </Pressable>
          ) : null}
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.settingsPanelBody} showsVerticalScrollIndicator={false}>
          {view === 'list' ? (
            loading ? (
              <ActivityIndicator size="small" color={palette.primary} />
            ) : (
              <>
                <View style={styles.overviewGrid}>
                  {summaryTiles.map((tile) => (
                    <View key={tile.status} style={[styles.overviewCard, { borderColor: palette.borderMuted, backgroundColor: palette.surface }]}>
                      <Text style={[styles.overviewValue, { color: palette.text }]}>{tile.value}</Text>
                      <Text style={[styles.overviewLabel, { color: palette.subtext }]}>{tile.label}</Text>
                    </View>
                  ))}
                </View>

                <Text style={{ color: palette.subtext, fontSize: 11, fontWeight: '700', marginBottom: 6 }}>Status</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                  {STATUS_FILTERS.map((s) => (
                    <Pressable
                      key={s}
                      onPress={() => setStatusFilter(s)}
                      style={{ paddingVertical: 5, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: statusFilter === s ? palette.primary : palette.borderMuted }}
                    >
                      <Text style={{ color: statusFilter === s ? palette.primary : palette.text, fontSize: 12 }}>
                        {s === 'all' ? 'All' : STATUS_META[s].label}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {channelOptions.length > 0 ? (
                  <>
                    <Text style={{ color: palette.subtext, fontSize: 11, fontWeight: '700', marginBottom: 6 }}>Channel</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                      <Pressable
                        onPress={() => setChannelFilter(null)}
                        style={{ paddingVertical: 5, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: channelFilter === null ? palette.primary : palette.borderMuted }}
                      >
                        <Text style={{ color: channelFilter === null ? palette.primary : palette.text, fontSize: 12 }}>All channels</Text>
                      </Pressable>
                      {channelOptions.map((c) => (
                        <Pressable
                          key={c.id}
                          onPress={() => setChannelFilter(c.id)}
                          style={{ paddingVertical: 5, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: channelFilter === c.id ? palette.primary : palette.borderMuted }}
                        >
                          <Text style={{ color: channelFilter === c.id ? palette.primary : palette.text, fontSize: 12 }}>#{c.name}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </>
                ) : null}

                {canManageTasks ? (
                  <View style={{ marginBottom: 16 }}>
                    <Pressable onPress={() => setShowCreate((v) => !v)} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
                      <Text style={{ color: palette.primary, fontSize: 13, fontWeight: '700', marginBottom: showCreate ? 8 : 0 }}>
                        {showCreate ? '− Cancel new task' : '+ New task'}
                      </Text>
                    </Pressable>
                    {showCreate ? (
                      <View>
                        <Text style={{ color: palette.subtext, fontSize: 11, marginTop: 10, marginBottom: 4 }}>Channel</Text>
                        {createChannelOptions.length === 0 ? (
                          <Text style={{ color: palette.subtext, fontSize: 12, marginBottom: 8 }}>No channels available to assign this task to.</Text>
                        ) : (
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                            {createChannelOptions.map((c) => (
                              <Pressable
                                key={c.id}
                                onPress={() => setNewChannelId(c.id)}
                                style={{ paddingVertical: 5, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: newChannelId === c.id ? palette.primary : palette.borderMuted }}
                              >
                                <Text style={{ color: newChannelId === c.id ? palette.primary : palette.text, fontSize: 12 }}>#{c.name}</Text>
                              </Pressable>
                            ))}
                          </View>
                        )}
                        <TextInput
                          value={newTitle}
                          onChangeText={setNewTitle}
                          placeholder="Task title"
                          placeholderTextColor={palette.subtext}
                          style={[styles.settingsTextInput, { borderColor: palette.borderMuted, color: palette.text, marginTop: 0 }]}
                        />
                        <TextInput
                          value={newDescription}
                          onChangeText={setNewDescription}
                          placeholder="Description (optional)"
                          placeholderTextColor={palette.subtext}
                          multiline
                          style={[styles.settingsTextInput, { borderColor: palette.borderMuted, color: palette.text, minHeight: 60, textAlignVertical: 'top' }]}
                        />
                        <TextInput
                          value={newDueAt}
                          onChangeText={setNewDueAt}
                          placeholder="Due date (YYYY-MM-DD, optional)"
                          placeholderTextColor={palette.subtext}
                          style={[styles.settingsTextInput, { borderColor: palette.borderMuted, color: palette.text }]}
                        />
                        <Text style={{ color: palette.subtext, fontSize: 11, marginTop: 10, marginBottom: 4 }}>Priority</Text>
                        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
                          {(Object.keys(PRIORITY_META) as TaskPriorityValue[]).map((p) => (
                            <Pressable
                              key={p}
                              onPress={() => setNewPriority(p)}
                              style={{ paddingVertical: 5, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: newPriority === p ? palette.primary : palette.borderMuted }}
                            >
                              <Text style={{ color: newPriority === p ? palette.primary : palette.text, fontSize: 12 }}>{PRIORITY_META[p].label}</Text>
                            </Pressable>
                          ))}
                        </View>
                        <Text style={{ color: palette.subtext, fontSize: 11, marginBottom: 4 }}>Assign to</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                          <Pressable
                            onPress={() => setNewAssigneeId(null)}
                            style={{ paddingVertical: 5, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: newAssigneeId === null ? palette.primary : palette.borderMuted }}
                          >
                            <Text style={{ color: newAssigneeId === null ? palette.primary : palette.subtext, fontSize: 12 }}>Unassigned</Text>
                          </Pressable>
                          {members.map((m) => (
                            <Pressable
                              key={m.user_id}
                              onPress={() => setNewAssigneeId(m.user_id)}
                              style={{ paddingVertical: 5, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: newAssigneeId === m.user_id ? palette.primary : palette.borderMuted }}
                            >
                              <Text style={{ color: newAssigneeId === m.user_id ? palette.primary : palette.text, fontSize: 12 }}>{memberName(m)}</Text>
                            </Pressable>
                          ))}
                        </View>
                        <PrimaryButton label={creating ? 'Creating…' : 'Create task'} onPress={createTask} disabled={creating || !newChannelId} palette={palette} />
                      </View>
                    ) : null}
                  </View>
                ) : null}

                {tasks.length === 0 ? (
                  <Text style={{ color: palette.subtext, fontSize: 13, textAlign: 'center', marginTop: 20 }}>No tasks match this filter.</Text>
                ) : (
                  tasks.map((task) => (
                    <Pressable
                      key={task.id}
                      onPress={() => openTask(task.id)}
                      style={({ pressed }) => [
                        styles.settingsFeatureRow,
                        { borderColor: task.is_overdue ? palette.danger : palette.borderMuted, backgroundColor: palette.surface, marginBottom: 8, opacity: pressed ? 0.8 : 1 },
                      ]}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <Text style={[styles.settingsFeatureTitle, { color: palette.text, flex: 1 }]} numberOfLines={2}>{task.title}</Text>
                        <StatusBadge status={task.status} palette={palette} />
                      </View>
                      <Text style={{ color: palette.subtext, fontSize: 11, marginTop: 2 }}>#{task.channel_name}</Text>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                        <UserChip user={task.assigned_to} palette={palette} />
                        <PriorityBadge priority={task.priority} palette={palette} />
                      </View>
                      <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
                        {task.due_at ? (
                          <Text style={{ color: task.is_overdue ? palette.danger : palette.subtext, fontSize: 10, fontWeight: task.is_overdue ? '700' : '400' }}>
                            {task.is_overdue ? 'Overdue · ' : 'Due '}{formatDate(task.due_at)}
                          </Text>
                        ) : null}
                        {task.attachment_count > 0 ? <Text style={{ color: palette.subtext, fontSize: 10 }}>📎 {task.attachment_count}</Text> : null}
                        {task.comment_count > 0 ? <Text style={{ color: palette.subtext, fontSize: 10 }}>💬 {task.comment_count}</Text> : null}
                      </View>
                    </Pressable>
                  ))
                )}
              </>
            )
          ) : detailLoading || !detail ? (
            <ActivityIndicator size="small" color={palette.primary} />
          ) : (
            <>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                <StatusBadge status={detail.status} palette={palette} />
                <PriorityBadge priority={detail.priority} palette={palette} />
              </View>

              {detail.description ? (
                <Text style={{ color: palette.text, fontSize: 13, lineHeight: 19, marginBottom: 12 }}>{detail.description}</Text>
              ) : null}

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <Text style={[styles.settingsSectionTitle, { color: palette.text }]}>Assigned to</Text>
                {canManageTasks ? (
                  <Pressable onPress={() => setShowAssignPicker((v) => !v)}>
                    <Text style={{ color: palette.primary, fontSize: 12, fontWeight: '700' }}>Reassign</Text>
                  </Pressable>
                ) : null}
              </View>
              <UserChip user={detail.assigned_to} palette={palette} />
              {showAssignPicker ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  <Pressable onPress={() => reassign(null)} style={{ paddingVertical: 5, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: palette.borderMuted }}>
                    <Text style={{ color: palette.subtext, fontSize: 12 }}>Unassign</Text>
                  </Pressable>
                  {members.map((m) => (
                    <Pressable key={m.user_id} onPress={() => reassign(m.user_id)} style={{ paddingVertical: 5, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: palette.borderMuted }}>
                      <Text style={{ color: palette.text, fontSize: 12 }}>{memberName(m)}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}

              <View style={{ marginTop: 12, marginBottom: 12 }}>
                {[
                  ['Created', detail.created_by?.display_name],
                  ['Due', formatDate(detail.due_at)],
                  ['Started', formatDate(detail.started_at)],
                  ['Submitted', formatDate(detail.submitted_at)],
                  ['Reviewed', formatDate(detail.reviewed_at)],
                  ['Completed', formatDate(detail.completed_at)],
                ].filter(([, v]) => !!v).map(([label, value]) => (
                  <Text key={label as string} style={{ color: palette.subtext, fontSize: 11, marginTop: 2 }}>{label}: {value}</Text>
                ))}
              </View>

              {detail.review_note ? (
                <View style={[styles.settingsFeatureRow, { borderColor: palette.warning, backgroundColor: palette.surface, marginBottom: 12 }]}>
                  <Text style={{ color: palette.subtext, fontSize: 11, fontWeight: '700', marginBottom: 2 }}>Review note</Text>
                  <Text style={{ color: palette.text, fontSize: 12 }}>{detail.review_note}</Text>
                </View>
              ) : null}

              {detail.attachments.length > 0 ? (
                <View style={{ marginBottom: 16 }}>
                  <Text style={[styles.settingsSectionTitle, { color: palette.text, marginBottom: 6 }]}>Attachments</Text>
                  {detail.attachments.map((att) => (
                    <Pressable
                      key={att.id}
                      onPress={() => att.file_url && Linking.openURL(att.file_url)}
                      style={[styles.settingsFeatureRow, { borderColor: palette.borderMuted, backgroundColor: palette.surface, marginBottom: 6 }]}
                    >
                      <Text style={{ color: palette.text, fontSize: 12, fontWeight: '600' }} numberOfLines={1}>
                        {att.kind === 'report' ? '📤 ' : '📎 '}{att.file_name || 'File'}
                      </Text>
                      <Text style={{ color: palette.subtext, fontSize: 10, marginTop: 2 }}>
                        {att.mime_type}{att.size_bytes ? ` · ${formatBytes(att.size_bytes)}` : ''}{att.uploaded_by ? ` · by ${att.uploaded_by.display_name}` : ''}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}

              {isAssignee && MEMBER_STARTABLE.includes(detail.status) ? (
                <View style={{ marginBottom: 16 }}>
                  <PrimaryButton label={busy ? 'Working…' : 'Start work'} onPress={startWork} disabled={busy} palette={palette} />
                </View>
              ) : null}

              {isAssignee && MEMBER_SUBMITTABLE.includes(detail.status) ? (
                <View style={{ marginBottom: 16 }}>
                  <Text style={[styles.settingsSectionTitle, { color: palette.text, marginBottom: 6 }]}>Submit report</Text>
                  <TextInput
                    value={submitNote}
                    onChangeText={setSubmitNote}
                    placeholder="Notes for the reviewer (optional)"
                    placeholderTextColor={palette.subtext}
                    multiline
                    style={[styles.settingsTextInput, { borderColor: palette.borderMuted, color: palette.text, minHeight: 50, textAlignVertical: 'top', marginTop: 0 }]}
                  />
                  <View style={{ marginTop: 8, marginBottom: 8 }}>
                    <GhostButton label="+ Attach file (any type)" onPress={pickReportFiles} palette={palette} />
                  </View>
                  {pickedFiles.map((f) => {
                    const prog = uploadProgress[f.uri];
                    return (
                      <View key={f.uri} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 }}>
                        <Text style={{ color: palette.text, fontSize: 12, flex: 1 }} numberOfLines={1}>
                          {f.name}{prog ? ` — ${prog.status}${prog.status === 'uploading' ? ` ${Math.round(prog.progress * 100)}%` : ''}` : ''}
                        </Text>
                        {!submitting ? (
                          <Pressable onPress={() => removePickedFile(f.uri)}>
                            <Text style={{ color: palette.danger, fontSize: 12 }}>Remove</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    );
                  })}
                  <View style={{ marginTop: 8 }}>
                    <PrimaryButton label={submitting ? 'Submitting…' : 'Submit for review'} onPress={submitReport} disabled={submitting} palette={palette} />
                  </View>
                </View>
              ) : null}

              {canManageTasks ? (
                <View style={{ marginBottom: 16 }}>
                  <Text style={[styles.settingsSectionTitle, { color: palette.text, marginBottom: 6 }]}>Review decision</Text>
                  <TextInput
                    value={reviewNote}
                    onChangeText={setReviewNote}
                    placeholder="Note for this decision (optional)"
                    placeholderTextColor={palette.subtext}
                    style={[styles.settingsTextInput, { borderColor: palette.borderMuted, color: palette.text, marginTop: 0, marginBottom: 8 }]}
                  />
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {ADMIN_STATUS_ACTIONS.map((action) => (
                      <GhostButton
                        key={action.status}
                        label={action.label}
                        onPress={() => changeStatus(action.status)}
                        disabled={busy || detail.status === action.status}
                        palette={palette}
                        tone={STATUS_META[action.status].color(palette)}
                      />
                    ))}
                    {UNDOABLE.includes(detail.status) ? (
                      <GhostButton label="Undo last change" onPress={undoStatus} disabled={busy} palette={palette} />
                    ) : null}
                  </View>
                  <View style={{ marginTop: 12 }}>
                    <Pressable onPress={deleteTask}>
                      <Text style={{ color: palette.danger, fontSize: 12, fontWeight: '700' }}>Delete task</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}

              <View style={{ marginBottom: 16 }}>
                <Text style={[styles.settingsSectionTitle, { color: palette.text, marginBottom: 6 }]}>Comments</Text>
                {detail.comments.map((c) => (
                  <View key={c.id} style={{ marginBottom: 8 }}>
                    <Text style={{ color: palette.text, fontSize: 12 }}>
                      <Text style={{ fontWeight: '700' }}>{c.author?.display_name ?? 'Someone'}</Text>{'  '}
                      <Text style={{ color: palette.subtext, fontSize: 10 }}>{formatDate(c.created_at)}</Text>
                    </Text>
                    <Text style={{ color: palette.text, fontSize: 12, marginTop: 2 }}>{c.body}</Text>
                  </View>
                ))}
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                  <TextInput
                    value={commentBody}
                    onChangeText={setCommentBody}
                    placeholder="Add a comment…"
                    placeholderTextColor={palette.subtext}
                    style={[styles.settingsTextInput, { borderColor: palette.borderMuted, color: palette.text, marginTop: 0, flex: 1 }]}
                  />
                  <Pressable
                    onPress={postComment}
                    disabled={postingComment || !commentBody.trim()}
                    style={({ pressed }) => [{ paddingHorizontal: 14, borderRadius: 10, backgroundColor: palette.royalInk, justifyContent: 'center', opacity: pressed || postingComment || !commentBody.trim() ? 0.6 : 1 }]}
                  >
                    <Text style={{ color: palette.ivory, fontWeight: '700', fontSize: 12 }}>Send</Text>
                  </Pressable>
                </View>
              </View>

              <Pressable onPress={() => setShowActivity((v) => !v)}>
                <Text style={{ color: palette.primary, fontSize: 12, fontWeight: '700', marginBottom: 8 }}>
                  {showActivity ? '− Hide activity log' : '+ Show activity log'}
                </Text>
              </Pressable>
              {showActivity
                ? detail.activity.map((entry) => (
                    <View key={entry.id} style={{ marginBottom: 6 }}>
                      <Text style={{ color: palette.subtext, fontSize: 11 }}>
                        {formatDate(entry.created_at)} · {entry.actor?.display_name ?? 'System'} · {entry.event_type}
                        {entry.from_status && entry.to_status ? ` (${STATUS_META[entry.from_status]?.label ?? entry.from_status} → ${STATUS_META[entry.to_status]?.label ?? entry.to_status})` : ''}
                        {entry.to_assignee ? ` → ${entry.to_assignee.display_name}` : ''}
                        {entry.note ? ` — "${entry.note}"` : ''}
                      </Text>
                    </View>
                  ))
                : null}
            </>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}
