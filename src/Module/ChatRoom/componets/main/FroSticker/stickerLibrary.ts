// src/Module/ChatRoom/componets/main/FroSticker/stickerLibrary.ts
//
// Server-authoritative sticker library (Django apps.chat.Sticker /
// StickerLibraryEntry — see apps/chat/views.py's StickerCreateView /
// StickerLibraryListView / StickerSaveView / StickerLibraryEntryDeleteView).
// Replaces StickerEditor.tsx's old local-only AsyncStorage persistence,
// which never survived a reinstall or synced to another device — the
// server is the source of truth here; AsyncStorage below is only a
// fast-first-paint cache, re-synced every time the picker opens.

import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { deleteRequest } from '@/network/delete';

const STICKER_CACHE_DIR = `${RNFS.CachesDirectoryPath}/stickers`;

export type LibrarySticker = {
  id: string;
  ownerId: string | null;
  assetId: string;
  captionText: string;
  createdAt: string;
};

export type StickerLibraryEntry = {
  id: string;
  addedAt: string;
  isMine: boolean;
  sticker: LibrarySticker;
};

export type StickerLibrarySection = 'all' | 'created' | 'saved';

export type StickerLibraryPage = {
  entries: StickerLibraryEntry[];
  page: number;
  totalPages: number;
  total: number;
};

const LIBRARY_CACHE_KEY_PREFIX = 'KIS_STICKER_LIBRARY_SERVER_CACHE_V1_';

const mapEntry = (raw: any): StickerLibraryEntry => ({
  id: String(raw?.id ?? ''),
  addedAt: String(raw?.added_at ?? raw?.addedAt ?? ''),
  isMine: Boolean(raw?.is_mine ?? raw?.isMine),
  sticker: {
    id: String(raw?.sticker?.id ?? ''),
    ownerId: raw?.sticker?.owner_id ?? raw?.sticker?.ownerId ?? null,
    assetId: String(raw?.sticker?.asset_id ?? raw?.sticker?.assetId ?? ''),
    captionText: String(raw?.sticker?.caption_text ?? raw?.sticker?.captionText ?? ''),
    createdAt: String(raw?.sticker?.created_at ?? raw?.sticker?.createdAt ?? ''),
  },
});

