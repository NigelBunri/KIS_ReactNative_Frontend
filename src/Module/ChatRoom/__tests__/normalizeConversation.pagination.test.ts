/**
 * P0 fix: fetchConversationsForCurrentUser (via refreshConversationsAndHandleEmpty
 * -> fetchAllConversationPages) used to fetch only page 1 of the conversation
 * list and never read `meta.total_pages`, so any account with more
 * conversations than the backend's default page size silently lost the rest
 * with no visible error. See ../normalizeConversation.ts.
 */

jest.mock('@/network', () => ({
  __esModule: true,
  default: { chat: { listConversations: 'https://api.test/api/v1/chats/conversations/' } },
}));

jest.mock('@/network/get', () => ({
  getRequest: jest.fn(),
}));

const mockCacheStore = new Map<string, any>();
jest.mock('@/network/cache', () => ({
  getCache: jest.fn(async (type: string, key: string) => mockCacheStore.get(`${type}:${key}`) ?? null),
  setCache: jest.fn(async (type: string, key: string, value: any) => {
    mockCacheStore.set(`${type}:${key}`, value);
  }),
  clearCacheByKey: jest.fn(async (type: string, key: string) => {
    mockCacheStore.delete(`${type}:${key}`);
  }),
}));

jest.mock('@/storage/userScopedProfileCache', () => ({
  getCurrentAuthUserId: jest.fn().mockResolvedValue('user-1'),
}));

jest.mock('../messagesUtils', () => ({
  directConversationName: jest.fn(() => 'Someone'),
  directConversationAvatar: jest.fn(() => undefined),
}));

jest.mock('../safeChatText', () => ({
  resolveChatPreviewText: jest.fn(() => ''),
}));

import { getRequest } from '@/network/get';
import { fetchConversationsForCurrentUser } from '../normalizeConversation';

const getRequestMock = getRequest as jest.Mock;

/** A group conversation (never hits the direct-name/avatar helpers) with a
 * unique id, so pagination/dedup can be checked by id alone. */
const conv = (id: number) => ({ id: `conv-${id}`, type: 'group', title: `Conversation ${id}` });

/** Builds a mock getRequest that serves `totalPages` pages of `perPage`
 * conversations each from an in-memory list, keyed off the `page` query
 * param in the requested URL. */
function makePagedBackend(totalConversations: number, perPage: number) {
  const all = Array.from({ length: totalConversations }, (_, i) => conv(i));
  const totalPages = Math.max(1, Math.ceil(totalConversations / perPage));
  return jest.fn(async (url: string) => {
    const page = Number(new URL(url).searchParams.get('page') ?? '1');
    const start = (page - 1) * perPage;
    const results = all.slice(start, start + perPage);
    return { data: { meta: { total_pages: totalPages, count: totalConversations }, results } };
  });
}

describe('conversation list pagination (P0 fix)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCacheStore.clear();
  });

  it('fetches only one page when the backend reports total_pages=1', async () => {
    getRequestMock.mockImplementation(makePagedBackend(10, 100));

    const chats = await fetchConversationsForCurrentUser([], 'user-1', true);

    expect(getRequestMock).toHaveBeenCalledTimes(1);
    expect(chats).toHaveLength(10);
  });

  it('walks every page and returns the full conversation set with no loss or duplication', async () => {
    // 250 conversations at page_size=100 -> 3 pages, matching what the fix
    // requests (page_size=100 on every call).
    getRequestMock.mockImplementation(makePagedBackend(250, 100));

    const chats = await fetchConversationsForCurrentUser([], 'user-1', true);

    expect(getRequestMock).toHaveBeenCalledTimes(3);
    const requestedPages = getRequestMock.mock.calls.map(([url]) => new URL(url).searchParams.get('page'));
    expect(requestedPages).toEqual(['1', '2', '3']);
    expect(chats).toHaveLength(250);
    const ids = new Set(chats.map((c) => c.id));
    expect(ids.size).toBe(250); // no duplicates
    for (let i = 0; i < 250; i++) {
      expect(ids.has(`conv-${i}`)).toBe(true); // nothing silently omitted
    }
  });

  it('falls back to cache instead of caching a partial list when a later page fails', async () => {
    // Seed the cache with a previously-successful full fetch.
    mockCacheStore.set('CHAT_CACHE:CONVERSATION_LIST:user-1', [conv(0), conv(1)]);

    getRequestMock.mockImplementation(async (url: string) => {
      const page = Number(new URL(url).searchParams.get('page') ?? '1');
      if (page === 1) {
        return { data: { meta: { total_pages: 2, count: 150 }, results: [conv(0)] } };
      }
      throw new Error('network down');
    });

    const chats = await fetchConversationsForCurrentUser([], 'user-1', true);

    // The failed refresh must not overwrite the cache with the partial
    // (page-1-only) result — the caller falls back to whatever was cached.
    expect(chats.map((c) => c.id).sort()).toEqual(['conv-0', 'conv-1']);
    expect(mockCacheStore.get('CHAT_CACHE:CONVERSATION_LIST:user-1')).toEqual([conv(0), conv(1)]);
  });

  it('treats a missing/invalid total_pages as a single page rather than looping', async () => {
    getRequestMock.mockResolvedValue({ data: { meta: {}, results: [conv(0)] } });

    const chats = await fetchConversationsForCurrentUser([], 'user-1', true);

    expect(getRequestMock).toHaveBeenCalledTimes(1);
    expect(chats).toHaveLength(1);
  });

  it('never exceeds the defensive page ceiling even if the server reports a runaway total_pages', async () => {
    getRequestMock.mockImplementation(async (url: string) => {
      const page = Number(new URL(url).searchParams.get('page') ?? '1');
      return { data: { meta: { total_pages: 999999 }, results: [conv(page)] } };
    });

    await fetchConversationsForCurrentUser([], 'user-1', true);

    // MAX_CONVERSATION_PAGES = 200 in the implementation.
    expect(getRequestMock).toHaveBeenCalledTimes(200);
  });
});
