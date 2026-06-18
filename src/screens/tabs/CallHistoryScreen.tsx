// Call History Screen — reads from the same AsyncStorage key that SocketProvider writes.
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  Alert,
  DeviceEventEmitter,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import { useSocket } from '../../../SocketProvider';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import type { CallType } from '@/services/calls/callTypes';

// SocketProvider writes entries with this shape to 'kis.call_history'.
type SocketCallEntry = {
  id: string;
  callType: CallType;
  title: string;
  participants: { userId: string; displayName: string }[];
  startedAt: string;
  endedAt: string;
  durationMs: number;
  state: 'ended' | 'missed';
  localUserId: string;
};

// Legacy shape kept for backward-compat with any entries written by the old logCall helper.
export type CallLogEntry = {
  callId: string;
  participantName: string;
  participantId: string;
  type: 'audio' | 'video' | 'group';
  direction: 'incoming' | 'outgoing' | 'missed';
  startedAt: string;
  durationSeconds: number;
};

/** Unified view produced by normalising either shape. */
type NormalisedEntry = {
  callId: string;
  participantName: string;
  participantId: string;
  type: 'audio' | 'video' | 'group';
  direction: 'incoming' | 'outgoing' | 'missed';
  startedAt: string;
  durationSeconds: number;
};

// SocketProvider uses this key — match it exactly.
const CALL_LOG_KEY = 'kis.call_history';
// Legacy key kept so old entries aren't silently discarded.
const CALL_LOG_KEY_LEGACY = 'KIS_CALL_LOG';
const MAX_CALL_LOG = 200;

/**
 * Normalise a raw entry (either SocketCallEntry or legacy CallLogEntry) into
 * NormalisedEntry so the list renderer has a single stable shape.
 */
function normaliseEntry(raw: any, currentUserId?: string | null): NormalisedEntry {
  // Legacy shape: has 'callId' string field.
  if (typeof raw?.callId === 'string') {
    return raw as NormalisedEntry;
  }
  // SocketProvider shape: has 'id' and 'callType'.
  const entry = raw as SocketCallEntry;
  const others = (entry.participants ?? []).filter(p => p.userId !== currentUserId);
  const participantName = others.length > 0
    ? others.map(p => p.displayName || 'User').join(', ')
    : entry.title || 'Unknown';
  const participantId = others[0]?.userId ?? '';
  const durationMs = entry.durationMs ?? 0;
  const direction: 'incoming' | 'outgoing' | 'missed' =
    entry.state === 'missed' ? 'missed' :
    entry.localUserId === (entry.participants?.[0]?.userId) ? 'outgoing' : 'incoming';

  const typeMap: Record<string, 'audio' | 'video' | 'group'> = {
    voice: 'audio',
    video: 'video',
    'voice-group': 'group',
    'video-group': 'group',
    broadcast: 'group',
  };

  return {
    callId: entry.id,
    participantName,
    participantId,
    type: typeMap[entry.callType] ?? 'audio',
    direction,
    startedAt: entry.startedAt,
    durationSeconds: Math.round(durationMs / 1000),
  };
}

/** @deprecated — kept for legacy callers; SocketProvider writes directly to kis.call_history. */
export async function logCall(entry: CallLogEntry): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(CALL_LOG_KEY_LEGACY);
    const log: CallLogEntry[] = raw ? JSON.parse(raw) : [];
    const next = [entry, ...log].slice(0, MAX_CALL_LOG);
    await AsyncStorage.setItem(CALL_LOG_KEY_LEGACY, JSON.stringify(next));
  } catch { /* silent */ }
}

type Props = {
  onBack?: () => void;
};

