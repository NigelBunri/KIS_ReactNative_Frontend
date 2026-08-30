import { NEST_API_BASE_URL } from '@/network';
import { uploadFileToBackend } from '@/Module/ChatRoom/uploadFileToBackend';

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

// Direct-to-S3 via Nest, with Django's duration-probe/BroadcastVideo-row/
// thumbnail work now happening via a post-confirm webhook instead of inline
// in the upload request itself — see apps/broadcasts/views_internal.py's
// ProcessBroadcastVideoUploadView (Django side) and upload-intent.service.ts's
// confirm() broadcast_video branch (Nest side). Bytes never touch Django or
// nginx's request-body limit here; only the (much smaller) presigned-PUT and
// initiate/confirm JSON round-trips do.
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

  try {
    let thumbnailAttachmentId: string | undefined;
    if (options.thumbnailUri) {
      try {
        const thumbAttachment = await uploadFileToBackend({
          file: {
            uri: options.thumbnailUri,
            name: options.thumbnailName ?? guessThumbnailName(options.thumbnailUri),
            type: options.thumbnailType ?? guessThumbnailMimeType(options.thumbnailUri),
          },
          baseUrl: NEST_API_BASE_URL,
          context: 'broadcast_video_thumbnail',
        });
        thumbnailAttachmentId = thumbAttachment?.id;
      } catch {
        // A custom thumbnail failing to upload shouldn't block the video
        // itself — Django auto-generates a frame-grab thumbnail when none
        // is supplied (see ensure_local_thumbnail on the Django side).
      }
    }

    const videoAttachment = await uploadFileToBackend({
      file: { uri, name, type },
      baseUrl: NEST_API_BASE_URL,
      context: 'broadcast_video',
      confirmExtra: {
        title: metadata.title,
        description: metadata.description,
        thumbnailAttachmentId,
      },
    });

    // mapServerVideoAttachment (below) reads Django's raw snake_case field
    // names (video_url, thumbnail_url, type, pipeline, ...) — the same
    // shape ProcessBroadcastVideoUploadView returns and this flow's confirm
    // step merges in unmodified under .raw (see uploadFileToBackend.ts).
    return { success: true, data: videoAttachment?.raw ?? videoAttachment };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Unable to upload video.' };
  }
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
  captions: serverData?.captions ?? serverData?.caption_tracks ?? [],
  processing_status: serverData?.processing_status ?? (serverData?.requires_review || serverData?.quarantined ? 'pending_review' : 'ready'),
  scan_status: serverData?.scan_status,
  quarantined: Boolean(serverData?.quarantined),
  requiresReview: Boolean(serverData?.requires_review ?? serverData?.requiresReview),
  safety: serverData?.safety,
  pipeline: serverData?.pipeline,
  originalName: serverData?.title ?? serverData?.id,
});
