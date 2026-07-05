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

type Props = NativeStackScreenProps<RootStackParamList, 'Medications'>;

type Medication = {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  refill_due?: string;
  instructions?: string;
};

type Reminder = {
  id: string;
  message: string;
  medication_name: string;
};

function isRefillSoon(dateStr?: string): boolean {
  if (!dateStr) return false;
  const refill = new Date(dateStr);
  const now = new Date();
  const diffDays = (refill.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays <= 7;
}

export default function MedicationsScreen({ navigation }: Props) {
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const sp = layout.pageGutter;

  const [medications, setMedications] = useState<Medication[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [medName, setMedName] = useState('');
  const [dosage, setDosage] = useState('');
  const [frequency, setFrequency] = useState('');
  const [refillDue, setRefillDue] = useState('');
  const [instructions, setInstructions] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [medsRes, remindersRes] = await Promise.all([
      getRequest(ROUTES.healthExtended.medications),
      getRequest(ROUTES.healthExtended.medicationReminders),
    ]);
    if (medsRes.success) {
      setMedications(Array.isArray(medsRes.data?.results ?? medsRes.data) ? (medsRes.data?.results ?? medsRes.data) : []);
    }
    if (remindersRes.success) {
      setReminders(Array.isArray(remindersRes.data?.results ?? remindersRes.data) ? (remindersRes.data?.results ?? remindersRes.data) : []);
    }
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  const handleSubmit = async () => {
    if (!medName.trim()) {
      Alert.alert('Name required', 'Please enter the medication name.');
      return;
    }
    setSubmitting(true);
    const res = await postRequest(ROUTES.healthExtended.medications, {
      name: medName.trim(),
      dosage: dosage.trim(),
      frequency: frequency.trim(),
      refill_due: refillDue.trim() || undefined,
      instructions: instructions.trim() || undefined,
    });
    setSubmitting(false);
    if (res.success) {
      Alert.alert('Added', 'Medication has been added.');
      setShowForm(false);
      setMedName(''); setDosage(''); setFrequency(''); setRefillDue(''); setInstructions('');
      fetchData();
    } else {
      Alert.alert('Error', res.message || 'Failed to add medication.');
    }
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
        <Text style={styles.headerTitle}>Medications</Text>
        <Text style={styles.headerSub}>Track your prescriptions and refills</Text>
      </LinearGradient>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={palette.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={medications}
          keyExtractor={(m) => m.id}
          contentContainerStyle={[styles.list, { paddingBottom: 100 }]}
          ListHeaderComponent={
            <>
              {/* Reminders Banner */}
              {reminders.length > 0 && (
                <View style={styles.remindersBanner}>
                  <KISIcon name="bell" size={16} color={palette.gold} focused />
                  <View style={styles.remindersText}>
                    <Text style={styles.remindersTitle}>Medication Reminders</Text>
                    {reminders.slice(0, 2).map((r) => (
                      <Text key={r.id} style={styles.reminderItem}>
                        • {r.medication_name}: {r.message}
                      </Text>
                    ))}
                  </View>
                </View>
              )}
              {medications.length > 0 && (
                <Text style={styles.sectionTitle}>Active Medications</Text>
              )}
            </>
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <KISIcon name="file" size={48} color={palette.subtext} />
              <Text style={styles.emptyText}>No medications tracked.</Text>
              <Text style={styles.emptySubtext}>Tap the button below to add one.</Text>
            </View>
          }
          renderItem={({ item: med }) => {
            const soon = isRefillSoon(med.refill_due);
            return (
              <View style={[styles.medCard, soon && styles.medCardAlert]}>
                <View style={styles.medRow}>
                  <View style={styles.medIcon}>
                    <KISIcon name="heart" size={18} color={palette.primary} />
                  </View>
                  <View style={styles.medInfo}>
                    <Text style={styles.medName}>{med.name}</Text>
                    <Text style={styles.medDosage}>{med.dosage} — {med.frequency}</Text>
                    {med.instructions ? (
                      <Text style={styles.medInstructions} numberOfLines={1}>{med.instructions}</Text>
                    ) : null}
                  </View>
                  {med.refill_due && (
                    <View style={[
                      styles.refillBadge,
                      { backgroundColor: soon ? palette.danger + '22' : palette.surface },
                    ]}>
                      <KISIcon name="refresh" size={12} color={soon ? palette.danger : palette.subtext} />
                      <Text style={[
                        styles.refillText,
                        { color: soon ? palette.danger : palette.subtext },
                      ]}>
                        {new Date(med.refill_due).toLocaleDateString()}
                      </Text>
                    </View>
                  )}
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

      {/* Add Medication Modal */}
      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Medication</Text>
            <TouchableOpacity
              onPress={() => setShowForm(false)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.closeBtn}
            >
              <KISIcon name="close" size={22} color={palette.text} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.formContent}>
            {[
              { label: 'Medication Name *', value: medName, onChange: setMedName, placeholder: 'e.g. Metformin' },
              { label: 'Dosage', value: dosage, onChange: setDosage, placeholder: 'e.g. 500mg' },
              { label: 'Frequency', value: frequency, onChange: setFrequency, placeholder: 'e.g. Twice daily' },
              { label: 'Refill Due (YYYY-MM-DD)', value: refillDue, onChange: setRefillDue, placeholder: 'e.g. 2025-08-01' },
              { label: 'Instructions', value: instructions, onChange: setInstructions, placeholder: 'Take with food...' },
            ].map((field) => (
              <React.Fragment key={field.label}>
                <Text style={styles.fieldLabel}>{field.label}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={field.placeholder}
                  placeholderTextColor={palette.subtext}
                  value={field.value}
                  onChangeText={field.onChange}
                />
              </React.Fragment>
            ))}
            <KISButton
              title="Add Medication"
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
    safe: { flex: 1, backgroundColor: palette.bg, marginTop: 25 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
      paddingHorizontal: sp,
      paddingTop: 16,
      paddingBottom: 20,
    },
    headerTitle: { fontSize: 26, fontWeight: '700', color: palette.ivory },
    headerSub: { fontSize: 13, color: palette.ivory, opacity: 0.8, marginTop: 2 },
    list: { paddingHorizontal: sp, paddingTop: 12, gap: 12 },
    remindersBanner: {
      flexDirection: 'row',
      backgroundColor: palette.gold + '22',
      borderRadius: 12,
      padding: 12,
      gap: 10,
      borderWidth: 1,
      borderColor: palette.gold + '44',
      marginBottom: 14,
    },
    remindersText: { flex: 1, gap: 4 },
    remindersTitle: { fontSize: 13, fontWeight: '700', color: palette.gold },
    reminderItem: { fontSize: 12, color: palette.text },
    sectionTitle: { fontSize: 15, fontWeight: '600', color: palette.text, marginBottom: 4 },
    emptyContainer: {
      alignItems: 'center',
      paddingTop: 60,
      gap: 8,
    },
    emptyText: { fontSize: 16, color: palette.text, fontWeight: '600', marginTop: 8 },
    emptySubtext: { fontSize: 13, color: palette.subtext },
    medCard: {
      backgroundColor: palette.card,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: palette.divider,
    },
    medCardAlert: { borderColor: palette.danger + '66' },
    medRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    medIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: palette.primarySoft,
      justifyContent: 'center',
      alignItems: 'center',
    },
    medInfo: { flex: 1, gap: 3 },
    medName: { fontSize: 15, fontWeight: '600', color: palette.text },
    medDosage: { fontSize: 13, color: palette.subtext },
    medInstructions: { fontSize: 12, color: palette.subtext },
    refillBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
    },
    refillText: { fontSize: 10, fontWeight: '600' },
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
    modalSafe: { flex: 1, backgroundColor: palette.bg, marginTop: 25 },
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
  });
}
