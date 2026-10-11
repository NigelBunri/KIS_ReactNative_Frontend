import { decidePendingCallPresentation } from '../SocketProvider';

// Regression coverage for "the phone rings — including in the background,
// including with the Activity brought forward on Android — but the
// incoming-call screen never appears". Root cause: displayIncomingCall()
// (native ring) and bringCallToForeground() (Android Activity launch) both
// already fired correctly, but the only code that ever read the persisted
// pending-call payload (resolveSessionForCallKitEvent) was wired exclusively
// to native CallKit 'answerCall'/'endCall' events — which never fire on
// Android, since KIS's phone account is non-self-managed and renders its own
// call UI entirely in JS. Nothing was left to proactively present the
// screen once the app came forward. decidePendingCallPresentation is the
// pure decision core of the fix: on every foreground/mount, check for a
// pending payload and present it if (and only if) it's still valid.

const BASE_NOW = 1_700_000_000_000;

describe('decidePendingCallPresentation', () => {
  it('presents a fresh pending call when there is no active call and the user id is known', () => {
    expect(
      decidePendingCallPresentation({
        hasActiveCall: false,
        pending: { savedAtMs: BASE_NOW - 1_000 },
        nowMs: BASE_NOW,
        myUserId: 'user-1',
      }),
    ).toEqual({ action: 'present' });
  });

  it('skips when a call is already active — idempotent across repeated foreground events while legitimately ringing', () => {
    expect(
      decidePendingCallPresentation({
        hasActiveCall: true,
        pending: { savedAtMs: BASE_NOW - 1_000 },
        nowMs: BASE_NOW,
        myUserId: 'user-1',
      }),
    ).toEqual({ action: 'skip_active_call' });
  });

  it('skips when there is no pending payload at all — the common case, every ordinary app resume', () => {
    expect(
      decidePendingCallPresentation({
        hasActiveCall: false,
        pending: null,
        nowMs: BASE_NOW,
        myUserId: 'user-1',
      }),
    ).toEqual({ action: 'skip_no_payload' });
  });

  it('treats a payload saved before the savedAtMs field existed (undefined) as fresh rather than silently dropping it', () => {
    expect(
      decidePendingCallPresentation({
        hasActiveCall: false,
        pending: {},
        nowMs: BASE_NOW,
        myUserId: 'user-1',
      }),
    ).toEqual({ action: 'present' });
  });

  it('presents a payload right at the boundary (under 95s old)', () => {
    expect(
      decidePendingCallPresentation({
        hasActiveCall: false,
        pending: { savedAtMs: BASE_NOW - 94_999 },
        nowMs: BASE_NOW,
        myUserId: 'user-1',
      }),
    ).toEqual({ action: 'present' });
  });

  it('skips a stale payload past the 95s margin over the server-side 90s ring timeout, reporting the exact age', () => {
    expect(
      decidePendingCallPresentation({
        hasActiveCall: false,
        pending: { savedAtMs: BASE_NOW - 95_001 },
        nowMs: BASE_NOW,
        myUserId: 'user-1',
      }),
    ).toEqual({ action: 'skip_stale', ageMs: 95_001 });
  });

  it('skips a very old payload (e.g. app was killed for hours) rather than ringing a long-dead call', () => {
    const decision = decidePendingCallPresentation({
      hasActiveCall: false,
      pending: { savedAtMs: BASE_NOW - 6 * 60 * 60 * 1000 },
      nowMs: BASE_NOW,
      myUserId: 'user-1',
    });
    expect(decision.action).toBe('skip_stale');
  });

  it('skips when the current user id has not resolved yet, even for a fresh payload — auth not ready', () => {
    expect(
      decidePendingCallPresentation({
        hasActiveCall: false,
        pending: { savedAtMs: BASE_NOW - 1_000 },
        nowMs: BASE_NOW,
        myUserId: '',
      }),
    ).toEqual({ action: 'skip_no_user' });
  });

  it('active-call guard takes priority over staleness — avoids acting on a stale payload the caller never needed to inspect', () => {
    expect(
      decidePendingCallPresentation({
        hasActiveCall: true,
        pending: { savedAtMs: BASE_NOW - 999_999 },
        nowMs: BASE_NOW,
        myUserId: 'user-1',
      }),
    ).toEqual({ action: 'skip_active_call' });
  });

  it('no-payload guard takes priority over the missing-user-id check', () => {
    expect(
      decidePendingCallPresentation({
        hasActiveCall: false,
        pending: null,
        nowMs: BASE_NOW,
        myUserId: '',
      }),
    ).toEqual({ action: 'skip_no_payload' });
  });
});
