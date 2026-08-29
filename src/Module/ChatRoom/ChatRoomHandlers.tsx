// src/screens/chat/ChatRoomHandlers.ts

import { Alert, DeviceEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  uploadFileToBackend,
  isVerificationFailedError,
  AttachmentMeta,
} from './uploadFileToBackend';
import RNFS from 'react-native-fs';
import ROUTES, { NEST_API_BASE_URL } from '@/network';
import { copyUriToChatMedia, fileUriForPath, stripFileScheme } from './chatMediaStorage';
import { buildVoiceAttachment } from './voiceAttachment';
import { postRequest } from '@/network/post';
import { blockContact } from '@/screens/tabs/BlockedContactsScreen';

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

const showMediaSafetyError = (error: unknown) => {
  const message =
    error instanceof Error && error.message
      ? error.message
      : 'This media cannot be sent until it passes KIS family-safety checks.';
  Alert.alert(isVerificationFailedError(error) ? 'Media safety check' : 'Upload failed', message);
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
  linkPreview,
  viewOnce,
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
  linkPreview?: { title?: string; description?: string; image?: string; site_name?: string; url: string };
  viewOnce?: boolean;
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
  const text = draft.trim();
  if (!text || !chat) return;

  const convId = await ensureConversationId(text);
  if (!convId) return;

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
      ...(linkPreview ? { linkPreview } : {}),
      ...(viewOnce ? { viewOnce } : {}),
    });
    setReplyTo(null);

    if (dmRole === 'recipient') {
      setHasLocallyAcceptedRequest(true);
    }
  } else {
    await sendTextMessage(text, {
      kind: 'text',
      fromMe: true,
      senderId: currentUserId,
      conversationId: convId,
      ...(linkPreview ? { linkPreview } : {}),
      ...(viewOnce ? { viewOnce } : {}),
    });
  }

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
  viewOnce,
  chat,
  authToken,
  currentUserId,
  ensureConversationId,
  sendRichMessage,
  onUploadStatus,
}: {
  uri: string;
  durationMs: number;
  viewOnce?: boolean;
  chat: any;
  authToken: string | null;
  currentUserId: string;
  ensureConversationId: EnsureConversationId;
  sendRichMessage: SendRichMessage;
  onUploadStatus?: (status: 'verifying' | 'done' | 'failed' | 'verification_failed') => void;
}) => {
  if (!chat) return;
  if (!authToken) {
    Alert.alert('Not signed in', 'You need to be signed in to send voice messages.');
    return;
  }

  const deviceId = await AsyncStorage.getItem('device_id');

  const convId = await ensureConversationId('Voice message');
  if (!convId) return;

  let attachment: AttachmentMeta | null = null;

  try {
    attachment = await uploadFileToBackend({
      file: {
        uri,
        name: uri.split('/').pop() || `voice_${Date.now()}.m4a`,
        // audio/mp4 is the correctly-registered MIME for an AAC-in-M4A
        // container (what HoldToLockComposer.tsx's recorder now explicitly
        // requests on both platforms via AudioSet — see that file). The
        // previous 'audio/m4a' is a non-standard string that happened to
        // pass Django's prefix-based validation but is a worse hint for
        // players sniffing by declared type than the real registered MIME.
        type: 'audio/mp4',
      },
      // Direct-to-S3, same as every other chat attachment — voice notes
      // used to omit baseUrl and fall through to Django's legacy multipart
      // proxy (the only reason being that proxy's AI content-safety scan,
      // which images/videos/docs sent through Nest already skip too — see
      // uploadFileToBackend.ts's header comment). Nest's VoicePlaybackService
      // presigns playback GETs itself for uploads that land here now.
      baseUrl: NEST_API_BASE_URL,
      authToken,
      deviceId: deviceId || undefined,
      conversationId: String(convId),
      onStatus: (s) => {
        if (s === 'verifying' || s === 'done' || s === 'failed' || s === 'verification_failed') {
          onUploadStatus?.(s);
        }
      },
    });
  } catch (error) {
    // verification_failed: onUploadStatus already called via onStatus callback before throw
    if (!isVerificationFailedError(error)) {
      onUploadStatus?.('failed');
      showMediaSafetyError(error);
    }
    return;
  }

  onUploadStatus?.('done');
  await sendRichMessage({
    kind: 'voice',
    fromMe: true,
    senderId: currentUserId,
    conversationId: convId,
    // Deterministic from the recording's own uri (which already embeds a
    // timestamp — see HoldToLockComposer.tsx's kis-voice-${Date.now()}.m4a),
    // not a fresh random id — so a duplicate call for the SAME recording
    // (e.g. a double-tap on send before the button disables) reuses Nest's
    // existing clientId-based idempotency (messages.service.ts's
    // createIdempotentLegacy) instead of creating a second message.
    clientId: `voice_${uri.replace(/[^a-zA-Z0-9]+/g, '_')}`,
    voice: buildVoiceAttachment({ attachment, localUri: uri, durationMs }),
    // Kept as a redundant, independently-persisted copy of the same URL —
    // apps.media/Nest's AttachmentSchema already declares every field it
    // needs (unlike the pre-fix VoiceMeta), so this survives persistence
    // even if a future regression strips `voice` again. See
    // voiceAttachment.ts's resolveVoicePlaybackUri, which checks this as
    // a fallback.
    attachments: attachment ? [attachment] : [],
    ...(viewOnce ? { viewOnce } : {}),
  });

  // Safe to remove the recorded temp file now that a remote copy exists —
  // playback of THIS message no longer needs it: MessageBubble's voice
  // player falls back to the remote url automatically (and, if that url
  // has since expired, to voicePlaybackResolver's refresh-via-Nest path)
  // whenever the local file is missing. Never deletes on upload failure —
  // a failed send may be retried from the same local recording. HoldToLock
  // Composer.tsx records into RNFS.CachesDirectoryPath, which the OS may
  // also purge under storage pressure at any time — this is a proactive
  // cleanup of a file that would otherwise linger indefinitely, not the
  // only thing standing between a stale reference and a crash.
  if (attachment?.url) {
    RNFS.unlink(stripFileScheme(uri)).catch(() => {});
  }
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
  if (!chat) return false;

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
      // Direct-to-S3 — see the matching comment in handleSendVoice above.
      baseUrl: NEST_API_BASE_URL,
      authToken,
      conversationId: String(convId),
    });
  } catch (error) {
    showMediaSafetyError(error);
    return;
  }

  await sendRichMessage({
    kind: 'sticker',
    fromMe: true,
    senderId: currentUserId,
    conversationId: convId,
    sticker: {
      id: sticker.id,
      uri: attachment?.url ?? attachment?.downloadUrl ?? attachment?.displayUrl ?? sticker.uri,
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
  if (!chat) return false;

  const caption = (input?.caption ?? '').trim();
  const files = input.files ?? [];
  const stagedFiles = await Promise.all(files.map(async (file: FilesType) => {
    if (!file?.uri?.startsWith('file://')) return file;
    try {
      const targetPath = await copyUriToChatMedia(
        file.uri,
        'uploads',
        file.name,
        `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      );
      return targetPath ? { ...file, originalUri: file.uri, uri: fileUriForPath(targetPath) } : file;
    } catch {
      return file;
    }
  }));

  const deviceId = await AsyncStorage.getItem('device_id');

  const convId = await ensureConversationId(caption || 'File');
  if (!convId) return;

  const uploaded = await Promise.all(
    stagedFiles.map(async (file: FilesType) => {
      try {
        return await uploadFileToBackend({
          file,
          authToken,
          deviceId: deviceId || undefined,
          baseUrl: NEST_API_BASE_URL,
          conversationId: String(convId),
          onProgress: (progress) => {
            const progressUri = (file as any)?.originalUri ?? file?.uri;
            if (progressUri) {
              input?.onProgress?.(progressUri, progress);
            }
          },
          onStatus: (status) => {
            const progressUri = (file as any)?.originalUri ?? file?.uri;
            if (progressUri) {
              input?.onStatus?.(progressUri, status);
            }
          },
        });
      } catch (error) {
        // verification_failed: onStatus already called inside uploadFileToBackend before throw
        const progressUri = (file as any)?.originalUri ?? file?.uri;
        if (progressUri && !isVerificationFailedError(error)) {
          input?.onStatus?.(progressUri, 'failed');
          showMediaSafetyError(error);
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
    kind: caption ? 'text' : 'attachment',
    fromMe: true,
    senderId: currentUserId,
    conversationId: convId,
    text: caption || undefined,
    attachments,
    media: { attachments },
    ...(input.viewOnce ? { viewOnce: input.viewOnce } : {}),
  });

  input.onUploadedReady?.();
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

export const handleSendLocation = async ({
  location,
  chat,
  currentUserId,
  ensureConversationId,
  sendRichMessage,
}: {
  location: { latitude: number; longitude: number; address?: string; title?: string };
  chat: any;
  currentUserId: string;
  ensureConversationId: EnsureConversationId;
  sendRichMessage: SendRichMessage;
}) => {
  if (!chat) return;

  const label = location.title ?? location.address ?? 'Location';
  const convId = await ensureConversationId(`📍 ${label}`);
  if (!convId) return;

  await sendRichMessage({
    kind: 'location',
    fromMe: true,
    senderId: currentUserId,
    conversationId: convId,
    location,
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

export const handleBlockRequest = async (
  chatId?: string,
  blockedUser?: { userId: string; displayName: string },
) => {
  if (!chatId) return;

  await postRequest(ROUTES.moderation.block, {
    conversationId: chatId,
    blocked: true,
  });

  const url = `${ROUTES.chat.listConversations}${chatId}/block_chat/`;
  await postRequest(url, {});

  if (blockedUser?.userId) {
    await blockContact({
      userId: blockedUser.userId,
      displayName: blockedUser.displayName,
      blockedAt: new Date().toISOString(),
    });
    DeviceEventEmitter.emit('blocked.contacts.refresh');
  }

  notifyConversationRefresh();
};

export const handleArchiveRequest = async (conversationId?: string, archived?: boolean) => {
  if (!conversationId) return;
  const url = `${ROUTES.chat.listConversations}${conversationId}/archive/`;
  await postRequest(url, { archived: archived ?? true });
  await postRequest(ROUTES.conversations.broadcast, {
    conversationId,
    type: 'archived',
    payload: { archived: archived ?? true },
  });
};

export const handleLockConversation = async (conversationId?: string, locked?: boolean) => {
  if (!conversationId) return;
  const url = `${ROUTES.chat.listConversations}${conversationId}/lock/`;
  await postRequest(url, { locked: locked ?? true });
  await postRequest(ROUTES.conversations.broadcast, {
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
  await postRequest(ROUTES.pins.set, {
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
  await postRequest(ROUTES.moderation.mute, {
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
  const res = await postRequest(ROUTES.moderation.report, {
    conversationId,
    messageId,
    reason,
    note,
  });
  return res?.success === true || res?.ok === true;
};
