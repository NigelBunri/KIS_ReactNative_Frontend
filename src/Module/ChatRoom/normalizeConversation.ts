// src/utils/normalizeConversation.ts

import { Chat, directConversationAvatar, directConversationName } from './messagesUtils';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { clearCacheByKey, getCache, setCache } from '@/network/cache';
import { getCurrentAuthUserId } from '@/storage/userScopedProfileCache';
import { resolveChatPreviewText } from './safeChatText';

// 🔐 Cache configuration for conversations
export const CONVERSATION_CACHE_TYPE = 'CHAT_CACHE';
export const CONVERSATION_CACHE_KEY = 'CONVERSATION_LIST';

const conversationListCacheKey = (currentUserId: string) => {
  const userPart = String(currentUserId).trim();
  return `${CONVERSATION_CACHE_KEY}:${userPart}`;
};

const resolveConversationUserId = async (currentUserId?: string | null) => {
  const explicit = currentUserId != null ? String(currentUserId).trim() : '';
  if (explicit) return explicit;
  return await getCurrentAuthUserId().catch(() => null);
};

const pickParticipantUserId = (participant: any): string | null => {
  if (!participant || typeof participant !== 'object') {
    const direct = participant != null ? String(participant).trim() : '';
    return direct || null;
  }
  const candidates = [
    participant.user?.id,
    participant.user_id,
    participant.userId,
    participant.account?.user_id,
    participant.id,
    participant.user,
  ];
  const found = candidates.find(value => {
    if (value === null || value === undefined) return false;
    const text = String(value).trim();
    return text.length > 0 && text !== 'null' && text !== 'undefined';
  });
  return found != null ? String(found).trim() : null;
};

const conversationBelongsToUser = (raw: any, currentUserId?: string | null) => {
  const userId = currentUserId != null ? String(currentUserId).trim() : '';
  if (!userId || !raw || typeof raw !== 'object') return true;
  const participantSources = [
    raw.participants,
    raw.members,
    raw.member_ids,
    raw.memberIds,
    raw.user_ids,
    raw.userIds,
  ].filter(Array.isArray) as any[][];
  if (!participantSources.length) return true;
  return participantSources.some(source =>
    source.some(participant => String(pickParticipantUserId(participant) ?? '') === userId),
  );
};

const filterConversationsForUser = (rawList: any[], currentUserId?: string | null) =>
  rawList.filter(item => conversationBelongsToUser(item, currentUserId));

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

// DRF's max page_size. Requesting this size on every page keeps the number
// of round trips small even for a user with hundreds of conversations.
const CONVERSATION_PAGE_SIZE = 100;
// Defensive ceiling on how many pages we'll walk in one refresh (200 * 100 =
// 20,000 conversations). Guards against spinning forever if a server bug
// ever reports a runaway total_pages value; a real account will never hit
// this and simply gets every page it actually has.
const MAX_CONVERSATION_PAGES = 200;

/**
 * Walks every page the backend reports for the conversation list and
 * returns the concatenated raw results.
 *
 * Previously this only ever fetched page 1: the backend's default
 * pagination (page_size=25) silently truncated any account with more than
 * 25 conversations, and nothing in this file ever read `meta.total_pages`
 * to know a second page existed. A user with 26+ conversations would never
 * see the rest, with no error and no visible sign anything was missing.
 *
 * Throws (rather than returning a partial list) if any page after the
 * first fails, so a mid-walk network error is treated as a full refresh
 * failure by the caller and falls back to cache instead of silently
 * caching a truncated list.
 */
