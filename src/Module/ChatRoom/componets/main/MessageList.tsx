import React, {
  useRef,
  useCallback,
  useState,
  useEffect,
  useMemo,
} from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  Animated,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

import { chatRoomStyles as styles } from '@/Module/ChatRoom/chatRoomStyles';
import { ChatMessage } from '../../chatTypes';
import { InteractiveMessageRow } from '../InteractiveMessageRow';
import CallHistoryRow from '../CallHistoryRow';
import type { CallHistoryEntry } from '../CallHistoryRow';

type TimelineItem =
  | { type: 'message'; message: ChatMessage; createdAt: string }
  | { type: 'call'; call: CallHistoryEntry; createdAt: string };

type MessageListProps = {
  messages: ChatMessage[];
  palette: any;
  isEmpty: boolean;
  currentUserId?: string;

  onReplyToMessage?: (message: ChatMessage) => void;
  onEditMessage?: (message: ChatMessage) => void;
  onForwardMessage?: (message: ChatMessage) => void;
  onDeleteMessage?: (message: ChatMessage) => void;
  onPinMessage?: (message: ChatMessage) => void;
  onReactMessage?: (message: ChatMessage, emoji: string) => void;
  onVotePoll?: (message: ChatMessage, optionId: string) => void;
  onRetryMessage?: (message: ChatMessage) => void;

  // Selection
  selectionMode?: boolean;
  selectedMessageIds?: string[];
  onStartSelection?: (message: ChatMessage) => void;
  onToggleSelect?: (message: ChatMessage) => void;

  /**
   * Allow parent (ChatRoomPage) and things like PinnedMessagesSheet
   * to get access to scroll/highlight helpers for a given message id.
   * This is how we'll "jump to pinned message" or "jump to root message of sub-room".
   */
  onMessageLocatorReady?: (helpers: {
    scrollToMessage: (messageId: string) => void;
    highlightMessage: (messageId: string) => void;
  }) => void;

  autoScrollEnabled?: boolean;
  startAtBottom?: boolean;
  onVisibleMessageIds?: (messageIds: string[]) => void;

  /** Called when the user scrolls near the top to load older messages. */
  onLoadOlder?: () => void;

  onStarMessage?: (message: ChatMessage) => void;
  onShowReadReceipts?: (message: ChatMessage) => void;
  onViewOnce?: (messageId: string) => void;
  onLocalDeleteMessage?: (message: ChatMessage) => void;
  onUpdateMessage?: (message: ChatMessage) => void;
  mentionMap?: Record<string, string>;
  participantMap?: Record<string, string>;
  participantAvatarMap?: Record<string, string>;
  isE2EE?: boolean;
  callHistory?: CallHistoryEntry[];
  onCallHistoryCallback?: (entry: CallHistoryEntry) => void;
};




