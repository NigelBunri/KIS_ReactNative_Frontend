import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import LinearGradient from 'react-native-linear-gradient';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import KISButton from '@/constants/KISButton';
import { KISIcon } from '@/constants/kisIcons';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'SymptomChecker'>;

type CheckResult = {
  triage_level: 'emergency' | 'urgent' | 'moderate' | 'mild';
  recommendations: string[];
  possible_conditions?: string[];
  seek_care_within?: string;
};

const COMMON_SYMPTOMS = [
  { key: 'headache', label: 'Headache', icon: 'warning' },
  { key: 'fever', label: 'Fever', icon: 'flame' },
  { key: 'cough', label: 'Cough', icon: 'volume' },
  { key: 'fatigue', label: 'Fatigue', icon: 'bolt' },
  { key: 'nausea', label: 'Nausea', icon: 'refresh' },
  { key: 'pain', label: 'Pain', icon: 'report' },
  { key: 'shortness_of_breath', label: 'Shortness of Breath', icon: 'info' },
  { key: 'dizziness', label: 'Dizziness', icon: 'sparkles' },
];

const TRIAGE_COLORS: Record<string, string> = {};

const TRIAGE_LABELS: Record<string, string> = {
  emergency: 'Emergency — Seek immediate care',
  urgent: 'Urgent — See a doctor today',
  moderate: 'Moderate — Schedule appointment soon',
  mild: 'Mild — Monitor symptoms at home',
};

