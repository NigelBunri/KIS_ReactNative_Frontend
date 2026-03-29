import { useCallback, useEffect, useState } from 'react';
import { deleteRequest } from '@/network/delete';
import { getRequest } from '@/network/get';
import { patchRequest } from '@/network/patch';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import type { PartnerProfileLink } from '@/screens/broadcast/education/api/education.models';

export default function usePartnerProfileLinks(partnerId?: string | null) {
  const [links, setLinks] = useState<PartnerProfileLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLinks = useCallback(async () => {
    if (!partnerId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await getRequest(ROUTES.education.partnerLinks(partnerId), {
        errorMessage: 'Unable to load linked profiles.',
      });
      const payload = response?.data ?? response ?? [];
      setLinks(Array.isArray(payload) ? payload : []);
    } catch (err: any) {
      setError(err?.message || 'Unable to load linked profiles.');
    } finally {
      setLoading(false);
    }
  }, [partnerId]);

  useEffect(() => {
    loadLinks();
  }, [loadLinks]);

  const toggleLink = useCallback(
    async (profileKey: PartnerProfileLink['profileKey'], link: boolean) => {
      if (!partnerId) return;
      const route = ROUTES.education.partnerLink(partnerId, profileKey);
      try {
        const response = link
          ? await postRequest(route, {}, { errorMessage: 'Unable to link profile.' })
          : await deleteRequest(route, { errorMessage: 'Unable to unlink profile.' });
        if (response?.success !== false) {
          loadLinks();
        }
      } catch (err: any) {
        setError(err?.message || 'Unable to update linked profile.');
      }
    },
    [partnerId, loadLinks],
  );

  const setRole = useCallback(
    async (profileKey: PartnerProfileLink['profileKey'], role: PartnerProfileLink['role']) => {
      if (!partnerId) return;
      try {
        await patchRequest(
          ROUTES.education.partnerLink(partnerId, profileKey),
          { role },
          { errorMessage: 'Unable to update role.' },
        );
        loadLinks();
      } catch (err: any) {
        setError(err?.message || 'Unable to update role.');
      }
    },
    [partnerId, loadLinks],
  );

  return {
    links,
    loading,
    error,
    refresh: loadLinks,
    toggleLink,
    setRole,
  };
}
