import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
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
import { patchRequest } from '@/network/patch';
import ROUTES from '@/network';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'PregnancyTrackerScreen'>;

type PregnancyData = {
  id: string;
  current_week: number;
  due_date: string;
  next_appointment?: {
    date: string;
    doctor: string;
    type: string;
  };
  symptoms?: string[];
};

const WEEK_INFO: Record<number, { size: string; development: string }> = {
  4: { size: 'a poppy seed', development: 'The embryo is forming. Neural tube development begins.' },
  8: { size: 'a kidney bean', development: 'All essential organs have begun forming. Heart is beating.' },
  12: { size: 'a lime', development: 'Reflexes are developing. Fingers and toes are fully formed.' },
  16: { size: 'an avocado', development: 'Baby can make facial expressions. Skeleton is hardening.' },
  20: { size: 'a banana', development: 'You may feel baby move. Halfway there!' },
  24: { size: 'a corn cob', development: 'Baby\'s face is fully formed. Lungs are developing.' },
  28: { size: 'an eggplant', development: 'Baby can open and close eyes. Brain is growing rapidly.' },
  32: { size: 'a squash', development: 'Baby is practicing breathing. Most organs are mature.' },
  36: { size: 'a papaya', development: 'Baby is considered full-term at 37 weeks. Almost there!' },
  40: { size: 'a watermelon', development: 'Baby is ready! Average birth weight is 7-8 pounds.' },
};

const SYMPTOM_CHIPS = [
  'nausea', 'fatigue', 'craving', 'pain', 'swelling',
];

const getWeekInfo = (week: number) => {
  const nearestKey = Object.keys(WEEK_INFO)
    .map(Number)
    .reduce((prev, curr) => (Math.abs(curr - week) < Math.abs(prev - week) ? curr : prev));
  return WEEK_INFO[nearestKey];
};

