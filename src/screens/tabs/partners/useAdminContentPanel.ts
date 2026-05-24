import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated } from 'react-native';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';

export type ContentFlag = {
  id: string;
  target_type: string;
  target_id: string | null;
  source: string;
  severity: string;
  status: string;
  reason: string;
  tags: string[];
  ai_score: number | null;
  reporter_id: string | null;
  reporter_email: string | null;
  reviewed_at: string | null;
  created_at: string | null;
};

export type ContentSummary = {
  total_pending: number;
  total_critical: number;
  actioned_today: number;
  by_severity: { severity: string; count: number }[];
  by_type: { target_type: string; count: number }[];
};

export type ContentAction = 'dismiss' | 'takedown' | 'warn' | 'restrict' | 'suspend' | 'ban';

export const useAdminContentPanel = (width: number) => {
  const [isOpen, setIsOpen] = useState(false);
  const [flags, setFlags] = useState<ContentFlag[]>([]);
  const [summary, setSummary] = useState<ContentSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const panelWidth = useMemo(() => {
    if (width < 600) return width;
    return Math.min(900, Math.max(600, Math.round(width * 0.85)));
  }, [width]);
  const panelTranslateX = useRef(new Animated.Value(panelWidth)).current;

  useEffect(() => {
    if (!isOpen) panelTranslateX.setValue(panelWidth);
  }, [panelWidth, isOpen, panelTranslateX]);

  const loadSummary = useCallback(async () => {
    const res = await getRequest((ROUTES as any).content?.summary ?? '', { errorMessage: '' });
    if (res.success) setSummary(res.data ?? null);
  }, []);

  const loadFlags = useCallback(async (opts?: { severity?: string; type?: string; status?: string; p?: number }) => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    const sev = opts?.severity ?? severityFilter;
    const typ = opts?.type ?? typeFilter;
    const st = opts?.status ?? statusFilter;
    const pg = opts?.p ?? page;
    if (sev) params.set('severity', sev);
    if (typ) params.set('target_type', typ);
    if (st) params.set('status', st);
    params.set('page', String(pg));
    params.set('per_page', '20');

    const url = `${(ROUTES as any).content?.queue ?? ''}?${params.toString()}`;
    try {
      const res = await getRequest(url, { errorMessage: 'Failed to load moderation queue.' });
      if (res.success) {
        setFlags(res.data?.flags ?? []);
        setTotalPages(res.data?.pagination?.total_pages ?? 1);
      } else {
        setError(res.message ?? 'Failed to load moderation queue.');
      }
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load queue.');
    } finally {
      setLoading(false);
    }
  }, [severityFilter, typeFilter, statusFilter, page]);

  const takeAction = useCallback(async (flagId: string, action: ContentAction, notes = '') => {
    setActionLoading(flagId);
    try {
      const res = await postRequest(
        (ROUTES as any).content?.flagAction?.(flagId) ?? '',
        { action, notes },
        { errorMessage: '' },
      );
      if (res.success) {
        setFlags(prev => prev.filter(f => f.id !== flagId));
        await loadSummary();
      }
      return { success: res.success, message: res.message };
    } finally {
      setActionLoading(null);
    }
  }, [loadSummary]);

  const open = () => {
    setIsOpen(true);
    void Promise.all([loadFlags(), loadSummary()]);
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
    flags, summary, loading, actionLoading, error,
    severityFilter, typeFilter, statusFilter, page, totalPages,
    setSeverityFilter, setTypeFilter, setStatusFilter, setPage,
    loadFlags, loadSummary, takeAction,
  };
};
