import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TextInput,
  Pressable,
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
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  createMaterialTopTabNavigator,
  MaterialTopTabBar,
} from '@react-navigation/material-top-tabs';
import { useKISTheme } from '../../theme/useTheme';
import { KIS_TOKENS } from '../../theme/constants';
import { useResponsiveLayout } from '../../theme/responsive';
import { ChatsTab } from '@/Module/ChatRoom/componets/MessageTabs';
import { KISIcon } from '@/constants/kisIcons';
import AddContactsPage from '@/Module/AddContacts/AddContactsPage';
import ChatRoomPage, { type AttachmentFilePayload } from '@/Module/ChatRoom/ChatRoomPage';
import { CameraCaptureModal } from '@/Module/ChatRoom/componets/main/CameraCaptureModal';
import { useSocket } from '../../../SocketProvider';
import { loadMessages, upsertMessage } from '@/Module/ChatRoom/Storage/chatStorage';
import { normalizePhoneKey, participantsToIds } from '@/Module/ChatRoom/messagesUtils';
import { decryptFromUser, ensureDeviceId } from '@/security/e2ee';
import { FilterManager, ToggleChip } from '@/components/messaging/Filters';
import UpdatesTab from '@/screens/tabs/MesssagingSubTabs/UpdatesTab';
import CallsTab from '@/screens/tabs/MesssagingSubTabs/CallsTab';
import CommunitiesTab from '@/screens/tabs/CommunitiesTab';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
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
import { translateString } from '@/languages';

const Tab = createMaterialTopTabNavigator();
type MessagesScreenProps = {
  onOpenChat: (chat: Chat) => void;
  onOpenInfo?: (payload: { chat: Chat; currentUserId: string | null }) => void;
  appName?: string;
  headerGradient?: readonly string[];
  sheenColor?: string;
};

type LocalQuick = QuickChip;

const getMessagePreviewText = (message: any): string => {
  if (!message) return '';

  const text = typeof message.text === 'string' ? message.text.trim() : '';
  if (text.length) return text;
  if (message?.styledText?.text) return message.styledText.text;
  if (message?.voice) return translateString('Voice message');
  if (message?.sticker) return translateString('Sticker');
  if (Array.isArray(message?.attachments) && message.attachments.length) {
    return translateString(message.attachments.length > 1 ? 'Attachments' : 'Attachment');
  }
  if (Array.isArray(message?.contacts) && message.contacts.length) {
    return translateString('Contact');
  }
  if (message?.poll) return translateString('Poll');
  if (message?.event) return translateString('Event');
  return '';
};

type ConversationMetaEntry = {
  lastMessage?: string;
  lastAt?: string;
  unreadCount?: number;
  lastStatus?: MessageStatus;
  lastMessageFromMe?: boolean;
};

type SearchSectionKey = 'contacts' | 'groups' | 'channels' | 'other' | 'messages';

type GlobalSearchResult = {
  id: string;
  section: SearchSectionKey;
  title: string;
  subtitle?: string;
  icon: string;
  chat?: Chat;
  messageId?: string;
  timestamp?: string;
};

/**
 * Changes in this file focus on animation smoothness & robustness:
 * - Replace timing-based hide/show with a spring and a small state machine to avoid re-trigger thrash
 * - Add velocity-based heuristics when available and clamp spurious small scrolls
 * - Respect Reduced Motion accessibility (disables animations)
 * - Animate the overflow menu (fade + scale) instead of hard-mounting
 * - Avoid repeated setState on layout if height hasn't changed
 */
export default function MessagesScreen({ onOpenChat, onOpenInfo, appName, headerGradient, sheenColor }: MessagesScreenProps) {
  const { palette, tone } = useKISTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const responsive = useResponsiveLayout();
  const isTinyDevice = responsive.isWatch || responsive.isCompactPhone;
  const messageHeaderIconSize = responsive.isWatch ? 30 : responsive.isCompactPhone ? 34 : 38;
  const messageHeaderTitleSize = responsive.isWatch ? 18 : responsive.isCompactPhone ? 20 : 22;
  const messageHeaderSubtitleSize = responsive.isWatch ? 0 : responsive.isCompactPhone ? 10 : 12;
  const messageHeaderPaddingX = responsive.pageGutter;
  const messageFabSize = responsive.isWatch ? 46 : responsive.isCompactPhone ? 50 : 56;
  // Search & menus
  const [query, setQuery] = useState('');
  const [menuVisible, setMenuVisible] = useState(false);
  const [globalSearchResults, setGlobalSearchResults] = useState<GlobalSearchResult[]>([]);
  const [globalSearchLoading, setGlobalSearchLoading] = useState(false);
  const [cameraShareVisible, setCameraShareVisible] = useState(false);
  const [pendingCameraShare, setPendingCameraShare] = useState<AttachmentFilePayload | null>(null);

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
const [conversationsLoading, setConversationsLoading] = useState(true);
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
const conversationMetaRef = useRef<Record<string, ConversationMetaEntry>>({});
const metaRefreshQueue = useRef(new Set<string>());
const metaRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
const metaPersistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

// On mount: restore persisted unread counts into conversationMeta
useEffect(() => {
  AsyncStorage.getItem('KIS_CONV_META_V1').then((raw) => {
    if (!raw) return;
    try {
      const saved: Record<string, number> = JSON.parse(raw);
      setConversationMeta((prev) => {
        if (Object.keys(prev).length > 0) return prev; // don't overwrite fresh server data
        const merged: Record<string, ConversationMetaEntry> = {};
        for (const [convId, unreadCount] of Object.entries(saved)) {
          merged[convId] = { unreadCount };
        }
        return merged;
      });
    } catch { /* silent */ }
  }).catch(() => {});
}, []);

// Keep ref in sync so callbacks can read current meta without stale closures
useEffect(() => {
  conversationMetaRef.current = conversationMeta;
}, [conversationMeta]);

// Debounced persistence of unreadCount whenever conversationMeta changes
useEffect(() => {
  if (metaPersistTimer.current) {
    clearTimeout(metaPersistTimer.current);
  }
  metaPersistTimer.current = setTimeout(() => {
    const toSave: Record<string, number> = {};
    for (const [convId, entry] of Object.entries(conversationMeta)) {
      if (typeof entry.unreadCount === 'number') {
        toSave[convId] = entry.unreadCount;
      }
    }
    AsyncStorage.setItem('KIS_CONV_META_V1', JSON.stringify(toSave)).catch(() => {});
  }, 1500);
  return () => {
    if (metaPersistTimer.current) {
      clearTimeout(metaPersistTimer.current);
    }
  };
}, [conversationMeta]);

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
  // Override server unread counts with local zero-reads — prevents stale server counts
  // from showing after the user has already read those messages in a prior session.
  const meta = conversationMetaRef.current;
  const merged = convs.map(c => {
    const cId = String((c as any).conversationId ?? c.id ?? '');
    const localUnread = meta[cId]?.unreadCount;
    if (typeof localUnread === 'number' && localUnread === 0 && (c.unreadCount ?? 0) > 0) {
      return { ...c, unreadCount: 0 };
    }
    return c;
  });
  setConversations(merged);
  if (force) {
    await loadCommunitiesRef.current();
  }
}, [currentUserId]);

