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

import AsyncStorage from '@react-native-async-storage/async-storage';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import { unregisterPushToken } from '../notifications';

const mockedPostRequest = postRequest as jest.MockedFunction<typeof postRequest>;
const mockedGetItem = AsyncStorage.getItem as jest.MockedFunction<typeof AsyncStorage.getItem>;

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
});
