// react-native-quick-crypto's native module isn't linked under Jest (no
// RN runtime), but it exposes the identical Node-compatible
// createDecipheriv/createCipheriv AES-GCM API that Node's own built-in
// `crypto` module provides — the same algorithm, the same call shape
// (this is exactly what src/security/customE2EE.ts's already-shipped
// decryptConversationPayload relies on). Mocking it with Node's real
// crypto module here tests the ACTUAL AES-256-GCM behavior (genuine
// authentication-tag verification, not a stub that always "succeeds"),
// while quick-crypto's own native binding is separately proven callable
// by its existing production use in customE2EE.ts.
import { Buffer } from 'buffer';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const nodeCrypto: any = require('crypto');

jest.mock('react-native-quick-crypto', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const realCrypto = require('crypto');
  return {
    __esModule: true,
    default: {
      createDecipheriv: (algo: string, key: Buffer, iv: Buffer) => realCrypto.createDecipheriv(algo, key, iv),
      createCipheriv: (algo: string, key: Buffer, iv: Buffer) => realCrypto.createCipheriv(algo, key, iv),
    },
  };
});

import { decryptPackagePart, decryptOfflinePackage, OfflinePackageIntegrityError } from '../offlineCrypto';

const AAD = (bookId: string, licenseId: string, version: number, part: string) =>
  Buffer.from(`${bookId}:${licenseId}:${version}:${part}`, 'utf8');

function encryptPartForTest(
  dek: Buffer,
  plaintext: unknown,
  opts: { bookId: string; licenseId: string; packageVersion: number; part: string },
) {
  const nonce = nodeCrypto.randomBytes(12);
  const cipher = nodeCrypto.createCipheriv('aes-256-gcm', dek, nonce);
  cipher.setAAD(AAD(opts.bookId, opts.licenseId, opts.packageVersion, opts.part));
  const ciphertext = Buffer.concat([cipher.update(Buffer.from(JSON.stringify(plaintext), 'utf8')), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { nonce: nonce.toString('base64'), ciphertext: ciphertext.toString('base64'), tag: tag.toString('base64') };
}

describe('offlineCrypto', () => {
  const dek = nodeCrypto.randomBytes(32);
  const opts = { bookId: 'book-1', licenseId: 'license-1', packageVersion: 1, part: 'manifest' };

  it('round-trips real AES-256-GCM encryption/decryption', () => {
    const part = encryptPartForTest(dek, { hello: 'world' }, opts);
    const result = decryptPackagePart(dek.toString('base64'), part, opts);
    expect(result).toEqual({ hello: 'world' });
  });

  it('rejects a tampered ciphertext byte (authentication failure, not garbage output)', () => {
    const part = encryptPartForTest(dek, { secret: 'book text' }, opts);
    const raw = Buffer.from(part.ciphertext, 'base64');
    raw[0] ^= 0xff;
    const tampered = { ...part, ciphertext: raw.toString('base64') };
    expect(() => decryptPackagePart(dek.toString('base64'), tampered, opts)).toThrow(OfflinePackageIntegrityError);
  });

  it('rejects a ciphertext decrypted under the wrong AAD (reordered/substituted part)', () => {
    const part = encryptPartForTest(dek, { secret: 'chapter one' }, { ...opts, part: 'chapter:a:0' });
    expect(() =>
      decryptPackagePart(dek.toString('base64'), part, { ...opts, part: 'chapter:b:1' }),
    ).toThrow(OfflinePackageIntegrityError);
  });

  it('rejects decryption with the wrong key entirely', () => {
    const part = encryptPartForTest(dek, { secret: 'x' }, opts);
    const wrongDek = nodeCrypto.randomBytes(32);
    expect(() => decryptPackagePart(wrongDek.toString('base64'), part, opts)).toThrow(OfflinePackageIntegrityError);
  });

  it('decryptOfflinePackage reconstructs chapters in manifest order, not delivery order', () => {
    const base = { bookId: 'book-1', licenseId: 'license-1', packageVersion: 1 };
    const manifest = {
      book_id: 'book-1', title: 'A Test Book', author_name: 'A. Author',
      license_id: 'license-1', package_version: 1, generated_at: new Date().toISOString(),
      chapters: [
        { stable_id: 'c2', order: 2, title: 'Second', word_count: 5, content_hash: 'x' },
        { stable_id: 'c1', order: 1, title: 'First', word_count: 5, content_hash: 'y' },
      ],
    };
    const manifestPart = encryptPartForTest(dek, manifest, { ...base, part: 'manifest' });
    const c1 = encryptPartForTest(dek, [{ type: 'paragraph', text: 'First chapter text.' }], { ...base, part: 'chapter:c1:1' });
    const c2 = encryptPartForTest(dek, [{ type: 'paragraph', text: 'Second chapter text.' }], { ...base, part: 'chapter:c2:2' });

    const result = decryptOfflinePackage({
      license_id: 'license-1', book_id: 'book-1', package_version: 1, package_dek: dek.toString('base64'),
      manifest: manifestPart, chapters: { c2, c1 },
    });

    expect(result.chapters.map((c) => c.stable_id)).toEqual(['c1', 'c2']);
    expect(result.chapters[0].content_blocks[0].text).toBe('First chapter text.');
    expect(result.chapters[1].content_blocks[0].text).toBe('Second chapter text.');
  });

  it('rejects a package missing a chapter the manifest declares', () => {
    const base = { bookId: 'book-1', licenseId: 'license-1', packageVersion: 1 };
    const manifest = {
      book_id: 'book-1', title: 'A Test Book', author_name: 'A. Author',
      license_id: 'license-1', package_version: 1, generated_at: new Date().toISOString(),
      chapters: [
        { stable_id: 'c1', order: 1, title: 'First', word_count: 5, content_hash: 'y' },
        { stable_id: 'c2', order: 2, title: 'Second', word_count: 5, content_hash: 'x' },
      ],
    };
    const manifestPart = encryptPartForTest(dek, manifest, { ...base, part: 'manifest' });
    const c1 = encryptPartForTest(dek, [{ type: 'paragraph', text: 'First.' }], { ...base, part: 'chapter:c1:1' });

    expect(() =>
      decryptOfflinePackage({
        license_id: 'license-1', book_id: 'book-1', package_version: 1, package_dek: dek.toString('base64'),
        manifest: manifestPart, chapters: { c1 }, // c2 missing
      }),
    ).toThrow(OfflinePackageIntegrityError);
  });

  it('contains no readable plaintext anywhere in the encrypted part itself', () => {
    const part = encryptPartForTest(dek, { text: 'The quick brown fox jumps over the lazy dog.' }, opts);
    const serialized = JSON.stringify(part);
    expect(serialized).not.toContain('quick brown fox');
  });
});
