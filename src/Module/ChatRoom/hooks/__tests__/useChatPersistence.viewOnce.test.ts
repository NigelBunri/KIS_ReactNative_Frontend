import { mergePreservingRich } from '../useChatPersistence';
import type { ChatMessage } from '../../chatTypes';

// Regression coverage for the confirmed root cause of "view-once content
// disappears, then reappears as the original message" — the most direct
// and severe of the three instances found, since mergePreservingRich runs
// via mergeMessages() on EVERY replaceMessages() call, including the very
// same call ChatRoomPage.tsx's handleViewOnce makes to apply its own strip.
// Without the isOpenedViewOnce guard, this function's "restore content
// that looks lost" logic undid that strip synchronously, on the exact call
// meant to apply it — the underlying message object kept the full
// original content the entire time, with only MessageBubble's own local
// React state hiding it from the viewer in that one render.

const fullMessage = (overrides: Partial<ChatMessage> = {}): ChatMessage =>
  ({
    id: 'msg-1',
    serverId: 'server-msg-1',
    clientId: 'client-msg-1',
    conversationId: 'conv-1',
    senderId: 'user-a',
    createdAt: '2026-01-01T00:00:00.000Z',
    text: 'the real secret content',
    attachments: [{ id: 'att-1', url: 'https://cdn.example.com/photo.jpg' }],
    voice: undefined,
    viewOnce: true,
    status: 'delivered',
    ...overrides,
  } as unknown as ChatMessage);

const openedMessage = (overrides: Partial<ChatMessage> = {}): ChatMessage =>
  ({
    id: 'msg-1',
    serverId: 'server-msg-1',
    clientId: 'client-msg-1',
    conversationId: 'conv-1',
    senderId: 'user-a',
    createdAt: '2026-01-01T00:00:00.000Z',
    text: '',
    attachments: [],
    media: undefined,
    voice: undefined,
    sticker: undefined,
    contacts: undefined,
    poll: undefined,
    event: undefined,
    viewOnce: true,
    viewedAt: '2026-01-01T00:05:00.000Z',
    status: 'delivered',
    ...overrides,
  } as unknown as ChatMessage);

describe('mergePreservingRich — view-once strip must survive the very merge that applies it', () => {
  it('does not restore attachments/text when `next` is the just-applied strip (prev=full, next=opened)', () => {
    const existingInMemory = fullMessage();
    const justStripped = openedMessage();

    const merged = mergePreservingRich(existingInMemory, justStripped);

    expect(merged.text).toBe('');
    expect(merged.attachments).toEqual([]);
    expect((merged as any).viewedAt).toBe('2026-01-01T00:05:00.000Z');
  });

  it('does not restore attachments/text when `prev` is the already-opened one (prev=opened, next=stale-full)', () => {
    const alreadyOpened = openedMessage();
    const staleFullCopy = fullMessage();

    const merged = mergePreservingRich(alreadyOpened, staleFullCopy);

    expect(merged.text).toBe('');
    expect(merged.attachments).toEqual([]);
  });

  it('still restores attachments/voice for a normal (non-view-once) encrypted-placeholder merge', () => {
    // The actual, legitimate case this function's "encrypted +
    // placeholder" branch exists for — must keep working unchanged.
    const decrypted = fullMessage({ viewOnce: undefined } as any);
    const stillEncryptedPlaceholder = {
      id: 'msg-1',
      serverId: 'server-msg-1',
      clientId: 'client-msg-1',
      conversationId: 'conv-1',
      senderId: 'user-a',
      createdAt: '2026-01-01T00:00:00.000Z',
      text: 'Encrypted message',
      encryptionMeta: { recipients: [] },
      attachments: [],
    } as unknown as ChatMessage;

    const merged = mergePreservingRich(decrypted, stillEncryptedPlaceholder);

    expect(merged.text).toBe('the real secret content');
    expect((merged.attachments as any[])?.length).toBe(1);
  });

  it('still restores a locally-downloaded file path for a normal (non-view-once) attachment merge', () => {
    const withLocalFile = fullMessage({
      viewOnce: undefined,
      attachments: [{ id: 'att-1', url: 'https://cdn.example.com/photo.jpg', localUri: 'file:///tmp/photo.jpg' } as any],
    } as any);
    const serverEcho = fullMessage({
      viewOnce: undefined,
      attachments: [{ id: 'att-1', url: 'https://cdn.example.com/photo.jpg' } as any],
    } as any);

    const merged = mergePreservingRich(withLocalFile, serverEcho);
    expect((merged.attachments as any[])[0].localUri).toBe('file:///tmp/photo.jpg');
  });
});
