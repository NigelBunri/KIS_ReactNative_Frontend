// Regression coverage for declining a call directly from the Android
// incoming-call notification's "Decline" action — must work with no live
// socket connection and no Activity launch at all, since the app may be
// fully backgrounded or killed when the button is pressed. See
// incomingCallActions.ts's own doc comment for why "Answer" has no
// equivalent background handler (it relies on launchActivity instead).

jest.mock('@/network/post', () => ({ postRequest: jest.fn().mockResolvedValue({ success: true }) }));
jest.mock('@/network', () => ({
  __esModule: true,
  default: { calls: { decline: (callId: string) => `https://nest.example.com/calls/${callId}/decline` } },
}));
jest.mock('../incomingCallNotification', () => ({
  cancelIncomingCallNotification: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../callKitService', () => ({
  reportCallEnded: jest.fn(),
}));
jest.mock('../pendingCallPayload', () => ({
  clearPendingCallPayload: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../callDiagnostics', () => ({
  logCallDiagnostic: jest.fn().mockResolvedValue(undefined),
}));

import { postRequest } from '@/network/post';
import { cancelIncomingCallNotification } from '../incomingCallNotification';
import { reportCallEnded } from '../callKitService';
import { clearPendingCallPayload } from '../pendingCallPayload';
import { declineCallFromNotification, registerIncomingCallActionHandler } from '../incomingCallActions';

const mockedPostRequest = postRequest as jest.MockedFunction<typeof postRequest>;
const mockedCancel = cancelIncomingCallNotification as jest.MockedFunction<typeof cancelIncomingCallNotification>;
const mockedReportCallEnded = reportCallEnded as jest.MockedFunction<typeof reportCallEnded>;
const mockedClearPending = clearPendingCallPayload as jest.MockedFunction<typeof clearPendingCallPayload>;

describe('declineCallFromNotification', () => {
  beforeEach(() => jest.clearAllMocks());

  it('POSTs the decline to the authoritative endpoint with the exact call/conversation ids', async () => {
    await declineCallFromNotification({ callId: 'call-1', conversationId: 'conv-1' });

    expect(mockedPostRequest).toHaveBeenCalledWith(
      'https://nest.example.com/calls/call-1/decline',
      { conversation_id: 'conv-1' },
    );
  });

  it('always cancels the local notification, reports the native call end, and clears the pending payload — even though the POST already ran', async () => {
    await declineCallFromNotification({ callId: 'call-1', conversationId: 'conv-1' });

    expect(mockedCancel).toHaveBeenCalledWith('call-1');
    expect(mockedReportCallEnded).toHaveBeenCalledWith('call-1', 'rejected');
    expect(mockedClearPending).toHaveBeenCalledWith('call-1');
  });

  it('still performs local cleanup even when the server request fails — the device must stop ringing regardless', async () => {
    mockedPostRequest.mockRejectedValueOnce(new Error('network down'));

    await expect(
      declineCallFromNotification({ callId: 'call-1', conversationId: 'conv-1' }),
    ).resolves.toBeUndefined();

    expect(mockedCancel).toHaveBeenCalledWith('call-1');
    expect(mockedReportCallEnded).toHaveBeenCalledWith('call-1', 'rejected');
  });
});

describe('registerIncomingCallActionHandler', () => {
  beforeEach(() => jest.clearAllMocks());

  it('registers exactly one background event listener even if called multiple times (idempotent)', async () => {
    const onBackgroundEvent = jest.fn();
    jest.resetModules();
    jest.doMock('@notifee/react-native', () => ({ default: { onBackgroundEvent } }), { virtual: true });
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('../incomingCallActions');

    await mod.registerIncomingCallActionHandler();
    await mod.registerIncomingCallActionHandler();

    expect(onBackgroundEvent).toHaveBeenCalledTimes(1);
  });

  it('declines the call when the registered handler receives an ACTION_PRESS/decline event', async () => {
    let capturedHandler: ((event: any) => Promise<void>) | null = null;
    const onBackgroundEvent = jest.fn((handler: any) => { capturedHandler = handler; });
    jest.resetModules();
    jest.doMock('@notifee/react-native', () => ({ default: { onBackgroundEvent } }), { virtual: true });
    jest.doMock('../incomingCallNotification', () => ({ cancelIncomingCallNotification: jest.fn().mockResolvedValue(undefined) }));
    jest.doMock('../callKitService', () => ({ reportCallEnded: jest.fn() }));
    jest.doMock('../pendingCallPayload', () => ({ clearPendingCallPayload: jest.fn().mockResolvedValue(undefined) }));
    jest.doMock('../callDiagnostics', () => ({ logCallDiagnostic: jest.fn().mockResolvedValue(undefined) }));
    jest.doMock('@/network/post', () => ({ postRequest: jest.fn().mockResolvedValue({ success: true }) }));
    jest.doMock('@/network', () => ({
      __esModule: true,
      default: { calls: { decline: (callId: string) => `https://nest.example.com/calls/${callId}/decline` } },
    }));
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('../incomingCallActions');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { postRequest: mockedPost } = require('@/network/post');

    await mod.registerIncomingCallActionHandler();
    expect(capturedHandler).not.toBeNull();

    await capturedHandler!({
      type: 2, // ACTION_PRESS
      detail: {
        pressAction: { id: 'decline' },
        notification: { id: 'call-9', data: { callId: 'call-9', conversationId: 'conv-9' } },
      },
    });

    expect(mockedPost).toHaveBeenCalledWith(
      'https://nest.example.com/calls/call-9/decline',
      { conversation_id: 'conv-9' },
    );
  });

  it('ignores every other event type/action — only decline is handled here', async () => {
    let capturedHandler: ((event: any) => Promise<void>) | null = null;
    const onBackgroundEvent = jest.fn((handler: any) => { capturedHandler = handler; });
    jest.resetModules();
    jest.doMock('@notifee/react-native', () => ({ default: { onBackgroundEvent } }), { virtual: true });
    jest.doMock('@/network/post', () => ({ postRequest: jest.fn().mockResolvedValue({ success: true }) }));
    jest.doMock('@/network', () => ({ __esModule: true, default: { calls: { decline: (id: string) => `x/${id}` } } }));
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('../incomingCallActions');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { postRequest: mockedPost } = require('@/network/post');

    await mod.registerIncomingCallActionHandler();

    // PRESS (plain tap, not an action button) — not decline.
    await capturedHandler!({ type: 1, detail: { notification: { id: 'call-1', data: {} } } });
    // ACTION_PRESS but the 'answer' action, not 'decline'.
    await capturedHandler!({
      type: 2,
      detail: { pressAction: { id: 'answer' }, notification: { id: 'call-1', data: { callId: 'call-1', conversationId: 'conv-1' } } },
    });

    expect(mockedPost).not.toHaveBeenCalled();
  });
});
