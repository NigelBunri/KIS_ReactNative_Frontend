// App-private, non-shareable storage for encrypted offline book packages.
//
// Deliberately NOT under the public Downloads folder, NOT registered as
// an ordinary readable document, and excluded from iOS's iCloud/Finder
// device backup (NSURLIsExcludedFromBackupKey on the directory itself —
// see ensureOfflineBooksRoot below). Android has no equivalent flag to
// set here because android:allowBackup="false" is already set app-wide
// in AndroidManifest.xml — nothing under this app's storage is backed up
// on Android regardless of directory.
//
// What's written to disk here is ALREADY AES-256-GCM ciphertext (see
// apps.books.offline_crypto / src/services/books/offlineCrypto.ts) — the
// files themselves are opaque blobs, not a secondary layer of protection
// on their own. The per-book decryption key never touches this
// directory; it lives in react-native-encrypted-storage (iOS Keychain /
// Android Keystore-backed), see offlineBookKeys.ts.
import RNFS from 'react-native-fs';
import { Buffer } from 'buffer';

export const KIS_OFFLINE_BOOKS_ROOT = `${RNFS.DocumentDirectoryPath}/KIS/OfflineBooks`;

const bookDir = (bookId: string) => `${KIS_OFFLINE_BOOKS_ROOT}/${bookId}`;
const packagePath = (bookId: string) => `${bookDir(bookId)}/package.json`;
const partialPath = (bookId: string) => `${bookDir(bookId)}/package.partial.json`;

let rootEnsured = false;

export async function ensureOfflineBooksRoot(): Promise<void> {
  if (rootEnsured) return;
  await RNFS.mkdir(`${RNFS.DocumentDirectoryPath}/KIS`, { NSURLIsExcludedFromBackupKey: true }).catch(() => {});
  await RNFS.mkdir(KIS_OFFLINE_BOOKS_ROOT, { NSURLIsExcludedFromBackupKey: true }).catch(() => {});
  rootEnsured = true;
}

export type StoredPackage = {
  license_id: string;
  book_id: string;
  package_version: number;
  expires_at: string;
  manifest: { nonce: string; ciphertext: string; tag: string };
  chapters: Record<string, { nonce: string; ciphertext: string; tag: string }>;
  // Optional — absent on a package written before image bundling
  // existed; readOfflinePackage's JSON.parse of an old on-disk file
  // simply yields `images: undefined`, treated as "no images" everywhere
  // this is consumed, never a parse error or a required-field crash.
  images?: Record<string, { nonce: string; ciphertext: string; tag: string }>;
};

/** Writes the raw encrypted package exactly as issued by the server —
 * nothing here is plaintext. Written to a `.partial` path first and
 * renamed into place only on full success, so a crash/kill mid-write
 * never leaves a half-written package that would later be mistaken for
 * a complete (but corrupted) one. */
export async function writeOfflinePackage(bookId: string, pkg: StoredPackage): Promise<number> {
  await ensureOfflineBooksRoot();
  await RNFS.mkdir(bookDir(bookId), { NSURLIsExcludedFromBackupKey: true }).catch(() => {});
  const json = JSON.stringify(pkg);
  await RNFS.writeFile(partialPath(bookId), json, 'utf8');
  const existing = await RNFS.exists(packagePath(bookId));
  if (existing) await RNFS.unlink(packagePath(bookId)).catch(() => {});
  await RNFS.moveFile(partialPath(bookId), packagePath(bookId));
  return Buffer.byteLength(json, 'utf8');
}

export async function readOfflinePackage(bookId: string): Promise<StoredPackage | null> {
  const exists = await RNFS.exists(packagePath(bookId));
  if (!exists) return null;
  try {
    const raw = await RNFS.readFile(packagePath(bookId), 'utf8');
    return JSON.parse(raw) as StoredPackage;
  } catch {
    // A corrupted/truncated file on disk (not a crypto failure — this is
    // the file literally failing to parse as JSON) is treated the same
    // as "not downloaded", prompting a clean re-download rather than a
    // crash loop every time the reader opens this book.
    return null;
  }
}

export async function removeOfflinePackage(bookId: string): Promise<void> {
  const exists = await RNFS.exists(bookDir(bookId));
  if (exists) await RNFS.unlink(bookDir(bookId)).catch(() => {});
}

export async function offlinePackageSizeBytes(bookId: string): Promise<number> {
  const exists = await RNFS.exists(packagePath(bookId));
  if (!exists) return 0;
  const stat = await RNFS.stat(packagePath(bookId));
  return Number(stat.size || 0);
}

export async function totalOfflineStorageBytes(): Promise<number> {
  await ensureOfflineBooksRoot();
  const exists = await RNFS.exists(KIS_OFFLINE_BOOKS_ROOT);
  if (!exists) return 0;
  const entries = await RNFS.readDir(KIS_OFFLINE_BOOKS_ROOT);
  let total = 0;
  for (const dir of entries) {
    total += await offlinePackageSizeBytes(dir.name);
  }
  return total;
}

export async function listDownloadedBookIds(): Promise<string[]> {
  await ensureOfflineBooksRoot();
  const exists = await RNFS.exists(KIS_OFFLINE_BOOKS_ROOT);
  if (!exists) return [];
  const entries = await RNFS.readDir(KIS_OFFLINE_BOOKS_ROOT);
  const ids: string[] = [];
  for (const dir of entries) {
    if (await RNFS.exists(packagePath(dir.name))) ids.push(dir.name);
  }
  return ids;
}
