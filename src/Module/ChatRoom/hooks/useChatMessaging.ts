// src/screens/chat/hooks/useChatMessaging.ts

// E2EE is deferred until key exchange protocol is validated end-to-end. Messages use server-side encryption via TLS. Flip to true when crypto module passes integration tests.
const E2EE_ENABLED = true;
const STALE_SIGNAL_DECRYPTS_KEY = 'kis.chat.stale_signal_decrypts.v1';
const DEBUG_STALE_DECRYPTS = false;

import {
  useCallback,
  useEffect,
  useRef,
} from 'react';
import type { MutableRefObject } from 'react';
import { AppState, DeviceEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isOnline, onNetworkRecovery } from '@/services/networkMonitor';

import {
  SendOverNetworkResult,
  useChatPersistence,
  type SendOverNetworkFn,
} from './useChatPersistence';
import {
  bulkUpdateMessages,
  clearMessages,
  filterLocallyDeletedMessages,
  rememberLocallyDeletedMessageIds,
  removeMessage,
} from '../Storage/chatStorage';
import {
  loadDecryptedMessage,
  saveDecryptedMessage,
} from '../Storage/decryptedMessageStorage';

import type {
  ChatMessage,
  ChatRoomPageProps,
  MessageKind,
  MessageStatus,
} from '../chatTypes';
import { normalizeChatDisplayText, normalizeChatSendText } from '../safeChatText';
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
  isSignalMessageCounterError,
  repairLocalE2EEBundle,
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

const serializeErrorForDiagnostics = (error: any) => {
  if (!error) return null;
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: (error as any).code,
      status: (error as any).status,
      response: (error as any).response?.data ?? (error as any).response,
    };
  }
  if (typeof error === 'object') {
    try {
      return JSON.parse(JSON.stringify(error));
    } catch {
      return {
        name: error?.name,
        message: error?.message ?? String(error),
        code: error?.code,
        stack: error?.stack,
      };
    }
  }
  return { message: String(error) };
};

const reactNativeDiagnostics = (
  stage: string,
  error: any,
  context: Record<string, any> = {},
) => ({
  source: 'reactnative:useChatMessaging',
  at: new Date().toISOString(),
  stage,
  ...context,
  error: serializeErrorForDiagnostics(error),
});

const safeStringify = (value: any) => {
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
};

