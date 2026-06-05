import RNFS from 'react-native-fs';

export type PermanentMediaDomain =
  | 'Chat'
  | 'Profile'
  | 'Institutions'
  | 'Feeds'
  | 'Broadcast'
  | 'Documents'
  | 'Education'
  | 'Market'
  | 'Other';

export type PermanentMediaBucket = 'Uploads' | 'Downloads' | 'Cache';

export const KIS_DOCUMENT_ROOT = `${RNFS.DocumentDirectoryPath}/KIS`;
export const KIS_MEDIA_ROOT = `${KIS_DOCUMENT_ROOT}/Media`;

export const sanitizePermanentFileName = (name?: string | null) =>
  String(name || `kis_file_${Date.now()}`)
    .replace(/[\\/:*?\"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim() || `kis_file_${Date.now()}`;

export const stripFileScheme = (uri: string) => {
  const raw = uri.startsWith('file://') ? uri.slice(7) : uri;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
};

export const fileUriForPath = (path: string) =>
  path.startsWith('file://') ? path : `file://${path}`;

const normalizeSegment = (value: string) =>
  sanitizePermanentFileName(value).replace(/\s+/g, '_');

export const getPermanentMediaDir = (
  domain: PermanentMediaDomain,
  bucket: PermanentMediaBucket,
) => `${KIS_MEDIA_ROOT}/${normalizeSegment(domain)}/${normalizeSegment(bucket)}`;

export const ensurePermanentMediaDirs = async () => {
  await RNFS.mkdir(KIS_DOCUMENT_ROOT).catch(() => {});
  await RNFS.mkdir(KIS_MEDIA_ROOT).catch(() => {});
};

export const ensurePermanentMediaDir = async (
  domain: PermanentMediaDomain,
  bucket: PermanentMediaBucket,
) => {
  await ensurePermanentMediaDirs();
  const dir = getPermanentMediaDir(domain, bucket);
  await RNFS.mkdir(dir).catch(() => {});
  return dir;
};

export const buildPermanentMediaPath = async (
  domain: PermanentMediaDomain,
  bucket: PermanentMediaBucket,
  filename?: string | null,
  stableKey?: string | null,
) => {
  const dir = await ensurePermanentMediaDir(domain, bucket);
  const cleanName = sanitizePermanentFileName(filename);
  const cleanKey = stableKey
    ? sanitizePermanentFileName(stableKey).slice(0, 64)
    : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  return `${dir}/${cleanKey}_${cleanName}`;
};

export const copyUriToPermanentMedia = async (
  sourceUri: string,
  domain: PermanentMediaDomain,
  bucket: PermanentMediaBucket,
  filename?: string | null,
  stableKey?: string | null,
) => {
  const sourcePath = stripFileScheme(sourceUri);
  const exists = await RNFS.exists(sourcePath).catch(() => false);
  if (!exists) return null;
  const targetPath = await buildPermanentMediaPath(domain, bucket, filename, stableKey);
  await RNFS.copyFile(sourcePath, targetPath);
  return targetPath;
};

export const permanentMediaExists = async (pathOrUri?: string | null) => {
  if (!pathOrUri) return false;
  return RNFS.exists(stripFileScheme(pathOrUri)).catch(() => false);
};


export const PERMANENT_MEDIA_DOMAINS: PermanentMediaDomain[] = [
  'Chat',
  'Profile',
  'Institutions',
  'Feeds',
  'Broadcast',
  'Documents',
  'Education',
  'Market',
  'Other',
];

export type PermanentMediaDomainUsage = {
  domain: PermanentMediaDomain;
  fileCount: number;
  bytes: number;
};

const sumDirectory = async (dir: string): Promise<{ fileCount: number; bytes: number }> => {
  const exists = await RNFS.exists(dir).catch(() => false);
  if (!exists) return { fileCount: 0, bytes: 0 };
  const rows = await RNFS.readDir(dir).catch(() => []);
  let fileCount = 0;
  let bytes = 0;
  for (const row of rows) {
    if (row.isDirectory()) {
      const nested = await sumDirectory(row.path);
      fileCount += nested.fileCount;
      bytes += nested.bytes;
    } else {
      fileCount += 1;
      bytes += Number(row.size || 0);
    }
  }
  return { fileCount, bytes };
};

export const getPermanentMediaUsage = async (): Promise<PermanentMediaDomainUsage[]> => {
  await ensurePermanentMediaDirs();
  const rows = await Promise.all(
    PERMANENT_MEDIA_DOMAINS.map(async (domain) => {
      const usage = await sumDirectory(`${KIS_MEDIA_ROOT}/${normalizeSegment(domain)}`);
      return { domain, ...usage };
    }),
  );
  return rows;
};

export const clearPermanentMediaDomain = async (domain: PermanentMediaDomain) => {
  const dir = `${KIS_MEDIA_ROOT}/${normalizeSegment(domain)}`;
  const exists = await RNFS.exists(dir).catch(() => false);
  if (exists) {
    await RNFS.unlink(dir).catch(() => {});
  }
  await Promise.all([
    ensurePermanentMediaDir(domain, 'Uploads'),
    ensurePermanentMediaDir(domain, 'Downloads'),
    ensurePermanentMediaDir(domain, 'Cache'),
  ]);
};

export const formatPermanentMediaBytes = (bytes: number) => {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
};
