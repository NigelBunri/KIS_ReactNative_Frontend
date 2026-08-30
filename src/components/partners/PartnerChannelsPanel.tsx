// src/components/partners/PartnerChannelsPanel.tsx
//
// Category + channel create/manage — PartnerChannelsSection.tsx (the
// existing sidebar list) was flat/read-only with no create action despite
// full CRUD already existing on the backend (server-categories/, and
// ChannelViewSet's create/update/archive/overwrites). This is the missing
// management surface.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import styles from '@/components/partners/partnersStyles';
import { useKISTheme } from '@/theme/useTheme';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { patchRequest } from '@/network/patch';
import { useSocket } from '../../../SocketProvider';

type Props = {
  isOpen: boolean;
  panelWidth: number;
  panelTranslateX: Animated.Value;
  partnerId?: string | null;
  onClose: () => void;
};

type Category = { id: string | number; name: string; order: number; is_private?: boolean };
type ChannelRow = {
  id: string | number;
  name: string;
  channel_type: 'text' | 'announcement' | 'private' | 'voice';
  category?: string | number | null;
  is_archived?: boolean;
  conversation_id?: string | null;
};

const CHANNEL_TYPES: ChannelRow['channel_type'][] = ['text', 'announcement', 'private', 'voice'];

export default function PartnerChannelsPanel({ isOpen, panelWidth, panelTranslateX, partnerId, onClose }: Props) {
  const { palette } = useKISTheme();
  const { activeCall, joinExistingCall, startVoiceChannel } = useSocket();
  const [joiningVoiceChannelId, setJoiningVoiceChannelId] = useState<string | number | null>(null);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [channels, setChannels] = useState<ChannelRow[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelType, setNewChannelType] = useState<ChannelRow['channel_type']>('text');
  const [newChannelCategory, setNewChannelCategory] = useState<string | number | null>(null);
  const [saving, setSaving] = useState(false);

  const backdropOpacity = panelTranslateX.interpolate({
    inputRange: [0, panelWidth],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const load = useCallback(async () => {
    if (!partnerId) return;
    const res = await getRequest(ROUTES.partners.serverLayout(partnerId), {
      errorMessage: 'Unable to load channels.',
    });
    const payload = res?.data ?? res ?? {};
    setCategories(Array.isArray(payload.categories) ? payload.categories : []);
    setChannels(Array.isArray(payload.channels) ? payload.channels : []);
  }, [partnerId]);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [isOpen, load]);

  const createCategory = async () => {
    if (!partnerId || !newCategoryName.trim()) return;
    setSaving(true);
    const res = await postRequest(
      ROUTES.partners.serverCategories(partnerId),
      { name: newCategoryName.trim(), order: categories.length },
      { errorMessage: 'Unable to create category.' },
    );
    setSaving(false);
    if (!res?.success) {
      Alert.alert('Failed', res?.message ?? 'Unable to create category.');
      return;
    }
    setNewCategoryName('');
    load();
  };

  const deleteCategory = (category: Category) => {
    if (!partnerId) return;
    Alert.alert('Delete category?', `"${category.name}" will be removed. Channels inside it will become uncategorized.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { deleteRequest } = await import('@/network/delete');
          const res = await deleteRequest(ROUTES.partners.serverCategoryDetail(partnerId, String(category.id)), {
            errorMessage: 'Unable to delete category.',
          });
          if (!res?.success) {
            Alert.alert('Failed', res?.message ?? 'Unable to delete category.');
            return;
          }
          load();
        },
      },
    ]);
  };

  const createChannel = async () => {
    if (!partnerId || !newChannelName.trim()) {
      Alert.alert('Missing info', 'Channel name is required.');
      return;
    }
    setSaving(true);
    const body: Record<string, unknown> = {
      name: newChannelName.trim(),
      channel_type: newChannelType,
      partner: partnerId,
    };
    if (newChannelCategory) body.category = newChannelCategory;
    const res = await postRequest(ROUTES.channels.createChannel, body, {
      errorMessage: 'Unable to create channel.',
    });
    setSaving(false);
    if (!res?.success) {
      Alert.alert('Failed', res?.message ?? 'Unable to create channel.');
      return;
    }
    setNewChannelName('');
    load();
  };

  const archiveChannel = (channel: ChannelRow) => {
    Alert.alert('Archive channel?', `"${channel.name}" will be archived and hidden from the sidebar.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive',
        style: 'destructive',
        onPress: async () => {
          const res = await postRequest(
            ROUTES.channels.archiveChannel(String(channel.id)),
            {},
            { errorMessage: 'Unable to archive channel.' },
          );
          if (!res?.success) {
            Alert.alert('Failed', res?.message ?? 'Unable to archive channel.');
            return;
          }
          load();
        },
      },
    ]);
  };

  const joinVoiceChannel = async (channel: ChannelRow) => {
    if (!channel.conversation_id) {
      Alert.alert('Unavailable', 'This voice channel is not ready yet.');
      return;
    }
    if (activeCall && activeCall.state !== 'ended' && activeCall.state !== 'missed') {
      Alert.alert('Already in a call', 'Leave your current call before joining a voice channel.');
      return;
    }
    setJoiningVoiceChannelId(channel.id);
    const res = await getRequest(ROUTES.calls.active(channel.conversation_id), {
      errorMessage: 'Unable to check voice channel status.',
    });
    const liveCall = res?.data?.call ?? null;
    if (liveCall?.callId && joinExistingCall) {
      await joinExistingCall({
        callId: liveCall.callId,
        conversationId: channel.conversation_id,
        callType: liveCall.callType ?? 'voice-group',
        title: channel.name,
      });
    } else if (startVoiceChannel) {
      await startVoiceChannel({ conversationId: channel.conversation_id, title: channel.name });
    }
    setJoiningVoiceChannelId(null);
  };

  const moveChannelToCategory = async (channel: ChannelRow, categoryId: string | number | null) => {
    setChannels((prev) => prev.map((c) => (c.id === channel.id ? { ...c, category: categoryId } : c)));
    const res = await patchRequest(
      ROUTES.channels.updateChannel(String(channel.id)),
      { category: categoryId },
      { errorMessage: 'Unable to move channel.' },
    );
    if (!res?.success) load();
  };

  if (!isOpen) return null;

  return (
    <View style={styles.settingsPanelOverlay} pointerEvents="box-none">
      <Animated.View style={[styles.settingsPanelBackdrop, { backgroundColor: palette.backdrop, opacity: backdropOpacity }]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          styles.settingsPanelContainer,
          {
            width: panelWidth,
            backgroundColor: palette.surfaceElevated,
            borderLeftColor: palette.divider,
            transform: [{ translateX: panelTranslateX }],
          },
        ]}
      >
        <View style={[styles.settingsPanelHeader, { borderBottomColor: palette.divider }]}>
          <Pressable onPress={onClose} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            <Text style={{ color: palette.text, fontSize: 18 }}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingsPanelTitle, { color: palette.text }]}>Channels & Categories</Text>
            <Text style={[styles.settingsPanelDescription, { color: palette.subtext }]}>
              Organize your server's spaces.
            </Text>
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.settingsPanelBody} showsVerticalScrollIndicator={false}>
          {loading ? (
            <ActivityIndicator size="small" color={palette.primary} />
          ) : (
            <>
              <Text style={[styles.settingsSectionTitle, { color: palette.text }]}>New category</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                <TextInput
                  value={newCategoryName}
                  onChangeText={setNewCategoryName}
                  placeholder="Category name"
                  placeholderTextColor={palette.subtext}
                  style={{
                    flex: 1,
                    borderWidth: 1,
                    borderColor: palette.borderMuted,
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    color: palette.text,
                  }}
                />
                <Pressable
                  onPress={createCategory}
                  disabled={saving}
                  style={({ pressed }) => [
                    { paddingHorizontal: 14, borderRadius: 10, backgroundColor: palette.primary, justifyContent: 'center', opacity: pressed || saving ? 0.7 : 1 },
                  ]}
                >
                  <Text style={{ color: palette.onPrimary ?? '#fff', fontWeight: '600' }}>Add</Text>
                </Pressable>
              </View>

              <Text style={[styles.settingsSectionTitle, { color: palette.text }]}>New channel</Text>
              <TextInput
                value={newChannelName}
                onChangeText={setNewChannelName}
                placeholder="Channel name"
                placeholderTextColor={palette.subtext}
                style={{
                  borderWidth: 1,
                  borderColor: palette.borderMuted,
                  borderRadius: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  color: palette.text,
                  marginBottom: 8,
                }}
              />
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
                {CHANNEL_TYPES.map((type) => (
                  <Pressable
                    key={type}
                    onPress={() => setNewChannelType(type)}
                    style={{
                      paddingVertical: 5,
                      paddingHorizontal: 10,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: newChannelType === type ? palette.primary : palette.borderMuted,
                    }}
                  >
                    <Text style={{ color: newChannelType === type ? palette.primary : palette.text, fontSize: 12 }}>{type}</Text>
                  </Pressable>
                ))}
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                <Pressable
                  onPress={() => setNewChannelCategory(null)}
                  style={{
                    paddingVertical: 5,
                    paddingHorizontal: 10,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: newChannelCategory === null ? palette.primary : palette.borderMuted,
                  }}
                >
                  <Text style={{ color: newChannelCategory === null ? palette.primary : palette.subtext, fontSize: 12 }}>
                    No category
                  </Text>
                </Pressable>
                {categories.map((cat) => (
                  <Pressable
                    key={cat.id}
                    onPress={() => setNewChannelCategory(cat.id)}
                    style={{
                      paddingVertical: 5,
                      paddingHorizontal: 10,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: newChannelCategory === cat.id ? palette.primary : palette.borderMuted,
                    }}
                  >
                    <Text style={{ color: newChannelCategory === cat.id ? palette.primary : palette.text, fontSize: 12 }}>
                      {cat.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Pressable
                onPress={createChannel}
                disabled={saving}
                style={({ pressed }) => [
                  { paddingVertical: 10, borderRadius: 10, backgroundColor: palette.primary, alignItems: 'center', opacity: pressed || saving ? 0.7 : 1 },
                ]}
              >
                <Text style={{ color: palette.onPrimary ?? '#fff', fontWeight: '600' }}>{saving ? 'Creating…' : 'Create channel'}</Text>
              </Pressable>

              {categories.map((cat) => (
                <View key={cat.id} style={{ marginTop: 20 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={[styles.settingsSectionTitle, { color: palette.text }]}>{cat.name}</Text>
                    <Pressable onPress={() => deleteCategory(cat)}>
                      <Text style={{ color: palette.danger, fontSize: 12 }}>Delete</Text>
                    </Pressable>
                  </View>
                  {channels.filter((c) => c.category === cat.id).map((channel) => (
                    <View
                      key={channel.id}
                      style={[styles.settingsFeatureRow, { borderColor: palette.borderMuted, backgroundColor: palette.surface, marginTop: 6 }]}
                    >
                      <Text style={[styles.settingsFeatureTitle, { color: palette.text }]}>
                        {channel.channel_type === 'voice' ? '🔊 ' : channel.channel_type === 'announcement' ? '📢 ' : channel.channel_type === 'private' ? '🔒 ' : '# '}
                        {channel.name}
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                        {channel.channel_type === 'voice' ? (
                          <Pressable onPress={() => joinVoiceChannel(channel)} disabled={joiningVoiceChannelId === channel.id}>
                            <Text style={{ color: palette.primary, fontSize: 12, fontWeight: '600' }}>
                              {joiningVoiceChannelId === channel.id ? 'Joining…' : 'Join'}
                            </Text>
                          </Pressable>
                        ) : null}
                        <Pressable onPress={() => moveChannelToCategory(channel, null)}>
                          <Text style={{ color: palette.subtext, fontSize: 12 }}>Uncategorize</Text>
                        </Pressable>
                        <Pressable onPress={() => archiveChannel(channel)}>
                          <Text style={{ color: palette.danger, fontSize: 12 }}>Archive</Text>
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </View>
              ))}

              <View style={{ marginTop: 20 }}>
                <Text style={[styles.settingsSectionTitle, { color: palette.text }]}>Uncategorized</Text>
                {channels.filter((c) => !c.category).map((channel) => (
                  <View
                    key={channel.id}
                    style={[styles.settingsFeatureRow, { borderColor: palette.borderMuted, backgroundColor: palette.surface, marginTop: 6 }]}
                  >
                    <Text style={[styles.settingsFeatureTitle, { color: palette.text }]}>
                      {channel.channel_type === 'announcement' ? '📢 ' : channel.channel_type === 'private' ? '🔒 ' : '# '}
                      {channel.name}
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                      {channel.channel_type === 'voice' ? (
                        <Pressable onPress={() => joinVoiceChannel(channel)} disabled={joiningVoiceChannelId === channel.id}>
                          <Text style={{ color: palette.primary, fontSize: 12, fontWeight: '600' }}>
                            {joiningVoiceChannelId === channel.id ? 'Joining…' : 'Join'}
                          </Text>
                        </Pressable>
                      ) : null}
                      {categories.map((cat) => (
                        <Pressable key={cat.id} onPress={() => moveChannelToCategory(channel, cat.id)}>
                          <Text style={{ color: palette.primary, fontSize: 12 }}>→ {cat.name}</Text>
                        </Pressable>
                      ))}
                      <Pressable onPress={() => archiveChannel(channel)}>
                        <Text style={{ color: palette.danger, fontSize: 12 }}>Archive</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            </>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}
