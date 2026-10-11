// Regression coverage for the Android call-reliability fixes:
//
// 1. reportCallEnded() must ALSO call native endCall() on Android, in
//    addition to reportEndCallWithUUID(). react-native-callkeep's Android
//    implementation of reportEndCallWithUUID (VoiceConnection.reportDisconnect)
//    calls Connection.setDisconnected() but never Connection.destroy() or
//    removes the connection from VoiceConnectionService's map — unlike its
//    iOS counterpart, which fully reports the end through CXProvider in one
//    call. Every call ended through the app previously left a permanently
//    "active" native Telecom connection behind for the life of the process,
//    which is why a call shortly after a prior one could fail to ring at
//    all until the app was restarted. iOS already does the right thing in
//    one call, so it must NOT get the extra endCall() — see
//    bringCallToForeground and reportCallEnded's own doc comments in
//    callKitService.ts for the full root-cause writeup.
//
// 2. bringCallToForeground() wraps RNCallKeep.backToForeground() — Android
//    only — the API that actually launches the Activity so the in-app
//    incoming-call screen becomes visible from a background/headless
//    context. Nothing in this app previously called it at all.
//
// Because CALLKIT_ENABLED and the react-native-callkeep require() happen at
// module load time based on Platform.OS, each test resets modules and
// re-requires callKitService fresh after setting the platform, rather than
// mocking Platform.OS globally once.

const mockRNCallKeep = {
  setup: jest.fn().mockResolvedValue(undefined),
  registerAndroidEvents: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  displayIncomingCall: jest.fn(),
  reportEndCallWithUUID: jest.fn(),
  endCall: jest.fn(),
  backToForeground: jest.fn(),
  setCurrentCallActive: jest.fn(),
  setMutedCall: jest.fn(),
  startCall: jest.fn(),
  checkPhoneAccountEnabled: jest.fn().mockResolvedValue(true),
  openPhoneAccountSettings: jest.fn(),
};

jest.mock('react-native-callkeep', () => ({ default: mockRNCallKeep }), { virtual: true });

const mockCancelIncomingCallNotification = jest.fn().mockResolvedValue(undefined);
jest.mock('../incomingCallNotification', () => ({
  cancelIncomingCallNotification: mockCancelIncomingCallNotification,
}));

// A minimal, fully-synthetic 'react-native' mock — callKitService.ts only
// imports { Platform, PermissionsAndroid } from it, so there's no need to
// pull in jest.requireActual('react-native') (which drags in the real
// TurboModule/FlatList/VirtualizedList graph and breaks under
// jest.resetModules() with a missing-native-module invariant).
//
// CALLKIT_ENABLED is `Platform.OS === 'android' ? true : !__DEV__` — iOS is
// deliberately gated behind __DEV__ (see the file's own top-of-file
// comment), and Jest's test environment defaults __DEV__ to true. Force it
// false for iOS cases so the real (production-equivalent) code path is
// actually exercised instead of silently no-op'ing on `!RNCallKeep`.
function loadServiceForPlatform(os: 'android' | 'ios') {
  jest.resetModules();
  (globalThis as any).__DEV__ = os === 'ios' ? false : true;
  jest.doMock('react-native', () => ({
    Platform: { OS: os, select: (obj: any) => obj[os] ?? obj.default },
    PermissionsAndroid: {
      request: jest.fn().mockResolvedValue('granted'),
      requestMultiple: jest.fn().mockResolvedValue({}),
      PERMISSIONS: { READ_PHONE_STATE: 'READ_PHONE_STATE', RECORD_AUDIO: 'RECORD_AUDIO', CAMERA: 'CAMERA', CALL_PHONE: 'CALL_PHONE' },
    },
  }));
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../callKitService');
}

const ORIGINAL_DEV = (globalThis as any).__DEV__;
afterAll(() => {
  (globalThis as any).__DEV__ = ORIGINAL_DEV;
});

