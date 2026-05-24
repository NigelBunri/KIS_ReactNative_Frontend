import { useCallback, useMemo, useRef, useState } from 'react';
import { Animated } from 'react-native';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';

export type AdminPartner = {
  id: string;
  name: string;
  tier: string;
  is_active: boolean;
  is_verified: boolean;
  member_count: number;
  created_at: string;
  country: string | null;
  owner_email: string | null;
};

export type AdminPartnerStats = {
  total_partners: number;
  active_partners: number;
  inactive_partners: number;
  verified_partners: number;
  new_30d: number;
};

export const useAdminPartnersPanel = (width: number) => {
  const [isOpen, setIsOpen] = useState(false);
  const [partners, setPartners] = useState<AdminPartner[]>([]);
  const [stats, setStats] = useState<AdminPartnerStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const panelWidth = useMemo(() => {
    if (width < 600) return width;
    return Math.min(900, Math.max(620, Math.round(width * 0.86)));
  }, [width]);
  const panelTranslateX = useRef(new Animated.Value(panelWidth)).current;

  const load = useCallback(async (opts?: { q?: string; p?: number }) => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    const q = opts?.q ?? query;
    const pg = opts?.p ?? page;
    if (q) params.set('q', q);
    params.set('page', String(pg));
    params.set('per_page', '20');

    try {
      const [listRes, statsRes] = await Promise.allSettled([
        getRequest(`${(ROUTES as any).adminPartners?.list ?? ''}?${params}`, { errorMessage: '' }),
        getRequest((ROUTES as any).adminPartners?.stats ?? '', { errorMessage: '' }),
      ]);
      if (listRes.status === 'fulfilled' && listRes.value?.success) {
        setPartners(listRes.value.data?.partners ?? listRes.value.data?.results ?? []);
        const pagination = listRes.value.data?.pagination;
        if (pagination) setTotalPages(pagination.total_pages ?? 1);
      } else if (listRes.status === 'fulfilled') {
        setError(listRes.value.message ?? 'Failed to load partners.');
      }
      if (statsRes.status === 'fulfilled' && statsRes.value?.success) {
        setStats(statsRes.value.data);
      }
    } catch {
      setError('Failed to load partners.');
    } finally {
      setLoading(false);
    }
  }, [query, page]);

  const setPartnerActive = useCallback(async (partnerId: string, active: boolean) => {
    setActionLoading(partnerId);
    try {
      const url = (ROUTES as any).adminPartners?.detail?.(partnerId) ?? '';
      const res = await postRequest(url, { is_active: active }, { errorMessage: '' });
      if (res.success) {
        setPartners(prev => prev.map(p => p.id === partnerId ? { ...p, is_active: active } : p));
      }
      return res.success;
    } finally {
      setActionLoading(null);
    }
  }, []);

  const search = useCallback((q: string) => {
    setQuery(q);
    setPage(1);
    void load({ q, p: 1 });
  }, [load]);

  const open = () => {
    setIsOpen(true);
    void load();
    requestAnimationFrame(() => {
      panelTranslateX.setValue(panelWidth);
      Animated.timing(panelTranslateX, { toValue: 0, duration: 260, useNativeDriver: true }).start();
    });
  };

  const close = () => {
    Animated.timing(panelTranslateX, { toValue: panelWidth, duration: 220, useNativeDriver: true }).start(() =>
      setIsOpen(false),
    );
  };

  return {
    panelWidth, panelTranslateX, isOpen, open, close,
    partners, stats, loading, actionLoading, error,
    query, page, totalPages,
    setQuery, setPage,
    search, load, setPartnerActive,
  };
};
