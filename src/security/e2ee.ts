import AsyncStorage from '@react-native-async-storage/async-storage';
import EncryptedStorage from 'react-native-encrypted-storage';
import { NativeModules, Platform } from 'react-native';
import { fromByteArray, toByteArray } from 'base64-js';
import { Buffer } from 'buffer';
import * as libsignal from '@privacyresearch/libsignal-protocol-typescript';

import ROUTES from '@/network';
import { postRequest } from '@/network/post';
import { getRequest } from '@/network/get';

const STORE_KEY = 'kis.e2ee.signal.store.v1';
const DEVICE_ID_KEY = 'device_id';
const E2EE_READY_KEY = 'kis.e2ee.ready.v2';

type SignalStoreCache = Record<string, any>;

let storeCache: SignalStoreCache | null = null;
const decryptPlaintextCache = new Map<string, string>();
const decryptInFlight = new Map<string, Promise<string>>();
const MAX_DECRYPT_CACHE_SIZE = 500;
const DEVICE_BUNDLE_CACHE_TTL_MS = 30_000;
const deviceBundleCache = new Map<
  string,
  { expiresAt: number; bundles: DeviceBundle[] }
>();
const deviceBundleRequests = new Map<string, Promise<DeviceBundle[]>>();
const sessionBuildRequests = new Map<
  string,
  Promise<{ address: any; device_id: string } | null>
>();

const clearRuntimeE2EECaches = () => {
  deviceBundleCache.clear();
  deviceBundleRequests.clear();
  sessionBuildRequests.clear();
  decryptPlaintextCache.clear();
  decryptInFlight.clear();
};

const rememberDecryptedPlaintext = (key: string, value: string) => {
  decryptPlaintextCache.set(key, value);
  if (decryptPlaintextCache.size > MAX_DECRYPT_CACHE_SIZE) {
    const oldest = decryptPlaintextCache.keys().next().value;
    if (oldest) decryptPlaintextCache.delete(oldest);
  }
};

const loadStore = async (): Promise<SignalStoreCache> => {
  if (storeCache) return storeCache;
  const raw = await EncryptedStorage.getItem(STORE_KEY);
  storeCache = raw ? JSON.parse(raw) : {};
  return storeCache ?? {};
};

const saveStore = async () => {
  if (!storeCache) return;
  await EncryptedStorage.setItem(STORE_KEY, JSON.stringify(storeCache));
};

const toB64 = (buf: ArrayBuffer | Uint8Array) =>
  fromByteArray(buf instanceof Uint8Array ? buf : new Uint8Array(buf));

const toBinaryInput = (
  value: ArrayBuffer | ArrayBufferLike | Uint8Array | null | undefined,
): ArrayBuffer | Uint8Array => {
  if (!value) return new Uint8Array(0);
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return value;
  return new Uint8Array(value);
};

const fromB64 = (b64: string) => toByteArray(b64).buffer;

const binaryStringToBytes = (input: string): Uint8Array => {
  const len = input.length;
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) {
    out[i] = input.charCodeAt(i) & 0xff;
  }
  return out;
};
const toArrayBuffer = (text: string): ArrayBuffer => {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(text).buffer;
  }
  const buf = Buffer.from(text, 'utf8');
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
};

const deviceIdToNumber = (deviceId: string): number => {
  let hash = 0;
  for (let i = 0; i < deviceId.length; i += 1) {
    hash = (hash * 31 + deviceId.charCodeAt(i)) | 0;
  }
  return Math.abs(hash % 16384) + 1;
};

class SignalProtocolStore {
  async get(key: string, defaultValue?: any) {
    const store = await loadStore();
    if (store[key] === undefined) return defaultValue;
    return store[key];
  }

  async put(key: string, value: any) {
    const store = await loadStore();
    store[key] = value;
    await saveStore();
  }

  async remove(key: string) {
    const store = await loadStore();
    delete store[key];
    await saveStore();
  }

  async getIdentityKeyPair() {
    const data = await this.get('identityKey');
    if (!data) return null;
    return {
      pubKey: fromB64(data.pubKey),
      privKey: fromB64(data.privKey),
    };
  }

  async getLocalRegistrationId() {
    return this.get('registrationId');
  }

