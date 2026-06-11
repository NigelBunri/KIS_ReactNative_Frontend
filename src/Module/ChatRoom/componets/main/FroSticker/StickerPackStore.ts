// StickerPackStore — discovers and caches server sticker packs locally.

import AsyncStorage from '@react-native-async-storage/async-storage';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';

const PACKS_CACHE_KEY = 'KIS_STICKER_PACKS_V1';
const PACKS_INSTALLED_KEY = 'KIS_STICKER_PACKS_INSTALLED_V1';

export type StickerPackItem = {
  id: string;
  url: string;
  name?: string;
  width?: number;
  height?: number;
};

export type StickerPack = {
  id: string;
  name: string;
  coverUrl?: string;
  stickers: StickerPackItem[];
};

export async function fetchRemotePacks(): Promise<StickerPack[]> {
  try {
    const res = await getRequest(ROUTES.stickers.packs, { errorMessage: '' });
    const list = res?.data?.results ?? res?.data ?? [];
    if (!Array.isArray(list)) return [];
    const packs: StickerPack[] = list.map((p: any) => ({
      id: String(p.id ?? p.slug ?? Math.random()),
      name: p.name ?? 'Sticker Pack',
      coverUrl: p.cover_url ?? p.coverUrl ?? p.thumbnail ?? undefined,
      stickers: Array.isArray(p.stickers)
        ? p.stickers.map((s: any, i: number) => ({
            id: String(s.id ?? `${p.id}_${i}`),
            url: s.url ?? s.file_url ?? s.fileUrl ?? '',
            name: s.name ?? s.emoji ?? undefined,
            width: s.width ?? undefined,
            height: s.height ?? undefined,
          })).filter((s: StickerPackItem) => !!s.url)
        : [],
    }));
    await AsyncStorage.setItem(PACKS_CACHE_KEY, JSON.stringify(packs));
    return packs;
  } catch {
    return loadCachedPacks();
  }
}

export async function loadCachedPacks(): Promise<StickerPack[]> {
  try {
    const raw = await AsyncStorage.getItem(PACKS_CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function getInstalledPackIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(PACKS_INSTALLED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function installPack(packId: string): Promise<void> {
  const installed = await getInstalledPackIds();
  if (!installed.includes(packId)) {
    await AsyncStorage.setItem(PACKS_INSTALLED_KEY, JSON.stringify([...installed, packId]));
  }
}

export async function uninstallPack(packId: string): Promise<void> {
  const installed = await getInstalledPackIds();
  await AsyncStorage.setItem(PACKS_INSTALLED_KEY, JSON.stringify(installed.filter(id => id !== packId)));
}

export async function loadInstalledStickers(packs: StickerPack[]): Promise<StickerPackItem[]> {
  const installedIds = await getInstalledPackIds();
  return packs
    .filter(p => installedIds.includes(p.id))
    .flatMap(p => p.stickers);
}
