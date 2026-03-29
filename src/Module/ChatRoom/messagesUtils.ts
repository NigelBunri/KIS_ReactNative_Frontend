import { KIS_TOKENS } from '@/theme/constants';
import { StyleSheet } from 'react-native';

/* ----------------------------- Types & Storage ----------------------------- */

// Wire types that may arrive from your Django API
export type UserWire = {
  id: string;
  display_name?: string | null;
  username?: string | null;
  phone?: string | null;
  [key: string]: any;
};

export type ParticipantWire = {
  id?: number | string;
  user?: UserWire | number | string | null;
  base_role?: string;
  display_name?: string;
  joined_at?: string | null;
  left_at?: string | null;
  is_active?: boolean;
  [key: string]: any;
};

export type Chat = {
  /* Core identity */
  id: string;
  name: string;
  title?: string;
  avatarUrl?: string;

  /* List-preview metadata (Messages tab) */
  lastMessage?: string;
  lastAt?: string;
  unreadCount?: number;
  hasMention?: boolean;
  hasMedia?: boolean;
  // participants can be a simple string list OR the richer wire payload from server
  participants?: string[] | ParticipantWire[];

  /**
   * Conversation type – mirrors Django Conversation.type
   * ('direct' | 'group' | 'channel' | 'post' | 'thread' | 'system'),
   */
  kind?: 'direct' | 'group' | 'community' | 'channel' | 'post' | 'thread' | 'system';
  isGroup?: boolean;
  isGroupChat?: boolean;
  isCommunityChat?: boolean;
  isContactChat?: boolean;
  isDirect?: boolean;
  isSubscribed?: boolean;
  canPost?: boolean;

  groupId?: string | number;
  communityId?: string | number;
  contactPhone?: string;

  /* Backend / conversation metadata (Django / Nest) */
  conversationId?: string;

  /* DM request / lock metadata (optional rich shapes supported) */
  requestState?: 'none' | 'pending' | 'accepted' | 'rejected' | string;

  // request initiator/recipient may be either a simple id string
  // OR a full nested user object (wire shape)
  requestInitiatorId?: string | UserWire | null;
  requestRecipientId?: string | UserWire | null;

  requestInitiatorName?: string | null;
  requestRecipientName?: string | null;

  isRequestOutbound?: boolean;
  isRequestInbound?: boolean;

  isArchived?: boolean;
  isLocked?: boolean;
  isBlocked?: boolean;
  isMuted?: boolean;
};

export type CustomFilterRule = {
  name: string;
  includeGroups?: boolean;
  includeDMs?: boolean;
  onlyUnread?: boolean;
  onlyMentions?: boolean;
  withMedia?: boolean;
  minUnread?: number;
  participantIncludes?: string;
  nameIncludes?: string;
};

export type CustomFilter = {
  id: string;
  label: string;
  rules: CustomFilterRule;
};

export const CUSTOM_FILTERS_KEY = 'kis_custom_filters:v1';

/* ------------------------------ Helpers ------------------------------ */

/**
 * Safely extracts a plain string list from `chat.participants`.
 * Supports both `string[]` (legacy) and `ParticipantWire[]` (server).
 */
export function participantsToStrings(participants?: string[] | ParticipantWire[]): string[] {
  if (!participants) return [];
  // already strings
  if (Array.isArray(participants) && participants.length > 0 && typeof participants[0] === 'string') {
    return (participants as string[]).map((s) => String(s));
  }

  // wire objects
  if (Array.isArray(participants)) {
    const out: string[] = [];
    for (const p of participants as ParticipantWire[]) {
      if (!p) continue;
      // prefer nested user display_name / phone
      const u = (p as ParticipantWire).user;
      if (u && typeof u === 'object') {
        const name = (u as UserWire).display_name ?? (u as UserWire).username ?? (u as UserWire).phone;
        if (name) out.push(String(name));
        continue;
      }

      // if `user` is an id string/number, fall back to participant.display_name
      if ((p as ParticipantWire).display_name) {
        out.push(String((p as ParticipantWire).display_name));
        continue;
      }

      // finally, try id
      if ((p as ParticipantWire).id != null) {
        out.push(String((p as ParticipantWire).id));
      }
    }
    return out;
  }

  return [];
}

