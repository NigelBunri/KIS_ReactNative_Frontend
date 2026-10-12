// src/services/calls/incomingCallNotification.ts
//
// Android only. Closes the final gap in background/killed-state incoming
// calls: Telecom's VoiceConnectionService.onCreateIncomingConnection() rings
// the device (setRinging()) the instant displayIncomingCall() succeeds —
// independent of any UI — but KIS's phone account is registered
// non-self-managed (CAPABILITY_CALL_PROVIDER, see callKitService.ts), so
// Android never invokes Connection.onShowIncomingCallUi() to tell the app to
// show anything (that callback is part of the SELF-MANAGED contract only —
// confirmed from react-native-callkeep's own native source,
// VoiceConnectionService.java:467-469, which only sets
// Connection.PROPERTY_SELF_MANAGED when the registered PhoneAccount actually
// has CAPABILITY_SELF_MANAGED). The only thing previously left to bring the
// screen up was bringCallToForeground() → RNCallKeep.backToForeground(),
// which — confirmed from RNCallKeepModule.java:1074-1097 — calls a raw
// Context.startActivity() with FLAG_ACTIVITY_NEW_TASK from a NON-Activity
// context whenever the app has no visible Activity already. That is exactly
// the kind of call Android 10+'s Background Activity Launch (BAL)
// restrictions exist to block, and enforcement has only tightened release
// over release — matching the reported regression exactly ("calls no longer
// RELIABLY wake the recipient" / "when fully closed, does not ring at all").
//
// The Android-sanctioned, BAL-EXEMPT mechanism for exactly this situation is
// a high-priority notification with a `fullScreenAction` (category CALL) —
// the system itself is what fires that PendingIntent, not the app, which is
// why it's exempted. This module posts that notification via @notifee/
// react-native, already an installed/linked dependency in this app (see
// src/services/pushNotificationDismissal.ts for the existing require-in-
// try/catch convention this follows). It launches MainActivity, which
// already declares showWhenLocked/turnScreenOn/singleTask — no further
// native changes are needed for lock-screen presentation.
//
// Migrating the Telecom account to CAPABILITY_SELF_MANAGED was considered
// (self-managed connections DO get their own BAL exemption, which is why
// Signal/WhatsApp/Viber-style apps normally use that mode) but deliberately
// NOT done here: it's a broader native change with real behavioral side
// effects (audio-focus/DND/Bluetooth-routing all shift to the app's
// responsibility instead of Telecom's), it is not required to fix this
// specific defect (the full-screen-intent notification is BAL-exempt on its
// own, independent of self-managed status), and the task's own instructions
// call for the smallest complete fix.
//
// ─── Ring audio (revised) ───────────────────────────────────────────────
//
// This notification was originally built silent, on the theory that
// Telecom's own Ringer would supply the ring audio once
// VoiceConnectionService.setRinging() fires. Physical-device testing
// disproved that: react-native-callkeep's native Android source contains
// NO ringtone-playing code anywhere (confirmed by searching it) —
// setRinging() only moves Telecom's internal connection *state* machine,
// it does not itself play audio. Telecom's own automatic Ringer is a
// managed-call/default-dialer behavior this app was never actually
// entitled to without a bound InCallService, so the earlier "audible
// ringing" was never guaranteed by anything this app controls. Result:
// the notification showed, correctly, but nothing was making noise.
//
// The fix: this notification's OWN channel sound is now the guaranteed,
// OS-level ring source for the backgrounded/killed path — a HIGH-importance
// notification posted to a channel with a sound WILL play it, independent
// of whether the React Native tree has mounted yet, which is exactly the
// property needed here (the in-app alternative, IncomingCallScreen's
// audioRouteManager.startRingtone() via react-native-incall-manager, only
// runs once a real Activity/JS tree is up — not guaranteed promptly, or at
// all, from a killed-process headless JS context).
//
// CHANNEL MIGRATION: Android notification channels are immutable after
// creation — `sound` specifically "cannot be overridden once the channel
// is created" (Notifee's own docs). The previous channel id
// (com.kis.calls.incoming) was created silent on every device that already
// installed that build, so simply changing this file's config would do
// nothing on devices that already have it. A NEW channel id is required —
// this is a deliberate one-time migration to fix an engineering mistake
// (the channel was built silent by accident, not by user choice), not a
// way to re-silence or override a user's own notification preference. The
// old channel is simply never posted to again; it is not deleted, so any
// user who had already customized it keeps that customization intact for
// whatever (now unused) history it has.
//
// DOUBLE-RING AVOIDANCE: once IncomingCallScreen actually mounts (in EITHER
// the foreground-socket path or the background-resume path), it becomes
// the ring owner via audioRouteManager — richer (proper earpiece/speaker
// routing) and already correctly stops on unmount for every answer/decline/
// end path. IncomingCallScreen's mount effect cancels this notification
// (Android only) the instant it takes over, so the two mechanisms are
// sequential (background notification rings first; in-app screen takes
// over the moment it's up), never sustained-concurrent. See its own
// comment for the reasoning on why this is safe even if the user
// backgrounds the ringing call again afterward.

