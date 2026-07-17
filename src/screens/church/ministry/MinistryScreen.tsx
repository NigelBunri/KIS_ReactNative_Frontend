import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import KISButton from '@/constants/KISButton';
import { KISIcon } from '@/constants/kisIcons';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'MinistryDepartments'>;

type Department = {
  id: string;
  name: string;
  type: string;
  description?: string;
  member_count?: number;
  leader_name?: string;
};

const DEPT_TYPE_ICONS: Record<string, string> = {
  worship: 'musical-notes-outline',
  children: 'people-outline',
  youth: 'trending-up-outline',
  media: 'videocam-outline',
  ushering: 'walk-outline',
  prayer: 'heart-outline',
  evangelism: 'earth-outline',
  hospitality: 'home-outline',
  finance: 'wallet-outline',
  security: 'shield-outline',
  pastoral: 'book-outline',
  admin: 'settings-outline',
  default: 'grid-outline',
};

export default function MinistryScreen({ navigation }: Props) {
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDept, setSelectedDept] = useState<Department | null>(null);
  const [signupNote, setSignupNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const styles = useMemo(() => makeStyles(palette, layout), [palette, layout]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      getRequest(ROUTES.church.departments)
        .then(res => {
          if (res?.success) {
            const raw = res.data;
            setDepartments(Array.isArray(raw) ? raw : raw?.results ?? []);
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }, []),
  );

  const getIcon = (type: string) => DEPT_TYPE_ICONS[type?.toLowerCase()] ?? DEPT_TYPE_ICONS.default;

  const handleVolunteer = useCallback(async () => {
    if (!selectedDept) return;
    setSubmitting(true);
    try {
      const res = await postRequest(ROUTES.church.volunteers, {
        department: selectedDept.id,
        note: signupNote || undefined,
      });
      if (res?.success) {
        Alert.alert('Application Submitted', `Your volunteer application for ${selectedDept.name} has been submitted.`);
        setSelectedDept(null);
        setSignupNote('');
      } else {
        Alert.alert('Error', res?.message ?? 'Could not submit application.');
      }
    } catch {
      Alert.alert('Error', 'Network error.');
    } finally {
      setSubmitting(false);
    }
  }, [selectedDept, signupNote]);

  const renderDept = ({ item }: { item: Department }) => (
    <TouchableOpacity
      style={styles.deptCard}
      onPress={() => setSelectedDept(item)}
      activeOpacity={0.75}
    >
      <View style={styles.deptIconWrap}>
        <KISIcon name={getIcon(item.type) as any} size={24} tone="primary" />
      </View>
      <Text style={styles.deptName}>{item.name}</Text>
      {item.member_count != null && (
        <Text style={styles.deptCount}>{item.member_count} volunteers</Text>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <Text style={styles.screenTitle}>Ministry & Outreach</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={palette.primary} />
        </View>
      ) : (
        <FlatList
          data={departments}
          keyExtractor={d => d.id}
          numColumns={2}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.columnWrapper}
          renderItem={renderDept}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>No departments found.</Text>
            </View>
          }
        />
      )}

      <Modal
        visible={!!selectedDept}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedDept(null)}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHandle} />
              {selectedDept && (
                <>
                  <View style={styles.modalHeader}>
                    <View style={styles.modalIconWrap}>
                      <KISIcon name={getIcon(selectedDept.type) as any} size={28} tone="primary" />
                    </View>
                    <View>
                      <Text style={styles.modalTitle}>{selectedDept.name}</Text>
                      {selectedDept.leader_name && (
                        <Text style={styles.modalLeader}>Led by {selectedDept.leader_name}</Text>
                      )}
                    </View>
                  </View>

                  {selectedDept.description ? (
                    <Text style={styles.modalDesc}>{selectedDept.description}</Text>
                  ) : null}

                  <Text style={styles.modalLabel}>Why do you want to volunteer? (optional)</Text>
                  <TouchableOpacity
                    style={styles.noteInput}
                    onPress={() => {}}
                    activeOpacity={1}
                  >
                    <Text style={styles.noteInputPlaceholder}>Add a note...</Text>
                  </TouchableOpacity>

                  <KISButton
                    title={submitting ? 'Submitting...' : 'Volunteer for this Ministry'}
                    loading={submitting}
                    disabled={submitting}
                    onPress={handleVolunteer}
                    style={styles.volunteerBtn}
                  />
                  <KISButton
                    title="Cancel"
                    variant="ghost"
                    onPress={() => setSelectedDept(null)}
                    style={styles.cancelBtn}
                  />
                </>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function makeStyles(palette: any, layout: any) {
  const sp = layout.pageGutter;
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: palette.bg, },
    topBar: { paddingHorizontal: sp, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.divider },
    screenTitle: { fontSize: 22, fontWeight: '700', color: palette.text },
    grid: { padding: sp, paddingBottom: 80 },
    columnWrapper: { gap: 12, marginBottom: 12 },
    deptCard: {
      flex: 1,
      backgroundColor: palette.card,
      borderRadius: 14,
      padding: 16,
      alignItems: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.divider,
      minHeight: 110,
      justifyContent: 'center',
    },
    deptIconWrap: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: palette.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
    },
    deptName: { fontSize: 14, fontWeight: '600', color: palette.text, textAlign: 'center' },
    deptCount: { fontSize: 12, color: palette.subtext, marginTop: 4 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
    emptyText: { fontSize: 14, color: palette.subtext },
    modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
    modalSheet: {
      backgroundColor: palette.bg,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 20,
      paddingBottom: 36,
    },
    modalHandle: {
      width: 40,
      height: 4,
      backgroundColor: palette.divider,
      borderRadius: 2,
      alignSelf: 'center',
      marginBottom: 20,
    },
    modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 },
    modalIconWrap: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: palette.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalTitle: { fontSize: 20, fontWeight: '700', color: palette.text },
    modalLeader: { fontSize: 13, color: palette.subtext, marginTop: 2 },
    modalDesc: { fontSize: 14, color: palette.text, lineHeight: 20, marginBottom: 16 },
    modalLabel: { fontSize: 13, fontWeight: '600', color: palette.subtext, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
    noteInput: {
      backgroundColor: palette.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.divider,
      padding: 14,
      minHeight: 80,
      marginBottom: 16,
    },
    noteInputPlaceholder: { fontSize: 14, color: palette.subtext },
    volunteerBtn: { minHeight: 52, marginBottom: 8 },
    cancelBtn: {},
  });
}
