import { resolveBackendAssetUrl } from '@/network';

type AttachmentSource = string | Record<string, any> | null | undefined;

const pickFirst = (source: Record<string, any>, keys: string[]) => {
  for (const key of keys) {
    const value = source?.[key];
    if (value) return value;
  }
  return null;
};

const normalizeUrl = (value: unknown) => {
  if (!value) return null;
  const str = typeof value === 'string' ? value : String(value);
  return resolveBackendAssetUrl(str) ?? null;
};

export type AttachmentPreviewInfo = {
  previewUri: string | null;
  isVideo: boolean;
  isImage: boolean;
  label: string;
  typeLabel: string;
  url: string | null;
};

const buildAttachmentIdentity = (info: AttachmentPreviewInfo) => {
  const primaryUrl = info.url ?? info.previewUri ?? '';
  const previewUrl = info.previewUri ?? '';
  const kind = info.isVideo ? 'video' : info.isImage ? 'image' : info.typeLabel;
  return `${kind}::${primaryUrl}::${previewUrl}`;
};

export const getAttachmentPreviewInfo = (attachment: AttachmentSource): AttachmentPreviewInfo => {
  if (!attachment) {
    return {
      previewUri: null,
      isVideo: false,
      isImage: false,
      label: 'Attachment',
      typeLabel: 'FILE',
      url: null,
    };
  }

  const source =
    typeof attachment === 'string'
      ? { url: attachment }
      : attachment;

  const urlCandidate = pickFirst(source, [
    'url',
    'uri',
    'file_url',
    'fileUrl',
    'preview_url',
    'previewUrl',
    'path',
    'value',
  ]);
  const resolvedUrl = normalizeUrl(urlCandidate);

  const thumbCandidate = pickFirst(source, [
    'thumbUrl',
    'thumb_url',
    'thumbnail',
    'thumb',
    'preview_url',
    'previewUrl',
  ]);

  const previewUri = normalizeUrl(thumbCandidate) ?? resolvedUrl;

  const typeHint =
    pickFirst(source, ['media_type', 'mime_type', 'kind', 'type']) ?? 'file';
  const kind = String(typeHint).toLowerCase();
  const isVideo = kind.includes('video') || kind.includes('mp4');
  const isImage = kind.includes('image');

  const label =
    pickFirst(source, ['label', 'name', 'title']) ||
    (resolvedUrl ? resolvedUrl.split('/').pop() ?? 'Attachment' : 'Attachment');

  const typeLabel = isVideo ? 'VIDEO' : isImage ? 'IMAGE' : kind.toUpperCase() || 'FILE';

  return {
    previewUri: previewUri && (isImage || thumbCandidate) ? previewUri : null,
    isVideo,
    isImage,
    label,
    typeLabel,
    url: resolvedUrl,
  };
};

export const dedupeAttachmentPreviews = (previews: AttachmentPreviewInfo[]): AttachmentPreviewInfo[] => {
  const seen = new Set<string>();
  const unique: AttachmentPreviewInfo[] = [];
  for (const preview of previews) {
    const identity = buildAttachmentIdentity(preview);
    if (seen.has(identity)) continue;
    seen.add(identity);
    unique.push(preview);
  }
  return unique;
};

export const isVideoAttachment = (attachment: AttachmentSource): boolean => {
  if (!attachment) return false;
  const source =
    typeof attachment === 'string'
      ? { url: attachment }
      : attachment;
  const typeHint =
    pickFirst(source, ['media_type', 'mime_type', 'kind', 'type']) ?? 'file';
  const kind = String(typeHint).toLowerCase();
  return kind.includes('video') || kind.includes('mp4');
};