/** Instant first paint while the real fetch is in flight — never treated as authoritative. */
export async function loadCachedLibraryPage(section: StickerLibrarySection): Promise<StickerLibraryEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(`${LIBRARY_CACHE_KEY_PREFIX}${section}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function cacheLibraryPage(section: StickerLibrarySection, entries: StickerLibraryEntry[]): Promise<void> {
  try {
    await AsyncStorage.setItem(`${LIBRARY_CACHE_KEY_PREFIX}${section}`, JSON.stringify(entries));
  } catch {
    // Non-fatal — the server fetch already succeeded, this is just the cache.
  }
}

export async function fetchStickerLibraryPage(
  section: StickerLibrarySection,
  page = 1,
  pageSize = 30,
): Promise<StickerLibraryPage> {
  const res = await getRequest(ROUTES.stickers.library, {
    params: { section, page, page_size: pageSize },
    errorMessage: '',
  });
  const results = Array.isArray(res?.data?.results) ? res.data.results : [];
  const entries = results.map(mapEntry);
  const meta = res?.data?.meta ?? {};

  if (page === 1) {
    await cacheLibraryPage(section, entries);
  }

  return {
    entries,
    page: Number(meta.page ?? page),
    totalPages: Number(meta.total_pages ?? 1),
    total: Number(meta.total ?? entries.length),
  };
}

/** Called right after uploading the sticker's image (context="sticker", visibility="public") via uploadFileToBackend. */
export async function createSticker(assetId: string, captionText?: string): Promise<StickerLibraryEntry> {
  const res = await postRequest(ROUTES.stickers.create, {
    assetId,
    captionText: captionText ?? '',
  });
  if (!res.success) {
    throw new Error(res.message || 'Could not save this sticker.');
  }
  return mapEntry(res.data);
}

/** Idempotent — saving something already in your library just returns the existing entry. */
export async function saveStickerToLibrary(stickerId: string): Promise<StickerLibraryEntry> {
  const res = await postRequest(ROUTES.stickers.save(stickerId), {});
  if (!res.success) {
    throw new Error(res.message || 'Could not save this sticker.');
  }
  return mapEntry(res.data);
}

/** Removes only the caller's own library entry — never the original sticker or anyone else's copy. */
export async function removeStickerLibraryEntry(entryId: string): Promise<void> {
  const res = await deleteRequest(ROUTES.stickers.removeLibraryEntry(entryId));
  if (!res.success) {
    throw new Error(res.message || 'Could not remove this sticker.');
  }
}

// --- Image URL resolution (presigned, short-lived — never cached to disk as a permanent link) ---

type ResolvedStickerUrl = { url: string; expiresAtMs: number };

const EXPIRY_SAFETY_MARGIN_MS = 60_000;
const urlCache = new Map<string, ResolvedStickerUrl>();
const urlInFlight = new Map<string, Promise<string>>();

function isFresh(entry: ResolvedStickerUrl | undefined): entry is ResolvedStickerUrl {
  return !!entry && entry.expiresAtMs - EXPIRY_SAFETY_MARGIN_MS > Date.now();
}

/** Resolves (and caches) a fresh, authenticated image URL for a sticker's underlying MediaAsset. */
export async function resolveStickerImageUrl(assetId: string): Promise<string> {
  if (!assetId) throw new Error('This sticker is missing its image.');

  const cached = urlCache.get(assetId);
  if (isFresh(cached)) return cached.url;

  const pending = urlInFlight.get(assetId);
  if (pending) return pending;

  const promise = (async (): Promise<string> => {
    const res = await getRequest(ROUTES.mediaAssets.signedUrl(assetId), { errorMessage: '' });
    const url = String(res?.data?.url ?? '');
    if (!res.success || !url) {
      throw new Error('This sticker is no longer available.');
    }
    const expiresInSeconds = Number(res?.data?.expiresInSeconds ?? 900);
    urlCache.set(assetId, { url, expiresAtMs: Date.now() + expiresInSeconds * 1000 });
    return url;
  })();

  urlInFlight.set(assetId, promise);
  try {
    return await promise;
  } finally {
    urlInFlight.delete(assetId);
  }
}

// --- Local file cache (sendable file:// path per sticker id, this device only) ---
//
// Sending a sticker into a chat always re-uploads real bytes to Nest for
// that specific message (see ChatRoomHandlers.handleSendSticker) - this
// just avoids re-downloading a sticker's image from Django's signed URL
// on every send when a local copy from an earlier create/send/download
// on THIS device already exists. Never treated as the sticker's identity
// or authoritative state - purely a local performance cache.

const LOCAL_FILE_CACHE_KEY = 'KIS_STICKER_LOCAL_FILE_CACHE_V1';

async function readLocalFileCache(): Promise<Record<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_FILE_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export async function cacheLocalStickerFile(stickerId: string, localUri: string): Promise<void> {
  if (!stickerId || !localUri) return;
  try {
    const cache = await readLocalFileCache();
    cache[stickerId] = localUri;
    await AsyncStorage.setItem(LOCAL_FILE_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Non-fatal — just means the next send for this sticker re-downloads it.
  }
}

export async function getCachedLocalStickerFile(stickerId: string): Promise<string | null> {
  if (!stickerId) return null;
  const cache = await readLocalFileCache();
  return cache[stickerId] ?? null;
}

/**
 * Guarantees a local file:// path for this sticker's image, downloading it
 * from Django's signed URL (by assetId) the first time this device needs
 * it — e.g. sending a sticker saved from another user, which never had a
 * local file to begin with. Required because the actual per-message send
 * (ChatRoomHandlers.handleSendSticker) uploads real local bytes to Nest;
 * it has no path that accepts a bare remote URL.
 */
export async function ensureLocalStickerFile(stickerId: string, assetId: string): Promise<string> {
  const cached = await getCachedLocalStickerFile(stickerId);
  if (cached) {
    const stillExists = await RNFS.exists(cached.startsWith('file://') ? cached.slice(7) : cached).catch(() => false);
    if (stillExists) return cached;
  }

  const url = await resolveStickerImageUrl(assetId);
  const dirExists = await RNFS.exists(STICKER_CACHE_DIR).catch(() => false);
  if (!dirExists) await RNFS.mkdir(STICKER_CACHE_DIR).catch(() => {});

  const destPath = `${STICKER_CACHE_DIR}/${stickerId}.png`;
  const result = await RNFS.downloadFile({ fromUrl: url, toFile: destPath }).promise;
  if (result.statusCode !== 200) {
    throw new Error('Could not download this sticker.');
  }
  const localUri = `file://${destPath}`;
  await cacheLocalStickerFile(stickerId, localUri);
  return localUri;
}
