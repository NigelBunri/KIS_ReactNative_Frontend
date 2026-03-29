export const KIS_HANDLE_PREFIX = '@KIS-';

const HANDLE_PATTERN = /@KIS-(?:\[[^\]\n\r]{1,120}\]|[A-Za-z0-9][A-Za-z0-9._-]{0,79})/gi;

export type KisHandleSegment =
  | { type: 'text'; value: string }
  | { type: 'handle'; value: string; handle: string; visibleName: string; normalizedKey: string };

const stripPrefix = (value: string) => {
  const text = String(value || '').trim();
  if (!text) return '';
  if (/^@kis-/i.test(text)) return text.replace(/^@kis-/i, '');
  return text;
};

export const extractVisibleNameFromHandle = (value: string) => {
  let body = stripPrefix(value).trim();
  if (!body) return '';
  if (body.startsWith('[') && body.endsWith(']')) {
    body = body.slice(1, -1);
  }
  return body
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

export const normalizeKisHandleKey = (value: string) =>
  extractVisibleNameFromHandle(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

export const formatKisHandleFromVisibleName = (value?: string | null) => {
  const safe = String(value ?? '').trim().replace(/^@+/, '');
  const slug = safe
    .replace(/\s+/g, '-')
    .replace(/[^A-Za-z0-9._-]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug ? `${KIS_HANDLE_PREFIX}${slug}` : `${KIS_HANDLE_PREFIX}user`;
};

export const splitTextByKisHandles = (value: unknown): KisHandleSegment[] => {
  const input = String(value ?? '');
  if (!input) return [{ type: 'text', value: '' }];

  const segments: KisHandleSegment[] = [];
  let cursor = 0;
  for (const match of input.matchAll(HANDLE_PATTERN)) {
    const raw = String(match[0] || '');
    const start = Number(match.index ?? 0);
    if (start > cursor) {
      segments.push({ type: 'text', value: input.slice(cursor, start) });
    }
    const visibleName = extractVisibleNameFromHandle(raw);
    const normalizedKey = normalizeKisHandleKey(raw);
    if (visibleName && normalizedKey) {
      segments.push({
        type: 'handle',
        value: raw,
        handle: raw,
        visibleName,
        normalizedKey,
      });
    } else {
      segments.push({ type: 'text', value: raw });
    }
    cursor = start + raw.length;
  }

  if (cursor < input.length) {
    segments.push({ type: 'text', value: input.slice(cursor) });
  }
  return segments.length ? segments : [{ type: 'text', value: input }];
};
