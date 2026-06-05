const METADATA_KEYS = [
  'conversationId',
  'clientId',
  'attachments',
  'media',
  'mimeType',
  'originalName',
  'downloadUrl',
  'displayUrl',
  'publicUrl',
  'localUri',
  'localPath',
  'mediaAssetId',
  'encryptionMeta',
];

const looksLikeJsonObject = (value: string) => {
  const text = value.trim();
  if (!text.startsWith('{') || !text.endsWith('}')) return false;
  return METADATA_KEYS.some((key) => text.includes(`"${key}"`) || text.includes(`${key}:`));
};

const looksLikeObjectString = (value: string) => {
  const text = value.trim();
  if (text === '[object Object]') return true;
  if (!text.startsWith('{') || !text.endsWith('}')) return false;
  return METADATA_KEYS.some((key) => text.includes(key));
};

export const normalizeChatDisplayText = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  const text = value.trim();
  if (!text) return '';
  if (looksLikeJsonObject(text) || looksLikeObjectString(text)) return '';
  return value;
};

export const normalizeChatSendText = (value: unknown): string | undefined => {
  const text = normalizeChatDisplayText(value).trim();
  return text || undefined;
};


type PreviewAttachment = {
  kind?: unknown;
  mimeType?: unknown;
  mime_type?: unknown;
  contentType?: unknown;
  content_type?: unknown;
  type?: unknown;
  originalName?: unknown;
  name?: unknown;
  fileName?: unknown;
  filename?: unknown;
};

const firstString = (...values: unknown[]): string => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim().toLowerCase();
  }
  return '';
};

export const getChatAttachments = (value: any): PreviewAttachment[] => {
  const direct = Array.isArray(value?.attachments) ? value.attachments : [];
  const media = Array.isArray(value?.media?.attachments) ? value.media.attachments : [];
  const nested = Array.isArray(value?.mediaAttachments) ? value.mediaAttachments : [];
  return [...direct, ...media, ...nested].filter(Boolean);
};

export const resolveChatAttachmentPreview = (value: any): string => {
  const attachments = getChatAttachments(value);
  const count = attachments.length;
  const first = attachments[0];
  const kind = firstString(first?.kind, first?.type, value?.kind);
  const mime = firstString(first?.mimeType, first?.mime_type, first?.contentType, first?.content_type);
  const name = firstString(first?.originalName, first?.name, first?.fileName, first?.filename);
  const label = (() => {
    if (kind === 'voice') return '🎙️ Voice message';
    if (kind === 'audio' || mime.startsWith('audio/')) return '🎧 Audio';
    if (kind === 'image' || mime.startsWith('image/')) return '🖼️ Photo';
    if (kind === 'video' || mime.startsWith('video/')) return '🎬 Video';
    if (mime.includes('pdf') || name.endsWith('.pdf')) return '📄 Document';
    if (kind === 'file' || kind === 'attachment' || count > 0) return '📎 File';
    return '';
  })();
  if (!label) return '';
  if (count > 1) return `${label} (${count})`;
  return label;
};

export const resolveChatPreviewText = (
  value: any,
  previous?: string,
  fallback = '',
): string => {
  const text = normalizeChatDisplayText(value?.text ?? value?.previewText ?? value?.preview_text ?? value);
  if (text && text.trim().toLowerCase() !== 'encrypted message') return text.trim();

  const mediaPreview = resolveChatAttachmentPreview(value);
  if (mediaPreview) return mediaPreview;

  const prev = normalizeChatDisplayText(previous);
  if (prev && prev.trim().toLowerCase() !== 'encrypted message') return prev.trim();

  const fallbackText = normalizeChatDisplayText(fallback);
  if (fallbackText && fallbackText.trim().toLowerCase() !== 'encrypted message') return fallbackText.trim();

  return '';
};
