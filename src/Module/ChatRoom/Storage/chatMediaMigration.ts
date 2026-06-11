// src/Module/ChatRoom/Storage/chatMediaMigration.ts
//
// One-time migration: moves any files that landed in the temporary
// KIS/Media/Chat/{Uploads,Downloads} directories back to the canonical
// KIS/ChatMedia/{Uploads,Downloads} directories, then updates every
// stored chat message so localPath / localUri point to the canonical path.
//
// Files already at KIS/ChatMedia/* are untouched — they are already correct.
// Safe to call on every launch — the DONE flag stops it after the first run.

import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import { CHAT_MEDIA_UPLOADS_DIR, CHAT_MEDIA_DOWNLOADS_DIR } from '../chatMediaStorage';

const MIGRATION_DONE_KEY = 'KIS_CHAT_MEDIA_PATH_MIGRATION_V2_DONE';

const STRAY_DIRS: Array<{ stray: string; canonical: string }> = [
  {
    stray:     `${RNFS.DocumentDirectoryPath}/KIS/Media/Chat/Uploads`,
    canonical: CHAT_MEDIA_UPLOADS_DIR,
  },
  {
    stray:     `${RNFS.DocumentDirectoryPath}/KIS/Media/Chat/Downloads`,
    canonical: CHAT_MEDIA_DOWNLOADS_DIR,
  },
];

// Message-level string replacements: old segment → canonical segment
const PATH_REPLACEMENTS: Array<[string, string]> = [
  ['/KIS/Media/Chat/Uploads/',   '/KIS/ChatMedia/Uploads/'],
  ['/KIS/Media/Chat/Downloads/', '/KIS/ChatMedia/Downloads/'],
];

const MSG_KEY_PREFIXES = [
  'KIS_CHAT_MESSAGES_BY_USER_ROOM_V3:',
  'KIS_CHAT_MESSAGES_BY_ROOM_V2:',
  'KIS_CHAT_MESSAGES_BY_ROOM_V1:',
];

async function migrateStrayFiles(): Promise<void> {
  for (const { stray, canonical } of STRAY_DIRS) {
    const strayExists = await RNFS.exists(stray).catch(() => false);
    if (!strayExists) continue;

    await RNFS.mkdir(canonical).catch(() => {});

    const items = await RNFS.readDir(stray).catch(() => []);
    for (const item of items) {
      if (!item.isFile()) continue;
      const dest = `${canonical}/${item.name}`;
      if (!(await RNFS.exists(dest).catch(() => false))) {
        await RNFS.copyFile(item.path, dest).catch(() => {});
      }
    }
  }
}

function patchPaths(raw: string): string {
  let result = raw;
  for (const [from, to] of PATH_REPLACEMENTS) {
    result = result.split(from).join(to);
  }
  return result;
}

async function migrateStoredMessages(): Promise<void> {
  const allKeys = await AsyncStorage.getAllKeys().catch(() => [] as string[]);
  const chatKeys = allKeys.filter((k) =>
    MSG_KEY_PREFIXES.some((p) => k.startsWith(p)),
  );
  if (!chatKeys.length) return;

  const pairs = await AsyncStorage.multiGet(chatKeys).catch(() => [] as [string, string | null][]);
  const updates: [string, string][] = [];
  for (const [key, raw] of pairs) {
    if (!raw) continue;
    const patched = patchPaths(raw);
    if (patched !== raw) updates.push([key, patched]);
  }
  if (updates.length) await AsyncStorage.multiSet(updates).catch(() => {});
}

export async function runChatMediaMigrationIfNeeded(): Promise<void> {
  try {
    const done = await AsyncStorage.getItem(MIGRATION_DONE_KEY).catch(() => null);
    if (done === '1') return;

    await migrateStrayFiles();
    await migrateStoredMessages();

    await AsyncStorage.setItem(MIGRATION_DONE_KEY, '1').catch(() => {});
  } catch {
    // Never crash the app over a migration failure.
  }
}
