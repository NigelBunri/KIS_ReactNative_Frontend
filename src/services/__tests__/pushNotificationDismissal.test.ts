const mockGetDisplayedNotifications = jest.fn();
const mockCancelDisplayedNotification = jest.fn();
const mockCancelAllNotifications = jest.fn();

jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    getDisplayedNotifications: (...args: any[]) => mockGetDisplayedNotifications(...args),
    cancelDisplayedNotification: (...args: any[]) => mockCancelDisplayedNotification(...args),
    cancelAllNotifications: (...args: any[]) => mockCancelAllNotifications(...args),
  },
}));

import { dismissNotificationsForConversation, dismissAllNotifications } from '../pushNotificationDismissal';

const getDisplayedNotifications = mockGetDisplayedNotifications;
const cancelDisplayedNotification = mockCancelDisplayedNotification;
const cancelAllNotifications = mockCancelAllNotifications;

describe('dismissNotificationsForConversation', () => {
  beforeEach(() => {
    getDisplayedNotifications.mockReset();
    cancelDisplayedNotification.mockReset().mockResolvedValue(undefined);
    cancelAllNotifications.mockReset();
  });

  it('cancels only notifications whose data.conversationId matches', async () => {
    getDisplayedNotifications.mockResolvedValue([
      { id: 'a', notification: { data: { conversationId: 'conv-1' } } },
      { id: 'b', notification: { data: { conversationId: 'conv-2' } } },
      { id: 'c', notification: { data: { conversationId: 'conv-1' } } },
    ]);

    await dismissNotificationsForConversation('conv-1');

    expect(cancelDisplayedNotification).toHaveBeenCalledTimes(2);
    expect(cancelDisplayedNotification).toHaveBeenCalledWith('a');
    expect(cancelDisplayedNotification).toHaveBeenCalledWith('c');
    expect(cancelDisplayedNotification).not.toHaveBeenCalledWith('b');
  });

  it('also matches legacy snake_case conversation_id', async () => {
    getDisplayedNotifications.mockResolvedValue([
      { id: 'a', notification: { data: { conversation_id: 'conv-9' } } },
    ]);

    await dismissNotificationsForConversation('conv-9');

    expect(cancelDisplayedNotification).toHaveBeenCalledWith('a');
  });

  it('is a no-op when nothing matches', async () => {
    getDisplayedNotifications.mockResolvedValue([
      { id: 'a', notification: { data: { conversationId: 'conv-other' } } },
    ]);

    await dismissNotificationsForConversation('conv-1');

    expect(cancelDisplayedNotification).not.toHaveBeenCalled();
  });

  it('is a no-op for an empty conversationId', async () => {
    await dismissNotificationsForConversation('');
    expect(getDisplayedNotifications).not.toHaveBeenCalled();
  });

  it('swallows errors from the native module rather than throwing', async () => {
    getDisplayedNotifications.mockRejectedValue(new Error('native module unavailable'));
    await expect(dismissNotificationsForConversation('conv-1')).resolves.toBeUndefined();
  });
});

describe('dismissAllNotifications', () => {
  beforeEach(() => {
    cancelAllNotifications.mockReset().mockResolvedValue(undefined);
  });

  it('calls cancelAllNotifications', async () => {
    await dismissAllNotifications();
    expect(cancelAllNotifications).toHaveBeenCalled();
  });

  it('swallows errors rather than throwing', async () => {
    cancelAllNotifications.mockRejectedValue(new Error('boom'));
    await expect(dismissAllNotifications()).resolves.toBeUndefined();
  });
});
