import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import styles from '@/components/partners/partnersStyles';
import { useKISTheme } from '@/theme/useTheme';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import PartnerExportSchedulesSection from '@/components/partners/reports/PartnerExportSchedulesSection';
import PartnerAnalyticsCharts from '@/components/partners/reports/PartnerAnalyticsCharts';

type Props = {
  isOpen: boolean;
  panelWidth: number;
  panelTranslateX: Animated.Value;
  partnerId?: string | null;
  onClose: () => void;
};

type ExportJob = {
  id: string | number;
  kind: string;
  export_format: string;
  status: string;
  file_path?: string;
  file_url?: string;
  error_message?: string;
  created_at?: string;
};

type ExportSchedule = {
  id: string | number;
  kind: string;
  export_format: string;
  frequency: string;
  is_active: boolean;
  last_run_at?: string | null;
  next_run_at?: string | null;
};

export default function PartnerReportsPanel({
  isOpen,
  panelWidth,
  panelTranslateX,
  partnerId,
  onClose,
}: Props) {
  const { palette } = useKISTheme();
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<Record<string, any> | null>(null);
  const [exports, setExports] = useState<ExportJob[]>([]);
  const [schedules, setSchedules] = useState<ExportSchedule[]>([]);
  const [exportKind, setExportKind] = useState('summary');
  const [exportFormat, setExportFormat] = useState('csv');
  const [scheduleKind, setScheduleKind] = useState('summary');
  const [scheduleFormat, setScheduleFormat] = useState('csv');
  const [scheduleFrequency, setScheduleFrequency] = useState('weekly');

  const backdropOpacity = panelTranslateX.interpolate({
    inputRange: [0, panelWidth],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const loadSummary = useCallback(async () => {
    if (!partnerId) return;
    const res = await getRequest(ROUTES.partners.reportsSummary(partnerId), {
      errorMessage: 'Unable to load reports summary.',
    });
    setSummary(res?.data ?? res ?? null);
  }, [partnerId]);

  const loadExports = useCallback(async () => {
    if (!partnerId) return;
    const res = await getRequest(ROUTES.partners.exports(partnerId), {
      errorMessage: 'Unable to load exports.',
    });
    const list = (res?.data ?? res ?? []) as ExportJob[];
    setExports(Array.isArray(list) ? list : []);
  }, [partnerId]);

  const loadSchedules = useCallback(async () => {
    if (!partnerId) return;
    const res = await getRequest(ROUTES.partners.exportSchedules(partnerId), {
      errorMessage: 'Unable to load export schedules.',
    });
    const list = (res?.data ?? res ?? []) as ExportSchedule[];
    setSchedules(Array.isArray(list) ? list : []);
  }, [partnerId]);

  const reloadAll = useCallback(async () => {
    await Promise.all([loadSummary(), loadExports(), loadSchedules()]);
  }, [loadSummary, loadExports, loadSchedules]);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    reloadAll().finally(() => setLoading(false));
  }, [isOpen, reloadAll]);

  const onCreateExport = async () => {
    if (!partnerId) return;
    const res = await postRequest(ROUTES.partners.exports(partnerId), {
      kind: exportKind.trim(),
      export_format: exportFormat.trim(),
    });
    if (!res?.success) {
      Alert.alert('Export failed', res?.message ?? 'Unable to generate export.');
      return;
    }
    loadExports();
  };

  const onCreateSchedule = async () => {
    if (!partnerId) return;
    const res = await postRequest(ROUTES.partners.exportSchedules(partnerId), {
      kind: scheduleKind.trim(),
      export_format: scheduleFormat.trim(),
      frequency: scheduleFrequency.trim(),
      is_active: true,
    });
    if (!res?.success) {
      Alert.alert('Schedule failed', res?.message ?? 'Unable to create schedule.');
      return;
    }
    loadSchedules();
  };

  const runSchedule = async (scheduleId: string | number) => {
    if (!partnerId) return;
    const res = await postRequest(
      ROUTES.partners.exportScheduleRun(partnerId, String(scheduleId)),
      {},
      { errorMessage: 'Unable to run schedule.' },
    );
    if (!res?.success) {
      Alert.alert('Run failed', res?.message ?? 'Please try again.');
      return;
    }
    loadExports();
    loadSchedules();
  };

  const summaryRows = useMemo(() => {
    if (!summary) return [];
    const hidden = new Set([
      'activity_series',
      'engagement_rate',
      'engagement_summary',
      'activity_summary',
    ]);
    return Object.entries(summary)
      .filter(([key, value]) => {
        if (hidden.has(key)) return false;
        if (Array.isArray(value)) return false;
        if (value && typeof value === 'object') return false;
        return true;
      })
      .map(([key, value]) => ({
        key,
        value,
      }));
  }, [summary]);

  if (!isOpen) return null;

  return (
    <View style={styles.settingsPanelOverlay} pointerEvents="box-none">
      <Animated.View
        style={[
          styles.settingsPanelBackdrop,
          { backgroundColor: palette.backdrop, opacity: backdropOpacity },
        ]}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          styles.settingsPanelContainer,
          {
            width: panelWidth,
            backgroundColor: palette.surfaceElevated,
            borderLeftColor: palette.divider,
            transform: [{ translateX: panelTranslateX }],
          },
        ]}
      >
        <View
          style={[
            styles.settingsPanelHeader,
            { borderBottomColor: palette.divider },
          ]}
        >
          <Pressable onPress={onClose} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            <Text style={{ color: palette.text, fontSize: 18 }}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingsPanelTitle, { color: palette.text }]}>
              Reports & Exports
            </Text>
            <Text style={[styles.settingsPanelDescription, { color: palette.subtext }]}>
              Track company health and export data.
            </Text>
          </View>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.settingsPanelBody}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <ActivityIndicator size="small" color={palette.primary} />
          ) : (
            <>
              <Text style={[styles.settingsSectionTitle, { color: palette.text }]}>
                Summary
              </Text>
              {summaryRows.map((row) => (
                <View
                  key={row.key}
                  style={[
                    styles.settingsFeatureRow,
                    { borderColor: palette.borderMuted, backgroundColor: palette.surface },
                  ]}
                >
                  <Text style={[styles.settingsFeatureTitle, { color: palette.text }]}>
                    {row.key.replace(/_/g, ' ')}
                  </Text>
                  <Text style={[styles.settingsFeatureMeta, { color: palette.subtext }]}>
                    {String(row.value)}
                  </Text>
                </View>
              ))}
              <PartnerAnalyticsCharts summary={summary} />

              <Text style={[styles.settingsSectionTitle, { color: palette.text, marginTop: 12 }]}>
                Export data
              </Text>
              <View
                style={[
                  styles.settingsFeatureRow,
                  { borderColor: palette.borderMuted, backgroundColor: palette.surface },
                ]}
              >
                <Text style={[styles.settingsFeatureTitle, { color: palette.text }]}>
                  Create export
                </Text>
                <TextInput
                  value={exportKind}
                  onChangeText={setExportKind}
                  placeholder="summary, members, roles, posts, audit, applications"
                  placeholderTextColor={palette.subtext}
                  style={{
                    color: palette.text,
                    borderColor: palette.borderMuted,
                    borderWidth: 2,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 8,
                    marginTop: 8,
                  }}
                />
                <TextInput
                  value={exportFormat}
                  onChangeText={setExportFormat}
                  placeholder="csv or json"
                  placeholderTextColor={palette.subtext}
                  style={{
                    color: palette.text,
                    borderColor: palette.borderMuted,
                    borderWidth: 2,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 8,
                    marginTop: 8,
                  }}
                />
                <Pressable
                  onPress={onCreateExport}
                  style={({ pressed }) => [
                    {
                      marginTop: 10,
                      paddingVertical: 8,
                      borderRadius: 10,
                      borderWidth: 2,
                      borderColor: palette.borderMuted,
                      backgroundColor: palette.primarySoft ?? palette.surface,
                      opacity: pressed ? 0.8 : 1,
                      alignItems: 'center',
                    },
                  ]}
                >
                  <Text style={{ color: palette.primaryStrong ?? palette.text, fontWeight: '700' }}>
                    CREATE EXPORT
                  </Text>
                </Pressable>
              </View>

              {exports.map((job) => (
                <View
                  key={String(job.id)}
                  style={[
                    styles.settingsFeatureRow,
                    { borderColor: palette.borderMuted, backgroundColor: palette.surface },
                  ]}
                >
                  <Text style={[styles.settingsFeatureTitle, { color: palette.text }]}>
                    {job.kind} ({job.export_format})
                  </Text>
                  <Text style={[styles.settingsFeatureDescription, { color: palette.subtext }]}>
                    Status: {job.status}
                  </Text>
                  {job.file_path ? (
                    <Text style={[styles.settingsFeatureMeta, { color: palette.subtext }]}>
                      {job.file_path}
                    </Text>
                  ) : null}
                  {job.error_message ? (
                    <Text style={[styles.settingsFeatureMeta, { color: palette.danger }]}>
                      {job.error_message}
                    </Text>
                  ) : null}
                </View>
              ))}

              <PartnerExportSchedulesSection
                palette={palette}
                schedules={schedules}
                scheduleKind={scheduleKind}
                scheduleFormat={scheduleFormat}
                scheduleFrequency={scheduleFrequency}
                onChangeKind={setScheduleKind}
                onChangeFormat={setScheduleFormat}
                onChangeFrequency={setScheduleFrequency}
                onCreateSchedule={onCreateSchedule}
                onRunSchedule={runSchedule}
              />
            </>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}