async function fetchAllConversationPages(): Promise<any[]> {
  const pageUrl = (page: number) =>
    `${ROUTES.chat.listConversations}?page=${page}&page_size=${CONVERSATION_PAGE_SIZE}`;

  // getRequest never throws on a normal network/HTTP failure - every
  // failure path (network error, 4xx/5xx, etc.) resolves to
  // `{ success: false, ... }` instead (see src/network/get/index.tsx). A
  // caller that ignores `success` and just extracts whatever list-shaped
  // data it can find will silently treat a failed page as "zero
  // conversations on that page" and keep walking, which reintroduces the
  // exact silent-truncation bug this function exists to fix. Explicitly
  // check and throw so a failed page aborts the whole walk instead.
  const fetchPageOrThrow = async (page: number) => {
    const res = await getRequest(pageUrl(page), {
      errorMessage: 'Unable to load conversations.',
    });
    if ((res as any)?.success === false) {
      throw new Error((res as any)?.message || `Failed to load conversations page ${page}.`);
    }
    return res;
  };

  const first = await fetchPageOrThrow(1);
  const all = extractConversationList(first);

  const totalPagesRaw = Number((first as any)?.data?.meta?.total_pages);
  const totalPages = Number.isFinite(totalPagesRaw) && totalPagesRaw > 0
    ? Math.min(totalPagesRaw, MAX_CONVERSATION_PAGES)
    : 1;

  for (let page = 2; page <= totalPages; page++) {
    const res = await fetchPageOrThrow(page);
    all.push(...extractConversationList(res));
  }

  return all;
}


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

    groupId: raw.group_id ?? raw.groupId ?? undefined,

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
async function getRawConversationsFromCache(currentUserId: string): Promise<any[]> {
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
async function refreshConversationsAndHandleEmpty(currentUserId: string): Promise<any[] | null> {
  try {
    const rawList = filterConversationsForUser(await fetchAllConversationPages(), currentUserId);

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
    const dedupedRawList = filterConversationsForUser(
      mergeRawConversationLists(cachedRaw, rawList),
      currentUserId,
    );

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

  const effectiveUserId = await resolveConversationUserId(currentUserId);
  if (!effectiveUserId) return [];

  try {
    const url = `${ROUTES.chat.listConversations}?q=${encodeURIComponent(q)}`;
    const res = await getRequest(url, {
      errorMessage: 'Unable to search conversations.',
    });

    const rawList = filterConversationsForUser(extractConversationList(res), effectiveUserId);

    if (__DEV__) console.log('reqest_conversations: ', rawList);
    const normalized = rawList.map((item: any) =>
      normalizeConversation(item, effectiveUserId),
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

/**
 * Outcome of a conversations fetch, so a caller can distinguish "confirmed
 * empty account" from "network/refresh failed, showing whatever's cached"
 * from "network/refresh failed and there is nothing cached to show" -
 * three states that used to be indistinguishable (fetchConversationsForCurrentUser
 * always just returned a Chat[] with no signal of which case produced it),
 * which is why the chat list previously had no way to render a distinct
 * error/offline state instead of a generic "no chats" empty view.
 */
export type ConversationsFetchStatus = 'fresh' | 'cache_fallback' | 'error_no_cache';

export async function fetchConversationsForCurrentUserWithStatus(
  fallback: Chat[] = [],
  currentUserId?: string,
  forceRefresh?: boolean,
): Promise<{ chats: Chat[]; status: ConversationsFetchStatus }> {
  const effectiveUserId = await resolveConversationUserId(currentUserId);
  if (!effectiveUserId) {
    const chats = dedupeChats(fallback);
    return { chats, status: chats.length ? 'cache_fallback' : 'error_no_cache' };
  }
  const userKey = effectiveUserId;
  if (forceRefresh) {
    lastRefreshByUser[userKey] = Date.now();
    const freshRaw = await refreshConversationsAndHandleEmpty(effectiveUserId);
    if (freshRaw === null) {
      const cachedRaw = await getRawConversationsFromCache(effectiveUserId);
      const fallbackRaw = cachedRaw.length ? cachedRaw : fallback;
      const normalizedFallback = fallbackRaw.map((item: any) =>
        normalizeConversation(item, effectiveUserId),
      );
      const chats = dedupeChats(normalizedFallback);
      return { chats, status: chats.length ? 'cache_fallback' : 'error_no_cache' };
    }
    const normalizedFresh = freshRaw.map((item: any) =>
      normalizeConversation(item, effectiveUserId),
    );
    return { chats: dedupeChats(normalizedFresh), status: 'fresh' };
  }

  let cachedRaw = await getRawConversationsFromCache(effectiveUserId);
  let status: ConversationsFetchStatus = 'fresh';
  if (!cachedRaw.length) {
    const freshRaw = await refreshConversationsAndHandleEmpty(effectiveUserId);
    if (Array.isArray(freshRaw) && freshRaw.length) {
      cachedRaw = freshRaw;
    } else {
      cachedRaw = await getRawConversationsFromCache(effectiveUserId);
      // freshRaw === null means the refresh itself failed (vs. freshRaw
      // being a confirmed-empty [] from the backend), which is the only
      // case that should read as an error rather than a genuinely empty
      // account.
      if (freshRaw === null) {
        status = cachedRaw.length ? 'cache_fallback' : 'error_no_cache';
      }
    }
  }
  cachedRaw = filterConversationsForUser(cachedRaw, effectiveUserId);
  if (__DEV__) console.log('[fetchConversationsForCurrentUser] Cached raw list:', cachedRaw);

  const baseList = cachedRaw.length ? cachedRaw : fallback;

  const normalized = baseList.map((item: any) =>
    normalizeConversation(item, effectiveUserId),
  );

  const chats = dedupeChats(normalized);

  return { chats, status };
}

export async function fetchConversationsForCurrentUser(
  fallback: Chat[] = [],
  currentUserId?: string,
  forceRefresh?: boolean,
): Promise<Chat[]> {
  const { chats } = await fetchConversationsForCurrentUserWithStatus(fallback, currentUserId, forceRefresh);
  return chats;
}