const CONVERSATIONS_CACHE_KEY = 'kis.conversations_cache';

// Load cached conversations on mount before the API call completes
useEffect(() => {
  AsyncStorage.getItem(CONVERSATIONS_CACHE_KEY).then((raw) => {
    if (!raw) return;
    try {
      const cached = JSON.parse(raw) as Chat[];
      if (Array.isArray(cached) && cached.length > 0) {
        setConversations((prev) => (prev.length === 0 ? cached : prev));
      }
    } catch { /* silent */ }
  }).catch(() => {});
}, []);

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
    if (active) {
      // Apply local zero-read overrides so server's stale unread counts don't re-appear
      const meta = conversationMetaRef.current;
      const merged = convs.map(c => {
        const cId = String((c as any).conversationId ?? c.id ?? '');
        const localUnread = meta[cId]?.unreadCount;
        if (typeof localUnread === 'number' && localUnread === 0 && (c.unreadCount ?? 0) > 0) {
          return { ...c, unreadCount: 0 };
        }
        return c;
      });
      setConversations(merged);
      setConversationsLoading(false);
      // Persist fresh list for offline use
      AsyncStorage.setItem(CONVERSATIONS_CACHE_KEY, JSON.stringify(merged)).catch(() => {});
    }
  })().catch(() => {});
  return () => {
    active = false;
  };
}, [currentUserId, query]);

const chatConversationKey = useCallback((chat: Chat | any) => {
  return String(chat?.conversationId ?? chat?.id ?? '');
}, []);

const resultMatches = useCallback((value: unknown, term: string) => {
  return String(value ?? '').toLowerCase().includes(term.toLowerCase());
}, []);

