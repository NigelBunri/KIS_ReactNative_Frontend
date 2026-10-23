import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { KISIcon } from '@/constants/kisIcons';
import KISButton from '@/constants/KISButton';
import ChannelAvatar from '@/components/broadcast/ChannelAvatar';
import PermanentRemoteImage from '@/components/media/PermanentRemoteImage';
import { resolveBackendAssetUrl } from '@/network';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import type { RootStackParamList } from '@/navigation/types';
import type { BroadcastChannelContent, BroadcastChannelSummary } from '@/screens/broadcast/channels/api/channels.types';
import { createBroadcastChannel, fetchChannelContents, publishChannelContent, setChannelBroadcastState, setChannelContentBroadcastState, setChannelContentTags, setChannelContentVisibility, useChannelsData } from '@/screens/broadcast/channels/hooks/useChannelsData';
import ChannelPlaylistsManager from '@/screens/broadcast/channels/studio/ChannelPlaylistsManager';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { useAuth } from '../../../../../App';
import ChannelAnalyticsPanel from '@/screens/broadcast/channels/studio/ChannelAnalyticsPanel';
import ChannelBrandingEditor from '@/screens/broadcast/channels/studio/ChannelBrandingEditor';
import ChannelSettingsPanel, { ChannelManagersSection } from '@/screens/broadcast/channels/studio/ChannelSettingsPanel';
import ChannelContentManager from '@/screens/broadcast/channels/studio/ChannelContentManager';
import ChannelModerationPanel from '@/screens/broadcast/channels/studio/ChannelModerationPanel';
import LiveControlRoom from '@/screens/broadcast/channels/studio/LiveControlRoom';
import RevenueAnalyticsPanel from '@/screens/broadcast/channels/studio/RevenueAnalyticsPanel';
import AudienceDemographicsPanel from '@/screens/broadcast/channels/studio/AudienceDemographicsPanel';
import CopyrightClaimsPanel from '@/screens/broadcast/channels/studio/CopyrightClaimsPanel';
import AdCampaignPanel from '@/screens/broadcast/channels/studio/AdCampaignPanel';
import ImpressionsAnalyticsPanel from '@/screens/broadcast/channels/studio/ImpressionsAnalyticsPanel';
import TrafficSourcesPanel from '@/screens/broadcast/channels/studio/TrafficSourcesPanel';
import SubtitleEditorPanel from '@/screens/broadcast/channels/studio/SubtitleEditorPanel';
import ChapterEditorPanel from '@/screens/broadcast/channels/studio/ChapterEditorPanel';
import ProductTagStudio from '@/screens/broadcast/channels/studio/ProductTagStudio';
import EndScreenEditor from '@/screens/broadcast/channels/studio/EndScreenEditor';
import ContentCardsEditor from '@/screens/broadcast/channels/studio/ContentCardsEditor';
import ChannelHomepageShelfEditor from '@/screens/broadcast/channels/studio/ChannelHomepageShelfEditor';
import MonetizationPanel from '@/screens/broadcast/channels/studio/MonetizationPanel';
import MembershipTiersPanel from '@/screens/broadcast/channels/studio/MembershipTiersPanel';
import TrustPromotionRevenuePreviewCard from '@/components/profitability/TrustPromotionRevenuePreviewCard';
import NotificationRetentionPreviewCard from '@/components/profitability/NotificationRetentionPreviewCard';
import EnterpriseKcanRevenuePreviewCard from '@/components/profitability/EnterpriseKcanRevenuePreviewCard';

type StudioTab = 'dashboard' | 'content' | 'create' | 'branding' | 'playlists' | 'live' | 'analytics' | 'moderation' | 'revenue' | 'audience' | 'copyright' | 'ads' | 'impressions' | 'traffic' | 'subtitles' | 'chapters' | 'endscreens' | 'cards' | 'shelves' | 'products' | 'monetization' | 'membership' | 'settings';

type Props = {
  legacyFeeds: any[];
  liveCount: number;
  expiresAt: string;
  onCreate: (channel?: BroadcastChannelSummary | null) => void;
};

type ChannelOwnerType = 'user' | 'shop' | 'health' | 'education' | 'partner';

type ChannelForm = {
  displayName: string;
  handle: string;
  description: string;
  category: string;
  ownerType: ChannelOwnerType;
  ownerId: string;
};

const OWNER_TYPE_OPTIONS: { id: ChannelOwnerType; label: string }[] = [
  { id: 'user', label: 'Personal' },
  { id: 'shop', label: 'Shop' },
  { id: 'health', label: 'Health institution' },
  { id: 'education', label: 'Education institution' },
  { id: 'partner', label: 'Partner organization' },
];

const TABS: Array<{ id: StudioTab; label: string }> = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'content', label: 'Content' },
  { id: 'create', label: 'Create' },
  { id: 'branding', label: 'Branding' },
  { id: 'playlists', label: 'Playlists' },
  { id: 'live', label: 'Live' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'moderation', label: 'Moderation' },
  { id: 'revenue', label: 'Revenue' },
  { id: 'audience', label: 'Audience' },
  { id: 'copyright', label: 'Copyright' },
  { id: 'ads', label: 'Ads' },
  { id: 'impressions', label: 'Impressions' },
  { id: 'traffic', label: 'Traffic' },
  { id: 'subtitles', label: 'Subtitles' },
  { id: 'chapters', label: 'Chapters' },
  { id: 'endscreens', label: 'End Screens' },
  { id: 'cards', label: 'Cards' },
  { id: 'shelves', label: 'Shelves' },
  { id: 'products', label: 'Products' },
  { id: 'monetization', label: 'Monetization' },
  { id: 'membership', label: 'Membership' },
  { id: 'settings', label: 'Settings' },
];

// Groups the 20 studio tabs into 5 labeled categories so the tab strip
// shows ~4-5 items at a time instead of all 20 at once — the individual
// tab panels themselves are unchanged, only how many are visible in the
// strip simultaneously.
type StudioTabCategory = 'content' | 'live' | 'growth' | 'brand' | 'protect';

const TAB_CATEGORIES: Array<{ id: StudioTabCategory; label: string; tabs: StudioTab[] }> = [
  { id: 'content', label: 'Content', tabs: ['dashboard', 'content', 'create', 'playlists'] },
  { id: 'live', label: 'Live', tabs: ['live', 'analytics', 'traffic', 'impressions'] },
  { id: 'growth', label: 'Growth', tabs: ['audience', 'revenue', 'ads', 'shelves', 'cards', 'products', 'monetization', 'membership'] },
  { id: 'brand', label: 'Brand', tabs: ['branding', 'subtitles', 'chapters', 'endscreens'] },
  { id: 'protect', label: 'Protect', tabs: ['moderation', 'copyright', 'settings'] },
];

const categoryForTab = (tab: StudioTab): StudioTabCategory =>
  TAB_CATEGORIES.find(category => category.tabs.includes(tab))?.id ?? 'content';

