import { useCallback, useEffect, useRef, useState } from 'react';
import { DeviceEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { getRequest } from '@/network/get';
import ROUTES from '@/network';
import { BroadcastItem, normalizeBroadcastItem } from '@/types/broadcast';

const STORAGE_KEY = 'broadcast.feed.v1';
const EVENT_CREATED = 'broadcast.created';
const EVENT_REACTION = 'broadcast.reaction';

type FetchOptions = {
  cursor?: string | null;
  append?: boolean;
};

export type UseBroadcastFeedResult = {
  items: BroadcastItem[];
  loading: boolean;
  loadingMore: boolean;
  error?: string | null;
  hasMore: boolean;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  updateItem: (id: string, updater: (item: BroadcastItem) => BroadcastItem) => void;
};

export const useBroadcastFeed = (): UseBroadcastFeedResult => {
  const [items, setItems] = useState<BroadcastItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const initialLoadedRef = useRef(false);

  const persistItems = useCallback(async (next: BroadcastItem[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }, []);

  const loadFromDisk = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setItems(parsed);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadFromDisk();
  }, [loadFromDisk]);

  useEffect(() => {
    if (!initialLoadedRef.current && items.length > 0) {
      initialLoadedRef.current = true;
    }
    persistItems(items);
  }, [items, persistItems]);

  const updateItem = useCallback(
    (id: string, updater: (item: BroadcastItem) => BroadcastItem) => {
      setItems((prev) => prev.map((item) => (item.id === id ? updater(item) : item)));
    },
    [],
  );

  const prependItem = useCallback(
    (incoming: BroadcastItem) => {
      setItems((prev) => {
        if (prev.some((item) => item.id === incoming.id)) return prev;
        return [incoming, ...prev];
      });
    },
    [],
  );

  const handleBroadcastCreated = useCallback(
    (payload: any) => {
      const normalized = normalizeBroadcastItem(payload);
      if (normalized) {
        prependItem(normalized);
      }
    },
    [prependItem],
  );

  const handleReactionEvent = useCallback(
    (payload: { id?: string; delta?: number }) => {
      if (!payload?.id || typeof payload.delta !== 'number') {
        return;
      }
      const delta = payload.delta;
      updateItem(payload.id, (item) => ({
        ...item,
        engagement: {
          ...item.engagement,
          reactions: Math.max(item.engagement.reactions + delta, 0),
        },
      }));
    },
    [updateItem],
  );

  useEffect(() => {
    const createdListener = DeviceEventEmitter.addListener(EVENT_CREATED, handleBroadcastCreated);
    const reactionListener = DeviceEventEmitter.addListener(EVENT_REACTION, handleReactionEvent);
    return () => {
      createdListener.remove();
      reactionListener.remove();
    };
  }, [handleBroadcastCreated, handleReactionEvent]);

  const fetchPage = useCallback(
    async ({ cursor, append = false }: FetchOptions) => {
      if (append ? loadingMore : loading) return;
      if (append) setLoadingMore(true);
      else setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('vertical', 'feeds');
        if (cursor) params.set('cursor', cursor);
        const url = `${ROUTES.broadcasts.list}?${params.toString()}`;
        const response = await getRequest(url);
        if (!response?.success) {
          throw new Error(response?.message ?? 'Unable to load broadcasts.');
        }
        const payload = response.data ?? {};
        const rawList = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.results)
          ? payload.results
          : Array.isArray(payload?.data)
          ? payload.data
          : [];
        const normalized = rawList
          .map((item: any): BroadcastItem | null => normalizeBroadcastItem(item))
          .filter((item: BroadcastItem | null): item is BroadcastItem => Boolean(item));
        setItems((prev) => {
          const merged = append ? [...prev, ...normalized] : normalized;
          const seen = new Set<string>();
          const deduped: BroadcastItem[] = [];
          for (const item of merged) {
            if (seen.has(item.id)) continue;
            seen.add(item.id);
            deduped.push(item);
          }
          return deduped;
        });
        setNextCursor(payload?.cursor ?? null);
        setHasMore(Boolean(payload?.cursor));
        setError(null);
      } catch (err: any) {
        setError(err?.message ?? 'Unable to load feed.');
      } finally {
        if (append) setLoadingMore(false);
        else setLoading(false);
        initialLoadedRef.current = true;
      }
    },
    [loading, loadingMore],
  );

  const refresh = useCallback(async () => {
    await fetchPage({ append: false, cursor: null });
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    await fetchPage({ append: true, cursor: nextCursor });
  }, [fetchPage, loadingMore, nextCursor]);

  useEffect(() => {
    if (!initialLoadedRef.current) {
      refresh();
    }
  }, [refresh]);

  return {
    items,
    loading,
    loadingMore,
    error,
    hasMore,
    refresh,
    loadMore,
    updateItem,
  };
};
