import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DeviceEventEmitter } from 'react-native';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import { enqueueMutation } from '@/services/pendingMutationsQueue';

import { FEEDS_ENDPOINT } from '@/screens/broadcast/feeds/api/feeds.endpoints';
import { recordWatchHistory as _recordWatchHistory } from '@/screens/broadcast/channels/hooks/useChannelsData';
import {
  BroadcastFeedItem,
  BroadcastSourceMeta,
  TrendingClipItem,
  normalizePaginated,
} from '@/screens/broadcast/feeds/api/feeds.types';

type Params = {
  q?: string;
  code?: string | null;
};

const buildQuery = (params: Record<string, any>) => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    const s = String(v).trim();
    if (!s) return;
    qs.set(k, s);
  });
  const out = qs.toString();
  return out ? `?${out}` : '';
};

const toTrendingClipItem = (item: BroadcastFeedItem): TrendingClipItem => ({
  id: item.id,
  title: item.title ?? item.source?.name ?? 'Broadcast',
  body: item.text_plain ?? item.text ?? '',
  text: item.text,
  styled_text: item.styled_text,
  text_doc: item.text_doc,
  text_plain: item.text_plain,
  broadcastedAt: item.broadcasted_at ?? item.created_at ?? undefined,
  attachments: item.attachments ?? [],
  engagement: {
    reactions: item.reaction_count ?? 0,
    comments: item.comment_count ?? 0,
  },
});

const getTopTrendingFeeds = (items: BroadcastFeedItem[], limit = 20) => {
  return [...items]
    .sort((a, b) => (b.reaction_count ?? 0) - (a.reaction_count ?? 0))
    .slice(0, limit);
};

const shuffleFeedItems = <T>(items: T[]): T[] => {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
  }
  return shuffled;
};

const isHealthcareFeedItem = (item: BroadcastFeedItem | null | undefined) => {
  if (!item) return false;
  const sourceType = String(item.source_type ?? '').toLowerCase();
  const sourceMetaType = String(item.source?.type ?? '').toLowerCase();
  return sourceType === 'healthcare' || sourceMetaType === 'healthcare';
};

const normalizeAuthorFromItem = (item: any) => {
  const author =
    item?.author && typeof item.author === 'object' ? item.author : {};
  const metadata =
    item?.metadata && typeof item.metadata === 'object' ? item.metadata : {};
  const fallbackUser =
    (item?.user && typeof item.user === 'object' ? item.user : null) ??
    (item?.broadcasted_by && typeof item.broadcasted_by === 'object'
      ? item.broadcasted_by
      : null) ??
    (metadata?.author && typeof metadata.author === 'object'
      ? metadata.author
      : null) ??
    (metadata?.user && typeof metadata.user === 'object'
      ? metadata.user
      : null) ??
    null;

  const authorId =
    author?.id ??
    fallbackUser?.id ??
    metadata?.author_id ??
    metadata?.authorId ??
    item?.broadcasted_by_id ??
    item?.creator_id ??
    item?.creatorId ??
    null;
  const authorProfileId =
    author?.profile_id ??
    author?.profileId ??
    fallbackUser?.profile_id ??
    fallbackUser?.profileId ??
    fallbackUser?.profile?.id ??
    metadata?.author_profile_id ??
    metadata?.authorProfileId ??
    metadata?.profile_id ??
    item?.profile?.id ??
    null;
  const displayName =
    author?.display_name ??
    author?.displayName ??
    author?.name ??
    fallbackUser?.display_name ??
    fallbackUser?.displayName ??
    fallbackUser?.name ??
    fallbackUser?.username ??
    metadata?.author_display_name ??
    metadata?.authorName ??
    metadata?.author_name ??
    null;
  const avatarUrl =
    author?.avatar_url ??
    author?.avatarUrl ??
    author?.avatar ??
    fallbackUser?.avatar_url ??
    fallbackUser?.avatarUrl ??
    fallbackUser?.avatar ??
    fallbackUser?.profile?.avatar_url ??
    fallbackUser?.profile?.avatarUrl ??
    fallbackUser?.profile?.avatar ??
    item?.profile?.avatar_url ??
    item?.profile?.avatarUrl ??
    item?.profile?.avatar ??
    metadata?.author_avatar_url ??
    metadata?.authorAvatarUrl ??
    metadata?.author_avatar ??
    metadata?.avatar_url ??
    null;
  const bio =
    author?.bio ??
    fallbackUser?.bio ??
    metadata?.author_bio ??
    metadata?.authorBio ??
    null;

  const nextAuthor: Record<string, any> = {
    ...(author || {}),
  };
  if (authorId) nextAuthor.id = String(authorId);
  if (authorProfileId) nextAuthor.profile_id = String(authorProfileId);
  if (displayName && String(displayName).trim())
    nextAuthor.display_name = String(displayName).trim();
  if (avatarUrl && String(avatarUrl).trim())
    nextAuthor.avatar_url = String(avatarUrl).trim();
  if (bio && String(bio).trim()) nextAuthor.bio = String(bio).trim();
  return Object.keys(nextAuthor).length ? nextAuthor : undefined;
};

