import React, {
  useRef,
  useCallback,
  useState,
  useEffect,
} from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  Pressable,
  Linking,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';

import Pdf from 'react-native-pdf';

import { chatRoomStyles as styles } from '@/Module/ChatRoom/chatRoomStyles';
import { ChatMessage } from '../../chatTypes';
import { InteractiveMessageRow } from '../InteractiveMessageRow';

type MessageListProps = {
  messages: ChatMessage[];
  palette: any;
  isEmpty: boolean;
  currentUserId?: string;

  onReplyToMessage?: (message: ChatMessage) => void;
  onEditMessage?: (message: ChatMessage) => void;
  onPressMessage?: (message: ChatMessage) => void;
  onLongPressMessage?: (message: ChatMessage) => void;
  onReactMessage?: (message: ChatMessage, emoji: string) => void;
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
};

/**
 * Old backend attachment wrapper:
 * {
 *   attachment: { id, url, name, mime, size }
 * }
 */
type LegacyAttachmentWrapper = {
  attachment: {
    id?: string | number;
    url?: string;
    uri?: string;
    mimeType?: string;
    contentType?: string;
    mime?: string;
    name?: string;
    filename?: string;
    sizeBytes?: number;
    size?: number;
  };
  id?: string | number;
};

/**
 * New flat AttachmentMeta we send/receive when using uploadFileToBackend.
 */
type FlatAttachmentMeta = {
  id?: string | number;
  url?: string;
  uri?: string;
  mimeType?: string;
  mimetype?: string;
  contentType?: string;
  mime?: string;
  name?: string;
  originalName?: string;
  filename?: string;
  sizeBytes?: number;
  size?: number;
};

