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

type Props = NativeStackScreenProps<RootStackParamList, 'BabyMilestones'>;

type Milestone = {
  id: string;
  type: string;
  title: string;
  milestone_date: string;
  notes?: string;
  photo_url?: string;
};

const MILESTONE_TYPES = [
  { key: 'first_smile', label: 'First Smile', icon: 'smile' as const },
  { key: 'first_word', label: 'First Word', icon: 'message' as const },
  { key: 'first_step', label: 'First Step', icon: 'flame' as const },
  { key: 'first_tooth', label: 'First Tooth', icon: 'star' as const },
  { key: 'first_solid_food', label: 'Solid Food', icon: 'heart' as const },
  { key: 'sitting_up', label: 'Sitting Up', icon: 'person' as const },
  { key: 'crawling', label: 'Crawling', icon: 'bolt' as const },
  { key: 'birthday', label: 'Birthday', icon: 'gift' as const },
];

const MILESTONE_ICON: Record<string, string> = Object.fromEntries(
  MILESTONE_TYPES.map((m) => [m.key, m.icon])
);

export default function BabyMilestonesScreen({ navigation }: Props) {
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const sp = layout.pageGutter;

  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedType, setSelectedType] = useState(MILESTONE_TYPES[0].key);
  const [milestoneDate, setMilestoneDate] = useState('');
  const [notes, setNotes] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchMilestones = useCallback(async () => {
    setLoading(true);
    const res = await getRequest(ROUTES.healthExtended.babyMilestones);
    if (res.success) {
      setMilestones(Array.isArray(res.data?.results ?? res.data) ? (res.data?.results ?? res.data) : []);
    }
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { fetchMilestones(); }, [fetchMilestones]));

  const handleSubmit = async () => {
    if (!milestoneDate.trim()) {
      Alert.alert('Date required', 'Please enter a milestone date.');
      return;
    }
    setSubmitting(true);
    const res = await postRequest(ROUTES.healthExtended.babyMilestones, {
      type: selectedType,
      milestone_date: milestoneDate.trim(),
      notes: notes.trim() || undefined,
      photo_url: photoUrl.trim() || undefined,
    });
    setSubmitting(false);
    if (res.success) {
      Alert.alert('Milestone added!', 'Your baby\'s milestone has been recorded.');
      setShowForm(false);
      setMilestoneDate('');
      setNotes('');
      setPhotoUrl('');
      setSelectedType(MILESTONE_TYPES[0].key);
      fetchMilestones();
    } else {
      Alert.alert('Error', res.message || 'Failed to add milestone.');
    }
  };

  const getIcon = (type: string) => MILESTONE_ICON[type] ?? 'star';

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
        <Text style={styles.headerTitle}>Baby Milestones</Text>
      </LinearGradient>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={palette.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={milestones}
          keyExtractor={(m) => m.id}
          contentContainerStyle={[styles.list, { paddingBottom: 100 }]}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <KISIcon name="heart" size={48} color={palette.subtext} />
              <Text style={styles.emptyText}>No milestones yet.</Text>
              <Text style={styles.emptySubtext}>Capture your baby's first moments!</Text>
            </View>
          }
          renderItem={({ item, index }) => (
            <View style={styles.timelineItem}>
              {/* Timeline connector */}
              <View style={styles.timelineLeft}>
                <View style={styles.timelineDot}>
                  <KISIcon name={getIcon(item.type) as any} size={14} color={palette.ivory} />
                </View>
                {index < milestones.length - 1 && <View style={styles.timelineLine} />}
              </View>

              {/* Milestone content */}
              <View style={styles.milestoneCard}>
                <View style={styles.milestoneRow}>
                  <View style={styles.milestoneInfo}>
                    <Text style={styles.milestoneTitle}>{item.title || item.type.replace(/_/g, ' ')}</Text>
                    <Text style={styles.milestoneDate}>
                      {new Date(item.milestone_date).toLocaleDateString()}
                    </Text>
                  </View>
                  {item.photo_url ? (
                    <View style={styles.photoPlaceholder}>
                      <KISIcon name="image" size={20} color={palette.subtext} />
                    </View>
                  ) : null}
                </View>
                {item.notes ? (
                  <Text style={styles.milestoneNotes}>{item.notes}</Text>
                ) : null}
              </View>
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

      {/* Add Milestone Modal */}
      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Milestone</Text>
            <TouchableOpacity
              onPress={() => setShowForm(false)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.closeBtn}
            >
              <KISIcon name="close" size={22} color={palette.text} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.formContent}>
            <Text style={styles.fieldLabel}>Milestone Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typePicker}>
              {MILESTONE_TYPES.map((t) => (
                <TouchableOpacity
                  key={t.key}
                  style={[
                    styles.typeChip,
                    selectedType === t.key && styles.typeChipActive,
                  ]}
                  onPress={() => setSelectedType(t.key)}
                >
                  <KISIcon
                    name={t.icon}
                    size={14}
                    color={selectedType === t.key ? palette.primary : palette.subtext}
                  />
                  <Text style={[
                    styles.typeChipText,
                    selectedType === t.key && styles.typeChipTextActive,
                  ]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.fieldLabel}>Date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 2025-03-15"
              placeholderTextColor={palette.subtext}
              value={milestoneDate}
              onChangeText={setMilestoneDate}
            />

            <Text style={styles.fieldLabel}>Notes (optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Write a memory..."
              placeholderTextColor={palette.subtext}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <Text style={styles.fieldLabel}>Photo URL (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="https://..."
              placeholderTextColor={palette.subtext}
              value={photoUrl}
              onChangeText={setPhotoUrl}
              autoCapitalize="none"
            />

            <KISButton
              title="Add Milestone"
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
    list: { paddingHorizontal: sp, paddingTop: 12 },
    emptyContainer: {
      alignItems: 'center',
      paddingTop: 60,
      gap: 8,
    },
    emptyText: { fontSize: 16, color: palette.text, fontWeight: '600', marginTop: 8 },
    emptySubtext: { fontSize: 13, color: palette.subtext },
    timelineItem: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 16,
    },
    timelineLeft: {
      alignItems: 'center',
      width: 30,
    },
    timelineDot: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: palette.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    timelineLine: {
      width: 2,
      flex: 1,
      backgroundColor: palette.divider,
      marginTop: 4,
    },
    milestoneCard: {
      flex: 1,
      backgroundColor: palette.card,
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: palette.divider,
      gap: 6,
    },
    milestoneRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    milestoneInfo: { flex: 1 },
    milestoneTitle: { fontSize: 14, fontWeight: '600', color: palette.text, textTransform: 'capitalize' },
    milestoneDate: { fontSize: 12, color: palette.subtext, marginTop: 2 },
    photoPlaceholder: {
      width: 44,
      height: 44,
      borderRadius: 8,
      backgroundColor: palette.surface,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: palette.divider,
    },
    milestoneNotes: { fontSize: 12, color: palette.subtext, lineHeight: 17 },
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
    typePicker: { marginBottom: 4 },
    typeChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.divider,
      marginRight: 8,
      minHeight: 36,
    },
    typeChipActive: {
      backgroundColor: palette.primarySoft,
      borderColor: palette.primary,
    },
    typeChipText: { fontSize: 12, color: palette.subtext },
    typeChipTextActive: { color: palette.primary, fontWeight: '600' },
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
    textArea: { minHeight: 80, textAlignVertical: 'top' },
  });
}
