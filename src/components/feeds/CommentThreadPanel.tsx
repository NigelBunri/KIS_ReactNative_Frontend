import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { useSocket } from '@/SocketProvider';
import { KISIcon } from '@/constants/kisIcons';
import {
  ChatEvents,
  CommentMessage,
  mapCommentPayload,
  parseCommentTimestamp,
} from './commentThreadUtils';

const MAX_VISIBLE_COMMENTS = 5;
const ROW_EST_HEIGHT = 62;
const MAX_LIST_HEIGHT = MAX_VISIBLE_COMMENTS * ROW_EST_HEIGHT + 16;

type Props = {
  postId: string;
  initialConversationId?: string | null;
  fetchConversationId?: () => Promise<string | null>;
  onConversationResolved?: (conversationId: string | null) => void;
  onMessageCountChange?: (count: number) => void;
  headerLabel?: string;
  contextLabel?: string;
  placeholder?: string;
  onScrollStart?: () => void;
  onScrollEnd?: () => void;
  useScrollView?: boolean;
};

type HistoryAck = {
  ok: boolean;
  error?: string;
  data?: { messages?: any[] };
};

type SendAck = {
  ok: boolean;
  error?: string;
  data?: {
    clientId?: string;
    serverId?: string;
    id?: string; // some servers use id instead of serverId
    createdAt?: string;
    seq?: number;
  };
};

