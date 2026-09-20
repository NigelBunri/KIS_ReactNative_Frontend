import { Buffer } from 'buffer';
import { fromByteArray, toByteArray } from 'base64-js';
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

  // Serve cache only when fresh AND the version matches what the message was encrypted with.
  // A version mismatch means the key was rotated — we must re-fetch rather than silently
  // decrypt with the wrong key (which would produce garbled or auth-failed output).
  if (cached && now - cached.fetchedAt < KEY_TTL) {
    if (!versionHint || cached.version === versionHint) {
      return cached;
    }
    // Version mismatch: evict stale entry and fall through to a fresh fetch.
    keyCache.delete(conversationId);
  }

  // Deduplicate concurrent requests for the same conversation.
  if (inflight.has(conversationId)) {
    const result = await inflight.get(conversationId)!;
    // If the inflight request returned a different version, retry once.
    if (versionHint && result.version !== versionHint) {
      keyCache.delete(conversationId);
    } else {
      return result;
    }
  }

  const url = versionHint
    ? `${ROUTES.e2ee.conversationKey(conversationId)}?version=${encodeURIComponent(versionHint)}`
    : ROUTES.e2ee.conversationKey(conversationId);

  const promise = (async () => {
    try {
      const res = await getRequest(url);
      if (!res.success || !res.data?.key || !res.data?.version) {
        throw new Error(res.message || 'Failed to fetch E2EE key');
      }
      const entry: CacheEntry = {
        key: res.data.key,
        version: res.data.version,
        fetchedAt: Date.now(),
      };
      if (versionHint && entry.version !== versionHint) {
        // Server returned a different version than requested — still use it but
        // don't cache under the wrong version to avoid serving stale data later.
        console.warn(
          `[customE2EE] key version mismatch for ${conversationId}: requested=${versionHint} got=${entry.version}`,
        );
      } else {
        keyCache.set(conversationId, entry);
      }
      return entry;
    } finally {
      inflight.delete(conversationId);
    }
  })();

  inflight.set(conversationId, promise);
  return promise;
}

const toBase64 = (value: Uint8Array | Buffer) =>
  fromByteArray(value instanceof Uint8Array ? value : new Uint8Array(value));

const fromBase64 = (value: string) => Buffer.from(toByteArray(value));

// There is deliberately no encryptConversationPayload here anymore. This
// server-held-AES-key scheme predates the Signal Protocol pairwise
// fan-out in security/e2ee.ts (encryptPayloadForRecipients), which is
// what every outgoing message - DM or group - actually encrypts with
// today (see useChatMessaging.ts's E2EE_ENABLED send path). Keeping an
// encrypt function alive for a scheme nothing calls invited exactly the
// confusion this fixed: code claiming "E2EE" while a server-decryptable
// path quietly coexisted. decryptConversationPayload below stays,
// because messages sent under the old scheme before this migration are
// still sitting in message history and must remain readable - this file
// is now read-only/legacy-decrypt, not a live encryption path.

export async function decryptConversationPayload(
  conversationId: string,
  ciphertext: string,
  iv: string,
  tag: string,
  aadBase64?: string,
  versionHint?: string,
) {
  const entry = await loadConversationKey(conversationId, versionHint);
  const key = fromBase64(entry.key);
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    fromBase64(iv),
  );
  decipher.setAuthTag(fromBase64(tag) as any);

  if (aadBase64) {
    try {
      const aad = fromBase64(aadBase64);
      if (aad.length) {
        decipher.setAAD(aad as any);
      }
    } catch {
      console.warn('[customE2EE] invalid AAD for decryption');
    }
  }

  const decrypted = Buffer.concat([
    decipher.update(fromBase64(ciphertext)),
    decipher.final(),
  ]);

  if (__DEV__) console.log(
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
  } catch (error: any) {
    // Auth errors (session expired / 401) are transient — the token refresh may still be
    // in-flight when the chat room mounts. Retry once after a short delay.
    const isAuthError =
      error?.message?.toLowerCase().includes('session') ||
      error?.message?.toLowerCase().includes('expired') ||
      error?.message?.toLowerCase().includes('unauthorized') ||
      error?.status === 401;
    if (isAuthError) {
      setTimeout(async () => {
        try {
          await loadConversationKey(conversationId);
        } catch {
          // Silently ignore — key will be fetched lazily on first decrypt
        }
      }, 3000);
    } else {
      console.warn('[customE2EE] preload failed', error);
    }
  }
}

export { ENCRYPTION_VERSION };
