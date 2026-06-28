import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import KISButton from '@/constants/KISButton';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'BusinessImpactReport'>;

type MetricCard = {
  key: string;
  label: string;
  value: string | number;
  unit?: string;
  icon?: string;
  change?: number;
};

type ImpactReport = {
  id?: string;
  org_id?: string;
  year?: number;
  generated_at?: string;
  metrics: Record<string, any>;
};

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => String(CURRENT_YEAR - i));

const METRIC_ICONS: Record<string, string> = {
  jobs_created: 'briefcase-outline',
  revenue: 'cash-outline',
  people_served: 'people-outline',
  beneficiaries: 'heart-outline',
  partnerships: 'link-outline',
  events: 'calendar-outline',
  volunteers: 'hand-left-outline',
  donations: 'gift-outline',
  countries: 'earth-outline',
};

function parseMetrics(metricsObj: Record<string, any>): MetricCard[] {
  return Object.entries(metricsObj).map(([key, value]) => ({
    key,
    label: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    value: typeof value === 'object' ? JSON.stringify(value) : value,
    icon: METRIC_ICONS[key] ?? 'bar-chart-outline',
    unit: typeof value === 'number' && key.toLowerCase().includes('revenue') ? 'USD' : undefined,
  }));
}

export default function ImpactReportScreen({ navigation }: Props) {
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const [orgId, setOrgId] = useState('');
  const [year, setYear] = useState(String(CURRENT_YEAR));
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [report, setReport] = useState<ImpactReport | null>(null);
  const [previousReports, setPreviousReports] = useState<ImpactReport[]>([]);
  const [loadingPrev, setLoadingPrev] = useState(true);

  const styles = useMemo(() => makeStyles(palette, layout), [palette, layout]);

  useFocusEffect(
    useCallback(() => {
      setLoadingPrev(true);
      getRequest(ROUTES.business.impactGenerate + '?list=true')
        .then(res => {
          const list = res?.data?.results ?? res?.data ?? res?.results ?? res ?? [];
          setPreviousReports(Array.isArray(list) ? list : []);
        })
        .catch(() => setPreviousReports([]))
        .finally(() => setLoadingPrev(false));
    }, []),
  );

  const handleGenerate = async () => {
    setGenerating(true);
    setReport(null);
    try {
      const res = await postRequest(ROUTES.business.impactGenerate, {
        org_id: orgId.trim() || undefined,
        year: parseInt(year, 10),
      });
      const data = res?.data ?? res;
      if (data?.metrics) {
        setReport(data);
      } else {
        Alert.alert('No data', 'No impact data found for that organisation and year.');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to generate report.');
    } finally {
      setGenerating(false);
    }
  };

  const metrics = report?.metrics ? parseMetrics(report.metrics) : [];

  const renderMetricCard = ({ item }: { item: MetricCard }) => (
    <View style={styles.metricCard}>
      <View style={[styles.metricIcon, { backgroundColor: palette.primarySoft }]}>
        <KISIcon name={(item.icon ?? 'bar-chart-outline') as any} size={22} color={palette.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.metricLabel}>{item.label}</Text>
        <Text style={styles.metricValue}>
          {item.unit ? `${item.unit} ` : ''}{typeof item.value === 'number' ? item.value.toLocaleString() : item.value}
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.navBar}>
          <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
            <KISIcon name="arrow-back-outline" size={24} color={palette.text} />
          </Pressable>
          <Text style={styles.navTitle}>Impact Report</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Generate Form */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Generate Report</Text>

            <Text style={styles.label}>Organisation ID (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="Leave blank for your own org"
              placeholderTextColor={palette.subtext}
              value={orgId}
              onChangeText={setOrgId}
              autoCapitalize="none"
            />

            <Text style={[styles.label, { marginTop: 14 }]}>Year</Text>
            <Pressable
              style={styles.selectorBtn}
              onPress={() => setShowYearPicker(!showYearPicker)}
            >
              <Text style={[styles.selectorText, { color: palette.text }]}>{year}</Text>
              <KISIcon name="chevron-down-outline" size={16} color={palette.subtext} />
            </Pressable>
            {showYearPicker ? (
              <View style={styles.pickerDropdown}>
                {YEARS.map(y => (
                  <Pressable
                    key={y}
                    style={[styles.pickerItem, y === year && { backgroundColor: palette.primarySoft }]}
                    onPress={() => { setYear(y); setShowYearPicker(false); }}
                  >
                    <Text style={[styles.pickerItemText, { color: y === year ? palette.primary : palette.text }]}>{y}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            <KISButton
              title="Generate Report"
              loading={generating}
              onPress={handleGenerate}
              style={{ marginTop: 20 }}
            />
          </View>

          {/* Report Results */}
          {report ? (
            <View style={styles.section}>
              <LinearGradient
                colors={[palette.gradientStart, palette.gradientEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.reportHeader}
              >
                <KISIcon name="bar-chart" size={28} color={palette.ivory} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.reportTitle, { color: palette.ivory }]}>
                    Impact Report {report.year}
                  </Text>
                  {report.generated_at ? (
                    <Text style={[styles.reportDate, { color: palette.ivory }]}>
                      Generated {new Date(report.generated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </Text>
                  ) : null}
                </View>
              </LinearGradient>

              {metrics.length > 0 ? (
                <FlatList
                  data={metrics}
                  keyExtractor={item => item.key}
                  renderItem={renderMetricCard}
                  scrollEnabled={false}
                  numColumns={2}
                  columnWrapperStyle={{ gap: 10 }}
                  contentContainerStyle={{ gap: 10, paddingTop: 12 }}
                />
              ) : (
                <Text style={[styles.noMetrics, { color: palette.subtext }]}>No metrics in this report.</Text>
              )}
            </View>
          ) : null}

          {/* Previous Reports */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Previous Reports</Text>
            {loadingPrev ? (
              <ActivityIndicator color={palette.primary} style={{ marginTop: 12 }} />
            ) : previousReports.length === 0 ? (
              <Text style={[styles.noMetrics, { color: palette.subtext }]}>No previous reports found.</Text>
            ) : (
              previousReports.map(r => (
                <Pressable
                  key={r.id ?? r.year}
                  style={styles.prevReportRow}
                  onPress={() => setReport(r)}
                >
                  <KISIcon name="document-text-outline" size={18} color={palette.primary} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.prevReportYear}>Report {r.year}</Text>
                    {r.generated_at ? (
                      <Text style={[styles.prevReportDate, { color: palette.subtext }]}>
                        {new Date(r.generated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </Text>
                    ) : null}
                  </View>
                  <KISIcon name="chevron-forward-outline" size={16} color={palette.subtext} />
                </Pressable>
              ))
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles(palette: any, layout: any) {
  const sp = layout.pageGutter;
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: palette.bg },
    navBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: sp,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: palette.divider,
    },
    backBtn: { width: 40, height: 44, justifyContent: 'center' },
    navTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: palette.text },
    scroll: { paddingBottom: 80 },
    section: {
      paddingHorizontal: sp,
      paddingTop: 20,
      paddingBottom: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: palette.divider,
    },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: palette.text, marginBottom: 12 },
    label: { fontSize: 14, fontWeight: '600', color: palette.text, marginBottom: 6 },
    input: {
      backgroundColor: palette.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.divider,
      padding: 12,
      fontSize: 15,
      color: palette.text,
      minHeight: 44,
    },
    selectorBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: palette.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.divider,
      paddingHorizontal: 12,
      height: 44,
    },
    selectorText: { fontSize: 15 },
    pickerDropdown: {
      backgroundColor: palette.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.divider,
      marginTop: 4,
      overflow: 'hidden',
      elevation: 3,
      shadowColor: palette.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
    },
    pickerItem: { paddingHorizontal: 16, paddingVertical: 12, minHeight: 44, justifyContent: 'center' },
    pickerItemText: { fontSize: 14, fontWeight: '500' },
    reportHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 14,
      padding: 16,
      marginBottom: 4,
    },
    reportTitle: { fontSize: 16, fontWeight: '700' },
    reportDate: { fontSize: 13, opacity: 0.85, marginTop: 2 },
    metricCard: {
      flex: 1,
      backgroundColor: palette.card,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.divider,
      padding: 14,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
    },
    metricIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    metricLabel: { fontSize: 12, color: palette.subtext, marginBottom: 2 },
    metricValue: { fontSize: 16, fontWeight: '800', color: palette.text },
    noMetrics: { fontSize: 14, marginTop: 8 },
    prevReportRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: palette.divider,
      minHeight: 44,
    },
    prevReportYear: { fontSize: 15, fontWeight: '600', color: palette.text },
    prevReportDate: { fontSize: 13, marginTop: 1 },
  });
}