export default function CommentThreadPanel({
  postId,
  initialConversationId,
  fetchConversationId,
  onConversationResolved,
  onMessageCountChange,
  headerLabel = 'Comments',
  contextLabel,
  placeholder,
  onScrollStart,
  onScrollEnd,
  useScrollView = false,
}: Props) {
  const { palette } = useKISTheme();
  const { socket, isConnected, currentUserId } = useSocket();

  const [conversationId, setConversationId] = useState<string | null | undefined>(
    initialConversationId ?? undefined,
  );

  const [messages, setMessages] = useState<CommentMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [fetchingConversation, setFetchingConversation] = useState(false);

  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMoreOlder, setHasMoreOlder] = useState(true);

  const [replyTarget, setReplyTarget] = useState<CommentMessage | null>(null);

  const flatListRef = useRef<FlatList<CommentMessage>>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const joinedRef = useRef(false);

  // ✅ FIX: this ref MUST be declared before any effect uses it (TDZ crash otherwise)
  const onMessageCountChangeRef = useRef(onMessageCountChange);
  useEffect(() => {
    onMessageCountChangeRef.current = onMessageCountChange;
  }, [onMessageCountChange]);

  useEffect(() => {
    setConversationId(initialConversationId ?? undefined);
  }, [initialConversationId]);

  // Resolve conversationId lazily if needed
  useEffect(() => {
    if (conversationId !== undefined || !fetchConversationId) return;

    let active = true;
    setFetchingConversation(true);

    fetchConversationId()
      .then((resolved) => {
        if (!active) return;
        if (resolved) {
          setConversationId(resolved);
          onConversationResolved?.(resolved);
          console.log(`${logPrefix} resolved conversationId`, {
            resolved,
            postId,
          });
        } else {
          setConversationId(null);
          setStatusMessage('Comments unavailable.');
        }
      })
      .catch(() => {
        if (!active) return;
        setConversationId(null);
        setStatusMessage('Unable to load comments.');
      })
      .finally(() => {
        if (active) setFetchingConversation(false);
      });

    return () => {
      active = false;
    };
  }, [conversationId, fetchConversationId, onConversationResolved, postId]);

  const sortByCreatedAt = useCallback((arr: CommentMessage[]) => {
    arr.sort((a, b) => parseCommentTimestamp(a.createdAt) - parseCommentTimestamp(b.createdAt));
    return arr;
  }, []);

  const upsertMany = useCallback(
    (incoming: CommentMessage[]) => {
      if (!incoming.length) return;

      setMessages((prev) => {
        const byId = new Map<string, CommentMessage>();
        const byClientId = new Map<string, string>(); // clientId -> id

        for (const m of prev) {
          byId.set(m.id, m);
          if (m.clientId) byClientId.set(m.clientId, m.id);
        }

        for (const m of incoming) {
          const existingId =
            (m.clientId && byClientId.get(m.clientId)) || (byId.has(m.id) ? m.id : null);

          if (existingId) {
            const old = byId.get(existingId)!;
            byId.set(existingId, { ...old, ...m, id: old.id }); // keep stable key
          } else {
            byId.set(m.id, m);
            if (m.clientId) byClientId.set(m.clientId, m.id);
          }
        }

        return sortByCreatedAt(Array.from(byId.values()));
      });
    },
    [sortByCreatedAt],
  );

  const addOne = useCallback(
    (message: CommentMessage) => {
      upsertMany([message]);
    },
    [upsertMany],
  );

  // Join/Leave (safe + only when connected)
  useEffect(() => {
    if (!socket || !conversationId) return;

    if (!(isConnected || socket.connected)) return;
    if (joinedRef.current) return;

    joinedRef.current = true;
    socket.emit(ChatEvents.JOIN, { conversationId }, (ack: any) => {
      if (!ack?.ok) {
        setStatusMessage(ack?.error ?? 'Unable to join conversation.');
        console.warn(`${logPrefix} join failed`, { conversationId, ack });
      } else {
        setStatusMessage(null);
        console.log(`${logPrefix} joined conversation`, { conversationId, ack });
      }
    });

    return () => {
      // leave on unmount OR conversation switch
      try {
        if (socket && conversationId) socket.emit(ChatEvents.LEAVE, { conversationId });
      } finally {
        joinedRef.current = false;
      }
    };
  }, [conversationId, socket, isConnected]);

  // Live messages
  useEffect(() => {
    if (!conversationId || !socket) return;

    const handler = (payload: any) => {
      if (payload?.conversationId !== conversationId) return;
      const mapped = mapCommentPayload(payload, conversationId, currentUserId);
      addOne(mapped);
    };

    socket.on(ChatEvents.MESSAGE, handler);
    return () => {
      socket.off(ChatEvents.MESSAGE, handler);
    };
  }, [conversationId, socket, addOne, currentUserId]);

  const earliestCreatedAt = useMemo(() => {
    if (!messages.length) return null;
    return messages[0]?.createdAt ?? null;
  }, [messages]);

  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      if (useScrollView) {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      } else {
        flatListRef.current?.scrollToEnd({ animated: true });
      }
    }, 50);
  }, [useScrollView]);

  useEffect(() => {
    if (!messages.length) return;
    onMessageCountChangeRef.current?.(messages.length);
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, []);

  const fetchHistory = useCallback(
    async (opts: { mode: 'initial' | 'older'; before?: string | null }) => {
      if (!socket || !conversationId) return;

      const connected = isConnected || socket.connected;
      if (!connected) return;

      console.log(`${logPrefix} fetchHistory`, {
        conversationId,
        mode: opts.mode,
        before: opts.before,
      });
      const limit = opts.mode === 'older' ? 30 : 60;

      // We keep this flexible for your backend:
      // - If backend supports "before", it will return older than that timestamp/seq.
      // - If not, it should simply ignore it and return latest.
      const payload: any = { conversationId, limit };
      if (opts.before) payload.before = opts.before;

      if (opts.mode === 'initial') setLoading(true);
      else setLoadingOlder(true);

      socket.timeout(7000).emit(ChatEvents.HISTORY, payload, (err: any, ack?: HistoryAck) => {
        if (opts.mode === 'initial') setLoading(false);
        else setLoadingOlder(false);

        if (err || !ack?.ok) {
          setStatusMessage(err?.message ?? ack?.error ?? 'Unable to load comments.');
          return;
        }

        const items = Array.isArray(ack?.data?.messages) ? ack!.data!.messages! : [];
        const mapped = items.map((item: any) => mapCommentPayload(item, conversationId, currentUserId));
        mapped.sort((a, b) => parseCommentTimestamp(a.createdAt) - parseCommentTimestamp(b.createdAt));

        if (!mapped.length) {
          if (opts.mode === 'older') setHasMoreOlder(false);
          return;
        }

        // If "older" returns the same earliest again, stop to prevent infinite loops
        if (opts.mode === 'older' && earliestCreatedAt && mapped[0]?.createdAt === earliestCreatedAt) {
          setHasMoreOlder(false);
          return;
        }

        upsertMany(mapped);

        // heuristic: if server returned fewer than requested, assume no more older
        if (opts.mode === 'older' && mapped.length < limit) setHasMoreOlder(false);
      });
    },
    [socket, conversationId, isConnected, currentUserId, upsertMany, earliestCreatedAt],
  );

  // Initial load + reload on reconnect / conversation change
  useEffect(() => {
    if (!conversationId || !socket) return;
    setHasMoreOlder(true);
    fetchHistory({ mode: 'initial', before: null });
  }, [conversationId, socket, isConnected, fetchHistory]);

  const loadOlder = useCallback(() => {
    if (!hasMoreOlder || loadingOlder) return;
    fetchHistory({ mode: 'older', before: earliestCreatedAt });
  }, [hasMoreOlder, loadingOlder, fetchHistory, earliestCreatedAt]);

  const handleSelectReply = useCallback((message: CommentMessage) => {
    setReplyTarget((prev) => (prev?.id === message.id ? null : message));
  }, []);

  const sendComment = useCallback(() => {
    if (!socket || !conversationId) return;

    const text = draft.trim();
    if (!text) return;

    const clientId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // optimistic message
    const replyToId = replyTarget?.id;

    const optimistic: CommentMessage = {
      id: clientId,
      clientId,
      text,
      senderName: 'You',
      createdAt: new Date().toISOString(),
      mine: true,
      // optional helpers if your UI wants them
      pending: true as any,
      replyToId,
    } as any;

    console.log(`${logPrefix} dispatch send`, {
      socketId: socket.id,
      connected: socket.connected,
      conversationId,
      clientId,
      replyToId,
      text: text.slice(0, 40),
    });
    addOne(optimistic);
    setDraft('');
    if (replyToId) setReplyTarget(null);
    if (replyToId) {
      setExpandedThreads((prev) => ({ ...prev, [replyToId]: true }));
    }

    socket.emit(
      ChatEvents.SEND,
      {
        conversationId,
        clientId,
        kind: 'text',
        text,
        replyToId,
      },
      (ack: SendAck) => {
        if (!ack?.ok) {
          console.error(`${logPrefix} send ack error`, {
            socketId: socket.id,
            conversationId,
            clientId,
            ack,
          });
          setStatusMessage(ack?.error ?? 'Unable to post comment.');
          // mark failed (keep message visible)
          setMessages((prev) =>
            prev.map((m) => (m.clientId === clientId ? ({ ...m, pending: false, failed: true } as any) : m)),
          );
          return;
        }

        const serverId = ack?.data?.serverId || ack?.data?.id;
        const createdAt = ack?.data?.createdAt;

        if (serverId || createdAt) {
          setMessages((prev) =>
            prev.map((m) => {
              if (m.clientId !== clientId) return m;
              return {
                ...m,
                id: serverId ?? m.id,
                createdAt: createdAt ?? m.createdAt,
                pending: false as any,
                failed: false as any,
              } as any;
            }),
          );
          console.log(`${logPrefix} send ack success`, {
            socketId: socket.id,
            conversationId,
            clientId,
            serverId,
            createdAt,
          });
        } else {
          // even without server fields, mark as delivered
          setMessages((prev) =>
            prev.map((m) => (m.clientId === clientId ? ({ ...m, pending: false, failed: false } as any) : m)),
          );
        }
      },
    );
  }, [socket, conversationId, draft, addOne, replyTarget]);

  const canSend = Boolean(draft.trim().length && socket && conversationId);

  const statusLabel =
    statusMessage ||
    ((isConnected || socket?.connected) ? 'Online' : 'Offline – comments sync when online');

  const filteredMessages = useMemo(() => (messages.length ? messages : []), [messages]);

  const [expandedThreads, setExpandedThreads] = useState<Record<string, boolean>>({});
  const logPrefix = '[CommentThreadPanel]';

  const toggleThread = useCallback((id: string) => {
    setExpandedThreads((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const jumpToEarliest = useCallback(() => {
    if (useScrollView) {
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, [useScrollView]);

  const jumpToLatest = useCallback(() => {
    if (useScrollView) {
      scrollViewRef.current?.scrollToEnd({ animated: true });
      return;
    }
    flatListRef.current?.scrollToEnd({ animated: true });
  }, [useScrollView]);

  const { topLevelComments, repliesByParent } = useMemo(() => {
    const parents: CommentMessage[] = [];
    const children = new Map<string, CommentMessage[]>();

    const sortMessages = (arr: CommentMessage[]) => {
      arr.sort((a, b) => parseCommentTimestamp(a.createdAt) - parseCommentTimestamp(b.createdAt));
    };

    filteredMessages.forEach((message) => {
      const parentId = message.replyToId ?? null;
      if (parentId) {
        const list = children.get(parentId) ?? [];
        list.push(message);
        children.set(parentId, list);
      } else {
        parents.push(message);
      }
    });

    sortMessages(parents);
    children.forEach((list) => sortMessages(list));
    return { topLevelComments: parents, repliesByParent: children };
  }, [filteredMessages]);

  const renderCommentRow = useCallback(
    (item: CommentMessage, options?: { isReply?: boolean }) => {
      const isReply = options?.isReply ?? false;
      const isTarget = replyTarget?.id === item.id;
      const isPending = Boolean((item as any).pending);
      const isFailed = Boolean((item as any).failed);
      const replyCount = repliesByParent.get(item.id)?.length ?? 0;
      const isExpanded = Boolean(expandedThreads[item.id]);

      return (
        <View
          style={[
            commentStyles.commentRowWrapper,
            isReply ? commentStyles.commentReplyWrapper : null,
          ]}
        >
          {!isReply && replyCount > 0 && <View style={commentStyles.threadIndicator} />}
          {isReply && <View style={commentStyles.replyLine} />}

          <Pressable
            onPress={() => handleSelectReply(item)}
            style={({ pressed }) => [
              commentStyles.commentRow,
              isReply ? commentStyles.commentReplyRow : null,
              item.mine ? commentStyles.commentMine : commentStyles.commentOther,
              isTarget ? commentStyles.commentSelected : null,
              isFailed ? commentStyles.commentFailed : null,
              pressed ? { opacity: 0.85 } : null,
            ]}
          >
            <View style={[commentStyles.avatar, { backgroundColor: palette.primarySoft }]}>
              <Text style={[commentStyles.avatarLabel, { color: palette.text }]}>
                {item.senderName.slice(0, 2).toUpperCase()}
              </Text>
            </View>

            <View style={commentStyles.commentBody}>
              <View style={commentStyles.commentHeader}>
                <Text style={[commentStyles.commentAuthor, { color: palette.text }]}>
                  {item.senderName}
                </Text>
                <Text style={[commentStyles.commentTime, { color: palette.subtext }]}>
                  {new Date(item.createdAt).toLocaleTimeString()}
                  {isPending ? ' · sending…' : isFailed ? ' · failed' : ''}
                </Text>
              </View>

              <Text style={[commentStyles.commentText, { color: palette.text }]}>
                {item.text}
              </Text>
            </View>
          </Pressable>

          {!isReply && replyCount > 0 && (
            <Pressable
              onPress={() => toggleThread(item.id)}
              style={({ pressed }) => [
                commentStyles.replyToggle,
                pressed ? { opacity: 0.7 } : null,
              ]}
            >
              <View style={commentStyles.replyToggleRow}>
                <KISIcon
                  name="reply"
                  size={12}
                  color={palette.primary}
                  style={commentStyles.replyToggleReplyIcon}
                />
                <Text style={[commentStyles.replyToggleText, { color: palette.primary }]}>
                  {isExpanded
                    ? `Hide replies (${replyCount})`
                    : `View ${replyCount} repl${replyCount === 1 ? 'y' : 'ies'}`}
                </Text>
                <KISIcon
                  name="chevron-down"
                  size={12}
                  color={palette.primary}
                  style={[
                    commentStyles.replyToggleIcon,
                    { transform: [{ rotate: isExpanded ? '180deg' : '0deg' }] },
                  ]}
                />
              </View>
            </Pressable>
          )}
        </View>
      );
    },
    [
      handleSelectReply,
      palette.primary,
      palette.primarySoft,
      palette.subtext,
      palette.text,
      replyTarget,
      repliesByParent,
      expandedThreads,
      toggleThread,
    ],
  );

  const renderThread = useCallback(
    (item: CommentMessage) => {
      const replies = repliesByParent.get(item.id) ?? [];
      const isExpanded = Boolean(expandedThreads[item.id]);

      return (
        <>
          {renderCommentRow(item)}
          {isExpanded &&
            replies.map((reply) => (
              <React.Fragment key={reply.id}>{renderCommentRow(reply, { isReply: true })}</React.Fragment>
            ))}
        </>
      );
    },
    [expandedThreads, repliesByParent, renderCommentRow],
  );

  const threadsToRender = topLevelComments.length ? topLevelComments : filteredMessages;

  const renderCommentList = () => {
    if (useScrollView) {
      return (
        <ScrollView
          ref={scrollViewRef}
          style={[panelStyles.list, { maxHeight: MAX_LIST_HEIGHT }]}
          contentContainerStyle={panelStyles.listContent}
          showsVerticalScrollIndicator
          scrollEnabled={threadsToRender.length > 1}
          nestedScrollEnabled
          onScrollBeginDrag={onScrollStart}
          onScrollEndDrag={onScrollEnd}
        >
          {threadsToRender.map((item) => (
            <React.Fragment key={item.id}>{renderThread(item)}</React.Fragment>
          ))}
        </ScrollView>
      );
    }

    return (
      <FlatList
        ref={flatListRef}
        data={threadsToRender}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => renderThread(item)}
        style={[panelStyles.list, { maxHeight: MAX_LIST_HEIGHT }]}
        contentContainerStyle={panelStyles.listContent}
        showsVerticalScrollIndicator
        scrollEnabled={threadsToRender.length > 1}
        nestedScrollEnabled
        maxToRenderPerBatch={MAX_VISIBLE_COMMENTS}
        onScrollBeginDrag={onScrollStart}
        onScrollEndDrag={onScrollEnd}
        getItemLayout={(_, index) => ({
          length: ROW_EST_HEIGHT,
          offset: ROW_EST_HEIGHT * index,
          index,
        })}
      />
    );
  };



  return (
    <View style={[panelStyles.root, { borderColor: palette.divider, backgroundColor: palette.card }]}>
      <View style={panelStyles.header}>
        <Text style={[panelStyles.headerLabel, { color: palette.text }]}>{headerLabel}</Text>

        {contextLabel ? (
          <Text style={[panelStyles.contextLabel, { color: palette.muted }]} numberOfLines={1}>
            {contextLabel}
          </Text>
        ) : null}

        <Text style={[panelStyles.statusLabel, { color: palette.muted }]}>{statusLabel}</Text>

        <View style={panelStyles.headerActionsRow}>
          <Pressable onPress={jumpToEarliest} style={panelStyles.headerAction}>
            <Text style={[panelStyles.headerActionLabel, { color: palette.primary }]}>Oldest</Text>
          </Pressable>
          <Pressable onPress={jumpToLatest} style={panelStyles.headerAction}>
            <Text style={[panelStyles.headerActionLabel, { color: palette.primary }]}>Latest</Text>
          </Pressable>
        </View>
      </View>

      <View
        style={[
          panelStyles.listWrapper,
          { borderColor: palette.divider, backgroundColor: palette.surface },
        ]}
      >
        {(loading || fetchingConversation) && !filteredMessages.length ? (
          <View style={panelStyles.loading}>
            <ActivityIndicator size="small" color={palette.primary} />
          </View>
        ) : filteredMessages.length ? (
          <>
            {hasMoreOlder ? (
              <Pressable
                onPress={loadOlder}
                disabled={loadingOlder}
                style={({ pressed }) => [
                  panelStyles.loadOlderButton,
                  { opacity: loadingOlder ? 0.5 : pressed ? 0.8 : 1 },
                ]}
              >
                {loadingOlder ? (
                  <ActivityIndicator size="small" color={palette.primary} />
                ) : (
                  <Text style={[panelStyles.loadOlderText, { color: palette.primary }]}>
                    Load older comments
                  </Text>
                )}
              </Pressable>
            ) : null}

            {renderCommentList()}
          </>
        ) : (
          <View style={panelStyles.emptyState}>
            <Text style={[panelStyles.emptyText, { color: palette.muted }]}>
              {fetchingConversation ? 'Loading…' : 'No comments yet.'}
            </Text>
          </View>
        )}
      </View>

      {replyTarget && (
        <View
          style={[
            panelStyles.replyPreview,
            { borderColor: palette.divider, backgroundColor: palette.surface },
          ]}
        >
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={[panelStyles.replyPreviewLabel, { color: palette.text }]} numberOfLines={1}>
              Replying to {replyTarget.senderName}
            </Text>
            <Text style={[panelStyles.replyPreviewText, { color: palette.subtext }]} numberOfLines={2}>
              {replyTarget.text}
            </Text>
          </View>
          <Pressable onPress={() => setReplyTarget(null)} style={panelStyles.replyPreviewClose}>
            <KISIcon name="close" size={14} color={palette.text} />
          </Pressable>
        </View>
      )}

      <View style={[panelStyles.composerRow, { borderTopColor: palette.divider }]}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={
            replyTarget
              ? `Replying to ${replyTarget.senderName}`
              : placeholder ?? 'Join the conversation…'
          }
          placeholderTextColor={palette.subtext}
          style={[
            panelStyles.composerInput,
            { color: palette.text, borderColor: palette.inputBorder },
          ]}
          multiline
          numberOfLines={2}
        />

        <Pressable
          onPress={sendComment}
          disabled={!canSend}
          style={({ pressed }) => [
            panelStyles.sendButton,
            {
              backgroundColor: palette.primary,
              opacity: !canSend ? 0.5 : pressed ? 0.85 : 1,
            },
          ]}
        >
          <KISIcon name="send" size={18} color="#fff" />
        </Pressable>
        </View>
      </View>
      );
}

const panelStyles = StyleSheet.create({
  root: {
    borderWidth: 2,
    borderRadius: 16,
    padding: 12,
    marginTop: 12,
    gap: 8,
  },
  header: {
    gap: 2,
  },
  headerLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  contextLabel: {
    fontSize: 12,
  },
  statusLabel: {
    fontSize: 11,
  },
  headerActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
  headerAction: {},
  headerActionLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  listWrapper: {
    minHeight: 60,
    maxHeight: MAX_LIST_HEIGHT,
    paddingHorizontal: 8,
    paddingVertical: 6,
    overflow: 'hidden',
  },
  list: {
    flexGrow: 0,
    alignSelf: 'stretch',
  },
  listContent: {
    paddingBottom: 8,
  },
  loading: {
    minHeight: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadOlderButton: {
    alignSelf: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 6,
    borderRadius: 10,
  },
  loadOlderText: {
    fontSize: 12,
    fontWeight: '600',
  },
  replyPreview: {
    borderWidth: 2,
    borderRadius: 12,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  replyPreviewLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  replyPreviewText: {
    fontSize: 12,
  },
  replyPreviewClose: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    minHeight: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
  },
  composerRow: {
    borderTopWidth: 1,
    paddingTop: 8,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-end',
  },
  composerInput: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 13,
    minHeight: 40,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const commentStyles = StyleSheet.create({
  commentRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 6,
    paddingLeft: 14,
    borderRadius: 12,
    marginBottom: 6,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  commentBody: {
    flex: 1,
  },
  commentRowWrapper: {
    position: 'relative',
    marginBottom: 8,
  },
  commentReplyWrapper: {
    marginLeft: 42,
  },
  commentReplyRow: {
    marginLeft: 0,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  commentAuthor: {
    fontSize: 12,
    fontWeight: '600',
  },
  commentTime: {
    fontSize: 10,
  },
  commentText: {
    fontSize: 13,
  },
  commentMine: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  commentOther: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
  },
  commentSelected: {
    borderWidth: 2,
    borderColor: '#60A5FA',
    shadowColor: '#60A5FA',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  commentFailed: {
    borderWidth: 2,
    borderColor: 'rgba(239, 68, 68, 0.6)',
  },
  replyToggle: {
    marginLeft: 46,
    marginTop: -6,
    marginBottom: 6,
    alignSelf: 'flex-start',
  },
  replyToggleText: {
    fontSize: 11,
    fontWeight: '600',
    flexShrink: 1,
  },
  replyToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  replyToggleIcon: {
    marginRight: 4,
  },
  replyLine: {
    position: 'absolute',
    left: 18,
    top: 8,
    bottom: -8,
    width: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    pointerEvents: 'none',
  },
  threadIndicator: {
    position: 'absolute',
    left: 14,
    top: 4,
    bottom: -4,
    width: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    pointerEvents: 'none',
  },
  replyToggleReplyIcon: {
    marginRight: 6,
  },
});
