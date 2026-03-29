// src/screens/chat/ChatRoomHandlers.ts

import { DeviceEventEmitter } from 'react-native';
import {
  uploadFileToBackend,
  AttachmentMeta,
} from './uploadFileToBackend';
import ROUTES, { NEST_API_BASE_URL } from '@/network';
import { postRequest } from '@/network/post';

import type { ChatMessage } from './chatTypes';

import type {
  AttachmentFilePayload,
  FilesType,
} from './ChatRoomPage';

import { SimpleContact } from './componets/main/ForAttachments/ContactsModal';
import { PollDraft } from './componets/main/ForAttachments/PollModal';
import { EventDraft } from './componets/main/ForAttachments/EventModal';
import { Sticker } from './componets/main/FroSticker/StickerEditor';
import { TextCardPayload } from './componets/main/TextCardComposer';

/* =========================================================
   SHARED TYPES
========================================================= */

type EnsureConversationId = (
  preview: string,
) => Promise<string | null>;

type SendRichMessage = (payload: any) => Promise<void>;
type SendTextMessage = (text: string, meta: any) => Promise<void>;

const notifyConversationRefresh = () => {
  DeviceEventEmitter.emit('conversation.refresh');
};

/* =========================================================
   SEND TEXT / EDIT / REPLY
========================================================= */

export const handleSend = async ({
  draft,
  chat,
  editing,
  replyTo,
  currentUserId,
  draftKey,
  dmRole,
  ensureConversationId,
  editMessage,
  replyToMessage,
  sendTextMessage,
  setDraft,
  setDraftsByKey,
  setEditing,
  setReplyTo,
  setHasLocallyAcceptedRequest,
}: {
  draft: string;
  chat: any;
  editing: ChatMessage | null;
  replyTo: ChatMessage | null;
  currentUserId: string;
  draftKey: string;
  dmRole: 'initiator' | 'recipient' | null;
  ensureConversationId: EnsureConversationId;
  editMessage: Function;
  replyToMessage: Function;
  sendTextMessage: SendTextMessage;
  setDraft: (v: string) => void;
  setDraftsByKey: Function;
  setEditing: (v: ChatMessage | null) => void;
  setReplyTo: (v: ChatMessage | null) => void;
  setHasLocallyAcceptedRequest: (v: boolean) => void;
}) => {
   console.log("I am chcking for messagein here: ", chat)
  const text = draft.trim();
  if (!text || !chat) return;
  
 console.log("I am chcking for messagein here 333: ", chat)
  const convId = await ensureConversationId(text);
  if (!convId) return;
console.log("I am chcking for messagein here 4444: ", chat)
  if (editing) {
    await editMessage(editing.id, {
      text,
      isEdited: true,
      status: 'pending',
      conversationId: convId,
    });
    setEditing(null);
  } else if (replyTo) {
    await replyToMessage(replyTo, text, {
      kind: 'text',
      fromMe: true,
      senderId: currentUserId,
      conversationId: convId,
    });
    setReplyTo(null);

    if (dmRole === 'recipient') {
      setHasLocallyAcceptedRequest(true);
    }
  } else {

    console.log("I am chcking for messagein here 55555: ", chat)

    await sendTextMessage(text, {
      kind: 'text',
      fromMe: true,
      senderId: currentUserId,
      conversationId: convId,
    });
  }

  console.log("I am chcking for messagein here 666: ", chat)

  setDraft('');
  setDraftsByKey((prev: any) => ({
    ...prev,
    [draftKey]: '',
  }));
};

/* =========================================================
   CUSTOM / STYLED TEXT (TEXT CARD)
========================================================= */

export const handleSendStyledText = async ({
  payload,
  chat,
  currentUserId,
  ensureConversationId,
  sendRichMessage,
  setTextCardBg,
}: {
  payload: TextCardPayload;
  chat: any;
  currentUserId: string;
  ensureConversationId: EnsureConversationId;
  sendRichMessage: SendRichMessage;
  setTextCardBg: (v: string | null) => void;
}) => {
  if (!chat) return;

  const preview = payload.text || 'Styled message';
  const convId = await ensureConversationId(preview);
  if (!convId) return;

  await sendRichMessage({
    kind: 'styled_text',
    fromMe: true,
    senderId: currentUserId,
    conversationId: convId,
    styledText: {
      text: payload.text,
      backgroundColor: payload.backgroundColor,
      fontColor: payload.fontColor,
      fontSize: payload.fontSize,
      fontFamily: payload.fontFamily,
    },
  });

  setTextCardBg(null);
};

/* =========================================================
   VOICE
========================================================= */

