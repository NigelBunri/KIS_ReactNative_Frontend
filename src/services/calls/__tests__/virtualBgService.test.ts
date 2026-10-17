// Regression coverage for feature F's real root cause: the previous
// implementation (VirtualBgProcessor) only ever produced a LOCAL preview
// via react-native-view-shot screenshot capture — peers always saw the raw,
// unprocessed camera stream. applyVirtualBackgroundToTrack is the new real
// path: it configures the native segmentation module (Android ML Kit /
// iOS Vision, see android/.../virtualbg and ios/KISVirtualBackground) and
// activates it on the actual local MediaStreamTrack via
// react-native-webrtc's _setVideoEffect extension point — the one call
// that makes the processed frame visible to remote participants.

const mockConfigure = jest.fn().mockResolvedValue(true);
const mockClear = jest.fn().mockResolvedValue(true);
jest.mock('react-native', () => ({
  NativeModules: {
    KISVirtualBackgroundModule: {
      configure: (...args: any[]) => mockConfigure(...args),
      clear: (...args: any[]) => mockClear(...args),
      isAvailable: jest.fn().mockResolvedValue(true),
    },
  },
}));

jest.mock('../webRTCService', () => ({
  webRTCService: { getLocalStream: jest.fn() },
}));

import { applyVirtualBackgroundToTrack, virtualBackgroundNativeAvailable } from '../virtualBgService';
import { webRTCService } from '../webRTCService';

function makeTrack() {
  return { _setVideoEffect: jest.fn(), _setVideoEffects: jest.fn() };
}

describe('applyVirtualBackgroundToTrack', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reports the native module as available when present', () => {
    expect(virtualBackgroundNativeAvailable).toBe(true);
  });

  it('configures the native module and activates the real video effect on the local track', async () => {
    const track = makeTrack();
    (webRTCService.getLocalStream as jest.Mock).mockReturnValue({ getVideoTracks: () => [track] });

    await applyVirtualBackgroundToTrack({ mode: 'blur', blurRadius: 14 });

    expect(mockConfigure).toHaveBeenCalledWith('blur', 14, null);
    expect(track._setVideoEffect).toHaveBeenCalledWith('kis-virtualbg');
  });

  it('passes the custom background image URI through to the native module', async () => {
    const track = makeTrack();
    (webRTCService.getLocalStream as jest.Mock).mockReturnValue({ getVideoTracks: () => [track] });

    await applyVirtualBackgroundToTrack({ mode: 'image', imageUri: 'file:///tmp/bg.jpg' });

    expect(mockConfigure).toHaveBeenCalledWith('image', 12, 'file:///tmp/bg.jpg');
  });

  it('deactivates the effect and clears native config when mode is "none"', async () => {
    const track = makeTrack();
    (webRTCService.getLocalStream as jest.Mock).mockReturnValue({ getVideoTracks: () => [track] });

    await applyVirtualBackgroundToTrack({ mode: 'none' });

    expect(track._setVideoEffects).toHaveBeenCalledWith([]);
    expect(mockClear).toHaveBeenCalled();
    expect(mockConfigure).not.toHaveBeenCalled();
  });

  it('is a safe no-op when there is no local video track yet', async () => {
    (webRTCService.getLocalStream as jest.Mock).mockReturnValue({ getVideoTracks: () => [] });

    await expect(applyVirtualBackgroundToTrack({ mode: 'blur' })).resolves.toBeUndefined();
    expect(mockConfigure).not.toHaveBeenCalled();
  });

  it('is a safe no-op when there is no local stream at all', async () => {
    (webRTCService.getLocalStream as jest.Mock).mockReturnValue(null);

    await expect(applyVirtualBackgroundToTrack({ mode: 'blur' })).resolves.toBeUndefined();
    expect(mockConfigure).not.toHaveBeenCalled();
  });
});