useEffect(() => {
  let active = true;
  const term = query.trim();

  if (term.length < 2) {
    setGlobalSearchResults([]);
    setGlobalSearchLoading(false);
    return () => {
      active = false;
    };
  }

  const timer = setTimeout(async () => {
    setGlobalSearchLoading(true);
    try {
      const [serverConversations, participantRes] = await Promise.all([
        searchConversationsFromServer(term, currentUserId ?? undefined),
        getRequest(`${ROUTES.chat.searchParticipants}?q=${encodeURIComponent(term)}`, {
          errorMessage: 'Unable to search participants.',
        }).catch(() => null),
      ]);

      const byConversationId = new Map<string, Chat>();
      [...conversations, ...serverConversations].forEach((chat: any) => {
        const key = chatConversationKey(chat);
        if (key) byConversationId.set(key, chat);
      });

      const next: GlobalSearchResult[] = [];
      const seen = new Set<string>();
      const pushResult = (result: GlobalSearchResult) => {
        const key = `${result.section}:${result.id}`;
        if (seen.has(key)) return;
        seen.add(key);
        next.push(result);
      };

      const participantItems = Array.isArray(participantRes?.data?.results)
        ? participantRes.data.results
        : Array.isArray(participantRes?.results)
        ? participantRes.results
        : [];

      participantItems.slice(0, 12).forEach((item: any) => {
        const convId = String(item?.conversation_id || '');
        const chat = byConversationId.get(convId);
        const user = item?.user ?? {};
        if (!convId || !chat) return;
        pushResult({
          id: `participant-${convId}-${user?.id || item?.membership_display_name || user?.phone || 'user'}`,
          section: 'contacts',
          title: String(user?.display_name || item?.membership_display_name || user?.phone || chat.name || 'Contact'),
          subtitle: String(user?.phone || chat.name || 'Open chat'),
          icon: 'user',
          chat,
        });
      });

      [...byConversationId.values()].forEach((chat: any) => {
        const name = String(chat?.name || '');
        const lastMessage = String(chat?.lastMessage || conversationMeta?.[chatConversationKey(chat)]?.lastMessage || '');
        const searchable = [name, lastMessage, chat?.title, chat?.description].filter(Boolean).join(' ');
        if (!resultMatches(searchable, term)) return;
        const isDirect = Boolean(chat?.isDirect || chat?.kind === 'direct');
        const isChannel = chat?.kind === 'channel';
        const isCommunity =
          chat?.isCommunityChat ||
          chat?.kind === 'community' ||
          Boolean(chat?.communityId) ||
          Boolean(communityByConversationId?.[chatConversationKey(chat)]);
        const isGroup = Boolean(chat?.isGroup || chat?.isGroupChat || chat?.kind === 'group');
        const section: SearchSectionKey = isDirect
          ? 'contacts'
          : isChannel
          ? 'channels'
          : isCommunity
          ? 'other'
          : isGroup
          ? 'groups'
          : 'other';
        pushResult({
          id: `chat-${chatConversationKey(chat)}`,
          section,
          title: name || 'Chat',
          subtitle: lastMessage || (section === 'contacts' ? 'Contact' : section === 'groups' ? 'Group' : section === 'channels' ? 'Channel' : 'Community'),
          icon: section === 'contacts' ? 'user' : section === 'groups' ? 'group' : section === 'channels' ? 'sub-channel' : 'users',
          chat,
        });
      });

      const messageCandidates = [...byConversationId.values()].slice(0, 80);
      const messageMatches = await Promise.all(
        messageCandidates.map(async (chat: any) => {
          const convId = chatConversationKey(chat);
          if (!convId) return [];
          const messages = await loadMessages(convId).catch(() => []);
          return messages
            .filter((message: any) => {
              const text = String(message?.text ?? message?.styledText?.text ?? '');
              return text.toLowerCase().includes(term.toLowerCase());
            })
            .slice(-3)
            .map((message: any) => ({
              chat,
              message,
              convId,
              text: String(message?.text ?? message?.styledText?.text ?? ''),
            }));
        }),
      );

      messageMatches.flat().slice(0, 18).forEach(({ chat, message, convId, text }) => {
        const messageId = String(message?.serverId ?? message?.id ?? message?.clientId ?? '');
        if (!messageId) return;
        pushResult({
          id: `message-${convId}-${messageId}`,
          section: 'messages',
          title: String(chat?.name || 'Chat'),
          subtitle: text,
          icon: 'chat',
          chat,
          messageId,
          timestamp: message?.createdAt,
        });
      });

      if (active) setGlobalSearchResults(next);
    } finally {
      if (active) setGlobalSearchLoading(false);
    }
  }, 160);

  return () => {
    active = false;
    clearTimeout(timer);
  };
}, [
  chatConversationKey,
  communityByConversationId,
  conversationMeta,
  conversations,
  currentUserId,
  query,
  resultMatches,
]);

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
    const rawSenderId =
      payload?.senderId ??
      payload?.sender_id ??
      payload?.sender?.id ??
      payload?.userId ??
      payload?.user_id;
    const senderId = rawSenderId != null ? String(rawSenderId) : '';
    const isFromMe = senderId.length > 0 && senderId === String(currentUserId);
    const previewText =
      payload?.text ??
      payload?.previewText ??
      payload?.preview_text ??
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

    setConversations((prev) => {
      const exists = prev.some((item: any) => {
        const existingId = item?.conversation_id ?? item?.conversationId ?? item?.id;
        return String(existingId ?? '') === convId;
      });
      if (exists) {
        return prev.map((item: any) => {
          const existingId = item?.conversation_id ?? item?.conversationId ?? item?.id;
          if (String(existingId ?? '') !== convId) return item;
          return {
            ...item,
            last_message_preview: previewText,
            lastMessage: previewText,
            last_message_at: lastAt,
            lastAt,
            updated_at: lastAt,
          };
        });
      }

      const fallbackName =
        payload?.senderName ??
        payload?.sender_name ??
        payload?.sender?.display_name ??
        payload?.sender?.username ??
        payload?.sender?.phone ??
        'Direct chat';

      if (__DEV__) console.log('[MessagesScreen] realtime conversation upsert', {
        conversationId: convId,
        senderId,
        isFromMe,
        fallbackName,
      });

      return [
        {
          id: convId,
          conversationId: convId,
          conversation_id: convId,
          type: 'direct',
          kind: 'direct',
          title: fallbackName,
          name: fallbackName,
          last_message_preview: previewText,
          lastMessage: previewText,
          last_message_at: lastAt,
          lastAt,
          created_at: lastAt,
          updated_at: lastAt,
          unread_count: isFromMe ? 0 : 1,
          unreadCount: isFromMe ? 0 : 1,
          read_state_authoritative: false,
          participants: senderId
            ? [
                {
                  id: `member-${senderId}`,
                  user: {
                    id: senderId,
                    display_name: fallbackName,
                    username: fallbackName,
                  },
                },
              ]
            : [],
        },
        ...prev,
      ];
    });

    try {
      const mapped = mapBackendToChatMessage(
        payload,
        String(currentUserId ?? ''),
        convId,
      );
      upsertMessage(convId, mapped).catch(() => {});
    } catch (err: any) {
      console.warn('[MessagesScreen] failed to map/upsert incoming message', err?.message);
    }

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
          String(payload?.senderId ?? payload?.sender_id ?? payload?.sender?.id ?? ''),
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
  const onConversationUpdated = (payload: any) => {
    const convId = String(payload?.conversationId ?? payload?.conversation_id ?? '');
    if (!convId) return;

    // Apply preview/timestamp immediately from the payload so the list updates
    // before the network refresh completes — avoids a blank/stale row.
    const preview = payload?.preview ?? payload?.previewText ?? payload?.preview_text;
    const lastAt = payload?.lastMessageAt ?? payload?.last_message_at ?? new Date().toISOString();
    const senderId = payload?.senderId ? String(payload.senderId) : '';
    const isFromMe = senderId.length > 0 && senderId === String(currentUserId);

    if (preview !== undefined) {
      setConversationMeta((prev) => {
        const prevUnread = prev[convId]?.unreadCount ?? 0;
        return {
          ...prev,
          [convId]: {
            ...prev[convId],
            lastMessage: preview,
            lastAt,
            unreadCount: isFromMe ? prevUnread : prevUnread + 1,
            lastMessageFromMe: isFromMe,
          },
        };
      });

      setConversations((prev) =>
        prev.map((item: any) => {
          const id = String(item?.conversation_id ?? item?.conversationId ?? item?.id ?? '');
          if (id !== convId) return item;
          return {
            ...item,
            last_message_preview: preview,
            lastMessage: preview,
            last_message_at: lastAt,
            lastAt,
            updated_at: lastAt,
          };
        }),
      );
    }

    queueMetaRefresh(convId);
    refreshConversations(true).catch(() => {});
  };
  socket.on('chat.message', onMessage);
  socket.on('conversation.updated', onConversationUpdated);
  socket.on('conversation.created', onConversationUpdated);
  return () => {
    socket.off('chat.message', onMessage);
    socket.off('conversation.updated', onConversationUpdated);
    socket.off('conversation.created', onConversationUpdated);
  };
}, [socket, isConnected, currentUserId, queueMetaRefresh, setConversations, setConversationMeta, refreshConversations]);

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
const selectedConversationIds = useMemo(
  () =>
    selectedChat
      .map(chat => String((chat as any).conversationId ?? chat.id ?? ''))
      .filter(Boolean),
  [selectedChat],
);

