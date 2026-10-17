import type { CallHistoryItem, ScheduledCallItem } from '@/services/calls/callTypes';

/**
 * Decide whether tapping "Join" on a scheduled call should START it (the
 * host's own action — reuses the scheduled call's existing callId) or
 * enter the WAITING ROOM (everyone else, before the host has started it).
 *
 * Prefers the server's authoritative `isHost` flag (added to the
 * GET /calls/scheduled response) since it's computed server-side from the
 * real `createdBy` field; falls back to comparing `createdBy` to the local
 * user id for any older cached response that predates that flag.
 */
export function isScheduledCallHost(
  item: Pick<ScheduledCallItem, 'isHost' | 'createdBy'>,
  currentUserId: string | null | undefined,
): boolean {
  if (typeof item.isHost === 'boolean') return item.isHost;
  if (!item.createdBy || !currentUserId) return false;
  return item.createdBy === currentUserId;
}

/**
 * Resolve who to invite when calling back a call-history record.
 *
 * ROOT CAUSE this exists to fix: a call-history item's own `.participants`
 * field is only populated when the item came straight from the server's
 * /calls/history response. The local-cache copy shown instantly on load
 * (and used as a fallback whenever the network fetch hasn't landed yet —
 * a completely normal thing for a user to tap through) only carries a
 * `participantCount` number, never actual userIds. Trusting
 * `item.participants` directly meant tapping a call-history row could
 * silently start a call with ZERO invitees — the call.offer went out, but
 * nobody's device was ever rung, with no error surfaced anywhere.
 *
 * The canonical, already-correct pattern used elsewhere (ChatRoomPage's
 * header call button and its own call-history callback) never trusts a
 * call record for membership — it reads LIVE conversation participants
 * instead. This mirrors that: prefer `liveParticipantIds` (current
 * conversation membership) and only fall back to the record's own
 * participants if live data isn't available yet.
 */
export function resolveCallbackInvitees(
  item: Pick<CallHistoryItem, 'participants'>,
  liveParticipantIds: string[] | undefined,
  currentUserId: string | null | undefined,
): string[] {
  const myId = String(currentUserId ?? '');
  if (liveParticipantIds && liveParticipantIds.length > 0) {
    return liveParticipantIds.filter((id) => id && id !== myId);
  }
  return (item.participants ?? [])
    .map((p) => String(p.userId ?? ''))
    .filter((id) => id && id !== myId);
}
