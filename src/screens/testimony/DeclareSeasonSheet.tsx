import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { patchRequest } from '@/network/patch';
import ROUTES from '@/network';
import type { RootStackParamList } from '@/navigation/types';

const CATEGORY_LABELS: Record<string, string> = {
  health: 'Health & Medical',
  finances: 'Financial Hardship',
  relationships: 'Relationships & Marriage',
  faith: 'Faith & Spirituality',
  business: 'Business & Career',
  grief: 'Loss & Grief',
  addiction: 'Addiction & Recovery',
  family: 'Family & Parenting',
  mental_health: 'Mental Health',
  other: 'Other',
};
const CATEGORIES = Object.keys(CATEGORY_LABELS);
const CATEGORY_EMOJI: Record<string, string> = {
  health: '🏥',
  finances: '💰',
  relationships: '💑',
  faith: '🙏',
  business: '💼',
  grief: '🕊️',
  addiction: '🌱',
  family: '👨‍👩‍👧',
  mental_health: '🧠',
  other: '💙',
};

type Visibility = 'public' | 'testimony_holders' | 'private';

const VISIBILITY_OPTIONS: { key: Visibility; emoji: string; label: string; sub: string }[] = [
  { key: 'public', emoji: '🌍', label: 'Public', sub: 'Anyone can see this' },
  { key: 'testimony_holders', emoji: '🔒', label: 'Testimony holders only', sub: "Only visible to people who've overcome this" },
  { key: 'private', emoji: '👁', label: 'Private', sub: 'Only you can see this' },
];

