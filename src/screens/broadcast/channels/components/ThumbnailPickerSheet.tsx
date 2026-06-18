import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { launchImageLibrary, Asset } from 'react-native-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKISTheme } from '@/theme/useTheme';
import { patchRequest } from '@/network/patch';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';

type Props = {
  visible: boolean;
  contentId: string;
  currentThumbnailUrl?: string;
  onClose: () => void;
  onUpdated?: (newThumbnailUrl: string) => void;
};

const guessMime = (uri: string): string => {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
};

export default function ThumbnailPickerSheet({
  visible,
  contentId,
  currentThumbnailUrl,
  onClose,
  onUpdated,
}: Props) {
  const { palette } = useKISTheme();
  const insets = useSafeAreaInsets();
  const [picked, setPicked] = useState<Asset | null>(null);
  const [saving, setSaving] = useState(false);

  const handlePick = async () => {
    const result = await launchImageLibrary({
      mediaType: 'photo',
      quality: 1,
      selectionLimit: 1,
    });
    if (result.didCancel || !result.assets?.length) return;
    setPicked(result.assets[0] ?? null);
  };

  const handleSave = async () => {
    const asset = picked;
    if (!asset?.uri) return;
    setSaving(true);
    try {
      // Step 1: upload the raw image bytes to get a hosted URL.
      const uploadForm = new FormData();
      const name = asset.fileName ?? `thumbnail_${Date.now()}.jpg`;
      const type = asset.type ?? guessMime(asset.uri);
      uploadForm.append('attachment', { uri: asset.uri, name, type } as any);

      const uploadRes = await postRequest(ROUTES.broadcasts.profileAttachment, uploadForm, {
        errorMessage: 'Failed to upload thumbnail image.',
      });

      const uploadedUrl: string = uploadRes?.data?.attachment?.url ?? '';
      if (!uploadRes.success || !uploadedUrl) {
        Alert.alert('Error', uploadRes.message ?? 'Failed to upload thumbnail image.');
        return;
      }

      // Step 2: point the content's thumbnail_url at the uploaded image.
      const detailUrl = ROUTES.broadcasts.channelContentDetail?.(contentId);
      if (!detailUrl) throw new Error('No content detail route');

      const res = await patchRequest(detailUrl, { thumbnail_url: uploadedUrl }, {
        errorMessage: 'Failed to update thumbnail.',
      });

      if (!res.success) {
        Alert.alert('Error', res.message ?? 'Failed to update thumbnail.');
        return;
      }

      const newUrl: string =
        res.data?.thumbnail_url ?? uploadedUrl;
      onUpdated?.(newUrl);
      setPicked(null);
      onClose();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to update thumbnail.');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (saving) return;
    setPicked(null);
    onClose();
  };

  const previewUri = picked?.uri ?? currentThumbnailUrl;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <Pressable style={[styles.backdrop, { backgroundColor: palette.royalInk, opacity: 0.6 }]} onPress={handleClose} />
      <View style={[styles.sheet, { backgroundColor: palette.surface, borderColor: palette.border, paddingBottom: 32 + insets.bottom }]}>
        <View style={[styles.handle, { backgroundColor: palette.border }]} />

        <Text style={[styles.title, { color: palette.text }]}>Change thumbnail</Text>

        {/* 16:9 preview */}
        <View style={[styles.previewBox, { backgroundColor: palette.royalInk, borderColor: palette.border }]}>
          {previewUri ? (
            <Image source={{ uri: previewUri }} style={styles.previewImage} resizeMode="cover" />
          ) : (
            <Text style={[styles.noThumb, { color: palette.subtext }]}>No thumbnail</Text>
          )}
        </View>

        <Pressable
          onPress={handlePick}
          style={[styles.pickButton, { borderColor: palette.primaryStrong }]}
        >
          <Text style={[styles.pickText, { color: palette.primaryStrong }]}>
            {picked ? 'Choose a different image' : 'Choose from library'}
          </Text>
        </Pressable>

        {picked && (
          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={[styles.saveButton, { backgroundColor: palette.primaryStrong, opacity: saving ? 0.7 : 1 }]}
          >
            {saving ? (
              <ActivityIndicator size="small" color={palette.surface} />
            ) : (
              <Text style={[styles.saveText, { color: palette.surface }]}>Save thumbnail</Text>
            )}
          </Pressable>
        )}

        <Pressable onPress={handleClose} style={styles.cancelButton} disabled={saving}>
          <Text style={[styles.cancelText, { color: palette.subtext }]}>Cancel</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 14,
  },
  previewBox: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  noThumb: {
    fontSize: 13,
    fontWeight: '700',
  },
  pickButton: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  pickText: {
    fontSize: 14,
    fontWeight: '800',
  },
  saveButton: {
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: 10,
  },
  saveText: {
    fontSize: 14,
    fontWeight: '900',
  },
  cancelButton: {
    paddingVertical: 10,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