  async saveIdentity(identifier: string, identityKey: ArrayBuffer) {
    await this.put(`identityKey:${identifier}`, toB64(identityKey));
    return true;
  }

  async isTrustedIdentity(identifier: string, identityKey: ArrayBuffer) {
    const existing = await this.get(`identityKey:${identifier}`);
    if (!existing) return true;
    return existing === toB64(identityKey);
  }

  async loadPreKey(keyId: number) {
    const data = await this.get(`preKey:${keyId}`);
    if (!data) return undefined;
    return {
      pubKey: fromB64(data.pubKey),
      privKey: fromB64(data.privKey),
    };
  }

  async storePreKey(keyId: number, keyPair: any) {
    await this.put(`preKey:${keyId}`, {
      pubKey: toB64(keyPair.pubKey),
      privKey: toB64(keyPair.privKey),
    });
  }

  async removePreKey(keyId: number) {
    await this.remove(`preKey:${keyId}`);
  }

  async loadSignedPreKey(keyId: number) {
    const data = await this.get(`signedPreKey:${keyId}`);
    if (!data) return undefined;
    return {
      pubKey: fromB64(data.pubKey),
      privKey: fromB64(data.privKey),
    };
  }

  async storeSignedPreKey(keyId: number, keyPair: any) {
    await this.put(`signedPreKey:${keyId}`, {
      pubKey: toB64(keyPair.pubKey),
      privKey: toB64(keyPair.privKey),
    });
  }

  async removeSignedPreKey(keyId: number) {
    await this.remove(`signedPreKey:${keyId}`);
  }

  async loadSession(identifier: string) {
    const data = await this.get(`session:${identifier}`);
    if (!data) return undefined;

    if (typeof data === 'string') {
      const trimmed = data.trim();
      // JSON session record — the libsignal library serialises sessions as JSON.
      if (trimmed.startsWith('{')) return trimmed;
      // Base64-encoded binary (stored by the new storeSession path).
      // We return it as a base64 string; libsignal treats it as an opaque record.
      return trimmed;
    }
    return data;
  }

  async storeSession(identifier: string, record: any) {
    let payload: string;
    if (typeof record === 'string') {
      // libsignal-protocol-typescript serialises sessions as JSON strings — pass through.
      payload = record;
    } else {
      // Guard against arbitrary binary objects: encode as base64 to prevent
      // UTF-8 corruption of non-ASCII bytes (e.g. cipher key material).
      const bytes =
        record instanceof Uint8Array
          ? record
          : new Uint8Array(record instanceof ArrayBuffer ? record : Buffer.from(record));
      payload = fromByteArray(bytes);
    }
    await this.put(`session:${identifier}`, payload);
  }

  async removeSession(identifier: string) {
    await this.remove(`session:${identifier}`);
  }

  async removeAllSessions(identifier: string) {
    const store = await loadStore();
    const prefix = `session:${identifier}`;
    Object.keys(store).forEach((key) => {
      if (key.startsWith(prefix)) delete store[key];
    });
    await saveStore();
  }
}

const signalStore = new SignalProtocolStore();

const createDeviceId = () => `dev_${Date.now()}_${Math.random().toString(36).slice(2)}`;

const { KISDeviceIdModule } = NativeModules;

// Settings.Secure.ANDROID_ID survives an app uninstall/reinstall (it's OS
// state scoped to this app's signing key, not app storage) unlike a
// randomly-generated id kept only in AsyncStorage/EncryptedStorage. Seeding
// a fresh device_id from it means a reinstalled Android app resolves back to
// the SAME device_id the backend already has on file as this account's
// primary device, instead of looking like an unrecognized new device and
// requiring QR re-linking - the same guarantee iOS already gets from
// Keychain persistence (see readSecureDeviceId/writeSecureDeviceId below).
// It does not survive a factory reset or a change of app signing key; those
// still fall back to QR re-linking / account recovery, same as today.
const getStableAndroidId = async (): Promise<string | null> => {
  if (Platform.OS !== 'android' || !KISDeviceIdModule?.getAndroidId) return null;
  try {
    const id = await KISDeviceIdModule.getAndroidId();
    return typeof id === 'string' && id.trim() ? `android_${id.trim()}` : null;
  } catch {
    return null;
  }
};

