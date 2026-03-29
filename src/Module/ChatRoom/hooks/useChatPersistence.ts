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

import {
  loadMessages,
  saveMessages,
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

  attemptFlushQueue: () => Promise<void>;

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

function sortMessages(
  list: ChatMessage[],
): ChatMessage[] {
  const getTimestampMs = (msg: ChatMessage): number => {
    if (typeof msg.createdAt === 'number') return msg.createdAt;
    if (typeof msg.createdAt !== 'string') return 0;
    const parsed = Date.parse(msg.createdAt);
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  return [...list].sort((a, b) => {
    const aSeq = typeof a.seq === 'number' ? a.seq : undefined;
    const bSeq = typeof b.seq === 'number' ? b.seq : undefined;

    if (aSeq !== undefined && bSeq !== undefined && aSeq !== bSeq) {
      return aSeq - bSeq;
    }

    const aTs = getTimestampMs(a);
    const bTs = getTimestampMs(b);
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
  const fromMe =
    senderId !== '' && senderId === String(currentUserId);
  return { ...msg, senderId, fromMe };
}

/* ============================================================================
 * MERGE / DEDUPLICATION
 * ============================================================================
 */

function mergeMessages(
  existing: ChatMessage[],
  incoming: ChatMessage[],
): ChatMessage[] {
  const map = new Map<string, ChatMessage>();
  const byClientId = new Map<string, string>();

  for (const msg of existing) {
    map.set(getIdentityKey(msg), msg);
    if (msg.clientId) {
      byClientId.set(msg.clientId, getIdentityKey(msg));
    }
  }

  for (const msg of incoming) {
    const key = getIdentityKey(msg);
    let prev = map.get(key);
    if (!prev && msg.clientId) {
      const clientKey = byClientId.get(msg.clientId);
      if (clientKey) {
        prev = map.get(clientKey);
      }
    }

    if (!prev) {
      map.set(key, msg);
      if (msg.clientId) {
        byClientId.set(msg.clientId, key);
      }
      continue;
    }

    if (
      prev.status === STATUS_QUEUED &&
      msg.status === STATUS_SENT
    ) {
      map.set(key, {
        ...prev,
        ...msg,
        fromMe: prev.fromMe,
      });
      continue;
    }

    if (msg.serverId) {
      map.set(key, { ...prev, ...msg });
      if (msg.clientId) {
        byClientId.set(msg.clientId, key);
      }
    }
  }

  return sortMessages(Array.from(map.values()));
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
  const flushInFlightRef = useRef(false);

  /* ------------------------------------------------------------------------
   * REF SYNC
   * --------------------------------------------------------------------- */

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
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
        if (!mounted) return;
        const filtered = (loaded ?? []).filter((m) => {
          const convId = m.conversationId ?? m.roomId ?? '';
          return String(convId) === String(roomId);
        });
        const normalized = filtered.map((m) =>
          normalizeSender(m, currentUserId),
        );
        const sorted = sortMessages(normalized);
        setMessages(sorted);
        await saveMessages(roomId, sorted);
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
      const sorted = sortMessages(next);
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
        payload.text?.trim() ||
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
      };

      const optimistic = [
        ...messagesRef.current,
        draft,
      ];

      await persist(optimistic);

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
        const failed = sending.map((m) =>
          m.clientId === clientId
            ? {
                ...m,
                status: STATUS_FAILED,
                isLocalOnly: true,
              }
            : m,
        );
        await persist(failed);
        return;
      }

      const reconciled = sending.map((m) =>
        m.clientId === clientId
          ? {
              ...m,
              serverId: result.serverId,
              seq: typeof result.seq === 'number' ? result.seq : m.seq,
              createdAt: result.createdAt ?? m.createdAt,
              status: STATUS_SENT,
              isLocalOnly: false,
            }
          : m,
      );

      await persist(reconciled);
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
      if (!text.trim()) return;

      await sendRichMessage({
        text: text.trim(),
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
    async () => {
      if (!sendOverNetwork) return;
      if (flushInFlightRef.current) return;
      flushInFlightRef.current = true;

      try {
        let next = [...messagesRef.current];

        for (const msg of next) {
          if (
            msg.status !== STATUS_QUEUED &&
            msg.status !== STATUS_FAILED
          ) {
            continue;
          }

          const sending = next.map((m) =>
            m.clientId === msg.clientId
              ? { ...m, status: 'sending' as MessageStatus }
              : m,
          );
          await persist(sending);

          const result = await sendOverNetwork(msg).catch(
            () => ({ ok: false } as SendOverNetworkNack),
          );

          next = sending.map((m) =>
            m.clientId === msg.clientId
              ? {
                  ...m,
                status: result.ok
                  ? STATUS_SENT
                  : STATUS_FAILED,
                serverId:
                  result.ok
                    ? result.serverId
                    : m.serverId,
                seq:
                  result.ok && typeof result.seq === 'number'
                    ? result.seq
                    : m.seq,
                createdAt:
                  result.ok && result.createdAt
                    ? result.createdAt
                    : m.createdAt,
                isLocalOnly: !result.ok,
              }
            : m,
        );
        }

        await persist(next);
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
    },
  };
}
