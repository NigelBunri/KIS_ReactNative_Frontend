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

export type SuspiciousSignal = {
  id: string;
  user_id: string;
  signal_type: string;
  detail: string | null;
  created_at: string;
};

export const useAdminVerificationPanel = (width: number) => {
  const [isOpen, setIsOpen] = useState(false);
  const [cases, setCases] = useState<VerificationCase[]>([]);
  const [summary, setSummary] = useState<VerificationSummary | null>(null);
  const [suspiciousSignals, setSuspiciousSignals] = useState<SuspiciousSignal[]>([]);
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
    const params = new URLSearchParams({ page: String(pg), per_page: '20' });
    try {
      const [casesRes, signalsRes] = await Promise.allSettled([
        getRequest(`${(ROUTES as any).verification?.staffCases ?? ''}?${params}`, { errorMessage: '' }),
        getRequest((ROUTES as any).verification?.staffSuspiciousSignals ?? '', { errorMessage: '' }),
      ]);
      if (casesRes.status === 'fulfilled' && casesRes.value?.success) {
        const data = casesRes.value.data;
        setCases(data?.cases ?? data?.results ?? []);
        const pagination = data?.pagination;
        if (pagination) setTotalPages(pagination.total_pages ?? 1);
        // Build summary from list data if no dedicated summary endpoint
        const list: VerificationCase[] = data?.cases ?? data?.results ?? [];
        const pending = list.filter((c: VerificationCase) => c.status === 'pending').length;
        const critical = list.filter((c: VerificationCase) => c.severity === 'HIGH' || c.severity === 'CRITICAL').length;
        setSummary(prev => prev ?? { total_pending: pending, total_critical: critical, actioned_today: 0 });
      } else if (casesRes.status === 'fulfilled') {
        setError(casesRes.value.message ?? 'Failed to load verification cases.');
      } else {
        setError('Failed to load verification cases.');
      }
      if (signalsRes.status === 'fulfilled' && signalsRes.value?.success) {
        setSuspiciousSignals(
          signalsRes.value.data?.signals ?? signalsRes.value.data?.results ?? [],
        );
      }
    } catch {
      setError('Failed to load verification cases.');
    } finally {
      setLoading(false);
    }
  }, [page]);

  const approveBadge = useCallback(async (userId: string, badgeType: string) => {
    setActionLoading(userId);
    try {
      const url = (ROUTES as any).verification?.staffBadgeIssue ?? '';
      const res = await postRequest(url, { user_id: userId, badge_type: badgeType }, { errorMessage: '' });
      if (res.success) {
        setCases(prev => prev.filter(c => c.content_id !== userId));
        setSummary(prev =>
          prev
            ? { ...prev, total_pending: Math.max(0, prev.total_pending - 1), actioned_today: prev.actioned_today + 1 }
            : prev,
        );
      }
      return res.success;
    } finally {
      setActionLoading(null);
    }
  }, []);

  const rejectCase = useCallback(async (caseId: string, notes?: string) => {
    setActionLoading(caseId);
    try {
      const url = (ROUTES as any).verification?.staffCase?.(caseId) ?? '';
      const res = await postRequest(url, { action: 'reject', notes: notes ?? '' }, { errorMessage: '' });
      if (res.success) {
        setCases(prev => prev.filter(c => c.id !== caseId));
        setSummary(prev =>
          prev
            ? { ...prev, total_pending: Math.max(0, prev.total_pending - 1), actioned_today: prev.actioned_today + 1 }
            : prev,
        );
      }
      return res.success;
    } finally {
      setActionLoading(null);
    }
  }, []);

  // Legacy combined action handler used by the panel UI
  const takeAction = useCallback(async (
    caseId: string,
    action: 'dismiss' | 'warn' | 'restrict' | 'takedown' | 'ban',
    notes?: string,
  ) => {
    setActionLoading(caseId);
    try {
      const url = (ROUTES as any).verification?.staffCase?.(caseId) ?? '';
      const res = await postRequest(url, { action, notes: notes ?? '' }, { errorMessage: '' });
      if (res.success) {
        setCases(prev => prev.filter(c => c.id !== caseId));
        setSummary(prev =>
          prev
            ? { ...prev, total_pending: Math.max(0, prev.total_pending - 1), actioned_today: prev.actioned_today + 1 }
            : prev,
        );
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
    cases, summary, suspiciousSignals, loading, actionLoading, error,
    page, totalPages, setPage, load, takeAction, approveBadge, rejectCase,
  };
};
