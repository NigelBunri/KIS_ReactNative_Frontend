import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import styles from '@/components/partners/partnersStyles';

type Props = {
  palette: any;
  schedules: Array<{
    id: string | number;
    kind: string;
    export_format: string;
    frequency: string;
    next_run_at?: string | null;
  }>;
  scheduleKind: string;
  scheduleFormat: string;
  scheduleFrequency: string;
  onChangeKind: (value: string) => void;
  onChangeFormat: (value: string) => void;
  onChangeFrequency: (value: string) => void;
  onCreateSchedule: () => void;
  onRunSchedule: (scheduleId: string | number) => void;
};

export default function PartnerExportSchedulesSection({
  palette,
  schedules,
  scheduleKind,
  scheduleFormat,
  scheduleFrequency,
  onChangeKind,
  onChangeFormat,
  onChangeFrequency,
  onCreateSchedule,
  onRunSchedule,
}: Props) {
  return (
    <>
      <Text style={[styles.settingsSectionTitle, { color: palette.text, marginTop: 12 }]}>
        Export schedules
      </Text>
      <View
        style={[
          styles.settingsFeatureRow,
          { borderColor: palette.borderMuted, backgroundColor: palette.surface },
        ]}
      >
        <Text style={[styles.settingsFeatureTitle, { color: palette.text }]}>
          Schedule export
        </Text>
        <TextInput
          value={scheduleKind}
          onChangeText={onChangeKind}
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
          value={scheduleFormat}
          onChangeText={onChangeFormat}
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
        <TextInput
          value={scheduleFrequency}
          onChangeText={onChangeFrequency}
          placeholder="daily, weekly, monthly"
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
          onPress={onCreateSchedule}
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
            CREATE SCHEDULE
          </Text>
        </Pressable>
      </View>

      {schedules.map((schedule) => (
        <View
          key={String(schedule.id)}
          style={[
            styles.settingsFeatureRow,
            { borderColor: palette.borderMuted, backgroundColor: palette.surface },
          ]}
        >
          <Text style={[styles.settingsFeatureTitle, { color: palette.text }]}>
            {schedule.kind} ({schedule.export_format})
          </Text>
          <Text style={[styles.settingsFeatureDescription, { color: palette.subtext }]}>
            Frequency: {schedule.frequency}
          </Text>
          <Text style={[styles.settingsFeatureMeta, { color: palette.subtext }]}>
            Next run: {schedule.next_run_at ?? 'not scheduled'}
          </Text>
          <Pressable
            onPress={() => onRunSchedule(schedule.id)}
            style={({ pressed }) => [
              {
                marginTop: 8,
                paddingVertical: 6,
                paddingHorizontal: 12,
                borderRadius: 8,
                borderWidth: 2,
                borderColor: palette.borderMuted,
                opacity: pressed ? 0.8 : 1,
                alignSelf: 'flex-start',
              },
            ]}
          >
            <Text style={{ color: palette.text, fontWeight: '700' }}>RUN NOW</Text>
          </Pressable>
        </View>
      ))}
    </>
  );
}
