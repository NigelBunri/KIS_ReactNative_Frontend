export type BroadcastEngagement = {
  reactions: number;
  comments: number;
  shares: number;
  saves: number;
};

export type BroadcastItem = {
  id: string;
  vertical: 'feeds';
  sourceType: 'feed_post';
  sourceId: string;
  creatorId: string;
  broadcastedAt: string;
  title?: string;
  body?: string;
  text?: any;
  text_doc?: any;
  text_plain?: string;
  styled_text?: any;
  attachments: any[];
  metadata: Record<string, unknown>;
  visibility: 'public' | 'community' | 'restricted' | 'private';
  engagement: BroadcastEngagement;
};

const normalizeEngagement = (value: any): BroadcastEngagement => ({
  reactions: Number(value?.reactions ?? 0),
  comments: Number(value?.comments ?? 0),
  shares: Number(value?.shares ?? 0),
  saves: Number(value?.saves ?? 0),
});

const extractId = (raw: any): string | null => {
  if (!raw) return null;
  if (typeof raw.id === 'string' && raw.id.trim()) return raw.id.trim();
  if (raw._id) return String(raw._id);
  if (raw._doc?.id) return String(raw._doc.id);
  if (raw._doc?._id) return String(raw._doc._id);
  return null;
};

export const normalizeBroadcastItem = (raw: any): BroadcastItem | null => {
  const id = extractId(raw);
  if (!id) return null;

  const broadcastedAt =
    raw.broadcastedAt ??
    raw.createdAt ??
    raw.updatedAt ??
    new Date().toISOString();

  const visibility = raw.visibility ?? 'public';

  const title =
    typeof raw.title === 'string' && raw.title.trim()
      ? raw.title.trim()
      : typeof raw.metadata?.title === 'string'
      ? raw.metadata.title
      : undefined;

  const body =
    typeof raw.body === 'string' && raw.body.trim()
      ? raw.body.trim()
      : typeof raw.text === 'string'
      ? raw.text
      : undefined;

  const textDoc =
    raw.text_doc ??
    raw.textDoc ??
    (raw.text && typeof raw.text === 'object' ? raw.text : undefined) ??
    raw.metadata?.text_doc ??
    raw.metadata?.textDoc ??
    (raw.metadata?.text && typeof raw.metadata.text === 'object'
      ? raw.metadata.text
      : undefined);
  const textPlain =
    raw.text_plain ??
    raw.textPlain ??
    raw.styled_text?.text ??
    raw.styledText?.text ??
    raw.metadata?.text_plain ??
    raw.metadata?.textPlain ??
    raw.metadata?.styled_text?.text ??
    raw.metadata?.styledText?.text ??
    body;

  return {
    id,
    vertical: 'feeds',
    sourceType: 'feed_post',
    sourceId: String(raw.sourceId ?? raw.metadata?.feedPostId ?? ''),
    creatorId: String(raw.creatorId ?? raw.metadata?.creatorId ?? ''),
    broadcastedAt,
    title,
    body,
    text: textDoc ?? body,
    text_doc: textDoc,
    text_plain: textPlain,
    styled_text:
      raw.styled_text ??
      raw.styledText ??
      raw.metadata?.styled_text ??
      raw.metadata?.styledText,
    attachments: Array.isArray(raw.attachments) ? raw.attachments : [],
    metadata: (raw.metadata ?? {}) as Record<string, unknown>,
    visibility: visibility as BroadcastItem['visibility'],
    engagement: normalizeEngagement(raw.engagement),
  };
};
