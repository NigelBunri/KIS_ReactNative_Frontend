import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TextInput,
  Pressable,
  Platform,
  Animated,
  Alert,
  Easing,
  LayoutChangeEvent,
  NativeSyntheticEvent,
  NativeScrollEvent,
  AccessibilityInfo,
  DeviceEventEmitter,
  AppState,
  useWindowDimensions,
  Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  createMaterialTopTabNavigator,
  MaterialTopTabBar,
} from '@react-navigation/material-top-tabs';
import { useKISTheme } from '../../theme/useTheme';
import { KIS_TOKENS } from '../../theme/constants';
import { ChatsTab } from '@/Module/ChatRoom/componets/MessageTabs';
import { KISIcon } from '@/constants/kisIcons';
import AddContactsPage from '@/Module/AddContacts/AddContactsPage';
import ChatRoomPage from '@/Module/ChatRoom/ChatRoomPage';
import { useSocket } from '../../../SocketProvider';
import { loadMessages, upsertMessage } from '@/Module/ChatRoom/Storage/chatStorage';
import { normalizePhoneKey, participantsToIds } from '@/Module/ChatRoom/messagesUtils';
import { decryptFromUser, ensureDeviceId } from '@/security/e2ee';
import { FilterManager, ToggleChip } from '@/components/messaging/Filters';
import UpdatesTab from '@/screens/tabs/MesssagingSubTabs/UpdatesTab';
import CallsTab from '@/screens/tabs/MesssagingSubTabs/CallsTab';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { 
  styles,
  type CustomFilter,
  type QuickChip,
  type Chat,
  CUSTOM_FILTERS_KEY 
} from '@/Module/ChatRoom/messagesUtils';
import { fetchConversationsForCurrentUser, searchConversationsFromServer } from '@/Module/ChatRoom/normalizeConversation';
import { mapBackendToChatMessage } from '@/Module/ChatRoom/componets/chatMapping';
import { MessageStatus } from '@/Module/ChatRoom/chatTypes';
import { decryptConversationPayload, ENCRYPTION_VERSION } from '@/security/customE2EE';

const Tab = createMaterialTopTabNavigator();
type MessagesScreenProps = {
  onOpenChat: (chat: Chat) => void;
  onOpenInfo?: (payload: { chat: Chat; currentUserId: string | null }) => void;
};

type LocalQuick = QuickChip;

const getMessagePreviewText = (message: any): string => {
  if (!message) return '';

  const text = typeof message.text === 'string' ? message.text.trim() : '';
  if (text.length) return text;
  if (message?.styledText?.text) return message.styledText.text;
  if (message?.voice) return 'Voice message';
  if (message?.sticker) return 'Sticker';
  if (Array.isArray(message?.attachments) && message.attachments.length) {
    return message.attachments.length > 1 ? 'Attachments' : 'Attachment';
  }
  if (Array.isArray(message?.contacts) && message.contacts.length) {
    return 'Contact';
  }
  if (message?.poll) return 'Poll';
  if (message?.event) return 'Event';
  return '';
};

type ConversationMetaEntry = {
  lastMessage?: string;
  lastAt?: string;
  unreadCount?: number;
  lastStatus?: MessageStatus;
  lastMessageFromMe?: boolean;
};

/**
 * Changes in this file focus on animation smoothness & robustness:
 * - Replace timing-based hide/show with a spring and a small state machine to avoid re-trigger thrash
 * - Add velocity-based heuristics when available and clamp spurious small scrolls
 * - Respect Reduced Motion accessibility (disables animations)
 * - Animate the overflow menu (fade + scale) instead of hard-mounting
 * - Avoid repeated setState on layout if height hasn't changed
 */
