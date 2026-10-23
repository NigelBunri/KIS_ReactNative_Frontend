import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import KISTextInput from '@/constants/KISTextInput';
import { KISIcon } from '@/constants/kisIcons';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import type { BroadcastChannelSummary } from '@/screens/broadcast/channels/api/channels.types';
import { updateChannelDetail } from '@/screens/broadcast/channels/hooks/useChannelsData';
import { resolveBackendAssetUrl } from '@/network';
import ChannelAvatar from '@/components/broadcast/ChannelAvatar';
import PermanentRemoteImage from '@/components/media/PermanentRemoteImage';
import {
  uploadChannelBrandingImage,
  type ChannelBrandingImageKind,
} from '@/services/uploadChannelBrandingImage';

type Props = {
  channel?: BroadcastChannelSummary | null;
  onUpdated?: () => void | Promise<void>;
};

function ChannelImagePicker({
  kind,
  channel,
  onUploaded,
}: {
  kind: ChannelBrandingImageKind;
  channel?: BroadcastChannelSummary | null;
  onUploaded: () => void | Promise<void>;
}) {
  const { palette } = useKISTheme();
  const { bodyFontSize } = useResponsiveLayout();
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const isAvatar = kind === 'avatar';
  const hasExisting = isAvatar ? channel?.avatar_kind === 'photo' : Boolean(channel?.banner_url);

  const handlePick = useCallback(async () => {
    if (!channel?.id || uploading) return;
    const picked = await launchImageLibrary({ mediaType: 'photo', selectionLimit: 1, quality: 0.9 });
    if (picked.didCancel) return;
    const asset = picked.assets?.[0];
    if (!asset?.uri) return;

    setLocalPreview(asset.uri);
    setUploading(true);
    setProgress(0);
    try {
      await uploadChannelBrandingImage({
        channelId: channel.id,
        kind,
        file: { uri: asset.uri, name: asset.fileName, type: asset.type, size: asset.fileSize },
        onProgress: update => setProgress(update.progress),
      });
      await onUploaded();
    } catch (err: any) {
      Alert.alert('Upload failed', err?.message || `Unable to upload this ${isAvatar ? 'logo' : 'cover image'}.`);
    } finally {
      setUploading(false);
      setLocalPreview(null);
    }
  }, [channel?.id, kind, isAvatar, uploading, onUploaded]);

  const label = isAvatar ? 'Logo' : 'Cover image';
  const actionLabel = hasExisting || localPreview ? `Change ${isAvatar ? 'logo' : 'cover image'}` : `Add ${isAvatar ? 'a logo' : 'a cover image'}`;

  return (
    <View style={styles.imagePickerRow}>
      <Pressable
        onPress={handlePick}
        disabled={uploading}
        accessibilityRole="button"
        accessibilityLabel={`${actionLabel} for ${channel?.display_name || 'this channel'}`}
        style={({ pressed }) => [
          isAvatar ? styles.avatarPreviewWrap : styles.bannerPreviewWrap,
          { borderColor: palette.border, backgroundColor: palette.surface },
          pressed && !uploading && { opacity: 0.85 },
        ]}
      >
        {localPreview ? (
          // The freshly-picked file is already on-device — a plain Image,
          // not PermanentRemoteImage (which treats its `uri` as something
          // to download/cache from a remote backend, wrong for a local
          // file:// picker URI that was never fetched from anywhere).
          <Image source={{ uri: localPreview }} style={isAvatar ? styles.avatarPreviewWrap : styles.bannerPreviewWrap} resizeMode="cover" />
        ) : isAvatar ? (
          <ChannelAvatar channel={channel} size={72} />
        ) : channel?.banner_url ? (
          <PermanentRemoteImage
            uri={resolveBackendAssetUrl(channel.banner_url)}
            domain="Broadcast"
            stableKey={`channel_banner_edit_${channel.id}`}
            containerStyle={styles.bannerPreviewWrap}
            resizeMode="cover"
          />
        ) : (
          <Text style={[styles.noImageText, { color: palette.subtext, fontSize: bodyFontSize - 3 }]}>No cover image yet</Text>
        )}

        {uploading ? (
          <View style={[styles.uploadOverlay, isAvatar ? { borderRadius: 36 } : null]}>
            <ActivityIndicator size="small" color="#fff" />
            <Text style={styles.uploadOverlayText}>{Math.round(progress * 100)}%</Text>
          </View>
        ) : (
          <View style={[styles.editBadge, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <KISIcon name="edit" size={13} color={palette.primaryStrong} />
          </View>
        )}
      </Pressable>

      <View style={{ flex: 1 }}>
        <Text style={[styles.imagePickerLabel, { color: palette.text, fontSize: bodyFontSize - 1 }]}>{label}</Text>
        <Text style={[styles.imagePickerHint, { color: palette.subtext, fontSize: bodyFontSize - 3 }]}>
          {isAvatar
            ? 'Shown wherever this channel appears. Square images work best.'
            : 'Shown at the top of your channel page. Wide images work best.'}
        </Text>
        <Pressable onPress={handlePick} disabled={uploading} accessibilityRole="button">
          <Text style={[styles.imagePickerAction, { color: uploading ? palette.subtext : palette.primaryStrong, fontSize: bodyFontSize - 2 }]}>
            {uploading ? 'Uploading…' : actionLabel}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

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

        <ChannelImagePicker kind="avatar" channel={channel} onUploaded={async () => { await onUpdated?.(); }} />
        <ChannelImagePicker kind="banner" channel={channel} onUploaded={async () => { await onUpdated?.(); }} />

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
  imagePickerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
  avatarPreviewWrap: {
    width: 72, height: 72, borderRadius: 36, borderWidth: 1, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  bannerPreviewWrap: {
    width: 108, height: 64, borderRadius: 8, borderWidth: 1, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  noImageText: { textAlign: 'center', paddingHorizontal: 6, fontWeight: '700' },
  editBadge: {
    position: 'absolute', bottom: 2, right: 2, width: 22, height: 22, borderRadius: 11,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
  },
  uploadOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', gap: 2,
  },
  uploadOverlayText: { color: '#fff', fontWeight: '800', fontSize: 11 },
  imagePickerLabel: { fontWeight: '800' },
  imagePickerHint: { marginTop: 2, lineHeight: 15, fontWeight: '600' },
  imagePickerAction: { marginTop: 6, fontWeight: '800' },
});
