// src/services/calls/callKitService.ts
//
// CallKit (iOS) + ConnectionService (Android) integration via react-native-callkeep.
//
// react-native-callkeep is loaded dynamically so the app compiles and runs
// even when the native module is not yet installed.
//
// Setup checklist (must complete ALL steps before enabling):
//   1. pnpm add react-native-callkeep
//   2. cd ios && pod install
//   3. UIBackgroundModes: voip in Info.plist  ← already done
//   4. Voice over IP + Push Notifications capabilities in Xcode → Signing & Capabilities
//   5. Rebuild the native app (not Metro-only)
//
// SIMULATOR LIMITATION:
//   The iOS Simulator does not support proper audio-session arbitration between
//   CallKit (CXProvider) and react-native-webrtc (AVAudioSession). Both fight
//   to own the session simultaneously during call setup and the WebRTC audio
//   engine crashes with EXC_BAD_ACCESS. This is a simulator-only issue.
//
//   On a real iPhone/iPad, CallKit and WebRTC cooperate via the CXProviderDelegate
//   audio activation callbacks (provider(_:didActivate:)) so there is no conflict.
//
//   The audio-session conflict above is an iOS-Simulator-only problem — there is
//   no equivalent issue on Android (emulator or device), so gating CallKeep off
//   for every __DEV__ build (including real-device Android debug builds, which
//   is how this app is actually tested) was disabling the exact background
//   incoming-call UI needed to reproduce/verify call delivery. Android is
//   therefore always enabled; iOS stays gated by __DEV__ since we can't
//   reliably tell simulator from real-device debug without an extra native
//   dependency (react-native-device-info). Set the iOS side to `true` too
//   once testing moves to a real-device debug or Release build.

import { Platform, PermissionsAndroid } from 'react-native';
import type { CallType } from './callTypes';

const CALLKIT_ENABLED = Platform.OS === 'android' ? true : !__DEV__;

// Structured, secret-free diagnostic log for every CallKeep failure. This
// infrastructure is what surfaces an incoming ring screen, so a silently
// swallowed failure here previously looked identical (from the outside) to
// "the push/socket never arrived" — indistinguishable failure modes that
// wasted real debugging time. Never pass RNCallKeep call args (callerName
// etc. are just display strings, not secrets, but keep this narrow anyway)
// — only the operation name and the error's own message/code.
const logCallKitError = (op: string, error: any): void => {
  const detail = error?.message ?? error?.code ?? String(error);
  console.warn(`[CallKit] ${op} failed: ${detail}`);
};

let RNCallKeep: any = null;
if (CALLKIT_ENABLED) {
  try {
    RNCallKeep = require('react-native-callkeep').default;
  } catch (e) {
    // Native module not installed/linked for this build. This is NOT a
    // silent "falls back to in-app UI" no-op in practice — the in-app
    // ring UI still shows, but the OS-level lock-screen/background ring
    // (the entire reason CallKeep exists) will not, so log it loudly.
    logCallKitError('require(react-native-callkeep)', e);
  }
}

export const callKeepAvailable = !!RNCallKeep;
if (CALLKIT_ENABLED && !callKeepAvailable) {
  console.warn('[CallKit] CALLKIT_ENABLED is true but the native module failed to load — background/lock-screen ringing will not work on this build.');
}

// Registers the headless-task handler that RNCallKeepBackgroundMessagingService
// (declared in AndroidManifest.xml) needs to route native call-UI actions
// (answer/decline from the lock screen) back into JS while the app isn't
// running. Per react-native-callkeep's own setup requirement, this must run
// unconditionally at JS entry (index.js) - not gated behind auth/socket
// mount - so it's registered even in a headless JS invocation triggered by a
// killed-state FCM message.
export function registerAndroidEvents(): void {
  if (!RNCallKeep || Platform.OS !== 'android') return;
  try {
    RNCallKeep.registerAndroidEvents();
  } catch (e) {
    logCallKitError('registerAndroidEvents', e);
  }
}

const APP_NAME = 'KIS';

type CallKeepCallbacks = {
  onAnswerCall: (callUUID: string) => void;
  onEndCall: (callUUID: string) => void;
  onToggleMute: (muted: boolean, callUUID: string) => void;
  onToggleHold: (hold: boolean, callUUID: string) => void;
};

let _callbacks: CallKeepCallbacks | null = null;