export const MessageList: React.FC<MessageListProps> = ({
  messages,
  palette,
  isEmpty,
  currentUserId,
  onReplyToMessage,
  onEditMessage,
  onForwardMessage,
  onDeleteMessage,
  onPinMessage,
  onReactMessage,
  onVotePoll,
  onRetryMessage,
  selectionMode = false,
  selectedMessageIds = [],
  onStartSelection,
  onToggleSelect,
  onMessageLocatorReady,
  autoScrollEnabled = true,
  startAtBottom = true,
  onVisibleMessageIds,
  onLoadOlder,
  onStarMessage,
  onShowReadReceipts,
  onViewOnce,
  onLocalDeleteMessage,
  onUpdateMessage,
  mentionMap,
  participantMap,
  participantAvatarMap,
  isE2EE = false,
  callHistory = [],
  onCallHistoryCallback,
}) => {
  const listRef = useRef<FlatList<TimelineItem>>(null);
  const timelineItems = useMemo<TimelineItem[]>(() => {
    // Separate call_event messages from regular messages so they render as call rows.
    const regularMessages: TimelineItem[] = [];
    const inlineCallItems: TimelineItem[] = [];

    for (const message of messages) {
      if (message.kind === 'call_event' && message.callEvent) {
        const ce = message.callEvent;
        inlineCallItems.push({
          type: 'call',
          call: {
            callId: ce.callId,
            conversationId: message.conversationId ?? '',
            callType: ce.callType ?? 'voice',
            status: ce.status ?? 'completed',
            startedAt: message.createdAt,
            endedAt: message.createdAt,
            duration: ce.duration ?? null,
            participantCount: ce.participantCount,
            createdBy: ce.initiatedBy ?? message.senderId ?? '',
          } as CallHistoryEntry,
          createdAt: message.createdAt,
        });
      } else {
        regularMessages.push({ type: 'message', message, createdAt: message.createdAt });
      }
    }

    // callHistory prop holds entries fetched from the server separately; merge and
    // deduplicate by callId so a call never appears twice.
    const seenCallIds = new Set(inlineCallItems.map((i) => (i as any).call.callId));
    const legacyCallItems: TimelineItem[] = callHistory
      .filter((c) => !seenCallIds.has(c.callId))
      .map((call) => ({ type: 'call', call, createdAt: call.startedAt }));

    return [...regularMessages, ...inlineCallItems, ...legacyCallItems].sort((a, b) => {
      const timeDiff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (timeDiff !== 0) return timeDiff;
      const aKey = a.type === 'message' ? a.message.id : a.call.callId;
      const bKey = b.type === 'message' ? b.message.id : b.call.callId;
      return String(aKey).localeCompare(String(bKey));
    });
  }, [messages, callHistory]);

  const [highlightedMessageId, setHighlightedMessageId] = useState<
    string | null
  >(null);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const jumpBtnOpacity = useRef(new Animated.Value(0)).current;
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const visibleThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadOlderThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressAutoScrollRef = useRef(false);
  const isAtBottomRef = useRef(startAtBottom);
  const prevMessageCountRef = useRef(messages.length);
  const lastStartAtBottomRef = useRef<boolean | null>(startAtBottom);
  const viewabilityConfigRef = useRef({
    viewAreaCoveragePercentThreshold: 60,
    minimumViewTime: 150,
  });
  const onViewableItemsChangedRef = useRef(
    ({ viewableItems }: { viewableItems: Array<{ item: TimelineItem }> }) => {
      if (!onVisibleMessageIds) return;
      const ids = viewableItems
        .map((entry) => {
          if (entry.item.type !== 'message') return null;
          const item = entry.item.message;
          return item.serverId ?? item.id ?? item.clientId ?? null;
        })
        .filter(Boolean)
        .map((id) => String(id));
      if (ids.length) {
        onVisibleMessageIds(ids);
      }
    },
  );

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
      if (visibleThrottleRef.current) clearTimeout(visibleThrottleRef.current);
      if (loadOlderThrottleRef.current) clearTimeout(loadOlderThrottleRef.current);
    };
  }, []);

  useEffect(() => {
    if (lastStartAtBottomRef.current === startAtBottom) return;
    lastStartAtBottomRef.current = startAtBottom;
    isAtBottomRef.current = !!startAtBottom;
  }, [startAtBottom]);

  // Track new messages arriving while scrolled up
  useEffect(() => {
    const newCount = messages.length;
    const added = newCount - prevMessageCountRef.current;
    prevMessageCountRef.current = newCount;
    if (added > 0 && !isAtBottomRef.current) {
      setUnreadCount((n) => n + added);
    }
  }, [messages.length]);

  // Animate jump-to-latest button in/out
  useEffect(() => {
    Animated.timing(jumpBtnOpacity, {
      toValue: showJumpToLatest ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [showJumpToLatest, jumpBtnOpacity]);

  useEffect(() => {
    onViewableItemsChangedRef.current = ({
      viewableItems,
    }: {
      viewableItems: Array<{ item: TimelineItem }>;
    }) => {
      if (!onVisibleMessageIds) return;
      const ids = viewableItems
        .map((entry) => {
          if (entry.item.type !== 'message') return null;
          const item = entry.item.message;
          return item.serverId ?? item.id ?? item.clientId ?? null;
        })
        .filter(Boolean)
        .map((id) => String(id));
      if (!ids.length) return;
      if (visibleThrottleRef.current) return;
      visibleThrottleRef.current = setTimeout(() => {
        visibleThrottleRef.current = null;
        onVisibleMessageIds(ids);
      }, 500);
    };
  }, [onVisibleMessageIds]);

  const handleContentSizeChange = () => {
    if (!listRef.current) return;
    if (!autoScrollEnabled) return;
    if (suppressAutoScrollRef.current) return;
    if (!isAtBottomRef.current) return;
    listRef.current.scrollToEnd({ animated: true });
  };

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
      const padding = 48;
      const atBottom =
        layoutMeasurement.height + contentOffset.y >= contentSize.height - padding;
      isAtBottomRef.current = atBottom;
      if (atBottom) {
        setShowJumpToLatest(false);
        setUnreadCount(0);
      } else {
        setShowJumpToLatest(true);
      }

      // Detect scroll near top to load older messages
      if (onLoadOlder && contentOffset.y < 100 && !loadOlderThrottleRef.current) {
        loadOlderThrottleRef.current = setTimeout(() => {
          loadOlderThrottleRef.current = null;
        }, 2000);
        onLoadOlder();
      }
    },
    [onLoadOlder],
  );

  const scrollToMessage = useCallback(
    (messageId: string) => {
      if (!listRef.current) return;
      const index = timelineItems.findIndex((entry) => {
        if (entry.type !== 'message') return false;
        const m = entry.message;
        return (
          m.id === messageId ||
          m.serverId === messageId ||
          m.clientId === messageId
        );
      });
      if (index < 0) return;

      try {
        suppressAutoScrollRef.current = true;
        isAtBottomRef.current = false;
        listRef.current.scrollToIndex({
          index,
          animated: true,
          viewPosition: 0.3,
        });
        setTimeout(() => {
          suppressAutoScrollRef.current = false;
        }, 800);
      } catch {
        const approximateItemHeight = 72;
        suppressAutoScrollRef.current = true;
        isAtBottomRef.current = false;
        listRef.current.scrollToOffset({
          offset: Math.max(0, index * approximateItemHeight),
          animated: true,
        });
        setTimeout(() => {
          suppressAutoScrollRef.current = false;
        }, 800);
      }
    },
    [timelineItems],
  );

  const highlightMessage = useCallback((messageId: string) => {
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }
    setHighlightedMessageId(messageId);

    highlightTimeoutRef.current = setTimeout(() => {
      setHighlightedMessageId((current) =>
        current === messageId ? null : current,
      );
    }, 2000);
  }, []);

  const handlePressReplySource = useCallback(
    (messageId: string) => {
      scrollToMessage(messageId);
      highlightMessage(messageId);
    },
    [scrollToMessage, highlightMessage],
  );

  /**
   * Expose scrollToMessage + highlightMessage to the parent when ready.
   */
  useEffect(() => {
    if (!onMessageLocatorReady) return;

    onMessageLocatorReady({
      scrollToMessage,
      highlightMessage,
    });
  }, [onMessageLocatorReady, scrollToMessage, highlightMessage]);

  const jumpToLatest = useCallback(() => {
    listRef.current?.scrollToEnd({ animated: true });
    setShowJumpToLatest(false);
    setUnreadCount(0);
  }, []);

  if (isEmpty) {
    return (
      <View style={styles.emptyStateContainer}>
        <Text
          style={{
            color: palette.subtext,
            fontSize: 13,
            textAlign: 'center',
          }}
        >
          Select a chat to start messaging.
        </Text>
      </View>
    );
  }

  /**
   * Renders a richer attachment strip for a message:
   * - Images: thumbnail.
   * - PDFs: first-page preview with react-native-pdf.
   * - Other docs: mini preview card (extension badge, filename, mime, size, url hint).
   */

  const E2EEBanner = isE2EE ? (
    <View style={{
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: 'rgba(0,0,0,0.08)',
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 7,
      marginTop: 12,
      marginBottom: 4,
      marginHorizontal: 24,
    }}>
      <Ionicons name="lock-closed" size={12} color={palette.subtext} />
      <Text style={{ fontSize: 12, color: palette.subtext, textAlign: 'center', flexShrink: 1 }}>
        Messages and calls are end-to-end encrypted.
      </Text>
    </View>
  ) : null;

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        ref={listRef}
        data={timelineItems}
        keyExtractor={(item) =>
          item.type === 'message' ? `message:${item.message.id}` : `call:${item.call.callId}`
        }
        style={styles.messagesList}
        contentContainerStyle={styles.messagesListContent}
        ListHeaderComponent={E2EEBanner}
        onContentSizeChange={handleContentSizeChange}
        onScroll={handleScroll}
        scrollEventThrottle={32}
        onViewableItemsChanged={onViewableItemsChangedRef.current}
        viewabilityConfig={viewabilityConfigRef.current}
        initialNumToRender={20}
        maxToRenderPerBatch={10}
        windowSize={10}
        removeClippedSubviews
        onScrollToIndexFailed={(info) => {
          listRef.current?.scrollToOffset({
            offset: Math.max(0, info.averageItemLength * info.index),
            animated: true,
          });
        }}
        renderItem={({ item: timelineItem, index }) => {
          const previousTimelineItem = timelineItems[index - 1];
          const showTimestampHeader = shouldShowTimestampHeader(
            previousTimelineItem?.createdAt,
            timelineItem.createdAt,
          );

          if (timelineItem.type === 'call') {
            return (
              <View>
                {showTimestampHeader && (
                  <View style={styles.timestampHeaderContainer}>
                    <Text
                      style={[
                        styles.timestampHeaderText,
                        {
                          backgroundColor: palette.timestampBg ?? '#00000033',
                          color: palette.onTimestamp ?? '#fff',
                        },
                      ]}
                    >
                      {formatDayLabel(timelineItem.createdAt)}
                    </Text>
                  </View>
                )}
                <CallHistoryRow
                  entry={timelineItem.call}
                  currentUserId={String(currentUserId ?? '')}
                  onCallBack={onCallHistoryCallback}
                />
              </View>
            );
          }

          const item = timelineItem.message;
          const previous = previousTimelineItem?.type === 'message'
            ? previousTimelineItem.message
            : undefined;
          const nextTimelineItem = timelineItems[index + 1];
          const next = nextTimelineItem?.type === 'message'
            ? nextTimelineItem.message
            : undefined;

          const prevSender = previous?.senderId;
          const nextSender = next?.senderId;
          const thisSender = item.senderId;
          const isFirstInGroup = prevSender !== thisSender;
          const isLastInGroup = nextSender !== thisSender;

          const replySource =
            item.replyToId != null
              ? messages.find(
                  (m) =>
                    m.id === item.replyToId ||
                    (m as any).serverId === item.replyToId ||
                    (m as any).clientId === item.replyToId,
                )
              : undefined;

          const isHighlighted =
            item.id === highlightedMessageId ||
            (item as any).serverId === highlightedMessageId;
          const isSelected = selectedMessageIds.includes(item.id);


          return (
            <View>
              {showTimestampHeader && (
                <View style={styles.timestampHeaderContainer}>
                  <Text
                    style={[
                      styles.timestampHeaderText,
                      {
                        backgroundColor: palette.timestampBg ?? '#00000033',
                        color: palette.onTimestamp ?? '#fff',
                      },
                    ]}
                  >
                    {formatDayLabel(item.createdAt)}
                  </Text>
                </View>
              )}

              <InteractiveMessageRow
                message={item}
                palette={palette}
                currentUserId={currentUserId}
                replySource={replySource}
                isHighlighted={isHighlighted}
                isSelected={isSelected}
                selectionMode={selectionMode}
                isFirstInGroup={isFirstInGroup}
                isLastInGroup={isLastInGroup}
                onPressReplySource={handlePressReplySource}
                onReplyToMessage={onReplyToMessage}
                onEditMessage={onEditMessage}
                onForwardMessage={onForwardMessage}
                onDeleteMessage={onDeleteMessage}
                onPinMessage={onPinMessage}
                onReactMessage={onReactMessage}
                onVotePoll={onVotePoll}
                onRetryMessage={onRetryMessage}
                onStartSelection={onStartSelection}
                onToggleSelect={onToggleSelect}
                onStarMessage={onStarMessage}
                onShowReadReceipts={onShowReadReceipts}
                onViewOnce={onViewOnce}
                onLocalDeleteMessage={onLocalDeleteMessage}
                onUpdateMessage={onUpdateMessage}
                mentionMap={mentionMap}
                participantMap={participantMap}
                participantAvatarMap={participantAvatarMap}
              />
            </View>
          );
        }}
      />

      {/* Jump-to-latest FAB */}
      <Animated.View
        style={{
          position: 'absolute',
          bottom: 16,
          right: 16,
          opacity: jumpBtnOpacity,
          pointerEvents: showJumpToLatest ? 'auto' : 'none',
        }}
      >
        <Pressable
          onPress={jumpToLatest}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: palette.surface,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOpacity: 0.18,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 2 },
            elevation: 6,
          }}
        >
          <Ionicons
            name="chevron-down"
            size={22}
            color={palette.primaryStrong ?? palette.primary}
          />
          {unreadCount > 0 && (
            <View
              style={{
                position: 'absolute',
                top: -4,
                right: -4,
                minWidth: 18,
                height: 18,
                borderRadius: 9,
                backgroundColor: palette.primaryStrong,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 4,
              }}
            >
              <Text style={{ color: palette.ivory, fontSize: 10, fontWeight: '700' }}>
                {unreadCount > 99 ? '99+' : String(unreadCount)}
              </Text>
            </View>
          )}
        </Pressable>
      </Animated.View>
    </View>
  );
};

const shouldShowTimestampHeader = (
  previousCreatedAt: string | undefined,
  currentCreatedAt: string,
) => {
  if (!previousCreatedAt) return true;
  const prevDate = new Date(previousCreatedAt);
  const currDate = new Date(currentCreatedAt);

  const prevDay = prevDate.toDateString();
  const currDay = currDate.toDateString();

  return prevDay !== currDay;
};

const formatDayLabel = (iso: string): string => {
  const d = new Date(iso);
  const today = new Date();
  const diffMs = today.setHours(0, 0, 0, 0) - d.setHours(0, 0, 0, 0);
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toDateString();
};
