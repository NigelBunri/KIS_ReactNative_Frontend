// src/screens/broadcast/education/hooks/useEducationOfflineStore.ts
import { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { EducationProgress } from '@/screens/broadcast/education/api/education.models';

const STORAGE_KEY = 'KIS_EDU_OFFLINE_CACHE';

export default function useEducationOfflineStore() {
  const [cache, setCache] = useState<Record<string, EducationProgress>>({});

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (cancelled) return;
        if (!value) {
          setCache({});
          return;
        }
        const parsed = JSON.parse(value);
        if (parsed && typeof parsed === 'object') {
          setCache(parsed);
        }
      })
      .catch(() => {
        setCache({});
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback((next: Record<string, EducationProgress>) => {
    setCache(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const addDownload = useCallback(
    async (progress: EducationProgress) => {
      persist({
        ...cache,
        [`${progress.contentType}-${progress.contentId}`]: {
          ...progress,
          downloaded: true,
        },
      });
    },
    [cache, persist],
  );

  const removeDownload = useCallback(
    async (id: string, type: EducationProgress['contentType']) => {
      const key = `${type}-${id}`;
      if (!(key in cache)) return;
      const next = { ...cache };
      delete next[key];
      persist(next);
    },
    [cache, persist],
  );

  const getStatus = useCallback(
    (id: string, type: EducationProgress['contentType']) =>
      cache[`${type}-${id}`]?.downloaded ?? false,
    [cache],
  );

  const activeDownloads = useMemo(
    () => Object.values(cache).filter((item) => item.downloaded),
    [cache],
  );

  return {
    offlineItems: activeDownloads,
    scheduleDownload: addDownload,
    cancelDownload: removeDownload,
    isDownloaded: getStatus,
  };
}
