// src/screens/chat/useChatSocket.ts

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { CHAT_WS_URL, CHAT_WS_PATH } from '@/network';
import type { ChatMessage } from '../chatTypes';

import RNFS from 'react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage';

/* -------------------------------------------------------------------------- */
/*                                   STICKERS                                 */
/* -------------------------------------------------------------------------- */

// Same key as in StickerEditor
const STICKER_STORAGE_KEY = 'KIS_STICKER_LIBRARY_V1';
const STICKER_DIR = `${RNFS.DocumentDirectoryPath}/stickers`;

type IncomingStickerPayload = {
  id: string;
  uri: string;
  text?: string;
  width?: number;
  height?: number;
};

async function ensureStickerDir() {
  try {
    const exists = await RNFS.exists(STICKER_DIR);
    if (!exists) {
      await RNFS.mkdir(STICKER_DIR);
    }
  } catch (err) {
    console.warn('[useChatSocket] Failed to ensure sticker directory', err);
  }
}

/**
 * Download the sticker PNG (if remote) and store it locally
 * so StickerPicker can reuse it.
 */
async function cacheStickerFromRemote(sticker: IncomingStickerPayload) {
  try {
    if (!sticker.uri || !sticker.uri.startsWith('http')) return;

    await ensureStickerDir();

    const fileName = `${sticker.id}.png`;
    const localPath = `${STICKER_DIR}/${fileName}`;

    if (!(await RNFS.exists(localPath))) {
      const res = await RNFS.downloadFile({
        fromUrl: sticker.uri,
        toFile: localPath,
      }).promise;

      if (res.statusCode && res.statusCode >= 400) {
        console.warn('[useChatSocket] Sticker download failed', res.statusCode);
        return;
      }
    }

    const localUri = `file://${localPath}`;
    const existingRaw = await AsyncStorage.getItem(STICKER_STORAGE_KEY);

    let list: any[] = [];
    if (existingRaw) {
      try {
        list = JSON.parse(existingRaw);
      } catch {
        list = [];
      }
    }

    const record = {
      id: sticker.id,
      uri: localUri,
      text: sticker.text,
      fileType: 'kis-sticker',
      mimeType: 'image/png',
      extension: '.png',
      metaPath: localPath,
    };

    const idx = list.findIndex((s) => s.id === sticker.id);
    if (idx >= 0) list[idx] = record;
    else list.unshift(record);

    await AsyncStorage.setItem(
      STICKER_STORAGE_KEY,
      JSON.stringify(list),
    );
  } catch (err) {
    console.warn('[useChatSocket] cacheStickerFromRemote error', err);
  }
}

/* -------------------------------------------------------------------------- */
/*                          BACKEND → UI MESSAGE MAP                           */
/* -------------------------------------------------------------------------- */

type BackendMessage = {
  id: string;
  conversationId: string;
  roomId?: string;
  senderId: string;
  senderName?: string | null;

  ciphertext?: string;
  encryptionMeta?: Record<string, any>;
  text?: string;

  attachments?: any[];

  kind?:
    | 'text'
    | 'voice'
    | 'styled_text'
    | 'sticker'
    | 'contacts'
    | 'poll'
    | 'event'
    | 'system';

  voice?: any;
  styledText?: any;
  sticker?: any;
  contacts?: any[];
  poll?: any;
  event?: any;

  createdAt: string | number;
  replyToId?: string | null;

  isDeleted?: boolean;
  isPinned?: boolean;
  status?: string;

  clientId?: string | null;
  serverId?: string | null;
  seq?: number;
};