export default function DeclareSeasonSheet() {
  const { palette } = useKISTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'DeclareSeasonSheet'>>();
  const editId = route.params?.editId;
  const isEdit = Boolean(editId);

  const [category, setCategory] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [submitting, setSubmitting] = useState(false);

  const styles = useMemo(() => makeStyles(palette), [palette]);

  useEffect(() => {
    if (!editId) return;
    getRequest(ROUTES.testimony.seasonDetail(editId))
      .then(res => {
        if (res?.success && res.data) {
          const d = res.data;
          setCategory(d.category ?? null);
          setTitle(d.title ?? '');
          setDescription(d.description ?? '');
          setVisibility(d.visibility ?? 'public');
        }
      })
      .catch(() => {});
  }, [editId]);

  const canSubmit = Boolean(category && title.trim());

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    const payload = {
      category,
      title: title.trim(),
      description: description.trim(),
      visibility,
    };
    try {
      const res = isEdit && editId
        ? await patchRequest(ROUTES.testimony.seasonDetail(editId), payload)
        : await postRequest(ROUTES.testimony.seasons, payload);
      if (res?.success) {
        navigation.goBack();
      } else {
        Alert.alert('Error', res?.message ?? 'Unable to save season.');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Unable to save season.');
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, category, title, description, visibility, isEdit, editId, navigation]);

  const handleMarkResolved = useCallback(() => {
    if (!editId) return;
    Alert.alert(
      'Mark as Resolved',
      'Mark this season as resolved?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Resolve',
          onPress: async () => {
            await patchRequest(ROUTES.testimony.seasonDetail(editId), { is_active: false });
            navigation.goBack();
          },
        },
      ],
    );
  }, [editId, navigation]);

  return (
    <SafeAreaView style={[{ flex: 1, backgroundColor: palette.bg, marginTop: 25 }]} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView
        style={{ backgroundColor: palette.bg, marginTop: 25 }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: palette.text }]}>
            {isEdit ? 'Edit Season' : "I'm Going Through..."}
          </Text>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
            <KISIcon name="close" size={22} color={palette.text} />
          </Pressable>
        </View>

        {!isEdit && (
          <Text style={[styles.intro, { color: palette.subtext }]}>
            Sharing opens the door to people who've overcome this.
          </Text>
        )}

        <Text style={[styles.sectionLabel, { color: palette.text }]}>Category</Text>
        <View style={styles.categoryGrid}>
          {CATEGORIES.map(cat => {
            const selected = category === cat;
            return (
              <Pressable
                key={cat}
                onPress={() => setCategory(cat)}
                style={[
                  styles.categoryChip,
                  {
                    borderColor: selected ? palette.primary : palette.border,
                    backgroundColor: selected ? palette.primaryStrong + '22' : palette.surface,
                    borderWidth: selected ? 2 : 1,
                  },
                ]}
              >
                <Text style={styles.categoryEmoji}>{CATEGORY_EMOJI[cat]}</Text>
                <Text style={[styles.categoryLabel, { color: selected ? palette.primary : palette.text }]} numberOfLines={2}>
                  {CATEGORY_LABELS[cat]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.sectionLabel, { color: palette.text }]}>Title</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Briefly describe what you're going through..."
          placeholderTextColor={palette.subtext}
          style={[styles.input, { backgroundColor: palette.surface, borderColor: palette.border, color: palette.text }]}
        />

        <Text style={[styles.sectionLabel, { color: palette.text }]}>Description</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Optional: share more context..."
          placeholderTextColor={palette.subtext}
          multiline
          numberOfLines={3}
          style={[styles.inputMulti, { backgroundColor: palette.surface, borderColor: palette.border, color: palette.text }]}
          textAlignVertical="top"
        />

        <Text style={[styles.sectionLabel, { color: palette.text }]}>Visibility</Text>
        <View style={{ gap: 8 }}>
          {VISIBILITY_OPTIONS.map(opt => {
            const selected = visibility === opt.key;
            return (
              <Pressable
                key={opt.key}
                onPress={() => setVisibility(opt.key)}
                style={[
                  styles.visibilityRow,
                  {
                    backgroundColor: selected ? palette.primaryStrong + '15' : palette.surface,
                    borderColor: selected ? palette.primary : palette.border,
                    borderWidth: selected ? 2 : 1,
                  },
                ]}
              >
                <Text style={styles.visibilityEmoji}>{opt.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.visibilityLabel, { color: palette.text }]}>{opt.label}</Text>
                  <Text style={[styles.visibilitySub, { color: palette.subtext }]}>{opt.sub}</Text>
                </View>
                <View
                  style={[
                    styles.radio,
                    {
                      borderColor: selected ? palette.primary : palette.border,
                      backgroundColor: selected ? palette.primary : palette.bg,
                    },
                  ]}
                />
              </Pressable>
            );
          })}
        </View>

        <Pressable
          disabled={!canSubmit || submitting}
          onPress={handleSubmit}
          style={[
            styles.submitBtn,
            { backgroundColor: canSubmit ? palette.primaryStrong : palette.divider },
          ]}
        >
          <Text style={styles.submitBtnText}>
            {submitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Declare'}
          </Text>
        </Pressable>

        {isEdit && (
          <Pressable onPress={handleMarkResolved} style={styles.resolveTextBtn}>
            <Text style={[styles.resolveTextBtnText, { color: palette.subtext }]}>Mark as Resolved</Text>
          </Pressable>
        )}
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles(palette: any) {
  return StyleSheet.create({
    content: { paddingHorizontal: 16, paddingBottom: 60, gap: 14 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, paddingBottom: 4 },
    headerTitle: { fontSize: 20, fontWeight: '800' },
    intro: { fontSize: 14, lineHeight: 20 },
    sectionLabel: { fontSize: 15, fontWeight: '700', marginTop: 4 },
    categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    categoryChip: { width: '47%', borderRadius: 12, padding: 12, alignItems: 'center', gap: 6 },
    categoryEmoji: { fontSize: 22 },
    categoryLabel: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
    input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
    inputMulti: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, minHeight: 80 },
    visibilityRow: { borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
    visibilityEmoji: { fontSize: 20 },
    visibilityLabel: { fontSize: 15, fontWeight: '700' },
    visibilitySub: { fontSize: 13, marginTop: 2 },
    radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2 },
    submitBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
    submitBtnText: { color: palette.onPrimary, fontWeight: '800', fontSize: 16 },
    resolveTextBtn: { alignItems: 'center', paddingVertical: 12 },
    resolveTextBtnText: { fontSize: 14, textDecorationLine: 'underline' },
  });
}
