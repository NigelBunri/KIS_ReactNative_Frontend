// Regression coverage for toggleScreenShare's screen-track 'ended' handling.
// Confirmed bug: the screen-capture track never had an 'ended' listener, so
// stopping a share via the OS-level control (iOS status-bar "Stop", Android's
// persistent "Stop sharing" notification - the PRIMARY real-world way users
// stop a screen share on both platforms) left _screenShareState stuck `true`,
// never restored the camera, never told the server sharing stopped, and left
// every other participant's UI showing this person as still sharing forever.

jest.mock('../webRTCService', () => ({
  webRTCService: {
    getLocalStream: jest.fn(),
    peers: new Map(),
  },
}));

const mockGetDisplayMedia = jest.fn();
jest.mock(
  'react-native-webrtc',
  () => ({
    mediaDevices: { getDisplayMedia: mockGetDisplayMedia },
  }),
  { virtual: true },
);

import { webRTCService } from '../webRTCService';
import { toggleScreenShare, setScreenShareCallbacks } from '../callService';

function makeFakeTrack(kind: 'video' | 'audio' = 'video') {
  const listeners: Record<string, Array<() => void>> = {};
  return {
    kind,
    enabled: true,
    stop: jest.fn(),
    addEventListener: jest.fn((event: string, cb: () => void) => {
      listeners[event] = listeners[event] ?? [];
      listeners[event].push(cb);
    }),
    // Exposed for tests to simulate the OS ending the track.
    __fireEnded: () => {
      (listeners['ended'] ?? []).forEach(cb => cb());
    },
  };
}

function makeFakeSender(track: any) {
  return { track, replaceTrack: jest.fn() };
}

describe('toggleScreenShare — screen track ended handling', () => {
  // callService.ts keeps its screen-share state in module-level variables
  // (_screenShareState, _screenTrack, etc.) with no exported reset hook, so
  // state from one test's "sharing on" would otherwise leak into the next
  // test run within the same file. A unique sessionId per test keeps each
  // test's _screenShareState[sessionId] entry independent without needing
  // to add a test-only reset export to the real module.
  let sessionCounter = 0;
  let sessionId: string;
  let cameraTrack: any;
  let screenTrack: any;
  let sender: any;
  let socket: any;

  beforeEach(() => {
    jest.clearAllMocks();
    sessionId = `session-${++sessionCounter}`;
    cameraTrack = makeFakeTrack('video');
    screenTrack = makeFakeTrack('video');
    sender = makeFakeSender(cameraTrack);

    const localStream = {
      getVideoTracks: jest.fn(() => [cameraTrack]),
    };
    (webRTCService.getLocalStream as jest.Mock).mockReturnValue(localStream);

    const pc = { getSenders: jest.fn(() => [sender]) };
    (webRTCService as any).peers = new Map([['peer-1', pc]]);

    socket = { emit: jest.fn() };

    // toggleScreenShare resolves react-native-webrtc via a dynamic
    // require() at call time (not a static import) specifically so the
    // module can be absent in environments without it - mockGetDisplayMedia
    // is the single shared mock registered via jest.mock above; reconfigure
    // its resolved value fresh for each test rather than re-mocking the
    // module (require()'s module-registry caching makes re-mocking the
    // whole module per-test unreliable without jest.resetModules()).
    mockGetDisplayMedia.mockReset();
    mockGetDisplayMedia.mockResolvedValue({
      getVideoTracks: () => [screenTrack],
    });
  });

  it('registers an ended listener on the screen track when sharing starts', async () => {
    const result = await toggleScreenShare(sessionId, socket, []);
    expect(result).toBe(true);
    expect(screenTrack.addEventListener).toHaveBeenCalledWith('ended', expect.any(Function));
    expect(sender.replaceTrack).toHaveBeenCalledWith(screenTrack);
    expect(socket.emit).toHaveBeenCalledWith('call.screen_share', { conversationId: sessionId, enabled: true });
  });

  it('cleans up and restores the camera when the track ends spontaneously (OS-level stop)', async () => {
    await toggleScreenShare(sessionId, socket, []);
    socket.emit.mockClear();
    sender.replaceTrack.mockClear();

    screenTrack.__fireEnded();

    expect(screenTrack.stop).toHaveBeenCalled();
    expect(sender.replaceTrack).toHaveBeenCalledWith(cameraTrack);
    expect(socket.emit).toHaveBeenCalledWith('call.screen_share', { conversationId: sessionId, enabled: false });

    // State must actually flip — a subsequent toggle should start a NEW
    // share (TOGGLE ON path), not attempt to toggle an already-off share.
    socket.emit.mockClear();
    const resumed = await toggleScreenShare(sessionId, socket, []);
    expect(resumed).toBe(true);
    expect(socket.emit).toHaveBeenCalledWith('call.screen_share', { conversationId: sessionId, enabled: true });
  });

  it('notifies onScreenShareEnded with reason "track-ended" on a spontaneous stop', async () => {
    const onScreenShareEnded = jest.fn();
    setScreenShareCallbacks({ onScreenShareEnded });

    await toggleScreenShare(sessionId, socket, []);
    screenTrack.__fireEnded();

    expect(onScreenShareEnded).toHaveBeenCalledWith(sessionId, 'track-ended');
  });

  it('notifies onScreenShareEnded with reason "manual" on an explicit toggle-off, and the track-ended firing afterward is a no-op', async () => {
    const onScreenShareEnded = jest.fn();
    setScreenShareCallbacks({ onScreenShareEnded });

    await toggleScreenShare(sessionId, socket, []);
    onScreenShareEnded.mockClear();
    socket.emit.mockClear();

    const result = await toggleScreenShare(sessionId, socket, []); // explicit toggle-off
    expect(result).toBe(false);
    expect(onScreenShareEnded).toHaveBeenCalledWith(sessionId, 'manual');
    expect(socket.emit).toHaveBeenCalledWith('call.screen_share', { conversationId: sessionId, enabled: false });

    onScreenShareEnded.mockClear();
    socket.emit.mockClear();

    // stop() above already fires the SAME track's 'ended' event in a real
    // browser/RN environment — simulate that self-inflicted second firing
    // and confirm it's an idempotent no-op, not a double cleanup/double
    // "enabled: false" emit.
    screenTrack.__fireEnded();
    expect(onScreenShareEnded).not.toHaveBeenCalled();
    expect(socket.emit).not.toHaveBeenCalled();
  });
});
