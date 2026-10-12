jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/network/post', () => ({ postRequest: jest.fn().mockResolvedValue({ success: true }) }));

jest.mock('@/network', () => ({
  __esModule: true,
  default: {
    notifications: {
      deviceTokenRegister: 'https://api.example.com/api/v1/notification-device-tokens/register/',
      deviceTokenUnregister: 'https://api.example.com/api/v1/notification-device-tokens/unregister/',
    },
    calls: {
      ringingAck: (callId: string) => `https://nest.example.com/calls/${callId}/ringing-ack`,
    },
  },
}));

jest.mock('@/network/config', () => ({ NEST_API_BASE_URL: 'https://nest.example.com' }));

jest.mock('../notificationRouter', () => ({ routeNotification: jest.fn() }));
jest.mock('../InAppNotificationToast', () => ({ InAppNotificationToastRef: { current: null } }));
jest.mock('@/services/calls/callKitService', () => ({
  displayIncomingCall: jest.fn(),
  callKeepAvailable: true,
  bringCallToForeground: jest.fn(),
}));
jest.mock('@/services/calls/incomingCallNotification', () => ({
  showIncomingCallNotification: jest.fn().mockResolvedValue(true),
}));
jest.mock('@/services/calls/callDiagnostics', () => ({ logCallDiagnostic: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/security/e2ee', () => ({ ensureDeviceId: jest.fn().mockResolvedValue('device-1') }));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import { unregisterPushToken, reregisterPushTokensForCurrentUser, handleBackgroundPushMessage } from '../notifications';
import { displayIncomingCall, bringCallToForeground } from '@/services/calls/callKitService';
import { showIncomingCallNotification } from '@/services/calls/incomingCallNotification';
import { logCallDiagnostic } from '@/services/calls/callDiagnostics';

const mockedPostRequest = postRequest as jest.MockedFunction<typeof postRequest>;
const mockedGetItem = AsyncStorage.getItem as jest.MockedFunction<typeof AsyncStorage.getItem>;
const mockedSetItem = AsyncStorage.setItem as jest.MockedFunction<typeof AsyncStorage.setItem>;
const mockedRemoveItem = AsyncStorage.removeItem as jest.MockedFunction<typeof AsyncStorage.removeItem>;
const mockedDisplayIncomingCall = displayIncomingCall as jest.MockedFunction<typeof displayIncomingCall>;
const mockedBringCallToForeground = bringCallToForeground as jest.MockedFunction<typeof bringCallToForeground>;
const mockedShowIncomingCallNotification = showIncomingCallNotification as jest.MockedFunction<typeof showIncomingCallNotification>;
const mockedLogCallDiagnostic = logCallDiagnostic as jest.MockedFunction<typeof logCallDiagnostic>;

describe('unregisterPushToken', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('unregisters with both Django and Nest using the stored device_id and push_token', async () => {
    mockedGetItem.mockImplementation(async (key: string) => {
      if (key === 'device_id') return 'device-1';
      if (key === 'push_token') return 'token-1';
      return null;
    });

    await unregisterPushToken();

    expect(mockedPostRequest).toHaveBeenCalledWith(
      ROUTES.notifications.deviceTokenUnregister,
      { device_id: 'device-1', push_token: 'token-1' },
    );
    expect(mockedPostRequest).toHaveBeenCalledWith(
      'https://nest.example.com/notifications/tokens/unregister',
      { token: 'token-1', deviceId: 'device-1' },
    );
  });

  it('does nothing when neither a device_id nor a push_token is known locally', async () => {
    mockedGetItem.mockResolvedValue(null);

    await unregisterPushToken();

    expect(mockedPostRequest).not.toHaveBeenCalled();
  });

  it('still calls both backends when only device_id is known (partial storage clear)', async () => {
    mockedGetItem.mockImplementation(async (key: string) => (key === 'device_id' ? 'device-1' : null));

    await unregisterPushToken();

    expect(mockedPostRequest).toHaveBeenCalledWith(
      ROUTES.notifications.deviceTokenUnregister,
      { device_id: 'device-1', push_token: undefined },
    );
  });

  it('never throws even if both network calls fail (best-effort, must not block logout)', async () => {
    mockedGetItem.mockImplementation(async (key: string) => (key === 'device_id' ? 'device-1' : null));
    mockedPostRequest.mockRejectedValue(new Error('network down'));

    await expect(unregisterPushToken()).resolves.toBeUndefined();
  });

  it('clears every pending-registration retry key so a stale attempt cannot fire under the next logged-in user', async () => {
    mockedGetItem.mockImplementation(async (key: string) => (key === 'device_id' ? 'device-1' : null));

    await unregisterPushToken();

    expect(mockedRemoveItem).toHaveBeenCalledWith('KIS_PENDING_PUSH_TOKEN');
    expect(mockedRemoveItem).toHaveBeenCalledWith('KIS_PENDING_NEST_PUSH_TOKEN');
    expect(mockedRemoveItem).toHaveBeenCalledWith('KIS_PENDING_VOIP_PUSH_TOKEN');
  });
});

// Regression coverage: registerPushToken() (exercised here via the exported
// reregisterPushTokensForCurrentUser) previously fired its write to Nest
// with a bare `.catch(() => {})` that discarded even a clean
// {success:false} result — Django's write had its own pending-retry
// tracking, Nest's silently had none. These tests lock in that Nest is now
// tracked independently.
describe('registerPushToken — Nest registration tracked independently of Django', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetItem.mockImplementation(async (key: string) => {
      if (key === 'fcm_token') return 'fcm-token-1';
      if (key === 'apns_token') return null;
      return null;
    });
  });

  it('clears the Nest pending key when the Nest write succeeds', async () => {
    mockedPostRequest.mockResolvedValue({ success: true });

    await reregisterPushTokensForCurrentUser();

    expect(mockedPostRequest).toHaveBeenCalledWith(
      'https://nest.example.com/notifications/tokens/register',
      // react-native's jest preset defaults Platform.OS to 'ios'.
      { token: 'fcm-token-1', platform: 'ios', deviceId: 'device-1' },
    );
    expect(mockedRemoveItem).toHaveBeenCalledWith('KIS_PENDING_NEST_PUSH_TOKEN');
  });

  it('persists a pending-retry record when the Nest write fails but Django succeeds', async () => {
    mockedPostRequest.mockImplementation(async (url: string) => {
      if (url.includes('nest.example.com')) return { success: false, message: 'Nest unavailable' };
      return { success: true };
    });

    await reregisterPushTokensForCurrentUser();

    expect(mockedSetItem).toHaveBeenCalledWith(
      'KIS_PENDING_NEST_PUSH_TOKEN',
      expect.stringContaining('"pushToken":"fcm-token-1"'),
    );
    // Django's own success must not be affected by Nest's independent failure.
    expect(mockedRemoveItem).toHaveBeenCalledWith('KIS_PENDING_PUSH_TOKEN');
  });

  it('persists a pending-retry record when the Nest write throws', async () => {
    mockedPostRequest.mockImplementation(async (url: string) => {
      if (url.includes('nest.example.com')) throw new Error('network down');
      return { success: true };
    });

    await reregisterPushTokensForCurrentUser();

    expect(mockedSetItem).toHaveBeenCalledWith(
      'KIS_PENDING_NEST_PUSH_TOKEN',
      expect.stringContaining('"pushToken":"fcm-token-1"'),
    );
  });
});

