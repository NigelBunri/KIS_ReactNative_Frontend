// src/services/calls/participantProfileHints.ts
//
// Small in-memory, module-level cache that bridges already-fetched,
// already visibility-gated profile data (avatar_url + work_status - both
// served through apps.accounts.serializers.ProfileSerializer.to_representation
// -> get_visible_work_status, exactly the same path every other avatar in
// this app already goes through) into CallParticipant construction over in
// SocketProvider.tsx's makeParticipant().
//
// Real-time call signaling itself runs through a separate NestJS service
// (see NEST_API_BASE_URL in src/network/routes/socialRoutes.ts) that is not
// part of this app's own Django backend, and its call.offer/
// call.participant.joined/etc payloads carry only {userId, displayName} -
// no avatar or work-status data at all, and extending that service is out
// of reach here. Rather than inventing a second, parallel (and likely
// ungated) fetch straight to Django from inside the call-signaling layer,
// this cache is fed by screens that ALREADY hold gated profile data for the
// same users - right now, ChatRoomPage's conversation-member fetch, which
// is where the chat list / message-bubble work-status ring already reads
// `p.user.profile.work_status` from - and consulted by makeParticipant. A
// cache miss (e.g. a call started before the conversation's members ever
// loaded) simply degrades to the prior behavior: no avatar, no ring.
type ProfileHint = { avatarUrl?: string | null; workStatus?: string | null };

const hints = new Map<string, ProfileHint>();

export function registerParticipantProfileHints(
  entries: Array<{ userId?: string | number | null } & ProfileHint>,
): void {
  for (const entry of entries ?? []) {
    const userId = String(entry?.userId ?? '').trim();
    if (!userId) continue;
    const prev = hints.get(userId) ?? {};
    const next: ProfileHint = {
      avatarUrl: entry.avatarUrl ?? prev.avatarUrl ?? null,
      workStatus: entry.workStatus ?? prev.workStatus ?? null,
    };
    hints.set(userId, next);
  }
}

export function getParticipantProfileHint(
  userId?: string | number | null,
): ProfileHint | undefined {
  const id = String(userId ?? '').trim();
  if (!id) return undefined;
  return hints.get(id);
}

/** Test-only reset so suites don't bleed state between cases. */
export function __resetParticipantProfileHintsForTests(): void {
  hints.clear();
}
