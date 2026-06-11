// src/screens/chat/storage/chatStorage.ts

import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChatMessage } from '../chatTypes';

/**
 * ⚠️ Storage versioning:
 * - V1: 'KIS_CHAT_MESSAGES_BY_ROOM_V1:' (old structure / legacy)
 * - V2: 'KIS_CHAT_MESSAGES_BY_ROOM_V2:' (legacy room-only cache)
 * - V3: 'KIS_CHAT_MESSAGES_BY_USER_ROOM_V3:' (current user-scoped room cache)
 */
const STORAGE_KEY_PREFIX_V3 = 'KIS_CHAT_MESSAGES_BY_USER_ROOM_V3:';
const STORAGE_KEY_PREFIX_V2 = 'KIS_CHAT_MESSAGES_BY_ROOM_V2:';
const LEGACY_STORAGE_KEY_PREFIX_V1 = 'KIS_CHAT_MESSAGES_BY_ROOM_V1:';
const LOCAL_DELETED_MESSAGE_IDS_PREFIX = 'KIS_CHAT_LOCAL_DELETED_MESSAGE_IDS_V1:';
const MAX_LOCAL_DELETED_MESSAGE_IDS = 5000;

// Tracks which roomIds have unsent (pending/failed) messages so a global
// flush service can retry them even after the ChatRoom component unmounts.
const PENDING_ROOMS_KEY = 'KIS_PENDING_ROOMS_V1';

const scopedRoomId = (roomId: string, currentUserId?: string | null) => {
  const userId = currentUserId != null ? String(currentUserId).trim() : '';
  return userId ? `${userId}:${roomId}` : roomId;
};

export async function markRoomHasPending(roomId: string, currentUserId?: string | null): Promise<void> {
  try {
    const key = scopedRoomId(roomId, currentUserId);
    const raw = await AsyncStorage.getItem(PENDING_ROOMS_KEY);
    const rooms: string[] = raw ? JSON.parse(raw) : [];
    if (!rooms.includes(key)) {
      await AsyncStorage.setItem(PENDING_ROOMS_KEY, JSON.stringify([...rooms, key]));
    }
  } catch {}
}

export async function unmarkRoomHasPending(roomId: string, currentUserId?: string | null): Promise<void> {
  try {
    const key = scopedRoomId(roomId, currentUserId);
    const raw = await AsyncStorage.getItem(PENDING_ROOMS_KEY);
    if (!raw) return;
    const rooms: string[] = JSON.parse(raw);
    const next = rooms.filter(r => r !== key && r !== roomId);
    await AsyncStorage.setItem(PENDING_ROOMS_KEY, JSON.stringify(next));
  } catch {}
}

export async function getAllRoomsWithPendingMessages(currentUserId?: string | null): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_ROOMS_KEY);
    const rooms: string[] = raw ? JSON.parse(raw) : [];
    const userId = currentUserId != null ? String(currentUserId).trim() : '';
    if (!userId) return rooms;
    return rooms
      .filter(room => room === String(room).split(':').slice(1).join(':') || room.startsWith(`${userId}:`))
      .map(room => (room.startsWith(`${userId}:`) ? room.slice(userId.length + 1) : room));
  } catch { return []; }
}

const buildKeyV3 = (roomId: string, currentUserId?: string | null) => {
  const userId = currentUserId != null ? String(currentUserId).trim() : '';
  return userId ? `${STORAGE_KEY_PREFIX_V3}${userId}:${roomId}` : `${STORAGE_KEY_PREFIX_V2}${roomId}`;
};
const buildKeyV2 = (roomId: string) => `${STORAGE_KEY_PREFIX_V2}${roomId}`;
const buildLegacyKeyV1 = (roomId: string) =>
  `${LEGACY_STORAGE_KEY_PREFIX_V1}${roomId}`;
const buildLocalDeletedMessageIdsKey = (
  roomId: string,
  currentUserId?: string | null,
) =>
  `${LOCAL_DELETED_MESSAGE_IDS_PREFIX}${scopedRoomId(roomId, currentUserId)}`;

