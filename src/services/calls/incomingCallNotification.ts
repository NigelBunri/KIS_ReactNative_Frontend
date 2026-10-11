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
// Deliberately silent (no sound/vibration of its own): Telecom's own
// ringtone (via setRinging()) is already the single source of ring audio;
// giving this notification a sound too would double-ring. Its only job is
// to be the thing Android is willing to let launch an Activity from the
// background.
//
// Migrating the Telecom account to CAPABILITY_SELF_MANAGED was considered
// (self-managed connections DO get their own BAL exemption, which is why
// Signal/WhatsApp/Viber-style apps normally use that mode) but deliberately
// NOT done here: it's a broader native change with real behavioral side
// effects (audio-focus/DND/Bluetooth-routing all shift to the app's
// responsibility instead of Telecom's), it is not required to fix this
// specific defect (the full-screen-intent notification is BAL-exempt on its
// own, independent of self-managed status), and the task's own instructions
// call for the smallest complete fix. See the final report for the full
// evidence trail.

import type { CallType } from './callTypes';
import { hasVideo } from './callTypes';

async function getNotifee(): Promise<any | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('@notifee/react-native');
    return mod?.default ?? mod;
  } catch {
    return null;
  }
}

const CHANNEL_ID = 'com.kis.calls.incoming';

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
        // No sound/vibration — Telecom's own ringtone (VoiceConnectionService
        // .setRinging()) already owns call audio; this channel exists purely
        // to be a BAL-exempt launch vehicle for the call screen.
        sound: undefined,
        vibration: false,
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
  try {
    await ensureChannel(notifee);
    await notifee.displayNotification({
      id: params.callId,
      title: params.callerName || 'Incoming call',
      body: hasVideo(params.callType) ? 'Incoming video call' : 'Incoming voice call',
      android: {
        channelId: CHANNEL_ID,
        category: notifee.AndroidCategory?.CALL ?? 'call',
        importance: notifee.AndroidImportance?.HIGH ?? 4,
        ongoing: true,
        autoCancel: false,
        // Matches the server's ~90s ring timeout plus margin (see
        // pendingCallPayload.ts/callDiagnostics.ts) — a backstop so a missed
        // explicit-cancel call site can never leave this notification (and
        // the full-screen launch it can retrigger) stuck showing for a call
        // that's already over.
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
