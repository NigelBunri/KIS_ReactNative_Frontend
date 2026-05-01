import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DeviceEventEmitter } from 'react-native';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';

import { FEEDS_ENDPOINT } from '@/screens/broadcast/feeds/api/feeds.endpoints';
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

export default function useFeedsData({ q = '', code = null }: Params) {
  const [items, setItems] = useState<BroadcastFeedItem[]>([]);
  const [trending, setTrending] = useState<TrendingClipItem[]>([]);
  const [trendingFeeds, setTrendingFeeds] = useState<BroadcastFeedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const nextUrlRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  const paramsKey = useMemo(() => `${q}::${code ?? ''}`, [q, code]);

  const applyItems = useCallback((nextItems: BroadcastFeedItem[]) => {
    setItems(nextItems);
    const topTrending = getTopTrendingFeeds(nextItems);
    setTrendingFeeds(topTrending);
    setTrending(topTrending.map(toTrendingClipItem));
  }, []);

  const loadFirstPage = useCallback(async () => {
    setLoading(true);
    const url = `${FEEDS_ENDPOINT}${buildQuery({
      q,
      code,
      limit: 20,
      offset: 0,
    })}`;
    try {
      const res = await getRequest(url, {
        errorMessage: 'Unable to load feeds.',
      });
      if (!mountedRef.current) return;
      const payload = res?.data ?? res;
      const page = normalizePaginated<BroadcastFeedItem>(payload);
      const normalizedResults = (page.results ?? []).map(item =>
        normalizeFeedItem(item),
      );
      applyItems(
        shuffleFeedItems(
          normalizedResults.filter(item => !isHealthcareFeedItem(item)),
        ),
      );
      nextUrlRef.current = page.next ?? null;
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [applyItems, code, q]);

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
      const have = new Set(prev.map(x => x.id));
      const merged = [...prev];
      const normalizedResults = (page.results ?? []).map(item =>
        normalizeFeedItem(item),
      );
      const nonHealthcareResults = normalizedResults.filter(
        item => !isHealthcareFeedItem(item),
      );
      for (const it of nonHealthcareResults) {
        if (!have.has(it.id)) merged.push(it);
      }
      if (!mountedRef.current) return prev;
      const topTrending = getTopTrendingFeeds(merged);
      setTrendingFeeds(topTrending);
      setTrending(topTrending.map(toTrendingClipItem));
      return merged;
    });

    nextUrlRef.current = page.next ?? null;
    setLoadingMore(false);
  }, [loadingMore]);

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
        setItems(prev =>
          prev.map(item =>
            item.id === itemId
              ? {
                  ...item,
                  reaction_count: previousReactionCount,
                  viewer_reaction: previousReaction,
                }
              : item,
          ),
        );
        return { ok: false, error };
      }
    },
    [],
  );

  const recordShare = useCallback(async (itemId: string) => {
    const res = await postRequest(
      ROUTES.broadcasts.share(itemId),
      { platform: 'app' },
      { errorMessage: 'Unable to log share.' },
    );
    if (res?.success === false) {
      return { ok: false };
    }
    setItems(prev =>
      prev.map(item =>
        item.id === itemId
          ? {
              ...item,
              share_count: Number(item.share_count ?? 0) + 1,
            }
          : item,
      ),
    );
    return { ok: true };
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
        return { ok: false };
      }
      setItems(prev =>
        prev.map(item =>
          item.id === itemId
            ? {
                ...item,
                viewer_saved: !currentlySaved,
              }
            : item,
        ),
      );
      return { ok: true, saved: !currentlySaved };
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

  return {
    items,
    trending,
    trendingFeeds,
    loading,
    loadingMore,
    refreshing,
    refreshAll,
    loadMore,
    toggleSubscribe,
    reactToItem,
    recordShare,
    hideItem,
    toggleSaved,
  };
}
