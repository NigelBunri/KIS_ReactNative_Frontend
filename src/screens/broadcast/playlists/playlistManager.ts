/**
 * playlistManager — user-created personal playlists
 *
 * Persistence strategy:
 *   1. AsyncStorage  — instant offline-first load on every app start
 *   2. Backend API   — authoritative cross-device sync
 *
 * Every mutation is optimistic: local state updates immediately,
 * backend is notified in the background. If the backend call fails,
 * local state is preserved and re-synced on the next hydration.
 *
 * Hydration order:
 *   AsyncStorage → emit (app can render) → GET /user-playlists/ → merge → emit again
 *
 * ID management:
 *   - `id`       : local client UUID (stable across all local operations)
 *   - `serverId` : backend-assigned ID (set after first successful POST)
 *   Operations that need the backend (PATCH / DELETE / item POST) are
 *   silently skipped when `serverId` is absent and will self-heal on the
 *   next full hydration from the server.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { patchRequest } from '@/network/patch';
import { deleteRequest } from '@/network/delete';
import ROUTES from '@/network';
import { getCurrentAuthUserId } from '@/storage/userScopedProfileCache';

// ─── Types ────────────────────────────────────────────────────────────────────

export type LoopMode = 'none' | 'all' | 'one' | 'selected';

/** Minimal broadcast shape we cache locally per playlist item. */
export type PlaylistFeedItem = {
  id: string;
  title?: string;
  text_plain?: string;
  attachments?: any[];
  author?: { display_name?: string; avatar_url?: string };
  video_duration_seconds?: number;
  source?: { name?: string; type?: string };
  source_type?: string;
};

export type PlaylistItem = {
  id: string;
  serverId?: string;        // backend-assigned ID, set after successful POST
  broadcastId: string;
  broadcastItem: PlaylistFeedItem;
  addedAt: string;
  selectedForLoop: boolean;
};

export type Playlist = {
  id: string;
  serverId?: string;        // backend-assigned ID, set after successful POST
  name: string;
  createdAt: string;
  updatedAt: string;
  items: PlaylistItem[];
  loopMode: LoopMode;
  syncing?: boolean;        // true while a create POST is in-flight
};

type PlaylistState = {
  playlists: Playlist[];
  hydrated: boolean;
};

// ─── Internal state ───────────────────────────────────────────────────────────

const STORAGE_KEY = '@kis:playlists-v1';
let activeStorageUserId: string | null = null;

const resolveStorageUserId = async () => await getCurrentAuthUserId().catch(() => null);

const storageKeyForCurrentUser = async () => {
  const userId = await resolveStorageUserId();
  return userId ? `${STORAGE_KEY}:${userId}` : STORAGE_KEY;
};

const ensureUserScopedState = async () => {
  const userId = await resolveStorageUserId();
  if (activeStorageUserId === userId) return;
  activeStorageUserId = userId;
  state = { playlists: [], hydrated: false };
  emit();
};
const VALID_LOOP_MODES: LoopMode[] = ['none', 'all', 'one', 'selected'];

let state: PlaylistState = { playlists: [], hydrated: false };
const listeners = new Set<(next: PlaylistState) => void>();

const emit = (): void => {
  listeners.forEach(fn => fn(state));
};

// ─── ID generation ────────────────────────────────────────────────────────────

const generateId = (): string => {
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    const buf = new Uint8Array(16);
    globalThis.crypto.getRandomValues(buf);
    return Array.from(buf)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
};

// ─── AsyncStorage persistence ─────────────────────────────────────────────────

const persistState = async (): Promise<void> => {
  try {
    await AsyncStorage.setItem(await storageKeyForCurrentUser(), JSON.stringify(state.playlists));
  } catch {
    // silently ignore — we will retry on next mutation
  }
};

// ─── Normalisation helpers ────────────────────────────────────────────────────

const normaliseItem = (raw: any): PlaylistItem => ({
  id: String(raw.client_id ?? raw.id ?? generateId()),
  serverId: raw.server_id ?? raw.serverId ?? undefined,
  broadcastId: String(raw.broadcast_id ?? raw.broadcastId ?? ''),
  broadcastItem: raw.broadcast_data ?? raw.broadcastItem ?? {},
  addedAt: String(raw.added_at ?? raw.addedAt ?? new Date().toISOString()),
  selectedForLoop: Boolean(raw.selected_for_loop ?? raw.selectedForLoop),
});

