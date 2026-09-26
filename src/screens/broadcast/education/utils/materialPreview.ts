// src/screens/broadcast/education/utils/materialPreview.ts
//
// Pure helpers extracted from EducationDetailSheet's inline material
// viewer (Education UX v2, Phase 2) so LearningPlayerScreen can render
// the same rich inline video/PDF/image preview instead of falling back
// to Linking.openURL, without duplicating the kind/mime inference logic.
export const toText = (value: any) => String(value ?? '').trim();

export const inferMaterialMime = (payload: any) => {
  const rawMime = toText(
    payload?.resource_mime_type || payload?.resource_type || payload?.mime_type,
  ).toLowerCase();
  if (rawMime) return rawMime;
  const source = toText(
    payload?.resource_name || payload?.name || payload?.title || payload?.resource_url,
  ).toLowerCase();
  if (source.endsWith('.pdf')) return 'application/pdf';
  if (/\.(png|jpg|jpeg|gif|webp|bmp|heic|heif|svg)$/.test(source)) return 'image/*';
  if (/\.(mp4|mov|m4v|webm|avi|mkv|m3u8)$/.test(source)) return 'video/*';
  if (/\.(mp3|wav|aac|m4a|ogg|oga|flac)$/.test(source)) return 'audio/*';
  return toText(payload?.kind).toLowerCase();
};

export const inferMaterialKind = (payload: any) => {
  const mime = inferMaterialMime(payload);
  if (mime.includes('image')) return 'image';
  if (mime.includes('video')) return 'video';
  if (mime.includes('audio')) return 'audio';
  if (mime.includes('pdf')) return 'pdf';
  return toText(payload?.kind).toLowerCase() || 'document';
};

export const buildProtectedSource = (uri?: string | null, headers?: Record<string, string>) => {
  if (!uri) return undefined;
  if (headers && Object.keys(headers).length > 0) {
    return { uri, headers };
  }
  return { uri };
};
