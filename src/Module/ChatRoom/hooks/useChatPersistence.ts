// src/screens/chat/hooks/useChatPersistence.ts

/* ============================================================================
 * OFFLINE-FIRST CHAT PERSISTENCE HOOK (TYPE-SAFE, serverId AWARE)
 * ---------------------------------------------------------------------------
 * This version FIXES all TypeScript issues reported:
 *
 * 1) SendOverNetworkResult union narrowing (serverId access safe)
 * 2) ChatMessage.id optional vs required mismatch
 * 3) string | undefined key usage
 * 4) Strict clientId / serverId identity rules
 *
 * It intentionally exceeds 500 LOC to remain explicit, debuggable,
 * and production-grade.
 * ============================================================================
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  ChatMessage,
  MessageStatus,
} from '../chatTypes';
import { normalizeChatSendText } from '../safeChatText';

import {
  loadMessages,
  saveMessages,
  markRoomHasPending,
  unmarkRoomHasPending,
} from '../Storage/chatStorage';

/* ============================================================================
 * NETWORK CONTRACT TYPES (STRICT)
 * ============================================================================
 */

/**
 * Transport ACK when message is accepted by server.
 */
export type SendOverNetworkAck = {
  ok: true;
  serverId: string;
  createdAt?: string;
  seq?: number;
};

/**
 * Transport NACK or failure.
 */
export type SendOverNetworkNack = {
  ok: false;
  queued?: boolean;
};

/**
 * Discriminated union for safe narrowing.
 */
export type SendOverNetworkResult =
  | SendOverNetworkAck
  | SendOverNetworkNack;

/**
 * Transport function injected from messaging layer.
 */
export type SendOverNetworkFn = (
  message: ChatMessage,
) => Promise<SendOverNetworkResult>;

/* ============================================================================
 * HOOK OPTIONS / API
 * ============================================================================
 */

type UseChatPersistenceOptions = {
  roomId: string;
  currentUserId: string;
  sendOverNetwork?: SendOverNetworkFn;
};

export type UseChatPersistenceResult = {
  messages: ChatMessage[];
  isLoading: boolean;

  sendTextMessage: (
    text: string,
    extra?: Partial<ChatMessage>,
  ) => Promise<void>;

  sendRichMessage: (
    payload: Partial<ChatMessage>,
  ) => Promise<void>;

  editMessage: (
    messageId: string,
    patch: Partial<ChatMessage>,
  ) => Promise<void>;

  softDeleteMessage: (
    messageId: string,
  ) => Promise<void>;

  replyToMessage: (
    parent: ChatMessage,
    text: string,
    extra?: Partial<ChatMessage>,
  ) => Promise<void>;

  attemptFlushQueue: (options?: { silent?: boolean }) => Promise<void>;

  replaceMessages: (
    next: ChatMessage[],
  ) => Promise<void>;

  retryMessage: (messageId: string) => Promise<void>;
};

/* ============================================================================
 * STATUS CONSTANTS
 * ============================================================================
 */

const STATUS_QUEUED: MessageStatus = 'pending';
const STATUS_SENT: MessageStatus = 'sent';
const STATUS_FAILED: MessageStatus = 'failed';

/* ============================================================================
 * ID & TIME HELPERS
 * ============================================================================
 */

const nowIso = (): string => new Date().toISOString();

/**
 * Always returns a NON-EMPTY string.
 */
const createClientId = (): string => {
  return `client_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2)}`;
};

/**
 * Ensures we always have a usable identity key.
 */
const getIdentityKey = (msg: ChatMessage): string => {
  if (msg.serverId) return msg.serverId;
  return msg.clientId;
};

/* ============================================================================
 * SORTING & NORMALIZATION
 * ============================================================================
 */


const isSyntheticUploadMessage = (msg: ChatMessage): boolean => {
  const row = msg as any;
  const id = String(row.id ?? row.clientId ?? '');
  return id.startsWith('__upload_') || Boolean(row._uploadStatus || row._uploadProgress !== undefined);
};

