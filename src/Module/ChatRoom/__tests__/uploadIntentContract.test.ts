import { InvalidUploadIntentError, buildConfirmPath, resolveUploadIntent } from '../uploadIntentContract';

const UPLOAD_ID = 'a1a1a1a1-1111-1111-1111-111111111111';
const STORAGE_KEY = '2026-08-02/1a55cbad-dd03-4f67-be7a-fa041dfec3da-video.mp4';

describe('resolveUploadIntent — every file kind shares this same extraction logic', () => {
  const kinds: Array<{ label: string; filename: string; contentType: string }> = [
    { label: 'video', filename: 'clip.mp4', contentType: 'video/mp4' },
    { label: 'image', filename: 'photo.jpg', contentType: 'image/jpeg' },
    { label: 'pdf', filename: 'doc.pdf', contentType: 'application/pdf' },
    { label: 'generic document', filename: 'report.docx', contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  ];

  for (const { label } of kinds) {
    it(`${label}: uses uploadId from the initiate response for confirmation`, () => {
      const result = resolveUploadIntent({
        uploadId: UPLOAD_ID,
        storageKey: STORAGE_KEY,
        uploadUrl: 'https://s3.example.com/put?sig=abc',
        headers: { 'Content-Type': 'application/octet-stream' },
      });

      expect(result.uploadId).toBe(UPLOAD_ID);
      expect(buildConfirmPath(result.uploadId)).toBe(`/uploads/${UPLOAD_ID}/confirm`);
    });
  }

  it('a 17MB MP4 initiate response resolves through the identical path an image would', () => {
    const videoResponse = {
      uploadId: UPLOAD_ID,
      storageKey: STORAGE_KEY,
      uploadUrl: 'https://s3.example.com/put?sig=video',
    };
    const imageResponse = {
      uploadId: 'b2b2b2b2-2222-2222-2222-222222222222',
      storageKey: '2026-08-02/other-uuid-photo.jpg',
      uploadUrl: 'https://s3.example.com/put?sig=image',
    };

    const video = resolveUploadIntent(videoResponse);
    const image = resolveUploadIntent(imageResponse);

    expect(video.uploadId).toBe(videoResponse.uploadId);
    expect(image.uploadId).toBe(imageResponse.uploadId);
  });
});

describe('resolveUploadIntent — storage key must never be used as the confirm id', () => {
  it('never falls back to storageKey', () => {
    expect(() => resolveUploadIntent({ storageKey: STORAGE_KEY, uploadUrl: 'https://x' })).toThrow(
      InvalidUploadIntentError,
    );
  });

  it('never falls back to key', () => {
    expect(() => resolveUploadIntent({ key: STORAGE_KEY, uploadUrl: 'https://x' })).toThrow(InvalidUploadIntentError);
  });

  it('never falls back to objectKey / object_key', () => {
    expect(() => resolveUploadIntent({ objectKey: STORAGE_KEY, uploadUrl: 'https://x' })).toThrow(
      InvalidUploadIntentError,
    );
    expect(() => resolveUploadIntent({ object_key: STORAGE_KEY, uploadUrl: 'https://x' })).toThrow(
      InvalidUploadIntentError,
    );
  });

  it('never falls back to the upload URL or filename', () => {
    expect(() =>
      resolveUploadIntent({ uploadUrl: 'https://s3.example.com/put?sig=abc', filename: 'video.mp4' }),
    ).toThrow(InvalidUploadIntentError);
  });

  it('rejects an id containing a slash even if it happens to be present as `uploadId`', () => {
    expect(() => resolveUploadIntent({ uploadId: STORAGE_KEY, uploadUrl: 'https://x' })).toThrow(
      'storage key received instead of upload intent ID',
    );
  });

  it('rejects an id that looks like a filename (has an extension) even without a slash', () => {
    expect(() => resolveUploadIntent({ uploadId: 'video.mp4', uploadUrl: 'https://x' })).toThrow(
      InvalidUploadIntentError,
    );
  });

  it('throws before any network call would be made when the upload id is missing entirely', () => {
    expect(() => resolveUploadIntent({ uploadUrl: 'https://x' })).toThrow(
      'Upload initiation did not return an upload intent ID.',
    );
  });

  it('accepts the legacy snake_case upload_id alias but still rejects it if it is key-shaped', () => {
    expect(() => resolveUploadIntent({ upload_id: STORAGE_KEY, upload_url: 'https://x' })).toThrow(
      InvalidUploadIntentError,
    );
  });
});

describe('buildConfirmPath', () => {
  it('URL-encodes the upload id', () => {
    expect(buildConfirmPath('has space/slash')).toBe('/uploads/has%20space%2Fslash/confirm');
  });

  it('leaves a well-formed UUID untouched', () => {
    expect(buildConfirmPath(UPLOAD_ID)).toBe(`/uploads/${UPLOAD_ID}/confirm`);
  });
});

describe('resolveUploadIntent — filenames with spaces and special characters', () => {
  it('do not affect the resolved confirm path, since only uploadId feeds it', () => {
    const result = resolveUploadIntent({
      uploadId: UPLOAD_ID,
      storageKey: "2026-08-02/uuid-My Résumé (final) #2.mp4",
      uploadUrl: 'https://s3.example.com/put?sig=abc',
    });
    expect(buildConfirmPath(result.uploadId)).toBe(`/uploads/${UPLOAD_ID}/confirm`);
    expect(result.storageKey).toContain('My Résumé (final) #2.mp4');
  });
});