// iOS Keychain entries survive app deletion by default, so persisting the
// device_id there means reinstalling on the same physical iPhone keeps the
// same device_id — the backend still recognizes it as the primary device,
// no QR re-link needed.
//
// Android has no storage equivalent: EncryptedStorage there is backed by
// EncryptedSharedPreferences + Android Keystore, both of which live inside
// the app's own private data directory and are wiped by the OS on uninstall
// *and* on "clear app storage" — same as plain AsyncStorage. Using
// EncryptedStorage on Android still closes a real gap (device_id was
// previously the one identity value plain AsyncStorage held while
// everything else sensitive already used EncryptedStorage) but it does NOT
// itself make device_id survive reinstall — that's what getStableAndroidId()
// above is for (OS-level ANDROID_ID, not app storage). If that ever returns
// null (very old/unusual devices, or the native call failing), primary-device
// recognition after an Android reinstall falls back to the best-effort
// SIM-number check (services/simInfo.ts, unreliable — permission often
// denied, many OEMs don't expose it) or the account-recovery flow
// (ParentRecoveryScreen).
const readSecureDeviceId = async (): Promise<string | null> => {
  try {
    return await EncryptedStorage.getItem(DEVICE_ID_KEY);
  } catch {
    return null;
  }
};

const writeSecureDeviceId = async (deviceId: string): Promise<boolean> => {
  try {
    await EncryptedStorage.setItem(DEVICE_ID_KEY, deviceId);
    return true;
  } catch {
    return false;
  }
};

export const ensureDeviceId = async (): Promise<string> => {
  let deviceId = await readSecureDeviceId();
  if (!deviceId) {
    // Migrate a value from an older app version that only used AsyncStorage,
    // then try the stable Android-only id (survives reinstall), before
    // falling back to a random one (iOS, or if that native call fails).
    deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (!deviceId) deviceId = (await getStableAndroidId()) ?? createDeviceId();
    await writeSecureDeviceId(deviceId);
  }
  // EncryptedStorage is the source of truth, but every network request
  // (src/network/{get,post,put,patch,delete}) reads the X-Device-Id header
  // value straight from plain AsyncStorage, not through this function — a
  // brand-new device (no prior AsyncStorage entry to migrate from, per the
  // branch above) would otherwise resolve a real device id here while
  // AsyncStorage['device_id'] stays permanently unset, so every request
  // after login goes out with no X-Device-Id header, the backend's
  // DeviceBoundJWTAuthentication rejects it with 401, and token refresh
  // (which also depends on device_id) fails the same way — kicking the
  // user back to the Welcome screen right after a successful login.
  // Mirroring the resolved id into AsyncStorage here keeps it in sync for
  // those call sites without changing their read path.
  await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
  return deviceId;
};

export const rotateDeviceId = async (): Promise<string> => {
  const deviceId = createDeviceId();
  clearRuntimeE2EECaches();
  storeCache = null;
  await EncryptedStorage.removeItem(STORE_KEY);
  await AsyncStorage.removeItem(E2EE_READY_KEY);
  await writeSecureDeviceId(deviceId);
  await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
  return deviceId;
};

export const resetE2EEStore = async () => {
  clearRuntimeE2EECaches();
  storeCache = null;
  await EncryptedStorage.removeItem(STORE_KEY);
  await AsyncStorage.removeItem(E2EE_READY_KEY);
};

const e2eeInitRequests = new Map<string, Promise<void>>();

