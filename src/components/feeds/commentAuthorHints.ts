// src/components/feeds/commentAuthorHints.ts
//
// Small in-memory, module-level cache bridging already-fetched, already
// visibility-gated profile data (avatar_url + work_status) into
// mapCommentPayload's CommentMessage construction - same problem, same
// fix as src/services/calls/participantProfileHints.ts: the comment
// socket (CHAT_WS_URL, the separate Nest chat backend - see
// src/network/config.ts) carries only {senderId, senderName} in its
// chat.message/chat.history payloads, no avatar or work-status data at
// all, and extending that service is out of reach here.
//
// Fed by FeedScreen.tsx from data it already has gated and in hand: the
// current viewer's own profile, and each post's own author (from the same
// REST post-list fetch that already surfaces author.work_status - see
// apps.communities/apps.partners' *PostSerializer.author). A cache miss
// (someone who commented but was never otherwise seen as a post author or
// the viewer themself) simply degrades to the prior behavior: initials,
// no ring - same documented tradeoff participantProfileHints.ts accepts.
type AuthorHint = { avatarUrl?: string | null; workStatus?: string | null };

const hints = new Map<string, AuthorHint>();

export function registerCommentAuthorHints(
  entries: Array<{ userId?: string | number | null } & AuthorHint>,
): void {
  for (const entry of entries ?? []) {
    const userId = String(entry?.userId ?? '').trim();
    if (!userId) continue;
    const prev = hints.get(userId) ?? {};
    const next: AuthorHint = {
      avatarUrl: entry.avatarUrl ?? prev.avatarUrl ?? null,
      workStatus: entry.workStatus ?? prev.workStatus ?? null,
    };
    hints.set(userId, next);
  }
}

export function getCommentAuthorHint(userId?: string | number | null): AuthorHint | undefined {
  const id = String(userId ?? '').trim();
  if (!id) return undefined;
  return hints.get(id);
}

/** Test-only reset so suites don't bleed state between cases. */
export function __resetCommentAuthorHintsForTests(): void {
  hints.clear();
}
