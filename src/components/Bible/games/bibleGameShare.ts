// src/components/Bible/games/bibleGameShare.ts
//
// Sends a real Bible-games stats snapshot into a chat conversation - the
// one network-touching action in the whole Bible-games feature (gameplay
// itself stays fully offline, see gameStorage.ts). Mirrors
// BibleReaderPanel.tsx's handleSharePick exactly: a real
// `socket.emit('chat.send', ...)` call with an ack callback, not a draft-
// prefill the user still has to press Send on - the point of sharing a
// stats card is that it actually lands in the chat right away.

import type { Socket } from 'socket.io-client';
import type { BibleGameStatsMessage } from '@/Module/ChatRoom/chatTypes';
import type { Chat } from '@/Module/ChatRoom/messagesUtils';

export function shareGameStats(
  socket: Socket | null | undefined,
  chat: Chat,
  stats: BibleGameStatsMessage,
): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    if (!socket) {
      resolve({ ok: false, error: 'Unable to share right now — check your connection.' });
      return;
    }
    const conversationId = String((chat as any)?.conversationId ?? chat.id);
    socket.timeout(20000).emit(
      'chat.send',
      {
        conversationId,
        clientId: `client_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        kind: 'bible_game_stats',
        bibleGameStats: stats,
      },
      (err: any, ackResult: { ok?: boolean; error?: string } | undefined) => {
        if (err) {
          resolve({ ok: false, error: 'No response from the server — please try again.' });
          return;
        }
        if (ackResult && ackResult.ok === false) {
          resolve({ ok: false, error: ackResult.error || 'The chat could not accept this message.' });
          return;
        }
        resolve({ ok: true });
      },
    );
  });
}
