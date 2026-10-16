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

// Regression coverage for the confirmed root cause of "a sent file never
// shows up in the sender's OWN chat" (while the recipient sees it fine):
// for an E2EE message, the server-visible plaintext shell only ever echoes
// a bare `{id}` per attachment — real content (url/mimeType/size/etc.)
// stays sealed inside encryptionMeta. Every time this message round-trips
// through the server again (chat.history on reconnect/app restart, a
// gap-fill, etc.), `next` is that bare stub. The per-attachment merge used
// to build the merged attachment FROM `next`, borrowing only
// localUri/localPath from `prev` — for a stub `next` that discards
// everything real, the sender's own already-decrypted copy of their file
// got replaced with a content-less shell with no url at all.
describe('mergePreservingRich — a content-less (stub) attachment never wins over a real one', () => {
  const stubAttachment = (id: string) => ({ id });
  const realAttachment = (id: string, extra: Record<string, unknown> = {}) => ({
    id,
    url: 'https://cdn.example.com/document.pdf',
    mimeType: 'application/pdf',
    originalName: 'document.pdf',
    size: 123456,
    ...extra,
  });

  it('keeps the real attachment when the server echo is a bare {id} stub, even with readable text', () => {
    const ownSentMessage = {
      id: 'msg-2',
      serverId: 'server-msg-2',
      clientId: 'client-msg-2',
      conversationId: 'conv-1',
      senderId: 'user-a',
      createdAt: '2026-01-01T00:00:00.000Z',
      text: 'here is the file',
      attachments: [realAttachment('att-2')],
    } as unknown as ChatMessage;

    const historyStub = {
      id: 'msg-2',
      serverId: 'server-msg-2',
      clientId: 'client-msg-2',
      conversationId: 'conv-1',
      senderId: 'user-a',
      createdAt: '2026-01-01T00:00:00.000Z',
      text: undefined,
      encryptionMeta: { recipients: [] },
      attachments: [stubAttachment('att-2')],
    } as unknown as ChatMessage;

    const merged = mergePreservingRich(ownSentMessage, historyStub);
    expect((merged.attachments as any[])[0].url).toBe('https://cdn.example.com/document.pdf');
    expect((merged.attachments as any[])[0].mimeType).toBe('application/pdf');
  });

  it('keeps the real media.attachments entry when the server echo is a bare {id} stub', () => {
    const ownSentMessage = {
      id: 'msg-3',
      serverId: 'server-msg-3',
      clientId: 'client-msg-3',
      conversationId: 'conv-1',
      senderId: 'user-a',
      createdAt: '2026-01-01T00:00:00.000Z',
      text: '',
      media: { attachments: [realAttachment('att-3')] },
    } as unknown as ChatMessage;

    const historyStub = {
      id: 'msg-3',
      serverId: 'server-msg-3',
      clientId: 'client-msg-3',
      conversationId: 'conv-1',
      senderId: 'user-a',
      createdAt: '2026-01-01T00:00:00.000Z',
      text: undefined,
      encryptionMeta: { recipients: [] },
      media: { attachments: [stubAttachment('att-3')] },
    } as unknown as ChatMessage;

    const merged = mergePreservingRich(ownSentMessage, historyStub);
    expect(((merged as any).media.attachments as any[])[0].url).toBe('https://cdn.example.com/document.pdf');
  });

  it('still prefers the server copy when it genuinely has real content (e.g. a successful decrypt patch)', () => {
    const staleLocalStub = {
      id: 'msg-4',
      serverId: 'server-msg-4',
      clientId: 'client-msg-4',
      conversationId: 'conv-1',
      senderId: 'user-b',
      createdAt: '2026-01-01T00:00:00.000Z',
      text: 'Encrypted message',
      encryptionMeta: { recipients: [] },
      attachments: [stubAttachment('att-4')],
    } as unknown as ChatMessage;

    const freshlyDecrypted = {
      id: 'msg-4',
      serverId: 'server-msg-4',
      clientId: 'client-msg-4',
      conversationId: 'conv-1',
      senderId: 'user-b',
      createdAt: '2026-01-01T00:00:00.000Z',
      text: 'a decrypted caption',
      attachments: [realAttachment('att-4')],
    } as unknown as ChatMessage;

    const merged = mergePreservingRich(staleLocalStub, freshlyDecrypted);
    expect((merged.attachments as any[])[0].url).toBe('https://cdn.example.com/document.pdf');
  });
});