const conversationActionUrl = useCallback(
  (conversationId: string, action: 'pin' | 'mute' | 'archive' | 'delete-for-me' | 'mark-read') =>
    `${ROUTES.chat.listConversations}${conversationId}/${action}/`,
  [],
);

const handleClearSelection = useCallback(() => {
  setSelectedChat([]);
  setSelectMode(false);
  setMenuVisible(false);
}, []);

const handleOpenChat = useCallback((chat: Chat) => {
  const convId = String((chat as any).conversationId ?? chat.id ?? '');
  if (convId) {
    setConversationMeta(prev => ({
      ...prev,
      [convId]: { ...prev[convId], unreadCount: 0 },
    }));
    setConversations(prev => {
      const updated = prev.map(c => {
        const cId = String((c as any).conversationId ?? c.id ?? '');
        return cId === convId ? { ...c, unreadCount: 0 } : c;
      });
      // Persist immediately so the cache has unreadCount:0 on next reload
      AsyncStorage.setItem(CONVERSATIONS_CACHE_KEY, JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  }
  onOpenChat(chat);
}, [onOpenChat]);

const updateSelectedConversations = useCallback(
  (updater: (chat: Chat) => Chat | null) => {
    const selectedIds = new Set(selectedConversationIds);
    setConversations(prev =>
      prev
        .map(chat => {
          const id = String((chat as any).conversationId ?? chat.id ?? '');
          return selectedIds.has(id) ? updater(chat) : chat;
        })
        .filter(Boolean) as Chat[],
    );
  },
  [selectedConversationIds],
);

const handleDeleteSelected = useCallback(() => {
  if (!selectedConversationIds.length) return;
  const count = selectedConversationIds.length;
  Alert.alert(
    count === 1 ? 'Delete chat?' : `Delete ${count} chats?`,
    'This removes the selected chats from this device list. It does not delete messages for the other person.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          updateSelectedConversations(() => null);
          setConversationMeta(prev => {
            const next = { ...prev };
            selectedConversationIds.forEach(id => {
              delete next[id];
            });
            return next;
          });
          void Promise.allSettled(
            selectedConversationIds.map(conversationId =>
              postRequest(conversationActionUrl(conversationId, 'delete-for-me'), {}),
            ),
          );
          handleClearSelection();
        },
      },
    ],
  );
}, [conversationActionUrl, handleClearSelection, selectedConversationIds, updateSelectedConversations]);

const handlePinSelected = useCallback(() => {
  if (!selectedConversationIds.length) return;
  const shouldPin = selectedChat.some(chat => !(chat as any).isPinned);
  updateSelectedConversations(chat => ({ ...chat, isPinned: shouldPin } as Chat));
  void Promise.allSettled(
    selectedConversationIds.map(conversationId =>
      postRequest(conversationActionUrl(conversationId, 'pin'), { pinned: shouldPin }),
    ),
  );
  handleClearSelection();
}, [conversationActionUrl, handleClearSelection, selectedChat, selectedConversationIds, updateSelectedConversations]);

const handleMuteSelected = useCallback(() => {
  if (!selectedConversationIds.length) return;
  const shouldMute = selectedChat.some(chat => !chat.isMuted);
  updateSelectedConversations(chat => ({ ...chat, isMuted: shouldMute }));
  void Promise.allSettled(
    selectedConversationIds.map(conversationId =>
      postRequest(conversationActionUrl(conversationId, 'mute'), { muted: shouldMute }),
    ),
  );
  handleClearSelection();
}, [conversationActionUrl, handleClearSelection, selectedChat, selectedConversationIds, updateSelectedConversations]);

const handleArchiveSelected = useCallback(() => {
  if (!selectedConversationIds.length) return;
  const shouldArchive = selectedChat.some(chat => !chat.isArchived);
  updateSelectedConversations(chat => ({ ...chat, isArchived: shouldArchive }));
  void Promise.allSettled(
    selectedConversationIds.map(conversationId =>
      postRequest(conversationActionUrl(conversationId, 'archive'), { archived: shouldArchive }),
    ),
  );
  handleClearSelection();
}, [conversationActionUrl, handleClearSelection, selectedChat, selectedConversationIds, updateSelectedConversations]);

