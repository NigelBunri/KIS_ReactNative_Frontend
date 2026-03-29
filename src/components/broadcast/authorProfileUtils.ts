type BroadcastSourceLike = {
  source_type?: string | null;
  source?: { type?: string | null } | null;
  author?: Record<string, any> | null;
  profile?: Record<string, any> | null;
};

const USER_BROADCAST_SOURCE_TYPES = new Set([
  'broadcast_profile',
  'broadcastprofile',
  'user',
  'profile',
  'personal',
  'personal_profile',
]);

const normalizeType = (value?: string | null) => String(value ?? '').trim().toLowerCase().replace(/\s+/g, '_');

export const isUserBroadcastSource = (item?: BroadcastSourceLike | null): boolean => {
  if (!item) return false;
  const sourceType = normalizeType(item.source_type);
  const sourceMetaType = normalizeType(item.source?.type);
  return USER_BROADCAST_SOURCE_TYPES.has(sourceType) || USER_BROADCAST_SOURCE_TYPES.has(sourceMetaType);
};

export const formatKisHandle = (displayName?: string | null) => {
  const safe = String(displayName ?? '').trim().replace(/^@+/, '');
  const slug = safe
    .replace(/\s+/g, '-')
    .replace(/[^A-Za-z0-9._-]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug ? `@KIS-${slug}` : '@KIS-user';
};

const BIO_FIELDS = [
  'bio',
  'headline',
  'about',
  'summary',
  'tagline',
  'profile_bio',
  'profileBio',
];

export const extractBroadcastAuthorBio = (item?: BroadcastSourceLike | null) => {
  const pools = [item?.author, item?.profile, item];
  for (const pool of pools) {
    if (!pool || typeof pool !== 'object') continue;
    const record = pool as Record<string, any>;
    for (const key of BIO_FIELDS) {
      const value = record[key];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }
  }
  return '';
};

export const truncateWords = (value: string, maxWords = 18) => {
  const normalized = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!normalized) return { text: '', truncated: false };
  const words = normalized.split(' ');
  if (words.length <= maxWords) {
    return { text: normalized, truncated: false };
  }
  return {
    text: `${words.slice(0, maxWords).join(' ')}...`,
    truncated: true,
  };
};

export const hasVisibleValue = (value: any): boolean => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'string') return true;
  const text = value.trim();
  if (!text) return false;
  if (/hidden by privacy/i.test(text)) return false;
  return true;
};

export const formatPublicPhone = (user: Record<string, any> | null | undefined): string | null => {
  if (!user || typeof user !== 'object') return null;
  const phone = String(user.phone ?? '').trim();
  if (!phone || !hasVisibleValue(phone)) return null;
  const countryCode = String(user.phone_country_code ?? user.country_code ?? '').trim();
  if (countryCode && !phone.startsWith('+')) return `${countryCode}${phone}`;
  return phone;
};
