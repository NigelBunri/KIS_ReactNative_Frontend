// src/services/calls/callPiPService.ts
//
// Thin JS wrapper around the native video-call Picture-in-Picture modules
// (Android: CallPiPModule.kt / MainActivity.kt, iOS: CallPiPModule.swift).
// Both platforms expose the same native module name and method shape
// (KISCallPiPModule: isSupported / setCallActive / enterPictureInPictureMode)
// and emit the same "KISCallPiPModeChanged" device event, so this file is a
// single, unified cross-platform surface rather than one per platform - the
// call lifecycle code (SocketProvider.tsx) doesn't need to know which
// platform it's on to use PiP.
//
// Mirrors callKitService.ts's own conventions: optional-chain every native
// call so a build without the native module linked (or running under Metro
// without a fresh native build after adding it) degrades to a silent no-op
// instead of a crash, and never throws out of this module.

import { NativeEventEmitter, NativeModules, Platform } from 'react-native';

const { KISCallPiPModule } = NativeModules;

export const callPiPAvailable = !!KISCallPiPModule;

// NativeEventEmitter's constructor itself calls addListener/removeListeners
// on whatever module it's given (a longstanding RN requirement even for
// modules whose events aren't emitted through it directly, as here - both
// native sides emit via emitDeviceEvent/RCTDeviceEventEmitter, not through
// this module instance) - guard the construction itself, not just the calls,
// since passing undefined throws immediately rather than degrading quietly.
const emitter = KISCallPiPModule ? new NativeEventEmitter(KISCallPiPModule) : null;

/**
 * Resolves false (never rejects) on platforms/OS versions without PiP
 * support - Android before API 26, or iOS if the native module isn't linked
 * yet. Callers should treat "unsupported" as just as normal a state as
 * "voice-only call, don't bother" - never worth surfacing to the user.
 */
export async function isCallPiPSupported(): Promise<boolean> {
  if (!KISCallPiPModule?.isSupported) return false;
  try {
    return await KISCallPiPModule.isSupported();
  } catch {
    return false;
  }
}

/**
 * Tells the native side whether backgrounding right now should auto-enter
 * PiP. Call this on every relevant call-state change (not just once) - the
 * native side has no other way to know the call ended or flipped from
 * voice-only to video mid-call (e.g. someone turns their camera on).
 *
 * @param active whether a call is currently connected (ringing/dialing
 *   should pass false - PiP-ing a call no one answered yet is confusing).
 * @param isVideo whether that call has video. Voice-only calls should
 *   always pass false here regardless of `active`.
 */
export function setCallPiPActive(active: boolean, isVideo: boolean): void {
  KISCallPiPModule?.setCallActive?.(active, isVideo);
}

/**
 * Manually requests PiP mode right now, independent of the OS's own
 * background-triggered entry (Android's onUserLeaveHint / iOS's
 * automatic-from-inline start) - for an in-app "minimize" affordance should
 * one ever be added. Resolves the native side's own success/failure report;
 * never throws.
 */
export async function enterCallPiP(): Promise<boolean> {
  if (!KISCallPiPModule?.enterPictureInPictureMode) return false;
  try {
    return await KISCallPiPModule.enterPictureInPictureMode();
  } catch {
    return false;
  }
}

/**
 * Fires whenever this device enters or leaves PiP, from any cause - the OS
 * auto-entering it on background, the user tapping the PiP window to
 * return to full screen, or enterCallPiP() above. ActiveCallScreen uses
 * this to hide its own control bar while in the tiny PiP window (there's no
 * room for it, and leaving it rendered just overlays illegibly on the
 * video) and restore it the instant the user taps back to full screen.
 *
 * Returns an unsubscribe function; safe to call even when callPiPAvailable
 * is false (returns a no-op unsubscribe).
 */
export function addCallPiPModeChangeListener(
  callback: (isInPictureInPictureMode: boolean) => void,
): () => void {
  if (!emitter) return () => {};
  const subscription = emitter.addListener(
    'KISCallPiPModeChanged',
    (event: { isInPictureInPictureMode?: boolean }) => {
      callback(!!event?.isInPictureInPictureMode);
    },
  );
  return () => subscription.remove();
}

// Only Android and iOS have a native module to speak of - every export above
// already degrades gracefully via optional chaining, this is just a cheap
// early-exit for Platform.OS checks call sites may want without importing
// react-native's Platform themselves.
export const callPiPPlatformSupported = Platform.OS === 'android' || Platform.OS === 'ios';
