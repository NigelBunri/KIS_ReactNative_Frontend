import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
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

type Props = NativeStackScreenProps<RootStackParamList, 'FamilyNoticeBoard'>;

type Notice = {
  id: string;
  title: string;
  content: string;
  pinned: boolean;
  expiry?: string;
  created_at: string;
};

export default function FamilyNoticeBoardScreen({ navigation }: Props) {
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formPinned, setFormPinned] = useState(false);
  const [formExpiry, setFormExpiry] = useState('');
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      getRequest(ROUTES.family.notices)
        .then((res: any) => {
          if (!active) return;
          setNotices(Array.isArray(res) ? res : res?.results ?? []);
        })
        .catch(() => setNotices([]))
        .finally(() => { if (active) setLoading(false); });
      return () => { active = false; };
    }, []),
  );

  async function handlePost() {
    if (!formTitle.trim() || !formContent.trim()) {
      Alert.alert('Title and content are required');
      return;
    }
    setSaving(true);
    try {
      const newNotice = await postRequest(ROUTES.family.notices, {
        title: formTitle.trim(),
        content: formContent.trim(),
        pinned: formPinned,
        expiry: formExpiry.trim() || undefined,
      }) as unknown as Notice;
      setNotices((prev) => [newNotice, ...prev]);
      setShowForm(false);
      setFormTitle('');
      setFormContent('');
      setFormPinned(false);
      setFormExpiry('');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to post notice');
    } finally {
      setSaving(false);
    }
  }

  const gutter = layout.pageGutter;
  const pinned = notices.filter((n) => n.pinned);
  const regular = notices.filter((n) => !n.pinned);

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
        <Text style={[styles.screenTitle, { color: palette.text }]}>Notice Board</Text>

        {/* Pinned */}
        {pinned.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <KISIcon name="pin" size={16} color={palette.gold} />
              <Text style={[styles.sectionLabel, { color: palette.gold }]}>Pinned</Text>
            </View>
            {pinned.map((notice) => (
              <NoticeCard key={notice.id} notice={notice} palette={palette} pinned />
            ))}
          </>
        )}

        {/* Regular */}
        {regular.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: palette.subtext, marginTop: 20, marginBottom: 8 }]}>
              All Notices
            </Text>
            {regular.map((notice) => (
              <NoticeCard key={notice.id} notice={notice} palette={palette} />
            ))}
          </>
        )}

        {notices.length === 0 && (
          <View style={styles.emptyState}>
            <KISIcon name="megaphone-outline" size={48} color={palette.subtext} />
            <Text style={[styles.emptyText, { color: palette.subtext }]}>No notices yet</Text>
          </View>
        )}
      </ScrollView>

      {/* Post Notice button */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: palette.gold }]}
        onPress={() => setShowForm(true)}
        activeOpacity={0.85}
      >
        <KISIcon name="create-outline" size={24} color={palette.bg} />
      </TouchableOpacity>

      {/* Form Modal */}
      <Modal visible={showForm} animationType="slide" transparent onRequestClose={() => setShowForm(false)}>
        <View style={styles.modalOverlay}>
          <ScrollView>
            <View style={[styles.modalSheet, { backgroundColor: palette.surface }]}>
              <Text style={[styles.modalTitle, { color: palette.text }]}>Post Notice</Text>

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
                placeholder="Content"
                placeholderTextColor={palette.subtext}
                value={formContent}
                onChangeText={setFormContent}
                multiline
                numberOfLines={4}
              />
              <TextInput
                style={[styles.input, { backgroundColor: palette.card, borderColor: palette.divider, color: palette.text }]}
                placeholder="Expiry date (YYYY-MM-DD, optional)"
                placeholderTextColor={palette.subtext}
                value={formExpiry}
                onChangeText={setFormExpiry}
              />

              <View style={styles.pinRow}>
                <Text style={[styles.pinLabel, { color: palette.text }]}>Pin notice</Text>
                <Switch
                  value={formPinned}
                  onValueChange={setFormPinned}
                  trackColor={{ false: palette.divider, true: palette.primaryStrong }}
                  thumbColor={palette.ivory}
                />
              </View>

              <View style={styles.modalActions}>
                <KISButton title="Cancel" variant="ghost" onPress={() => setShowForm(false)} style={{ flex: 1 }} />
                <KISButton
                  title={saving ? 'Posting…' : 'Post'}
                  onPress={handlePost}
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

function NoticeCard({ notice, palette, pinned }: { notice: Notice; palette: any; pinned?: boolean }) {
  return (
    <View
      style={[
        styles.noticeCard,
        {
          backgroundColor: palette.card,
          borderColor: pinned ? palette.gold : palette.divider,
          borderWidth: pinned ? 1.5 : 1,
        },
      ]}
    >
      <View style={styles.noticeHeader}>
        <Text style={[styles.noticeTitle, { color: palette.text }]}>{notice.title}</Text>
        {pinned && <KISIcon name="pin" size={14} color={palette.gold} />}
      </View>
      <Text style={[styles.noticeContent, { color: palette.subtext }]}>{notice.content}</Text>
      {notice.expiry && (
        <Text style={[styles.noticeExpiry, { color: palette.danger }]}>
          Expires: {notice.expiry}
        </Text>
      )}
      <Text style={[styles.noticeDate, { color: palette.subtext }]}>
        {new Date(notice.created_at).toLocaleDateString()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screenTitle: { fontSize: 22, fontWeight: '700', marginBottom: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  sectionLabel: { fontSize: 14, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  noticeCard: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  noticeHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  noticeTitle: { fontSize: 16, fontWeight: '700', flex: 1 },
  noticeContent: { fontSize: 14, lineHeight: 20, marginBottom: 8 },
  noticeExpiry: { fontSize: 12, marginBottom: 4 },
  noticeDate: { fontSize: 11 },
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
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    gap: 12,
  },
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
  pinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  pinLabel: { fontSize: 15 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 4 },
});