export function directConversationName(
  participants: string[] | ParticipantWire[] | undefined,
  currentUserId: string | undefined,
): string | null {
  if (!participants) return null;
  const hasCurrentUser = !!currentUserId;

  if (Array.isArray(participants) && participants.length > 0 && typeof participants[0] === 'string') {
    const list = (participants as string[]).map((s) => String(s));
    const other = hasCurrentUser
      ? list.find((s) => s && s !== currentUserId)
      : list.find((s) => s);
    return other ?? null;
  }

  if (Array.isArray(participants)) {
    for (const p of participants as ParticipantWire[]) {
      if (!p) continue;
      const u = (p as ParticipantWire).user;
      if (u && typeof u === 'object') {
        const uid = String((u as UserWire).id ?? '');
        if (hasCurrentUser && uid && uid === String(currentUserId)) continue;
        const name =
          (u as UserWire).display_name ??
          (u as UserWire).username ??
          (u as UserWire).phone;
        if (name) return String(name);
      }

      if ((p as ParticipantWire).display_name && String((p as ParticipantWire).display_name)) {
        const name = String((p as ParticipantWire).display_name);
        return name;
      }

      if ((p as ParticipantWire).id != null && (!hasCurrentUser || String((p as ParticipantWire).id) !== String(currentUserId))) {
        return String((p as ParticipantWire).id);
      }
    }
  }

  return null;
}

export function directConversationAvatar(
  participants: string[] | ParticipantWire[] | undefined,
  currentUserId: string | undefined,
): string | null {
  if (!participants) return null;
  const hasCurrentUser = !!currentUserId;

  if (Array.isArray(participants)) {
    for (const p of participants as ParticipantWire[]) {
      if (!p) continue;
      const u = (p as ParticipantWire).user;
      if (u && typeof u === 'object') {
        const uid = String((u as UserWire).id ?? '');
        if (hasCurrentUser && uid && uid === String(currentUserId)) continue;
        const avatar =
          (u as any)?.profile?.avatar_url ??
          (u as any)?.profile?.avatarUrl ??
          (u as any)?.avatar_url ??
          (u as any)?.avatarUrl;
        if (avatar) return String(avatar);
      }

      const fallback =
        (p as any)?.avatar_url ??
        (p as any)?.avatarUrl ??
        (p as any)?.user?.avatar_url ??
        (p as any)?.user?.avatarUrl;
      if (fallback) return String(fallback);
    }
  }

  return null;
}

export function participantsToIds(participants?: string[] | ParticipantWire[]): string[] {
  if (!participants) return [];
  if (Array.isArray(participants) && participants.length > 0 && typeof participants[0] === 'string') {
    return (participants as string[]).map((s) => String(s));
  }

  if (Array.isArray(participants)) {
    const out: string[] = [];
    for (const p of participants as ParticipantWire[]) {
      if (!p) continue;
      const u = (p as ParticipantWire).user;
      if (u && typeof u === 'object') {
        const id = (u as UserWire).id;
        if (id) out.push(String(id));
        continue;
      }
      if ((p as ParticipantWire).user != null && (typeof (p as ParticipantWire).user === 'string' || typeof (p as ParticipantWire).user === 'number')) {
        out.push(String((p as ParticipantWire).user));
        continue;
      }
      if ((p as ParticipantWire).id != null) {
        out.push(String((p as ParticipantWire).id));
      }
    }
    return out;
  }

  return [];
}

export function normalizePhoneKey(phone?: string | null): string {
  if (!phone) return '';
  return String(phone).replace(/[^0-9+]/g, '');
}

export function otherParticipantPhone(
  participants: string[] | ParticipantWire[] | undefined,
  currentUserId: string | undefined,
): string | null {
  if (!participants || !currentUserId) return null;

  if (Array.isArray(participants)) {
    for (const p of participants as ParticipantWire[]) {
      if (!p) continue;
      const u = (p as ParticipantWire).user;
      if (u && typeof u === 'object') {
        const uid = String((u as UserWire).id ?? '');
        if (uid && uid === String(currentUserId)) continue;
        const phone = (u as UserWire).phone;
        if (phone) return String(phone);
      }
    }
  }

  return null;
}