const initializeE2EE = async (
  userId: string,
  deviceId: string,
  options?: { force?: boolean },
) => {
  if (!globalThis.crypto || !(globalThis.crypto as any).subtle) {
    throw new Error('Missing WebCrypto: install react-native-quick-crypto and restart the app.');
  }

  const readyKey = `${E2EE_READY_KEY}:${userId}:${deviceId}`;
  const ready = await AsyncStorage.getItem(readyKey);
  if (ready === 'true' && !options?.force) return;

  let identityKey = await signalStore.getIdentityKeyPair();
  let registrationId = await signalStore.getLocalRegistrationId();

  if (!identityKey?.pubKey || !identityKey?.privKey) {
    const generatedIdentityKey = await libsignal.KeyHelper.generateIdentityKeyPair();
    identityKey = generatedIdentityKey;
    await signalStore.put('identityKey', {
      pubKey: toB64(toBinaryInput(generatedIdentityKey.pubKey)),
      privKey: toB64(toBinaryInput(generatedIdentityKey.privKey)),
    });
  }
  if (!identityKey?.pubKey || !identityKey?.privKey) {
    throw new Error('Failed to initialize identity key pair.');
  }

  if (!registrationId) {
    registrationId = await libsignal.KeyHelper.generateRegistrationId();
    await signalStore.put('registrationId', registrationId);
  }

  let signedPreKeyId = await signalStore.get('signedPreKeyId');
  if (typeof signedPreKeyId !== 'number') {
    signedPreKeyId = 1;
    await signalStore.put('signedPreKeyId', signedPreKeyId);
  }

  const signedPreKey = await libsignal.KeyHelper.generateSignedPreKey(
    identityKey,
    signedPreKeyId,
  );
  await signalStore.storeSignedPreKey(signedPreKeyId, signedPreKey.keyPair);

  const preKeys = [];
  let preKeyId = await signalStore.get('preKeyId', 1);
  for (let i = 0; i < 50; i += 1) {
    const key = await libsignal.KeyHelper.generatePreKey(preKeyId);
    await signalStore.storePreKey(preKeyId, key.keyPair);
    preKeys.push({ id: preKeyId, key: toB64(key.keyPair.pubKey) });
    preKeyId += 1;
  }
  await signalStore.put('preKeyId', preKeyId);

  const payload = {
    device_id: deviceId,
    identity_key: toB64(toBinaryInput(identityKey.pubKey)),
    signed_prekey: {
      id: signedPreKeyId,
      key: toB64(signedPreKey.keyPair.pubKey),
      signature: toB64(signedPreKey.signature),
    },
    prekeys: preKeys,
    registration_id: registrationId,
  };

  const res = await postRequest(ROUTES.auth.e2eeRegisterKeys, payload, {
    headers: { 'X-Device-Id': deviceId },
    errorMessage: 'Failed to register E2EE keys.',
  });

  if (!res?.success) {
    await AsyncStorage.removeItem(readyKey);
    await AsyncStorage.removeItem(E2EE_READY_KEY);
    throw new Error(res?.message || res?.data?.detail || 'E2EE key registration failed.');
  }

  await AsyncStorage.setItem(readyKey, 'true');
  await AsyncStorage.setItem(E2EE_READY_KEY, 'true');
};

export const initE2EE = async (userId?: string | null, options?: { force?: boolean }) => {
  if (!userId) return;
  const deviceId = await ensureDeviceId();
  const requestKey = `${userId}:${deviceId}`;
  const existingRequest = e2eeInitRequests.get(requestKey);
  if (existingRequest) {
    return existingRequest;
  }

  const request = initializeE2EE(userId, deviceId, options);
  e2eeInitRequests.set(requestKey, request);
  try {
    await request;
  } finally {
    if (e2eeInitRequests.get(requestKey) === request) {
      e2eeInitRequests.delete(requestKey);
    }
  }
};

export const repairLocalE2EEBundle = async (userId?: string | null) => {
  if (!userId) return;
  deviceBundleCache.delete(userId);
  const deviceId = await ensureDeviceId();
  const readyKey = `${E2EE_READY_KEY}:${userId}:${deviceId}`;
  await AsyncStorage.removeItem(readyKey);
  await AsyncStorage.removeItem(E2EE_READY_KEY);
  await initE2EE(userId, { force: true });
};

const getAddress = (userId: string, deviceId: string) =>
  new libsignal.SignalProtocolAddress(userId, deviceIdToNumber(deviceId));

/**
 * Drops this device's local Signal session for a specific (userId,
 * deviceId), without touching that device's identity/prekeys/anything
 * else. For use after a decrypt failure that a simple retry can't recover
 * from (see useChatMessaging.ts's generic decrypt-failure handling) - a
 * corrupted/desynced local session record left in place would keep
 * failing the same way forever, whereas removing it lets the NEXT
 * incoming PreKeyWhisperMessage (or this device's own next send to that
 * peer) bootstrap a clean session from scratch instead.
 */
export const dropStaleSession = async (userId: string, deviceId: string): Promise<void> => {
  if (!userId || !deviceId) return;
  const address = getAddress(userId, deviceId);
  await signalStore.removeSession(getSessionId(address));
};

