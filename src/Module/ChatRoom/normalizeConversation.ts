// src/utils/normalizeConversation.ts

import { Chat, directConversationAvatar, directConversationName } from './messagesUtils';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { clearCacheByKey, getCache, setCache } from '@/network/cache';
import { resolveChatPreviewText } from './safeChatText';

// 🔐 Cache configuration for conversations
export const CONVERSATION_CACHE_TYPE = 'CHAT_CACHE';
export const CONVERSATION_CACHE_KEY = 'CONVERSATION_LIST';

const conversationListCacheKey = (currentUserId?: string) => {
  const userPart = currentUserId ? String(currentUserId).trim() : 'anon';
  return `${CONVERSATION_CACHE_KEY}:${userPart || 'anon'}`;
};

const extractConversationList = (payload: any): any[] => {
  const candidates = [
    payload?.data?.results,
    payload?.data?.data?.results,
    payload?.data?.data,
    payload?.data,
    payload?.results,
    payload,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
};

const mergeRawConversationLists = (...lists: any[][]): any[] => {
  const map = new Map<string, any>();
  for (const list of lists) {
    for (const conv of list || []) {
      if (!conv) continue;
      map.set(computeChatId(conv), conv);
    }
  }
  return Array.from(map.values());
};


/* -------------------------------------------------------------------------- */
/*  CONSTANTS                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Per-chat cache key: maps a chat/contact → small metadata (e.g. conversation id).
 * NOTE: In this file we no longer store full conversation payloads under this key
 * to avoid duplication. The full list is stored ONLY under CONVERSATION_CACHE_KEY.
 * Other modules (e.g. ChatRoomPage) can still use this to map chat → conv id.
 */
export const conversationCacheKeyForChat = (chatId: string | number) =>
  `CHAT_CONVERSATION_${String(chatId)}`;

/**
 * Compute a safe, non-empty ID string for a conversation-like object.
 */
function computeChatId(raw: any): string {
  if (!raw) return 'unknown';

  const candidates = [
    raw.id,
    raw.conversation_id,
    raw.conversationId,
    raw.uuid,
    raw.pk,
  ];

  const firstValid = candidates.find((v) => {
    if (v === null || v === undefined) return false;
    const s = String(v).trim();
    return s.length > 0 && s !== 'undefined' && s !== 'null';
  });

  if (firstValid !== undefined) return String(firstValid);

  const namePart =
    raw?.title || raw?.name || raw?.description || 'conversation';
  const timePart =
    raw?.last_message_at || raw?.lastAt || raw?.created_at || '';

  const base = `${namePart}_${timePart}`.replace(/\s+/g, '-');

  if (base && base !== 'conversation_') {
    return `local_${base}`;
  }

  return `local_${Math.random().toString(16).slice(2)}`;
}

/**
 * Normalize raw Django conversation into Chat model.
 */
export function normalizeConversation(raw: any, currentUserId?: string): Chat {
  if (!raw) {
    return {
      id: 'unknown',
      name: 'Unnamed Conversation',
      lastMessage: '',
      lastAt: '',
      unreadCount: 0,
      hasMention: false,
      readStateAuthoritative: false,
      participants: [],
      kind: undefined,
      isGroup: false,
      isGroupChat: false,
      isCommunityChat: false,
      isContactChat: false,
      isDirect: false,
      requestState: 'none',
      requestInitiatorId: undefined,
      requestRecipientId: undefined,
    };
  }

  const id = computeChatId(raw);

  const name =
    raw.title || raw.name || raw.description || 'Unnamed Conversation';

  const resolvedType = raw.type ?? raw.kind;
  const isDirect = resolvedType === 'direct';
  const directName = isDirect
    ? directConversationName(raw.participants ?? [], currentUserId)
    : null;
  const directAvatar = isDirect
    ? directConversationAvatar(raw.participants ?? [], currentUserId)
    : null;
  const participantRecords = Array.isArray(raw.participants) ? raw.participants : [];
  const selfMember = currentUserId
    ? participantRecords.find(
        (p: any) =>
          p?.user?.id === currentUserId ||
          p?.user === currentUserId ||
          p?.id === currentUserId,
      )
    : null;
  const isBlocked = Boolean(selfMember?.is_blocked ?? selfMember?.isBlocked);
  const isMuted = Boolean(raw.is_muted ?? raw.isMuted ?? selfMember?.is_muted ?? selfMember?.isMuted);
  const isPinned = Boolean(raw.is_pinned ?? raw.isPinned ?? selfMember?.is_pinned ?? selfMember?.isPinned);
  const isHidden = Boolean(raw.is_hidden ?? raw.isHidden ?? selfMember?.is_hidden ?? selfMember?.isHidden);

  return {
    id,
    name: directName || name,
    avatarUrl: raw.avatar_url ?? raw.avatarUrl ?? directAvatar ?? undefined,

    lastMessage: resolveChatPreviewText({
      ...raw,
      text: raw.lastMessageText ?? raw.last_message_text ?? raw.text,
      previewText: raw.last_message_preview ?? raw.lastMessage ?? raw.last_message,
      attachments: raw.attachments,
      media: raw.media,
      kind: raw.last_message_kind ?? raw.lastMessageKind ?? raw.kind,
    }),
    lastAt: raw.last_message_at ?? raw.lastAt ?? '',

    unreadCount: raw.unread_count ?? raw.unreadCount ?? 0,
    hasMention: raw.has_mention ?? raw.hasMention ?? false,
    readStateAuthoritative:
      raw.read_state_authoritative ?? raw.readStateAuthoritative ?? false,

    participants: raw.participants ?? [],

    kind: resolvedType,
    isGroup: resolvedType === 'group',
    isGroupChat: resolvedType === 'group',
    isCommunityChat:
      resolvedType === 'community' ||
      resolvedType === 'post' ||
      Boolean(raw.is_community_group ?? raw.isCommunityGroup) ||
      Boolean(raw.community_id ?? raw.communityId),
    isContactChat: (raw.type ?? raw.kind) === 'direct',
    isDirect,

    communityId:
      raw.community_id ??
      raw.communityId ??
      (raw.group && (raw.group.community_id ?? raw.group.communityId)) ??
      undefined,

    requestState: raw.request_state ?? raw.requestState ?? 'none',
    requestInitiatorId:
      raw.request_initiator ?? raw.requestInitiatorId ?? undefined,
    requestRecipientId:
      raw.request_recipient ?? raw.requestRecipientId ?? undefined,

    isArchived: raw.is_archived ?? raw.isArchived ?? false,
    isLocked: raw.is_locked ?? raw.isLocked ?? false,
    isBlocked,
    isMuted,
    isPinned,
    isHidden,
    isPartner: !!(raw.is_partner ?? raw.isPartner ?? raw.partner_id ?? raw.partnerId ?? String(raw.kind ?? '').includes('partner') ?? String(raw.type ?? '').includes('partner')),
    isVerified: !!(raw.is_verified ?? raw.isVerified),
  };
}

/**
 * Read cached conversation list from local storage.
 * Single source of truth: list is stored only under CONVERSATION_CACHE_KEY.
 */
async function getRawConversationsFromCache(currentUserId?: string): Promise<any[]> {
  try {
    const cached = await getCache(CONVERSATION_CACHE_TYPE, conversationListCacheKey(currentUserId));

    if (!cached) return [];

    if (Array.isArray(cached)) return cached;

    if (Array.isArray((cached as any).results)) return cached.results;

    if (cached?.data && Array.isArray(cached.data.results)) {
      return cached.data.results;
    }

    console.warn(
      '[fetchConversationsForCurrentUser] Unexpected cache shape:',
      cached,
    );
    return [];
  } catch (e) {
    console.warn('[fetchConversationsForCurrentUser] Cache read failed:', e);
    return [];
  }
}

/**
 * AWAITED REFRESH:
 * - We fetch from backend
 * - If backend returns empty list → clear cache
 * - Otherwise we overwrite the single list cache with a de-duplicated array.
 */
async function refreshConversationsAndHandleEmpty(currentUserId?: string): Promise<any[] | null> {
  try {
    const res = await getRequest(ROUTES.chat.listConversations, {
      errorMessage: 'Unable to load conversations.',
    });

    const rawList = extractConversationList(res);

    if (__DEV__) console.log(
      '[refreshConversationsAndHandleEmpty] Fetched conversations:',
      rawList.length,
    );

    // Keep the permanent cache when the server returns zero conversations.
    // A transient backend/auth/policy issue can look like an empty list, and
    // clearing here makes chats disappear on the next offline launch.
    if (rawList.length === 0) {
      if (__DEV__) console.log(
        '[fetchConversations] Backend returned ZERO conversations → preserving local cache',
      );
      return [];
    }

    const cachedRaw = await getRawConversationsFromCache(currentUserId);
    const dedupedRawList = mergeRawConversationLists(cachedRaw, rawList);

    // Store the merged list so a partial/slow backend response cannot shrink
    // the offline-visible conversation list to one chat.
    await clearCacheByKey(CONVERSATION_CACHE_TYPE, conversationListCacheKey(currentUserId));
    await setCache(CONVERSATION_CACHE_TYPE, conversationListCacheKey(currentUserId), dedupedRawList);

    if (__DEV__) console.log(
      '[refreshConversationsAndHandleEmpty] Cached deduped conversations list (no per-conversation payloads)',
    );
    return dedupedRawList;
  } catch (error) {
    console.warn('[fetchConversations] Background refresh failed:', error);
    return null;
  }
}

export async function searchConversationsFromServer(
  query: string,
  currentUserId?: string,
): Promise<Chat[]> {
  const q = query.trim();
  if (!q) return [];

  try {
    const url = `${ROUTES.chat.listConversations}?q=${encodeURIComponent(q)}`;
    const res = await getRequest(url, {
      errorMessage: 'Unable to search conversations.',
    });

    const rawList = extractConversationList(res);

    if (__DEV__) console.log("reqest_conversations: ", rawList);
    const normalized = rawList.map((item: any) =>
      normalizeConversation(item, currentUserId),
    );

    return dedupeChats(normalized);
  } catch (e) {
    console.warn('[searchConversationsFromServer] failed:', e);
    return [];
  }
}

/**
 * De-duplicate conversation objects by ID → last one wins.
 */
function dedupeChats(chats: Chat[]): Chat[] {
  const map = new Map<string, Chat>();

  for (const c of chats) {
    if (!c || !c.id) continue;
    map.set(String(c.id), c);
  }

  return Array.from(map.values());
}

/**
 * Public API:
 * Always return conversations from cache (fallback if empty).
 * Backend refresh runs in background AND handles empty backend → clear cache.
 */
const lastRefreshByUser: Record<string, number> = {};

export async function fetchConversationsForCurrentUser(
  fallback: Chat[] = [],
  currentUserId?: string,
  forceRefresh?: boolean,
): Promise<Chat[]> {
  const userKey = currentUserId ? String(currentUserId) : 'anon';
  if (forceRefresh) {
    lastRefreshByUser[userKey] = Date.now();
    const freshRaw = await refreshConversationsAndHandleEmpty(currentUserId);
    if (freshRaw === null) {
      const cachedRaw = await getRawConversationsFromCache(currentUserId);
      const fallbackRaw = cachedRaw.length ? cachedRaw : fallback;
      const normalizedFallback = fallbackRaw.map((item: any) =>
        normalizeConversation(item, currentUserId),
      );
      return dedupeChats(normalizedFallback);
    }
    const normalizedFresh = freshRaw.map((item: any) =>
      normalizeConversation(item, currentUserId),
    );
    return dedupeChats(normalizedFresh);
  }

  let cachedRaw = await getRawConversationsFromCache(currentUserId);
  if (!cachedRaw.length) {
    const freshRaw = await refreshConversationsAndHandleEmpty(currentUserId);
    cachedRaw = Array.isArray(freshRaw) && freshRaw.length
      ? freshRaw
      : await getRawConversationsFromCache(currentUserId);
  }
  if (__DEV__) console.log('[fetchConversationsForCurrentUser] Cached raw list:', cachedRaw);

  const baseList = cachedRaw.length ? cachedRaw : fallback;

  const normalized = baseList.map((item: any) =>
    normalizeConversation(item, currentUserId),
  );

  const deduped = dedupeChats(normalized);

  return deduped;
}
