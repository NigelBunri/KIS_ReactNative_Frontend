// src/screens/broadcast/channels/studio/ChannelSettingsPanel.tsx
//
// Real channel settings, backed by fields the backend already enforces:
//  - is_public (BroadcastChannel model field) - BroadcastChannelDetailView
//    .get 404s a private channel for anyone who isn't a manager.
//  - settings.comments_restricted (BroadcastChannel.settings JSONField) -
//    ChannelCommentsView/ChannelCommentCreateView already reject a comment
//    from a non-manager when this is true (apps/broadcasts/views.py).
// Both were already readable/writable through the channel detail PATCH
// endpoint; there was simply no UI for either one - the old Settings tab
// was a static "will be wired as backend policies are finalized" message
// describing policies that, for these two, already existed.
//
// `settings` is a JSONField the backend replaces wholesale on PATCH (not a
// merge - see BroadcastChannelDetailView.patch), and it's also missing
// entirely from the list endpoint's summary serializer - so this panel
// fetches the real channel detail itself on mount rather than trusting
// whatever `channel.settings` the caller passed in, and always sends back
// the full settings object (existing keys + the one this screen owns) so
// an unrelated key (e.g. `default_tab`, `private_email`) already stored
// there is never silently wiped by a change made here.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { KISIcon } from '@/constants/kisIcons';
import KISButton from '@/constants/KISButton';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import type { BroadcastChannelDetail, BroadcastChannelSummary } from '@/screens/broadcast/channels/api/channels.types';
import {
  type ChannelManager,
  addChannelManager,
  fetchChannelDetail,
  fetchChannelManagers,
  removeChannelManager,
  updateChannelDetail,
} from '@/screens/broadcast/channels/hooks/useChannelsData';

type Props = {
  channel?: BroadcastChannelSummary | BroadcastChannelDetail | null;
  onUpdated?: () => void | Promise<void>;
};

