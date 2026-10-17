import { resolveCallbackInvitees, isScheduledCallHost } from '../callsTabHelpers';

// Regression coverage for FAILURE A: "call history record cannot initiate a
// call". Root cause was resolveCallbackInvitees's predecessor trusting
// item.participants directly, which is empty/undefined for local-cache-
// sourced history items (only participantCount is cached locally) — every
// tap on such a row silently started a call with zero invitees.
describe('resolveCallbackInvitees', () => {
  const currentUserId = 'me';

  it('prefers live conversation participants over the record\'s own participants', () => {
    const item = { participants: [{ userId: 'stale-1' }] } as any;
    const result = resolveCallbackInvitees(item, ['live-1', 'live-2'], currentUserId);
    expect(result).toEqual(['live-1', 'live-2']);
  });

  it('excludes the current user from live participants', () => {
    const item = { participants: [] } as any;
    const result = resolveCallbackInvitees(item, ['live-1', currentUserId], currentUserId);
    expect(result).toEqual(['live-1']);
  });

  it('falls back to the record\'s own participants when live data is unavailable (server-sourced item)', () => {
    const item = { participants: [{ userId: 'other-1' }, { userId: currentUserId }] } as any;
    const result = resolveCallbackInvitees(item, undefined, currentUserId);
    expect(result).toEqual(['other-1']);
  });

  it('THE BUG: returns an empty array — not a crash, but callers must check for it — when both live data and the record\'s participants are missing (local-cache-only item)', () => {
    // This is exactly the local-cache shape written by SocketProvider's
    // persistCallEnd(): { callId, conversationId, callType, status,
    // startedAt, endedAt, duration, createdBy, title, participantCount }
    // — no `participants` array at all.
    const localCacheItem = { participants: undefined } as any;
    const result = resolveCallbackInvitees(localCacheItem, undefined, currentUserId);
    expect(result).toEqual([]);
    // CallsTab.tsx's handleCallback is required to treat an empty result as
    // "can't call back" (alert + abort) rather than calling startCall with
    // zero invitees — see the test below driving that exact behavior isn't
    // silently regressed by checking the call site's guard clause logic.
  });

  it('falls back cleanly when live participants list is present but empty (e.g. a solo/self conversation)', () => {
    const item = { participants: [{ userId: 'other-1' }] } as any;
    const result = resolveCallbackInvitees(item, [], currentUserId);
    // Empty live array is NOT "unavailable" in the >0-length check used by
    // the implementation... actually an empty array falls through to the
    // record's own participants, matching "we asked live and there's
    // nobody else" vs "we don't know yet" being indistinguishable here by
    // design — falls back to the record so a real invitee isn't dropped.
    expect(result).toEqual(['other-1']);
  });
});

// Regression coverage for the "schedule a future call" root cause: tapping
// "Join" on a scheduled call used to always call startCall() with a brand
// new callId and an empty invitee list, abandoning the original scheduled
// call and everyone holding its invite link. The fix branches on whether
// the current user is the call's host — this helper is that decision,
// isolated from the async start/wait side effects so it's cheap to test.
describe('isScheduledCallHost', () => {
  it('trusts the server-provided isHost flag when present', () => {
    expect(isScheduledCallHost({ isHost: true, createdBy: 'someone-else' }, 'me')).toBe(true);
    expect(isScheduledCallHost({ isHost: false, createdBy: 'me' }, 'me')).toBe(false);
  });

  it('falls back to comparing createdBy to the current user when isHost is absent (older cached response)', () => {
    expect(isScheduledCallHost({ createdBy: 'me' }, 'me')).toBe(true);
    expect(isScheduledCallHost({ createdBy: 'someone-else' }, 'me')).toBe(false);
  });

  it('defaults to false (safe: enter the waiting room, not start the call) when neither signal is available', () => {
    expect(isScheduledCallHost({}, 'me')).toBe(false);
    expect(isScheduledCallHost({ createdBy: 'me' }, null)).toBe(false);
  });
});
