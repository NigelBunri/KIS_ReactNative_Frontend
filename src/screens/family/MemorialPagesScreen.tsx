import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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

type Props = NativeStackScreenProps<RootStackParamList, 'FamilyMemorials'>;

type MemorialPage = {
  id: string;
  name: string;
  birth_date?: string | null;
  death_date?: string | null;
  tribute?: string;
  photo_url?: string;
  is_public: boolean;
};

export default function MemorialPagesScreen({ navigation }: Props) {
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const [pages, setPages] = useState<MemorialPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formBirthDate, setFormBirthDate] = useState('');
  const [formDeathDate, setFormDeathDate] = useState('');
  const [formTribute, setFormTribute] = useState('');
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      getRequest(ROUTES.family.memorials)
        .then((res: any) => {
          if (!active) return;
          setPages(Array.isArray(res?.data) ? res.data : res?.data?.results ?? []);
        })
        .catch(() => setPages([]))
        .finally(() => { if (active) setLoading(false); });
      return () => { active = false; };
    }, []),
  );

  async function handleCreate() {
    if (!formName.trim()) {
      Alert.alert('A name is required');
      return;
    }
    setSaving(true);
    try {
      const createdResult = await postRequest(ROUTES.family.memorials, {
        name: formName.trim(),
        birth_date: formBirthDate.trim() || undefined,
        death_date: formDeathDate.trim() || undefined,
        tribute: formTribute.trim() || undefined,
      });
      const created = (createdResult?.data ?? createdResult) as MemorialPage;
      setPages((prev) => [created, ...prev]);
      setShowForm(false);
      setFormName('');
      setFormBirthDate('');
      setFormDeathDate('');
      setFormTribute('');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to create memorial page');
    } finally {
      setSaving(false);
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
      <ScrollView contentContainerStyle={{ paddingHorizontal: gutter, paddingTop: 20, paddingBottom: 80 }}>
        <Text style={[styles.screenTitle, { color: palette.text }]}>Memorial Pages</Text>

        {pages.length === 0 ? (
          <View style={styles.emptyState}>
            <KISIcon name="flower-outline" size={48} color={palette.subtext} />
            <Text style={[styles.emptyText, { color: palette.subtext }]}>
              No memorial pages yet
            </Text>
          </View>
        ) : (
          pages.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={[styles.card, { backgroundColor: palette.card, borderColor: palette.divider }]}
              onPress={() => navigation.navigate('MemorialPage', { memorialId: p.id })}
              activeOpacity={0.8}
            >
              {p.photo_url ? (
                <Image source={{ uri: p.photo_url }} style={styles.photo} />
              ) : (
                <View style={[styles.photo, styles.photoPlaceholder, { backgroundColor: palette.surface }]}>
                  <KISIcon name="flower-outline" size={22} color={palette.subtext} />
                </View>
              )}
              <View style={styles.cardInfo}>
                <Text style={[styles.cardName, { color: palette.text }]}>{p.name}</Text>
                {(p.birth_date || p.death_date) && (
                  <Text style={[styles.cardDates, { color: palette.subtext }]}>
                    {p.birth_date ?? '—'} – {p.death_date ?? '—'}
                  </Text>
                )}
              </View>
              <KISIcon name="chevron-forward" size={18} color={palette.subtext} />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: palette.gold }]}
        onPress={() => setShowForm(true)}
        activeOpacity={0.85}
      >
        <KISIcon name="add" size={28} color={palette.bg} />
      </TouchableOpacity>

      <Modal visible={showForm} animationType="slide" transparent onRequestClose={() => setShowForm(false)}>
        <View style={styles.modalOverlay}>
          <ScrollView>
            <View style={[styles.modalSheet, { backgroundColor: palette.surface }]}>
              <Text style={[styles.modalTitle, { color: palette.text }]}>Create Memorial Page</Text>

              <TextInput
                style={[styles.input, { backgroundColor: palette.card, borderColor: palette.divider, color: palette.text }]}
                placeholder="Name"
                placeholderTextColor={palette.subtext}
                value={formName}
                onChangeText={setFormName}
              />
              <TextInput
                style={[styles.input, { backgroundColor: palette.card, borderColor: palette.divider, color: palette.text }]}
                placeholder="Birth date (YYYY-MM-DD, optional)"
                placeholderTextColor={palette.subtext}
                value={formBirthDate}
                onChangeText={setFormBirthDate}
              />
              <TextInput
                style={[styles.input, { backgroundColor: palette.card, borderColor: palette.divider, color: palette.text }]}
                placeholder="Death date (YYYY-MM-DD, optional)"
                placeholderTextColor={palette.subtext}
                value={formDeathDate}
                onChangeText={setFormDeathDate}
              />
              <TextInput
                style={[
                  styles.input,
                  styles.multiline,
                  { backgroundColor: palette.card, borderColor: palette.divider, color: palette.text },
                ]}
                placeholder="Tribute (optional)"
                placeholderTextColor={palette.subtext}
                value={formTribute}
                onChangeText={setFormTribute}
                multiline
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
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  photo: { width: 48, height: 48, borderRadius: 24 },
  photoPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 16, fontWeight: '700' },
  cardDates: { fontSize: 13, marginTop: 2 },
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