export default function PregnancyTrackerScreen({ navigation }: Props) {
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const sp = layout.pageGutter;

  const [data, setData] = useState<PregnancyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [savingSymptoms, setSavingSymptoms] = useState(false);

  const fetchPregnancy = useCallback(async () => {
    setLoading(true);
    const res = await getRequest(ROUTES.healthExtended.pregnancy);
    if (res.success && res.data) {
      setData(res.data);
      setSelectedSymptoms(res.data.symptoms ?? []);
    }
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { fetchPregnancy(); }, [fetchPregnancy]));

  const toggleSymptom = (s: string) => {
    setSelectedSymptoms((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  };

  const handleSaveSymptoms = async () => {
    setSavingSymptoms(true);
    const res = await patchRequest(ROUTES.healthExtended.pregnancy, {
      symptoms: selectedSymptoms,
    });
    setSavingSymptoms(false);
    if (res.success) {
      Alert.alert('Saved', 'Symptoms updated.');
    } else {
      Alert.alert('Error', res.message || 'Failed to save symptoms.');
    }
  };

  const styles = makeStyles(palette, sp);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator color={palette.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  const week = data?.current_week ?? 0;
  const progress = week / 40;
  const weekInfo = getWeekInfo(week);

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
        <Text style={styles.headerTitle}>Pregnancy Tracker</Text>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 80 }]}
        showsVerticalScrollIndicator={false}
      >
        {!data ? (
          <Text style={styles.emptyText}>No pregnancy profile found.</Text>
        ) : (
          <>
            {/* Week Progress */}
            <View style={styles.card}>
              <View style={styles.weekHeader}>
                <Text style={styles.weekLabel}>Week</Text>
                <Text style={styles.weekNumber}>{week}</Text>
                <Text style={styles.weekTotal}>/40</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
                <View style={[styles.progressMarker, { left: `${progress * 100}%` }]} />
              </View>
              {data.due_date && (
                <Text style={styles.dueDate}>
                  Due: {new Date(data.due_date).toLocaleDateString()}
                </Text>
              )}
            </View>

            {/* Development Card */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Week {week} Development</Text>
              <View style={styles.devRow}>
                <KISIcon name="heart" size={20} color={palette.primary} />
                <Text style={styles.devText}>
                  Baby is the size of <Text style={styles.devHighlight}>{weekInfo.size}</Text>.
                </Text>
              </View>
              <Text style={styles.devDescription}>{weekInfo.development}</Text>
            </View>

            {/* Next Appointment */}
            {data.next_appointment && (
              <View style={styles.appointmentCard}>
                <View style={styles.appointmentIcon}>
                  <KISIcon name="calendar" size={20} color={palette.primary} />
                </View>
                <View style={styles.appointmentInfo}>
                  <Text style={styles.appointmentType}>{data.next_appointment.type}</Text>
                  <Text style={styles.appointmentDoctor}>{data.next_appointment.doctor}</Text>
                  <Text style={styles.appointmentDate}>
                    {new Date(data.next_appointment.date).toLocaleString()}
                  </Text>
                </View>
              </View>
            )}

            {/* Symptom Logger */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Log Symptoms</Text>
              <View style={styles.symptomsRow}>
                {SYMPTOM_CHIPS.map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[
                      styles.symptomChip,
                      selectedSymptoms.includes(s) && styles.symptomChipActive,
                    ]}
                    onPress={() => toggleSymptom(s)}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Text style={[
                      styles.symptomText,
                      selectedSymptoms.includes(s) && styles.symptomTextActive,
                    ]}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <KISButton
                title="Save Symptoms"
                variant="secondary"
                size="sm"
                loading={savingSymptoms}
                onPress={handleSaveSymptoms}
              />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(palette: any, sp: number) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: palette.bg },
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
    content: { padding: sp, gap: 16 },
    emptyText: { color: palette.subtext, textAlign: 'center', marginTop: 40 },
    card: {
      backgroundColor: palette.card,
      borderRadius: 14,
      padding: 16,
      borderWidth: 1,
      borderColor: palette.divider,
      gap: 12,
    },
    weekHeader: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 4,
    },
    weekLabel: { fontSize: 14, color: palette.subtext },
    weekNumber: { fontSize: 40, fontWeight: '800', color: palette.primary, lineHeight: 46 },
    weekTotal: { fontSize: 18, color: palette.subtext, fontWeight: '500' },
    progressTrack: {
      height: 10,
      backgroundColor: palette.divider,
      borderRadius: 5,
      overflow: 'visible',
    },
    progressFill: {
      height: '100%',
      backgroundColor: palette.primary,
      borderRadius: 5,
    },
    progressMarker: {
      position: 'absolute',
      top: -4,
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: palette.primary,
      borderWidth: 3,
      borderColor: palette.card,
      marginLeft: -9,
    },
    dueDate: { fontSize: 13, color: palette.subtext, textAlign: 'right' },
    cardTitle: { fontSize: 16, fontWeight: '600', color: palette.text },
    devRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    devText: { fontSize: 14, color: palette.text, flex: 1 },
    devHighlight: { color: palette.primary, fontWeight: '600' },
    devDescription: { fontSize: 13, color: palette.subtext, lineHeight: 20 },
    appointmentCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: palette.primarySoft,
      borderRadius: 14,
      padding: 14,
      gap: 12,
      borderWidth: 1,
      borderColor: palette.primary + '44',
    },
    appointmentIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: palette.card,
      justifyContent: 'center',
      alignItems: 'center',
    },
    appointmentInfo: { flex: 1 },
    appointmentType: { fontSize: 14, fontWeight: '700', color: palette.primary },
    appointmentDoctor: { fontSize: 13, color: palette.text, marginTop: 2 },
    appointmentDate: { fontSize: 12, color: palette.subtext, marginTop: 2 },
    symptomsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    symptomChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.divider,
      minHeight: 36,
      justifyContent: 'center',
    },
    symptomChipActive: {
      backgroundColor: palette.primarySoft,
      borderColor: palette.primary,
    },
    symptomText: { fontSize: 13, color: palette.subtext },
    symptomTextActive: { color: palette.primary, fontWeight: '600' },
  });
}
