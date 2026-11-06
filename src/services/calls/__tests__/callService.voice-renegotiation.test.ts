// Regression coverage for the core bug this pass fixes: "sender sees local
// preview, receiver sees nothing" for VOICE and voice-group calls.
//
// Root cause: a voice call's peer connections never negotiate a video
// m-line at all (webRTCService.buildPeer() only adds tracks present in the
// local camera/mic MediaStream, and a voice call's local stream has no
// video track - see webRTCService.ts). toggleScreenShare's P2P path used
// ONLY sender.replaceTrack(), which reuses an ALREADY-NEGOTIATED m-line and
// silently does nothing when `senders.find(video)` finds nothing. The
// screen track was captured locally (so the sharer's own preview looked
// fine) but never reached any peer connection at all.
//
// Fix: when no video sender exists yet, add a brand-new one via
// pc.addTrack() and signal a fresh offer/answer round trip through the new
// onRenegotiationNeeded callback (mirrors webRTCService's existing
// onIceRestartNeeded pattern already wired up in SocketProvider.tsx).

jest.mock('../sfuService', () => ({
  sfuService: { isJoined: false, replaceTrack: jest.fn() },
}));

const mockCreateOffer = jest.fn();
jest.mock('../webRTCService', () => ({
  webRTCService: {
    getLocalStream: jest.fn(),
    peers: new Map(),
    createOffer: (...args: any[]) => mockCreateOffer(...args),
    ensurePeerConnection: jest.fn(),
  },
  presentIOSScreenCapturePicker: jest.fn(() => true),
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
  setScreenShareCallbacks,
  registerIOSScreenCapturePickerRef,
  applyActiveScreenShareToPeer,
} from '../callService';

function makeFakeTrack(kind: 'video' | 'audio' = 'video') {
  return { kind, enabled: true, stop: jest.fn(), addEventListener: jest.fn() };
}

// toggleScreenShare now requests server ownership (an acked call.screen_share
// via socket.timeout(ms).emit(...)) BEFORE touching any peer connection - see
// callService.ts's requestScreenShareOwnership. These tests aren't exercising
// that ownership policy itself (see callService.screen-share-ownership.test.ts
// for that), so this fake socket auto-acks every ownership request as granted.
function makeAckingSocket() {
  const ownershipEmit = jest.fn((_event: string, _payload: any, cb?: (err: any, ack: any) => void) =>
    cb?.(null, { ok: true, data: { delivered: true } }));
  return {
    emit: jest.fn(),
    timeout: jest.fn(() => ({ emit: ownershipEmit })),
    // Exposed for assertions - the real ownership-request emit now goes
    // through socket.timeout(ms).emit(...), not the plain socket.emit(...)
    // used here only as a legacy no-op (toggleScreenShare's own trailing
    // emit was removed since the ownership request already covers it).
    ownershipEmit,
  };
}

describe('toggleScreenShare — voice-call addTrack+renegotiation fallback', () => {
  let sessionCounter = 0;
  let sessionId: string;
  let screenTrack: any;
  let audioOnlyPc: any;
  let socket: any;

  beforeEach(() => {
    jest.clearAllMocks();
    registerIOSScreenCapturePickerRef({ current: {} });
    sessionId = `voice-session-${++sessionCounter}`;
    screenTrack = makeFakeTrack('video');

    // A voice call's peer connection: only ever had an AUDIO sender, no
    // video sender exists at all — the exact shape buildPeer() produces
    // for a voice/voice-group call.
    const audioSender = { track: makeFakeTrack('audio'), replaceTrack: jest.fn() };
    audioOnlyPc = {
      getSenders: jest.fn(() => [audioSender]),
      addTrack: jest.fn(),
    };

    (webRTCService.getLocalStream as jest.Mock).mockReturnValue({
      getVideoTracks: jest.fn(() => []), // voice call — no camera track
    });
    (webRTCService as any).peers = new Map([['peer-voice-1', audioOnlyPc]]);

    mockCreateOffer.mockResolvedValue({ type: 'offer', sdp: 'v=0...offer-sdp' });

    socket = makeAckingSocket();
    mockGetDisplayMedia.mockReset();
    mockGetDisplayMedia.mockResolvedValue({ getVideoTracks: () => [screenTrack] });
  });

  it('adds a brand-new video sender via addTrack when no video sender exists yet', async () => {
    await toggleScreenShare(sessionId, socket, []);
    expect(audioOnlyPc.addTrack).toHaveBeenCalledWith(screenTrack);
  });

  it('requests a fresh offer and reports it via onRenegotiationNeeded, since adding a track changes the SDP shape', async () => {
    const onRenegotiationNeeded = jest.fn();
    setScreenShareCallbacks({ onRenegotiationNeeded });

    await toggleScreenShare(sessionId, socket, []);

    expect(mockCreateOffer).toHaveBeenCalledWith('peer-voice-1');
    expect(onRenegotiationNeeded).toHaveBeenCalledWith(
      'peer-voice-1',
      { type: 'offer', sdp: 'v=0...offer-sdp' },
    );
  });

  it('still requests ownership for enabled:true even though the P2P track had to be added rather than replaced', async () => {
    const result = await toggleScreenShare(sessionId, socket, []);
    expect(result).toBe(true);
    expect(socket.ownershipEmit).toHaveBeenCalledWith(
      'call.screen_share',
      { conversationId: sessionId, enabled: true },
      expect.any(Function),
    );
  });

  it('on stop, nulls out the dynamically-added video sender instead of leaving it transmitting a stopped track forever', async () => {
    await toggleScreenShare(sessionId, socket, []); // on
    const videoSenderAfterOn = { track: screenTrack, replaceTrack: jest.fn() };
    // Simulate the sender now present after addTrack (a real RTCPeerConnection
    // would report it in getSenders() from this point on).
    audioOnlyPc.getSenders.mockReturnValue([
      { track: makeFakeTrack('audio'), replaceTrack: jest.fn() },
      videoSenderAfterOn,
    ]);

    await toggleScreenShare(sessionId, socket, []); // off

    // _originalVideoTrack was null (voice call never had a camera track),
    // so the restore call must pass null — this is the fix for the dead
    // producer/sender bug where a voice call's screen-share video sender
    // was never cleaned up at all on stop.
    expect(videoSenderAfterOn.replaceTrack).toHaveBeenCalledWith(null);
  });
});

describe('applyActiveScreenShareToPeer — late joiner receives the in-progress share', () => {
  // callService.ts keeps screen-share state in module-level variables with
  // no reset hook (see the sibling test file's own comment on this) - a
  // fresh sessionId per test prevents one test's still-active share from
  // being interpreted as a TOGGLE OFF by the next test's toggleScreenShare call.
  let sessionCounter = 0;
  let sessionId: string;
  let screenTrack: any;
  let socket: any;

  beforeEach(() => {
    jest.clearAllMocks();
    registerIOSScreenCapturePickerRef({ current: {} });
    sessionId = `late-joiner-session-${++sessionCounter}`;
    screenTrack = makeFakeTrack('video');
    (webRTCService.getLocalStream as jest.Mock).mockReturnValue({ getVideoTracks: jest.fn(() => []) });
    (webRTCService as any).peers = new Map();
    mockCreateOffer.mockResolvedValue({ type: 'offer', sdp: 'sdp' });
    socket = makeAckingSocket();
    mockGetDisplayMedia.mockReset();
    mockGetDisplayMedia.mockResolvedValue({ getVideoTracks: () => [screenTrack] });
  });

  it('does nothing when nobody is currently sharing', () => {
    applyActiveScreenShareToPeer('brand-new-peer');
    expect(webRTCService.ensurePeerConnection).not.toHaveBeenCalled();
  });

  it('attaches the active screen track to a brand-new peer connection before its first offer is ever created', async () => {
    await toggleScreenShare(sessionId, socket, []); // start a share (no existing peers yet)

    const newPc = { getSenders: jest.fn(() => []), addTrack: jest.fn() };
    (webRTCService.ensurePeerConnection as jest.Mock).mockReturnValue(newPc);

    applyActiveScreenShareToPeer('late-joiner-peer');

    expect(webRTCService.ensurePeerConnection).toHaveBeenCalledWith('late-joiner-peer');
    expect(newPc.addTrack).toHaveBeenCalledWith(screenTrack);
  });

  it('replaces (not adds) when the new peer connection already has a video sender (video/video-group call)', async () => {
    await toggleScreenShare(sessionId, socket, []);

    const existingVideoSender = { track: makeFakeTrack('video'), replaceTrack: jest.fn() };
    const newPc = { getSenders: jest.fn(() => [existingVideoSender]), addTrack: jest.fn() };
    (webRTCService.ensurePeerConnection as jest.Mock).mockReturnValue(newPc);

    applyActiveScreenShareToPeer('late-joiner-peer-2');

    expect(existingVideoSender.replaceTrack).toHaveBeenCalledWith(screenTrack);
    expect(newPc.addTrack).not.toHaveBeenCalled();
  });
});
