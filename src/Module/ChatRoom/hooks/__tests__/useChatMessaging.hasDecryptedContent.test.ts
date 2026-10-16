import { hasDecryptedContent, attachmentHasRealContent } from '../useChatMessaging';

// CONFIRMED ROOT CAUSE (live-tested 2026-10-16) of "files appear encrypted/
// unreadable to the receiver": for an E2EE file/image/video message,
// sendOverNetworkImpl's mediaPlaintextEcho deliberately leaves a bare
// `{id: a.id}` stub in the server-visible plaintext shell (real content -
// url/mimeType/size/etc. - stays sealed inside the encrypted payload).
// mapServerMessage maps that stub straight into message.attachments/
// media.attachments BEFORE decryption ever runs. hasDecryptedContent used
// to treat "attachments array is non-empty" alone as proof the message
// was already fully decrypted - true for a locally-sent message, but
// also true for that content-less stub. decryptChatMessage's own
// short-circuit then found that exact stub already sitting in state (it's
// added to messagesRef BEFORE decrypt is ever called) and skipped
// decryption entirely, forever. Same stub-echo risk applied to voice
// notes via voicePlaintextEcho ({mediaAssetId, objectKey, durationMs},
// no uri/url).

describe('attachmentHasRealContent', () => {
  it('is false for a bare id-only stub (the plaintext echo of an E2EE attachment)', () => {
    expect(attachmentHasRealContent({ id: 'att-1' })).toBe(false);
  });

  it('is true once a real content locator is present', () => {
    expect(attachmentHasRealContent({ id: 'att-1', url: 'https://cdn.example.com/photo.jpg' })).toBe(true);
    expect(attachmentHasRealContent({ id: 'att-1', downloadUrl: 'https://cdn.example.com/f' })).toBe(true);
    expect(attachmentHasRealContent({ id: 'att-1', localUri: 'file:///tmp/photo.jpg' })).toBe(true);
  });

  // CONFIRMED ROOT CAUSE (live-tested 2026-10-16) of "gallery images always
  // show the lock icon, receiver never decrypts": Nest's
  // messages.service.ts normalizeAttachments() backfills mimeType (and
  // storageKey) server-side from the matching confirmed UploadIntent for
  // EVERY message, including E2EE ones where the client only ever echoed
  // a bare `{id}`. So the receiver's raw, still-encrypted attachment
  // already carries a real mimeType - and often storageKey - before
  // decryption ever runs, with no url/downloadUrl/publicUrl/displayUrl/
  // localUri. mimeType (and storageKey) must never count as real content.
  it('is false for the server-backfilled id+mimeType+storageKey stub, with no actual url', () => {
    expect(
      attachmentHasRealContent({ id: 'att-1', mimeType: 'image/jpeg', storageKey: 'uploads/att-1.jpg' }),
    ).toBe(false);
  });

  it('is false for null/undefined', () => {
    expect(attachmentHasRealContent(null)).toBe(false);
    expect(attachmentHasRealContent(undefined)).toBe(false);
  });
});

describe('hasDecryptedContent — must not treat an undecrypted E2EE stub as already-readable content', () => {
  it('is false for a message whose only attachment is the id-only plaintext echo stub', () => {
    const preDecryptStub = {
      text: undefined,
      attachments: [{ id: 'att-1' }],
    };
    expect(hasDecryptedContent(preDecryptStub as any)).toBe(false);
  });

  it('is false for a message whose only media.attachments entry is the id-only stub', () => {
    const preDecryptStub = {
      text: undefined,
      media: { attachments: [{ id: 'att-1' }] },
    };
    expect(hasDecryptedContent(preDecryptStub as any)).toBe(false);
  });

  it('is true once the attachment has been decrypted into a real, openable locator', () => {
    const decrypted = {
      text: undefined,
      attachments: [{ id: 'att-1', url: 'https://cdn.example.com/photo.jpg', mimeType: 'image/jpeg' }],
    };
    expect(hasDecryptedContent(decrypted as any)).toBe(true);
  });

  it('is false for a voice note whose only value is the plaintext echo stub (no uri/url)', () => {
    const preDecryptVoiceStub = {
      text: undefined,
      voice: { mediaAssetId: 'asset-1', objectKey: 'voice/asset-1.m4a', durationMs: 4200 },
    };
    expect(hasDecryptedContent(preDecryptVoiceStub as any)).toBe(false);
  });

  it('is true once the voice note has a real playable uri/url', () => {
    const decryptedVoice = {
      text: undefined,
      voice: { uri: 'https://cdn.example.com/voice/asset-1.m4a', durationMs: 4200 },
    };
    expect(hasDecryptedContent(decryptedVoice as any)).toBe(true);
  });

  it('is still true for genuinely plain text content, unaffected by the stub fix', () => {
    expect(hasDecryptedContent({ text: 'hello there' } as any)).toBe(true);
  });

  it('is still false for the "Encrypted message" placeholder text alone', () => {
    expect(hasDecryptedContent({ text: 'Encrypted message' } as any)).toBe(false);
  });

  it('is still true for a sticker, poll, event, or non-empty contacts list', () => {
    expect(hasDecryptedContent({ text: undefined, sticker: { id: 's1' } } as any)).toBe(true);
    expect(hasDecryptedContent({ text: undefined, poll: { question: 'q' } } as any)).toBe(true);
    expect(hasDecryptedContent({ text: undefined, event: { title: 'e' } } as any)).toBe(true);
    expect(hasDecryptedContent({ text: undefined, contacts: [{ id: 'c1' }] } as any)).toBe(true);
  });
});
