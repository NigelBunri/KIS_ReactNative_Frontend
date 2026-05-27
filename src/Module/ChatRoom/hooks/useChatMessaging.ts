// src/screens/chat/hooks/useChatMessaging.ts

// E2EE is deferred until key exchange protocol is validated end-to-end. Messages use server-side encryption via TLS. Flip to true when crypto module passes integration tests.
const E2EE_ENABLED = true;

import {
  useCallback,
  useEffect,
  useRef,
} from 'react';
import type { MutableRefObject } from 'react';
import { AppState, DeviceEventEmitter } from 'react-native';
import { onNetworkRecovery } from '@/services/networkMonitor';

import {
  SendOverNetworkResult,
  useChatPersistence,
  type SendOverNetworkFn,
} from './useChatPersistence';
import { bulkUpdateMessages } from '../Storage/chatStorage';

import type {
  ChatMessage,
  ChatRoomPageProps,
  MessageKind,
  MessageStatus,
} from '../chatTypes';
import { participantsToIds } from '../messagesUtils';

import { useSocket } from '../../../../SocketProvider';
import {
  ENCRYPTION_VERSION,
  decryptConversationPayload,
  preloadConversationKey,
} from '@/security/customE2EE';
import {
  decryptFromUser,
  ensureDeviceId,
  encryptPayloadForRecipients,
} from '@/security/e2ee';

/* ========================================================================
 * TYPES
 * ===================================================================== */

type ChatType = ChatRoomPageProps['chat'];

type UseChatMessagingParams = {
  chat: ChatType | undefined;
  storageRoomId: string | number;
  currentUserId: string;
  currentUserName: string | null;
  conversationId: string | null;
};

/* ========================================================================
 * HOOK
 * ===================================================================== */

