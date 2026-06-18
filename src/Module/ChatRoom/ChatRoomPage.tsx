// src/screens/chat/ChatRoomPage.tsx

/**
 * ChatRoomPage
 * -----------------------------------------------------------------------------
 * This screen is the orchestration layer for:
 * - Message rendering
 * - Draft management
 * - Selection / bulk actions
 * - DM lock rules
 * - Attachment & rich message dispatch
 * - Socket-backed optimistic messaging
 *
 * IMPORTANT:
 * - Business logic lives in hooks + handlers
 * - This page ONLY coordinates state & UI
 * - Socket lifecycle is abstracted away
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  Alert,
  DeviceEventEmitter,
  ImageBackground,
} from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { useKISTheme } from '../../theme/useTheme';
import { chatRoomStyles as styles } from './chatRoomStyles';
import { KISIcon } from '@/constants/kisIcons';

/* -------------------------------------------------------------------------- */
/*                                   UI PARTS                                 */
/* -------------------------------------------------------------------------- */

import { ChatHeader } from './componets/main/ChatHeader';
import ChatRoomBody from './ChatRoomBody';
import ChatRoomOverlays from './ChatRoomOverlays';
import ChatRoomEditors from './ChatRoomEditors';
import ChatRoomSheets from './ChatRoomSheets';
import { TextCardPayload } from './componets/main/TextCardComposer';
import { Sticker } from './componets/main/FroSticker/StickerEditor';

/* -------------------------------------------------------------------------- */
/*                                   HOOKS                                    */
/* -------------------------------------------------------------------------- */

import { useChatAuth } from './hooks/useChatAuth';
import { useConversationBootstrap } from './hooks/useConversationBootstrap';
import { useDraftState } from './hooks/useDraftState';
import { useChatMessaging } from './hooks/useChatMessaging';
import { useSelectionState } from './hooks/useSelectionState';
import { useBulkMessageActions } from './hooks/useBulkMessageActions';
import { useSocket } from '../../../SocketProvider';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES, { NEST_API_BASE_URL } from '@/network';
import { loadMessages } from './Storage/chatStorage';

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

import type {
  ChatMessage,
  ChatRoomPageProps,
  SubRoom,
} from './chatTypes';
export type { ChatMessage } from './chatTypes';
import { participantsToIds } from './messagesUtils';

const DARK_CHAT_BACKGROUND = require('../../assets/dark_chat_background.png');
const LIGHT_CHAT_BACKGROUND = require('../../assets/light_chat_background.png');

/* -------------------------------------------------------------------------- */
/*                        ATTACHMENTS / RICH PAYLOADS                          */
/* -------------------------------------------------------------------------- */

import { SimpleContact } from './componets/main/ForAttachments/ContactsModal';
import { PollDraft } from './componets/main/ForAttachments/PollModal';
import { EventDraft } from './componets/main/ForAttachments/EventModal';

/* -------------------------------------------------------------------------- */
/*                               CENTRAL HANDLERS                              */
/* -------------------------------------------------------------------------- */

import * as Handlers from './ChatRoomHandlers';
import type { LocationMessage, ReadByEntry } from './chatTypes';
import {
  saveStarredMessage,
  removeStarredMessage,
} from './componets/main/StarredMessagesSheet';
import type { DisappearDuration } from './componets/main/DisappearingTimerSheet';
import { saveWallpaper, loadWallpaper, WALLPAPER_OPTIONS } from './componets/main/WallpaperPickerSheet';
import { QuickRepliesBar } from './componets/main/QuickRepliesBar';
import { normalizeChatDisplayText, normalizeChatSendText } from './safeChatText';

/* -------------------------------------------------------------------------- */
/*                                   HELPERS                                  */
/* -------------------------------------------------------------------------- */

export type FilesType = {
  uri: string;
  name: string;
  type: string | null;
  size?: number | null;
  durationMs?: number | null;
  originalUri?: string | null;
};

export type UploadStatus = 'verifying' | 'uploading' | 'done' | 'failed' | 'verification_failed';

type UploadBubble = ChatMessage & {
  _uploadProgress: number;
  _uploadStatus: 'verifying' | 'uploading' | 'verification_failed' | 'failed';
  _uploadInput?: AttachmentFilePayload;
};

export type AttachmentFilePayload = {
  files?: FilesType[];
  caption?: string;
  onProgress?: (uri: string, progress: number) => void;
  onStatus?: (uri: string, status: UploadStatus) => void;
  onUploadedReady?: () => void;
};

const normalizeSubRoom = (
  row: any,
  parentRoomId: string,
  meta?: { unreadCount?: number; lastMessage?: string; lastAt?: string },
): SubRoom | null => {
  const conversationId =
    row?.child_conversation_id ??
    row?.childConversationId ??
    row?.child_conversation?.id ??
    row?.childConversation?.id ??
    row?.conversationId ??
    null;
  if (!conversationId) return null;
  return {
    id: String(row?.id ?? conversationId),
    parentRoomId,
    conversationId: String(conversationId),
    rootMessageId: row?.parent_message_key ?? row?.rootMessageId ?? undefined,
    title:
      row?.child_title ??
      row?.child_conversation?.title ??
      row?.childConversation?.title ??
      row?.title ??
      'Sub-room',
    unreadCount: meta?.unreadCount,
    lastMessage: meta?.lastMessage,
    lastAt: meta?.lastAt,
  };
};

type ExtendedChatRoomPageProps = ChatRoomPageProps & {
  hideHeader?: boolean;
  onOpenInfo?: (payload: { chat: ChatRoomPageProps['chat']; currentUserId: string | null }) => void;
  onOpenChat?: (chat: NonNullable<ChatRoomPageProps['chat']>) => void;
  initialTargetMessageId?: string | null;
  headerContextLabel?: string | null;
  onPressHeaderContext?: () => void;
  safeAreaTopInsetOverride?: number;
  showMessageCount?: boolean;
  messageCountLabel?: string;
  onMessageCountChange?: (count: number) => void;
};

type MessageLocator = {
  scrollToMessage: (messageId: string) => void;
  highlightMessage: (messageId: string) => void;
};

/* ========================================================================== */
/*                                MAIN COMPONENT                              */
/* ========================================================================== */

