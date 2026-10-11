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
import { logCallDiagnostic } from './callDiagnostics';

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

// Guards RNCallKeep.setup() so it only ever runs once per JS process.
// Critically, this must be reachable from TWO separate entry points that
// never run together:
//   1. SocketProvider's mount-time useEffect (app foreground/backgrounded,
//      React tree alive) — via setupCallKit() below.
//   2. handleBackgroundPushMessage in push/notifications.ts, invoked by
//      Android as a HEADLESS JS task when the app is fully KILLED and an
//      incoming-call FCM data message arrives. No React tree ever mounts
//      in that execution context, so SocketProvider's effect never runs —
//      which meant displayIncomingCall() was being called natively before
//      RNCallKeep.setup() had EVER run in that process. setup() is what
//      registers the Android PhoneAccount + notification channel that
//      displayIncomingCall()'s native ConnectionService call depends on;
//      without it, the call silently never rings while regular message/
//      missed-call pushes (OS-rendered from the `notification` block,
//      no JS required at all) kept working — exactly this app's reported
//      symptom. ensureCallKeepSetup() closes that gap by making setup()
//      safe (and necessary) to call from both places.
let _setupPromise: Promise<void> | null = null;

// Returns a promise that resolves once RNCallKeep.setup() has completed (or
// resolves immediately if setup already ran/is running). Callers that need
// setup to have genuinely finished before touching the native call APIs —
// displayIncomingCall() in particular — must await this, not just invoke it
// fire-and-forget, otherwise the native PhoneAccount registration setup()
// performs may not have landed yet by the time displayIncomingCall() fires.
export function ensureCallKeepSetup(): Promise<void> {
  if (!RNCallKeep) return Promise.resolve();
  if (_setupPromise) return _setupPromise;

  // On Android, READ_PHONE_STATE must be requested at runtime before setup().
  // PermissionsAndroid.request() needs a foreground Activity to show its
  // dialog — in the headless background-handler entry point there is none,
  // so this reliably no-ops there (resolves with whatever state already
  // existed) rather than throwing; the normal foreground call to
  // setupCallKit() is what actually prompts the user the first time.
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

  const setupPromise: Promise<void> = RNCallKeep.setup({
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
  }).then(() => undefined).catch((e: any) => {
    // A failed setup() must be retried on the next call attempt rather than
    // permanently abandoned — otherwise one transient failure (e.g. a race
    // during a headless invocation) would silently disable ringing for the
    // rest of the process's lifetime.
    _setupPromise = null;
    logCallKitError('setup', e);
  });
  _setupPromise = setupPromise;
  return setupPromise;
}

