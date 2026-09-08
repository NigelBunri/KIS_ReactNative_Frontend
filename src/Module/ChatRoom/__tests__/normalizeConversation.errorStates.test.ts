/**
 * P1 fix: fetchConversationsForCurrentUser previously returned a plain
 * Chat[] with no signal of *why* the list is what it is — a failed refresh
 * that fell back to cache was indistinguishable from a confirmed-empty
 * account, and the caller had no way to render a distinct error/offline
 * state instead of a generic empty view. See
 * fetchConversationsForCurrentUserWithStatus in ../normalizeConversation.ts.
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
import { fetchConversationsForCurrentUserWithStatus } from '../normalizeConversation';

const getRequestMock = getRequest as jest.Mock;

const conv = (id: number) => ({ id: `conv-${id}`, type: 'group', title: `Conversation ${id}` });
const okPage = (results: any[], totalPages = 1) => ({ data: { meta: { total_pages: totalPages }, results } });

describe('conversation list fetch status (P1 fix)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCacheStore.clear();
  });

  it('reports "fresh" on a normal successful forced refresh', async () => {
    getRequestMock.mockResolvedValue(okPage([conv(0), conv(1)]));

    const { chats, status } = await fetchConversationsForCurrentUserWithStatus([], 'user-1', true);

    expect(status).toBe('fresh');
    expect(chats).toHaveLength(2);
  });

  it('reports "fresh" (not an error) when the backend genuinely returns zero conversations', async () => {
    getRequestMock.mockResolvedValue(okPage([]));

    const { chats, status } = await fetchConversationsForCurrentUserWithStatus([], 'user-1', true);

    // A confirmed-empty account must never be indistinguishable from an
    // error - it should render the plain "no chats yet" empty state, not
    // an error/offline banner.
    expect(status).toBe('fresh');
    expect(chats).toHaveLength(0);
  });

  it('reports "cache_fallback" when a forced refresh fails but cached data exists', async () => {
    mockCacheStore.set('CHAT_CACHE:CONVERSATION_LIST:user-1', [conv(0)]);
    getRequestMock.mockRejectedValue(new Error('network down'));

    const { chats, status } = await fetchConversationsForCurrentUserWithStatus([], 'user-1', true);

    expect(status).toBe('cache_fallback');
    expect(chats).toHaveLength(1);
  });

  it('reports "error_no_cache" when a forced refresh fails and nothing is cached', async () => {
    getRequestMock.mockRejectedValue(new Error('network down'));

    const { chats, status } = await fetchConversationsForCurrentUserWithStatus([], 'user-1', true);

    expect(status).toBe('error_no_cache');
    expect(chats).toHaveLength(0);
  });

  it('reports "error_no_cache" on the passive (non-forced) path when the cache is empty and the background refresh fails', async () => {
    getRequestMock.mockRejectedValue(new Error('network down'));

    const { chats, status } = await fetchConversationsForCurrentUserWithStatus([conv(0)], 'user-1', false);

    // Falls back to the caller-supplied `fallback` list (e.g. in-memory
    // state) - still an error, not a silent "fresh empty" result.
    expect(status).toBe('error_no_cache' /* nothing in AsyncStorage-backed cache */);
    expect(chats.map((c) => c.id)).toEqual(['conv-0']);
  });

  it('reports "fresh" on the passive path when a background refresh succeeds from an empty cache', async () => {
    getRequestMock.mockResolvedValue(okPage([conv(0)]));

    const { chats, status } = await fetchConversationsForCurrentUserWithStatus([], 'user-1', false);

    expect(status).toBe('fresh');
    expect(chats).toHaveLength(1);
  });

  it('reports "fresh" on the passive path when the cache already has data (no refresh attempted)', async () => {
    mockCacheStore.set('CHAT_CACHE:CONVERSATION_LIST:user-1', [conv(0), conv(1)]);

    const { chats, status } = await fetchConversationsForCurrentUserWithStatus([], 'user-1', false);

    expect(getRequestMock).not.toHaveBeenCalled();
    expect(status).toBe('fresh');
    expect(chats).toHaveLength(2);
  });
});
