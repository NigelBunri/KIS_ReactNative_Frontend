// src/screens/chat/hooks/useChatMessaging.ts

import {
  useCallback,
  useEffect,
  useRef,
} from 'react';
import type { MutableRefObject } from 'react';
import { AppState, DeviceEventEmitter } from 'react-native';

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
  encryptConversationPayload,
  preloadConversationKey,
} from '@/security/customE2EE';
import {
  decryptFromUser,
  encryptPayloadForRecipients,
  ensureDeviceId,
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

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const conversationIdRef =
    useRef<string | null>(conversationId);
  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

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

  const getRecipientUserIds = useCallback(() => {
    const participantIds = participantsToIds(chat?.participants ?? []);
    return participantIds.filter((id) => id && id !== currentUserId);
  }, [chat?.participants, currentUserId]);

  const patchDecryptedMessage = useCallback(
    (messageId: string, patch: Partial<ChatMessage>) => {
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
      if (!encMeta) return;

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

      const senderId =
        serverMsg.senderId != null ? String(serverMsg.senderId) : '';

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
      const text = serverMsg.text ?? (rawCiphertext || hasEncryptedMeta ? 'Encrypted message' : '');

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
        status: 'sent' as MessageStatus,
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
    },
    [socket, isConnected],
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
      socket.timeout(5000).emit(
        'chat.history',
        {
          conversationId: String(conversationId),
          limit: input.limit,
          after: input.after,
          before: input.before,
        },
        (err: any, ack?: any) => {
          if (err || !ack?.ok) return;
          const items = Array.isArray(ack?.data?.messages) ? ack.data.messages : [];
          if (!items.length) return;
          const mapped = items.map((m: any) => mapServerMessage(m));
          replaceMessages(mapped);
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
        socket.timeout(5000).emit(
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
      while (rounds < 20) {
        const items = await requestHistoryBatch({ before, limit: 200 });
        if (!items.length) break;
        const mapped = items.map((m: any) => mapServerMessage(m));
        all = [...mapped, ...all];
        const oldest = items[0]?.createdAt ?? items[0]?.created_at;
        if (!oldest || oldest === before) break;
        before = oldest;
        rounds += 1;
      }
      if (all.length) {
        replaceMessages(all);
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
    loadFullHistory();

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
      console.log(
        '[sendOverNetworkImpl]',
        'socket:',
        !!socket,
        'connected:',
        isConnected,
        'message:',
        message,
      );

      // Socket not ready → keep message queued locally
      if (!socket || !(isConnected || socket.connected) || !chat) {
        console.log(
          '[sendOverNetworkImpl] socket not ready → queue',
        );
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

      let payloadToSend: any = basePayload;
      try {
        const recipientUserIds = getRecipientUserIds();
        if (!recipientUserIds.length) {
          throw new Error('Missing recipient device inventory for signal fanout');
        }
        const signalEncrypted = await encryptPayloadForRecipients(
          String(currentUserId),
          recipientUserIds,
          basePayload,
        );
        payloadToSend = {
          conversationId: basePayload.conversationId,
          clientId,
          kind: basePayload.kind,
          encryptionMeta: signalEncrypted.encryptionMeta,
        };
      } catch (err) {
        try {
          const encrypted = await encryptConversationPayload(String(convId), basePayload);
          payloadToSend = {
            conversationId: basePayload.conversationId,
            clientId,
            kind: basePayload.kind,
            encrypted: true,
            ciphertext: encrypted.ciphertext,
            iv: encrypted.iv,
            tag: encrypted.tag,
            encryptionVersion: encrypted.encryptionVersion ?? ENCRYPTION_VERSION,
            encryptionKeyVersion: encrypted.encryptionKeyVersion,
            aad: encrypted.aad,
          };
        } catch (legacyErr) {
          console.warn('[useChatMessaging] encryption failed', err, legacyErr);
          return { ok: false };
        }
      }

      return new Promise<SendOverNetworkResult>(
        (resolve) => {
          socket
            .timeout(5000)
            .emit(
            'chat.send',
            payloadToSend,
              (
                err: any,
                ack?: any,
              ) => {
                if (err) {
                  console.warn('[chat.send] error', err);
                  return resolve({ ok: false });
                }

                const success = ack?.ok === true;

                if (!success) {
                  return resolve({ ok: false });
                }

                const ackPayload =
                  ack?.data?.ack ?? ack?.ack ?? null;
                const serverId =
                  ackPayload?.serverId ?? ack?.serverId ?? ack?.id;

                if (!serverId) {
                  console.warn(
                    '[chat.send] ACK missing serverId',
                    ack,
                  );
                  return resolve({ ok: false });
                }

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
      getRecipientUserIds,
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

    console.log(
      '[useChatMessaging] socket connected → flush queue',
    );

    attemptFlushQueue();
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
      flushInFlightRef.current = true;
      attemptFlushQueue()
        .catch(() => {})
        .finally(() => {
          flushInFlightRef.current = false;
        });
    }, 8000);

    return () => clearInterval(interval);
  }, [socket, isConnected, attemptFlushQueue]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      if (!socket || !(isConnected || socket.connected)) return;
      attemptFlushQueue();
      syncHistory();
    });
    return () => sub.remove();
  }, [socket, isConnected, attemptFlushQueue, syncHistory]);

  /* ---------------------------------------------------------------------
   * RECEIVE REALTIME MESSAGES
   * ------------------------------------------------------------------ */

  useEffect(() => {
    if (!socket) return;

    const onIncomingMessage = (
      serverMsg: any,
    ) => {
      const activeConv =
        conversationIdRef.current;

      if (
        !activeConv ||
        String(serverMsg.conversationId) !==
          String(activeConv)
      ) {
        return;
      }

      const matchIndex = messagesRef.current.findIndex((m) => {
        if (serverMsg.clientId && m.clientId && m.clientId === serverMsg.clientId) return true;
        if ((serverMsg.id ?? serverMsg._id) && m.serverId && m.serverId === (serverMsg.id ?? serverMsg._id)) return true;
        if (!serverMsg.clientId && String(serverMsg.senderId ?? '') === String(currentUserId) && m.fromMe && m.status === 'pending') return true;
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
        replaceMessages(next);
        return;
      }

      const msg = mapServerMessage(serverMsg);

      if (!msg.fromMe && msg.serverId) {
        try {
          socket.emit('chat.receipt', {
            conversationId: String(msg.conversationId),
            messageId: msg.serverId,
            type: 'delivered',
          });
        } catch {}
      }

      replaceMessages([
        ...messagesRef.current,
        msg,
      ]);
      void decryptChatMessage(msg);

    };

    socket.on(
      'chat.message',
      onIncomingMessage,
    );

    const onReceipt = async (payload: any) => {
      const conversationId = payload?.conversationId;
      const messageId = payload?.messageId ?? payload?.id;
      const type = payload?.type;
      if (!conversationId || !messageId || !type) return;

      const roomId = String(storageRoomId);
      const status =
        type === 'read'
          ? 'read'
          : type === 'delivered'
          ? 'delivered'
          : undefined;

      if (!status) return;
      try {
        const updated = await bulkUpdateMessages(roomId, (m) =>
          m.serverId === messageId || m.id === messageId
            ? { ...m, status }
            : m,
        );
        replaceMessages(updated);
        const changed = updated.find(
          (m) =>
            String(m.serverId ?? m.id ?? '') === String(messageId),
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
      const activeConv =
        conversationIdRef.current;
      if (
        !activeConv ||
        String(serverMsg.conversationId) !==
          String(activeConv)
      ) {
        return;
      }

      const id =
        serverMsg.id ??
        serverMsg._id ??
        serverMsg.messageId;

      const next = messagesRef.current.map(
        (m) =>
          m.serverId === id || m.id === id
            ? {
                ...m,
                text: serverMsg.text ?? m.text,
                styledText:
                  serverMsg.styledText ??
                  m.styledText,
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
                updatedAt:
                  serverMsg.updatedAt ??
                  new Date().toISOString(),
              }
            : m,
      );

      replaceMessages(next);
      const updated = next.find((m) => m.serverId === id || m.id === id);
      if (updated) {
        void decryptChatMessage(updated);
      }
    };

    const onDelete = (serverMsg: any) => {
      const activeConv =
        conversationIdRef.current;
      if (
        !activeConv ||
        String(serverMsg.conversationId) !==
          String(activeConv)
      ) {
        return;
      }

      const id =
        serverMsg.id ??
        serverMsg._id ??
        serverMsg.messageId;

      const next = messagesRef.current.map(
        (m) =>
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

      replaceMessages(next);
    };

    socket.on('chat.edit', onEdit);
    socket.on('chat.delete', onDelete);

    const onReaction = (serverMsg: any) => {
      const activeConv =
        conversationIdRef.current;
      if (
        !activeConv ||
        String(serverMsg.conversationId) !==
          String(activeConv)
      ) {
        return;
      }

      const id =
        serverMsg.id ??
        serverMsg._id ??
        serverMsg.messageId;
      if (!id) return;

      const reactions = normalizeReactions(serverMsg.reactions);
      const roomId = String(storageRoomId);
      bulkUpdateMessages(roomId, (m) =>
        m.serverId === id || m.id === id
          ? { ...m, reactions }
          : m,
      ).then(replaceMessages);
    };

    socket.on('chat.message_reaction', onReaction);

    return () => {
      socket.off(
        'chat.message',
        onIncomingMessage,
      );
      socket.off('chat.message_receipt', onReceipt);
      socket.off('chat.edit', onEdit);
      socket.off('chat.delete', onDelete);
      socket.off('chat.message_reaction', onReaction);
    };
  }, [
    socket,
    replaceMessages,
    storageRoomId,
    mapServerMessage,
    conversationId,
    normalizeReactions,
    currentUserId,
    decryptChatMessage,
  ]);

  /* ---------------------------------------------------------------------
   * CONVERSATION FAN-OUT EVENTS
   * ------------------------------------------------------------------ */

  useEffect(() => {
    if (!socket) return;

    const log =
      (name: string) => (p: any) =>
        console.log(`[WS] ${name}`, p);

    socket.on(
      'conversation.created',
      (payload: any) => {
        log('conversation.created')(payload);
        DeviceEventEmitter.emit('conversation.refresh');
      },
    );
    socket.on(
      'conversation.updated',
      (payload: any) => {
        log('conversation.updated')(payload);
        DeviceEventEmitter.emit('conversation.refresh');
      },
    );
    socket.on(
      'conversation.last_message',
      (payload: any) => {
        log('conversation.last_message')(payload);
        DeviceEventEmitter.emit('conversation.refresh');
      },
    );

    return () => {
      socket.off('conversation.created');
      socket.off('conversation.updated');
      socket.off(
        'conversation.last_message',
      );
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
      if (patch.text != null || patch.styledText) {
        try {
          const recipientUserIds = getRecipientUserIds();
          if (!recipientUserIds.length) {
            throw new Error('Missing recipient device inventory for signal fanout');
          }
          const encrypted = await encryptPayloadForRecipients(
            String(currentUserId),
            recipientUserIds,
            {
              conversationId: String(convId),
              kind: 'text',
              clientId: String(serverId),
              text: patch.text,
              styledText: patch.styledText,
            },
          );
          delete editPayload.text;
          delete editPayload.styledText;
          editPayload.encryptionMeta = encrypted.encryptionMeta;
          editPayload.ciphertext = undefined;
        } catch (err) {
          try {
            const encrypted = await encryptConversationPayload(String(convId), {
              conversationId: String(convId),
              kind: 'text',
              clientId: String(serverId),
              text: patch.text,
              styledText: patch.styledText,
            });
            delete editPayload.text;
            delete editPayload.styledText;
            editPayload.ciphertext = encrypted.ciphertext;
            editPayload.iv = encrypted.iv;
            editPayload.tag = encrypted.tag;
            editPayload.aad = encrypted.aad;
            editPayload.encryptionVersion = encrypted.encryptionVersion ?? ENCRYPTION_VERSION;
            editPayload.encryptionKeyVersion = encrypted.encryptionKeyVersion;
          } catch (legacyErr) {
            console.warn('[useChatMessaging] edit encryption failed', err, legacyErr);
          }
        }
      }
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
      await attemptFlushQueue();
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
    markMessagesRead,
    socket,
    isSocketConnected: isConnected,
  };
}
