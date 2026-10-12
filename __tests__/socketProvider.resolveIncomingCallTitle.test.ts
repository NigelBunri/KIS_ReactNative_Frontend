import { resolveIncomingCallTitle } from '../SocketProvider';

// Regression coverage for the real root cause of "both call participants
// see the same name": the recipient's incoming-call title used to prefer
// `payload.title` — the CALLER's own call label (startCall()'s args.title,
// which for a 1:1 call is the RECIPIENT's own name from the caller's point
// of view) — over `payload.displayName`, the server-authoritative field
// that actually carries the caller's real identity. That made the
// recipient see their own name reflected back at them as "who's calling".

describe('resolveIncomingCallTitle', () => {
  it('a 1:1 call prefers payload.displayName (the authoritative caller identity) over payload.title', () => {
    expect(
      resolveIncomingCallTitle({
        isGroupCall: false,
        payloadTitle: 'Recipient Own Name', // what the caller called this — the recipient's OWN name
        payloadDisplayName: 'Real Caller Name',
        payloadCallerName: null,
      }),
    ).toBe('Real Caller Name');
  });

  it('a 1:1 call never falls back to payload.title even when displayName is present but callerName is not', () => {
    const title = resolveIncomingCallTitle({
      isGroupCall: false,
      payloadTitle: 'Recipient Own Name',
      payloadDisplayName: 'Real Caller Name',
    });
    expect(title).not.toBe('Recipient Own Name');
  });

  it('a 1:1 call falls back to payloadCallerName when displayName is absent (e.g. an older server build)', () => {
    expect(
      resolveIncomingCallTitle({
        isGroupCall: false,
        payloadTitle: 'Recipient Own Name',
        payloadDisplayName: null,
        payloadCallerName: 'Caller Via Legacy Field',
      }),
    ).toBe('Caller Via Legacy Field');
  });

  it('a 1:1 call falls back to the generic "Incoming call" label when no identity field is available at all', () => {
    expect(
      resolveIncomingCallTitle({ isGroupCall: false, payloadTitle: 'Recipient Own Name' }),
    ).toBe('Incoming call');
  });

  it('a group/broadcast call DOES use payload.title — it is a legitimately shared room label there, not a person\'s name', () => {
    expect(
      resolveIncomingCallTitle({
        isGroupCall: true,
        payloadTitle: 'Family Group Call',
        payloadDisplayName: 'Whoever Started It',
      }),
    ).toBe('Family Group Call');
  });

  it('a group call falls back to the caller identity only when no room title was set', () => {
    expect(
      resolveIncomingCallTitle({
        isGroupCall: true,
        payloadTitle: undefined,
        payloadDisplayName: 'Whoever Started It',
      }),
    ).toBe('Whoever Started It');
  });
});
