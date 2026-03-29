import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import BibleSectionCard from './BibleSectionCard';
import KISButton from '@/constants/KISButton';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import type { MeditationEntry } from '@/screens/tabs/bible/useBibleData';

const scheduleSuggestions = [
  { label: 'Morning devotion', cadence: 'daily', time_of_day: '07:00' },
  { label: 'Evening reflection', cadence: 'daily', time_of_day: '20:30' },
  { label: 'Weekly fasting focus', cadence: 'weekly', time_of_day: '12:00' },
];

type Props = {
  meditations: MeditationEntry[];
};

export default function MeditationPanel({ meditations }: Props) {
  const { palette } = useKISTheme();
  const [topic, setTopic] = useState('Faith');
  const [schedules, setSchedules] = useState<any[]>([]);

  const loadSchedules = async () => {
    const res = await getRequest(ROUTES.bible.schedules, {
      errorMessage: 'Unable to load schedules.',
    });
    const payload = res?.data?.results ?? res?.data ?? [];
    setSchedules(Array.isArray(payload) ? payload : []);
  };

  useEffect(() => {
    loadSchedules();
  }, []);

  const createSchedule = async (label: string, cadence: string, time: string) => {
    const res = await postRequest(
      ROUTES.bible.schedules,
      { topic_label: topic, cadence, time_of_day: time },
      { errorMessage: 'Unable to save schedule.' },
    );
    if (res?.success) {
      loadSchedules();
    }
  };

  return (
    <BibleSectionCard>
      <Text style={[styles.title, { color: palette.text }]}>Meditations & schedules</Text>
      <Text style={{ color: palette.subtext }}>
        Choose a topic and manage your daily devotion rhythm.
      </Text>

      <TextInput
        value={topic}
        onChangeText={setTopic}
        placeholder="Topic (e.g., Hope, Courage)"
        placeholderTextColor={palette.subtext}
        style={[styles.input, { borderColor: palette.divider, color: palette.text }]}
      />

      <View style={styles.sectionRow}>
        {scheduleSuggestions.map((schedule) => (
          <View key={schedule.label} style={[styles.scheduleCard, { borderColor: palette.divider }]}>
            <Text style={{ color: palette.text, fontWeight: '600' }}>{schedule.label}</Text>
            <Text style={{ color: palette.subtext }}>{schedule.cadence} · {schedule.time_of_day}</Text>
            <KISButton
              title="Add"
              size="sm"
              variant="outline"
              onPress={() => createSchedule(schedule.label, schedule.cadence, schedule.time_of_day)}
            />
          </View>
        ))}
      </View>

      {schedules.length > 0 ? (
        <View style={{ marginTop: 8, gap: 8 }}>
          <Text style={{ color: palette.text, fontWeight: '700' }}>Your schedules</Text>
          {schedules.slice(0, 4).map((schedule) => (
            <View key={schedule.id} style={[styles.meditationCard, { borderColor: palette.divider }]}>
              <Text style={{ color: palette.text, fontWeight: '600' }}>
                {schedule.topic_label || schedule.topic_detail?.name}
              </Text>
              <Text style={{ color: palette.subtext, marginTop: 4 }}>
                {schedule.cadence} · {schedule.time_of_day} · {schedule.timezone || 'UTC'}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={{ gap: 10 }}>
        {meditations.slice(0, 3).map((entry) => (
          <View key={entry.id} style={[styles.meditationCard, { borderColor: palette.divider }]}>
            <Text style={{ color: palette.primaryStrong, fontWeight: '700' }}>{entry.title}</Text>
            <Text style={{ color: palette.subtext, marginTop: 4 }}>{entry.date}</Text>
            <Text style={{ color: palette.text, marginTop: 8 }}>{entry.content}</Text>
          </View>
        ))}
      </View>
    </BibleSectionCard>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '800' },
  input: {
    borderWidth: 2,
    borderRadius: 10,
    padding: 10,
  },
  sectionRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  scheduleCard: { borderWidth: 2, borderRadius: 12, padding: 10, width: 160, gap: 6 },
  meditationCard: { borderWidth: 2, borderRadius: 12, padding: 12 },
});
