// Scheduled Messages — a dedicated, cross-conversation view of every
// message the current user has queued to send later. Server-backed (not
// local device state) so it stays correct across app restarts and other
// devices signed into the same account; see
// src/services/scheduledMessages.ts for the REST client and
// ScheduledMessagesController (Nest) for the authoritative source.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { useSafeTopInset } from '@/hooks/useSafeTopInset';
import { KISIcon } from '@/constants/kisIcons';
import { getCurrentAuthUserId } from '@/storage/userScopedProfileCache';
import { fetchConversationsForCurrentUser } from '@/Module/ChatRoom/normalizeConversation';
import {
  cancelScheduledMessage,
  fetchScheduledMessages,
  rescheduleScheduledMessage,
  ScheduledMessageView,
} from '@/services/scheduledMessages';
import { ScheduleMessageSheet } from '@/Module/ChatRoom/componets/main/ScheduleMessageSheet';

type Props = { onBack?: () => void };

function statusLabel(status: ScheduledMessageView['status']): string {
  switch (status) {
    case 'scheduled': return 'Scheduled';
    case 'processing': return 'Sending';
    case 'failed': return 'Retrying';
    default: return status;
  }
}

function statusColor(status: ScheduledMessageView['status'], palette: any): string {
  switch (status) {
    case 'processing': return palette.primary;
    case 'failed': return palette.danger;
    default: return palette.subtext;
  }
}

