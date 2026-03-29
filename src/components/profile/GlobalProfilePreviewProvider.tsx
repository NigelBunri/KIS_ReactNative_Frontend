import React, { createContext, useCallback, useContext, useMemo, useRef } from 'react';
import { Alert } from 'react-native';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import BroadcastAuthorProfileSheet from '@/components/broadcast/BroadcastAuthorProfileSheet';
import useAuthorProfilePreview from '@/components/broadcast/useAuthorProfilePreview';
import { normalizeKisHandleKey } from '@/utils/kisHandle';

type ResolvedAuthor = {
  id: string;
  display_name: string;
  profile_id?: string;
  avatar_url?: string;
};

type GlobalProfilePreviewContextValue = {
  openProfileByHandle: (handle: string) => Promise<boolean>;
  openProfileByUser: (author: Partial<ResolvedAuthor>) => Promise<boolean>;
};

const noopAsync = async () => false;

const GlobalProfilePreviewContext = createContext<GlobalProfilePreviewContextValue>({
  openProfileByHandle: noopAsync,
  openProfileByUser: noopAsync,
});

type Props = {
  children: React.ReactNode;
};

const normalizeAuthorPayload = (raw: any): ResolvedAuthor | null => {
  const id = String(raw?.id ?? '').trim();
  if (!id) return null;
  const displayName = String(
    raw?.display_name ??
      raw?.name ??
      raw?.username ??
      'KIS user',
  ).trim();
  const profileId = String(raw?.profile_id ?? raw?.profileId ?? '').trim();
  const avatarUrl = String(raw?.avatar_url ?? raw?.avatarUrl ?? raw?.avatar ?? '').trim();
  return {
    id,
    display_name: displayName || 'KIS user',
    profile_id: profileId || undefined,
    avatar_url: avatarUrl || undefined,
  };
};

export function GlobalProfilePreviewProvider({ children }: Props) {
  const {
    visible,
    loading,
    error,
    profile,
    openAuthorProfile,
    closeAuthorProfile,
  } = useAuthorProfilePreview();

  const handleCacheRef = useRef<Record<string, ResolvedAuthor>>({});

  const openProfileByUser = useCallback(
    async (author: Partial<ResolvedAuthor>) => {
      const normalized = normalizeAuthorPayload(author);
      if (!normalized) return false;
      await openAuthorProfile({
        source_type: 'user',
        source: { type: 'user' },
        author: normalized,
      } as any);
      return true;
    },
    [openAuthorProfile],
  );

  const openProfileByHandle = useCallback(
    async (handle: string) => {
      const normalizedKey = normalizeKisHandleKey(handle);
      if (!normalizedKey) return false;

      const cached = handleCacheRef.current[normalizedKey];
      if (cached) {
        return openProfileByUser(cached);
      }

      const response = await getRequest(ROUTES.user.resolveHandle, {
        params: { handle },
        forceNetwork: true,
        errorMessage: 'Unable to resolve profile handle.',
      });
      if (!response?.success) {
        Alert.alert('Profile preview', response?.message || 'Unable to resolve profile handle.');
        return false;
      }

      const candidate = normalizeAuthorPayload(response?.data?.user ?? response?.data);
      if (!candidate) {
        Alert.alert('Profile preview', 'No profile matched this handle.');
        return false;
      }
      handleCacheRef.current[normalizedKey] = candidate;
      return openProfileByUser(candidate);
    },
    [openProfileByUser],
  );

  const value = useMemo(
    () => ({
      openProfileByHandle,
      openProfileByUser,
    }),
    [openProfileByHandle, openProfileByUser],
  );

  return (
    <GlobalProfilePreviewContext.Provider value={value}>
      {children}
      <BroadcastAuthorProfileSheet
        visible={visible}
        loading={loading}
        error={error}
        profile={profile}
        onClose={closeAuthorProfile}
      />
    </GlobalProfilePreviewContext.Provider>
  );
}

export const useGlobalProfilePreview = () => useContext(GlobalProfilePreviewContext);

