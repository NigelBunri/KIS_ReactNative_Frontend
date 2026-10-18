import { shouldIgnoreDuplicateCallOffer } from '../SocketProvider';

// Regression coverage for "a contact invited to an active call doesn't
// reliably get rung": the call.offer listener's duplicate-offer guard
// previously excluded 'ended'/'missed' from the states it's safe to
// re-render from. call.invite reuses the SAME callId when the host
// re-adds a contact to an already-active call - so a contact who had
// already declined/missed that exact callId once had their device's
// local session sitting in 'ended'/'missed', and a genuinely new re-invite
// for the same callId was silently dropped as if it were a stale duplicate.

describe('shouldIgnoreDuplicateCallOffer', () => {
  it('does not ignore when there is no existing session at all (first-ever offer)', () => {
    expect(shouldIgnoreDuplicateCallOffer(null, 'call-1')).toBe(false);
    expect(shouldIgnoreDuplicateCallOffer(undefined, 'call-1')).toBe(false);
  });

  it('does not ignore an offer for a DIFFERENT callId than the existing session', () => {
    expect(shouldIgnoreDuplicateCallOffer({ callId: 'call-1', state: 'active' }, 'call-2')).toBe(false);
  });

  it('ignores a duplicate offer for a call already in progress (active/connecting/ringing/dialing/reconnecting)', () => {
    for (const state of ['active', 'connecting', 'ringing', 'dialing', 'reconnecting'] as const) {
      expect(shouldIgnoreDuplicateCallOffer({ callId: 'call-1', state }, 'call-1')).toBe(true);
    }
  });

  it('does NOT ignore a re-offer for a call we have not acted on yet', () => {
    for (const state of ['incoming', 'lobby', 'waiting-for-host'] as const) {
      expect(shouldIgnoreDuplicateCallOffer({ callId: 'call-1', state }, 'call-1')).toBe(false);
    }
  });

  it('does NOT ignore a re-invite for a callId whose local session already concluded (ended/missed) — the actual bug fixed here', () => {
    expect(shouldIgnoreDuplicateCallOffer({ callId: 'call-1', state: 'ended' }, 'call-1')).toBe(false);
    expect(shouldIgnoreDuplicateCallOffer({ callId: 'call-1', state: 'missed' }, 'call-1')).toBe(false);
  });
});
