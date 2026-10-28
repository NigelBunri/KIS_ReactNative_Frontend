// Orchestrates the full offline-book download lifecycle: request a
// package from the server, persist its (already-encrypted) bytes to
// app-private storage, move its decryption key into secure
// (Keychain/Keystore-backed) storage, and track a small non-sensitive
// local index (book id/title/expiry/size — never chapter content) so
// MyLibraryScreen and BookDetailScreen can show real download state
// without re-fetching from the server every time.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { deleteRequest } from '@/network/delete';
import ROUTES from '@/network';
import { ensureDeviceId } from '@/security/e2ee';
import { storeOfflineBookDek, getOfflineBookDek, removeOfflineBookDek } from '@/security/offlineBookKeys';
import {
  writeOfflinePackage,
  readOfflinePackage,
  removeOfflinePackage,
  offlinePackageSizeBytes,
  listDownloadedBookIds,
  type StoredPackage,
} from '@/storage/offlineBookStorage';
import { decryptOfflinePackage, OfflinePackageIntegrityError } from './offlineCrypto';

const INDEX_KEY = 'kis.offline_books.index.v1';

export type OfflineBookIndexEntry = {
  bookId: string;
  title: string;
  authorName: string;
  userId: string;
  deviceId: string;
  licenseId: string;
  packageVersion: number;
  expiresAt: string;
  sizeBytes: number;
  downloadedAt: string;
  lastVerifiedAt: string;
};

type Index = Record<string, OfflineBookIndexEntry>;

async function readIndex(): Promise<Index> {
  try {
    const raw = await AsyncStorage.getItem(INDEX_KEY);
    return raw ? (JSON.parse(raw) as Index) : {};
  } catch {
    return {};
  }
}

async function writeIndex(index: Index): Promise<void> {
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(index));
}

export async function getOfflineIndexEntry(bookId: string): Promise<OfflineBookIndexEntry | null> {
  const index = await readIndex();
  return index[bookId] || null;
}

export async function listOfflineIndexEntries(): Promise<OfflineBookIndexEntry[]> {
  const index = await readIndex();
  return Object.values(index);
}

export type DownloadProgress = { phase: 'requesting' | 'saving' | 'done'; percent: number };

export class OfflineDownloadError extends Error {
  code: 'not_authorized' | 'no_chapters' | 'network' | 'too_large' | 'unknown';
  constructor(message: string, code: OfflineDownloadError['code']) {
    super(message);
    this.name = 'OfflineDownloadError';
    this.code = code;
  }
}

/**
 * Downloads (or re-downloads, after a content update / corrupted local
 * copy) the given book for offline reading. The server independently
 * re-verifies entitlement on every call — this function never sends,
 * and the server never trusts, any client-asserted "I own this" flag.
 */
export async function downloadBookForOffline(
  bookId: string,
  userId: string,
  onProgress?: (p: DownloadProgress) => void,
): Promise<OfflineBookIndexEntry> {
  const deviceId = await ensureDeviceId();
  onProgress?.({ phase: 'requesting', percent: 10 });

  const res: any = await postRequest(ROUTES.books.offlineRequest(bookId), { device_id: deviceId });
  if (!res?.success) {
    const status = res?.status;
    if (status === 403) throw new OfflineDownloadError(res?.message || 'You do not have access to this book.', 'not_authorized');
    if (status === 400) throw new OfflineDownloadError(res?.message || 'This book could not be downloaded.', 'too_large');
    throw new OfflineDownloadError(res?.message || 'Download failed — check your connection and try again.', 'network');
  }
  onProgress?.({ phase: 'requesting', percent: 40 });

  const pkg = res.data as {
    license_id: string; book_id: string; package_version: number; package_dek: string;
    expires_at: string; manifest: any; chapters: Record<string, any>; images?: Record<string, any>;
  };

  // Decrypt once here purely to PROVE the package is intact and to read
  // the book's title/author for the local index — the decrypted
  // plaintext (chapters AND any images) is never persisted; only the
  // original ciphertext (pkg itself, minus the DEK) is written to disk
  // below.
  const { manifest } = decryptOfflinePackage(pkg);

  onProgress?.({ phase: 'saving', percent: 70 });
  const storedPackage: StoredPackage = {
    license_id: pkg.license_id, book_id: pkg.book_id, package_version: pkg.package_version,
    expires_at: pkg.expires_at, manifest: pkg.manifest, chapters: pkg.chapters, images: pkg.images || {},
  };
  const sizeBytes = await writeOfflinePackage(bookId, storedPackage);
  await storeOfflineBookDek(bookId, pkg.package_dek);

  const entry: OfflineBookIndexEntry = {
    bookId, title: manifest.title, authorName: manifest.author_name, userId, deviceId,
    licenseId: pkg.license_id, packageVersion: pkg.package_version, expiresAt: pkg.expires_at,
    sizeBytes, downloadedAt: new Date().toISOString(), lastVerifiedAt: new Date().toISOString(),
  };
  const index = await readIndex();
  index[bookId] = entry;
  await writeIndex(index);

  onProgress?.({ phase: 'done', percent: 100 });
  return entry;
}

