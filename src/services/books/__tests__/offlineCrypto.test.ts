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

describe('offlineCrypto — image bundling', () => {
  const dek = nodeCrypto.randomBytes(32);
  const base = { bookId: 'book-1', licenseId: 'license-1', packageVersion: 1 };

  const manifestWithOneImage = {
    book_id: 'book-1', title: 'A Test Book', author_name: 'A. Author',
    license_id: 'license-1', package_version: 1, generated_at: new Date().toISOString(),
    chapters: [{ stable_id: 'c1', order: 1, title: 'First', word_count: 5, content_hash: 'y' }],
    images: [{ asset_id: 'asset-1', content_type: 'image/png', width: 40, height: 30, content_hash: 'h' }],
  };

  it('decrypts a bundled image to a renderable data: URI', () => {
    const manifestPart = encryptPartForTest(dek, manifestWithOneImage, { ...base, part: 'manifest' });
    const c1 = encryptPartForTest(dek, [{ type: 'paragraph', text: 'First.' }], { ...base, part: 'chapter:c1:1' });
    const fakeBase64Png = Buffer.from('not a real png but exercises the round-trip').toString('base64');
    const img = encryptPartForTest(dek, fakeBase64Png, { ...base, part: 'image:asset-1' });

    const result = decryptOfflinePackage({
      license_id: 'license-1', book_id: 'book-1', package_version: 1, package_dek: dek.toString('base64'),
      manifest: manifestPart, chapters: { c1 }, images: { 'asset-1': img },
    });

    expect(result.images['asset-1'].contentType).toBe('image/png');
    expect(result.images['asset-1'].width).toBe(40);
    expect(result.images['asset-1'].dataUri).toBe(`data:image/png;base64,${fakeBase64Png}`);
  });

  it('rejects a package missing an image part the manifest declares', () => {
    const manifestPart = encryptPartForTest(dek, manifestWithOneImage, { ...base, part: 'manifest' });
    const c1 = encryptPartForTest(dek, [{ type: 'paragraph', text: 'First.' }], { ...base, part: 'chapter:c1:1' });

    expect(() =>
      decryptOfflinePackage({
        license_id: 'license-1', book_id: 'book-1', package_version: 1, package_dek: dek.toString('base64'),
        manifest: manifestPart, chapters: { c1 }, images: {}, // image missing
      }),
    ).toThrow(OfflinePackageIntegrityError);
  });

  it('rejects a tampered image ciphertext', () => {
    const manifestPart = encryptPartForTest(dek, manifestWithOneImage, { ...base, part: 'manifest' });
    const c1 = encryptPartForTest(dek, [{ type: 'paragraph', text: 'First.' }], { ...base, part: 'chapter:c1:1' });
    const img = encryptPartForTest(dek, Buffer.from('abc').toString('base64'), { ...base, part: 'image:asset-1' });
    const raw = Buffer.from(img.ciphertext, 'base64');
    raw[0] ^= 0xff;
    const tamperedImg = { ...img, ciphertext: raw.toString('base64') };

    expect(() =>
      decryptOfflinePackage({
        license_id: 'license-1', book_id: 'book-1', package_version: 1, package_dek: dek.toString('base64'),
        manifest: manifestPart, chapters: { c1 }, images: { 'asset-1': tamperedImg },
      }),
    ).toThrow(OfflinePackageIntegrityError);
  });

  it('is fully backward-compatible with a manifest that has no images key at all', () => {
    const manifestNoImages = {
      book_id: 'book-1', title: 'Image-free book', author_name: 'A. Author',
      license_id: 'license-1', package_version: 1, generated_at: new Date().toISOString(),
      chapters: [{ stable_id: 'c1', order: 1, title: 'First', word_count: 5, content_hash: 'y' }],
      // no `images` field — simulates a package built before this feature existed
    };
    const manifestPart = encryptPartForTest(dek, manifestNoImages, { ...base, part: 'manifest' });
    const c1 = encryptPartForTest(dek, [{ type: 'paragraph', text: 'First.' }], { ...base, part: 'chapter:c1:1' });

    const result = decryptOfflinePackage({
      license_id: 'license-1', book_id: 'book-1', package_version: 1, package_dek: dek.toString('base64'),
      manifest: manifestPart, chapters: { c1 }, // no `images` field passed in either
    });

    expect(result.images).toEqual({});
    expect(result.chapters).toHaveLength(1);
  });

  it('bundles the same asset_id once and both placements resolve to the identical data URI', () => {
    // Mirrors the backend dedup: two blocks reference the same asset_id,
    // the manifest/package only ever carries ONE image part for it.
    const manifestPart = encryptPartForTest(dek, manifestWithOneImage, { ...base, part: 'manifest' });
    const c1 = encryptPartForTest(
      dek,
      [
        { type: 'image', id: 'img-block-1', asset_id: 'asset-1' },
        { type: 'paragraph', text: 'Middle text.' },
        { type: 'image', id: 'img-block-2', asset_id: 'asset-1' },
      ],
      { ...base, part: 'chapter:c1:1' },
    );
    const fakeBase64 = Buffer.from('shared image bytes').toString('base64');
    const img = encryptPartForTest(dek, fakeBase64, { ...base, part: 'image:asset-1' });

    const result = decryptOfflinePackage({
      license_id: 'license-1', book_id: 'book-1', package_version: 1, package_dek: dek.toString('base64'),
      manifest: manifestPart, chapters: { c1 }, images: { 'asset-1': img },
    });

    const blocks = result.chapters[0].content_blocks;
    const dataUri = result.images['asset-1'].dataUri;
    expect(blocks.filter((b: any) => b.type === 'image')).toHaveLength(2);
    expect(dataUri).toBe(`data:image/png;base64,${fakeBase64}`);
    // Both placements resolve via the one shared asset_id key.
    expect(blocks[0].asset_id).toBe('asset-1');
    expect(blocks[2].asset_id).toBe('asset-1');
  });
});
