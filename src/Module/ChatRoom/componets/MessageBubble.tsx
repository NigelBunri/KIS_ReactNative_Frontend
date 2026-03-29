import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Image, Dimensions, Modal, Linking } from 'react-native';

import { chatRoomStyles as styles } from '../chatRoomStyles';

import AudioRecorderPlayer, {
  PlayBackType,
} from 'react-native-audio-recorder-player';
import { KISIcon } from '@/constants/kisIcons';
import { ChatMessage } from '../chatTypes';
import { EmojiPicker } from './EmojiPicker';

// Use a shared player instance for all bubbles
const audioPlayer = new AudioRecorderPlayer();

/**
 * Shape coming from the backend, e.g.
 * {
 *   id: "693731200ae7...",
 *   createdAt: "2025-12-08T20:12:16.547Z",
 *   roomId: "...",
 *   senderId: "...",
 *   fromMe: true,
 *   kind: "text",
 *   status: "sent",
 *   text: "Hello John",
 *   replyToId: null
 * }
 */
type ServerMessageLike = {
  id: string;
  createdAt: string | number | Date;
  roomId?: string;
  senderId?: string;
  fromMe: boolean;
  kind?: string;
  status?: ChatMessage['status'] | 'sending' | 'sent' | 'delivered' | 'read' | 'failed' | 'pending' | 'local_only';
  text?: string | null;
  replyToId?: string | null;
  // allow extra fields without complaining
  [key: string]: any;
};

/**
 * Attachment metadata shape – this should match what comes from the backend.
 * Even if ChatMessage doesn't declare it explicitly, we'll treat
 * `message.attachments` as `AttachmentMeta[]` structurally.
 */
type AttachmentKind = 'image' | 'video' | 'audio' | 'document' | 'other';

type AttachmentMeta = {
  id: string;
  url: string;
  originalName: string;
  mimeType?: string; // ← made optional, be defensive
  size?: number;
  kind?: AttachmentKind;
  width?: number;
  height?: number;
  durationMs?: number;
};

type MessageBubbleProps = {
  // ✅ Accept both your internal ChatMessage and direct server messages
  message: ChatMessage | ServerMessageLike;
  palette: any;
  currentUserId?: string;
  onReact?: (message: ChatMessage, emoji: string) => void;
  onRetry?: (message: ChatMessage) => void;

  // reply preview
  replySource?: ChatMessage;
  onPressReplySource?: () => void;

  // highlight when scrolled-to from reply
  isHighlighted?: boolean;

  // selection visual
  isSelected?: boolean;
};

const formatTimeFromMs = (ms: number) => {
  const totalSecs = Math.floor(ms / 1000);
  const m = Math.floor(totalSecs / 60);
  const s = totalSecs % 60;
  const mm = m < 10 ? `0${m}` : `${m}`;
  const ss = s < 10 ? `0${s}` : `${s}`;
  return `${mm}:${ss}`;
};

const formatFileSize = (bytes: number | undefined) => {
  if (!bytes || bytes <= 0) return '';
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }
  const mb = kb / 1024;
  if (mb < 1024) {
    return `${mb.toFixed(1)} MB`;
  }
  const gb = mb / 1024;
  return `${gb.toFixed(1)} GB`;
};

const getAttachmentIconName = (att: AttachmentMeta): string => {
  const mime = att.mimeType ?? '';
  const kind = att.kind;

  if (kind === 'image' || mime.startsWith('image/')) return 'image';
  if (kind === 'video' || mime.startsWith('video/')) return 'video';
  if (kind === 'audio' || mime.startsWith('audio/')) return 'audio';
  if (kind === 'document') return 'file';
  return 'file';
};

