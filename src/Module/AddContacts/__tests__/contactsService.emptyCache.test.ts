// Regression coverage for AND-029 ("share a contact" showing "No contacts
// available" despite the device actually having contacts).
//
// Root cause: refreshFromDeviceAndBackendWithOptions() cached whatever
// getDeviceContactsFromDevice()+markRegisteredBulk() returned, including an
// EMPTY result, for a full 10 minutes. If the very first call ever
// happened to come back empty (permission not yet granted, a transient
// native-module hiccup, the permission dialog getting swallowed because
// ContactsModal's own <Modal> was already on screen), every call for the
// next 10 minutes — including from ContactsModal, which has no manual
// refresh button like AddContactsPage does — served that stale empty
// result back verbatim, even after permission was granted in between.
//
// Fix: an empty fetch is never written to the cache, and a cached empty
// array is treated as a miss (forces a fresh fetch) rather than a hit.

jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
  PermissionsAndroid: {
    PERMISSIONS: { READ_CONTACTS: 'READ_CONTACTS', WRITE_CONTACTS: 'WRITE_CONTACTS' },
    RESULTS: { GRANTED: 'granted', NEVER_ASK_AGAIN: 'never_ask_again' },
    check: jest.fn(),
    requestMultiple: jest.fn(),
  },
}));

const mockGetAllWithoutPhotos = jest.fn();
jest.mock('react-native-contacts', () => ({
  checkPermission: jest.fn(),
  requestPermission: jest.fn(),
  getAllWithoutPhotos: (...args: any[]) => mockGetAllWithoutPhotos(...args),
  getAll: jest.fn(),
}));

const mockPostRequest = jest.fn();
jest.mock('@/network/post', () => ({
  postRequest: (...args: any[]) => mockPostRequest(...args),
}));
jest.mock('@/network/get', () => ({
  getRequest: jest.fn(),
}));
jest.mock('@/network', () => ({
  __esModule: true,
  default: { contacts: { check: 'https://api.example.com/api/v1/contacts/check/' }, auth: {} },
}));

import { PermissionsAndroid } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { refreshFromDeviceAndBackendWithOptions, CONTACTS_CACHE_KEY } from '../contactsService';

describe('refreshFromDeviceAndBackendWithOptions — empty-result caching (AND-029)', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    (PermissionsAndroid.requestMultiple as jest.Mock).mockResolvedValue({
      READ_CONTACTS: 'granted',
      WRITE_CONTACTS: 'granted',
    });
  });

  it('does not cache an empty fetch result', async () => {
    mockGetAllWithoutPhotos.mockResolvedValue([]); // device has no (or unreadable) contacts this call

    const first = await refreshFromDeviceAndBackendWithOptions({});
    expect(first).toEqual([]);

    const cachedRaw = await AsyncStorage.getItem(CONTACTS_CACHE_KEY);
    expect(cachedRaw).toBeNull();
  });

  it('retries the device/backend fetch on the next call instead of trusting a stale empty cache', async () => {
    // First call: simulate the transient empty result (e.g. permission
    // dialog got swallowed while the sharing modal was open).
    mockGetAllWithoutPhotos.mockResolvedValueOnce([]);
    const first = await refreshFromDeviceAndBackendWithOptions({});
    expect(first).toEqual([]);

    // Second call (e.g. user re-opens "Share a contact" a minute later,
    // after actually granting permission): the device now has contacts.
    mockGetAllWithoutPhotos.mockResolvedValueOnce([
      { recordID: '1', displayName: 'Jo', givenName: 'Jo', phoneNumbers: [{ number: '+15551234567' }] },
    ]);
    mockPostRequest.mockResolvedValue({ success: true, data: { results: {} } });

    const second = await refreshFromDeviceAndBackendWithOptions({});
    expect(second).toHaveLength(1);
    expect(second[0].phone).toBe('+15551234567');
  });

  it('does cache and reuse a non-empty result', async () => {
    mockGetAllWithoutPhotos.mockResolvedValue([
      { recordID: '1', displayName: 'Jo', givenName: 'Jo', phoneNumbers: [{ number: '+15551234567' }] },
    ]);
    mockPostRequest.mockResolvedValue({ success: true, data: { results: {} } });

    const first = await refreshFromDeviceAndBackendWithOptions({});
    expect(first).toHaveLength(1);

    // Second call should be served from cache — getAllWithoutPhotos should
    // not be invoked again.
    mockGetAllWithoutPhotos.mockClear();
    const second = await refreshFromDeviceAndBackendWithOptions({});
    expect(second).toHaveLength(1);
    expect(mockGetAllWithoutPhotos).not.toHaveBeenCalled();
  });
});