const normalisePlaylist = (raw: any): Playlist => ({
  id: String(raw.client_id ?? raw.id ?? generateId()),
  serverId: raw.server_id ?? raw.serverId ?? undefined,
  name: String(raw.name ?? 'Playlist'),
  createdAt: String(raw.created_at ?? raw.createdAt ?? new Date().toISOString()),
  updatedAt: String(raw.updated_at ?? raw.updatedAt ?? new Date().toISOString()),
  loopMode: VALID_LOOP_MODES.includes(raw.loop_mode ?? raw.loopMode)
    ? (raw.loop_mode ?? raw.loopMode)
    : 'none',
  items: Array.isArray(raw.items) ? raw.items.map(normaliseItem) : [],
});

// ─── Hydration ────────────────────────────────────────────────────────────────

const hydrateFromStorage = async (): Promise<void> => {
  try {
    await ensureUserScopedState();
    const raw = await AsyncStorage.getItem(await storageKeyForCurrentUser());
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        state = {
          playlists: (parsed as any[]).map(normalisePlaylist),
          hydrated: true,
        };
        emit();
      }
    } else {
      state = { ...state, hydrated: true };
      emit();
    }
  } catch {
    state = { ...state, hydrated: true };
    emit();
  }
};

/**
 * Fetch from the backend and merge.
 * Backend playlists (those with a serverId) replace their local counterpart.
 * Local-only playlists (no serverId) are kept and queued for upload.
 */
const hydrateFromBackend = async (): Promise<void> => {
  try {
    await ensureUserScopedState();
    const res = await getRequest(ROUTES.broadcasts.userPlaylists, {
      errorMessage: 'Unable to fetch playlists.',
      forceNetwork: true,
    });

    if (!res?.success) return;

    const rawList: any[] = Array.isArray(res?.data?.results)
      ? res.data.results
      : Array.isArray(res?.data)
      ? res.data
      : [];

    if (rawList.length === 0 && state.playlists.length === 0) return;

    // Build a map of serverId → normalised playlist from backend
    const fromServer: Playlist[] = rawList.map(raw => {
      // Backend embeds items — look for items array on the payload
      const items = Array.isArray(raw.items)
        ? raw.items.map((it: any) => ({
            id: String(it.client_id ?? it.id),
            serverId: String(it.id),
            broadcastId: String(it.broadcast_id ?? ''),
            broadcastItem: it.broadcast_data ?? {},
            addedAt: String(it.added_at ?? new Date().toISOString()),
            selectedForLoop: Boolean(it.selected_for_loop),
          }))
        : [];

      return {
        id: String(raw.client_id ?? raw.id),
        serverId: String(raw.id),
        name: String(raw.name ?? 'Playlist'),
        createdAt: String(raw.created_at ?? new Date().toISOString()),
        updatedAt: String(raw.updated_at ?? new Date().toISOString()),
        loopMode: VALID_LOOP_MODES.includes(raw.loop_mode) ? raw.loop_mode : 'none',
        items,
      };
    });

    const serverIdSet = new Set(fromServer.map(p => p.serverId).filter(Boolean));

    // Keep local-only playlists that don't exist on the server yet
    const localOnly = state.playlists.filter(
      p => !p.serverId || !serverIdSet.has(p.serverId),
    );

    state = {
      ...state,
      playlists: [...fromServer, ...localOnly],
    };
    emit();
    void persistState();

    // Push any local-only playlists up to the server
    for (const pl of localOnly) {
      if (!pl.serverId) {
        void pushPlaylistToServer(pl);
      }
    }
  } catch {
    // Network unavailable — keep local state, will retry on next app resume
  }
};

/** Full hydration: storage first (fast), then backend (authoritative). */
const hydrateState = async (): Promise<void> => {
  await hydrateFromStorage();
  void hydrateFromBackend();
};

void hydrateState();

// ─── Backend sync helpers ─────────────────────────────────────────────────────

/**
 * Creates a playlist on the server and updates the local record with the
 * returned serverId. If the request fails, the local record is kept as-is
 * and will be retried on next hydration.
 */
