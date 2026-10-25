// src/screens/broadcast/workspace/BroadcastWorkspaceScreen.tsx
//
// The global creator workspace - replaces FeedManagementModal as the entry
// point reached from Profile's "Broadcast workspace" launcher. Previously
// that launcher opened a modal with no real route, no back button, and no
// deep-linking; this is a real registered screen (RootStackParamList's
// "BroadcastWorkspace") with its own persistent bottom navigation across
// four destinations (Overview/Channels/Content/Analytics) plus a
// persistent Create action - the Level A workspace in the redesign's
// two-level IA (Level B is ChannelStudioScreen.tsx, reached by picking a
// channel here).
//
// Reuses the exact same data layer every other screen in this area already
// uses - useChannelsData (channel list/CRUD), fetchChannelContents
// (per-channel content), useProfileController (the legacy broadcast_feed
// queue) - rather than inventing a second implementation of any of it.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootStackParamList } from '@/navigation/types';
import { KISIcon } from '@/constants/kisIcons';
import KISButton from '@/constants/KISButton';
import KISTextInput from '@/constants/KISTextInput';
import PermanentRemoteImage from '@/components/media/PermanentRemoteImage';
import { resolveBackendAssetUrl } from '@/network';
import {
  useChannelsData,
  fetchChannelContents,
  createBroadcastChannel,
} from '@/screens/broadcast/channels/hooks/useChannelsData';
import type { BroadcastChannelContent, BroadcastChannelSummary } from '@/screens/broadcast/channels/api/channels.types';
import { useAuth } from '../../../../App';
import { useProfileController } from '@/screens/tabs/profile/useProfileController';
import FeedComposerSheet, {
  toChannelComposerContext,
} from '@/components/feeds/FeedComposerSheet';
import { WORKSPACE_PALETTE as palette } from './workspaceTheme';
import WorkspaceStatTile from './components/WorkspaceStatTile';
import { useAdvancedComposerSubmit } from './useAdvancedComposerSubmit';

type GlobalTab = 'overview' | 'channels' | 'content' | 'analytics';

const normalizeHandle = (value: string) =>
  value.toLowerCase().replace(/^@+/, '').replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