export type OfflineReadiness =
  | { status: 'not_downloaded' }
  | { status: 'downloaded'; entry: OfflineBookIndexEntry }
  | { status: 'update_available'; entry: OfflineBookIndexEntry }
  | { status: 'license_expired'; entry: OfflineBookIndexEntry }
  | { status: 'corrupted'; entry: OfflineBookIndexEntry };

/**
 * The offline-enforcement decision point: a device with NO connectivity
 * cannot ask the server whether a license was revoked, so it enforces
 * against the last expires_at it cached locally at issue/renew time.
 * This is the documented boundary — see BookOfflineLicense's docstring
 * on the backend and docs/KIS_BOOKS_OPERATIONS.md — never a promise of
 * instant offline revocation.
 */
export async function getOfflineReadiness(bookId: string): Promise<OfflineReadiness> {
  const entry = await getOfflineIndexEntry(bookId);
  if (!entry) return { status: 'not_downloaded' };

  const pkg = await readOfflinePackage(bookId);
  const dek = await getOfflineBookDek(bookId);
  if (!pkg || !dek) return { status: 'corrupted', entry };

  if (new Date(entry.expiresAt).getTime() <= Date.now()) {
    return { status: 'license_expired', entry };
  }
  return { status: 'downloaded', entry };
}

/** Decrypts a locally-stored package for offline reading. Throws
 * OfflinePackageIntegrityError if the on-disk bytes don't match what was
 * encrypted (tampering or corruption) — callers should treat that as
 * "re-download required", never fall back to any other content source. */
export async function readOfflineBookForDisplay(bookId: string) {
  const pkg = await readOfflinePackage(bookId);
  const dek = await getOfflineBookDek(bookId);
  if (!pkg || !dek) throw new OfflinePackageIntegrityError('package (missing from local storage)');
  return decryptOfflinePackage({ ...pkg, package_dek: dek });
}

/** The periodic online check-in — call while connectivity is available
 * and well before the locally-cached expiry, so a legitimately-renewed
 * license never lapses just because the app wasn't opened online in
 * time. Silently no-ops (keeps the stale local state) on a network
 * failure, matching the backend's "a device with no connectivity cannot
 * learn about revocation sooner than this window" policy. */
export async function verifyAndRenewOfflineLicense(bookId: string): Promise<void> {
  const entry = await getOfflineIndexEntry(bookId);
  if (!entry) return;
  const res: any = await getRequest(ROUTES.books.offlineVerify(bookId, entry.deviceId)).catch(() => null);
  if (!res?.success) return;
  if (!res.data?.valid) {
    // Revoked server-side (refund, takedown, lost access) — remove the
    // local copy outright rather than leaving a license row the device
    // will keep believing is fine until its cached expiry lapses.
    await removeOfflineDownload(bookId);
    return;
  }
  const index = await readIndex();
  if (index[bookId]) {
    index[bookId] = { ...index[bookId], expiresAt: res.data.expires_at, lastVerifiedAt: new Date().toISOString() };
    await writeIndex(index);
  }
}

export async function removeOfflineDownload(bookId: string): Promise<void> {
  const entry = await getOfflineIndexEntry(bookId);
  if (entry) {
    // Best-effort — local removal must succeed even with no
    // connectivity; the server-side row simply won't be renewable next
    // time it's checked, which is fine (see verify's revoked-path).
    await deleteRequest(ROUTES.books.offlineRevoke(bookId, entry.deviceId)).catch(() => {});
  }
  await removeOfflinePackage(bookId);
  await removeOfflineBookDek(bookId);
  const index = await readIndex();
  delete index[bookId];
  await writeIndex(index);
}

export async function totalDownloadedBookCount(): Promise<number> {
  return (await listDownloadedBookIds()).length;
}

/** Sign-out / account-switch cleanup — a DEK (and the package it
 * unlocks) issued to one account must not remain usable once a
 * different account signs in on the same device. Called from
 * src/security/authStorage.ts's clearAuthSession via a dynamic import
 * (avoids a circular import: this module depends on src/network/*,
 * which itself depends on authStorage). */
export async function clearAllOfflineDownloadsForSignOut(): Promise<void> {
  const ids = await listDownloadedBookIds();
  await Promise.all(ids.map((id) => Promise.all([removeOfflinePackage(id), removeOfflineBookDek(id)])));
  await AsyncStorage.removeItem(INDEX_KEY);
}

export async function recomputeIndexEntrySize(bookId: string): Promise<void> {
  const index = await readIndex();
  if (!index[bookId]) return;
  index[bookId].sizeBytes = await offlinePackageSizeBytes(bookId);
  await writeIndex(index);
}
