import { resolveEndCallAction } from '../SocketProvider';

describe('resolveEndCallAction', () => {
  it('a plain participant (not host, not group admin) can only leave, even mid-call with others present', () => {
    expect(
      resolveEndCallAction({ isHost: false, isGroupAdmin: false, otherJoined: 3, callIsLive: true }),
    ).toBe('leave');
  });

  it('regression: a non-host no longer ends the call for everyone just because nobody else has joined yet', () => {
    // This is exactly the shape of the original bug — the old code's
    // `else` branch matched both "no host, and nobody joined" AND
    // "no host, live call with others" and called endCallForAll() for
    // both. A plain participant must always get 'leave', never 'endAll'.
    expect(
      resolveEndCallAction({ isHost: false, isGroupAdmin: false, otherJoined: 0, callIsLive: false }),
    ).toBe('leave');
  });

  it('the host gets the leave-or-end-for-all choice once others have joined a live call', () => {
    expect(
      resolveEndCallAction({ isHost: true, isGroupAdmin: false, otherJoined: 2, callIsLive: true }),
    ).toBe('choice');
  });

  it('a group admin (not the call host) also gets the choice on a live call with others present', () => {
    expect(
      resolveEndCallAction({ isHost: false, isGroupAdmin: true, otherJoined: 2, callIsLive: true }),
    ).toBe('choice');
  });

  it('the host cancels the outgoing call directly (no dialog) while nobody has joined yet', () => {
    expect(
      resolveEndCallAction({ isHost: true, isGroupAdmin: false, otherJoined: 0, callIsLive: false }),
    ).toBe('endAll');
  });

  it('a group admin also cancels directly while nobody has joined yet', () => {
    expect(
      resolveEndCallAction({ isHost: false, isGroupAdmin: true, otherJoined: 0, callIsLive: false }),
    ).toBe('endAll');
  });

  it('the host still gets endAll (not the choice dialog) if the call state is not yet live, even with entries in participants', () => {
    // e.g. still in a 'connecting'/'lobby' state — callIsLive only covers
    // 'active'/'reconnecting'.
    expect(
      resolveEndCallAction({ isHost: true, isGroupAdmin: false, otherJoined: 1, callIsLive: false }),
    ).toBe('endAll');
  });
});
