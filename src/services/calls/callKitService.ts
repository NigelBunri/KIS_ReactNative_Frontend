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
//   CALLKIT_ENABLED is therefore FALSE in __DEV__ builds (which includes the
//   simulator). Set it to true for a real-device debug or Release build.

import { Platform, PermissionsAndroid } from 'react-native';
import type { CallType } from './callTypes';

// Disable in any DEBUG build (simulator + real-device debug).
// Change to `true` when you want to test CallKit on a physical device.
// Release builds (App Store / TestFlight) automatically have __DEV__ = false,
// so CallKit is always active in production.
const CALLKIT_ENABLED = !__DEV__;

let RNCallKeep: any = null;
if (CALLKIT_ENABLED) {
  try {
    RNCallKeep = require('react-native-callkeep').default;
  } catch {
    // Package not installed — falls back to in-app UI.
  }
}

export const callKeepAvailable = !!RNCallKeep;

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
    ).catch(() => {});
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
    }).catch(() => {});

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
  } catch {}
}

export function teardownCallKit(): void {
  if (!RNCallKeep) return;
  try {
    RNCallKeep.removeEventListener('answerCall');
    RNCallKeep.removeEventListener('endCall');
    RNCallKeep.removeEventListener('didPerformSetMutedCallAction');
    RNCallKeep.removeEventListener('didToggleHoldCallAction');
  } catch {}
}

export function displayIncomingCall(params: {
  callUUID: string;
  callerName: string;
  callType: CallType;
}): void {
  if (!RNCallKeep) return;
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
  } catch {}
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
  } catch {}
}

export function reportCallAnswered(callUUID: string): void {
  if (!RNCallKeep) return;
  try {
    RNCallKeep.setCurrentCallActive(callUUID, true);
  } catch {}
}

export function reportCallEnded(
  callUUID: string,
  reason: 'ended' | 'missed' | 'rejected' = 'ended',
): void {
  if (!RNCallKeep) return;
  const reasonCode = reason === 'missed' ? 2 : reason === 'rejected' ? 6 : 1;
  try {
    RNCallKeep.reportEndCallWithUUID(callUUID, reasonCode);
  } catch {}
}

export function setMuted(callUUID: string, muted: boolean): void {
  if (!RNCallKeep) return;
  try {
    RNCallKeep.setMutedCall(callUUID, muted);
  } catch {}
}
