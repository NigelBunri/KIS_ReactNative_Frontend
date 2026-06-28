import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import Ionicons from 'react-native-vector-icons/Ionicons';

import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import usePullDownToClose from '@/hooks/usePullDownToClose';
import { patchRequest } from '@/network/patch';
import { uploadFileToBackend } from '@/Module/ChatRoom/uploadFileToBackend';
import { getAccessToken } from '@/security/authStorage';
import type { FeedPost } from './FeedScreen';

type Props = {
  visible: boolean;
  post: FeedPost | null;
  editEndpoint: (postId: string) => string;
  onClose: () => void;
  onUpdated: (updatedPost: Partial<FeedPost>) => void;
};

export default function FeedEditSheet({ visible, post, editEndpoint, onClose, onUpdated }: Props) {
  const { palette } = useKISTheme();
  const sheetY = useRef(new Animated.Value(600)).current;

  const [text, setText] = useState('');
  const [thumbUri, setThumbUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingThumb, setUploadingThumb] = useState(false);

  useEffect(() => {
    if (!visible || !post) return;
    setText(post.text_plain ?? post.text ?? post.styled_text?.text ?? '');
    const existingThumb =
      (Array.isArray(post.attachments) && post.attachments[0]?.thumb_url) ||
      (Array.isArray(post.attachments) && post.attachments[0]?.thumbUrl) ||
      null;
    setThumbUri(existingThumb ?? null);
    Animated.timing(sheetY, { toValue: 0, duration: 240, useNativeDriver: true }).start();
  }, [visible, post, sheetY]);

  const closeSheet = useCallback(() => {
    Animated.timing(sheetY, { toValue: 600, duration: 220, useNativeDriver: true }).start(() => {
      setText('');
      setThumbUri(null);
      onClose();
    });
  }, [sheetY, onClose]);

  const { dragY, panHandlers } = usePullDownToClose({ enabled: visible, onClose: closeSheet });

  const isVideo = useCallback(() => {
    if (!post?.attachments?.length) return false;
    const att = post.attachments[0];
    const kind = String(att?.kind ?? att?.mimeType ?? att?.type ?? '').toLowerCase();
    return kind.includes('video') || kind.includes('mp4');
  }, [post]);

  const pickThumbnail = useCallback(async () => {
    const result = await launchImageLibrary({ mediaType: 'photo', selectionLimit: 1, quality: 0.9 });
    if (result.didCancel || !result.assets?.length) return;
    const a = result.assets[0];
    if (!a?.uri) return;

    const token = await getAccessToken();
    if (!token) { Alert.alert('Not signed in', 'Please log in again.'); return; }

    try {
      setUploadingThumb(true);
      setThumbUri(a.uri);
      const uploaded = await uploadFileToBackend({
        file: { uri: a.uri, name: a.fileName ?? 'thumb.jpg', type: a.type ?? 'image/jpeg', size: a.fileSize },
        authToken: token,
      });
      setThumbUri(uploaded.url ?? a.uri);
    } catch {
      Alert.alert('Upload failed', 'Could not upload thumbnail.');
      setThumbUri(null);
    } finally {
      setUploadingThumb(false);
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!post || submitting) return;
    setSubmitting(true);
    try {
      const body: any = { text_plain: text.trim() || undefined };
      if (thumbUri) body.thumbnail_url = thumbUri;

      const res = await patchRequest(editEndpoint(post.id), body, {
        errorMessage: 'Unable to update post.',
      });

      if (!res.success) {
        Alert.alert('Error', res.message || 'Could not update the post.');
        return;
      }

      onUpdated({ id: post.id, text_plain: text.trim() || undefined });
      closeSheet();
    } finally {
      setSubmitting(false);
    }
  }, [post, submitting, text, thumbUri, editEndpoint, onUpdated, closeSheet]);

  if (!visible || !post) return null;

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={closeSheet}>
      <Pressable style={styles.backdrop} onPress={closeSheet} />
      <Animated.View
        style={[
          styles.sheet,
          { backgroundColor: palette.card, transform: [{ translateY: Animated.add(sheetY, dragY) }] },
        ]}
      >
        <View style={styles.sheetHeader} {...panHandlers}>
          <View style={[styles.handle, { backgroundColor: palette.divider }]} />
        </View>

        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: palette.text }]}>Edit post</Text>
          <Pressable onPress={closeSheet} hitSlop={10}>
            <KISIcon name="close" size={20} color={palette.subtext} />
          </Pressable>
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Caption/text edit */}
          <Text style={[styles.label, { color: palette.subtext }]}>Caption</Text>
          <View style={[styles.inputWrap, { borderColor: palette.inputBorder, backgroundColor: palette.surface }]}>
            <TextInput
              value={text}
              onChangeText={setText}
              multiline
              placeholder="Write something…"
              placeholderTextColor={palette.subtext}
              style={[styles.input, { color: palette.text }]}
            />
          </View>

          {/* Thumbnail picker (video posts only) */}
          {isVideo() && (
            <>
              <Text style={[styles.label, { color: palette.subtext, marginTop: 16 }]}>Video thumbnail</Text>

              {thumbUri ? (
                <View style={styles.thumbRow}>
                  <Image
                    source={{ uri: thumbUri }}
                    style={[styles.thumbPreview, { borderColor: palette.inputBorder }]}
                    resizeMode="cover"
                  />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.thumbLabel, { color: palette.text }]}>Thumbnail selected</Text>
                    <Text style={[styles.thumbSub, { color: palette.subtext }]}>
                      {uploadingThumb ? 'Uploading…' : 'Tap to change'}
                    </Text>
                  </View>
                  <Pressable
                    onPress={pickThumbnail}
                    style={[styles.changeBtn, { borderColor: palette.inputBorder }]}
                  >
                    <Ionicons name="image-outline" size={18} color={palette.primary} />
                  </Pressable>
                  <Pressable
                    onPress={() => setThumbUri(null)}
                    style={[styles.changeBtn, { borderColor: palette.inputBorder, marginLeft: 6 }]}
                  >
                    <KISIcon name="close" size={16} color={palette.subtext} />
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  onPress={pickThumbnail}
                  style={[styles.pickThumbBtn, { borderColor: palette.inputBorder, backgroundColor: palette.surface }]}
                >
                  <View style={[styles.thumbIconChip, { backgroundColor: palette.primary }]}>
                    <Ionicons name="image-outline" size={18} color={palette.onPrimary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.pickThumbLabel, { color: palette.text }]}>Pick thumbnail</Text>
                    <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 2 }}>
                      {uploadingThumb ? 'Uploading…' : 'Choose a cover image from your device'}
                    </Text>
                  </View>
                </Pressable>
              )}
            </>
          )}

          {/* Save button */}
          <Pressable
            onPress={submitting ? undefined : handleSave}
            style={[
              styles.saveBtn,
              { backgroundColor: palette.primary, opacity: submitting ? 0.7 : 1 },
            ]}
          >
            {submitting ? (
              <ActivityIndicator color={palette.onPrimary} />
            ) : (
              <Text style={[styles.saveBtnText, { color: palette.onPrimary }]}>Save changes</Text>
            )}
          </Pressable>
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#00000066' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 16,
    maxHeight: '85%',
  },
  sheetHeader: { alignItems: 'center', paddingBottom: 8 },
  handle: { width: 38, height: 4, borderRadius: 999 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  title: { fontSize: 17, fontWeight: '800' },
  scroll: { paddingBottom: 32 },

  label: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  inputWrap: {
    borderWidth: 2,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 80,
  },
  input: { fontSize: 15, lineHeight: 22, textAlignVertical: 'top' },

  thumbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    overflow: 'visible',
  },
  thumbPreview: {
    width: 72,
    height: 72,
    borderRadius: 12,
    borderWidth: 2,
  },
  thumbLabel: { fontSize: 14, fontWeight: '700' },
  thumbSub: { fontSize: 12, marginTop: 2 },
  changeBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  pickThumbBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 1 },
      default: {},
    }),
  },
  thumbIconChip: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickThumbLabel: { fontSize: 15, fontWeight: '700' },

  saveBtn: {
    marginTop: 20,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnText: { fontSize: 15, fontWeight: '800' },
});
