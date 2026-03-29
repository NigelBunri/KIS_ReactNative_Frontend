import AsyncStorage from '@react-native-async-storage/async-storage';
import EncryptedStorage from 'react-native-encrypted-storage';
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
    if (!data) {
      console.log('[E2EE] loadSession:miss', { identifier });
      return undefined;
    }
    if (typeof data === 'string') {
      const trimmed = data.trim();
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        console.log('[E2EE] loadSession:hit', { identifier, format: 'json' });
        return trimmed;
      }
      try {
        const decoded = Buffer.from(trimmed, 'base64').toString('utf8');
        console.log('[E2EE] loadSession:hit', { identifier, format: 'base64' });
        return decoded;
      } catch {
        console.log('[E2EE] loadSession:hit', { identifier, format: 'raw' });
        return trimmed;
      }
    }
    console.log('[E2EE] loadSession:hit', { identifier, format: 'unknown' });
    return data;
  }

  async storeSession(identifier: string, record: any) {
    const payload = typeof record === 'string' ? record : Buffer.from(new Uint8Array(record)).toString('utf8');
    console.log('[E2EE] storeSession', { identifier, bytes: payload.length, format: typeof record === 'string' ? 'json' : 'buffer' });
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

export const ensureDeviceId = async (): Promise<string> => {
  let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = `dev_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
};

export const resetE2EEStore = async () => {
  storeCache = null;
  await EncryptedStorage.removeItem(STORE_KEY);
  await AsyncStorage.removeItem(E2EE_READY_KEY);
};

export const initE2EE = async (userId?: string | null) => {
  if (!userId) return;
  if (!globalThis.crypto || !(globalThis.crypto as any).subtle) {
    throw new Error('Missing WebCrypto: install react-native-quick-crypto and restart the app.');
  }
  const ready = await AsyncStorage.getItem(E2EE_READY_KEY);
  if (ready === 'true') return;

  const deviceId = await ensureDeviceId();

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
    await AsyncStorage.removeItem(E2EE_READY_KEY);
    throw new Error(res?.message || res?.data?.detail || 'E2EE key registration failed.');
  }

  await AsyncStorage.setItem(E2EE_READY_KEY, 'true');
};

const getAddress = (userId: string, deviceId: string) =>
  new libsignal.SignalProtocolAddress(userId, deviceIdToNumber(deviceId));

const getSessionId = (address: any) => `${address.getName()}.${address.getDeviceId()}`;

const logE2EE = (...args: any[]) => {
  console.log('[E2EE]', ...args);
};

const ensureSession = async (recipientUserId: string) => {
  const deviceId = await ensureDeviceId();
  logE2EE('ensureSession:start', { recipientUserId, deviceId });
  const bundleRes = await getRequest(
    `${ROUTES.auth.e2eeFetchBundle(recipientUserId)}`,
    { headers: { 'X-Device-Id': deviceId } },
  );
  if (!bundleRes?.success) {
    logE2EE('ensureSession:bundle_missing', { recipientUserId, deviceId, response: bundleRes });
    throw new Error('Missing E2EE bundle');
  }
  const bundle = bundleRes.data;
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
  logE2EE('ensureSession:ready', { recipientUserId, address: getSessionId(address), deviceId: bundle.device_id, hasPreKey: !!bundle.one_time_prekey });
  return { address, device_id: bundle.device_id };
};

export const encryptForUser = async (recipientUserId: string, plaintext: string) => {
  const senderDeviceId = await ensureDeviceId();
  logE2EE('encryptForUser:start', { recipientUserId, senderDeviceId });
  let session = await ensureSession(recipientUserId);
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
      session = await ensureSession(recipientUserId);
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

export const encryptPayloadForRecipients = async (
  senderUserId: string,
  recipientUserIds: string[],
  payload: Record<string, any>,
) => {
  const plaintext = JSON.stringify(payload);
  const senderDeviceId = await ensureDeviceId();
  const uniqueIds = Array.from(new Set([senderUserId, ...recipientUserIds])).filter(Boolean);
  const recipients: Array<{ userId: string; deviceId: string; type: number; ciphertext: string }> = [];

  for (const uid of uniqueIds) {
    const result = await encryptForUser(uid, plaintext);
    recipients.push({
      userId: uid,
      deviceId: result.encryptionMeta.recipientDeviceId,
      type: result.encryptionMeta.type,
      ciphertext: result.ciphertext,
    });
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

export const decryptFromUser = async (
  senderUserId: string,
  senderDeviceId: string,
  ciphertext: string,
  metaType: number,
) => {
  const address = getAddress(senderUserId, senderDeviceId);
  const cipher = new libsignal.SessionCipher(signalStore, address);
  const bytes = fromB64(ciphertext);

  let plaintext;
  if (metaType === 3) {
    plaintext = await cipher.decryptPreKeyWhisperMessage(bytes, 'binary');
  } else {
    plaintext = await cipher.decryptWhisperMessage(bytes, 'binary');
  }

  return Buffer.from(new Uint8Array(plaintext)).toString('utf8');
};
