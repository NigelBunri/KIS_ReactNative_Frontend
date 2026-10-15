import { applyRaisedHands } from '../SocketProvider';

// Regression for AND-093: a participant could raise their hand (tracked
// correctly in session.raisedHands, which is what CallControls reads for
// the local button) but every other UI surface — ParticipantTile,
// ParticipantsSheet, VoiceCallGrid, BroadcastLayout — reads
// participant.handRaised, which was initialized to false and never updated.
// A raised hand was therefore invisible to every other participant.

type P = { userId: string; handRaised: boolean };

function makeParticipants(ids: string[]): P[] {
  return ids.map(userId => ({ userId, handRaised: false }));
}

describe('applyRaisedHands', () => {
  it('marks a participant whose id is in raisedHands as handRaised: true', () => {
    const participants = makeParticipants(['alice', 'bob', 'carol']);
    const result = applyRaisedHands(participants, ['bob']);
    expect(result.find(p => p.userId === 'bob')?.handRaised).toBe(true);
    expect(result.find(p => p.userId === 'alice')?.handRaised).toBe(false);
    expect(result.find(p => p.userId === 'carol')?.handRaised).toBe(false);
  });

  it('lowers a previously-raised hand when the id is removed from raisedHands', () => {
    const participants: P[] = [
      { userId: 'alice', handRaised: true },
      { userId: 'bob', handRaised: false },
    ];
    const result = applyRaisedHands(participants, []);
    expect(result.find(p => p.userId === 'alice')?.handRaised).toBe(false);
  });

  it('supports multiple simultaneously raised hands', () => {
    const participants = makeParticipants(['alice', 'bob', 'carol']);
    const result = applyRaisedHands(participants, ['alice', 'carol']);
    expect(result.map(p => p.handRaised)).toEqual([true, false, true]);
  });

  it('returns the same participant object reference when its handRaised value does not change', () => {
    // Keeps setActiveCall from forcing unnecessary re-renders of every tile
    // on every unrelated raise/lower elsewhere in the call.
    const alice: P = { userId: 'alice', handRaised: false };
    const bob: P = { userId: 'bob', handRaised: true };
    const [resultAlice, resultBob] = applyRaisedHands([alice, bob], ['bob']);
    expect(resultAlice).toBe(alice);
    expect(resultBob).toBe(bob);
  });

  it('is a no-op on an empty participant list', () => {
    expect(applyRaisedHands([], ['ghost'])).toEqual([]);
  });
});
