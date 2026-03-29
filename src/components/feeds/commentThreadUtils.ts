export type CommentMessage = {
  id: string;
  clientId?: string;
  text: string;
  senderName: string;
  senderId?: string;
  createdAt: string;
  mine?: boolean;
  replyToId?: string | null;
};

export const ChatEvents = {
  JOIN: 'chat.join',
  LEAVE: 'chat.leave',
  SEND: 'chat.send',
  MESSAGE: 'chat.message',
  HISTORY: 'chat.history',
} as const;

export const parseCommentTimestamp = (value?: string) => {
  if (!value) return 0;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return 0;
  return parsed;
};

export const mapCommentPayload = (
  payload: any,
  conversationId?: string | null,
  currentUserId?: string | null,
): CommentMessage => {
  const text =
    payload?.text ??
    payload?.message ??
    payload?.styled_text?.text ??
    payload?.previewText ??
    payload?.preview ??
    '';
  const id =
    payload?.id ??
    payload?.serverId ??
    payload?.messageId ??
    payload?.clientId ??
    `${conversationId ?? 'thread'}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const senderId =
    payload?.senderId ??
    payload?.sender?.id ??
    payload?.sender_id ??
    payload?.userId ??
    payload?.user?.id ??
    payload?.user?.pk;
  const senderName =
    payload?.senderName ??
    payload?.sender?.display_name ??
    payload?.sender?.name ??
    payload?.user?.display_name ??
    payload?.user?.name ??
    'Someone';
  const createdAt =
    payload?.createdAt ??
    payload?.created_at ??
    payload?.created ??
    payload?.timestamp ??
    new Date().toISOString();
  const mine =
    senderId && currentUserId ? String(senderId) === String(currentUserId) : false;
  const replyToId =
    payload?.replyToId ??
    payload?.reply_to_id ??
    payload?.reply_to ??
    payload?.replyTo ??
    null;
  return {
    id: String(id),
    clientId: payload?.clientId,
    text: String(text ?? ''),
    senderName: String(senderName),
    senderId: senderId ? String(senderId) : undefined,
    createdAt,
    mine,
    replyToId: replyToId ? String(replyToId) : null,
  };
};
