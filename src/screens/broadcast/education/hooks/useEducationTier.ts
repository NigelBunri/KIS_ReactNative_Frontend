import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { getRequest } from '@/network/get';
import ROUTES from '@/network';

const TIER_ORDER = ['free', 'basic', 'pro', 'business', 'business pro', 'partner', 'partner pro'];

type TierLike = string | null | undefined | { name?: string; label?: string };

const normalizeTierLabel = (value: TierLike): string | null => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    return value.name ?? value.label ?? null;
  }
  return null;
};

const tierRank = (label?: string | null) => {
  if (!label) return 0;
  const normalized = String(label).trim().toLowerCase();
  return TIER_ORDER.indexOf(normalized) >= 0 ? TIER_ORDER.indexOf(normalized) : 0;
};

export default function useEducationTier() {
  const [tierLabel, setTierLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blockedUntilRef = useRef(0);

  const load = useCallback(async () => {
    const now = Date.now();
    if (now < blockedUntilRef.current) return;
    setLoading(true);
    try {
      const cached = await AsyncStorage.getItem('kis_profile_cache_v1');
      if (cached) {
        const parsed = JSON.parse(cached);
        const cachedTier = parsed?.account?.tier ?? parsed?.tier ?? null;
        const normalizedCachedTier = normalizeTierLabel(cachedTier);
        if (normalizedCachedTier) {
          setTierLabel(normalizedCachedTier);
          setError(null);
          return;
        }
      }
      const res = await getRequest(ROUTES.profiles.me, {
        errorMessage: 'Unable to load profile data.',
      });
      if (res.success) {
        const rawTier = res.data?.account?.tier ?? res.data?.tier ?? null;
        setTierLabel(normalizeTierLabel(rawTier));
        setError(null);
      } else {
        if (Number(res?.status) === 429) {
          blockedUntilRef.current = Date.now() + 60 * 1000;
          return;
        }
        setError(res.message ?? 'Unable to load profile data.');
      }
    } catch (err: any) {
      setError(err?.message ?? 'Unable to load profile data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const isTierAtLeast = useMemo(() => {
    return (required: string) => tierRank(tierLabel) >= tierRank(required);
  }, [tierLabel]);

  return {
    tierLabel,
    loading,
    error,
    refresh: load,
    isTierAtLeast,
    tierRank,
  };
}
