import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useAuth } from '../../../App';
import {
  downloadBookForOffline,
  getOfflineReadiness,
  removeOfflineDownload,
  verifyAndRenewOfflineLicense,
  type OfflineReadiness,
  OfflineDownloadError,
} from '@/services/books/offlineDownloadManager';

export type OfflineDownloadUiState =
  | 'idle'
  | 'not_downloaded'
  | 'downloading'
  | 'downloaded'
  | 'update_available'
  | 'license_expired'
  | 'failed';

/** Drives the "Download for Offline Reading" action and status on
 * BookDetailScreen. Re-checks readiness on focus (via the caller's own
 * useFocusEffect calling refresh()) rather than polling, since offline
 * state only changes in response to explicit user action or an online
 * verify call. */
export function useOfflineDownload(bookId: string) {
  const { user } = useAuth();
  const [uiState, setUiState] = useState<OfflineDownloadUiState>('idle');
  const [progressPercent, setProgressPercent] = useState(0);
  const [sizeBytes, setSizeBytes] = useState(0);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const applyReadiness = useCallback((r: OfflineReadiness) => {
    if (!mounted.current) return;
    if (r.status === 'not_downloaded') { setUiState('not_downloaded'); setSizeBytes(0); return; }
    setSizeBytes(r.entry.sizeBytes);
    if (r.status === 'downloaded') setUiState('downloaded');
    else if (r.status === 'update_available') setUiState('update_available');
    else if (r.status === 'license_expired') setUiState('license_expired');
    else if (r.status === 'corrupted') setUiState('failed');
  }, []);

  const refresh = useCallback(async () => {
    const r = await getOfflineReadiness(bookId);
    applyReadiness(r);
    // A downloaded book's own detail screen gaining focus (with
    // connectivity) is the natural, frequent moment for the "periodic
    // online check-in" the 14-day offline-license policy depends on —
    // without this, a license would never actually renew in practice no
    // matter how often the app is opened online. Best-effort and
    // non-blocking: a failed renew attempt here just leaves the locally-
    // cached expiry as-is, same as any other connectivity gap.
    if (r.status === 'downloaded' || r.status === 'update_available' || r.status === 'license_expired') {
      await verifyAndRenewOfflineLicense(bookId).catch(() => {});
      if (mounted.current) {
        const r2 = await getOfflineReadiness(bookId);
        applyReadiness(r2);
      }
    }
  }, [bookId, applyReadiness]);

  useEffect(() => { refresh(); }, [refresh]);

  const startDownload = useCallback(async () => {
    if (!user?.id) {
      Alert.alert('Sign in required', 'Please sign in to download books for offline reading.');
      return;
    }
    setUiState('downloading');
    setProgressPercent(0);
    try {
      await downloadBookForOffline(bookId, user.id, (p) => {
        if (mounted.current) setProgressPercent(p.percent);
      });
      if (mounted.current) {
        setUiState('downloaded');
        await refresh();
      }
    } catch (err) {
      if (!mounted.current) return;
      setUiState('failed');
      const message = err instanceof OfflineDownloadError ? err.message : 'Download failed — please try again.';
      Alert.alert('Download Failed', message);
    }
  }, [bookId, user?.id, refresh]);

  const removeDownload = useCallback(async () => {
    await removeOfflineDownload(bookId);
    if (mounted.current) {
      setUiState('not_downloaded');
      setSizeBytes(0);
    }
  }, [bookId]);

  const checkForUpdate = useCallback(async () => {
    await verifyAndRenewOfflineLicense(bookId);
    await refresh();
  }, [bookId, refresh]);

  return { uiState, progressPercent, sizeBytes, startDownload, removeDownload, checkForUpdate, refresh };
}
