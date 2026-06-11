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
>;

export async function saveDecryptedMessage(
  userId: string,
  message: Partial<ChatMessage>,
  patch: Partial<DecryptedMessagePatch>,
): Promise<void> {
  const ids = messageIds(message);
  if (!userId || !ids.length) return;
  const payload = JSON.stringify(patch);
  await Promise.all(
    ids.map((id) => EncryptedStorage.setItem(storageKey(userId, id), payload)),
  );
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