const normalizeFeedItem = (item: BroadcastFeedItem): BroadcastFeedItem => ({
  ...item,
  author: normalizeAuthorFromItem(item),
  viewer_saved: Boolean(item.viewer_saved),
});

// Caps how many items this hook keeps in memory per params combo (see
// MAX_CACHED_FEED_ITEMS below) - past that, older items get trimmed off
// the top as new pages load in at the bottom, so a long scrolling session
// doesn't grow the in-memory list (and every full-bleed video card's
// mounted weight) without bound.
const MAX_CACHED_FEED_ITEMS = 150;

type FeedSessionCacheEntry = {
  items: BroadcastFeedItem[];
  trending: TrendingClipItem[];
  trendingFeeds: BroadcastFeedItem[];
  nextUrl: string | null;
  trimmedFromTop: boolean;
};

// Module-level (not component state) so it survives this hook unmounting
// and remounting across navigation within the same app session - leaving
// the Feeds tab and coming back re-renders from whatever's already here
// instead of blanking the list and refetching from scratch. Cleared only
// by the app process restarting, same lifetime as any other in-memory
// singleton in this codebase (no AsyncStorage/disk persistence - this is
// session-scoped, not meant to survive an app kill).
const feedSessionCache = new Map<string, FeedSessionCacheEntry>();

