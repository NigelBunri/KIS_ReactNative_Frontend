import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
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

export default function DeclareTestimonySheet() {
  const { palette } = useKISTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'DeclareTestimonySheet'>>();
  const editId = route.params?.editId;
  const isEdit = Boolean(editId);

  const [category, setCategory] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [story, setStory] = useState('');
  const [openToContact, setOpenToContact] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const styles = useMemo(() => makeStyles(palette), [palette]);

  useEffect(() => {
    if (!editId) return;
    getRequest(ROUTES.testimony.testimonyDetail(editId))
      .then(res => {
        if (res?.success && res.data) {
          const d = res.data;
          setCategory(d.category ?? null);
          setTitle(d.title ?? '');
          setStory(d.story ?? '');
          setOpenToContact(d.open_to_contact !== false);
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
      story: story.trim(),
      open_to_contact: openToContact,
    };
    try {
      const res = isEdit && editId
        ? await patchRequest(ROUTES.testimony.testimonyDetail(editId), payload)
        : await postRequest(ROUTES.testimony.testimonies, payload);
      if (res?.success) {
        if (!isEdit) {
          Alert.alert('Thank you 🙏', 'Your testimony is now visible to people who need it.', [
            { text: 'OK', onPress: () => navigation.goBack() },
          ]);
        } else {
          navigation.goBack();
        }
      } else {
        Alert.alert('Error', res?.message ?? 'Unable to save testimony.');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Unable to save testimony.');
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, category, title, story, openToContact, isEdit, editId, navigation]);

  return (
    <SafeAreaView style={[{ flex: 1, backgroundColor: palette.bg, }]} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView
        style={{ backgroundColor: palette.bg, }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: palette.text }]}>
            {isEdit ? 'Edit Testimony' : 'Share Your Testimony'}
          </Text>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
            <KISIcon name="close" size={22} color={palette.text} />
          </Pressable>
        </View>

        <Text style={[styles.intro, { color: palette.subtext }]}>
          Your story is someone else's survival guide.
        </Text>

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
          placeholder="What did you overcome?"
          placeholderTextColor={palette.subtext}
          style={[styles.input, { backgroundColor: palette.surface, borderColor: palette.border, color: palette.text }]}
        />

        <Text style={[styles.sectionLabel, { color: palette.text }]}>Your Story</Text>
        <TextInput
          value={story}
          onChangeText={setStory}
          placeholder="Share your story — what happened, how you got through it, and what you'd tell someone in it right now..."
          placeholderTextColor={palette.subtext}
          multiline
          numberOfLines={6}
          style={[styles.storyInput, { backgroundColor: palette.surface, borderColor: palette.border, color: palette.text }]}
          textAlignVertical="top"
        />

        <View style={[styles.contactRow, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.contactLabel, { color: palette.text }]}>I'm open to being contacted</Text>
            <Text style={[styles.contactSub, { color: palette.subtext }]}>
              People going through this can see your offer to help
            </Text>
          </View>
          <Switch
            value={openToContact}
            onValueChange={setOpenToContact}
            trackColor={{ false: palette.divider, true: palette.primary }}
            thumbColor={palette.ivory}
          />
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
            {submitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Share Testimony'}
          </Text>
        </Pressable>
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
    storyInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, minHeight: 140 },
    contactRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, borderWidth: 1, padding: 14 },
    contactLabel: { fontSize: 15, fontWeight: '700' },
    contactSub: { fontSize: 13, marginTop: 2 },
    submitBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
    submitBtnText: { color: palette.onPrimary, fontWeight: '800', fontSize: 16 },
  });
}
