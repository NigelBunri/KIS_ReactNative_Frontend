// Regression coverage for "Clear chat" un-clearing itself: clearMessages()
// wiped the local message cache, but nothing told the client to stop
// re-syncing OLD history from the server - the very next time this
// conversation's history-reconciliation effect ran (reopening the chat, or
// an app restart) it found zero local messages and fetched the most recent
// page straight from the server, resurrecting everything just cleared.
// clearMessages now also records a "cleared before" watermark, and
// filterLocallyDeletedMessages (already called at every point server data
// gets merged in - chat.history, gap-fill, live append) drops anything at
// or before it.

const mockStore = new Map<string, string>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key: string) => Promise.resolve(mockStore.has(key) ? mockStore.get(key)! : null)),
  setItem: jest.fn((key: string, value: string) => {
    mockStore.set(key, value);
    return Promise.resolve();
  }),
  removeItem: jest.fn((key: string) => {
    mockStore.delete(key);
    return Promise.resolve();
  }),
  getAllKeys: jest.fn(() => Promise.resolve(Array.from(mockStore.keys()))),
  multiGet: jest.fn((keys: string[]) =>
    Promise.resolve(keys.map((k) => [k, mockStore.has(k) ? mockStore.get(k)! : null])),
  ),
}));

jest.mock('react-native-fs', () => ({
  exists: jest.fn().mockResolvedValue(false),
  unlink: jest.fn().mockResolvedValue(undefined),
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn().mockResolvedValue(''),
  DocumentDirectoryPath: '/tmp',
}));

import {
  clearMessages,
  filterLocallyDeletedMessages,
  getClearedBeforeTimestamp,
  rememberClearedBeforeTimestamp,
} from '../chatStorage';
import type { ChatMessage } from '../../chatTypes';

const msg = (overrides: Partial<ChatMessage>): ChatMessage =>
  ({
    id: overrides.id ?? 'm',
    conversationId: 'conv-1',
    senderId: 'user-a',
    status: 'delivered',
    ...overrides,
  } as unknown as ChatMessage);

describe('clearMessages records a cleared-before watermark', () => {
  beforeEach(() => mockStore.clear());

  it('getClearedBeforeTimestamp is null before any clear', async () => {
    expect(await getClearedBeforeTimestamp('room-1', 'user-1')).toBeNull();
  });

  it('clearMessages sets a cleared-before timestamp scoped to this room+user', async () => {
    await clearMessages('room-1', 'user-1');
    const ts = await getClearedBeforeTimestamp('room-1', 'user-1');
    expect(ts).not.toBeNull();
    expect(Number.isNaN(Date.parse(ts!))).toBe(false);

    // A different room, or a different user viewing the same room, is unaffected.
    expect(await getClearedBeforeTimestamp('room-2', 'user-1')).toBeNull();
    expect(await getClearedBeforeTimestamp('room-1', 'user-2')).toBeNull();
  });
});

describe('filterLocallyDeletedMessages drops anything at/before the clear watermark', () => {
  beforeEach(() => mockStore.clear());

  it('drops server-synced messages created before the clear', async () => {
    await rememberClearedBeforeTimestamp('room-1', '2026-01-02T00:00:00.000Z', 'user-1');

    const old = msg({ id: 'old', createdAt: '2026-01-01T00:00:00.000Z' });
    const result = await filterLocallyDeletedMessages('room-1', [old], 'user-1');

    expect(result).toEqual([]);
  });

  it('drops a message created exactly at the clear timestamp (boundary is inclusive)', async () => {
    await rememberClearedBeforeTimestamp('room-1', '2026-01-02T00:00:00.000Z', 'user-1');

    const atBoundary = msg({ id: 'boundary', createdAt: '2026-01-02T00:00:00.000Z' });
    const result = await filterLocallyDeletedMessages('room-1', [atBoundary], 'user-1');

    expect(result).toEqual([]);
  });

  it('keeps a message sent/received AFTER the clear', async () => {
    await rememberClearedBeforeTimestamp('room-1', '2026-01-02T00:00:00.000Z', 'user-1');

    const fresh = msg({ id: 'fresh', createdAt: '2026-01-03T00:00:00.000Z' });
    const result = await filterLocallyDeletedMessages('room-1', [fresh], 'user-1');

    expect(result).toEqual([fresh]);
  });

  it('keeps everything when the conversation has never been cleared', async () => {
    const anything = msg({ id: 'm1', createdAt: '2020-01-01T00:00:00.000Z' });
    const result = await filterLocallyDeletedMessages('room-1', [anything], 'user-1');
    expect(result).toEqual([anything]);
  });

  it('a clear in one room never affects another room for the same user', async () => {
    await rememberClearedBeforeTimestamp('room-1', '2026-01-02T00:00:00.000Z', 'user-1');

    const inOtherRoom = msg({ id: 'other-room-msg', conversationId: 'conv-2', createdAt: '2020-01-01T00:00:00.000Z' });
    const result = await filterLocallyDeletedMessages('room-2', [inOtherRoom], 'user-1');
    expect(result).toEqual([inOtherRoom]);
  });

  it('end-to-end: clearMessages() then filtering a stale server history page drops it entirely', async () => {
    await clearMessages('room-1', 'user-1');

    const staleHistoryPage = [
      msg({ id: 'h1', createdAt: '2020-01-01T00:00:00.000Z' }),
      msg({ id: 'h2', createdAt: '2020-01-02T00:00:00.000Z' }),
    ];
    const result = await filterLocallyDeletedMessages('room-1', staleHistoryPage, 'user-1');
    expect(result).toEqual([]);
  });
});
