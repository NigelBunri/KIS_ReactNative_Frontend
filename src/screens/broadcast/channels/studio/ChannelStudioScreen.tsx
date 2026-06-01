import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { KISIcon } from '@/constants/kisIcons';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import type { RootStackParamList } from '@/navigation/types';
import type { BroadcastChannelContent, BroadcastChannelPlaylist, BroadcastChannelSummary } from '@/screens/broadcast/channels/api/channels.types';
import { createBroadcastChannel, fetchChannelContents, fetchChannelPlaylists, setChannelBroadcastState, setChannelContentBroadcastState, useChannelsData } from '@/screens/broadcast/channels/hooks/useChannelsData';
import { isTierAtLeast } from '@/services/tierAccess';
import { useAuth } from '../../../../../App';
import ChannelAnalyticsPanel from '@/screens/broadcast/channels/studio/ChannelAnalyticsPanel';
import ChannelBrandingEditor from '@/screens/broadcast/channels/studio/ChannelBrandingEditor';
import ChannelContentManager from '@/screens/broadcast/channels/studio/ChannelContentManager';
import ChannelModerationPanel from '@/screens/broadcast/channels/studio/ChannelModerationPanel';
import LiveControlRoom from '@/screens/broadcast/channels/studio/LiveControlRoom';
import {
  KIS_PROMOTIONAL_CREDIT_SAFETY_COPY,
  getLockedPremiumStateCopy,
  getProfitabilityPlanById,
} from '@/services/profitabilityPricing';
import TrustPromotionRevenuePreviewCard from '@/components/profitability/TrustPromotionRevenuePreviewCard';
import NotificationRetentionPreviewCard from '@/components/profitability/NotificationRetentionPreviewCard';
import EnterpriseKcanRevenuePreviewCard from '@/components/profitability/EnterpriseKcanRevenuePreviewCard';

type StudioTab = 'dashboard' | 'content' | 'create' | 'branding' | 'playlists' | 'live' | 'analytics' | 'moderation' | 'settings';

type Props = {
  legacyFeeds: any[];
  liveCount: number;
  expiresAt: string;
  onCreate: (channel?: BroadcastChannelSummary | null) => void;
};

type ChannelForm = {
  displayName: string;
  handle: string;
  description: string;
  category: string;
};

const TABS: Array<{ id: StudioTab; label: string }> = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'content', label: 'Content' },
  { id: 'create', label: 'Create' },
  { id: 'branding', label: 'Branding' },
  { id: 'playlists', label: 'Playlists' },
  { id: 'live', label: 'Live' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'moderation', label: 'Moderation' },
  { id: 'settings', label: 'Settings' },
];

