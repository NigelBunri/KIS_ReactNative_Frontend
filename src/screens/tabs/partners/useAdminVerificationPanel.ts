import { useCallback, useMemo, useRef, useState } from 'react';
import { Animated } from 'react-native';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';

export type VerificationCase = {
  id: string;
  flag_type: string;
  severity: string;
  status: string;
  reporter_id: string | null;
  content_type: string;
  content_id: string;
  content_preview: string | null;
  created_at: string;
  notes: string | null;
};

export type VerificationSummary = {
  total_pending: number;
  total_critical: number;
  actioned_today: number;
};

export const useAdminVerificationPanel = (width: number) => {
  const [isOpen, setIsOpen] = useState(false);
  const [cases, setCases] = useState<VerificationCase[]>([]);
  const [summary, setSummary] = useState<VerificationSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const panelWidth = useMemo(() => {
    if (width < 600) return width;
    return Math.min(900, Math.max(620, Math.round(width * 0.86)));
  }, [width]);
  const panelTranslateX = useRef(new Animated.Value(panelWidth)).current;

  const load = useCallback(async (opts?: { p?: number }) => {
    setLoading(true);
    setError(null);
    const pg = opts?.p ?? page;
    const params = new URLSearchParams({ page: String(pg), per_page: '20', status: 'PENDING' });
    try {
      const [queueRes, summaryRes] = await Promise.allSettled([
        getRequest(`${(ROUTES as any).content?.queue ?? ''}?${params}`, { errorMessage: '' }),
        getRequest((ROUTES as any).content?.summary ?? '', { errorMessage: '' }),
      ]);
      if (queueRes.status === 'fulfilled' && queueRes.value?.success) {
        setCases(queueRes.value.data?.flags ?? queueRes.value.data?.results ?? []);
        const pagination = queueRes.value.data?.pagination;
        if (pagination) setTotalPages(pagination.total_pages ?? 1);
      } else if (queueRes.status === 'fulfilled') {
        setError(queueRes.value.message ?? 'Failed to load verification queue.');
      }
      if (summaryRes.status === 'fulfilled' && summaryRes.value?.success) {
        setSummary(summaryRes.value.data);
      }
    } catch {
      setError('Failed to load verification queue.');
    } finally {
      setLoading(false);
    }
  }, [page]);

  const takeAction = useCallback(async (
    caseId: string,
    action: 'dismiss' | 'warn' | 'restrict' | 'takedown' | 'ban',
    notes?: string,
  ) => {
    setActionLoading(caseId);
    try {
      const url = (ROUTES as any).content?.flagAction?.(caseId) ?? '';
      const res = await postRequest(url, { action, notes: notes ?? '' }, { errorMessage: '' });
      if (res.success) {
        setCases(prev => prev.filter(c => c.id !== caseId));
        setSummary(prev => prev ? { ...prev, total_pending: Math.max(0, prev.total_pending - 1), actioned_today: prev.actioned_today + 1 } : prev);
      }
      return res.success;
    } finally {
      setActionLoading(null);
    }
  }, []);

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
    cases, summary, loading, actionLoading, error,
    page, totalPages, setPage, load, takeAction,
  };
};