export default function CallHistoryScreen({ onBack }: Props) {
  const { palette } = useKISTheme();
  const insets = useSafeAreaInsets();
  const responsive = useResponsiveLayout();
  const { startCall, currentUserId } = useSocket();
  const [entries, setEntries] = useState<NormalisedEntry[]>([]);
  const [callingBack, setCallingBack] = useState<string | null>(null);

  const loadLog = useCallback(async () => {
    try {
      // Primary: SocketProvider's key.
      const raw = await AsyncStorage.getItem(CALL_LOG_KEY);
      const primary: any[] = raw ? JSON.parse(raw) : [];
      // Secondary: legacy key — merge without duplicates.
      const legacyRaw = await AsyncStorage.getItem(CALL_LOG_KEY_LEGACY);
      const legacy: any[] = legacyRaw ? JSON.parse(legacyRaw) : [];
      const all = [...primary, ...legacy].slice(0, MAX_CALL_LOG);
      setEntries(all.map(e => normaliseEntry(e, currentUserId)));
    } catch { /* silent */ }
  }, [currentUserId]);

  useEffect(() => {
    void loadLog();
  }, [loadLog]);

  // Reload when a call ends (SocketProvider emits 'calls.refresh').
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('calls.refresh', loadLog);
    return () => sub.remove();
  }, [loadLog]);

  const handleClear = () => {
    Alert.alert('Clear call history', 'Remove all call history entries?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          await Promise.all([
            AsyncStorage.removeItem(CALL_LOG_KEY).catch(() => {}),
            AsyncStorage.removeItem(CALL_LOG_KEY_LEGACY).catch(() => {}),
          ]);
          setEntries([]);
        },
      },
    ]);
  };

  const handleCallBack = useCallback(async (item: NormalisedEntry) => {
    if (!item.participantId || callingBack) return;
    setCallingBack(item.callId);
    try {
      // Resolve or create a DM conversation with this participant
      const res = await postRequest(
        ROUTES.chat.directConversation,
        { other_user_id: item.participantId },
        { errorMessage: 'Unable to start call.' },
      );
      const conversationId =
        res?.data?.conversation_id ??
        res?.data?.id ??
        res?.data?.conversationId ??
        null;

      if (conversationId && startCall) {
        // Map normalised type back to StartCallArgs.
        const media: 'voice' | 'video' = item.type === 'video' ? 'video' : 'voice';
        const callType: CallType = item.type === 'group' ? 'voice-group' : media === 'video' ? 'video' : 'voice';
        const inviteeUserIds = item.participantId ? [item.participantId] : [];
        await startCall({
          conversationId: String(conversationId),
          title: item.participantName || 'Call',
          callType,
          media,
          inviteeUserIds,
        });
      } else if (conversationId) {
        // startCall not available — fall back to opening the chat room
        DeviceEventEmitter.emit('chat.open', {
          conversationId: String(conversationId),
          name: item.participantName,
          kind: 'dm',
        });
        onBack?.();
      } else {
        Alert.alert('Call back', 'Unable to reach this contact right now.');
      }
    } catch {
      Alert.alert('Call back', 'Unable to start the call. Please try again.');
    } finally {
      setCallingBack(null);
    }
  }, [callingBack, startCall, onBack]);

  const directionIcon = (direction: NormalisedEntry['direction']) => {
    if (direction === 'outgoing') return { symbol: '↗', color: palette.success };
    if (direction === 'missed') return { symbol: '✕', color: palette.danger };
    return { symbol: '↙', color: palette.primary };
  };

  const typeIcon = (type: NormalisedEntry['type']) => {
    if (type === 'video') return 'video';
    if (type === 'group') return 'users';
    return 'phone';
  };

  const formatDur = (secs: number) => {
    if (secs <= 0) return '';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const renderItem = ({ item }: { item: NormalisedEntry }) => {
    const dir = directionIcon(item.direction);
    const time = new Date(item.startedAt);
    const timeLabel = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateLabel = time.toLocaleDateString([], { month: 'short', day: 'numeric' });
    const dur = formatDur(item.durationSeconds);
    const isCallingThisBack = callingBack === item.callId;
    return (
      <View style={[localStyles.row, { backgroundColor: palette.card, borderColor: palette.divider }]}>
        {/* Left: type icon */}
        <View style={[localStyles.iconWrap, { backgroundColor: palette.primarySoft ?? palette.surface }]}>
          <KISIcon name={typeIcon(item.type) as any} size={20} color={palette.primaryStrong ?? palette.primary} />
        </View>

        {/* Center: name + direction + duration */}
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={{ fontWeight: '700', fontSize: 14, color: palette.text }} numberOfLines={1}>
            {item.participantName || 'Unknown'}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <Text style={{ fontSize: 14, color: dir.color }}>{dir.symbol}</Text>
            <Text style={{ fontSize: 12, color: palette.subtext, textTransform: 'capitalize' }}>
              {item.direction}{dur ? ` · ${dur}` : ''}
            </Text>
          </View>
        </View>

        {/* Right: date/time + call-back button */}
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <Text style={{ fontSize: 11, color: palette.subtext }}>{dateLabel}</Text>
          <Text style={{ fontSize: 11, color: palette.subtext }}>{timeLabel}</Text>
          <Pressable
            onPress={() => void handleCallBack(item)}
            hitSlop={10}
            disabled={!!callingBack}
            accessibilityLabel="Call back"
            accessibilityRole="button"
            style={({ pressed }) => [
              localStyles.callBackBtn,
              {
                backgroundColor: palette.primarySoft ?? (palette.primary + '22'),
                opacity: pressed || isCallingThisBack ? 0.5 : 1,
              },
            ]}
          >
            <KISIcon
              name="phone"
              size={15}
              color={palette.primaryStrong ?? palette.primary}
            />
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <View style={[localStyles.root, { backgroundColor: palette.bg }]}>
      {/* Header */}
      <View style={[localStyles.header, { paddingTop: insets.top + 8, borderBottomColor: palette.divider, backgroundColor: palette.card }]}>
        {onBack && (
          <Pressable onPress={onBack} style={localStyles.backBtn} hitSlop={10}>
            <KISIcon name="arrow-left" size={22} color={palette.primary} />
          </Pressable>
        )}
        <Text style={[localStyles.title, { color: palette.text }]}>Call history</Text>
        {entries.length > 0 && (
          <Pressable onPress={handleClear} style={localStyles.clearBtn} hitSlop={10}>
            <Text style={{ color: palette.danger, fontWeight: '700', fontSize: 13 }}>Clear</Text>
          </Pressable>
        )}
      </View>

      <FlatList
        data={entries}
        keyExtractor={(item) => item.callId}
        renderItem={renderItem}
        contentContainerStyle={{ padding: responsive.pageGutter, width: '100%', maxWidth: responsive.contentMaxWidth, alignSelf: 'center' }}
        ListEmptyComponent={
          <View style={{ paddingVertical: responsive.pageGutter * 2, alignItems: 'center' }}>
            <Text style={{ color: palette.subtext }}>No call history yet.</Text>
          </View>
        }
      />
    </View>
  );
}

const localStyles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: { marginRight: 12 },
  title: { flex: 1, fontSize: 18, fontWeight: '800' },
  clearBtn: { marginLeft: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callBackBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