import type { CallType } from './callTypes';
import { hasVideo } from './callTypes';

// KIS brand gold — small-icon accent tint only; does not affect reliability.
const BRAND_GOLD = '#C9A24A';

async function getNotifee(): Promise<any | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('@notifee/react-native');
    return mod?.default ?? mod;
  } catch {
    return null;
  }
}

// ".v2" because the original "com.kis.calls.incoming" id was created
// silent and is permanently stuck that way on any device that already has
// it — see this file's top-of-file comment. Any FUTURE change to this
// channel's sound/vibration would need ANOTHER new id, for the same reason.
const CHANNEL_ID = 'com.kis.calls.incoming.v2';

let _channelReady: Promise<void> | null = null;

/** Idempotent — safe to call on every incoming call, not just once per app
 * process. Notifee's createChannel() is a cheap no-op if the channel (by
 * this exact id) already exists, and this also has to work from the
 * headless JS context a killed-app FCM push runs in, where there's no
 * mount-time effect to have created it ahead of time. */
function ensureChannel(notifee: any): Promise<void> {
  if (_channelReady) return _channelReady;
  _channelReady = (async () => {
    try {
      await notifee.createChannel({
        id: CHANNEL_ID,
        name: 'Incoming calls',
        importance: notifee.AndroidImportance?.HIGH ?? 4,
        // 'default' = the device's default notification sound, looped (see
        // showIncomingCallNotification's loopSound) for the duration of the
        // ringing notification — this channel IS the guaranteed ring audio
        // source now (see top-of-file comment for why Telecom's own Ringer
        // can't be trusted for that). Respects the user's own ring/
        // notification volume and Do Not Disturb exactly as any normal
        // Android notification sound would — nothing here bypasses either.
        sound: 'default',
        vibration: true,
      });
    } catch {
      _channelReady = null; // allow a retry on the next incoming call
    }
  })();
  return _channelReady;
}

/**
 * Posts (or replaces, if one with this callId is already showing — e.g. a
 * duplicate FCM delivery) the full-screen-intent notification that reliably
 * launches MainActivity from the background/killed state. Returns whether
 * it was actually posted, so callers can tell "shown" from "notifee
 * unavailable / POST_NOTIFICATIONS denied" (the latter is a real, user-
 * controlled Android restriction — not a bug — see NotificationPermission
 * Modal; Telecom's own ring is unaffected either way).
 */
export async function showIncomingCallNotification(params: {
  callId: string;
  callerName: string;
  callType: CallType;
}): Promise<boolean> {
  const notifee = await getNotifee();
  if (!notifee?.displayNotification) return false;
  const isVideo = hasVideo(params.callType);
  // Call-type-aware fallback, not a generic "Incoming call" — matches the
  // body text below and gives the user real information even when the
  // caller's display name couldn't be resolved (never blocks on a network
  // call to find out; the backend already resolves this server-side before
  // the push is ever sent — see notifications.service.ts's
  // resolveCallerLabel).
  const fallbackTitle = isVideo ? 'Incoming video call' : 'Incoming voice call';
  try {
    await ensureChannel(notifee);
    await notifee.displayNotification({
      id: params.callId,
      title: params.callerName || fallbackTitle,
      body: isVideo ? 'Incoming video call' : 'Incoming voice call',
      android: {
        channelId: CHANNEL_ID,
        category: notifee.AndroidCategory?.CALL ?? 'call',
        importance: notifee.AndroidImportance?.HIGH ?? 4,
        color: BRAND_GOLD,
        ongoing: true,
        autoCancel: false,
        // The notification IS the ring — see this file's top-of-file
        // comment. Loops the channel's sound for as long as the
        // notification is showing; cancelIncomingCallNotification() (every
        // answer/decline/cancel/timeout/remote-hangup path, plus
        // IncomingCallScreen's own mount-time handoff) is what stops it.
        loopSound: true,
        // A duplicate FCM delivery for the SAME callId re-posts (replaces)
        // this notification rather than stacking a second one — without
        // this flag, that replace would also re-trigger the alert
        // (sound/vibration restart) even though it's already ringing.
        onlyAlertOnce: true,
        // Matches the server's ~90s ring timeout plus margin (see
        // pendingCallPayload.ts/callDiagnostics.ts) — a backstop so a missed
        // explicit-cancel call site can never leave this notification (and
        // its looping sound) stuck for a call that's already over.
        timeoutAfter: 95_000,
        fullScreenAction: { id: 'default', launchActivity: 'default' },
        pressAction: { id: 'default', launchActivity: 'default' },
      },
    });
    return true;
  } catch {
    return false;
  }
}

/** Call on answer, decline, caller-cancel, timeout, or remote hangup — every
 * exit from the ringing state. Safe/idempotent to call even if no
 * notification with this id is currently showing. */
export async function cancelIncomingCallNotification(callId: string): Promise<void> {
  if (!callId) return;
  const notifee = await getNotifee();
  if (!notifee?.cancelNotification) return;
  try {
    await notifee.cancelNotification(callId);
  } catch {
    /* best-effort */
  }
}