export default function ChannelSettingsPanel({ channel, onUpdated }: Props) {
  const { palette } = useKISTheme();
  const { bodyFontSize } = useResponsiveLayout();
  const channelId = channel?.id;

  const [loadingDetail, setLoadingDetail] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rawSettings, setRawSettings] = useState<Record<string, any>>({});
  const [isPublic, setIsPublic] = useState<boolean>(channel?.is_public ?? true);
  const [commentsRestricted, setCommentsRestricted] = useState(false);
  const [savingField, setSavingField] = useState<'visibility' | 'comments' | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!channelId) return;
    let cancelled = false;
    setLoadingDetail(true);
    setLoadError(null);
    fetchChannelDetail(channelId)
      .then(detail => {
        if (cancelled) return;
        if (!detail) {
          setLoadError('Unable to load this channel’s settings. Please try again.');
          return;
        }
        setIsPublic(detail.is_public ?? true);
        const settings = detail.settings && typeof detail.settings === 'object' ? detail.settings : {};
        setRawSettings(settings);
        setCommentsRestricted(Boolean(settings.comments_restricted));
      })
      .catch(() => {
        if (!cancelled) setLoadError('Unable to load this channel’s settings. Please try again.');
      })
      .finally(() => {
        if (!cancelled) setLoadingDetail(false);
      });
    return () => {
      cancelled = true;
    };
  }, [channelId]);

  const handleToggleVisibility = useCallback(async (next: boolean) => {
    if (!channelId || savingField) return;
    const previous = isPublic;
    setIsPublic(next);
    setSavingField('visibility');
    setSaveError(null);
    try {
      const updated = await updateChannelDetail(channelId, { is_public: next });
      if (!updated) throw new Error('Unable to save this change. Please try again.');
      await onUpdated?.();
    } catch (err: any) {
      setIsPublic(previous);
      setSaveError(err?.message || 'Unable to save this change. Please try again.');
    } finally {
      setSavingField(null);
    }
  }, [channelId, isPublic, onUpdated, savingField]);

  const handleToggleComments = useCallback(async (next: boolean) => {
    if (!channelId || savingField) return;
    const previous = commentsRestricted;
    setCommentsRestricted(next);
    setSavingField('comments');
    setSaveError(null);
    try {
      const nextSettings = { ...rawSettings, comments_restricted: next };
      const updated = await updateChannelDetail(channelId, { settings: nextSettings });
      if (!updated) throw new Error('Unable to save this change. Please try again.');
      setRawSettings(nextSettings);
      await onUpdated?.();
    } catch (err: any) {
      setCommentsRestricted(previous);
      setSaveError(err?.message || 'Unable to save this change. Please try again.');
    } finally {
      setSavingField(null);
    }
  }, [channelId, commentsRestricted, onUpdated, rawSettings, savingField]);

  if (loadingDetail) {
    return (
      <View style={[styles.panel, { borderColor: palette.border, backgroundColor: palette.surface, alignItems: 'center', paddingVertical: 24 }]}>
        <ActivityIndicator color={palette.primaryStrong} />
        <Text style={[styles.loadingText, { color: palette.subtext, fontSize: bodyFontSize - 2 }]}>Loading settings…</Text>
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={[styles.panel, { borderColor: palette.border, backgroundColor: palette.surface }]}>
        <Text style={[styles.errorText, { color: palette.danger, fontSize: bodyFontSize - 1 }]}>{loadError}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.panel, { borderColor: palette.border, backgroundColor: palette.surface }]}>
      <Text style={[styles.title, { color: palette.text, fontSize: bodyFontSize + 3 }]}>Channel settings</Text>
      <Text style={[styles.subtitle, { color: palette.subtext, fontSize: bodyFontSize - 3 }]}>
        Who can see your channel, and who can comment on it.
      </Text>

      <View style={[styles.row, { borderColor: palette.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.rowLabel, { color: palette.text, fontSize: bodyFontSize }]}>Who can see this channel?</Text>
          <Text style={[styles.rowHelper, { color: palette.subtext, fontSize: bodyFontSize - 3 }]}>
            {isPublic
              ? 'Public — anyone can find, view, and subscribe to this channel.'
              : 'Private — only you and your channel managers can see it.'}
          </Text>
        </View>
        {savingField === 'visibility' ? (
          <ActivityIndicator color={palette.primaryStrong} />
        ) : (
          <Switch
            value={isPublic}
            onValueChange={handleToggleVisibility}
            accessibilityLabel="Public channel"
            accessibilityHint={isPublic ? 'Turn off to make this channel private' : 'Turn on to make this channel public'}
          />
        )}
      </View>

      <View style={[styles.row, { borderColor: palette.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.rowLabel, { color: palette.text, fontSize: bodyFontSize }]}>Who can comment?</Text>
          <Text style={[styles.rowHelper, { color: palette.subtext, fontSize: bodyFontSize - 3 }]}>
            {commentsRestricted
              ? 'Only you and your channel managers can comment.'
              : 'Anyone can comment on your published content.'}
          </Text>
        </View>
        {savingField === 'comments' ? (
          <ActivityIndicator color={palette.primaryStrong} />
        ) : (
          <Switch
            value={commentsRestricted}
            onValueChange={handleToggleComments}
            accessibilityLabel="Limit comments to channel managers"
            accessibilityHint={commentsRestricted ? 'Turn off to let anyone comment' : 'Turn on to limit comments to managers'}
          />
        )}
      </View>

      {saveError ? <Text style={[styles.errorText, { color: palette.danger, fontSize: bodyFontSize - 2 }]}>{saveError}</Text> : null}
    </View>
  );
}