export function setupCallKit(callbacks: CallKeepCallbacks): void {
  if (!RNCallKeep) return;
  _callbacks = callbacks;

  // On Android, READ_PHONE_STATE must be requested at runtime before setup().
  if (Platform.OS === 'android') {
    PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
      {
        title: 'Phone permission',
        message: 'KIS needs access to your phone state to manage calls.',
        buttonPositive: 'Allow',
      },
    ).catch((e) => logCallKitError('READ_PHONE_STATE permission request', e));

    // PLAUSIBLE ROOT CAUSE of "background video calls have never worked,
    // background voice worked once then failed" (unverified without a
    // physical device — see displayIncomingCall's own diagnostics for the
    // actual failure signal). VoiceConnectionService declares
    // foregroundServiceType="phoneCall|microphone|camera". On Android 14+,
    // the OS requires the runtime permission matching a foreground-service
    // type to ALREADY be granted before that service is allowed to start —
    // otherwise the start is refused outright (ForegroundServiceStart-
    // NotAllowedException natively). Camera/mic permission was previously
    // requested for the FIRST time only reactively, inside
    // requestCallPermissions() — called from startCall/answerCall, which
    // only ever run once the user is actively interacting with the app in
    // the foreground. An incoming call while backgrounded never goes
    // through that path at all, so displayIncomingCall() could be trying
    // to start a camera-typed foreground service with camera permission
    // never yet granted — every time, for anyone who has never personally
    // initiated a video call before. Mic-only (voice) needing just
    // RECORD_AUDIO is more likely to have already been granted for other
    // reasons (voice notes, etc.), matching "worked once" instead of never.
    // Requesting both here, once, early (this effect runs once per app
    // session via SocketProvider's CallKit-setup useEffect) means both are
    // already granted by the time ANY incoming call — foreground or
    // background — needs to start that foreground service.
    PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      PermissionsAndroid.PERMISSIONS.CAMERA,
    ]).catch((e) => logCallKitError('proactive mic/camera permission request', e));
  }

  try {
    RNCallKeep.setup({
      ios: {
        appName: APP_NAME,
        supportsVideo: true,
        maximumCallGroups: '1',
        maximumCallsPerCallGroup: '1',
        includesCallsInRecents: true,
      },
      android: {
        alertTitle: 'Allow KIS to manage calls',
        alertDescription:
          'KIS needs permission to show incoming call screens on your lock screen and manage call audio.',
        cancelButton: 'Not now',
        okButton: 'Allow',
        imageName: 'ic_launcher',
        additionalPermissions: [
          PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
          PermissionsAndroid.PERMISSIONS.CALL_PHONE,
        ],
        foregroundService: {
          channelId: 'com.kis.calls',
          channelName: 'KIS calls',
          notificationTitle: 'KIS call in progress',
        },
      },
    }).catch((e: any) => logCallKitError('setup', e));

    RNCallKeep.addEventListener('answerCall', ({ callUUID }: { callUUID: string }) => {
      _callbacks?.onAnswerCall(callUUID);
    });
    RNCallKeep.addEventListener('endCall', ({ callUUID }: { callUUID: string }) => {
      _callbacks?.onEndCall(callUUID);
    });
    RNCallKeep.addEventListener(
      'didPerformSetMutedCallAction',
      ({ muted, callUUID }: { muted: boolean; callUUID: string }) => {
        _callbacks?.onToggleMute(muted, callUUID);
      },
    );
    RNCallKeep.addEventListener(
      'didToggleHoldCallAction',
      ({ hold, callUUID }: { hold: boolean; callUUID: string }) => {
        _callbacks?.onToggleHold(hold, callUUID);
      },
    );
  } catch (e) {
    logCallKitError('setupCallKit (event listeners)', e);
  }
}

export function teardownCallKit(): void {
  if (!RNCallKeep) return;
  try {
    RNCallKeep.removeEventListener('answerCall');
    RNCallKeep.removeEventListener('endCall');
    RNCallKeep.removeEventListener('didPerformSetMutedCallAction');
    RNCallKeep.removeEventListener('didToggleHoldCallAction');
  } catch (e) {
    logCallKitError('teardownCallKit', e);
  }
}

/** Returns whether the native call actually got shown, so callers (the
 * push/socket call.offer handlers) can tell "we tried to ring and it
 * failed" apart from "everything worked" instead of assuming success. */
export function displayIncomingCall(params: {
  callUUID: string;
  callerName: string;
  callType: CallType;
}): boolean {
  if (!RNCallKeep) {
    console.warn(`[CallKit] displayIncomingCall skipped for callId=${params.callUUID}: RNCallKeep unavailable — no native ring UI will show.`);
    return false;
  }
  try {
    const hasVideo =
      params.callType === 'video' || params.callType === 'video-group';
    RNCallKeep.displayIncomingCall(
      params.callUUID,
      params.callerName,
      params.callerName,
      'generic',
      hasVideo,
    );
    return true;
  } catch (e) {
    logCallKitError(`displayIncomingCall callId=${params.callUUID}`, e);
    return false;
  }
}

export function startOutgoingCall(params: {
  callUUID: string;
  callerName: string;
  callType: CallType;
}): void {
  if (!RNCallKeep) return;
  try {
    const hasVideo =
      params.callType === 'video' || params.callType === 'video-group';
    RNCallKeep.startCall(
      params.callUUID,
      params.callerName,
      params.callerName,
      'generic',
      hasVideo,
    );
  } catch (e) {
    logCallKitError(`startOutgoingCall callId=${params.callUUID}`, e);
  }
}

export function reportCallAnswered(callUUID: string): void {
  if (!RNCallKeep) return;
  try {
    RNCallKeep.setCurrentCallActive(callUUID, true);
  } catch (e) {
    logCallKitError(`reportCallAnswered callId=${callUUID}`, e);
  }
}

export function reportCallEnded(
  callUUID: string,
  reason: 'ended' | 'missed' | 'rejected' = 'ended',
): void {
  if (!RNCallKeep) return;
  const reasonCode = reason === 'missed' ? 2 : reason === 'rejected' ? 6 : 1;
  try {
    RNCallKeep.reportEndCallWithUUID(callUUID, reasonCode);
  } catch (e) {
    logCallKitError(`reportCallEnded callId=${callUUID}`, e);
  }
}

export function setMuted(callUUID: string, muted: boolean): void {
  if (!RNCallKeep) return;
  try {
    RNCallKeep.setMutedCall(callUUID, muted);
  } catch (e) {
    logCallKitError(`setMuted callId=${callUUID}`, e);
  }
}
