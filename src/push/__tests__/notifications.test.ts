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
  },
}));

jest.mock('@/network/config', () => ({ NEST_API_BASE_URL: 'https://nest.example.com' }));

jest.mock('../notificationRouter', () => ({ routeNotification: jest.fn() }));
jest.mock('../InAppNotificationToast', () => ({ InAppNotificationToastRef: { current: null } }));
jest.mock('@/services/calls/callKitService', () => ({ displayIncomingCall: jest.fn() }));
jest.mock('@/security/e2ee', () => ({ ensureDeviceId: jest.fn().mockResolvedValue('device-1') }));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import { unregisterPushToken, reregisterPushTokensForCurrentUser } from '../notifications';

const mockedPostRequest = postRequest as jest.MockedFunction<typeof postRequest>;
const mockedGetItem = AsyncStorage.getItem as jest.MockedFunction<typeof AsyncStorage.getItem>;
const mockedSetItem = AsyncStorage.setItem as jest.MockedFunction<typeof AsyncStorage.setItem>;
const mockedRemoveItem = AsyncStorage.removeItem as jest.MockedFunction<typeof AsyncStorage.removeItem>;

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