const getSessionId = (address: any) => `${address.getName()}.${address.getDeviceId()}`;

const logE2EE = (...args: any[]) => {
  if (__DEV__) console.log('[E2EE]', ...args);
};

type DeviceBundle = {
  user_id: string;
  device_id: string;
  identity_key: string;
  signed_prekey: { id: number; key: string; signature: string };
  one_time_prekey?: { id: number; key: string } | null;
  registration_id?: number | null;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isUuid = (value?: string | null) => UUID_RE.test(String(value ?? ''));

const buildSessionForBundle = async (bundle: DeviceBundle) => {
  const address = getAddress(bundle.user_id, bundle.device_id);
  const preKeyBundle = {
    identityKey: fromB64(bundle.identity_key),
    registrationId: bundle.registration_id ?? 0,
    signedPreKey: {
      keyId: bundle.signed_prekey.id,
      publicKey: fromB64(bundle.signed_prekey.key),
      signature: fromB64(bundle.signed_prekey.signature),
    },
    preKey: bundle.one_time_prekey
      ? {
          keyId: bundle.one_time_prekey.id,
          publicKey: fromB64(bundle.one_time_prekey.key),
        }
      : undefined,
  };

  const builder = new libsignal.SessionBuilder(signalStore, address);
  await builder.processPreKey(preKeyBundle);
  logE2EE('ensureSession:ready', {
    recipientUserId: bundle.user_id,
    address: getSessionId(address),
    deviceId: bundle.device_id,
    hasPreKey: !!bundle.one_time_prekey,
  });
  return { address, device_id: bundle.device_id };
};

const fetchDeviceBundles = async (recipientUserId: string): Promise<DeviceBundle[]> => {
  if (!isUuid(recipientUserId)) {
    throw new Error('Invalid E2EE recipient user id');
  }
  const cached = deviceBundleCache.get(recipientUserId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.bundles;
  }
  const existingRequest = deviceBundleRequests.get(recipientUserId);
  if (existingRequest) return existingRequest;

  const request = (async () => {
  const deviceId = await ensureDeviceId();
  logE2EE('ensureSession:start', { recipientUserId, deviceId });
  const bundlesRes = await getRequest(
    `${ROUTES.auth.e2eeFetchDeviceBundles(recipientUserId)}`,
    { headers: { 'X-Device-Id': deviceId } },
  );
  if (bundlesRes?.success && Array.isArray(bundlesRes.data?.devices) && bundlesRes.data.devices.length) {
    const bundles = bundlesRes.data.devices as DeviceBundle[];
    deviceBundleCache.set(recipientUserId, {
      expiresAt: Date.now() + DEVICE_BUNDLE_CACHE_TTL_MS,
      bundles,
    });
    return bundles;
  }

  const bundleRes = await getRequest(
    `${ROUTES.auth.e2eeFetchBundle(recipientUserId)}`,
    { headers: { 'X-Device-Id': deviceId } },
  );
  if (!bundleRes?.success || !bundleRes.data?.device_id) {
    logE2EE('ensureSession:bundle_missing', { recipientUserId, deviceId, response: bundleRes });
    throw new Error('Missing E2EE bundle');
  }
  const bundles = [bundleRes.data as DeviceBundle];
  deviceBundleCache.set(recipientUserId, {
    expiresAt: Date.now() + DEVICE_BUNDLE_CACHE_TTL_MS,
    bundles,
  });
  return bundles;
  })();

  deviceBundleRequests.set(recipientUserId, request);
  try {
    return await request;
  } finally {
    deviceBundleRequests.delete(recipientUserId);
  }
};

const invalidateDeviceBundleCache = (userId: string) => {
  deviceBundleCache.delete(userId);
};

// One per-device session build/reuse. Deliberately NOT all-or-nothing across
// a user's devices: a single broken/unreachable device (e.g. one stale
// browser session, one device mid-reinstall) must never prevent building
// sessions for that same user's OTHER devices, or this device count would
// regress every multi-device account to single-device reliability. Returns
// null (never throws) for a device this call couldn't build a session for -
// callers filter nulls rather than losing the whole batch to one failure.
const ensureSessionForDevice = async (
  bundle: DeviceBundle,
): Promise<{ address: any; device_id: string } | null> => {
  const address = getAddress(bundle.user_id, bundle.device_id);
  const sessionId = getSessionId(address);
  const existingSession = await signalStore.loadSession(sessionId);
  if (existingSession) {
    // Verify the cached session still matches the identity this device
    // CURRENTLY publishes, not just that a session record exists. If a
    // device was reinstalled/reset, it generates a brand-new identity
    // keypair under the same device_id/user_id - a stale local session
    // built against the OLD identity would otherwise be reused forever,
    // silently producing ciphertext that device can never decrypt (see
    // isNoSignalSessionError's doc comment in useChatMessaging.ts for the
    // exact failure mode this was previously undetectable and
    // unrecoverable from: "the original message stays permanently
    // unreadable"). Deliberately using sessionId (userId.deviceId) here
    // rather than the library's own isTrustedIdentity/saveIdentity calls -
    // those are invoked internally with inconsistent identifiers (bare
    // userId on read, userId.deviceId on write), making them a permanent
    // no-op; this is a separate, self-consistent check layered on top,
    // not a fix to that library-internal mismatch.
    const bundleIdentityKey = fromB64(bundle.identity_key);
    const stillTrusted = await signalStore.isTrustedIdentity(sessionId, bundleIdentityKey as ArrayBuffer);
    if (stillTrusted) {
      return { address, device_id: bundle.device_id };
    }
    logE2EE('ensureSession:identity_changed_rebuilding', {
      recipientUserId: bundle.user_id,
      deviceId: bundle.device_id,
    });
    await signalStore.removeSession(sessionId);
  }

  const pending = sessionBuildRequests.get(sessionId);
  if (pending) return pending;

  const build = (async () => {
    try {
      const built = await buildSessionForBundle(bundle);
      // No manual safety-number-verification UX exists in this app - TOFU
      // already governs trust - so recording the new identity here is
      // "accept this device's current keys as authoritative" rather than a
      // downgrade: it's what makes the mismatch detected above actually
      // self-heal instead of just being detected forever.
      await signalStore.saveIdentity(sessionId, fromB64(bundle.identity_key) as ArrayBuffer);
      return built;
    } catch (error) {
      logE2EE('ensureSession:build_failed', {
        recipientUserId: bundle.user_id,
        deviceId: bundle.device_id,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  })();
  sessionBuildRequests.set(sessionId, build);
  try {
    return await build;
  } finally {
    sessionBuildRequests.delete(sessionId);
  }
};

const ensureSessionsForUser = async (recipientUserId: string) => {
  const bundles = await fetchDeviceBundles(recipientUserId);
  const sessions = await Promise.all(bundles.map((bundle) => ensureSessionForDevice(bundle)));
  return sessions.filter((s): s is { address: any; device_id: string } => s !== null);
};

export const encryptForUser = async (recipientUserId: string, plaintext: string) => {
  const senderDeviceId = await ensureDeviceId();
  logE2EE('encryptForUser:start', { recipientUserId, senderDeviceId });
  let session = (await ensureSessionsForUser(recipientUserId))[0];
  if (!session) {
    throw new Error(`Could not establish an E2EE session with any device for ${recipientUserId}`);
  }
  let cipher = new libsignal.SessionCipher(signalStore, session.address);
  const plaintextBytes = toArrayBuffer(plaintext);
  let encrypted;
  try {
    encrypted = await cipher.encrypt(plaintextBytes);
  } catch (err: any) {
    const msg = err?.message || '';
    if (msg.includes('No record for')) {
      const sessionId = getSessionId(session.address);
      logE2EE('encryptForUser:no_session', { recipientUserId, sessionId, senderDeviceId });
      await signalStore.removeSession(sessionId);
      session = (await ensureSessionsForUser(recipientUserId))[0];
      cipher = new libsignal.SessionCipher(signalStore, session.address);
      encrypted = await cipher.encrypt(plaintextBytes);
    } else {
      logE2EE('encryptForUser:failed', { recipientUserId, senderDeviceId, error: msg });
      throw err;
    }
  }
  const body = encrypted.body;
  const bodyBytes = typeof body === 'string' ? binaryStringToBytes(body) : new Uint8Array(body);
  logE2EE('encryptForUser:success', {
    recipientUserId,
    senderDeviceId,
    recipientDeviceId: session.device_id,
    type: encrypted.type,
    bytes: bodyBytes.byteLength,
  });
  return {
    ciphertext: fromByteArray(bodyBytes),
    encryptionMeta: {
      e2ee: 'signal',
      type: encrypted.type,
      senderDeviceId,
      recipientDeviceId: session.device_id,
    },
  };
};

// Clearing the compose box the instant send is pressed (see
// ChatRoomHandlers.tsx's handleSend) means a user can now fire off several
// messages back-to-back without waiting for each one's network round-trip -
// which makes concurrent calls into this function a normal occurrence
// instead of a rare edge case. cipher.encrypt() internally does
// loadSession -> advance the ratchet -> storeSession for each recipient
// device; two overlapping calls encrypting for the SAME device can both
// load the same starting session state, each advance it independently, and
// then race to store - whichever finishes last wins, silently discarding
// the other's ratchet step even though its ciphertext already went out
// using it. That's not a transient failure a retry fixes - it desyncs the
// session, and the discarded message (or messages after it) can become
// permanently undecryptable for that device. Serializing every call
// through one promise chain makes the actual session-touching work happen
// one at a time regardless of how many sends were fired concurrently; each
// step is local crypto (no network), so this adds imperceptible latency,
// not the kind of wait this whole fix is about removing.
let encryptSerializationTail: Promise<unknown> = Promise.resolve();

export const encryptPayloadForRecipients = (
  senderUserId: string,
  recipientUserIds: string[],
  payload: Record<string, any>,
) => {
  const run = encryptSerializationTail.then(() =>
    encryptPayloadForRecipientsSerialized(senderUserId, recipientUserIds, payload),
  );
  // Keep the chain alive regardless of this call's outcome - one rejected
  // encrypt (a genuinely unreachable recipient, say) must not permanently
  // wedge every later send behind a dead promise.
  encryptSerializationTail = run.catch(() => undefined);
  return run;
};

const encryptPayloadForRecipientsSerialized = async (
  senderUserId: string,
  recipientUserIds: string[],
  payload: Record<string, any>,
) => {
  const plaintext = JSON.stringify(payload);
  const senderDeviceId = await ensureDeviceId();
  await initE2EE(senderUserId);
  const uniqueIds = Array.from(new Set([senderUserId, ...recipientUserIds]))
    .filter((uid) => isUuid(uid));
  if (!uniqueIds.length) {
    throw new Error('Missing valid E2EE recipient user ids');
  }

  // Per-user AND per-device fault isolation. A message must reach every
  // device it can, not none of them because one device (any recipient's, or
  // even the sender's OWN other device) was temporarily unreachable/stale -
  // that all-or-nothing behavior is what made multi-device accounts less
  // reliable than single-device ones. Each uid gets one retry (forcing a
  // fresh device-bundle fetch, bypassing the 30s cache, in case the failure
  // was a just-registered device the cache hadn't seen yet); a uid that
  // still fails after that is skipped, logged, and never blocks delivery to
  // every other uid/device that did succeed.
  const encryptOnce = async () => {
    const recipients: Array<{ userId: string; deviceId: string; type: number; ciphertext: string }> = [];
    for (const uid of uniqueIds) {
      let sessions: Array<{ address: any; device_id: string }> = [];
      try {
        sessions = await ensureSessionsForUser(uid);
      } catch (error) {
        if (uid === senderUserId && String((error as any)?.message ?? '').includes('Missing E2EE bundle')) {
          await repairLocalE2EEBundle(senderUserId);
          sessions = await ensureSessionsForUser(uid);
        } else {
          logE2EE('encryptPayloadForRecipients:bundle_fetch_failed_retrying', {
            uid,
            error: error instanceof Error ? error.message : String(error),
          });
          invalidateDeviceBundleCache(uid);
          try {
            sessions = await ensureSessionsForUser(uid);
          } catch (retryError) {
            logE2EE('encryptPayloadForRecipients:uid_skipped', {
              uid,
              error: retryError instanceof Error ? retryError.message : String(retryError),
            });
            continue;
          }
        }
      }
      for (const session of sessions) {
        try {
          const cipher = new libsignal.SessionCipher(signalStore, session.address);
          const encrypted = await cipher.encrypt(toArrayBuffer(plaintext));
          const body = encrypted.body;
          const bodyBytes = typeof body === 'string' ? binaryStringToBytes(body) : new Uint8Array(body);
          recipients.push({
            userId: uid,
            deviceId: session.device_id,
            type: encrypted.type,
            ciphertext: fromByteArray(bodyBytes),
          });
        } catch (error) {
          // A session that loaded but failed to actually encrypt with (a
          // corrupt/desynced record) - drop it and rebuild fresh from the
          // device's current bundle rather than losing this device for
          // every future message too.
          logE2EE('encryptPayloadForRecipients:session_encrypt_failed_rebuilding', {
            uid,
            deviceId: session.device_id,
            error: error instanceof Error ? error.message : String(error),
          });
          await signalStore.removeSession(getSessionId(session.address));
          try {
            const bundles = await fetchDeviceBundles(uid);
            const bundle = bundles.find((b) => b.device_id === session.device_id);
            const rebuilt = bundle ? await ensureSessionForDevice(bundle) : null;
            if (!rebuilt) continue;
            const cipher = new libsignal.SessionCipher(signalStore, rebuilt.address);
            const encrypted = await cipher.encrypt(toArrayBuffer(plaintext));
            const body = encrypted.body;
            const bodyBytes = typeof body === 'string' ? binaryStringToBytes(body) : new Uint8Array(body);
            recipients.push({
              userId: uid,
              deviceId: rebuilt.device_id,
              type: encrypted.type,
              ciphertext: fromByteArray(bodyBytes),
            });
          } catch (rebuildError) {
            logE2EE('encryptPayloadForRecipients:device_skipped', {
              uid,
              deviceId: session.device_id,
              error: rebuildError instanceof Error ? rebuildError.message : String(rebuildError),
            });
          }
        }
      }
    }
    return recipients;
  };

  const recipients = await encryptOnce();

  if (!recipients.length) {
    throw new Error('Could not establish an E2EE session with any recipient device');
  }

  return {
    encryptionMeta: {
      e2ee: 'signal',
      senderDeviceId,
      recipients,
      payloadVersion: 1,
    },
  };
};

export const isSignalMessageCounterError = (error: unknown): boolean => {
  const name = String((error as any)?.name ?? '');
  const message = String((error as any)?.message ?? '');
  return (
    name.includes('MessageCounterError') ||
    message.includes('Message key not found') ||
    message.includes('counter was repeated') ||
    message.includes('key was not filled')
  );
};

export const decryptFromUser = async (
  senderUserId: string,
  senderDeviceId: string,
  ciphertext: string,
  metaType: number,
) => {
  const address = getAddress(senderUserId, senderDeviceId);
  const cacheKey = `${getSessionId(address)}:${metaType}:${ciphertext}`;
  const cached = decryptPlaintextCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const pending = decryptInFlight.get(cacheKey);
  if (pending) return pending;

  const decryptPromise = (async () => {
    const bytes = fromB64(ciphertext);

    let plaintext;
    try {
      const cipher = new libsignal.SessionCipher(signalStore, address);
      if (metaType === 3) {
        plaintext = await cipher.decryptPreKeyWhisperMessage(bytes, 'binary');
      } else {
        plaintext = await cipher.decryptWhisperMessage(bytes, 'binary');
      }
    } catch (error) {
      const message = String((error as any)?.message ?? '').toLowerCase();
      if (metaType !== 3 || !message.includes('bad mac')) throw error;

      // A sender from an older build may have rebuilt its prekey session before
      // every send. Drop only that stale peer session and establish the new one
      // from this prekey message.
      await signalStore.removeSession(getSessionId(address));
      const retryCipher = new libsignal.SessionCipher(signalStore, address);
      plaintext = await retryCipher.decryptPreKeyWhisperMessage(bytes, 'binary');
    }

    const decoded = Buffer.from(new Uint8Array(plaintext)).toString('utf8');
    rememberDecryptedPlaintext(cacheKey, decoded);
    return decoded;
  })();

  decryptInFlight.set(cacheKey, decryptPromise);
  try {
    return await decryptPromise;
  } catch (error) {
    const recovered = decryptPlaintextCache.get(cacheKey);
    if (recovered !== undefined && isSignalMessageCounterError(error)) {
      return recovered;
    }
    throw error;
  } finally {
    decryptInFlight.delete(cacheKey);
  }
};
