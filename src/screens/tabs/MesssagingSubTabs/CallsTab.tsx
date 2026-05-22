// src/screens/tabs/MesssagingSubTabs/CallsTab.tsx
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  DeviceEventEmitter,
} from 'react-native';
import { KISIcon } from '@/constants/kisIcons';
import Skeleton from '@/components/common/Skeleton';
import { getRequest } from '@/network/get';
import { NEST_API_BASE_URL } from '@/network';
import { useSocket } from '../../../../SocketProvider';
import { fetchConversationsForCurrentUser } from '@/Module/ChatRoom/normalizeConversation';
import type { CallHistoryItem, CallType } from '@/services/calls/callTypes';
import { callTypeLabel, callTypeIcon, formatDuration } from '@/services/calls/callTypes';

type CallsTabProps = {
  searchTerm?: string;
};

const STATUS_COLOR: Record<string, string> = {
  ended: 'rgba(255,255,255,0.4)',
  missed: '#E52B2B',
  active: '#22C55E',
  ringing: '#F59E0B',
  busy: '#E52B2B',
  declined: '#E52B2B',
};

const STATUS_LABEL: Record<string, string> = {
  ended: 'Ended',
  missed: 'Missed',
  active: 'Active',
  ringing: 'Ringing',
  busy: 'Busy',
  declined: 'Declined',
};

function resolveCallType(item: CallHistoryItem): CallType {
  if (item.callType) return item.callType;
  return item.media === 'video' ? 'video' : 'voice';
}

export default function CallsTab({ searchTerm = '' }: CallsTabProps) {
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const { currentUserId, startCall } = useSocket();
  const [loading, setLoading] = useState(true);
  const [calls, setCalls] = useState<CallHistoryItem[]>([]);
  const [conversationNameById, setConversationNameById] = useState<Record<string, string>>({});

  const loadCalls = useCallback(async () => {
    setLoading(true);
    try {
      const url = `${NEST_API_BASE_URL}/calls/history?limit=100`;
      const res = await getRequest(url);
      if (res.success && Array.isArray(res.data?.calls)) {
        setCalls(res.data.calls as CallHistoryItem[]);
      } else if (res.success && Array.isArray(res.data)) {
        setCalls(res.data as CallHistoryItem[]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadCalls(); }, [loadCalls]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('calls.refresh', loadCalls);
    return () => sub.remove();
  }, [loadCalls]);

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

  const renderItem = ({ item }: { item: CallHistoryItem }) => {
    const name = conversationNameById[item.conversationId] ?? `Conversation ${item.conversationId?.slice?.(0, 6) ?? '…'}`;
    const callType = resolveCallType(item);
    const iconName = callTypeIcon(callType);
    const typeLabel = callTypeLabel(callType);
    const statusLabel = STATUS_LABEL[item.status] ?? item.status;
    const statusColor = STATUS_COLOR[item.status] ?? palette.subtext;
    const isMissed = item.status === 'missed' || item.status === 'declined' || item.status === 'busy';
    const isActive = item.status === 'active';

    const when = item.startedAt ? new Date(item.startedAt) : null;
    const timeAgo = when ? formatTimeAgo(when) : '';
    const duration = item.duration != null ? formatDuration(item.duration) : null;
    const participantCount = item.participantCount ?? item.participants?.length ?? null;

    const iconSize = responsive.isWatch ? 28 : 32;

    return (
      <Pressable
        style={[styles.row, { borderColor: palette.inputBorder, backgroundColor: palette.card }]}
        onPress={() => DeviceEventEmitter.emit('chat.open', { conversationId: item.conversationId, name })}
      >
        {/* Call type icon */}
        <View style={[
          styles.iconWrap,
          {
            backgroundColor: isMissed ? 'rgba(229,43,43,0.12)' : isActive ? 'rgba(34,197,94,0.12)' : palette.surface,
            width: iconSize + 16,
            height: iconSize + 16,
            borderRadius: (iconSize + 16) / 2,
          },
        ]}>
          <KISIcon
            name={isMissed ? 'phone-missed' : iconName}
            size={iconSize * 0.55}
            color={isMissed ? '#E52B2B' : isActive ? '#22C55E' : palette.subtext}
          />
        </View>

        {/* Content */}
        <View style={styles.content}>
          <Text style={[styles.name, { color: isMissed ? '#E52B2B' : palette.text, fontSize: responsive.bodyFontSize }]} numberOfLines={1}>
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
            {participantCount && participantCount > 2 && (
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

        {/* Callback button */}
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

        {/* Live badge */}
        {isActive && (
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <View style={[styles.wrap, { backgroundColor: palette.bg, padding: responsive.pageGutter }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.headerTitle, { color: palette.text, fontSize: responsive.isWatch ? 17 : 20 }]}>
          Calls
        </Text>
        <Pressable onPress={loadCalls} style={styles.refreshBtn} hitSlop={8}>
          <KISIcon name="refresh-cw" size={17} color={palette.text} />
        </Pressable>
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
      ) : rows.length === 0 ? (
        <View style={styles.empty}>
          <KISIcon name="phone" size={40} color={palette.subtext} />
          <Text style={[styles.emptyText, { color: palette.subtext }]}>No call history yet.</Text>
          <Text style={[styles.emptySubtext, { color: palette.subtext }]}>Start a call from any conversation.</Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        />
      )}
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
  refreshBtn: { padding: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
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
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(34,197,94,0.15)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22C55E' },
  liveText: { color: '#22C55E', fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 60 },
  emptyText: { fontSize: 16, fontWeight: '700' },
  emptySubtext: { fontSize: 13 },
});
