import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { KISIcon } from '@/constants/kisIcons';
import { useKISTheme } from '@/theme/useTheme';
import type { RootStackParamList } from '@/navigation/types';
import type { BroadcastChannelContent, BroadcastChannelPlaylist, BroadcastChannelSummary } from '@/screens/broadcast/channels/api/channels.types';
import { createBroadcastChannel, fetchChannelContents, fetchChannelPlaylists, setChannelBroadcastState, setChannelContentBroadcastState, useChannelsData } from '@/screens/broadcast/channels/hooks/useChannelsData';
import ChannelAnalyticsPanel from '@/screens/broadcast/channels/studio/ChannelAnalyticsPanel';
import ChannelBrandingEditor from '@/screens/broadcast/channels/studio/ChannelBrandingEditor';
import ChannelContentManager from '@/screens/broadcast/channels/studio/ChannelContentManager';
import ChannelModerationPanel from '@/screens/broadcast/channels/studio/ChannelModerationPanel';
import LiveControlRoom from '@/screens/broadcast/channels/studio/LiveControlRoom';

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

export default function ChannelStudioScreen({ legacyFeeds, liveCount, expiresAt, onCreate }: Props) {
  const { palette, tone } = useKISTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [activeTab, setActiveTab] = useState<StudioTab>('dashboard');
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [contents, setContents] = useState<BroadcastChannelContent[]>([]);
  const [playlists, setPlaylists] = useState<BroadcastChannelPlaylist[]>([]);
  const [loadingContent, setLoadingContent] = useState(false);
  const [createFormVisible, setCreateFormVisible] = useState(false);
  const [creatingChannel, setCreatingChannel] = useState(false);
  const [channelForm, setChannelForm] = useState<ChannelForm>(EMPTY_FORM);
  const [channelError, setChannelError] = useState<string | null>(null);
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

  const createLabel = selectedChannel?.handle ? `Create in @${selectedChannel.handle}` : 'Create feed/content';

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
      if (!created?.id) {
        setChannelError('Unable to create this channel. Try another handle.');
        return;
      }
      setSelectedChannelId(created.id);
      setChannelForm(EMPTY_FORM);
      setCreateFormVisible(false);
      setActiveTab('create');
      await refresh();
    } catch (err: any) {
      setChannelError(err?.message || 'Unable to create this channel.');
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

  const renderCreateChannelForm = () => (
    <View style={[styles.createCard, { borderColor: palette.border, backgroundColor: palette.surface }]}> 
      <View style={styles.formHeaderRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Create a channel</Text>
          <Text style={[styles.sectionText, { color: palette.subtext }]}>Feeds, videos, lives, playlists, and embeds will live under this channel.</Text>
        </View>
        {channels.length ? (
          <Pressable onPress={() => setCreateFormVisible(false)} style={styles.smallIconButton}>
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
    if (activeTab === 'analytics') return <ChannelAnalyticsPanel channelId={selectedChannel.id} queued={legacyFeeds.length} live={liveCount} subscribers={selectedChannel.subscriber_count} />;
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
      return <LiveControlRoom channel={selectedChannel} onOpenWatch={stream => navigation.navigate('LiveWatch', { streamId: stream.id, stream })} />;
    }
    if (activeTab === 'settings') {
      return <Placeholder title="Channel settings" text="Visibility, comments, embed allowlist, moderation defaults, and channel permissions will be wired as backend policies are finalized." />;
    }
    return (
      <>
        <ChannelAnalyticsPanel channelId={selectedChannel.id} queued={legacyFeeds.length} live={liveCount} subscribers={selectedChannel.subscriber_count} />
        <ChannelContentManager contents={contents.slice(0, 4)} legacyFeeds={legacyFeeds.slice(0, 4)} onCreate={() => onCreate(selectedChannel)} onToggleBroadcast={handleToggleContentBroadcast} broadcastingId={contentBroadcastingId} />
        {loadingContent ? <ActivityIndicator color={palette.primaryStrong} /> : null}
      </>
    );
  };

  return (
    <View style={[styles.shell, { backgroundColor: palette.card, borderColor: palette.border }]}> 
      <View style={styles.headerRow}>
        <View style={[styles.logo, { backgroundColor: palette.primarySoft }]}> 
          <KISIcon name="sub-channel" size={22} color={palette.primaryStrong} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.eyebrow, { color: palette.primaryStrong }]}>CHANNEL STUDIO</Text>
          <Text style={[styles.title, { color: palette.text }]}>{selectedChannel?.display_name || 'Creator workspace'}</Text>
          <Text style={[styles.subtitle, { color: palette.subtext }]}>{selectedChannel ? `@${selectedChannel.handle} · ${expiresAt} cycle` : 'Create a channel to start publishing channel-scoped feeds.'}</Text>
        </View>
        {selectedChannel ? (
          <View style={styles.headerActions}>
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
                {selectedChannel.is_broadcast ? 'Stop broadcasting channel' : 'Broadcast channel'}
              </Text>
            </Pressable>
            <Pressable onPress={() => onCreate(selectedChannel)} style={[styles.headerCreateButton, { backgroundColor: palette.text }]}> 
              <KISIcon name="add" size={16} color={palette.surface} />
              <Text style={[styles.primaryText, { color: palette.surface }]}>{createLabel}</Text>
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
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.channelPills}> 
          {channels.map(channel => {
            const active = channel.id === selectedChannel?.id;
            return (
              <Pressable key={channel.id} onPress={() => setSelectedChannelId(channel.id)} style={[styles.channelPill, { backgroundColor: active ? palette.primarySoft : palette.surface, borderColor: active ? palette.primary : palette.border }]}> 
                <Text style={{ color: active ? palette.primaryStrong : palette.text, fontWeight: '900', fontSize: 12 }}>@{channel.handle}{channel.is_broadcast ? ' · LIVE' : ''}</Text>
              </Pressable>
            );
          })}
          <Pressable onPress={() => setCreateFormVisible(true)} style={[styles.channelPill, { backgroundColor: palette.card, borderColor: palette.primary }]}> 
            <Text style={{ color: palette.primaryStrong, fontWeight: '900', fontSize: 12 }}>+ New Channel</Text>
          </Pressable>
        </ScrollView>
      ) : null}
      {createFormVisible && selectedChannel ? renderCreateChannelForm() : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}> 
        {TABS.map(tab => {
          const active = activeTab === tab.id;
          return (
            <Pressable key={tab.id} onPress={() => setActiveTab(tab.id)} style={[styles.tab, { backgroundColor: active ? palette.primarySoft : palette.surface, borderColor: active ? palette.primary : palette.border }]}> 
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
  channelPills: { gap: 8, paddingTop: 14 },
  channelPill: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  tabs: { gap: 8, paddingVertical: 14 },
  tab: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
  loadingText: { fontSize: 12, fontWeight: '700' },
  emptyChannel: { borderWidth: 1, borderRadius: 8, padding: 16, marginBottom: 12 },
  createCard: { borderWidth: 1, borderRadius: 8, padding: 16, marginTop: 12, gap: 10 },
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
});
