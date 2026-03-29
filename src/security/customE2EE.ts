import { Buffer } from 'buffer';
import crypto from 'react-native-quick-crypto';

import { getRequest } from '@/network/get';
import ROUTES from '@/network';

const KEY_TTL = 10 * 60 * 1000; // 10 minutes
const ENCRYPTION_VERSION = 'custom-aes-2';

type CacheEntry = {
  key: string;
  version: string;
  fetchedAt: number;
};

const keyCache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<CacheEntry>>();

async function loadConversationKey(
  conversationId: string,
  versionHint?: string,
): Promise<CacheEntry> {
  const now = Date.now();
  const cached = keyCache.get(conversationId);

  if (
    cached &&
    now - cached.fetchedAt < KEY_TTL &&
    (!versionHint || cached.version === versionHint)
  ) {
    return cached;
  }

  if (inflight.has(conversationId)) {
    return inflight.get(conversationId)!;
  }

  const promise = (async () => {
    try {
      const res = await getRequest(ROUTES.e2ee.conversationKey(conversationId));
      if (!res.success || !res.data?.key || !res.data?.version) {
        throw new Error(res.message || 'Failed to fetch E2EE key');
      }
      const entry: CacheEntry = {
        key: res.data.key,
        version: res.data.version,
        fetchedAt: Date.now(),
      };
      if (versionHint && entry.version !== versionHint) {
        console.log(
          `[customE2EE] version mismatch for ${conversationId}: client hint=${versionHint} server=${entry.version}`,
        );
      }
      keyCache.set(conversationId, entry);
      return entry;
    } finally {
      inflight.delete(conversationId);
    }
  })();

  inflight.set(conversationId, promise);
  return promise;
}

const buildAad = (conversationId: string, clientId?: string, kind?: string) => {
  const parts = [conversationId, clientId ?? '', kind ?? ''];
  return Buffer.from(parts.join('|'), 'utf8');
};

export async function encryptConversationPayload(
  conversationId: string,
  payload: Record<string, any>,
) {
  const entry = await loadConversationKey(conversationId);
  const key = Buffer.from(entry.key, 'base64');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const aad = buildAad(conversationId, payload.clientId, payload.kind);
  cipher.setAAD(aad as any);

  const plaintext = JSON.stringify(payload);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  console.log(
    '[customE2EE] encrypt',
    conversationId,
    'version',
    entry.version,
    'aad',
    aad.toString('base64'),
  );

  return {
    ciphertext: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    encryptionVersion: ENCRYPTION_VERSION,
    encryptionKeyVersion: entry.version,
    aad: aad.toString('base64'),
  };
}

export async function decryptConversationPayload(
  conversationId: string,
  ciphertext: string,
  iv: string,
  tag: string,
  aadBase64?: string,
  versionHint?: string,
) {
  const entry = await loadConversationKey(conversationId, versionHint);
  const key = Buffer.from(entry.key, 'base64');
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(iv, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(tag, 'base64') as any);

  if (aadBase64) {
    try {
      const aad = Buffer.from(aadBase64, 'base64');
      if (aad.length) {
        decipher.setAAD(aad as any);
      }
    } catch {
      console.warn('[customE2EE] invalid AAD for decryption');
    }
  }

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64')),
    decipher.final(),
  ]);

  console.log(
    '[customE2EE] decrypt',
    conversationId,
    'version',
    entry.version,
    'hint',
    versionHint,
  );

  return decrypted.toString('utf8');
}

export async function preloadConversationKey(conversationId: string) {
  try {
    await loadConversationKey(conversationId);
  } catch (error) {
    console.warn('[customE2EE] preload failed', error);
  }
}

export { ENCRYPTION_VERSION };