/**
 * Try to pick a friendly display name for a participant wire (used in request banners)
 */
export function participantDisplayName(p?: ParticipantWire | string): string | null {
  if (!p) return null;
  if (typeof p === 'string') return p;
  const u = (p as ParticipantWire).user;
  if (u && typeof u === 'object') {
    return (u as UserWire).display_name ?? (u as UserWire).username ?? (u as UserWire).phone ?? null;
  }
  return (p as ParticipantWire).display_name ?? null;
}

/**
 * Normalizes server-side conversation payload into the Chat shape used by the UI.
 * Accepts partial shapes and is safe to call repeatedly.
 */
export function normalizeChatFromServer(raw: any): Chat {
  const chat: Partial<Chat> = {};
  chat.id = raw?.id ? String(raw.id) : raw?.conversationId ? String(raw.conversationId) : 'unknown';
  chat.name = raw?.name ?? raw?.title ?? 'Unnamed Conversation';
  chat.title = raw?.title ?? undefined;
  chat.avatarUrl = raw?.avatar_url ?? raw?.avatarUrl ?? undefined;

  chat.lastMessage = raw?.lastMessage ?? raw?.last_message ?? raw?.last_message_preview ?? undefined;
  chat.lastAt = raw?.lastAt ?? raw?.last_at ?? undefined;
  chat.unreadCount = typeof raw?.unreadCount === 'number' ? raw.unreadCount : raw?.unread_count ?? 0;
  chat.hasMention = raw?.hasMention ?? raw?.has_mention ?? false;
  chat.hasMedia = raw?.hasMedia ?? raw?.has_media ?? false;

  // participants: if the server uses "participants" as rich objects, keep them.
  if (Array.isArray(raw?.participants)) {
    // Heuristic: if first participant has `.user` key it's the rich form
    if (raw.participants.length > 0 && raw.participants[0] && raw.participants[0].user != null) {
      chat.participants = raw.participants as ParticipantWire[];
    } else {
      chat.participants = (raw.participants || []).map((p: any) => String(p));
    }
  } else if (Array.isArray(raw?.participants_list)) {
    chat.participants = raw.participants_list.map((p: any) => String(p));
  }

  chat.kind = raw?.kind ?? raw?.type ?? undefined;
  chat.isGroup = !!raw?.isGroup;
  chat.isGroupChat = !!raw?.isGroupChat;
  chat.isCommunityChat = !!raw?.isCommunityChat;
  chat.isContactChat = !!raw?.isContactChat;
  chat.isDirect = !!raw?.isDirect;

  chat.groupId = raw?.groupId ?? raw?.group_id ?? undefined;
  chat.communityId = raw?.communityId ?? raw?.community_id ?? undefined;
  chat.contactPhone = raw?.contactPhone ?? raw?.contact_phone ?? undefined;

  chat.conversationId = raw?.conversationId ?? raw?.conversation_id ?? (raw?.id ? String(raw.id) : undefined);

  // DM request fields (flexible)
  chat.requestState = raw?.requestState ?? raw?.request_state ?? raw?.request_state_raw ?? undefined;

  const maybeInitiator = raw?.requestInitiatorId ?? raw?.request_initiator ?? raw?.requestInitiator ?? null;
  const maybeRecipient = raw?.requestRecipientId ?? raw?.request_recipient ?? raw?.requestRecipient ?? null;

  chat.requestInitiatorId = maybeInitiator;
  chat.requestRecipientId = maybeRecipient;

  chat.requestInitiatorName = participantDisplayName(maybeInitiator as any) ?? null;
  chat.requestRecipientName = participantDisplayName(maybeRecipient as any) ?? null;

  return chat as Chat;
}

/* ------------------------------ Filter utils ------------------------------ */

export type QuickChip = 'Unread' | 'Groups' | 'Mentions' | 'Archived' | 'Blocked' | 'Community';