export function setupCallKit(callbacks: CallKeepCallbacks): void {
  if (!RNCallKeep) return;
  _callbacks = callbacks;
  ensureCallKeepSetup();

  try {
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
 * failed" apart from "everything worked" instead of assuming success.
 *
 * Async (not sync) specifically so the setup-before-display ordering below
 * is a genuine await, not a fire-and-forget race — see ensureCallKeepSetup's
 * doc comment for why that race was the actual root cause of calls never
 * ringing from a killed app. */
export async function displayIncomingCall(params: {
  callUUID: string;
  callerName: string;
  callType: CallType;
}): Promise<boolean> {
  if (!RNCallKeep) {
    console.warn(`[CallKit] displayIncomingCall skipped for callId=${params.callUUID}: RNCallKeep unavailable — no native ring UI will show.`);
    return false;
  }
  // Must-complete-first: see ensureCallKeepSetup()'s doc comment. This is
  // the only call in the headless (killed-app) background-push entry point
  // — SocketProvider's setupCallKit() never mounts there — so without
  // awaiting this, RNCallKeep.setup() may not have finished registering the
  // Android PhoneAccount/notification channel yet when displayIncomingCall()
  // fires, and the native call below silently fails to ring. Resolves
  // immediately (no real delay) once setup has already completed in this
  // process — e.g. every call after the first in a long-lived app session.
  await ensureCallKeepSetup();
  if (!(await isPhoneAccountEnabled())) {
    void logCallDiagnostic({
      stage: 'CALLKEEP_PHONE_ACCOUNT_DISABLED',
      callId: params.callUUID,
      callType: params.callType,
    });
    console.warn(`[CallKit] phone account not enabled for callId=${params.callUUID} — attempting to ring anyway, but Android will likely refuse it. The user needs to enable KIS under Settings > Apps > Calling accounts.`);
    // Fall through and attempt it anyway — isPhoneAccountEnabled() fails
    // open on its own errors, and a stale read is possible; better to try
    // and fail than to skip a call that might actually have worked.
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

/**
 * Android only. KIS registers its ConnectionService as a REGULAR (non
 * self-managed) phone account — see AndroidManifest.xml's VoiceConnectionService
 * — which Android requires the USER to explicitly enable, once, via a system
 * settings screen (the react-native-callkeep setup() call's
 * alertTitle/alertDescription/cancelButton/okButton prompt THIS screen to
 * open). If the user dismisses that one-time prompt ("Not now") or it never
 * successfully surfaces, the phone account stays permanently disabled and
 * every subsequent RNCallKeep.displayIncomingCall() silently fails to ring —
 * forever, with no further native prompt — while every OTHER push type
 * keeps working normally since they don't depend on this at all. This is
 * indistinguishable from the outside from "the push/socket never arrived",
 * which is exactly what made it look like a delivery bug rather than a
 * one-time Android settings toggle the user never completed.
 *
 * Resolves true on iOS (CallKit has no equivalent "enable this account"
 * step) and when RNCallKeep itself isn't available, so callers can treat
 * "not applicable" and "genuinely enabled" the same way.
 */
export async function isPhoneAccountEnabled(): Promise<boolean> {
  if (Platform.OS !== 'android' || !RNCallKeep) return true;
  try {
    return await RNCallKeep.checkPhoneAccountEnabled();
  } catch (e) {
    logCallKitError('checkPhoneAccountEnabled', e);
    // Fail open rather than nagging the user over a check that itself
    // errored — displayIncomingCall's own try/catch is the real backstop
    // if the account truly isn't enabled.
    return true;
  }
}

/** Opens Android's native "Calling accounts" settings screen (same
 * destination the one-time setup() prompt would have opened), so the user
 * can manually enable KIS's phone account after having missed/dismissed
 * that prompt the first time. No-op on iOS or if RNCallKeep is unavailable. */
export function openPhoneAccountSettings(): void {
  if (Platform.OS !== 'android' || !RNCallKeep) return;
  try {
    RNCallKeep.openPhoneAccountSettings();
  } catch (e) {
    logCallKitError('openPhoneAccountSettings', e);
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
  // Android only: react-native-callkeep's Android reportEndCallWithUUID
  // (VoiceConnection.reportDisconnect) calls Connection.setDisconnected()
  // but — unlike its iOS counterpart, which fully reports the end through
  // CXProvider — never calls Connection.destroy() or removes the entry
  // from VoiceConnectionService's connection map. Every call ever ended
  // through this path left a permanently "active" native Telecom
  // connection behind, for the lifetime of the app process. This is the
  // root cause of calls becoming unable to ring at all after a prior call
  // ended (a second/third call's telecomManager.addNewIncomingCall() can
  // be refused while a stale, un-destroyed connection still exists for
  // the account), recoverable only by fully restarting the app (which
  // tears down the process-lifetime connection map). RNCallKeep.endCall()
  // finds the same connection and performs the real
  // destroy()/deinitConnection() cleanup reportDisconnect skips — safe to
  // call here even though the connection is already marked disconnected.
  // Calling it loops back through the native 'endCall' event listener
  // (onEndCall in SocketProvider.tsx), but that handler is idempotent
  // (guarded by call state already being terminal), so the redundant
  // invocation is a safe no-op, not a duplicate side effect.
  if (Platform.OS === 'android') {
    try {
      RNCallKeep.endCall(callUUID);
    } catch (e) {
      logCallKitError(`reportCallEnded (native connection cleanup) callId=${callUUID}`, e);
    }
  }
}

/**
 * Android only. Explicitly brings the app's Activity to the foreground so
 * the in-app incoming-call screen actually becomes visible.
 *
 * On Android, react-native-callkeep's incoming-call UI model relies
 * entirely on the app rendering its own screen — there is no system call
 * UI equivalent to iOS CallKit's lock-screen presentation (see
 * VoiceConnection.onShowIncomingCallUi in the native module, which only
 * emits a JS event; nothing in this app ever listens for it). The Telecom
 * framework plays the ringtone for a ringing connection independently of
 * whether any UI is shown, which is why a backgrounded recipient
 * previously heard an audible ring with no visible incoming-call screen
 * until they manually reopened the app. Call this right after a
 * successful displayIncomingCall() from a background/headless context so
 * the screen appears immediately, matching the ring.
 */
export function bringCallToForeground(): void {
  if (!RNCallKeep || Platform.OS !== 'android') return;
  try {
    RNCallKeep.backToForeground();
  } catch (e) {
    logCallKitError('bringCallToForeground', e);
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
