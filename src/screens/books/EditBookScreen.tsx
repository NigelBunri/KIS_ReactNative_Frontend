import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import KISButton from '@/constants/KISButton';
import { getRequest } from '@/network/get';
import { patchRequest } from '@/network/patch';
import { deleteRequest } from '@/network/delete';
import ROUTES from '@/network';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'EditBook'>;

const CATEGORIES: { key: string; label: string }[] = [
  { key: 'bible_study', label: 'Bible studies' },
  { key: 'theology', label: 'Theology & doctrine' },
  { key: 'discipleship', label: 'Discipleship' },
  { key: 'devotional', label: 'Devotionals' },
  { key: 'biography', label: 'Biography & testimony' },
  { key: 'fiction', label: 'Christian fiction' },
  { key: 'children', label: "Children's" },
  { key: 'family', label: 'Marriage & family' },
  { key: 'leadership', label: 'Leadership & ministry' },
  { key: 'apologetics', label: 'Apologetics' },
  { key: 'church_history', label: 'Church history' },
  { key: 'counseling', label: 'Counseling' },
  { key: 'living', label: 'Christian living' },
  { key: 'worship', label: 'Worship & hymns' },
  { key: 'other', label: 'Other' },
];

export default function EditBookScreen({ navigation, route }: Props) {
  const { id } = route.params;
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const sp = layout.pageGutter;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('draft');

  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('other');
  const [isFree, setIsFree] = useState(true);
  const [priceInput, setPriceInput] = useState('0');

  const load = useCallback(async () => {
    setLoading(true);
    const res: any = await getRequest(ROUTES.books.mineDetail(id));
    if (res?.success) {
      const b = res.data;
      setTitle(b.title || '');
      setSubtitle(b.subtitle || '');
      setAuthorName(b.author_name || '');
      setDescription(b.description || '');
      setCategory(b.christian_category || 'other');
      setIsFree(!!b.is_free);
      setPriceInput(String(((b.price_cents || 0) / 100).toFixed(2)));
      setStatus(b.status || 'draft');
    } else {
      Alert.alert('Error', res?.message || 'Could not load this book.');
    }
    setLoading(false);
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // A book under moderation review is locked server-side too
  // (AuthorBookDetailView.patch rejects edits in that state) — mirroring
  // it here means the Save button fails fast with a clear reason instead
  // of a round-trip just to find out.
  const isLocked = status === 'pending_review' || status === 'under_review';

  const handleSave = async () => {
    if (!title.trim() || !authorName.trim()) {
      Alert.alert('Missing info', 'Title and author name are required.');
      return;
    }
    const priceCents = Math.round(parseFloat(priceInput || '0') * 100) || 0;
    if (!isFree && priceCents <= 0) {
      Alert.alert('Set a price', 'Paid books need a price greater than zero, or switch to Free.');
      return;
    }
    setSaving(true);
    const res: any = await patchRequest(ROUTES.books.mineDetail(id), {
      title: title.trim(),
      subtitle: subtitle.trim(),
      author_name: authorName.trim(),
      description: description.trim(),
      christian_category: category,
      is_free: isFree,
      price_cents: isFree ? 0 : priceCents,
    });
    setSaving(false);
    if (res?.success) {
      const wasPublished = status === 'published';
      Alert.alert(
        'Saved',
        wasPublished ? 'Your changes were saved and this book is back under review before going live again.' : 'Your changes were saved.',
      );
      navigation.goBack();
    } else {
      Alert.alert('Could not save', res?.message || 'Please try again.');
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete draft', 'This permanently deletes this draft. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteRequest(ROUTES.books.mineDetail(id));
          navigation.goBack();
        },
      },
    ]);
  };

  const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: palette.bg },
    header: { flexDirection: 'row', alignItems: 'center', padding: sp, gap: 10 },
    headerTitle: { fontSize: 18, fontWeight: '700', color: palette.text, flex: 1 },
    content: { padding: sp, gap: 14 },
    lockedBox: { backgroundColor: palette.primarySoft, borderRadius: 12, padding: 14 },
    lockedText: { fontSize: 13, color: palette.text },
    label: { fontSize: 13, fontWeight: '700', color: palette.subtext },
    input: {
      borderWidth: 1, borderColor: palette.divider, borderRadius: 10, padding: 12,
      color: palette.text, fontSize: 15,
    },
    categoryWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    pill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, borderWidth: 1, borderColor: palette.divider },
    pillActive: { backgroundColor: palette.primary, borderColor: palette.primary },
    pillText: { color: palette.text, fontSize: 13 },
    pillTextActive: { color: palette.ivory, fontWeight: '700' },
    priceRow: { flexDirection: 'row', gap: 8 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    deleteLink: { color: '#B23B3B', fontWeight: '700', textAlign: 'center', marginTop: 8 },
  });

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}><ActivityIndicator size="large" color={palette.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} accessibilityLabel="Go back">
          <KISIcon name="back" size={22} color={palette.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Edit Book</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {isLocked && (
          <View style={styles.lockedBox}>
            <Text style={styles.lockedText}>
              This book is currently under review. You can still view these details, but changes will fail to save until a decision is made.
            </Text>
          </View>
        )}

        <Text style={styles.label}>Title</Text>
        <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Book title" placeholderTextColor={palette.subtext} />

        <Text style={styles.label}>Subtitle</Text>
        <TextInput style={styles.input} value={subtitle} onChangeText={setSubtitle} placeholder="Optional subtitle" placeholderTextColor={palette.subtext} />

        <Text style={styles.label}>Author name</Text>
        <TextInput style={styles.input} value={authorName} onChangeText={setAuthorName} placeholder="Byline shown to readers" placeholderTextColor={palette.subtext} />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, { minHeight: 90, textAlignVertical: 'top' }]}
          value={description}
          onChangeText={setDescription}
          placeholder="What is this book about?"
          placeholderTextColor={palette.subtext}
          multiline
        />

        <Text style={styles.label}>Category</Text>
        <View style={styles.categoryWrap}>
          {CATEGORIES.map((c) => (
            <Pressable key={c.key} style={[styles.pill, category === c.key && styles.pillActive]} onPress={() => setCategory(c.key)}>
              <Text style={[styles.pillText, category === c.key && styles.pillTextActive]}>{c.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Pricing</Text>
        <View style={styles.priceRow}>
          <Pressable style={[styles.pill, isFree && styles.pillActive]} onPress={() => setIsFree(true)}>
            <Text style={[styles.pillText, isFree && styles.pillTextActive]}>Free</Text>
          </Pressable>
          <Pressable style={[styles.pill, !isFree && styles.pillActive]} onPress={() => setIsFree(false)}>
            <Text style={[styles.pillText, !isFree && styles.pillTextActive]}>Paid</Text>
          </Pressable>
        </View>
        {!isFree && (
          <TextInput
            style={styles.input}
            value={priceInput}
            onChangeText={setPriceInput}
            placeholder="0.00"
            placeholderTextColor={palette.subtext}
            keyboardType="decimal-pad"
          />
        )}

        <KISButton title="Save changes" variant="primary" loading={saving} onPress={handleSave} />

        {status === 'draft' && (
          <Pressable onPress={handleDelete} hitSlop={8}>
            <Text style={styles.deleteLink}>Delete this draft</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
