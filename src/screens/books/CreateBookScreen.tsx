import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import KISButton from '@/constants/KISButton';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateBook'>;

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

export default function CreateBookScreen({ navigation }: Props) {
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const sp = layout.pageGutter;

  const [title, setTitle] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('other');
  const [busy, setBusy] = useState(false);

  const handleCreate = async () => {
    if (!title.trim() || !authorName.trim()) {
      Alert.alert('Missing info', 'Title and author name are required.');
      return;
    }
    setBusy(true);
    const res: any = await postRequest(ROUTES.books.mine, {
      title: title.trim(), author_name: authorName.trim(), description: description.trim(),
      christian_category: category, is_free: true, price_cents: 0,
    });
    setBusy(false);
    if (res?.success) {
      navigation.replace('ManuscriptUpload', { id: res.data.id });
    } else {
      Alert.alert('Could not create book', res?.message || 'Please try again.');
    }
  };

  const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: palette.bg },
    header: { flexDirection: 'row', alignItems: 'center', padding: sp, gap: 10 },
    headerTitle: { fontSize: 18, fontWeight: '700', color: palette.text, flex: 1 },
    content: { padding: sp, gap: 14 },
    policyBox: { backgroundColor: palette.primarySoft, borderRadius: 12, padding: 14, gap: 6 },
    policyTitle: { fontWeight: '800', color: palette.text },
    policyText: { fontSize: 13, color: palette.text, lineHeight: 19 },
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
  });

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} accessibilityLabel="Go back">
          <KISIcon name="back" size={22} color={palette.text} />
        </Pressable>
        <Text style={styles.headerTitle}>New Book</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.policyBox}>
          <Text style={styles.policyTitle}>Christian Books Only</Text>
          <Text style={styles.policyText}>
            KIS Books is dedicated to Christian literature and resources that align with our Christian
            publishing policy. All submitted books are subject to review before publication. Uploading a
            book does not guarantee approval or publication. Books that do not meet our policy may be
            rejected, removed, or restricted. Serious or repeated violations may result in account
            restrictions or suspension.
          </Text>
        </View>

        <Text style={styles.label}>Title</Text>
        <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Book title" placeholderTextColor={palette.subtext} />

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

        <KISButton title="Continue to manuscript upload" variant="primary" loading={busy} onPress={handleCreate} />
      </ScrollView>
    </SafeAreaView>
  );
}