const pushPlaylistToServer = async (pl: Playlist): Promise<void> => {
  try {
    const res = await postRequest(
      ROUTES.broadcasts.userPlaylists,
      {
        client_id: pl.id,
        name: pl.name,
        loop_mode: pl.loopMode,
      },
      { errorMessage: 'Unable to sync playlist.' },
    );

    if (!res?.success) return;

    const serverId = String(res?.data?.id ?? '');
    if (!serverId) return;

    // Stamp the serverId onto the local record
    state = {
      ...state,
      playlists: state.playlists.map(p =>
        p.id === pl.id ? { ...p, serverId, syncing: false } : p,
      ),
    };
    emit();
    void persistState();

    // Now push each local item to the server
    const updated = state.playlists.find(p => p.id === pl.id);
    if (updated) {
      for (const item of updated.items) {
        if (!item.serverId) void pushItemToServer(serverId, item, pl.id);
      }
    }
  } catch {
    // Will be retried on next full hydration
  }
};

const pushItemToServer = async (
  playlistServerId: string,
  item: PlaylistItem,
  localPlaylistId: string,
): Promise<void> => {
  try {
    const res = await postRequest(
      ROUTES.broadcasts.userPlaylistItems(playlistServerId),
      {
        client_id: item.id,
        broadcast_id: item.broadcastId,
        selected_for_loop: item.selectedForLoop,
        broadcast_data: item.broadcastItem,
      },
      { errorMessage: 'Unable to sync playlist item.' },
    );

    if (!res?.success) return;

    const itemServerId = String(res?.data?.id ?? '');
    if (!itemServerId) return;

    state = {
      ...state,
      playlists: state.playlists.map(p =>
        p.id === localPlaylistId
          ? {
              ...p,
              items: p.items.map(it =>
                it.id === item.id ? { ...it, serverId: itemServerId } : it,
              ),
            }
          : p,
      ),
    };
    emit();
    void persistState();
  } catch {}
};

// ─── Public API ───────────────────────────────────────────────────────────────

export const getPlaylistsState = (): PlaylistState => state;

export const subscribeToPlaylists = (
  listener: (next: PlaylistState) => void,
): (() => void) => {
  listeners.add(listener);
  listener(state);
  return () => listeners.delete(listener);
};

/** Re-sync from the server (call when the screen regains focus). */
export const refreshPlaylistsFromServer = (): void => {
  void (async () => {
    await ensureUserScopedState();
    await hydrateFromStorage();
    await hydrateFromBackend();
  })();
};

// ─── Playlist CRUD ────────────────────────────────────────────────────────────

export const createPlaylist = (name: string): Playlist => {
  void ensureUserScopedState();
  const now = new Date().toISOString();
  const pl: Playlist = {
    id: generateId(),
    name: name.trim() || 'My Playlist',
    createdAt: now,
    updatedAt: now,
    items: [],
    loopMode: 'none',
    syncing: true,
  };

  state = { ...state, playlists: [pl, ...state.playlists] };
  emit();
  void persistState();
  void pushPlaylistToServer(pl);
  return pl;
};

export const renamePlaylist = (id: string, name: string): void => {
  void ensureUserScopedState();
  const trimmed = name.trim();
  state = {
    ...state,
    playlists: state.playlists.map(pl =>
      pl.id === id
        ? { ...pl, name: trimmed || pl.name, updatedAt: new Date().toISOString() }
        : pl,
    ),
  };
  emit();
  void persistState();

  const pl = state.playlists.find(p => p.id === id);
  if (pl?.serverId) {
    void patchRequest(
      ROUTES.broadcasts.userPlaylistDetail(pl.serverId),
      { name: trimmed || pl.name },
      { errorMessage: 'Unable to update playlist name.' },
    );
  }
};

export const deletePlaylist = (id: string): void => {
  void ensureUserScopedState();
  const pl = state.playlists.find(p => p.id === id);
  state = { ...state, playlists: state.playlists.filter(p => p.id !== id) };
  emit();
  void persistState();

  if (pl?.serverId) {
    void deleteRequest(ROUTES.broadcasts.userPlaylistDetail(pl.serverId), {
      errorMessage: 'Unable to delete playlist.',
    });
  }
};

export const setPlaylistLoopMode = (id: string, loopMode: LoopMode): void => {
  void ensureUserScopedState();
  state = {
    ...state,
    playlists: state.playlists.map(pl =>
      pl.id === id
        ? { ...pl, loopMode, updatedAt: new Date().toISOString() }
        : pl,
    ),
  };
  emit();
  void persistState();

  const pl = state.playlists.find(p => p.id === id);
  if (pl?.serverId) {
    void patchRequest(
      ROUTES.broadcasts.userPlaylistDetail(pl.serverId),
      { loop_mode: loopMode },
      { errorMessage: 'Unable to update loop mode.' },
    );
  }
};

