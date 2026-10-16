// Regression coverage for the "phantom/generic chat room" audit: every
// chat.open emitter in the app is expected to pass a real name, but
// nothing enforced that - a payload missing it (or with an empty name)
// used to silently fall back to the literal string 'Chat', which is
// exactly the generic placeholder title users reported seeing instead of
// the conversation they actually opened/just created.

const mockGetRequest = jest.fn();
jest.mock('@/network/get', () => ({
  getRequest: (...args: any[]) => mockGetRequest(...args),
}));

jest.mock('@/network', () => ({
  __esModule: true,
  default: {
    chat: {
      listConversations: 'https://api.example.com/api/v1/chats/conversations/',
    },
  },
}));

import { resolveChatOpenPayload } from '../resolveChatOpenPayload';

describe('resolveChatOpenPayload', () => {
  beforeEach(() => {
    mockGetRequest.mockReset();
  });

  it('returns null when there is no usable conversation id at all - never invents one', async () => {
    const chat = await resolveChatOpenPayload({ name: 'Something' });
    expect(chat).toBeNull();
    expect(mockGetRequest).not.toHaveBeenCalled();
  });

  it('uses the provided name as-is without any network call when present', async () => {
    const chat = await resolveChatOpenPayload({ conversationId: 'conv-1', name: 'Real Group Name', kind: 'group' });
    expect(chat?.name).toBe('Real Group Name');
    expect(mockGetRequest).not.toHaveBeenCalled();
  });

  it('fetches the real conversation name from Django when the payload omits it', async () => {
    mockGetRequest.mockResolvedValue({
      success: true,
      data: { id: 'conv-2', name: 'Fetched Real Name', kind: 'group' },
    });

    const chat = await resolveChatOpenPayload({ conversationId: 'conv-2' });

    expect(mockGetRequest).toHaveBeenCalledWith(
      'https://api.example.com/api/v1/chats/conversations/conv-2/',
      expect.anything(),
    );
    expect(chat?.name).toBe('Fetched Real Name');
    // Must never be the generic placeholder this entire fix exists to kill.
    expect(chat?.name).not.toBe('Chat');
  });

  it('falls back to an honest "Unnamed Conversation" (never the generic "Chat") when the fetch also fails', async () => {
    mockGetRequest.mockRejectedValue(new Error('network down'));

    const chat = await resolveChatOpenPayload({ conversationId: 'conv-3' });

    expect(chat?.name).toBe('Unnamed Conversation');
    expect(chat?.name).not.toBe('Chat');
  });

  it('falls back to "Unnamed Conversation" when the fetch succeeds but returns no usable name', async () => {
    mockGetRequest.mockResolvedValue({ success: true, data: { id: 'conv-4' } });

    const chat = await resolveChatOpenPayload({ conversationId: 'conv-4' });

    expect(chat?.name).toBe('Unnamed Conversation');
  });

  it('treats a whitespace-only name the same as a missing one and still fetches the real name', async () => {
    mockGetRequest.mockResolvedValue({
      success: true,
      data: { id: 'conv-5', name: 'Real Name', kind: 'direct' },
    });

    const chat = await resolveChatOpenPayload({ conversationId: 'conv-5', name: '   ' });

    expect(mockGetRequest).toHaveBeenCalled();
    expect(chat?.name).toBe('Real Name');
  });

  it("marks 'group' kind payloads as isGroup/isGroupChat", async () => {
    const chat = await resolveChatOpenPayload({ conversationId: 'conv-6', name: 'G', kind: 'group' });
    expect(chat?.isGroup).toBe(true);
    expect(chat?.isGroupChat).toBe(true);
  });

  it("marks 'channel' kind payloads as isGroup/isGroupChat too (broadcast channel conversation)", async () => {
    const chat = await resolveChatOpenPayload({ conversationId: 'conv-7', name: 'C', kind: 'channel' });
    expect(chat?.isGroup).toBe(true);
    expect(chat?.isGroupChat).toBe(true);
  });

  it("marks 'community' kind payloads with isCommunityChat and a communityId", async () => {
    const chat = await resolveChatOpenPayload({ conversationId: 'conv-8', name: 'Com', kind: 'community' });
    expect((chat as any)?.isCommunityChat).toBe(true);
    expect((chat as any)?.communityId).toBe('conv-8');
  });

  it("a plain 'dm' kind payload is not treated as a group", async () => {
    const chat = await resolveChatOpenPayload({ conversationId: 'conv-9', name: 'Jo', kind: 'dm' });
    expect(chat?.isGroup).toBe(false);
    expect(chat?.isGroupChat).toBe(false);
  });
});
