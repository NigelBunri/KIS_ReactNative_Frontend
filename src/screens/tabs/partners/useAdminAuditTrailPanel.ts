import { useCallback, useMemo, useRef, useState } from 'react';
import { Animated } from 'react-native';
import { getRequest } from '@/network/get';
import ROUTES from '@/network';

export type AuditEntry = {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  action_type: string;
  target_app: string;
  target_model: string;
  target_pk: string;
  severity: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export const useAdminAuditTrailPanel = (width: number) => {
  const [isOpen, setIsOpen] = useState(false);
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [severityFilter, setSeverityFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const panelWidth = useMemo(() => {
    if (width < 600) return width;
    return Math.min(920, Math.max(640, Math.round(width * 0.88)));
  }, [width]);
  const panelTranslateX = useRef(new Animated.Value(panelWidth)).current;

  const load = useCallback(async (opts?: { p?: number; severity?: string; action?: string }) => {
    setLoading(true);
    setError(null);
    const pg = opts?.p ?? page;
    const sev = opts?.severity ?? severityFilter;
    const act = opts?.action ?? actionFilter;
    const params = new URLSearchParams({ page: String(pg), per_page: '30' });
    if (sev) params.set('severity', sev);
    if (act) params.set('action_type', act);

    try {
      const res = await getRequest(
        `${(ROUTES as any).control?.auditEntries ?? ''}?${params}`,
        { errorMessage: '' },
      );
      if (res.success) {
        setEntries(res.data?.entries ?? res.data?.results ?? []);
        const pagination = res.data?.pagination;
        if (pagination) setTotalPages(pagination.total_pages ?? 1);
      } else {
        setError(res.message ?? 'Failed to load audit trail.');
      }
    } catch {
      setError('Failed to load audit trail.');
    } finally {
      setLoading(false);
    }
  }, [page, severityFilter, actionFilter]);

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
    entries, loading, error,
    page, totalPages, severityFilter, actionFilter,
    setPage, setSeverityFilter, setActionFilter, load,
  };
};
