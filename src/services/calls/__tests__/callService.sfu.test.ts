// Regression coverage for feature B's real root cause: toggleScreenShare
// only ever replaced the video track on direct P2P peer connections. A
// group call that has upgraded to the SFU (mediasoup) sends video through
// a producer instead — so starting/stopping screen share had no effect at
// all for any participant reached via the SFU, which is every participant
// once a call is large enough to have auto-upgraded. Fixed by mirroring
// the P2P replaceTrack call with an SFU one whenever sfuService.isJoined.

jest.mock('../webRTCService', () => ({
  webRTCService: {
    getLocalStream: jest.fn(),
    peers: new Map(),
  },
  presentIOSScreenCapturePicker: jest.fn(() => true),
}));

jest.mock('../sfuService', () => ({
  sfuService: {
    isJoined: false,
    replaceTrack: jest.fn(),
  },
}));

const mockGetDisplayMedia = jest.fn();
jest.mock(
  'react-native-webrtc',
  () => ({ mediaDevices: { getDisplayMedia: mockGetDisplayMedia } }),
  { virtual: true },
);

import { webRTCService } from '../webRTCService';
import { sfuService } from '../sfuService';
import { toggleScreenShare, registerIOSScreenCapturePickerRef } from '../callService';

const mockReplaceTrack = sfuService.replaceTrack as jest.Mock;

function makeFakeTrack() {
  return { kind: 'video', enabled: true, stop: jest.fn(), addEventListener: jest.fn() };
}

describe('toggleScreenShare — SFU dual-path', () => {
  let sessionCounter = 0;
  let sessionId: string;
  let cameraTrack: any;
  let screenTrack: any;
  let socket: any;

  beforeEach(() => {
    jest.clearAllMocks();
    (sfuService as any).isJoined = false;
    registerIOSScreenCapturePickerRef({ current: {} });
    sessionId = `session-${++sessionCounter}`;
    cameraTrack = makeFakeTrack();
    screenTrack = makeFakeTrack();

    const localStream = { getVideoTracks: jest.fn(() => [cameraTrack]) };
    (webRTCService.getLocalStream as jest.Mock).mockReturnValue(localStream);
    (webRTCService as any).peers = new Map(); // no P2P peers — isolates the SFU path

    socket = { emit: jest.fn() };
    mockGetDisplayMedia.mockReset();
    mockGetDisplayMedia.mockResolvedValue({ getVideoTracks: () => [screenTrack] });
  });

  it('replaces the SFU video producer track when the call has upgraded to the SFU', async () => {
    (sfuService as any).isJoined = true;
    await toggleScreenShare(sessionId, socket, []);
    expect(mockReplaceTrack).toHaveBeenCalledWith('video', screenTrack);
  });

  it('does not touch the SFU at all for a plain P2P call (never joined)', async () => {
    (sfuService as any).isJoined = false;
    await toggleScreenShare(sessionId, socket, []);
    expect(mockReplaceTrack).not.toHaveBeenCalled();
  });

  it('restores the camera track on the SFU producer when sharing stops', async () => {
    (sfuService as any).isJoined = true;
    await toggleScreenShare(sessionId, socket, []); // on
    mockReplaceTrack.mockClear();

    await toggleScreenShare(sessionId, socket, []); // off
    expect(mockReplaceTrack).toHaveBeenCalledWith('video', cameraTrack);
  });
});
