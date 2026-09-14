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
