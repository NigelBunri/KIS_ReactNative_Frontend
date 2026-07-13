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
import ReAnimated, { useSharedValue, withTiming } from 'react-native-reanimated';
import { useGoldenSectionContent } from '@/contexts/GoldenSectionContext';
import { useCollapsingGoldHeader } from '@/hooks/useCollapsingGoldHeader';
import { useHeaderDragToScroll, type ScrollableHandle } from '@/hooks/useHeaderDragToScroll';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRawTopInset } from '@/hooks/useSafeTopInset';
import {
  createMaterialTopTabNavigator,
  MaterialTopTabBar,
} from '@react-navigation/material-top-tabs';
import { useKISTheme } from '../../theme/useTheme';
import { KIS_ROYAL_GRADIENTS, KIS_TOKENS } from '../../theme/constants';
import { useStatusBarStyle } from '../../theme/useStatusBarStyle';
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
import MessagesOfflineCard from '@/screens/tabs/MesssagingSubTabs/MessagesOfflineCard';
import NetInfo from '@react-native-community/netinfo';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { enqueueMutation, flushPendingMutations } from '@/services/pendingMutationsQueue';
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
import { normalizeChatDisplayText, resolveChatPreviewText } from '@/Module/ChatRoom/safeChatText';
import { getCurrentAuthUserId } from '@/storage/userScopedProfileCache';

const Tab = createMaterialTopTabNavigator();
type MessagesScreenProps = {
  onOpenChat: (chat: Chat) => void;
  onOpenInfo?: (payload: { chat: Chat; currentUserId: string | null }) => void;
  appName?: string;
  headerGradient?: readonly string[];
  sheenColor?: string;
};

type LocalQuick = QuickChip;

const isEncryptedPreviewPlaceholder = (value: unknown): boolean => {
  return typeof value === 'string' && value.trim().toLowerCase() === 'encrypted message';
};

const resolveConversationPreview = (
  candidate: unknown,
  previous?: string,
  fallback = '',
): string => resolveChatPreviewText(candidate, previous, fallback);

const getMessagePreviewText = (message: any): string => {
  if (!message) return '';

  const text = normalizeChatDisplayText(message.text).trim();
  if (text.length && !isEncryptedPreviewPlaceholder(text)) return text;
  const styled = normalizeChatDisplayText(message?.styledText?.text).trim();
  if (styled.length) return styled;
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
export default function MessagesScreen({ onOpenChat, onOpenInfo, appName, headerGradient, sheenColor: _sheenColor }: MessagesScreenProps) {
  const { palette, tone } = useKISTheme();
  const insets = useSafeAreaInsets();
  // Opts out of the app-wide GLOBAL_TOP_PADDING dial (useSafeTopInset) — this
  // is one of the 5 main-tab gold-header screens with its own hand-tuned
  // spacing, so it reads the raw (corrected) device inset instead.
  const topInset = useRawTopInset();
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
const { socket, isConnected, typingByConversation, currentUserId, presenceByUser, startCall } = useSocket();
const [authCacheUserId, setAuthCacheUserId] = useState<string | null>(null);
const effectiveCurrentUserId = currentUserId || authCacheUserId || null;
const [statusByUserId, _setStatusByUserId] = useState<Record<string, { hasStatus: boolean; hasUnseen: boolean }>>({});
const [avatarPreview, setAvatarPreview] = useState<{ uri: string; chat?: Chat; userId?: string | null } | null>(null);
const [avatarPreviewFull, setAvatarPreviewFull] = useState(false);
const [isOffline, setIsOffline] = useState(false);
const avatarAnim = useRef(new Animated.Value(0)).current;
const tabRef = useRef<any>(null);
const loadCommunitiesRef = useRef<() => void | Promise<void>>(() => {});
const userScopedCacheKey = useCallback(
  (baseKey: string) => {
    const userId = effectiveCurrentUserId ? String(effectiveCurrentUserId).trim() : '';
    return userId ? `${baseKey}:${userId}` : null;
  },
  [effectiveCurrentUserId],
);

const mountedRef = useRef(true);
const conversationsRef = useRef<Chat[]>([]);
const conversationMetaRef = useRef<Record<string, ConversationMetaEntry>>({});
const metaRefreshQueue = useRef(new Set<string>());
const metaRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
const metaPersistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

useEffect(() => {
  let active = true;
  getCurrentAuthUserId()
    .then(userId => {
      if (active) setAuthCacheUserId(userId);
    })
    .catch(() => {});
  return () => {
    active = false;
  };
}, [effectiveCurrentUserId]);

// On mount: restore persisted unread counts into conversationMeta
useEffect(() => {
  const cacheKey = userScopedCacheKey('KIS_CONV_META_V1');
  if (!cacheKey) return;
  AsyncStorage.getItem(cacheKey).then((raw) => {
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
}, [userScopedCacheKey]);

// Keep ref in sync so callbacks can read current meta without stale closures
useEffect(() => {
  conversationMetaRef.current = conversationMeta;
}, [conversationMeta, userScopedCacheKey]);

useEffect(() => {
  conversationsRef.current = conversations;
}, [conversations]);

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
    const cacheKey = userScopedCacheKey('KIS_CONV_META_V1');
    if (cacheKey) {
      AsyncStorage.setItem(cacheKey, JSON.stringify(toSave)).catch(() => {});
    }
  }, 1500);
  return () => {
    if (metaPersistTimer.current) {
      clearTimeout(metaPersistTimer.current);
    }
  };
}, [conversationMeta, userScopedCacheKey]);

