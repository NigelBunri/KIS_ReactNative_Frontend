// src/utils/normalizeConversation.ts

import { Chat, directConversationAvatar, directConversationName } from './messagesUtils';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { clearCacheByKey, getCache, setCache } from '@/network/cache';

// 🔐 Cache configuration for conversations
export const CONVERSATION_CACHE_TYPE = 'CHAT_CACHE';
export const CONVERSATION_CACHE_KEY = 'CONVERSATION_LIST';

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
  const isMuted = Boolean(selfMember?.is_muted ?? selfMember?.isMuted);

  return {
    id,
    name: directName || name,
    avatarUrl: raw.avatar_url ?? raw.avatarUrl ?? directAvatar ?? undefined,

    lastMessage: raw.last_message_preview ?? raw.lastMessage ?? '',
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
  };
}

/**
 * Read cached conversation list from local storage.
 * Single source of truth: list is stored only under CONVERSATION_CACHE_KEY.
 */
async function getRawConversationsFromCache(): Promise<any[]> {
  try {
    const cached = await getCache(CONVERSATION_CACHE_TYPE, CONVERSATION_CACHE_KEY);

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
async function refreshConversationsAndHandleEmpty() {
  try {
    const res = await getRequest(ROUTES.chat.listConversations, {
      errorMessage: 'Unable to load conversations.',
    });

    const rawList = Array.isArray(res?.data?.results)
      ? res.data.results
      : [];

    console.log(
      '[refreshConversationsAndHandleEmpty] Fetched conversations:',
      rawList.length,
    );

    // ── If no conversations: clear the main list cache and exit ───────────
    if (rawList.length === 0) {
      console.log(
        '[fetchConversations] Backend returned ZERO conversations → clearing local cache',
      );
      await clearCacheByKey(CONVERSATION_CACHE_TYPE, CONVERSATION_CACHE_KEY);
      return;
    }

    // ── De-duplicate by computed chat id (last one wins) ──────────────────
    const map = new Map<string, any>();
    for (const conv of rawList) {
      if (!conv) continue;
      const id = computeChatId(conv);
      map.set(id, conv);
    }
    const dedupedRawList = Array.from(map.values());

    // ── Store ONLY the deduped list under the main conversations key ──────
    await setCache(CONVERSATION_CACHE_TYPE, CONVERSATION_CACHE_KEY, dedupedRawList);

    console.log(
      '[refreshConversationsAndHandleEmpty] Cached deduped conversations list (no per-conversation payloads)',
    );
  } catch (error) {
    console.warn('[fetchConversations] Background refresh failed:', error);
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

    const rawList = Array.isArray(res?.data?.results)
      ? res.data.results
      : [];

    console.log("reqest_conversations: ", rawList);
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
    await refreshConversationsAndHandleEmpty();
  }

  const cachedRaw = await getRawConversationsFromCache();
  if (!cachedRaw.length) {
    await refreshConversationsAndHandleEmpty();
  }
  console.log('[fetchConversationsForCurrentUser] Cached raw list:', cachedRaw);

  const baseList = cachedRaw.length ? cachedRaw : fallback;

  const normalized = baseList.map((item: any) =>
    normalizeConversation(item, currentUserId),
  );

  const deduped = dedupeChats(normalized);

  return deduped;
}