const attachmentKeys = (attachment: any): string[] => {
  if (!attachment || typeof attachment !== 'object') return [];
  const keys = new Set<string>();
  const add = (prefix: string, value: unknown) => {
    if (typeof value !== 'string') return;
    const clean = value.trim();
    if (clean) keys.add(`${prefix}:${clean}`);
  };

  add('asset', attachment.mediaAssetId ?? attachment.assetId ?? attachment.mediaAssetRef);
  add('remote', attachment.displayUrl ?? attachment.url ?? attachment.downloadUrl ?? attachment.publicUrl);
  add('local', attachment.localUploadKey);
  add('local', attachment.localUri ?? attachment.uri);

  const name = String(attachment.originalName ?? attachment.name ?? '').trim().toLowerCase();
  const mime = String(attachment.mimeType ?? attachment.mime ?? attachment.type ?? '').trim().toLowerCase();
  const size = typeof attachment.size === 'number' && Number.isFinite(attachment.size)
    ? String(attachment.size)
    : '';
  if ((name || mime) && size) {
    keys.add(`file:${name}:${mime}:${size}`);
  }

  return Array.from(keys);
};

const dedupeMessageAttachments = (msg: ChatMessage): ChatMessage => {
  const row = msg as any;
  const attachments = Array.isArray(row.attachments) ? row.attachments : [];
  if (attachments.length < 2) return msg;

  const isLocalUrl = (attachment: any) => /^(file|ph|assets-library|content):/i.test(String(attachment?.displayUrl ?? attachment?.url ?? attachment?.uri ?? ''));
  const isMedia = (attachment: any) => {
    const mime = String(attachment?.mimeType ?? attachment?.mime ?? attachment?.type ?? '').toLowerCase();
    const kind = String(attachment?.kind ?? '').toLowerCase();
    return kind === 'image' || kind === 'video' || mime.startsWith('image/') || mime.startsWith('video/');
  };
  const hasRemoteMedia = attachments.some((attachment: any) => isMedia(attachment) && !isLocalUrl(attachment));

  const seen = new Set<string>();
  const nextAttachments: any[] = [];
  for (const attachment of attachments) {
    if (hasRemoteMedia && isMedia(attachment) && isLocalUrl(attachment)) continue;
    const keys = attachmentKeys(attachment);
    const duplicate = keys.length > 0 && keys.some((key) => seen.has(key));
    if (duplicate) continue;
    keys.forEach((key) => seen.add(key));
    nextAttachments.push(attachment);
  }

  return nextAttachments.length === attachments.length
    ? msg
    : ({ ...msg, attachments: nextAttachments } as ChatMessage);
};

