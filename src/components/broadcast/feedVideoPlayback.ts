import { normalizeVideoUrl } from '@/Module/vieo/utils';
import { resolveBackendAssetUrl } from '@/network';
import { API_BASE_URL, NEST_API_BASE_URL } from '@/network/config';

export type BroadcastFeedVideoSourceKind =
  | 'stream_url'
  | 'url'
  | 'link'
  | 'resource_url'
  | 'source_url'
  | 'uri';

export type BroadcastFeedVideoSource = {
  kind: BroadcastFeedVideoSourceKind;
  url: string;
  host: string | null;
  isLoopbackHost: boolean;
  isHttp: boolean;
  needsAuthHeaders: boolean;
};

export const describeBroadcastFeedVideoSource = (
  source: BroadcastFeedVideoSource | null | undefined,
) => {
  if (!source) return null;
  return {
    kind: source.kind,
    url: source.url,
    host: source.host,
    risk: getBroadcastFeedVideoRiskNote(source),
  };
};

const SOURCE_KEYS: BroadcastFeedVideoSourceKind[] = [
  'stream_url',
  'url',
  'link',
  'resource_url',
  'source_url',
  'uri',
];

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);
const KIND_PRIORITY: Record<BroadcastFeedVideoSourceKind, number> = {
  stream_url: 0,
  url: 1,
  link: 2,
  resource_url: 3,
  source_url: 4,
  uri: 5,
};

const BACKEND_HOSTS = new Set(
  [API_BASE_URL, NEST_API_BASE_URL]
    .map((base) => {
      try {
        return new URL(base).host.toLowerCase();
      } catch {
        return null;
      }
    })
    .filter(Boolean) as string[],
);

const mediaTypeForUrl = (value: string | null | undefined) => {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    const pathname = parsed.pathname.toLowerCase();
    if (pathname.endsWith('.m3u8')) return 'm3u8';
    if (pathname.endsWith('.mpd')) return 'mpd';
    if (pathname.endsWith('.mov')) return 'mov';
    if (pathname.endsWith('.webm')) return 'webm';
    if (pathname.endsWith('.mp4') || pathname.includes('.mp4/')) return 'mp4';
  } catch {
    const lower = value.toLowerCase();
    if (lower.includes('.m3u8')) return 'm3u8';
    if (lower.includes('.mpd')) return 'mpd';
    if (lower.includes('.mov')) return 'mov';
    if (lower.includes('.webm')) return 'webm';
    if (lower.includes('.mp4')) return 'mp4';
  }
  return null;
};

export const getBroadcastFeedVideoSourceType = (
  attachment: any,
  source: BroadcastFeedVideoSource | null | undefined,
) => {
  const mime = String(
    attachment?.mime_type ??
      attachment?.mimeType ??
      attachment?.content_type ??
      attachment?.contentType ??
      '',
  ).toLowerCase();
  if (mime.includes('mpegurl') || mime.includes('m3u8')) return 'm3u8';
  if (mime.includes('dash') || mime.includes('mpd')) return 'mpd';
  if (mime.includes('quicktime')) return 'mov';
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('mp4')) return 'mp4';
  return mediaTypeForUrl(source?.url);
};

const parseVideoUrl = (value: string) => {
  const resolved = resolveBackendAssetUrl(value) ?? value;
  const normalized = normalizeVideoUrl(resolved);
  if (!normalized) return null;
  try {
    const parsed = new URL(normalized);
    // Hermes URL parser may append a trailing slash to file paths — strip it.
    if (parsed.pathname !== '/' && parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.replace(/\/+$/, '');
    }
    const cleanUrl = parsed.toString();
    const host = parsed.hostname?.toLowerCase?.() ?? null;
    // Only send auth headers for API endpoints, not direct media file paths.
    // Django middleware can reject auth headers on /media/ URLs (causing -11850 in AVFoundation).
    const isApiPath = parsed.pathname.startsWith('/api/');
    return {
      url: cleanUrl,
      host,
      isLoopbackHost: host ? LOOPBACK_HOSTS.has(host) : false,
      isHttp: parsed.protocol.toLowerCase() === 'http:',
      needsAuthHeaders: BACKEND_HOSTS.has(parsed.host.toLowerCase()) && isApiPath,
    };
  } catch {
    return null;
  }
};

export const getBroadcastFeedVideoSources = (attachment: any): BroadcastFeedVideoSource[] => {
  const seen = new Set<string>();
  const sources: BroadcastFeedVideoSource[] = [];
  const rawCandidates: Record<string, string | null> = {};
  for (const key of SOURCE_KEYS) {
    const raw = attachment?.[key];
    rawCandidates[key] = typeof raw === 'string' ? raw : null;
    if (!raw || typeof raw !== 'string') continue;
    const parsed = parseVideoUrl(raw);
    if (!parsed || seen.has(parsed.url)) continue;
    seen.add(parsed.url);
    sources.push({
      kind: key,
      url: parsed.url,
      host: parsed.host,
      isLoopbackHost: parsed.isLoopbackHost,
      isHttp: parsed.isHttp,
      needsAuthHeaders: parsed.needsAuthHeaders,
    });
  }
  const sorted = [...sources].sort((left, right) => {
    const leftRisk = (left.isLoopbackHost ? 100 : 0) + (left.isHttp ? 10 : 0);
    const rightRisk = (right.isLoopbackHost ? 100 : 0) + (right.isHttp ? 10 : 0);
    if (leftRisk !== rightRisk) return leftRisk - rightRisk;
    return (KIND_PRIORITY[left.kind] ?? 99) - (KIND_PRIORITY[right.kind] ?? 99);
  });
  console.log(
    '[BroadcastFeed:sources] resolved',
    JSON.stringify({
      attachmentId: attachment?.video_id ?? attachment?.id ?? null,
      mediaType: attachment?.media_type ?? null,
      mimeType: attachment?.mime_type ?? null,
      rawCandidates,
      resolved: sorted.map((s) => ({
        kind: s.kind,
        url: s.url,
        host: s.host,
        risk: getBroadcastFeedVideoRiskNote(s) ?? 'none',
        needsAuthHeaders: s.needsAuthHeaders,
      })),
    }),
  );
  return sorted;
};

export const getBroadcastFeedVideoPosterUrl = (attachment: any): string | null => {
  const candidate =
    attachment?.thumb_url ??
    attachment?.thumbUrl ??
    attachment?.thumbnail_url ??
    attachment?.thumbnailUrl ??
    attachment?.thumbnail ??
    attachment?.thumb ??
    attachment?.preview_url ??
    attachment?.previewUrl ??
    null;
  if (!candidate || typeof candidate !== 'string') return null;
  const resolved = resolveBackendAssetUrl(candidate) ?? candidate;
  return normalizeVideoUrl(resolved);
};

export const getBroadcastFeedVideoSourceLabel = (source: BroadcastFeedVideoSource | null | undefined) => {
  if (!source) return 'unknown';
  if (source.kind === 'stream_url') return 'stream';
  if (source.kind === 'url') return 'file';
  return source.kind.replace(/_/g, ' ');
};

export const getBroadcastFeedVideoRiskNote = (source: BroadcastFeedVideoSource | null | undefined) => {
  if (!source) return null;
  if (source.isLoopbackHost) {
    return 'loopback-host';
  }
  if (source.isHttp) {
    return 'http-source';
  }
  return null;
};
