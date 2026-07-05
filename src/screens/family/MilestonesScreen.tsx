import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import type { RootStackParamList } from '@/navigation/types';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import { KISIcon } from '@/constants/kisIcons';
import KISButton from '@/constants/KISButton';
import FamilySelect from './components/FamilySelect';

type Props = NativeStackScreenProps<RootStackParamList, 'FamilyMilestones'>;

type Milestone = {
  id: string;
  title: string;
  milestone_type: string;
  date: string;
  description?: string;
  member_name?: string;
  member_id?: string;
};

type Member = {
  id: string;
  display_name: string;
};

const MILESTONE_TYPES = [
  'birth', 'graduation', 'marriage', 'anniversary', 'first_steps',
  'first_words', 'baptism', 'confirmation', 'promotion', 'other',
];

const MILESTONE_ICONS: Record<string, string> = {
  birth: 'heart',
  graduation: 'school-outline',
  marriage: 'rose-outline',
  anniversary: 'star-outline',
  first_steps: 'footsteps-outline',
  first_words: 'chatbubble-outline',
  baptism: 'water-outline',
  confirmation: 'checkmark-circle-outline',
  promotion: 'ribbon-outline',
  other: 'flag-outline',
};

export default function MilestonesScreen({}: Props) {
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formType, setFormType] = useState('birth');
  const [formDate, setFormDate] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formMemberId, setFormMemberId] = useState('');
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      Promise.all([
        getRequest(ROUTES.family.milestones),
        getRequest(ROUTES.family.members),
      ])
        .then(([ms, mems]: any[]) => {
          if (!active) return;
          setMilestones(Array.isArray(ms) ? ms : ms?.results ?? []);
          const memberList = Array.isArray(mems) ? mems : mems?.results ?? [];
          setMembers(memberList);
          if (memberList.length > 0) setFormMemberId(memberList[0].id);
        })
        .catch(() => {})
        .finally(() => { if (active) setLoading(false); });
      return () => { active = false; };
    }, []),
  );

  async function handleAdd() {
    if (!formTitle.trim() || !formDate.trim()) {
      Alert.alert('Title and date are required');
      return;
    }
    setSaving(true);
    try {
      const created = (await postRequest(ROUTES.family.milestones, {
        title: formTitle.trim(),
        milestone_type: formType,
        date: formDate.trim(),
        description: formDesc.trim() || undefined,
        member_id: formMemberId || undefined,
      })) as unknown as Milestone;
      setMilestones((prev) => [created, ...prev]);
      setShowForm(false);
      setFormTitle('');
      setFormDate('');
      setFormDesc('');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to add milestone');
    } finally {
      setSaving(false);
    }
  }

  const gutter = layout.pageGutter;

  if (loading) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: palette.bg, marginTop: 25 }]}>
        <ActivityIndicator style={styles.flex} color={palette.gold} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: palette.bg, marginTop: 25 }]}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: gutter, paddingTop: 20, paddingBottom: 80 }}>
        <Text style={[styles.screenTitle, { color: palette.text }]}>Family Milestones</Text>

        {milestones.length === 0 ? (
          <View style={styles.emptyState}>
            <KISIcon name="ribbon-outline" size={48} color={palette.subtext} />
            <Text style={[styles.emptyText, { color: palette.subtext }]}>No milestones yet</Text>
          </View>
        ) : (
          <View style={styles.timeline}>
            {milestones.map((m, idx) => {
              const icon = MILESTONE_ICONS[m.milestone_type] ?? 'flag-outline';
              const isLast = idx === milestones.length - 1;
              return (
                <View key={m.id} style={styles.timelineItem}>
                  {/* Vertical line */}
                  <View style={styles.lineCol}>
                    <View style={[styles.iconCircle, { backgroundColor: palette.primaryStrong }]}>
                      <KISIcon name={icon as any} size={16} color={palette.ivory} />
                    </View>
                    {!isLast && <View style={[styles.line, { backgroundColor: palette.divider }]} />}
                  </View>

                  {/* Content */}
                  <View style={[styles.milestoneCard, { backgroundColor: palette.card, borderColor: palette.divider }]}>
                    <Text style={[styles.milestoneTitle, { color: palette.text }]}>{m.title}</Text>
                    <Text style={[styles.milestoneDate, { color: palette.gold }]}>{m.date}</Text>
                    {m.member_name && (
                      <Text style={[styles.milestoneMember, { color: palette.subtext }]}>{m.member_name}</Text>
                    )}
                    {m.description && (
                      <Text style={[styles.milestoneDesc, { color: palette.subtext }]}>{m.description}</Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: palette.gold }]}
        onPress={() => setShowForm(true)}
        activeOpacity={0.85}
      >
        <KISIcon name="add" size={28} color={palette.bg} />
      </TouchableOpacity>

      {/* Add Modal */}
      <Modal visible={showForm} animationType="slide" transparent onRequestClose={() => setShowForm(false)}>
        <View style={styles.modalOverlay}>
          <ScrollView>
            <View style={[styles.modalSheet, { backgroundColor: palette.surface }]}>
              <Text style={[styles.modalTitle, { color: palette.text }]}>Add Milestone</Text>

              {members.length > 0 && (
                <View style={[styles.pickerWrapper, { borderColor: palette.divider, backgroundColor: palette.card }]}>
                  <FamilySelect
                    value={formMemberId}
                    onChange={setFormMemberId}
                    placeholder="Family member"
                    options={members.map((mem) => ({
                      label: mem.display_name,
                      value: mem.id,
                    }))}
                  />
                </View>
              )}

              <View style={[styles.pickerWrapper, { borderColor: palette.divider, backgroundColor: palette.card }]}>
                <FamilySelect
                  value={formType}
                  onChange={setFormType}
                  placeholder="Milestone type"
                  options={MILESTONE_TYPES.map((t) => ({
                    label: t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
                    value: t,
                  }))}
                />
              </View>

              <TextInput
                style={[styles.input, { backgroundColor: palette.card, borderColor: palette.divider, color: palette.text }]}
                placeholder="Title"
                placeholderTextColor={palette.subtext}
                value={formTitle}
                onChangeText={setFormTitle}
              />
              <TextInput
                style={[styles.input, { backgroundColor: palette.card, borderColor: palette.divider, color: palette.text }]}
                placeholder="Date (YYYY-MM-DD)"
                placeholderTextColor={palette.subtext}
                value={formDate}
                onChangeText={setFormDate}
              />
              <TextInput
                style={[
                  styles.input,
                  styles.multiline,
                  { backgroundColor: palette.card, borderColor: palette.divider, color: palette.text },
                ]}
                placeholder="Description (optional)"
                placeholderTextColor={palette.subtext}
                value={formDesc}
                onChangeText={setFormDesc}
                multiline
              />

              <View style={styles.modalActions}>
                <KISButton title="Cancel" variant="ghost" onPress={() => setShowForm(false)} style={{ flex: 1 }} />
                <KISButton
                  title={saving ? 'Saving…' : 'Add'}
                  onPress={handleAdd}
                  disabled={saving}
                  loading={saving}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screenTitle: { fontSize: 22, fontWeight: '700', marginBottom: 20 },
  timeline: { gap: 0 },
  timelineItem: { flexDirection: 'row', gap: 12, marginBottom: 0 },
  lineCol: { alignItems: 'center', width: 36 },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  line: { width: 2, flex: 1, minHeight: 20, marginTop: 4 },
  milestoneCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 16,
  },
  milestoneTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  milestoneDate: { fontSize: 13, fontWeight: '600', marginBottom: 2 },
  milestoneMember: { fontSize: 13, marginBottom: 4 },
  milestoneDesc: { fontSize: 13, lineHeight: 18 },
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15 },
  fab: {
    position: 'absolute',
    bottom: 28,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, gap: 12 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  pickerWrapper: { borderRadius: 10, borderWidth: 1, overflow: 'hidden' },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    minHeight: 48,
  },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 4 },
});