export function useChatMessaging({
  chat,
  storageRoomId,
  currentUserId,
  currentUserName: _currentUserName,
  conversationId,
}: UseChatMessagingParams) {
  /* ---------------------------------------------------------------------
   * SOCKET
   * ------------------------------------------------------------------ */

  const { socket, isConnected } = useSocket();

  /* ---------------------------------------------------------------------
   * MOUNTED GUARD
   * ------------------------------------------------------------------ */

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  /* ---------------------------------------------------------------------
   * SEND IMPLEMENTATION REF
   * ------------------------------------------------------------------ */

  const sendOverNetworkImplRef =
    useRef<SendOverNetworkFn | null>(null);
  const historySyncRef = useRef<number>(0);
  const flushInFlightRef = useRef(false);
  const historyLoadRef = useRef(false);

  const sendOverNetwork: SendOverNetworkFn =
  useCallback(async (message) => {
    const impl = sendOverNetworkImplRef.current;

    if (!impl) {
      console.warn(
        '[useChatMessaging] send impl not ready',
      );
      return { ok: false };
    }

    return impl(message);
  }, []);


  /* ---------------------------------------------------------------------
   * CHAT PERSISTENCE
   * ------------------------------------------------------------------ */

  const {
    messages,
    isLoading,
    sendTextMessage,
    sendRichMessage,
    editMessage,
    softDeleteMessage,
    replyToMessage,
    attemptFlushQueue,
    replaceMessages,
    retryMessage,
  } = useChatPersistence({
    roomId: String(storageRoomId),
    currentUserId,
    sendOverNetwork,
  });

  /* ---------------------------------------------------------------------
   * REFS (AVOID STALE CLOSURES)
   * ------------------------------------------------------------------ */

  const messagesRef: MutableRefObject<
    ChatMessage[]
  > = useRef(messages);
  const deviceIdRef = useRef<string | null>(null);
  // Tracks whether the initial full-history load has run for the current conversation.
  // Reconnects reuse syncHistory (delta) rather than re-fetching all history.
  const hasInitialLoadRef = useRef(false);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const conversationIdRef =
    useRef<string | null>(conversationId);
  useEffect(() => {
    if (conversationIdRef.current !== conversationId) {
      // New conversation — allow full history load for this room.
      hasInitialLoadRef.current = false;
    }
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  const replaceMessagesRef = useRef(replaceMessages);
  useEffect(() => { replaceMessagesRef.current = replaceMessages; }, [replaceMessages]);

  useEffect(() => {
    ensureDeviceId()
      .then((value) => {
        deviceIdRef.current = value;
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!conversationId) return;
    preloadConversationKey(conversationId);
  }, [conversationId]);

  const resolveServerId = useCallback(
    (id: string) => {
      const msg = messagesRef.current.find(
        (m) => m.id === id || m.clientId === id,
      );
      return msg?.serverId;
    },
    [],
  );

  const normalizeReactions = useCallback((input: any) => {
    if (!input) return undefined;
    if (Array.isArray(input)) {
      return input.reduce((acc: Record<string, string[]>, item: any) => {
        const emoji = item?.emoji;
        const userId = item?.userId;
        if (!emoji || !userId) return acc;
        if (!acc[emoji]) acc[emoji] = [];
        if (!acc[emoji].includes(userId)) {
          acc[emoji].push(userId);
        }
        return acc;
      }, {});
    }
    if (typeof input === 'object') {
      return input as Record<string, string[]>;
    }
    return undefined;
  }, []);

  const patchDecryptedMessage = useCallback(
    (messageId: string, patch: Partial<ChatMessage>) => {
      if (!mountedRef.current) return;
      const next = messagesRef.current.map((message) =>
        message.serverId === messageId || message.id === messageId
          ? { ...message, ...patch }
          : message,
      );
      replaceMessages(next);
    },
    [replaceMessages],
  );

  const decryptChatMessage = useCallback(
    async (mapped: ChatMessage) => {
      const encMeta = mapped.encryptionMeta;
      if (!encMeta && !mapped.ciphertext) return;

      try {
        if (encMeta?.e2ee === 'signal') {
          const senderDeviceId = encMeta?.senderDeviceId ?? encMeta?.deviceId ?? '';
          const recipients = Array.isArray(encMeta?.recipients) ? encMeta.recipients : [];
          const recipientCipher = recipients.find(
            (item: any) =>
              String(item?.userId) === String(currentUserId) &&
              (!deviceIdRef.current || String(item?.deviceId) === String(deviceIdRef.current)),
          ) ?? recipients.find((item: any) => String(item?.userId) === String(currentUserId));

          const ciphertext = recipientCipher?.ciphertext ?? mapped.ciphertext;
          const type = recipientCipher?.type ?? encMeta?.type ?? 1;
          if (!mapped.senderId || !senderDeviceId || !ciphertext) return;

          const plaintext = await decryptFromUser(
            String(mapped.senderId),
            String(senderDeviceId),
            String(ciphertext),
            Number(type),
          );
          let parsed: any = null;
          try {
            parsed = JSON.parse(plaintext);
          } catch {}
          patchDecryptedMessage(String(mapped.serverId ?? mapped.id), {
            text: parsed?.text ?? plaintext,
            styledText: parsed?.styledText ?? mapped.styledText,
            attachments: parsed?.attachments ?? mapped.attachments,
            contacts: parsed?.contacts ?? mapped.contacts,
            poll: parsed?.poll ?? mapped.poll,
            event: parsed?.event ?? mapped.event,
            voice: parsed?.voice ?? mapped.voice,
            sticker: parsed?.sticker ?? mapped.sticker,
            replyToId: parsed?.replyToId ?? mapped.replyToId,
            kind: parsed?.kind ?? mapped.kind,
          });
          return;
        }

        if (
          mapped.encryptionVersion === ENCRYPTION_VERSION &&
          mapped.ciphertext &&
          mapped.iv &&
          mapped.tag &&
          mapped.conversationId
        ) {
          const plaintext = await decryptConversationPayload(
            String(mapped.conversationId),
            String(mapped.ciphertext),
            String(mapped.iv),
            String(mapped.tag),
            mapped.aad,
            mapped.encryptionKeyVersion,
          );
          let parsed: any = null;
          try {
            parsed = JSON.parse(plaintext);
          } catch {}
          patchDecryptedMessage(String(mapped.serverId ?? mapped.id), {
            text: parsed?.text ?? plaintext,
            styledText: parsed?.styledText ?? mapped.styledText,
            attachments: parsed?.attachments ?? mapped.attachments,
            contacts: parsed?.contacts ?? mapped.contacts,
            poll: parsed?.poll ?? mapped.poll,
            event: parsed?.event ?? mapped.event,
            voice: parsed?.voice ?? mapped.voice,
            sticker: parsed?.sticker ?? mapped.sticker,
            replyToId: parsed?.replyToId ?? mapped.replyToId,
            kind: parsed?.kind ?? mapped.kind,
          });
        }
      } catch (error) {
        console.warn('[useChatMessaging] decrypt failed', error);
      }
    },
    [currentUserId, patchDecryptedMessage],
  );

  // Stable refs so the socket listener effect doesn't re-subscribe on every render
  const decryptChatMessageRef = useRef(decryptChatMessage);
  useEffect(() => { decryptChatMessageRef.current = decryptChatMessage; });

  const mapServerMessage = useCallback(
    (serverMsg: any): ChatMessage => {
      const mapAttachments = (list: any[]) =>
        list.map((raw) => {
          const a = raw?.attachment ?? raw ?? {};
          return {
            id: a.id ?? a.key,
            url: a.url ?? a.uri,
            originalName: a.originalName ?? a.name ?? a.filename,
            mimeType: a.mimeType ?? a.mime ?? a.contentType,
            size: a.size ?? a.sizeBytes,
            kind: a.kind,
            width: a.width,
            height: a.height,
            durationMs: a.durationMs,
            thumbUrl: a.thumbUrl,
          };
        });

      const rawSenderId =
        serverMsg.senderId ??
        serverMsg.sender_id ??
        serverMsg.sender?.id ??
        serverMsg.userId ??
        serverMsg.user_id;
      const senderId = rawSenderId != null ? String(rawSenderId) : '';

      const normalizedConversationId =
        serverMsg.conversationId ??
        serverMsg.conversation_id ??
        conversationId ??
        String(storageRoomId);

      const styledText =
        serverMsg.styledText ?? serverMsg.styled_text ?? null;

      const contacts =
        Array.isArray(serverMsg.contacts)
          ? serverMsg.contacts.map((c: any, idx: number) => ({
              id: String(c?.id ?? c?.phone ?? `contact_${idx + 1}`),
              name: String(c?.name ?? c?.display_name ?? c?.phone ?? 'Contact'),
              phone: String(c?.phone ?? c?.phoneNumber ?? ''),
            }))
          : undefined;

      const poll =
        serverMsg.poll && typeof serverMsg.poll === 'object'
          ? {
              id: serverMsg.poll.id ?? undefined,
              question: String(serverMsg.poll.question ?? ''),
              allowMultiple: !!serverMsg.poll.allowMultiple,
              expiresAt: serverMsg.poll.expiresAt ?? null,
              options: Array.isArray(serverMsg.poll.options)
                ? serverMsg.poll.options.map((opt: any, idx: number) => ({
                    id: String(opt?.id ?? `opt_${idx + 1}`),
                    text: String(opt?.text ?? opt?.label ?? ''),
                    votes:
                      typeof opt?.votes === 'number' ? opt.votes : undefined,
                  }))
                : [],
            }
          : undefined;

      const rawEvent =
        serverMsg.event ?? serverMsg.event_data ?? serverMsg.eventData ?? null;
      const event =
        rawEvent && typeof rawEvent === 'object'
          ? {
              id: rawEvent.id ?? undefined,
              title: String(rawEvent.title ?? ''),
              description:
                rawEvent.description != null
                  ? String(rawEvent.description)
                  : undefined,
              location:
                rawEvent.location != null
                  ? String(rawEvent.location)
                  : undefined,
              startsAt:
                rawEvent.startsAt ??
                (rawEvent.date && rawEvent.time
                  ? `${rawEvent.date}T${rawEvent.time}:00`
                  : undefined),
              endsAt:
                rawEvent.endsAt ??
                (rawEvent.endDate && rawEvent.endTime
                  ? `${rawEvent.endDate}T${rawEvent.endTime}:00`
                  : undefined),
              reminderMinutes:
                typeof rawEvent.reminderMinutes === 'number'
                  ? rawEvent.reminderMinutes
                  : undefined,
            }
          : undefined;

      const rawCiphertext = serverMsg.ciphertext ?? undefined;
      const hasEncryptedMeta = !!(serverMsg.encryptionMeta ?? serverMsg.encryption_meta);
      const text =
        serverMsg.text ??
        serverMsg.previewText ??
        serverMsg.preview_text ??
        (rawCiphertext || hasEncryptedMeta ? 'Encrypted message' : '');

      return {
        id: serverMsg.id ?? serverMsg._id,
        clientId: serverMsg.clientId,
        serverId: serverMsg.id ?? serverMsg._id,
        seq: typeof serverMsg.seq === 'number' ? serverMsg.seq : undefined,
        conversationId: normalizedConversationId,
        senderId,
        senderName: serverMsg.senderName,
        text,
        kind: (serverMsg.kind as MessageKind) ?? 'text',
        createdAt:
          serverMsg.createdAt ??
          serverMsg.created_at ??
          new Date().toISOString(),
        attachments: serverMsg.attachments
          ? mapAttachments(serverMsg.attachments)
          : [],
        replyToId: serverMsg.replyToId ?? null,
        status: (
          serverMsg.status === 'read' ? 'read' :
          serverMsg.status === 'delivered' ? 'delivered' :
          serverMsg.status === 'sent' ? 'sent' :
          'sent'
        ) as MessageStatus,
        roomId: String(storageRoomId),
        fromMe: senderId !== '' && senderId === String(currentUserId),
        reactions: normalizeReactions(serverMsg.reactions),
        ciphertext: rawCiphertext,
        encryptionMeta: serverMsg.encryptionMeta ?? serverMsg.encryption_meta ?? undefined,
        iv: serverMsg.iv ?? undefined,
        tag: serverMsg.tag ?? undefined,
        aad: serverMsg.aad ?? undefined,
        encryptionVersion: serverMsg.encryptionVersion ?? undefined,
        encryptionKeyVersion: serverMsg.encryptionKeyVersion ?? undefined,
        styledText: styledText ?? undefined,
        contacts,
        poll,
        event,
      };
    },
    [storageRoomId, currentUserId, normalizeReactions, conversationId],
  );

  const mapServerMessageRef = useRef(mapServerMessage);
  useEffect(() => { mapServerMessageRef.current = mapServerMessage; });

  const normalizeReactionsRef = useRef(normalizeReactions);
  useEffect(() => { normalizeReactionsRef.current = normalizeReactions; });

  /* ---------------------------------------------------------------------
   * JOIN / LEAVE CONVERSATION
   * ------------------------------------------------------------------ */

  const joinConversation = useCallback(
    (convId?: string | null) => {
      if (!socket || !(isConnected || socket.connected) || !convId)
        return;

      socket.emit('chat.join', {
        conversationId: String(convId),
      });

      // Mark conversation as read when joining — send a receipt for the last
      // message from another user so the server updates unread counts.
      const msgs = messagesRef.current;
      if (msgs.length > 0) {
        const lastMsg = msgs[msgs.length - 1];
        if (lastMsg?.serverId && lastMsg.senderId !== currentUserId) {
          socket.emit('chat.receipt', {
            conversationId: String(convId),
            messageId: lastMsg.serverId,
            status: 'read',
          });
        }
      }
    },
    [socket, isConnected, currentUserId],
  );

  const leaveConversation = useCallback(
    (convId?: string | null) => {
      if (!socket || !convId) return;

      socket.emit('chat.leave', {
        conversationId: String(convId),
      });
    },
    [socket],
  );

  const requestHistory = useCallback(
    (input: { after?: string; before?: string; limit?: number }) => {
      if (!socket || !(isConnected || socket.connected) || !conversationId) return;
      socket.timeout(15000).emit(
        'chat.history',
        {
          conversationId: String(conversationId),
          limit: input.limit,
          after: input.after,
          before: input.before,
        },
        async (err: any, ack?: any) => {
          if (err || !ack?.ok) return;
          const items = Array.isArray(ack?.data?.messages) ? ack.data.messages : [];
          if (!items.length) return;
          const mapped = items.map((m: any) => mapServerMessage(m));
          // Await so messagesRef is current before decryption reads it.
          await replaceMessages(mapped);
          mapped.forEach((message: ChatMessage) => {
            void decryptChatMessage(message);
          });
        },
      );
    },
    [socket, isConnected, conversationId, replaceMessages, mapServerMessage, decryptChatMessage],
  );

  const requestHistoryBatch = useCallback(
    (input: { before?: string; limit?: number }) =>
      new Promise<any[]>((resolve) => {
        if (!socket || !(isConnected || socket.connected) || !conversationId) {
          resolve([]);
          return;
        }
        socket.timeout(15000).emit(
          'chat.history',
          {
            conversationId: String(conversationId),
            limit: input.limit,
            before: input.before,
          },
          (err: any, ack?: any) => {
            if (err || !ack?.ok) return resolve([]);
            const items = Array.isArray(ack?.data?.messages) ? ack.data.messages : [];
            resolve(items);
          },
        );
      }),
    [socket, isConnected, conversationId],
  );

  const loadFullHistory = useCallback(async () => {
    if (historyLoadRef.current) return;
    historyLoadRef.current = true;

    try {
      let before: string | undefined;
      let rounds = 0;
      let all: ChatMessage[] = [];
      // Cap at 5 rounds (500 messages) — enough history for most conversations
      // without hammering a slow network with 4000-message fetches on first open.
      while (rounds < 5) {
        const items = await requestHistoryBatch({ before, limit: 100 });
        if (!items.length) break;
        const mapped = items.map((m: any) => mapServerMessage(m));
        all = [...mapped, ...all];
        const oldest = items[0]?.createdAt ?? items[0]?.created_at;
        if (!oldest || oldest === before) break;
        before = oldest;
        rounds += 1;
      }
      if (all.length) {
        // Await so messagesRef is current before decryption patches run.
        await replaceMessages(all);
        all.forEach((message: ChatMessage) => {
          void decryptChatMessage(message);
        });
      }
    } finally {
      historyLoadRef.current = false;
    }
  }, [requestHistoryBatch, replaceMessages, mapServerMessage, decryptChatMessage]);

  const syncHistory = useCallback(() => {
    const now = Date.now();
    if (now - historySyncRef.current < 3000) return;
    historySyncRef.current = now;

    const convId = conversationIdRef.current ?? conversationId;
    if (!convId) return;

    const byCreatedAt = (a: string, b: string) =>
      Date.parse(a) - Date.parse(b);

    const validServerMessages = messagesRef.current
      .filter((m) => m.conversationId === convId)
      .filter((m) => m.serverId && !m.isLocalOnly)
      .map((m) => m.createdAt)
      .filter((value) => typeof value === 'string' && !Number.isNaN(Date.parse(value)));

    const lastLocal =
      (validServerMessages.length
        ? validServerMessages.sort(byCreatedAt).slice(-1)[0]
        : undefined) ??
      messagesRef.current
        .filter((m) => m.conversationId === convId)
        .map((m) => m.createdAt)
        .filter((value) => typeof value === 'string' && !Number.isNaN(Date.parse(value)))
        .sort(byCreatedAt)
        .slice(-1)[0];

    if (lastLocal) {
      requestHistory({ after: lastLocal, limit: 200 });
      requestHistory({ before: lastLocal, limit: 50 });
      return;
    }

    requestHistory({ limit: 50 });
  }, [conversationId, requestHistory]);

  const markMessagesRead = useCallback(
    async (messageIds: string[]) => {
      if (!socket || !conversationId || !messageIds.length) return;
      const roomId = String(storageRoomId);
      const idSet = new Set(messageIds.map((id) => String(id)));
      const unread = messagesRef.current.filter((m) => {
        const msgId = (m as any).serverId ?? m.id ?? (m as any).clientId;
        return (
          !m.fromMe &&
          m.conversationId === conversationId &&
          m.status !== 'read' &&
          msgId != null &&
          idSet.has(String(msgId))
        );
      });

      if (!unread.length) return;

      for (const msg of unread) {
        if (!msg.serverId) continue;
        socket.emit('chat.receipt', {
          conversationId,
          messageId: msg.serverId,
          type: 'read',
        });
      }

      const updated = await bulkUpdateMessages(roomId, (m) => {
        const msgId = (m as any).serverId ?? m.id ?? (m as any).clientId;
        if (
          m.fromMe ||
          m.conversationId !== conversationId ||
          m.status === 'read' ||
          msgId == null ||
          !idSet.has(String(msgId))
        ) {
          return m;
        }
        return { ...m, status: 'read' };
      });
      replaceMessages(updated);
      DeviceEventEmitter.emit('conversation.read', {
        conversationId,
        readCount: unread.length,
      });
    },
    [socket, conversationId, storageRoomId, replaceMessages],
  );

  useEffect(() => {
    if (!socket || !(isConnected || socket.connected) || !conversationId)
      return;

    joinConversation(conversationId);
    syncHistory();

    // Full history only on first open — reconnects use syncHistory (delta only).
    if (!hasInitialLoadRef.current) {
      hasInitialLoadRef.current = true;
      loadFullHistory();
    }

    return () => {
      leaveConversation(conversationId);
    };
  }, [
    socket,
    isConnected,
    conversationId,
    joinConversation,
    leaveConversation,
    replaceMessages,
    mapServerMessage,
    storageRoomId,
    syncHistory,
    loadFullHistory,
  ]);

  /* ---------------------------------------------------------------------
   * SEND MESSAGE TO BACKEND (CORE FIX)
   * ------------------------------------------------------------------ */

  const sendOverNetworkImpl =
  useCallback<SendOverNetworkFn>(
    async (message) => {
      if (__DEV__) console.log('[chat.send.debug] start', {
        socketReady: !!socket,
        connected: !!(socket && (isConnected || socket.connected)),
        messageId: message.id,
        clientId: message.clientId,
        conversationId: message.conversationId ?? conversationId ?? storageRoomId,
        status: message.status,
        kind: message.kind,
        hasText: typeof message.text === 'string' && message.text.length > 0,
        participantCount: Array.isArray(chat?.participants) ? chat.participants.length : 0,
      });

      // Socket not ready → keep message queued locally
      if (!socket || !(isConnected || socket.connected) || !chat) {
        if (__DEV__) console.log('[sendOverNetworkImpl] socket not ready → queue');
        return { ok: false };
      }

      const convId =
        message.conversationId ??
        conversationId ??
        String(storageRoomId);

      if (!convId) {
        return { ok: false };
      }

      // clientId is REQUIRED by ChatMessage type
      const clientId = message.clientId;

      const normalizeAttachments = (attachments: any[]) =>
        attachments.map((a) => ({
          id: a.id,
          url: a.url,
          originalName: a.originalName ?? a.name,
          mimeType: a.mimeType ?? a.mime,
          size: a.size,
          kind: a.kind,
          width: a.width,
          height: a.height,
          durationMs: a.durationMs,
          thumbUrl: a.thumbUrl,
        }));

      const normalizeContacts = (list: any[] | undefined) =>
        Array.isArray(list)
          ? list.map((c, idx) => ({
              id: String(c?.id ?? c?.phone ?? `contact_${idx + 1}`),
              name: String(c?.name ?? c?.display_name ?? c?.phone ?? 'Contact'),
              phone: String(c?.phone ?? c?.phoneNumber ?? ''),
            }))
          : undefined;

      const normalizePoll = (input: any) => {
        if (!input || typeof input !== 'object') return undefined;
        const options = Array.isArray(input.options)
          ? input.options.map((opt: any, idx: number) => {
              if (typeof opt === 'string') {
                return { id: `opt_${idx + 1}`, text: opt };
              }
              return {
                id: String(opt?.id ?? `opt_${idx + 1}`),
                text: String(opt?.text ?? opt?.label ?? ''),
                votes:
                  typeof opt?.votes === 'number' ? opt.votes : undefined,
              };
            })
          : [];
        return {
          id: input.id ?? undefined,
          question: String(input.question ?? ''),
          options,
          allowMultiple: !!input.allowMultiple,
          expiresAt: input.expiresAt ?? null,
        };
      };

      const basePayload: any = {
        conversationId: String(convId),
        kind: (message.kind as MessageKind) ?? 'text',
        clientId,
        text: message.text ?? message.styledText?.text ?? undefined,
        previewText:
          typeof (message.text ?? message.styledText?.text) === 'string'
            ? String(message.text ?? message.styledText?.text).slice(0, 200)
            : undefined,
        replyToId: message.replyToId ?? null,
        attachments: message.attachments ? normalizeAttachments(message.attachments) : undefined,
        contacts: normalizeContacts(message.contacts),
        poll: normalizePoll(message.poll),
        event: message.event ?? undefined,
        styledText: message.styledText ?? null,
        sticker: message.sticker ?? null,
        voice: message.voice
          ? {
              ...message.voice,
              url: (message.voice as any).url ?? (message.voice as any).uri,
            }
          : null,
      };

      let payloadToSend: any;
      if (E2EE_ENABLED && Array.isArray((chat as any)?.participants)) {
        const recipientIds = ((chat as any).participants as any[])
          .map((p: any) => String(p?.userId ?? p?.user_id ?? p?.id ?? ''))
          .filter(Boolean)
          .filter((uid: string) => uid !== String(currentUserId));
        if (recipientIds.length > 0) {
          try {
            const { encryptionMeta } = await encryptPayloadForRecipients(
              String(currentUserId),
              recipientIds,
              basePayload,
            );
            payloadToSend = {
              conversationId: String(convId),
              clientId,
              kind: basePayload.kind,
              previewText: basePayload.previewText,
              encrypted: true,
              encryptionMeta,
            };
          } catch (encryptErr) {
            console.warn('[E2EE] encryption failed, falling back to unencrypted', encryptErr);
            payloadToSend = { ...basePayload, encrypted: false, encryptionMeta: undefined };
          }
        } else {
          payloadToSend = { ...basePayload, encrypted: false, encryptionMeta: undefined };
        }
      } else {
        payloadToSend = { ...basePayload, encrypted: false, encryptionMeta: undefined };
      }

      return new Promise<SendOverNetworkResult>(
        (resolve) => {
          // 20 s timeout — give slow 2G/3G networks time to acknowledge.
          // At 5 s the timeout fires before the server can respond on lossy networks,
          // causing messages to flip to 'failed' even though they were delivered.
          socket
            .timeout(20000)
            .emit(
            'chat.send',
            payloadToSend,
              (
                err: any,
                ack?: any,
              ) => {
                if (err) {
                  if (__DEV__) console.warn('[chat.send.debug] socket ack timeout/error', {
                    conversationId: payloadToSend?.conversationId,
                    clientId,
                    err,
                  });
                  return resolve({ ok: false });
                }

                const success = ack?.ok === true;

                if (!success) {
                  if (__DEV__) console.warn('[chat.send.debug] ACK failed', {
                    conversationId: payloadToSend?.conversationId,
                    clientId,
                    ack,
                  });
                  return resolve({ ok: false });
                }

                const ackPayload =
                  ack?.data?.ack ?? ack?.ack ?? null;
                const serverId =
                  ackPayload?.serverId ?? ack?.serverId ?? ack?.id;

                if (!serverId) {
                  if (__DEV__) console.warn('[chat.send] ACK missing serverId', ack);
                  return resolve({ ok: false });
                }

                if (__DEV__) console.log('[chat.send.debug] ACK success', {
                  conversationId: payloadToSend?.conversationId,
                  clientId,
                  serverId,
                  seq: ackPayload?.seq,
                });

                resolve({
                  ok: true,
                  serverId,
                  createdAt: ackPayload?.createdAt,
                  seq: typeof ackPayload?.seq === 'number' ? ackPayload.seq : undefined,
                });
              },
            );
        },
      );
    },
    [
      socket,
      isConnected,
      chat,
      currentUserId,
      conversationId,
      storageRoomId,
    ],
  );


  useEffect(() => {
    sendOverNetworkImplRef.current =
      sendOverNetworkImpl;
  }, [sendOverNetworkImpl]);

  /* ---------------------------------------------------------------------
   * FLUSH QUEUE WHEN SOCKET CONNECTS (🔥 FIX)
   * ------------------------------------------------------------------ */

  useEffect(() => {
    if (!socket || !(isConnected || socket.connected)) return;

    if (__DEV__) console.log('[useChatMessaging] socket connected → flush queue');
    attemptFlushQueue({ silent: true });
    syncHistory();
  }, [socket, isConnected, attemptFlushQueue, syncHistory]);

  useEffect(() => {
    if (!socket || !(isConnected || socket.connected)) return;

    const interval = setInterval(() => {
      if (flushInFlightRef.current) return;
      const hasQueued = messagesRef.current.some(
        (m) => m.status === 'pending' || m.status === 'failed',
      );
      if (!hasQueued) return;
      attemptFlushQueue({ silent: true }).catch(() => {});
    }, 4000); // Check every 4 s instead of 8 s — faster recovery on slow networks

    return () => clearInterval(interval);
  }, [socket, isConnected, attemptFlushQueue]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      if (!socket || !(isConnected || socket.connected)) return;
      attemptFlushQueue({ silent: true });
    });
    return () => sub.remove();
  }, [socket, isConnected, attemptFlushQueue, syncHistory]);

  // Flush immediately when network comes back — before the socket reconnects
  // so the socket-reconnect flush doesn't have to wait for the backoff timer.
  const attemptFlushQueueRef = useRef(attemptFlushQueue);
  useEffect(() => { attemptFlushQueueRef.current = attemptFlushQueue; }, [attemptFlushQueue]);

  useEffect(() => {
    const unsub = onNetworkRecovery(() => {
      attemptFlushQueueRef.current({ silent: true }).catch(() => {});
    });
    return unsub;
  }, []);

  /* ---------------------------------------------------------------------
   * RECEIVE REALTIME MESSAGES
   * ------------------------------------------------------------------ */

  useEffect(() => {
    if (!socket) return;

    const onIncomingMessage = async (
      serverMsg: any,
    ) => {
      const activeConv = conversationIdRef.current;

      if (
        !activeConv ||
        String(serverMsg.conversationId) !== String(activeConv)
      ) {
        return;
      }

      const incomingServerId = serverMsg.id ?? serverMsg._id;
      const matchIndex = messagesRef.current.findIndex((m) => {
        if (serverMsg.clientId && m.clientId && m.clientId === serverMsg.clientId) return true;
        if (incomingServerId && m.serverId && m.serverId === incomingServerId) return true;
        if (
          !serverMsg.clientId &&
          String(serverMsg.senderId ?? serverMsg.sender_id ?? '') === String(currentUserId) &&
          m.fromMe &&
          (m.status === 'pending' || m.status === 'sending')
        ) return true;
        return false;
      });

      if (matchIndex >= 0) {
        const next = messagesRef.current.map((m, idx) =>
          idx === matchIndex
            ? {
                ...m,
                serverId: serverMsg.id ?? serverMsg._id ?? m.serverId,
                status: 'sent' as MessageStatus,
                isLocalOnly: false,
              }
            : m,
        );
        await replaceMessagesRef.current(next);
        return;
      }

      const msg = mapServerMessageRef.current(serverMsg);

      if (!msg.fromMe && msg.serverId) {
        try {
          socket.emit('chat.receipt', {
            conversationId: String(msg.conversationId),
            messageId: msg.serverId,
            type: 'delivered',
          });
        } catch (err: any) {
          console.warn('[useChatMessaging] delivery receipt emit failed', err?.message);
        }

        // If the chat room is currently open, immediately mark as read too.
        if (mountedRef.current) {
          try {
            socket.emit('chat.receipt', {
              conversationId: String(msg.conversationId),
              messageId: msg.serverId,
              status: 'read',
            });
          } catch (err: any) {
            console.warn('[useChatMessaging] read receipt emit failed', err?.message);
          }
        }
      }

      await replaceMessagesRef.current([...messagesRef.current, msg]);
      void decryptChatMessageRef.current(msg);
    };

    socket.on('chat.message', onIncomingMessage);

    const onReceipt = async (payload: any) => {
      const conversationId = payload?.conversationId;
      const messageId = payload?.messageId ?? payload?.id;
      const type = payload?.type;
      if (!conversationId || !messageId || !type) return;

      const roomId = String(storageRoomId);
      const status =
        type === 'read' ? 'read' :
        type === 'delivered' ? 'delivered' :
        undefined;

      if (!status) return;
      try {
        const updated = await bulkUpdateMessages(roomId, (m) =>
          m.serverId === messageId || m.id === messageId
            ? { ...m, status }
            : m,
        );
        replaceMessagesRef.current(updated);
        const changed = updated.find(
          (m) => String(m.serverId ?? m.id ?? '') === String(messageId),
        );
        DeviceEventEmitter.emit('message.status', {
          conversationId,
          messageId,
          status,
          fromMe: !!changed?.fromMe,
        });
      } catch (error) {
        console.warn('[useChatMessaging] receipt update failed', error);
      }
    };

    socket.on('chat.message_receipt', onReceipt);

    const onEdit = (serverMsg: any) => {
      const activeConv = conversationIdRef.current;
      if (
        !activeConv ||
        String(serverMsg.conversationId) !== String(activeConv)
      ) {
        return;
      }

      const id = serverMsg.id ?? serverMsg._id ?? serverMsg.messageId;

      const next = messagesRef.current.map((m) =>
        m.serverId === id || m.id === id
          ? {
              ...m,
              text: serverMsg.text ?? m.text,
              styledText: serverMsg.styledText ?? m.styledText,
              ciphertext: serverMsg.ciphertext ?? m.ciphertext,
              encryptionMeta:
                serverMsg.encryptionMeta ??
                serverMsg.encryption_meta ??
                m.encryptionMeta,
              iv: serverMsg.iv ?? m.iv,
              tag: serverMsg.tag ?? m.tag,
              aad: serverMsg.aad ?? m.aad,
              encryptionVersion: serverMsg.encryptionVersion ?? m.encryptionVersion,
              encryptionKeyVersion: serverMsg.encryptionKeyVersion ?? m.encryptionKeyVersion,
              isEdited: true,
              updatedAt: serverMsg.updatedAt ?? new Date().toISOString(),
            }
          : m,
      );

      replaceMessagesRef.current(next);
      const updated = next.find((m) => m.serverId === id || m.id === id);
      if (updated) {
        void decryptChatMessageRef.current(updated);
      }
    };

    const onDelete = (serverMsg: any) => {
      const activeConv = conversationIdRef.current;
      if (
        !activeConv ||
        String(serverMsg.conversationId) !== String(activeConv)
      ) {
        return;
      }

      const id = serverMsg.id ?? serverMsg._id ?? serverMsg.messageId;

      const next = messagesRef.current.map((m) =>
        m.serverId === id || m.id === id
          ? {
              ...m,
              isDeleted: true,
              text: '',
              styledText: undefined,
              voice: undefined,
              sticker: undefined,
              attachments: [],
            }
          : m,
      );

      replaceMessagesRef.current(next);
    };

    socket.on('chat.edit', onEdit);
    socket.on('chat.delete', onDelete);

    const onReaction = (serverMsg: any) => {
      const activeConv = conversationIdRef.current;
      if (
        !activeConv ||
        String(serverMsg.conversationId) !== String(activeConv)
      ) {
        return;
      }

      const id = serverMsg.id ?? serverMsg._id ?? serverMsg.messageId;
      if (!id) return;

      const reactions = normalizeReactionsRef.current(serverMsg.reactions);
      const roomId = String(storageRoomId);
      bulkUpdateMessages(roomId, (m) =>
        m.serverId === id || m.id === id ? { ...m, reactions } : m,
      ).then((updated) => replaceMessagesRef.current(updated));
    };

    socket.on('chat.message_reaction', onReaction);

    return () => {
      socket.off('chat.message', onIncomingMessage);
      socket.off('chat.message_receipt', onReceipt);
      socket.off('chat.edit', onEdit);
      socket.off('chat.delete', onDelete);
      socket.off('chat.message_reaction', onReaction);
    };
  }, [socket, storageRoomId, currentUserId]);

  /* ---------------------------------------------------------------------
   * CONVERSATION FAN-OUT EVENTS
   * ------------------------------------------------------------------ */

  useEffect(() => {
    if (!socket) return;

    const onConversationCreated = (payload: any) => {
      if (__DEV__) console.log('[WS] conversation.created', payload);
      DeviceEventEmitter.emit('conversation.refresh');
    };
    const onConversationUpdated = (payload: any) => {
      if (__DEV__) console.log('[WS] conversation.updated', payload);
      DeviceEventEmitter.emit('conversation.refresh');
    };
    const onConversationLastMessage = (payload: any) => {
      if (__DEV__) console.log('[WS] conversation.last_message', payload);
      DeviceEventEmitter.emit('conversation.refresh');
    };

    socket.on('conversation.created', onConversationCreated);
    socket.on('conversation.updated', onConversationUpdated);
    socket.on('conversation.last_message', onConversationLastMessage);

    return () => {
      socket.off('conversation.created', onConversationCreated);
      socket.off('conversation.updated', onConversationUpdated);
      socket.off('conversation.last_message', onConversationLastMessage);
    };
  }, [socket]);

  /* ---------------------------------------------------------------------
   * RETURN API
   * ------------------------------------------------------------------ */

  const sendTyping = useCallback((isTyping: boolean) => {
    const convId =
      conversationIdRef.current ??
      String(storageRoomId);
    if (!socket || !convId) return;
    socket.emit('chat.typing', {
      conversationId: String(convId),
      isTyping,
    });
  }, [socket, storageRoomId]);

  return {
    messages,
    isLoading,
    sendTextMessage,
    sendRichMessage,
    editMessage: async (
      messageId: string,
      patch: Partial<ChatMessage>,
    ) => {
      await editMessage(messageId, patch);

      const convId =
        conversationIdRef.current ??
        String(storageRoomId);
      if (!socket || !convId) return;

      const serverId = resolveServerId(messageId);
      if (!serverId) return;
      const editPayload: any = {
        conversationId: String(convId),
        messageId: serverId,
        text: patch.text,
        styledText: patch.styledText,
      };
      socket.emit('chat.edit', editPayload);
    },
    softDeleteMessage: async (
      messageId: string,
    ) => {
      await softDeleteMessage(messageId);

      const convId =
        conversationIdRef.current ??
        String(storageRoomId);
      if (!socket || !convId) return;

      const serverId = resolveServerId(messageId);
      if (!serverId) return;
      socket.emit('chat.delete', {
        conversationId: String(convId),
        messageId: serverId,
      });
    },
    replyToMessage,
    attemptFlushQueue,
    sendTyping,
    retryMessage: async (messageId: string) => {
      await retryMessage(messageId);
    },
    sendReaction: (messageId: string, emoji: string, convId?: string | null) => {
      const resolvedConvId =
        convId ??
        conversationIdRef.current ??
        String(storageRoomId);
      if (!socket || !resolvedConvId || !messageId) return;
      socket.emit('chat.react', {
        conversationId: String(resolvedConvId),
        messageId,
        emoji,
      });
    },
    votePoll: (messageId: string, optionId: string) => {
      const resolvedConvId =
        conversationIdRef.current ??
        String(storageRoomId);
      if (!socket || !resolvedConvId || !messageId) return;
      socket.emit('chat.vote_poll', {
        conversationId: String(resolvedConvId),
        messageId,
        optionId,
      });
    },
    markMessagesRead,
    socket,
    isSocketConnected: isConnected,
  };
}
