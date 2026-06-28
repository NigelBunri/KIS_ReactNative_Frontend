import React, { useCallback, useMemo, useState } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
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

type Props = NativeStackScreenProps<RootStackParamList, 'HealthGoals'>;

type HealthGoal = {
  id: string;
  title: string;
  category: string;
  current_value: number;
  target_value: number;
  unit: string;
  deadline?: string;
};

const CATEGORIES = ['All', 'Weight', 'Steps', 'Sleep', 'Water', 'Exercise', 'Nutrition', 'Mental'];

const CATEGORY_ICONS: Record<string, string> = {
  Weight: 'flame',
  Steps: 'bolt',
  Sleep: 'star',
  Water: 'refresh',
  Exercise: 'heart',
  Nutrition: 'bookmark',
  Mental: 'sparkles',
  All: 'list',
};

export default function HealthGoalsScreen({ navigation }: Props) {
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const sp = layout.pageGutter;

  const [goals, setGoals] = useState<HealthGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showForm, setShowForm] = useState(false);
  const [updateValues, setUpdateValues] = useState<Record<string, string>>({});
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState(CATEGORIES[1]);
  const [formTarget, setFormTarget] = useState('');
  const [formUnit, setFormUnit] = useState('');
  const [formDeadline, setFormDeadline] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchGoals = useCallback(async (cat?: string) => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (cat && cat !== 'All') params.category = cat;
    const res = await getRequest(ROUTES.healthExtended.healthGoals, { params });
    if (res.success) {
      setGoals(Array.isArray(res.data?.results ?? res.data) ? (res.data?.results ?? res.data) : []);
    }
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { fetchGoals(selectedCategory); }, [fetchGoals, selectedCategory]));

  const handleCategoryChange = (c: string) => {
    setSelectedCategory(c);
    fetchGoals(c);
  };

  const handleUpdateProgress = async (goal: HealthGoal) => {
    const value = parseFloat(updateValues[goal.id] ?? '');
    if (isNaN(value)) {
      Alert.alert('Invalid value', 'Please enter a valid number.');
      return;
    }
    setUpdatingId(goal.id);
    const res = await postRequest(ROUTES.healthExtended.goalProgress(goal.id), {
      current_value: value,
    });
    setUpdatingId(null);
    if (res.success) {
      Alert.alert('Updated!', 'Progress has been saved.');
      setUpdateValues((prev) => ({ ...prev, [goal.id]: '' }));
      fetchGoals(selectedCategory);
    } else {
      Alert.alert('Error', res.message || 'Failed to update progress.');
    }
  };

  const handleSubmitGoal = async () => {
    if (!formTitle.trim()) {
      Alert.alert('Title required', 'Please enter a goal title.');
      return;
    }
    setSubmitting(true);
    const res = await postRequest(ROUTES.healthExtended.healthGoals, {
      title: formTitle.trim(),
      category: formCategory,
      target_value: parseFloat(formTarget) || 0,
      unit: formUnit.trim(),
      deadline: formDeadline.trim() || undefined,
    });
    setSubmitting(false);
    if (res.success) {
      Alert.alert('Goal created!', 'Your health goal has been set.');
      setShowForm(false);
      setFormTitle(''); setFormCategory(CATEGORIES[1]); setFormTarget(''); setFormUnit(''); setFormDeadline('');
      fetchGoals(selectedCategory);
    } else {
      Alert.alert('Error', res.message || 'Failed to create goal.');
    }
  };

  const styles = useMemo(() => makeStyles(palette, sp), [palette, sp]);

  const progressPercent = (goal: HealthGoal) =>
    goal.target_value > 0
      ? Math.min(1, goal.current_value / goal.target_value)
      : 0;

  const categoryIcon = (cat: string): string => CATEGORY_ICONS[cat] ?? 'star';

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient
        colors={[palette.gradientStart, palette.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>Health Goals</Text>
        <Text style={styles.headerSub}>Track your wellness progress</Text>
      </LinearGradient>

      {/* Category Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {CATEGORIES.map((c) => (
          <TouchableOpacity
            key={c}
            style={[styles.filterChip, selectedCategory === c && styles.filterChipActive]}
            onPress={() => handleCategoryChange(c)}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          >
            <KISIcon
              name={categoryIcon(c) as any}
              size={12}
              color={selectedCategory === c ? palette.primary : palette.subtext}
            />
            <Text style={[styles.filterChipText, selectedCategory === c && styles.filterChipTextActive]}>
              {c}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={palette.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={goals}
          keyExtractor={(g) => g.id}
          contentContainerStyle={[styles.list, { paddingBottom: 100 }]}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <KISIcon name="bolt" size={48} color={palette.subtext} />
              <Text style={styles.emptyText}>No goals set yet.</Text>
              <Text style={styles.emptySubtext}>Tap the button below to set your first goal.</Text>
            </View>
          }
          renderItem={({ item: goal }) => {
            const pct = progressPercent(goal);
            const pctLabel = Math.round(pct * 100);
            return (
              <View style={styles.goalCard}>
                <View style={styles.goalHeader}>
                  <View style={styles.goalIconWrap}>
                    <KISIcon name={categoryIcon(goal.category) as any} size={18} color={palette.primary} />
                  </View>
                  <View style={styles.goalInfo}>
                    <Text style={styles.goalTitle}>{goal.title}</Text>
                    <Text style={styles.goalMeta}>
                      {goal.category}
                      {goal.deadline ? ` · Due ${new Date(goal.deadline).toLocaleDateString()}` : ''}
                    </Text>
                  </View>
                  <Text style={styles.goalPct}>{pctLabel}%</Text>
                </View>

                {/* Progress Bar */}
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${pct * 100}%` }]} />
                </View>
                <Text style={styles.progressLabel}>
                  {goal.current_value} / {goal.target_value} {goal.unit}
                </Text>

                {/* Inline Update */}
                <View style={styles.updateRow}>
                  <TextInput
                    style={styles.updateInput}
                    placeholder={`Update (${goal.unit})`}
                    placeholderTextColor={palette.subtext}
                    keyboardType="decimal-pad"
                    value={updateValues[goal.id] ?? ''}
                    onChangeText={(v) => setUpdateValues((prev) => ({ ...prev, [goal.id]: v }))}
                  />
                  <KISButton
                    title={updatingId === goal.id ? '...' : 'Update'}
                    variant="secondary"
                    size="sm"
                    loading={updatingId === goal.id}
                    style={styles.updateBtn}
                    onPress={() => handleUpdateProgress(goal)}
                  />
                </View>
              </View>
            );
          }}
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

      {/* Add Goal Modal */}
      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Health Goal</Text>
            <TouchableOpacity
              onPress={() => setShowForm(false)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.closeBtn}
            >
              <KISIcon name="close" size={22} color={palette.text} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.formContent}>
            <Text style={styles.fieldLabel}>Title *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Drink 2L water daily"
              placeholderTextColor={palette.subtext}
              value={formTitle}
              onChangeText={setFormTitle}
            />

            <Text style={styles.fieldLabel}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catPicker}>
              {CATEGORIES.filter((c) => c !== 'All').map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.catChip, formCategory === c && styles.catChipActive]}
                  onPress={() => setFormCategory(c)}
                >
                  <Text style={[styles.catChipText, formCategory === c && styles.catChipTextActive]}>
                    {c}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.fieldLabel}>Target Value</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 2000"
              placeholderTextColor={palette.subtext}
              keyboardType="decimal-pad"
              value={formTarget}
              onChangeText={setFormTarget}
            />

            <Text style={styles.fieldLabel}>Unit</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. ml, steps, hours"
              placeholderTextColor={palette.subtext}
              value={formUnit}
              onChangeText={setFormUnit}
            />

            <Text style={styles.fieldLabel}>Deadline (YYYY-MM-DD, optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 2025-12-31"
              placeholderTextColor={palette.subtext}
              value={formDeadline}
              onChangeText={setFormDeadline}
            />

            <KISButton
              title="Create Goal"
              variant="primary"
              size="lg"
              loading={submitting}
              onPress={handleSubmitGoal}
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function makeStyles(palette: any, sp: number) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: palette.bg },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
      paddingHorizontal: sp,
      paddingTop: 16,
      paddingBottom: 20,
    },
    headerTitle: { fontSize: 26, fontWeight: '700', color: palette.ivory },
    headerSub: { fontSize: 13, color: palette.ivory, opacity: 0.8, marginTop: 2 },
    filterRow: {
      paddingHorizontal: sp,
      paddingVertical: 10,
      gap: 8,
      borderBottomWidth: 1,
      borderBottomColor: palette.divider,
    },
    filterChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: palette.card,
      borderWidth: 1,
      borderColor: palette.divider,
      minHeight: 36,
    },
    filterChipActive: {
      backgroundColor: palette.primarySoft,
      borderColor: palette.primary,
    },
    filterChipText: { fontSize: 12, color: palette.subtext },
    filterChipTextActive: { color: palette.primary, fontWeight: '600' },
    list: { paddingHorizontal: sp, paddingTop: 12, gap: 12 },
    emptyContainer: {
      alignItems: 'center',
      paddingTop: 60,
      gap: 8,
    },
    emptyText: { fontSize: 16, color: palette.text, fontWeight: '600', marginTop: 8 },
    emptySubtext: { fontSize: 13, color: palette.subtext },
    goalCard: {
      backgroundColor: palette.card,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: palette.divider,
      gap: 10,
    },
    goalHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    goalIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: palette.primarySoft,
      justifyContent: 'center',
      alignItems: 'center',
    },
    goalInfo: { flex: 1 },
    goalTitle: { fontSize: 14, fontWeight: '600', color: palette.text },
    goalMeta: { fontSize: 12, color: palette.subtext, marginTop: 2 },
    goalPct: { fontSize: 16, fontWeight: '700', color: palette.primary },
    progressTrack: {
      height: 8,
      backgroundColor: palette.divider,
      borderRadius: 4,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: palette.primary,
      borderRadius: 4,
    },
    progressLabel: { fontSize: 12, color: palette.subtext, textAlign: 'right' },
    updateRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
    updateInput: {
      flex: 1,
      backgroundColor: palette.surface,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: palette.divider,
      paddingHorizontal: 10,
      height: 40,
      color: palette.text,
      fontSize: 14,
    },
    updateBtn: { minWidth: 80 },
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
    modalSafe: { flex: 1, backgroundColor: palette.bg },
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
    catPicker: { marginBottom: 4 },
    catChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.divider,
      marginRight: 8,
      minHeight: 36,
      justifyContent: 'center',
    },
    catChipActive: {
      backgroundColor: palette.primarySoft,
      borderColor: palette.primary,
    },
    catChipText: { fontSize: 12, color: palette.subtext },
    catChipTextActive: { color: palette.primary, fontWeight: '600' },
  });
}