function ChannelManagersSection({ channel }: { channel?: BroadcastChannelSummary | BroadcastChannelDetail | null }) {
  const { palette } = useKISTheme();
  const { bodyFontSize } = useResponsiveLayout();
  const channelId = channel?.id;
  const isOwner = channel?.viewer_role === 'owner';

  const [managers, setManagers] = useState<ChannelManager[]>([]);
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!channelId) return;
    setLoading(true);
    try {
      setManagers(await fetchChannelManagers(channelId));
    } finally {
      setLoading(false);
    }
  }, [channelId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAdd = useCallback(async () => {
    if (!channelId) return;
    const trimmed = phone.trim();
    if (!trimmed) {
      setAddError('Enter the phone number on their KIS account.');
      return;
    }
    setAdding(true);
    setAddError(null);
    try {
      await addChannelManager(channelId, trimmed);
      setPhone('');
      await load();
    } catch (err: any) {
      setAddError(err?.message || 'Unable to add this manager.');
    } finally {
      setAdding(false);
    }
  }, [channelId, phone, load]);

  const handleRemove = useCallback((manager: ChannelManager) => {
    if (!channelId) return;
    Alert.alert(
      'Remove this manager?',
      `${manager.display_name || 'This person'} will no longer be able to manage this channel.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setRemovingUserId(manager.user_id);
            try {
              const ok = await removeChannelManager(channelId, manager.user_id);
              if (ok) await load();
              else Alert.alert('Unable to remove', 'Please try again.');
            } finally {
              setRemovingUserId(null);
            }
          },
        },
      ],
    );
  }, [channelId, load]);

  if (loading) {
    return (
      <View style={[styles.panel, { borderColor: palette.border, backgroundColor: palette.surface, alignItems: 'center', paddingVertical: 20 }]}>
        <ActivityIndicator color={palette.primaryStrong} />
      </View>
    );
  }

  return (
    <View style={[styles.panel, { borderColor: palette.border, backgroundColor: palette.surface }]}>
      <Text style={[styles.title, { color: palette.text, fontSize: bodyFontSize + 3 }]}>Channel managers</Text>
      <Text style={[styles.subtitle, { color: palette.subtext, fontSize: bodyFontSize - 3 }]}>
        People who can manage this channel alongside you.
      </Text>

      {managers.map(manager => (
        <View key={manager.user_id} style={[styles.managerRow, { borderColor: palette.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowLabel, { color: palette.text, fontSize: bodyFontSize - 1 }]}>{manager.display_name || 'KIS user'}</Text>
            <Text style={[styles.rowHelper, { color: palette.subtext, fontSize: bodyFontSize - 3 }]}>
              {manager.role.replace(/^./, c => c.toUpperCase())}
            </Text>
          </View>
          {isOwner && manager.role !== 'owner' ? (
            removingUserId === manager.user_id ? (
              <ActivityIndicator color={palette.primaryStrong} />
            ) : (
              <Pressable onPress={() => handleRemove(manager)} accessibilityLabel={`Remove ${manager.display_name || 'this manager'}`} style={{ padding: 6 }}>
                <KISIcon name="trash" size={16} color={palette.danger} />
              </Pressable>
            )
          ) : null}
        </View>
      ))}

      {isOwner ? (
        <View style={{ marginTop: 10, gap: 8 }}>
          <Text style={[styles.rowLabel, { color: palette.text, fontSize: bodyFontSize - 1 }]}>Add a manager</Text>
          <Text style={[styles.rowHelper, { color: palette.subtext, fontSize: bodyFontSize - 3 }]}>
            Enter the phone number on their KIS account. They'll be able to manage this channel just like you.
          </Text>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="Phone number"
            placeholderTextColor={palette.subtext}
            keyboardType="phone-pad"
            style={[styles.phoneInput, { color: palette.text, borderColor: palette.border, backgroundColor: palette.card }]}
          />
          {addError ? <Text style={[styles.errorText, { color: palette.danger, fontSize: bodyFontSize - 2 }]}>{addError}</Text> : null}
          <KISButton title={adding ? 'Adding…' : 'Add manager'} onPress={handleAdd} disabled={adding} loading={adding} />
        </View>
      ) : null}
    </View>
  );
}

export { ChannelManagersSection };

const styles = StyleSheet.create({
  panel: { borderWidth: 1, borderRadius: 8, padding: 14, marginBottom: 12, gap: 4 },
  title: { fontWeight: '900' },
  subtitle: { marginTop: 3, marginBottom: 8, lineHeight: 16, fontWeight: '700' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12,
    borderTopWidth: 1,
  },
  rowLabel: { fontWeight: '800' },
  rowHelper: { marginTop: 3, lineHeight: 15, fontWeight: '600' },
  loadingText: { marginTop: 8, fontWeight: '700' },
  errorText: { marginTop: 8, fontWeight: '700' },
  managerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1 },
  phoneInput: { minHeight: 42, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, fontSize: 13, fontWeight: '700' },
});
