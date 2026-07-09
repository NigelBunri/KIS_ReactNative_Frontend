import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import LinearGradient from 'react-native-linear-gradient';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import KISButton from '@/constants/KISButton';
import { KISIcon } from '@/constants/kisIcons';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'MoodJournal'>;

type JournalEntry = {
  id: string;
  title: string;
  content: string;
  mood_score: number;
  created_at: string;
};

export default function MoodJournalScreen({ navigation }: Props) {
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const sp = layout.pageGutter;

  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [moodScore, setMoodScore] = useState(5);
  const [submitting, setSubmitting] = useState(false);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    const res = await getRequest(ROUTES.healthExtended.mentalJournals);
    if (res.success) {
      setEntries(Array.isArray(res.data?.results ?? res.data) ? (res.data?.results ?? res.data) : []);
    }
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { fetchEntries(); }, [fetchEntries]));

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Title required', 'Please enter a title for your entry.');
      return;
    }
    setSubmitting(true);
    const res = await postRequest(ROUTES.healthExtended.mentalJournals, {
      title: title.trim(),
      content: content.trim(),
      mood_score: moodScore,
    });
    setSubmitting(false);
    if (res.success) {
      Alert.alert('Saved!', 'Journal entry created.');
      setShowForm(false);
      setTitle('');
      setContent('');
      setMoodScore(5);
      fetchEntries();
    } else {
      Alert.alert('Error', res.message || 'Failed to save entry.');
    }
  };

  const moodColor = (score: number) => {
    if (score >= 7) return palette.primary;
    if (score >= 4) return palette.gold;
    return palette.danger;
  };

  const styles = makeStyles(palette, sp);

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient
        colors={[palette.gradientStart, palette.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.backBtn}
        >
          <KISIcon name="arrow-left" size={22} color={palette.ivory} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mood Journal</Text>
      </LinearGradient>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={palette.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(e) => e.id}
          contentContainerStyle={[styles.list, { paddingBottom: 100 }]}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <KISIcon name="document" size={48} color={palette.subtext} />
              <Text style={styles.emptyText}>No journal entries yet.</Text>
              <Text style={styles.emptySubtext}>Tap the button below to start writing.</Text>
            </View>
          }
          renderItem={({ item: entry }) => (
            <View style={styles.entryCard}>
              <View style={styles.entryRow}>
                <View style={styles.entryInfo}>
                  <Text style={styles.entryTitle}>{entry.title}</Text>
                  <Text style={styles.entryDate}>
                    {new Date(entry.created_at).toLocaleDateString()}
                  </Text>
                </View>
                <View style={[styles.moodChip, { backgroundColor: moodColor(entry.mood_score) + '22' }]}>
                  <Text style={[styles.moodChipText, { color: moodColor(entry.mood_score) }]}>
                    {entry.mood_score}/10
                  </Text>
                </View>
              </View>
              {entry.content ? (
                <Text style={styles.entryPreview} numberOfLines={2}>
                  {entry.content}
                </Text>
              ) : null}
            </View>
          )}
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowForm(true)}
        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
      >
        <KISIcon name="add" size={28} color={palette.ivory} focused />
      </TouchableOpacity>

      {/* New Entry Modal */}
      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Journal Entry</Text>
            <TouchableOpacity
              onPress={() => setShowForm(false)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.closeBtn}
            >
              <KISIcon name="close" size={22} color={palette.text} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.formContent}>
            <Text style={styles.fieldLabel}>Title</Text>
            <TextInput
              style={styles.input}
              placeholder="Entry title"
              placeholderTextColor={palette.subtext}
              value={title}
              onChangeText={setTitle}
            />

            <Text style={styles.fieldLabel}>Mood Score: {moodScore}/10</Text>
            <View style={styles.sliderRow}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <TouchableOpacity
                  key={n}
                  onPress={() => setMoodScore(n)}
                  style={[
                    styles.scoreBtn,
                    moodScore === n && styles.scoreBtnActive,
                  ]}
                  hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
                >
                  <Text style={[
                    styles.scoreBtnText,
                    moodScore === n && styles.scoreBtnTextActive,
                  ]}>
                    {n}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Content</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Write your thoughts..."
              placeholderTextColor={palette.subtext}
              value={content}
              onChangeText={setContent}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />

            <KISButton
              title="Save Entry"
              variant="primary"
              size="lg"
              loading={submitting}
              onPress={handleSubmit}
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function makeStyles(palette: any, sp: number) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: palette.bg, },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: sp,
      paddingTop: 12,
      paddingBottom: 16,
      gap: 12,
    },
    backBtn: { minWidth: 44, minHeight: 44, justifyContent: 'center' },
    headerTitle: { fontSize: 22, fontWeight: '700', color: palette.ivory },
    list: { paddingHorizontal: sp, paddingTop: 12, gap: 12 },
    emptyContainer: {
      alignItems: 'center',
      paddingTop: 60,
      gap: 8,
    },
    emptyText: { fontSize: 16, color: palette.text, fontWeight: '600', marginTop: 8 },
    emptySubtext: { fontSize: 13, color: palette.subtext },
    entryCard: {
      backgroundColor: palette.card,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: palette.divider,
      gap: 8,
    },
    entryRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    entryInfo: { flex: 1 },
    entryTitle: { fontSize: 15, fontWeight: '600', color: palette.text },
    entryDate: { fontSize: 12, color: palette.subtext, marginTop: 2 },
    moodChip: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    moodChipText: { fontSize: 12, fontWeight: '700' },
    entryPreview: { fontSize: 13, color: palette.subtext, lineHeight: 18 },
    fab: {
      position: 'absolute',
      bottom: 28,
      right: sp,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: palette.primary,
      justifyContent: 'center',
      alignItems: 'center',
      elevation: 6,
      shadowColor: palette.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 8,
    },
    modalSafe: { flex: 1, backgroundColor: palette.bg, paddingTop: 40 },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: sp,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: palette.divider,
    },
    modalTitle: { fontSize: 18, fontWeight: '700', color: palette.text },
    closeBtn: { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
    formContent: { padding: sp, gap: 14, paddingBottom: 40 },
    fieldLabel: { fontSize: 14, fontWeight: '600', color: palette.text },
    input: {
      backgroundColor: palette.surface,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: palette.divider,
      padding: 12,
      color: palette.text,
      fontSize: 14,
      minHeight: 44,
    },
    textArea: { minHeight: 120, textAlignVertical: 'top' },
    sliderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 4,
    },
    scoreBtn: {
      flex: 1,
      minHeight: 36,
      borderRadius: 8,
      backgroundColor: palette.surface,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: palette.divider,
    },
    scoreBtnActive: {
      backgroundColor: palette.primarySoft,
      borderColor: palette.primary,
    },
    scoreBtnText: { fontSize: 11, color: palette.subtext, fontWeight: '500' },
    scoreBtnTextActive: { color: palette.primary, fontWeight: '700' },
  });
}
