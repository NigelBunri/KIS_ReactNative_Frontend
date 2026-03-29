import { Alert } from 'react-native';
import { uploadBroadcastVideoAttachment, mapServerVideoAttachment } from '@/network/uploadBroadcastVideo';
import { FeedComposerPayload } from '@/components/feeds/FeedComposerSheet';

const isRemoteUrl = (value?: string | null) =>
  typeof value === 'string' && /^https?:\/\//i.test(value);

const hasLocalVideoAttachment = (attachment: any) => {
  const uri = attachment?.uri ?? attachment?.url;
  if (!uri || isRemoteUrl(uri)) return false;
  const normalized = (attachment?.kind ?? attachment?.mimeType ?? attachment?.type ?? '').toLowerCase();
  return normalized.includes('video');
};

const getLocalThumbnailUri = (attachment: any): string | undefined => {
  const thumbUri = attachment?.thumbUrl ?? attachment?.thumbnail_url ?? attachment?.thumbnailUrl ?? null;
  if (!thumbUri || isRemoteUrl(thumbUri)) {
    return undefined;
  }
  return thumbUri;
};

export const prepareBroadcastVideoPayload = async (payload: FeedComposerPayload) => {
  const attachments = Array.isArray(payload.attachments) ? payload.attachments : [];
  if (!attachments.length) return payload;
  const attachment = attachments[0];
  const isComposerVideo =
    payload.composerType === 'video' || payload.composerType === 'short_video';
  if (!isComposerVideo && !hasLocalVideoAttachment(attachment)) {
    return payload;
  }
  if (!hasLocalVideoAttachment(attachment)) {
    return payload;
  }
  const plainText = payload.textPlain ?? payload.text ?? '';
  const metadata = {
    title: plainText,
    description: plainText,
  };
  const thumbnailUri = getLocalThumbnailUri(attachment);
  const uploadResult = await uploadBroadcastVideoAttachment(attachment, metadata, {
    thumbnailUri,
  });
  if (!uploadResult.success) {
    Alert.alert('Video upload failed', uploadResult.message ?? 'Unable to upload video.');
    return null;
  }
  const kind = payload.composerType === 'short_video' ? 'short_video' : 'video';
  const mapped = mapServerVideoAttachment(
    uploadResult.data,
    kind,
    attachment.thumbUrl ?? attachment.thumbnail_url,
  );
  return {
    ...payload,
    attachments: [mapped],
  };
};