export function applyQuickChips(chat: Chat, chips: Set<QuickChip>) {
  if (chips.has('Unread') && (chat.unreadCount ?? 0) <= 0) return false;
  if (chips.has('Groups') && !chat.isGroup) return false;
  if (chips.has('Community') && !(chat.isCommunityChat || chat.kind === 'community' || chat.kind === 'post')) return false;
  if (chips.has('Mentions') && !chat.hasMention) return false;
  if (chips.has('Archived') && !chat.isArchived) return false;
  if (chips.has('Blocked') && !chat.isBlocked) return false;
  return true;
}

export function applyCustomRules(chat: Chat, rules?: CustomFilterRule) {
  if (!rules) return true;
  if (rules.onlyUnread && (chat.unreadCount ?? 0) <= 0) return false;
  if (rules.onlyMentions && !chat.hasMention) return false;

  if (rules.includeGroups === true && !chat.isGroup) return false;
  if (rules.includeDMs === true && chat.isGroup) return false;

  if (typeof rules.minUnread === 'number' && (chat.unreadCount ?? 0) < rules.minUnread) return false;

  if (rules.withMedia === true && !chat.hasMedia) return false;

  if (rules.participantIncludes?.trim()) {
    const q = rules.participantIncludes.trim().toLowerCase();
    const hay = participantsToStrings(chat.participants).join(' ').toLowerCase();
    if (!hay.includes(q)) return false;
  }

  if (rules.nameIncludes?.trim()) {
    const q = rules.nameIncludes.trim().toLowerCase();
    if (!chat.name.toLowerCase().includes(q)) return false;
  }

  return true;
}

export function bySearch(chat: Chat, query: string) {
  if (!query.trim()) return true;
  const q = query.toLowerCase();
  return (
    chat.name.toLowerCase().includes(q) ||
    (chat.lastMessage ?? '').toLowerCase().includes(q) ||
    participantsToStrings(chat.participants).join(' ').toLowerCase().includes(q)
  );
}

/* --------------------------------- Styles --------------------------------- */

export const styles = StyleSheet.create({
  wrap: { flex: 1 },

  /* App Bar */
  appBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingBottom: 10,
    paddingTop: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  appBarLeft: { flex: 1 },
  appName: { fontSize: 22, fontWeight: '900', letterSpacing: 0.3 },
  appSubtitle: { marginTop: 2, fontSize: 12, letterSpacing: 0.2 },
  appBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 10,
  },

  /* Search */
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    height: KIS_TOKENS.controlHeights.md,
    borderRadius: KIS_TOKENS.radius.xl,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: KIS_TOKENS.typography.input,
    marginHorizontal: 8,
  },
  searchIconBtn: {
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRadius: 8,
  },
  searchDivider: { width: 1, height: 24, opacity: 0.5, marginHorizontal: 4 },

  /* Chips */
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    flexWrap: 'wrap',
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 2,
  },

  /* Chat Row */
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 16,
    borderWidth: 2,
    marginBottom: 12,
  },
  name: { fontWeight: '700', marginBottom: 2, fontSize: 16 },
  avatar: { width: 44, height: 44, borderRadius: 22 },

  /* Dropdown */
  menuOverlay: {
    position: 'absolute',
    top: 0,
    bottom: -100,
    left: 0,
    right: 0,
  },
  menuBox: {
    position: 'absolute',
    width: 200,
    borderRadius: 12,
    borderWidth: 2,
    paddingVertical: 6,
  },
  menuItem: { paddingHorizontal: 14, paddingVertical: 12 },

  /* Centers */
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  /* Modal */
  modalWrap: { flex: 1, justifyContent: 'flex-end' },
  modalCard: {
    padding: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 2,
  },
  searchOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    justifyContent: 'flex-start',
  },
  searchOverlayBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  searchOverlayCard: {
    marginTop: 10,
    marginHorizontal: 12,
    borderWidth: 2,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchOverlayRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 10 },

  input: {
    borderWidth: 2,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 6,
  },
  pillBtn: {
    borderWidth: 2,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedFilterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  footerBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
});