const extractRoomAliases = (roomId: string, messages: ChatMessage[] = []): string[] => {
  const aliases = new Set<string>();
  const add = (value: unknown) => {
    if (value == null) return;
    const clean = String(value).trim();
    if (clean) aliases.add(clean);
  };

  add(roomId);
  messages.forEach((message) => {
    add((message as any).conversationId);
    add((message as any).roomId);
  });

  return Array.from(aliases);
};

const keyBelongsToUserScope = (key: string, currentUserId?: string | null) => {
  const userId = currentUserId != null ? String(currentUserId).trim() : '';
  if (key.startsWith(STORAGE_KEY_PREFIX_V2) || key.startsWith(LEGACY_STORAGE_KEY_PREFIX_V1)) {
    return true;
  }
  if (!key.startsWith(STORAGE_KEY_PREFIX_V3)) return false;
  if (!userId) return true;
  return key.startsWith(`${STORAGE_KEY_PREFIX_V3}${userId}:`);
};

const firstString = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) return value;
  }
  return undefined;
};

const firstNumber = (...values: unknown[]): number | undefined => {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return undefined;
};

const normalizeStoredAttachment = (raw: unknown, index: number) => {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as any;
  const att = source.attachment ?? source.asset ?? source.media ?? source.file ?? source;
  if (!att || typeof att !== 'object') return null;

  const localPath = firstString(att.localPath, att.local_path);
  const localUri =
    firstString(att.localUri, att.local_uri) ??
    (localPath ? `file://${localPath}` : undefined);
  const url =
    firstString(
      att.displayUrl,
      att.display_url,
      att.url,
      att.downloadUrl,
      att.download_url,
      att.publicUrl,
      att.public_url,
      att.fileUrl,
      att.file_url,
      att.secureUrl,
      att.secure_url,
      att.signedUrl,
      att.signed_url,
      att.uri,
      localUri,
      att.path,
    ) ?? '';
  const assetId = firstString(att.assetId, att.asset_id);
  const mediaAssetId = firstString(att.mediaAssetId, att.media_asset_id);
  const id =
    firstString(att.id, att.key, mediaAssetId, assetId, att.mediaAssetRef, att.media_asset_ref) ??
    (url ? `att-${index}-${url}` : undefined);

  if (!id && !url) return null;

  return {
    ...att,
    id: id ?? `att-${index}`,
    url,
    displayUrl: firstString(att.displayUrl, att.display_url, url),
    downloadUrl: firstString(att.downloadUrl, att.download_url, att.fileUrl, att.file_url, url),
    publicUrl: firstString(att.publicUrl, att.public_url),
    originalName: firstString(att.originalName, att.original_name, att.name, att.filename, att.fileName, att.file_name) ?? 'File',
    mimeType: firstString(att.mimeType, att.mime_type, att.mimetype, att.contentType, att.content_type, att.mime) ?? 'application/octet-stream',
    size: firstNumber(att.size, att.sizeBytes, att.size_bytes) ?? 0,
    assetId,
    mediaAssetId,
    mediaAssetRef: firstString(att.mediaAssetRef, att.media_asset_ref),
    localUri,
    localPath,
    expiresAt: firstString(att.expiresAt, att.expires_at),
    expired: att.expired === true,
    downloadedAt: firstString(att.downloadedAt, att.downloaded_at),
    localDownloadedAt: att.localDownloadedAt ?? att.local_downloaded_at,
  };
};

const normalizeStoredAttachments = (input: unknown) => {
  if (!Array.isArray(input)) return [];
  return input
    .map((item, index) => normalizeStoredAttachment(item, index))
    .filter(Boolean);
};

const hydrateStoredMessageMedia = (message: ChatMessage): ChatMessage => {
  const row = message as any;
  const directAttachments = normalizeStoredAttachments(row.attachments);
  const mediaAttachments = normalizeStoredAttachments(row.media?.attachments);
  const attachments = directAttachments.length ? directAttachments : mediaAttachments;
  if (!attachments.length) return message;

  const media =
    row.media && typeof row.media === 'object'
      ? { ...row.media, attachments }
      : { attachments };

  return {
    ...message,
    attachments: attachments as any,
    media,
  };
};

/**
 * Lightweight runtime guard to ensure we always get a ChatMessage[].
 * We don't deeply validate every field, just make sure it's an array of objects.
 */
