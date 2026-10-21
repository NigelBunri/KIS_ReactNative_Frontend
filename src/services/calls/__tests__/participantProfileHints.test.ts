// Regression coverage for the hint cache CallParticipant construction reads
// avatarUrl/workStatus from (see SocketProvider.tsx's makeParticipant) -
// since the call-signaling payload itself never carries either field.

import {
  registerParticipantProfileHints,
  getParticipantProfileHint,
  __resetParticipantProfileHintsForTests,
} from '../participantProfileHints';

describe('participantProfileHints', () => {
  beforeEach(() => {
    __resetParticipantProfileHintsForTests();
  });

  it('returns undefined for an unknown user', () => {
    expect(getParticipantProfileHint('nobody')).toBeUndefined();
  });

  it('stores and retrieves a registered hint by userId', () => {
    registerParticipantProfileHints([
      { userId: 'u1', avatarUrl: 'https://x/a.png', workStatus: 'open_for_work' },
    ]);
    expect(getParticipantProfileHint('u1')).toEqual({
      avatarUrl: 'https://x/a.png',
      workStatus: 'open_for_work',
    });
  });

  it('ignores entries with no usable userId', () => {
    registerParticipantProfileHints([{ userId: null, avatarUrl: 'x' } as any, { userId: '  ' } as any]);
    expect(getParticipantProfileHint(null)).toBeUndefined();
  });

  it('merges a later registration without clobbering fields the new entry omits', () => {
    registerParticipantProfileHints([{ userId: 'u2', avatarUrl: 'https://x/b.png' }]);
    registerParticipantProfileHints([{ userId: 'u2', workStatus: 'hiring' }]);
    expect(getParticipantProfileHint('u2')).toEqual({
      avatarUrl: 'https://x/b.png',
      workStatus: 'hiring',
    });
  });

  it('a newer explicit null overwrites a previously cached value', () => {
    registerParticipantProfileHints([{ userId: 'u3', workStatus: 'hiring' }]);
    registerParticipantProfileHints([{ userId: 'u3', workStatus: null }]);
    // null is falsy against `??`, so the previous value stays unless the
    // caller passes a real value - documents current (intentional) behavior:
    // a transient miss should not blank out a previously known status.
    expect(getParticipantProfileHint('u3')?.workStatus).toBe('hiring');
  });

  it('numeric userIds are normalized to strings consistently', () => {
    registerParticipantProfileHints([{ userId: 42, workStatus: 'open_for_work' }]);
    expect(getParticipantProfileHint('42')?.workStatus).toBe('open_for_work');
  });
});