// Getting-Started journey: the 22 tabs above have no inherent order, so a
// brand-new creator landing on Dashboard has no indication of what to do
// first. Three steps, matching what YouTube's own new-channel checklist
// covers (customize channel / upload something / turn on monetization) -
// "Go live" was considered but dropped: there's no live-streaming entry
// point reachable from within Channel Studio itself (it lives on the
// channel's own page, outside this component), so a step pointing nowhere
// real would be worse than not having it.
type JourneyStepId = 'branding' | 'first_post' | 'monetization';

const JOURNEY_STEPS: Array<{
  id: JourneyStepId;
  label: string;
  description: string;
  category: StudioTabCategory;
  tab: StudioTab;
}> = [
  {
    id: 'branding',
    label: 'Set up branding',
    description: 'Add a banner so viewers recognize your channel at a glance.',
    category: 'brand',
    tab: 'branding',
  },
  {
    id: 'first_post',
    label: 'Publish your first post',
    description: 'Share something so your channel has content to show.',
    category: 'content',
    tab: 'content',
  },
  {
    id: 'monetization',
    label: 'Set up monetization',
    description: 'Turn on tips, memberships, or ads for your channel.',
    category: 'growth',
    tab: 'monetization',
  },
];

const journeyStorageKey = (channelId: string) => `KIS_STUDIO_JOURNEY_${channelId}`;

const EMPTY_FORM: ChannelForm = {
  displayName: '',
  handle: '',
  description: '',
  category: '',
  ownerType: 'user',
  ownerId: '',
};

const normalizeHandle = (value: string) => value.toLowerCase().replace(/^@+/, '').replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