export default function BroadcastWorkspaceScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const { setAuth, setPhone } = useAuth();
  const [tab, setTab] = useState<GlobalTab>('overview');
  const { channels, loading, refresh } = useChannelsData({ mine: true });

  // Channel picker for "Create" when more than one channel exists - the
  // composer/content create flow is always channel-scoped server-side, so
  // an ambiguous "which channel" state can't be skipped, only made quick.
  const [createChannelPickerVisible, setCreateChannelPickerVisible] = useState(false);
  const [composerChannelId, setComposerChannelId] = useState<string | null>(null);
  const [composerVisible, setComposerVisible] = useState(false);

  const profileController = useProfileController({ setAuth, setPhone });
  useEffect(() => { void profileController.refreshBroadcastProfiles(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const submitAdvancedComposer = useAdvancedComposerSubmit(profileController);

  const aggregateStats = useMemo(() => ({
    channelCount: channels.length,
    totalSubscribers: channels.reduce((sum, c) => sum + (c.subscriber_count || 0), 0),
    totalContent: channels.reduce((sum, c) => sum + (c.content_count || 0), 0),
    liveCount: channels.filter(c => c.is_broadcast).length,
  }), [channels]);

  const openChannel = useCallback((channelId: string, studioTab?: 'dashboard' | 'content' | 'live' | 'growth' | 'branding') => {
    navigation.navigate('ChannelStudio', { channelId, tab: studioTab });
  }, [navigation]);

  const handleCreatePress = useCallback(() => {
    if (!channels.length) {
      // Nothing to create into yet - send the user to make their first
      // channel instead of opening a composer with nowhere to save to.
      setTab('channels');
      return;
    }
    if (channels.length === 1) {
      setComposerChannelId(channels[0].id);
      setComposerVisible(true);
      return;
    }
    setCreateChannelPickerVisible(true);
  }, [channels]);

  const composerChannel = channels.find(c => c.id === composerChannelId) ?? null;

  return (
    <View style={[styles.root, { backgroundColor: palette.bg }]}>
      <View style={[styles.header, { paddingTop: insets.top + 10, backgroundColor: palette.bg, borderBottomColor: palette.border }]}>
        <Pressable
          onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('MainTabs'))}
          style={styles.closeBtn}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <KISIcon name="arrow-left" size={20} color={palette.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.eyebrow, { color: palette.primaryStrong }]}>BROADCAST WORKSPACE</Text>
          <Text style={[styles.title, { color: palette.text }]}>
            {{ overview: 'Overview', channels: 'Channels', content: 'Content', analytics: 'Analytics' }[tab]}
          </Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 90 }]}>
        {tab === 'overview' ? (
          <OverviewTab
            loading={loading}
            stats={aggregateStats}
            channels={channels}
            onOpenChannel={openChannel}
            onGoToTab={setTab}
            onCreate={handleCreatePress}
          />
        ) : null}
        {tab === 'channels' ? (
          <ChannelsTab
            loading={loading}
            channels={channels}
            onOpenChannel={openChannel}
            onCreated={refresh}
          />
        ) : null}
        {tab === 'content' ? (
          <ContentTab channels={channels} onOpenChannel={openChannel} />
        ) : null}
        {tab === 'analytics' ? (
          <AnalyticsTab stats={aggregateStats} channels={channels} onOpenChannel={openChannel} />
        ) : null}
      </ScrollView>

      {/* Persistent bottom nav - the 4 global destinations stay reachable
          regardless of which one is active, matching the brief's "compact,
          persistent bottom navigation on mobile" requirement. */}
      <View style={[styles.bottomNav, { paddingBottom: insets.bottom + 8, backgroundColor: palette.card, borderTopColor: palette.border }]}>
        {([
          { id: 'overview', label: 'Overview', icon: 'home' },
          { id: 'channels', label: 'Channels', icon: 'sub-channel' },
          { id: 'content', label: 'Content', icon: 'layers' },
          { id: 'analytics', label: 'Analytics', icon: 'bar-chart' },
        ] as const).map(item => {
          const active = tab === item.id;
          return (
            <Pressable
              key={item.id}
              onPress={() => setTab(item.id)}
              style={styles.bottomNavItem}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={item.label}
            >
              <KISIcon name={item.icon as any} size={20} color={active ? palette.primaryStrong : palette.subtext} />
              <Text style={[styles.bottomNavLabel, { color: active ? palette.primaryStrong : palette.subtext }]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Persistent Create action - floats above the bottom nav so it's
          reachable from every tab without extra navigation. */}
      <Pressable
        onPress={handleCreatePress}
        style={[styles.createFab, { backgroundColor: palette.primary, bottom: insets.bottom + 72 }]}
        accessibilityRole="button"
        accessibilityLabel="Create content"
      >
        <KISIcon name="add" size={22} color={palette.onPrimary} />
      </Pressable>

      {composerChannel ? (
        <FeedComposerSheet
          visible={composerVisible}
          onClose={() => setComposerVisible(false)}
          onSubmit={submitAdvancedComposer}
          channelContext={toChannelComposerContext(composerChannel)}
        />
      ) : null}

      {createChannelPickerVisible ? (
        <View style={styles.pickerOverlay}>
          <Pressable style={styles.pickerBackdrop} onPress={() => setCreateChannelPickerVisible(false)} />
          <View style={[styles.pickerSheet, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Text style={[styles.pickerTitle, { color: palette.text }]}>Create in which channel?</Text>
            {channels.map(c => (
              <Pressable
                key={c.id}
                onPress={() => {
                  setCreateChannelPickerVisible(false);
                  setComposerChannelId(c.id);
                  setComposerVisible(true);
                }}
                style={[styles.pickerRow, { borderColor: palette.border }]}
              >
                <Text style={[styles.pickerRowText, { color: palette.text }]}>@{c.handle}</Text>
                <KISIcon name="chevron-right" size={16} color={palette.subtext} />
              </Pressable>
            ))}
            <KISButton title="Cancel" variant="ghost" onPress={() => setCreateChannelPickerVisible(false)} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

// ── Overview ─────────────────────────────────────────────────────────────────

function OverviewTab({
  loading,
  stats,
  channels,
  onOpenChannel,
  onGoToTab,
  onCreate,
}: {
  loading: boolean;
  stats: { channelCount: number; totalSubscribers: number; totalContent: number; liveCount: number };
  channels: BroadcastChannelSummary[];
  onOpenChannel: (id: string, tab?: 'dashboard' | 'content' | 'live' | 'growth' | 'branding') => void;
  onGoToTab: (tab: GlobalTab) => void;
  onCreate: () => void;
}) {
  // Setup reminder: surfaces the single most useful next action across all
  // channels, rather than repeating each channel's own onboarding checklist
  // here too (that lives in ChannelStudioScreen's Dashboard - this is a
  // workspace-wide summary, not a duplicate of it).
  const needsBranding = channels.find(c => !c.banner_url);
  const needsFirstPost = channels.find(c => (c.content_count || 0) === 0);

  if (loading && !channels.length) {
    return (
      <View style={styles.loadingRow}>
        <ActivityIndicator color={palette.primaryStrong} />
        <Text style={[styles.loadingText, { color: palette.subtext }]}>Loading your workspace</Text>
      </View>
    );
  }

  if (!channels.length) {
    return (
      <View style={[styles.emptyCard, { borderColor: palette.border, backgroundColor: palette.card }]}>
        <Text style={[styles.emptyTitle, { color: palette.text }]}>Start your first channel</Text>
        <Text style={[styles.emptyText, { color: palette.subtext }]}>
          Every post, video, live stream, and playlist is organized under a channel. Create one to get started.
        </Text>
        <KISButton title="Create a channel" onPress={() => onGoToTab('channels')} left={<KISIcon name="add" size={16} color={palette.onPrimary} />} />
      </View>
    );
  }

  return (
    <>
      <View style={styles.statsGrid}>
        <WorkspaceStatTile icon="sub-channel" value={stats.channelCount} label="Channels" onPress={() => onGoToTab('channels')} />
        <WorkspaceStatTile icon="people" value={stats.totalSubscribers} label="Subscribers" onPress={() => onGoToTab('analytics')} />
        <WorkspaceStatTile icon="layers" value={stats.totalContent} label="Published" onPress={() => onGoToTab('content')} />
        {stats.liveCount > 0 ? (
          <WorkspaceStatTile icon="broadcast" value={stats.liveCount} label="Live now" onPress={() => { const live = channels.find(c => c.is_broadcast); if (live) onOpenChannel(live.id, 'live'); }} />
        ) : null}
      </View>

      <KISButton title="Create content" onPress={onCreate} left={<KISIcon name="add" size={16} color={palette.onPrimary} />} style={{ marginTop: 14 }} />

      {needsBranding || needsFirstPost ? (
        <View style={[styles.reminderCard, { borderColor: palette.border, backgroundColor: palette.card }]}>
          <KISIcon name="info" size={16} color={palette.primaryStrong} />
          <View style={{ flex: 1 }}>
            {needsBranding ? (
              <Pressable onPress={() => onOpenChannel(needsBranding.id, 'branding')}>
                <Text style={[styles.reminderText, { color: palette.text }]}>
                  @{needsBranding.handle} has no banner yet — <Text style={{ color: palette.primaryStrong, fontWeight: '800' }}>set up branding</Text>
                </Text>
              </Pressable>
            ) : null}
            {needsFirstPost ? (
              <Pressable onPress={() => onOpenChannel(needsFirstPost.id, 'content')}>
                <Text style={[styles.reminderText, { color: palette.text }]}>
                  @{needsFirstPost.handle} has no published content yet — <Text style={{ color: palette.primaryStrong, fontWeight: '800' }}>publish your first post</Text>
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}

      <Text style={[styles.sectionHeading, { color: palette.text }]}>Your channels</Text>
      {channels.slice(0, 4).map(c => (
        <Pressable key={c.id} onPress={() => onOpenChannel(c.id)} style={[styles.channelRow, { borderColor: palette.border, backgroundColor: palette.card }]}>
          <ChannelAvatarCircle channel={c} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.channelRowName, { color: palette.text }]} numberOfLines={1}>{c.display_name}</Text>
            <Text style={[styles.channelRowMeta, { color: palette.subtext }]} numberOfLines={1}>@{c.handle} · {c.subscriber_count || 0} subscribers</Text>
          </View>
          {c.is_broadcast ? <View style={[styles.liveDot, { backgroundColor: palette.danger }]} /> : null}
          <KISIcon name="chevron-right" size={16} color={palette.subtext} />
        </Pressable>
      ))}
      {channels.length > 4 ? (
        <KISButton title="See all channels" variant="ghost" onPress={() => onGoToTab('channels')} />
      ) : null}
    </>
  );
}

// ── Channels ─────────────────────────────────────────────────────────────────

function ChannelsTab({
  loading,
  channels,
  onOpenChannel,
  onCreated,
}: {
  loading: boolean;
  channels: BroadcastChannelSummary[];
  onOpenChannel: (id: string, tab?: 'dashboard' | 'content' | 'live' | 'growth' | 'branding') => void;
  onCreated: () => Promise<void> | void;
}) {
  const [formVisible, setFormVisible] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [handle, setHandle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async () => {
    const name = displayName.trim();
    const normalizedHandle = normalizeHandle(handle || name);
    if (!name) { setError('Add a channel name.'); return; }
    if (!normalizedHandle) { setError('Add a public handle using letters or numbers.'); return; }
    setSubmitting(true);
    setError(null);
    try {
      await createBroadcastChannel({
        owner_type: 'user',
        display_name: name,
        handle: normalizedHandle,
        description: description.trim(),
        category: '',
        is_public: true,
      });
      setFormVisible(false);
      setDisplayName('');
      setHandle('');
      setDescription('');
      await onCreated();
    } catch (err: any) {
      const raw = String(err?.message || '');
      setError(raw.toLowerCase().includes('handle') || raw.toLowerCase().includes('taken')
        ? 'That handle is already taken. Try a different one.'
        : raw || 'Unable to create this channel.');
    } finally {
      setSubmitting(false);
    }
  }, [displayName, handle, description, onCreated]);

  return (
    <>
      <View style={styles.channelsTabHeader}>
        <Text style={[styles.sectionHeading, { color: palette.text, marginTop: 0 }]}>
          {channels.length} channel{channels.length === 1 ? '' : 's'}
        </Text>
        <KISButton title="New channel" size="sm" onPress={() => setFormVisible(v => !v)} left={<KISIcon name="add" size={14} color={palette.onPrimary} />} />
      </View>

      {formVisible ? (
        <View style={[styles.createCard, { borderColor: palette.border, backgroundColor: palette.card }]}>
          <KISTextInput placeholder="Channel name" value={displayName} onChangeText={v => { setDisplayName(v); if (!handle) setHandle(normalizeHandle(v)); }} />
          <KISTextInput placeholder="@handle" value={handle} onChangeText={v => setHandle(normalizeHandle(v))} autoCapitalize="none" />
          <KISTextInput placeholder="Description (optional)" value={description} onChangeText={setDescription} multiline />
          {error ? <Text style={[styles.errorText, { color: palette.danger }]}>{error}</Text> : null}
          <Text style={[styles.hintText, { color: palette.subtext }]}>
            Creating a channel for a shop, health, education, or partner organization? Open a channel's full Studio and use "Switch channel" → "New Channel" for the full owner picker.
          </Text>
          <KISButton title={submitting ? 'Creating…' : 'Create channel'} onPress={submit} loading={submitting} disabled={submitting} />
        </View>
      ) : null}

      {loading && !channels.length ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={palette.primaryStrong} />
          <Text style={[styles.loadingText, { color: palette.subtext }]}>Loading channels</Text>
        </View>
      ) : (
        channels.map(c => (
          <Pressable key={c.id} onPress={() => onOpenChannel(c.id)} style={[styles.channelCard, { borderColor: palette.border, backgroundColor: palette.card }]}>
            {c.banner_url ? (
              <PermanentRemoteImage
                uri={resolveBackendAssetUrl(c.banner_url)}
                domain="Broadcast"
                stableKey={`workspace_channel_banner_${c.id}`}
                containerStyle={styles.channelCardBanner}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.channelCardBanner, { backgroundColor: palette.primarySoft }]} />
            )}
            <View style={styles.channelCardBody}>
              <ChannelAvatarCircle channel={c} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[styles.channelRowName, { color: palette.text }]} numberOfLines={1}>{c.display_name}</Text>
                  {c.is_broadcast ? (
                    <View style={[styles.liveBadge, { backgroundColor: palette.danger }]}><Text style={styles.liveBadgeText}>LIVE</Text></View>
                  ) : null}
                </View>
                <Text style={[styles.channelRowMeta, { color: palette.subtext }]} numberOfLines={1}>@{c.handle} · {c.subscriber_count || 0} subscribers</Text>
                {!c.banner_url ? (
                  <Text style={[styles.channelCardNudge, { color: palette.primaryStrong }]}>Add a banner to finish branding</Text>
                ) : null}
              </View>
              <KISIcon name="chevron-right" size={18} color={palette.subtext} />
            </View>
          </Pressable>
        ))
      )}
    </>
  );
}

// ── Content ──────────────────────────────────────────────────────────────────

function ContentTab({
  channels,
  onOpenChannel,
}: {
  channels: BroadcastChannelSummary[];
  onOpenChannel: (id: string, tab?: 'dashboard' | 'content' | 'live' | 'growth' | 'branding') => void;
}) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Array<BroadcastChannelContent & { _channel: BroadcastChannelSummary }>>([]);

  useEffect(() => {
    let cancelled = false;
    if (!channels.length) { setLoading(false); setRows([]); return; }
    setLoading(true);
    Promise.all(channels.map(c => fetchChannelContents(c.id, { limit: 10 }).then(r => r.contents.map(item => ({ ...item, _channel: c })))))
      .then(lists => {
        if (cancelled) return;
        const merged = lists.flat().sort((a, b) => new Date(b.published_at || b.created_at || 0).getTime() - new Date(a.published_at || a.created_at || 0).getTime());
        setRows(merged);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [channels]);

  if (loading) {
    return (
      <View style={styles.loadingRow}>
        <ActivityIndicator color={palette.primaryStrong} />
        <Text style={[styles.loadingText, { color: palette.subtext }]}>Loading content across your channels</Text>
      </View>
    );
  }

  if (!rows.length) {
    return (
      <View style={[styles.emptyCard, { borderColor: palette.border, backgroundColor: palette.card }]}>
        <Text style={[styles.emptyTitle, { color: palette.text }]}>No content yet</Text>
        <Text style={[styles.emptyText, { color: palette.subtext }]}>Drafts, queued, and published content across every channel you manage will show up here.</Text>
      </View>
    );
  }

  return (
    <>
      {rows.map(item => (
        <Pressable
          key={item.id}
          onPress={() => onOpenChannel(item._channel.id, 'content')}
          style={[styles.contentRow, { borderColor: palette.border, backgroundColor: palette.card }]}
        >
          <View style={[styles.contentTypeIcon, { backgroundColor: palette.primarySoft }]}>
            <KISIcon name={item.content_type === 'live_stream' ? 'broadcast' : item.content_type === 'audio' ? 'audio' : 'play'} size={16} color={palette.primaryStrong} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.channelRowName, { color: palette.text }]} numberOfLines={1}>{item.title || 'Untitled'}</Text>
            <Text style={[styles.channelRowMeta, { color: palette.subtext }]} numberOfLines={1}>
              @{item._channel.handle} · {String(item.status || '').toUpperCase() || 'DRAFT'}
            </Text>
          </View>
          <KISIcon name="chevron-right" size={16} color={palette.subtext} />
        </Pressable>
      ))}
    </>
  );
}

// ── Analytics ────────────────────────────────────────────────────────────────

function AnalyticsTab({
  stats,
  channels,
  onOpenChannel,
}: {
  stats: { channelCount: number; totalSubscribers: number; totalContent: number; liveCount: number };
  channels: BroadcastChannelSummary[];
  onOpenChannel: (id: string, tab?: 'dashboard' | 'content' | 'live' | 'growth' | 'branding') => void;
}) {
  // No workspace-level analytics endpoint exists in the backend - only
  // per-channel analytics (ChannelAnalyticsPanel/RevenueAnalyticsPanel/
  // AudienceDemographicsPanel/ImpressionsAnalyticsPanel/
  // TrafficSourcesPanel, all keyed by channelId). Rather than fabricate a
  // workspace-wide chart with no real data behind it, this shows the
  // real aggregate numbers that ARE computable from the channel list
  // itself, plus a direct link into each channel's real analytics.
  return (
    <>
      <View style={styles.statsGrid}>
        <WorkspaceStatTile icon="sub-channel" value={stats.channelCount} label="Channels" />
        <WorkspaceStatTile icon="people" value={stats.totalSubscribers} label="Total subscribers" />
        <WorkspaceStatTile icon="layers" value={stats.totalContent} label="Published items" />
        <WorkspaceStatTile icon="broadcast" value={stats.liveCount} label="Live now" />
      </View>
      <Text style={[styles.hintText, { color: palette.subtext, marginTop: 12 }]}>
        Detailed analytics (views, watch time, impressions, traffic sources, revenue) are scoped per channel.
      </Text>
      <Text style={[styles.sectionHeading, { color: palette.text }]}>Open full analytics</Text>
      {channels.map(c => (
        <Pressable key={c.id} onPress={() => onOpenChannel(c.id, 'dashboard')} style={[styles.channelRow, { borderColor: palette.border, backgroundColor: palette.card }]}>
          <ChannelAvatarCircle channel={c} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.channelRowName, { color: palette.text }]} numberOfLines={1}>{c.display_name}</Text>
            <Text style={[styles.channelRowMeta, { color: palette.subtext }]} numberOfLines={1}>@{c.handle}</Text>
          </View>
          <KISIcon name="chevron-right" size={16} color={palette.subtext} />
        </Pressable>
      ))}
    </>
  );
}

// ── Shared small bits ─────────────────────────────────────────────────────────

function ChannelAvatarCircle({ channel }: { channel: BroadcastChannelSummary }) {
  const url = channel.avatar_display_url || channel.avatar_url;
  if (url) {
    return (
      <PermanentRemoteImage
        uri={resolveBackendAssetUrl(url)}
        domain="Broadcast"
        stableKey={`workspace_avatar_${channel.id}`}
        containerStyle={styles.avatarCircle}
      />
    );
  }
  return (
    <View style={[styles.avatarCircle, { backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center' }]}>
      <Text style={{ color: palette.primaryStrong, fontWeight: '800', fontSize: 14 }}>
        {(channel.avatar_initials || channel.display_name || '?').slice(0, 2).toUpperCase()}
      </Text>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontSize: 10, fontWeight: '900' },
  title: { fontSize: 20, fontWeight: '900', marginTop: 2 },
  body: { padding: 16 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 24, justifyContent: 'center' },
  loadingText: { fontSize: 12, fontWeight: '700' },
  emptyCard: { borderWidth: 1, borderRadius: 14, padding: 20, gap: 10, alignItems: 'flex-start' },
  emptyTitle: { fontSize: 16, fontWeight: '800' },
  emptyText: { fontSize: 13, lineHeight: 19 },
  reminderCard: { flexDirection: 'row', gap: 10, borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 12, alignItems: 'flex-start' },
  reminderText: { fontSize: 12, lineHeight: 18, fontWeight: '600' },
  sectionHeading: { fontSize: 14, fontWeight: '800', marginTop: 20, marginBottom: 10 },
  channelRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, padding: 10, marginBottom: 8 },
  channelRowName: { fontSize: 13, fontWeight: '800' },
  channelRowMeta: { fontSize: 11, marginTop: 1 },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  avatarCircle: { width: 36, height: 36, borderRadius: 18, overflow: 'hidden' },
  channelsTabHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  createCard: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 10, marginBottom: 14 },
  errorText: { fontSize: 12, fontWeight: '700' },
  hintText: { fontSize: 11, lineHeight: 16 },
  channelCard: { borderWidth: 1, borderRadius: 14, overflow: 'hidden', marginBottom: 12 },
  channelCardBanner: { width: '100%', height: 56 },
  channelCardBody: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  channelCardNudge: { fontSize: 11, fontWeight: '800', marginTop: 2 },
  liveBadge: { borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  liveBadgeText: { color: '#fff', fontSize: 9, fontWeight: '900' },
  contentRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, padding: 10, marginBottom: 8 },
  contentTypeIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  bottomNav: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingTop: 8,
  },
  bottomNavItem: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 2 },
  bottomNavLabel: { fontSize: 10, fontWeight: '700' },
  createFab: {
    position: 'absolute',
    right: 16,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  pickerOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end' },
  pickerBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  pickerSheet: { borderTopLeftRadius: 18, borderTopRightRadius: 18, borderWidth: 1, padding: 16, gap: 8 },
  pickerTitle: { fontSize: 15, fontWeight: '800', marginBottom: 6 },
  pickerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 10, padding: 12 },
  pickerRowText: { fontSize: 13, fontWeight: '700' },
});