const statusToSymbol = (status?: ChatMessage['status'] | string) => {
  if (!status) return '';
  if (status === 'local_only' || status === 'pending' || status === 'sending')
    return '⏳';
  if (status === 'sent') return '✓';
  if (status === 'delivered') return '✓✓';
  if (status === 'read') return '✓✓';
  if (status === 'failed') return '!';
  return '';
};

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  palette,
  currentUserId,
  onReact,
  onRetry,
  replySource,
  onPressReplySource,
  isHighlighted,
  isSelected = false,
}) => {
  // ─────────────────────────────────────
  // 🔁 Normalize fields so both shapes work
  // ─────────────────────────────────────
  const rawCreatedAt = (message as any).createdAt;
  const date =
    rawCreatedAt instanceof Date
      ? rawCreatedAt
      : new Date(rawCreatedAt ?? Date.now());

  const timeLabel = date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });

  const isMe = (message as any).fromMe ?? false;
  const status = (message as any).status as
    | ChatMessage['status']
    | string
    | undefined;

  // text can be undefined or empty string from the server
  const text: string =
    typeof (message as any).text === 'string'
      ? ((message as any).text as string)
      : '';

  const voice = (message as any).voice;
  const styled = (message as any).styledText;
  const sticker = (message as any).sticker;
  const contacts = (message as any).contacts as
    | { name: string; phone: string }[]
    | undefined;
  const poll = (message as any).poll as
    | {
        question: string;
        options: { id: string; text: string; votes?: number }[];
        allowMultiple?: boolean;
        expiresAt?: string | null;
      }
    | undefined;
  const eventData = (message as any).event as
    | {
        title: string;
        description?: string;
        location?: string;
        startsAt: string;
        endsAt?: string;
      }
    | undefined;

  const isPinned = !!(message as any).isPinned;
  const isDeleted = !!(message as any).isDeleted;
  const reactions = (message as any).reactions as
    | Record<string, string[]>
    | undefined;

  // ---------------------------------------------------------------------------
  // Attachments: be SUPER defensive about shape
  // ---------------------------------------------------------------------------
  const rawAttachments = ((message as any).attachments ?? []) as any[];

  const attachments: AttachmentMeta[] = rawAttachments
    .filter((att) => att && typeof att === 'object')
    .map((att, index): AttachmentMeta => {
      const id =
        typeof att.id === 'string'
          ? att.id
          : `att-${index}-${(message as any).id ?? 'local'}`;
      const url: string =
        typeof att.url === 'string'
          ? att.url
          : typeof att.path === 'string'
          ? att.path
          : '';

      const originalName: string =
        typeof att.originalName === 'string'
          ? att.originalName
          : typeof att.name === 'string'
          ? att.name
          : 'file';

      const mimeType: string | undefined =
        typeof att.mimeType === 'string'
          ? att.mimeType
          : typeof att.mimetype === 'string'
          ? att.mimetype
          : undefined;

      const kind: AttachmentKind | undefined =
        typeof att.kind === 'string' ? (att.kind as AttachmentKind) : undefined;

      return {
        id,
        url,
        originalName,
        mimeType,
        size: typeof att.size === 'number' ? att.size : undefined,
        kind,
        width: typeof att.width === 'number' ? att.width : undefined,
        height: typeof att.height === 'number' ? att.height : undefined,
        durationMs:
          typeof att.durationMs === 'number' ? att.durationMs : undefined,
      };
    })
    .filter((att) => !!att.url); // require a URL to show something

  const hasAttachments = attachments.length > 0;

  const isVoiceOnly =
    !!voice &&
    !text &&
    !styled &&
    !sticker &&
    !hasAttachments &&
    !contacts &&
    !poll &&
    !eventData;

  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1
  const width = Dimensions.get('window').width;
  const [reactionPickerVisible, setReactionPickerVisible] = useState(false);

  // ✅ local state for selected poll option
  const [selectedPollOptionKey, setSelectedPollOptionKey] = useState<
    string | null
  >(null);

  const stopPlayback = async () => {
    try {
      await audioPlayer.stopPlayer();
      audioPlayer.removePlayBackListener();
    } catch {
      // ignore
    }
    setIsPlaying(false);
    setProgress(0);
  };

  const startPlayback = async () => {
    if (!voice) return;
    try {
      setIsPlaying(true);
      setProgress(0);

      await audioPlayer.startPlayer(voice.uri);

      audioPlayer.addPlayBackListener((e: PlayBackType) => {
        const pos = e.currentPosition ?? 0;
        const dur =
          e.duration ??
          (voice.durationMs !== undefined ? voice.durationMs : 1);

        const ratio = Math.min(1, pos / dur);
        setProgress(ratio);

        if (pos >= dur) {
          stopPlayback();
        }
        return;
      });
    } catch (err) {
      console.warn('start playback error', err);
      setIsPlaying(false);
      setProgress(0);
    }
  };

  const handleTogglePlay = async () => {
    if (!voice) return;
    if (isPlaying) {
      await stopPlayback();
    } else {
      await startPlayback();
    }
  };

  // ✅ handle tap on poll option (local-only for now)
  const handlePollOptionPress = (optionKey: string) => {
    setSelectedPollOptionKey(optionKey);

    console.log('[MessageBubble] poll option selected', {
      messageId: (message as any).id,
      optionKey,
    });

    // 🔜 later: call a prop or hook here to send the vote to backend
  };

  useEffect(() => {
    return () => {
      try {
        audioPlayer.stopPlayer();
        audioPlayer.removePlayBackListener();
      } catch {
        // ignore
      }
    };
  }, []);

  const bubbleBaseStyle = [
    styles.messageBubble,
    isMe
      ? { backgroundColor: palette.outgoingBubble ?? palette.primary }
      : {
          backgroundColor:
            palette.incomingBubble ?? palette.surface ?? palette.card,
        },
  ];

  const highlightedStyle = isHighlighted
    ? {
        borderWidth: 2,
        borderColor: palette.highlightBorder ?? palette.primary,
        shadowColor: palette.highlightShadow ?? palette.primary,
        shadowOpacity: 0.35,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 0 },
      }
    : null;

  /**
   * Subtle border for pinned messages.
   * This is intentionally lighter than the selection/highlight styling.
   */
  const pinnedStyle = isPinned
    ? {
        borderWidth: 2,
        borderColor:
          palette.pinnedBorder ?? (palette.primarySoft ?? '#4F46E533'),
      }
    : null;

  const selectedStyle = isSelected
    ? {
        borderWidth: 2,
        borderColor: palette.selectedBorder ?? '#4F46E5',
        backgroundColor: isMe
          ? palette.selectedBgOutgoing ?? '#ffffff22'
          : palette.selectedBgIncoming ?? '#00000011',
      }
    : null;

  const outgoingBubbleColor = palette.outgoingBubble ?? palette.primary ?? '#4F46E5';
  const parseHex = (hex?: string) => {
    if (!hex || typeof hex !== 'string') return null;
    const cleaned = hex.replace('#', '').trim();
    if (cleaned.length === 3) {
      const r = parseInt(cleaned[0] + cleaned[0], 16);
      const g = parseInt(cleaned[1] + cleaned[1], 16);
      const b = parseInt(cleaned[2] + cleaned[2], 16);
      return { r, g, b };
    }
    if (cleaned.length === 6) {
      const r = parseInt(cleaned.slice(0, 2), 16);
      const g = parseInt(cleaned.slice(2, 4), 16);
      const b = parseInt(cleaned.slice(4, 6), 16);
      return { r, g, b };
    }
    return null;
  };
  const readableTextForBg = (hex: string) => {
    const rgb = parseHex(hex);
    if (!rgb) return '#ffffff';
    const yiq = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
    return yiq >= 160 ? '#111111' : '#ffffff';
  };
  const outgoingTextColor = readableTextForBg(outgoingBubbleColor);
  const outgoingMetaColor = outgoingTextColor === '#111111' ? '#2b2b2b' : '#e0e0e0';

  const textColor = isMe ? outgoingTextColor : palette.text;
  const metaColor = isMe ? outgoingMetaColor : palette.subtext;

  const statusSymbol = statusToSymbol(status);
  const statusColor =
    status === 'read'
      ? palette.readStatus ?? palette.primary ?? '#34B7F1'
      : metaColor;
  const showRetry = status === 'failed';

  const reactionEntries = reactions
    ? Object.entries(reactions).filter(
        ([emoji, users]) => !!emoji && Array.isArray(users) && users.length > 0,
      )
    : [];

  /* ─────────────────────────────────────────
   * Helper: small "Pinned" icon next to time
   * ──────────────────────────────────────── */
  const renderPinnedIcon = () => {
    if (!isPinned) return null;

    return (
      <View style={{ marginLeft: 4 }}>
        <KISIcon
          name="pin"
          size={12}
          color={metaColor}
        />
      </View>
    );
  };

  /* ─────────────────────────────────────────
   * Helper: reply preview
   * ──────────────────────────────────────── */
  const renderReplyPreview = () => {
    if (!replySource) return null;

    const previewText =
      replySource.text ||
      replySource.styledText?.text ||
      (replySource.sticker ? 'Sticker' : '') ||
      (replySource.voice ? 'Voice message' : '') ||
      (replySource.contacts?.length ? 'Contact(s)' : '') ||
      (replySource.poll ? 'Poll' : '') ||
      (replySource.event ? 'Event' : '') ||
      '';

    const labelColor = isMe
      ? palette.replyPreviewLabelOnOutgoing ?? '#ffffffcc'
      : palette.replyPreviewLabelOnIncoming ?? palette.primary;

    const borderColor = isMe
      ? palette.replyPreviewBorderOnOutgoing ?? '#ffffff55'
      : palette.replyPreviewBorderOnIncoming ??
        (palette.primary ?? '#4F46E5');

    const bgColor = isMe
      ? palette.replyPreviewBgOnOutgoing ?? '#00000022'
      : palette.replyPreviewBgOnIncoming ?? '#00000011';

    return (
      <Pressable
        onPress={onPressReplySource}
        style={{
          marginBottom: 6,
          paddingVertical: 4,
          paddingHorizontal: 8,
          borderLeftWidth: 3,
          borderLeftColor: borderColor,
          borderRadius: 8,
          backgroundColor: bgColor,
        }}
      >
        <Text
          style={{
            fontSize: 11,
            fontWeight: '600',
            color: labelColor,
            marginBottom: 2,
          }}
        >
          Replying to
        </Text>
        {!!previewText && (
          <Text
            numberOfLines={2}
            ellipsizeMode="tail"
            style={{
              fontSize: 12,
              color: isMe ? palette.onPrimary ?? '#fff' : palette.text,
            }}
          >
            {previewText}
          </Text>
        )}
      </Pressable>
    );
  };

  const renderReactionsRow = () => {
    if (!reactionEntries.length && !onReact) return null;

    return (
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          marginTop: 6,
        }}
      >
        {reactionEntries.map(([emoji, users]) => {
          const safeUsers = Array.isArray(users) ? users : [];
          const count = safeUsers.length;
          const reactedByMe = currentUserId
            ? safeUsers.includes(currentUserId)
            : false;

          return (
            <Pressable
              key={`${emoji}-${count}`}
              onPress={() => onReact?.(message as ChatMessage, emoji)}
              style={{
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 12,
                marginRight: 6,
                marginBottom: 6,
                backgroundColor: reactedByMe
                  ? palette.reactionActiveBg ?? '#00000022'
                  : palette.reactionBg ?? '#00000011',
                borderWidth: reactedByMe ? 1 : 0,
                borderColor: reactedByMe
                  ? palette.reactionActiveBorder ?? palette.primary
                  : 'transparent',
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  color: textColor,
                  fontWeight: reactedByMe ? '600' : '400',
                }}
              >
                {emoji}
                {count > 1 ? ` ${count}` : ''}
              </Text>
            </Pressable>
          );
        })}

        {onReact && (
          <Pressable
            onPress={() => setReactionPickerVisible(true)}
            style={{
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 12,
              marginRight: 6,
              marginBottom: 6,
              backgroundColor: palette.reactionAddBg ?? '#0000000d',
              borderWidth: 2,
              borderColor: palette.reactionAddBorder ?? '#00000022',
            }}
          >
            <Text style={{ fontSize: 12, color: textColor }}>+</Text>
          </Pressable>
        )}
      </View>
    );
  };

  const renderRetry = () => {
    if (!showRetry || !onRetry) return null;
    return (
      <Pressable
        onPress={() => onRetry(message as ChatMessage)}
        style={{
          marginTop: 6,
          alignSelf: 'flex-end',
        }}
      >
        <Text style={{ color: palette.errorText ?? '#E74C3C', fontSize: 12 }}>
          Tap to retry
        </Text>
      </Pressable>
    );
  };

  const renderReactionPicker = () => {
    if (!onReact) return null;

    return (
      <Modal
        transparent
        visible={reactionPickerVisible}
        animationType="fade"
        onRequestClose={() => setReactionPickerVisible(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.35)',
            justifyContent: 'flex-end',
          }}
          onPress={() => setReactionPickerVisible(false)}
        >
          <View
            style={{
              maxHeight: '60%',
              backgroundColor: palette.surface ?? '#fff',
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              paddingBottom: 16,
            }}
            onStartShouldSetResponder={() => true}
          >
            <EmojiPicker
              palette={palette}
              onSelectEmoji={(emoji) => {
                setReactionPickerVisible(false);
                onReact(message as ChatMessage, emoji);
              }}
            />
          </View>
        </Pressable>
      </Modal>
    );
  };

  /* ─────────────────────────────────────────
   * Helper: attachments renderer (defensive)
   * (for images, files, etc.)
   * ──────────────────────────────────────── */
  const renderAttachments = () => {
    if (!hasAttachments) return null;

    const maxBubbleWidth = width * 0.7;

    const imageAtts = attachments.filter((a) => {
      const mime = a.mimeType ?? '';
      const kind = a.kind;
      return kind === 'image' || mime.startsWith('image/');
    });

    const nonImageAtts = attachments.filter((a) => !imageAtts.includes(a));

    return (
      <View style={{ marginTop: text ? 8 : 0 }}>
        {/* Images grid (from camera or backend) */}
        {imageAtts.length > 0 && (
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              marginBottom: nonImageAtts.length > 0 ? 8 : 0,
            }}
          >
            {imageAtts.map((att) => {
              const imgWidth = Math.min(att.width ?? 180, maxBubbleWidth);
              const imgHeight =
                att.height && att.width
                  ? (imgWidth * att.height) / att.width
                  : imgWidth;

              return (
                <View
                  key={att.id}
                  style={{
                    marginRight: 6,
                    marginBottom: 6,
                    borderRadius: 12,
                    overflow: 'hidden',
                    backgroundColor: '#00000011',
                  }}
                >
                  <Image
                    source={{ uri: att.url }}
                    style={{ width: imgWidth, height: imgHeight }}
                    resizeMode="cover"
                  />
                </View>
              );
            })}
          </View>
        )}

        {/* Non-image file chips */}
        {nonImageAtts.length > 0 && (
          <View style={{ gap: 6 }}>
            {nonImageAtts.map((att) => {
              const iconName = getAttachmentIconName(att);
              const fileSizeLabel = formatFileSize(att.size);

              return (
                <View
                  key={att.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 8,
                    paddingHorizontal: 10,
                    borderRadius: 10,
                    backgroundColor: isMe
                      ? palette.attachmentBgOutgoing ?? '#00000022'
                      : palette.attachmentBgIncoming ?? '#00000011',
                  }}
                >
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 10,
                      backgroundColor: isMe
                        ? palette.attachmentIconBgOutgoing ?? '#ffffff22'
                        : palette.attachmentIconBgIncoming ?? '#00000022',
                    }}
                  >
                    <KISIcon
                      name={iconName}
                      size={18}
                      color={
                        isMe ? palette.onPrimary ?? '#fff' : palette.primary
                      }
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text
                      numberOfLines={1}
                      ellipsizeMode="tail"
                      style={{
                        fontSize: 13,
                        fontWeight: '600',
                        color: isMe
                          ? palette.attachmentTitleOutgoing ?? '#fff'
                          : palette.attachmentTitleIncoming ?? palette.text,
                      }}
                    >
                      {att.originalName}
                    </Text>
                    <Text
                      style={{
                        fontSize: 11,
                        color: isMe
                          ? palette.attachmentMetaOutgoing ?? metaColor
                          : palette.attachmentMetaIncoming ?? metaColor,
                        marginTop: 2,
                      }}
                    >
                      {att.mimeType ?? 'file'}
                      {fileSizeLabel ? ` • ${fileSizeLabel}` : ''}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    );
  };

  /* ─────────────────────────────────────────
   * Helper: contacts card
   * ──────────────────────────────────────── */
  const renderContactsCard = () => {
    if (!contacts || !contacts.length) return null;

    const headerColor = isMe
      ? outgoingTextColor
      : palette.primary ?? palette.text;

    const phoneColor = isMe
      ? outgoingMetaColor
      : palette.subtext;

    return (
      <View
        style={{
          marginTop: text ? 8 : 0,
          paddingVertical: 8,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 6,
          }}
        >
          <KISIcon
            name="contacts"
            size={14}
            color={headerColor}
          />
          <Text
            style={{
              marginLeft: 4,
              fontSize: 12,
              fontWeight: '600',
              color: headerColor,
            }}
          >
            Shared contact{contacts.length > 1 ? 's' : ''}
          </Text>
        </View>

        {contacts.map((c, idx) => (
          <View
            key={`${c.phone}-${idx}`}
            style={{
              paddingVertical: 6,
              paddingHorizontal: 10,
              borderRadius: 10,
              backgroundColor: isMe
                ? palette.contactCardBgOutgoing ?? '#00000022'
                : palette.contactCardBgIncoming ?? '#00000008',
              marginBottom: idx === contacts.length - 1 ? 0 : 6,
            }}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: '600',
                color: textColor,
              }}
            >
              {c.name}
            </Text>
            <Text
              style={{
                fontSize: 12,
                marginTop: 2,
                color: phoneColor,
              }}
            >
              {c.phone}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  /* ─────────────────────────────────────────
   * Helper: poll card (with tap-to-vote)
   * ──────────────────────────────────────── */
  const renderPollCard = () => {
    if (!poll) return null;

    const questionColor = isMe
      ? outgoingTextColor
      : palette.text;

    const optionBg = isMe
      ? palette.pollOptionBgOutgoing ?? '#00000022'
      : palette.pollOptionBgIncoming ?? '#00000008';

    const optionTextColor = isMe
      ? outgoingTextColor
      : palette.text;

    const metaTextColor = isMe
      ? outgoingMetaColor
      : palette.subtext;

    const totalVotes = poll.options.reduce(
      (sum, o) => sum + (o.votes ?? 0),
      0,
    );

    return (
      <View
        style={{
          marginTop: text ? 8 : 0,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 6,
          }}
        >
          <KISIcon
            name="poll"
            size={14}
            color={questionColor}
          />
          <Text
            style={{
              marginLeft: 4,
              fontSize: 12,
              fontWeight: '600',
              color: questionColor,
            }}
          >
            Poll
          </Text>
        </View>

        <Text
          style={{
            fontSize: 14,
            fontWeight: '600',
            color: questionColor,
            marginBottom: 8,
          }}
        >
          {poll.question}
        </Text>

        {poll.options.map((opt, idx) => {
          const votes = opt.votes ?? 0;
          const percentage =
            totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;

          // ✅ stable key + local selection key
          const optionKey =
            typeof opt.id === 'string' && opt.id.length > 0
              ? `poll-opt-${opt.id}`
              : `poll-opt-${idx}`;

          const isSelected = selectedPollOptionKey === optionKey;

          return (
            <Pressable
              key={optionKey}
              onPress={() => handlePollOptionPress(optionKey)}
              style={{ marginBottom: 6 }}
            >
              <View
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                  borderRadius: 10,
                  backgroundColor: optionBg,
                  borderWidth: isSelected ? 2 : 0,
                  borderColor: isSelected
                    ? palette.pollOptionSelectedBorder ?? palette.primary
                    : 'transparent',
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                {/* Option text + meta */}
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 13,
                      color: optionTextColor,
                    }}
                  >
                    {opt.text}
                  </Text>
                  <Text
                    style={{
                      fontSize: 11,
                      color: metaTextColor,
                      marginTop: 2,
                    }}
                  >
                    {votes} vote{votes === 1 ? '' : 's'}
                    {totalVotes > 0 ? ` • ${percentage}%` : ''}
                  </Text>
                </View>

                {/* Simple check mark for selected option */}
                {isSelected && (
                  <Text
                    style={{
                      marginLeft: 8,
                      fontSize: 14,
                      color: palette.primary ?? '#4F46E5',
                      fontWeight: '700',
                    }}
                  >
                    ✓
                  </Text>
                )}
              </View>
            </Pressable>
          );
        })}

        <Text
          style={{
            fontSize: 11,
            color: metaTextColor,
            marginTop: 4,
          }}
        >
          {poll.allowMultiple ? 'Multiple choices allowed' : 'Single choice'}
          {poll.expiresAt
            ? ` • closes ${new Date(poll.expiresAt).toLocaleString()}`
            : ''}
        </Text>
      </View>
    );
  };

  /* ─────────────────────────────────────────
   * Helper: event card
   * ──────────────────────────────────────── */
  const renderEventCard = () => {
    if (!eventData) return null;

    const titleColor = isMe
      ? outgoingTextColor
      : palette.text;

    const metaTextColor = isMe
      ? outgoingMetaColor
      : palette.subtext;

    const startsRaw =
      eventData.startsAt ??
      ((eventData as any).date && (eventData as any).time
        ? `${(eventData as any).date}T${(eventData as any).time}:00`
        : undefined);
    const endsRaw =
      eventData.endsAt ??
      ((eventData as any).endDate && (eventData as any).endTime
        ? `${(eventData as any).endDate}T${(eventData as any).endTime}:00`
        : undefined);

    const starts = startsRaw ? new Date(startsRaw) : new Date(NaN);
    const ends = endsRaw ? new Date(endsRaw) : null;
    const reminderMinutes = (eventData as any).reminderMinutes;

    const formatGcalDate = (dt: Date) =>
      dt.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

    const buildGoogleCalendarUrl = () => {
      if (Number.isNaN(starts.getTime())) return null;
      const endTime = ends && !Number.isNaN(ends.getTime())
        ? ends
        : new Date(starts.getTime() + 60 * 60 * 1000);
      const dates = `${formatGcalDate(starts)}/${formatGcalDate(endTime)}`;
      const text = encodeURIComponent(eventData.title ?? 'Event');
      const details = encodeURIComponent(eventData.description ?? '');
      const location = encodeURIComponent(eventData.location ?? '');
      return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${dates}&details=${details}&location=${location}`;
    };

    const hasStart = !Number.isNaN(starts.getTime());

    const dateLabel = hasStart
      ? starts.toLocaleDateString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        })
      : 'Date TBD';

    const timeLabelLocal = hasStart
      ? starts.toLocaleTimeString(undefined, {
          hour: '2-digit',
          minute: '2-digit',
        })
      : 'Time TBD';

    const endTimeLabel =
      ends &&
      !Number.isNaN(ends.getTime()) &&
      ends.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
      });

    return (
      <View
        style={{
          marginTop: text ? 8 : 0,
          paddingVertical: 4,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 6,
          }}
        >
          <KISIcon
            name="calendar"
            size={14}
            color={titleColor}
          />
          <Text
            style={{
              marginLeft: 4,
              fontSize: 12,
              fontWeight: '600',
              color: titleColor,
            }}
          >
            Event
          </Text>
        </View>

        <Text
          style={{
            fontSize: 14,
            fontWeight: '600',
            color: titleColor,
            marginBottom: 4,
          }}
        >
          {eventData.title}
        </Text>

        <Text
          style={{
            fontSize: 12,
            color: metaTextColor,
            marginBottom: 2,
          }}
        >
          {dateLabel} • {timeLabelLocal}
          {endTimeLabel ? ` – ${endTimeLabel}` : ''}
        </Text>

        {!!eventData.location && (
          <Text
            style={{
              fontSize: 12,
              color: metaTextColor,
              marginBottom: 2,
            }}
          >
            📍 {eventData.location}
          </Text>
        )}

        {!!eventData.description && (
          <Text
            style={{
              fontSize: 12,
              color: metaTextColor,
              marginTop: 4,
            }}
          >
            {eventData.description}
          </Text>
        )}

        {typeof reminderMinutes === 'number' && reminderMinutes > 0 && (
          <Text
            style={{
              fontSize: 11,
              color: metaTextColor,
              marginTop: 4,
            }}
          >
            Reminder: {reminderMinutes} min before
          </Text>
        )}

        {buildGoogleCalendarUrl() && (
          <Pressable
            onPress={() => {
              const url = buildGoogleCalendarUrl();
              if (url) {
                Linking.openURL(url).catch(() => {});
              }
            }}
            style={{
              alignSelf: 'flex-start',
              marginTop: 8,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 12,
              borderWidth: 2,
              borderColor: titleColor,
            }}
          >
            <Text
              style={{
                fontSize: 11,
                color: titleColor,
                fontWeight: '600',
              }}
            >
              Add to Google Calendar
            </Text>
          </Pressable>
        )}
      </View>
    );
  };

  /* ─────────────────────────────────────────
   * -1) Deleted message placeholder
   * ──────────────────────────────────────── */
  if (isDeleted) {
    return (
      <View
        style={[
          styles.messageRow,
          isMe ? styles.messageRowMe : styles.messageRowThem,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            {
              backgroundColor: palette.deletedBubbleBg ?? '#333',
            },
            pinnedStyle || undefined,
            selectedStyle || undefined,
            highlightedStyle || undefined,
          ]}
        >
          <Text
            style={[
              styles.messageText,
              {
                color: palette.deletedTextColor ?? metaColor,
                fontStyle: 'italic',
              },
            ]}
          >
            Message deleted
          </Text>

          {renderReactionsRow()}
          {renderRetry()}

          <View style={styles.messageMetaRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text
                style={[
                  styles.messageTime,
                  {
                    color: metaColor,
                  },
                ]}
              >
                {timeLabel}
              </Text>
              {renderPinnedIcon()}
            </View>

            {isMe && status && (
              <Text
                style={[
                  styles.messageStatus,
                  {
                    color: statusColor,
                  },
                ]}
              >
                {statusSymbol}
              </Text>
            )}
          </View>
        </View>

        {renderReactionPicker()}
      </View>
    );
  }

  /* ─────────────────────────────────────────
   * 0) Sticker bubble
   * ──────────────────────────────────────── */
  if (sticker?.uri) {
    const stickerWidth = sticker.width ?? 180;
    const stickerHeight = sticker.height ?? 180;

    return (
      <View
        style={[
          styles.messageRow,
          isMe ? styles.messageRowMe : styles.messageRowThem,
        ]}
      >
        <View
          style={[
            {
              maxWidth: stickerWidth,
              borderRadius: 16,
              overflow: 'visible',
              backgroundColor: 'transparent',
            },
            pinnedStyle || undefined,
            selectedStyle || undefined,
            highlightedStyle || undefined,
          ]}
        >
          {renderReplyPreview()}

          <Image
            source={{ uri: sticker.uri }}
            style={{ width: stickerWidth, height: stickerHeight }}
            resizeMode="contain"
          />

          {renderReactionsRow()}
          {renderRetry()}

          {/* time + ticks row */}
          <View
            style={[
              styles.messageMetaRow,
              { paddingHorizontal: 6, paddingBottom: 4 },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text
                style={[
                  styles.messageTime,
                  {
                    color: metaColor,
                  },
                ]}
              >
                {timeLabel}
                {(message as any).isEdited ? ' • edited' : ''}
              </Text>
              {renderPinnedIcon()}
            </View>

            {isMe && status && (
              <Text
                style={[
                  styles.messageStatus,
                  {
                    color: statusColor,
                  },
                ]}
              >
                {statusSymbol}
              </Text>
            )}
          </View>
        </View>

        {renderReactionPicker()}
      </View>
    );
  }

  /* ─────────────────────────────────────────
   * 1) Styled text card (background + font)
   * ──────────────────────────────────────── */
  if (styled) {
    return (
      <View
        style={[
          styles.messageRow,
          isMe ? styles.messageRowMe : styles.messageRowThem,
        ]}
      >
        <View
          style={[
            {
              maxWidth: '80%',
              borderRadius: 18,
              overflow: 'hidden',
              backgroundColor: styled.backgroundColor,
              paddingHorizontal: 16,
              paddingVertical: 12,
            },
            pinnedStyle || undefined,
            selectedStyle || undefined,
            highlightedStyle || undefined,
          ]}
        >
          {renderReplyPreview()}

          <Text
            style={{
              fontSize: styled.fontSize,
              color: styled.fontColor,
              fontFamily: styled.fontFamily || undefined,
              textAlign: 'center',
            }}
          >
            {styled.text}
          </Text>

          {renderReactionsRow()}
          {renderRetry()}

          {/* time + ticks row */}
          <View style={styles.messageMetaRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text
                style={[
                  styles.messageTime,
                  {
                    color: metaColor,
                  },
                ]}
              >
                {timeLabel}
                {(message as any).isEdited ? ' • edited' : ''}
              </Text>
              {renderPinnedIcon()}
            </View>

            {isMe && status && (
              <Text
                style={[
                  styles.messageStatus,
                  {
                    color: statusColor,
                  },
                ]}
              >
                {statusSymbol}
              </Text>
            )}
          </View>
        </View>

        {renderReactionPicker()}
      </View>
    );
  }

  /* ─────────────────────────────────────────
   * 2) Voice-only bubble
   * ──────────────────────────────────────── */
  if (isVoiceOnly && voice) {
    const durationLabel = formatTimeFromMs(voice.durationMs);

    return (
      <View
        style={[
          styles.messageRow,
          isMe ? styles.messageRowMe : styles.messageRowThem,
        ]}
      >
        <View
          style={[
            bubbleBaseStyle,
            pinnedStyle || undefined,
            selectedStyle || undefined,
            highlightedStyle || undefined,
            { width: width / 2 },
          ]}
        >
          {renderReplyPreview()}

          <Pressable
            onPress={handleTogglePlay}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <KISIcon
              name={isPlaying ? 'pause' : 'play'}
              size={20}
              color={palette.primary}
            />

            <View style={{ flex: 1, marginHorizontal: 8 }}>
              {/* progress track */}
              <View
                style={{
                  height: 3,
                  borderRadius: 999,
                  backgroundColor: palette.primary,
                  overflow: 'hidden',
                }}
              >
                <View
                  style={{
                    height: 3,
                    width: `${Math.round(progress * 100)}%`,
                    backgroundColor: isMe
                      ? palette.onPrimary ?? '#fff'
                      : palette.primary ?? '#4F46E5',
                  }}
                />
              </View>

              {/* duration */}
              <Text
                style={{
                  marginTop: 4,
                  fontSize: 11,
                  color: metaColor,
                }}
              >
                {durationLabel}
                {isPlaying ? '  (Playing)' : ''}
              </Text>
            </View>
          </Pressable>

          {renderReactionsRow()}
          {renderRetry()}

          {/* time + ticks row */}
          <View style={styles.messageMetaRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text
                style={[
                  styles.messageTime,
                  {
                    color: metaColor,
                  },
                ]}
              >
                {timeLabel}
                {(message as any).isEdited ? ' • edited' : ''}
              </Text>
              {renderPinnedIcon()}
            </View>

            {isMe && status && (
              <Text
                style={[
                  styles.messageStatus,
                  {
                    color: statusColor,
                  },
                ]}
              >
                {statusSymbol}
              </Text>
            )}
          </View>
        </View>

        {renderReactionPicker()}
      </View>
    );
  }

  /* ─────────────────────────────────────────
   * 3) Default text + contacts/poll/event + attachments bubble
   * ──────────────────────────────────────── */
  return (
    <View
      style={[
        styles.messageRow,
        isMe ? styles.messageRowMe : styles.messageRowThem,
      ]}
    >
      <View
        style={[
          bubbleBaseStyle,
          pinnedStyle || undefined,
          selectedStyle || undefined,
          highlightedStyle || undefined,
        ]}
      >
        {renderReplyPreview()}

        {!!text && (
          <Text
            style={[
              styles.messageText,
              {
                color: textColor,
              },
            ]}
          >
            {text}
          </Text>
        )}

        {/* Contacts / Poll / Event cards */}
        {renderContactsCard()}
        {renderPollCard()}
        {renderEventCard()}

        {/* Attachments (images, files, etc.) */}
        {renderAttachments()}

        {renderReactionsRow()}
        {renderRetry()}

        <View style={styles.messageMetaRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text
              style={[
                styles.messageTime,
                {
                  color: metaColor,
                },
              ]}
            >
              {timeLabel}
              {(message as any).isEdited ? ' • edited' : ''}
            </Text>
            {renderPinnedIcon()}
          </View>

          {isMe && status && (
            <Text
              style={[
                styles.messageStatus,
                {
                  color: statusColor,
                },
              ]}
            >
              {statusSymbol}
            </Text>
          )}
        </View>
      </View>

      {renderReactionPicker()}
    </View>
  );
};
