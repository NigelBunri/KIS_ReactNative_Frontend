// Decrypts a KIS offline book package (apps.books.offline_crypto on the
// backend). Uses react-native-quick-crypto's Node-compatible
// createDecipheriv — the exact same proven AES-256-GCM call shape
// src/security/customE2EE.ts's decryptConversationPayload already uses
// for real E2EE chat messages, not a new/unverified crypto path. Keyed
// at app boot: index.js sets `global.crypto = QuickCrypto` when WebCrypto
// isn't already present, and this module additionally imports the
// library directly (matching customE2EE.ts) rather than relying on the
// global, so it still works even if that polyfill assignment is ever
// changed.
import { Buffer } from 'buffer';
import crypto from 'react-native-quick-crypto';

export type EncryptedPart = { nonce: string; ciphertext: string; tag: string };

export class OfflinePackageIntegrityError extends Error {
  constructor(part: string, cause?: unknown) {
    super(`Offline book package part "${part}" failed integrity verification.`);
    this.name = 'OfflinePackageIntegrityError';
    if (cause) (this as any).cause = cause;
  }
}

const aad = (bookId: string, licenseId: string, packageVersion: number, part: string) =>
  Buffer.from(`${bookId}:${licenseId}:${packageVersion}:${part}`, 'utf8');

/**
 * Decrypts one part (the manifest, or one chapter) of an offline
 * package. Throws OfflinePackageIntegrityError — never returns partial
 * or best-effort plaintext — if the ciphertext, tag, or AAD don't match
 * exactly what was encrypted: a tampered byte, a chapter's ciphertext
 * swapped into a different chapter's slot, or a stale package decrypted
 * against the wrong license/version all fail the GCM authentication tag
 * check here, by construction (see apps.books.offline_crypto's
 * docstring for why AAD binds book/license/version/part together).
 */
export function decryptPackagePart<T = unknown>(
  dekBase64: string,
  encrypted: EncryptedPart,
  opts: { bookId: string; licenseId: string; packageVersion: number; part: string },
): T {
  const key = Buffer.from(dekBase64, 'base64');
  const nonce = Buffer.from(encrypted.nonce, 'base64');
  const ciphertext = Buffer.from(encrypted.ciphertext, 'base64');
  const tag = Buffer.from(encrypted.tag, 'base64');

  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce);
    decipher.setAuthTag(tag as any);
    decipher.setAAD(aad(opts.bookId, opts.licenseId, opts.packageVersion, opts.part) as any);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return JSON.parse(plaintext.toString('utf8'));
  } catch (err) {
    throw new OfflinePackageIntegrityError(opts.part, err);
  }
}

export type OfflineManifest = {
  book_id: string;
  title: string;
  author_name: string;
  license_id: string;
  package_version: number;
  generated_at: string;
  chapters: { stable_id: string; order: number; title: string; word_count: number; content_hash: string }[];
};

/**
 * Decrypts the full package: the manifest first, then every chapter the
 * manifest declares, in the manifest's own authoritative order (never
 * the order keys happen to iterate in a JS object or arrive over the
 * wire). Rejects the whole package — not a partial render — if any
 * chapter the manifest lists is missing from what was delivered, or if
 * any part fails its own integrity check.
 */
export function decryptOfflinePackage(pkg: {
  license_id: string;
  book_id: string;
  package_version: number;
  package_dek: string;
  manifest: EncryptedPart;
  chapters: Record<string, EncryptedPart>;
}): { manifest: OfflineManifest; chapters: { stable_id: string; order: number; title: string; word_count: number; content_blocks: any[] }[] } {
  const base = { bookId: pkg.book_id, licenseId: pkg.license_id, packageVersion: pkg.package_version };
  const manifest = decryptPackagePart<OfflineManifest>(pkg.package_dek, pkg.manifest, { ...base, part: 'manifest' });

  const chapters = manifest.chapters
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((entry) => {
      const encryptedChapter = pkg.chapters[entry.stable_id];
      if (!encryptedChapter) {
        throw new OfflinePackageIntegrityError(`chapter:${entry.stable_id}:${entry.order} (missing from package)`);
      }
      const blocks = decryptPackagePart<any[]>(pkg.package_dek, encryptedChapter, {
        ...base,
        part: `chapter:${entry.stable_id}:${entry.order}`,
      });
      return { stable_id: entry.stable_id, order: entry.order, title: entry.title, word_count: entry.word_count, content_blocks: blocks };
    });

  return { manifest, chapters };
}
