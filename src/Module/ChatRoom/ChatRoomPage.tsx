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
  View,
  Alert,
  DeviceEventEmitter,
  ImageBackground,
} from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKISTheme } from '../../theme/useTheme';
import { chatRoomStyles as styles } from './chatRoomStyles';

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

/* -------------------------------------------------------------------------- */
/*                                   HELPERS                                  */
/* -------------------------------------------------------------------------- */

export type FilesType = {
  uri: string;
  name: string;
  type: string | null;
  size?: number | null;
  durationMs?: number | null;
};

export type AttachmentFilePayload = {
  files?: FilesType[];
  caption?: string;
  onProgress?: (uri: string, progress: number) => void;
  onStatus?: (uri: string, status: 'uploading' | 'done' | 'failed') => void;
};

const normalizeSubRoom = (row: any, parentRoomId: string): SubRoom | null => {
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
  const topInset =
    typeof safeAreaTopInsetOverride === 'number'
      ? safeAreaTopInsetOverride
      : insets.top;

  /* ------------------------------------------------------------------------ */
  /*                               AUTH CONTEXT                                */
  /* ------------------------------------------------------------------------ */

  const { authToken, currentUserId: authCurrentUserId, currentUserName } =
    useChatAuth(chat);
  const { typingByConversation, presenceByUser, socket, startCall, currentUserId: socketCurrentUserId } = useSocket();
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
      setSubRooms(normalized);
      try {
        await AsyncStorage.setItem(`${SUBROOMS_CACHE_PREFIX}${convId}`, JSON.stringify(normalized));
      } catch { /* silent */ }
    } catch { /* silent */ }

    return () => { mounted = false; };
  }, [chat?.conversationId, chat?.id, conversationId]);

  useEffect(() => {
    loadSubRooms();
  }, [loadSubRooms]);
  const [messageLocator, setMessageLocator] =
    useState<MessageLocator | null>(null);
  const initialUnreadJumpRef = useRef<string | null>(null);

  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
      sendReaction(messageId, emoji, convId);
    },
    [sendReaction, conversationId, chat?.id],
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
        text: item?.text ?? item?.previewText ?? item?.styledText?.text ?? '',
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

  useEffect(() => {
    if (!conversationId) return;
    const isTyping = draft.trim().length > 0;

    if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
    typingDebounceRef.current = setTimeout(() => {
      sendTyping(isTyping);
    }, 500);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    if (isTyping) {
      typingTimeoutRef.current = setTimeout(() => {
        sendTyping(false);
      }, 2000);
    }

    return () => {
      if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [draft, conversationId, sendTyping]);

  /* ======================================================================== */
  /*                              HANDLER BINDINGS                             */
  /* ======================================================================== */

  const handleSend = () =>
    Handlers.handleSend({
      draft,
      chat,
      editing,
      replyTo,
      currentUserId,
      draftKey,
      dmRole,
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
    await Handlers.handleBlockRequest(String(convId));
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

  const handleSendVoice = (p: { uri: string; durationMs: number }) =>
    Handlers.handleSendVoice({
      ...p,
      chat,
      authToken,
      currentUserId,
      ensureConversationId,
      sendRichMessage,
    });

  const handleSendSticker = (sticker: Sticker) =>
    Handlers.handleSendSticker({
      sticker,
      chat,
      authToken,
      currentUserId,
      ensureConversationId,
      sendRichMessage,
    });

  const handleSendAttachment = (input: AttachmentFilePayload) =>
    Handlers.handleSendAttachment({
      input,
      chat,
      authToken,
      currentUserId,
      ensureConversationId,
      sendRichMessage,
    });

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

  /* ======================================================================== */
  /*                                   RENDER                                  */
  /* ======================================================================== */

  const bg = palette.chatBg ?? palette.bg;
  const chatBackgroundImage = isDark ? DARK_CHAT_BACKGROUND : LIGHT_CHAT_BACKGROUND;
  const handleRetryMessage = useCallback(
    (message: ChatMessage) => {
      const messageId = message.serverId ?? message.id;
      if (!messageId) return;
      void retryMessage(String(messageId));
    },
    [retryMessage],
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
    return () => {
      sub.remove();
    };
  }, [chat?.conversationId, chat?.id, handleOpenInfo]);

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: bg, paddingTop: topInset },
      ]}
    >
      {!hideHeader && (
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
          onOpenPinned={() => setPinnedSheetVisible(true)}
          onOpenSubRooms={() => setSubRoomsSheetVisible(true)}
          isSingleSelection={isSingleSelection}
          onContinueInSubRoom={handleContinueInSubRoom}
        />
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
        />
      )}
      <ImageBackground
        source={chatBackgroundImage}
        resizeMode="cover"
        style={[styles.chatWallpaper, { backgroundColor: bg }]}
        imageStyle={styles.chatWallpaperImage}
      >
        <ChatRoomBody
          chat={chat}
          messages={messages}
          palette={palette}
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
          onChangeDraft={handleChangeDraft}
          onSend={handleSend}
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
          canSend={canSend}
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
          messageLocator?.scrollToMessage(messageId);
          messageLocator?.highlightMessage(messageId);
        }}
        subRoomsSheetVisible={subRoomsSheetVisible}
        onCloseSubRooms={() => setSubRoomsSheetVisible(false)}
        subRooms={subRooms}
        onOpenSubRoom={handleOpenSubRoom}
      />
    </View>
  );
};

export default ChatRoomPage;
