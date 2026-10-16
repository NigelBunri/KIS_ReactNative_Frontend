// Regression coverage for AND-056 (mute hit a dead NestJS endpoint) and
// AND-060 (blocking locked the conversation for BOTH participants instead
// of being private to the blocker). handleSetPinned (AND-044) was removed
// from this file entirely on 2026-10-16 - pinning now goes through
// useChatMessaging.ts's setPinned (a socket emit), not a REST POST; see
// that file's own comment for the full root cause.
//
// ChatRoomHandlers.tsx pulls in a lot of heavy, native-backed modules
// (file upload, voice attachments, chat media storage) that aren't needed
// to exercise the three handlers under test here, so they're mocked out
// to keep this a fast, pure logic test of the handlers' own URL/payload
// construction and error handling.

jest.mock('react-native', () => ({
  Alert: { alert: jest.fn() },
  DeviceEventEmitter: { emit: jest.fn(), addListener: jest.fn(() => ({ remove: jest.fn() })) },
}));

jest.mock('../uploadFileToBackend', () => ({
  uploadFileToBackend: jest.fn(),
  isVerificationFailedError: jest.fn(() => false),
}));
jest.mock('../chatMediaStorage', () => ({
  copyUriToChatMedia: jest.fn(),
  fileUriForPath: jest.fn(),
  stripFileScheme: jest.fn((s: string) => s),
}));
jest.mock('../voiceAttachment', () => ({
  buildVoiceAttachment: jest.fn(),
}));

const mockPostRequest = jest.fn();
jest.mock('@/network/post', () => ({
  postRequest: (...args: any[]) => mockPostRequest(...args),
}));

const mockBlockContact = jest.fn();
jest.mock('@/screens/tabs/BlockedContactsScreen', () => ({
  blockContact: (...args: any[]) => mockBlockContact(...args),
}));

jest.mock('@/network', () => ({
  __esModule: true,
  default: {
    chat: {
      listConversations: 'https://api.example.com/api/v1/chats/conversations/',
    },
    moderation: {
      // Kept here only to prove the handlers no longer reach for these —
      // moderation.mute/block are the dead NestJS routes from AND-056/060.
      mute: 'https://nest.example.com/api/v1/moderation/mute',
      block: 'https://nest.example.com/api/v1/moderation/block',
    },
  },
  NEST_API_BASE_URL: 'https://nest.example.com',
}));

import { Alert } from 'react-native';
import { postRequest } from '@/network/post';
import {
  handleMuteConversation,
  handleBlockRequest,
} from '../ChatRoomHandlers';

describe('handleMuteConversation (AND-056)', () => {
  beforeEach(() => {
    mockPostRequest.mockReset();
    (Alert.alert as jest.Mock).mockReset();
  });

  it('posts to the Django per-conversation mute action, not the dead NestJS moderation route', async () => {
    mockPostRequest.mockResolvedValue({ success: true });

    const ok = await handleMuteConversation({ conversationId: 'conv1', muted: true });

    expect(ok).toBe(true);
    expect(mockPostRequest).toHaveBeenCalledTimes(1);
    const [url, payload] = mockPostRequest.mock.calls[0];
    expect(url).toBe('https://api.example.com/api/v1/chats/conversations/conv1/mute/');
    expect(url).not.toContain('moderation/mute');
    expect(payload).toMatchObject({ muted: true });
  });

  it('surfaces a failure instead of fabricating success', async () => {
    mockPostRequest.mockResolvedValue({ success: false, message: 'nope' });

    const ok = await handleMuteConversation({ conversationId: 'conv1', muted: false });

    expect(ok).toBe(false);
    expect(Alert.alert).toHaveBeenCalled();
  });
});

describe('handleBlockRequest (AND-060)', () => {
  beforeEach(() => {
    mockPostRequest.mockReset();
    mockBlockContact.mockReset();
  });

  it('never locks the shared conversation or writes a conversation-scoped block record', async () => {
    mockBlockContact.mockResolvedValue(true);

    await handleBlockRequest('conv1', { userId: 'u2', displayName: 'Jo' });

    // The only network call a block should make is the user-scoped block
    // write, which happens inside blockContact() (mocked above) - this
    // handler itself must not call postRequest at all (no block_chat lock,
    // no conversation-scoped moderation.block).
    expect(mockPostRequest).not.toHaveBeenCalled();
    expect(mockBlockContact).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u2', displayName: 'Jo', conversationId: 'conv1' }),
    );
  });

  it('does nothing without a chatId', async () => {
    await handleBlockRequest(undefined, { userId: 'u2', displayName: 'Jo' });
    expect(mockPostRequest).not.toHaveBeenCalled();
    expect(mockBlockContact).not.toHaveBeenCalled();
  });
});

