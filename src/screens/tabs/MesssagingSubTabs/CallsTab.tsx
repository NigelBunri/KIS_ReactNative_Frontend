import { useKISTheme } from '@/theme/useTheme';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
} from 'react-native';
import { KISIcon } from '@/constants/kisIcons';
import Skeleton from '@/components/common/Skeleton';
import { getRequest } from '@/network/get';
import { NEST_API_BASE_URL } from '@/network';
import { useSocket } from '../../../../SocketProvider';
import { fetchConversationsForCurrentUser } from '@/Module/ChatRoom/normalizeConversation';

type CallHistoryItem = {
  id: string;
  conversationId: string;
  callId: string;
  createdBy: string;
  status: string;
  media?: string;
  startedAt?: string;
  endedAt?: string | null;
  participants?: { userId: string; status: string }[];
};

type CallsTabProps = {
  searchTerm?: string;
};

export default function CallsTab({ searchTerm = '' }: CallsTabProps) {
  const { palette } = useKISTheme();
  const { currentUserId } = useSocket();
  const [loading, setLoading] = useState(true);
  const [calls, setCalls] = useState<CallHistoryItem[]>([]);
  const [conversationNameById, setConversationNameById] = useState<Record<string, string>>({});

  const loadCalls = useCallback(async () => {
    setLoading(true);
    const url = `${NEST_API_BASE_URL}/calls/history?limit=50`;
    const res = await getRequest(url);
    if (res.success && Array.isArray(res.data?.calls)) {
      setCalls(res.data.calls as CallHistoryItem[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadCalls();
  }, [loadCalls]);

  useEffect(() => {
    const loadConversations = async () => {
      const convs = await fetchConversationsForCurrentUser([], currentUserId ?? undefined);
      const map: Record<string, string> = {};
      for (const c of convs) {
        if (c?.conversationId) map[String(c.conversationId)] = c.name ?? 'Conversation';
        if (c?.id) map[String(c.id)] = c.name ?? 'Conversation';
      }
      setConversationNameById(map);
    };
    loadConversations();
  }, [currentUserId]);

  const rows = useMemo(() => {
    if (!searchTerm.trim()) return calls;
    const q = searchTerm.trim().toLowerCase();
    return calls.filter((item) => {
      const name =
        conversationNameById[item.conversationId] ??
        `Conversation ${item.conversationId?.slice?.(0, 6) ?? ''}`;
      return (
        name.toLowerCase().includes(q) ||
        String(item.status ?? '').toLowerCase().includes(q)
      );
    });
  }, [calls, conversationNameById, searchTerm]);

  const renderItem = ({ item }: { item: CallHistoryItem }) => {
    const name =
      conversationNameById[item.conversationId] ??
      `Conversation ${item.conversationId?.slice?.(0, 6) ?? ''}`;
    const when = item.startedAt ? new Date(item.startedAt) : null;
    const timeLabel = when ? when.toLocaleString() : '';
    const statusLabel =
      item.status === 'ended'
        ? 'Ended'
        : item.status === 'active'
        ? 'Active'
        : 'Ringing';
    const iconName = item.media === 'video' ? 'video' : 'mic';

    return (
      <Pressable
        style={[
          styles.row,
          {
            borderColor: palette.inputBorder,
            backgroundColor: palette.card,
          },
        ]}
      >
        <View
          style={[
            styles.rowIcon,
            { backgroundColor: palette.surface },
          ]}
        >
          <KISIcon name={iconName} size={18} color={palette.text} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.rowTitle, { color: palette.text }]} numberOfLines={1}>
            {name}
          </Text>
          <Text style={[styles.rowMeta, { color: palette.subtext }]} numberOfLines={1}>
            {statusLabel} {timeLabel ? `• ${timeLabel}` : ''}
          </Text>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={[styles.wrap, { backgroundColor: palette.bg }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.headerTitle, { color: palette.text }]}>Calls</Text>
        <Pressable onPress={loadCalls}>
          <KISIcon name="refresh" size={18} color={palette.text} />
        </Pressable>
      </View>

      {loading ? (
        <View style={{ gap: 12 }}>
          {Array.from({ length: 5 }).map((_, idx) => (
            <View
              key={`call-skel-${idx}`}
              style={[
                styles.row,
                { borderColor: palette.inputBorder, backgroundColor: palette.card },
              ]}
            >
              <Skeleton width={40} height={40} radius={20} />
              <View style={{ flex: 1 }}>
                <Skeleton width="50%" height={12} radius={6} />
                <Skeleton width="30%" height={10} radius={6} style={{ marginTop: 6 }} />
              </View>
            </View>
          ))}
        </View>
      ) : rows.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ color: palette.subtext }}>No call history yet.</Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 16 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitle: { fontSize: 20, fontWeight: '800' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowTitle: { fontSize: 15, fontWeight: '700' },
  rowMeta: { marginTop: 2, fontSize: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
