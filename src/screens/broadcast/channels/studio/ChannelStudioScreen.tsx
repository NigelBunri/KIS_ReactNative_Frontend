import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { KISIcon } from '@/constants/kisIcons';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import type { RootStackParamList } from '@/navigation/types';
import type { BroadcastChannelContent, BroadcastChannelPlaylist, BroadcastChannelSummary } from '@/screens/broadcast/channels/api/channels.types';
import { createBroadcastChannel, fetchChannelContents, fetchChannelPlaylists, setChannelBroadcastState, setChannelContentBroadcastState, setChannelContentTags, useChannelsData } from '@/screens/broadcast/channels/hooks/useChannelsData';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { isTierAtLeast } from '@/services/tierAccess';
import { useAuth } from '../../../../../App';
import ChannelAnalyticsPanel from '@/screens/broadcast/channels/studio/ChannelAnalyticsPanel';
import ChannelBrandingEditor from '@/screens/broadcast/channels/studio/ChannelBrandingEditor';
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
import EndScreenEditor from '@/screens/broadcast/channels/studio/EndScreenEditor';
import ContentCardsEditor from '@/screens/broadcast/channels/studio/ContentCardsEditor';
import ChannelHomepageShelfEditor from '@/screens/broadcast/channels/studio/ChannelHomepageShelfEditor';
import {
  KIS_PROMOTIONAL_CREDIT_SAFETY_COPY,
  getLockedPremiumStateCopy,
  getProfitabilityPlanById,
} from '@/services/profitabilityPricing';
import TrustPromotionRevenuePreviewCard from '@/components/profitability/TrustPromotionRevenuePreviewCard';
import NotificationRetentionPreviewCard from '@/components/profitability/NotificationRetentionPreviewCard';
import EnterpriseKcanRevenuePreviewCard from '@/components/profitability/EnterpriseKcanRevenuePreviewCard';

type StudioTab = 'dashboard' | 'content' | 'create' | 'branding' | 'playlists' | 'live' | 'analytics' | 'moderation' | 'revenue' | 'audience' | 'copyright' | 'ads' | 'impressions' | 'traffic' | 'subtitles' | 'chapters' | 'endscreens' | 'cards' | 'shelves' | 'settings';

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
  { id: 'growth', label: 'Growth', tabs: ['audience', 'revenue', 'ads', 'shelves', 'cards'] },
  { id: 'brand', label: 'Brand', tabs: ['branding', 'subtitles', 'chapters', 'endscreens'] },
  { id: 'protect', label: 'Protect', tabs: ['moderation', 'copyright', 'settings'] },
];

const categoryForTab = (tab: StudioTab): StudioTabCategory =>
  TAB_CATEGORIES.find(category => category.tabs.includes(tab))?.id ?? 'content';

const EMPTY_FORM: ChannelForm = {
  displayName: '',
  handle: '',
  description: '',
  category: '',
  ownerType: 'user',
  ownerId: '',
};

const normalizeHandle = (value: string) => value.toLowerCase().replace(/^@+/, '').replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

const CREATOR_PREMIUM_FEATURES = [
  {
    key: 'channel-limit',
    planId: 'creator_pro',
    icon: 'sub-channel',
    title: 'More creator channels',
    value: '3 channels',
    detail: 'Creator Pro will raise the free channel limit while keeping existing free channels working.',
  },
  {
    key: 'scheduled-posts',
    planId: 'creator_pro',
    icon: 'calendar',
    title: 'Scheduled publishing',
    value: 'Creator Pro',
    detail: 'Prepare posts, videos, files, and announcements for future release windows.',
  },
  {
    key: 'analytics',
    planId: 'creator_growth',
    icon: 'poll',
    title: 'Advanced analytics',
    value: 'Growth',
    detail: 'Subscriber trends, content performance, embeds, promotion impact, and conversion reporting.',
  },
  {
    key: 'embeds',
    planId: 'creator_growth',
    icon: 'link',
    title: 'Advanced embeds',
    value: 'Growth',
    detail: 'Public/private embed controls and analytics after embed safety policy approval.',
  },
  {
    key: 'live',
    planId: 'creator_growth',
    icon: 'channel',
    title: 'Live and premieres',
    value: 'Growth',
    detail: 'Live provider controls, premieres, replays, moderation, and event monetization readiness.',
  },
  {
    key: 'paid-content',
    planId: 'creator_growth',
    icon: 'cart',
    title: 'Paid content readiness',
    value: 'Future',
    detail: 'Members-only posts and paid content planning with USD direct-provider settlement only.',
  },
  {
    key: 'promotion',
    planId: 'promotion_packages',
    icon: 'megaphone',
    title: 'Promotion packages',
    value: 'Reviewed',
    detail: 'Christian-safe featured placement with sponsored labels, staff review, and child-safe filtering.',
  },
] as const;

