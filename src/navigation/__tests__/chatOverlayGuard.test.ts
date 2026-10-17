// Regression coverage for the "empty, stuck chat room" bug: AppNavigator's
// openChat() is handed out directly as the onOpenChat prop to ChatRoomPage
// etc, so a caller like handleOpenSubRoom (which builds its own Chat object
// from a sub-room entry, bypassing the validated 'chat.open' event path
// entirely) could previously push a Chat with no real conversationId
// straight into chatHistory, making ChatRoomBody's isEmpty={!chat} false
// and rendering "Select a chat to start messaging." as a fully visible,
// un-escapable room.

import { hasUsableConversationKey } from '../chatOverlayGuard';

describe('hasUsableConversationKey', () => {
  it('rejects null/undefined chat objects', () => {
    expect(hasUsableConversationKey(null)).toBe(false);
    expect(hasUsableConversationKey(undefined)).toBe(false);
  });

  it('rejects a chat with neither conversationId nor id', () => {
    expect(hasUsableConversationKey({} as any)).toBe(false);
  });

  it('rejects an empty-string conversationId', () => {
    expect(hasUsableConversationKey({ conversationId: '' } as any)).toBe(false);
  });

  it('rejects a whitespace-only conversationId', () => {
    expect(hasUsableConversationKey({ conversationId: '   ' } as any)).toBe(false);
  });

  it('accepts a real conversationId', () => {
    expect(hasUsableConversationKey({ conversationId: 'conv-1' } as any)).toBe(true);
  });

  it('falls back to id when conversationId is absent', () => {
    expect(hasUsableConversationKey({ id: 'conv-2' } as any)).toBe(true);
  });

  it('prefers conversationId over id when both are present', () => {
    expect(hasUsableConversationKey({ conversationId: 'conv-3', id: '' } as any)).toBe(true);
  });
});