export default function MessagesScreen({ onOpenChat, onOpenInfo }: MessagesScreenProps) {
  const { palette } = useKISTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  // Search & menus
  const [query, setQuery] = useState('');
  const [menuVisible, setMenuVisible] = useState(false);

  // Quick chips incl. Archived/Blocked
  const [activeQuick, setActiveQuick] = useState<Set<LocalQuick>>(new Set());

  // Custom filters
  const [customFilters, setCustomFilters] = useState<CustomFilter[]>([]);
  const [activeCustom, setActiveCustom] = useState<string | null>(null);
  const [filterMgrOpen, setFilterMgrOpen] = useState(false);

  // ── Full-screen Chat Room overlay (covers entire device) ──────────────────
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [chatVisible, setChatVisible] = useState(false);
  const chatSlide = useRef(new Animated.Value(0)).current; // 0 = offscreen, 1 = onscreen
  const [selectMode, setSelectMode] = useState(false);
  const [selectedChat, setSelectedChat] = useState<Chat[]>([]);

// if you still want selectCount as separate state:
const [selectCount, setSelectCount] = useState<number | null>(null);

const [conversations, setConversations] = useState<Chat[]>([]);
const [contactNameByPhone, setContactNameByPhone] = useState<Record<string, string>>({});
const [conversationMeta, setConversationMeta] = useState<Record<string, ConversationMetaEntry>>({});
const [communityByConversationId, setCommunityByConversationId] = useState<Record<string, { id: string; name: string }>>({});
const [communityGroupConversationIds, setCommunityGroupConversationIds] = useState<Set<string>>(new Set());
const [statusByUserId, _setStatusByUserId] = useState<Record<string, { hasStatus: boolean; hasUnseen: boolean }>>({});
const [avatarPreview, setAvatarPreview] = useState<{ uri: string; chat?: Chat; userId?: string | null } | null>(null);
const [avatarPreviewFull, setAvatarPreviewFull] = useState(false);
const avatarAnim = useRef(new Animated.Value(0)).current;
const tabRef = useRef<any>(null);
const loadCommunitiesRef = useRef<() => void | Promise<void>>(() => {});

const mountedRef = useRef(true);
const metaRefreshQueue = useRef(new Set<string>());
const metaRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

useEffect(() => {
  return () => {
    mountedRef.current = false;
    if (metaRefreshTimer.current) {
      clearTimeout(metaRefreshTimer.current);
      metaRefreshTimer.current = null;
    }
  };
}, []);

const refreshConversationMeta = useCallback(
  async (convId: string) => {
    if (!convId) return;
    try {
      const messages = await loadMessages(convId);
      if (!mountedRef.current) return;
      if (!messages.length) {
        setConversationMeta((prev) => {
          if (!prev[convId]) return prev;
          const next = { ...prev };
          delete next[convId];
          return next;
        });
        return;
      }
      const last = messages[messages.length - 1];
      const preview = getMessagePreviewText(last);
      const unread = messages.filter((m) => !m.fromMe && m.status !== 'read').length;
      setConversationMeta((prev) => ({
        ...prev,
        [convId]: {
          lastMessage: preview,
          lastAt: last.createdAt,
          unreadCount: unread,
          lastStatus: last.fromMe ? last.status : undefined,
          lastMessageFromMe: !!last.fromMe,
        },
      }));
    } catch (error) {
      console.warn('[MessagesScreen] refresh meta failed', error);
    }
  },
  [],
);

const queueMetaRefresh = useCallback(
  (convId: string) => {
    if (!convId) return;
    metaRefreshQueue.current.add(convId);
    if (metaRefreshTimer.current) return;
    metaRefreshTimer.current = setTimeout(() => {
      const toRefresh = Array.from(metaRefreshQueue.current);
      metaRefreshQueue.current.clear();
      metaRefreshTimer.current = null;
      Promise.all(toRefresh.map((id) => refreshConversationMeta(id))).catch((err) => {
        console.warn('[MessagesScreen] queued meta refresh failed', err);
      });
    }, 150);
  },
  [refreshConversationMeta],
);

const deviceIdRef = useRef<string>('');
const joinedRoomsRef = useRef<Set<string>>(new Set());
const { socket, isConnected, typingByConversation, currentUserId, presenceByUser, startCall } = useSocket();

const handleStartQuickCall = useCallback(
  async (chat: Chat | undefined | null, media: 'voice' | 'video') => {
    if (!chat || !startCall) {
      Alert.alert('Call unavailable', 'Calling is not ready yet.');
      return;
    }
    const conversationId = String((chat as any).conversationId ?? chat.id ?? '');
    if (!conversationId) {
      Alert.alert('Call unavailable', 'Conversation is not ready yet.');
      return;
    }

    const inviteeUserIds = participantsToIds(chat.participants ?? []).filter(
      (id) => String(id) !== String(currentUserId ?? ''),
    );

    await startCall({
      conversationId,
      title: chat.name ?? 'Call',
      media,
      inviteeUserIds,
    });
  },
  [startCall, currentUserId],
);

const refreshConversations = useCallback(async (force?: boolean) => {
  const convs = await fetchConversationsForCurrentUser([], currentUserId ?? undefined, !!force);
  setConversations(convs);
  if (force) {
    await loadCommunitiesRef.current();
  }
}, [currentUserId]);

useEffect(() => {
  let active = true;
  (async () => {
    const term = query.trim();
    if (term.length >= 2) {
      const convs = await searchConversationsFromServer(term, currentUserId ?? undefined);
      if (active) setConversations(convs);
      return;
    }
    const convs = await fetchConversationsForCurrentUser([], currentUserId ?? undefined);
    if (active) setConversations(convs);
  })();
  return () => {
    active = false;
  };
}, [currentUserId, query]);

useEffect(() => {
  const sub = DeviceEventEmitter.addListener('conversation.refresh', async () => {
    await refreshConversations(true);
  });
  return () => {
    sub.remove();
  };
}, [refreshConversations]);

useEffect(() => {
  const sub = AppState.addEventListener('change', (state) => {
    if (state !== 'active') return;
    refreshConversations(true);
  });
  return () => sub.remove();
}, [refreshConversations]);

useEffect(() => {
  const sub = DeviceEventEmitter.addListener('status.open', () => {
    tabRef.current?.navigate?.('Updates');
  });
  return () => {
    sub.remove();
  };
}, []);

useEffect(() => {
  if (!avatarPreview) return;
  avatarAnim.setValue(0);
  Animated.timing(avatarAnim, {
    toValue: 1,
    duration: 180,
    easing: Easing.out(Easing.ease),
    useNativeDriver: true,
  }).start();
}, [avatarPreview, avatarAnim]);

const communitiesMountedRef = useRef(true);
const loadCommunities = useCallback(async () => {
  if (!currentUserId) {
    setCommunityByConversationId({});
    setCommunityGroupConversationIds(new Set());
    return;
  }

  try {
    const res = await getRequest(ROUTES.community.list, {
      errorMessage: 'Failed to load communities',
    });
    const list = Array.isArray(res?.data?.results)
      ? res.data.results
      : Array.isArray(res?.results)
      ? res.results
      : res?.data ?? res ?? [];
    if (!Array.isArray(list)) throw new Error('Unexpected communities payload');
    const map: Record<string, { id: string; name: string }> = {};
    const groupConvIds = new Set<string>();
    await Promise.all(
      list.map(async (c: any) => {
        const communityId = c?.id;
        const mainId = c?.main_conversation_id ?? c?.mainConversationId;
        const postsId = c?.posts_conversation_id ?? c?.postsConversationId;
        const name = String(c.name ?? c.title ?? 'Community');
        const register = (key: any) => {
          if (!key) return;
          map[String(key)] = {
            id: communityId ? String(communityId) : String(key),
            name,
          };
        };
        register(mainId);
        register(postsId);
        if (!communityId) return;
        try {
          const groupsRes = await getRequest(`${ROUTES.groups.list}?community=${communityId}`);
          const groupsList = Array.isArray(groupsRes?.data?.results)
            ? groupsRes.data.results
            : Array.isArray(groupsRes?.results)
            ? groupsRes.results
            : groupsRes?.data ?? groupsRes ?? [];
          if (Array.isArray(groupsList)) {
            groupsList.forEach((g: any) => {
              const convId = g?.conversation_id ?? g?.conversationId;
              if (convId) groupConvIds.add(String(convId));
            });
          }
        } catch {
          // ignore group fetch errors per community
        }
      }),
    );

    if (communitiesMountedRef.current) {
      setCommunityByConversationId(map);
      setCommunityGroupConversationIds(groupConvIds);
    }
  } catch {
    if (communitiesMountedRef.current) {
      setCommunityByConversationId({});
      setCommunityGroupConversationIds(new Set());
    }
  }
}, [currentUserId]);

useEffect(() => {
  loadCommunitiesRef.current = loadCommunities;
}, [loadCommunities]);

useEffect(() => {
  communitiesMountedRef.current = true;
  loadCommunities();
  return () => {
    communitiesMountedRef.current = false;
  };
}, [loadCommunities]);

useEffect(() => {
  const sub = DeviceEventEmitter.addListener('community.refresh', () => {
    loadCommunities();
  });
  return () => sub.remove();
}, [loadCommunities]);

useEffect(() => {
  const sub = DeviceEventEmitter.addListener('conversation.read', (payload: any) => {
    const convId = String(payload?.conversationId ?? '');
    const readCount = typeof payload?.readCount === 'number' ? payload.readCount : 0;
    if (!convId || readCount <= 0) return;
    queueMetaRefresh(convId);
    setConversationMeta((prev) => {
      const prevUnread = prev[convId]?.unreadCount ?? 0;
      return {
        ...prev,
        [convId]: {
          ...prev[convId],
          unreadCount: Math.max(prevUnread - readCount, 0),
        },
      };
    });
  });
  return () => {
    sub.remove();
  };
}, [queueMetaRefresh]);

useEffect(() => {
  const sub = DeviceEventEmitter.addListener('message.status', (payload: any) => {
    const convId = String(payload?.conversationId ?? '');
    const status = payload?.status as MessageStatus | undefined;
    const fromMe = !!payload?.fromMe;
    if (!convId) return;
    queueMetaRefresh(convId);
    if (!status || !fromMe) return;
    setConversationMeta((prev) => {
      const existing = prev[convId] ?? {};
      return {
        ...prev,
        [convId]: {
          ...existing,
          lastStatus: status,
          lastMessageFromMe: true,
        },
      };
    });
  });
  return () => {
    sub.remove();
  };
}, [queueMetaRefresh]);

useEffect(() => {
  const CONTACTS_CACHE_KEY = 'kis.contacts.cache.v1';
  const loadContacts = async () => {
    try {
      const raw = await AsyncStorage.getItem(CONTACTS_CACHE_KEY);
      if (!raw) return;
      const list = JSON.parse(raw) as Array<{ name?: string; phone?: string }>;
      const map: Record<string, string> = {};
      for (const c of list || []) {
        const key = normalizePhoneKey(c.phone);
        if (key && c.name) map[key] = c.name;
      }
      setContactNameByPhone(map);
    } catch {}
  };
  loadContacts();
}, []);

useEffect(() => {
  const convIds = Array.from(
    new Set(
      conversations
        .map((c) => String((c as any)?.conversation_id ?? (c as any)?.conversationId ?? (c as any)?.id ?? ''))
        .filter(Boolean),
    ),
  );

  convIds.forEach((id) => queueMetaRefresh(id));

  setConversationMeta((prev) => {
    const next = { ...prev };
    const keep = new Set(convIds);
    Object.keys(next).forEach((key) => {
      if (!keep.has(key)) {
        delete next[key];
      }
    });
    return next;
  });
}, [conversations, queueMetaRefresh]);

useEffect(() => {
  if (deviceIdRef.current) return;
  ensureDeviceId()
    .then((id) => {
      deviceIdRef.current = id;
    })
    .catch(() => {});
}, []);

useEffect(() => {
  if (!socket || !isConnected) return;
  const onMessage = (payload: any) => {
    const convId = String(payload?.conversationId ?? payload?.conversation_id ?? '');
    if (!convId) return;
    const encMeta = payload?.encryptionMeta ?? payload?.encryption_meta;
    const hasEncrypted = !!(encMeta || payload?.ciphertext);
    const lastAt = payload?.createdAt ?? new Date().toISOString();
    const senderId =
      payload?.senderId != null ? String(payload.senderId) : '';
    const isFromMe = senderId.length > 0 && senderId === String(currentUserId);
    const previewText =
      payload?.text ??
      getMessagePreviewText(payload) ??
      (hasEncrypted ? 'Encrypted message' : '');

    setConversationMeta((prev) => {
      const prevUnread = prev[convId]?.unreadCount ?? 0;
      const increment = isFromMe ? 0 : 1;
      return {
        ...prev,
        [convId]: {
          lastMessage: previewText,
          lastAt,
          unreadCount: Math.max(prevUnread + increment, 0),
          lastStatus: isFromMe ? (payload?.status ?? 'sent') : prev[convId]?.lastStatus,
          lastMessageFromMe: isFromMe,
        },
      };
    });

    try {
      const mapped = mapBackendToChatMessage(
        payload,
        String(currentUserId ?? ''),
        convId,
      );
      upsertMessage(convId, mapped).catch(() => {});
    } catch {}

    queueMetaRefresh(convId);

    if (encMeta?.e2ee === 'signal') {
      const senderDeviceId = encMeta?.senderDeviceId ?? encMeta?.deviceId ?? '';
      const recipients = Array.isArray(encMeta?.recipients) ? encMeta.recipients : null;
      const currentDeviceId = deviceIdRef.current;
      const recipientCipher = recipients
        ? recipients.find(
            (r: any) =>
              String(r.userId) === String(currentUserId) ||
              String(r.deviceId) === String(currentDeviceId),
          )
        : null;
      const ciphertext = recipientCipher?.ciphertext ?? payload?.ciphertext;
      const type = recipientCipher?.type ?? encMeta?.type ?? 1;
      if (senderDeviceId && ciphertext) {
        decryptFromUser(
          String(payload?.senderId ?? ''),
          String(senderDeviceId),
          String(ciphertext),
          Number(type),
        )
          .then((plaintext) => {
            let parsed: any = null;
            try {
              parsed = JSON.parse(plaintext);
            } catch {}
            const textValue = parsed?.text ?? plaintext;
            setConversationMeta((prev) => ({
              ...prev,
              [convId]: {
                lastMessage: textValue,
                lastAt,
                unreadCount: prev[convId]?.unreadCount ?? 0,
              },
            }));
            const mappedInner = mapBackendToChatMessage(
              payload,
              String(currentUserId ?? ''),
              convId,
            );
            const patched = {
              ...mappedInner,
              text: textValue,
              styledText: parsed?.styledText ?? mappedInner.styledText,
              attachments: parsed?.attachments ?? mappedInner.attachments,
              contacts: parsed?.contacts ?? mappedInner.contacts,
              poll: parsed?.poll ?? mappedInner.poll,
              event: parsed?.event ?? mappedInner.event,
              voice: parsed?.voice ?? mappedInner.voice,
              sticker: parsed?.sticker ?? mappedInner.sticker,
              replyToId: parsed?.replyToId ?? mappedInner.replyToId,
              kind: parsed?.kind ?? mappedInner.kind,
            };
            upsertMessage(convId, patched).catch(() => {});
          })
          .catch(() => {});
      }
    }

    if (
      payload?.encryptionVersion === ENCRYPTION_VERSION &&
      payload?.encrypted &&
      payload?.ciphertext &&
      payload?.iv &&
      payload?.tag
    ) {
      void (async () => {
        try {
          const plaintext = await decryptConversationPayload(
            convId,
            payload.ciphertext,
            payload.iv,
            payload.tag,
            payload.aad,
            payload.encryptionKeyVersion,
          );
          let parsed: any = null;
          try {
            parsed = JSON.parse(plaintext);
          } catch {}
          const textValue = parsed?.text ?? plaintext;
          setConversationMeta((prev) => ({
            ...prev,
            [convId]: {
              ...prev[convId],
              lastMessage: textValue,
              lastAt,
              unreadCount: prev[convId]?.unreadCount ?? 0,
            },
          }));
          const mappedInner = mapBackendToChatMessage(
            payload,
            String(currentUserId ?? ''),
            convId,
          );
          const patched = {
            ...mappedInner,
            text: textValue,
            styledText: parsed?.styledText ?? mappedInner.styledText,
            attachments: parsed?.attachments ?? mappedInner.attachments,
            contacts: parsed?.contacts ?? mappedInner.contacts,
            poll: parsed?.poll ?? mappedInner.poll,
            event: parsed?.event ?? mappedInner.event,
            voice: parsed?.voice ?? mappedInner.voice,
            sticker: parsed?.sticker ?? mappedInner.sticker,
            replyToId: parsed?.replyToId ?? mappedInner.replyToId,
            kind: parsed?.kind ?? mappedInner.kind,
          };
          upsertMessage(convId, patched).catch(() => {});
        } catch (error) {
          console.warn('[customE2EE] decrypt fallback failed', error);
        }
      })();
    }
  };
  socket.on('chat.message', onMessage);
  return () => {
    socket.off('chat.message', onMessage);
  };
}, [socket, isConnected, currentUserId, queueMetaRefresh]);

useEffect(() => {
  const sub = DeviceEventEmitter.addListener('message.status', (payload: any) => {
    const convId = String(payload?.conversationId ?? '');
    if (!convId) return;
    queueMetaRefresh(convId);
  });
  return () => {
    sub.remove();
  };
}, [queueMetaRefresh]);

useEffect(() => {
  if (!socket || !isConnected) return;
  const convIds = conversations
    .map((c: any) => c?.conversation_id ?? c?.conversationId ?? c?.id)
    .filter(Boolean)
    .map((v: any) => String(v));

  const nextSet = new Set(convIds);
  const prevSet = joinedRoomsRef.current;
  for (const id of nextSet) {
    if (!prevSet.has(id)) {
      socket.emit('chat.join', { conversationId: id });
    }
  }
  for (const id of prevSet) {
    if (!nextSet.has(id)) {
      socket.emit('chat.leave', { conversationId: id });
    }
  }
  joinedRoomsRef.current = nextSet;
}, [socket, isConnected, conversations]);

useEffect(() => {
  if (!socket) return;
  const handleDisconnect = () => {
    for (const id of joinedRoomsRef.current) {
      socket.emit('chat.leave', { conversationId: id });
    }
    joinedRoomsRef.current = new Set();
  };
  socket.on('disconnect', handleDisconnect);
  return () => {
    socket.off('disconnect', handleDisconnect);
    if (socket.connected) {
      for (const id of joinedRoomsRef.current) {
        socket.emit('chat.leave', { conversationId: id });
      }
      joinedRoomsRef.current = new Set();
    }
  };
}, [socket]);


useEffect(() => {
  if (selectedChat.length > 0) {
    setSelectMode(true);
    setSelectCount(selectedChat.length);
  } else {
    setSelectMode(false);
    setSelectCount(null);
  }
}, [selectedChat]);

// handlers for app bar actions
const handleClearSelection = () => {
  setSelectedChat([]);
  setSelectMode(false);
  setMenuVisible(false);
};

const handleDeleteSelected = () => {
  // TODO: implement deletion logic
  // e.g. call API, update chats list, etc.
  console.log('Delete chats:', selectedChat);
};

const handlePinSelected = () => {
  console.log('Pin chats:', selectedChat);
};

const handleMuteSelected = () => {
  console.log('Mute chats:', selectedChat);
};



  const [addVisible, setAddVisible] = useState(false);
  const addSlide = useRef(new Animated.Value(0)).current; // 0 = off-screen, 1 = on-screen

  const openAddContacts = () => {
    setAddVisible(true);
    Animated.timing(addSlide, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }

  
  const closeChat = () => {
    Animated.timing(chatSlide, {
      toValue: 0,
      duration: 260,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start(() => {
      setChatVisible(false);
      setActiveChat(null);
    });
  };

  const closeAddContacts = () => {
    Animated.timing(addSlide, {
      toValue: 0,
      duration: 260,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start(() => {
      setAddVisible(false);
    });
  };

  const addTranslateY = addSlide.interpolate({
    inputRange: [0, 1],
    outputRange: [height, 0], // slide up from bottom
  });

  const chatTranslateX = chatSlide.interpolate({
    inputRange: [0, 1],
    outputRange: [width, 0], // slide in from the right
  });

  // ── Accessibility: reduce motion ──────────────────────────────────────────
  const reduceMotionRef = useRef(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (mounted) reduceMotionRef.current = !!v;
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => {
      reduceMotionRef.current = !!v;
    });
    return () => {
      mounted = false;
      sub?.remove?.();
    };
  }, []);

  // ── Animated cluster (header + tab bar) ───────────────────────────────────
  // hideProgress: 0 = fully shown, 1 = fully hidden
  const hideProgress = useRef(new Animated.Value(0)).current;

  // Header measurement
  const headerHRef = useRef(0);
  const [headerH, setHeaderH] = useState(0);

  // Tab bar measurement
  const tabHRef = useRef(0);
  const [tabH, setTabH] = useState(0);

  const onHeaderLayout = (e: LayoutChangeEvent) => {
    const h = Math.max(0, e.nativeEvent.layout.height || 0);
    if (h !== headerHRef.current) {
      headerHRef.current = h;
      setHeaderH(h);
    }
  };

  const onTabLayout = (h: number) => {
    const v = Math.max(0, h || 0);
    if (v !== tabHRef.current) {
      tabHRef.current = v;
      setTabH(v);
    }
  };

  const translateHeaderY = hideProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -(headerH * 2) || 0],
    extrapolate: 'clamp',
  });
  const headerNegMargin = hideProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -(headerH || 0)],
    extrapolate: 'clamp',
  });

  const translateTabY = hideProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -(tabH || 0)],
    extrapolate: 'clamp',
  });
  const tabNegMargin = hideProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -(tabH || 0)],
    extrapolate: 'clamp',
  });

  // ── Scroll heuristics (debounced + velocity aware) ────────────────────────
  const lastYRef = useRef(0);
  const lastTsRef = useRef(0);
  const animatingRef = useRef<null | 'show' | 'hide'>(null);

  const animationRef = useRef<Animated.CompositeAnimation | null>(null);
  const runSpring = useCallback(
    (toValue: 0 | 1) => {
      if (reduceMotionRef.current) {
        hideProgress.setValue(toValue);
        animatingRef.current = null;
        return;
      }
      const nextState = toValue ? 'hide' : 'show';
      animatingRef.current = nextState;
      animationRef.current?.stop();
      animationRef.current = Animated.timing(hideProgress, {
        toValue,
        duration: 220,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: false, // we still animate layout margins
      });
      animationRef.current.start(() => {
        animatingRef.current = null;
        animationRef.current = null;
      });
    },
    [hideProgress]
  );

  const animateHidden = (hidden: boolean) => {
    if (
      animatingRef.current &&
      ((hidden && animatingRef.current === 'hide') ||
        (!hidden && animatingRef.current === 'show'))
    ) {
      return; // avoid re-triggering same direction
    }
    runSpring(hidden ? 1 : 0);
  };

  const handleChatsScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { y } = e.nativeEvent.contentOffset;
    const ts = Date.now();
    const dy = y - lastYRef.current;
    const dt = Math.max(1, ts - (lastTsRef.current || ts));
    const velocityY = dy / dt; // px per ms (rough)

    // Ignore ultra-small jitters/noise
    if (Math.abs(dy) < 2) return;

    // Velocity-sensitive thresholds (faster scrolls hide/show sooner)
    const baseThreshold = 8;
    const velocityBoost = Math.min(1.5, Math.max(0.5, Math.abs(velocityY) * 120));
    const threshold = baseThreshold / velocityBoost;

    if (dy > threshold) animateHidden(true); // scrolling down -> hide
    else if (dy < -threshold) animateHidden(false); // scrolling up -> show

    lastYRef.current = y;
    lastTsRef.current = ts;
  };

  const handleChatsEndReached = () => {
    animateHidden(false); // reveal at end
  };

  // ── Load/save custom filters ─────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(CUSTOM_FILTERS_KEY);
        if (raw) setCustomFilters(JSON.parse(raw));
      } catch (e) {
        console.warn('Failed to load custom filters', e);
      }
    })();
  }, []);
  async function persistFilters(next: CustomFilter[]) {
    setCustomFilters(next);
    try {
      await AsyncStorage.setItem(CUSTOM_FILTERS_KEY, JSON.stringify(next));
    } catch (e) {
      console.warn('Failed to save custom filters', e);
    }
  }
  const addCustomFilter = (f: CustomFilter) => {
    const next = [...customFilters, f];
    persistFilters(next);
    setActiveCustom(f.id);
  };
  const deleteCustomFilter = (id: string) => {
    const next = customFilters.filter((f) => f.id !== id);
    persistFilters(next);
    if (activeCustom === id) setActiveCustom(null);
  };

  const quickToggle = (chip: LocalQuick) =>
    setActiveQuick((prev) => {
      const next = new Set(prev);
      if (next.has(chip)) next.delete(chip);
      else next.add(chip);
      return next;
    });

  // pass all supported chips to ChatsTab
  const activeQuickForChats = useMemo(() => {
    const base = new Set<QuickChip>();
    for (const c of activeQuick)
      if (
        c === 'Unread' ||
        c === 'Groups' ||
        c === 'Community' ||
        c === 'Mentions' ||
        c === 'Archived' ||
        c === 'Blocked'
      )
        base.add(c);
    return base;
  }, [activeQuick]);

  // ── Animated Top Tab Bar (collapses space) ───────────────────────────────
  const [activeTopTab, setActiveTopTab] = useState<'Chats' | 'Updates' | 'Calls'>('Chats');
  const [tabSearchOpen, setTabSearchOpen] = useState(false);
  const [tabSearchQuery, setTabSearchQuery] = useState('');

  const AnimatedTopBar = (tabProps: any) => {
    const nextTab = tabProps?.state?.routes?.[tabProps.state.index]?.name;
    useEffect(() => {
      if (nextTab === 'Chats' || nextTab === 'Updates' || nextTab === 'Calls') {
        setActiveTopTab(nextTab);
      }
    }, [nextTab]);
    return (
      <Animated.View
        onLayout={(e) => onTabLayout(e.nativeEvent.layout.height)}
        style={{
          transform: [{ translateY: translateTabY }],
          marginBottom: tabNegMargin, // collapse layout space while hidden
          backgroundColor: palette.bar,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: palette.inputBorder,
        }}
      >
        <MaterialTopTabBar
          {...tabProps}
          style={{ backgroundColor: palette.bar, elevation: 0 }}
          indicatorStyle={{ backgroundColor: palette.primary, height: 3, borderRadius: 3 }}
          labelStyle={{ fontWeight: '700', textTransform: 'none', fontSize: 14 }}
          activeTintColor={palette.text}
          inactiveTintColor={palette.subtext}
        />
      </Animated.View>
    );
  };

  const menuItems = useMemo(() => {
    if (activeTopTab === 'Updates') {
      return [
        { key: 'new-status', label: 'New status' },
        { key: 'new-channel', label: 'New channel' },
        { key: 'updates-settings', label: 'Updates settings' },
      ];
    }
    if (activeTopTab === 'Calls') {
      return [
        { key: 'new-call', label: 'New call' },
        { key: 'call-history', label: 'Call history' },
        { key: 'calls-settings', label: 'Calls settings' },
      ];
    }
    return [
      { key: 'new-chat', label: 'New chat' },
      { key: 'new-group', label: 'New group' },
      { key: 'settings', label: 'Settings' },
    ];
  }, [activeTopTab]);

  useEffect(() => {
    if (activeTopTab === 'Chats') {
      setTabSearchOpen(false);
      setTabSearchQuery('');
    }
  }, [activeTopTab]);

  // ── Animated menu (fade + scale) ─────────────────────────────────────────
  const menuAnim = useRef(new Animated.Value(0)).current; // 0 hidden, 1 visible
  useEffect(() => {
    const to = menuVisible ? 1 : 0;
    if (reduceMotionRef.current) {
      menuAnim.setValue(to);
    } else {
      Animated.timing(menuAnim, {
        toValue: to,
        duration: 140,
        easing: menuVisible ? Easing.out(Easing.quad) : Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start();
    }
  }, [menuVisible, menuAnim]);

  const menuStyle = {
    opacity: menuAnim,
    transform: [
      {
        scale: menuAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.96, 1],
          extrapolate: 'clamp',
        }),
      },
      {
        translateY: menuAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [-4, 0],
          extrapolate: 'clamp',
        }),
      },
    ],
  } as const;

  return (
    <View style={[styles.wrap, { backgroundColor: palette.chrome, paddingTop: insets.top }]}>
      {/* ------------ Top App Bar ------------ */}
        {selectMode ? (
          // 🔵 SELECT MODE APP BAR
          <View
            style={[
              styles.appBar,
              { borderBottomColor: palette.inputBorder },
            ]}
          >
            {/* LEFT: back arrow + count */}
            <View style={styles.appBarLeft}>
              <Pressable
                onPress={handleClearSelection}
                hitSlop={10}
                style={({ pressed }) => [
                  { opacity: pressed ? KIS_TOKENS.opacity.pressed : 1, padding: 8 },
                ]}
              >
                <KISIcon name="arrow-left" size={20} color={palette.text} />
              </Pressable>

              <Text
                style={[
                  styles.appName,
                  { color: palette.text, marginLeft: 4 },
                ]}
              >
                {selectCount ?? selectedChat.length}
              </Text>
            </View>

            {/* RIGHT: pin, mute, delete, menu */}
            <View style={styles.appBarRight}>
              <Pressable
                onPress={handlePinSelected}
                hitSlop={10}
                style={({ pressed }) => [
                  { opacity: pressed ? KIS_TOKENS.opacity.pressed : 1, padding: 8 },
                ]}
              >
                <KISIcon name="pin" size={18} color={palette.text} />
              </Pressable>

              <Pressable
                onPress={handleMuteSelected}
                hitSlop={10}
                style={({ pressed }) => [
                  { opacity: pressed ? KIS_TOKENS.opacity.pressed : 1, padding: 8 },
                ]}
              >
                <KISIcon name="mute" size={18} color={palette.text} />
              </Pressable>

              <Pressable
                onPress={handleDeleteSelected}
                hitSlop={10}
                style={({ pressed }) => [
                  { opacity: pressed ? KIS_TOKENS.opacity.pressed : 1, padding: 8 },
                ]}
              >
                <KISIcon name="trash" size={18} color={palette.text} />
              </Pressable>

              <Pressable
                onPress={() => setMenuVisible((v) => !v)}
                hitSlop={10}
                style={({ pressed }) => [
                  { opacity: pressed ? KIS_TOKENS.opacity.pressed : 1, padding: 8 },
                ]}
              >
                <KISIcon name="menu" size={18} color={palette.text} />
              </Pressable>
            </View>

            {/* Dropdown menu (selection actions) */}
            <View pointerEvents={menuVisible ? 'auto' : 'none'} style={{ zIndex: 5 }}>
              {/* overlay */}
              <Pressable
                onPress={() => setMenuVisible(false)}
                style={[styles.menuOverlay, { opacity: menuVisible ? 1 : 0 }]}
              />
              {/* popover */}
              <Animated.View
                style={[
                  styles.menuBox,
                  {
                    position: 'absolute',
                    right: 12,
                    top: Platform.select({ ios: 46, android: 50, default: 46 }),
                    borderColor: palette.inputBorder,
                    backgroundColor: palette.card,
                    shadowColor: palette.shadow,
                  },
                  KIS_TOKENS.elevation.popover,
                  menuStyle,
                ]}
              >
                {[
                  { key: 'select-all', label: 'Select all' },
                  { key: 'mark-read', label: 'Mark as read' },
                  { key: 'archive', label: 'Archive' },
                ].map((m) => (
                  <Pressable
                    key={m.key}
                    onPress={() => {
                      // TODO: handle each menu item
                      setMenuVisible(false);
                    }}
                    style={({ pressed }) => [
                      styles.menuItem,
                      { backgroundColor: pressed ? palette.surface : 'transparent' },
                    ]}
                  >
                    <Text style={{ color: palette.text, fontSize: 14 }}>
                      {m.label}
                    </Text>
                  </Pressable>
                ))}
              </Animated.View>
            </View>
          </View>
        ) : (
          // 🟢 NORMAL APP BAR (your original)
          <View
            style={[
              styles.appBar,
              { borderBottomColor: palette.inputBorder },
            ]}
          >
            <View style={styles.appBarLeft}>
              <Text style={[styles.appName, { color: palette.text }]}> KIS </Text>
              <Text style={[styles.appSubtitle, { color: palette.subtext }]}>
                Kingdom Impact Social
              </Text>
            </View>

            <View style={styles.appBarRight}>
              <Pressable
                onPress={() => {
                  if (activeTopTab === 'Chats') return;
                  setTabSearchOpen(true);
                }}
                hitSlop={10}
                style={({ pressed }) => [
                  { opacity: pressed ? KIS_TOKENS.opacity.pressed : 1, padding: 8 },
                ]}
              >
                <KISIcon
                  name={activeTopTab === 'Chats' ? 'camera' : 'search'}
                  size={18}
                  color={palette.text}
                />
              </Pressable>
              <Pressable
                onPress={() => setMenuVisible((v) => !v)}
                hitSlop={10}
                style={({ pressed }) => [
                  { opacity: pressed ? KIS_TOKENS.opacity.pressed : 1, padding: 8 },
                ]}
              >
                <KISIcon name="menu" size={18} color={palette.text} />
              </Pressable>
            </View>

            {/* Dropdown menu (normal mode) */}
            <View pointerEvents={menuVisible ? 'auto' : 'none'} style={{ zIndex: 5 }}>
              <Pressable
                onPress={() => setMenuVisible(false)}
                style={[styles.menuOverlay, { opacity: menuVisible ? 1 : 0 }]}
              />
              <Animated.View
                style={[
                  styles.menuBox,
                  {
                    position: 'absolute',
                    right: 12,
                    top: Platform.select({ ios: 46, android: 50, default: 46 }),
                    borderColor: palette.inputBorder,
                    backgroundColor: palette.card,
                    shadowColor: palette.shadow,
                  },
                  KIS_TOKENS.elevation.popover,
                  menuStyle,
                ]}
              >
                {menuItems.map((m) => (
                  <Pressable
                    key={m.key}
                    onPress={() => setMenuVisible(false)}
                    style={({ pressed }) => [
                      styles.menuItem,
                      { backgroundColor: pressed ? palette.surface : 'transparent' },
                    ]}
                  >
                    <Text style={{ color: palette.text, fontSize: 14 }}>
                      {m.label}
                    </Text>
                  </Pressable>
                ))}
              </Animated.View>
            </View>
          </View>
        )}


      {/* ------------ Animated Elevated Search Bar + Filters ------------ */}
      {activeTopTab === 'Chats' ? (
        <Animated.View
          onLayout={onHeaderLayout}
          style={{
            transform: [{ translateY: translateHeaderY }],
            marginBottom: headerNegMargin, // collapse space so list moves up
            paddingHorizontal: 12,
            paddingTop: 10,
            paddingBottom: 8,
            zIndex: 1,
          }}
        >
          <View
            style={[
              styles.searchContainer,
              {
                borderColor: palette.inputBorder,
                backgroundColor: palette.surfaceElevated,
                shadowColor: palette.shadow,
              },
              KIS_TOKENS.elevation.card,
            ]}
          >
            <KISIcon name="search" size={18} color={palette.text} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search chats, people, and groups…"
              placeholderTextColor={palette.subtext}
              style={[styles.searchInput, { color: palette.text }]}
            />
            <Pressable onPress={() => {}} style={styles.searchIconBtn}>
              <KISIcon name="mic" size={18} color={palette.text} />
            </Pressable>
            <View style={[styles.searchDivider, { backgroundColor: palette.inputBorder }]} />
            <Pressable onPress={() => setFilterMgrOpen(true)} style={styles.searchIconBtn} hitSlop={8}>
              <KISIcon name="settings" size={18} color={palette.text} />
            </Pressable>
          </View>

          {/* Quick chips + Custom filter row */}
          <View style={styles.chipsRow}>
            {(['Unread', 'Groups', 'Community', 'Mentions', 'Archived', 'Blocked'] as LocalQuick[]).map(
              (chip) => (
                <ToggleChip
                  key={chip}
                  label={chip}
                  active={activeQuick.has(chip)}
                  onPress={() => quickToggle(chip)}
                  palette={palette}
                />
              )
            )}

            {customFilters.map((f) => (
              <ToggleChip
                key={f.id}
                label={f.label}
                active={activeCustom === f.id}
                onPress={() => setActiveCustom((cur) => (cur === f.id ? null : f.id))}
                palette={palette}
              />
            ))}

            <Pressable
              onPress={() => setFilterMgrOpen(true)}
              style={({ pressed }) => [
                styles.chip,
                {
                  backgroundColor: pressed ? palette.surface : palette.card,
                  borderColor: palette.inputBorder,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                },
              ]}
            >
              <KISIcon name="add" size={18} color={palette.text} />
              <Text style={{ color: palette.text, fontSize: 13 }}>Create</Text>
            </Pressable>
          </View>
        </Animated.View>
      ) : null}

      {/* ------------ Updates/Calls Search Modal ------------ */}
      {tabSearchOpen && activeTopTab !== 'Chats' ? (
        <View style={styles.searchOverlay}>
          <Pressable
            style={styles.searchOverlayBackdrop}
            onPress={() => setTabSearchOpen(false)}
          />
          <View
            style={[
              styles.searchOverlayCard,
              { backgroundColor: palette.card, borderColor: palette.inputBorder },
            ]}
          >
            <View style={styles.searchOverlayRow}>
              <KISIcon name="search" size={18} color={palette.text} />
              <TextInput
                value={tabSearchQuery}
                onChangeText={setTabSearchQuery}
                placeholder={
                  activeTopTab === 'Updates'
                    ? 'Search updates…'
                    : 'Search calls…'
                }
                placeholderTextColor={palette.subtext}
                style={[styles.searchInput, { color: palette.text }]}
                autoFocus
              />
              <Pressable onPress={() => setTabSearchQuery('')} style={styles.searchIconBtn}>
                <KISIcon name="close" size={18} color={palette.text} />
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

      {/* ------------ Top Tabs (animated tab bar) ------------ */}
      <View style={{ flex: 1, backgroundColor: palette.bg }}>
        <Tab.Navigator
          {...({ ref: tabRef } as any)}
          tabBar={(props) => <AnimatedTopBar {...props} />}
          screenOptions={{ swipeEnabled: true, tabBarScrollEnabled: false }}
        >
          <Tab.Screen
            name="Chats"
            children={() => (
              <ChatsTab
                filters={customFilters}
                activeQuick={activeQuickForChats}
                activeCustomId={activeCustom}
                search={query}
                typingByConversation={typingByConversation}
                presenceByUser={presenceByUser}
                currentUserId={currentUserId ?? undefined}
                contactNameByPhone={contactNameByPhone}
                conversationMeta={conversationMeta}
                communityByConversationId={communityByConversationId}
                communityGroupConversationIds={communityGroupConversationIds}
                statusByUserId={statusByUserId}
                onOpenStatus={(userId) => {
                  DeviceEventEmitter.emit('status.open', { userId });
                  tabRef.current?.navigate?.('Updates');
                }}
                onOpenAvatarPreview={(payload) => {
                  setAvatarPreview({
                    uri: payload.avatarUrl,
                    chat: payload.chat,
                    userId: payload.userId ?? null,
                  });
                  setAvatarPreviewFull(false);
                }}
                onScroll={handleChatsScroll}
                onEndReached={handleChatsEndReached}
                onOpenChat={onOpenChat}
                selectedChat={selectedChat}
                setSelectedChat={setSelectedChat}
                conversations={conversations}
              />
            )}
          />
          <Tab.Screen
            name="Updates"
            children={() => (
              <UpdatesTab searchTerm={tabSearchQuery} onOpenChat={onOpenChat} />
            )}
          />
          <Tab.Screen
            name="Calls"
            children={() => <CallsTab searchTerm={tabSearchQuery} />}
          />
        </Tab.Navigator>

        {/* 🔵 Suspended "Add" button (FAB) */}
        {activeTopTab === 'Chats' ? (
          <Pressable
            onPress={openAddContacts}
            style={({ pressed }) => [
              {
                position: 'absolute',
                right: 16,
                bottom: 16 + 64, // 64-ish to sit above bottom tab bar
                width: 56,
                height: 56,
                borderRadius: 28,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: palette.primary,
                shadowColor: palette.shadow,
                shadowOpacity: 0.3,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 4 },
                elevation: 6,
              },
              pressed && { opacity: KIS_TOKENS.opacity.pressed },
            ]}
          >
            <KISIcon name="add" size={24} color={palette.inverseText ?? '#fff'} />
          </Pressable>
        ) : null}
      </View>

      <Modal
        visible={!!avatarPreview}
        transparent
        animationType="fade"
        onRequestClose={() => setAvatarPreview(null)}
      >
        <Pressable
          style={[
            styles.searchOverlayBackdrop,
            { backgroundColor: avatarPreviewFull ? '#000' : 'rgba(0,0,0,0)' },
          ]}
          onPress={() => setAvatarPreview(null)}
        />
        {avatarPreview ? (
          <Animated.View
            style={{
              position: 'absolute',
              top: insets.top + 24,
              left: 0,
              right: 0,
              bottom: insets.bottom + 24,
              alignItems: 'center',
              justifyContent: 'center',
              transform: [
                {
                  scale: avatarAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.9, 1],
                  }),
                },
              ],
            }}
          >
            <Pressable
              onPress={() => setAvatarPreviewFull((prev) => !prev)}
              style={{
                width: avatarPreviewFull ? width : Math.min(width * 0.7, 280),
                height: avatarPreviewFull ? height * 0.7 : Math.min(width * 0.7, 280),
                borderRadius: avatarPreviewFull ? 0 : 18,
                overflow: 'hidden',
                backgroundColor: palette.card,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Image
                source={{ uri: avatarPreview.uri }}
                resizeMode="cover"
                style={{ width: '100%', height: '100%' }}
              />
                <Pressable
                  onPress={() => setAvatarPreview(null)}
                  style={{
                    position: 'absolute',
                    top: 10,
                    left: 10,
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    backgroundColor: 'rgba(0,0,0,0.55)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <KISIcon name="arrow-left" size={18} color="#fff" />
                </Pressable>
            </Pressable>
            {!avatarPreviewFull ? (
              <View
                style={{
                  marginTop: 12,
                  width: Math.min(width * 0.7, 280),
                  flexDirection: 'row',
                  borderRadius: 16,
                  overflow: 'hidden',
                  backgroundColor: palette.card,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: palette.inputBorder,
                }}
              >
                <Pressable
                  onPress={() => {
                    if (avatarPreview.chat) {
                      setAvatarPreview(null);
                      onOpenChat(avatarPreview.chat);
                    }
                  }}
                  style={{ flex: 1, paddingVertical: 12, alignItems: 'center' }}
                >
                  <KISIcon name="chat" size={20} color={palette.primary} />
                </Pressable>
                <Pressable
                  onPress={() => {
                    void handleStartQuickCall(avatarPreview.chat, 'voice');
                  }}
                  style={{ flex: 1, paddingVertical: 12, alignItems: 'center' }}
                >
                  <KISIcon name="phone" size={20} color={palette.text} />
                </Pressable>
                <Pressable
                  onPress={() => {
                    void handleStartQuickCall(avatarPreview.chat, 'video');
                  }}
                  style={{ flex: 1, paddingVertical: 12, alignItems: 'center' }}
                >
                  <KISIcon name="video" size={20} color={palette.text} />
                </Pressable>
                <Pressable
                  onPress={() => {
                    if (avatarPreview.chat) {
                      setAvatarPreview(null);
                      if (onOpenInfo) {
                        onOpenInfo({
                          chat: avatarPreview.chat,
                          currentUserId: currentUserId ?? null,
                        });
                        return;
                      }
                      onOpenChat(avatarPreview.chat);
                    }
                  }}
                  style={{ flex: 1, paddingVertical: 12, alignItems: 'center' }}
                >
                  <KISIcon name="info" size={20} color={palette.text} />
                </Pressable>
              </View>
            ) : null}
          </Animated.View>
        ) : null}
      </Modal>

      {/* Custom Filter Manager */}
      <FilterManager
        visible={filterMgrOpen}
        onClose={() => setFilterMgrOpen(false)}
        onSave={addCustomFilter}
        onDelete={deleteCustomFilter}
        filters={customFilters}
      />


      {/* ------------ Full-screen Chat Room Overlay ------------ */}
      {(
        <Animated.View
          pointerEvents={chatVisible ? 'auto' : 'none'}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            transform: [{ translateX: chatTranslateX }],
            zIndex: 50, // above everything
            backgroundColor: palette.bg,
          }}
        >
          <ChatRoomPage
            chat={activeChat}
            onBack={closeChat}
            allChats={conversations}
          />
        </Animated.View>
      )}
      {(
        <Animated.View
          pointerEvents={addVisible ? 'auto' : 'none'}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            transform: [{ translateY: addTranslateY }],
            zIndex: 40,
            backgroundColor: palette.bg,
          }}
        >
          <AddContactsPage onOpenChat={onOpenChat} onClose={closeAddContacts} />
        </Animated.View>
      )}
    </View>
  )
  
  
}
