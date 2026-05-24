import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated } from 'react-native';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';

export type AdminUser = {
  id: string;
  email: string | null;
  username: string | null;
  display_name: string | null;
  phone: string | null;
  tier: string;
  status: string;
  country: string;
  is_staff: boolean;
  is_superuser: boolean;
  trust_score: number;
  last_login_at: string | null;
  date_joined: string | null;
};

export type AdminUsersPagination = {
  page: number;
  per_page: number;
  total_pages: number;
  total_items: number;
};

export const useAdminUsersPanel = (width: number) => {
  const [isOpen, setIsOpen] = useState(false);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [pagination, setPagination] = useState<AdminUsersPagination | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const panelWidth = useMemo(() => {
    if (width < 600) return width;
    return Math.min(900, Math.max(600, Math.round(width * 0.85)));
  }, [width]);
  const panelTranslateX = useRef(new Animated.Value(panelWidth)).current;

  useEffect(() => {
    if (!isOpen) panelTranslateX.setValue(panelWidth);
  }, [panelWidth, isOpen, panelTranslateX]);

  const load = useCallback(async (opts?: { q?: string; tier?: string; status?: string; p?: number }) => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    const q = opts?.q ?? query;
    const t = opts?.tier ?? tierFilter;
    const s = opts?.status ?? statusFilter;
    const pg = opts?.p ?? page;
    if (q) params.set('q', q);
    if (t) params.set('tier', t);
    if (s) params.set('status', s);
    params.set('page', String(pg));
    params.set('per_page', '20');

    const url = `${(ROUTES as any).users?.list ?? ''}?${params.toString()}`;
    try {
      const res = await getRequest(url, { errorMessage: 'Failed to load users.' });
      if (res.success) {
        setUsers(res.data?.users ?? []);
        setPagination(res.data?.pagination ?? null);
      } else {
        setError(res.message ?? 'Failed to load users.');
      }
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  }, [query, tierFilter, statusFilter, page]);

  const banUser = useCallback(async (userId: string, reason: string, permanent = true) => {
    setActionLoading(userId);
    try {
      const res = await postRequest((ROUTES as any).users?.ban?.(userId) ?? '', { reason, permanent }, { errorMessage: '' });
      if (res.success) {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: permanent ? 'banned' : 'suspended' } : u));
      }
      return res.success;
    } finally {
      setActionLoading(null);
    }
  }, []);

  const unbanUser = useCallback(async (userId: string) => {
    setActionLoading(userId);
    try {
      const res = await postRequest((ROUTES as any).users?.unban?.(userId) ?? '', {}, { errorMessage: '' });
      if (res.success) {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: 'active' } : u));
      }
      return res.success;
    } finally {
      setActionLoading(null);
    }
  }, []);

  const setUserTier = useCallback(async (userId: string, tier: string) => {
    setActionLoading(userId);
    try {
      const res = await postRequest((ROUTES as any).users?.setTier?.(userId) ?? '', { tier }, { errorMessage: '' });
      if (res.success) {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, tier } : u));
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
    Animated.timing(panelTranslateX, { toValue: panelWidth, duration: 220, useNativeDriver: true }).start(() => setIsOpen(false));
  };

  return {
    panelWidth, panelTranslateX, isOpen, open, close,
    users, pagination, loading, actionLoading, error,
    query, tierFilter, statusFilter, page,
    setQuery, setTierFilter, setStatusFilter, setPage,
    search, load, banUser, unbanUser, setUserTier,
  };
};
