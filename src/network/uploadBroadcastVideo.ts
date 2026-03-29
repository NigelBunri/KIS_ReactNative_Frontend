import { postRequest } from '@/network/post';
import ROUTES from '@/network';

export type BroadcastVideoUploadMetadata = {
  title?: string;
  description?: string;
};

type UploadResponse = {
  success: boolean;
  message?: string;
  data?: any;
};

type UploadOptions = {
  thumbnailUri?: string;
  thumbnailName?: string;
  thumbnailType?: string;
};

const guessThumbnailMimeType = (uri?: string): string => {
  const lower = (uri ?? '').toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  return 'image/jpeg';
};

const guessThumbnailName = (uri?: string): string => {
  if (!uri) {
    return `thumbnail_${Date.now()}.jpg`;
  }
  const pathParts = uri.split('/');
  const last = pathParts[pathParts.length - 1];
  if (!last) {
    return `thumbnail_${Date.now()}.jpg`;
  }
  return last.split('?')[0] || `thumbnail_${Date.now()}.jpg`;
};

export const uploadBroadcastVideoAttachment = async (
  attachment: any,
  metadata: BroadcastVideoUploadMetadata = {},
  options: UploadOptions = {},
): Promise<UploadResponse> => {
  const uri = attachment?.uri ?? attachment?.url;
  if (!uri) {
    return { success: false, message: 'Missing video file.' };
  }
  const name = attachment?.originalName ?? attachment?.name ?? `broadcast_${Date.now()}.mp4`;
  const type = attachment?.mimeType ?? attachment?.type ?? 'video/mp4';
  const form = new FormData();
  form.append('file', {
    uri,
    name,
    type,
  } as any);
  if (options.thumbnailUri) {
    form.append('thumbnail', {
      uri: options.thumbnailUri,
      name: options.thumbnailName ?? guessThumbnailName(options.thumbnailUri),
      type: options.thumbnailType ?? guessThumbnailMimeType(options.thumbnailUri),
    } as any);
  }
  if (metadata.title) {
    form.append('title', metadata.title);
  }
  if (metadata.description) {
    form.append('description', metadata.description);
  }
  const res = await postRequest(ROUTES.broadcasts.upload, form, {
    errorMessage: 'Unable to upload video.',
  });
  if (!res.success) {
    return { success: false, message: res.message || 'Unable to upload video.' };
  }
  return { success: true, data: res.data };
};

export const mapServerVideoAttachment = (serverData: any, kind: string, fallbackThumbnail?: string) => ({
  id: serverData?.id,
  url: serverData?.video_url,
  mimeType: serverData?.mime_type ?? 'video/mp4',
  kind,
  type: serverData?.type,
  duration_seconds: serverData?.duration_seconds,
  video_category: serverData?.video_category ?? (serverData?.type === 'short' ? 'shorts' : 'videos'),
  thumbUrl: serverData?.thumbnail_url ?? fallbackThumbnail ?? null,
  transcript_segments: serverData?.transcript_segments ?? [],
  originalName: serverData?.title ?? serverData?.id,
});
