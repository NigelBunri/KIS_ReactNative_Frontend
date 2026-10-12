// src/services/calls/incomingCallActions.ts
//
// Android only. Registers Notifee's background event handler so the
// incoming-call notification's "Decline" action (see
// incomingCallNotification.ts) works entirely in the background — no
// Activity launch, no app foregrounding at all, matching how a real phone
// app's decline behaves. Must be registered unconditionally at JS entry
// (index.js), not later inside App.tsx's mount effect, for the exact same
// reason registerBackgroundPushHandler() and registerAndroidEvents() are:
// Android can invoke this from a headless JS instance even when the app
// process was fully killed, but only for a handler that was already
// registered before the action was pressed.
//
// "Answer" deliberately has NO handler here — its `launchActivity:
// 'default'` already does everything needed (brings the app forward onto
// the real IncomingCallScreen; see incomingCallNotification.ts's top-of-
// file comment for why a fully-headless one-tap answer was not attempted).

import ROUTES from '@/network';
import { postRequest } from '@/network/post';
import { cancelIncomingCallNotification } from './incomingCallNotification';
import { reportCallEnded } from './callKitService';
import { clearPendingCallPayload } from './pendingCallPayload';
import { logCallDiagnostic } from './callDiagnostics';

async function getNotifee(): Promise<any | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('@notifee/react-native');
    return mod?.default ?? mod;
  } catch {
    return null;
  }
}

/**
 * Authoritatively declines a call with no live socket connection at all —
 * the plain HTTP endpoint is the only thing that can reach the server from
 * this headless context (same reasoning as the ringing-ack in
 * push/notifications.ts). Exported standalone (not folded into the event
 * handler below) so it's directly unit-testable without needing to
 * simulate a full Notifee background event.
 */
export async function declineCallFromNotification(params: {
  callId: string;
  conversationId: string;
}): Promise<void> {
  const { callId, conversationId } = params;
  try {
    await postRequest(ROUTES.calls.decline(callId), { conversation_id: conversationId });
    void logCallDiagnostic({ stage: 'CALL_ENDED', callId, detail: 'declined_from_notification' });
  } catch {
    // Best-effort — the call may already have ended server-side (caller
    // cancelled, server-side ring timeout), or the request failed to reach
    // the server at all. Either way, the local cleanup below still runs,
    // so this device stops ringing regardless; a genuinely still-active
    // call on the server will be caught by its own ring timeout.
  } finally {
    void cancelIncomingCallNotification(callId);
    reportCallEnded(callId, 'rejected');
    void clearPendingCallPayload(callId);
  }
}

// Notifee's EventType enum (ACTION_PRESS = 2) is a NAMED export from the
// package root (`export * from './types/Notification'`), not a static
// property on the default-export Module instance `getNotifee()` returns —
// unlike this file's sibling incomingCallNotification.ts, which only ever
// reads AndroidImportance/AndroidCategory with a hardcoded `?? literal`
// fallback (so it happens to work either way), there is no safe fallback
// for a strict equality check here, so this is hardcoded directly rather
// than risking `notifee.EventType` being undefined and throwing.
const EVENT_TYPE_ACTION_PRESS = 2;

let _registered = false;

/** Idempotent — safe to call more than once per process (index.js calls it
 * unconditionally at JS entry; nothing else needs to call it again, but a
 * duplicate call must not register two listeners). */
export async function registerIncomingCallActionHandler(): Promise<void> {
  if (_registered) return;
  const notifee = await getNotifee();
  if (!notifee?.onBackgroundEvent) return;
  _registered = true;

  notifee.onBackgroundEvent(async (event: any) => {
    if (event?.type !== EVENT_TYPE_ACTION_PRESS) return;
    if (event?.detail?.pressAction?.id !== 'decline') return;

    const data = event?.detail?.notification?.data ?? {};
    const callId = data?.callId ? String(data.callId) : String(event?.detail?.notification?.id ?? '');
    const conversationId = data?.conversationId ? String(data.conversationId) : '';
    if (!callId || !conversationId) return;

    await declineCallFromNotification({ callId, conversationId });
  });
}