function normalizeParsedMessages(parsed: unknown): ChatMessage[] {
  if (!Array.isArray(parsed)) return [];

  const arr = parsed
    .filter((item) => item && typeof item === 'object')
    .map((item) => hydrateStoredMessageMedia(item as ChatMessage));

  // Sort by createdAt if present
  const messages = (arr as ChatMessage[]).slice().sort((a, b) => {
    if (!a.createdAt || !b.createdAt) return 0;
    return a.createdAt.localeCompare(b.createdAt);
  });

  return messages;
}

// Rooms already merged via the alias-recovery scan. Avoids repeating the
// expensive getAllKeys() + per-key read loop on every loadMessages call.
const aliasRecoveryDone = new Set<string>();

/**
 * Loads messages for a room from AsyncStorage.
 * - Primary: V2 key
 * - Fallback: V1 key (migrates to V2 on first load)
 */
const messageBelongsToRoom = (roomId: string, message: ChatMessage) => {
  const convId = (message as any).conversationId;
  const localRoomId = (message as any).roomId;
  if (convId == null && localRoomId == null) return true;
  return String(convId ?? '') === String(roomId) || String(localRoomId ?? '') === String(roomId);
};

const messagesForRoom = (roomId: string, messages: ChatMessage[]) =>
  messages.filter(message => messageBelongsToRoom(roomId, message));

const messageIdentityKey = (message: ChatMessage, index: number): string => {
  const row = message as any;
  return String(row.serverId ?? row.clientId ?? row.id ?? row.messageId ?? `${row.createdAt ?? 'msg'}:${row.senderId ?? 'unknown'}:${index}`);
};

const messageCacheScore = (message: ChatMessage): number => {
  const row = message as any;
  const text = typeof row.text === 'string' ? row.text.trim() : '';
  const hasReadableText = text.length > 0 && text.toLowerCase() !== 'encrypted message';
  const directAttachments = Array.isArray(row.attachments) ? row.attachments.length : 0;
  const mediaAttachments = Array.isArray(row.media?.attachments) ? row.media.attachments.length : 0;
  const statusRank: Record<string, number> = {
    local_only: 0,
    failed: 1,
    pending: 2,
    sending: 3,
    sent: 4,
    delivered: 5,
    read: 6,
  };
  return (
    (hasReadableText ? 100 : 0) +
    (directAttachments + mediaAttachments) * 20 +
    (row.media ? 10 : 0) +
    (row.styledText || row.voice || row.sticker || row.poll || row.event || row.contacts?.length ? 10 : 0) +
    (statusRank[String(row.status ?? '')] ?? 0)
  );
};

const CACHE_STATUS_ORDER: Record<string, number> = { failed: -1, pending: 0, sending: 0, local_only: 0, sent: 1, delivered: 2, read: 3 };

const mergeCachedMessage = (prev: ChatMessage, next: ChatMessage): ChatMessage => {
  const p = prev as any;
  const n = next as any;
  const merged: any = { ...p, ...n };
  const nextText = typeof n.text === 'string' ? n.text.trim() : '';
  const prevText = typeof p.text === 'string' ? p.text.trim() : '';
  if ((!nextText || nextText.toLowerCase() === 'encrypted message') && prevText && prevText.toLowerCase() !== 'encrypted message') {
    merged.text = p.text;
  }
  if (!(n.attachments?.length) && p.attachments?.length) merged.attachments = p.attachments;
  if (!(n.media?.attachments?.length) && p.media?.attachments?.length) merged.media = p.media;
  if (!n.styledText && p.styledText) merged.styledText = p.styledText;
  if (!n.voice && p.voice) merged.voice = p.voice;
  if (!n.sticker && p.sticker) merged.sticker = p.sticker;
  if (!n.poll && p.poll) merged.poll = p.poll;
  if (!n.event && p.event) merged.event = p.event;
  if (!(n.contacts?.length) && p.contacts?.length) merged.contacts = p.contacts;
  // Never downgrade status — keep whichever version has the higher rank.
  const pRank = CACHE_STATUS_ORDER[String(p.status ?? '')] ?? 0;
  const nRank = CACHE_STATUS_ORDER[String(n.status ?? '')] ?? 0;
  if (pRank > nRank) merged.status = p.status;
  return merged as ChatMessage;
};