const isBadMacDecryptError = (error: any): boolean => {
  const name = String(error?.name ?? '').toLowerCase();
  const message = String(error?.message ?? error ?? '').toLowerCase();
  return name.includes('badmac') || message.includes('bad mac');
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const normalizeUuid = (value: unknown): string | null => {
  if (value && typeof value === 'object') {
    const objectValue = value as Record<string, unknown>;
    return (
      normalizeUuid(objectValue.id) ??
      normalizeUuid(objectValue.userId) ??
      normalizeUuid(objectValue.user_id) ??
      normalizeUuid(objectValue.uuid)
    );
  }
  const text = String(value ?? '').trim();
  return UUID_RE.test(text) ? text : null;
};

const resolveParticipantUserIdForE2EE = (participant: any): string | null => {
  if (typeof participant === 'string') return normalizeUuid(participant);
  if (!participant || typeof participant !== 'object') return null;

  const user = participant.user;
  if (user && typeof user === 'object') {
    const nested =
      normalizeUuid(user.id) ??
      normalizeUuid(user.userId) ??
      normalizeUuid(user.user_id) ??
      normalizeUuid(user.uuid);
    if (nested) return nested;
  }

  return (
    normalizeUuid(participant.userId) ??
    normalizeUuid(participant.user_id) ??
    normalizeUuid(participant.user_uuid) ??
    normalizeUuid(participant.member_user_id) ??
    normalizeUuid(participant.account_id) ??
    null
  );
};

const resolveE2EERecipientIds = (chat: any, currentUserId: string): string[] => {
  const recipients = new Set<string>();
  const selfUserId = normalizeUuid(currentUserId);
  if (selfUserId) recipients.add(selfUserId);

  const directCandidates = [
    chat?.peer_user_id,
    chat?.peerUserId,
    chat?.contactUserId,
    chat?.contact_user_id,
    chat?.requestRecipientId,
    chat?.request_initiator_id,
    chat?.requestInitiatorId,
  ];
  for (const candidate of directCandidates) {
    const userId = normalizeUuid(candidate);
    if (userId) recipients.add(userId);
  }

  const participants = Array.isArray(chat?.participants) ? chat.participants : [];
  for (const participant of participants) {
    const userId = resolveParticipantUserIdForE2EE(participant);
    if (userId) recipients.add(userId);
  }
  return Array.from(recipients);
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
  const lastKnownSeqRef = useRef<Record<string, number>>({});
  const decryptInFlightRef = useRef<Set<string>>(new Set());
  const decryptFailedAtRef = useRef<Map<string, number>>(new Map());
  const decryptSkippedRef = useRef<Set<string>>(new Set());
  const staleSignalDecryptsRef = useRef<Set<string>>(new Set());
  const staleSignalDecryptsLoadedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STALE_SIGNAL_DECRYPTS_KEY)
      .then((raw) => {
        if (cancelled || !raw) return;
        try {
          const values = JSON.parse(raw);
          if (Array.isArray(values)) {
            staleSignalDecryptsRef.current = new Set(values.filter((value) => typeof value === 'string'));
          }
        } catch {}
      })
      .finally(() => {
        if (!cancelled) staleSignalDecryptsLoadedRef.current = true;
      });
    return () => { cancelled = true; };
  }, []);

  /* -----------------------------------------------------------------------
   * OFFLINE QUEUES — receipts and reactions are fire-and-forget socket
   * emits. Under poor network, the socket may be temporarily disconnected.
   * Queue them and flush as soon as the socket reconnects.
   * --------------------------------------------------------------------- */
  type PendingReceipt = { conversationId: string; messageId: string; type: string };
  type PendingReaction = { conversationId: string; messageId: string; emoji: string; remove?: boolean };

  const pendingReceiptsRef = useRef<PendingReceipt[]>([]);
  const pendingReactionsRef = useRef<PendingReaction[]>([]);

  const emitReceiptRef = useRef<(convId: string, msgId: string, type: string) => void>(
    () => {},
  );
  const emitReactionRef = useRef<(convId: string, msgId: string, emoji: string, remove?: boolean) => void>(
    () => {},
  );

  // Keep the emit helpers up-to-date as socket/isConnected change
  useEffect(() => {
    emitReceiptRef.current = (convId: string, msgId: string, type: string) => {
      if (!convId || !msgId) return;
      if (socket && (isConnected || socket.connected)) {
        socket.emit('chat.receipt', { conversationId: convId, messageId: msgId, type });
      } else {
        const already = pendingReceiptsRef.current.some(
          r => r.conversationId === convId && r.messageId === msgId && r.type === type,
        );
        if (!already) pendingReceiptsRef.current.push({ conversationId: convId, messageId: msgId, type });
      }
    };
    emitReactionRef.current = (convId: string, msgId: string, emoji: string, remove?: boolean) => {
      if (!convId || !msgId || !emoji) return;
      if (socket && (isConnected || socket.connected)) {
        socket.emit('chat.react', { conversationId: convId, messageId: msgId, emoji, ...(remove ? { remove: true } : {}) });
      } else {
        const already = pendingReactionsRef.current.some(
          r => r.conversationId === convId && r.messageId === msgId && r.emoji === emoji && !!r.remove === !!remove,
        );
        if (!already) pendingReactionsRef.current.push({ conversationId: convId, messageId: msgId, emoji, remove });
      }
    };
  }, [socket, isConnected]);

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
    for (const message of messages) {
      const text = typeof message.text === 'string' ? message.text.trim() : '';
      const encrypted = Boolean(
        message.encryptionMeta ?? message.ciphertext ?? (message as any).encrypted,
      );
      if (!encrypted || !text || text.toLowerCase() === 'encrypted message') continue;
      void saveDecryptedMessage(String(currentUserId), message, {
        text: message.text,
        styledText: message.styledText,
        attachments: message.attachments,
        media: (message as any).media,
        contacts: message.contacts,
        poll: message.poll,
        event: message.event,
        voice: message.voice,
        sticker: message.sticker,
        replyToId: message.replyToId,
        kind: message.kind,
      }).catch(() => {});
    }
  }, [messages, currentUserId]);

  const conversationIdRef =
    useRef<string | null>(conversationId);
  useEffect(() => {
    if (conversationIdRef.current !== conversationId) {
      // New conversation — allow full history load for this room.
      hasInitialLoadRef.current = false;
      if (conversationId) delete lastKnownSeqRef.current[conversationId];
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
    async (messageId: string, patch: Partial<ChatMessage>) => {
      if (!mountedRef.current) return;
      const next = messagesRef.current.map((message) =>
        message.serverId === messageId || message.id === messageId
          ? { ...message, ...patch }
          : message,
      );
      await replaceMessages(next);
      const updated = next.find((message) => message.serverId === messageId || message.id === messageId);
      const convId = updated?.conversationId ?? conversationIdRef.current;
      if (convId) {
        DeviceEventEmitter.emit('message.decrypted', { conversationId: String(convId), messageId });
        DeviceEventEmitter.emit('conversation.refresh');
      }
    },
    [replaceMessages],
  );

  const rememberStaleSignalDecrypt = useCallback((key: string) => {
    if (!key || staleSignalDecryptsRef.current.has(key)) return;
    staleSignalDecryptsRef.current.add(key);
    const values = Array.from(staleSignalDecryptsRef.current).slice(-1000);
    staleSignalDecryptsRef.current = new Set(values);
    AsyncStorage.setItem(STALE_SIGNAL_DECRYPTS_KEY, JSON.stringify(values)).catch(() => {});
  }, []);

  const decryptChatMessage = useCallback(
    async (mapped: ChatMessage) => {
      const encMeta = mapped.encryptionMeta;
      if (!encMeta && !mapped.ciphertext) return;

      const messageId = String(mapped.serverId ?? mapped.id ?? mapped.clientId ?? '');
      const existingReadable = messageId
        ? messagesRef.current.find((m) => {
            const sameMessage = m.serverId === messageId || m.id === messageId || m.clientId === messageId;
            const text = typeof m.text === 'string' ? m.text.trim() : '';
            return sameMessage && text.length > 0 && text.toLowerCase() !== 'encrypted message';
          })
        : null;
      if (existingReadable) return;

      const storedPlaintext = await loadDecryptedMessage(
        String(currentUserId),
        mapped,
      );
      if (storedPlaintext) {
        await patchDecryptedMessage(messageId, storedPlaintext);
        return;
      }

      const decryptKey = [
        messageId || 'unknown',
        encMeta?.e2ee ?? mapped.encryptionVersion ?? 'encrypted',
        mapped.ciphertext ? String(mapped.ciphertext).slice(0, 48) : '',
      ].join(':');
      const failedAt = decryptFailedAtRef.current.get(decryptKey) ?? 0;
      if (
        decryptSkippedRef.current.has(decryptKey) ||
        decryptInFlightRef.current.has(decryptKey) ||
        Date.now() - failedAt < 5_000
      ) {
        return;
      }
      decryptInFlightRef.current.add(decryptKey);

      try {
        if (encMeta?.e2ee === 'signal') {
          const senderDeviceId = encMeta?.senderDeviceId ?? encMeta?.deviceId ?? '';
          const recipients = Array.isArray(encMeta?.recipients) ? encMeta.recipients : [];
          let currentDeviceId = deviceIdRef.current;
          if (!currentDeviceId) {
            currentDeviceId = await ensureDeviceId();
            deviceIdRef.current = currentDeviceId;
          }
          const isOwnCurrentDeviceMessage =
            String(mapped.senderId) === String(currentUserId) &&
            !!currentDeviceId &&
            String(senderDeviceId) === String(currentDeviceId);
          const recipientCipher = currentDeviceId
            ? recipients.find(
                (item: any) =>
                  String(item?.userId) === String(currentUserId) &&
                  String(item?.deviceId) === String(currentDeviceId),
              )
            : recipients.find((item: any) => String(item?.userId) === String(currentUserId));

          // Multi-device Signal payloads are per-device. If the server returned
          // recipient envelopes, this device must only decrypt its own envelope.
          // Falling back to another ciphertext consumes/reads the wrong session
          // counter and causes MessageCounterError on history replay.
          if (recipients.length > 0 && !recipientCipher) return;
          if (isOwnCurrentDeviceMessage && !recipientCipher) return;

          const ciphertext = recipientCipher?.ciphertext ?? mapped.ciphertext;
          const type = recipientCipher?.type ?? encMeta?.type ?? 1;
          if (!mapped.senderId || !senderDeviceId || !ciphertext) return;

          const signalStaleKey = [
            currentDeviceId,
            messageId || mapped.serverId || mapped.id || mapped.clientId || 'unknown',
            mapped.senderId,
            senderDeviceId,
            String(ciphertext).slice(0, 64),
          ].join(':');
          if (!staleSignalDecryptsLoadedRef.current) {
            try {
              const raw = await AsyncStorage.getItem(STALE_SIGNAL_DECRYPTS_KEY);
              if (raw) {
                const values = JSON.parse(raw);
                if (Array.isArray(values)) {
                  staleSignalDecryptsRef.current = new Set(values.filter((value) => typeof value === 'string'));
                }
              }
            } catch {
              // Non-fatal: a corrupt skip cache just means we attempt decrypt once.
            } finally {
              staleSignalDecryptsLoadedRef.current = true;
            }
          }
          if (staleSignalDecryptsRef.current.has(signalStaleKey)) return;

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
          if (typeof signalStaleKey === 'string') {
            staleSignalDecryptsRef.current.delete(signalStaleKey);
          }
          const parsedMedia = parsed?.media && typeof parsed.media === 'object'
            ? parsed.media
            : (Array.isArray(parsed?.attachments) ? { attachments: parsed.attachments } : undefined);
          const nextMedia = parsedMedia ?? (mapped as any).media;
          const decryptedPatch = {
            text: parsed ? normalizeChatSendText(parsed?.text) : normalizeChatDisplayText(plaintext),
            styledText: parsed?.styledText ?? mapped.styledText,
            attachments: Array.isArray(nextMedia?.attachments)
              ? nextMedia.attachments
              : parsed?.attachments ?? mapped.attachments,
            media: nextMedia,
            contacts: parsed?.contacts ?? mapped.contacts,
            poll: parsed?.poll ?? mapped.poll,
            event: parsed?.event ?? mapped.event,
            voice: parsed?.voice ?? mapped.voice,
            sticker: parsed?.sticker ?? mapped.sticker,
            replyToId: parsed?.replyToId ?? mapped.replyToId,
            kind: parsed?.kind ?? mapped.kind,
          };
          await saveDecryptedMessage(String(currentUserId), mapped, decryptedPatch);
          await patchDecryptedMessage(String(mapped.serverId ?? mapped.id), decryptedPatch);
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
          const parsedMedia = parsed?.media && typeof parsed.media === 'object'
            ? parsed.media
            : (Array.isArray(parsed?.attachments) ? { attachments: parsed.attachments } : undefined);
          const nextMedia = parsedMedia ?? (mapped as any).media;
          const decryptedPatch = {
            text: parsed ? normalizeChatSendText(parsed?.text) : normalizeChatDisplayText(plaintext),
            styledText: parsed?.styledText ?? mapped.styledText,
            attachments: Array.isArray(nextMedia?.attachments)
              ? nextMedia.attachments
              : parsed?.attachments ?? mapped.attachments,
            media: nextMedia,
            contacts: parsed?.contacts ?? mapped.contacts,
            poll: parsed?.poll ?? mapped.poll,
            event: parsed?.event ?? mapped.event,
            voice: parsed?.voice ?? mapped.voice,
            sticker: parsed?.sticker ?? mapped.sticker,
            replyToId: parsed?.replyToId ?? mapped.replyToId,
            kind: parsed?.kind ?? mapped.kind,
          };
          await saveDecryptedMessage(String(currentUserId), mapped, decryptedPatch);
          await patchDecryptedMessage(String(mapped.serverId ?? mapped.id), decryptedPatch);
        }
        decryptFailedAtRef.current.delete(decryptKey);
      } catch (error) {
        decryptFailedAtRef.current.set(decryptKey, Date.now());
        if (isSignalMessageCounterError(error)) {
          const messageId = String(mapped.serverId ?? mapped.id ?? mapped.clientId ?? '');
          const senderDeviceId = encMeta?.senderDeviceId ?? encMeta?.deviceId ?? '';
          const currentDeviceId = deviceIdRef.current ?? '';
          const recipients = Array.isArray(encMeta?.recipients) ? encMeta.recipients : [];
          const recipientCipher = currentDeviceId
            ? recipients.find(
                (item: any) =>
                  String(item?.userId) === String(currentUserId) &&
                  String(item?.deviceId) === String(currentDeviceId),
              )
            : null;
          const staleKey = [
            currentDeviceId,
            messageId || 'unknown',
            mapped.senderId,
            senderDeviceId,
            String(recipientCipher?.ciphertext ?? mapped.ciphertext ?? '').slice(0, 64),
          ].join(':');
          rememberStaleSignalDecrypt(staleKey);
          const existing = messageId
            ? messagesRef.current.find((m) => m.serverId === messageId || m.id === messageId || m.clientId === messageId)
            : null;
          if (existing?.text && existing.text !== 'Encrypted message') {
            return;
          }
          decryptSkippedRef.current.add(decryptKey);
          return;
        } else if (isBadMacDecryptError(error)) {
          decryptSkippedRef.current.add(decryptKey);
          if (__DEV__ && DEBUG_STALE_DECRYPTS) {
            console.warn('[useChatMessaging] stale encrypted message skipped', {
              messageId: mapped.serverId ?? mapped.id ?? mapped.clientId,
              senderId: mapped.senderId,
              error: serializeErrorForDiagnostics(error),
            });
          }
          return;
        } else {
          console.warn('[useChatMessaging] decrypt failed', error);
        }
      } finally {
        decryptInFlightRef.current.delete(decryptKey);
      }
    },
    [currentUserId, patchDecryptedMessage, rememberStaleSignalDecrypt],
  );

  // Stable refs so the socket listener effect doesn't re-subscribe on every render
  const decryptChatMessageRef = useRef(decryptChatMessage);
  useEffect(() => { decryptChatMessageRef.current = decryptChatMessage; });

  // On initial cache load: any message stored in AsyncStorage with an encrypted
  // payload but no readable text needs decryption triggered here.  The socket
  // path (loadFullHistory / live events) only covers messages that arrive while
  // the room is open. Older messages that were only ever received encrypted and
  // never patched in a previous session stay as "Encrypted message" on reload
  // unless we explicitly kick off decryption after the cache comes back.
  // decryptChatMessage checks EncryptedStorage first so this is a fast no-network
  // path for anything we've already seen.
  const hasRunInitialDecryptRef = useRef(false);
  useEffect(() => {
    if (isLoading) {
      // Room changed or remounted — allow the pass to run again.
      hasRunInitialDecryptRef.current = false;
      return;
    }
    if (hasRunInitialDecryptRef.current) return;
    hasRunInitialDecryptRef.current = true;

    for (const msg of messages) {
      const hasEncryption = Boolean(
        msg.encryptionMeta ?? msg.ciphertext ?? (msg as any).encrypted,
      );
      if (!hasEncryption) continue;
      const text = typeof msg.text === 'string' ? msg.text.trim() : '';
      if (text && text.toLowerCase() !== 'encrypted message') continue;
      void decryptChatMessageRef.current(msg);
    }
  }, [isLoading, messages]);

  const mapServerMessage = useCallback(
    (serverMsg: any): ChatMessage => {
      const mapAttachments = (list: any[]) =>
        list.map((raw) => {
          const a = raw?.attachment ?? raw?.asset ?? raw?.media ?? raw?.file ?? raw ?? {};
          const localPath = a.localPath ?? a.local_path ?? a.path;
          const localUri = a.localUri ?? a.local_uri ?? a.uri;
          const displayUrl =
            a.displayUrl ??
            a.display_url ??
            a.url ??
            a.downloadUrl ??
            a.download_url ??
            a.publicUrl ??
            a.public_url ??
            a.fileUrl ??
            a.file_url ??
            a.secureUrl ??
            a.secure_url ??
            a.signedUrl ??
            a.signed_url ??
            localUri ??
            (typeof localPath === 'string' && localPath ? `file://${localPath}` : undefined);
          return {
            ...a,
            id: a.id ?? a.key ?? a.assetId ?? a.asset_id ?? a.mediaAssetId ?? a.media_asset_id ?? displayUrl,
            url: displayUrl,
            publicUrl: a.publicUrl ?? a.public_url,
            downloadUrl: a.downloadUrl ?? a.download_url ?? a.fileUrl ?? a.file_url ?? a.secureUrl ?? a.secure_url ?? a.signedUrl ?? a.signed_url,
            displayUrl,
            assetId: a.assetId ?? a.asset_id,
            mediaAssetId: a.mediaAssetId ?? a.media_asset_id,
            mediaAssetRef: a.mediaAssetRef ?? a.media_asset_ref,
            originalName: a.originalName ?? a.original_name ?? a.name ?? a.filename,
            mimeType: a.mimeType ?? a.mime_type ?? a.mimetype ?? a.mime ?? a.contentType ?? a.content_type,
            size: a.size ?? a.sizeBytes ?? a.size_bytes,
            kind: a.kind,
            width: a.width,
            height: a.height,
            durationMs: a.durationMs ?? a.duration_ms,
            durationSeconds: a.durationSeconds ?? a.duration_seconds,
            thumbUrl: a.thumbUrl ?? a.thumb_url ?? a.thumbnailUrl ?? a.thumbnail_url,
            expiresAt: a.expiresAt ?? undefined,
            expired: a.expired ?? false,
            private: a.private,
            scanStatus: a.scanStatus ?? a.scan_status,
            localUri,
            localPath,
            localUploadKey: a.localUploadKey ?? a.local_upload_key,
            quarantined: a.quarantined,
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
                    voterIds: Array.isArray(opt?.voter_ids)
                      ? opt.voter_ids.map(String)
                      : Array.isArray(opt?.voterIds)
                        ? opt.voterIds.map(String)
                        : undefined,
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

      const rawMedia = serverMsg.media && typeof serverMsg.media === 'object' ? serverMsg.media : undefined;
      const rawAttachments = Array.isArray(rawMedia?.attachments)
        ? rawMedia.attachments
        : Array.isArray(serverMsg.attachments)
        ? serverMsg.attachments
        : [];
      const attachments = mapAttachments(rawAttachments);
      const media = rawMedia ? { ...rawMedia, attachments } : attachments.length ? { attachments } : undefined;

      const rawCiphertext = serverMsg.ciphertext ?? undefined;
      const hasEncryptedMeta = !!(serverMsg.encryptionMeta ?? serverMsg.encryption_meta);
      const rawText = serverMsg.text ?? serverMsg.previewText ?? serverMsg.preview_text ?? '';
      const text = hasEncryptedMeta || rawCiphertext
        ? (String(rawText).trim().toLowerCase() === 'encrypted message' ? 'Encrypted message' : normalizeChatDisplayText(rawText))
        : normalizeChatDisplayText(rawText);

      // Always stringify — .lean() MongoDB queries return _id as an ObjectId
      // object (no `id` virtual). An ObjectId key never matches stored string
      // keys in mergeMessages, causing history messages to bypass the merge
      // and appear as new encrypted-placeholder entries alongside the cached
      // decrypted versions.
      const rawId = serverMsg.id ?? serverMsg._id;
      const idStr = rawId != null ? String(rawId) : '';

      return {
        id: idStr,
        clientId: serverMsg.clientId,
        serverId: idStr,
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
        attachments,
        media,
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

      // Fetch server-starred message IDs and apply to local messages
      socket.emit('chat.get_starred', { conversationId: String(convId) }, (res: any) => {
        const ids: string[] = res?.data?.messageIds ?? [];
        if (!ids.length) return;
        const idSet = new Set(ids.map(String));
        const updated = messagesRef.current.map(m =>
          idSet.has(String(m.serverId ?? m.id)) ? { ...m, isStarred: true } : m,
        );
        replaceMessagesRef.current(updated);
      });

      // Mark conversation as read when joining — send a receipt for the last
      // message from another user so the server updates unread counts.
      const msgs = messagesRef.current;
      if (msgs.length > 0) {
        const lastMsg = msgs[msgs.length - 1];
        if (lastMsg?.serverId && lastMsg.senderId !== currentUserId) {
          emitReceiptRef.current(String(convId), lastMsg.serverId, 'read');
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
          const mapped = await filterLocallyDeletedMessages(
            String(storageRoomId),
            items.map((m: any) => mapServerMessage(m)),
            currentUserId,
          );
          if (!mapped.length) return;
          // Await so messagesRef is current before decryption reads it.
          await replaceMessages(mapped);
          mapped.forEach((message: ChatMessage) => {
            void decryptChatMessage(message);
          });
        },
      );
    },
    [
      socket,
      isConnected,
      conversationId,
      replaceMessages,
      mapServerMessage,
      decryptChatMessage,
      storageRoomId,
      currentUserId,
    ],
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
        all = await filterLocallyDeletedMessages(
          String(storageRoomId),
          all,
          currentUserId,
        );
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
  }, [
    requestHistoryBatch,
    replaceMessages,
    mapServerMessage,
    decryptChatMessage,
    storageRoomId,
    currentUserId,
  ]);

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
        emitReceiptRef.current(conversationId, msg.serverId, 'read');
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
      }, currentUserId);
      replaceMessages(updated);
      DeviceEventEmitter.emit('conversation.read', {
        conversationId,
        readCount: unread.length,
      });
    },
    [socket, conversationId, storageRoomId, replaceMessages, currentUserId],
  );

  useEffect(() => {
    if (!socket || !(isConnected || socket.connected) || !conversationId)
      return;

    joinConversation(conversationId);

    // Wait for local storage load to complete before fetching full history.
    // This ensures mergeMessages can find the existing cached messages (with
    // delivered/read statuses) and won't downgrade them to 'sent'.
    if (!isLoading) {
      syncHistory();
      if (!hasInitialLoadRef.current) {
        hasInitialLoadRef.current = true;
        loadFullHistory();
      }
    }

    return () => {
      leaveConversation(conversationId);
    };
  }, [
    socket,
    isConnected,
    conversationId,
    isLoading,
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

      const online = await isOnline();
      // Offline/socket not ready → keep message queued locally without showing retry failure.
      if (!online || !socket || !(isConnected || socket.connected) || !chat) {
        if (__DEV__) console.log('[sendOverNetworkImpl] socket offline/not ready → queue');
        return { ok: false, queued: true };
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
          publicUrl: a.publicUrl,
          downloadUrl: a.downloadUrl,
          displayUrl: a.displayUrl,
          assetId: a.assetId,
          mediaAssetId: a.mediaAssetId,
          mediaAssetRef: a.mediaAssetRef,
          originalName: a.originalName ?? a.name,
          mimeType: a.mimeType ?? a.mime,
          size: a.size,
          kind: a.kind,
          width: a.width,
          height: a.height,
          durationMs: a.durationMs,
          durationSeconds: a.durationSeconds,
          thumbUrl: a.thumbUrl,
          private: a.private,
          scanStatus: a.scanStatus,
          localUri: a.localUri,
          localPath: a.localPath,
          quarantined: a.quarantined,
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
                voterIds: Array.isArray(opt?.voter_ids)
                  ? opt.voter_ids.map(String)
                  : Array.isArray(opt?.voterIds)
                    ? opt.voterIds.map(String)
                    : undefined,
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

      const rawTextPayload = message.text ?? message.styledText?.text;
      const textPayload = normalizeChatSendText(rawTextPayload);
      const mediaAttachments = Array.isArray((message as any).media?.attachments)
        ? (message as any).media.attachments
        : Array.isArray(message.attachments)
        ? message.attachments
        : [];
      const normalizedMediaAttachments = mediaAttachments.length
        ? normalizeAttachments(mediaAttachments)
        : undefined;
      const mediaPayload = normalizedMediaAttachments?.length
        ? { ...((message as any).media ?? {}), attachments: normalizedMediaAttachments }
        : undefined;

      const basePayload: any = {
        conversationId: String(convId),
        kind: (message.kind as MessageKind) ?? 'text',
        clientId,
        text: textPayload,
        previewText:
          typeof textPayload === 'string'
            ? textPayload.slice(0, 200)
            : undefined,
        replyToId: message.replyToId ?? null,
        media: mediaPayload,
        contacts: normalizeContacts(message.contacts),
        poll: normalizePoll(message.poll),
        event: message.event ?? undefined,
        location: (message as any).location ?? undefined,
        styledText: message.styledText ?? null,
        sticker: message.sticker ?? null,
        voice: message.voice
          ? {
              ...message.voice,
              url: (message.voice as any).url ?? (message.voice as any).uri,
            }
          : null,
      };

      await saveDecryptedMessage(
        String(currentUserId),
        message,
        basePayload,
      ).catch(() => {});

      let payloadToSend: any;
      const isPublicRoom = (chat as any)?.kind === 'post' || (chat as any)?.kind === 'thread';
      if (E2EE_ENABLED && chat && !isPublicRoom) {
        const recipientIds = resolveE2EERecipientIds(chat as any, String(currentUserId));
        // Only encrypt when there is at least one recipient OTHER than the sender.
        // If the participants list hasn't loaded yet or this is a public open room,
        // the resolved list contains only the sender — encrypting in that case would
        // produce a message only the sender can decrypt, leaving all receivers locked.
        const selfNorm = normalizeUuid(String(currentUserId));
        const hasExternalRecipients = recipientIds.some(id => id !== selfNorm);
        if (recipientIds.length > 0 && hasExternalRecipients) {
          try {
            const { encryptionMeta } = await encryptPayloadForRecipients(
              String(currentUserId),
              recipientIds,
              basePayload,
            );
            const encryptedRecipientCount = Array.isArray(encryptionMeta?.recipients)
              ? encryptionMeta.recipients.length
              : 0;
            if (encryptedRecipientCount < recipientIds.length) {
              throw new Error(`E2EE recipient envelope missing: ${encryptedRecipientCount}/${recipientIds.length}`);
            }
            payloadToSend = {
              conversationId: String(convId),
              clientId,
              // The real kind lives inside the encrypted payload. Keep the
              // server-visible shell generic so rich encrypted messages do not
              // have to expose styledText/voice/etc. outside E2EE.
              kind: 'text',
              previewText: 'Encrypted message',
              encrypted: true,
              encryptionMeta,
            };
          } catch (encryptErr) {
            if (String((encryptErr as any)?.message ?? '').includes('Missing E2EE bundle')) {
              try {
                await repairLocalE2EEBundle(String(currentUserId));
                const { encryptionMeta } = await encryptPayloadForRecipients(
                  String(currentUserId),
                  recipientIds,
                  basePayload,
                );
                const encryptedRecipientCount = Array.isArray(encryptionMeta?.recipients)
                  ? encryptionMeta.recipients.length
                  : 0;
                if (encryptedRecipientCount >= recipientIds.length) {
                  payloadToSend = {
                    conversationId: String(convId),
                    clientId,
                    kind: 'text',
                    previewText: 'Encrypted message',
                    encrypted: true,
                    encryptionMeta,
                  };
                } else {
                  throw new Error(`E2EE recipient envelope missing after repair: ${encryptedRecipientCount}/${recipientIds.length}`);
                }
              } catch (repairErr) {
                console.warn('[E2EE] encryption failed; message remains queued locally', {
                  reactNativeDiagnostics: reactNativeDiagnostics('send.encrypt_payload', repairErr, {
                    conversationId: String(convId),
                    clientId,
                    senderUserId: currentUserId,
                    recipientIds,
                  }),
                });
                return { ok: false };
              }
            } else {
              console.warn('[E2EE] encryption failed; message remains queued locally', {
                reactNativeDiagnostics: reactNativeDiagnostics('send.encrypt_payload', encryptErr, {
                  conversationId: String(convId),
                  clientId,
                  senderUserId: currentUserId,
                  recipientIds,
                }),
              });
              return { ok: false };
            }
          }
        } else {
          // Either no recipients at all, or only the sender is resolved.
          // Both cases mean no one else can decrypt the message, so send plaintext.
          console.warn('[E2EE] no external recipients; falling back to server-encrypted send', {
            conversationId: String(convId),
            recipientIds,
            participantCount: Array.isArray((chat as any)?.participants) ? (chat as any).participants.length : 0,
          });
          payloadToSend = { ...basePayload, encrypted: false, encryptionMeta: undefined };
        }
      } else {
        payloadToSend = { ...basePayload, encrypted: false, encryptionMeta: undefined };
      }

      return new Promise<SendOverNetworkResult>(
        (resolve) => {
          const logAckDebug = (label: string, details: Record<string, any>) => {
            if (!__DEV__) return;
            console.log(`[chat.send.ack] ${label}`, {
              conversationId: payloadToSend?.conversationId,
              clientId,
              encrypted: payloadToSend?.encrypted === true,
              kind: payloadToSend?.kind,
              hasText: typeof payloadToSend?.text === 'string' && payloadToSend.text.length > 0,
              hasPreviewText: typeof payloadToSend?.previewText === 'string' && payloadToSend.previewText.length > 0,
              attachmentCount: Array.isArray(payloadToSend?.media?.attachments)
                ? payloadToSend.media.attachments.length
                : Array.isArray(payloadToSend?.attachments) ? payloadToSend.attachments.length : 0,
              recipientCount: Array.isArray(payloadToSend?.encryptionMeta?.recipients)
                ? payloadToSend.encryptionMeta.recipients.length
                : 0,
              ...details,
            });
          };

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
                logAckDebug('received', { ack, err });

                if (err) {
                  console.warn('[chat.send.debug] socket ack timeout/error', {
                    conversationId: payloadToSend?.conversationId,
                    clientId,
                    err,
                    ack,
                    serverDiagnostics: ack?.diagnostics,
                    reactNativeDiagnostics: reactNativeDiagnostics('send.socket_ack', err, {
                      conversationId: payloadToSend?.conversationId,
                      clientId,
                    }),
                    errJson: safeStringify(err),
                    ackJson: safeStringify(ack),
                  });
                  return resolve({ ok: false });
                }

                const success = ack?.ok === true;

                if (!success) {
                  console.warn('[chat.send.debug] ACK failed', {
                    conversationId: payloadToSend?.conversationId,
                    clientId,
                    ack,
                    serverDiagnostics: ack?.diagnostics,
                    reactNativeDiagnostics: reactNativeDiagnostics('send.nack', ack?.error ?? ack, {
                      conversationId: payloadToSend?.conversationId,
                      clientId,
                      ackCode: ack?.code,
                    }),
                    ackJson: safeStringify(ack),
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

    // Flush queued receipts
    const receipts = pendingReceiptsRef.current.splice(0);
    for (const r of receipts) {
      try { socket.emit('chat.receipt', r); } catch {}
    }

    // Flush queued reactions
    const reactions = pendingReactionsRef.current.splice(0);
    for (const r of reactions) {
      try { socket.emit('chat.react', r); } catch {}
    }
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

      const [msg] = await filterLocallyDeletedMessages(
        String(storageRoomId),
        [mapServerMessageRef.current(serverMsg)],
        currentUserId,
      );
      if (!msg) return;

      if (!msg.fromMe && msg.serverId) {
        emitReceiptRef.current(String(msg.conversationId), msg.serverId, 'delivered');

        // If the chat room is currently open, immediately mark as read too.
        if (mountedRef.current) {
          try {
            emitReceiptRef.current(String(msg.conversationId), msg.serverId, 'read');
          } catch (err: any) {
            console.warn('[useChatMessaging] read receipt emit failed', err?.message);
          }
        }
      }

      await replaceMessagesRef.current([...messagesRef.current, msg]);
      void decryptChatMessageRef.current(msg);

      // Gap detection: if incoming seq skips ahead, request missing messages.
      const incomingSeq = typeof serverMsg.seq === 'number' ? serverMsg.seq : undefined;
      if (incomingSeq != null && activeConv) {
        const prevSeq = lastKnownSeqRef.current[activeConv] ?? (incomingSeq - 1);
        if (incomingSeq > prevSeq + 1) {
          const haveSeqs = messagesRef.current
            .map((m) => (m as any).seq as number | undefined)
            .filter((s): s is number => typeof s === 'number');
          socket.emit(
            'chat.gap_check',
            { conversationId: activeConv, haveSeqs },
            (ack: any) => {
              const missingSeqs: number[] = ack?.data?.missingSeqs ?? [];
              if (!missingSeqs.length) return;
              socket.emit(
                'chat.gap_fill',
                { conversationId: activeConv, missingSeqs },
                async (fillAck: any) => {
                  const filled: any[] = fillAck?.data?.messages ?? [];
                  if (!filled.length) return;
                  const mapped = await filterLocallyDeletedMessages(
                    String(storageRoomId),
                    filled.map((s) => mapServerMessageRef.current(s)),
                    currentUserId,
                  );
                  if (!mapped.length) return;
                  await replaceMessagesRef.current([...messagesRef.current, ...mapped]);
                  for (const m of mapped) void decryptChatMessageRef.current(m);
                  const maxFilled = Math.max(...mapped.map((m) => (m as any).seq ?? 0));
                  if (maxFilled > (lastKnownSeqRef.current[activeConv] ?? 0)) {
                    lastKnownSeqRef.current[activeConv] = maxFilled;
                  }
                },
              );
            },
          );
        }
        if (incomingSeq > (lastKnownSeqRef.current[activeConv] ?? 0)) {
          lastKnownSeqRef.current[activeConv] = incomingSeq;
        }
      }
    };

    socket.on('chat.message', onIncomingMessage);

    const onReceipt = async (payload: any) => {
      const conversationId = payload?.conversationId;
      const messageId = payload?.messageId ?? payload?.id;
      const type = payload?.type;
      if (!conversationId || !messageId || !type) return;

      const roomId = String(storageRoomId);
      const totalParticipants: number | undefined =
        typeof payload?.totalParticipants === 'number' ? payload.totalParticipants : undefined;
      const readerId: string | undefined = payload?.userId;

      if (type !== 'read' && type !== 'delivered') return;
      try {
        const updated = await bulkUpdateMessages(roomId, (m) => {
          if (m.serverId !== messageId && m.id !== messageId) return m;
          const patch: any = { ...m };

          // Track per-reader readBy list
          if (type === 'read' && readerId) {
            const existing: any[] = (m as any).readBy ?? [];
            if (!existing.some((e: any) => e.userId === readerId)) {
              patch.readBy = [...existing, { userId: readerId, at: payload?.at ?? Date.now() }];
            } else {
              patch.readBy = existing;
            }
          }

          // For group chats, only go blue (read) when everyone has read.
          // For DMs (totalParticipants === 2 or undefined), any read receipt means blue.
          if (type === 'read') {
            const readByCount = (patch.readBy ?? (m as any).readBy ?? []).length;
            const threshold = totalParticipants ? totalParticipants - 1 : 1;
            const alreadyRead = m.status === 'read';
            if (alreadyRead || readByCount >= threshold) {
              patch.status = 'read';
            }
          } else if (type === 'delivered' && m.status !== 'read') {
            patch.status = 'delivered';
          }

          return patch;
        }, currentUserId);
        replaceMessagesRef.current(updated);
        const changed = updated.find(
          (m) => String(m.serverId ?? m.id ?? '') === String(messageId),
        );
        DeviceEventEmitter.emit('message.status', {
          conversationId,
          messageId,
          status: (changed as any)?.status,
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

      const editedAt = serverMsg.updatedAt ?? new Date().toISOString();
      const next = messagesRef.current.map((m) => {
        if (m.serverId !== id && m.id !== id) return m;
        const prevText = m.text ?? '';
        const historyEntry = prevText ? { text: prevText, editedAt } : null;
        const prevHistory = m.editHistory ?? [];
        return {
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
          updatedAt: editedAt,
          editHistory: historyEntry ? [...prevHistory, historyEntry] : prevHistory,
        };
      });

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
        currentUserId,
      ).then((updated) => replaceMessagesRef.current(updated));
    };

    socket.on('chat.message_reaction', onReaction);

    // ── Pin / unpin ────────────────────────────────────────────────────────
    const onPin = (serverMsg: any) => {
      const activeConv = conversationIdRef.current;
      if (!activeConv || String(serverMsg.conversationId) !== String(activeConv)) return;
      const id = serverMsg.messageId ?? serverMsg.id ?? serverMsg._id;
      if (!id) return;
      const pinned = serverMsg.pinned !== false; // default true
      const next = messagesRef.current.map((m) =>
        m.serverId === id || m.id === id ? { ...m, isPinned: pinned } : m,
      );
      replaceMessagesRef.current(next);
    };

    socket.on('chat.pin', onPin);
    socket.on('chat.message_pinned', onPin);

    // ── Disappearing-message setting update ───────────────────────────────
    const onDisappear = (payload: any) => {
      const activeConv = conversationIdRef.current;
      if (!activeConv || String(payload.conversationId) !== String(activeConv)) return;
      DeviceEventEmitter.emit('chat.disappear.update', {
        conversationId: String(activeConv),
        seconds: payload.seconds ?? 0,
      });
    };

    socket.on('chat.disappear.set', onDisappear);
    socket.on('chat.disappear.update', onDisappear);

    const onLocationUpdate = (payload: any) => {
      const activeConv = conversationIdRef.current;
      if (!activeConv || String(payload?.conversationId) !== String(activeConv)) return;
      const { messageId, latitude, longitude, address, expiresAt } = payload || {};
      if (!messageId) return;
      const next = messagesRef.current.map((m) =>
        m.serverId === messageId || m.id === messageId
          ? {
              ...m,
              location: {
                ...(m as any).location,
                latitude,
                longitude,
                address: address ?? (m as any).location?.address,
                isLive: true,
                expiresAt,
              },
            }
          : m,
      );
      replaceMessagesRef.current(next);
    };

    socket.on('chat.location_update', onLocationUpdate);

    return () => {
      socket.off('chat.message', onIncomingMessage);
      socket.off('chat.message_receipt', onReceipt);
      socket.off('chat.edit', onEdit);
      socket.off('chat.delete', onDelete);
      socket.off('chat.message_reaction', onReaction);
      socket.off('chat.pin', onPin);
      socket.off('chat.message_pinned', onPin);
      socket.off('chat.disappear.set', onDisappear);
      socket.off('chat.disappear.update', onDisappear);
      socket.off('chat.location_update', onLocationUpdate);
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
   * DISAPPEARING MESSAGES — delete when timer fires
   * ------------------------------------------------------------------ */

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('message.expired', async ({ messageId, conversationId: expiredConvId }: any) => {
      if (!messageId) return;
      const activeConv = conversationIdRef.current;
      if (expiredConvId && activeConv && String(expiredConvId) !== String(activeConv)) return;
      const updated = await removeMessage(String(storageRoomId), String(messageId), currentUserId).catch(() => null);
      if (updated) replaceMessagesRef.current(updated);
    });
    return () => sub.remove();
  }, [storageRoomId, currentUserId]);

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
    sendReaction: (messageId: string, emoji: string, convId?: string | null, remove?: boolean) => {
      const resolvedConvId =
        convId ??
        conversationIdRef.current ??
        String(storageRoomId);
      if (!resolvedConvId || !messageId) return;
      emitReactionRef.current(String(resolvedConvId), messageId, emoji, remove);
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
      // Optimistically add currentUserId to the voted option's voterIds
      if (currentUserId) {
        const next = messagesRef.current.map((m) => {
          if (m.id !== messageId && m.serverId !== messageId) return m;
          if (!m.poll) return m;
          return {
            ...m,
            poll: {
              ...m.poll,
              options: m.poll.options.map((opt) => {
                if (opt.id !== optionId) return opt;
                const existing = opt.voterIds ?? [];
                return existing.includes(String(currentUserId))
                  ? opt
                  : { ...opt, votes: (opt.votes ?? 0) + 1, voterIds: [...existing, String(currentUserId)] };
              }),
            },
          };
        });
        replaceMessagesRef.current(next);
      }
    },
    markMessagesRead,
    socket,
    isSocketConnected: isConnected,
    requestHistoryBatch,
    mapServerMessage,
    replaceMessages,
    localDeleteMessage: async (messageId: string) => {
      const target = messagesRef.current.find(message => {
        const identities = [
          message.id,
          message.serverId,
          message.clientId,
          (message as any).messageId,
        ]
          .filter(Boolean)
          .map(value => String(value));
        return identities.includes(String(messageId));
      });
      const targetIds = [
        target?.id,
        target?.serverId,
        target?.clientId,
        (target as any)?.messageId,
        messageId,
      ]
        .filter((value): value is string => Boolean(value))
        .map(value => String(value));
      const targetIdSet = new Set(targetIds);

      const nextMessages = messagesRef.current.filter(message => {
        const identities = [
          message.id,
          message.serverId,
          message.clientId,
          (message as any).messageId,
        ]
          .filter(Boolean)
          .map(value => String(value));
        return !identities.some(identity => targetIdSet.has(identity));
      });

      await rememberLocallyDeletedMessageIds(
        String(storageRoomId),
        targetIds,
        currentUserId,
      );
      replaceMessagesRef.current(nextMessages);

      await removeMessage(
        String(storageRoomId),
        targetIds,
        currentUserId,
      );
    },
    clearAllMessages: async () => {
      await clearMessages(String(storageRoomId), currentUserId);
      replaceMessages([]);
    },
  };
}