// ─── Item operations ──────────────────────────────────────────────────────────

export type AddToPlaylistResult = 'added' | 'duplicate' | 'not_found';

export const addItemToPlaylist = (
  playlistId: string,
  item: PlaylistFeedItem,
): AddToPlaylistResult => {
  void ensureUserScopedState();
  const pl = state.playlists.find(p => p.id === playlistId);
  if (!pl) return 'not_found';
  if (pl.items.some(it => it.broadcastId === item.id)) return 'duplicate';

  const newItem: PlaylistItem = {
    id: generateId(),
    broadcastId: item.id,
    broadcastItem: item,
    addedAt: new Date().toISOString(),
    selectedForLoop: false,
  };

  state = {
    ...state,
    playlists: state.playlists.map(p =>
      p.id === playlistId
        ? { ...p, items: [...p.items, newItem], updatedAt: new Date().toISOString() }
        : p,
    ),
  };
  emit();
  void persistState();

  if (pl.serverId) {
    void pushItemToServer(pl.serverId, newItem, playlistId);
  }

  return 'added';
};

export const removeItemFromPlaylist = (
  playlistId: string,
  itemId: string,
): void => {
  void ensureUserScopedState();
  const pl = state.playlists.find(p => p.id === playlistId);
  const item = pl?.items.find(it => it.id === itemId);

  state = {
    ...state,
    playlists: state.playlists.map(p =>
      p.id === playlistId
        ? {
            ...p,
            items: p.items.filter(it => it.id !== itemId),
            updatedAt: new Date().toISOString(),
          }
        : p,
    ),
  };
  emit();
  void persistState();

  if (pl?.serverId && item?.serverId) {
    void deleteRequest(
      ROUTES.broadcasts.userPlaylistItemDetail(pl.serverId, item.serverId),
      { errorMessage: 'Unable to remove playlist item.' },
    );
  }
};

export const toggleItemSelectedForLoop = (
  playlistId: string,
  itemId: string,
): void => {
  void ensureUserScopedState();
  const pl = state.playlists.find(p => p.id === playlistId);
  const item = pl?.items.find(it => it.id === itemId);
  const nextSelected = !item?.selectedForLoop;

  state = {
    ...state,
    playlists: state.playlists.map(p =>
      p.id === playlistId
        ? {
            ...p,
            items: p.items.map(it =>
              it.id === itemId ? { ...it, selectedForLoop: nextSelected } : it,
            ),
            updatedAt: new Date().toISOString(),
          }
        : p,
    ),
  };
  emit();
  void persistState();

  // Sync the selection state to the backend item
  if (pl?.serverId && item?.serverId) {
    void patchRequest(
      ROUTES.broadcasts.userPlaylistItemDetail(pl.serverId, item.serverId),
      { selected_for_loop: nextSelected },
      { errorMessage: 'Unable to update item selection.' },
    );
  }
};

export const movePlaylistItem = (
  playlistId: string,
  fromIndex: number,
  direction: 'up' | 'down',
): void => {
  void ensureUserScopedState();
  const pl = state.playlists.find(p => p.id === playlistId);
  if (!pl) return;
  const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
  if (toIndex < 0 || toIndex >= pl.items.length) return;
  const newItems = [...pl.items];
  [newItems[fromIndex], newItems[toIndex]] = [newItems[toIndex], newItems[fromIndex]];
  state = {
    ...state,
    playlists: state.playlists.map(p =>
      p.id === playlistId ? { ...p, items: newItems, updatedAt: new Date().toISOString() } : p,
    ),
  };
  emit();
  void persistState();
  if (pl.serverId) {
    void patchRequest(
      ROUTES.broadcasts.playlistItems(pl.serverId),
      { order: newItems.map(it => it.broadcastId) },
      { errorMessage: 'Unable to save playlist order.' },
    );
  }
};

// ─── Convenience composite ────────────────────────────────────────────────────

export const createPlaylistAndAdd = (
  name: string,
  item: PlaylistFeedItem,
): { playlist: Playlist; result: AddToPlaylistResult } => {
  const pl = createPlaylist(name);
  const result = addItemToPlaylist(pl.id, item);
  return { playlist: pl, result };
};