// Coverage for FAILURE B (background calling reliability): the background
// FCM handler is the ONLY path that can wake a fully-killed app into
// CallKeep. These tests lock in the pipeline-stage diagnostics added so a
// physical-device "it rang but no UI" report can actually be traced, and
// verify the handler correctly branches on displayIncomingCall's
// success/failure result instead of assuming it always worked.
describe('handleBackgroundPushMessage — incoming_call pipeline', () => {
  beforeEach(() => jest.clearAllMocks());

  it('parses an incoming_call payload and requests CallKeep display with the right args', async () => {
    mockedDisplayIncomingCall.mockResolvedValue(true);

    await handleBackgroundPushMessage({
      data: { type: 'incoming_call', callId: 'call-123', callerName: 'Jane', callType: 'video' },
    });

    expect(mockedDisplayIncomingCall).toHaveBeenCalledWith({
      callUUID: 'call-123',
      callerName: 'Jane',
      callType: 'video',
    });
  });

  it('logs the full pipeline stage sequence when CallKeep display and the full-screen notification both succeed', async () => {
    mockedDisplayIncomingCall.mockResolvedValue(true);
    mockedShowIncomingCallNotification.mockResolvedValue(true);

    await handleBackgroundPushMessage({
      data: { type: 'incoming_call', callId: 'call-123', callType: 'voice' },
    });

    const stages = mockedLogCallDiagnostic.mock.calls.map((c) => c[0].stage);
    expect(stages).toEqual([
      'PUSH_RECEIVED',
      'BACKGROUND_HANDLER_STARTED',
      'CALL_PAYLOAD_PARSED',
      'CALLKEEP_REQUESTED',
      'CALLKEEP_DISPLAYED_OK',
      'FULLSCREEN_NOTIFICATION_SHOWN',
    ]);
  });

  it('logs CALLKEEP_DISPLAYED_FAILED — not OK — when displayIncomingCall reports failure', async () => {
    mockedDisplayIncomingCall.mockResolvedValue(false);

    await handleBackgroundPushMessage({
      data: { type: 'incoming_call', callId: 'call-456', callType: 'video' },
    });

    const stages = mockedLogCallDiagnostic.mock.calls.map((c) => c[0].stage);
    expect(stages).toContain('CALLKEEP_DISPLAYED_FAILED');
    expect(stages).not.toContain('CALLKEEP_DISPLAYED_OK');
  });

  it('does not treat a non-call push (e.g. a regular message) as an incoming call', async () => {
    await handleBackgroundPushMessage({
      data: { type: 'message', conversationId: 'conv-1' },
      notification: { title: 'New message', body: 'Hi' },
    });

    expect(mockedDisplayIncomingCall).not.toHaveBeenCalled();
  });

  // Regression coverage for "phone rang audibly but the incoming-call
  // screen never appeared until the user manually reopened the app": the
  // Telecom/ConnectionService ring is independent of any UI on Android —
  // nothing brings the app's Activity forward unless this is called.
  describe('bringCallToForeground wiring', () => {
    it('calls bringCallToForeground after a successful display', async () => {
      mockedDisplayIncomingCall.mockResolvedValue(true);

      await handleBackgroundPushMessage({
        data: { type: 'incoming_call', callId: 'call-123', callType: 'voice' },
      });

      expect(mockedBringCallToForeground).toHaveBeenCalledTimes(1);
    });

    it('does NOT call bringCallToForeground when display itself failed — nothing to bring forward', async () => {
      mockedDisplayIncomingCall.mockResolvedValue(false);

      await handleBackgroundPushMessage({
        data: { type: 'incoming_call', callId: 'call-456', callType: 'voice' },
      });

      expect(mockedBringCallToForeground).not.toHaveBeenCalled();
    });

    it('does not call bringCallToForeground for a non-call push', async () => {
      await handleBackgroundPushMessage({
        data: { type: 'message', conversationId: 'conv-1' },
        notification: { title: 'New message', body: 'Hi' },
      });

      expect(mockedBringCallToForeground).not.toHaveBeenCalled();
    });
  });

  // Coverage for the final root-cause fix: bringCallToForeground()'s raw
  // startActivity() from a non-Activity context is not guaranteed by
  // Android 10+'s background-activity-launch restrictions. The full-screen-
  // intent notification is the BAL-exempt mechanism, and must be posted
  // UNCONDITIONALLY — not gated on displayIncomingCall's own success —
  // since it's an independent delivery path from Telecom/ConnectionService.
  describe('showIncomingCallNotification wiring (final incoming-call-UI fix)', () => {
    it('posts the full-screen notification after a successful display', async () => {
      mockedDisplayIncomingCall.mockResolvedValue(true);

      await handleBackgroundPushMessage({
        data: { type: 'incoming_call', callId: 'call-123', conversationId: 'conv-1', callerName: 'Jane', callType: 'video' },
      });

      expect(mockedShowIncomingCallNotification).toHaveBeenCalledWith({
        callId: 'call-123',
        conversationId: 'conv-1',
        callerName: 'Jane',
        callType: 'video',
      });
    });

    it('still posts the full-screen notification even when native CallKeep display failed — it is an independent delivery path', async () => {
      mockedDisplayIncomingCall.mockResolvedValue(false);

      await handleBackgroundPushMessage({
        data: { type: 'incoming_call', callId: 'call-456', conversationId: 'conv-1', callerName: 'Jane', callType: 'voice' },
      });

      expect(mockedShowIncomingCallNotification).toHaveBeenCalledWith({
        callId: 'call-456',
        conversationId: 'conv-1',
        callerName: 'Jane',
        callType: 'voice',
      });
    });

    it('does not post a full-screen notification for a non-call push', async () => {
      await handleBackgroundPushMessage({
        data: { type: 'message', conversationId: 'conv-1' },
        notification: { title: 'New message', body: 'Hi' },
      });

      expect(mockedShowIncomingCallNotification).not.toHaveBeenCalled();
    });

    it('logs FULLSCREEN_NOTIFICATION_FAILED (not SHOWN) when notifee is unavailable or permission was denied', async () => {
      mockedDisplayIncomingCall.mockResolvedValue(true);
      mockedShowIncomingCallNotification.mockResolvedValue(false);

      await handleBackgroundPushMessage({
        data: { type: 'incoming_call', callId: 'call-789', callType: 'voice' },
      });

      const stages = mockedLogCallDiagnostic.mock.calls.map((c) => c[0].stage);
      expect(stages).toContain('FULLSCREEN_NOTIFICATION_FAILED');
      expect(stages).not.toContain('FULLSCREEN_NOTIFICATION_SHOWN');
    });

    it('does not post the full-screen notification for a stale push', async () => {
      await handleBackgroundPushMessage({
        data: {
          type: 'incoming_call',
          callId: 'call-stale',
          callType: 'voice',
          sentAt: String(Date.now() - 80_000),
        },
      });

      expect(mockedShowIncomingCallNotification).not.toHaveBeenCalled();
    });
  });

  // Coverage for the Calling→Ringing device-acknowledgement path that
  // works even with no live socket at all (fully backgrounded/killed
  // process, woken only by this FCM push). Mirrors the socket-based
  // call.ringing event for the one path sockets can't reach.
  describe('ringing-ack wiring (Calling→Ringing device acknowledgement)', () => {
    it('POSTs a ringing acknowledgement for the call, with the conversation id', async () => {
      await handleBackgroundPushMessage({
        data: { type: 'incoming_call', callId: 'call-123', callType: 'voice', conversationId: 'conv-1' },
      });

      expect(mockedPostRequest).toHaveBeenCalledWith(
        'https://nest.example.com/calls/call-123/ringing-ack',
        { conversation_id: 'conv-1' },
      );
    });

    it('does not POST an ack when there is no conversation id to report', async () => {
      await handleBackgroundPushMessage({
        data: { type: 'incoming_call', callId: 'call-123', callType: 'voice' },
      });

      expect(mockedPostRequest).not.toHaveBeenCalledWith(
        expect.stringContaining('ringing-ack'),
        expect.anything(),
      );
    });

    it('does not POST an ack for a stale push — it never reaches this point', async () => {
      await handleBackgroundPushMessage({
        data: {
          type: 'incoming_call',
          callId: 'call-stale',
          callType: 'voice',
          conversationId: 'conv-1',
          sentAt: String(Date.now() - 80_000),
        },
      });

      expect(mockedPostRequest).not.toHaveBeenCalledWith(
        expect.stringContaining('ringing-ack'),
        expect.anything(),
      );
    });

    it('a failed ack is best-effort — never throws, never blocks the rest of the handler', async () => {
      mockedPostRequest.mockRejectedValueOnce(new Error('network down'));

      await expect(
        handleBackgroundPushMessage({
          data: { type: 'incoming_call', callId: 'call-123', callType: 'voice', conversationId: 'conv-1' },
        }),
      ).resolves.toBeUndefined();
    });
  });

  // Coverage for FAILURE B's "a call is already ended when a delayed push
  // arrives" case: a device that was offline (or on a flaky connection)
  // can receive this push long after the call rang out and was marked
  // missed server-side. Showing a ring UI for it would present a dead call
  // as a live incoming one.
  describe('stale push protection (sentAt / expiresInSeconds)', () => {
    it('skips displaying the call when sentAt is older than the staleness threshold', async () => {
      await handleBackgroundPushMessage({
        data: {
          type: 'incoming_call',
          callId: 'call-123',
          callerName: 'Jane',
          callType: 'voice',
          sentAt: String(Date.now() - 80_000), // older than the 75s cutoff
        },
      });

      expect(mockedDisplayIncomingCall).not.toHaveBeenCalled();
      expect(mockedBringCallToForeground).not.toHaveBeenCalled();
      const stages = mockedLogCallDiagnostic.mock.calls.map((c) => c[0].stage);
      expect(stages).toContain('CALL_PUSH_STALE_SKIPPED');
      expect(stages).not.toContain('CALLKEEP_REQUESTED');
    });

    it('still displays the call when sentAt is recent', async () => {
      mockedDisplayIncomingCall.mockResolvedValue(true);

      await handleBackgroundPushMessage({
        data: {
          type: 'incoming_call',
          callId: 'call-123',
          callerName: 'Jane',
          callType: 'voice',
          sentAt: String(Date.now() - 2_000),
        },
      });

      expect(mockedDisplayIncomingCall).toHaveBeenCalledWith(
        expect.objectContaining({ callUUID: 'call-123' }),
      );
    });

    it('still displays the call when sentAt is absent (older server build, fail open)', async () => {
      mockedDisplayIncomingCall.mockResolvedValue(true);

      await handleBackgroundPushMessage({
        data: { type: 'incoming_call', callId: 'call-123', callerName: 'Jane', callType: 'voice' },
      });

      expect(mockedDisplayIncomingCall).toHaveBeenCalled();
    });
  });
});
