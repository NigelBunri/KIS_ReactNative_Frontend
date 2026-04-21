import { normalizeVideoUrl } from '@/Module/vieo/utils';
import { API_BASE_URL, MEDIA_FALLBACK_API_BASE_URL } from '@/network/config';

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

const parseVideoUrl = (value: string) => {
  const resolved = rewriteLoopbackUrl(value) ?? value;
  const normalized = normalizeVideoUrl(resolved);
  if (!normalized) return null;
  try {
    const parsed = new URL(normalized);
    const host = parsed.hostname?.toLowerCase?.() ?? null;
    return {
      url: normalized,
      host,
      isLoopbackHost: host ? LOOPBACK_HOSTS.has(host) : false,
      isHttp: parsed.protocol.toLowerCase() === 'http:',
    };
  } catch {
    return null;
  }
};

export const getBroadcastFeedVideoSources = (attachment: any): BroadcastFeedVideoSource[] => {
  const seen = new Set<string>();
  const sources: BroadcastFeedVideoSource[] = [];
  for (const key of SOURCE_KEYS) {
    const raw = attachment?.[key];
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
    });
  }
  return [...sources].sort((left, right) => {
    const leftRisk = (left.isLoopbackHost ? 100 : 0) + (left.isHttp ? 10 : 0);
    const rightRisk = (right.isLoopbackHost ? 100 : 0) + (right.isHttp ? 10 : 0);
    if (leftRisk !== rightRisk) return leftRisk - rightRisk;
    return (KIND_PRIORITY[left.kind] ?? 99) - (KIND_PRIORITY[right.kind] ?? 99);
  });
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
  return normalizeVideoUrl(rewriteLoopbackUrl(candidate) ?? candidate);
};

const rewriteLoopbackUrl = (value: string) => {
  const normalized = normalizeVideoUrl(value);
  if (!normalized) return null;
  try {
    const parsed = new URL(normalized);
    if (!parsed.hostname || !LOOPBACK_HOSTS.has(parsed.hostname.toLowerCase())) {
      return normalized;
    }
    const base = new URL(MEDIA_FALLBACK_API_BASE_URL || API_BASE_URL);
    parsed.protocol = base.protocol;
    parsed.hostname = base.hostname;
    parsed.port = base.port;
    return parsed.toString();
  } catch {
    return normalized;
  }
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
