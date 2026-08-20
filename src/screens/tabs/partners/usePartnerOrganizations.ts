import { useCallback, useEffect, useState } from 'react';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';

export type PartnerOrganizationType = 'shop' | 'health_institution' | 'education_institution' | 'broadcast_channel';

export type PartnerOrganizationLink = {
  id: string;
  owner_type: PartnerOrganizationType;
  owner_id: string;
  name: string;
  exists: boolean;
  created_at: string | null;
};

export type LinkableOrganization = {
  owner_type: PartnerOrganizationType;
  owner_id: string;
  name: string;
};

export default function usePartnerOrganizations(partnerId?: string | null) {
  const [organizations, setOrganizations] = useState<PartnerOrganizationLink[]>([]);
  const [linkable, setLinkable] = useState<LinkableOrganization[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!partnerId) return;
    setLoading(true);
    setError(null);
    try {
      const [orgsRes, linkableRes] = await Promise.all([
        getRequest(ROUTES.partners.organizations(partnerId), { errorMessage: 'Unable to load organizations.' }),
        getRequest(ROUTES.partners.linkableOrganizations(partnerId), { errorMessage: 'Unable to load linkable organizations.' }),
      ]);
      const orgsPayload = (orgsRes as any)?.data ?? orgsRes;
      const linkablePayload = (linkableRes as any)?.data ?? linkableRes;
      setOrganizations(Array.isArray(orgsPayload?.organizations) ? orgsPayload.organizations : []);
      setLinkable(Array.isArray(linkablePayload?.organizations) ? linkablePayload.organizations : []);
    } catch (err: any) {
      setError(err?.message || 'Unable to load organizations.');
    } finally {
      setLoading(false);
    }
  }, [partnerId]);

  useEffect(() => {
    load();
  }, [load]);

  const linkOrganization = useCallback(
    async (owner_type: PartnerOrganizationType, owner_id: string) => {
      if (!partnerId) return;
      try {
        await postRequest(
          ROUTES.partners.organizations(partnerId),
          { owner_type, owner_id },
          { errorMessage: 'Unable to link this organization.' },
        );
        load();
      } catch (err: any) {
        setError(err?.message || 'Unable to link this organization.');
      }
    },
    [partnerId, load],
  );

  const unlinkOrganization = useCallback(
    async (link_id: string) => {
      if (!partnerId) return;
      try {
        await postRequest(
          ROUTES.partners.unlinkOrganization(partnerId),
          { link_id },
          { errorMessage: 'Unable to unlink this organization.' },
        );
        load();
      } catch (err: any) {
        setError(err?.message || 'Unable to unlink this organization.');
      }
    },
    [partnerId, load],
  );

  return {
    organizations,
    linkable,
    loading,
    error,
    refresh: load,
    linkOrganization,
    unlinkOrganization,
  };
}
