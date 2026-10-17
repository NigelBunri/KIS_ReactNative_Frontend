// src/navigation/chatOverlayGuard.ts
//
// The single, shared definition of "does this Chat object have a real
// conversation behind it" — used by AppNavigator.tsx's openChat() (the one
// chokepoint every chat-room overlay open goes through, whether triggered
// via the validated 'chat.open' DeviceEventEmitter path or a direct
// onOpenChat(...) call from inside an already-open chat room, e.g.
// ChatRoomPage's handleOpenSubRoom) to refuse to open a room with no
// conversation id, instead of letting ChatRoomBody's isEmpty={!chat} render
// a fully-visible, inescapable "Select a chat to start messaging." room
// with nothing real behind it.
import type { Chat } from '@/Module/ChatRoom/messagesUtils';

export function hasUsableConversationKey(chat: Pick<Chat, 'id' | 'conversationId'> | null | undefined): boolean {
  const key = chat?.conversationId ?? chat?.id;
  return typeof key !== 'undefined' && key !== null && String(key).trim().length > 0;
}
