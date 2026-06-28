import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
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
import { patchRequest } from '@/network/patch';
import ROUTES from '@/network';
import { KISIcon } from '@/constants/kisIcons';
import KISButton from '@/constants/KISButton';

type Props = NativeStackScreenProps<RootStackParamList, 'FamilyPrayer'>;

type Prayer = {
  id: string;
  text: string;
  answered: boolean;
  created_at: string;
};

export default function FamilyPrayerScreen({ navigation }: Props) {
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const [prayers, setPrayers] = useState<Prayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newPrayer, setNewPrayer] = useState('');
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      getRequest(ROUTES.family.prayers)
        .then((res: any) => {
          if (!active) return;
          setPrayers(Array.isArray(res) ? res : res?.results ?? []);
        })
        .catch(() => setPrayers([]))
        .finally(() => { if (active) setLoading(false); });
      return () => { active = false; };
    }, []),
  );

  async function handleAddPrayer() {
    if (!newPrayer.trim()) {
      Alert.alert('Prayer text is required');
      return;
    }
    setSaving(true);
    try {
      const created = await postRequest(ROUTES.family.prayers, { text: newPrayer.trim() }) as Prayer;
      setPrayers((prev) => [created, ...prev]);
      setShowForm(false);
      setNewPrayer('');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to add prayer');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleAnswered(prayer: Prayer) {
    setTogglingId(prayer.id);
    try {
      const updated = await patchRequest(
        `${ROUTES.family.prayers}${prayer.id}/`,
        { answered: !prayer.answered },
      ) as Prayer;
      setPrayers((prev) => prev.map((p) => (p.id === prayer.id ? { ...p, ...updated } : p)));
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to update prayer');
    } finally {
      setTogglingId(null);
    }
  }

  const gutter = layout.pageGutter;

  if (loading) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: palette.bg }]}>
        <ActivityIndicator style={styles.flex} color={palette.gold} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: palette.bg }]}>
      <FlatList
        data={prayers}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: gutter, paddingTop: 20, paddingBottom: 80 }}
        ListHeaderComponent={
          <Text style={[styles.screenTitle, { color: palette.text }]}>Family Prayers</Text>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <KISIcon name="heart-outline" size={48} color={palette.subtext} />
            <Text style={[styles.emptyText, { color: palette.subtext }]}>No prayer requests yet</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View
            style={[
              styles.prayerRow,
              {
                backgroundColor: item.answered ? palette.primarySoft : palette.card,
                borderColor: item.answered ? palette.primary : palette.divider,
              },
            ]}
          >
            <TouchableOpacity
              onPress={() => handleToggleAnswered(item)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              disabled={togglingId === item.id}
            >
              {togglingId === item.id ? (
                <ActivityIndicator size="small" color={palette.primary} />
              ) : (
                <KISIcon
                  name={item.answered ? 'checkmark-circle' : 'ellipse-outline'}
                  size={24}
                  color={item.answered ? palette.primary : palette.subtext}
                />
              )}
            </TouchableOpacity>
            <View style={styles.prayerContent}>
              <Text
                style={[
                  styles.prayerText,
                  {
                    color: item.answered ? palette.primary : palette.text,
                    textDecorationLine: item.answered ? 'line-through' : 'none',
                  },
                ]}
              >
                {item.text}
              </Text>
              <Text style={[styles.prayerDate, { color: palette.subtext }]}>
                {new Date(item.created_at).toLocaleDateString()}
              </Text>
            </View>
            {item.answered && (
              <View style={[styles.answeredBadge, { backgroundColor: palette.primary }]}>
                <Text style={[styles.answeredText, { color: palette.ivory }]}>Answered</Text>
              </View>
            )}
          </View>
        )}
      />

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: palette.gold }]}
        onPress={() => setShowForm(true)}
        activeOpacity={0.85}
      >
        <KISIcon name="add" size={28} color={palette.bg} />
      </TouchableOpacity>

      {/* Add Prayer Modal */}
      <Modal visible={showForm} animationType="slide" transparent onRequestClose={() => setShowForm(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: palette.surface }]}>
            <Text style={[styles.modalTitle, { color: palette.text }]}>Add Prayer Request</Text>
            <TextInput
              style={[
                styles.input,
                styles.multiline,
                { backgroundColor: palette.card, borderColor: palette.divider, color: palette.text },
              ]}
              placeholder="Share your prayer request…"
              placeholderTextColor={palette.subtext}
              value={newPrayer}
              onChangeText={setNewPrayer}
              multiline
              autoFocus
            />
            <View style={styles.modalActions}>
              <KISButton title="Cancel" variant="ghost" onPress={() => setShowForm(false)} style={{ flex: 1 }} />
              <KISButton
                title={saving ? 'Adding…' : 'Add Prayer'}
                onPress={handleAddPrayer}
                disabled={saving}
                loading={saving}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screenTitle: { fontSize: 22, fontWeight: '700', marginBottom: 16 },
  prayerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
  },
  prayerContent: { flex: 1 },
  prayerText: { fontSize: 15, lineHeight: 20, marginBottom: 4 },
  prayerDate: { fontSize: 12 },
  answeredBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  answeredText: { fontSize: 11, fontWeight: '700' },
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
  multiline: { minHeight: 100, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 4 },
});