type NormalizedAttachment = {
  key: string;
  uri: string;
  mime?: string;
  name?: string;
  filename?: string;
  size?: number;
};

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  palette,
  isEmpty,
  currentUserId,
  onReplyToMessage,
  onEditMessage,
  onPressMessage,
  onLongPressMessage,
  onReactMessage,
  onRetryMessage,
  selectionMode = false,
  selectedMessageIds = [],
  onStartSelection,
  onToggleSelect,
  onMessageLocatorReady,
  autoScrollEnabled = true,
  startAtBottom = true,
  onVisibleMessageIds,
}) => {
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const [highlightedMessageId, setHighlightedMessageId] = useState<
    string | null
  >(null);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const suppressAutoScrollRef = useRef(false);
  const isAtBottomRef = useRef(startAtBottom);
  const lastStartAtBottomRef = useRef<boolean | null>(startAtBottom);
  const viewabilityConfigRef = useRef({
    viewAreaCoveragePercentThreshold: 60,
    minimumViewTime: 150,
  });
  const onViewableItemsChangedRef = useRef(
    ({ viewableItems }: { viewableItems: Array<{ item: ChatMessage }> }) => {
      if (!onVisibleMessageIds) return;
      const ids = viewableItems
        .map((entry) => {
          const item: any = entry.item;
          return (
            item?.serverId ??
            item?.id ??
            item?.clientId ??
            null
          );
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
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (lastStartAtBottomRef.current === startAtBottom) return;
    lastStartAtBottomRef.current = startAtBottom;
    isAtBottomRef.current = !!startAtBottom;
  }, [startAtBottom]);

  useEffect(() => {
    onViewableItemsChangedRef.current = ({
      viewableItems,
    }: {
      viewableItems: Array<{ item: ChatMessage }>;
    }) => {
      if (!onVisibleMessageIds) return;
      const ids = viewableItems
        .map((entry) => {
          const item: any = entry.item;
          return (
            item?.serverId ??
            item?.id ??
            item?.clientId ??
            null
          );
        })
        .filter(Boolean)
        .map((id) => String(id));
      if (ids.length) {
        onVisibleMessageIds(ids);
      }
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
    },
    [],
  );

  const scrollToMessage = useCallback(
    (messageId: string) => {
      if (!listRef.current) return;
      const index = messages.findIndex(
        (m) =>
          m.id === messageId ||
          (m as any).serverId === messageId ||
          (m as any).clientId === messageId,
      );
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
    [messages],
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

  /* ----------------------------- Helpers ---------------------------------- */

  const formatFileSize = (bytes?: number) => {
    if (!bytes || bytes <= 0) return '';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    if (mb < 1024) return `${mb.toFixed(1)} MB`;
    const gb = mb / 1024;
    return `${gb.toFixed(1)} GB`;
  };

  const getExtension = (nameOrUrl: string | undefined) => {
    if (!nameOrUrl) return '';
    const last = nameOrUrl.split('.').pop();
    if (!last) return '';
    return last.split('?')[0].split('#')[0].toLowerCase();
  };

  const getDisplayName = (raw?: string) => {
    if (!raw) return 'File';
    try {
      const decoded = decodeURIComponent(raw);
      return decoded.replace(/_/g, ' ');
    } catch {
      return raw.replace(/_/g, ' ');
    }
  };

  const getShortUrl = (url?: string) => {
    if (!url) return '';
    try {
      const u = new URL(url);
      const last = u.pathname.split('/').pop();
      return `${u.host}${last ? ` / ${decodeURIComponent(last)}` : ''}`;
    } catch {
      const parts = url.split('/');
      return parts.slice(-2).join('/');
    }
  };

  const normalizeAttachments = (
    attachmentsRaw: unknown,
  ): NormalizedAttachment[] => {
    if (!Array.isArray(attachmentsRaw)) return [];

    const list = attachmentsRaw as any[];

    return list
      .map((raw, index): NormalizedAttachment | null => {
        if (!raw || typeof raw !== 'object') return null;

        let att: any;

        // Legacy shape: { attachment: {...} }
        if ('attachment' in raw && raw.attachment) {
          att = (raw as LegacyAttachmentWrapper).attachment;
        } else {
          // New flat metadata shape (AttachmentMeta[] from uploadFileToBackend)
          att = raw as FlatAttachmentMeta;
        }

        const uri =
          att.url ||
          att.uri ||
          (typeof att.path === 'string' ? att.path : '');

        if (!uri) return null;

        const mime =
          att.mimeType ||
          att.mimetype ||
          att.contentType ||
          att.mime ||
          undefined;

        const name =
          att.name ||
          att.originalName ||
          att.filename ||
          (uri ? uri.split('/').pop() : '');

        const size =
          typeof att.sizeBytes === 'number'
            ? att.sizeBytes
            : typeof att.size === 'number'
            ? att.size
            : undefined;

        const key = String(att.id ?? uri ?? index);

        return { key, uri, mime, name, filename: att.filename, size };
      })
      .filter(Boolean) as NormalizedAttachment[];
  };

  /**
   * Renders a richer attachment strip for a message:
   * - Images: thumbnail.
   * - PDFs: first-page preview with react-native-pdf.
   * - Other docs: mini preview card (extension badge, filename, mime, size, url hint).
   */
  const renderAttachments = (
    attachmentsRaw: unknown,
    fromMe: boolean | undefined,
  ) => {
    const attachments = normalizeAttachments(attachmentsRaw);
    if (!attachments.length) return null;

    const isOutgoing = !!fromMe;

    return (
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          marginTop: 4,
          marginBottom: 6,
          justifyContent: isOutgoing ? 'flex-end' : 'flex-start',
        }}
      >
        {attachments.map((att, _index) => {
          const key = att.key;
          const uri = att.uri;
          const mime = att.mime;
          const ext = getExtension(att.name || att.filename || uri);

          const isImage =
            mime?.startsWith('image/') ||
            (uri &&
              (uri.toLowerCase().endsWith('.png') ||
                uri.toLowerCase().endsWith('.jpg') ||
                uri.toLowerCase().endsWith('.jpeg') ||
                uri.toLowerCase().endsWith('.gif') ||
                uri.toLowerCase().endsWith('.webp')));

          const isPdf =
            mime === 'application/pdf' ||
            ext === 'pdf' ||
            (uri && uri.toLowerCase().endsWith('.pdf'));

          const sizeLabel = formatFileSize(att.size);
          const displayName = getDisplayName(
            att.name || att.filename || (uri ? uri.split('/').pop() : ''),
          );
          const shortUrl = getShortUrl(uri);

          // IMAGE THUMBNAIL PREVIEW (images will only reach here from camera or backend)
          if (isImage && uri) {
            return (
              <Pressable
                key={key}
                style={{
                  width: 140,
                  height: 140,
                  borderRadius: 16,
                  overflow: 'hidden',
                  marginHorizontal: 4,
                  marginVertical: 4,
                  backgroundColor: palette.surface ?? palette.card,
                }}
                onPress={() => {
                  Linking.openURL(uri).catch((err) =>
                    console.warn('open attachment error', err),
                  );
                }}
              >
                <Image
                  source={{ uri }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover"
                />
              </Pressable>
            );
          }

          // PDF FIRST-PAGE PREVIEW
          if (isPdf && uri) {
            return (
              <Pressable
                key={key}
                style={{
                  width: 220,
                  height: 260,
                  borderRadius: 18,
                  overflow: 'hidden',
                  marginHorizontal: 4,
                  marginVertical: 4,
                  backgroundColor: palette.surface ?? palette.card,
                }}
                onPress={() => {
                  Linking.openURL(uri).catch((err) =>
                    console.warn('open pdf error', err),
                  );
                }}
              >
                {/* First page as preview */}
                <View style={{ flex: 1 }}>
                  <Pdf
                    source={{ uri, cache: true }}
                    page={1}
                    singlePage
                    style={{ flex: 1 }}
                  />
                </View>

                {/* Overlay footer with filename + meta */}
                <View
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    backgroundColor: '#00000088',
                  }}
                >
                  <Text
                    numberOfLines={1}
                    ellipsizeMode="middle"
                    style={{
                      fontSize: 12,
                      fontWeight: '600',
                      color: '#ffffff',
                    }}
                  >
                    {displayName}
                  </Text>
                  <Text
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={{
                      fontSize: 11,
                      color: '#f5f5f5',
                      marginTop: 2,
                    }}
                  >
                    PDF {sizeLabel ? `• ${sizeLabel}` : ''}
                  </Text>
                </View>
              </Pressable>
            );
          }

          // DOCUMENT / OTHER FILE MINI PREVIEW CARD
          return (
            <Pressable
              key={key}
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                maxWidth: 340,
                paddingHorizontal: 12,
                paddingVertical: 10,
                marginHorizontal: 4,
                marginVertical: 4,
                borderRadius: 16,
                backgroundColor: isOutgoing
                  ? palette.outgoingBubble ?? palette.primary
                  : palette.incomingBubble ??
                    palette.surface ??
                    palette.card,
              }}
              onPress={() => {
                if (uri) {
                  Linking.openURL(uri).catch((err) =>
                    console.warn('open attachment error', err),
                  );
                }
              }}
            >
              {/* Extension badge on the left */}
              <View
                style={{
                  width: 46,
                  height: 56,
                  borderRadius: 10,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 10,
                  backgroundColor: isOutgoing
                    ? palette.onPrimary
                      ? `${palette.onPrimary}22`
                      : '#ffffff22'
                    : palette.primary
                    ? `${palette.primary}22`
                    : '#00000011',
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    color: isOutgoing
                      ? palette.onPrimary ?? '#fff'
                      : palette.primary ?? '#4F46E5',
                  }}
                >
                  {ext || 'FILE'}
                </Text>
              </View>

              {/* Right side: file "preview" info */}
              <View style={{ flex: 1 }}>
                {/* File name */}
                <Text
                  numberOfLines={2}
                  ellipsizeMode="tail"
                  style={{
                    fontSize: 13,
                    fontWeight: '600',
                    color: isOutgoing
                      ? palette.onPrimary ?? '#fff'
                      : palette.text,
                  }}
                >
                  {displayName}
                </Text>

                {/* Mime + size */}
                <Text
                  style={{
                    fontSize: 11,
                    marginTop: 4,
                    color: isOutgoing
                      ? palette.onPrimaryMuted ?? '#e0e0e0'
                      : palette.subtext,
                  }}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {(mime || 'Document') +
                    (sizeLabel ? ` • ${sizeLabel}` : '')}
                </Text>

                {/* Short URL / location hint */}
                {!!shortUrl && (
                  <Text
                    style={{
                      fontSize: 10,
                      marginTop: 4,
                      color: isOutgoing
                        ? palette.onPrimaryMuted ?? '#e0e0e0'
                        : palette.subtext,
                    }}
                    numberOfLines={1}
                    ellipsizeMode="middle"
                  >
                    {shortUrl}
                  </Text>
                )}

                {/* Tap hint */}
                <Text
                  style={{
                    fontSize: 10,
                    marginTop: 4,
                    color: isOutgoing
                      ? palette.onPrimaryMuted ?? '#e0e0e0'
                      : palette.subtext,
                  }}
                >
                  Tap to open
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    );
  };

  return (
    <FlatList
      ref={listRef}
      data={messages}
      keyExtractor={(item) => item.id}
      style={styles.messagesList}
      contentContainerStyle={styles.messagesListContent}
      onContentSizeChange={handleContentSizeChange}
      onScroll={handleScroll}
      scrollEventThrottle={16}
      onViewableItemsChanged={onViewableItemsChangedRef.current}
      viewabilityConfig={viewabilityConfigRef.current}
      onScrollToIndexFailed={(info) => {
        const approximateItemHeight = 72;
        listRef.current?.scrollToOffset({
          offset: Math.max(0, info.index * approximateItemHeight),
          animated: true,
        });
      }}
      renderItem={({ item, index }) => {
        const previous = messages[index - 1];
        const showTimestampHeader = shouldShowTimestampHeader(previous, item);

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

        const attachments = (item as any).attachments ?? [];

        return (
          <View>
            {showTimestampHeader && (
              <View style={styles.timestampHeaderContainer}>
                <Text
                  style={[
                    styles.timestampHeaderText,
                    {
                      backgroundColor:
                        palette.timestampBg ?? '#00000033',
                      color: palette.onTimestamp ?? '#fff',
                    },
                  ]}
                >
                  {formatDayLabel(item.createdAt)}
                </Text>
              </View>
            )}

            {/* Main bubble row (text / voice / sticker / styled / contacts / poll / event) */}
            <InteractiveMessageRow
              message={item}
              palette={palette}
              currentUserId={currentUserId}
              replySource={replySource}
              isHighlighted={isHighlighted}
              isSelected={isSelected}
              selectionMode={selectionMode}
              onPressReplySource={handlePressReplySource}
              onReplyToMessage={onReplyToMessage}
              onEditMessage={onEditMessage}
              onPressMessage={onPressMessage}
              onLongPressMessage={onLongPressMessage}
              onReactMessage={onReactMessage}
              onRetryMessage={onRetryMessage}
              onStartSelection={onStartSelection}
              onToggleSelect={onToggleSelect}
            />

            {/* Attachment strip for this message (if any) */}
            {renderAttachments(attachments, (item as any).fromMe)}
          </View>
        );
      }}
    />
  );
};

const shouldShowTimestampHeader = (
  prev: ChatMessage | undefined,
  current: ChatMessage,
) => {
  if (!prev) return true;
  const prevDate = new Date(prev.createdAt);
  const currDate = new Date(current.createdAt);

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
