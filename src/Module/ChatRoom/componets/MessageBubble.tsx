import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Image, Dimensions, Modal, Linking, Platform, TouchableOpacity } from 'react-native';
import Video from 'react-native-video';

import { chatRoomStyles as styles } from '../chatRoomStyles';

import AudioRecorderPlayer, {
  PlayBackType,
} from 'react-native-audio-recorder-player';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { KISIcon } from '@/constants/kisIcons';
import { ChatMessage } from '../chatTypes';
import { EmojiPicker } from './EmojiPicker';
import { useResponsiveLayout } from '@/theme/responsive';
import { useLanguage, useTranslation } from '@/languages';

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
  downloadUrl?: string;
  displayUrl?: string;
  publicUrl?: string;
};

type MessageBubbleProps = {
  // ✅ Accept both your internal ChatMessage and direct server messages
  message: ChatMessage | ServerMessageLike;
  palette: any;
  currentUserId?: string;
  onReact?: (message: ChatMessage, emoji: string) => void;
  onVotePoll?: (messageId: string, optionId: string) => void;
  onRetry?: (message: ChatMessage) => void;

  // reply preview
  replySource?: ChatMessage;
  onPressReplySource?: () => void;

  // highlight when scrolled-to from reply
  isHighlighted?: boolean;

  // selection visual
  isSelected?: boolean;

  // group bubble context
  isFirstInGroup?: boolean;
  isLastInGroup?: boolean;

  // star / read-receipts handlers
  onStar?: (message: ChatMessage) => void;
  onShowReadReceipts?: (message: ChatMessage) => void;
  onViewOnce?: (messageId: string) => void;
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

const renderStatusIcon = (
  status?: ChatMessage['status'] | string,
  color?: string,
  size: number = 13,
) => {
  if (!status) return null;
  if (status === 'local_only' || status === 'pending' || status === 'sending') {
    return <Ionicons name="time-outline" size={size} color={color ?? '#aaa'} />;
  }
  if (status === 'sent') {
    return <Ionicons name="checkmark" size={size} color={color ?? '#aaa'} />;
  }
  if (status === 'delivered') {
    return <Ionicons name="checkmark-done-outline" size={size} color={color ?? '#aaa'} />;
  }
  if (status === 'read') {
    return <Ionicons name="checkmark-done" size={size} color={color ?? '#34B7F1'} />;
  }
  if (status === 'failed') {
    return <Ionicons name="alert-circle" size={size} color="#DC2626" />;
  }
  return null;
};

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  palette,
  currentUserId,
  onReact,
  onVotePoll,
  onRetry,
  replySource,
  onPressReplySource,
  isHighlighted,
  isSelected = false,
  isFirstInGroup = true,
  isLastInGroup = true,
  onStar,
  onShowReadReceipts,
  onViewOnce,
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

  const senderName = (message as any).senderName as string | undefined;
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
        typeof att.displayUrl === 'string'
          ? att.displayUrl
          : typeof att.url === 'string'
          ? att.url
          : typeof att.downloadUrl === 'string'
          ? att.downloadUrl
          : typeof att.publicUrl === 'string'
          ? att.publicUrl
          : typeof att.uri === 'string'
          ? att.uri
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

  // Edit indicator
  const isEdited = !!(message as any).isEdited || !!(message as any).edited_at ||
    (!!(message as any).is_edited) ||
    (
      typeof (message as any).updated_at === 'string' &&
      typeof (message as any).created_at === 'string' &&
      (message as any).updated_at !== (message as any).created_at
    );

  // Voice transcription state (keyed by message id)
  const messageId = (message as any).id as string;
  const [transcription, setTranscription] = useState<string | null>(
    (message as any).transcription ?? (message as any).transcript ?? null,
  );
  const [showTranscription, setShowTranscription] = useState(false);
  const [transcribing, setTranscribing] = useState(false);

  const handleShowTranscription = async () => {
    if (transcription) {
      setShowTranscription(prev => !prev);
      return;
    }
    setTranscribing(true);
    try {
      const { getRequest: get } = await import('@/network/get');
      const res = await get(`/api/v1/messages/${messageId}/transcription/`, { errorMessage: '' });
      const text: string | undefined = res?.data?.transcription ?? res?.data?.transcript ?? res?.data?.text;
      if (text) {
        setTranscription(text);
        setShowTranscription(true);
      }
    } catch { /* silent */ } finally {
      setTranscribing(false);
    }
  };

  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1
  const [playbackSpeed, setPlaybackSpeed] = useState<0.5 | 1 | 1.5 | 2>(1);
  const SPEED_CYCLE: Array<0.5 | 1 | 1.5 | 2> = [1, 1.5, 2, 0.5];

  // Disappearing messages countdown
  const disappearAfterSeconds = (message as any).disappearAfterSeconds as number | null | undefined;
  const sentAt = (message as any).sentAt ?? (message as any).createdAt;
  const [disappearSecsLeft, setDisappearSecsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!disappearAfterSeconds || !sentAt) { setDisappearSecsLeft(null); return; }
    const sentMs = new Date(sentAt).getTime();
    const expiresMs = sentMs + disappearAfterSeconds * 1000;
    const update = () => {
      const left = Math.ceil((expiresMs - Date.now()) / 1000);
      setDisappearSecsLeft(left > 0 ? left : 0);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [disappearAfterSeconds, sentAt]);

  // View-once: track if the user has viewed it
  const isViewOnce = !!(message as any).attachments?.some((a: any) => a.viewOnce);
  const [viewOnceViewed, setViewOnceViewed] = useState(
    !!(message as any).attachments?.some((a: any) => a.viewedAt),
  );

  const isStarred = !!(message as any).isStarred;

  const [videoFullscreenUri, setVideoFullscreenUri] = useState<string | null>(null);

  const responsive = useResponsiveLayout();
  const width = responsive.width || Dimensions.get('window').width;
  const bubbleMaxWidth = responsive.isTablet ? '68%' : responsive.isWatch ? '92%' : responsive.isCompactPhone ? '88%' : '80%';
  const bubblePaddingX = responsive.isWatch ? 8 : 10;
  const bubbleTextSize = responsive.bodyFontSize;

  const { language: userLanguage } = useLanguage();
  const { t } = useTranslation();

  // Read-more state for long messages
  const READ_MORE_THRESHOLD = 300;
  const isLongText = !!text && text.length > READ_MORE_THRESHOLD;
  const [expanded, setExpanded] = useState(false);
  const displayText = isLongText && !expanded ? text!.slice(0, READ_MORE_THRESHOLD) : text;

  // Translation — uses the language the user set in their profile
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);

  const handleTranslate = useCallback(async () => {
    if (!text || translating) return;
    setTranslating(true);
    try {
      const { postRequest: post } = await import('@/network/post');
      const ROUTES_mod = await import('@/network');
      const res = await post(
        ROUTES_mod.default.translate,
        { text, target_lang: userLanguage },
        {},
      );
      if (res?.data?.translated && res.data.translated !== text) {
        setTranslatedText(res.data.translated);
      }
    } catch { /* silent */ } finally {
      setTranslating(false);
    }
  }, [text, translating, userLanguage]);

  // Auto-translate incoming messages when the user's language is not English
  useEffect(() => {
    if (!text || isMe || translatedText || userLanguage === 'en') return;
    handleTranslate();
  // Only run when language changes or a new message arrives (text changes)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, userLanguage]);

  // Reset translation when language changes so it is re-fetched in the new language
  useEffect(() => {
    setTranslatedText(null);
  }, [userLanguage]);

  // Link preview
  const serverLinkPreview = (message as any).linkPreview as
    | { title?: string; description?: string; image?: string; site_name?: string; url?: string }
    | undefined;
  const [linkPreview, setLinkPreview] = useState<
    { title?: string; description?: string; image?: string; site_name?: string; url?: string } | null
  >(serverLinkPreview ?? null);
  const [linkPreviewUrl, setLinkPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (serverLinkPreview) { setLinkPreview(serverLinkPreview); return; }
    if (!text || isMe) return;
    const urlMatch = text.match(/https?:\/\/[^\s<>"{}|\\^`[\]]+/);
    if (!urlMatch) return;
    const url = urlMatch[0];
    setLinkPreviewUrl(url);
    let cancelled = false;
    (async () => {
      try {
        const ROUTES_mod = await import('@/network');
        const { getRequest } = await import('@/network/get');
        const res = await getRequest(
          `${ROUTES_mod.default.linkPreview}?url=${encodeURIComponent(url)}`,
          { errorMessage: '' },
        );
        if (!cancelled && (res?.data?.title || res?.data?.description)) {
          setLinkPreview({ ...res.data, url });
        }
      } catch { /* silent */ }
    })();
    return () => { cancelled = true; };
  }, [text, isMe, serverLinkPreview]);
  const [reactionPickerVisible, setReactionPickerVisible] = useState(false);
  const [reactionViewerVisible, setReactionViewerVisible] = useState(false);
  const [reactionViewerEmoji, setReactionViewerEmoji] = useState<string | null>(null);

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
      try { await (audioPlayer as any).setPlaybackSpeed?.(playbackSpeed); } catch { /* not all versions support it */ }

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

  const handleCycleSpeed = async () => {
    const currentIdx = SPEED_CYCLE.indexOf(playbackSpeed);
    const nextSpeed = SPEED_CYCLE[(currentIdx + 1) % SPEED_CYCLE.length];
    setPlaybackSpeed(nextSpeed);
    if (isPlaying) {
      try { await (audioPlayer as any).setPlaybackSpeed?.(nextSpeed); } catch { /* silent */ }
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

  const handlePollOptionPress = (optionKey: string, rawOptionId: string) => {
    setSelectedPollOptionKey(optionKey);
    const messageId = (message as any).serverId ?? (message as any).id;
    if (messageId) {
      onVotePoll?.(messageId, rawOptionId);
    }
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
    !isLastInGroup
      ? isMe
        ? { borderBottomRightRadius: 8 }
        : { borderBottomLeftRadius: 8 }
      : null,
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

  const renderMentionText = (raw: string) => {
    const parts = raw.split(/(@\w+)/g);
    if (parts.length <= 1) {
      return <Text style={[styles.messageText, { color: textColor, fontSize: bubbleTextSize }]}>{raw}</Text>;
    }
    return (
      <Text style={[styles.messageText, { color: textColor, fontSize: bubbleTextSize }]}>
        {parts.map((part, i) =>
          /^@\w+$/.test(part) ? (
            <Text key={i} style={{ color: palette.mentionColor ?? palette.primary, fontWeight: '700' }}>
              {part}
            </Text>
          ) : (
            <React.Fragment key={i}>{part}</React.Fragment>
          ),
        )}
      </Text>
    );
  };

  /* ─────────────────────────────────────────
   * Helper: sender name (group chats)
   * ──────────────────────────────────────── */
  const renderSenderName = () => {
    if (isMe || !senderName || !isFirstInGroup) return null;
    return (
      <Text
        style={{
          fontSize: 11,
          fontWeight: '700',
          color: palette.senderNameColor ?? palette.primary ?? '#4F46E5',
          marginBottom: 2,
          marginLeft: 2,
        }}
        numberOfLines={1}
      >
        {senderName}
      </Text>
    );
  };

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
              onLongPress={() => {
                setReactionViewerEmoji(emoji);
                setReactionViewerVisible(true);
              }}
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

  const renderReactionViewerSheet = () => {
    if (!reactionEntries.length) return null;

    // Determine which emoji tab to show; default to first available
    const activeEmoji =
      reactionViewerEmoji &&
      reactionEntries.some(([e]) => e === reactionViewerEmoji)
        ? reactionViewerEmoji
        : reactionEntries[0]?.[0] ?? null;

    const activeUsers = activeEmoji
      ? (reactions?.[activeEmoji] ?? [])
      : [];

    return (
      <Modal
        transparent
        visible={reactionViewerVisible}
        animationType="slide"
        onRequestClose={() => setReactionViewerVisible(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.35)',
            justifyContent: 'flex-end',
          }}
          onPress={() => setReactionViewerVisible(false)}
        >
          <View
            style={{
              maxHeight: '55%',
              backgroundColor: palette.surface ?? '#fff',
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              paddingBottom: 24,
            }}
            onStartShouldSetResponder={() => true}
          >
            {/* Tab row */}
            <View
              style={{
                flexDirection: 'row',
                paddingHorizontal: 16,
                paddingTop: 12,
                paddingBottom: 8,
                borderBottomWidth: 1,
                borderBottomColor: palette.divider ?? '#00000011',
              }}
            >
              {reactionEntries.map(([emoji, users]) => {
                const isActive = emoji === activeEmoji;
                return (
                  <Pressable
                    key={emoji}
                    onPress={() => setReactionViewerEmoji(emoji)}
                    style={{
                      marginRight: 8,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 12,
                      backgroundColor: isActive
                        ? palette.reactionActiveBg ?? '#00000022'
                        : 'transparent',
                      borderWidth: isActive ? 1 : 0,
                      borderColor: isActive
                        ? palette.reactionActiveBorder ?? palette.primary
                        : 'transparent',
                    }}
                  >
                    <Text style={{ fontSize: 14 }}>
                      {emoji}{' '}
                      <Text
                        style={{
                          fontSize: 12,
                          color: palette.subtext ?? '#888',
                        }}
                      >
                        {Array.isArray(users) ? users.length : 0}
                      </Text>
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* User list */}
            {activeUsers.map((userId) => {
              const isCurrentUser =
                currentUserId && String(userId) === String(currentUserId);
              const displayName = isCurrentUser
                ? 'You'
                : `User ${String(userId).slice(0, 6)}`;
              return (
                <View
                  key={String(userId)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderBottomWidth: 1,
                    borderBottomColor: palette.divider ?? '#00000011',
                  }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor:
                        palette.surfaceSoft ?? palette.surface ?? '#eee',
                      marginRight: 12,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <KISIcon name="person" size={18} color={palette.subtext ?? '#888'} />
                  </View>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: isCurrentUser ? '700' : '400',
                      color: palette.text ?? '#111',
                    }}
                  >
                    {displayName}
                  </Text>
                </View>
              );
            })}
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

    // View-once: show "Tap to view" placeholder if not yet viewed
    if (isViewOnce && !viewOnceViewed && !isMe) {
      return (
        <Pressable
          onPress={() => {
            setViewOnceViewed(true);
            onViewOnce?.(messageId);
          }}
          style={{
            marginTop: 6,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            paddingHorizontal: 14,
            paddingVertical: 12,
            borderRadius: 14,
            backgroundColor: palette.surfaceSoft ?? 'rgba(0,0,0,0.08)',
          }}
        >
          <Text style={{ fontSize: 22 }}>👁</Text>
          <View>
            <Text style={{ fontSize: 14, fontWeight: '700', color: palette.text }}>View once</Text>
            <Text style={{ fontSize: 12, color: palette.subtext }}>Tap to open · disappears after viewing</Text>
          </View>
        </Pressable>
      );
    }

    const maxBubbleWidth = width * (responsive.isWatch ? 0.78 : responsive.isCompactPhone ? 0.74 : responsive.isTablet ? 0.52 : 0.7);

    const imageAtts = attachments.filter((a) => {
      const mime = a.mimeType ?? '';
      const kind = a.kind;
      return kind === 'image' || mime.startsWith('image/');
    });

    const videoAtts = attachments.filter((a) => {
      const mime = a.mimeType ?? '';
      const kind = a.kind;
      return kind === 'video' || mime.startsWith('video/');
    });

    const nonImageAtts = attachments.filter(
      (a) => !imageAtts.includes(a) && !videoAtts.includes(a),
    );

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

        {/* Video thumbnails with play overlay */}
        {videoAtts.length > 0 && (
          <View style={{ gap: 6, marginBottom: nonImageAtts.length > 0 ? 8 : 0 }}>
            {videoAtts.map((att) => {
              const videoW = Math.min(att.width ?? 220, maxBubbleWidth);
              const videoH = att.height && att.width ? (videoW * att.height) / att.width : videoW * 0.56;
              return (
                <Pressable
                  key={att.id}
                  onPress={() => setVideoFullscreenUri(att.url)}
                  style={{ borderRadius: 12, overflow: 'hidden', backgroundColor: '#000' }}
                >
                  <Video
                    source={{ uri: att.url }}
                    style={{ width: videoW, height: videoH }}
                    paused
                    resizeMode="cover"
                    muted
                  />
                  <View
                    style={{
                      position: 'absolute',
                      top: 0, left: 0, right: 0, bottom: 0,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: 'rgba(0,0,0,0.28)',
                    }}
                  >
                    <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.85)', alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="play" size={20} color="#111" />
                    </View>
                  </View>
                </Pressable>
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
                      width: responsive.isWatch ? 28 : 32,
                      height: responsive.isWatch ? 28 : 32,
                      borderRadius: responsive.isWatch ? 7 : 8,
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
                      size={responsive.isWatch ? 15 : 18}
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

          const rawOptionId =
            typeof opt.id === 'string' && opt.id.length > 0 ? opt.id : String(idx);
          const optionKey =
            typeof opt.id === 'string' && opt.id.length > 0
              ? `poll-opt-${opt.id}`
              : `poll-opt-${idx}`;

          const isSelected = selectedPollOptionKey === optionKey;

          return (
            <Pressable
              key={optionKey}
              onPress={() => handlePollOptionPress(optionKey, rawOptionId)}
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
                  overflow: 'hidden',
                }}
              >
                {/* Percentage fill bar behind content */}
                {totalVotes > 0 && (
                  <View
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: `${percentage}%`,
                      backgroundColor: isSelected
                        ? (palette.pollBarSelected ?? (palette.primary ?? '#4F46E5') + '44')
                        : (palette.pollBarBg ?? '#00000011'),
                      borderRadius: 10,
                    }}
                  />
                )}

                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, color: optionTextColor, fontWeight: isSelected ? '700' : '400' }}>
                      {opt.text}
                    </Text>
                    <Text style={{ fontSize: 11, color: metaTextColor, marginTop: 2 }}>
                      {votes} vote{votes === 1 ? '' : 's'}
                      {totalVotes > 0 ? ` • ${percentage}%` : ''}
                    </Text>
                  </View>

                  {isSelected && (
                    <Ionicons
                      name="checkmark-circle"
                      size={16}
                      color={palette.primary ?? '#4F46E5'}
                      style={{ marginLeft: 8 }}
                    />
                  )}
                </View>
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
   * Helper: location card
   * ──────────────────────────────────────── */
  const renderLocationCard = () => {
    const locationData = (message as any).location as
      | { lat?: number; lng?: number; latitude?: number; longitude?: number; label?: string; address?: string; title?: string }
      | undefined;
    if (!locationData) return null;

    const lat = locationData.lat ?? locationData.latitude ?? 0;
    const lng = locationData.lng ?? locationData.longitude ?? 0;
    const label = locationData.label ?? locationData.title ?? locationData.address;

    const titleColor = isMe ? outgoingTextColor : palette.text;
    const metaTextColor = isMe ? outgoingMetaColor : palette.subtext;

    const mapsUrl = Platform.select({
      ios: `maps://?q=${lat},${lng}`,
      default: `https://maps.google.com/?q=${lat},${lng}`,
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
          <KISIcon name="pin" size={14} color={titleColor} />
          <Text
            style={{
              marginLeft: 4,
              fontSize: 12,
              fontWeight: '600',
              color: titleColor,
            }}
          >
            Location
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
          {label || 'Shared location'}
        </Text>

        <Text
          style={{
            fontSize: 12,
            color: metaTextColor,
            marginBottom: 4,
          }}
        >
          {lat.toFixed(6)}, {lng.toFixed(6)}
        </Text>

        <Pressable
          onPress={() => {
            Linking.openURL(mapsUrl).catch(() => {});
          }}
          style={{
            alignSelf: 'flex-start',
            marginTop: 4,
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
            Open in Maps
          </Text>
        </Pressable>
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
              <View style={{ marginLeft: 4, alignSelf: 'center' }}>
                {renderStatusIcon(status, statusColor, 13)}
              </View>
            )}
          </View>
        </View>

        {renderReactionPicker()}
        {renderReactionViewerSheet()}
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
          {renderSenderName()}
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
                {isEdited ? ' • edited' : ''}
              </Text>
              {renderPinnedIcon()}
            </View>

            {isMe && status && (
              <View style={{ marginLeft: 4, alignSelf: 'center' }}>
                {renderStatusIcon(status, statusColor, 13)}
              </View>
            )}
          </View>
        </View>

        {renderReactionPicker()}
        {renderReactionViewerSheet()}
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
          {renderSenderName()}
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
                {isEdited ? ' • edited' : ''}
              </Text>
              {renderPinnedIcon()}
            </View>

            {isMe && status && (
              <View style={{ marginLeft: 4, alignSelf: 'center' }}>
                {renderStatusIcon(status, statusColor, 13)}
              </View>
            )}
          </View>
        </View>

        {renderReactionPicker()}
        {renderReactionViewerSheet()}
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
          {renderSenderName()}
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

          {/* Speed control + Transcription */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 12 }}>
            <Pressable
              onPress={handleCycleSpeed}
              style={{
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 8,
                backgroundColor: isMe ? 'rgba(255,255,255,0.15)' : (palette.surfaceSoft ?? '#0000000D'),
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '700', color: isMe ? '#fff' : palette.primary }}>
                {playbackSpeed}x
              </Text>
            </Pressable>
            <Pressable
              onPress={() => void handleShowTranscription()}
              disabled={transcribing}
              style={{ opacity: transcribing ? 0.5 : 1 }}
            >
              <Text style={{ fontSize: 11, color: metaColor }}>
                {transcribing ? 'Transcribing…' : showTranscription ? 'Hide transcript' : 'Transcript'}
              </Text>
            </Pressable>
          </View>
          {showTranscription && transcription ? (
            <View
              style={{
                marginTop: 4,
                paddingVertical: 6,
                paddingHorizontal: 8,
                borderRadius: 8,
                backgroundColor: isMe ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0.06)',
              }}
            >
              <Text style={{ fontSize: 12, color: textColor, fontStyle: 'italic' }}>{transcription}</Text>
            </View>
          ) : null}

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
                {isEdited ? ' • edited' : ''}
              </Text>
              {renderPinnedIcon()}
            </View>

            {isMe && status && (
              <View style={{ marginLeft: 4, alignSelf: 'center' }}>
                {renderStatusIcon(status, statusColor, 13)}
              </View>
            )}
          </View>
        </View>

        {renderReactionPicker()}
        {renderReactionViewerSheet()}
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
          { maxWidth: bubbleMaxWidth, paddingHorizontal: bubblePaddingX },
        ]}
      >
        {renderSenderName()}
        {renderReplyPreview()}

        {!!text && (
          <View>
            {renderMentionText((displayText ?? '') + (isLongText && !expanded ? '…' : ''))}
            {isLongText && (
              <Pressable onPress={() => setExpanded(prev => !prev)} style={{ marginTop: 2 }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: isMe ? 'rgba(255,255,255,0.75)' : (palette.primary ?? '#2196F3') }}>
                  {expanded ? t('Show less') : t('Read more')}
                </Text>
              </Pressable>
            )}
            {isEdited && (
              <Text style={{ fontSize: 10, color: metaColor, marginTop: 2 }}>(edited)</Text>
            )}
          </View>
        )}

        {/* Translation */}
        {text && text.length > 15 && !isMe && !translatedText && (
          <Pressable
            onPress={() => void handleTranslate()}
            style={{ marginTop: 4, opacity: translating ? 0.5 : 1 }}
            disabled={translating}
          >
            <Text style={{ color: palette.subtext ?? '#888', fontSize: 11 }}>
              {translating ? `🌐 ${t('Translating...')}` : `🌐 ${t('Translate')}`}
            </Text>
          </Pressable>
        )}
        {translating && isMe && (
          <Text style={{ fontSize: 11, color: palette.subtext ?? '#888', marginTop: 4 }}>🌐 {t('Translating...')}</Text>
        )}
        {translatedText && (
          <View style={{ marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: 'rgba(128,128,128,0.2)' }}>
            <Text style={{ fontSize: 10, color: palette.subtext ?? '#888', marginBottom: 2 }}>
              🌐 {t('Translation')}
            </Text>
            <Text style={{ color: isMe ? '#fff' : (palette.text ?? '#000'), fontSize: 14 }}>{translatedText}</Text>
            <Pressable onPress={() => setTranslatedText(null)}>
              <Text style={{ fontSize: 10, color: palette.subtext ?? '#888', marginTop: 2 }}>
                {t('Hide')}
              </Text>
            </Pressable>
          </View>
        )}

        {/* Link preview card */}
        {linkPreview && linkPreview.title && (
          <Pressable
            onPress={() => { const u = linkPreview.url ?? linkPreviewUrl; if (u) Linking.openURL(u).catch(() => {}); }}
            style={{
              marginTop: 6,
              borderRadius: 10,
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: isMe ? 'rgba(255,255,255,0.2)' : (palette.divider ?? '#e0e0e0'),
              backgroundColor: isMe ? 'rgba(0,0,0,0.08)' : (palette.surface ?? '#f5f5f5'),
            }}
          >
            {linkPreview.image ? (
              <Image
                source={{ uri: linkPreview.image }}
                style={{ width: '100%', height: 120 }}
                resizeMode="cover"
              />
            ) : null}
            <View style={{ padding: 8, gap: 2 }}>
              {linkPreview.site_name ? (
                <Text style={{ fontSize: 10, color: palette.primary ?? '#2196F3', fontWeight: '700', textTransform: 'uppercase' }}>
                  {linkPreview.site_name}
                </Text>
              ) : null}
              <Text style={{ fontSize: 13, fontWeight: '700', color: isMe ? '#fff' : (palette.text ?? '#000') }} numberOfLines={2}>
                {linkPreview.title}
              </Text>
              {linkPreview.description ? (
                <Text style={{ fontSize: 11, color: isMe ? 'rgba(255,255,255,0.7)' : (palette.subtext ?? '#666') }} numberOfLines={2}>
                  {linkPreview.description}
                </Text>
              ) : null}
            </View>
          </Pressable>
        )}

        {/* Contacts / Poll / Event / Location cards */}
        {renderContactsCard()}
        {renderPollCard()}
        {renderEventCard()}
        {renderLocationCard()}

        {/* Attachments (images, files, etc.) */}
        {renderAttachments()}

        {renderReactionsRow()}
        {renderRetry()}

        <View style={styles.messageMetaRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            {isStarred && (
              <Text style={{ fontSize: 11 }}>⭐</Text>
            )}
            {disappearSecsLeft !== null && disappearSecsLeft > 0 && (
              <Text style={{ fontSize: 10, color: metaColor }}>
                ⏱ {disappearSecsLeft < 60
                  ? `${disappearSecsLeft}s`
                  : disappearSecsLeft < 3600
                  ? `${Math.floor(disappearSecsLeft / 60)}m`
                  : `${Math.floor(disappearSecsLeft / 3600)}h`}
              </Text>
            )}
            <Text
              style={[
                styles.messageTime,
                { color: metaColor },
              ]}
            >
              {timeLabel}
              {isEdited ? ' • edited' : ''}
            </Text>
            {renderPinnedIcon()}
          </View>

          {isMe && status && (
            <Pressable
              onPress={() => onShowReadReceipts?.(message as ChatMessage)}
              style={{ marginLeft: 4, alignSelf: 'center' }}
              hitSlop={6}
            >
              {renderStatusIcon(status, statusColor, 13)}
            </Pressable>
          )}
        </View>
      </View>

      {renderReactionPicker()}
      {renderReactionViewerSheet()}

      {/* Fullscreen video player */}
      {videoFullscreenUri && (
        <Modal
          visible
          transparent={false}
          animationType="fade"
          onRequestClose={() => setVideoFullscreenUri(null)}
          statusBarTranslucent
        >
          <View style={{ flex: 1, backgroundColor: '#000' }}>
            <Video
              source={{ uri: videoFullscreenUri }}
              style={{ flex: 1 }}
              resizeMode="contain"
              controls
            />
            <Pressable
              onPress={() => setVideoFullscreenUri(null)}
              style={{ position: 'absolute', top: 44, left: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="close" size={22} color="#fff" />
            </Pressable>
          </View>
        </Modal>
      )}
    </View>
  );
};