describe('callKitService — reportCallEnded native cleanup (Android orphaned-connection fix)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Android: calls both reportEndCallWithUUID AND endCall, so the native Telecom connection is actually destroyed', () => {
    const { reportCallEnded } = loadServiceForPlatform('android');

    reportCallEnded('call-1', 'ended');

    expect(mockRNCallKeep.reportEndCallWithUUID).toHaveBeenCalledWith('call-1', 1);
    expect(mockRNCallKeep.endCall).toHaveBeenCalledWith('call-1');
  });

  it('Android: still calls endCall for every reason code (missed, rejected), not just the default', () => {
    const { reportCallEnded } = loadServiceForPlatform('android');

    reportCallEnded('call-2', 'missed');
    reportCallEnded('call-3', 'rejected');

    expect(mockRNCallKeep.reportEndCallWithUUID).toHaveBeenCalledWith('call-2', 2);
    expect(mockRNCallKeep.endCall).toHaveBeenCalledWith('call-2');
    expect(mockRNCallKeep.reportEndCallWithUUID).toHaveBeenCalledWith('call-3', 6);
    expect(mockRNCallKeep.endCall).toHaveBeenCalledWith('call-3');
  });

  it('Android: a failure from the extra endCall() call is caught and does not throw (best-effort cleanup)', () => {
    const { reportCallEnded } = loadServiceForPlatform('android');
    mockRNCallKeep.endCall.mockImplementationOnce(() => { throw new Error('native boom'); });

    expect(() => reportCallEnded('call-4', 'ended')).not.toThrow();
  });

  it('iOS: does NOT call the extra endCall — reportEndCallWithUUID alone already fully reports the end through CXProvider', () => {
    const { reportCallEnded } = loadServiceForPlatform('ios');

    reportCallEnded('call-5', 'ended');

    expect(mockRNCallKeep.reportEndCallWithUUID).toHaveBeenCalledWith('call-5', 1);
    expect(mockRNCallKeep.endCall).not.toHaveBeenCalled();
  });
});

describe('callKitService — cancelIncomingCallNotification wiring (final incoming-call-UI fix)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reportCallAnswered cancels the full-screen notification for that call', () => {
    const { reportCallAnswered } = loadServiceForPlatform('android');

    reportCallAnswered('call-6');

    expect(mockCancelIncomingCallNotification).toHaveBeenCalledWith('call-6');
  });

  it('reportCallEnded cancels the full-screen notification regardless of reason (decline, timeout, remote hangup all call this)', () => {
    const { reportCallEnded } = loadServiceForPlatform('android');

    reportCallEnded('call-7', 'missed');

    expect(mockCancelIncomingCallNotification).toHaveBeenCalledWith('call-7');
  });

  it('cancels the notification even when RNCallKeep itself is unavailable — the notification is an independent delivery path', () => {
    jest.resetModules();
    jest.doMock('react-native-callkeep', () => {
      throw new Error('native module not linked');
    }, { virtual: true });
    jest.doMock('react-native', () => ({
      Platform: { OS: 'android', select: (obj: any) => obj.android ?? obj.default },
      PermissionsAndroid: {
        request: jest.fn().mockResolvedValue('granted'),
        requestMultiple: jest.fn().mockResolvedValue({}),
        PERMISSIONS: { READ_PHONE_STATE: 'READ_PHONE_STATE', RECORD_AUDIO: 'RECORD_AUDIO', CAMERA: 'CAMERA', CALL_PHONE: 'CALL_PHONE' },
      },
    }));
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { reportCallEnded } = require('../callKitService');

      reportCallEnded('call-8', 'ended');

      expect(mockCancelIncomingCallNotification).toHaveBeenCalledWith('call-8');
    } finally {
      // jest.doMock's replacement factory (throwing) otherwise persists
      // for every subsequent require() in this file, not just this test —
      // restore the normal mock so later tests get the real mockRNCallKeep
      // instance back.
      jest.resetModules();
      jest.doMock('react-native-callkeep', () => ({ default: mockRNCallKeep }), { virtual: true });
    }
  });
});

describe('callKitService — bringCallToForeground (missing incoming-call UI fix)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Android: calls RNCallKeep.backToForeground()', () => {
    const { bringCallToForeground } = loadServiceForPlatform('android');

    bringCallToForeground();

    expect(mockRNCallKeep.backToForeground).toHaveBeenCalledTimes(1);
  });

  it('iOS: is a no-op — CallKit already presents the system call UI natively, nothing to bring forward', () => {
    const { bringCallToForeground } = loadServiceForPlatform('ios');

    bringCallToForeground();

    expect(mockRNCallKeep.backToForeground).not.toHaveBeenCalled();
  });

  it('never throws even if the native call fails', () => {
    const { bringCallToForeground } = loadServiceForPlatform('android');
    mockRNCallKeep.backToForeground.mockImplementationOnce(() => { throw new Error('no activity'); });

    expect(() => bringCallToForeground()).not.toThrow();
  });
});
