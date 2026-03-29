// src/screens/broadcast/education/hooks/useEducationDiscovery.ts
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EducationDiscoveryPayload } from '@/screens/broadcast/education/api/education.models';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { FEATURE_FLAGS } from '@/constants/featureFlags';

export type FilterPayload = {
  type?: string;
  topic?: string;
  language?: string;
  level?: string;
  price?: 'free' | 'paid';
  duration?: 'short' | 'medium' | 'long';
  creator?: string;
  rating?: '4+' | '3+' | 'all';
};

const DEFAULT_FILTERS: FilterPayload = {
  price: 'free',
  level: 'all',
};

export const EDUCATION_SORT_OPTIONS = ['recommended', 'newest', 'popular', 'price_low', 'price_high'];

const useDebouncedValue = <T,>(value: T, delay = 260) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
};

type Params = {
  initialSearch?: string;
  onUnavailable?: () => void;
  onAvailable?: () => void;
};

const normalizePayload = (payload: any): EducationDiscoveryPayload => ({
  heroCourse: payload?.hero_course ?? null,
  sections: Array.isArray(payload?.sections) ? payload.sections : [],
  categories: Array.isArray(payload?.categories) ? payload.categories : [],
  continueLearning: Array.isArray(payload?.continue_learning) ? payload.continue_learning : [],
  filters: {
    languages: Array.isArray(payload?.filters?.languages) ? payload.filters.languages : [],
    levels: Array.isArray(payload?.filters?.levels) ? payload.filters.levels : [],
    prices: Array.isArray(payload?.filters?.prices) ? payload.filters.prices : [],
    partners: Array.isArray(payload?.filters?.partners) ? payload.filters.partners : [],
    topics: Array.isArray(payload?.filters?.topics) ? payload.filters.topics : [],
    sortOptions: Array.isArray(payload?.filters?.sortOptions)
      ? payload.filters.sortOptions
      : EDUCATION_SORT_OPTIONS,
  },
});

export default function useEducationDiscovery({
  initialSearch = '',
  onUnavailable,
  onAvailable,
}: Params = {}) {
  const [search, setSearch] = useState(initialSearch);
  const debouncedSearch = useDebouncedValue(search, 280);
  const [filters, setFilters] = useState<FilterPayload>(DEFAULT_FILTERS);
  const [sort, setSort] = useState(EDUCATION_SORT_OPTIONS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<EducationDiscoveryPayload | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const mounted = useRef(true);

  const buildParams = useCallback(() => {
    const params: Record<string, string> = {};
    if (debouncedSearch) params.q = debouncedSearch;
    if (filters.type && filters.type !== 'all') params.type = filters.type;
    if (filters.topic) params.topic = filters.topic;
    if (filters.language) params.language = filters.language;
    if (filters.level && filters.level !== 'all') params.level = filters.level;
    if (filters.price) params.price = filters.price;
    if (filters.duration) params.duration = filters.duration;
    if (filters.creator) params.creator = filters.creator;
    if (filters.rating) params.rating = filters.rating;
    if (sort) params.sort = sort;
    return params;
  }, [debouncedSearch, filters, sort]);

  const load = useCallback(async () => {
    if (!FEATURE_FLAGS.EDUCATION_V2) return;
    setLoading(true);
    setError(null);
    try {
      const response = await getRequest(ROUTES.education.discovery, { params: buildParams() });
      if (response?.success === false) {
        if (response?.status === 404) {
          if (mounted.current) {
            setUnavailable(true);
          }
          onUnavailable?.();
          return;
        }
        throw new Error(response?.message ?? 'Unable to load education discovery.');
      }
      const payload = response?.data ?? response ?? {};
      if (mounted.current) {
        setData(normalizePayload(payload));
        setUnavailable(false);
      }
      onAvailable?.();
    } catch (err: any) {
      if (mounted.current) {
        setError(err?.message || 'Unable to load education discovery.');
      }
    } finally {
      if (mounted.current) {
        setLoading(false);
      }
    }
  }, [buildParams, onAvailable, onUnavailable]);

  useEffect(() => {
    mounted.current = true;
    load();
    return () => {
      mounted.current = false;
    };
  }, [load]);

  const refresh = useCallback(() => {
    load();
  }, [load]);

  const updateFilter = useCallback((key: keyof FilterPayload, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const availableFilters = useMemo(() => data?.filters ?? null, [data]);

  return {
    data,
    loading,
    error,
    search,
    setSearch,
    filters,
    updateFilter,
    sort,
    setSort,
    sortOptions: data?.filters?.sortOptions ?? EDUCATION_SORT_OPTIONS,
    availableFilters,
    unavailable,
    refresh,
  };
}