export const handleSendVoice = async ({
  uri,
  durationMs,
  chat,
  authToken,
  currentUserId,
  ensureConversationId,
  sendRichMessage,
}: {
  uri: string;
  durationMs: number;
  chat: any;
  authToken: string | null;
  currentUserId: string;
  ensureConversationId: EnsureConversationId;
  sendRichMessage: SendRichMessage;
}) => {
  if (!chat || !authToken) return;

  const convId = await ensureConversationId('Voice message');
  if (!convId) return;

  let attachment: AttachmentMeta | null = null;

  try {
    attachment = await uploadFileToBackend({
      file: {
        uri,
        name: uri.split('/').pop() || `voice_${Date.now()}.m4a`,
        type: 'audio/m4a',
      },
      authToken,
      conversationId: String(convId),
    });
  } catch {}

  await sendRichMessage({
    kind: 'voice',
    fromMe: true,
    senderId: currentUserId,
    conversationId: convId,
    voice: {
      url: attachment?.url ?? uri,
      durationMs,
    },
    attachments: attachment ? [attachment] : [],
  });
};

/* =========================================================
   STICKER
========================================================= */

export const handleSendSticker = async ({
  sticker,
  chat,
  authToken,
  currentUserId,
  ensureConversationId,
  sendRichMessage,
}: {
  sticker: Sticker;
  chat: any;
  authToken: string | null;
  currentUserId: string;
  ensureConversationId: EnsureConversationId;
  sendRichMessage: SendRichMessage;
}) => {
  if (!chat || !authToken) return;

  const convId = await ensureConversationId('Sticker');
  if (!convId) return;

  let attachment: AttachmentMeta | null = null;

  try {
    attachment = await uploadFileToBackend({
      file: {
        uri: sticker.uri,
        name: `${sticker.id}.png`,
        type: 'image/png',
      },
      authToken,
      conversationId: String(convId),
    });
  } catch {}

  await sendRichMessage({
    kind: 'sticker',
    fromMe: true,
    senderId: currentUserId,
    conversationId: convId,
    sticker: {
      id: sticker.id,
      uri: attachment?.url ?? sticker.uri,
      text: sticker.text,
    },
    attachments: attachment ? [attachment] : [],
  });
};

/* =========================================================
   ATTACHMENTS
========================================================= */

export const handleSendAttachment = async ({
  input,
  chat,
  authToken,
  currentUserId,
  ensureConversationId,
  sendRichMessage,
}: {
  input: AttachmentFilePayload;
  chat: any;
  authToken: string | null;
  currentUserId: string;
  ensureConversationId: EnsureConversationId;
  sendRichMessage: SendRichMessage;
}) => {
  if (!chat || !authToken) return;

  const caption = (input?.caption ?? '').trim();
  const files = input.files ?? [];

  const convId = await ensureConversationId(caption || 'File');
  if (!convId) return;

  const uploaded = await Promise.all(
    files.map(async (file: FilesType) => {
      try {
        return await uploadFileToBackend({
          file,
          authToken,
          conversationId: String(convId),
          onProgress: (progress) => {
            if (file?.uri) {
              input?.onProgress?.(file.uri, progress);
            }
          },
          onStatus: (status) => {
            if (file?.uri) {
              input?.onStatus?.(file.uri, status);
            }
          },
        });
      } catch {
        if (file?.uri) {
          input?.onStatus?.(file.uri, 'failed');
        }
        return null;
      }
    }),
  );

  const attachments = uploaded.filter(Boolean);
  const hasFailures = uploaded.some((item) => !item);

  if (hasFailures) return false;
  if (!attachments.length && !caption) return false;

  await sendRichMessage({
    kind: 'text',
    fromMe: true,
    senderId: currentUserId,
    conversationId: convId,
    text: caption || undefined,
    attachments,
  });
  return true;
};

/* =========================================================
   CONTACTS / POLL / EVENT
========================================================= */

export const handleSendContacts = async ({
  contacts,
  chat,
  currentUserId,
  ensureConversationId,
  sendRichMessage,
}: {
  contacts: SimpleContact[];
  chat: any;
  currentUserId: string;
  ensureConversationId: EnsureConversationId;
  sendRichMessage: SendRichMessage;
}) => {
  if (!chat || !contacts.length) return;

  const convId = await ensureConversationId(
    `Contact: ${contacts[0].name}`,
  );
  if (!convId) return;

  await sendRichMessage({
    kind: 'contacts',
    fromMe: true,
    senderId: currentUserId,
    conversationId: convId,
    contacts: contacts.map((c, idx) => ({
      id: String(c?.id ?? c?.phone ?? `contact_${idx + 1}`),
      name: String(c?.name ?? c?.phone ?? 'Contact'),
      phone: String(c?.phone ?? ''),
    })),
  });
};

export const handleCreatePoll = async ({
  poll,
  chat,
  currentUserId,
  ensureConversationId,
  sendRichMessage,
}: {
  poll: PollDraft;
  chat: any;
  currentUserId: string;
  ensureConversationId: EnsureConversationId;
  sendRichMessage: SendRichMessage;
}) => {
  if (!chat) return;

  const convId = await ensureConversationId(poll.question || 'Poll');
  if (!convId) return;

  await sendRichMessage({
    kind: 'poll',
    fromMe: true,
    senderId: currentUserId,
    conversationId: convId,
    poll: {
      question: poll.question,
      options: poll.options.map((opt, idx) => ({
        id: `opt_${idx + 1}`,
        text: opt,
      })),
    },
  });
};