export default function SymptomCheckerScreen({ navigation }: Props) {
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const sp = layout.pageGutter;

  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [additionalSymptoms, setAdditionalSymptoms] = useState('');
  const [durationDays, setDurationDays] = useState('');
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);

  const triageColor = (level: string): string => {
    if (level === 'emergency') return palette.danger;
    if (level === 'urgent') return palette.gold;
    if (level === 'moderate') return palette.gold;
    return palette.primary;
  };

  const toggleSymptom = (s: string) => {
    setSelectedSymptoms((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  };

  const handleSubmit = async () => {
    const allSymptoms = [...selectedSymptoms];
    if (additionalSymptoms.trim()) {
      allSymptoms.push(...additionalSymptoms.split(',').map((s) => s.trim()).filter(Boolean));
    }
    if (allSymptoms.length === 0) {
      Alert.alert('No symptoms selected', 'Please select or enter at least one symptom.');
      return;
    }
    setChecking(true);
    setResult(null);
    const res = await postRequest(ROUTES.healthExtended.symptomsCheck, {
      symptoms: allSymptoms,
      duration_days: parseInt(durationDays, 10) || 1,
    });
    setChecking(false);
    if (res.success && res.data) {
      setResult(res.data);
    } else {
      Alert.alert('Error', res.message || 'Failed to check symptoms.');
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
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.backBtn}
        >
          <KISIcon name="arrow-left" size={22} color={palette.ivory} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>AI Symptom Checker (Beta)</Text>
          <Text style={styles.headerSub}>Not a substitute for professional medical advice</Text>
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 80 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Disclaimer */}
        <View style={styles.disclaimer}>
          <KISIcon name="info" size={16} color={palette.gold} />
          <Text style={styles.disclaimerText}>
            This tool provides general guidance only. Always consult a qualified healthcare professional for diagnosis and treatment.
          </Text>
        </View>

        {/* Symptom Chips */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Symptoms</Text>
          <View style={styles.symptomsGrid}>
            {COMMON_SYMPTOMS.map((s) => {
              const selected = selectedSymptoms.includes(s.key);
              return (
                <TouchableOpacity
                  key={s.key}
                  style={[styles.symptomChip, selected && styles.symptomChipActive]}
                  onPress={() => toggleSymptom(s.key)}
                  hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                >
                  <KISIcon
                    name={s.icon as any}
                    size={14}
                    color={selected ? palette.primary : palette.subtext}
                  />
                  <Text style={[styles.symptomText, selected && styles.symptomTextActive]}>
                    {s.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Additional Symptoms */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Additional Symptoms</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. sore throat, runny nose (comma-separated)"
            placeholderTextColor={palette.subtext}
            value={additionalSymptoms}
            onChangeText={setAdditionalSymptoms}
            multiline
            numberOfLines={2}
            textAlignVertical="top"
          />
        </View>

        {/* Duration */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Duration (days)</Text>
          <TextInput
            style={styles.durationInput}
            placeholder="e.g. 3"
            placeholderTextColor={palette.subtext}
            keyboardType="number-pad"
            value={durationDays}
            onChangeText={setDurationDays}
          />
        </View>

        {/* Submit */}
        <KISButton
          title="Check Symptoms"
          variant="primary"
          size="lg"
          loading={checking}
          left={<KISIcon name="sparkles" size={18} color={palette.ivory} />}
          onPress={handleSubmit}
        />

        {/* Results */}
        {checking && (
          <View style={styles.loadingResult}>
            <ActivityIndicator color={palette.primary} />
            <Text style={styles.loadingText}>Analyzing symptoms...</Text>
          </View>
        )}

        {result && (
          <View style={[styles.resultCard, { borderColor: triageColor(result.triage_level) }]}>
            {/* Triage Level */}
            <View style={[styles.triageBanner, { backgroundColor: triageColor(result.triage_level) }]}>
              <KISIcon name="shield" size={18} color={palette.ivory} focused />
              <Text style={styles.triageText}>
                {TRIAGE_LABELS[result.triage_level] ?? result.triage_level.toUpperCase()}
              </Text>
            </View>

            {result.seek_care_within && (
              <View style={styles.resultRow}>
                <KISIcon name="calendar" size={14} color={palette.subtext} />
                <Text style={styles.resultLabel}>Seek care: </Text>
                <Text style={styles.resultValue}>{result.seek_care_within}</Text>
              </View>
            )}

            {/* Recommendations */}
            {result.recommendations.length > 0 && (
              <View style={styles.resultSection}>
                <Text style={styles.resultSectionTitle}>Recommendations</Text>
                {result.recommendations.map((r, i) => (
                  <View key={i} style={styles.bulletRow}>
                    <Text style={styles.bullet}>•</Text>
                    <Text style={styles.bulletText}>{r}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Possible Conditions */}
            {result.possible_conditions && result.possible_conditions.length > 0 && (
              <View style={styles.resultSection}>
                <Text style={styles.resultSectionTitle}>Possible Conditions</Text>
                <View style={styles.conditionsRow}>
                  {result.possible_conditions.map((c, i) => (
                    <View key={i} style={styles.conditionChip}>
                      <Text style={styles.conditionText}>{c}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Book Consultation CTA */}
            <KISButton
              title="Book Consultation"
              variant="primary"
              size="md"
              left={<KISIcon name="calendar" size={16} color={palette.ivory} />}
              onPress={() => navigation.navigate('TelemedicineHub')}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(palette: any, sp: number) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: palette.bg, },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: sp,
      paddingTop: 12,
      paddingBottom: 16,
      gap: 12,
    },
    backBtn: { minWidth: 44, minHeight: 44, justifyContent: 'center' },
    headerText: { flex: 1 },
    headerTitle: { fontSize: 18, fontWeight: '700', color: palette.ivory },
    headerSub: { fontSize: 11, color: palette.ivory, opacity: 0.75, marginTop: 2 },
    content: { padding: sp, gap: 18 },
    disclaimer: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: palette.gold + '22',
      borderRadius: 10,
      padding: 12,
      gap: 8,
      borderWidth: 1,
      borderColor: palette.gold + '44',
    },
    disclaimerText: {
      fontSize: 12,
      color: palette.text,
      flex: 1,
      lineHeight: 17,
    },
    section: { gap: 10 },
    sectionTitle: { fontSize: 15, fontWeight: '600', color: palette.text },
    symptomsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    symptomChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 24,
      backgroundColor: palette.card,
      borderWidth: 1,
      borderColor: palette.divider,
      minHeight: 44,
    },
    symptomChipActive: {
      backgroundColor: palette.primarySoft,
      borderColor: palette.primary,
    },
    symptomText: { fontSize: 13, color: palette.subtext },
    symptomTextActive: { color: palette.primary, fontWeight: '600' },
    input: {
      backgroundColor: palette.card,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: palette.divider,
      padding: 12,
      color: palette.text,
      fontSize: 14,
      minHeight: 60,
    },
    durationInput: {
      backgroundColor: palette.card,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: palette.divider,
      padding: 12,
      color: palette.text,
      fontSize: 14,
      minHeight: 44,
      width: 100,
    },
    loadingResult: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 16,
      justifyContent: 'center',
    },
    loadingText: { color: palette.subtext, fontSize: 14 },
    resultCard: {
      borderRadius: 14,
      borderWidth: 2,
      overflow: 'hidden',
      gap: 0,
    },
    triageBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 14,
    },
    triageText: {
      fontSize: 14,
      fontWeight: '700',
      color: palette.ivory,
      flex: 1,
    },
    resultRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingTop: 12,
    },
    resultLabel: { fontSize: 13, color: palette.subtext },
    resultValue: { fontSize: 13, color: palette.text, fontWeight: '600' },
    resultSection: {
      paddingHorizontal: 14,
      paddingTop: 12,
      gap: 8,
    },
    resultSectionTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: palette.text,
    },
    bulletRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
    bullet: { fontSize: 14, color: palette.primary, lineHeight: 20 },
    bulletText: { fontSize: 13, color: palette.text, flex: 1, lineHeight: 20 },
    conditionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    conditionChip: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 10,
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.divider,
    },
    conditionText: { fontSize: 12, color: palette.subtext },
    bookingCta: {
      margin: 14,
      marginTop: 12,
    },
  });
}
