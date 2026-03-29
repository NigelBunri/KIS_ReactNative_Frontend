// src/screens/chat/storage/chatStorage.ts

import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChatMessage } from '../chatTypes';

/**
 * ⚠️ Storage versioning:
 * - V1: 'KIS_CHAT_MESSAGES_BY_ROOM_V1:' (old structure / legacy)
 * - V2: 'KIS_CHAT_MESSAGES_BY_ROOM_V2:' (current ChatMessage structure aligned with backend)
 */
const STORAGE_KEY_PREFIX_V2 = 'KIS_CHAT_MESSAGES_BY_ROOM_V2:';
const LEGACY_STORAGE_KEY_PREFIX_V1 = 'KIS_CHAT_MESSAGES_BY_ROOM_V1:';

const buildKeyV2 = (roomId: string) => `${STORAGE_KEY_PREFIX_V2}${roomId}`;
const buildLegacyKeyV1 = (roomId: string) =>
  `${LEGACY_STORAGE_KEY_PREFIX_V1}${roomId}`;

/**
 * Lightweight runtime guard to ensure we always get a ChatMessage[].
 * We don't deeply validate every field, just make sure it's an array of objects.
 */
function normalizeParsedMessages(parsed: unknown): ChatMessage[] {
  if (!Array.isArray(parsed)) return [];

  const arr = parsed.filter((item) => item && typeof item === 'object');

  // Sort by createdAt if present
  const messages = (arr as ChatMessage[]).slice().sort((a, b) => {
    if (!a.createdAt || !b.createdAt) return 0;
    return a.createdAt.localeCompare(b.createdAt);
  });

  return messages;
}

/**
 * Loads messages for a room from AsyncStorage.
 * - Primary: V2 key
 * - Fallback: V1 key (migrates to V2 on first load)
 */
export async function loadMessages(roomId: string): Promise<ChatMessage[]> {
  try {
    // 1. Try V2
    const rawV2 = await AsyncStorage.getItem(buildKeyV2(roomId));
    if (rawV2) {
      const parsed = JSON.parse(rawV2);
      console.log("normalized data to see well 55555555: ", parsed)
      return normalizeParsedMessages(parsed);
    }

    // 2. Fallback: try legacy V1
    const rawV1 = await AsyncStorage.getItem(buildLegacyKeyV1(roomId));
    if (rawV1) {
      const parsed = JSON.parse(rawV1);
      const normalized = normalizeParsedMessages(parsed);

      // 🔁 Migrate to V2 for future loads
      await saveMessages(roomId, normalized);

      // (optional) You can also remove the legacy key if you want:
      // await AsyncStorage.removeItem(buildLegacyKeyV1(roomId));

      console.log("normalized data to see well: ", normalized)

      return normalized;
    }

    // Nothing stored
    return [];
  } catch (e) {
    console.warn('[chatStorage] loadMessages error', e);
    return [];
  }
}

export async function saveMessages(
  roomId: string,
  messages: ChatMessage[],
): Promise<void> {
  try {
    // Make sure messages are sorted by createdAt before saving
    const sorted = [...messages].sort((a, b) => {
      if (!a.createdAt || !b.createdAt) return 0;
      return a.createdAt.localeCompare(b.createdAt);
    });

    await AsyncStorage.setItem(buildKeyV2(roomId), JSON.stringify(sorted));
  } catch (e) {
    console.warn('[chatStorage] saveMessages error', e);
  }
}

/**
 * Insert or update a single message in storage for a room.
 * Matching is done by message.id (Mongo _id or local_...).
 */
export async function upsertMessage(
  roomId: string,
  message: ChatMessage,
): Promise<ChatMessage[]> {
  const existing = await loadMessages(roomId);
  const index = existing.findIndex((m) => m.id === message.id);
  let next: ChatMessage[];

  if (index === -1) {
    next = [...existing, message];
  } else {
    next = [...existing];
    next[index] = { ...existing[index], ...message };
  }

  await saveMessages(roomId, next);
  return next;
}

export async function removeMessage(
  roomId: string,
  messageId: string,
): Promise<ChatMessage[]> {
  const existing = await loadMessages(roomId);
  const next = existing.filter((m) => m.id !== messageId);
  await saveMessages(roomId, next);
  return next;
}

export async function updateMessageStatus(
  roomId: string,
  messageId: string,
  status: ChatMessage['status'],
): Promise<ChatMessage[]> {
  const existing = await loadMessages(roomId);
  const next = existing.map((m) =>
    m.id === messageId ? { ...m, status } : m,
  );
  await saveMessages(roomId, next);
  return next;
}

/**
 * Helper to update a batch of messages.
 * Used to mark many messages as 'sent', 'delivered', 'read', etc.
 */
export async function bulkUpdateMessages(
  roomId: string,
  updater: (message: ChatMessage) => ChatMessage,
): Promise<ChatMessage[]> {
  const existing = await loadMessages(roomId);
  const next = existing.map(updater);
  await saveMessages(roomId, next);
  return next;
}
