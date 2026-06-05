import {
  buildPermanentMediaPath,
  copyUriToPermanentMedia,
  fileUriForPath,
  ensurePermanentMediaDir,
  getPermanentMediaDir,
  sanitizePermanentFileName,
  stripFileScheme,
} from '@/storage/permanentMediaStorage';

export type ChatMediaBucket = 'uploads' | 'downloads';

export const CHAT_MEDIA_ROOT = getPermanentMediaDir('Chat', 'Cache');
export const CHAT_MEDIA_UPLOADS_DIR = getPermanentMediaDir('Chat', 'Uploads');
export const CHAT_MEDIA_DOWNLOADS_DIR = getPermanentMediaDir('Chat', 'Downloads');

export const sanitizeChatMediaFileName = sanitizePermanentFileName;

export { fileUriForPath, stripFileScheme };

export const ensureChatMediaDirs = async () => {
  await Promise.all([
    ensurePermanentMediaDir('Chat', 'Uploads'),
    ensurePermanentMediaDir('Chat', 'Downloads'),
  ]);
};

export const getChatMediaDir = (bucket: ChatMediaBucket) =>
  bucket === 'uploads' ? CHAT_MEDIA_UPLOADS_DIR : CHAT_MEDIA_DOWNLOADS_DIR;

export const buildChatMediaPath = async (
  bucket: ChatMediaBucket,
  filename?: string | null,
  stableKey?: string | null,
) =>
  buildPermanentMediaPath(
    'Chat',
    bucket === 'uploads' ? 'Uploads' : 'Downloads',
    filename,
    stableKey,
  );

export const copyUriToChatMedia = async (
  sourceUri: string,
  bucket: ChatMediaBucket,
  filename?: string | null,
  stableKey?: string | null,
) =>
  copyUriToPermanentMedia(
    sourceUri,
    'Chat',
    bucket === 'uploads' ? 'Uploads' : 'Downloads',
    filename,
    stableKey,
  );
