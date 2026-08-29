// src/screens/broadcast/channels/studio/ProductTagStudio.tsx
//
// Product tagging interface — tag products at specific timestamps in content.

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import ROUTES, { NEST_API_BASE_URL } from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { uploadFileToBackend } from '@/Module/ChatRoom/uploadFileToBackend';

// ── Types ──────────────────────────────────────────────────────────────────────

type ProductTag = {
  id: string;
  title: string;
  product_url: string;
  thumbnail_url?: string;
  price_display?: string;
  timestamp_seconds: number;
};

type Props = {
  contentId: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const formatTimestamp = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function ProductTagStudio({ contentId }: Props) {
  const { palette } = useKISTheme();
  const [tags, setTags] = useState<ProductTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formUrl, setFormUrl] = useState('');
  // Holds the already-uploaded thumbnail's hosted URL, same shape as
  // ThumbnailPickerSheet.tsx's handleSave - picking replaces this with a
  // fresh upload rather than letting the user type/paste an arbitrary URL.
  const [formThumb, setFormThumb] = useState('');
  const [thumbUploading, setThumbUploading] = useState(false);
  const [formPrice, setFormPrice] = useState('');
  const [formTimestamp, setFormTimestamp] = useState('');

  const guessMime = (uri: string): string => {
    const lower = uri.toLowerCase();
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.webp')) return 'image/webp';
    return 'image/jpeg';
  };

  const pickThumbnail = useCallback(async () => {
    const result = await launchImageLibrary({ mediaType: 'photo', quality: 1, selectionLimit: 1 });
    if (result.didCancel || !result.assets?.length) return;
    const asset = result.assets[0];
    if (!asset?.uri) return;
    setThumbUploading(true);
    try {
      // Direct-to-S3 via Nest — this picker is mediaType: 'photo' only, so
      // there's no video-processing dependency keeping it on Django.
      const name = asset.fileName ?? `product_thumb_${Date.now()}.jpg`;
      const type = asset.type ?? guessMime(asset.uri);
      const attachment = await uploadFileToBackend({
        file: { uri: asset.uri, name, type },
        baseUrl: NEST_API_BASE_URL,
        context: 'product_thumbnail',
      });
      const uploadedUrl = attachment?.url || attachment?.displayUrl || '';
      if (!uploadedUrl) {
        Alert.alert('Error', 'Failed to upload thumbnail image.');
        return;
      }
      setFormThumb(uploadedUrl);
    } catch {
      Alert.alert('Error', 'Failed to upload thumbnail image.');
    } finally {
      setThumbUploading(false);
    }
  }, []);

  const fetchTags = useCallback(async () => {
    if (!contentId) return;
    setLoading(true);
    try {
      const res = await getRequest(
        ROUTES.broadcasts.contentProducts(contentId),
        { errorMessage: '' },
      );
      const raw: ProductTag[] = Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
        ? res.data
        : res?.results ?? [];
      setTags(raw);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [contentId]);

  useEffect(() => {
    void fetchTags();
  }, [fetchTags]);

  const resetForm = () => {
    setFormTitle('');
    setFormUrl('');
    setFormThumb('');
    setFormPrice('');
    setFormTimestamp('');
  };

  const handleAdd = useCallback(async () => {
    if (!formTitle.trim()) {
      Alert.alert('Validation', 'Product title is required.');
      return;
    }
    if (!formUrl.trim()) {
      Alert.alert('Validation', 'Product URL is required.');
      return;
    }
    const ts = parseInt(formTimestamp, 10);
    if (isNaN(ts) || ts < 0) {
      Alert.alert('Validation', 'Enter a valid timestamp in seconds (e.g. 120 for 2:00).');
      return;
    }
    setSaving(true);
    try {
      const res = await postRequest(
        ROUTES.broadcasts.contentProducts(contentId),
        {
          title: formTitle.trim(),
          product_url: formUrl.trim(),
          thumbnail_url: formThumb.trim() || undefined,
          price_display: formPrice.trim() || undefined,
          timestamp_seconds: ts,
        },
        { errorMessage: 'Could not add product tag.' },
      );
      if (res?.data || res?.id) {
        resetForm();
        await fetchTags();
      } else {
        Alert.alert('Error', res?.message ?? 'Could not add product tag.');
      }
    } catch {
      Alert.alert('Error', 'Could not add product tag. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [contentId, fetchTags, formPrice, formThumb, formTimestamp, formTitle, formUrl]);

  const handleRemove = useCallback(async (tag: ProductTag) => {
    Alert.alert('Remove product tag?', `Remove "${tag.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setRemovingId(tag.id);
          try {
            await postRequest(
              `${ROUTES.broadcasts.contentProducts(contentId)}${tag.id}/remove/`,
              {},
              { errorMessage: '' },
            ).catch(() => {});
            await fetchTags();
          } finally {
            setRemovingId(null);
          }
        },
      },
    ]);
  }, [contentId, fetchTags]);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: palette.surface }]}
      contentContainerStyle={styles.content}
    >
      {/* Add form */}
      <View style={[styles.formCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <Text style={[styles.formTitle, { color: palette.text }]}>Add Product Tag</Text>

        <TextInput
          value={formTitle}
          onChangeText={setFormTitle}
          placeholder="Product title"
          placeholderTextColor={palette.subtext}
          style={[styles.input, { color: palette.text, borderColor: palette.border }]}
        />
        <TextInput
          value={formUrl}
          onChangeText={setFormUrl}
          placeholder="Product URL (https://...)"
          placeholderTextColor={palette.subtext}
          autoCapitalize="none"
          keyboardType="url"
          style={[styles.input, { color: palette.text, borderColor: palette.border }]}
        />
        {formThumb ? (
          <View style={[styles.thumbPreviewRow, { borderColor: palette.border }]}>
            <Image source={{ uri: formThumb }} style={styles.thumbPreviewImage} resizeMode="cover" />
            <Pressable onPress={pickThumbnail} style={styles.thumbPreviewBtn} disabled={thumbUploading}>
              <Text style={{ color: palette.primaryStrong, fontWeight: '700', fontSize: 12 }}>Change</Text>
            </Pressable>
            <Pressable onPress={() => setFormThumb('')} style={styles.thumbPreviewBtn} disabled={thumbUploading}>
              <KISIcon name="close" size={16} color={palette.subtext} />
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={pickThumbnail}
            disabled={thumbUploading}
            style={[styles.thumbPickBtn, { borderColor: palette.border }]}
          >
            {thumbUploading ? (
              <ActivityIndicator size="small" color={palette.primaryStrong} />
            ) : (
              <>
                <KISIcon name="image" size={16} color={palette.subtext} />
                <Text style={{ color: palette.subtext, fontSize: 13 }}>Pick thumbnail image (optional)</Text>
              </>
            )}
          </Pressable>
        )}
        <TextInput
          value={formPrice}
          onChangeText={setFormPrice}
          placeholder="Price (e.g. $29.99)"
          placeholderTextColor={palette.subtext}
          style={[styles.input, { color: palette.text, borderColor: palette.border }]}
        />
        <TextInput
          value={formTimestamp}
          onChangeText={setFormTimestamp}
          placeholder="Timestamp in seconds (e.g. 120 = 2:00)"
          placeholderTextColor={palette.subtext}
          keyboardType="number-pad"
          style={[styles.input, { color: palette.text, borderColor: palette.border }]}
        />

        <Pressable
          onPress={handleAdd}
          disabled={saving}
          style={[styles.addBtn, { backgroundColor: palette.primaryStrong }]}
        >
          {saving ? (
            <ActivityIndicator size="small" color={palette.ivory} />
          ) : (
            <Text style={[styles.addBtnText, { color: palette.onPrimary }]}>Tag Product</Text>
          )}
        </Pressable>
      </View>

      {/* Tags list */}
      <Text style={[styles.sectionTitle, { color: palette.text }]}>
        Current Tags ({loading ? '...' : tags.length})
      </Text>

      {loading ? (
        <ActivityIndicator color={palette.primaryStrong} style={{ alignSelf: 'center' }} />
      ) : tags.length === 0 ? (
        <View style={[styles.emptyState, { borderColor: palette.border, backgroundColor: palette.card }]}>
          <Text style={[styles.emptyText, { color: palette.subtext }]}>
            No product tags yet.
          </Text>
        </View>
      ) : (
        tags.map(tag => (
          <View
            key={tag.id}
            style={[styles.tagCard, { backgroundColor: palette.card, borderColor: palette.border }]}
          >
            <View style={styles.tagInfo}>
              <Text numberOfLines={1} style={[styles.tagTitle, { color: palette.text }]}>
                {tag.title}
              </Text>
              {tag.price_display ? (
                <Text style={[styles.tagPrice, { color: palette.primaryStrong }]}>
                  {tag.price_display}
                </Text>
              ) : null}
              <Text style={[styles.tagTimestamp, { color: palette.subtext }]}>
                @ {formatTimestamp(tag.timestamp_seconds)} ({tag.timestamp_seconds}s)
              </Text>
            </View>
            <Pressable
              onPress={() => handleRemove(tag)}
              disabled={removingId === tag.id}
              style={styles.removeBtn}
            >
              {removingId === tag.id ? (
                <ActivityIndicator size="small" color={palette.subtext} />
              ) : (
                <Text style={[styles.removeBtnText, { color: palette.danger }]}>Remove</Text>
              )}
            </Pressable>
          </View>
        ))
      )}
    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  formCard: { borderWidth: 1, borderRadius: 10, padding: 14, gap: 10 },
  formTitle: { fontSize: 15, fontWeight: '800', marginBottom: 2 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },
  thumbPickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 44,
  },
  thumbPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
  },
  thumbPreviewImage: { width: 44, height: 44, borderRadius: 6 },
  thumbPreviewBtn: { paddingHorizontal: 8, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  addBtn: {
    borderRadius: 8,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  addBtnText: { fontWeight: '800', fontSize: 14 },
  sectionTitle: { fontSize: 14, fontWeight: '800' },
  tagCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    gap: 10,
  },
  tagInfo: { flex: 1, gap: 2 },
  tagTitle: { fontSize: 13, fontWeight: '800' },
  tagPrice: { fontSize: 12, fontWeight: '700' },
  tagTimestamp: { fontSize: 11, fontWeight: '600' },
  removeBtn: { paddingHorizontal: 10, paddingVertical: 6, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  removeBtnText: { fontSize: 12, fontWeight: '800' },
  emptyState: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 24,
    alignItems: 'center',
  },
  emptyText: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
});
