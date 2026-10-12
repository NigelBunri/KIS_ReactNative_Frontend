// Regression coverage for the final Android incoming-call reliability fix:
//
// Telecom's VoiceConnectionService rings the device (setRinging()) the
// instant displayIncomingCall() succeeds, independent of any UI — but
// KIS's phone account is non-self-managed, so Android never calls
// Connection.onShowIncomingCallUi(), and bringCallToForeground()'s raw
// Context.startActivity() from a non-Activity context is exactly what
// Android 10+'s background-activity-launch restrictions exist to block.
// A high-priority notification with a `fullScreenAction` is the
// Android-sanctioned, BAL-EXEMPT mechanism for reliably launching the
// call screen from a background/killed process — see
// incomingCallNotification.ts's own doc comment for the full evidence
// trail (react-native-callkeep's actual native source,
// VoiceConnectionService.java / RNCallKeepModule.java).
//
// This notification was originally built silent on the theory that
// Telecom's own Ringer supplied ring audio. Physical-device testing
// disproved that (react-native-callkeep's native Android source contains
// no ringtone-playing code at all) — the notification showed with no
// audible ring. This file's own channel sound is now the guaranteed ring
// source instead; see the module's top-of-file comment for the full
// evidence trail and the channel-migration reasoning (channels are
// immutable post-creation, hence the new ".v2" channel id).
//
// Each test resets modules and re-mocks @notifee/react-native fresh,
// since the module under test caches its channel-creation promise at
// module scope (deliberately — see ensureChannel's own comment on why
// that's safe/correct in production, not just a test artifact).

const mockNotifee = {
  createChannel: jest.fn().mockResolvedValue(undefined),
  displayNotification: jest.fn().mockResolvedValue(undefined),
  cancelNotification: jest.fn().mockResolvedValue(undefined),
  AndroidImportance: { HIGH: 4 },
  AndroidCategory: { CALL: 'call' },
};

function loadModuleWithNotifeeAvailable() {
  jest.resetModules();
  jest.clearAllMocks();
  jest.doMock('@notifee/react-native', () => ({ default: mockNotifee }), { virtual: true });
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../incomingCallNotification');
}

function loadModuleWithNotifeeUnavailable() {
  jest.resetModules();
  jest.doMock('@notifee/react-native', () => {
    throw new Error('native module not linked');
  }, { virtual: true });
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../incomingCallNotification');
}

