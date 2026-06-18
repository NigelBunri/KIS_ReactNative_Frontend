import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import KISTextInput from '@/constants/KISTextInput';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import type { BroadcastChannelSummary } from '@/screens/broadcast/channels/api/channels.types';
import { updateChannelDetail } from '@/screens/broadcast/channels/hooks/useChannelsData';

type Props = {
  channel?: BroadcastChannelSummary | null;
  onUpdated?: () => void | Promise<void>;
};

export default function ChannelBrandingEditor({ channel, onUpdated }: Props) {
  const { palette } = useKISTheme();
  const { minTouchTarget, bodyFontSize } = useResponsiveLayout();
  const [displayName, setDisplayName] = useState(channel?.display_name || '');
  const [handle, setHandle] = useState(channel?.handle || '');
  const [description, setDescription] = useState(channel?.description || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDisplayName(channel?.display_name || '');
    setHandle(channel?.handle || '');
    setDescription(channel?.description || '');
  }, [channel?.id, channel?.display_name, channel?.handle, channel?.description]);

  const dirty =
    displayName.trim() !== (channel?.display_name || '') ||
    handle.trim() !== (channel?.handle || '') ||
    description.trim() !== (channel?.description || '');

  const handleSave = useCallback(async () => {
    if (!channel?.id) return;
    if (!displayName.trim()) {
      Alert.alert('Validation', 'Display name is required.');
      return;
    }
    if (!handle.trim()) {
      Alert.alert('Validation', 'Channel handle is required.');
      return;
    }
    setSaving(true);
    try {
      const updated = await updateChannelDetail(channel.id, {
        display_name: displayName.trim(),
        handle: handle.trim(),
        description: description.trim(),
      });
      if (updated) {
        await onUpdated?.();
      } else {
        Alert.alert('Error', 'Could not save branding changes. Please try again.');
      }
    } catch {
      Alert.alert('Error', 'Could not save branding changes. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [channel?.id, displayName, handle, description, onUpdated]);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <View style={[styles.panel, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <Text style={[styles.title, { color: palette.text, fontSize: bodyFontSize + 3 }]}>Branding</Text>
        <Text style={[styles.subtitle, { color: palette.subtext, fontSize: bodyFontSize - 3 }]}>Channel name, handle, and public identity.</Text>
        <KISTextInput label="Display name" value={displayName} onChangeText={setDisplayName} placeholder="Channel display name" />
        <KISTextInput
          label="Handle"
          value={handle}
          onChangeText={text => setHandle(text.replace(/^@/, ''))}
          placeholder="channel-handle"
          autoCapitalize="none"
        />
        <KISTextInput label="Description" value={description} onChangeText={setDescription} multiline style={{ minHeight: 70 }} />
        <Pressable
          onPress={handleSave}
          disabled={saving || !dirty}
          style={[
            styles.saveBtn,
            {
              backgroundColor: palette.primaryStrong,
              minHeight: minTouchTarget,
              opacity: saving || !dirty ? 0.6 : 1,
            },
          ]}
        >
          {saving ? (
            <ActivityIndicator size="small" color={palette.onPrimary} />
          ) : (
            <Text style={[styles.saveBtnText, { color: palette.onPrimary, fontSize: bodyFontSize - 1 }]}>Save changes</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  panel: { borderWidth: 1, borderRadius: 8, padding: 14, marginBottom: 12, gap: 10 },
  title: { fontWeight: '900' },
  subtitle: { marginTop: 3, marginBottom: 4, lineHeight: 16, fontWeight: '700' },
  saveBtn: { borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  saveBtnText: { fontWeight: '800' },
});