export default function ScheduledMessagesScreen({ onBack }: Props) {
  const navigation = useNavigation<any>();
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const topInset = useSafeTopInset();

  const [items, setItems] = useState<ScheduledMessageView[]>([]);
  const [conversationNames, setConversationNames] = useState<Record<string, string>>({});
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<ScheduledMessageView | null>(null);

  const load = useCallback(async (opts: { append?: boolean } = {}) => {
    if (opts.append) setLoadingMore(true);
    else { setLoading(true); setError(null); }
    try {
      const page = await fetchScheduledMessages({ limit: 50, cursor: opts.append ? cursor : null });
      setItems((prev) => (opts.append ? [...prev, ...page.items] : page.items));
      setCursor(page.nextCursor);
    } catch {
      if (!opts.append) setError('Could not load scheduled messages.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [cursor]);

  // Conversation names aren't part of the scheduled-message record itself
  // (the server only knows a bare conversationId) — reuse the already-
  // normalized chat list the Messages tab itself loads from, rather than
  // adding a second "resolve a conversation's name" server round trip.
  const loadConversationNames = useCallback(async () => {
    try {
      const userId = await getCurrentAuthUserId();
      const chats = await fetchConversationsForCurrentUser([], userId ?? undefined);
      const map: Record<string, string> = {};
      for (const chat of chats) {
        const id = String((chat as any).conversationId ?? chat.id);
        if (id) map[id] = chat.name || chat.title || 'Chat';
      }
      setConversationNames(map);
    } catch { /* names are best-effort — falls back to a generic label */ }
  }, []);

  useEffect(() => {
    void load();
    void loadConversationNames();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Live refresh: once a pending item is actually sent/fails/gets cancelled
  // (by this device or another of the user's own devices), drop it from —
  // or update its status in — the list without the user having to pull to
  // refresh. Still falls back correctly without this: re-opening the
  // screen always re-fetches from the server anyway.
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('chat.scheduled_message_updated', (payload: any) => {
      const id = String(payload?.id ?? '');
      if (!id) return;
      if (payload?.status === 'sent' || payload?.status === 'cancelled') {
        setItems((prev) => prev.filter((it) => it.id !== id));
      } else {
        setItems((prev) => prev.map((it) => (it.id === id ? { ...it, status: payload.status } : it)));
      }
    });
    return () => sub.remove();
  }, []);

  const handleOpenConversation = useCallback((item: ScheduledMessageView) => {
    DeviceEventEmitter.emit('chat.open', {
      conversationId: item.conversationId,
      name: conversationNames[item.conversationId] ?? 'Chat',
    });
  }, [conversationNames]);

  const handleCancel = useCallback((item: ScheduledMessageView) => {
    Alert.alert(
      'Cancel scheduled message?',
      'This message will not be sent.',
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Cancel message',
          style: 'destructive',
          onPress: async () => {
            const result = await cancelScheduledMessage(item.id);
            if (result.ok) {
              setItems((prev) => prev.filter((it) => it.id !== item.id));
            } else {
              // Never claim success for a message delivery already made
              // irreversible — tell the user exactly why, and refresh so
              // the list reflects its real current status.
              Alert.alert('Could not cancel', result.error || `This message is already ${result.status}.`);
              void load();
            }
          },
        },
      ],
    );
  }, [load]);

  const handleRescheduleConfirm = useCallback(async (scheduledAtIso: string) => {
    const target = rescheduleTarget;
    setRescheduleTarget(null);
    if (!target) return;
    const result = await rescheduleScheduledMessage(target.id, { scheduledAt: scheduledAtIso });
    if (result.ok && result.data) {
      setItems((prev) => prev.map((it) => (it.id === target.id ? result.data! : it)));
    } else {
      Alert.alert('Could not reschedule', result.error || `This message is already ${result.status}.`);
      void load();
    }
  }, [rescheduleTarget, load]);

  const renderItem = useCallback(({ item }: { item: ScheduledMessageView }) => {
    const date = new Date(item.scheduledAt);
    const dateLabel = date.toLocaleString(undefined, {
      weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
    const canEdit = item.status === 'scheduled';
    return (
      <View style={[styles.row, { backgroundColor: palette.card, borderColor: palette.divider }]}>
        <Pressable onPress={() => handleOpenConversation(item)} style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: palette.text }} numberOfLines={1}>
              {conversationNames[item.conversationId] ?? 'Chat'}
            </Text>
            <Text style={{ fontSize: 11, fontWeight: '700', color: statusColor(item.status, palette) }}>
              {statusLabel(item.status)}
            </Text>
          </View>
          <Text style={{ fontSize: 13, color: palette.subtext, marginTop: 3 }} numberOfLines={2}>
            {item.preview.hasAttachment ? '📎 ' : ''}
            {item.preview.text ?? (item.preview.hasAttachment ? 'Attachment' : 'Encrypted message')}
          </Text>
          <Text style={{ fontSize: 12, color: palette.subtext, marginTop: 4 }}>
            {dateLabel}
          </Text>
          {item.status === 'failed' && item.lastError ? (
            <Text style={{ fontSize: 11, color: palette.danger, marginTop: 4 }} numberOfLines={2}>
              {item.lastError}
            </Text>
          ) : null}
        </Pressable>

        <View style={{ gap: 8, alignItems: 'flex-end' }}>
          {canEdit && (
            <Pressable
              onPress={() => setRescheduleTarget(item)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Reschedule"
              style={[styles.actionBtn, { backgroundColor: `${palette.primary}18` }]}
            >
              <KISIcon name="calendar" size={16} color={palette.primary} />
            </Pressable>
          )}
          {(item.status === 'scheduled' || item.status === 'failed') && (
            <Pressable
              onPress={() => handleCancel(item)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Cancel scheduled message"
              style={[styles.actionBtn, { backgroundColor: `${palette.danger}18` }]}
            >
              <KISIcon name="trash" size={16} color={palette.danger} />
            </Pressable>
          )}
        </View>
      </View>
    );
  }, [palette, conversationNames, handleOpenConversation, handleCancel]);

  const handleBack = useCallback(() => {
    if (onBack) return onBack();
    navigation.goBack();
  }, [onBack, navigation]);

  return (
    <View style={[styles.root, { backgroundColor: palette.bg }]}>
      <View style={[styles.header, { paddingTop: topInset + 8, borderBottomColor: palette.divider, backgroundColor: palette.card }]}>
        <Pressable onPress={handleBack} style={styles.backBtn} hitSlop={10} accessibilityRole="button" accessibilityLabel="Go back">
          <KISIcon name="arrow-left" size={22} color={palette.primary} />
        </Pressable>
        <Text style={[styles.title, { color: palette.text }]}>Scheduled messages</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={palette.primary} style={{ marginTop: 40 }} />
      ) : error ? (
        <View style={{ padding: responsive.pageGutter * 2, alignItems: 'center' }}>
          <KISIcon name="warning" size={32} color={palette.danger} />
          <Text style={{ color: palette.subtext, marginTop: 12, textAlign: 'center' }}>{error}</Text>
          <Pressable
            onPress={() => load()}
            style={[styles.retryBtn, { borderColor: palette.primary }]}
            accessibilityRole="button"
            accessibilityLabel="Retry"
          >
            <Text style={{ color: palette.primary, fontWeight: '700' }}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: responsive.pageGutter, width: '100%', maxWidth: responsive.contentMaxWidth, alignSelf: 'center' }}
          refreshing={loading}
          onRefresh={() => load()}
          onEndReachedThreshold={0.4}
          onEndReached={() => { if (cursor && !loadingMore) void load({ append: true }); }}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={palette.primary} style={{ marginVertical: 16 }} /> : null}
          ListEmptyComponent={
            <View style={{ paddingVertical: responsive.pageGutter * 2, alignItems: 'center' }}>
              <KISIcon name="calendar" size={40} color={palette.subtext} />
              <Text style={{ color: palette.subtext, marginTop: 12, fontSize: 15 }}>
                No scheduled messages.
              </Text>
              <Text style={{ color: palette.subtext, marginTop: 4, fontSize: 13, textAlign: 'center', paddingHorizontal: 32 }}>
                Long-press the send button in any chat to schedule a message for later.
              </Text>
            </View>
          }
        />
      )}

      {rescheduleTarget && (
        <ScheduleMessageSheet
          visible
          onClose={() => setRescheduleTarget(null)}
          onSchedule={handleRescheduleConfirm}
          palette={palette}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    gap: 10,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryBtn: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
});
