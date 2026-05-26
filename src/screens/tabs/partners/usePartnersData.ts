import { useCallback, useEffect, useMemo, useState } from 'react';
import { DeviceEventEmitter } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getRequest } from '@/network/get';
import ROUTES from '@/network';
import {
  Partner,
  PartnerChannel,
  PartnerCommunity,
  PartnerDiscordSummary,
  PartnerGroup,
} from '@/components/partners/partnersTypes';

const isKcanPartner = (p: Partner) =>
  p.slug?.toLowerCase() === 'kcan' ||
  p.name?.toLowerCase() === 'kcan' ||
  p.name?.toLowerCase().includes('kingdom impact');

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
  discord_summary: raw.discord_summary ?? raw.discordSummary ?? null,
  verification_summary: raw.verification_summary ?? null,
});

export const usePartnersData = (isSuperuser = false) => {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [partnersLoading, setPartnersLoading] = useState(true);
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
    () => partnerGroups.filter((g) => String(g.partner ?? '') === String(selectedPartner?.id ?? '')),
    [partnerGroups, selectedPartner?.id],
  );

  const communitiesForPartner: PartnerCommunity[] = useMemo(
    () => partnerCommunities.filter((c) => String(c.partner ?? '') === String(selectedPartner?.id ?? '')),
    [partnerCommunities, selectedPartner?.id],
  );

  const channelsForPartner: PartnerChannel[] = useMemo(
    () => partnerChannels.filter((c) => String(c.partner ?? '') === String(selectedPartner?.id ?? '')),
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

  const applyOwnerOverride = useCallback(
    (partner: Partner): Partner =>
      isSuperuser && isKcanPartner(partner)
        ? { ...partner, role: 'owner', member_role: 'owner', access_level: 'owner' }
        : partner,
    [isSuperuser],
  );

  const loadPartners = useCallback(async () => {
    setPartnersLoading(true);
    try {
      const res = await getRequest(ROUTES.partners.list, {
        errorMessage: 'Unable to load partners.',
      });
      const list = (res?.data?.results ?? res?.data ?? res ?? []) as any[];
      const mapped = Array.isArray(list)
        ? list.map((raw) => applyOwnerOverride(mapPartner(raw)))
        : [];
      setPartners(mapped);
      if (mapped.length > 0) {
        const exists = selectedPartnerId
          ? mapped.some((p) => p.id === selectedPartnerId)
          : false;
        if (!selectedPartnerId || !exists) {
          setSelectedPartnerId(mapped[0].id);
        }
      }
    } finally {
      setPartnersLoading(false);
    }
  }, [selectedPartnerId, applyOwnerOverride]);

  const loadPartnerDetail = useCallback(async (partnerId: string) => {
    const res = await getRequest(ROUTES.partners.detail(partnerId), {
      errorMessage: 'Unable to load partner details.',
    });
    if (!res?.success || !res?.data) return;
    setPartners((prev) =>
      prev.map((p) =>
        p.id === partnerId
          ? applyOwnerOverride(mapPartner({ ...p, ...res.data }))
          : p,
      ),
    );
  }, [applyOwnerOverride]);

  const loadPartnerDiscordSummary = useCallback(async (partnerId: string) => {
    const res = await getRequest(ROUTES.partners.discordSummary(partnerId), {
      errorMessage: 'Unable to load partner workspace summary.',
    });
    if (!res?.success || !res?.data) return;
    const summary = res.data as PartnerDiscordSummary;
    setPartners((prev) =>
      prev.map((p) =>
        p.id === partnerId ? { ...p, discord_summary: summary } : p,
      ),
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

  // Reload partner data when groups/channels/communities are created from outside this context
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('partner.data.refresh', () => {
      loadPartners();
      if (selectedPartnerId) {
        loadPartnerGroups(selectedPartnerId);
        loadPartnerChannels(selectedPartnerId);
        loadPartnerCommunities(selectedPartnerId);
      }
    });
    return () => sub.remove();
  }, [selectedPartnerId, loadPartners, loadPartnerGroups, loadPartnerChannels, loadPartnerCommunities]);

  useEffect(() => {
    if (!selectedPartnerId) return;
    loadPartnerDetail(selectedPartnerId);
    loadPartnerDiscordSummary(selectedPartnerId);
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
    loadPartnerDiscordSummary,
  ]);

  const reloadSelectedPartner = useCallback(() => {
    if (!selectedPartnerId) return;
    loadPartnerDetail(selectedPartnerId);
    loadPartnerDiscordSummary(selectedPartnerId);
    loadPartnerCommunities(selectedPartnerId);
    loadPartnerGroups(selectedPartnerId);
    loadPartnerChannels(selectedPartnerId);
  }, [
    selectedPartnerId,
    loadPartnerDetail,
    loadPartnerCommunities,
    loadPartnerGroups,
    loadPartnerChannels,
    loadPartnerDiscordSummary,
  ]);

  const handlePartnerItemCreated = useCallback(
    (kind: 'group' | 'channel' | 'community', data: any) => {
      if (!data?.id) return;
      if (kind === 'group') {
        setPartnerGroups((prev) =>
          prev.some((g) => g.id === data.id) ? prev : [...prev, data as PartnerGroup],
        );
      } else if (kind === 'channel') {
        setPartnerChannels((prev) =>
          prev.some((c) => c.id === data.id) ? prev : [...prev, data as PartnerChannel],
        );
      } else if (kind === 'community') {
        setPartnerCommunities((prev) =>
          prev.some((c) => c.id === data.id) ? prev : [...prev, data as PartnerCommunity],
        );
      }
      // Tell the chats list (MessagesScreen) that new conversations exist
      DeviceEventEmitter.emit('conversation.refresh');
      if (selectedPartnerId) {
        loadPartnerGroups(selectedPartnerId);
        loadPartnerChannels(selectedPartnerId);
        loadPartnerCommunities(selectedPartnerId);
      }
    },
    [selectedPartnerId, loadPartnerGroups, loadPartnerChannels, loadPartnerCommunities],
  );

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
    partnersLoading,
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
    handlePartnerItemCreated,
    reloadPartners: loadPartners,
  };
};