useEffect(() => {
  return () => {
    mountedRef.current = false;
    if (metaRefreshTimer.current) {
      clearTimeout(metaRefreshTimer.current);
      metaRefreshTimer.current = null;
    }
  };
}, [userScopedCacheKey]);

const refreshConversationMeta = useCallback(
  async (convId: string) => {
    if (!convId) return;
    try {
      const messages = await loadMessages(convId, effectiveCurrentUserId);
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
      const rawPreview = resolveChatPreviewText(last);
      const unread = messages.filter((m) => !m.fromMe && m.status !== 'read').length;
      setConversationMeta((prev) => ({
        ...prev,
        [convId]: {
          lastMessage: resolveConversationPreview(rawPreview, prev[convId]?.lastMessage),
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
  [effectiveCurrentUserId],
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
      (id) => String(id) !== String(effectiveCurrentUserId ?? ''),
    );

    await startCall({
      conversationId,
      title: chat.name ?? 'Call',
      media,
      inviteeUserIds,
    });
  },
  [startCall, effectiveCurrentUserId],
);

const refreshConversations = useCallback(async (force?: boolean) => {
  const currentList = conversationsRef.current;
  const convs = await fetchConversationsForCurrentUser(currentList, effectiveCurrentUserId ?? undefined, !!force);
  if (convs.length === 0 && currentList.length > 0) return;
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
}, [effectiveCurrentUserId]);

const CONVERSATIONS_CACHE_KEY = 'kis.conversations_cache';

// Load cached conversations on mount before the API call completes
useEffect(() => {
  let active = true;
  const cacheKey = userScopedCacheKey(CONVERSATIONS_CACHE_KEY);
  if (!cacheKey) return;
  AsyncStorage.getItem(cacheKey).then(async (raw) => {
    try {
      const cached = raw ? JSON.parse(raw) as Chat[] : [];
      if (Array.isArray(cached) && cached.length > 0) {
        if (active) setConversations((prev) => (prev.length === 0 ? cached : prev));
        return;
      }
      const canonical = await fetchConversationsForCurrentUser(conversationsRef.current, effectiveCurrentUserId ?? undefined);
      if (active && canonical.length > 0) {
        setConversations((prev) => (prev.length === 0 ? canonical : prev));
        AsyncStorage.setItem(cacheKey, JSON.stringify(canonical)).catch(() => {});
      }
    } catch { /* silent */ }
  }).catch(() => {});
  return () => {
    active = false;
  };
}, [effectiveCurrentUserId, userScopedCacheKey]);

useEffect(() => {
  let active = true;
  (async () => {
    const term = query.trim();
    if (term.length >= 2) {
      const convs = await searchConversationsFromServer(term, effectiveCurrentUserId ?? undefined);
      if (active && convs.length > 0) setConversations(convs);
      if (active) setConversationsLoading(false);
      return;
    }
    const convs = await fetchConversationsForCurrentUser(conversationsRef.current, effectiveCurrentUserId ?? undefined);
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
      if (merged.length > 0 || conversationsRef.current.length === 0) {
        setConversations(merged);
      }
      setConversationsLoading(false);
      // Persist fresh list for offline use, but never overwrite a usable
      // local list with an empty transient backend/offline response.
      if (merged.length > 0) {
        const cacheKey = userScopedCacheKey(CONVERSATIONS_CACHE_KEY);
        if (cacheKey) AsyncStorage.setItem(cacheKey, JSON.stringify(merged)).catch(() => {});
      }
    }
  })().catch(() => {});
  return () => {
    active = false;
  };
}, [effectiveCurrentUserId, query, userScopedCacheKey]);

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
        searchConversationsFromServer(term, effectiveCurrentUserId ?? undefined),
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
          const messages = await loadMessages(convId, effectiveCurrentUserId).catch(() => []);
          return messages
            .filter((message: any) => {
              const text = normalizeChatDisplayText(message?.text) || normalizeChatDisplayText(message?.styledText?.text);
              return text.toLowerCase().includes(term.toLowerCase());
            })
            .slice(-3)
            .map((message: any) => ({
              chat,
              message,
              convId,
              text: normalizeChatDisplayText(message?.text) || normalizeChatDisplayText(message?.styledText?.text),
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
  effectiveCurrentUserId,
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
  const sub = DeviceEventEmitter.addListener('profile.updated', () => {
    void refreshConversations(true);
  });
  return () => {
    sub.remove();
  };
}, [refreshConversations]);

useEffect(() => {
  const sub = DeviceEventEmitter.addListener('message.decrypted', (payload: any) => {
    const convId = String(payload?.conversationId ?? '');
    if (convId) queueMetaRefresh(convId);
  });
  return () => {
    sub.remove();
  };
}, [queueMetaRefresh]);

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

// Track connectivity for the offline card, and flush pending mutations when
// network recovers.
useEffect(() => {
  const unsubscribe = NetInfo.addEventListener((state) => {
    const connected = state.isConnected === true && state.isInternetReachable !== false;
    setIsOffline(!connected);
    if (connected) {
      flushPendingMutations().catch(() => {});
    }
  });
  return () => unsubscribe();
}, []);

const handleRetryConnection = useCallback(() => {
  NetInfo.fetch().then((state) => {
    const connected = state.isConnected === true && state.isInternetReachable !== false;
    setIsOffline(!connected);
    if (connected) {
      flushPendingMutations().catch(() => {});
    }
  });
}, []);

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

const prevConvIdsRef = useRef<Set<string>>(new Set());
useEffect(() => {
  const convIds = Array.from(
    new Set(
      conversations
        .map((c) => String((c as any)?.conversation_id ?? (c as any)?.conversationId ?? (c as any)?.id ?? ''))
        .filter(Boolean),
    ),
  );
  const convIdSet = new Set(convIds);

  // Only refresh metadata for conversations that are NEW to the list.
  // Refreshing all conversations on every list change causes a thundering-herd
  // of storage reads when conversations re-order after a new message arrives.
  for (const id of convIdSet) {
    if (!prevConvIdsRef.current.has(id)) {
      queueMetaRefresh(id);
    }
  }
  prevConvIdsRef.current = convIdSet;

  setConversationMeta((prev) => {
    const next = { ...prev };
    const keep = convIdSet;
    Object.keys(next).forEach((key) => {
      if (!keep.has(key)) delete next[key];
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
    const isFromMe = senderId.length > 0 && senderId === String(effectiveCurrentUserId);
    const rawPreviewText =
      payload?.text ??
      payload?.previewText ??
      payload?.preview_text ??
      getMessagePreviewText(payload) ??
      '';
    const listPreviewText = resolveConversationPreview(
      {
        ...payload,
        text: payload?.text,
        previewText: rawPreviewText,
        attachments: payload?.attachments,
        media: payload?.media,
      },
      conversationMetaRef.current[convId]?.lastMessage,
      hasEncrypted ? '' : getMessagePreviewText(payload),
    );

    setConversationMeta((prev) => {
      const prevUnread = prev[convId]?.unreadCount ?? 0;
      const increment = isFromMe ? 0 : 1;
      const previewText = resolveConversationPreview(
        {
          ...payload,
          text: payload?.text,
          previewText: rawPreviewText,
          attachments: payload?.attachments,
          media: payload?.media,
        },
        prev[convId]?.lastMessage,
        hasEncrypted ? '' : getMessagePreviewText(payload),
      );
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
            last_message_preview: listPreviewText,
            lastMessage: listPreviewText,
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
          last_message_preview: listPreviewText,
          lastMessage: listPreviewText,
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
        String(effectiveCurrentUserId ?? ''),
        convId,
      );
      upsertMessage(convId, mapped, effectiveCurrentUserId).catch(() => {});
    } catch (err: any) {
      console.warn('[MessagesScreen] failed to map/upsert incoming message', err?.message);
    }

    queueMetaRefresh(convId);

    if (encMeta?.e2ee === 'signal') {
      const senderDeviceId = encMeta?.senderDeviceId ?? encMeta?.deviceId ?? '';
      const recipients = Array.isArray(encMeta?.recipients) ? encMeta.recipients : null;
      const currentDeviceId = deviceIdRef.current;
      const isOwnCurrentDeviceMessage =
        String(payload?.senderId ?? payload?.sender_id ?? payload?.sender?.id ?? '') === String(effectiveCurrentUserId) &&
        !!currentDeviceId &&
        String(senderDeviceId) === String(currentDeviceId);
      const recipientCipher = recipients
        ? currentDeviceId
          ? recipients.find(
              (r: any) =>
                String(r.userId) === String(effectiveCurrentUserId) &&
                String(r.deviceId) === String(currentDeviceId),
            )
          : recipients.find((r: any) => String(r.userId) === String(effectiveCurrentUserId))
        : null;
      if (isOwnCurrentDeviceMessage && !recipientCipher) return;
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
            const previewValue = resolveChatPreviewText(parsed ?? { text: plaintext });
            const messageText = parsed
              ? normalizeChatDisplayText(parsed?.text)
              : normalizeChatDisplayText(plaintext);
            setConversationMeta((prev) => ({
              ...prev,
              [convId]: {
                lastMessage: previewValue,
                lastAt,
                unreadCount: prev[convId]?.unreadCount ?? 0,
              },
            }));
            const mappedInner = mapBackendToChatMessage(
              payload,
              String(effectiveCurrentUserId ?? ''),
              convId,
            );
            const patched = {
              ...mappedInner,
              text: messageText,
              styledText: parsed?.styledText ?? mappedInner.styledText,
              attachments: parsed?.attachments ?? parsed?.media?.attachments ?? mappedInner.attachments,
              media: parsed?.media ?? mappedInner.media,
              contacts: parsed?.contacts ?? mappedInner.contacts,
              poll: parsed?.poll ?? mappedInner.poll,
              event: parsed?.event ?? mappedInner.event,
              voice: parsed?.voice ?? mappedInner.voice,
              sticker: parsed?.sticker ?? mappedInner.sticker,
              replyToId: parsed?.replyToId ?? mappedInner.replyToId,
              kind: parsed?.kind ?? mappedInner.kind,
            };
            upsertMessage(convId, patched, effectiveCurrentUserId).catch(() => {});
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
          const previewValue = resolveChatPreviewText(parsed ?? { text: plaintext });
          const messageText = parsed
            ? normalizeChatDisplayText(parsed?.text)
            : normalizeChatDisplayText(plaintext);
          setConversationMeta((prev) => ({
            ...prev,
            [convId]: {
              ...prev[convId],
              lastMessage: previewValue,
              lastAt,
              unreadCount: prev[convId]?.unreadCount ?? 0,
            },
          }));
          const mappedInner = mapBackendToChatMessage(
            payload,
            String(effectiveCurrentUserId ?? ''),
            convId,
          );
          const patched = {
            ...mappedInner,
            text: messageText,
            styledText: parsed?.styledText ?? mappedInner.styledText,
            attachments: parsed?.attachments ?? parsed?.media?.attachments ?? mappedInner.attachments,
            media: parsed?.media ?? mappedInner.media,
            contacts: parsed?.contacts ?? mappedInner.contacts,
            poll: parsed?.poll ?? mappedInner.poll,
            event: parsed?.event ?? mappedInner.event,
            voice: parsed?.voice ?? mappedInner.voice,
            sticker: parsed?.sticker ?? mappedInner.sticker,
            replyToId: parsed?.replyToId ?? mappedInner.replyToId,
            kind: parsed?.kind ?? mappedInner.kind,
          };
          upsertMessage(convId, patched, effectiveCurrentUserId).catch(() => {});
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
    const rawPreview = payload?.preview ?? payload?.previewText ?? payload?.preview_text;
    const lastAt = payload?.lastMessageAt ?? payload?.last_message_at ?? new Date().toISOString();
    const senderId = payload?.senderId ? String(payload.senderId) : '';
    const isFromMe = senderId.length > 0 && senderId === String(effectiveCurrentUserId);

    if (rawPreview !== undefined) {
      setConversationMeta((prev) => {
        const prevUnread = prev[convId]?.unreadCount ?? 0;
        return {
          ...prev,
          [convId]: {
            ...prev[convId],
            lastMessage: resolveConversationPreview(payload, prev[convId]?.lastMessage),
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
            last_message_preview: resolveConversationPreview(payload, conversationMetaRef.current[convId]?.lastMessage),
            lastMessage: resolveConversationPreview(payload, conversationMetaRef.current[convId]?.lastMessage),
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
}, [socket, isConnected, effectiveCurrentUserId, queueMetaRefresh, setConversations, setConversationMeta, refreshConversations]);

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
      const cacheKey = userScopedCacheKey(CONVERSATIONS_CACHE_KEY);
      if (cacheKey) {
        AsyncStorage.setItem(cacheKey, JSON.stringify(updated)).catch(() => {});
      }
      return updated;
    });
  }
  onOpenChat(chat);
}, [onOpenChat, userScopedCacheKey]);

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
            selectedConversationIds.map(async (conversationId) => {
              try {
                await postRequest(conversationActionUrl(conversationId, 'delete-for-me'), {});
              } catch {
                await enqueueMutation({ method: 'POST', url: conversationActionUrl(conversationId, 'delete-for-me'), payload: {} });
              }
            }),
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
    selectedConversationIds.map(async (conversationId) => {
      try {
        await postRequest(conversationActionUrl(conversationId, 'pin'), { pinned: shouldPin });
      } catch {
        await enqueueMutation({ method: 'POST', url: conversationActionUrl(conversationId, 'pin'), payload: { pinned: shouldPin } });
      }
    }),
  );
  handleClearSelection();
}, [conversationActionUrl, handleClearSelection, selectedChat, selectedConversationIds, updateSelectedConversations]);

const handleMuteSelected = useCallback(() => {
  if (!selectedConversationIds.length) return;
  const shouldMute = selectedChat.some(chat => !chat.isMuted);
  updateSelectedConversations(chat => ({ ...chat, isMuted: shouldMute }));
  void Promise.allSettled(
    selectedConversationIds.map(async (conversationId) => {
      try {
        await postRequest(conversationActionUrl(conversationId, 'mute'), { muted: shouldMute });
      } catch {
        await enqueueMutation({ method: 'POST', url: conversationActionUrl(conversationId, 'mute'), payload: { muted: shouldMute } });
      }
    }),
  );
  handleClearSelection();
}, [conversationActionUrl, handleClearSelection, selectedChat, selectedConversationIds, updateSelectedConversations]);

const handleArchiveSelected = useCallback(() => {
  if (!selectedConversationIds.length) return;
  const shouldArchive = selectedChat.some(chat => !chat.isArchived);
  updateSelectedConversations(chat => ({ ...chat, isArchived: shouldArchive }));
  void Promise.allSettled(
    selectedConversationIds.map(async (conversationId) => {
      try {
        await postRequest(conversationActionUrl(conversationId, 'archive'), { archived: shouldArchive });
      } catch {
        await enqueueMutation({ method: 'POST', url: conversationActionUrl(conversationId, 'archive'), payload: { archived: shouldArchive } });
      }
    }),
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
    selectedConversationIds.map(async (conversationId) => {
      try {
        await postRequest(conversationActionUrl(conversationId, 'mark-read'), {});
      } catch {
        await enqueueMutation({ method: 'POST', url: conversationActionUrl(conversationId, 'mark-read'), payload: {} });
      }
    }),
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

  // ── Collapsing search + filter header ────────────────────────────────────
  // Only the search bar and filter chips collapse away on scroll — same
  // mechanism as Broadcast/Bible/Partners/Profile's Golden Sections now
  // (continuous maxHeight+opacity interpolation of one shared scroll
  // position), instead of the previous direction-threshold show/hide toggle.
  // The tab bar (Chats/Updates/Calls/Communities) is permanent navigation
  // and must never hide — users need to always know where they are.
  const MESSAGES_COLLAPSE_DISTANCE = 110;
  const { scrollY, onHeaderLayout, collapseStyle } = useCollapsingGoldHeader(MESSAGES_COLLAPSE_DISTANCE);

  // Shared by every sub-tab's own scrollable (Chats/Updates/Calls/Communities)
  // so the gold header's search+filter row collapses/reveals consistently no
  // matter which tab the user is scrolling — not just Chats. A plain callback
  // writing into the shared value (rather than useAnimatedScrollHandler) so
  // the sub-tabs' own FlatList/ScrollView/SectionList don't need to become
  // Reanimated-wrapped components themselves.
  const handleTabScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollY.value = e.nativeEvent.contentOffset.y;
  }, [scrollY]);

  const handleChatsEndReached = useCallback(() => {
    scrollY.value = reduceMotionRef.current ? 0 : withTiming(0, { duration: 220 });
  }, [scrollY]);

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

  // The gold header is registered content rendered by App.tsx's shared
  // GoldenSection host (a normal-flow flex sibling above the navigator), not
  // part of this screen's own view tree — a drag starting on it has no
  // native scroll gesture to move the page. These refs let
  // useHeaderDragToScroll (below) imperatively scroll whichever sub-tab is
  // currently active in lockstep with the header drag, same pattern as
  // BibleScreen's scrollActiveContentTo.
  const chatsTabRef = useRef<ScrollableHandle>(null);
  const updatesTabRef = useRef<ScrollableHandle>(null);
  const callsTabRef = useRef<ScrollableHandle>(null);
  const communitiesTabRef = useRef<ScrollableHandle>(null);
  const scrollActiveContentTo = useCallback((y: number, animated: boolean) => {
    const activeRef =
      activeTopTab === 'Chats' ? chatsTabRef
      : activeTopTab === 'Updates' ? updatesTabRef
      : activeTopTab === 'Calls' ? callsTabRef
      : communitiesTabRef;
    activeRef.current?.scrollTo({ y, animated });
  }, [activeTopTab]);
  const messagesCollapseDistance = useSharedValue(MESSAGES_COLLAPSE_DISTANCE);
  // Lets a vertical drag directly on the gold header itself (not just on the
  // Chats/Updates/Calls/Communities lists below) collapse/reveal the search
  // bar + filter chips — same shared mechanism BibleScreen uses for its own
  // header, which also keeps the active list scrolling in lockstep with the
  // drag instead of just animating the header in place.
  const { panHandlers: headerPanHandlers } = useHeaderDragToScroll({
    scrollY,
    collapseDistance: messagesCollapseDistance,
    onScrollTo: scrollActiveContentTo,
  });

  const AnimatedTopBar = (tabProps: any) => {
    const nextTab = tabProps?.state?.routes?.[tabProps.state.index]?.name;
    useEffect(() => {
      if (nextTab === 'Chats' || nextTab === 'Updates' || nextTab === 'Calls' || nextTab === 'Communities') {
        setActiveTopTab(nextTab);
      }
    }, [nextTab]);
    return (
      <View style={{ backgroundColor: messageTopPanelBg, borderBottomWidth: 0, borderBottomColor: 'transparent' }}>
        <MaterialTopTabBar
          {...tabProps}
          style={{ backgroundColor: messageTopPanelBg, elevation: 0 }}
          indicatorStyle={{ backgroundColor: palette.goldLight, height: 3, borderRadius: 3 }}
          labelStyle={{ fontWeight: '700', textTransform: 'none', fontSize: responsive.isWatch ? 11 : responsive.isCompactPhone ? 12 : 14 }}
          activeTintColor={palette.onGold}
          inactiveTintColor="rgba(255,244,184,0.76)"
        />
      </View>
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

  const messageTopPanelBg = tone === 'dark' ? palette.goldDeep : palette.royalInk;

  // goldHeader starts with bright gold so the transparent status bar shows the
  // app's gold theme, not a dark void. The diagonal direction keeps the luxury
  // depth effect in the visible header below the status bar.
  const messageGoldGradient: readonly string[] = headerGradient ?? [...KIS_ROYAL_GRADIENTS.goldHeader];

  // Gold header → always use dark icons for readability (push/pop so other
  // screens' bar styles are unaffected when navigating away).
  useStatusBarStyle(tone, 'dark-content');

  // Registered with the shared Golden Section host in App.tsx instead of
  // rendering GoldHeaderShell locally, so it stays mounted/animated across
  // tab switches. Same JSX as before, just handed off instead of returned.
  //
  // Cleared (passed null) while the full-screen chat room / add-contacts
  // overlays are open: those overlays are position:absolute within this
  // screen's own tree, which starts *below* the Golden Section — they can't
  // reach up to cover it. Hiding the Golden Section instead lets this
  // screen's content area (and the overlay inside it) expand to fill that
  // freed space, so the overlay genuinely covers the whole screen instead of
  // opening underneath the still-visible gold header.
  useGoldenSectionContent(chatVisible || addVisible ? null : {
    content: (
      <View {...headerPanHandlers}>

      {/* ------------ Top App Bar ------------ */}
        {selectMode ? (
          <View
            style={[
              styles.appBar,
              styles.royalAppBar,
              {
                backgroundColor: 'transparent',
                borderBottomColor: 'transparent',
                paddingTop: topInset + 38,
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
                    backgroundColor: 'rgba(23,17,31,0.28)',
                    borderWidth: 1,
                    borderColor: 'rgba(255,244,184,0.30)',
                    opacity: pressed ? KIS_TOKENS.opacity.pressed : 1,
                  },
                ]}
              >
                <KISIcon name="arrow-left" size={20} color={palette.onGold} />
              </Pressable>

              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={{
                    color: palette.onGold,
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
                    color: palette.ivory,
                    opacity: 0.88,
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
                      backgroundColor: 'rgba(23,17,31,0.28)',
                      borderWidth: 1,
                      borderColor: 'rgba(255,244,184,0.26)',
                      opacity: pressed ? KIS_TOKENS.opacity.pressed : 1,
                    },
                  ]}
                >
                  <KISIcon name={action.icon as any} size={18} color={palette.onGold} />
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
                    backgroundColor: 'rgba(23,17,31,0.28)',
                    borderWidth: 1,
                    borderColor: 'rgba(255,244,184,0.26)',
                    opacity: pressed ? KIS_TOKENS.opacity.pressed : 1,
                  },
                ]}
              >
                <KISIcon name="menu" size={18} color={palette.onGold} />
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
                paddingTop: topInset + 38,
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
                  backgroundColor: 'rgba(23,17,31,0.28)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,244,184,0.30)',
                }}
              >
                <Text style={{ color: palette.onGold, fontSize: responsive.isWatch ? 15 : 18, fontWeight: '900' }}>
                  {appName ? appName[0].toUpperCase() : 'K'}
                </Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={{
                    color: palette.onGold,
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
                      color: palette.ivory,
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
                      backgroundColor: 'rgba(23,17,31,0.28)',
                      borderWidth: 1,
                      borderColor: 'rgba(255,244,184,0.26)',
                      opacity: pressed ? KIS_TOKENS.opacity.pressed : 1,
                    },
                  ]}
                >
                  <KISIcon name={action.icon as any} size={18} color={palette.onGold} />
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
              top: topInset + (isTinyDevice ? 62 : 72),
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
        <ReAnimated.View style={[collapseStyle, { overflow: 'hidden' }]}>
        <View
          onLayout={onHeaderLayout}
          style={{
            paddingHorizontal: messageHeaderPaddingX,
            paddingTop: 4,
            paddingBottom: 8,
            marginTop: -1,
            zIndex: 1,
            backgroundColor: 'transparent',
            borderTopWidth: 0,
            borderBottomLeftRadius: 24,
            borderBottomRightRadius: 24,
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
            {(['Unread', 'Groups', 'Channels', 'Favourites', 'Community', 'Mentions', 'Archived', 'Blocked'] as LocalQuick[]).map(
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
        </View>
        </ReAnimated.View>
      )}
      </View>
    ),
    colors: messageGoldGradient,
    shellStyle: styles.messageGoldPanel,
  });

  return (
    <View style={[styles.wrap, { backgroundColor: palette.bg }]}>
      {/* ------------ Offline state — below the gold header's filter chips, ------------
          above the Chats/Updates/Calls/Communities tabs. Replaces the old red
          error bar (previously rendered app-wide in AppNavigator's MainTabs). */}
      <MessagesOfflineCard visible={isOffline} onRetry={handleRetryConnection} />

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
      <View style={{ flex: 1, backgroundColor: palette.bg, }}>
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
            options={{ tabBarLabel: translateString('Chats') }}
            children={() => (
              <ChatsTab
                ref={chatsTabRef}
                filters={customFilters}
                activeQuick={activeQuickForChats}
                activeCustomId={activeCustom}
                search={query}
                typingByConversation={typingByConversation}
                presenceByUser={presenceByUser}
                currentUserId={effectiveCurrentUserId ?? undefined}
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
                onScroll={handleTabScroll}
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
            options={{ tabBarLabel: translateString('Updates') }}
            children={() => (
              <UpdatesTab ref={updatesTabRef} searchTerm={query} onOpenChat={onOpenChat} onScroll={handleTabScroll} />
            )}
          />
          <Tab.Screen
            name="Calls"
            options={{ tabBarLabel: translateString('Calls') }}
            children={() => <CallsTab ref={callsTabRef} searchTerm={query} onScroll={handleTabScroll} />}
          />
          <Tab.Screen
            name="Communities"
            options={{ tabBarLabel: translateString('Communities') }}
            children={() => (
              <CommunitiesTab ref={communitiesTabRef} onOpenChat={onOpenChat} onScroll={handleTabScroll} />
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
            <KISIcon name="add" size={24} color={palette.ivory} />
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
            { backgroundColor: avatarPreviewFull ? palette.royalInk : 'transparent' },
          ]}
          onPress={() => setAvatarPreview(null)}
        />
        {avatarPreview ? (
          <Animated.View
            style={{
              position: 'absolute',
              top: topInset + 24,
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
                  hitSlop={10}
                  style={{
                    position: 'absolute',
                    top: 10,
                    left: 10,
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    backgroundColor: palette.backdrop,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <KISIcon name="arrow-left" size={18} color={palette.ivory} />
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
                          currentUserId: effectiveCurrentUserId ?? null,
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
