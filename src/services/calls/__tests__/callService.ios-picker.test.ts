// Regression coverage for AND-098: iOS screen sharing never worked because
// getDisplayMedia() on iOS presents no UI of its own — it only waits for
// react-native-webrtc's RTCScreenSharingExtension broadcast extension to
// connect, which only happens once the user picks it from ReplayKit's
// system broadcast sheet. That sheet must be explicitly triggered first via
// ScreenCapturePickerView's "show" command (see webRTCService.ts's
// presentIOSScreenCapturePicker and ActiveCallScreen's
// IOSScreenSharePicker). Nothing previously did this, so getDisplayMedia()
// on iOS had no way to ever resolve.

jest.mock('../webRTCService', () => ({
  webRTCService: {
    getLocalStream: jest.fn(() => ({ getVideoTracks: () => [] })),
    peers: new Map(),
  },
  presentIOSScreenCapturePicker: jest.fn(),
}));

const mockGetDisplayMedia = jest.fn();
jest.mock(
  'react-native-webrtc',
  () => ({ mediaDevices: { getDisplayMedia: mockGetDisplayMedia } }),
  { virtual: true },
);

jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

import { presentIOSScreenCapturePicker } from '../webRTCService';
import {
  toggleScreenShare,
  registerIOSScreenCapturePickerRef,
} from '../callService';

describe('toggleScreenShare — iOS broadcast-picker gate (AND-098)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDisplayMedia.mockResolvedValue({
      getVideoTracks: () => [{ kind: 'video', stop: jest.fn(), addEventListener: jest.fn() }],
    });
  });

  it('fails fast with SCREEN_SHARE_UNAVAILABLE on iOS when no picker ref was ever registered, instead of hanging on getDisplayMedia()', async () => {
    registerIOSScreenCapturePickerRef(null);
    await expect(toggleScreenShare('session-no-picker', { emit: jest.fn() }, [])).rejects.toThrow(
      'SCREEN_SHARE_UNAVAILABLE',
    );
    expect(mockGetDisplayMedia).not.toHaveBeenCalled();
  });

  it('fails fast when a picker ref is registered but presenting it fails', async () => {
    (presentIOSScreenCapturePicker as jest.Mock).mockReturnValue(false);
    registerIOSScreenCapturePickerRef({ current: {} });
    await expect(toggleScreenShare('session-present-fails', { emit: jest.fn() }, [])).rejects.toThrow(
      'SCREEN_SHARE_UNAVAILABLE',
    );
    expect(mockGetDisplayMedia).not.toHaveBeenCalled();
  });

  it('presents the broadcast picker before calling getDisplayMedia() when a picker ref is registered', async () => {
    (presentIOSScreenCapturePicker as jest.Mock).mockReturnValue(true);
    const ref = { current: {} };
    registerIOSScreenCapturePickerRef(ref);

    const result = await toggleScreenShare('session-ok', { emit: jest.fn() }, []);

    expect(result).toBe(true);
    expect(presentIOSScreenCapturePicker).toHaveBeenCalledWith(ref);
    expect(mockGetDisplayMedia).toHaveBeenCalled();
  });
});
