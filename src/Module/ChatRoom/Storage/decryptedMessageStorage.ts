import EncryptedStorage from 'react-native-encrypted-storage';

import type { ChatMessage } from '../chatTypes';

const PREFIX = 'KIS_CHAT_DECRYPTED_MESSAGE_V1';

const safeSegment = (value: unknown) =>
  encodeURIComponent(String(value ?? '').trim());

const storageKey = (userId: string, messageId: string) =>
  `${PREFIX}:${safeSegment(userId)}:${safeSegment(messageId)}`;

const messageIds = (message: Partial<ChatMessage>): string[] =>
  Array.from(
    new Set(
      [
        message.serverId,
        message.id,
        message.clientId,
        (message as any).messageId,
      ]
        .filter((value) => value != null && String(value).trim())
        .map(String),
    ),
  );

export type DecryptedMessagePatch = Pick<
  ChatMessage,
  | 'text'
  | 'styledText'
  | 'attachments'
  | 'media'
  | 'contacts'
  | 'poll'
  | 'event'
  | 'voice'
  | 'sticker'
  | 'replyToId'
  | 'kind'
  | 'isPreJoinHidden'
>;

export async function saveDecryptedMessage(
  userId: string,
  message: Partial<ChatMessage>,
  patch: Partial<DecryptedMessagePatch>,
): Promise<void> {
  const ids = messageIds(message);
  if (!userId || !ids.length) return;
  const payload = JSON.stringify(patch);
  // Best-effort persistence cache, not a correctness-critical step — the
  // caller already has the real decrypted patch in memory and is about to
  // hand it to the UI regardless of whether this write succeeds. Native
  // Keychain/EncryptedSharedPreferences storage has a real (and on iOS,
  // undocumented and lower-than-advertised) size ceiling per item, and a
  // large attachments/media payload (image/video messages carry more
  // metadata per attachment than a single voice note) can exceed it. This
  // call previously threw straight out of saveDecryptedMessage with no
  // handling; since callers await it BEFORE patching the UI with the
  // decrypted content, a native storage failure here was indistinguishable
  // from a genuine decrypt failure to the caller's try/catch — surfacing as
  // "This message could not be decrypted" even though decryption had
  // already succeeded. Swallow so a caching failure can never block or
  // misreport delivery of content we've already successfully decrypted.
  try {
    await Promise.all(
      ids.map((id) => EncryptedStorage.setItem(storageKey(userId, id), payload)),
    );
  } catch (error) {
    if (__DEV__) {
      console.warn('[decryptedMessageStorage] saveDecryptedMessage failed (non-fatal)', error);
    }
  }
}

/**
 * Must be called the instant a view-once message is consumed (see
 * ChatRoomPage.tsx's handleViewOnce). Without this, the FULL plaintext
 * saveDecryptedMessage cached here the first time this message was ever
 * decrypted — before it was ever opened — survives indefinitely in this
 * persistent, Keychain-backed store. hydrateDecryptedMessages's own
 * isOpenedViewOnce guard stops it from being READ BACK once opened, but
 * deleting it here too is defense in depth: leaving a plaintext copy of
 * "permanently inaccessible" content sitting in storage forever, just
 * unused by this one code path, is still a real exposure this feature's
 * entire premise is to prevent.
 */
export async function deleteDecryptedMessage(
  userId: string,
  message: Partial<ChatMessage>,
): Promise<void> {
  const ids = messageIds(message);
  if (!userId || !ids.length) return;
  try {
    await Promise.all(
      ids.map((id) => EncryptedStorage.removeItem(storageKey(userId, id))),
    );
  } catch (error) {
    if (__DEV__) {
      console.warn('[decryptedMessageStorage] deleteDecryptedMessage failed', error);
    }
  }
}

export async function loadDecryptedMessage(
  userId: string,
  message: Partial<ChatMessage>,
): Promise<Partial<DecryptedMessagePatch> | null> {
  if (!userId) return null;
  for (const id of messageIds(message)) {
    try {
      const raw = await EncryptedStorage.getItem(storageKey(userId, id));
      if (raw) return JSON.parse(raw);
    } catch {
      // Try the next stable message identity.
    }
  }
  return null;
}

export async function hydrateDecryptedMessages(
  userId: string,
  messages: ChatMessage[],
): Promise<ChatMessage[]> {
  if (!userId || !messages.length) return messages;

  return Promise.all(
    messages.map(async message => {
      // CONFIRMED ROOT CAUSE (one of three) of "view-once content
      // disappears, then reappears as the original message," specifically
      // the variant that survives an app restart: a view-once message's
      // ciphertext/encryptionMeta fields are stripped server-side
      // (markViewOnceOpened) but were never stripped by this client's own
      // handleViewOnce, so `encrypted` below still evaluates true for an
      // already-opened message whose content fields are now correctly
      // empty - which is exactly the "nothing readable, try to rehydrate"
      // condition this function exists to handle. Without this guard, it
      // then faithfully restores the FULL original plaintext from
      // whatever saveDecryptedMessage cached here the very first time
      // this message was ever decrypted, before it was ever opened -
      // undoing the one-time reveal on every single room reopen or app
      // restart. handleViewOnce calls deleteDecryptedMessage the instant a
      // message is opened (removing the stale cache entry outright); this
      // check is the second, load-time line of defense in case that
      // delete didn't land yet (e.g. a cold-start race) or some other
      // code path reaches this message before it does.
      if (Boolean((message as any).viewOnce) && (message as any).viewedAt) {
        return message;
      }

      const encrypted = Boolean(
        message.encryptionMeta ??
          message.ciphertext ??
          (message as any).encrypted,
      );
      if (!encrypted) return message;

      const text =
        typeof message.text === 'string' ? message.text.trim() : '';
      const hasReadableText =
        text.length > 0 && text.toLowerCase() !== 'encrypted message';
      const hasReadableContent = Boolean(
        hasReadableText ||
          message.styledText ||
          message.voice ||
          message.sticker ||
          message.poll ||
          message.event ||
          message.contacts?.length ||
          message.attachments?.length ||
          message.media?.attachments?.length,
      );
      if (hasReadableContent) return message;

      const decrypted = await loadDecryptedMessage(userId, message);
      return decrypted ? ({ ...message, ...decrypted } as ChatMessage) : message;
    }),
  );
}
