import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getRequest } from '@/network/get';
import ROUTES from '@/network';

export type ParentalContentFilter = 'child' | 'youth' | 'adult';

export type ParentalControls = {
  content_filter: ParentalContentFilter;
  restricted_sections: {
    marketplace: boolean;
    calls: boolean;
    health: boolean;
    chat: boolean;
    media: boolean;
  };
  screen_time_minutes: number;
  sos_enabled: boolean;
};

const CACHE_KEY = 'kis_parental_controls';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

let _memCache: { data: ParentalControls; ts: number } | null = null;

const DEFAULT: ParentalControls = {
  content_filter: 'adult',
  restricted_sections: { marketplace: false, calls: false, health: false, chat: false, media: false },
  screen_time_minutes: 0,
  sos_enabled: true,
};

export function useParentalControls(memberId?: string | null) {
  const [controls, setControls] = useState<ParentalControls>(DEFAULT);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!memberId) { setControls(DEFAULT); return; }

    // Return from memory cache if fresh
    if (_memCache && Date.now() - _memCache.ts < CACHE_TTL_MS) {
      setControls(_memCache.data);
      return;
    }

    setLoading(true);
    try {
      const cached = await AsyncStorage.getItem(`${CACHE_KEY}:${memberId}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.ts < CACHE_TTL_MS) {
          setControls(parsed.data);
          _memCache = parsed;
          setLoading(false);
          return;
        }
      }
      const res = await getRequest(ROUTES.family.parentalControl(memberId));
      // getRequest resolves to the ApiResult wrapper ({success, data,
      // message}) — on a genuine network-level failure (not just a non-2xx
      // HTTP response, which still carries a `data` body), `data` is
      // undefined, so `res?.data ?? res` fell back to the wrapper itself.
      // That corrupted object has neither `restricted_sections` nor
      // `content_filter`, which broke this hook's own enforcement
      // functions in two DIFFERENT, inconsistent directions at once:
      // isSectionRestricted() read `controls.restricted_sections?.[x]` as
      // undefined -> false, silently *unrestricting* every section, while
      // isContentAllowed() read `controls.content_filter` as undefined,
      // whose order.indexOf() of -1 made every comparison fail -> blocking
      // *all* content. Falling back to the real, intentionally-permissive
      // DEFAULT here (rather than to `res`) is the one safe, deterministic
      // failure state for parental-control enforcement.
      const data: ParentalControls = res?.success && res?.data ? res.data : DEFAULT;
      setControls(data);
      _memCache = { data, ts: Date.now() };
      await AsyncStorage.setItem(`${CACHE_KEY}:${memberId}`, JSON.stringify(_memCache));
    } catch {
      // Non-fatal - defaults permit everything (adult mode)
    } finally {
      setLoading(false);
    }
  }, [memberId]);

  useEffect(() => { void load(); }, [load]);

  const isSectionRestricted = useCallback(
    (section: keyof ParentalControls['restricted_sections']) =>
      Boolean(controls.restricted_sections?.[section]),
    [controls],
  );

  const isContentAllowed = useCallback(
    (requiredFilter: ParentalContentFilter) => {
      const order: ParentalContentFilter[] = ['child', 'youth', 'adult'];
      return order.indexOf(controls.content_filter) >= order.indexOf(requiredFilter);
    },
    [controls],
  );

  return { controls, loading, isSectionRestricted, isContentAllowed };
}

export function invalidateParentalControlsCache(memberId: string) {
  _memCache = null;
  AsyncStorage.removeItem(`${CACHE_KEY}:${memberId}`).catch(() => {});
}
