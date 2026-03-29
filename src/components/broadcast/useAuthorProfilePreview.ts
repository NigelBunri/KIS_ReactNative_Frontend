import { useCallback, useRef, useState } from 'react';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import {
  extractBroadcastAuthorBio,
  isUserBroadcastSource,
} from '@/components/broadcast/authorProfileUtils';

type BroadcastItemLike = {
  source_type?: string;
  source?: { type?: string } | null;
  author?: {
    id?: string;
    profile_id?: string;
    profileId?: string;
    display_name?: string;
    avatar_url?: string;
    bio?: string;
  } | null;
  profile?: Record<string, any> | null;
};

const buildFallbackProfile = (item: BroadcastItemLike) => ({
  user: {
    id: item?.author?.id ?? null,
    display_name: item?.author?.display_name ?? 'KIS user',
    avatar_url: item?.author?.avatar_url ?? null,
  },
  profile: {
    bio: extractBroadcastAuthorBio(item) || null,
  },
});

const mergeProfilePayload = (fallback: any, payload: any) => ({
  ...fallback,
  ...(payload || {}),
  user: {
    ...(fallback?.user || {}),
    ...((payload && payload.user) || {}),
  },
  profile: {
    ...(fallback?.profile || {}),
    ...((payload && payload.profile) || {}),
  },
  sections: {
    ...((payload && payload.sections) || {}),
  },
});

export default function useAuthorProfilePreview() {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const cacheRef = useRef<Record<string, any>>({});
  const authorToProfileIdRef = useRef<Record<string, string>>({});
  const requestIdRef = useRef(0);

  const closeAuthorProfile = useCallback(() => {
    setVisible(false);
  }, []);

  const openAuthorProfile = useCallback(async (item: BroadcastItemLike) => {
    if (!isUserBroadcastSource(item)) return;

    const authorId = String(item?.author?.id ?? '').trim();
    const authorProfileId = String(
      item?.author?.profile_id ??
        item?.author?.profileId ??
        item?.profile?.id ??
        '',
    ).trim();
    const fallback = buildFallbackProfile(item);
    const nextRequestId = requestIdRef.current + 1;
    requestIdRef.current = nextRequestId;

    setVisible(true);
    setError(null);
    setProfile(fallback);

    if (!authorId && !authorProfileId) {
      setLoading(false);
      setError('Public profile details are not available for this broadcaster yet.');
      return;
    }

    const cacheKey = authorProfileId ? `profile:${authorProfileId}` : `user:${authorId}`;
    const cached = cacheRef.current[cacheKey];
    if (cached) {
      setLoading(false);
      setProfile(cached);
      return;
    }

    setLoading(true);
    try {
      let profileId = authorProfileId;
      if (!profileId && authorId) {
        const existingProfileId = authorToProfileIdRef.current[authorId];
        if (existingProfileId) {
          profileId = existingProfileId;
        } else {
          const userRes = await getRequest(ROUTES.user.detail(authorId), {
            errorMessage: 'Unable to load profile preview.',
          });
          if (nextRequestId !== requestIdRef.current) return;
          const userPayload = userRes?.data ?? {};
          const enrichedFallback = mergeProfilePayload(fallback, {
            user: {
              avatar_url:
                userPayload?.profile?.avatar_url ??
                userPayload?.profile?.avatar ??
                userPayload?.avatar_url ??
                fallback?.user?.avatar_url ??
                null,
              display_name:
                userPayload?.display_name ??
                userPayload?.username ??
                fallback?.user?.display_name ??
                'KIS user',
            },
            profile: {
              avatar_url:
                userPayload?.profile?.avatar_url ??
                userPayload?.profile?.avatar ??
                fallback?.profile?.avatar_url ??
                null,
              cover_url:
                userPayload?.profile?.cover_url ??
                userPayload?.profile?.cover ??
                fallback?.profile?.cover_url ??
                null,
              bio:
                userPayload?.profile?.bio ??
                fallback?.profile?.bio ??
                null,
            },
          });
          setProfile(enrichedFallback);
          const resolvedProfileId = String(
            userPayload?.profile?.id ??
              userPayload?.profile_id ??
              userPayload?.profileId ??
              '',
          ).trim();
          if (resolvedProfileId) {
            authorToProfileIdRef.current[authorId] = resolvedProfileId;
            profileId = resolvedProfileId;
          }
        }
      }

      if (!profileId) {
        if (nextRequestId !== requestIdRef.current) return;
        setError('Public profile details are not available for this broadcaster yet.');
        return;
      }

      const res = await getRequest(ROUTES.profiles.view(profileId), {
        errorMessage: 'Unable to load profile preview.',
      });
      if (nextRequestId !== requestIdRef.current) return;
      const payload = res?.data ?? null;
      if (payload) {
        const merged = mergeProfilePayload(fallback, payload);
        cacheRef.current[cacheKey] = merged;
        setProfile(merged);
        setError(null);
      } else {
        setError(res?.message || 'Unable to load public profile details.');
      }
    } catch (err: any) {
      if (nextRequestId !== requestIdRef.current) return;
      setError(err?.message || 'Unable to load public profile details.');
    } finally {
      if (nextRequestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  return {
    visible,
    loading,
    error,
    profile,
    openAuthorProfile,
    closeAuthorProfile,
  };
}