const dedupeCachedMessages = (messages: ChatMessage[]): ChatMessage[] => {
  const byIdentity = new Map<string, ChatMessage>();
  messages.forEach((message, index) => {
    const key = messageIdentityKey(message, index);
    const existing = byIdentity.get(key);
    if (!existing) {
      byIdentity.set(key, message);
      return;
    }
    const merged = mergeCachedMessage(existing, message);
    byIdentity.set(
      key,
      messageCacheScore(message) >= messageCacheScore(existing) ? mergeCachedMessage(existing, message) : merged,
    );
  });
  return normalizeParsedMessages(Array.from(byIdentity.values()));
};

export async function loadMessages(roomId: string, currentUserId?: string | null): Promise<ChatMessage[]> {
  try {
    const recovered: ChatMessage[] = [];

    const rawV3 = await AsyncStorage.getItem(buildKeyV3(roomId, currentUserId));
    if (rawV3) {
      try {
        recovered.push(...messagesForRoom(roomId, normalizeParsedMessages(JSON.parse(rawV3))));
      } catch {}
    }

    // Migration fallback: old builds stored room messages without user scope.
    // Merge it with the scoped cache because aliases can hold newer rows.
    const rawV2 = await AsyncStorage.getItem(buildKeyV2(roomId));
    if (rawV2) {
      try {
        recovered.push(...messagesForRoom(roomId, normalizeParsedMessages(JSON.parse(rawV2))));
      } catch {}
    }

    const rawV1 = await AsyncStorage.getItem(buildLegacyKeyV1(roomId));
    if (rawV1) {
      try {
        recovered.push(...messagesForRoom(roomId, normalizeParsedMessages(JSON.parse(rawV1))));
      } catch {}
    }

    // Alias recovery: run once per room per session. A new DM can start with
    // a temporary chat.id and later receive a backend conversationId — keys
    // can hold rows for both. The getAllKeys() scan is expensive so we only
    // run it on first load for a given room, then skip on subsequent calls.
    const recoveryKey = `${currentUserId ?? ''}:${roomId}`;
    if (!aliasRecoveryDone.has(recoveryKey)) {
      aliasRecoveryDone.add(recoveryKey);
      const keys = await AsyncStorage.getAllKeys();
      const candidateKeys = keys.filter((key) =>
        keyBelongsToUserScope(key, currentUserId) &&
        (
          key.startsWith(STORAGE_KEY_PREFIX_V3) ||
          key.startsWith(STORAGE_KEY_PREFIX_V2) ||
          key.startsWith(LEGACY_STORAGE_KEY_PREFIX_V1)
        ),
      );
      for (const key of candidateKeys) {
        const raw = await AsyncStorage.getItem(key);
        if (!raw) continue;
        try {
          recovered.push(...messagesForRoom(roomId, normalizeParsedMessages(JSON.parse(raw))));
        } catch {}
      }
    }

    if (recovered.length) {
      const deduped = dedupeCachedMessages(recovered);
      const visible = await filterLocallyDeletedMessages(
        roomId,
        deduped,
        currentUserId,
      );
      await saveMessages(roomId, visible, currentUserId);
      return visible;
    }

    return [];
  } catch (e) {
    console.warn('[chatStorage] loadMessages error', e);
    return [];
  }
}

export async function saveMessages(
  roomId: string,
  messages: ChatMessage[],
  currentUserId?: string | null,
): Promise<void> {
  try {
    // Make sure messages are sorted by createdAt before saving
    const sorted = [...messages].sort((a, b) => {
      if (!a.createdAt || !b.createdAt) return 0;
      return a.createdAt.localeCompare(b.createdAt);
    });

    const payload = JSON.stringify(sorted);
    const aliases = extractRoomAliases(roomId, sorted);
    await Promise.all(
      aliases.map((alias) =>
        AsyncStorage.setItem(buildKeyV3(alias, currentUserId), payload),
      ),
    );
  } catch (e) {
    console.warn('[chatStorage] saveMessages error', e);
  }
}

const identityValues = (message: Partial<ChatMessage>): string[] =>
  [
    message.id,
    message.serverId,
    message.clientId,
    (message as any).messageId,
  ]
    .filter((value): value is string | number => value != null && String(value).trim().length > 0)
    .map((value) => String(value));