export default function ChannelStudioScreen({ legacyFeeds, liveCount, expiresAt, onCreate }: Props) {
  const { palette, tone } = useKISTheme();
  const responsive = useResponsiveLayout();
  const compact = responsive.isWatch || responsive.isCompactPhone;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  // Top-level flow: Overview (aggregate, channel-agnostic) -> Channel
  // Studio (pick which channel) -> channel detail (the full 22-tab studio
  // below, now reached as a drill-in rather than always showing whichever
  // channel happened to be first). "detail" hides the Overview/Channel
  // Studio tab bar in favor of a back button, matching a normal
  // push-navigation feel rather than three permanently-visible tab bars
  // stacked on top of each other.
  type StudioTopView = 'overview' | 'list' | 'detail';
  const [topView, setTopView] = useState<StudioTopView>('overview');
  const [activeTab, setActiveTab] = useState<StudioTab>('dashboard');
  const [activeCategory, setActiveCategory] = useState<StudioTabCategory>(categoryForTab('dashboard'));
  const [selectedContent, setSelectedContent] = useState<BroadcastChannelContent | null>(null);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [contents, setContents] = useState<BroadcastChannelContent[]>([]);
  const [loadingContent, setLoadingContent] = useState(false);
  const [createFormVisible, setCreateFormVisible] = useState(false);
  const [creatingChannel, setCreatingChannel] = useState(false);
  const [channelForm, setChannelForm] = useState<ChannelForm>(EMPTY_FORM);
  const [channelError, setChannelError] = useState<string | null>(null);
  const [lastCreatedHandle, setLastCreatedHandle] = useState<string | null>(null);
  const [channelBroadcasting, setChannelBroadcasting] = useState(false);
  const [contentBroadcastingId, setContentBroadcastingId] = useState<string | null>(null);
  const [contentPublishingId, setContentPublishingId] = useState<string | null>(null);
  const [contentMembersOnlyTogglingId, setContentMembersOnlyTogglingId] = useState<string | null>(null);
  const [monetizationVisited, setMonetizationVisited] = useState(false);
  const [journeyDismissed, setJourneyDismissed] = useState(false);
  const { channels, loading, refresh } = useChannelsData({ mine: true });

  useEffect(() => {
    if (!selectedChannelId && channels[0]?.id) setSelectedChannelId(channels[0].id);
  }, [channels, selectedChannelId]);

  // Loads this channel's journey progress (monetization tab visited,
  // banner dismissed) - persisted per-channel so switching between
  // channels or reopening the app doesn't lose it, but also doesn't carry
  // one channel's progress onto a different one.
  useEffect(() => {
    if (!selectedChannelId) return;
    let cancelled = false;
    AsyncStorage.getItem(journeyStorageKey(selectedChannelId))
      .then(raw => {
        if (cancelled || !raw) return;
        const parsed = JSON.parse(raw) as { monetizationVisited?: boolean; dismissed?: boolean };
        setMonetizationVisited(Boolean(parsed.monetizationVisited));
        setJourneyDismissed(Boolean(parsed.dismissed));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [selectedChannelId]);

  const persistJourneyState = useCallback((channelId: string, patch: { monetizationVisited?: boolean; dismissed?: boolean }) => {
    AsyncStorage.getItem(journeyStorageKey(channelId))
      .then(raw => {
        const parsed = raw ? JSON.parse(raw) : {};
        return AsyncStorage.setItem(journeyStorageKey(channelId), JSON.stringify({ ...parsed, ...patch }));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (activeTab === 'monetization' && selectedChannelId && !monetizationVisited) {
      setMonetizationVisited(true);
      persistJourneyState(selectedChannelId, { monetizationVisited: true });
    }
  }, [activeTab, selectedChannelId, monetizationVisited, persistJourneyState]);

  const selectedChannel = useMemo(
    () => channels.find(channel => channel.id === selectedChannelId) || channels[0] || null,
    [channels, selectedChannelId],
  );

  const journeyStepComplete = useMemo((): Record<JourneyStepId, boolean> => ({
    branding: Boolean(selectedChannel?.banner_url),
    first_post: contents.length > 0,
    monetization: monetizationVisited,
  }), [selectedChannel?.banner_url, contents.length, monetizationVisited]);

  const journeyAllComplete = JOURNEY_STEPS.every(step => journeyStepComplete[step.id]);
  const journeyNextStepIndex = JOURNEY_STEPS.findIndex(step => !journeyStepComplete[step.id]);
  const showJourney = Boolean(selectedChannel) && !journeyAllComplete && !journeyDismissed;

  const handleDismissJourney = useCallback(() => {
    setJourneyDismissed(true);
    if (selectedChannelId) persistJourneyState(selectedChannelId, { dismissed: true });
  }, [selectedChannelId, persistJourneyState]);

  const handleJourneyStepPress = useCallback((step: typeof JOURNEY_STEPS[number]) => {
    setActiveCategory(step.category);
    setActiveTab(step.tab);
  }, []);

  const handleOpenChannelDetail = useCallback((channelId: string, landingTab: StudioTab = 'dashboard') => {
    setSelectedChannelId(channelId);
    // Reset to a clean landing tab each time a channel is opened, rather
    // than leaving whichever tab a previous channel happened to be on -
    // defaults to Dashboard, but the card's Edit button jumps straight to
    // Branding instead, since that's specifically what it's for.
    setActiveCategory(categoryForTab(landingTab));
    setActiveTab(landingTab);
    // The create-channel form lives inside the list view - closing it on
    // navigation avoids it reappearing (stale open state) if it was left
    // open when a channel card was tapped.
    setCreateFormVisible(false);
    setTopView('detail');
  }, []);

  const handleBackToChannelList = useCallback(() => {
    setTopView('list');
  }, []);

  const aggregateStats = useMemo(() => ({
    channelCount: channels.length,
    totalSubscribers: channels.reduce((sum, channel) => sum + (channel.subscriber_count || 0), 0),
    totalContent: channels.reduce((sum, channel) => sum + (channel.content_count || 0), 0),
    liveCount: channels.filter(channel => channel.is_broadcast).length,
  }), [channels]);

  const createLabel = selectedChannel?.handle ? `Create in @${selectedChannel.handle}` : 'Create feed/content';
  const channelUsageText = channels.length
    ? `${channels.length} channel${channels.length === 1 ? '' : 's'} created. Free creator mode is designed around 1 channel; Creator Pro will expand this when pricing is approved.`
    : 'Create your first free channel. Creator Pro/Growth previews below are not live charges.';

  const updateChannelForm = useCallback((field: keyof ChannelForm, value: string) => {
    setChannelError(null);
    setChannelForm(prev => {
      if (field === 'displayName' && !prev.handle.trim()) {
        return { ...prev, displayName: value, handle: normalizeHandle(value) };
      }
      if (field === 'handle') return { ...prev, handle: normalizeHandle(value) };
      return { ...prev, [field]: value };
    });
  }, []);

  const [ownerOptions, setOwnerOptions] = useState<{ id: string; name: string }[]>([]);
  const [ownerOptionsLoading, setOwnerOptionsLoading] = useState(false);

  const loadOwnerOptions = useCallback(async (ownerType: ChannelOwnerType) => {
    if (ownerType === 'user') {
      setOwnerOptions([]);
      return;
    }
    setOwnerOptionsLoading(true);
    setOwnerOptions([]);
    try {
      if (ownerType === 'shop') {
        const response = await getRequest(ROUTES.commerce.shops, { errorMessage: '' });
        const rows = (response as any)?.data?.results ?? (response as any)?.data ?? [];
        const list = Array.isArray(rows) ? rows : [];
        setOwnerOptions(
          list
            .filter((shop: any) => String(shop?.owner) === String(user?.id))
            .map((shop: any) => ({ id: String(shop.id), name: String(shop.name || 'Shop') })),
        );
      } else if (ownerType === 'health') {
        const response = await getRequest(ROUTES.healthOps.institutions, { errorMessage: '' });
        const rows = (response as any)?.data?.results ?? (response as any)?.data ?? [];
        const list = Array.isArray(rows) ? rows : [];
        setOwnerOptions(
          list
            .filter((institution: any) => institution?.can_manage)
            .map((institution: any) => ({ id: String(institution.id), name: String(institution.name || 'Institution') })),
        );
      } else if (ownerType === 'education') {
        const response = await getRequest(ROUTES.broadcasts.educationHub, { errorMessage: '' });
        const list = (response as any)?.data?.institutions ?? [];
        setOwnerOptions(
          (Array.isArray(list) ? list : [])
            .filter((institution: any) => institution?.can_manage)
            .map((institution: any) => ({ id: String(institution.id), name: String(institution.name || 'Institution') })),
        );
      } else if (ownerType === 'partner') {
        const response = await getRequest(ROUTES.partners.list, { errorMessage: '' });
        const rows = (response as any)?.data?.results ?? (response as any)?.data ?? [];
        const list = Array.isArray(rows) ? rows : [];
        setOwnerOptions(
          list
            .filter((partner: any) => partner?.can_manage)
            .map((partner: any) => ({ id: String(partner.id), name: String(partner.name || 'Partner') })),
        );
      }
    } finally {
      setOwnerOptionsLoading(false);
    }
  }, [user?.id]);

  const handleSelectOwnerType = useCallback((ownerType: ChannelOwnerType) => {
    setChannelError(null);
    setChannelForm(prev => ({ ...prev, ownerType, ownerId: '' }));
    void loadOwnerOptions(ownerType);
  }, [loadOwnerOptions]);

  const handleCreateChannel = useCallback(async () => {
    const displayName = channelForm.displayName.trim();
    const handle = normalizeHandle(channelForm.handle || displayName);
    if (!displayName) {
      setChannelError('Add a channel name before creating.');
      return;
    }
    if (!handle) {
      setChannelError('Add a public handle using letters or numbers.');
      return;
    }
    if (channelForm.ownerType !== 'user' && !channelForm.ownerId) {
      setChannelError('Choose which shop, institution, or partner this channel belongs to.');
      return;
    }
    setCreatingChannel(true);
    setChannelError(null);
    try {
      const created = await createBroadcastChannel({
        owner_type: channelForm.ownerType,
        owner_id: channelForm.ownerType !== 'user' ? channelForm.ownerId : undefined,
        display_name: displayName,
        handle,
        description: channelForm.description.trim(),
        category: channelForm.category.trim(),
        is_public: true,
      });
      setSelectedChannelId(created.id);
      setLastCreatedHandle(created.handle || created.display_name || 'channel');
      setChannelForm(EMPTY_FORM);
      await refresh();
    } catch (err: any) {
      const raw = String(err?.message || '');
      const isHandleTaken =
        raw.toLowerCase().includes('handle') ||
        raw.toLowerCase().includes('already') ||
        raw.toLowerCase().includes('unique') ||
        raw.toLowerCase().includes('exists');
      const isThrottle =
        raw.toLowerCase().includes('throttl') ||
        raw.toLowerCase().includes('too many') ||
        raw.toLowerCase().includes('requests');
      if (isHandleTaken) {
        setChannelError('That handle is already taken. Try a different one.');
      } else if (isThrottle) {
        setChannelError(`Too many requests. Wait a moment and try again.${raw.includes('Try again') ? ' ' + raw.split('Try again')[1] : ''}`);
      } else {
        setChannelError(raw || 'Unable to create this channel.');
      }
    } finally {
      setCreatingChannel(false);
    }
  }, [channelForm, refresh]);

  const refreshContent = useCallback(async () => {
    if (!selectedChannel?.id) return;
    setLoadingContent(true);
    try {
      // Playlists own their own fetch now (ChannelPlaylistsManager) - this
      // only ever feeds the Content tab/dashboard's content list.
      const contentRows = await fetchChannelContents(selectedChannel.id, { limit: 20 });
      setContents(contentRows.contents);
    } finally {
      setLoadingContent(false);
    }
  }, [selectedChannel?.id]);

  useEffect(() => {
    void refreshContent();
  }, [refreshContent]);

  useEffect(() => {
    if (!selectedContent && contents.length > 0) {
      setSelectedContent(contents[0] ?? null);
    }
  }, [contents, selectedContent]);

  const handleToggleChannelBroadcast = useCallback(async () => {
    if (!selectedChannel?.id || channelBroadcasting) return;
    setChannelBroadcasting(true);
    try {
      await setChannelBroadcastState(selectedChannel.id, !selectedChannel.is_broadcast);
      await refresh();
    } finally {
      setChannelBroadcasting(false);
    }
  }, [channelBroadcasting, refresh, selectedChannel?.id, selectedChannel?.is_broadcast]);

  // Turning broadcast ON is low-stakes (nothing changes for existing
  // subscribers until there's something to see), but turning it OFF
  // immediately hides the channel and all of its public content from
  // subscribers — a channel-wide, high-visibility action with no prior
  // confirmation. Gate only the "stop broadcasting" direction, matching
  // the confirm-only-on-destructive pattern used for "End stream" in
  // LiveControlRoom and "Remove" in ChannelModerationPanel.
  const confirmToggleChannelBroadcast = useCallback(() => {
    if (!selectedChannel) return;
    if (!selectedChannel.is_broadcast) {
      void handleToggleChannelBroadcast();
      return;
    }
    Alert.alert(
      'Stop broadcasting this channel?',
      'Your channel and its public content will be hidden from subscribers until you broadcast again.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Stop broadcasting', style: 'destructive', onPress: () => void handleToggleChannelBroadcast() },
      ],
    );
  }, [selectedChannel, handleToggleChannelBroadcast]);

  const handleToggleContentBroadcast = useCallback(async (content: BroadcastChannelContent, nextState: boolean) => {
    if (!content?.id) return;
    setContentBroadcastingId(content.id);
    try {
      await setChannelContentBroadcastState(content.id, nextState);
      await refreshContent();
    } finally {
      setContentBroadcastingId(null);
    }
  }, [refreshContent]);

  const handleUpdateContentTags = useCallback(async (contentId: string, tags: string[]) => {
    if (!contentId) return;
    await setChannelContentTags(contentId, tags);
  }, []);

  const handlePublishContent = useCallback(async (content: BroadcastChannelContent) => {
    if (!content?.id) return;
    setContentPublishingId(content.id);
    try {
      const published = await publishChannelContent(content.id);
      if (!published) {
        Alert.alert('Unable to publish', 'Please try again.');
        return;
      }
      await refreshContent();
    } finally {
      setContentPublishingId(null);
    }
  }, [refreshContent]);

  const handleToggleContentMembersOnly = useCallback(async (content: BroadcastChannelContent, nextMembersOnly: boolean) => {
    if (!content?.id) return;
    setContentMembersOnlyTogglingId(content.id);
    try {
      const updated = await setChannelContentVisibility(content.id, nextMembersOnly ? 'members_only' : 'public');
      if (!updated) {
        Alert.alert('Unable to update visibility', 'Please try again.');
        return;
      }
      await refreshContent();
    } finally {
      setContentMembersOnlyTogglingId(null);
    }
  }, [refreshContent]);

  const renderCreateChannelForm = () => (
    <View style={[styles.createCard, { borderColor: palette.border, backgroundColor: palette.surface }]}>
      {lastCreatedHandle ? (
        <View style={[styles.successBanner, { backgroundColor: `${palette.success}26`, borderColor: palette.success }]}>
          <KISIcon name="check" size={16} color={palette.success} />
          <Text style={[styles.successText, { color: palette.success, flex: 1 }]}>
            @{lastCreatedHandle} created! Fill in the form below to add another channel.
          </Text>
          <KISButton
            variant="ghost"
            onPress={() => { setCreateFormVisible(false); setLastCreatedHandle(null); }}
            style={styles.smallIconButton}
            accessibilityLabel="Dismiss channel created notice"
          >
            <KISIcon name="close" size={16} color={palette.subtext} />
          </KISButton>
        </View>
      ) : null}
      <View style={styles.formHeaderRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>{lastCreatedHandle ? 'Add another channel' : 'Create a channel'}</Text>
          <Text style={[styles.sectionText, { color: palette.subtext }]}>Feeds, videos, lives, playlists, and embeds will live under this channel.</Text>
        </View>
        {channels.length || lastCreatedHandle ? (
          <KISButton
            variant="ghost"
            onPress={() => { setCreateFormVisible(false); setLastCreatedHandle(null); }}
            style={styles.smallIconButton}
            accessibilityLabel="Close create channel form"
          >
            <KISIcon name="close" size={18} color={palette.subtext} />
          </KISButton>
        ) : null}
      </View>
      <Text style={[styles.sectionText, { color: palette.subtext, marginTop: 4 }]}>
        Who owns this channel?
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6, marginBottom: 4 }}>
        {OWNER_TYPE_OPTIONS.map(option => (
          <KISButton
            key={option.id}
            title={option.label}
            size="xs"
            variant={channelForm.ownerType === option.id ? 'primary' : 'outline'}
            onPress={() => handleSelectOwnerType(option.id)}
          />
        ))}
      </View>
      {channelForm.ownerType !== 'user' ? (
        ownerOptionsLoading ? (
          <Text style={[styles.sectionText, { color: palette.subtext, marginBottom: 8 }]}>
            Loading your options…
          </Text>
        ) : ownerOptions.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
            {ownerOptions.map(option => (
              <KISButton
                key={option.id}
                title={option.name}
                size="xs"
                variant={channelForm.ownerId === option.id ? 'primary' : 'outline'}
                onPress={() => setChannelForm(prev => ({ ...prev, ownerId: option.id }))}
              />
            ))}
          </View>
        ) : (
          <Text style={[styles.sectionText, { color: palette.subtext, marginBottom: 8 }]}>
            You don't manage any of these yet.
          </Text>
        )
      ) : null}
      <TextInput
        value={channelForm.displayName}
        onChangeText={text => updateChannelForm('displayName', text)}
        placeholder="Channel name"
        placeholderTextColor={palette.subtext}
        style={[styles.input, { color: palette.text, borderColor: palette.border, backgroundColor: palette.card }]}
      />
      <TextInput
        value={channelForm.handle ? `@${channelForm.handle}` : ''}
        onChangeText={text => updateChannelForm('handle', text)}
        autoCapitalize="none"
        placeholder="@channel-handle"
        placeholderTextColor={palette.subtext}
        style={[styles.input, { color: palette.text, borderColor: palette.border, backgroundColor: palette.card }]}
      />
      <TextInput
        value={channelForm.description}
        onChangeText={text => updateChannelForm('description', text)}
        placeholder="What this channel is about"
        placeholderTextColor={palette.subtext}
        multiline
        style={[styles.input, styles.textarea, { color: palette.text, borderColor: palette.border, backgroundColor: palette.card }]}
      />
      <TextInput
        value={channelForm.category}
        onChangeText={text => updateChannelForm('category', text)}
        placeholder="Category, e.g. education, market, health"
        placeholderTextColor={palette.subtext}
        style={[styles.input, { color: palette.text, borderColor: palette.border, backgroundColor: palette.card }]}
      />
      {channelError ? <Text style={[styles.errorText, { color: palette.danger }]}>{channelError}</Text> : null}
      <KISButton
        title={creatingChannel ? 'Creating...' : 'Create Channel'}
        onPress={handleCreateChannel}
        disabled={creatingChannel}
        loading={creatingChannel}
        left={!creatingChannel ? <KISIcon name="add" size={17} color={palette.onPrimary} /> : undefined}
      />
    </View>
  );

  // Channel-agnostic hub: aggregate numbers across every channel the
  // creator owns, plus the premium-feature preview that previously sat
  // inside the per-channel Dashboard tab (it was never actually
  // channel-specific content, just always rendered there by default).
  // Each tile is now a real navigation shortcut, not a static number - the
  // whole point of an "overview" is to jump straight into whatever the
  // number is about, not just display it.
  const renderOverview = () => {
    const openFirstChannel = (landingTab: StudioTab) => {
      if (!channels.length) {
        setTopView('list');
        return;
      }
      handleOpenChannelDetail(channels[0].id, landingTab);
    };
    return (
    <>
      {loading && !channels.length ? (
        <View style={styles.loadingRow}><ActivityIndicator color={palette.primaryStrong} /><Text style={[styles.loadingText, { color: palette.subtext }]}>Loading your channels</Text></View>
      ) : (
        <View style={styles.studioMetrics}>
          <Pressable
            onPress={() => setTopView('list')}
            style={[styles.metricTile, { borderColor: palette.goldMuted ?? palette.border, backgroundColor: tone === 'dark' ? palette.primarySoft : palette.surface }]}
            accessibilityRole="button"
            accessibilityLabel={`${aggregateStats.channelCount} channels - go to Channel Studio`}
          >
            <Text style={[styles.metricValue, { color: palette.text }]}>{aggregateStats.channelCount}</Text>
            <Text style={[styles.metricLabel, { color: palette.subtext }]}>Channels</Text>
          </Pressable>
          <Pressable
            onPress={() => openFirstChannel('audience')}
            style={[styles.metricTile, { borderColor: palette.goldMuted ?? palette.border, backgroundColor: tone === 'dark' ? palette.primarySoft : palette.surface }]}
            accessibilityRole="button"
            accessibilityLabel={`${aggregateStats.totalSubscribers} total subscribers - view audience`}
          >
            <Text style={[styles.metricValue, { color: palette.text }]}>{aggregateStats.totalSubscribers}</Text>
            <Text style={[styles.metricLabel, { color: palette.subtext }]}>Total subscribers</Text>
          </Pressable>
          <Pressable
            onPress={() => openFirstChannel('content')}
            style={[styles.metricTile, { borderColor: palette.goldMuted ?? palette.border, backgroundColor: tone === 'dark' ? palette.primarySoft : palette.surface }]}
            accessibilityRole="button"
            accessibilityLabel={`${aggregateStats.totalContent} published items - view content`}
          >
            <Text style={[styles.metricValue, { color: palette.text }]}>{aggregateStats.totalContent}</Text>
            <Text style={[styles.metricLabel, { color: palette.subtext }]}>Published items</Text>
          </Pressable>
          {aggregateStats.liveCount > 0 ? (
            <Pressable
              onPress={() => openFirstChannel('live')}
              style={[styles.metricTile, { borderColor: palette.goldMuted ?? palette.border, backgroundColor: tone === 'dark' ? palette.primarySoft : palette.surface }]}
              accessibilityRole="button"
              accessibilityLabel={`${aggregateStats.liveCount} live now - view live control room`}
            >
              <Text style={[styles.metricValue, { color: palette.text }]}>{aggregateStats.liveCount}</Text>
              <Text style={[styles.metricLabel, { color: palette.subtext }]}>Live now</Text>
            </Pressable>
          ) : null}
        </View>
      )}

      {/* The one thing most people open this screen to do - previously
          buried several taps deep (Overview -> Channel Studio -> pick a
          channel -> Content category -> Create tab), with no shortcut
          here at all. */}
      <KISButton
        title="Create content"
        onPress={() => onCreate(channels[0] ?? null)}
        left={<KISIcon name="add" size={17} color={palette.onPrimary} />}
        style={{ marginTop: 14 }}
      />
      <KISButton
        title="Go to Channel Studio"
        variant="outline"
        onPress={() => setTopView('list')}
        left={<KISIcon name="sub-channel" size={16} color={palette.primaryStrong} />}
        style={{ marginTop: 8 }}
      />

      {/* Previously a full plan-card + 7-feature-card wall every time this
          screen loaded, with nothing on it a user could act on besides a
          single button at the very bottom - all the weight, none of the
          interaction. Condensed to one line + one button; the full
          feature breakdown still lives in the contexts where someone is
          actually about to hit the specific limit it explains (Create,
          Live, Analytics, Settings). */}
      <Pressable
        onPress={() => navigation.navigate('MainTabs')}
        style={[styles.upsellBanner, { borderColor: palette.goldMuted ?? palette.border, backgroundColor: tone === 'dark' ? palette.primarySoft : palette.surface }]}
        accessibilityRole="button"
        accessibilityLabel="See what Creator Pro and Growth offer"
      >
        <View style={[styles.premiumIcon, { backgroundColor: palette.primarySoft }]}>
          <KISIcon name="star" size={16} color={palette.primaryStrong} />
        </View>
        <Text style={[styles.upsellBannerText, { color: palette.text }]}>More channels, scheduling, and advanced analytics are available on Creator Pro and Growth.</Text>
        <KISIcon name="chevron-right" size={16} color={palette.subtext} />
      </Pressable>
    </>
    );
  };

  // The channel picker: every channel as a tappable card (avatar, name,
  // handle, subscribers, LIVE badge) rather than the small horizontal
  // pills this replaced - tapping one drills into its full studio
  // (renderBody/the category+tab system below) via handleOpenChannelDetail.
  const renderChannelList = () => (
    <>
      {createFormVisible ? renderCreateChannelForm() : null}
      {loading && !channels.length ? (
        <View style={styles.loadingRow}><ActivityIndicator color={palette.primaryStrong} /><Text style={[styles.loadingText, { color: palette.subtext }]}>Loading your channels</Text></View>
      ) : channels.length ? (
        <View style={styles.channelCardList}>
          {channels.map(channel => (
            <Pressable
              key={channel.id}
              onPress={() => handleOpenChannelDetail(channel.id)}
              style={({ pressed }) => [
                styles.channelCard,
                { borderColor: palette.border, backgroundColor: palette.surface },
                pressed && { opacity: 0.85 },
              ]}
            >
              {/* Cover image - every channel always shows something here
                  too: a real banner when set, otherwise a flat brand-color
                  fill, so the card never has a blank gap up top. */}
              {channel.banner_url ? (
                <PermanentRemoteImage
                  uri={resolveBackendAssetUrl(channel.banner_url)}
                  domain="Broadcast"
                  stableKey={`channel_banner_${channel.id}`}
                  containerStyle={styles.channelCardBanner}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.channelCardBanner, { backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={[styles.channelCardNudge, { color: palette.primaryStrong, marginTop: 0 }]}>No cover image yet</Text>
                </View>
              )}
              {/* Jumps straight to the Branding tab rather than the card's
                  own onPress (which lands on Dashboard) - a nested
                  Pressable is its own touch responder in RN, so this
                  doesn't also trigger the outer card's onPress. */}
              <Pressable
                onPress={() => handleOpenChannelDetail(channel.id, 'branding')}
                style={({ pressed }) => [styles.channelCardEditButton, { backgroundColor: palette.card }, pressed && { opacity: 0.7 }]}
                accessibilityLabel={`Edit ${channel.display_name}'s branding`}
              >
                <KISIcon name="edit" size={14} color={palette.primaryStrong} />
              </Pressable>
              <View style={styles.channelCardRow}>
                <ChannelAvatar channel={channel} size={52} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.channelCardName, { color: palette.text }]} numberOfLines={1}>
                    {channel.display_name}{channel.is_broadcast ? ' · LIVE' : ''}
                  </Text>
                  <Text style={[styles.channelCardHandle, { color: palette.subtext }]} numberOfLines={1}>
                    @{channel.handle} · {channel.subscriber_count || 0} subscribers
                  </Text>
                  {channel.description ? (
                    <Text style={[styles.channelCardDescription, { color: palette.subtext }]} numberOfLines={2}>
                      {channel.description}
                    </Text>
                  ) : null}
                  {channel.avatar_kind === 'initials' ? (
                    <Text style={[styles.channelCardNudge, { color: palette.primaryStrong }]}>Add a logo for this channel →</Text>
                  ) : null}
                </View>
                <KISIcon name="chevron-right" size={18} color={palette.subtext} />
              </View>
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={[styles.emptyChannel, { borderColor: palette.border, backgroundColor: palette.surface }]}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>No channels yet</Text>
          <Text style={[styles.sectionText, { color: palette.subtext }]}>{channelUsageText}</Text>
        </View>
      )}
      <KISButton title="+ New Channel" size="sm" variant="outline" onPress={() => setCreateFormVisible(true)} style={{ marginTop: 10 }} />
    </>
  );

  const renderBody = () => {
    if (loading && !selectedChannel) {
      return <View style={styles.loadingRow}><ActivityIndicator color={palette.primaryStrong} /><Text style={[styles.loadingText, { color: palette.subtext }]}>Loading channels</Text></View>;
    }
    if (!selectedChannel) {
      return (
        <View style={[styles.emptyChannel, { borderColor: palette.border, backgroundColor: palette.surface }]}> 
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Start with your first channel</Text>
          <Text style={[styles.sectionText, { color: palette.subtext }]}>Create a channel before publishing feed content. This keeps every post, video, live, playlist, and embed organized under a creator identity.</Text>
          {createFormVisible ? renderCreateChannelForm() : (
            <KISButton
              title="Create Channel"
              onPress={() => setCreateFormVisible(true)}
              left={<KISIcon name="add" size={17} color={palette.onPrimary} />}
            />
          )}
        </View>
      );
    }
    if (activeTab === 'branding') {
      return (
        <>
          <ChannelBrandingEditor channel={selectedChannel} onUpdated={refresh} />
          <KISButton
            title="Manage landing page"
            onPress={() =>
              navigation.navigate('WebsiteBuilder', {
                ownerType: 'broadcast_channel',
                ownerId: selectedChannel.id,
                ownerLabel: selectedChannel.display_name || 'Channel',
              })
            }
          />
        </>
      );
    }
    if (activeTab === 'analytics') return <ChannelAnalyticsPanel channelId={selectedChannel.id} queued={legacyFeeds.length} live={liveCount} subscribers={selectedChannel.subscriber_count} />;
    if (activeTab === 'content') return <ChannelContentManager contents={contents} legacyFeeds={legacyFeeds} onCreate={() => onCreate(selectedChannel)} onToggleBroadcast={handleToggleContentBroadcast} broadcastingId={contentBroadcastingId} onUpdateTags={handleUpdateContentTags} onPublish={handlePublishContent} publishingId={contentPublishingId} onToggleMembersOnly={handleToggleContentMembersOnly} togglingMembersOnlyId={contentMembersOnlyTogglingId} />;
    if (activeTab === 'moderation') return <ChannelModerationPanel channelId={selectedChannel.id} />;
    if (activeTab === 'create') {
      return (
        <View style={[styles.emptyChannel, { borderColor: palette.border, backgroundColor: palette.surface }]}> 
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Create for @{selectedChannel.handle}</Text>
          <Text style={[styles.sectionText, { color: palette.subtext }]}>The advanced composer will save this feed inside the selected channel and still preserve the old profile feed queue for compatibility.</Text>
          <KISButton
            title={createLabel}
            onPress={() => onCreate(selectedChannel)}
            left={<KISIcon name="add" size={17} color={palette.onPrimary} />}
          />
        </View>
      );
    }
    if (activeTab === 'playlists') return <ChannelPlaylistsManager channelId={selectedChannel.id} />;
    // Core live-stream management - scheduling, going live, the control
    // room, chat/moderation - is ordinary creator functionality, not a
    // paid-tier feature (matches every free-tier live offering this is
    // benchmarked against). It used to be flatly blocked below Partner
    // tier. Whether a stream can actually go live is a server-side,
    // infra-readiness concern (the configured live provider), surfaced by
    // LiveControlRoom's own error handling when that call is made - not
    // something this screen should guess at or pre-emptively paywall.
    if (activeTab === 'live') return <LiveControlRoom channel={selectedChannel} onOpenWatch={stream => navigation.navigate('LiveWatch', { streamId: stream.id, stream })} />;
    if (activeTab === 'revenue') return <RevenueAnalyticsPanel channelId={selectedChannel.id} />;
    if (activeTab === 'audience') return <AudienceDemographicsPanel channelId={selectedChannel.id} />;
    if (activeTab === 'copyright') return <CopyrightClaimsPanel channelId={selectedChannel.id} />;
    if (activeTab === 'ads') return <AdCampaignPanel channelId={selectedChannel.id} />;
    if (activeTab === 'impressions') return <ImpressionsAnalyticsPanel channelId={selectedChannel.id} />;
    if (activeTab === 'traffic') return <TrafficSourcesPanel channelId={selectedChannel.id} />;
    if (activeTab === 'subtitles') return <SubtitleEditorPanel contentId={selectedContent?.id ?? ''} />;
    if (activeTab === 'chapters') return <ChapterEditorPanel contentId={selectedContent?.id ?? ''} />;
    if (activeTab === 'endscreens') return <EndScreenEditor contentId={selectedContent?.id ?? ''} />;
    if (activeTab === 'cards') return <ContentCardsEditor contentId={selectedContent?.id ?? ''} />;
    // AND-169: ProductTagStudio was a fully built panel (API calls,
    // product search/create, timestamp picker) with no entry point
    // anywhere in the app at all - never imported, never rendered, not
    // even registered as a navigable screen. Wired in the same way every
    // other per-content studio panel already is (chapters/cards/
    // endscreens/subtitles all key off selectedContent?.id the same way).
    if (activeTab === 'products') return <ProductTagStudio contentId={selectedContent?.id ?? ''} />;
    if (activeTab === 'shelves') return <ChannelHomepageShelfEditor channelId={selectedChannel.id} />;
    if (activeTab === 'monetization') return <MonetizationPanel channelId={selectedChannel.id} />;
    if (activeTab === 'membership') return <MembershipTiersPanel channelId={selectedChannel.id} />;
    if (activeTab === 'settings') {
      return (
        <>
          <ChannelSettingsPanel channel={selectedChannel} onUpdated={refresh} />
          <ChannelManagersSection channel={selectedChannel} />
        </>
      );
    }
    return (
      <>
        <TrustPromotionRevenuePreviewCard
          palette={palette}
          kind="channel_trust"
          title="Channel trust and promotion preview"
          subtitle="Creator verification, badge renewal, trust boosts, sponsored labels, and campaign review states are not live yet."
        />
        <NotificationRetentionPreviewCard
          palette={palette}
          kind="channels"
          title="Channel retention preview"
          subtitle="Subscriber digests, priority alerts, saved-content nudges, and retention analytics are visible but not live."
        />
        <EnterpriseKcanRevenuePreviewCard
          palette={palette}
          kind="channels"
          title="Channel network enterprise preview"
          subtitle="Creator, ministry, education, and institution media networks are packaged for future annual contracts only."
        />
        <ChannelAnalyticsPanel channelId={selectedChannel.id} queued={legacyFeeds.length} live={liveCount} subscribers={selectedChannel.subscriber_count} />
        <ChannelContentManager contents={contents.slice(0, 4)} legacyFeeds={legacyFeeds.slice(0, 4)} onCreate={() => onCreate(selectedChannel)} onToggleBroadcast={handleToggleContentBroadcast} broadcastingId={contentBroadcastingId} onUpdateTags={handleUpdateContentTags} onPublish={handlePublishContent} publishingId={contentPublishingId} onToggleMembersOnly={handleToggleContentMembersOnly} togglingMembersOnlyId={contentMembersOnlyTogglingId} />
        {loadingContent ? <ActivityIndicator color={palette.primaryStrong} /> : null}
      </>
    );
  };

  if (topView !== 'detail') {
    return (
      <View style={[styles.shell, { backgroundColor: palette.card, borderColor: palette.border, padding: compact ? 11 : 16 }]}>
        <View style={[styles.headerRow, compact && { alignItems: 'flex-start' }]}>
          <View style={[styles.logo, { backgroundColor: palette.primarySoft, borderColor: palette.gold, width: compact ? 40 : 48, height: compact ? 40 : 48 }]}>
            <KISIcon name="sub-channel" size={22} color={palette.primaryStrong} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.eyebrow, { color: palette.primaryStrong }]}>
              {topView === 'overview' ? 'CREATOR TOOLS' : 'CHANNEL STUDIO'}
            </Text>
            <Text style={[styles.title, { color: palette.text, fontSize: compact ? 18 : 22, lineHeight: compact ? 23 : 27 }]} numberOfLines={2}>
              {topView === 'overview' ? 'Overview' : 'Channel Studio'}
            </Text>
            <Text style={[styles.subtitle, { color: palette.subtext }]} numberOfLines={compact ? 2 : 1}>
              {topView === 'overview' ? 'Everything across your channels, at a glance.' : 'Pick a channel to manage its content, branding, and more.'}
            </Text>
          </View>
        </View>
        <View style={styles.topTabBar}>
          <KISButton title="Overview" size="sm" variant={topView === 'overview' ? 'primary' : 'outline'} onPress={() => setTopView('overview')} style={{ flex: 1 }} />
          <KISButton title="Channel Studio" size="sm" variant={topView === 'list' ? 'primary' : 'outline'} onPress={() => setTopView('list')} style={{ flex: 1 }} />
        </View>
        {topView === 'overview' ? renderOverview() : renderChannelList()}
      </View>
    );
  }

  return (
    <View style={[styles.shell, { backgroundColor: palette.card, borderColor: palette.border, padding: compact ? 11 : 16 }]}>
      <KISButton title="← All channels" size="xs" variant="ghost" onPress={handleBackToChannelList} style={styles.backButton} />
      <View style={[styles.headerRow, compact && { alignItems: 'flex-start' }]}>
        <View style={[styles.logo, { backgroundColor: palette.primarySoft, borderColor: palette.gold, width: compact ? 40 : 48, height: compact ? 40 : 48 }]}>
          <KISIcon name="sub-channel" size={22} color={palette.primaryStrong} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.eyebrow, { color: palette.primaryStrong }]}>CHANNEL STUDIO</Text>
          <Text style={[styles.title, { color: palette.text, fontSize: compact ? 18 : 22, lineHeight: compact ? 23 : 27 }]} numberOfLines={2}>{selectedChannel?.display_name || 'Creator workspace'}</Text>
          <Text style={[styles.subtitle, { color: palette.subtext }]} numberOfLines={compact ? 2 : 1}>{selectedChannel ? `@${selectedChannel.handle} · ${expiresAt} cycle` : 'Create a channel to start publishing channel-scoped feeds.'}</Text>
        </View>
        {selectedChannel ? (
          <View style={[styles.headerActions, compact && { width: '100%', justifyContent: 'flex-start' }]}>
            <KISButton
              title={compact ? (selectedChannel.is_broadcast ? 'Stop broadcast' : 'Broadcast') : (selectedChannel.is_broadcast ? 'Stop broadcasting channel' : 'Broadcast channel')}
              variant={selectedChannel.is_broadcast ? 'danger' : 'outline'}
              onPress={confirmToggleChannelBroadcast}
              disabled={channelBroadcasting}
              loading={channelBroadcasting}
            />
            <KISButton
              title={compact ? 'Create' : createLabel}
              onPress={() => onCreate(selectedChannel)}
              left={<KISIcon name="add" size={16} color={palette.onPrimary} />}
            />
          </View>
        ) : null}
      </View>
      {selectedChannel ? (
        <View style={styles.studioMetrics}>
          <View style={[styles.metricTile, { borderColor: palette.goldMuted ?? palette.border, backgroundColor: tone === 'dark' ? palette.primarySoft : palette.surface }]}>
            <Text style={[styles.metricValue, { color: palette.text }]}>{contents.length}</Text>
            <Text style={[styles.metricLabel, { color: palette.subtext }]}>Studio items</Text>
          </View>
          <View style={[styles.metricTile, { borderColor: palette.goldMuted ?? palette.border, backgroundColor: tone === 'dark' ? palette.primarySoft : palette.surface }]}>
            <Text style={[styles.metricValue, { color: palette.text }]}>{selectedChannel.is_broadcast ? 'Live' : 'Private'}</Text>
            <Text style={[styles.metricLabel, { color: palette.subtext }]}>Broadcast state</Text>
          </View>
          <View style={[styles.metricTile, { borderColor: palette.goldMuted ?? palette.border, backgroundColor: tone === 'dark' ? palette.primarySoft : palette.surface }]}>
            <Text style={[styles.metricValue, { color: palette.text }]}>{selectedChannel.subscriber_count || 0}</Text>
            <Text style={[styles.metricLabel, { color: palette.subtext }]}>Subscribers</Text>
          </View>
        </View>
      ) : null}
      {showJourney ? (
        <View style={[styles.journeyCard, { borderColor: palette.goldMuted ?? palette.border, backgroundColor: tone === 'dark' ? palette.primarySoft : palette.surface }]}>
          <View style={styles.journeyHeaderRow}>
            <Text style={[styles.journeyTitle, { color: palette.text }]}>Get your channel ready</Text>
            <KISButton title="Dismiss" size="xs" variant="ghost" onPress={handleDismissJourney} />
          </View>
          <View style={styles.journeyDots}>
            {JOURNEY_STEPS.map((step, index) => (
              <View
                key={step.id}
                style={[
                  styles.journeyDot,
                  {
                    backgroundColor: journeyStepComplete[step.id] ? palette.primaryStrong : palette.border,
                  },
                  index < JOURNEY_STEPS.length - 1 && styles.journeyDotSpacer,
                ]}
              />
            ))}
          </View>
          {JOURNEY_STEPS.map((step, index) => {
            const done = journeyStepComplete[step.id];
            const isNext = index === journeyNextStepIndex;
            return (
              <View key={step.id} style={styles.journeyStepRow}>
                <KISIcon
                  name="checkmark-circle"
                  focused={done}
                  size={18}
                  color={done ? palette.primaryStrong : palette.subtext}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.journeyStepLabel, { color: done ? palette.subtext : palette.text }]}>
                    {index + 1}. {step.label}
                  </Text>
                  {isNext ? (
                    <Text style={[styles.journeyStepDescription, { color: palette.subtext }]}>{step.description}</Text>
                  ) : null}
                </View>
                {isNext ? (
                  <KISButton title="Start" size="xs" onPress={() => handleJourneyStepPress(step)} />
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.categoryTabs, { paddingTop: compact ? 10 : 14 }]}>
        {TAB_CATEGORIES.map(category => {
          const active = activeCategory === category.id;
          return (
            <KISButton
              key={category.id}
              title={category.label}
              size="xs"
              variant={active ? 'primary' : 'outline'}
              onPress={() => {
                setActiveCategory(category.id);
                setActiveTab(category.tabs[0]);
              }}
            />
          );
        })}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.tabs, { paddingVertical: compact ? 10 : 14 }]}>
        {TABS.filter(tab => activeCategory === categoryForTab(tab.id)).map(tab => {
          const active = activeTab === tab.id;
          return (
            <KISButton
              key={tab.id}
              title={tab.label}
              size="xs"
              variant={active ? 'primary' : 'outline'}
              onPress={() => setActiveTab(tab.id)}
            />
          );
        })}
      </ScrollView>
      {renderBody()}
    </View>
  );
}

const styles = StyleSheet.create({
  topTabBar: { flexDirection: 'row', gap: 8, marginTop: 14 },
  backButton: { alignSelf: 'flex-start', marginBottom: 8 },
  channelCardList: { gap: 12, marginTop: 14 },
  channelCard: { borderWidth: 1, borderRadius: 10, overflow: 'hidden' },
  channelCardBanner: { width: '100%', height: 64 },
  channelCardEditButton: { position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  channelCardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 12, marginTop: -26 },
  channelCardName: { fontSize: 14, fontWeight: '800' },
  channelCardHandle: { fontSize: 12, marginTop: 2 },
  channelCardDescription: { fontSize: 12, marginTop: 4, lineHeight: 16 },
  channelCardNudge: { fontSize: 11, fontWeight: '800', marginTop: 4 },
  journeyCard: { borderWidth: 1, borderRadius: 8, padding: 14, marginTop: 10, gap: 8 },
  journeyHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  journeyTitle: { fontSize: 15, fontWeight: '900' },
  journeyDots: { flexDirection: 'row', alignItems: 'center' },
  journeyDot: { width: 8, height: 8, borderRadius: 4 },
  journeyDotSpacer: { marginRight: 12 },
  journeyStepRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  journeyStepLabel: { fontSize: 13, fontWeight: '700' },
  journeyStepDescription: { fontSize: 12, marginTop: 2 },
  shell: { borderWidth: 1, borderRadius: 8, padding: 16, marginBottom: 14, overflow: 'hidden', shadowOpacity: 0.08, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 3 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  logo: { width: 48, height: 48, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 0 },
  title: { marginTop: 2, fontSize: 22, lineHeight: 27, fontWeight: '900' },
  subtitle: { marginTop: 3, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  studioMetrics: { flexDirection: 'row', gap: 10, marginTop: 14, flexWrap: 'wrap' },
  metricTile: { flex: 1, minWidth: 92, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  metricValue: { fontSize: 15, fontWeight: '900' },
  metricLabel: { marginTop: 2, fontSize: 10, fontWeight: '800' },
  upsellBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 8, padding: 12, marginTop: 14 },
  upsellBannerText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  premiumIcon: { width: 40, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  channelPills: { gap: 8, paddingTop: 14 },
  categoryTabs: { gap: 6 },
  tabs: { gap: 8, paddingVertical: 14 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
  loadingText: { fontSize: 12, fontWeight: '700' },
  emptyChannel: { borderWidth: 1, borderRadius: 8, padding: 16, marginBottom: 12 },
  createCard: { borderWidth: 1, borderRadius: 8, padding: 16, marginTop: 12, gap: 10 },
  successBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderWidth: 1, borderRadius: 8 },
  successText: { fontSize: 12, fontWeight: '700', lineHeight: 17 },
  formHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  smallIconButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 15, fontWeight: '900' },
  sectionText: { marginTop: 5, fontSize: 12, lineHeight: 18, fontWeight: '700' },
  input: { minHeight: 44, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, fontWeight: '700' },
  textarea: { minHeight: 82, textAlignVertical: 'top' },
  errorText: { fontSize: 12, lineHeight: 17, fontWeight: '800' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' },
});
