import { CacheConfig } from '@/network/cacheKeys';
import { getCache } from '@/network/cache';

export type AccountTierShape = {
  name?: string;
  code?: string;
  slug?: string;
  id?: string | number;
};

const TIER_ORDER = ['free', 'basic', 'pro', 'business', 'market pro', 'business pro', 'partner', 'partner pro'];
const TIER_ALIASES: Record<string, string> = {
  'market pro': 'business pro',
  'market-pro': 'business pro',
  'market_pro': 'business pro',
};

export const normalizeTierName = (tier?: AccountTierShape | string | null) => {
  if (!tier) return '';
  const source =
    typeof tier === 'string'
      ? tier
      : String(tier.name || tier.code || tier.slug || tier?.id || '');
  const cleaned = source
    .trim()
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase();
  return TIER_ALIASES[cleaned] ?? cleaned;
};

export const tierRank = (tier?: AccountTierShape | string | null) => {
  const key = normalizeTierName(tier);
  const idx = TIER_ORDER.findIndex((name) => name === key);
  return idx >= 0 ? idx : 0;
};

export const isTierAtLeast = (tier: AccountTierShape | string | null, required: string) =>
  tierRank(tier) >= tierRank(required);

export const isBusinessTier = (tier?: AccountTierShape | string | null) =>
  isTierAtLeast(tier || '', 'business');

export const isPartnerTier = (tier?: AccountTierShape | string | null) =>
  normalizeTierName(tier).includes('partner');

export const isPartnerProTier = (tier?: AccountTierShape | string | null) =>
  normalizeTierName(tier).includes('partner pro');

export const getCachedProfile = async () =>
  getCache(CacheConfig.userProfile.type, CacheConfig.userProfile.key);

export const getTierFromProfile = (profile: any): AccountTierShape | null =>
  profile?.account?.tier || profile?.tier || null;
