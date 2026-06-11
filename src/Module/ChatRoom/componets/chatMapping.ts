// src/screens/chat/chatMapping.ts

import type { ChatMessage } from '../chatTypes';
import { normalizeChatDisplayText } from '../safeChatText';

// Helper to map backend payload -> ChatMessage
export const mapBackendToChatMessage = (
  payload: any,
  currentUserId: string,
  roomId: string,
): ChatMessage => {
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
        (typeof localPath === 'string' && localPath ? `file://${localPath}` : '');
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
        localUri,
        localPath,
      };
    });

  const createdAtRaw =
    payload.createdAt ?? payload.created_at ?? Date.now();
  const createdAt =
    typeof createdAtRaw === 'string'
      ? createdAtRaw
      : new Date(createdAtRaw).toISOString();

  const senderIdValue =
    payload.senderId ??
    payload.sender_id ??
    payload.sender?.id ??
    payload.userId ??
    payload.user_id;
  const senderId = senderIdValue != null ? String(senderIdValue) : 'unknown';

  const rawText = payload.text ?? payload.previewText ?? payload.preview_text ?? '';
  const ciphertext = payload.ciphertext ?? undefined;
  const hasEncryptedMeta = !!(payload.encryptionMeta ?? payload.encryption_meta);
  const text = (ciphertext || hasEncryptedMeta) && String(rawText).trim().toLowerCase() === 'encrypted message'
    ? ''
    : normalizeChatDisplayText(rawText);

  const styledText = payload.styledText ?? payload.styled_text ?? undefined;

  const contacts = Array.isArray(payload.contacts)
    ? payload.contacts.map((c: any, idx: number) => ({
        id: String(c?.id ?? c?.phone ?? `contact_${idx + 1}`),
        name: String(c?.name ?? c?.display_name ?? c?.phone ?? 'Contact'),
        phone: String(c?.phone ?? c?.phoneNumber ?? ''),
      }))
    : undefined;

  const poll =
    payload.poll && typeof payload.poll === 'object'
      ? {
          id: payload.poll.id ?? undefined,
          question: String(payload.poll.question ?? ''),
          allowMultiple: !!payload.poll.allowMultiple,
          expiresAt: payload.poll.expiresAt ?? null,
          options: Array.isArray(payload.poll.options)
            ? payload.poll.options.map((opt: any, idx: number) => ({
                id: String(opt?.id ?? `opt_${idx + 1}`),
                text: String(opt?.text ?? opt?.label ?? ''),
                votes:
                  typeof opt?.votes === 'number' ? opt.votes : undefined,
              }))
            : [],
        }
      : undefined;

  const rawEvent =
    payload.event ?? payload.event_data ?? payload.eventData ?? null;
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

  const rawMedia = payload.media && typeof payload.media === 'object' ? payload.media : undefined;
  const rawAttachments = Array.isArray(rawMedia?.attachments)
    ? rawMedia.attachments
    : Array.isArray(payload.attachments)
    ? payload.attachments
    : [];
  const attachments = mapAttachments(rawAttachments);
  const media = rawMedia ? { ...rawMedia, attachments } : attachments.length ? { attachments } : undefined;

  return {
    id: String(payload.id ?? payload._id ?? payload.clientId ?? ''),
    clientId: payload.clientId ?? undefined,
    serverId: payload.id ?? payload._id ?? undefined,
    seq: typeof payload.seq === 'number' ? payload.seq : undefined,
    createdAt,
    roomId: String(payload.conversationId ?? payload.conversation_id ?? roomId),
    conversationId: String(payload.conversationId ?? payload.conversation_id ?? roomId),
    senderId,
    senderName: payload.senderName ?? payload.sender_name ?? undefined,
    fromMe: senderId !== 'unknown' && senderId === currentUserId,
    kind: payload.kind ?? 'text',
    status: 'sent',
    text,
    ciphertext,
    encryptionMeta: payload.encryptionMeta ?? payload.encryption_meta ?? undefined,
    iv: payload.iv ?? undefined,
    tag: payload.tag ?? undefined,
    aad: payload.aad ?? undefined,
    encryptionVersion: payload.encryptionVersion ?? undefined,
    encryptionKeyVersion: payload.encryptionKeyVersion ?? undefined,
    replyToId: payload.replyToId,
    attachments,
    media,
    styledText,
    contacts,
    poll,
    event,
  };
};