function mapBackendToChatMessage(
  raw: BackendMessage,
  currentUserId: string,
  roomId: string,
): ChatMessage {
  const senderId = raw.senderId != null ? String(raw.senderId) : '';
  const fromMe = senderId !== '' && senderId === String(currentUserId);

  const createdAt =
    typeof raw.createdAt === 'string'
      ? raw.createdAt
      : new Date(raw.createdAt).toISOString();

  const rawText = raw.text ?? '';
  const ciphertext = raw.ciphertext ?? undefined;
  const hasEncryptedMeta = !!(raw.encryptionMeta ?? (raw as any).encryption_meta);
  const text = rawText || (ciphertext || hasEncryptedMeta ? 'Encrypted message' : undefined);

  return {
    id: raw.id,
    clientId: raw.clientId ?? raw.id,
    seq: typeof raw.seq === 'number' ? raw.seq : undefined,

    conversationId: raw.conversationId,
    roomId: roomId || raw.conversationId,

    createdAt,
    senderId,
    senderName: raw.senderName ?? undefined,
    fromMe,

    kind: raw.kind,
    status: raw.status as ChatMessage['status'] | undefined,

    text,
    ciphertext,
    encryptionMeta: raw.encryptionMeta ?? (raw as any).encryption_meta ?? undefined,

    voice: raw.voice,
    styledText: raw.styledText,
    sticker: raw.sticker,

    attachments: raw.attachments,
    contacts: raw.contacts?.length ? raw.contacts : undefined,
    poll: raw.poll,
    event: raw.event,

    replyToId: raw.replyToId ?? undefined,
    isDeleted: raw.isDeleted ?? false,
    isPinned: raw.isPinned ?? false,
  };
}

/* -------------------------------------------------------------------------- */
/*                                   HOOK API                                  */
/* -------------------------------------------------------------------------- */

type UseChatSocketParams = {
  authToken: string | null;
  roomId: string;
  currentUserId: string;
  replaceMessages: (messages: ChatMessage[]) => void;
  messagesRef: React.MutableRefObject<ChatMessage[]>;
};

export const useChatSocket = ({
  authToken,
  roomId,
  currentUserId,
  replaceMessages,
  messagesRef,
}: UseChatSocketParams) => {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  /* ------------------------------ SEND MESSAGE ----------------------------- */
  const sendMessage = useCallback(
    (payload: Partial<ChatMessage>) => {
      if (!socketRef.current || !isConnected) return;

      const clientId = payload.clientId;

      socketRef.current.emit('chat.send', {
        conversationId: roomId,
        clientId,
        kind: payload.kind ?? 'text',
        text: payload.text ?? payload.styledText?.text,
        styledText: payload.styledText ?? null,
        voice: payload.voice ?? null,
        sticker: payload.sticker ?? null,
        contacts: payload.contacts ?? null,
        poll: payload.poll ?? null,
        event: payload.event ?? null,
        attachments: payload.attachments ?? [],
        replyToId: payload.replyToId ?? null,
      });
    },
    [isConnected, roomId],
  );

  /* ------------------------------- SOCKET CORE ------------------------------ */
  useEffect(() => {
    if (!authToken) return;

    let active = true;

    const connect = async () => {
      const deviceIdKey = 'device_id';
      const deviceId = await AsyncStorage.getItem(deviceIdKey);
      if (!active) return;

      const socket = io(CHAT_WS_URL, {
        path: CHAT_WS_PATH,
        transports: ['websocket'],
        extraHeaders: {
          Authorization: `Bearer ${authToken}`,
          'x-device-id': deviceId ?? '',
        },
        auth: { token: authToken, deviceId: deviceId ?? undefined },
      });

      socketRef.current = socket;

      socket.on('connect', () => {
        setIsConnected(true);

        socket.emit('chat.join', { conversationId: roomId });
      });

      socket.on('disconnect', () => {
        setIsConnected(false);
      });

      socket.on('chat.message', (payload: BackendMessage) => {
        const payloadConv = payload?.conversationId ?? payload?.roomId;
        if (
          payloadConv != null &&
          String(payloadConv) !== String(roomId)
        ) {
          return;
        }

        if (payload?.sticker?.uri) {
          cacheStickerFromRemote(payload.sticker);
        }

        const mapped = mapBackendToChatMessage(
          payload,
          currentUserId,
          roomId,
        );

        const current = messagesRef.current || [];

        // de-dupe by server id OR clientId
        if (
          current.some(
            (m) =>
              m.id === mapped.id ||
              (mapped.clientId && m.clientId === mapped.clientId),
          )
        ) {
          return;
        }

        replaceMessages([...current, mapped]);
      });
    };

    connect();

    return () => {
      active = false;
      const socket = socketRef.current;
      try {
        socket?.emit('chat.leave', { conversationId: roomId });
      } catch {}
      socket?.disconnect();
      socketRef.current = null;
    };
  }, [authToken, roomId, currentUserId, replaceMessages, messagesRef]);

  /* -------------------------------------------------------------------------- */

  return {
    isConnected,
    socketRef,
    sendMessage,
  };
};
