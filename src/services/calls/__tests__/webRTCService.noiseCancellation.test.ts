// Regression coverage for feature C's real root cause: setNoiseCancellation
// only ever replaced the audio track on direct P2P peer connections. A
// group call that has upgraded to the SFU (mediasoup) sends audio through
// a producer instead — so toggling noise cancellation mid-call had no
// effect for any participant reached via the SFU. Fixed by mirroring the
// P2P replaceTrack call with an SFU one whenever sfuService.isJoined,
// mirroring the existing toggleMute/toggleVideo dual-path pattern.

jest.mock('../sfuService', () => ({
  sfuService: {
    isJoined: false,
    replaceTrack: jest.fn(),
  },
}));

// `react-native-webrtc` is a real, installed package (not a module that
// only exists as a type) — it must NOT be mocked with `{ virtual: true }`.
// That flag is for specifiers with no real file to resolve to; using it
// for a package that's also imported unmocked elsewhere (e.g. any test
// that pulls in SocketProvider.tsx, which imports webRTCService/sfuService
// for real) makes Jest's module resolution order-dependent: once some
// other test file in the same worker has resolved the real package for
// this specifier, a later virtual registration for the same specifier can
// silently lose to the cached real resolution, leaving RNW.mediaDevices
// as the real (native-less) implementation instead of this mock —
// confirmed by bisecting cross-file pollution down to exactly this
// ordering (decidePendingCallPresentation.test.ts, which transitively
// requires the real package, run before this file in the same process).
jest.mock('react-native-webrtc', () => ({
  mediaDevices: { getUserMedia: jest.fn() },
}));

import { webRTCService } from '../webRTCService';
import { sfuService } from '../sfuService';

const RNW = require('react-native-webrtc');
const mockGetUserMedia = RNW.mediaDevices.getUserMedia as jest.Mock;
const mockReplaceTrack = sfuService.replaceTrack as jest.Mock;
const newAudioTrack = { kind: 'audio', id: 'new-audio-track' };

describe('webRTCService.setNoiseCancellation — SFU dual-path', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUserMedia.mockResolvedValue({ getAudioTracks: () => [newAudioTrack] });
    (sfuService as any).isJoined = false;
    (webRTCService as any).localStream = {
      getAudioTracks: () => [{ stop: jest.fn() }],
      removeTrack: jest.fn(),
      addTrack: jest.fn(),
    };
    (webRTCService as any).peers = new Map();
  });

  it('replaces the SFU audio producer track when the call has upgraded to the SFU', async () => {
    (sfuService as any).isJoined = true;
    await webRTCService.setNoiseCancellation(true);
    expect(mockReplaceTrack).toHaveBeenCalledWith('audio', newAudioTrack);
  });

  it('does not touch the SFU for a plain P2P call (never joined)', async () => {
    (sfuService as any).isJoined = false;
    await webRTCService.setNoiseCancellation(true);
    expect(mockReplaceTrack).not.toHaveBeenCalled();
  });

  it('still replaces the track on P2P peer connections regardless of SFU state', async () => {
    const sender = { track: { kind: 'audio' }, replaceTrack: jest.fn() };
    const pc = { getSenders: () => [sender] };
    (webRTCService as any).peers = new Map([['peer-1', pc]]);

    await webRTCService.setNoiseCancellation(false);

    expect(sender.replaceTrack).toHaveBeenCalledWith(newAudioTrack);
  });
});