const handleMarkReadSelected = useCallback(() => {
  if (!selectedConversationIds.length) return;
  updateSelectedConversations(chat => ({ ...chat, unreadCount: 0 }));
  setConversationMeta(prev => {
    const next = { ...prev };
    selectedConversationIds.forEach(id => {
      if (next[id]) next[id] = { ...next[id], unreadCount: 0 };
    });
    return next;
  });
  void Promise.allSettled(
    selectedConversationIds.map(conversationId =>
      postRequest(conversationActionUrl(conversationId, 'mark-read'), {}),
    ),
  );
  handleClearSelection();
}, [conversationActionUrl, handleClearSelection, selectedConversationIds, updateSelectedConversations]);

const handleSelectAllChats = useCallback(() => {
  setSelectedChat(conversations.filter(chat => chat.kind !== 'channel'));
  setMenuVisible(false);
}, [conversations]);



  const [addVisible, setAddVisible] = useState(false);
  const [addInitialMode, setAddInitialMode] = useState<'list' | 'addGroup' | 'addChannel' | undefined>(undefined);
  const addSlide = useRef(new Animated.Value(0)).current; // 0 = off-screen, 1 = on-screen

  const openAddContacts = useCallback((initialMode?: 'list' | 'addGroup' | 'addChannel') => {
    setAddInitialMode(initialMode);
    setAddVisible(true);
    Animated.timing(addSlide, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [addSlide]);

  
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

  const closeAddContacts = useCallback(() => {
    Animated.timing(addSlide, {
      toValue: 0,
      duration: 260,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start(() => {
      setAddVisible(false);
      setAddInitialMode(undefined);
    });
  }, [addSlide]);

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
      animationRef.current = Animated.spring(hideProgress, {
        toValue,
        tension: 120,
        friction: 18,
        useNativeDriver: false, // layout margins cannot use native driver
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
  const [activeTopTab, setActiveTopTab] = useState<'Chats' | 'Updates' | 'Calls' | 'Communities'>('Chats');
  const [tabSearchOpen, setTabSearchOpen] = useState(false);
  const [tabSearchQuery, setTabSearchQuery] = useState('');

  const AnimatedTopBar = (tabProps: any) => {
    const nextTab = tabProps?.state?.routes?.[tabProps.state.index]?.name;
    useEffect(() => {
      if (nextTab === 'Chats' || nextTab === 'Updates' || nextTab === 'Calls' || nextTab === 'Communities') {
        setActiveTopTab(nextTab);
      }
    }, [nextTab]);
    return (
      <Animated.View
        onLayout={(e) => onTabLayout(e.nativeEvent.layout.height)}
        style={{
          transform: [{ translateY: translateTabY }],
          marginBottom: tabNegMargin, // collapse layout space while hidden
          backgroundColor: messageTopPanelBg,
          borderBottomWidth: 0,
          borderBottomColor: 'transparent',
          overflow: 'hidden',
        }}
      >
        <MaterialTopTabBar
          {...tabProps}
          style={{ backgroundColor: messageTopPanelBg, elevation: 0 }}
          indicatorStyle={{ backgroundColor: palette.goldLight, height: 3, borderRadius: 3 }}
          labelStyle={{ fontWeight: '700', textTransform: 'none', fontSize: responsive.isWatch ? 11 : responsive.isCompactPhone ? 12 : 14 }}
          activeTintColor={palette.ivory}
          inactiveTintColor={palette.goldSoft}
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
    if (activeTopTab === 'Communities') {
      return [
        { key: 'new-community', label: 'New community' },
        { key: 'discover-communities', label: 'Discover communities' },
      ];
    }
    return [
      { key: 'new-chat', label: 'New chat' },
      { key: 'new-group', label: 'New group' },
      { key: 'settings', label: 'Settings' },
    ];
  }, [activeTopTab]);

  const handleNormalMenuAction = useCallback((key: string) => {
    setMenuVisible(false);
    switch (key) {
      case 'new-chat':
      case 'new-call':
        openAddContacts('list');
        return;
      case 'new-group':
        openAddContacts('addGroup');
        return;
      case 'new-channel':
        openAddContacts('addChannel');
        return;
      case 'new-status':
        tabRef.current?.navigate?.('Updates');
        DeviceEventEmitter.emit('status.create');
        return;
      case 'call-history':
        tabRef.current?.navigate?.('Calls');
        return;
      case 'new-community':
        DeviceEventEmitter.emit('community.create');
        return;
      case 'discover-communities':
        DeviceEventEmitter.emit('community.discover');
        return;
      case 'updates-settings':
      case 'calls-settings':
      case 'settings':
        setFilterMgrOpen(true);
        return;
      default:
        return;
    }
  }, [openAddContacts]);

  const handleHeaderCameraPress = useCallback(() => {
    if (activeTopTab === 'Chats') {
      setMenuVisible(false);
      setCameraShareVisible(true);
      return;
    }
    if (activeTopTab === 'Communities') {
      DeviceEventEmitter.emit('community.discover');
      return;
    }
    setTabSearchOpen(true);
  }, [activeTopTab]);

  const handleCameraShareCapture = useCallback((payload: AttachmentFilePayload) => {
    setCameraShareVisible(false);
    setPendingCameraShare(payload);
    openAddContacts('list');
  }, [openAddContacts]);

const handleOpenChatFromAddContacts = useCallback((chat: Chat) => {
    onOpenChat(chat);
    if (pendingCameraShare) {
      const targetId = String((chat as any).conversationId ?? chat.id ?? '');
      const sharePayload = pendingCameraShare;
      setPendingCameraShare(null);
      closeAddContacts();
      setTimeout(() => {
        DeviceEventEmitter.emit('chat.sendPendingAttachment', {
          targetId,
          attachment: sharePayload,
        });
      }, 450);
    }
  }, [closeAddContacts, onOpenChat, pendingCameraShare]);

  const groupedSearchResults = useMemo(() => {
    const order: SearchSectionKey[] = ['contacts', 'groups', 'channels', 'other', 'messages'];
    return order
      .map((section) => ({
        section,
        title:
          section === 'contacts'
            ? 'Contacts'
            : section === 'groups'
            ? 'Groups'
            : section === 'channels'
            ? 'Channels'
            : section === 'other'
            ? 'Other'
            : 'Messages',
        items: globalSearchResults.filter((item) => item.section === section).slice(0, section === 'messages' ? 12 : 8),
      }))
      .filter((group) => group.items.length > 0);
  }, [globalSearchResults]);

  const handleSearchResultPress = useCallback(
    (result: GlobalSearchResult) => {
      if (!result.chat) return;
      setMenuVisible(false);
      setQuery('');
      setGlobalSearchResults([]);
      const chat = result.messageId
        ? ({
            ...result.chat,
            initialTargetMessageId: result.messageId,
          } as Chat)
        : result.chat;
      handleOpenChat(chat);
    },
    [handleOpenChat],
  );

  useEffect(() => {
    if (activeTopTab === 'Chats' || activeTopTab === 'Communities') {
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

  const messageTopPanelBg = tone === 'dark' ? '#5E3B0A' : '#6B4334';
  const messageGoldGradient: readonly string[] = headerGradient ?? (
    tone === 'dark'
      ? ['#3B271E', '#6F4515', '#B9852E', '#56321F']
      : ['#4B2F2A', '#8A5A12', '#D9A875', '#6B4334']
  );
  return (
    <View style={[styles.wrap, { backgroundColor: tone === 'dark' ? palette.bg : '#FFFFFF' }]}>
      <LinearGradient
        colors={messageGoldGradient as string[]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.messageGoldPanel}
      >
        {/* Luxury shimmer line at the very top of the panel */}
        <View
          style={[styles.messageGoldSheen, sheenColor ? { backgroundColor: sheenColor } : undefined]}
          pointerEvents="none"
        />

      {/* ------------ Top App Bar ------------ */}
        {selectMode ? (
          <View
            style={[
              styles.appBar,
              styles.royalAppBar,
              {
                backgroundColor: 'transparent',
                borderBottomColor: 'transparent',
                paddingTop: insets.top + 14,
              },
            ]}
          >
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <Pressable
                onPress={handleClearSelection}
                hitSlop={10}
                style={({ pressed }) => [
                  {
                    width: messageHeaderIconSize,
                    height: messageHeaderIconSize,
                    borderRadius: messageHeaderIconSize / 2,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(255,255,255,0.13)',
                    borderWidth: 1,
                    borderColor: 'rgba(255,244,184,0.30)',
                    opacity: pressed ? KIS_TOKENS.opacity.pressed : 1,
                  },
                ]}
              >
                <KISIcon name="arrow-left" size={20} color={palette.ivory} />
              </Pressable>

              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={{
                    color: palette.ivory,
                    fontSize: responsive.isWatch ? 15 : 18,
                    fontWeight: '900',
                    letterSpacing: 0.2,
                  }}
                  numberOfLines={1}
                >
                  {selectCount ?? selectedChat.length} selected
                </Text>
                <Text
                  style={{
                    color: '#FFF4B8',
                    fontSize: responsive.isWatch ? 0 : 11,
                    fontWeight: '800',
                    marginTop: 2,
                  }}
                  numberOfLines={1}
                >
                  Manage chats
                </Text>
              </View>
            </View>

            <View style={[styles.appBarRight, isTinyDevice && { gap: 4 }]}>
              {[
                { key: 'archive', icon: 'download', onPress: handleArchiveSelected },
                { key: 'pin', icon: 'pin', onPress: handlePinSelected },
                { key: 'mute', icon: 'mute', onPress: handleMuteSelected },
                { key: 'delete', icon: 'trash', onPress: handleDeleteSelected },
              ].map(action => (
                <Pressable
                  key={action.key}
                  onPress={action.onPress}
                  hitSlop={8}
                  style={({ pressed }) => [
                    {
                      width: responsive.isWatch ? 30 : 36,
                      height: responsive.isWatch ? 30 : 36,
                      borderRadius: responsive.isWatch ? 15 : 18,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: 'rgba(255,255,255,0.13)',
                      borderWidth: 1,
                      borderColor: 'rgba(255,244,184,0.26)',
                      opacity: pressed ? KIS_TOKENS.opacity.pressed : 1,
                    },
                  ]}
                >
                  <KISIcon name={action.icon as any} size={18} color={palette.ivory} />
                </Pressable>
              ))}

              <Pressable
                onPress={() => setMenuVisible((v) => !v)}
                hitSlop={8}
                style={({ pressed }) => [
                  {
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(255,255,255,0.13)',
                    borderWidth: 1,
                    borderColor: 'rgba(255,244,184,0.26)',
                    opacity: pressed ? KIS_TOKENS.opacity.pressed : 1,
                  },
                ]}
              >
                <KISIcon name="menu" size={18} color={palette.ivory} />
              </Pressable>
            </View>

          </View>
        ) : (
          <View
            style={[
              styles.appBar,
              styles.royalAppBar,
              {
                backgroundColor: 'transparent',
                borderBottomColor: 'transparent',
                paddingTop: insets.top + 14,
              },
            ]}
          >
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <View
                style={{
                  width: responsive.isWatch ? 34 : responsive.isCompactPhone ? 38 : 42,
                  height: responsive.isWatch ? 34 : responsive.isCompactPhone ? 38 : 42,
                  borderRadius: responsive.isWatch ? 14 : 18,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(255,255,255,0.14)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,244,184,0.30)',
                }}
              >
                <Text style={{ color: palette.ivory, fontSize: responsive.isWatch ? 15 : 18, fontWeight: '900' }}>
                  {appName ? appName[0].toUpperCase() : 'K'}
                </Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={{
                    color: palette.ivory,
                    fontSize: messageHeaderTitleSize,
                    fontWeight: '900',
                    letterSpacing: 0.3,
                  }}
                  numberOfLines={1}
                >
                  {appName ?? 'KIS'}
                </Text>
                {!appName && messageHeaderSubtitleSize > 0 && (
                  <Text
                    style={{
                      color: '#FFF4B8',
                      marginTop: 2,
                      fontSize: messageHeaderSubtitleSize,
                      fontWeight: '800',
                      letterSpacing: 0.2,
                    }}
                    numberOfLines={1}
                  >
                    Kingdom Impact Social
                  </Text>
                )}
              </View>
            </View>

            <View style={[styles.appBarRight, isTinyDevice && { gap: 4 }]}>
              {[
                {
                  key: 'camera-search',
                  icon: activeTopTab === 'Chats' ? 'camera' : activeTopTab === 'Communities' ? 'globe' : 'search',
                  onPress: handleHeaderCameraPress,
                },
                { key: 'menu', icon: 'menu', onPress: () => setMenuVisible((v) => !v) },
              ].map(action => (
                <Pressable
                  key={action.key}
                  onPress={action.onPress}
                  hitSlop={8}
                  style={({ pressed }) => [
                    {
                      width: messageHeaderIconSize,
                      height: messageHeaderIconSize,
                      borderRadius: messageHeaderIconSize / 2,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: 'rgba(255,255,255,0.13)',
                      borderWidth: 1,
                      borderColor: 'rgba(255,244,184,0.26)',
                      opacity: pressed ? KIS_TOKENS.opacity.pressed : 1,
                    },
                  ]}
                >
                  <KISIcon name={action.icon as any} size={18} color={palette.ivory} />
                </Pressable>
              ))}
            </View>

          </View>

        )}


      <Modal
        visible={menuVisible}
        transparent
        animationType="none"
        onRequestClose={() => setMenuVisible(false)}
      >
      <View
        pointerEvents="auto"
        style={StyleSheet.absoluteFillObject}
      >
        <Pressable
          onPress={() => setMenuVisible(false)}
          style={[styles.menuOverlay, { opacity: menuVisible ? 1 : 0 }]}
        />
        <Animated.View
          style={[
            styles.menuBox,
            {
              position: 'absolute',
              right: messageHeaderPaddingX,
              top: insets.top + (isTinyDevice ? 52 : 62),
              borderColor: palette.gold,
              backgroundColor: palette.card,
              shadowColor: palette.shadow,
            },
            KIS_TOKENS.elevation.popover,
            menuStyle,
          ]}
        >
          {(selectedChat.length > 0
            ? [
                { key: 'select-all', label: 'Select all', onPress: handleSelectAllChats },
                { key: 'mark-read', label: 'Mark as read', onPress: handleMarkReadSelected },
                { key: 'archive', label: 'Archive', onPress: handleArchiveSelected },
              ]
            : menuItems.map((m) => ({
                ...m,
                onPress: () => handleNormalMenuAction(m.key),
              }))
          ).map((m) => (
            <Pressable
              key={m.key}
              onPress={() => {
                setMenuVisible(false);
                m.onPress();
              }}
              style={({ pressed }) => [
                styles.menuItem,
                { backgroundColor: pressed ? palette.goldSoft : 'transparent' },
              ]}
            >
              <Text style={{ color: palette.text, fontSize: 14, fontWeight: '700' }}>
                {m.label}
              </Text>
            </Pressable>
          ))}
        </Animated.View>
      </View>
      </Modal>


      {/* ------------ Animated Elevated Search Bar + Filters ------------ */}
      {(
        <Animated.View
          onLayout={onHeaderLayout}
          style={{
            transform: [{ translateY: translateHeaderY }],
            marginBottom: headerNegMargin, // collapse space so list moves up
            paddingHorizontal: messageHeaderPaddingX,
            paddingTop: 4,
            paddingBottom: 8,
            marginTop: -1,
            zIndex: 1,
            backgroundColor: 'transparent',
            borderTopWidth: 0,
            borderBottomLeftRadius: 24,
            borderBottomRightRadius: 24,
            overflow: 'hidden',
          }}
        >
          <View
            style={[
              styles.searchContainer,
              {
                borderColor: palette.goldMuted,
                backgroundColor: palette.card,
                shadowColor: 'transparent',
              },
            ]}
          >
            <KISIcon name="search" size={18} color={palette.text} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={
                activeTopTab === 'Updates'
                  ? 'Search updates, channels, and messages…'
                  : activeTopTab === 'Calls'
                  ? 'Search calls, contacts, and messages…'
                  : activeTopTab === 'Communities'
                  ? 'Search communities…'
                  : 'Search chats, people, groups, and messages…'
              }
              placeholderTextColor={palette.subtext}
              style={[styles.searchInput, { color: palette.text }]}
            />
            <Pressable onPress={() => setQuery('')} style={styles.searchIconBtn}>
              <KISIcon name={query.trim() ? 'close' : 'mic'} size={18} color={palette.text} />
            </Pressable>
            <View style={[styles.searchDivider, { backgroundColor: palette.inputBorder }]} />
            <Pressable onPress={() => setFilterMgrOpen(true)} style={styles.searchIconBtn} hitSlop={8}>
              <KISIcon name="settings" size={18} color={palette.text} />
            </Pressable>
          </View>

          {query.trim().length >= 2 ? (
            <View
              style={[
                localSearchStyles.resultsCard,
                {
                  backgroundColor: palette.card,
                  borderColor: palette.goldMuted,
                  shadowColor: palette.shadow,
                },
                KIS_TOKENS.elevation.popover,
              ]}
            >
              {globalSearchLoading ? (
                <Text style={[localSearchStyles.resultEmpty, { color: palette.subtext }]}>
                  Searching...
                </Text>
              ) : groupedSearchResults.length ? (
                groupedSearchResults.map((group) => (
                  <View key={group.section} style={localSearchStyles.resultGroup}>
                    <Text style={[localSearchStyles.resultSectionTitle, { color: palette.subtext }]}>
                      {group.title}
                    </Text>
                    {group.items.map((item) => (
                      <Pressable
                        key={item.id}
                        onPress={() => handleSearchResultPress(item)}
                        style={({ pressed }) => [
                          localSearchStyles.resultRow,
                          { backgroundColor: pressed ? palette.surface : 'transparent' },
                        ]}
                      >
                        <View style={[localSearchStyles.resultIcon, { backgroundColor: palette.primarySoft }]}>
                          <KISIcon name={item.icon as any} size={17} color={palette.primaryStrong} />
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={[localSearchStyles.resultTitle, { color: palette.text }]} numberOfLines={1}>
                            {item.title}
                          </Text>
                          {item.subtitle ? (
                            <Text style={[localSearchStyles.resultSubtitle, { color: palette.subtext }]} numberOfLines={1}>
                              {item.subtitle}
                            </Text>
                          ) : null}
                        </View>
                      </Pressable>
                    ))}
                  </View>
                ))
              ) : (
                <Text style={[localSearchStyles.resultEmpty, { color: palette.subtext }]}>
                  No matching chats, contacts, channels, or messages.
                </Text>
              )}
            </View>
          ) : null}

          {/* Quick chips + Custom filter row */}
          {activeTopTab === 'Chats' ? <View style={styles.chipsRow}>
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
          </View> : null}
        </Animated.View>
      )}
      </LinearGradient>

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
      <View style={{ flex: 1, backgroundColor: tone === 'dark' ? palette.bg : '#FFFFFF' }}>
        <Tab.Navigator
          {...({ ref: tabRef } as any)}
          tabBar={(props) => <AnimatedTopBar {...props} />}
          screenOptions={{
            swipeEnabled: true,
            tabBarScrollEnabled: false,
            tabBarIndicatorStyle: {
              backgroundColor: palette.goldDeep,
              height: 3,
              borderRadius: 3,
            },
          }}
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
                onOpenChat={handleOpenChat}
                selectedChat={selectedChat}
                setSelectedChat={setSelectedChat}
                conversations={conversations}
                loading={conversationsLoading}
              />
            )}
          />
          <Tab.Screen
            name="Updates"
            children={() => (
              <UpdatesTab searchTerm={query} onOpenChat={onOpenChat} />
            )}
          />
          <Tab.Screen
            name="Calls"
            children={() => <CallsTab searchTerm={query} />}
          />
          <Tab.Screen
            name="Communities"
            children={() => (
              <CommunitiesTab onOpenChat={onOpenChat} />
            )}
          />
        </Tab.Navigator>

        {/* 🔵 Suspended "Add" button (FAB) */}
        {activeTopTab === 'Chats' ? (
          <Pressable
            onPress={() => openAddContacts('list')}
            style={({ pressed }) => [
              {
                position: 'absolute',
                right: responsive.pageGutter,
                bottom: (responsive.isWatch ? 10 : 16) + 64, // 64-ish to sit above bottom tab bar
                width: messageFabSize,
                height: messageFabSize,
                borderRadius: messageFabSize / 2,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: palette.goldDeep,
                shadowColor: palette.goldDeep,
                shadowOpacity: 0.34,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 5 },
                elevation: 7,
                overflow: 'hidden',
              },
              pressed && { opacity: KIS_TOKENS.opacity.pressed },
            ]}
          >
            <LinearGradient
              colors={messageGoldGradient as string[]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: -8,
                bottom: -8,
                left: 6,
                width: 16,
                backgroundColor: 'rgba(255,255,255,0.18)',
                transform: [{ rotate: '-18deg' }],
              }}
            />
            <KISIcon name="add" size={24} color={palette.ivory ?? '#fff'} />
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

      <CameraCaptureModal
        visible={cameraShareVisible}
        palette={palette}
        onClose={() => setCameraShareVisible(false)}
        onCapture={handleCameraShareCapture}
      />

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
            onOpenChat={onOpenChat}
            initialTargetMessageId={(activeChat as any)?.initialTargetMessageId ?? null}
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
          <AddContactsPage onOpenChat={handleOpenChatFromAddContacts} onClose={closeAddContacts} initialMode={addInitialMode} />
        </Animated.View>
      )}
    </View>
  )
  
  
}

const localSearchStyles = StyleSheet.create({
  resultsCard: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 18,
    overflow: 'hidden',
    maxHeight: 390,
  },
  resultGroup: {
    paddingVertical: 6,
  },
  resultSectionTitle: {
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 4,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  resultIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  resultSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  resultEmpty: {
    padding: 14,
    fontSize: 13,
    fontWeight: '700',
  },
});
