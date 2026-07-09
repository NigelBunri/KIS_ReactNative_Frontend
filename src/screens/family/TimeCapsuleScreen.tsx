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

type Props = NativeStackScreenProps<RootStackParamList, 'FamilyTimeCapsules'>;

type MediaItem = { id: string; url?: string; thumb_url?: string };

type TimeCapsule = {
  id: string;
  title: string;
  unlock_date: string;
  message?: string;
  media?: MediaItem[];
  is_unlocked?: boolean;
};

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  const diff = target.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export default function TimeCapsuleScreen({ navigation }: Props) {
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const [capsules, setCapsules] = useState<TimeCapsule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formMessage, setFormMessage] = useState('');
  const [formUnlockDate, setFormUnlockDate] = useState('');
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      getRequest(ROUTES.family.timeCapsules)
        .then((res: any) => {
          if (!active) return;
          setCapsules(Array.isArray(res) ? res : res?.results ?? []);
        })
        .catch(() => setCapsules([]))
        .finally(() => { if (active) setLoading(false); });
      return () => { active = false; };
    }, []),
  );

  async function handleCreate() {
    if (!formTitle.trim() || !formUnlockDate.trim()) {
      Alert.alert('Title and unlock date are required');
      return;
    }
    setSaving(true);
    try {
      const created = await postRequest(ROUTES.family.timeCapsules, {
        title: formTitle.trim(),
        message: formMessage.trim() || undefined,
        unlock_date: formUnlockDate.trim(),
      }) as TimeCapsule;
      setCapsules((prev) => [created, ...prev]);
      setShowForm(false);
      setFormTitle('');
      setFormMessage('');
      setFormUnlockDate('');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to create capsule');
    } finally {
      setSaving(false);
    }
  }

  const gutter = layout.pageGutter;

  if (loading) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: palette.bg, }]}>
        <ActivityIndicator style={styles.flex} color={palette.gold} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: palette.bg, }]}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: gutter, paddingTop: 20, paddingBottom: 80 }}>
        <Text style={[styles.screenTitle, { color: palette.text }]}>Time Capsules</Text>

        {capsules.length === 0 ? (
          <View style={styles.emptyState}>
            <KISIcon name="time-outline" size={48} color={palette.subtext} />
            <Text style={[styles.emptyText, { color: palette.subtext }]}>No time capsules yet</Text>
          </View>
        ) : (
          capsules.map((c) => {
            const days = daysUntil(c.unlock_date);
            const unlocked = c.is_unlocked || days === 0;
            return (
              <View
                key={c.id}
                style={[
                  styles.capsuleCard,
                  {
                    backgroundColor: palette.card,
                    borderColor: unlocked ? palette.gold : palette.divider,
                    borderWidth: unlocked ? 1.5 : 1,
                  },
                ]}
              >
                <View style={styles.capsuleHeader}>
                  <KISIcon
                    name={unlocked ? 'lock-open-outline' : 'lock-closed-outline'}
                    size={20}
                    color={unlocked ? palette.gold : palette.subtext}
                  />
                  <Text style={[styles.capsuleTitle, { color: palette.text }]}>{c.title}</Text>
                  {unlocked ? (
                    <View style={[styles.unlockedBadge, { backgroundColor: palette.primarySoft }]}>
                      <Text style={[styles.unlockedText, { color: palette.gold }]}>UNLOCKED</Text>
                    </View>
                  ) : (
                    <Text style={[styles.countdown, { color: palette.subtext }]}>
                      {days}d left
                    </Text>
                  )}
                </View>

                <Text style={[styles.unlockDate, { color: palette.subtext }]}>
                  Unlocks: {c.unlock_date}
                </Text>

                {unlocked && c.message && (
                  <Text style={[styles.capsuleMessage, { color: palette.text }]}>{c.message}</Text>
                )}

                {unlocked && c.media && c.media.length > 0 && (
                  <View style={styles.mediaRow}>
                    {c.media.slice(0, 4).map((m) => (
                      <View
                        key={m.id}
                        style={[styles.mediaThumb, { backgroundColor: palette.surface, borderColor: palette.divider }]}
                      >
                        <KISIcon name="image-outline" size={16} color={palette.subtext} />
                      </View>
                    ))}
                    {c.media.length > 4 && (
                      <View style={[styles.mediaThumb, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
                        <Text style={[styles.mediaMore, { color: palette.subtext }]}>+{c.media.length - 4}</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          })
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

      {/* Create Modal */}
      <Modal visible={showForm} animationType="slide" transparent onRequestClose={() => setShowForm(false)}>
        <View style={styles.modalOverlay}>
          <ScrollView>
            <View style={[styles.modalSheet, { backgroundColor: palette.surface }]}>
              <Text style={[styles.modalTitle, { color: palette.text }]}>Create Time Capsule</Text>

              <TextInput
                style={[styles.input, { backgroundColor: palette.card, borderColor: palette.divider, color: palette.text }]}
                placeholder="Title"
                placeholderTextColor={palette.subtext}
                value={formTitle}
                onChangeText={setFormTitle}
              />
              <TextInput
                style={[
                  styles.input,
                  styles.multiline,
                  { backgroundColor: palette.card, borderColor: palette.divider, color: palette.text },
                ]}
                placeholder="Message (optional)"
                placeholderTextColor={palette.subtext}
                value={formMessage}
                onChangeText={setFormMessage}
                multiline
              />
              <TextInput
                style={[styles.input, { backgroundColor: palette.card, borderColor: palette.divider, color: palette.text }]}
                placeholder="Unlock date (YYYY-MM-DD)"
                placeholderTextColor={palette.subtext}
                value={formUnlockDate}
                onChangeText={setFormUnlockDate}
              />

              <View style={styles.modalActions}>
                <KISButton title="Cancel" variant="ghost" onPress={() => setShowForm(false)} style={{ flex: 1 }} />
                <KISButton
                  title={saving ? 'Creating…' : 'Create'}
                  onPress={handleCreate}
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
  capsuleCard: { borderRadius: 14, padding: 14, marginBottom: 14 },
  capsuleHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  capsuleTitle: { flex: 1, fontSize: 16, fontWeight: '700' },
  unlockedBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  unlockedText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  countdown: { fontSize: 13 },
  unlockDate: { fontSize: 13, marginBottom: 8 },
  capsuleMessage: { fontSize: 14, lineHeight: 20, marginBottom: 8 },
  mediaRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  mediaThumb: {
    width: 52,
    height: 52,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaMore: { fontSize: 12, fontWeight: '700' },
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
