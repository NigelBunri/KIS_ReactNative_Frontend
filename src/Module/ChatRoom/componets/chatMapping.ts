// src/screens/chat/chatMapping.ts

import type { ChatMessage } from '../chatTypes';

// Helper to map backend payload -> ChatMessage
export const mapBackendToChatMessage = (
  payload: any,
  currentUserId: string,
  roomId: string,
): ChatMessage => {
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

  const createdAtRaw =
    payload.createdAt ?? payload.created_at ?? Date.now();
  const createdAt =
    typeof createdAtRaw === 'string'
      ? createdAtRaw
      : new Date(createdAtRaw).toISOString();

  const rawText = payload.text ?? '';
  const ciphertext = payload.ciphertext ?? undefined;
  const hasEncryptedMeta = !!(payload.encryptionMeta ?? payload.encryption_meta);
  const text = rawText || (ciphertext || hasEncryptedMeta ? 'Encrypted message' : '');

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

  return {
    id: String(payload.id ?? payload._id ?? Date.now().toString()),
    clientId: payload.clientId ?? undefined,
    serverId: payload.id ?? payload._id ?? undefined,
    seq: typeof payload.seq === 'number' ? payload.seq : undefined,
    createdAt,
    roomId: String(payload.conversationId ?? payload.conversation_id ?? roomId),
    conversationId: String(payload.conversationId ?? payload.conversation_id ?? roomId),
    senderId: String(payload.senderId ?? 'unknown'),
    senderName: payload.senderName ?? undefined,
    fromMe: String(payload.senderId ?? '') === currentUserId,
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
    attachments: payload.attachments
      ? mapAttachments(payload.attachments)
      : [],
    styledText,
    contacts,
    poll,
    event,
  };
};
