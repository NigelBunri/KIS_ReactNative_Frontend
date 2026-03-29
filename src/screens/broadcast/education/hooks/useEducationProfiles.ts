import { useCallback, useEffect, useState } from 'react';

import ROUTES from '@/network';
import { deleteRequest } from '@/network/delete';
import { getRequest } from '@/network/get';
import { patchRequest } from '@/network/patch';
import { postRequest } from '@/network/post';

type CreateProfilePayload = {
  name: string;
  description?: string;
  profile_type?: string;
  metadata?: Record<string, any>;
  courses?: any[];
  modules?: any[];
  roles?: any[];
  is_default?: boolean;
};

export default function useEducationProfiles() {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProfiles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getRequest(ROUTES.broadcasts.educationProfiles, {
        errorMessage: 'Unable to load education profiles.',
      });
      const next = res?.data?.profiles ?? [];
      setProfiles(Array.isArray(next) ? next : []);
      setError(null);
    } catch (err: any) {
      setError(err?.message ?? 'Unable to load education profiles.');
    } finally {
      setLoading(false);
    }
  }, []);

  const createProfile = useCallback(
    async (payload: CreateProfilePayload) => {
      const res = await postRequest(ROUTES.broadcasts.educationProfiles, payload, {
        errorMessage: 'Unable to create education profile.',
      });
      if (!res?.success) {
        throw new Error(res?.message || 'Unable to create education profile.');
      }
      await loadProfiles();
      return res.data?.profile;
    },
    [loadProfiles],
  );

  const updateProfile = useCallback(
    async (profileId: string, updates: Record<string, any>) => {
      const res = await patchRequest(ROUTES.broadcasts.educationProfile(profileId), updates, {
        errorMessage: 'Unable to update education profile.',
      });
      if (!res?.success) {
        throw new Error(res?.message || 'Unable to update education profile.');
      }
      await loadProfiles();
      return res.data?.profile;
    },
    [loadProfiles],
  );

  const deleteProfile = useCallback(
    async (profileId: string) => {
      const res = await deleteRequest(ROUTES.broadcasts.educationProfile(profileId), {
        errorMessage: 'Unable to delete education profile.',
      });
      if (!res?.success && res?.status !== 204) {
        throw new Error(res?.message || 'Unable to delete education profile.');
      }
      await loadProfiles();
    },
    [loadProfiles],
  );

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  return {
    profiles,
    loading,
    error,
    reload: loadProfiles,
    createProfile,
    updateProfile,
    deleteProfile,
  };
}
