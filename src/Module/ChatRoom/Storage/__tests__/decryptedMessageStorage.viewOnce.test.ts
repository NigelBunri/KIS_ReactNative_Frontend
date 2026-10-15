import EncryptedStorage from 'react-native-encrypted-storage';
import {
  saveDecryptedMessage,
  loadDecryptedMessage,
  deleteDecryptedMessage,
  hydrateDecryptedMessages,
} from '../decryptedMessageStorage';
import type { ChatMessage } from '../../chatTypes';

// Regression coverage for the third confirmed root cause of "view-once
// content disappears, then reappears as the original message" — the one
// that specifically explains surviving an app restart. saveDecryptedMessage
// caches a message's full plaintext the first time it's ever decrypted, in
// a persistent, Keychain-backed store (react-native-encrypted-storage) that
// nothing about an in-memory strip touches. If the message's own
// ciphertext/encryptionMeta fields were never cleared alongside its content
// fields, hydrateDecryptedMessages' "nothing readable, try to rehydrate"
// check still read it as "encrypted, needs recovery" post-view and
// restored the stale full plaintext from that cache on every subsequent
// load — including after a restart, since that's exactly when this
// hydration path runs.

afterEach(() => {
  (EncryptedStorage as any).__resetMockStore();
  jest.clearAllMocks();
});

const userId = 'user-1';

describe('hydrateDecryptedMessages — must not rehydrate an opened view-once message', () => {
  it('skips rehydration entirely once viewOnce && viewedAt are set, even if ciphertext/encryptionMeta were never cleared', async () => {
    const original: ChatMessage = {
      id: 'msg-1',
      serverId: 'server-msg-1',
      conversationId: 'conv-1',
      senderId: 'user-a',
      createdAt: '2026-01-01T00:00:00.000Z',
      encryptionMeta: { recipients: [] },
      text: 'placeholder',
    } as unknown as ChatMessage;

    // The cache a successful first decrypt would have written, before
    // this message was ever opened.
    await saveDecryptedMessage(userId, original, {
      text: 'the real secret content',
      attachments: [{ id: 'att-1', url: 'https://cdn.example.com/photo.jpg' } as any],
    });

    // Opened, but — simulating the exact bug — ciphertext/encryptionMeta
    // were left on the object (the pre-fix behavior).
    const openedButNotFullyCleared = {
      ...original,
      viewOnce: true,
      viewedAt: '2026-01-01T00:05:00.000Z',
      text: '',
      attachments: [],
      encryptionMeta: { recipients: [] }, // deliberately still present
    } as unknown as ChatMessage;

    const [result] = await hydrateDecryptedMessages(userId, [openedButNotFullyCleared]);

    expect(result.text).toBe('');
    expect(result.attachments).toEqual([]);
  });

  it('still rehydrates a normal (non-view-once) message whose content is genuinely empty pending cache lookup', async () => {
    const original: ChatMessage = {
      id: 'msg-2',
      serverId: 'server-msg-2',
      conversationId: 'conv-1',
      senderId: 'user-a',
      createdAt: '2026-01-01T00:00:00.000Z',
      encryptionMeta: { recipients: [] },
      text: '',
    } as unknown as ChatMessage;

    await saveDecryptedMessage(userId, original, { text: 'hello there' });

    const [result] = await hydrateDecryptedMessages(userId, [original]);
    expect(result.text).toBe('hello there');
  });
});

describe('deleteDecryptedMessage — must actually remove the cached plaintext', () => {
  it('removes the cache entry so a later load finds nothing to rehydrate from', async () => {
    const message: ChatMessage = {
      id: 'msg-3',
      serverId: 'server-msg-3',
      conversationId: 'conv-1',
      senderId: 'user-a',
      createdAt: '2026-01-01T00:00:00.000Z',
    } as unknown as ChatMessage;

    await saveDecryptedMessage(userId, message, { text: 'secret' });
    expect(await loadDecryptedMessage(userId, message)).toEqual({ text: 'secret' });

    await deleteDecryptedMessage(userId, message);
    expect(await loadDecryptedMessage(userId, message)).toBeNull();
  });

  it('removes the cache entry under every stable id alias (serverId, id, clientId)', async () => {
    const message: ChatMessage = {
      id: 'local-id-4',
      serverId: 'server-msg-4',
      clientId: 'client-msg-4',
      conversationId: 'conv-1',
      senderId: 'user-a',
      createdAt: '2026-01-01T00:00:00.000Z',
    } as unknown as ChatMessage;

    await saveDecryptedMessage(userId, message, { text: 'secret' });
    await deleteDecryptedMessage(userId, message);

    // Look up by each alias independently — none should still resolve.
    expect(await loadDecryptedMessage(userId, { serverId: 'server-msg-4' } as any)).toBeNull();
    expect(await loadDecryptedMessage(userId, { id: 'local-id-4' } as any)).toBeNull();
    expect(await loadDecryptedMessage(userId, { clientId: 'client-msg-4' } as any)).toBeNull();
  });
});