const EMPTY_FORM: ChannelForm = {
  displayName: '',
  handle: '',
  description: '',
  category: '',
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
  const canUseLiveStreaming = isTierAtLeast(user?.profile?.tier ?? null, 'partner');
  const [activeTab, setActiveTab] = useState<StudioTab>('dashboard');
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
    setCreatingChannel(true);
    setChannelError(null);
    try {
      const created = await createBroadcastChannel({
        owner_type: 'user',
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
      <View style={[styles.premiumPanel, { borderColor: tone === 'dark' ? palette.goldMuted : '#E8DDC7', backgroundColor: tone === 'dark' ? 'rgba(231,199,109,0.10)' : '#FFFCF5' }]}>
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
        <View style={[styles.successBanner, { backgroundColor: tone === 'dark' ? 'rgba(34,197,94,0.15)' : '#F0FDF4', borderColor: tone === 'dark' ? '#166534' : '#BBF7D0' }]}>
          <KISIcon name="check" size={16} color={tone === 'dark' ? '#4ADE80' : '#16A34A'} />
          <Text style={[styles.successText, { color: tone === 'dark' ? '#4ADE80' : '#15803D', flex: 1 }]}>
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
      {channelError ? <Text style={[styles.errorText, { color: palette.error || '#B42318' }]}>{channelError}</Text> : null}
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
    if (activeTab === 'branding') return <ChannelBrandingEditor channel={selectedChannel} />;
    if (activeTab === 'analytics') {
      return (
        <>
          {renderCreatorPremiumPreview('analytics')}
          <ChannelAnalyticsPanel channelId={selectedChannel.id} queued={legacyFeeds.length} live={liveCount} subscribers={selectedChannel.subscriber_count} />
        </>
      );
    }
    if (activeTab === 'content') return <ChannelContentManager contents={contents} legacyFeeds={legacyFeeds} onCreate={() => onCreate(selectedChannel)} onToggleBroadcast={handleToggleContentBroadcast} broadcastingId={contentBroadcastingId} />;
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
        <ChannelContentManager contents={contents.slice(0, 4)} legacyFeeds={legacyFeeds.slice(0, 4)} onCreate={() => onCreate(selectedChannel)} onToggleBroadcast={handleToggleContentBroadcast} broadcastingId={contentBroadcastingId} />
        {loadingContent ? <ActivityIndicator color={palette.primaryStrong} /> : null}
      </>
    );
  };

  return (
    <View style={[styles.shell, { backgroundColor: palette.card, borderColor: palette.border, padding: compact ? 11 : 16 }]}> 
      <View style={[styles.headerRow, compact && { alignItems: 'flex-start' }]}>
        <View style={[styles.logo, { backgroundColor: palette.primarySoft, width: compact ? 40 : 48, height: compact ? 40 : 48 }]}> 
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
                  backgroundColor: tone === 'dark' ? palette.primarySoft : '#FFFCF5',
                  borderColor: selectedChannel.is_broadcast ? palette.error || '#B42318' : palette.primary,
                  opacity: channelBroadcasting ? 0.72 : 1,
                },
              ]}
            >
              {channelBroadcasting ? <ActivityIndicator size="small" color={palette.primaryStrong} /> : null}
              <Text style={[styles.broadcastText, { color: selectedChannel.is_broadcast ? palette.error || '#B42318' : palette.primaryStrong }]}>
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
          <View style={[styles.metricTile, { borderColor: tone === 'dark' ? palette.goldMuted : '#E8DDC7', backgroundColor: tone === 'dark' ? palette.primarySoft : '#FFFCF5' }]}>
            <Text style={[styles.metricValue, { color: palette.text }]}>{contents.length}</Text>
            <Text style={[styles.metricLabel, { color: palette.subtext }]}>Studio items</Text>
          </View>
          <View style={[styles.metricTile, { borderColor: tone === 'dark' ? palette.goldMuted : '#E8DDC7', backgroundColor: tone === 'dark' ? palette.primarySoft : '#FFFCF5' }]}>
            <Text style={[styles.metricValue, { color: palette.text }]}>{selectedChannel.is_broadcast ? 'Live' : 'Private'}</Text>
            <Text style={[styles.metricLabel, { color: palette.subtext }]}>Broadcast state</Text>
          </View>
          <View style={[styles.metricTile, { borderColor: tone === 'dark' ? palette.goldMuted : '#E8DDC7', backgroundColor: tone === 'dark' ? palette.primarySoft : '#FFFCF5' }]}>
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
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.tabs, { paddingVertical: compact ? 10 : 14 }]}> 
        {TABS.map(tab => {
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
  shell: { borderWidth: 1, borderRadius: 8, padding: 16, marginBottom: 14, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 3 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  logo: { width: 48, height: 48, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E6D7B2' },
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
  primaryButton: { alignSelf: 'flex-start', marginTop: 12, minHeight: 38, borderRadius: 8, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 7 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' },
  headerCreateButton: { minHeight: 38, borderRadius: 8, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 7 },
  headerBroadcastButton: { minHeight: 38, borderWidth: 1, borderRadius: 8, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFFCF5' },
  broadcastText: { fontSize: 11, fontWeight: '900' },
  primaryText: { fontSize: 12, fontWeight: '900' },
  upgradePrompt: { borderWidth: 1, borderRadius: 8, padding: 24, marginBottom: 12, alignItems: 'center', gap: 12 },
  upgradeTitle: { fontSize: 18, fontWeight: '900', textAlign: 'center' },
  upgradeText: { fontSize: 13, lineHeight: 19, fontWeight: '700', textAlign: 'center' },
});
