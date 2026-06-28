// src/screens/tabs/MesssagingSubTabs/CallsTab.tsx
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  RefreshControl,
  DeviceEventEmitter,
  SectionList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KISIcon } from '@/constants/kisIcons';
import Skeleton from '@/components/common/Skeleton';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES, { NEST_API_BASE_URL } from '@/network';
import { useSocket } from '../../../../SocketProvider';
import { fetchConversationsForCurrentUser } from '@/Module/ChatRoom/normalizeConversation';
import type {
  CallHistoryItem,
  CallType,
  ScheduledCallItem,
} from '@/services/calls/callTypes';
import { callTypeLabel, callTypeIcon, formatDuration } from '@/services/calls/callTypes';
import ScheduleCallSheet, { type StandaloneCallResult } from '@/screens/calls/ScheduleCallSheet';
import { loadCallHistory, saveCallHistory } from '@/services/calls/callHistoryStorage';

type CallsTabProps = {
  searchTerm?: string;
};

const buildStatusColor = (p: any): Record<string, string> => ({
  ended: p.subtext,
  completed: p.success,
  cancelled: p.subtext,
  ongoing: p.success,
  missed: p.danger,
  active: p.success,
  ringing: p.gold,
  pending: p.gold,
  busy: p.danger,
  declined: p.danger,
});

const STATUS_LABEL: Record<string, string> = {
  ended: 'Completed',
  completed: 'Completed',
  cancelled: 'Cancelled',
  ongoing: 'Ongoing',
  missed: 'Missed',
  active: 'Ongoing',
  ringing: 'Ringing',
  pending: 'Scheduled',
  busy: 'Busy',
  declined: 'Declined',
};

function resolveCallType(item: CallHistoryItem): CallType {
  if (item.callType) return item.callType;
  return item.media === 'video' ? 'video' : 'voice';
}

function formatScheduledFor(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  if (diffMs < 0) return 'Starts now';
  const diffMin = Math.round(diffMs / 60_000);
  if (diffMin < 60) return `in ${diffMin} min`;
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  return `in ${h}h${m > 0 ? ` ${m}m` : ''}`;
}

