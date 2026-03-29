// src/components/feeds/composer/attachments.ts

export const makeAttachment = (file: {
  uri: string;
  name?: string | null;
  type?: string | null;
  size?: number | null;
  kind?: string;
}) => ({
  id: `local_${Date.now()}_${Math.random().toString(36).slice(2)}`,
  url: file.uri,
  originalName: file.name || 'file',
  mimeType: file.type || 'application/octet-stream',
  size: file.size ?? 0,
  kind: file.kind ?? 'file',
});