export default function useFeedsData({ q = '', code = null }: Params) {
  // Computed inline (not via the paramsKey useMemo below, which doesn't
  // exist yet at this point in the function) purely to seed the lazy
  // initializers below from any cached session for this exact q/code combo.
  const initialCacheKey = `${q}::${code ?? ''}`;
  const initialCached = feedSessionCache.get(initialCacheKey);

  const [items, setItems] = useState<BroadcastFeedItem[]>(initialCached?.items ?? []);
  const [trending, setTrending] = useState<TrendingClipItem[]>(initialCached?.trending ?? []);
  const [trendingFeeds, setTrendingFeeds] = useState<BroadcastFeedItem[]>(initialCached?.trendingFeeds ?? []);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const nextUrlRef = useRef<string | null>(initialCached?.nextUrl ?? null);
  const trimmedFromTopRef = useRef<boolean>(initialCached?.trimmedFromTop ?? false);
  const mountedRef = useRef(true);
  const itemsRef = useRef<BroadcastFeedItem[]>(initialCached?.items ?? []);

  const paramsKey = useMemo(() => `${q}::${code ?? ''}`, [q, code]);

  // Mirrors current state into the module-level session cache so the next
  // mount for this exact params combo (e.g. navigating back to the Feeds
  // tab) picks up right where this one left off.
  const persistCache = useCallback(
    (nextItems: BroadcastFeedItem[], nextTrendingFeeds: BroadcastFeedItem[], nextTrending: TrendingClipItem[]) => {
      feedSessionCache.set(paramsKey, {
        items: nextItems,
        trending: nextTrending,
        trendingFeeds: nextTrendingFeeds,
        nextUrl: nextUrlRef.current,
        trimmedFromTop: trimmedFromTopRef.current,
      });
    },
    [paramsKey],
  );

  const applyItems = useCallback((nextItems: BroadcastFeedItem[]) => {
    itemsRef.current = nextItems;
    setItems(nextItems);
    const topTrending = getTopTrendingFeeds(nextItems);
    setTrendingFeeds(topTrending);
    setTrending(topTrending.map(toTrendingClipItem));
    // A fresh top page fully replaces the window, so whatever was
    // previously trimmed off the top no longer applies.
    trimmedFromTopRef.current = false;
    persistCache(nextItems, topTrending, topTrending.map(toTrendingClipItem));
  }, [persistCache]);

  const loadFirstPage = useCallback(async () => {
    setLoading(true);
    // 50/page (not the previous 20) so the first screen - and every
    // full-screen/next-attachment jump within it - has a bigger loaded
    // window to draw from before ever needing another round trip. See
    // FeedsDiscoverPage's onScroll for the matching prefetch-ahead trigger
    // that loads the next 50 before the user reaches the end of this one.
    const url = `${FEEDS_ENDPOINT}${buildQuery({
      q,
      code,
      limit: 50,
      offset: 0,
    })}`;
    try {
      const res = await getRequest(url, {
        errorMessage: 'Unable to load feeds.',
        cacheKey: `broadcast_feeds_v1:${paramsKey}`,
        offlineTtlSeconds: 30 * 60,
        staleWhileRevalidate: true,
        forceNetwork: true,
      });
      if (!mountedRef.current) return;
      const payload = res?.data ?? res;
      const page = normalizePaginated<BroadcastFeedItem>(payload);
      const normalizedResults = (page.results ?? []).map(item =>
        normalizeFeedItem(item),
      );
      const nonHealthcareResults = normalizedResults.filter(item => !isHealthcareFeedItem(item));
      // Dedup by string-normalized id so the same item can't appear twice
      const seen = new Set<string>();
      const visibleResults = nonHealthcareResults.filter(item => {
        const key = String(item.id);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      if (visibleResults.length === 0 && itemsRef.current.length > 0) {
        nextUrlRef.current = page.next ?? null;
        return;
      }
      applyItems(shuffleFeedItems(visibleResults));
      nextUrlRef.current = page.next ?? null;

      // staleWhileRevalidate only ever did the "stale" half — a cache hit
      // this old can carry presigned S3 video/PDF URLs that expired days
      // ago (they're only valid ~1hr), so a single transient network blip
      // could leave dead video links on screen indefinitely with nothing
      // ever re-fetching. If this response was a stale fallback, force one
      // real network refetch shortly after to replace it with live data
      // (and live, unexpired signed URLs).
      if ((res as any)?.stale) {
        setTimeout(() => {
          if (!mountedRef.current) return;
          getRequest(url, { errorMessage: 'Unable to refresh feeds.', forceNetwork: true })
            .then(freshRes => {
              if (!mountedRef.current || !freshRes?.success) return;
              const freshPayload = freshRes?.data ?? freshRes;
              const freshPage = normalizePaginated<BroadcastFeedItem>(freshPayload);
              const freshResults = (freshPage.results ?? [])
                .map(item => normalizeFeedItem(item))
                .filter(item => !isHealthcareFeedItem(item));
              if (freshResults.length === 0) return;
              const freshSeen = new Set<string>();
              const dedupedFresh = freshResults.filter(item => {
                const key = String(item.id);
                if (freshSeen.has(key)) return false;
                freshSeen.add(key);
                return true;
              });
              applyItems(shuffleFeedItems(dedupedFresh));
              nextUrlRef.current = freshPage.next ?? null;
            })
            .catch(() => {});
        }, 400);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [applyItems, code, paramsKey, q]);

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    await loadFirstPage();
    if (!mountedRef.current) return;
    setRefreshing(false);
  }, [loadFirstPage]);

  const loadMore = useCallback(async () => {
    const nextUrl = nextUrlRef.current;
    if (!nextUrl || loadingMore) return;

    setLoadingMore(true);
    const res = await getRequest(nextUrl, {
      errorMessage: 'Unable to load more.',
    });
    const payload = res?.data ?? res;
    const page = normalizePaginated<BroadcastFeedItem>(payload);
    if (!mountedRef.current) {
      setLoadingMore(false);
      return;
    }

    setItems(prev => {
      const have = new Set(prev.map(x => String(x.id)));
      const merged = [...prev];
      const normalizedResults = (page.results ?? []).map(item =>
        normalizeFeedItem(item),
      );
      const nonHealthcareResults = normalizedResults.filter(
        item => !isHealthcareFeedItem(item),
      );
      for (const it of nonHealthcareResults) {
        if (!have.has(String(it.id))) {
          have.add(String(it.id));
          merged.push(it);
        }
      }
      if (!mountedRef.current) return prev;

      // Keep the in-memory window bounded - trim the oldest (topmost)
      // items once a new page pushes past the cap, same idea as a video
      // player only keeping a rolling buffer instead of the whole file.
      // The trimmed content isn't gone forever: scrolling back up near the
      // top re-triggers loadFirstPage (see FeedsDiscoverPage's onScroll
      // and refillFromTopIfTrimmed below), which refetches a fresh page 1.
      let windowed = merged;
      if (merged.length > MAX_CACHED_FEED_ITEMS) {
        windowed = merged.slice(merged.length - MAX_CACHED_FEED_ITEMS);
        trimmedFromTopRef.current = true;
      }

      itemsRef.current = windowed;
      const topTrending = getTopTrendingFeeds(windowed);
      setTrendingFeeds(topTrending);
      setTrending(topTrending.map(toTrendingClipItem));
      nextUrlRef.current = page.next ?? null;
      persistCache(windowed, topTrending, topTrending.map(toTrendingClipItem));
      return windowed;
    });

    setLoadingMore(false);
  }, [loadingMore, persistCache]);

  // Re-fetches page 1 when the user scrolls back up near the top of a
  // window that's had its original top trimmed off (see loadMore above) -
  // that content isn't cached indefinitely, so "scrolling back up" means a
  // real (usually fast, since it's a single page) refetch rather than a
  // local restore. A no-op when nothing's been trimmed.
  const refillFromTopIfTrimmed = useCallback(() => {
    if (!trimmedFromTopRef.current || loading) return;
    void loadFirstPage();
  }, [loading, loadFirstPage]);

  const reactToItem = useCallback(
    async (itemId: string, emoji: string = '❤️') => {
      let previousReactionCount = 0;
      let previousReaction: string | null = null;
      setItems(prev =>
        prev.map(item =>
          item.id === itemId
            ? (() => {
                previousReactionCount = Number(item.reaction_count ?? 0);
                previousReaction = item.viewer_reaction ?? null;
                const hadSameReaction = previousReaction === emoji;
                const hadDifferentReaction = Boolean(
                  previousReaction && previousReaction !== emoji,
                );
                return {
                  ...item,
                  reaction_count: hadSameReaction
                    ? Math.max(previousReactionCount - 1, 0)
                    : hadDifferentReaction
                    ? previousReactionCount
                    : previousReactionCount + 1,
                  viewer_reaction: hadSameReaction ? null : emoji,
                };
              })()
            : item,
        ),
      );
      try {
        const res = await postRequest(
          ROUTES.broadcasts.react(itemId),
          { emoji },
          { errorMessage: 'Unable to react.' },
        );
        if (res?.success === false) {
          throw new Error(res?.message || 'Unable to react.');
        }
        const count = Number(res?.data?.count ?? res?.count ?? 0);
        const reacted = Boolean(res?.data?.reacted ?? res?.reacted);
        setItems(prev =>
          prev.map(item =>
            item.id === itemId
              ? {
                  ...item,
                  reaction_count: count,
                  viewer_reaction: reacted ? emoji : null,
                }
              : item,
          ),
        );
        return { ok: true };
      } catch (error) {
        // Queue for retry when offline — optimistic state stays intact
        enqueueMutation({
          method: 'POST',
          url: ROUTES.broadcasts.react(itemId),
          payload: { emoji },
        }).catch(() => {});
        return { ok: false, error };
      }
    },
    [],
  );

  const recordShare = useCallback(async (itemId: string) => {
    // Optimistic share count increment
    setItems(prev =>
      prev.map(item =>
        item.id === itemId
          ? { ...item, share_count: Number(item.share_count ?? 0) + 1 }
          : item,
      ),
    );
    try {
      const res = await postRequest(
        ROUTES.broadcasts.share(itemId),
        { platform: 'app' },
        { errorMessage: 'Unable to log share.' },
      );
      if (res?.success === false) {
        throw new Error(res?.message || 'Unable to log share.');
      }
      return { ok: true };
    } catch {
      // Queue for retry; keep optimistic count
      enqueueMutation({
        method: 'POST',
        url: ROUTES.broadcasts.share(itemId),
        payload: { platform: 'app' },
      }).catch(() => {});
      return { ok: false };
    }
  }, []);

  const hideItem = useCallback(
    async (itemId: string) => {
      const res = await postRequest(
        ROUTES.broadcasts.hide(itemId),
        {},
        { errorMessage: 'Unable to hide broadcast.' },
      );
      if (res?.success === false) {
        return { ok: false };
      }
      applyItems(items.filter(item => item.id !== itemId));
      return { ok: true };
    },
    [applyItems, items],
  );

  const toggleSaved = useCallback(
    async (itemId: string, currentlySaved: boolean) => {
      const endpoint = ROUTES.broadcasts.save(itemId);
      // Optimistic update
      setItems(prev =>
        prev.map(item =>
          item.id === itemId ? { ...item, viewer_saved: !currentlySaved } : item,
        ),
      );
      try {
        const res = currentlySaved
          ? await postRequest(
              `${endpoint}?action=unsave`,
              {},
              { errorMessage: 'Unable to remove saved broadcast.' },
            )
          : await postRequest(
              endpoint,
              {},
              { errorMessage: 'Unable to save broadcast.' },
            );
        if (res?.success === false) {
          throw new Error(res?.message || 'Failed');
        }
        return { ok: true, saved: !currentlySaved };
      } catch {
        // Queue for retry; optimistic state stays
        enqueueMutation({
          method: 'POST',
          url: currentlySaved ? `${endpoint}?action=unsave` : endpoint,
          payload: {},
        }).catch(() => {});
        return { ok: false };
      }
    },
    [],
  );

  const toggleSubscribe = useCallback(
    async (
      source: BroadcastSourceMeta | undefined,
      currentlySubscribed: boolean,
    ) => {
      if (!source?.id) {
        return { ok: false };
      }
      if (!source.allow_subscribe && !currentlySubscribed) {
        return { ok: false };
      }

      const targetType = String(source.type ?? '').toLowerCase();
      if (!['partner', 'community', 'channel'].includes(targetType)) {
        return { ok: false };
      }

      const payload: Record<string, any> = {
        target_type: targetType,
        target_id: source.id,
      };
      if (targetType === 'channel' && source.conversation_id) {
        payload.conversation_id = source.conversation_id;
      }

      const res = await postRequest(
        currentlySubscribed
          ? `${ROUTES.broadcasts.subscribe}?action=unsubscribe`
          : ROUTES.broadcasts.subscribe,
        payload,
        { errorMessage: 'Unable to update subscription.' },
      );
      if (res?.success === false) return { ok: false };

      setItems(prev =>
        prev.map(it => {
          if (!it.source?.id || String(it.source.id) !== String(source.id))
            return it;
          if (String(it.source.type) !== targetType) return it;
          return {
            ...it,
            source: {
              ...it.source,
              is_subscribed: !currentlySubscribed,
              can_open: !currentlySubscribed,
            },
          };
        }),
      );

      DeviceEventEmitter.emit('broadcast.refresh');
      return { ok: true, subscribed: !currentlySubscribed };
    },
    [],
  );

  useEffect(() => {
    mountedRef.current = true;
    refreshAll();
    return () => {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('broadcast.refresh', () => {
      refreshAll();
    });
    return () => sub.remove();
  }, [refreshAll]);

  const recordWatchHistory = useCallback(
    async (contentId: string, watchedSeconds?: number) => {
      await _recordWatchHistory(contentId, watchedSeconds != null ? { watched_seconds: watchedSeconds } : {});
    },
    [],
  );

  return {
    items,
    trending,
    trendingFeeds,
    loading,
    loadingMore,
    refreshing,
    refreshAll,
    loadMore,
    refillFromTopIfTrimmed,
    toggleSubscribe,
    reactToItem,
    recordShare,
    hideItem,
    toggleSaved,
    recordWatchHistory,
  };
}
