import { buildVoiceAttachment, classifyVoicePlaybackReadiness, resolveEmbeddedVoicePlaybackUri } from '../voiceAttachment';
import type { AttachmentMeta } from '../uploadFileToBackend';

describe('buildVoiceAttachment', () => {
  it('prefers attachment.url, and derives mediaAssetId (the permanent identity) from the Django asset id', () => {
    const attachment = {
      id: 'upload-1',
      url: 'https://cdn.example.com/voice.m4a?sig=abc',
      assetId: 'asset-42',
      mimeType: 'audio/mp4',
      originalName: 'note.m4a',
      size: 2048,
    } as unknown as AttachmentMeta;

    const voice = buildVoiceAttachment({
      attachment,
      localUri: 'file:///tmp/note.m4a',
      durationMs: 5000,
    });

    expect(voice).toMatchObject({
      uri: 'https://cdn.example.com/voice.m4a?sig=abc',
      url: 'https://cdn.example.com/voice.m4a?sig=abc',
      mediaAssetId: 'asset-42',
      id: 'upload-1',
      mimeType: 'audio/mp4',
      fileName: 'note.m4a',
      fileSize: 2048,
      durationMs: 5000,
    });
  });

  it('falls back to the local recording uri when the upload result has no url (e.g. upload still failed)', () => {
    const voice = buildVoiceAttachment({
      attachment: null,
      localUri: 'file:///tmp/note.m4a',
      durationMs: 1200,
    });

    expect(voice.uri).toBe('file:///tmp/note.m4a');
    expect(voice.url).toBeUndefined();
    expect(voice.durationMs).toBe(1200);
  });

  it('falls back through downloadUrl and displayUrl when url is absent', () => {
    const attachment = { downloadUrl: 'https://cdn.example.com/a' } as unknown as AttachmentMeta;
    expect(
      buildVoiceAttachment({ attachment, localUri: 'file:///x.m4a', durationMs: 1 }).url,
    ).toBe('https://cdn.example.com/a');

    const attachment2 = { displayUrl: 'https://cdn.example.com/b' } as unknown as AttachmentMeta;
    expect(
      buildVoiceAttachment({ attachment: attachment2, localUri: 'file:///x.m4a', durationMs: 1 }).url,
    ).toBe('https://cdn.example.com/b');
  });
});

describe('resolveEmbeddedVoicePlaybackUri', () => {
  it('prefers a local uri over a remote one (sender optimistic playback)', () => {
    const uri = resolveEmbeddedVoicePlaybackUri({
      localUri: 'file:///tmp/note.m4a',
      url: 'https://cdn.example.com/voice.m4a',
      uri: 'https://cdn.example.com/voice.m4a',
      durationMs: 1000,
    });
    expect(uri).toBe('file:///tmp/note.m4a');
  });

  it('falls back to url, then uri, then the passed-in attachment fallback url', () => {
    expect(
      resolveEmbeddedVoicePlaybackUri({ url: 'https://cdn.example.com/a', durationMs: 1 } as any),
    ).toBe('https://cdn.example.com/a');

    expect(
      resolveEmbeddedVoicePlaybackUri({ uri: 'https://cdn.example.com/b', durationMs: 1 } as any),
    ).toBe('https://cdn.example.com/b');

    expect(
      resolveEmbeddedVoicePlaybackUri({ durationMs: 1 } as any, 'https://cdn.example.com/fallback'),
    ).toBe('https://cdn.example.com/fallback');
  });

  it('returns null (not empty string) when nothing usable is available — the field is missing, not "resolved to nothing"', () => {
    expect(resolveEmbeddedVoicePlaybackUri(undefined)).toBeNull();
    expect(resolveEmbeddedVoicePlaybackUri(null)).toBeNull();
    expect(resolveEmbeddedVoicePlaybackUri({ durationMs: 1 } as any)).toBeNull();
  });

  it('rejects a bare id/objectKey masquerading as a uri (no scheme) instead of handing an unplayable value to a player', () => {
    expect(
      resolveEmbeddedVoicePlaybackUri({ uri: 'asset-42', durationMs: 1 } as any),
    ).toBeNull();
  });

  it('accepts file:// and content:// uris in addition to http(s)', () => {
    expect(resolveEmbeddedVoicePlaybackUri({ uri: 'file:///a.m4a', durationMs: 1 } as any)).toBe('file:///a.m4a');
    expect(resolveEmbeddedVoicePlaybackUri({ uri: 'content://media/a', durationMs: 1 } as any)).toBe('content://media/a');
  });
});

describe('classifyVoicePlaybackReadiness', () => {
  it('is "ready" whenever a playback uri was resolved, regardless of message status', () => {
    expect(classifyVoicePlaybackReadiness('https://cdn.example.com/a.m4a', 'sent')).toBe('ready');
    expect(classifyVoicePlaybackReadiness('https://cdn.example.com/a.m4a', undefined)).toBe('ready');
  });

  it('is "resolving" — not "unavailable" — while the message is still local/pending/sending', () => {
    expect(classifyVoicePlaybackReadiness(null, 'local_only')).toBe('resolving');
    expect(classifyVoicePlaybackReadiness(null, 'pending')).toBe('resolving');
    expect(classifyVoicePlaybackReadiness(null, 'sending')).toBe('resolving');
  });

  it('is "unavailable" once the message is settled (sent/delivered/failed/etc.) with no playable uri', () => {
    expect(classifyVoicePlaybackReadiness(null, 'sent')).toBe('unavailable');
    expect(classifyVoicePlaybackReadiness(null, 'delivered')).toBe('unavailable');
    expect(classifyVoicePlaybackReadiness(null, 'failed')).toBe('unavailable');
    expect(classifyVoicePlaybackReadiness(null, undefined)).toBe('unavailable');
  });
});
