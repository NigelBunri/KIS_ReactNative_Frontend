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

const mergeById = (primary: BroadcastFeedItem[], secondary: BroadcastFeedItem[]) => {
  const out: BroadcastFeedItem[] = [];
  const seen = new Set<string>();
  for (const row of primary) {
    const id = String(row?.id ?? '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(row);
  }
  for (const row of secondary) {
    const id = String(row?.id ?? '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(row);
  }
  return out;
};

const isHealthcareFeedItem = (item: BroadcastFeedItem | null | undefined) => {
  if (!item) return false;
  const sourceType = String(item.source_type ?? '').toLowerCase();
  const sourceMetaType = String(item.source?.type ?? '').toLowerCase();
  return sourceType === 'healthcare' || sourceMetaType === 'healthcare';
};

const normalizeAuthorFromItem = (item: any) => {
  const author = item?.author && typeof item.author === 'object' ? item.author : {};
  const metadata = item?.metadata && typeof item.metadata === 'object' ? item.metadata : {};
  const fallbackUser =
    (item?.user && typeof item.user === 'object' ? item.user : null) ??
    (item?.broadcasted_by && typeof item.broadcasted_by === 'object' ? item.broadcasted_by : null) ??
    (metadata?.author && typeof metadata.author === 'object' ? metadata.author : null) ??
    (metadata?.user && typeof metadata.user === 'object' ? metadata.user : null) ??
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
  if (displayName && String(displayName).trim()) nextAuthor.display_name = String(displayName).trim();
  if (avatarUrl && String(avatarUrl).trim()) nextAuthor.avatar_url = String(avatarUrl).trim();
  if (bio && String(bio).trim()) nextAuthor.bio = String(bio).trim();
  return Object.keys(nextAuthor).length ? nextAuthor : undefined;
};

const normalizeFeedItem = (item: BroadcastFeedItem): BroadcastFeedItem => ({
  ...item,
  author: normalizeAuthorFromItem(item),
});

const mapProfileFeedToBroadcastItem = (entry: any, owner?: any): BroadcastFeedItem => {
  const attachments = ([] as any[])
    .concat(entry.attachment ? [entry.attachment] : [])
    .concat(Array.isArray(entry.attachments) ? entry.attachments : [])
    .filter(Boolean);

  const timestamp = entry.created_at ?? entry.updated_at ?? new Date().toISOString();
  const authorIdRaw =
    entry?.author?.id ??
    entry?.author_id ??
    entry?.user?.id ??
    entry?.user_id ??
    owner?.id ??
    owner?.user_id ??
    null;
  const authorDisplayName =
    entry?.author?.display_name ??
    entry?.author_name ??
    entry?.user?.display_name ??
    entry?.user?.name ??
    owner?.display_name ??
    owner?.name ??
    owner?.username ??
    entry?.display_name ??
    '';
  const authorProfileId =
    entry?.author?.profile_id ??
    entry?.author?.profileId ??
    entry?.profile?.id ??
    entry?.profile_id ??
    owner?.profile?.id ??
    owner?.profile_id ??
    null;
  const authorAvatar =
    entry?.author?.avatar_url ??
    entry?.author?.avatarUrl ??
    entry?.author?.avatar ??
    entry?.user?.avatar_url ??
    entry?.user?.avatarUrl ??
    owner?.avatar_url ??
    owner?.avatarUrl ??
    owner?.avatar ??
    entry?.avatar_url ??
    entry?.avatarUrl ??
    null;
  const authorBio =
    entry?.author?.bio ??
    entry?.profile?.bio ??
    entry?.user?.bio ??
    owner?.bio ??
    entry?.summary ??
    '';

  return {
    id: `profile-${entry.id}`,
    source_type: 'broadcast_profile',
    source_id: String(entry.id),
    title: entry.title,
    text: entry.summary,
    text_plain: entry.summary,
    broadcasted_at: timestamp,
    created_at: timestamp,
    attachments,
    reaction_count: entry.reaction_count ?? 0,
    comment_count: entry.comment_count ?? 0,
    author: {
      id: authorIdRaw ? String(authorIdRaw) : undefined,
      profile_id: authorProfileId ? String(authorProfileId) : undefined,
      display_name: String(authorDisplayName || '').trim() || 'KIS user',
      avatar_url: authorAvatar ? String(authorAvatar) : undefined,
      bio: String(authorBio || '').trim() || undefined,
    },
    source: {
      type: 'broadcast_profile',
      id: String(entry?.profile_id ?? entry?.broadcast_profile_id ?? 'main'),
      name: entry?.profile_name ?? entry?.broadcast_profile_name ?? 'Broadcast profile',
      is_subscribed: true,
      allow_subscribe: false,
      can_open: true,
    },
  };
};

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

  const fetchDjangoBroadcastFeeds = useCallback(async () => {
    try {
      const res = await getRequest(ROUTES.broadcasts.list, {
        errorMessage: 'Unable to load broadcast profiles.',
      });
      if (!res?.success) return [];

      const apiPayload = res?.data ?? {};
      const apiPage = normalizePaginated<BroadcastFeedItem>(apiPayload);
      const apiResults = (apiPage.results ?? []).map((item) => normalizeFeedItem(item));

      const profile = res.data?.profiles?.broadcast_feed;
      const owner =
        profile?.owner ??
        profile?.user ??
        res.data?.user ??
        null;
      const feeds = Array.isArray(profile?.feeds) ? profile.feeds : [];
      const profileFeeds = feeds.map((entry: any) => mapProfileFeedToBroadcastItem(entry, owner));
      return mergeById(apiResults, profileFeeds);
    } catch (error) {
      console.warn('[useFeedsData] django broadcasts failed', error);
      return [];
    }
  }, []);

  const loadFirstPage = useCallback(async () => {
    setLoading(true);
    const url = `${FEEDS_ENDPOINT}${buildQuery({ q, code })}`;
    try {
      const [res, djangoFeeds] = await Promise.all([
        getRequest(url, { errorMessage: 'Unable to load feeds.' }),
        fetchDjangoBroadcastFeeds(),
      ]);
      if (!mountedRef.current) return;
      const payload = res?.data ?? res;
      const page = normalizePaginated<BroadcastFeedItem>(payload);
      const normalizedResults = (page.results ?? []).map((item) => normalizeFeedItem(item));
      const nonHealthcareResults = normalizedResults.filter((item) => !isHealthcareFeedItem(item));
      const nextItems = mergeById(
        djangoFeeds.filter((item) => !isHealthcareFeedItem(item)),
        nonHealthcareResults,
      );
      setItems(nextItems);
      const topTrending = getTopTrendingFeeds(nextItems);
      setTrendingFeeds(topTrending);
      setTrending(topTrending.map(toTrendingClipItem));
      nextUrlRef.current = page.next ?? null;
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [code, fetchDjangoBroadcastFeeds, q]);

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
    const res = await getRequest(nextUrl, { errorMessage: 'Unable to load more.' });
    const payload = res?.data ?? res;
    const page = normalizePaginated<BroadcastFeedItem>(payload);
    if (!mountedRef.current) {
      setLoadingMore(false);
      return;
    }

    setItems((prev) => {
      const have = new Set(prev.map((x) => x.id));
      const merged = [...prev];
      const normalizedResults = (page.results ?? []).map((item) => normalizeFeedItem(item));
      const nonHealthcareResults = normalizedResults.filter((item) => !isHealthcareFeedItem(item));
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

  const toggleSubscribe = useCallback(
    async (source: BroadcastSourceMeta | undefined, currentlySubscribed: boolean) => {
      if (!source?.id || !source.allow_subscribe) {
        return { ok: false };
      }

      const targetType = String(source.type ?? '').toLowerCase();
      if (!['partner', 'community', 'channel'].includes(targetType)) {
        return { ok: false };
      }

      if (currentlySubscribed) {
        setItems((prev) =>
          prev.map((it) => {
            if (!it.source?.id || String(it.source.id) !== String(source.id)) return it;
            return {
              ...it,
              source: {
                ...it.source,
                is_subscribed: false,
              },
            };
          }),
        );
        return { ok: true };
      }

      const payload: Record<string, any> = {
        target_type: targetType,
        target_id: source.id,
      };
      if (targetType === 'channel' && source.conversation_id) {
        payload.conversation_id = source.conversation_id;
      }

      const res = await postRequest(
        ROUTES.broadcasts.subscribe,
        payload,
        { errorMessage: 'Unable to update subscription.' },
      );
      if (res?.success === false) return { ok: false };

      setItems((prev) =>
        prev.map((it) => {
          if (!it.source?.id || String(it.source.id) !== String(source.id)) return it;
          if (String(it.source.type) !== targetType) return it;
          return {
            ...it,
            source: {
              ...it.source,
              is_subscribed: true,
            },
          };
        }),
      );

      DeviceEventEmitter.emit('broadcast.refresh');
      return { ok: true };
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
  };
}
