import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { getRequest } from '@/network/get';
import ROUTES from '@/network';
import {
  Partner,
  PartnerChannel,
  PartnerCommunity,
  PartnerGroup,
} from '@/components/partners/partnersTypes';

const initialsFor = (name?: string | null) => {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase()).join('');
};

const mapPartner = (raw: any): Partner => ({
  id: raw.id,
  name: raw.name,
  slug: raw.slug,
  description: raw.description ?? '',
  avatar_url: raw.avatar_url ?? '',
  is_active: raw.is_active ?? true,
  main_conversation_id: raw.main_conversation_id ?? null,
  created_at: raw.created_at,
  updated_at: raw.updated_at,
  initials: initialsFor(raw.name),
  tagline: raw.description || raw.slug || '',
  admins: Array.isArray(raw.admins) ? raw.admins : [],
  role: raw.role ?? raw.member_role ?? raw.access_level ?? null,
  member_role: raw.member_role ?? null,
  access_level: raw.access_level ?? null,
});

export const usePartnersData = () => {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [partnerCommunities, setPartnerCommunities] = useState<PartnerCommunity[]>([]);
  const [partnerGroups, setPartnerGroups] = useState<PartnerGroup[]>([]);
  const [partnerChannels, setPartnerChannels] = useState<PartnerChannel[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [selectedFeed, setSelectedFeed] = useState<'general' | null>(null);
  const [selectedCommunityFeedId, setSelectedCommunityFeedId] = useState<string | null>(null);
  const [expandedCommunities, setExpandedCommunities] = useState<
    Record<string, boolean>
  >({});

  const selectedPartner: Partner = useMemo(
    () =>
      partners.find((p) => p.id === selectedPartnerId) ??
      partners[0] ??
      mapPartner({ id: '', name: 'Partner', slug: '' }),
    [partners, selectedPartnerId],
  );

  const groupsForPartner: PartnerGroup[] = useMemo(
    () => partnerGroups.filter((g) => g.partner === selectedPartner?.id),
    [partnerGroups, selectedPartner?.id],
  );

  const communitiesForPartner: PartnerCommunity[] = useMemo(
    () => partnerCommunities.filter((c) => c.partner === selectedPartner?.id),
    [partnerCommunities, selectedPartner?.id],
  );

  const channelsForPartner: PartnerChannel[] = useMemo(
    () => partnerChannels.filter((c) => c.partner === selectedPartner?.id),
    [partnerChannels, selectedPartner?.id],
  );

  const rootGroups: PartnerGroup[] = useMemo(
    () => groupsForPartner.filter((g) => !g.community),
    [groupsForPartner],
  );

  const rootChannels: PartnerChannel[] = useMemo(
    () => channelsForPartner.filter((c) => !c.community),
    [channelsForPartner],
  );

  const loadPartners = useCallback(async () => {
    const res = await getRequest(ROUTES.partners.list, {
      errorMessage: 'Unable to load partners.',
    });
    const list = (res?.data?.results ?? res?.data ?? res ?? []) as any[];
    const mapped = Array.isArray(list) ? list.map(mapPartner) : [];
    setPartners(mapped);
    if (mapped.length > 0) {
      const exists = selectedPartnerId
        ? mapped.some((p) => p.id === selectedPartnerId)
        : false;
      if (!selectedPartnerId || !exists) {
        setSelectedPartnerId(mapped[0].id);
      }
    }
  }, [selectedPartnerId]);

  const loadPartnerDetail = useCallback(async (partnerId: string) => {
    const res = await getRequest(ROUTES.partners.detail(partnerId), {
      errorMessage: 'Unable to load partner details.',
    });
    if (!res?.success || !res?.data) return;
    setPartners((prev) =>
      prev.map((p) => (p.id === partnerId ? mapPartner({ ...p, ...res.data }) : p)),
    );
  }, []);

  const loadPartnerCommunities = useCallback(async (partnerId: string) => {
    const res = await getRequest(`${ROUTES.community.list}?partner=${partnerId}`, {
      errorMessage: 'Unable to load partner communities.',
    });
    const list = (res?.data?.results ?? res?.data ?? res ?? []) as PartnerCommunity[];
    setPartnerCommunities(Array.isArray(list) ? list : []);
  }, []);

  const loadPartnerGroups = useCallback(async (partnerId: string) => {
    const res = await getRequest(`${ROUTES.groups.list}?partner=${partnerId}`, {
      errorMessage: 'Unable to load partner groups.',
    });
    const list = (res?.data?.results ?? res?.data ?? res ?? []) as PartnerGroup[];
    setPartnerGroups(Array.isArray(list) ? list : []);
  }, []);

  const loadPartnerChannels = useCallback(async (partnerId: string) => {
    const res = await getRequest(`${ROUTES.channels.getAllChannels}?partner=${partnerId}`, {
      errorMessage: 'Unable to load partner channels.',
    });
    const list = (res?.data?.results ?? res?.data ?? res ?? []) as PartnerChannel[];
    setPartnerChannels(Array.isArray(list) ? list : []);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadPartners();
    }, [loadPartners]),
  );

  useEffect(() => {
    if (!selectedPartnerId) return;
    loadPartnerDetail(selectedPartnerId);
    loadPartnerCommunities(selectedPartnerId);
    loadPartnerGroups(selectedPartnerId);
    loadPartnerChannels(selectedPartnerId);
    setSelectedGroupId(null);
    setSelectedChannelId(null);
    setSelectedFeed(null);
    setSelectedCommunityFeedId(null);
  }, [
    selectedPartnerId,
    loadPartnerDetail,
    loadPartnerCommunities,
    loadPartnerGroups,
    loadPartnerChannels,
  ]);

  const reloadSelectedPartner = useCallback(() => {
    if (!selectedPartnerId) return;
    loadPartnerDetail(selectedPartnerId);
    loadPartnerCommunities(selectedPartnerId);
    loadPartnerGroups(selectedPartnerId);
    loadPartnerChannels(selectedPartnerId);
  }, [
    selectedPartnerId,
    loadPartnerDetail,
    loadPartnerCommunities,
    loadPartnerGroups,
    loadPartnerChannels,
  ]);

  useEffect(() => {
    const initial: Record<string, boolean> = {};
    communitiesForPartner.forEach((c) => {
      initial[c.id] = true;
    });
    setExpandedCommunities(initial);
  }, [selectedPartnerId, communitiesForPartner]);

  const toggleCommunity = (communityId: string) => {
    setExpandedCommunities((prev) => ({
      ...prev,
      [communityId]: !(prev[communityId] ?? true),
    }));
  };

  return {
    partners,
    partnerCommunities,
    partnerGroups,
    partnerChannels,
    selectedPartner,
    selectedPartnerId,
    setSelectedPartnerId,
    selectedGroupId,
    setSelectedGroupId,
    selectedChannelId,
    setSelectedChannelId,
    selectedFeed,
    setSelectedFeed,
    selectedCommunityFeedId,
    setSelectedCommunityFeedId,
    expandedCommunities,
    toggleCommunity,
    rootGroups,
    rootChannels,
    groupsForPartner,
    channelsForPartner,
    communitiesForPartner,
    reloadSelectedPartner,
    reloadPartners: loadPartners,
  };
};
