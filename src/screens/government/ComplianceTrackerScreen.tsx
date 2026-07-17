import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
import type { RootStackParamList } from '@/navigation/types';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import { KISIcon } from '@/constants/kisIcons';
import KISButton from '@/constants/KISButton';

type Props = NativeStackScreenProps<RootStackParamList, 'ComplianceTracker'>;

type ComplianceItem = {
  id: string;
  title: string;
  type: string;
  due_date: string;
  status: 'pending' | 'complete' | 'overdue';
  notes?: string;
};

const STATUS_FILTERS = ['All', 'Pending', 'Complete', 'Overdue'] as const;
type StatusFilter = typeof STATUS_FILTERS[number];

export default function ComplianceTrackerScreen(_props: Props) {
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const gutter = layout.pageGutter;

  const [items, setItems] = useState<ComplianceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [showAddModal, setShowAddModal] = useState(false);

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formType, setFormType] = useState('');
  const [formDueDate, setFormDueDate] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      getRequest(ROUTES.government.compliance)
        .then((res: any) => {
          if (!active) return;
          const list: ComplianceItem[] = Array.isArray(res)
            ? res
            : res?.results ?? [];
          // Sort by due date ascending
          list.sort(
            (a, b) =>
              new Date(a.due_date).getTime() - new Date(b.due_date).getTime(),
          );
          setItems(list);
        })
        .catch(() => setItems([]))
        .finally(() => { if (active) setLoading(false); });
      return () => { active = false; };
    }, []),
  );

  const filtered =
    statusFilter === 'All'
      ? items
      : items.filter(
          (i) => i.status?.toLowerCase() === statusFilter.toLowerCase(),
        );

  function getStatusColor(status: string) {
    switch (status?.toLowerCase()) {
      case 'complete':
        return palette.primary;
      case 'overdue':
        return palette.danger;
      case 'pending':
        return palette.gold;
      default:
        return palette.subtext;
    }
  }

  async function handleAddDeadline() {
    if (!formTitle.trim() || !formDueDate.trim()) {
      Alert.alert('Required', 'Title and due date are required.');
      return;
    }
    setSaving(true);
    try {
      const result = (await postRequest(ROUTES.government.compliance, {
        title: formTitle.trim(),
        type: formType.trim(),
        due_date: formDueDate.trim(),
        notes: formNotes.trim() || undefined,
      })) as ComplianceItem;
      setItems((prev) => {
        const updated = [result, ...prev];
        updated.sort(
          (a, b) =>
            new Date(a.due_date).getTime() - new Date(b.due_date).getTime(),
        );
        return updated;
      });
      setFormTitle('');
      setFormType('');
      setFormDueDate('');
      setFormNotes('');
      setShowAddModal(false);
    } catch {
      Alert.alert('Error', 'Could not save deadline. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = [
    styles.input,
    {
      backgroundColor: palette.surface,
      borderColor: palette.divider,
      color: palette.text,
    },
  ];

  if (loading) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: palette.bg, }]}>
        <ActivityIndicator style={styles.flex} color={palette.gold} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: palette.bg, }]}>
      {/* Status Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.filterBar, { borderBottomColor: palette.divider }]}
        contentContainerStyle={{ paddingHorizontal: gutter, paddingVertical: 8, gap: 8 }}
      >
        {STATUS_FILTERS.map((f) => (
          <TouchableOpacity
            key={f}
            activeOpacity={0.75}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
            style={[
              styles.chip,
              {
                backgroundColor:
                  statusFilter === f ? palette.primary : palette.surface,
                borderColor:
                  statusFilter === f ? palette.primary : palette.divider,
              },
            ]}
            onPress={() => setStatusFilter(f)}
          >
            <Text
              style={[
                styles.chipText,
                {
                  color: statusFilter === f ? palette.ivory : palette.subtext,
                },
              ]}
            >
              {f}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: gutter,
          paddingTop: 12,
          paddingBottom: 100,
        }}
      >
        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <KISIcon
              name="checkmark-circle-outline"
              size={52}
              color={palette.subtext}
            />
            <Text style={[styles.emptyText, { color: palette.subtext }]}>
              No {statusFilter === 'All' ? '' : statusFilter.toLowerCase() + ' '}
              items
            </Text>
          </View>
        ) : (
          filtered.map((item) => {
            const statusColor = getStatusColor(item.status);
            const isOverdue = item.status?.toLowerCase() === 'overdue';
            return (
              <View
                key={item.id}
                style={[
                  styles.card,
                  {
                    backgroundColor: isOverdue
                      ? palette.danger + '15'
                      : palette.card,
                    borderColor: isOverdue ? palette.danger : palette.divider,
                    marginBottom: layout.cardGap,
                  },
                ]}
              >
                <View style={styles.cardTop}>
                  <View style={styles.cardInfo}>
                    <Text style={[styles.itemTitle, { color: palette.text }]}>
                      {item.title}
                    </Text>
                    {item.type ? (
                      <Text style={[styles.itemType, { color: palette.subtext }]}>
                        {item.type}
                      </Text>
                    ) : null}
                    <Text style={[styles.dueDate, { color: palette.subtext }]}>
                      Due:{' '}
                      {new Date(item.due_date).toLocaleDateString()}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusChip,
                      { backgroundColor: statusColor + '22' },
                    ]}
                  >
                    <Text
                      style={[styles.statusChipText, { color: statusColor }]}
                    >
                      {item.status}
                    </Text>
                  </View>
                </View>
                {item.notes ? (
                  <Text style={[styles.notes, { color: palette.subtext }]}>
                    {item.notes}
                  </Text>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        activeOpacity={0.85}
        style={[styles.fab, { backgroundColor: palette.primary }]}
        onPress={() => setShowAddModal(true)}
      >
        <KISIcon name="add" size={28} color={palette.ivory} />
      </TouchableOpacity>

      {/* Add Deadline Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddModal(false)}
      >
        <SafeAreaView style={[styles.flex, { backgroundColor: palette.bg, paddingTop: 40 }]}>
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={60}
          >
            <View
              style={[
                styles.modalHeader,
                { borderBottomColor: palette.divider, paddingHorizontal: gutter },
              ]}
            >
              <Text style={[styles.modalTitle, { color: palette.text }]}>
                Add Deadline
              </Text>
              <TouchableOpacity
                activeOpacity={0.75}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={() => setShowAddModal(false)}
              >
                <KISIcon name="close-outline" size={24} color={palette.text} />
              </TouchableOpacity>
            </View>
            <ScrollView
              contentContainerStyle={{
                paddingHorizontal: gutter,
                paddingTop: 16,
                paddingBottom: 60,
              }}
            >
              <Text style={[styles.label, { color: palette.text }]}>
                Title *
              </Text>
              <TextInput
                style={inputStyle}
                value={formTitle}
                onChangeText={setFormTitle}
                placeholder="e.g. Annual Returns Filing"
                placeholderTextColor={palette.subtext}
              />
              <Text style={[styles.label, { color: palette.text }]}>Type</Text>
              <TextInput
                style={inputStyle}
                value={formType}
                onChangeText={setFormType}
                placeholder="e.g. Tax, Regulatory, Board"
                placeholderTextColor={palette.subtext}
              />
              <Text style={[styles.label, { color: palette.text }]}>
                Due Date * (YYYY-MM-DD)
              </Text>
              <TextInput
                style={inputStyle}
                value={formDueDate}
                onChangeText={setFormDueDate}
                placeholder="e.g. 2026-12-31"
                placeholderTextColor={palette.subtext}
                keyboardType="numbers-and-punctuation"
              />
              <Text style={[styles.label, { color: palette.text }]}>
                Notes
              </Text>
              <TextInput
                style={[inputStyle, styles.textarea]}
                value={formNotes}
                onChangeText={setFormNotes}
                placeholder="Additional notes…"
                placeholderTextColor={palette.subtext}
                multiline
                textAlignVertical="top"
              />
              <KISButton
                title={saving ? 'Saving…' : 'Add Deadline'}
                onPress={handleAddDeadline}
                disabled={saving}
                style={{ marginTop: 20 }}
              />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  filterBar: {
    borderBottomWidth: 1,
  },
  chip: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 7,
    minHeight: 36,
    justifyContent: 'center',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  cardInfo: {
    flex: 1,
    gap: 4,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  itemType: {
    fontSize: 13,
  },
  dueDate: {
    fontSize: 12,
  },
  statusChip: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  notes: {
    fontSize: 13,
    lineHeight: 18,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
  },
  fab: {
    position: 'absolute',
    bottom: 28,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    minHeight: 44,
  },
  textarea: {
    minHeight: 80,
    paddingTop: 11,
  },
});
