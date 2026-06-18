// src/screens/broadcast/channels/studio/ProductTagStudio.tsx
//
// Product tagging interface — tag products at specific timestamps in content.

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';

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
  const [formThumb, setFormThumb] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formTimestamp, setFormTimestamp] = useState('');

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
        <TextInput
          value={formThumb}
          onChangeText={setFormThumb}
          placeholder="Thumbnail URL (optional)"
          placeholderTextColor={palette.subtext}
          autoCapitalize="none"
          keyboardType="url"
          style={[styles.input, { color: palette.text, borderColor: palette.border }]}
        />
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