describe('incomingCallNotification — showIncomingCallNotification', () => {
  it('posts a notification with the callId as its id, CALL category, and a fullScreenAction targeting the default activity', async () => {
    const { showIncomingCallNotification } = loadModuleWithNotifeeAvailable();

    const shown = await showIncomingCallNotification({
      callId: 'call-abc',
      conversationId: 'conv-1',
      callerName: 'Jane Doe',
      callType: 'voice',
    });

    expect(shown).toBe(true);
    expect(mockNotifee.displayNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'call-abc',
        title: 'Jane Doe',
        data: { callId: 'call-abc', conversationId: 'conv-1' },
        android: expect.objectContaining({
          category: 'call',
          importance: 4,
          fullScreenAction: { id: 'default', launchActivity: 'default' },
          actions: [
            { title: 'Decline', pressAction: { id: 'decline' } },
            { title: 'Answer', pressAction: { id: 'answer', launchActivity: 'default' } },
          ],
        }),
      }),
    );
  });

  it('creates the notification channel before displaying, every time it is needed', async () => {
    const { showIncomingCallNotification } = loadModuleWithNotifeeAvailable();

    await showIncomingCallNotification({ callId: 'call-1', conversationId: 'conv-1', callerName: 'A', callType: 'voice' });

    expect(mockNotifee.createChannel).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'com.kis.calls.incoming.v2', importance: 4 }),
    );
  });

  it('does not recreate the channel on a second call within the same process — createChannel is idempotent by design, not re-invoked needlessly', async () => {
    const { showIncomingCallNotification } = loadModuleWithNotifeeAvailable();

    await showIncomingCallNotification({ callId: 'call-1', conversationId: 'conv-1', callerName: 'A', callType: 'voice' });
    await showIncomingCallNotification({ callId: 'call-2', conversationId: 'conv-1', callerName: 'B', callType: 'voice' });

    expect(mockNotifee.createChannel).toHaveBeenCalledTimes(1);
    expect(mockNotifee.displayNotification).toHaveBeenCalledTimes(2);
  });

  it('labels a video call distinctly from a voice call', async () => {
    const { showIncomingCallNotification } = loadModuleWithNotifeeAvailable();

    await showIncomingCallNotification({ callId: 'call-video', conversationId: 'conv-1', callerName: 'A', callType: 'video' });

    expect(mockNotifee.displayNotification).toHaveBeenCalledWith(
      expect.objectContaining({ body: 'Incoming video call' }),
    );
  });

  it('attaches a real sound and vibration to the channel — this notification is now the guaranteed ring source, not Telecom', async () => {
    const { showIncomingCallNotification } = loadModuleWithNotifeeAvailable();

    await showIncomingCallNotification({ callId: 'call-1', conversationId: 'conv-1', callerName: 'A', callType: 'voice' });

    const channelArgs = mockNotifee.createChannel.mock.calls[0][0];
    expect(channelArgs.sound).toBe('default');
    expect(channelArgs.vibration).toBe(true);
  });

  it('loops the sound and only alerts once per notification id — a duplicate FCM delivery for the same call must not restart or stack the ring', async () => {
    const { showIncomingCallNotification } = loadModuleWithNotifeeAvailable();

    await showIncomingCallNotification({ callId: 'call-1', conversationId: 'conv-1', callerName: 'A', callType: 'voice' });

    expect(mockNotifee.displayNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        android: expect.objectContaining({ loopSound: true, onlyAlertOnce: true }),
      }),
    );
  });

  it('falls back to a call-type-aware title (not a generic "Incoming call") when the caller name is unavailable', async () => {
    const { showIncomingCallNotification } = loadModuleWithNotifeeAvailable();

    await showIncomingCallNotification({ callId: 'call-1', conversationId: 'conv-1', callerName: '', callType: 'video' });

    expect(mockNotifee.displayNotification).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Incoming video call' }),
    );
  });

  it('carries a timeoutAfter backstop matching the server-side ring-timeout margin, so a missed explicit cancel cannot leave it (and the UI it can relaunch) stuck forever', async () => {
    const { showIncomingCallNotification } = loadModuleWithNotifeeAvailable();

    await showIncomingCallNotification({ callId: 'call-1', conversationId: 'conv-1', callerName: 'A', callType: 'voice' });

    expect(mockNotifee.displayNotification).toHaveBeenCalledWith(
      expect.objectContaining({ android: expect.objectContaining({ timeoutAfter: 95_000 }) }),
    );
  });

  it('returns false without throwing when @notifee/react-native is unavailable', async () => {
    const { showIncomingCallNotification } = loadModuleWithNotifeeUnavailable();

    const shown = await showIncomingCallNotification({ callId: 'call-1', conversationId: 'conv-1', callerName: 'A', callType: 'voice' });

    expect(shown).toBe(false);
  });

  it('returns false without throwing when displayNotification itself rejects (e.g. POST_NOTIFICATIONS denied)', async () => {
    const { showIncomingCallNotification } = loadModuleWithNotifeeAvailable();
    mockNotifee.displayNotification.mockRejectedValueOnce(new Error('permission denied'));

    const shown = await showIncomingCallNotification({ callId: 'call-1', conversationId: 'conv-1', callerName: 'A', callType: 'voice' });

    expect(shown).toBe(false);
  });
});

describe('incomingCallNotification — cancelIncomingCallNotification', () => {
  it('cancels the notification by callId', async () => {
    const { cancelIncomingCallNotification } = loadModuleWithNotifeeAvailable();

    await cancelIncomingCallNotification('call-abc');

    expect(mockNotifee.cancelNotification).toHaveBeenCalledWith('call-abc');
  });

  it('is a no-op for an empty callId — never calls into notifee', async () => {
    const { cancelIncomingCallNotification } = loadModuleWithNotifeeAvailable();

    await cancelIncomingCallNotification('');

    expect(mockNotifee.cancelNotification).not.toHaveBeenCalled();
  });

  it('never throws even if the native cancel call fails', async () => {
    const { cancelIncomingCallNotification } = loadModuleWithNotifeeAvailable();
    mockNotifee.cancelNotification.mockRejectedValueOnce(new Error('boom'));

    await expect(cancelIncomingCallNotification('call-1')).resolves.toBeUndefined();
  });

  it('never throws when @notifee/react-native is unavailable', async () => {
    const { cancelIncomingCallNotification } = loadModuleWithNotifeeUnavailable();

    await expect(cancelIncomingCallNotification('call-1')).resolves.toBeUndefined();
  });
});
