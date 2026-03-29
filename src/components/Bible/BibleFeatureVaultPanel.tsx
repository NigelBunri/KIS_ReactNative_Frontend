import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import BibleSectionCard from './BibleSectionCard';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { patchRequest } from '@/network/patch';
import ROUTES from '@/network';

const FEATURE_TOGGLES = [
  { key: 'enable_audio_sync', label: 'Verse-by-verse audio sync' },
  { key: 'enable_parallel_view', label: 'Parallel translations view' },
  { key: 'enable_daily_reminders', label: 'Daily reminders' },
  { key: 'enable_offline_cache', label: 'Offline chapter cache' },
];

export default function BibleFeatureVaultPanel() {
  const { palette } = useKISTheme();
  const [preferences, setPreferences] = useState<any | null>(null);

  const loadPreferences = async () => {
    const res = await getRequest(ROUTES.bible.preferences, { errorMessage: 'Unable to load preferences.' });
    const payload = res?.data?.results ?? res?.data ?? [];
    const prefs = Array.isArray(payload) ? payload[0] : payload;
    if (prefs) {
      setPreferences(prefs);
      return;
    }
    const created = await postRequest(
      ROUTES.bible.preferences,
      {},
      { errorMessage: 'Unable to create preferences.' },
    );
    if (created?.success) {
      setPreferences(created.data);
    }
  };

  useEffect(() => {
    loadPreferences();
  }, []);

  const togglePreference = async (key: string) => {
    if (!preferences?.id) return;
    const nextValue = !preferences[key];
    const res = await patchRequest(
      `${ROUTES.bible.preferences}${preferences.id}/`,
      { [key]: nextValue },
      { errorMessage: 'Unable to update preference.' },
    );
    if (res?.success) {
      setPreferences((prev: any) => ({ ...prev, [key]: nextValue }));
    }
  };

  return (
    <BibleSectionCard>
      <Text style={[styles.title, { color: palette.text }]}>Feature vault</Text>
      <Text style={{ color: palette.subtext }}>
        A complete set of tools for global Christian discipleship.
      </Text>
      <View style={styles.grid}>
        {FEATURE_TOGGLES.map((feature) => {
          const isEnabled = Boolean(preferences?.[feature.key]);
          return (
            <Pressable
              key={feature.key}
              onPress={() => togglePreference(feature.key)}
              style={[
                styles.item,
                {
                  borderColor: palette.divider,
                  backgroundColor: isEnabled ? palette.primarySoft : 'transparent',
                },
              ]}
            >
              <Text style={{ color: palette.text, fontWeight: '600' }}>{feature.label}</Text>
              <Text style={{ color: palette.subtext, marginTop: 6 }}>
                {isEnabled ? 'Enabled' : 'Disabled'}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </BibleSectionCard>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '800' },
  grid: { gap: 10, marginTop: 12 },
  item: { borderWidth: 2, borderRadius: 10, padding: 10 },
});