export default function ChannelStudioScreen({ legacyFeeds, liveCount, expiresAt, onCreate }: Props) {
  const { palette, tone } = useKISTheme();
  const responsive = useResponsiveLayout();
  const compact = responsive.isWatch || responsive.isCompactPhone;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  // Tier lives at the top level of the /users/me/ response (UserSerializer),
  // not nested under profile - ProfileSerializer has no tier field at all,
  // so user?.profile?.tier was always undefined regardless of the account's
  // real tier, meaning this always evaluated as Free and blocked every
  // Partner/Partner Pro account from live streaming. AdminUserManagementScreen.tsx
  // and AdminUsersPanel.tsx already read user.tier directly - matching that.
  const canUseLiveStreaming = isTierAtLeast(user?.tier ?? null, 'partner');
  const [activeTab, setActiveTab] = useState<StudioTab>('dashboard');
  const [activeCategory, setActiveCategory] = useState<StudioTabCategory>(categoryForTab('dashboard'));
  const [selectedContent, setSelectedContent] = useState<BroadcastChannelContent | null>(null);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [contents, setContents] = useState<BroadcastChannelContent[]>([]);
  const [playlists, setPlaylists] = useState<BroadcastChannelPlaylist[]>([]);
  const [loadingContent, setLoadingContent] = useState(false);
  const [createFormVisible, setCreateFormVisible] = useState(false);
  const [creatingChannel, setCreatingChannel] = useState(false);
  const [channelForm, setChannelForm] = useState<ChannelForm>(EMPTY_FORM);
  const [channelError, setChannelError] = useState<string | null>(null);
  const [lastCreatedHandle, setLastCreatedHandle] = useState<string | null>(null);
  const [channelBroadcasting, setChannelBroadcasting] = useState(false);
  const [contentBroadcastingId, setContentBroadcastingId] = useState<string | null>(null);
  const { channels, loading, refresh } = useChannelsData({ mine: true });

  useEffect(() => {
    if (!selectedChannelId && channels[0]?.id) setSelectedChannelId(channels[0].id);
  }, [channels, selectedChannelId]);

  const selectedChannel = useMemo(
    () => channels.find(channel => channel.id === selectedChannelId) || channels[0] || null,
    [channels, selectedChannelId],
  );
  const creatorProPlan = useMemo(() => getProfitabilityPlanById('creator_pro'), []);
  const creatorGrowthPlan = useMemo(() => getProfitabilityPlanById('creator_growth'), []);

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
        const response = await getRequest(ROUTES.broadcasts.partners.list, { errorMessage: '' });
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
      const [contentRows, playlistRows] = await Promise.all([
        fetchChannelContents(selectedChannel.id, { limit: 20 }),
        fetchChannelPlaylists(selectedChannel.id),
      ]);
      setContents(contentRows.contents);
      setPlaylists(playlistRows);
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

  const renderCreatorPremiumPreview = (context: 'dashboard' | 'create' | 'analytics' | 'live' | 'settings' = 'dashboard') => {
    const features =
      context === 'create'
        ? CREATOR_PREMIUM_FEATURES.filter(feature => ['channel-limit', 'scheduled-posts', 'paid-content'].includes(feature.key))
        : context === 'analytics'
        ? CREATOR_PREMIUM_FEATURES.filter(feature => ['analytics', 'embeds', 'promotion'].includes(feature.key))
        : context === 'live'
        ? CREATOR_PREMIUM_FEATURES.filter(feature => ['live', 'paid-content', 'promotion'].includes(feature.key))
        : context === 'settings'
        ? CREATOR_PREMIUM_FEATURES.filter(feature => ['embeds', 'promotion', 'paid-content'].includes(feature.key))
        : CREATOR_PREMIUM_FEATURES;
    return (
      <View style={[styles.premiumPanel, { borderColor: palette.goldMuted ?? palette.border, backgroundColor: tone === 'dark' ? palette.primarySoft : palette.surface }]}>
        <View style={styles.premiumHeaderRow}>
          <View style={[styles.premiumIcon, { backgroundColor: palette.primarySoft }]}>
            <KISIcon name="star" size={18} color={palette.primaryStrong} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Creator tools</Text>
            <Text style={[styles.sectionText, { color: palette.subtext }]}>
              {channelUsageText}
            </Text>
          </View>
          <View style={[styles.notLiveBadge, { borderColor: palette.goldBorder || palette.border }]}>
            <Text style={[styles.notLiveText, { color: palette.primaryStrong }]}>NOT LIVE</Text>
          </View>
        </View>
        <View style={styles.planRow}>
          {[creatorProPlan, creatorGrowthPlan].filter(Boolean).map(plan => (
            <View key={plan!.id} style={[styles.planCard, { borderColor: palette.border, backgroundColor: palette.card }]}>
              <Text style={[styles.planName, { color: palette.text }]}>{plan!.name}</Text>
              <Text style={[styles.planPrice, { color: palette.primaryStrong }]}>{plan!.priceLabel}</Text>
              <Text style={[styles.planDescription, { color: palette.subtext }]} numberOfLines={2}>{plan!.description}</Text>
            </View>
          ))}
        </View>
        <View style={styles.premiumGrid}>
          {features.map(feature => {
            const state = getLockedPremiumStateCopy(feature.planId, feature.title);
            return (
              <View key={feature.key} style={[styles.premiumFeatureCard, { borderColor: palette.border, backgroundColor: palette.surface }]}>
                <View style={styles.premiumFeatureTop}>
                  <View style={[styles.premiumFeatureIcon, { backgroundColor: palette.primarySoft }]}>
                    <KISIcon name={feature.icon as any} size={16} color={palette.primaryStrong} />
                  </View>
                  <Text style={[styles.premiumFeatureValue, { color: palette.primaryStrong }]}>{feature.value}</Text>
                </View>
                <Text style={[styles.premiumFeatureTitle, { color: palette.text }]}>{state.title}</Text>
                <Text style={[styles.premiumFeatureText, { color: palette.subtext }]}>{feature.detail}</Text>
                <Text style={[styles.lockedCopy, { color: palette.subtext }]}>Locked</Text>
              </View>
            );
          })}
        </View>
        <Text style={[styles.creditSafetyCopy, { color: palette.subtext }]}>
          {KIS_PROMOTIONAL_CREDIT_SAFETY_COPY}
        </Text>
      </View>
    );
  };

  const renderCreateChannelForm = () => (
    <View style={[styles.createCard, { borderColor: palette.border, backgroundColor: palette.surface }]}>
      {lastCreatedHandle ? (
        <View style={[styles.successBanner, { backgroundColor: `${palette.success}26`, borderColor: palette.success }]}>
          <KISIcon name="check" size={16} color={palette.success} />
          <Text style={[styles.successText, { color: palette.success, flex: 1 }]}>
            @{lastCreatedHandle} created! Fill in the form below to add another channel.
          </Text>
          <Pressable onPress={() => { setCreateFormVisible(false); setLastCreatedHandle(null); }} style={styles.smallIconButton}>
            <KISIcon name="close" size={16} color={palette.subtext} />
          </Pressable>
        </View>
      ) : null}
      <View style={styles.formHeaderRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>{lastCreatedHandle ? 'Add another channel' : 'Create a channel'}</Text>
          <Text style={[styles.sectionText, { color: palette.subtext }]}>Feeds, videos, lives, playlists, and embeds will live under this channel.</Text>
        </View>
        {channels.length || lastCreatedHandle ? (
          <Pressable onPress={() => { setCreateFormVisible(false); setLastCreatedHandle(null); }} style={styles.smallIconButton}>
            <KISIcon name="close" size={18} color={palette.subtext} />
          </Pressable>
        ) : null}
      </View>
      <Text style={[styles.sectionText, { color: palette.subtext, marginTop: 4 }]}>
        Who owns this channel?
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6, marginBottom: 4 }}>
        {OWNER_TYPE_OPTIONS.map(option => (
          <Pressable
            key={option.id}
            onPress={() => handleSelectOwnerType(option.id)}
            style={{
              paddingVertical: 6,
              paddingHorizontal: 12,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: channelForm.ownerType === option.id ? palette.text : palette.border,
              backgroundColor: channelForm.ownerType === option.id ? palette.text : palette.card,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: '700',
                color: channelForm.ownerType === option.id ? palette.surface : palette.text,
              }}
            >
              {option.label}
            </Text>
          </Pressable>
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
              <Pressable
                key={option.id}
                onPress={() => setChannelForm(prev => ({ ...prev, ownerId: option.id }))}
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 12,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: channelForm.ownerId === option.id ? palette.primaryStrong : palette.border,
                  backgroundColor: channelForm.ownerId === option.id ? palette.card : 'transparent',
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: palette.text }}>
                  {option.name}
                </Text>
              </Pressable>
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
      <Pressable onPress={handleCreateChannel} disabled={creatingChannel} style={[styles.primaryButton, { backgroundColor: palette.text, opacity: creatingChannel ? 0.72 : 1 }]}> 
        {creatingChannel ? <ActivityIndicator color={palette.surface} /> : <KISIcon name="add" size={17} color={palette.surface} />}
        <Text style={[styles.primaryText, { color: palette.surface }]}>{creatingChannel ? 'Creating...' : 'Create Channel'}</Text>
      </Pressable>
    </View>
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
            <Pressable onPress={() => setCreateFormVisible(true)} style={[styles.primaryButton, { backgroundColor: palette.text }]}> 
              <KISIcon name="add" size={17} color={palette.surface} />
              <Text style={[styles.primaryText, { color: palette.surface }]}>Create Channel</Text>
            </Pressable>
          )}
        </View>
      );
    }
    if (activeTab === 'branding') {
      return (
        <>
          <ChannelBrandingEditor channel={selectedChannel} onUpdated={refresh} />
          <Pressable
            onPress={() =>
              navigation.navigate('WebsiteBuilder', {
                ownerType: 'broadcast_channel',
                ownerId: selectedChannel.id,
                ownerLabel: selectedChannel.display_name || 'Channel',
              })
            }
            style={[styles.primaryButton, { backgroundColor: palette.text }]}
          >
            <Text style={[styles.primaryText, { color: palette.surface }]}>Manage landing page</Text>
          </Pressable>
        </>
      );
    }
    if (activeTab === 'analytics') {
      return (
        <>
          {renderCreatorPremiumPreview('analytics')}
          <ChannelAnalyticsPanel channelId={selectedChannel.id} queued={legacyFeeds.length} live={liveCount} subscribers={selectedChannel.subscriber_count} />
        </>
      );
    }
    if (activeTab === 'content') return <ChannelContentManager contents={contents} legacyFeeds={legacyFeeds} onCreate={() => onCreate(selectedChannel)} onToggleBroadcast={handleToggleContentBroadcast} broadcastingId={contentBroadcastingId} onUpdateTags={handleUpdateContentTags} />;
    if (activeTab === 'moderation') return <ChannelModerationPanel channelId={selectedChannel.id} />;
    if (activeTab === 'create') {
      return (
        <View style={[styles.emptyChannel, { borderColor: palette.border, backgroundColor: palette.surface }]}> 
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Create for @{selectedChannel.handle}</Text>
          <Text style={[styles.sectionText, { color: palette.subtext }]}>The advanced composer will save this feed inside the selected channel and still preserve the old profile feed queue for compatibility.</Text>
          <Pressable onPress={() => onCreate(selectedChannel)} style={[styles.primaryButton, { backgroundColor: palette.text }]}> 
            <KISIcon name="add" size={17} color={palette.surface} />
            <Text style={[styles.primaryText, { color: palette.surface }]}>{createLabel}</Text>
          </Pressable>
          {renderCreatorPremiumPreview('create')}
        </View>
      );
    }
    if (activeTab === 'playlists') {
      return (
        <View style={[styles.emptyChannel, { borderColor: palette.border, backgroundColor: palette.surface }]}> 
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Playlists</Text>
          {playlists.length ? playlists.map(item => <Text key={item.id} style={[styles.sectionText, { color: palette.subtext }]}>- {item.title}</Text>) : <Text style={[styles.sectionText, { color: palette.subtext }]}>Playlist creation and reorder UI is prepared for the playlist API; no public playlists are available yet.</Text>}
        </View>
      );
    }
    if (activeTab === 'live') {
      if (!canUseLiveStreaming) {
        return (
          <View style={[styles.upgradePrompt, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <KISIcon name="channel" size={32} color={palette.primaryStrong} />
            <Text style={[styles.upgradeTitle, { color: palette.text }]}>Live Streaming</Text>
            <Text style={[styles.upgradeText, { color: palette.subtext }]}>
              Live streaming is available on Partner plans and above. Upgrade your account to schedule and broadcast live streams to your subscribers.
            </Text>
            {/* Previously a dead end - text only, no way to actually act on
                it. Upgrading itself (tier lookup, discount/reward
                application, Flutterwave checkout) lives in
                useProfileController.upgradeTier, which needs profile/tiers
                data this screen doesn't have - rather than duplicate that
                payment logic here, this hands off to the Profile tab where
                the real, working "Upgrade" entry point already is. */}
            <Pressable
              onPress={() => navigation.navigate('MainTabs')}
              style={[styles.primaryButton, { backgroundColor: palette.text, marginTop: 14 }]}
            >
              <Text style={[styles.primaryText, { color: palette.surface }]}>Go to Profile to upgrade</Text>
            </Pressable>
          </View>
        );
      }
      return (
        <>
          {renderCreatorPremiumPreview('live')}
          <LiveControlRoom channel={selectedChannel} onOpenWatch={stream => navigation.navigate('LiveWatch', { streamId: stream.id, stream })} />
        </>
      );
    }
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
    if (activeTab === 'shelves') return <ChannelHomepageShelfEditor channelId={selectedChannel.id} />;
    if (activeTab === 'settings') {
      return (
        <>
          {renderCreatorPremiumPreview('settings')}
          <TrustPromotionRevenuePreviewCard
            palette={palette}
            kind="promotion_entry"
            title="Promotion campaign preview"
            subtitle="Campaign packages, sponsored labels, and review states are visible here for planning only."
          />
          <Placeholder title="Channel settings" text="Visibility, comments, embed allowlist, moderation defaults, and channel permissions will be wired as backend policies are finalized." />
        </>
      );
    }
    return (
      <>
        {renderCreatorPremiumPreview('dashboard')}
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
        <ChannelContentManager contents={contents.slice(0, 4)} legacyFeeds={legacyFeeds.slice(0, 4)} onCreate={() => onCreate(selectedChannel)} onToggleBroadcast={handleToggleContentBroadcast} broadcastingId={contentBroadcastingId} onUpdateTags={handleUpdateContentTags} />
        {loadingContent ? <ActivityIndicator color={palette.primaryStrong} /> : null}
      </>
    );
  };

  return (
    <View style={[styles.shell, { backgroundColor: palette.card, borderColor: palette.border, padding: compact ? 11 : 16 }]}> 
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
            <Pressable
              onPress={handleToggleChannelBroadcast}
              disabled={channelBroadcasting}
              style={[
                styles.headerBroadcastButton,
                {
                  backgroundColor: tone === 'dark' ? palette.primarySoft : palette.surface,
                  borderColor: selectedChannel.is_broadcast ? palette.danger : palette.primary,
                  opacity: channelBroadcasting ? 0.72 : 1,
                },
              ]}
            >
              {channelBroadcasting ? <ActivityIndicator size="small" color={palette.primaryStrong} /> : null}
              <Text style={[styles.broadcastText, { color: selectedChannel.is_broadcast ? palette.danger : palette.primaryStrong }]}>
                {compact ? (selectedChannel.is_broadcast ? 'Stop broadcast' : 'Broadcast') : (selectedChannel.is_broadcast ? 'Stop broadcasting channel' : 'Broadcast channel')}
              </Text>
            </Pressable>
            <Pressable onPress={() => onCreate(selectedChannel)} style={[styles.headerCreateButton, { backgroundColor: palette.text }]}> 
              <KISIcon name="add" size={16} color={palette.surface} />
              <Text style={[styles.primaryText, { color: palette.surface }]} numberOfLines={1}>{compact ? 'Create' : createLabel}</Text>
            </Pressable>
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
      {channels.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.channelPills, { paddingTop: compact ? 10 : 14 }]}> 
          {channels.map(channel => {
            const active = channel.id === selectedChannel?.id;
            return (
              <Pressable key={channel.id} onPress={() => setSelectedChannelId(channel.id)} style={[styles.channelPill, { backgroundColor: active ? palette.primarySoft : palette.surface, borderColor: active ? palette.primary : palette.border, paddingHorizontal: compact ? 9 : 12 }]}> 
                <Text style={{ color: active ? palette.primaryStrong : palette.text, fontWeight: '900', fontSize: 12 }}>@{channel.handle}{channel.is_broadcast ? ' · LIVE' : ''}</Text>
              </Pressable>
            );
          })}
          <Pressable onPress={() => setCreateFormVisible(true)} style={[styles.channelPill, { backgroundColor: palette.card, borderColor: palette.primary }]}> 
            <Text style={{ color: palette.primaryStrong, fontWeight: '900', fontSize: 12 }}>+ New Channel</Text>
          </Pressable>
        </ScrollView>
      ) : null}
      {createFormVisible && (selectedChannel || lastCreatedHandle) ? renderCreateChannelForm() : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.categoryTabs, { paddingTop: compact ? 10 : 14 }]}>
        {TAB_CATEGORIES.map(category => {
          const active = activeCategory === category.id;
          return (
            <Pressable
              key={category.id}
              onPress={() => {
                setActiveCategory(category.id);
                setActiveTab(category.tabs[0]);
              }}
              style={[styles.categoryTab, { backgroundColor: active ? palette.primary : palette.surface, borderColor: active ? palette.primary : palette.border }]}
            >
              <Text style={{ color: active ? palette.onPrimary ?? '#fff' : palette.text, fontWeight: '900', fontSize: 11 }}>{category.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.tabs, { paddingVertical: compact ? 10 : 14 }]}>
        {TABS.filter(tab => activeCategory === categoryForTab(tab.id)).map(tab => {
          const active = activeTab === tab.id;
          return (
            <Pressable key={tab.id} onPress={() => setActiveTab(tab.id)} style={[styles.tab, { backgroundColor: active ? palette.primarySoft : palette.surface, borderColor: active ? palette.primary : palette.border, paddingHorizontal: compact ? 9 : 12, paddingVertical: compact ? 7 : 9 }]}>
              <Text style={{ color: active ? palette.primaryStrong : palette.text, fontWeight: '900', fontSize: 11 }}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {renderBody()}
    </View>
  );
}

function Placeholder({ title, text }: { title: string; text: string }) {
  const { palette } = useKISTheme();
  return (
    <View style={[styles.emptyChannel, { borderColor: palette.border, backgroundColor: palette.surface }]}> 
      <Text style={[styles.sectionTitle, { color: palette.text }]}>{title}</Text>
      <Text style={[styles.sectionText, { color: palette.subtext }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
  premiumPanel: { borderWidth: 1, borderRadius: 8, padding: 14, marginBottom: 12, gap: 12 },
  premiumHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  premiumIcon: { width: 40, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  notLiveBadge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  notLiveText: { fontSize: 9, fontWeight: '900', letterSpacing: 0 },
  planRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  planCard: { flex: 1, minWidth: 180, borderWidth: 1, borderRadius: 8, padding: 12, gap: 5 },
  planName: { fontSize: 13, fontWeight: '900' },
  planPrice: { fontSize: 12, fontWeight: '900' },
  planDescription: { fontSize: 11, lineHeight: 16, fontWeight: '700' },
  premiumGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  premiumFeatureCard: { flex: 1, minWidth: 150, borderWidth: 1, borderRadius: 8, padding: 12, gap: 7 },
  premiumFeatureTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  premiumFeatureIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  premiumFeatureValue: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  premiumFeatureTitle: { fontSize: 12, fontWeight: '900' },
  premiumFeatureText: { fontSize: 11, lineHeight: 16, fontWeight: '700' },
  lockedCopy: { fontSize: 10, lineHeight: 15, fontWeight: '800' },
  creditSafetyCopy: { fontSize: 10, lineHeight: 15, fontWeight: '800' },
  channelPills: { gap: 8, paddingTop: 14 },
  channelPill: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  categoryTabs: { gap: 6 },
  categoryTab: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  tabs: { gap: 8, paddingVertical: 14 },
  tab: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9 },
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
  primaryButton: { alignSelf: 'flex-start', marginTop: 12, minHeight: 44, borderRadius: 8, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 7 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' },
  headerCreateButton: { minHeight: 44, borderRadius: 8, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 7 },
  headerBroadcastButton: { minHeight: 44, borderWidth: 1, borderRadius: 8, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 6 },
  broadcastText: { fontSize: 11, fontWeight: '900' },
  primaryText: { fontSize: 12, fontWeight: '900' },
  upgradePrompt: { borderWidth: 1, borderRadius: 8, padding: 24, marginBottom: 12, alignItems: 'center', gap: 12 },
  upgradeTitle: { fontSize: 18, fontWeight: '900', textAlign: 'center' },
  upgradeText: { fontSize: 13, lineHeight: 19, fontWeight: '700', textAlign: 'center' },
});
