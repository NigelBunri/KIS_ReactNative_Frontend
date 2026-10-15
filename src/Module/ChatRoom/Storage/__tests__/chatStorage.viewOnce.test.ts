import { mergeCachedMessage, dedupeCachedMessages } from '../chatStorage';
import type { ChatMessage } from '../../chatTypes';

// Regression coverage for the confirmed root cause of "view-once content
// disappears, then reappears as the original message, including surviving
// an app restart": mergeCachedMessage's field-by-field content-restoration
// logic (built to recover content genuinely lost across a cache merge, e.g.
// a downloaded file's localUri) had no concept of a view-once message's
// emptied fields being an intentional, permanent, terminal state - so
// merging a just-opened/stripped copy against ANY older cached snapshot
// that still had the pre-view content resurrected it. loadMessages()
// concatenates multiple storage layers (durable history, AsyncStorage V3/
// V2/V1 keys, alias-recovered keys) on every single room open, so this
// fired on essentially every reopen/restart once any one layer held a
// stale copy.

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

describe('mergeCachedMessage — view-once must never be "repaired" by a stale cached copy', () => {
  it('does not restore text/attachments when the NEWER copy (next) is the opened/stripped one', () => {
    const stale = fullMessage(); // e.g. an old durable-history or V1/V2 cache entry
    const opened = openedMessage(); // the just-applied strip

    const merged = mergeCachedMessage(stale, opened);

    expect(merged.text).toBe('');
    expect(merged.attachments).toEqual([]);
    expect((merged as any).viewedAt).toBe('2026-01-01T00:05:00.000Z');
  });

  it('does not restore text/attachments when the OLDER copy (prev) is the opened/stripped one', () => {
    // dedupeCachedMessages can call mergeCachedMessage with either
    // argument order depending on which storage layer's entry is
    // processed first — both directions must hold.
    const opened = openedMessage();
    const stale = fullMessage();

    const merged = mergeCachedMessage(opened, stale);

    expect(merged.text).toBe('');
    expect(merged.attachments).toEqual([]);
  });

  it('still recovers a genuinely-lost localUri/localPath for an UNOPENED view-once message (viewedAt not set)', () => {
    const withLocalFile = fullMessage({
      viewedAt: undefined,
      attachments: [{ id: 'att-1', url: 'https://cdn.example.com/photo.jpg', localUri: 'file:///tmp/photo.jpg' } as any],
    } as any);
    const withoutLocalFile = fullMessage({
      viewedAt: undefined,
      attachments: [{ id: 'att-1', url: 'https://cdn.example.com/photo.jpg' } as any],
    } as any);

    const merged = mergeCachedMessage(withLocalFile, withoutLocalFile);

    // Normal (non-view-once-consumption) behavior must be preserved —
    // this is the actual, legitimate purpose mergeCachedMessage exists for.
    expect((merged.attachments as any[])[0].localUri).toBe('file:///tmp/photo.jpg');
  });

  it('dedupeCachedMessages keeps a message opened as view-once stripped, even when a duplicate stale entry is present in the same batch', () => {
    const stale = fullMessage();
    const opened = openedMessage();

    const result = dedupeCachedMessages([stale, opened]);
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('');
    expect(result[0].attachments).toEqual([]);

    // Order must not matter.
    const resultReversed = dedupeCachedMessages([opened, stale]);
    expect(resultReversed).toHaveLength(1);
    expect(resultReversed[0].text).toBe('');
    expect(resultReversed[0].attachments).toEqual([]);
  });
});
