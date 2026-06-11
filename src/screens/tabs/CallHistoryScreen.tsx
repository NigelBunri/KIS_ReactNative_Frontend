// GAP 7: Call History Screen
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';

export type CallLogEntry = {
  callId: string;
  participantName: string;
  participantId: string;
  type: 'audio' | 'video' | 'group';
  direction: 'incoming' | 'outgoing' | 'missed';
  startedAt: string; // ISO
  durationSeconds: number;
};

const CALL_LOG_KEY = 'KIS_CALL_LOG';
const MAX_CALL_LOG = 200;

export async function logCall(entry: CallLogEntry): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(CALL_LOG_KEY);
    const log: CallLogEntry[] = raw ? JSON.parse(raw) : [];
    // Prepend and cap
    const next = [entry, ...log].slice(0, MAX_CALL_LOG);
    await AsyncStorage.setItem(CALL_LOG_KEY, JSON.stringify(next));
  } catch { /* silent */ }
}

type Props = {
  onBack?: () => void;
};

export default function CallHistoryScreen({ onBack }: Props) {
  const { palette } = useKISTheme();
  const insets = useSafeAreaInsets();
  const [entries, setEntries] = useState<CallLogEntry[]>([]);

  const loadLog = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(CALL_LOG_KEY);
      if (raw) setEntries(JSON.parse(raw));
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    void loadLog();
  }, [loadLog]);

  const handleClear = () => {
    Alert.alert('Clear call history', 'Remove all call history entries?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.removeItem(CALL_LOG_KEY).catch(() => {});
          setEntries([]);
        },
      },
    ]);
  };

  const directionIcon = (direction: CallLogEntry['direction']) => {
    if (direction === 'outgoing') return { symbol: '↗', color: '#22C55E' };
    if (direction === 'missed') return { symbol: '✕', color: '#EF4444' };
    return { symbol: '↙', color: '#3B82F6' };
  };

  const typeIcon = (type: CallLogEntry['type']) => {
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

  const renderItem = ({ item }: { item: CallLogEntry }) => {
    const dir = directionIcon(item.direction);
    const time = new Date(item.startedAt);
    const timeLabel = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateLabel = time.toLocaleDateString([], { month: 'short', day: 'numeric' });
    const dur = formatDur(item.durationSeconds);
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

        {/* Right: date/time */}
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 11, color: palette.subtext }}>{dateLabel}</Text>
          <Text style={{ fontSize: 11, color: palette.subtext }}>{timeLabel}</Text>
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
            <Text style={{ color: '#EF4444', fontWeight: '700', fontSize: 13 }}>Clear</Text>
          </Pressable>
        )}
      </View>

      <FlatList
        data={entries}
        keyExtractor={(item) => item.callId}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={
          <View style={{ paddingVertical: 60, alignItems: 'center' }}>
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
});
