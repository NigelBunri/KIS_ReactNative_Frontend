// src/navigation/resolveChatOpenPayload.ts
//
// Extracted from AppNavigator.tsx's 'chat.open' DeviceEventEmitter listener
// so it can be unit-tested without rendering the whole navigator (heavy
// native deps: React Navigation, Animated, BackHandler, etc.).
import type { Chat } from '@/Module/ChatRoom/messagesUtils';
import { normalizeConversation } from '@/Module/ChatRoom/normalizeConversation';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';

export type ChatOpenPayload = {
  conversationId?: string | number;
  id?: string | number;
  name?: string;
  kind?: string;
};

/**
 * Resolves a `chat.open` DeviceEventEmitter payload into a real Chat object.
 *
 * CONFIRMED gap ("phantom/generic chat room" audit): every emitter of
 * 'chat.open' across the app is expected to pass a real name, but nothing
 * enforced that - a caller that omitted it (or whose name resolved to an
 * empty string) used to silently fall back to the literal string 'Chat',
 * which is exactly the generic placeholder title users reported seeing
 * instead of the real conversation they just opened/created. Rather than
 * inventing a fake name, this fetches the real one from Django before
 * returning - only adding a network round-trip on the rare path where the
 * caller didn't already have the name on hand. Returns null when there's no
 * usable conversation id at all - callers must not invent one.
 */
export async function resolveChatOpenPayload(payload: ChatOpenPayload | null | undefined): Promise<Chat | null> {
  const convId = String(payload?.conversationId ?? payload?.id ?? '');
  if (!convId) return null;

  // 'group' is InviteJoinScreen's kind for a joined chat group; 'channel' is
  // a broadcast channel's underlying conversation (see
  // GlobalSearchScreen.tsx/BroadcastFeedSection.tsx) - both are multi-party,
  // non-direct conversations. Missing 'group' here (this used to check only
  // 'channel') left isGroup/isGroupChat both false for a freshly-joined
  // group, which made useConversationBootstrap's isDirectChat check wrongly
  // true - a joined group got treated as a DM still needing a peer to
  // select, so it opened stuck on "Select a chat to start messaging" with
  // no way to send.
  const isGroupKind = payload?.kind === 'group' || payload?.kind === 'channel';

  let resolvedName = payload?.name;
  if (!resolvedName || !String(resolvedName).trim()) {
    try {
      const res = await getRequest(`${ROUTES.chat.listConversations}${convId}/`, {
        errorMessage: '',
      });
      if (res?.success && res.data) {
        const normalized = normalizeConversation(res.data);
        resolvedName = normalized?.name;
      }
    } catch {
      // fall through to the honest placeholder below
    }
  }

  return {
    id: convId,
    conversationId: convId,
    // 'Unnamed Conversation' (not 'Chat') when even the fetch above
    // couldn't resolve a real name - reads as a data gap rather than a
    // plausible-looking fake title, and matches the exact fallback
    // normalizeConversation itself already uses elsewhere.
    name: (resolvedName && String(resolvedName).trim()) || 'Unnamed Conversation',
    kind: payload?.kind,
    communityId: payload?.kind === 'community' ? convId : undefined,
    isCommunityChat: payload?.kind === 'community',
    isGroup: isGroupKind,
    isGroupChat: isGroupKind,
  } as Chat;
}