export const handleCreateEvent = async ({
  event,
  chat,
  currentUserId,
  ensureConversationId,
  sendRichMessage,
}: {
  event: EventDraft;
  chat: any;
  currentUserId: string;
  ensureConversationId: EnsureConversationId;
  sendRichMessage: SendRichMessage;
}) => {
  if (!chat) return;

  const convId = await ensureConversationId(event.title || 'Event');
  if (!convId) return;

  await sendRichMessage({
    kind: 'event',
    fromMe: true,
    senderId: currentUserId,
    conversationId: convId,
    event,
  });
};

/* =========================================================
   REQUEST ACTIONS
========================================================= */

export const handleAcceptRequest = async ({
  chat,
  currentUserId,
  ensureConversationId,
  sendTextMessage,
  setHasLocallyAcceptedRequest,
}: {
  chat: any;
  currentUserId: string;
  ensureConversationId: EnsureConversationId;
  sendTextMessage: SendTextMessage;
  setHasLocallyAcceptedRequest: (v: boolean) => void;
}) => {
  if (!chat) return;

  const convId = await ensureConversationId('Accept chat request');
  if (!convId) return;

  await sendTextMessage('Accepted chat request', {
    kind: 'text',
    fromMe: true,
    senderId: currentUserId,
    conversationId: convId,
  });

  setHasLocallyAcceptedRequest(true);
};

export const handleBlockRequest = async (chatId?: string) => {
  if (!chatId) return;

  const moderationUrl = `${NEST_API_BASE_URL}/moderation/block`;
  await postRequest(moderationUrl, {
    conversationId: chatId,
    blocked: true,
  });

  const url = `${ROUTES.chat.listConversations}${chatId}/block_chat/`;
  await postRequest(url, {});
  notifyConversationRefresh();
};

export const handleArchiveRequest = async (conversationId?: string, archived?: boolean) => {
  if (!conversationId) return;
  const url = `${ROUTES.chat.listConversations}${conversationId}/archive/`;
  await postRequest(url, { archived: archived ?? true });
  await postRequest(`${NEST_API_BASE_URL}/conversations/broadcast`, {
    conversationId,
    type: 'archived',
    payload: { archived: archived ?? true },
  });
};

export const handleLockConversation = async (conversationId?: string, locked?: boolean) => {
  if (!conversationId) return;
  const url = `${ROUTES.chat.listConversations}${conversationId}/lock/`;
  await postRequest(url, { locked: locked ?? true });
  await postRequest(`${NEST_API_BASE_URL}/conversations/broadcast`, {
    conversationId,
    type: 'locked',
    payload: { locked: locked ?? true },
  });
};

export const handleAcceptConversationRequest = async (chatId?: string) => {
  if (!chatId) return;
  const url = `${ROUTES.chat.listConversations}${chatId}/accept-request/`;
  await postRequest(url, {});
  notifyConversationRefresh();
};

export const handleAddGroupMember = async ({
  conversationId,
  userId,
  baseRole,
}: {
  conversationId?: string;
  userId?: string;
  baseRole?: string;
}) => {
  if (!conversationId || !userId) return;
  const url = `${ROUTES.chat.listConversations}${conversationId}/members/`;
  await postRequest(url, {
    user_id: userId,
    base_role: baseRole ?? 'member',
  });
};

export const handleRemoveGroupMember = async ({
  conversationId,
  userId,
}: {
  conversationId?: string;
  userId?: string;
}) => {
  if (!conversationId || !userId) return;
  const url = `${ROUTES.chat.listConversations}${conversationId}/members/remove/`;
  await postRequest(url, { user_id: userId });
};

export const handleSetGroupMemberRole = async ({
  conversationId,
  userId,
  baseRole,
}: {
  conversationId?: string;
  userId?: string;
  baseRole?: string;
}) => {
  if (!conversationId || !userId || !baseRole) return;
  const url = `${ROUTES.chat.listConversations}${conversationId}/members/role/`;
  await postRequest(url, { user_id: userId, base_role: baseRole });
};

export const handleSetPinned = async ({
  conversationId,
  messageId,
  pinned,
}: {
  conversationId?: string;
  messageId?: string;
  pinned: boolean;
}) => {
  if (!conversationId || !messageId) return;
  const url = `${NEST_API_BASE_URL}/pins/set`;
  await postRequest(url, {
    conversationId,
    messageId,
    pinned,
  });
};

export const handleMuteConversation = async ({
  conversationId,
  muted,
  untilMs,
}: {
  conversationId?: string;
  muted: boolean;
  untilMs?: number;
}) => {
  if (!conversationId) return;
  const url = `${NEST_API_BASE_URL}/moderation/mute`;
  await postRequest(url, {
    conversationId,
    muted,
    untilMs,
  });
  notifyConversationRefresh();
};

export const handleReportMessage = async ({
  conversationId,
  messageId,
  reason,
  note,
}: {
  conversationId?: string;
  messageId?: string;
  reason?: string;
  note?: string;
}) => {
  if (!conversationId || !messageId) return;
  const url = `${NEST_API_BASE_URL}/moderation/report`;
  const res = await postRequest(url, {
    conversationId,
    messageId,
    reason,
    note,
  });
  return res?.success === true || res?.ok === true;
};
