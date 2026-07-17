import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Alert } from 'react-native';

import ROUTES from '../src/network';
import { useProfileController } from '../src/screens/tabs/profile/useProfileController';
import { uploadProfileImage } from '../src/screens/tabs/profile/profileImageUpload';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { patchRequest } from '@/network/patch';
import { deleteRequest } from '@/network/delete';
import { clearAuthTokens } from '@/security/authStorage';

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn(),
}));

jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: jest.fn(),
}));

jest.mock('@/network/get', () => ({ getRequest: jest.fn() }));
jest.mock('@/network/post', () => ({ postRequest: jest.fn() }));
jest.mock('@/network/patch', () => ({ patchRequest: jest.fn() }));
jest.mock('@/network/delete', () => ({ deleteRequest: jest.fn() }));

// The direct-to-S3 upload flow (compress -> initiate -> PUT -> confirm) has
// its own dedicated unit tests in profileImageUpload.test.ts; here we only
// need to verify useProfileController.saveProfile() calls into it correctly
// and handles its success/failure without disturbing the text-field save.
jest.mock('../src/screens/tabs/profile/profileImageUpload', () => ({
  uploadProfileImage: jest.fn(),
}));

jest.mock('@/security/authStorage', () => ({
  clearAuthTokens: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

type ControllerRef = ReturnType<typeof useProfileController>;

const ControllerHarness = React.forwardRef<
  ControllerRef,
  { setAuth: jest.Mock; setPhone: jest.Mock }
>(({ setAuth, setPhone }, ref) => {
  const controller = useProfileController({
    setAuth,
    setPhone,
    locationCallingCode: '+237',
  });
  React.useImperativeHandle(ref, () => controller);
  return null;
});

const profilePayload = {
  user: {
    id: 'user-1',
    display_name: 'Test User',
    phone: '+237676000111',
    phone_country_code: '+237',
    phone_number: '676000111',
    country: 'CM',
  },
  profile: {
    id: 'profile-1',
    headline: '',
    bio: '',
    industry: '',
    avatar_url: '',
    cover_url: '',
  },
  preferences: { languages: ['English'] },
  privacy: [],
  account: { wallet_balance_cents: 0 },
  sections: { showcases: {} },
};

const mockedGetRequest = getRequest as jest.MockedFunction<typeof getRequest>;
const mockedPostRequest = postRequest as jest.MockedFunction<
  typeof postRequest
>;
const mockedPatchRequest = patchRequest as jest.MockedFunction<
  typeof patchRequest
>;
const mockedDeleteRequest = deleteRequest as jest.MockedFunction<
  typeof deleteRequest
>;
const mockedClearAuthTokens = clearAuthTokens as jest.MockedFunction<
  typeof clearAuthTokens
>;
const mockedUploadProfileImage = uploadProfileImage as jest.MockedFunction<
  typeof uploadProfileImage
>;

const setupGetRequestMock = () => {
  mockedGetRequest.mockImplementation(async (url: string) => {
    const target = String(url);
    if (target === ROUTES.profiles.me) {
      return { success: true, data: profilePayload, message: '' } as any;
    }
    if (target === ROUTES.wallet.me) {
      return {
        success: true,
        data: { wallet: { balance_cents: 0, balance_kisc: 0, balance_usd: 0 } },
        message: '',
      } as any;
    }
    if (target === ROUTES.wallet.ledger) {
      return { success: true, data: { results: [] }, message: '' } as any;
    }
    if (target === ROUTES.broadcasts.createProfile) {
      return { success: true, data: { profiles: {} }, message: '' } as any;
    }
    if (target.startsWith(ROUTES.auth.checkContact)) {
      return {
        success: true,
        data: { registered: true, userId: 'recipient-1' },
        message: '',
      } as any;
    }
    if (target === ROUTES.user.detail('recipient-1')) {
      return {
        success: true,
        data: {
          id: 'recipient-1',
          display_name: 'Receiver Name',
          phone: '+237699123456',
          phone_country_code: '+237',
          phone_number: '699123456',
        },
        message: '',
      } as any;
    }
    return { success: true, data: {}, message: '' } as any;
  });
};

describe('useProfileController phase-05 runtime flows', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupGetRequestMock();
    mockedPatchRequest.mockResolvedValue({
      success: true,
      data: {},
      message: '',
    } as any);
    mockedDeleteRequest.mockResolvedValue({
      success: true,
      data: {},
      message: '',
    } as any);
    mockedUploadProfileImage.mockResolvedValue({
      upload_id: 'upload-1',
      status: 'confirmed',
      profile: { avatar_url: 'https://cdn.example.com/avatar.jpg' },
    } as any);
    mockedPostRequest.mockImplementation(async (url: string) => {
      const target = String(url);
      if (target === ROUTES.profileLanguages.sync)
        return { success: true, data: {}, message: '' } as any;
      if (target === ROUTES.auth.logout)
        return { success: true, data: {}, message: '' } as any;
      if (target === ROUTES.wallet.transfer)
        return { success: true, data: { ok: true }, message: '' } as any;
      return { success: true, data: {}, message: '' } as any;
    });
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
  });

  test('phone change save prompts forced re-login and clears session on continue', async () => {
    const setAuth = jest.fn();
    const setPhone = jest.fn();
    const ref = React.createRef<ControllerRef>();

    await ReactTestRenderer.act(async () => {
      ReactTestRenderer.create(
        <ControllerHarness ref={ref} setAuth={setAuth} setPhone={setPhone} />,
      );
    });

    await ReactTestRenderer.act(async () => {
      await ref.current?.loadProfile(true);
    });

    ReactTestRenderer.act(() => {
      ref.current?.setDraftProfile((prev: any) => ({
        ...prev,
        phone_number: '699000222',
      }));
    });

    await ReactTestRenderer.act(async () => {
      await ref.current?.saveProfile();
    });

    expect(mockedPatchRequest).toHaveBeenCalledWith(
      ROUTES.user.detail('user-1'),
      expect.objectContaining({
        phone_country_code: '+237',
        phone_number: '699000222',
        phone: '+237699000222',
      }),
      expect.any(Object),
    );

    const promptCall = (Alert.alert as jest.Mock).mock.calls.find(
      call => call[0] === 'Phone number updated',
    );
    expect(promptCall).toBeTruthy();

    const continueButton = promptCall?.[2]?.[0];
    expect(typeof continueButton?.onPress).toBe('function');

    await ReactTestRenderer.act(async () => {
      await continueButton.onPress();
    });

    expect(mockedPostRequest).toHaveBeenCalledWith(
      ROUTES.auth.logout,
      {},
      expect.objectContaining({ errorMessage: 'Server logout failed.' }),
    );
    expect(mockedClearAuthTokens).toHaveBeenCalledTimes(1);
    expect(setPhone).toHaveBeenCalledWith(null);
    expect(setAuth).toHaveBeenCalledWith(false);
  });

  test('save without phone change keeps session active', async () => {
    const setAuth = jest.fn();
    const setPhone = jest.fn();
    const ref = React.createRef<ControllerRef>();

    await ReactTestRenderer.act(async () => {
      ReactTestRenderer.create(
        <ControllerHarness ref={ref} setAuth={setAuth} setPhone={setPhone} />,
      );
    });

    await ReactTestRenderer.act(async () => {
      await ref.current?.loadProfile(true);
    });

    ReactTestRenderer.act(() => {
      ref.current?.setDraftProfile((prev: any) => ({
        ...prev,
        display_name: 'Updated Name',
      }));
    });

    await ReactTestRenderer.act(async () => {
      await ref.current?.saveProfile();
    });

    const calls = (Alert.alert as jest.Mock).mock.calls;
    expect(calls.some(call => call[0] === 'Phone number updated')).toBe(false);
    expect(
      calls.some(
        call =>
          call[0] === 'Profile' &&
          call[1] === 'Your profile changes were saved.',
      ),
    ).toBe(true);
    expect(mockedClearAuthTokens).not.toHaveBeenCalled();
    expect(setAuth).not.toHaveBeenCalledWith(false);
  });

  test('wallet transfer submit is blocked by promotional-credit safety policy', async () => {
    const setAuth = jest.fn();
    const setPhone = jest.fn();
    const ref = React.createRef<ControllerRef>();

    await ReactTestRenderer.act(async () => {
      ReactTestRenderer.create(
        <ControllerHarness ref={ref} setAuth={setAuth} setPhone={setPhone} />,
      );
    });

    await ReactTestRenderer.act(async () => {
      await ref.current?.loadProfile(true);
    });

    ReactTestRenderer.act(() => {
      ref.current?.setWalletForm((prev: any) => ({
        ...prev,
        mode: 'transfer',
        recipient: '699123456',
        amount: '1',
      }));
    });

    await ReactTestRenderer.act(async () => {
      await ref.current?.submitWalletAction();
    });

    expect(mockedPostRequest).not.toHaveBeenCalledWith(
      ROUTES.wallet.transfer,
      expect.anything(),
      expect.anything(),
    );
    expect(
      (Alert.alert as jest.Mock).mock.calls.some(
        call =>
          call[0] === 'Wallet' &&
          String(call[1]).includes('Buying, sending, withdrawing, or converting KIS promotional credits is disabled'),
      ),
    ).toBe(true);
  });

  test('saveProfile sends only text fields to the profile PATCH, never avatar_file/cover_file', async () => {
    const setAuth = jest.fn();
    const setPhone = jest.fn();
    const ref = React.createRef<ControllerRef>();

    await ReactTestRenderer.act(async () => {
      ReactTestRenderer.create(
        <ControllerHarness ref={ref} setAuth={setAuth} setPhone={setPhone} />,
      );
    });

    await ReactTestRenderer.act(async () => {
      await ref.current?.loadProfile(true);
    });

    ReactTestRenderer.act(() => {
      ref.current?.setDraftProfile((prev: any) => ({
        ...prev,
        headline: 'Builder',
      }));
    });

    await ReactTestRenderer.act(async () => {
      await ref.current?.saveProfile();
    });

    expect(mockedPatchRequest).toHaveBeenCalledWith(
      ROUTES.profiles.update('profile-1'),
      { headline: 'Builder', bio: '', industry: '' },
      expect.any(Object),
    );
    expect(mockedUploadProfileImage).not.toHaveBeenCalled();
  });

  test('saveProfile uploads a newly picked avatar via the direct-to-S3 flow', async () => {
    const setAuth = jest.fn();
    const setPhone = jest.fn();
    const ref = React.createRef<ControllerRef>();

    await ReactTestRenderer.act(async () => {
      ReactTestRenderer.create(
        <ControllerHarness ref={ref} setAuth={setAuth} setPhone={setPhone} />,
      );
    });

    await ReactTestRenderer.act(async () => {
      await ref.current?.loadProfile(true);
    });

    const pickedAvatar = {
      uri: 'file:///tmp/avatar.jpg',
      name: 'avatar.jpg',
      type: 'image/jpeg',
    };
    ReactTestRenderer.act(() => {
      ref.current?.setDraftProfile((prev: any) => ({
        ...prev,
        avatar_file: pickedAvatar,
        avatar_preview: pickedAvatar.uri,
      }));
    });

    await ReactTestRenderer.act(async () => {
      await ref.current?.saveProfile();
    });

    expect(mockedUploadProfileImage).toHaveBeenCalledWith(
      'avatar',
      pickedAvatar,
      expect.any(Function),
    );
    // The multipart bundling is gone — the profile PATCH stays JSON/text-only
    // even when an avatar was also picked in this same save.
    expect(mockedPatchRequest).toHaveBeenCalledWith(
      ROUTES.profiles.update('profile-1'),
      expect.objectContaining({ headline: expect.any(String) }),
      expect.any(Object),
    );
    expect(
      (Alert.alert as jest.Mock).mock.calls.some(
        call =>
          call[0] === 'Profile' &&
          call[1] === 'Your profile changes were saved.',
      ),
    ).toBe(true);
  });

  test('saveProfile reports a partial failure when the avatar upload fails but text fields saved', async () => {
    mockedUploadProfileImage.mockRejectedValueOnce(new Error('Image upload to storage failed. Please try again.'));

    const setAuth = jest.fn();
    const setPhone = jest.fn();
    const ref = React.createRef<ControllerRef>();

    await ReactTestRenderer.act(async () => {
      ReactTestRenderer.create(
        <ControllerHarness ref={ref} setAuth={setAuth} setPhone={setPhone} />,
      );
    });

    await ReactTestRenderer.act(async () => {
      await ref.current?.loadProfile(true);
    });

    ReactTestRenderer.act(() => {
      ref.current?.setDraftProfile((prev: any) => ({
        ...prev,
        headline: 'Builder',
        avatar_file: { uri: 'file:///tmp/avatar.jpg', name: 'avatar.jpg', type: 'image/jpeg' },
        avatar_preview: 'file:///tmp/avatar.jpg',
      }));
    });

    await ReactTestRenderer.act(async () => {
      await ref.current?.saveProfile();
    });

    // Text fields still committed — the profile PATCH ran and succeeded.
    expect(mockedPatchRequest).toHaveBeenCalledWith(
      ROUTES.profiles.update('profile-1'),
      expect.objectContaining({ headline: 'Builder' }),
      expect.any(Object),
    );
    const partialFailureCall = (Alert.alert as jest.Mock).mock.calls.find(
      call => call[0] === 'Profile' && String(call[1]).includes('Your profile details were saved, but'),
    );
    expect(partialFailureCall).toBeTruthy();
    expect(String(partialFailureCall?.[1])).toContain('Profile photo:');
    // Not reported as a total failure.
    expect(
      (Alert.alert as jest.Mock).mock.calls.some(
        call => call[0] === 'Profile' && call[1] === 'Unable to save profile changes.',
      ),
    ).toBe(false);
  });

});