export async function getLocallyDeletedMessageIds(
  roomId: string,
  currentUserId?: string | null,
): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(
      buildLocalDeletedMessageIdsKey(roomId, currentUserId),
    );
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed
          .filter(value => value != null && String(value).trim().length > 0)
          .map(String)
      : [];
  } catch {
    return [];
  }
}

export async function rememberLocallyDeletedMessageIds(
  roomId: string,
  messageIds: string | string[],
  currentUserId?: string | null,
): Promise<void> {
  const incoming = (Array.isArray(messageIds) ? messageIds : [messageIds])
    .filter(value => value != null && String(value).trim().length > 0)
    .map(String);
  if (!incoming.length) return;

  try {
    const existing = await getLocallyDeletedMessageIds(roomId, currentUserId);
    const merged = Array.from(new Set([...existing, ...incoming])).slice(
      -MAX_LOCAL_DELETED_MESSAGE_IDS,
    );
    await AsyncStorage.setItem(
      buildLocalDeletedMessageIdsKey(roomId, currentUserId),
      JSON.stringify(merged),
    );
  } catch (error) {
    console.warn('[chatStorage] rememberLocallyDeletedMessageIds error', error);
  }
}

export async function filterLocallyDeletedMessages(
  roomId: string,
  messages: ChatMessage[],
  currentUserId?: string | null,
): Promise<ChatMessage[]> {
  const deletedIds = new Set(
    await getLocallyDeletedMessageIds(roomId, currentUserId),
  );
  if (!deletedIds.size) return messages;

  return messages.filter(
    message =>
      !identityValues(message).some(identity => deletedIds.has(identity)),
  );
}

const messagesShareIdentity = (
  left: Partial<ChatMessage>,
  right: Partial<ChatMessage>,
): boolean => {
  const rightIds = new Set(identityValues(right));
  return identityValues(left).some((value) => rightIds.has(value));
};

/**
 * Insert or update a single message in storage for a room.
 * Matching uses every stable identity we have so local client rows are promoted
 * to server rows instead of being rendered again after socket echo / restart.
 */
export async function upsertMessage(
  roomId: string,
  message: ChatMessage,
  currentUserId?: string | null,
): Promise<ChatMessage[]> {
  const existing = await loadMessages(roomId, currentUserId);
  const index = existing.findIndex((m) => messagesShareIdentity(m, message));
  let next: ChatMessage[];

  if (index === -1) {
    next = [...existing, message];
  } else {
    next = [...existing];
    next[index] = { ...existing[index], ...message };
  }

  await saveMessages(roomId, next, currentUserId);
  return next;
}

export async function removeMessage(
  roomId: string,
  messageId: string | string[],
  currentUserId?: string | null,
): Promise<ChatMessage[]> {
  const existing = await loadMessages(roomId, currentUserId);
  const targetIds = new Set(
    (Array.isArray(messageId) ? messageId : [messageId])
      .filter(Boolean)
      .map(value => String(value)),
  );
  const next = existing.filter(
    message =>
      !identityValues(message).some(identity => targetIds.has(identity)),
  );
  await saveMessages(roomId, next, currentUserId);
  return next;
}

export async function updateMessageStatus(
  roomId: string,
  messageId: string,
  status: ChatMessage['status'],
  currentUserId?: string | null,
): Promise<ChatMessage[]> {
  const existing = await loadMessages(roomId, currentUserId);
  const next = existing.map((m) =>
    m.id === messageId ? { ...m, status } : m,
  );
  await saveMessages(roomId, next, currentUserId);
  return next;
}

/**
 * Helper to update a batch of messages.
 * Used to mark many messages as 'sent', 'delivered', 'read', etc.
 */
export async function bulkUpdateMessages(
  roomId: string,
  updater: (message: ChatMessage) => ChatMessage,
  currentUserId?: string | null,
): Promise<ChatMessage[]> {
  const existing = await loadMessages(roomId, currentUserId);
  const next = existing.map(updater);
  await saveMessages(roomId, next, currentUserId);
  return next;
}

export async function clearMessages(roomId: string, currentUserId?: string | null): Promise<void> {
  try {
    await AsyncStorage.removeItem(buildKeyV3(roomId, currentUserId));
  } catch (e) {
    console.warn('[chatStorage] clearMessages error', e);
  }
}
