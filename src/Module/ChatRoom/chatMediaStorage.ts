// src/Module/ChatRoom/chatMediaStorage.ts
//
// Canonical on-device storage for chat attachments:
//   Uploads  → <DocumentDir>/KIS/ChatMedia/Uploads/
//   Downloads → <DocumentDir>/KIS/ChatMedia/Downloads/
//
// This matches the path users see in the device Files app and was the
// original location before a brief period where code accidentally wrote to
// KIS/Media/Chat/{Uploads,Downloads}. The migration (chatMediaMigration.ts)
// moves any stray files back here on first launch.

import RNFS from 'react-native-fs';
import { fileUriForPath, stripFileScheme, sanitizePermanentFileName } from '@/storage/permanentMediaStorage';

export { fileUriForPath, stripFileScheme };

export type ChatMediaBucket = 'uploads' | 'downloads';

// Single source of truth for every chat media path in the app.
const CHAT_MEDIA_BASE = `${RNFS.DocumentDirectoryPath}/KIS/ChatMedia`;
export const CHAT_MEDIA_UPLOADS_DIR = `${CHAT_MEDIA_BASE}/Uploads`;
export const CHAT_MEDIA_DOWNLOADS_DIR = `${CHAT_MEDIA_BASE}/Downloads`;

// Keep for cross-module references that import CHAT_MEDIA_ROOT.
export const CHAT_MEDIA_ROOT = CHAT_MEDIA_BASE;

export const sanitizeChatMediaFileName = sanitizePermanentFileName;

export const getChatMediaDir = (bucket: ChatMediaBucket): string =>
  bucket === 'uploads' ? CHAT_MEDIA_UPLOADS_DIR : CHAT_MEDIA_DOWNLOADS_DIR;

export const ensureChatMediaDirs = async (): Promise<void> => {
  await RNFS.mkdir(`${CHAT_MEDIA_BASE}/Uploads`).catch(() => {});
  await RNFS.mkdir(`${CHAT_MEDIA_BASE}/Downloads`).catch(() => {});
};

/**
 * Returns the canonical absolute path for a new chat media file.
 * Creates the directory if needed.
 */
export const buildChatMediaPath = async (
  bucket: ChatMediaBucket,
  filename?: string | null,
  stableKey?: string | null,
): Promise<string> => {
  const dir = getChatMediaDir(bucket);
  await RNFS.mkdir(dir).catch(() => {});
  const cleanName = sanitizeChatMediaFileName(filename);
  const cleanKey = stableKey
    ? sanitizeChatMediaFileName(stableKey).slice(0, 64)
    : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  return `${dir}/${cleanKey}_${cleanName}`;
};

/**
 * Copies a source URI to the canonical chat media directory.
 * Returns the absolute destination path, or null on failure.
 */
export const copyUriToChatMedia = async (
  sourceUri: string,
  bucket: ChatMediaBucket,
  filename?: string | null,
  stableKey?: string | null,
): Promise<string | null> => {
  const sourcePath = stripFileScheme(sourceUri);
  const exists = await RNFS.exists(sourcePath).catch(() => false);
  if (!exists) return null;
  const targetPath = await buildChatMediaPath(bucket, filename, stableKey);
  await RNFS.copyFile(sourcePath, targetPath);
  return targetPath;
};

// Alternative legacy paths that may contain files from previous code versions.
const LEGACY_DIRS: Array<{ legacy: string; canonical: string }> = [
  { legacy: `${RNFS.DocumentDirectoryPath}/KIS/Media/Chat/Uploads`,   canonical: CHAT_MEDIA_UPLOADS_DIR },
  { legacy: `${RNFS.DocumentDirectoryPath}/KIS/Media/Chat/Downloads`, canonical: CHAT_MEDIA_DOWNLOADS_DIR },
];

/**
 * If the file at `storedPath` no longer exists, checks legacy directories
 * for the same filename and returns the live path. Falls back to the
 * original path (CDN fallback in ImageWithFallback will handle it).
 */
export const resolveChatMediaPath = async (storedPath: string): Promise<string> => {
  if (!storedPath) return storedPath;
  const clean = storedPath.startsWith('file://') ? stripFileScheme(storedPath) : storedPath;
  if (await RNFS.exists(clean).catch(() => false)) return storedPath;

  for (const { legacy, canonical } of LEGACY_DIRS) {
    // Check canonical → legacy and legacy → canonical.
    for (const [from, to] of [[canonical, legacy], [legacy, canonical]] as [string, string][]) {
      if (clean.startsWith(from + '/')) {
        const candidate = to + clean.slice(from.length);
        if (await RNFS.exists(candidate).catch(() => false)) {
          return storedPath.startsWith('file://') ? fileUriForPath(candidate) : candidate;
        }
      }
    }
  }
  return storedPath;
};