export default function CallsTab({ searchTerm = '' }: CallsTabProps) {
  const { palette } = useKISTheme();
  const STATUS_COLOR = buildStatusColor(palette);
  const responsive = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const { currentUserId, startCall, joinExistingCall, socket } = useSocket();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [calls, setCalls] = useState<CallHistoryItem[]>([]);
  const [scheduled, setScheduled] = useState<ScheduledCallItem[]>([]);
  const [conversationNameById, setConversationNameById] = useState<Record<string, string>>({});
  const [showNewCallSheet, setShowNewCallSheet] = useState(false);

  const loadCalls = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    const userId = String(currentUserId ?? '');

    // Show local cache immediately while the network request runs.
    if (userId) {
      const cached = await loadCallHistory(userId);
      if (cached.length) {
        setCalls(cached);
        if (!isRefresh) setLoading(false);
      }
    }

    try {
      const [histRes, schedRes] = await Promise.all([
        getRequest(`${ROUTES.calls.history}?limit=100`),
        getRequest(`${ROUTES.calls.scheduled}`).catch(() => null),
      ]);

      const serverCalls: CallHistoryItem[] | null =
        histRes.success && Array.isArray(histRes.data?.calls)
          ? (histRes.data.calls as CallHistoryItem[])
          : histRes.success && Array.isArray(histRes.data)
          ? (histRes.data as CallHistoryItem[])
          : null;

      if (serverCalls) {
        setCalls(serverCalls);
        // Persist under the real userId so the next reload shows cached data
        // immediately. Also save under the empty-string key as an emergency
        // fallback for the window before currentUserId is resolved.
        if (userId) {
          await saveCallHistory(userId, serverCalls);
        }
      }

      if (schedRes?.success && Array.isArray(schedRes.data?.calls)) {
        setScheduled(schedRes.data.calls as ScheduledCallItem[]);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUserId]);

  // Run once on mount. When currentUserId resolves (null → real id),
  // loadCalls is recreated and this effect re-runs automatically.
  useEffect(() => { void loadCalls(); }, [loadCalls]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('calls.refresh', loadCalls);
    return () => sub.remove();
  }, [loadCalls]);

  // Real-time socket updates so the list reflects live call state without a pull-to-refresh.
  useEffect(() => {
    if (!socket) return;

    // New call started — insert or promote to 'ongoing' at the top.
    const onOffer = (payload: any) => {
      if (!payload?.callId) return;
      setCalls((prev) => {
        const exists = prev.some((c) => c.callId === String(payload.callId));
        const incoming: CallHistoryItem = {
          id: String(payload.callId),
          callId: String(payload.callId),
          conversationId: String(payload.conversationId ?? ''),
          createdBy: String(payload.createdBy ?? ''),
          status: 'ongoing',
          callType: (payload.callType ?? 'voice') as CallType,
          title: payload.title ?? null,
          startedAt: payload.startedAt ?? new Date().toISOString(),
          participantCount: Number(payload.participantCount ?? 1),
        };
        if (exists) {
          return prev.map((c) => c.callId === incoming.callId ? { ...c, status: 'ongoing' as const } : c);
        }
        return [incoming, ...prev];
      });
    };

    // Call ended — mark as completed and refresh to get duration/status from server.
    const onEnd = (payload: any) => {
      if (!payload?.callId) return;
      setCalls((prev) =>
        prev.map((c) =>
          c.callId === String(payload.callId)
            ? { ...c, status: 'completed' as const }
            : c,
        ),
      );
      // Fetch fresh history after a short delay so the server has time to persist.
      setTimeout(() => void loadCalls(), 1500);
    };

    // Someone joined — update participant count.
    const onJoined = (payload: any) => {
      if (!payload?.conversationId) return;
      setCalls((prev) =>
        prev.map((c) =>
          c.conversationId === String(payload.conversationId)
            ? { ...c, participantCount: (c.participantCount ?? 1) + 1 }
            : c,
        ),
      );
    };

    // Someone left — decrement count.
    const onLeft = (payload: any) => {
      if (!payload?.conversationId) return;
      setCalls((prev) =>
        prev.map((c) =>
          c.conversationId === String(payload.conversationId)
            ? { ...c, participantCount: Math.max(0, (c.participantCount ?? 1) - 1) }
            : c,
        ),
      );
    };

    socket.on('call.offer',              onOffer);
    socket.on('call.end',                onEnd);
    socket.on('call.participant.joined', onJoined);
    socket.on('call.participant.left',   onLeft);
    return () => {
      socket.off('call.offer',              onOffer);
      socket.off('call.end',               onEnd);
      socket.off('call.participant.joined', onJoined);
      socket.off('call.participant.left',  onLeft);
    };
  }, [socket, loadCalls]);

  useEffect(() => {
    const load = async () => {
      const convs = await fetchConversationsForCurrentUser([], currentUserId ?? undefined);
      const map: Record<string, string> = {};
      for (const c of convs) {
        if (c?.conversationId) map[String(c.conversationId)] = c.name ?? 'Conversation';
        if (c?.id) map[String(c.id)] = c.name ?? 'Conversation';
      }
      setConversationNameById(map);
    };
    load();
  }, [currentUserId]);

  const rows = useMemo(() => {
    if (!searchTerm.trim()) return calls;
    const q = searchTerm.trim().toLowerCase();
    return calls.filter(item => {
      const name = conversationNameById[item.conversationId] ?? '';
      const label = STATUS_LABEL[item.status] ?? item.status;
      const type = callTypeLabel(resolveCallType(item));
      return name.toLowerCase().includes(q) || label.toLowerCase().includes(q) || type.toLowerCase().includes(q);
    });
  }, [calls, conversationNameById, searchTerm]);

  const handleCallback = useCallback(async (item: CallHistoryItem) => {
    if (!startCall) return;
    const ct = resolveCallType(item);
    await startCall({
      conversationId: item.conversationId,
      title: conversationNameById[item.conversationId] ?? 'Call',
      callType: ct,
      inviteeUserIds: item.participants?.map(p => p.userId).filter(id => id !== currentUserId) ?? [],
    });
  }, [startCall, conversationNameById, currentUserId]);

  const handleCreateStandalone = useCallback(async (params: {
    callId: string;
    callType: CallType;
    title: string;
    scheduledFor?: Date | null;
  }): Promise<StandaloneCallResult> => {
    const res = await postRequest(`${NEST_API_BASE_URL}/api/v1/calls/standalone`, {
      call_id: params.callId,
      call_type: params.callType,
      title: params.title,
      scheduled_for: params.scheduledFor?.toISOString() ?? undefined,
    });
    if (!res.success) throw new Error(res.error ?? 'Failed to create call');
    return res.data as StandaloneCallResult;
  }, []);

  const handleStandaloneStart = useCallback(async (result: StandaloneCallResult) => {
    setShowNewCallSheet(false);
    if (!result.scheduledFor) {
      // Start the call immediately if not scheduled
      if (startCall) {
        await startCall({
          conversationId: result.conversationId,
          title: result.title ?? 'My call',
          callType: result.callType,
          inviteeUserIds: [],
          inviteToken: result.inviteToken,
        });
      }
    }
    loadCalls();
  }, [startCall, loadCalls]);

  const handleJoinScheduled = useCallback(async (item: ScheduledCallItem) => {
    if (!startCall) return;
    await startCall({
      conversationId: item.conversationId,
      title: item.title ?? 'Call',
      callType: item.callType as CallType,
      inviteeUserIds: [],
      inviteToken: item.inviteToken ?? undefined,
    });
  }, [startCall]);

  const renderHistoryItem = ({ item }: { item: CallHistoryItem }) => {
    const isStandalone = item.isStandalone || item.conversationId?.startsWith('standalone:');
    const name = isStandalone
      ? item.title ?? 'Standalone call'
      : conversationNameById[item.conversationId] ?? `Conversation ${item.conversationId?.slice?.(0, 6) ?? '…'}`;
    const callType = resolveCallType(item);
    const iconName = callTypeIcon(callType);
    const typeLabel = callTypeLabel(callType);
    const statusLabel = STATUS_LABEL[item.status] ?? item.status;
    const statusColor = STATUS_COLOR[item.status] ?? palette.subtext;
    const isMissed = item.status === 'missed' || item.status === 'declined' || item.status === 'busy';
    const isActive = item.status === 'active' || item.status === 'ongoing' || item.status === 'ringing';

    const when = item.startedAt ? new Date(item.startedAt) : null;
    const timeAgo = when ? formatTimeAgo(when) : '';
    const duration = item.duration != null ? formatDuration(item.duration) : null;
    const participantCount = item.participantCount ?? item.participants?.length ?? null;

    const iconSize = responsive.isWatch ? 28 : 32;

    return (
      <Pressable
        style={[styles.row, { borderColor: palette.inputBorder, backgroundColor: palette.card }]}
        onPress={isStandalone
          ? undefined
          : () => DeviceEventEmitter.emit('chat.open', { conversationId: item.conversationId, name })}
      >
        <View style={[
          styles.iconWrap,
          {
            backgroundColor: isMissed ? `${palette.danger}1E` : isActive ? `${palette.success}1E` : palette.surface,
            width: iconSize + 16,
            height: iconSize + 16,
            borderRadius: (iconSize + 16) / 2,
          },
        ]}>
          <KISIcon
            name={isMissed ? 'phone-missed' : iconName}
            size={iconSize * 0.55}
            color={isMissed ? palette.danger : isActive ? palette.success : palette.subtext}
          />
        </View>

        <View style={styles.content}>
          <Text style={[styles.name, { color: isMissed ? palette.danger : palette.text, fontSize: responsive.bodyFontSize }]} numberOfLines={1}>
            {name}
          </Text>
          <View style={styles.metaRow}>
            <Text style={[styles.typeLabel, { color: palette.subtext, fontSize: responsive.labelFontSize }]}>
              {typeLabel}
            </Text>
            <Text style={{ color: palette.subtext, fontSize: responsive.labelFontSize }}>·</Text>
            <Text style={[styles.statusLabel, { color: statusColor, fontSize: responsive.labelFontSize }]}>
              {statusLabel}
            </Text>
            {duration && !isMissed && (
              <>
                <Text style={{ color: palette.subtext, fontSize: responsive.labelFontSize }}>·</Text>
                <Text style={[styles.duration, { color: palette.subtext, fontSize: responsive.labelFontSize }]}>{duration}</Text>
              </>
            )}
            {participantCount != null && participantCount > 2 && (
              <>
                <Text style={{ color: palette.subtext, fontSize: responsive.labelFontSize }}>·</Text>
                <Text style={[styles.duration, { color: palette.subtext, fontSize: responsive.labelFontSize }]}>{participantCount} people</Text>
              </>
            )}
          </View>
          {timeAgo ? (
            <Text style={[styles.time, { color: palette.subtext, fontSize: responsive.labelFontSize - 1 }]}>{timeAgo}</Text>
          ) : null}
        </View>

        {!isActive && (
          <Pressable
            onPress={() => void handleCallback(item)}
            style={[styles.callbackBtn, { borderColor: palette.inputBorder }]}
            hitSlop={8}
          >
            <KISIcon
              name={callType === 'video' || callType === 'video-group' ? 'video' : 'phone'}
              size={16}
              color={palette.primary}
            />
          </Pressable>
        )}

        {isActive && (
          <Pressable
            onPress={() => {
              if (joinExistingCall && item.callId) {
                void joinExistingCall({
                  callId: item.callId,
                  conversationId: item.conversationId,
                  callType: resolveCallType(item),
                  title: item.title ?? conversationNameById[item.conversationId] ?? 'Call',
                });
              }
            }}
            style={[styles.joinActiveBtn, { backgroundColor: palette.success }]}
            hitSlop={6}
            accessibilityLabel="Join live call"
          >
            <View style={[styles.liveDot, { backgroundColor: palette.ivory }]} />
            <Text style={[styles.liveText, { color: palette.ivory }]}>Join</Text>
          </Pressable>
        )}
      </Pressable>
    );
  };

  const renderScheduledItem = ({ item }: { item: ScheduledCallItem }) => {
    const timeStr = item.scheduledFor ? formatScheduledFor(item.scheduledFor) : '';
    return (
      <Pressable
        style={[styles.scheduledRow, { backgroundColor: `${palette.gold}10`, borderColor: `${palette.gold}40` }]}
        onPress={() => handleJoinScheduled(item)}
      >
        <View style={[styles.scheduledIcon, { backgroundColor: `${palette.gold}26` }]}>
          <KISIcon name="calendar" size={16} color={palette.gold} />
        </View>
        <View style={styles.content}>
          <Text style={[styles.name, { color: palette.text }]} numberOfLines={1}>
            {item.title ?? 'Scheduled call'}
          </Text>
          <View style={styles.metaRow}>
            <Text style={[styles.typeLabel, { color: palette.subtext }]}>{callTypeLabel(item.callType as CallType)}</Text>
            {timeStr ? (
              <>
                <Text style={{ color: palette.subtext }}>·</Text>
                <Text style={{ color: palette.gold, fontWeight: '700', fontSize: 12 }}>{timeStr}</Text>
              </>
            ) : null}
          </View>
        </View>
        <View style={[styles.joinBtn, { backgroundColor: palette.gold }]}>
          <Text style={[styles.joinText, { color: palette.royalInk }]}>Join</Text>
        </View>
      </Pressable>
    );
  };

  const sections = useMemo(() => {
    const s: Array<{ title: string; data: any[]; type: 'scheduled' | 'history' }> = [];
    if (scheduled.length > 0) {
      s.push({ title: 'Upcoming', data: scheduled, type: 'scheduled' });
    }
    s.push({ title: 'Recent calls', data: rows, type: 'history' });
    return s;
  }, [scheduled, rows]);

  return (
    <View style={[styles.wrap, { backgroundColor: palette.bg, padding: responsive.pageGutter }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.headerTitle, { color: palette.text, fontSize: responsive.isWatch ? 17 : 20 }]}>
          Calls
        </Text>
        <View style={styles.headerActions}>
          <Pressable onPress={() => loadCalls()} style={styles.iconBtn} hitSlop={8}>
            <KISIcon name="refresh-cw" size={17} color={palette.text} />
          </Pressable>
          <Pressable
            onPress={() => setShowNewCallSheet(true)}
            style={[styles.newCallBtn, { backgroundColor: palette.gold }]}
            accessibilityLabel="New call"
          >
            <KISIcon name="phone" size={15} color={palette.royalInk} />
            <Text style={[styles.newCallText, { color: palette.royalInk }]}>New call</Text>
          </Pressable>
        </View>
      </View>

      {loading ? (
        <View style={{ gap: 10 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <View key={i} style={[styles.row, { borderColor: palette.inputBorder, backgroundColor: palette.card }]}>
              <Skeleton width={48} height={48} radius={24} />
              <View style={{ flex: 1, gap: 6 }}>
                <Skeleton width="55%" height={13} radius={6} />
                <Skeleton width="35%" height={11} radius={6} />
              </View>
            </View>
          ))}
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item, index) => item.id ?? item.callId ?? String(index)}
          renderItem={({ item, section }) =>
            section.type === 'scheduled'
              ? renderScheduledItem({ item })
              : renderHistoryItem({ item })
          }
          renderSectionHeader={({ section }) =>
            sections.length > 1 ? (
              <Text style={[styles.sectionHeader, { color: palette.subtext }]}>
                {section.title}
              </Text>
            ) : null
          }
          contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
          ListEmptyComponent={
            rows.length === 0 && scheduled.length === 0 ? (
              <View style={styles.empty}>
                <KISIcon name="phone" size={40} color={palette.subtext} />
                <Text style={[styles.emptyText, { color: palette.subtext }]}>No calls yet</Text>
                <Text style={[styles.emptySubtext, { color: palette.subtext }]}>
                  Tap "New call" to start or schedule one.
                </Text>
              </View>
            ) : null
          }
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadCalls(true)} tintColor={palette.primaryStrong} colors={[palette.primaryStrong]} />
          }
          stickySectionHeadersEnabled={false}
        />
      )}

      {/* New call bottom sheet */}
      <ScheduleCallSheet
        visible={showNewCallSheet}
        onClose={() => setShowNewCallSheet(false)}
        onCreate={handleCreateStandalone}
        onStart={handleStandaloneStart}
      />
    </View>
  );
}

function formatTimeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (d > 7) return date.toLocaleDateString();
  if (d > 1) return `${d} days ago`;
  if (d === 1) return 'Yesterday';
  if (h > 1) return `${h}h ago`;
  if (m > 1) return `${m}m ago`;
  return 'Just now';
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  headerTitle: { fontWeight: '800' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBtn: { padding: 6, minWidth: 40, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  newCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  newCallText: { fontSize: 13, fontWeight: '800' },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 14,
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
  },
  scheduledRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
  },
  scheduledIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconWrap: { alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  content: { flex: 1, gap: 3 },
  name: { fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5 },
  typeLabel: {},
  statusLabel: { fontWeight: '600' },
  duration: {},
  time: { marginTop: 1 },
  callbackBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  joinBtn: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexShrink: 0,
  },
  joinText: { fontSize: 13, fontWeight: '800' },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  joinActiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 7,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  liveText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 60 },
  emptyText: { fontSize: 16, fontWeight: '700' },
  emptySubtext: { fontSize: 13, textAlign: 'center' },
});
