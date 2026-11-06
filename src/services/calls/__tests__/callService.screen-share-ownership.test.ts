// Regression coverage for the follow-up pass: toggleScreenShare's
// call.screen_share emit was fire-and-forget, so a server-side
// SCREEN_SHARE_IN_USE rejection (the backstop for two people tapping
// "Share" within the same instant) had no reliable way to reach the loser.
// Fixed by requesting ownership via an ACKED emit (socket.timeout(ms).emit)
// BEFORE touching any peer connection/SFU state - see callService.ts's
// requestScreenShareOwnership and ScreenShareRejectedError.

jest.mock('../webRTCService', () => ({
  webRTCService: {
    getLocalStream: jest.fn(() => ({ getVideoTracks: () => [] })),
    peers: new Map(),
  },
  presentIOSScreenCapturePicker: jest.fn(() => true),
}));

jest.mock('../sfuService', () => ({
  sfuService: { isJoined: false, replaceTrack: jest.fn() },
}));

const mockGetDisplayMedia = jest.fn();
jest.mock(
  'react-native-webrtc',
  () => ({ mediaDevices: { getDisplayMedia: mockGetDisplayMedia } }),
  { virtual: true },
);

import { webRTCService } from '../webRTCService';
import {
  toggleScreenShare,
  registerIOSScreenCapturePickerRef,
  ScreenShareRejectedError,
} from '../callService';

function makeFakeTrack() {
  return { kind: 'video', enabled: true, stop: jest.fn(), addEventListener: jest.fn() };
}

/** A fake socket whose ownership-request ack behavior is configurable per test. */
function makeSocket(ackBehavior: (cb: (err: any, ack: any) => void) => void) {
  const ownershipEmit = jest.fn((_event: string, _payload: any, cb: (err: any, ack: any) => void) => {
    ackBehavior(cb);
  });
  return {
    emit: jest.fn(),
    timeout: jest.fn(() => ({ emit: ownershipEmit })),
    ownershipEmit,
  };
}

describe('toggleScreenShare — ownership race (ack-based rejection)', () => {
  let sessionCounter = 0;
  let sessionId: string;
  let screenTrack: any;
  let pc: any;

  beforeEach(() => {
    jest.clearAllMocks();
    registerIOSScreenCapturePickerRef({ current: {} });
    sessionId = `ownership-session-${++sessionCounter}`;
    screenTrack = makeFakeTrack();
    pc = { getSenders: jest.fn(() => []), addTrack: jest.fn() };
    (webRTCService as any).peers = new Map([['peer-1', pc]]);
    mockGetDisplayMedia.mockReset();
    mockGetDisplayMedia.mockResolvedValue({ getVideoTracks: () => [screenTrack] });
  });

  it('asks for ownership BEFORE touching any peer connection', async () => {
    let capturedCb: ((err: any, ack: any) => void) | null = null;
    const socket = makeSocket((cb) => { capturedCb = cb; }); // never resolves yet
    const promise = toggleScreenShare(sessionId, socket, []);

    // Give the microtask queue a tick so getDisplayMedia + the ownership
    // emit have both run, but the ack hasn't fired yet.
    await Promise.resolve();
    await Promise.resolve();

    expect(socket.ownershipEmit).toHaveBeenCalled();
    expect(pc.addTrack).not.toHaveBeenCalled();

    // Resolve it now so the test doesn't leave a dangling promise.
    capturedCb!(null, { ok: true, data: { delivered: true } });
    await promise;
  });

  it('succeeds and mutates peer connections when the server grants ownership', async () => {
    const socket = makeSocket((cb) => cb(null, { ok: true, data: { delivered: true } }));
    const result = await toggleScreenShare(sessionId, socket, []);

    expect(result).toBe(true);
    expect(pc.addTrack).toHaveBeenCalledWith(screenTrack);
  });

  it('rejects with SCREEN_SHARE_IN_USE, stops the captured track, and never touches a peer connection when the server denies ownership', async () => {
    const socket = makeSocket((cb) =>
      cb(null, { ok: false, error: 'Someone else is already sharing their screen', code: 'SCREEN_SHARE_IN_USE' }));

    await expect(toggleScreenShare(sessionId, socket, [])).rejects.toMatchObject({
      name: 'ScreenShareRejectedError',
      code: 'SCREEN_SHARE_IN_USE',
    });

    expect(screenTrack.stop).toHaveBeenCalled();
    expect(pc.addTrack).not.toHaveBeenCalled();
  });

  it('is an instance of ScreenShareRejectedError (not a plain Error) on rejection, so callers can distinguish it by type too', async () => {
    const socket = makeSocket((cb) =>
      cb(null, { ok: false, error: 'in use', code: 'SCREEN_SHARE_IN_USE' }));

    let caught: any = null;
    try {
      await toggleScreenShare(sessionId, socket, []);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ScreenShareRejectedError);
  });

  it('treats an ack timeout the same as a rejection: stops the track, touches no peer connection, and throws SCREEN_SHARE_ACK_TIMEOUT', async () => {
    const socket = makeSocket((cb) => {
      // socket.io's timeout(ms) calls back with a timeout Error as the
      // first arg and no second arg when the ack never arrives in time.
      cb(new Error('operation has timed out'), undefined);
    });

    await expect(toggleScreenShare(sessionId, socket, [])).rejects.toMatchObject({
      code: 'SCREEN_SHARE_ACK_TIMEOUT',
    });
    expect(screenTrack.stop).toHaveBeenCalled();
    expect(pc.addTrack).not.toHaveBeenCalled();
  });

  it('allows a SUBSEQUENT attempt to succeed normally after a prior rejection (state was never corrupted by the loss)', async () => {
    const losingSocket = makeSocket((cb) =>
      cb(null, { ok: false, error: 'in use', code: 'SCREEN_SHARE_IN_USE' }));
    await expect(toggleScreenShare(sessionId, losingSocket, [])).rejects.toBeInstanceOf(ScreenShareRejectedError);

    // Fresh capture for the retry (the first one was already stopped).
    const secondTrack = makeFakeTrack();
    mockGetDisplayMedia.mockResolvedValue({ getVideoTracks: () => [secondTrack] });

    const winningSocket = makeSocket((cb) => cb(null, { ok: true, data: { delivered: true } }));
    const result = await toggleScreenShare(sessionId, winningSocket, []);

    expect(result).toBe(true);
    expect(pc.addTrack).toHaveBeenCalledWith(secondTrack);
  });

  it('does not emit a second, redundant call.screen_share once ownership is granted', async () => {
    const socket = makeSocket((cb) => cb(null, { ok: true, data: { delivered: true } }));
    await toggleScreenShare(sessionId, socket, []);

    // Exactly one ownership request, and the plain socket.emit (legacy
    // trailing emit) is never used for the ON path anymore.
    expect(socket.ownershipEmit).toHaveBeenCalledTimes(1);
    expect(socket.emit).not.toHaveBeenCalled();
  });

  it('fails safe with SCREEN_SHARE_ACK_ERROR and stops the track when no socket is available at all', async () => {
    await expect(toggleScreenShare(sessionId, null, [])).rejects.toMatchObject({
      code: 'SCREEN_SHARE_ACK_ERROR',
    });
    expect(screenTrack.stop).toHaveBeenCalled();
  });
});
