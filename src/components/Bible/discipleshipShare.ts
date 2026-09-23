// src/components/Bible/discipleshipShare.ts
//
// Sends a real 12-Pillars discipleship-journey stats snapshot into a chat
// conversation. Mirrors src/components/Bible/games/bibleGameShare.ts
// exactly: a real `socket.emit('chat.send', ...)` call with an ack
// callback, not a draft-prefill the user still has to press Send on.

import type { Socket } from 'socket.io-client';
import type { BibleDiscipleshipStatsMessage } from '@/Module/ChatRoom/chatTypes';
import type { Chat } from '@/Module/ChatRoom/messagesUtils';

export function shareDiscipleshipStats(
  socket: Socket | null | undefined,
  chat: Chat,
  stats: BibleDiscipleshipStatsMessage,
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
        kind: 'bible_discipleship_stats',
        bibleDiscipleshipStats: stats,
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