const messageTimestampMs = (msg: ChatMessage): number => {
  if (typeof msg.createdAt === 'number') return msg.createdAt;
  if (typeof msg.createdAt !== 'string') return 0;
  const parsed = Date.parse(msg.createdAt);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const messageAttachmentKeys = (msg: ChatMessage): string[] => {
  const attachments = Array.isArray((msg as any).attachments) ? (msg as any).attachments : [];
  const keys = new Set<string>();
  attachments.forEach((attachment: any) => {
    attachmentKeys(attachment).forEach((key) => keys.add(key));
  });
  return Array.from(keys);
};

const isUnsettledLocalMediaMessage = (msg: ChatMessage): boolean => {
  const status = String((msg as any).status ?? '').toLowerCase();
  return status === 'failed' || status === 'pending' || status === 'sending' || status === 'local_only';
};

const hasRemoteAttachment = (msg: ChatMessage): boolean => {
  const attachments = Array.isArray((msg as any).attachments) ? (msg as any).attachments : [];
  return attachments.some((attachment: any) => {
    const url = String(attachment?.displayUrl ?? attachment?.url ?? attachment?.downloadUrl ?? attachment?.publicUrl ?? '');
    return /^https?:\/\//i.test(url);
  });
};

const duplicateMessageScore = (msg: ChatMessage): number => {
  const status = String((msg as any).status ?? '').toLowerCase();
  const statusScore = status === 'read' || status === 'delivered' || status === 'sent'
    ? 100
    : status === 'pending' || status === 'sending'
      ? 40
      : status === 'failed' || status === 'local_only'
        ? 10
        : 20;
  return statusScore + (hasRemoteAttachment(msg) ? 20 : 0) + (isSyntheticUploadMessage(msg) ? -100 : 0);
};

const cleanupHistoricalUploadDuplicates = (list: ChatMessage[]): ChatMessage[] => {
  const normalized = list
    .map(dedupeMessageAttachments)
    .filter((msg) => !isSyntheticUploadMessage(msg));

  const kept: ChatMessage[] = [];

  normalized.forEach((msg) => {
    const keys = messageAttachmentKeys(msg);
    if (!keys.length) {
      kept.push(msg);
      return;
    }

    const duplicateIndex = kept.findIndex((candidate) => {
      const candidateKeys = messageAttachmentKeys(candidate);
      if (!candidateKeys.some((key) => keys.includes(key))) return false;
      return isUnsettledLocalMediaMessage(candidate) || isUnsettledLocalMediaMessage(msg);
    });

    if (duplicateIndex < 0) {
      kept.push(msg);
      return;
    }

    const existing = kept[duplicateIndex];
    const existingScore = duplicateMessageScore(existing);
    const nextScore = duplicateMessageScore(msg);
    if (
      nextScore > existingScore ||
      (nextScore === existingScore && messageTimestampMs(msg) >= messageTimestampMs(existing))
    ) {
      kept[duplicateIndex] = msg;
    }
  });

  return kept;
};

function sortMessages(
  list: ChatMessage[],
): ChatMessage[] {
  return [...list].sort((a, b) => {
    const aSeq = typeof a.seq === 'number' ? a.seq : undefined;
    const bSeq = typeof b.seq === 'number' ? b.seq : undefined;

    if (aSeq !== undefined && bSeq !== undefined && aSeq !== bSeq) {
      return aSeq - bSeq;
    }

    const aTs = messageTimestampMs(a);
    const bTs = messageTimestampMs(b);
    if (aTs !== bTs) {
      return aTs - bTs;
    }

    return getIdentityKey(a).localeCompare(
      getIdentityKey(b),
    );
  });
}

function normalizeSender(
  msg: ChatMessage,
  currentUserId: string,
): ChatMessage {
  if (msg.senderId == null) return msg;
  const senderId = String(msg.senderId);
  if (!currentUserId) {
    return { ...msg, senderId };
  }
  const fromMe = senderId !== '' && senderId === String(currentUserId);
  return { ...msg, senderId, fromMe };
}

/* ============================================================================
 * MERGE / DEDUPLICATION
 * ============================================================================
 */

// Merge two message versions without letting a partial server update
// (e.g. a status receipt that lacks rich fields) clobber the locally-stored
// replyTo / sticker / voice / attachments that the full message already has.
function mergePreservingRich(prev: ChatMessage, next: ChatMessage): ChatMessage {
  const merged = { ...prev, ...next } as any;
  const p = prev as any;
  const n = next as any;
  if (!n.replyTo && p.replyTo) merged.replyTo = p.replyTo;
  if (!n.sticker && p.sticker) merged.sticker = p.sticker;
  if (!n.voice && p.voice) merged.voice = p.voice;
  if (!(n.attachments?.length) && p.attachments?.length) merged.attachments = p.attachments;
  if (!n.media && p.media) merged.media = p.media;
  if (!n.poll && p.poll) merged.poll = p.poll;
  if (!n.event && p.event) merged.event = p.event;
  if (!(n.contacts?.length) && p.contacts?.length) merged.contacts = p.contacts;
  if (!n.styledText && p.styledText) merged.styledText = p.styledText;

  const incomingEncrypted = Boolean(n.encryptionMeta ?? n.ciphertext ?? n.encrypted);
  const incomingPlaceholder =
    typeof n.text !== 'string' ||
    n.text.trim() === '' ||
    n.text.trim().toLowerCase() === 'encrypted message';
  if (incomingEncrypted && incomingPlaceholder) {
    if (p.text && p.text !== 'Encrypted message') merged.text = p.text;
    if (p.styledText) merged.styledText = p.styledText;
    if (p.voice) merged.voice = p.voice;
    if (p.sticker) merged.sticker = p.sticker;
    if (p.poll) merged.poll = p.poll;
    if (p.event) merged.event = p.event;
    if (p.contacts?.length) merged.contacts = p.contacts;
    if (p.attachments?.length) merged.attachments = p.attachments;
    if (p.media) merged.media = p.media;
  }

  return merged as ChatMessage;
}

function mergeMessages(
  existing: ChatMessage[],
  incoming: ChatMessage[],
): ChatMessage[] {
  const map = new Map<string, ChatMessage>();
  const byClientId = new Map<string, string>();

  for (const msg of existing) {
    const k = getIdentityKey(msg);
    map.set(k, msg);
    if (msg.clientId) {
      byClientId.set(msg.clientId, k);
    }
  }

  for (const msg of incoming) {
    const key = getIdentityKey(msg);
    let prev = map.get(key);
    let oldKey: string | undefined;

    if (!prev && msg.clientId) {
      const clientKey = byClientId.get(msg.clientId);
      if (clientKey) {
        prev = map.get(clientKey);
        // Track the old key so we can remove it after promotion.
        // Without this, both 'clientId-key' and 'serverId-key' entries
        // remain in the map and render as two identical messages.
        if (prev && clientKey !== key) {
          oldKey = clientKey;
        }
      }
    }

    if (!prev) {
      map.set(key, msg);
      if (msg.clientId) {
        byClientId.set(msg.clientId, key);
      }
      continue;
    }

    // Remove the stale clientId-keyed entry BEFORE writing the serverId-keyed one.
    if (oldKey) {
      map.delete(oldKey);
    }

    if (
      prev.status === STATUS_QUEUED &&
      msg.status === STATUS_SENT
    ) {
      map.set(key, {
        ...mergePreservingRich(prev, msg),
        fromMe: prev.fromMe,
      });
      if (msg.clientId) {
        byClientId.set(msg.clientId, key);
      }
      continue;
    }

    if (msg.serverId) {
      const statusOrder: Record<string, number> = { pending: 0, sending: 0, local_only: 0, sent: 1, delivered: 2, read: 3, failed: -1 };
      const prevRank = statusOrder[prev.status ?? ''] ?? 0;
      const nextRank = statusOrder[msg.status ?? ''] ?? 0;
      const preservedStatus = prevRank >= nextRank ? prev.status : msg.status;
      map.set(key, { ...mergePreservingRich(prev, msg), status: preservedStatus, fromMe: prev.fromMe ?? msg.fromMe });
      if (msg.clientId) {
        byClientId.set(msg.clientId, key);
      }
    }
  }

  return cleanupHistoricalUploadDuplicates(sortMessages(Array.from(map.values())));
}

/* ============================================================================
 * MAIN HOOK
 * ============================================================================
 */

export function useChatPersistence(
  options: UseChatPersistenceOptions,
): UseChatPersistenceResult {
  const {
    roomId,
    currentUserId,
    sendOverNetwork,
  } = options;

  const [messages, setMessages] =
    useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] =
    useState<boolean>(true);

  const messagesRef = useRef<ChatMessage[]>([]);
  const roomIdRef = useRef<string>(roomId);
  const previousRoomIdRef = useRef<string | null>(null);
  const flushInFlightRef = useRef(false);

  /* ------------------------------------------------------------------------
   * REF SYNC
   * --------------------------------------------------------------------- */

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (roomIdRef.current !== roomId) {
      previousRoomIdRef.current = roomIdRef.current;
    }
    roomIdRef.current = roomId;
  }, [roomId, currentUserId]);

  /* ------------------------------------------------------------------------
   * INITIAL LOAD
   * --------------------------------------------------------------------- */

  useEffect(() => {
    let mounted = true;

    setIsLoading(true);
    setMessages([]);

    (async () => {
      try {
        const loaded = await loadMessages(roomId);
        const previousRoomId = previousRoomIdRef.current;
        const migrated =
          previousRoomId && previousRoomId !== roomId
            ? await loadMessages(previousRoomId)
            : [];
        if (!mounted) return;
        const byIdentity = new Map<string, ChatMessage>();
        [...(loaded ?? []), ...(migrated ?? []), ...messagesRef.current].forEach((m) => {
          const convId = m.conversationId ?? m.roomId ?? '';
          const belongsToRoom = String(convId) === String(roomId) || String(m.roomId ?? '') === String(roomId);
          const migratedToRoom = previousRoomId && String(m.roomId ?? '') === String(previousRoomId) && String(convId) === String(roomId);
          if (!belongsToRoom && !migratedToRoom) return;
          const key = String(m.serverId ?? m.id ?? m.clientId ?? `${m.createdAt}-${m.senderId}`);
          byIdentity.set(key, { ...m, roomId, conversationId: m.conversationId ?? roomId });
        });
        const normalized = Array.from(byIdentity.values()).map((m) =>
          normalizeSender(m, currentUserId),
        );
        const sorted = cleanupHistoricalUploadDuplicates(sortMessages(normalized));
        setMessages(sorted);
        if (currentUserId) {
          await saveMessages(roomId, sorted);
        }
      } catch (err) {
        console.warn('[useChatPersistence] load error', err);
        setMessages([]);
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [roomId, currentUserId]);

  /* ------------------------------------------------------------------------
   * PERSIST
   * --------------------------------------------------------------------- */

  const persist = useCallback(
    async (next: ChatMessage[]) => {
      const sorted = cleanupHistoricalUploadDuplicates(sortMessages(next));
      // Update the ref synchronously before the async state update so that any
      // concurrent async operation (e.g. decrypt → patchDecryptedMessage) that
      // reads messagesRef.current immediately after persist() will see the
      // latest list instead of the stale pre-render snapshot.
      messagesRef.current = sorted;
      setMessages(sorted);
      await saveMessages(roomIdRef.current, sorted);
    },
    [],
  );

  /* ------------------------------------------------------------------------
   * SEND RICH MESSAGE
   * --------------------------------------------------------------------- */

  const sendRichMessage = useCallback(
    async (payload: Partial<ChatMessage>) => {
      const hasContent = Boolean(
        normalizeChatSendText(payload.text) ||
          payload.voice ||
          payload.styledText ||
          payload.sticker ||
          payload.poll ||
          payload.event ||
          payload.attachments?.length ||
          payload.contacts?.length,
      );

      if (!hasContent) return;

      const clientId = payload.clientId ?? createClientId();

      const safePayloadText = normalizeChatSendText(payload.text);

      const draft: ChatMessage = {
        // IMPORTANT: id is REQUIRED in your ChatMessage type
        // We map it to clientId for local-only identity
        id: clientId,
        clientId,
        serverId: payload.serverId,
        roomId,
        conversationId: payload.conversationId ?? roomId,
        senderId: currentUserId,
        senderName: payload.senderName,
        fromMe: true,
        createdAt: nowIso(),
        status: STATUS_QUEUED,
        ...payload,
        text: safePayloadText,
      };

      const optimistic = [
        ...messagesRef.current,
        draft,
      ];

      await persist(optimistic);
      markRoomHasPending(roomId).catch(() => {});

      if (!sendOverNetwork) return;

      const sending = optimistic.map((m) =>
        m.clientId === clientId
          ? { ...m, status: 'sending' as MessageStatus }
          : m,
      );
      await persist(sending);

      const result = await sendOverNetwork(draft).catch(
        () => ({ ok: false } as SendOverNetworkNack),
      );

      if (!result.ok) {
        // Offline/socket-unavailable sends remain queued locally. Only a real
        // online NACK/ACK failure should show the user a retry failure state.
        const afterFail = messagesRef.current.map((m) =>
          m.clientId === clientId && m.status !== STATUS_SENT && m.status !== 'delivered' && m.status !== 'read'
            ? { ...m, status: result.queued ? STATUS_QUEUED : STATUS_FAILED, isLocalOnly: true }
            : m,
        );
        await persist(afterFail);
        return;
      }

      // Re-read the LATEST snapshot from the ref — the socket echo-back may have
      // already reconciled this message while we awaited the ACK.  Using the stale
      // `sending` array here would overwrite those changes and cause a duplicate.
      const afterAck = messagesRef.current.map((m) => {
        if (m.clientId !== clientId) return m;
        // If a socket echo already marked this sent/delivered/read, leave it alone.
        if (m.status === STATUS_SENT || m.status === 'delivered' || m.status === 'read') return m;
        return {
          ...m,
          serverId: m.serverId ?? result.serverId,
          seq: typeof result.seq === 'number' ? result.seq : m.seq,
          createdAt: result.createdAt ?? m.createdAt,
          status: STATUS_SENT,
          isLocalOnly: false,
        };
      });

      await persist(afterAck);
    },
    [persist, roomId, currentUserId, sendOverNetwork],
  );

  /* ------------------------------------------------------------------------
   * SEND TEXT
   * --------------------------------------------------------------------- */

  const sendTextMessage = useCallback(
    async (
      text: string,
      extra?: Partial<ChatMessage>,
    ) => {
      const safeText = normalizeChatSendText(text);
      if (!safeText) return;

      await sendRichMessage({
        text: safeText,
        kind: extra?.kind ?? 'text',
        ...extra,
      });
    },
    [sendRichMessage],
  );

  /* ------------------------------------------------------------------------
   * EDIT MESSAGE
   * --------------------------------------------------------------------- */

  const editMessage = useCallback(
    async (
      messageId: string,
      patch: Partial<ChatMessage>,
    ) => {
      const next = messagesRef.current.map((m) =>
        getIdentityKey(m) === messageId
          ? {
              ...m,
              ...patch,
              isEdited: true,
              updatedAt: nowIso(),
              status: STATUS_QUEUED,
            }
          : m,
      );

      await persist(next);
    },
    [persist],
  );

  /* ------------------------------------------------------------------------
   * SOFT DELETE
   * --------------------------------------------------------------------- */

  const softDeleteMessage = useCallback(
    async (messageId: string) => {
      const next = messagesRef.current.map((m) =>
        getIdentityKey(m) === messageId
          ? {
              ...m,
              isDeleted: true,
              text: '',
              styledText: undefined,
              voice: undefined,
              sticker: undefined,
              attachments: [],
              status: STATUS_QUEUED,
            }
          : m,
      );

      await persist(next);
    },
    [persist],
  );

  /* ------------------------------------------------------------------------
   * REPLY
   * --------------------------------------------------------------------- */

  const replyToMessage = useCallback(
    async (
      parent: ChatMessage,
      text: string,
      extra?: Partial<ChatMessage>,
    ) => {
      await sendTextMessage(text, {
        ...extra,
        replyToId: parent.serverId ?? parent.clientId,
      });
    },
    [sendTextMessage],
  );

  /* ------------------------------------------------------------------------
   * FLUSH QUEUE
   * --------------------------------------------------------------------- */

  const attemptFlushQueue = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!sendOverNetwork) return;
      const silent = !!options?.silent;
      if (flushInFlightRef.current) return;
      flushInFlightRef.current = true;

      try {
        // Snapshot the queue to iterate — but always reconcile against
        // messagesRef.current (live) so we never lose messages that arrive
        // via socket while we're awaiting a network call.
        const queue = messagesRef.current
          .filter((m) => m.status === STATUS_QUEUED || m.status === STATUS_FAILED)
          .map((m) => ({ ...m }));

        for (const msg of queue) {
          if (!silent) {
            const marking = messagesRef.current.map((m) =>
              m.clientId === msg.clientId
                ? { ...m, status: 'sending' as MessageStatus }
                : m,
            );
            await persist(marking);
          }

          const result = await sendOverNetwork(msg).catch(
            () => ({ ok: false } as SendOverNetworkNack),
          );

          // Re-read the live ref — incoming socket messages may have arrived
          // during the await and must NOT be overwritten with a stale snapshot.
          const reconciled = messagesRef.current.map((m) => {
            if (m.clientId !== msg.clientId) return m;
            // Already confirmed by an echo-back — don't downgrade.
            if (m.status === STATUS_SENT || m.status === 'delivered' || m.status === 'read') return m;
            return {
              ...m,
              status: result.ok ? STATUS_SENT : result.queued ? STATUS_QUEUED : silent ? m.status : STATUS_FAILED,
              serverId: result.ok ? (m.serverId ?? result.serverId) : m.serverId,
              seq: result.ok && typeof result.seq === 'number' ? result.seq : m.seq,
              createdAt: result.ok && result.createdAt ? result.createdAt : m.createdAt,
              isLocalOnly: result.ok ? false : m.isLocalOnly,
            };
          });
          await persist(reconciled);
        }
        // Unmark room if no messages remain pending/failed after flush
        const hasPending = messagesRef.current.some(
          m => m.status === STATUS_QUEUED || m.status === STATUS_FAILED,
        );
        if (!hasPending) unmarkRoomHasPending(roomIdRef.current).catch(() => {});
      } finally {
        flushInFlightRef.current = false;
      }
    },
    [persist, sendOverNetwork],
  );

  /* ------------------------------------------------------------------------
   * MERGE WS MESSAGES
   * --------------------------------------------------------------------- */

  const replaceMessages = useCallback(
    async (next: ChatMessage[]) => {
      const list = Array.isArray(next) ? next : [];
      const filtered = list.filter((m) => {
        const convId = m.conversationId ?? m.roomId;
        return String(convId ?? '') === String(roomIdRef.current);
      });
      const merged = mergeMessages(
        messagesRef.current,
        filtered,
      );

      await persist(merged);
    },
    [persist],
  );

  /* ------------------------------------------------------------------------
   * API
   * --------------------------------------------------------------------- */

  return {
    messages,
    isLoading,
    sendTextMessage,
    sendRichMessage,
    editMessage,
    softDeleteMessage,
    replyToMessage,
    attemptFlushQueue,
    replaceMessages,
    retryMessage: async (messageId: string) => {
      const next = messagesRef.current.map((m) =>
        getIdentityKey(m) === messageId
          ? { ...m, status: STATUS_QUEUED, isLocalOnly: true }
          : m,
      );
      await persist(next);
      await attemptFlushQueue();
    },
  };
}
