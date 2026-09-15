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
  ActivityIndicator,
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
  | { type: 'call'; call: CallHistoryEntry; createdAt: string }
  | { type: 'joinBoundary'; createdAt: string };

/**
 * Pure builder for the chronologically-sorted timeline, extracted out of
 * MessageList's own useMemo so the pre-join-filter/join-boundary logic is
 * unit-testable without rendering the component (which pulls in native
 * FlatList/vector-icon/InteractiveMessageRow dependencies).
 *
 * - Messages flagged isPreJoinHidden (useChatMessaging.ts: no decryption
 *   envelope for this user/device, because they were encrypted before this
 *   user joined the group) are excluded entirely, never rendered as
 *   individual bubbles.
 * - Exactly one joinBoundary item is inserted at myJoinedAt, but only when
 *   there's actually something before it to mark a transition against —
 *   a conversation with no history older than the user's own join needs
 *   no boundary at all.
 */
export function buildTimelineItems(
  messages: ChatMessage[],
  callHistory: CallHistoryEntry[],
  myJoinedAt?: string | null,
): TimelineItem[] {
  const regularMessages: TimelineItem[] = [];
  const inlineCallItems: TimelineItem[] = [];
  let hasPreJoinMessage = false;

  for (const message of messages) {
    if (message.isPreJoinHidden) {
      hasPreJoinMessage = true;
      continue;
    }
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

  const hasOlderThanJoin =
    hasPreJoinMessage ||
    regularMessages.some((item) => item.createdAt < String(myJoinedAt));
  const boundaryItems: TimelineItem[] =
    myJoinedAt && hasOlderThanJoin ? [{ type: 'joinBoundary', createdAt: myJoinedAt }] : [];

  return [...regularMessages, ...inlineCallItems, ...legacyCallItems, ...boundaryItems].sort((a, b) => {
    const timeDiff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    if (timeDiff !== 0) return timeDiff;
    // A same-timestamp tie against the boundary itself always sorts the
    // boundary first (i.e. presented as "the start of what you can
    // see") rather than depending on id comparison, which neither side
    // of a boundary/non-boundary pair has in common.
    if (a.type === 'joinBoundary') return -1;
    if (b.type === 'joinBoundary') return 1;
    const aKey = a.type === 'message' ? a.message.id : a.call.callId;
    const bKey = b.type === 'message' ? b.message.id : b.call.callId;
    return String(aKey).localeCompare(String(bKey));
  });
}

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

  /** Called when the user scrolls up toward the oldest loaded message,
   * to fetch the next batch of older history. */
  onLoadOlder?: () => void;
  /** True while a batch of older messages is in flight — shows a small
   * spinner at the oldest edge of the list. Older-message loading is the
   * only pagination state that should ever show a loading indicator here;
   * the initial batch must never show one. */
  isLoadingOlder?: boolean;
  /** False once a load-older request has come back with fewer than a full
   * page (or empty) — stops firing further onLoadOlder calls once the true
   * start of the conversation has been reached. Defaults to true so a
   * screen that doesn't pass this prop keeps the previous behavior. */
  hasMoreOlder?: boolean;

  /** The current user's own membership.joined_at for this group
   * conversation (server-side, see apps/groups/views.py's
   * _reactivate_group_membership). When set, messages created before it
   * are filtered out (they're already flagged isPreJoinHidden by
   * useChatMessaging's decrypt path — this is a display concern, not a
   * decryption one) and a single joinBoundary timeline item is inserted
   * at the transition instead of a per-message banner. Undefined/null
   * means no boundary is drawn — matches the previous behavior. */
  myJoinedAt?: string | null;

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
  isLoadingOlder = false,
  hasMoreOlder = true,
  myJoinedAt,
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
  // Actual rendered width of this list's own container — measured, not
  // assumed. MessageBubble previously sized its attachment grid off the
  // raw device width, which is wrong whenever this chat renders inside
  // something narrower than the full screen (TabletDialogOverlay's capped
  // dialog, PartnersMessagesPane's capped pane on tablet/desktop) — the
  // grid computed itself wider than the bubble's real available space and
  // overflowed past the bubble's edge. Passed down as `paneWidth` so
  // MessageBubble can size against it instead.
  const [paneWidth, setPaneWidth] = useState(0);
  const timelineItems = useMemo<TimelineItem[]>(
    () => buildTimelineItems(messages, callHistory, myJoinedAt),
    [messages, callHistory, myJoinedAt],
  );

  // FlatList's `data` for the inverted list — newest first, so it renders
  // at the visual bottom with the oldest loaded item at the visual top,
  // matching how every other chat app's initial-load/scroll-up-for-history
  // pattern works. `timelineItems` itself stays chronological (ascending)
  // since messagesById and the reply/highlight lookups below are simpler
  // expressed against that order — this is purely a render-time view over
  // the same data, not a second copy of app state.
  const reversedTimelineItems = useMemo(
    () => [...timelineItems].reverse(),
    [timelineItems],
  );

  // O(1) reply-source lookup — renderItem previously ran messages.find(...)
  // for every rendered row with a replyToId, an O(n) linear scan of the
  // *entire* conversation per row. For a long, reply-heavy chat that's
  // O(n * visible rows) of scanning on every scroll frame, which is exactly
  // the kind of per-frame JS-thread work a low-end device doesn't have
  // headroom for. A message can be matched by id, serverId, or clientId
  // (mirroring the three checks the old .find() made) — first-match-wins
  // per key, same as .find()'s "first match in array order" semantics, so
  // this is a pure optimization with no behavior change.
  const messagesById = useMemo(() => {
    const map = new Map<string, ChatMessage>();
    for (const m of messages) {
      const anyM = m as any;
      if (!map.has(m.id)) map.set(m.id, m);
      if (anyM.serverId != null && !map.has(anyM.serverId)) map.set(anyM.serverId, m);
      if (anyM.clientId != null && !map.has(anyM.clientId)) map.set(anyM.clientId, m);
    }
    return map;
  }, [messages]);

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
  // Identity (not just count) of the newest loaded item, so a genuinely new
  // message arriving can be told apart from an older-history page landing.
  // Both grow `timelineItems`, but only the former should ever move the
  // scroll position or bump the unread badge - conflating the two (the
  // previous implementation compared array length alone) meant loading an
  // older page while scrolled up incorrectly counted as unread activity.
  const newestItemKeyRef = useRef<string | null>(null);
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

  // Fires only when the newest loaded item actually changes - i.e. a real
  // new message arrived (send or receive), never when an older-history page
  // was prepended (the newest item's identity is untouched by that). The
  // inverted list already renders the newest item at the visual bottom
  // with zero scroll calls needed on mount or on an older-page load; this
  // is the one case that still needs an explicit scroll, because RN does
  // not auto-follow new data appended to an inverted list the way it does
  // for a normal list's scrollToEnd-on-content-grow pattern.
  useEffect(() => {
    const newest = timelineItems[timelineItems.length - 1];
    const newestKey = newest
      ? newest.type === 'message'
        ? String(newest.message.serverId ?? newest.message.id ?? newest.message.clientId)
        : newest.type === 'call'
          ? `call:${newest.call.callId}`
          : `boundary:${newest.createdAt}`
      : null;
    const prevKey = newestItemKeyRef.current;
    newestItemKeyRef.current = newestKey;

    if (prevKey === null || newestKey === null || newestKey === prevKey) return;

    if (autoScrollEnabled && !suppressAutoScrollRef.current && isAtBottomRef.current) {
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
    } else {
      setUnreadCount((n) => n + 1);
    }
  }, [timelineItems, autoScrollEnabled]);

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

  // Inverted list: the newest message renders at the visual bottom, which
  // corresponds to contentOffset.y near 0 (the START of the scroll range),
  // not near contentSize.height the way a normal list's "bottom" would be.
  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset } = e.nativeEvent;
      const padding = 48;
      const atBottom = contentOffset.y <= padding;
      isAtBottomRef.current = atBottom;
      if (atBottom) {
        setShowJumpToLatest(false);
        setUnreadCount(0);
      } else {
        setShowJumpToLatest(true);
      }
    },
    [],
  );

  // Fires when the user scrolls up far enough to reach the oldest loaded
  // message - in an inverted list that's the native "end" of the list, so
  // FlatList's own onEndReached (well-tested, purpose-built for exactly
  // this) replaces the old hand-rolled contentOffset.y < 100 heuristic.
  // hasMoreOlder stops this from firing once the true start of the
  // conversation has already been reached.
  const handleEndReached = useCallback(() => {
    if (!onLoadOlder || !hasMoreOlder || isLoadingOlder) return;
    if (loadOlderThrottleRef.current) return;
    loadOlderThrottleRef.current = setTimeout(() => {
      loadOlderThrottleRef.current = null;
    }, 2000);
    onLoadOlder();
  }, [onLoadOlder, hasMoreOlder, isLoadingOlder]);

  const scrollToMessage = useCallback(
    (messageId: string) => {
      if (!listRef.current) return;
      const ascendingIndex = timelineItems.findIndex((entry) => {
        if (entry.type !== 'message') return false;
        const m = entry.message;
        return (
          m.id === messageId ||
          m.serverId === messageId ||
          m.clientId === messageId
        );
      });
      if (ascendingIndex < 0) return;
      // The rendered data is timelineItems reversed (inverted list), so the
      // index FlatList actually needs is mirrored from the ascending one.
      const index = timelineItems.length - 1 - ascendingIndex;

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
    // Newest message is at the visual bottom == offset 0 in an inverted list.
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
    setShowJumpToLatest(false);
    setUnreadCount(0);
  }, []);

  /**
   * Renders a richer attachment strip for a message:
   * - Images: thumbnail.
   * - PDFs: first-page preview with react-native-pdf.
   * - Other docs: mini preview card (extension badge, filename, mime, size, url hint).
   */

  // Hooks must run unconditionally on every render (Rules of Hooks), so this
  // is declared here, above the `isEmpty` early return below, even though
  // it's only ever handed to the FlatList in the non-empty render path.
  //
  // Wrapped in useCallback (was an inline arrow function passed straight to
  // FlatList's renderItem prop) so a parent re-render that doesn't actually
  // touch any of this closure's own dependencies reuses the same function
  // reference instead of handing FlatList's cell renderer a brand-new one
  // every time — a fresh renderItem identity forces every visible cell to
  // re-render regardless of whether that cell's own data changed. `messages`
  // (and therefore `timelineItems`) still changes on every new message, so
  // this doesn't help mid-conversation — the real fix for that would be
  // extracting each row into its own React.memo'd component keyed on its
  // own props, a larger refactor left for a follow-up — but it does stop
  // every visible bubble re-rendering for the *other*, more common re-render
  // triggers here that don't touch the conversation itself: selection mode
  // toggling, a highlight flashing in and out, participant/mention maps
  // refreshing, etc.
  const renderTimelineItem = useCallback(
    ({ item: timelineItem, index }: { item: TimelineItem; index: number }) => {
      // `index` is into reversedTimelineItems (newest-first), so the
      // chronologically-previous item is the NEXT array slot, not the prior
      // one - mirrored from how this worked against the ascending array.
      const previousTimelineItem = reversedTimelineItems[index + 1];
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

      if (timelineItem.type === 'joinBoundary') {
        // Same pill visual language as the E2EE notice below (ListTopEdge)
        // rather than inventing new styling — a single marker at the
        // transition point instead of repeating a banner on every
        // pre-join message.
        return (
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
            <Ionicons name="people-outline" size={12} color={palette.subtext} />
            <Text style={{ fontSize: 12, color: palette.subtext, textAlign: 'center', flexShrink: 1 }}>
              Messages before this point aren't shown — you joined the group.
            </Text>
          </View>
        );
      }

      const item = timelineItem.message;
      const previous = previousTimelineItem?.type === 'message'
        ? previousTimelineItem.message
        : undefined;
      const nextTimelineItem = reversedTimelineItems[index - 1];
      const next = nextTimelineItem?.type === 'message'
        ? nextTimelineItem.message
        : undefined;

      const prevSender = previous?.senderId;
      const nextSender = next?.senderId;
      const thisSender = item.senderId;
      const isFirstInGroup = prevSender !== thisSender;
      const isLastInGroup = nextSender !== thisSender;

      const replySource =
        item.replyToId != null ? messagesById.get(item.replyToId) : undefined;

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
            paneWidth={paneWidth || undefined}
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
    },
    [
      reversedTimelineItems,
      palette,
      currentUserId,
      paneWidth,
      onCallHistoryCallback,
      messagesById,
      highlightedMessageId,
      selectedMessageIds,
      selectionMode,
      handlePressReplySource,
      onReplyToMessage,
      onEditMessage,
      onForwardMessage,
      onDeleteMessage,
      onPinMessage,
      onReactMessage,
      onVotePoll,
      onRetryMessage,
      onStartSelection,
      onToggleSelect,
      onStarMessage,
      onShowReadReceipts,
      onViewOnce,
      onLocalDeleteMessage,
      onUpdateMessage,
      mentionMap,
      participantMap,
      participantAvatarMap,
    ],
  );

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

  // Rendered as ListFooterComponent — in an inverted list that's the visual
  // TOP, i.e. the oldest edge, which is exactly where "loading more history"
  // and "this is the start of the conversation" both belong. Only one of
  // the three shows at a time: a spinner while a page is in flight, the
  // E2EE notice once the true beginning has actually been reached
  // (hasMoreOlder false — showing it earlier would claim to be the start of
  // the conversation before it actually is), otherwise nothing.
  const ListTopEdge = isLoadingOlder ? (
    <View style={{ paddingVertical: 16, alignItems: 'center' }}>
      <ActivityIndicator size="small" color={palette.subtext} />
    </View>
  ) : !hasMoreOlder && isE2EE ? (
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
    <View
      style={{ flex: 1 }}
      onLayout={(e) => {
        const w = Math.round(e.nativeEvent.layout.width);
        if (w > 0 && w !== paneWidth) setPaneWidth(w);
      }}
    >
      <FlatList
        ref={listRef}
        inverted
        data={reversedTimelineItems}
        keyExtractor={(item) =>
          item.type === 'message'
            ? `message:${item.message.id}`
            : item.type === 'call'
              ? `call:${item.call.callId}`
              : `boundary:${item.createdAt}`
        }
        style={styles.messagesList}
        contentContainerStyle={styles.messagesListContent}
        ListFooterComponent={ListTopEdge}
        onScroll={handleScroll}
        scrollEventThrottle={32}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        onViewableItemsChanged={onViewableItemsChangedRef.current}
        viewabilityConfig={viewabilityConfigRef.current}
        initialNumToRender={30}
        maxToRenderPerBatch={10}
        windowSize={10}
        removeClippedSubviews
        onScrollToIndexFailed={(info) => {
          listRef.current?.scrollToOffset({
            offset: Math.max(0, info.averageItemLength * info.index),
            animated: true,
          });
        }}
        renderItem={renderTimelineItem}
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