export const ChatRoomPage: React.FC<ExtendedChatRoomPageProps> = ({
  chat,
  onBack,
  allChats = [],
  onForwardMessages,
  hideHeader,
  onOpenInfo,
  onOpenChat,
  initialTargetMessageId,
  headerContextLabel,
  onPressHeaderContext,
  safeAreaTopInsetOverride,
  showMessageCount = false,
  messageCountLabel,
  onMessageCountChange,
}) => {
  /* ------------------------------------------------------------------------ */
  /*                               THEME / SAFE AREA                           */
  /* ------------------------------------------------------------------------ */

  const { palette, isDark } = useKISTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const topInset =
    typeof safeAreaTopInsetOverride === 'number'
      ? safeAreaTopInsetOverride
      : insets.top;

  /* ------------------------------------------------------------------------ */
  /*                               AUTH CONTEXT                                */
  /* ------------------------------------------------------------------------ */

  const { authToken, currentUserId: authCurrentUserId, currentUserName } =
    useChatAuth(chat);
  const { typingByConversation, typingDisplayNames, presenceByUser, socket, isNetworkOnline, startCall, currentUserId: socketCurrentUserId } = useSocket();
  const currentUserId = authCurrentUserId || String(socketCurrentUserId ?? '');

  /* ------------------------------------------------------------------------ */
  /*                         CONVERSATION BOOTSTRAP                            */
  /* ------------------------------------------------------------------------ */

  const {
    isDirectChat,
    conversationId,
    storageRoomId,
    ensureConversationId,
  } = useConversationBootstrap(chat, authToken);

  /* ------------------------------------------------------------------------ */
  /*                                DRAFT STATE                                */
  /* ------------------------------------------------------------------------ */

  const {
    draft,
    setDraft,
    draftKey,
    setDraftsByKey,
    handleChangeDraft,
  } = useDraftState(conversationId, chat?.id);

  /* ------------------------------------------------------------------------ */
  /*                          MESSAGING (SOCKET-BACKED)                        */
  /* ------------------------------------------------------------------------ */

  const {
    messages,
    sendTextMessage,
    sendRichMessage,
    editMessage,
    softDeleteMessage,
    replyToMessage,
    sendTyping,
    sendReaction,
    votePoll,
    retryMessage,
    markMessagesRead,
    requestHistoryBatch,
    mapServerMessage,
    replaceMessages,
    localDeleteMessage,
    clearAllMessages,
  } = useChatMessaging({
    chat,
    storageRoomId,
    currentUserId,
    currentUserName,
    conversationId,
  });

  useEffect(() => {
    if (!onMessageCountChange) return;
    const count = messages.filter((msg) => !msg.isDeleted).length;
    onMessageCountChange(count);
  }, [messages, onMessageCountChange]);

  /* ======================================================================== */
  /*                              LOCAL UI STATE                               */
  /* ======================================================================== */

  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const [chatHeaderH, setChatHeaderH] = useState(56);
  const noop = () => {};

  const [openStickerEditor, setOpenStickerEditor] = useState(false);
  const [textCardBg, setTextCardBg] = useState<string | null>(null);
  const [stickerLibraryVersion, setStickerLibraryVersion] =
    useState(0);

  const [forwardSheetVisible, setForwardSheetVisible] =
    useState(false);
  const [pinnedSheetVisible, setPinnedSheetVisible] =
    useState(false);
  const [subRoomsSheetVisible, setSubRoomsSheetVisible] =
    useState(false);
  const [menuVisible, setMenuVisible] = useState(false);

  // ── New feature state ──────────────────────────────────────────────────────
  const [starredSheetVisible, setStarredSheetVisible] = useState(false);
  const [readReceiptsSheetVisible, setReadReceiptsSheetVisible] = useState(false);
  const [readReceiptsData, setReadReceiptsData] = useState<ReadByEntry[]>([]);
  const [disappearingSheetVisible, setDisappearingSheetVisible] = useState(false);
  const [disappearingSeconds, setDisappearingSeconds] = useState<DisappearDuration>(0);
  const [wallpaperSheetVisible, setWallpaperSheetVisible] = useState(false);
  const [wallpaperId, setWallpaperId] = useState<string>('default');
  const [scheduledQueue, setScheduledQueue] = useState<
    { text: string; scheduledAt: string; timerId: ReturnType<typeof setTimeout> }[]
  >([]);

  const [uploadBubbles, setUploadBubbles] = useState<Record<string, UploadBubble>>({});

  const messagesWithUploads = useMemo(() => {
    const uploadLocalKeys = new Set<string>();
    const uploadFileSignatures = new Set<string>();
    const isMediaAttachment = (attachment: any) => {
      const kind = String(attachment?.kind ?? '').trim().toLowerCase();
      const mime = String(attachment?.mimeType ?? attachment?.mime ?? attachment?.type ?? '').trim().toLowerCase();
      const nameOrUri = String(
        attachment?.originalName ??
          attachment?.name ??
          attachment?.localUri ??
          attachment?.uri ??
          attachment?.url ??
          '',
      ).toLowerCase();
      return (
        kind === 'image' ||
        kind === 'video' ||
        mime.startsWith('image/') ||
        mime.startsWith('video/') ||
        /\.(jpe?g|png|webp|heic|heif|gif|mp4|mov|m4v)(\?|#|$)/i.test(nameOrUri)
      );
    };
    const activeMediaUploadBubbles = Object.values(uploadBubbles).filter((bubble: any) => {
      const attachments = Array.isArray(bubble?.attachments) ? bubble.attachments : [];
      return attachments.some(isMediaAttachment);
    });

    const getMessageTimeMs = (value: any) => {
      const raw = value?.createdAt ?? value?.created_at ?? value?.timestamp ?? value?.sentAt;
      if (typeof raw === 'number') return raw;
      if (raw instanceof Date) return raw.getTime();
      if (typeof raw === 'string') {
        const parsed = Date.parse(raw);
        if (Number.isFinite(parsed)) return parsed;
      }
      return 0;
    };

    const hasMediaAttachment = (attachments: any[]) =>
      attachments.some(isMediaAttachment);

    const collectUploadKeys = (attachment: any) => {
      if (!attachment || typeof attachment !== 'object') return;
      const localKey = attachment.localUploadKey;
      const localUri = attachment.localUri ?? attachment.uri ?? attachment.url;
      if (typeof localKey === 'string' && localKey) uploadLocalKeys.add(localKey);
      if (typeof localUri === 'string' && localUri) uploadLocalKeys.add(localUri);
      const name = String(attachment.originalName ?? attachment.name ?? '').trim().toLowerCase();
      const mime = String(attachment.mimeType ?? attachment.mime ?? attachment.type ?? '').trim().toLowerCase();
      if (name || mime) uploadFileSignatures.add(`${name}:${mime}`);
    };

    Object.values(uploadBubbles).forEach((bubble: any) => {
      (Array.isArray(bubble?.attachments) ? bubble.attachments : []).forEach(collectUploadKeys);
    });

    const visibleMessages = messages.filter((message: any) => {
      const attachments = Array.isArray(message?.attachments) ? message.attachments : [];
      if (attachments.length === 0) return true;

      if (activeMediaUploadBubbles.length > 0 && hasMediaAttachment(attachments)) {
        const messageTime = getMessageTimeMs(message);
        const sender = String(message?.senderId ?? '');
        const fromMe = Boolean(message?.fromMe);
        const hasMatchingUploadBubble = activeMediaUploadBubbles.some((bubble: any) => {
          const bubbleTime = getMessageTimeMs(bubble);
          const sameSender =
            (sender && sender === String(bubble?.senderId ?? '')) ||
            (fromMe && Boolean(bubble?.fromMe));
          if (!sameSender) return false;
          if (!messageTime || !bubbleTime) return true;
          return messageTime >= bubbleTime - 60_000 && messageTime <= bubbleTime + 10 * 60_000;
        });
        if (hasMatchingUploadBubble) return false;
      }

      return !attachments.some((attachment: any) => {
        const localKey = attachment?.localUploadKey;
        const localUri = attachment?.localUri ?? attachment?.uri ?? attachment?.url;
        if (typeof localKey === 'string' && uploadLocalKeys.has(localKey)) return true;
        if (typeof localUri === 'string' && uploadLocalKeys.has(localUri)) return true;
        const name = String(attachment?.originalName ?? attachment?.name ?? '').trim().toLowerCase();
        const mime = String(attachment?.mimeType ?? attachment?.mime ?? attachment?.type ?? '').trim().toLowerCase();
        return Boolean(name || mime) && uploadFileSignatures.has(`${name}:${mime}`);
      });
    });

    return [...visibleMessages, ...Object.values(uploadBubbles)] as ChatMessage[];
  }, [messages, uploadBubbles]);

  // Load wallpaper on mount
  useEffect(() => {
    const chatId = String(conversationId ?? chat?.id ?? '');
    if (!chatId) return;
    loadWallpaper(chatId).then(setWallpaperId);
  }, [conversationId, chat?.id]);

  // Persist + restore scheduled queue so it survives app restarts
  const SCHED_KEY = `kis.scheduled.${conversationId ?? chat?.id ?? 'unknown'}`;
  useEffect(() => {
    if (!conversationId && !chat?.id) return;
    AsyncStorage.getItem(SCHED_KEY).then((raw) => {
      if (!raw) return;
      try {
        const saved: { text: string; scheduledAt: string }[] = JSON.parse(raw);
        const now = Date.now();
        saved.forEach((item) => {
          const delay = new Date(item.scheduledAt).getTime() - now;
          if (delay <= 0) {
            sendTextMessage(item.text);
          } else {
            const timerId = setTimeout(() => sendTextMessage(item.text), delay);
            setScheduledQueue((prev) => [...prev, { ...item, timerId }]);
          }
        });
        AsyncStorage.removeItem(SCHED_KEY);
      } catch { /* silent */ }
    });
  // Only on mount for this conversation
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, chat?.id]);

  useEffect(() => {
    if (!conversationId && !chat?.id) return;
    if (scheduledQueue.length === 0) { AsyncStorage.removeItem(SCHED_KEY).catch(() => {}); return; }
    const toSave = scheduledQueue.map(({ text, scheduledAt }) => ({ text, scheduledAt }));
    AsyncStorage.setItem(SCHED_KEY, JSON.stringify(toSave)).catch(() => {});
  }, [scheduledQueue, SCHED_KEY]);

  // Listen for incoming disappearing-message setting changes from the other party
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('chat.disappear.update', (payload: any) => {
      const convId = String(conversationId ?? chat?.id ?? '');
      if (!convId || String(payload?.conversationId) !== convId) return;
      const secs = Number(payload?.seconds ?? 0);
      setDisappearingSeconds(secs as DisappearDuration);
    });
    return () => sub.remove();
  }, [conversationId, chat?.id]);

  const SUBROOMS_CACHE_PREFIX = 'KIS_SUBROOMS_V1:';

  const [subRooms, setSubRooms] = useState<SubRoom[]>([]);
  const loadSubRooms = useCallback(async () => {
    const convId = String(conversationId ?? chat?.conversationId ?? chat?.id ?? '');
    if (!convId || convId.startsWith('newContact-')) return;
    let mounted = true;

    // 1. Load from cache immediately
    try {
      const cached = await AsyncStorage.getItem(`${SUBROOMS_CACHE_PREFIX}${convId}`);
      if (cached && mounted) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSubRooms(parsed);
        }
      }
    } catch { /* silent */ }

    // 2. Fetch from backend and update
    try {
      const res = await getRequest(
        `${ROUTES.chat.threads}?parent_conversation=${encodeURIComponent(convId)}`,
        { errorMessage: 'Unable to load sub-rooms.' },
      );
      if (!mounted) return;
      const rows = res?.data?.results ?? res?.data ?? res?.results ?? [];
      if (!Array.isArray(rows)) return;
      const normalized = rows
        .map((row: any) => normalizeSubRoom(row, convId))
        .filter(Boolean) as SubRoom[];

      const enriched = await Promise.all(
        normalized.map(async (sr) => {
          try {
            const msgs = await loadMessages(sr.conversationId, currentUserId ?? undefined);
            const unread = msgs.filter((m) => !m.fromMe && m.status !== 'read').length;
            const last = msgs[msgs.length - 1];
            return {
              ...sr,
              unreadCount: unread || undefined,
              lastMessage: last
                ? typeof last.text === 'string' ? last.text.slice(0, 80) : undefined
                : undefined,
              lastAt: last?.createdAt ?? undefined,
            };
          } catch {
            return sr;
          }
        }),
      );

      if (!mounted) return;
      setSubRooms(enriched);
      try {
        await AsyncStorage.setItem(`${SUBROOMS_CACHE_PREFIX}${convId}`, JSON.stringify(enriched));
      } catch { /* silent */ }
    } catch { /* silent */ }

    return () => { mounted = false; };
  }, [chat?.conversationId, chat?.id, conversationId, currentUserId]);

  useEffect(() => {
    loadSubRooms();
  }, [loadSubRooms]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('message.decrypted', (payload: any) => {
      const convId = String(payload?.conversationId ?? '');
      if (convId && subRooms.some((sr) => sr.conversationId === convId)) {
        loadSubRooms();
      }
    });
    return () => sub.remove();
  }, [subRooms, loadSubRooms]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('subroom.message', (payload: any) => {
      const convId = String(payload?.conversationId ?? '');
      if (convId && subRooms.some((sr) => sr.conversationId === convId)) {
        loadSubRooms();
      }
    });
    return () => sub.remove();
  }, [subRooms, loadSubRooms]);
  const [messageLocator, setMessageLocator] =
    useState<MessageLocator | null>(null);
  const initialUnreadJumpRef = useRef<string | null>(null);
  const composerLinkPreviewRef = useRef<{ title?: string; description?: string; image?: string; site_name?: string; url: string } | null>(null);

  // member.tap popup (group sender avatar/name tap)
  const [memberTap, setMemberTap] = useState<{ userId?: string; name: string; avatarUrl?: string } | null>(null);

  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isActivelyTypingRef = useRef(false);
  const [lockOverride, setLockOverride] = useState<boolean | null>(null);
  const [muteOverride, setMuteOverride] = useState<boolean | null>(null);
  const [requestStateOverride, setRequestStateOverride] = useState<string | null>(null);
  const [groupAction, setGroupAction] = useState<'add' | 'remove' | 'role' | null>(null);
  const [groupUserIdInput, setGroupUserIdInput] = useState('');
  const [groupRoleInput, setGroupRoleInput] = useState('member');

  const handleOpenSubRoom = useCallback(
    (subRoom: SubRoom) => {
      const chatPayload: NonNullable<ChatRoomPageProps['chat']> = {
        id: subRoom.conversationId,
        conversationId: subRoom.conversationId,
        name: subRoom.title || 'Sub-room',
        title: subRoom.title || 'Sub-room',
        kind: 'thread',
        isGroup: true,
        isGroupChat: true,
      } as NonNullable<ChatRoomPageProps['chat']>;
      setSubRoomsSheetVisible(false);
      if (onOpenChat) {
        onOpenChat(chatPayload);
        return;
      }
      DeviceEventEmitter.emit('chat.open', chatPayload);
    },
    [onOpenChat],
  );

  const handleEditThreadSubject = useCallback(
    (subRoom: SubRoom) => {
      const doRename = (newTitle: string) => {
        const trimmed = newTitle.trim();
        if (!trimmed) return;
        setSubRooms((prev) =>
          prev.map((sr) =>
            sr.conversationId === subRoom.conversationId
              ? { ...sr, title: trimmed }
              : sr,
          ),
        );
        socket?.emit('subroom.rename', {
          subroomId: subRoom.conversationId,
          title: trimmed,
        });
      };
      if (Platform.OS === 'ios') {
        Alert.prompt(
          'Edit thread subject',
          'Enter a new subject for this thread.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Save', onPress: (val: string | undefined) => doRename(val ?? '') },
          ],
          'plain-text',
          subRoom.title ?? '',
        );
      } else {
        Alert.alert(
          'Edit thread subject',
          'Enter a new subject for this thread.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Save', onPress: () => doRename(subRoom.title ?? '') },
          ],
        );
      }
    },
    [socket],
  );

  const handleReactMessage = useCallback(
    (message: ChatMessage, emoji: string) => {
      const fallbackId =
        message.id && message.id.startsWith('client_')
          ? null
          : message.id;
      const messageId = message.serverId ?? fallbackId;
      const convId =
        message.conversationId ?? conversationId ?? chat?.id ?? null;
      if (!messageId || !convId) return;

      // Toggle: if the current user already reacted with this emoji, remove it
      const existingReactions = message.reactions ?? {};
      const reactors: string[] = existingReactions[emoji] ?? [];
      const alreadyReacted = currentUserId
        ? reactors.includes(currentUserId)
        : false;

      if (alreadyReacted) {
        sendReaction(messageId, emoji, convId, true);
      } else {
        sendReaction(messageId, emoji, convId);
      }
    },
    [sendReaction, conversationId, chat?.id, currentUserId],
  );

  const handleVotePoll = useCallback(
    (message: ChatMessage, optionId: string) => {
      const fallbackId =
        message.id && message.id.startsWith('client_')
          ? null
          : message.id;
      const messageId = message.serverId ?? fallbackId;
      if (!messageId) return;
      votePoll(messageId, optionId);
    },
    [votePoll],
  );

  /* ======================================================================== */
  /*                              SELECTION MODE                               */
  /* ======================================================================== */

  const {
    selectionMode,
    selectedIds,
    enterSelectionMode,
    toggleSelectMessage,
    exitSelectionMode,
    selectedMessages,
    isSingleSelection,
    pinnedMessages,
    pinnedCount,
    subRoomCount,
  } = useSelectionState(messages, subRooms);

  const forwardTargets = useMemo(() => {
    const currentId = String(chat?.conversationId ?? chat?.id ?? '');
    return allChats.filter((c) => {
      const id = String((c as any)?.conversationId ?? (c as any)?.id ?? '');
      return id && id !== currentId;
    });
  }, [allChats, chat?.conversationId, chat?.id]);

  const mentionParticipants = useMemo(() => {
    const parts = chat?.participants ?? [];
    if (!Array.isArray(parts) || parts.length === 0) return [];
    return parts
      .map((p: any) => {
        const id = String(p?.id ?? p?.user?.id ?? p ?? '');
        const name =
          p?.display_name ??
          p?.user?.display_name ??
          p?.user?.username ??
          (typeof p === 'string' ? p : null);
        if (!name || !id) return null;
        return { id, name: String(name) };
      })
      .filter(Boolean) as { id: string; name: string }[];
  }, [chat?.participants]);

  const participantMap = useMemo(() => {
    const map: Record<string, string> = {};
    mentionParticipants.forEach(p => { map[p.id] = p.name; });
    return map;
  }, [mentionParticipants]);

  const participantAvatarMap = useMemo(() => {
    const map: Record<string, string> = {};
    const parts = chat?.participants ?? [];
    if (!Array.isArray(parts)) return map;
    (parts as any[]).forEach((p: any) => {
      const id = String(p?.id ?? p?.user?.id ?? p ?? '');
      const avatar =
        p?.user?.avatar_url ??
        p?.user?.profile_picture ??
        p?.user?.avatarUrl ??
        p?.avatar_url ??
        p?.profile_picture ??
        p?.avatarUrl ?? '';
      if (id && avatar) map[id] = String(avatar);
    });
    return map;
  }, [chat?.participants]);

  const createForwardClientId = useCallback(
    () => `client_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    [],
  );

  const buildForwardPayload = useCallback((message: ChatMessage) => {
    const kind = message.kind ?? 'text';
    const text = message.text ?? message.styledText?.text ?? '';
    const attachments = message.attachments ?? [];

    const hasContent =
      text.trim().length > 0 ||
      Boolean(message.styledText) ||
      Boolean(message.sticker) ||
      Boolean(message.voice) ||
      Boolean(message.poll) ||
      Boolean(message.event) ||
      Boolean(message.contacts?.length) ||
      attachments.length > 0;

    if (!hasContent) return null;

    return {
      kind,
      text,
      styledText: message.styledText ?? null,
      voice: message.voice ?? null,
      sticker: message.sticker ?? null,
      contacts: message.contacts ?? null,
      poll: message.poll ?? null,
      event: message.event ?? null,
      attachments,
    };
  }, []);

  const handleForwardConfirm = useCallback(
    async (chatIds: string[]) => {
      if (!chatIds.length || selectedMessages.length === 0) {
        setForwardSheetVisible(false);
        return;
      }

      if (onForwardMessages) {
        onForwardMessages({
          fromRoomId: String(storageRoomId),
          toChatIds: chatIds,
          messages: selectedMessages,
        });
        exitSelectionMode();
        setForwardSheetVisible(false);
        return;
      }

      if (!socket) {
        Alert.alert('Forward', 'Unable to forward messages right now.');
        return;
      }

      chatIds.forEach((chatId) => {
        selectedMessages.forEach((message) => {
          const payload = buildForwardPayload(message);
          if (!payload) return;
          socket.emit('chat.send', {
            conversationId: chatId,
            clientId: createForwardClientId(),
            ...payload,
          });
        });
      });

      exitSelectionMode();
      setForwardSheetVisible(false);
    },
    [
      selectedMessages,
      socket,
      onForwardMessages,
      buildForwardPayload,
      createForwardClientId,
      exitSelectionMode,
      storageRoomId,
    ],
  );

  // ── Single-message action handlers (from long-press action sheet) ──────────
  const handleForwardSingleMessage = useCallback(
    (message: ChatMessage) => {
      // Put the message into the forward targets sheet as if it were selected
      enterSelectionMode(message);
      setForwardSheetVisible(true);
    },
    [enterSelectionMode],
  );

  const handleDeleteSingleMessage = useCallback(
    async (message: ChatMessage) => {
      await softDeleteMessage(message.id);
    },
    [softDeleteMessage],
  );

  const handleUpdateMessage = useCallback(
    (updatedMessage: ChatMessage) => {
      replaceMessages(messages.map((message) => {
        const sameId =
          message.id === updatedMessage.id ||
          message.clientId === updatedMessage.clientId ||
          (message.serverId && message.serverId === updatedMessage.serverId);
        return sameId ? { ...message, ...updatedMessage } : message;
      }));
    },
    [messages, replaceMessages],
  );

  const handleLocalDeleteMessage = useCallback(
    async (message: ChatMessage) => {
      await localDeleteMessage(message.id);
    },
    [localDeleteMessage],
  );

  const handleClearChat = useCallback(() => {
    Alert.alert(
      'Clear chat',
      'This will remove all messages from this conversation on your device only. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await clearAllMessages();
          },
        },
      ],
    );
  }, [clearAllMessages]);

  const handlePinSingleMessage = useCallback(
    (message: ChatMessage) => {
      const convId = message.conversationId ?? conversationId ?? chat?.id ?? null;
      const messageId =
        message.serverId ??
        (message.id && !message.id.startsWith('client_') ? message.id : null);
      if (!convId || !messageId) return;
      Handlers.handleSetPinned({
        conversationId: String(convId),
        messageId: String(messageId),
        pinned: !(message as any).isPinned,
      });
    },
    [conversationId, chat?.id],
  );
  // ─────────────────────────────────────────────────────────────────────────

  const {
    handlePinSelected,
    handleDeleteSelected,
    handleCopySelected,
    handleMoreSelected,
    handleContinueInSubRoom,
  } = useBulkMessageActions({
    selectedIds,
    selectedMessages,
    messages,
    editMessage,
    softDeleteMessage,
    exitSelectionMode,
    isSingleSelection,
    canBroadcast: chat?.kind === 'channel',
    onBroadcastMessages: async (payload) => {
      const convId = String(conversationId ?? chat?.conversationId ?? chat?.id ?? '');
      if (!convId) {
        Alert.alert('Broadcast', 'Conversation ID is missing.');
        return;
      }
      const messageIds = payload
        .map((m) => m.serverId ?? (m.id?.startsWith('client_') ? null : m.id))
        .filter(Boolean);
      if (messageIds.length === 0) {
        Alert.alert('Broadcast', 'Select at least one delivered message.');
        return;
      }

      const res = await postRequest(
        ROUTES.broadcasts.channelMessages,
        { conversation_id: convId, message_ids: messageIds },
        { errorMessage: 'Unable to broadcast selected messages.' },
      );
      if (!res?.success) {
        Alert.alert('Broadcast', res?.message || 'Unable to broadcast messages.');
        return;
      }
      DeviceEventEmitter.emit('broadcast.refresh');
      Alert.alert('Broadcast', 'Messages added to broadcast.');
    },
    onReportMessage: async (message) => {
      const convId =
        message.conversationId ?? conversationId ?? chat?.id ?? null;
      const messageId =
        message.serverId ??
        (message.id && message.id.startsWith('client_') ? null : message.id);
      if (!convId || !messageId) return false;
      const reported = await Handlers.handleReportMessage({
        conversationId: String(convId),
        messageId: String(messageId),
        reason: 'user_reported',
      });
      return Boolean(reported);
    },
    onEditMessage: (message) => {
      setEditing(message);
    },
    onDeleteForEveryone: async (message) => {
      await softDeleteMessage(message.id);
    },
    onPinMessage: (message, pinned) => {
      const convId =
        message.conversationId ?? conversationId ?? chat?.id ?? null;
      const messageId =
        message.serverId ??
        (message.id && message.id.startsWith('client_') ? null : message.id);
      if (!convId || !messageId) return;
      Handlers.handleSetPinned({
        conversationId: String(convId),
        messageId: String(messageId),
        pinned,
      });
    },
    onContinueInSubRoom: async (message) => {
      const rootId =
        message.serverId ??
        (message.id && message.id.startsWith('client_') ? null : message.id);
      const convId = String(message.conversationId ?? conversationId ?? chat?.conversationId ?? chat?.id ?? '');
      if (!rootId) {
        Alert.alert('Sub-room', 'Please wait for this message to be delivered before opening a sub-room.');
        return;
      }
      if (!convId || convId.startsWith('newContact-')) {
        Alert.alert('Sub-room', 'The conversation is still being prepared. Please try again in a moment.');
        return;
      }
      const title =
        message.text ||
        message.styledText?.text ||
        (message.sticker ? 'Sticker' : '') ||
        (message.voice ? 'Voice message' : '') ||
        'Sub-room';
      const res = await postRequest(
        ROUTES.chat.threads,
        {
          parent_conversation: convId,
          parent_message_key: String(rootId),
          title,
        },
        { errorMessage: 'Unable to open sub-room.' },
      );
      const row = res?.data ?? res;
      const next = normalizeSubRoom(row, convId);
      if (!next) {
        Alert.alert('Sub-room', 'Unable to open the sub-room for this message.');
        return;
      }
      setSubRooms((prev) => {
        const withoutDuplicate = prev.filter(
          (item) =>
            item.rootMessageId !== next.rootMessageId &&
            item.conversationId !== next.conversationId,
        );
        const updated = [next, ...withoutDuplicate];
        // Update cache
        try {
          const AsyncStorage = require('@react-native-async-storage/async-storage').default;
          AsyncStorage.setItem(`${SUBROOMS_CACHE_PREFIX}${convId}`, JSON.stringify(updated)).catch(() => {});
        } catch { /* silent */ }
        return updated;
      });
      setSubRoomsSheetVisible(true);
    },
  });

  /* ======================================================================== */
  /*                                 DM LOCK                                   */
  /* ======================================================================== */

  const { dmRole } = useMemo(() => {
    if (!isDirectChat || !conversationId) {
      return { dmRole: null };
    }

    const first =
      messages.find((m) => m.isFirstMessage) ??
      messages[0] ??
      null;

    let role: 'initiator' | 'recipient' | null = null;

    if ((chat as any)?.request_initiator?.id === currentUserId)
      role = 'initiator';
    else if (
      (chat as any)?.request_recipient?.id === currentUserId
    )
      role = 'recipient';
    else if (first)
      role =
        first.senderId === currentUserId
          ? 'initiator'
          : 'recipient';

    return { dmRole: role };
  }, [chat, conversationId, isDirectChat, messages, currentUserId]);

  const { dmStatusLabel, dmStatusVariant } = useMemo(() => {
    const isArchived = Boolean((chat as any)?.isArchived);
    const isLocked = lockOverride ?? Boolean((chat as any)?.isLocked);
    const requestState = String(
      requestStateOverride ?? (chat as any)?.requestState ?? 'none',
    );

    if (isArchived) {
      return { dmStatusLabel: 'Archived', dmStatusVariant: 'locked' as const };
    }

    if (isLocked) {
      return { dmStatusLabel: 'Chat locked', dmStatusVariant: 'locked' as const };
    }

    if (requestState === 'pending') {
      const label =
        dmRole === 'initiator'
          ? 'Waiting for acceptance'
          : 'Request pending';
      return { dmStatusLabel: label, dmStatusVariant: 'pending' as const };
    }

    if (requestState === 'rejected') {
      return { dmStatusLabel: 'Request rejected', dmStatusVariant: 'rejected' as const };
    }

    return { dmStatusLabel: null, dmStatusVariant: 'normal' as const };
  }, [chat, dmRole, lockOverride, requestStateOverride]);

  /* ======================================================================== */
  /*                              MESSAGE SEARCH                               */
  /* ======================================================================== */

  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchBefore, setSearchBefore] = useState<string | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchHasMore, setSearchHasMore] = useState(true);
  const searchCacheRef = useRef<Record<string, any[]>>({});
  const searchResultsRef = useRef<any[]>([]);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
  const unreadCount = typeof chat?.unreadCount === 'number' ? chat.unreadCount : 0;
  const startAtBottom = unreadCount <= 2;

  useEffect(() => {
    searchResultsRef.current = searchResults;
  }, [searchResults]);

  useEffect(() => {
    setAutoScrollEnabled(true);
  }, [conversationId]);

  // HTTP mark-read — guarantees Django persists the read state even if socket receipts are lost.
  // Fires once per conversation open; deduplicated by ref so re-renders don't repeat the call.
  const markedReadRef = useRef<string | null>(null);
  useEffect(() => {
    const convId = conversationId ?? chat?.id;
    if (!convId || markedReadRef.current === String(convId)) return;
    markedReadRef.current = String(convId);
    postRequest(ROUTES.chat.markRead(String(convId)), {}).catch(() => {});
  }, [conversationId, chat?.id]);

  useEffect(() => {
    initialUnreadJumpRef.current = null;
  }, [conversationId]);

  useEffect(() => {
    if (!initialTargetMessageId || !messageLocator) return;
    const timer = setTimeout(() => {
      messageLocator.scrollToMessage(String(initialTargetMessageId));
      messageLocator.highlightMessage(String(initialTargetMessageId));
    }, 350);
    return () => clearTimeout(timer);
  }, [initialTargetMessageId, messageLocator]);

  useEffect(() => {
    if (startAtBottom) return;
    if (!messageLocator || !conversationId) return;
    if (initialUnreadJumpRef.current === conversationId) return;
    const firstUnread = messages.find(
      (m) => !m.fromMe && m.status !== 'read',
    );
    if (!firstUnread) return;
    const targetId =
      firstUnread.serverId ?? firstUnread.id ?? (firstUnread as any).clientId;
    if (!targetId) return;
    initialUnreadJumpRef.current = conversationId;
    messageLocator.scrollToMessage(String(targetId));
  }, [startAtBottom, messageLocator, conversationId, messages]);

  const handleVisibleMessageIds = useCallback(
    (ids: string[]) => {
      if (!ids.length) return;
      markMessagesRead(ids);
    },
    [markMessagesRead],
  );

  const buildSearchSnippet = useCallback((text: string, query: string) => {
    const source = text ?? '';
    const q = query.trim();
    if (!source || !q) return { prefix: '', match: '', suffix: source };
    const lower = source.toLowerCase();
    const idx = lower.indexOf(q.toLowerCase());
    if (idx === -1) return { prefix: '', match: '', suffix: source };
    const start = Math.max(0, idx - 24);
    const end = Math.min(source.length, idx + q.length + 24);
    const prefix = source.slice(start, idx);
    const match = source.slice(idx, idx + q.length);
    const suffix = source.slice(idx + q.length, end);
    return {
      prefix: start > 0 ? `…${prefix}` : prefix,
      match,
      suffix: end < source.length ? `${suffix}…` : suffix,
    };
  }, []);

  const runSearch = useCallback(
    async (reset?: boolean) => {
      const convId = String(conversationId ?? chat?.id ?? '');
      const q = searchQuery.trim();
      if (!convId || !q) {
        setSearchResults([]);
        setSearchBefore(null);
        setSearchHasMore(false);
        return;
      }

      if (searchLoading) return;

      if (reset) {
        const cacheKey = `${convId}::${q.toLowerCase()}`;
        const cached = searchCacheRef.current[cacheKey];
        if (cached?.length) {
          setSearchResults(cached);
        } else {
          const localMatches = messages
            .filter((m) => {
              const text = (m.text ?? m.styledText?.text ?? '').toLowerCase();
              return text.includes(q.toLowerCase());
            })
            .map((m) => ({
              id: m.serverId ?? m.id,
              text: m.text ?? m.styledText?.text ?? '',
              createdAt: m.createdAt,
            }));
          if (localMatches.length) {
            setSearchResults(localMatches);
          }
        }
      }

      setSearchLoading(true);

      const offset = reset ? 0 : searchResultsRef.current.length;
      const url = `${NEST_API_BASE_URL}/messages/search?conversationId=${encodeURIComponent(
        convId,
      )}&q=${encodeURIComponent(q)}&skip=${offset}&limit=30`;

      const res = await getRequest(url, {
        errorMessage: 'Search failed.',
      });

      const rawItems =
        (res?.data?.data?.messages as any[]) ??
        (res?.data?.data?.results as any[]) ??
        (res?.data?.messages as any[]) ??
        (res?.data?.results as any[]) ??
        (Array.isArray(res?.data) ? (res.data as any[]) : []);
      const items = rawItems.map((item: any) => ({
        id: String(item?.id ?? item?._id ?? item?.serverId ?? item?.messageId ?? ''),
        serverId: item?.serverId ?? item?.id ?? item?._id,
        clientId: item?.clientId,
        text:
          normalizeChatDisplayText(item?.text) ||
          normalizeChatDisplayText(item?.previewText) ||
          normalizeChatDisplayText(item?.styledText?.text),
        createdAt: item?.createdAt ?? item?.created_at ?? null,
      })).filter((item: any) => item.id);

      const merged = reset ? items : [...searchResultsRef.current, ...items];
      setSearchResults(merged);
      const cacheKey = `${convId}::${q.toLowerCase()}`;
      searchCacheRef.current[cacheKey] = merged;

      const oldest = items?.[items.length - 1]?.createdAt ?? null;
      setSearchBefore(oldest);
      setSearchHasMore(items.length >= 30);
      setSearchLoading(false);
    },
    [conversationId, chat?.id, searchQuery, searchBefore, searchLoading, messages],
  );

  useEffect(() => {
    if (!searchVisible) return;
    const q = searchQuery.trim();
    if (!q) {
      if (searchResultsRef.current.length > 0) {
        setSearchResults([]);
      }
      if (searchBefore !== null) {
        setSearchBefore(null);
      }
      if (searchHasMore !== false) {
        setSearchHasMore(false);
      }
      return;
    }
    const timer = setTimeout(() => {
      runSearch(true);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, searchVisible, runSearch]);

  const currentMembership = useMemo(() => {
    const participants = (chat as any)?.participants;
    if (!Array.isArray(participants) || !currentUserId) return null;
    return (
      participants.find(
        (p: any) =>
          p?.user?.id === currentUserId ||
          p?.user === currentUserId ||
          p?.id === currentUserId,
      ) ?? null
    );
  }, [chat, currentUserId]);

  const isMuted =
    muteOverride ??
    Boolean(currentMembership?.is_muted ?? currentMembership?.isMuted);

  const isLocked = lockOverride ?? Boolean((chat as any)?.isLocked);
  const requestStateEffective = String(
    requestStateOverride ?? (chat as any)?.requestState ?? 'none',
  );

  const canPost = (chat as any)?.canPost ?? true;
  const isChannel = (chat as any)?.kind === 'channel';
  const canSend = draft.trim().length > 0 && canPost;

  const statusText = useMemo(() => {
    const convId = conversationId ?? String(storageRoomId);
    if (!convId) return 'offline';
    const typingUsers = typingByConversation?.[convId] ?? {};
    const otherTyping = Object.keys(typingUsers).filter((u) => u !== currentUserId);
    if (otherTyping.length > 0) return 'typing...';

    const participantIds = participantsToIds(chat?.participants ?? []);
    const otherIds = participantIds.filter((u) => u && u !== currentUserId);
    const anyOnline = otherIds.some((u) => presenceByUser?.[u]?.isOnline);
    if (anyOnline) return 'online';

    if ((chat as any)?.isDirect && otherIds.length > 0) {
      const lastSeenAt = otherIds
        .map((u) => presenceByUser?.[u]?.at)
        .filter((v) => typeof v === 'number')
        .sort()
        .slice(-1)[0];
      if (lastSeenAt) {
        const dt = new Date(lastSeenAt);
        const now = new Date();
        const isSameDay =
          dt.getFullYear() === now.getFullYear() &&
          dt.getMonth() === now.getMonth() &&
          dt.getDate() === now.getDate();
        const label = isSameDay
          ? dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : dt.toLocaleDateString();
        return `last seen ${label}`;
      }
    }

    return 'offline';
  }, [typingByConversation, presenceByUser, conversationId, storageRoomId, chat, currentUserId]);

  const statusTextFinal = useMemo(() => {
    if (!showMessageCount) return statusText;
    const count = messages.filter((msg) => !msg.isDeleted).length;
    const label = messageCountLabel ?? 'comments';
    const noun = count === 1 && label.endsWith('s') ? label.slice(0, -1) : label;
    return `${count} ${noun}`;
  }, [showMessageCount, statusText, messages, messageCountLabel]);

  // Typing users with resolved name + avatar for the in-room indicator
  const typingUserObjects = useMemo(() => {
    const convId = conversationId ?? String(storageRoomId);
    if (!convId) return [];
    const typingMap = typingByConversation?.[convId] ?? {};
    const otherIds = Object.keys(typingMap).filter(u => u !== currentUserId);
    if (otherIds.length === 0) return [];

    const participants = chat?.participants ?? [];
    return otherIds.map(uid => {
      let name: string | null = null;
      let avatarUrl: string | null = null;

      // 1. Name from typing event itself (backend sends senderName since the fix)
      const fromTypingEvent = typingDisplayNames?.[uid];
      if (fromTypingEvent && fromTypingEvent !== uid) name = fromTypingEvent;

      // 2. Structured participant objects (for name + avatar)
      if (!name && Array.isArray(participants)) {
        for (const p of participants as any[]) {
          if (typeof p === 'string') continue;
          const pId = String(p?.id ?? p?.user?.id ?? '');
          if (pId !== uid) continue;
          name =
            p?.display_name ??
            p?.user?.display_name ??
            p?.user?.username ??
            null;
          avatarUrl =
            p?.user?.profile?.avatar_url ??
            p?.user?.profile?.avatarUrl ??
            p?.user?.avatar_url ??
            p?.user?.avatarUrl ??
            p?.avatar_url ??
            p?.avatarUrl ??
            null;
          break;
        }
      }

      // 3. mentionParticipants — only if name differs from the id (not a UUID mapped to itself)
      if (!name) {
        const fromMention = mentionParticipants.find(m => m.id === uid);
        if (fromMention?.name && fromMention.name !== uid) name = fromMention.name;
      }

      // 4. Message sender name from live/recent messages
      if (!name) {
        const msg = messages.find(
          m => m.senderId === uid && m.senderName,
        );
        if (msg?.senderName) name = msg.senderName;
      }

      return { id: uid, name: name ?? `User ${uid.slice(-4)}`, avatarUrl: avatarUrl ?? undefined };
    });
  }, [typingByConversation, typingDisplayNames, conversationId, storageRoomId, currentUserId, chat?.participants, mentionParticipants, messages]);

  useEffect(() => {
    if (!conversationId) return;
    const nowTyping = draft.trim().length > 0;

    if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);

    if (nowTyping) {
      // Send start signal immediately on the FIRST keystroke of a typing session.
      // Subsequent keystrokes just reset the stop timer — no need to re-send.
      if (!isActivelyTypingRef.current) {
        isActivelyTypingRef.current = true;
        sendTyping(true);
      }
      // Reset auto-stop: clears any pending stop timer and sets a fresh one.
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        isActivelyTypingRef.current = false;
        sendTyping(false);
      }, 4000);
    } else {
      // Draft was cleared (sent or deleted) — stop immediately after a short delay.
      typingDebounceRef.current = setTimeout(() => {
        if (isActivelyTypingRef.current) {
          isActivelyTypingRef.current = false;
          sendTyping(false);
        }
        if (typingTimeoutRef.current) { clearTimeout(typingTimeoutRef.current); typingTimeoutRef.current = null; }
      }, 300);
    }

    return () => {
      if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [draft, conversationId, sendTyping]);

  /* ======================================================================== */
  /*                              HANDLER BINDINGS                             */
  /* ======================================================================== */

  const handleSend = () => {
    const lp = composerLinkPreviewRef.current;
    composerLinkPreviewRef.current = null;
    return Handlers.handleSend({
      draft,
      chat,
      editing,
      replyTo,
      currentUserId,
      draftKey,
      dmRole,
      linkPreview: lp ?? undefined,
      ensureConversationId,
      editMessage,
      replyToMessage,
      sendTextMessage,
      setDraft,
      setDraftsByKey,
      setEditing,
      setReplyTo,
      setHasLocallyAcceptedRequest: noop,
    });
  };

  const handleToggleMute = async () => {
    const convId = conversationId ?? chat?.id;
    if (!convId) return;
    const next = !isMuted;
    await Handlers.handleMuteConversation({
      conversationId: String(convId),
      muted: next,
    });
    setMuteOverride(next);
  };

  const handleBlockChat = async () => {
    const convId = conversationId ?? chat?.id;
    if (!convId) return;

    // Derive the other participant so the blocked-contacts list stays in sync
    let blockedUser: { userId: string; displayName: string } | undefined;
    const participants = (chat as any)?.participants;
    if (Array.isArray(participants)) {
      const other = participants.find((p: any) => {
        const id = typeof p === 'string' ? p : String(p?.user?.id ?? p?.user ?? p?.id ?? '');
        return id && id !== currentUserId;
      });
      if (other) {
        const uid = typeof other === 'string' ? other : String(other?.user?.id ?? other?.user ?? other?.id ?? '');
        const name = typeof other === 'string'
          ? (chat?.name ?? '')
          : (other?.user?.display_name ?? other?.display_name ?? other?.user?.username ?? chat?.name ?? '');
        if (uid) blockedUser = { userId: uid, displayName: name };
      }
    }

    await Handlers.handleBlockRequest(String(convId), blockedUser);
    setLockOverride(true);
  };

  const handleAcceptRequest = async () => {
    const convId = conversationId ?? chat?.id;
    if (!convId) return;
    await Handlers.handleAcceptConversationRequest(String(convId));
    setRequestStateOverride('accepted');
    Alert.alert('Request accepted', 'You can now chat freely.');
  };

  const handleGroupActionSubmit = async () => {
    const convId = conversationId ?? chat?.id;
    const userId = groupUserIdInput.trim();
    if (!convId || !userId || !groupAction) return;

    if (groupAction === 'add') {
      await Handlers.handleAddGroupMember({
        conversationId: String(convId),
        userId,
        baseRole: groupRoleInput.trim() || 'member',
      });
    }

    if (groupAction === 'remove') {
      await Handlers.handleRemoveGroupMember({
        conversationId: String(convId),
        userId,
      });
    }

    if (groupAction === 'role') {
      await Handlers.handleSetGroupMemberRole({
        conversationId: String(convId),
        userId,
        baseRole: groupRoleInput.trim() || 'member',
      });
    }

    setGroupAction(null);
    setGroupUserIdInput('');
  };

  const handleSendVoice = useCallback((p: { uri: string; durationMs: number }) => {
    const bubbleId = `__upload_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const bubble: UploadBubble = {
      id: bubbleId,
      clientId: bubbleId,
      roomId: String(storageRoomId),
      senderId: currentUserId,
      fromMe: true,
      createdAt: new Date().toISOString(),
      status: 'sending',
      kind: 'voice',
      voice: { uri: p.uri, durationMs: p.durationMs },
      _uploadProgress: 0,
      _uploadStatus: 'verifying',
    };
    setUploadBubbles(prev => ({ ...prev, [bubbleId]: bubble }));

    void Handlers.handleSendVoice({
      ...p,
      chat,
      authToken,
      currentUserId,
      ensureConversationId,
      sendRichMessage,
      onUploadStatus: (s) => {
        if (s === 'done') {
          setUploadBubbles(prev => {
            const next = { ...prev };
            delete next[bubbleId];
            return next;
          });
        } else if (s === 'verification_failed' || s === 'failed') {
          setUploadBubbles(prev => {
            const b = prev[bubbleId];
            if (!b) return prev;
            return { ...prev, [bubbleId]: { ...b, status: 'failed', _uploadStatus: s } };
          });
        }
      },
    });
  }, [chat, authToken, currentUserId, storageRoomId, ensureConversationId, sendRichMessage]);

  const handleSendSticker = (sticker: Sticker) =>
    Handlers.handleSendSticker({
      sticker,
      chat,
      authToken,
      currentUserId,
      ensureConversationId,
      sendRichMessage,
    });

  const handleSendAttachment = useCallback((input: AttachmentFilePayload) => {
    const bubbleId = `__upload_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const localAttachments = (input.files ?? []).map((f, i) => {
      const fileType = String(f.type ?? '').toLowerCase();
      const fileName = String(f.name ?? f.uri ?? '').toLowerCase();
      const kind =
        fileType.startsWith('image/') || /\.(jpe?g|png|webp|heic|heif|gif)(\?|#|$)/i.test(fileName)
          ? 'image'
          : fileType.startsWith('video/') || /\.(mp4|mov|m4v)(\?|#|$)/i.test(fileName)
          ? 'video'
          : undefined;
      return {
        id: `local_${i}`,
        url: f.uri,
        originalName: f.name,
        mimeType: f.type ?? (kind === 'image' ? 'image/*' : kind === 'video' ? 'video/*' : 'application/octet-stream'),
        kind,
        size: f.size ?? 0,
        localUri: f.uri,
        localUploadKey: `${f.uri}:${f.name}:${f.type ?? ''}`,
      };
    });
    const bubble: UploadBubble = {
      id: bubbleId,
      clientId: bubbleId,
      roomId: String(storageRoomId),
      senderId: currentUserId,
      fromMe: true,
      createdAt: new Date().toISOString(),
      status: 'sending',
      kind: input.caption ? 'text' : 'attachment',
      text: normalizeChatSendText(input.caption),
      attachments: localAttachments as any,
      media: { attachments: localAttachments as any },
      _uploadProgress: 0,
      _uploadStatus: 'verifying',
      _uploadInput: {
        files: input.files,
        caption: input.caption,
      },
    };
    setUploadBubbles(prev => ({ ...prev, [bubbleId]: bubble }));

    // Per-file progress tracking
    const fileProgressMap: Record<string, number> = {};
    const fileStatusMap: Record<string, UploadStatus> = {};
    const uris = (input.files ?? []).map(f => f.uri);

    const syncBubble = () => {
      const progresses = uris.map(u => fileProgressMap[u] ?? 0);
      const avgProgress = progresses.length ? progresses.reduce((a, b) => a + b, 0) / progresses.length : 0;
      const anyVerifFailed = uris.some(u => fileStatusMap[u] === 'verification_failed');
      const anyFailed = uris.some(u => fileStatusMap[u] === 'failed');
      const allDone = uris.length > 0 && uris.every(u => fileStatusMap[u] === 'done');
      const anyUploading = uris.some(u => fileStatusMap[u] === 'uploading');

      if (allDone) {
        setUploadBubbles(prev => {
          const b = prev[bubbleId];
          if (!b) return prev;
          return { ...prev, [bubbleId]: { ...b, _uploadProgress: 1, _uploadStatus: 'uploading' } };
        });
      } else if (anyVerifFailed || anyFailed) {
        setUploadBubbles(prev => {
          const b = prev[bubbleId];
          if (!b) return prev;
          return { ...prev, [bubbleId]: { ...b, status: 'failed', _uploadProgress: avgProgress, _uploadStatus: anyVerifFailed ? 'verification_failed' : 'failed' } };
        });
      } else {
        setUploadBubbles(prev => {
          const b = prev[bubbleId];
          if (!b) return prev;
          return { ...prev, [bubbleId]: { ...b, _uploadProgress: avgProgress, _uploadStatus: anyUploading ? 'uploading' : b._uploadStatus } };
        });
      }
    };

    const wrappedInput: AttachmentFilePayload = {
      ...input,
      onProgress: (uri, progress) => {
        fileProgressMap[uri] = progress;
        input.onProgress?.(uri, progress);
        syncBubble();
      },
      onStatus: (uri, status) => {
        fileStatusMap[uri] = status;
        input.onStatus?.(uri, status);
        syncBubble();
      },
      onUploadedReady: () => {
        input.onUploadedReady?.();
        setUploadBubbles(prev => {
          const next = { ...prev };
          delete next[bubbleId];
          return next;
        });
      },
    };

    void Handlers.handleSendAttachment({
      input: wrappedInput,
      chat,
      authToken,
      currentUserId,
      ensureConversationId,
      sendRichMessage,
    }).then((ok) => {
      if (ok === false) {
        setUploadBubbles(prev => {
          const b = prev[bubbleId];
          if (!b) return prev;
          return { ...prev, [bubbleId]: { ...b, status: 'failed', _uploadStatus: 'failed' } };
        });
      }
    }).catch(() => {
      setUploadBubbles(prev => {
        const b = prev[bubbleId];
        if (!b) return prev;
        return { ...prev, [bubbleId]: { ...b, status: 'failed', _uploadStatus: 'failed' } };
      });
    });
  }, [chat, authToken, currentUserId, storageRoomId, ensureConversationId, sendRichMessage]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('chat.sendPendingAttachment', (payload: any) => {
      const targetId = String(payload?.targetId ?? '');
      const chatId = String((chat as any)?.conversationId ?? (chat as any)?.id ?? '');
      if (!targetId || !chatId || targetId !== chatId) return;
      const attachment = payload?.attachment as AttachmentFilePayload | undefined;
      if (!attachment) return;
      void handleSendAttachment(attachment);
    });
    return () => {
      sub.remove();
    };
  }, [chat?.conversationId, chat?.id, handleSendAttachment]);

  const handleSendContacts = (contacts: SimpleContact[]) =>
    Handlers.handleSendContacts({
      contacts,
      chat,
      currentUserId,
      ensureConversationId,
      sendRichMessage,
    });

  const handleCreatePoll = (poll: PollDraft) =>
    Handlers.handleCreatePoll({
      poll,
      chat,
      currentUserId,
      ensureConversationId,
      sendRichMessage,
    });

  const handleCreateEvent = (event: EventDraft) =>
    Handlers.handleCreateEvent({
      event,
      chat,
      currentUserId,
      ensureConversationId,
      sendRichMessage,
    });

  const handleSendGif = useCallback(
    async (gif: { url: string; previewUrl: string; width: number; height: number }) => {
      await ensureConversationId();
      const attachments = [{
          id: `gif_${Date.now()}`,
          url: gif.url,
          originalName: 'gif',
          mimeType: 'image/gif',
          size: 0,
          kind: 'image',
          width: gif.width,
          height: gif.height,
        }];
      sendRichMessage({
        kind: 'attachment',
        attachments,
        media: { attachments },
      });
    },
    [ensureConversationId, sendRichMessage],
  );

  const handleSendLocation = useCallback(
    async (loc: LocationMessage) => {
      await ensureConversationId();
      sendRichMessage({ kind: 'location', location: loc });
    },
    [ensureConversationId, sendRichMessage],
  );

  const handleScheduleSend = useCallback(
    (scheduledAt: string) => {
      const text = draft.trim();
      if (!text) return;
      const delay = new Date(scheduledAt).getTime() - Date.now();
      if (delay <= 0) { handleSend(); return; }
      const timerId = setTimeout(() => {
        sendTextMessage(text);
      }, delay);
      setScheduledQueue((prev) => [...prev, { text, scheduledAt, timerId }]);
      setDraft('');
      Alert.alert(
        'Message scheduled',
        `Your message will be sent at ${new Date(scheduledAt).toLocaleString()}`,
      );
    },
    [draft, handleSend, sendTextMessage],
  );

  const handleStarMessage = useCallback(
    async (message: ChatMessage) => {
      if ((message as any).isStarred) {
        await removeStarredMessage(message.id);
        replaceMessages(messages.map((m) =>
          m.id === message.id ? { ...m, isStarred: false } : m,
        ));
      } else {
        await saveStarredMessage(message);
        replaceMessages(messages.map((m) =>
          m.id === message.id ? { ...m, isStarred: true } : m,
        ));
      }
    },
    [messages, replaceMessages],
  );

  const handleShowReadReceipts = useCallback(
    (message: ChatMessage) => {
      const rb: ReadByEntry[] = (message as any).readBy ?? [];
      setReadReceiptsData(rb);
      setReadReceiptsSheetVisible(true);
    },
    [],
  );

  const handleSetDisappearing = useCallback(
    (seconds: DisappearDuration) => {
      setDisappearingSeconds(seconds);
      const convId = String(conversationId ?? chat?.id ?? '');
      if (convId && socket) {
        (socket as any).emit('chat.disappear.set', { conversationId: convId, seconds });
      }
    },
    [conversationId, chat?.id, socket],
  );

  const handleSelectWallpaper = useCallback(
    (id: string) => {
      const chatId = String(conversationId ?? chat?.id ?? '');
      setWallpaperId(id);
      saveWallpaper(chatId, id);
    },
    [conversationId, chat?.id],
  );

  const handleViewOnce = useCallback(
    (messageId: string) => {
      const convId = String(conversationId ?? chat?.id ?? '');
      if (!convId || !socket) return;
      (socket as any).emit('chat.view_once', { conversationId: convId, messageId });
    },
    [conversationId, chat?.id, socket],
  );

  // Resolve wallpaper background color
  const wallpaperBgColor = useMemo(() => {
    const opt = WALLPAPER_OPTIONS.find((o) => o.id === wallpaperId);
    if (!opt || opt.isDefault || !opt.colors.length) return undefined;
    return opt.colors[0];
  }, [wallpaperId]);

  // Last received message for quick replies
  const lastReceivedMessage = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (!messages[i].fromMe && !messages[i].isDeleted) return messages[i];
    }
    return null;
  }, [messages]);

  /* ======================================================================== */
  /*                                   RENDER                                  */
  /* ======================================================================== */

  const bg = palette.chatBg ?? palette.bg;
  const chatBackgroundImage = isDark ? DARK_CHAT_BACKGROUND : LIGHT_CHAT_BACKGROUND;
  const handleRetryMessage = useCallback(
    (message: ChatMessage) => {
      const uploadInput = (message as any)._uploadInput as AttachmentFilePayload | undefined;
      const fallbackFiles = Array.isArray((message as any).attachments)
        ? ((message as any).attachments as any[])
            .map((attachment): FilesType | null => {
              const uri = attachment?.localUri ?? attachment?.uri ?? attachment?.url;
              if (typeof uri !== 'string' || !uri) return null;
              return {
                uri,
                name: String(attachment?.originalName ?? attachment?.name ?? 'upload'),
                type: attachment?.mimeType ?? attachment?.mime ?? attachment?.type ?? null,
                size: typeof attachment?.size === 'number' ? attachment.size : null,
                durationMs: typeof attachment?.durationMs === 'number' ? attachment.durationMs : null,
              };
            })
            .filter(Boolean) as FilesType[]
        : [];
      const retryInput =
        uploadInput?.files?.length
          ? uploadInput
          : fallbackFiles.length
          ? { files: fallbackFiles, caption: (message as any).text }
          : null;

      if (retryInput?.files?.length) {
        const failedBubbleId = String((message as any).id ?? '');
        if (__DEV__) {
          console.log('[chat.upload.retry] retrying failed upload bubble', {
            failedBubbleId,
            fileCount: retryInput.files.length,
            hasStoredInput: Boolean(uploadInput?.files?.length),
          });
        }
        if (failedBubbleId) {
          setUploadBubbles(prev => {
            const next = { ...prev };
            delete next[failedBubbleId];
            return next;
          });
        }
        handleSendAttachment(retryInput);
        return;
      }

      const messageId = message.serverId ?? message.id;
      if (!messageId) return;
      void retryMessage(String(messageId));
    },
    [handleSendAttachment, retryMessage],
  );
  const handleOpenInfo = useCallback(() => {
    if (!chat) return;
    onOpenInfo?.({ chat, currentUserId });
  }, [chat, currentUserId, onOpenInfo]);

  const handleStartCall = useCallback(
    async (media: 'voice' | 'video' | 'broadcast') => {
      if (!chat || !startCall) {
        Alert.alert('Call unavailable', 'Calling is not ready yet.');
        return;
      }

      const resolvedConversationId =
        conversationId ??
        (await ensureConversationId().catch(() => null)) ??
        chat.conversationId ??
        chat.id ??
        null;

      if (!resolvedConversationId) {
        Alert.alert('Call unavailable', 'Conversation is not ready yet.');
        return;
      }

      const inviteeUserIds = participantsToIds(chat.participants ?? []).filter(
        (id) => String(id) !== String(currentUserId ?? ''),
      );

      if (media === 'broadcast') {
        await startCall({
          conversationId: String(resolvedConversationId),
          title: chat.name ?? 'Broadcast',
          callType: 'broadcast',
          inviteeUserIds,
        });
      } else {
        await startCall({
          conversationId: String(resolvedConversationId),
          title: chat.name ?? 'Call',
          media,
          inviteeUserIds,
        });
      }
    },
    [chat, startCall, conversationId, ensureConversationId, currentUserId],
  );

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('chat.openInfo', (payload: any) => {
      const targetId = String(payload?.chatId ?? '');
      const chatId = String(chat?.conversationId ?? chat?.id ?? '');
      if (!targetId || !chatId) return;
      if (targetId !== chatId) return;
      handleOpenInfo();
    });
    return () => { sub.remove(); };
  }, [chat?.conversationId, chat?.id, handleOpenInfo]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('member.tap', (payload: any) => {
      setMemberTap({ userId: payload?.userId, name: String(payload?.name ?? ''), avatarUrl: payload?.avatarUrl });
    });
    return () => { sub.remove(); };
  }, []);

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: bg, paddingTop: topInset },
      ]}
    >
      {!hideHeader && (
        <View
          onLayout={(e) => {
            const h = e?.nativeEvent?.layout?.height;
            if (h && h > 0) setChatHeaderH(h);
          }}
        >
        <ChatHeader
          chat={chat}
          onBack={selectionMode ? exitSelectionMode : onBack}
          palette={palette}
          onOpenInfo={selectionMode ? undefined : handleOpenInfo}
          onStartVoiceCall={selectionMode ? undefined : () => void handleStartCall('voice')}
          onStartVideoCall={selectionMode ? undefined : () => void handleStartCall('video')}
          onStartBroadcast={
            selectionMode ? undefined
              : (chat?.participants?.length ?? 0) > 2
                ? () => void handleStartCall('broadcast')
                : undefined
          }
          currentUserId={currentUserId}
          statusText={statusTextFinal}
          contextLabel={headerContextLabel}
          onPressContext={onPressHeaderContext}
          dmStatusLabel={dmStatusLabel}
          dmStatusVariant={dmStatusVariant}
          dmRole={dmRole}
          onAcceptRequest={handleAcceptRequest}
          selectionMode={selectionMode}
          selectedCount={selectedIds.length}
          onCancelSelection={exitSelectionMode}
          onPinSelected={handlePinSelected}
          onDeleteSelected={handleDeleteSelected}
          onForwardSelected={() => setForwardSheetVisible(true)}
          onCopySelected={handleCopySelected}
          onMoreSelected={selectionMode ? handleMoreSelected : () => setMenuVisible(true)}
          pinnedCount={pinnedCount}
          subRoomCount={subRoomCount}
          subRoomUnread={subRooms.reduce((acc, sr) => acc + (sr.unreadCount ?? 0), 0)}
          onOpenPinned={() => setPinnedSheetVisible(true)}
          onOpenSubRooms={() => setSubRoomsSheetVisible(true)}
          isSingleSelection={isSingleSelection}
          onContinueInSubRoom={handleContinueInSubRoom}
          isE2EE
          isConnecting={!isNetworkOnline || !socket?.connected}
        />
        </View>
      )}

      {!selectionMode && (
        <ChatRoomOverlays
          palette={palette}
          chat={chat}
          menuVisible={menuVisible}
          onCloseMenu={() => setMenuVisible(false)}
          dmRole={dmRole}
          requestStateEffective={requestStateEffective}
          isLocked={isLocked}
          isMuted={isMuted}
          conversationId={conversationId}
          onAcceptRequest={handleAcceptRequest}
          onBlockChat={handleBlockChat}
          onToggleMute={handleToggleMute}
          onOpenSearch={() => {
            setSearchVisible(true);
            setSearchQuery('');
            setSearchResults([]);
            setSearchBefore(null);
            setSearchHasMore(true);
          }}
          onOpenAddMember={() => {
            setGroupRoleInput('member');
            setGroupAction('add');
          }}
          onOpenRemoveMember={() => setGroupAction('remove')}
          onOpenSetRole={() => {
            setGroupRoleInput('admin');
            setGroupAction('role');
          }}
          onClearChat={handleClearChat}
          groupAction={groupAction}
          groupUserIdInput={groupUserIdInput}
          groupRoleInput={groupRoleInput}
          onChangeGroupUserId={setGroupUserIdInput}
          onChangeGroupRole={setGroupRoleInput}
          onCloseGroupAction={() => setGroupAction(null)}
          onSubmitGroupAction={handleGroupActionSubmit}
          searchVisible={searchVisible}
          searchQuery={searchQuery}
          onChangeSearchQuery={setSearchQuery}
          onCloseSearch={() => setSearchVisible(false)}
          onRunSearch={runSearch}
          searchResults={searchResults}
          searchHasMore={searchHasMore}
          searchLoading={searchLoading}
          onSelectSearchResult={(id) => {
            messageLocator?.scrollToMessage(String(id));
            messageLocator?.highlightMessage(String(id));
            setAutoScrollEnabled(false);
          }}
          buildSearchSnippet={buildSearchSnippet}
          participants={(chat?.participants ?? []).map((p: any) => ({
            id: String(p.id ?? p.userId ?? p.user_id ?? ''),
            name: p.name ?? p.display_name ?? p.username ?? '',
            avatarUrl: p.avatar_url ?? p.avatarUrl,
          }))}
        />
      )}
      <ImageBackground
        source={wallpaperBgColor ? undefined : chatBackgroundImage}
        resizeMode="cover"
        style={[
          styles.chatWallpaper,
          { backgroundColor: wallpaperBgColor ?? bg },
        ]}
        imageStyle={styles.chatWallpaperImage}
      >
        {/* Quick replies bar above composer */}
        <QuickRepliesBar
          lastMessage={lastReceivedMessage}
          palette={palette}
          onSelect={(text) => {
            setDraft(text);
            handleSend();
          }}
        />

        <ChatRoomBody
          chat={chat}
          messages={messagesWithUploads}
          palette={palette}
          keyboardOffset={chatHeaderH}
          isChannel={isChannel}
          canPost={canPost}
          draft={draft}
          selectionMode={selectionMode}
          selectedIds={selectedIds}
          currentUserId={currentUserId}
          autoScrollEnabled={autoScrollEnabled}
          startAtBottom={startAtBottom}
          stickerLibraryVersion={stickerLibraryVersion}
          replyTo={replyTo}
          editing={editing}
          onReplyToMessage={setReplyTo}
          onEditMessage={setEditing}
          onForwardMessage={handleForwardSingleMessage}
          onDeleteMessage={handleDeleteSingleMessage}
          onPinMessage={handlePinSingleMessage}
          onStartSelection={enterSelectionMode}
          onToggleSelect={toggleSelectMessage}
          onReactMessage={handleReactMessage}
          onVotePoll={handleVotePoll}
          onRetryMessage={handleRetryMessage}
          onMessageLocatorReady={setMessageLocator}
          onVisibleMessageIds={handleVisibleMessageIds}
          mentionParticipants={mentionParticipants}
          participantMap={participantMap}
          participantAvatarMap={participantAvatarMap}
          senderName={currentUserName ?? ''}
          conversationIdForMentions={String(conversationId ?? chat?.id ?? '')}
          onChangeDraft={handleChangeDraft}
          onSend={handleSend}
          onLinkPreviewChange={(p: any) => { composerLinkPreviewRef.current = p; }}
          onSendVoice={handleSendVoice}
          onOpenStickerEditor={() => setOpenStickerEditor(true)}
          onChooseTextBackground={setTextCardBg}
          onSendSticker={handleSendSticker}
          onClearReply={() => setReplyTo(null)}
          onCancelEditing={() => setEditing(null)}
          onSendAttachment={handleSendAttachment}
          onSendContacts={handleSendContacts}
          onCreatePoll={handleCreatePoll}
          onCreateEvent={handleCreateEvent}
          onSendGif={handleSendGif}
          onSendLocation={handleSendLocation}
          onScheduleSend={handleScheduleSend}
          onStarMessage={handleStarMessage}
          onShowReadReceipts={handleShowReadReceipts}
          onViewOnce={handleViewOnce}
          onLocalDeleteMessage={handleLocalDeleteMessage}
          onUpdateMessage={handleUpdateMessage}
          typingUsers={typingUserObjects}
          canSend={canSend}
          onLoadOlder={() => {
            const oldest = messages[0];
            if (!oldest?.createdAt) return;
            requestHistoryBatch({ before: oldest.createdAt, limit: 50 })
              .then((items: any[]) => {
                if (!items.length) return;
                const mapped = items.map((m: any) => mapServerMessage(m));
                replaceMessages([...mapped, ...messages]);
              })
              .catch(() => {});
          }}
        />
      </ImageBackground>

      <ChatRoomEditors
        palette={palette}
        textCardBg={textCardBg}
        onCloseTextCard={() => setTextCardBg(null)}
        onSendTextCard={(payload: TextCardPayload) =>
          Handlers.handleSendStyledText?.({
            payload,
            chat,
            currentUserId,
            ensureConversationId,
            sendRichMessage,
            setTextCardBg,
          })
        }
        openStickerEditor={openStickerEditor}
        onCloseStickerEditor={() => setOpenStickerEditor(false)}
        onSaveSticker={() => {
          setStickerLibraryVersion((v) => v + 1);
          setOpenStickerEditor(false);
        }}
      />

      <ChatRoomSheets
        palette={palette}
        roomId={String(storageRoomId)}
        forwardSheetVisible={forwardSheetVisible}
        onCloseForward={() => setForwardSheetVisible(false)}
        onConfirmForward={handleForwardConfirm}
        forwardTargets={forwardTargets}
        pinnedSheetVisible={pinnedSheetVisible}
        onClosePinned={() => setPinnedSheetVisible(false)}
        pinnedMessages={pinnedMessages}
        onJumpToMessage={(messageId) => {
          setPinnedSheetVisible(false);
          setStarredSheetVisible(false);
          messageLocator?.scrollToMessage(messageId);
          messageLocator?.highlightMessage(messageId);
        }}
        subRoomsSheetVisible={subRoomsSheetVisible}
        onCloseSubRooms={() => setSubRoomsSheetVisible(false)}
        subRooms={subRooms}
        onOpenSubRoom={handleOpenSubRoom}
        onEditThreadSubject={handleEditThreadSubject}
        starredSheetVisible={starredSheetVisible}
        onCloseStarred={() => setStarredSheetVisible(false)}
        readReceiptsSheetVisible={readReceiptsSheetVisible}
        onCloseReadReceipts={() => setReadReceiptsSheetVisible(false)}
        readReceiptsData={readReceiptsData}
        disappearingSheetVisible={disappearingSheetVisible}
        onCloseDisappearing={() => setDisappearingSheetVisible(false)}
        disappearingCurrentValue={disappearingSeconds}
        onSetDisappearing={handleSetDisappearing}
        wallpaperSheetVisible={wallpaperSheetVisible}
        onCloseWallpaper={() => setWallpaperSheetVisible(false)}
        wallpaperCurrentId={wallpaperId}
        onSelectWallpaper={handleSelectWallpaper}
      />

      {/* ── Member profile popup (triggered by tapping sender avatar/name) ── */}
      {memberTap && (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setMemberTap(null)}
        >
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }} onPress={() => setMemberTap(null)}>
            <Pressable onPress={() => {}} style={{ width: 280, borderRadius: 20, overflow: 'hidden', backgroundColor: palette.card }}>
              {/* Avatar */}
              <View style={{ alignItems: 'center', paddingTop: 28, paddingBottom: 16, backgroundColor: palette.surface }}>
                <View style={{ width: 72, height: 72, borderRadius: 36, overflow: 'hidden', backgroundColor: `${palette.primary}33`, alignItems: 'center', justifyContent: 'center' }}>
                  {memberTap.avatarUrl ? (
                    <Image source={{ uri: memberTap.avatarUrl }} style={{ width: 72, height: 72 }} resizeMode="cover" />
                  ) : (
                    <Text style={{ fontSize: 26, fontWeight: '700', color: palette.primary }}>
                      {(memberTap.name ?? '').trim().split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()}
                    </Text>
                  )}
                </View>
                <Text style={{ marginTop: 10, fontSize: 16, fontWeight: '700', color: palette.text }} numberOfLines={1}>{memberTap.name}</Text>
              </View>

              {/* Action buttons */}
              <View style={{ flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.divider }}>
                {[
                  { icon: 'chat', label: 'Message', onPress: async () => {
                    if (!memberTap.userId) return;
                    setMemberTap(null);
                    try {
                      const res = await postRequest(ROUTES.chat.directConversation, { other_user_id: memberTap.userId }, {});
                      const convId = res?.data?.conversation_id ?? res?.data?.id ?? res?.data?.conversationId;
                      if (convId) DeviceEventEmitter.emit('chat.open', { conversationId: String(convId), name: memberTap.name, kind: 'dm' });
                    } catch { /* best-effort */ }
                  }},
                  { icon: 'phone', label: 'Voice', onPress: () => {
                    setMemberTap(null);
                    if (startCall && memberTap.userId) {
                      void startCall({ conversationId: String(chat?.conversationId ?? chat?.id ?? ''), title: memberTap.name, media: 'voice', inviteeUserIds: [memberTap.userId] });
                    }
                  }},
                  { icon: 'video', label: 'Video', onPress: () => {
                    setMemberTap(null);
                    if (startCall && memberTap.userId) {
                      void startCall({ conversationId: String(chat?.conversationId ?? chat?.id ?? ''), title: memberTap.name, media: 'video', inviteeUserIds: [memberTap.userId] });
                    }
                  }},
                  { icon: 'user', label: 'Profile', onPress: () => {
                    setMemberTap(null);
                    if (memberTap.userId) navigation?.navigate('ViewProfile', { userId: memberTap.userId, displayName: memberTap.name });
                  }},
                ].map(({ icon, label, onPress }) => (
                  <Pressable key={label} onPress={onPress} style={({ pressed }) => ({ flex: 1, alignItems: 'center', paddingVertical: 14, opacity: pressed ? 0.6 : 1 })}>
                    <KISIcon name={icon} size={22} color={palette.primary} />
                    <Text style={{ fontSize: 10, color: palette.subtext, marginTop: 4 }}>{label}</Text>
                  </Pressable>
                ))}
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </View>
  );
};

export default ChatRoomPage;
