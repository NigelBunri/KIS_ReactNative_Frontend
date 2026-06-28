import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { getRequest } from '@/network/get';
import { patchRequest } from '@/network/patch';
import ROUTES from '@/network';
import { invalidateParentalControlsCache } from '@/hooks/useParentalControls';
import KISButton from '@/constants/KISButton';
import FamilySelect from './components/FamilySelect';

type Props = NativeStackScreenProps<RootStackParamList, 'ParentalControls'>;

type ContentFilter = 'child' | 'youth' | 'adult';

type RestrictedSections = {
  marketplace: boolean;
  calls: boolean;
  health: boolean;
  chat: boolean;
  media: boolean;
};

type ControlsState = {
  content_filter: ContentFilter;
  screen_time_minutes: number;
  restricted_sections: RestrictedSections;
  location_sharing: boolean;
  sos_enabled: boolean;
};

const SECTION_LABELS: (keyof RestrictedSections)[] = [
  'marketplace',
  'calls',
  'health',
  'chat',
  'media',
];

const FILTER_OPTIONS: { label: string; value: ContentFilter }[] = [
  { label: 'Child (Under 12)', value: 'child' },
  { label: 'Youth (12–17)', value: 'youth' },
  { label: 'Adult (18+)', value: 'adult' },
];

function formatScreenTime(mins: number): string {
  if (mins === 0) return 'No limit';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m} min/day`;
  if (m === 0) return `${h} hour${h > 1 ? 's' : ''}/day`;
  return `${h}h ${m}m/day`;
}

export default function ParentalControlsScreen({ route }: Props) {
  const { memberId } = route.params;
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [controls, setControls] = useState<ControlsState>({
    content_filter: 'youth',
    screen_time_minutes: 120,
    restricted_sections: {
      marketplace: false,
      calls: false,
      health: false,
      chat: false,
      media: false,
    },
    location_sharing: false,
    sos_enabled: true,
  });

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      getRequest(ROUTES.family.parentalControl(memberId))
        .then((res: any) => {
          if (!active) return;
          if (res) setControls(res);
        })
        .catch(() => {})
        .finally(() => { if (active) setLoading(false); });
      return () => { active = false; };
    }, [memberId]),
  );

  async function handleSave() {
    setSaving(true);
    try {
      await patchRequest(ROUTES.family.parentalControl(memberId), controls);
      invalidateParentalControlsCache(memberId);
      Alert.alert('Saved', 'Parental controls updated.');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  }

  function setSection(key: keyof RestrictedSections, value: boolean) {
    setControls((prev) => ({
      ...prev,
      restricted_sections: { ...prev.restricted_sections, [key]: value },
    }));
  }

  const gutter = layout.pageGutter;

  if (loading) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: palette.bg }]}>
        <ActivityIndicator style={styles.flex} color={palette.gold} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: palette.bg }]}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: gutter, paddingTop: 20, paddingBottom: 80 }}>
        <Text style={[styles.title, { color: palette.text }]}>Parental Controls</Text>

        {/* Content Filter */}
        <View style={[styles.section, { backgroundColor: palette.card, borderColor: palette.divider }]}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Content Filter</Text>
          <View style={[styles.pickerWrapper, { borderColor: palette.divider, backgroundColor: palette.surface }]}>
            <FamilySelect
              value={controls.content_filter}
              onChange={(value) =>
                setControls((prev) => ({ ...prev, content_filter: value as ContentFilter }))
              }
              placeholder="Content filter"
              options={FILTER_OPTIONS}
            />
          </View>
        </View>

        {/* Screen Time */}
        <View style={[styles.section, { backgroundColor: palette.card, borderColor: palette.divider }]}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Screen Time</Text>
          <Text style={[styles.screenTimeValue, { color: palette.gold }]}>
            {formatScreenTime(controls.screen_time_minutes)}
          </Text>
          {/* Simple +/- stepper since Slider may need native module */}
          <View style={styles.sliderRow}>
            <Text style={[styles.sliderLabel, { color: palette.subtext }]}>0 min</Text>
            <View style={styles.stepperControls}>
              <Text
                style={[styles.stepperBtn, { color: palette.primary, borderColor: palette.divider }]}
                onPress={() =>
                  setControls((prev) => ({
                    ...prev,
                    screen_time_minutes: Math.max(0, prev.screen_time_minutes - 30),
                  }))
                }
              >
                −30m
              </Text>
              <Text
                style={[styles.stepperBtn, { color: palette.primary, borderColor: palette.divider }]}
                onPress={() =>
                  setControls((prev) => ({
                    ...prev,
                    screen_time_minutes: Math.min(480, prev.screen_time_minutes + 30),
                  }))
                }
              >
                +30m
              </Text>
            </View>
            <Text style={[styles.sliderLabel, { color: palette.subtext }]}>8 hrs</Text>
          </View>
        </View>

        {/* Restricted Sections */}
        <View style={[styles.section, { backgroundColor: palette.card, borderColor: palette.divider }]}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Restricted Sections</Text>
          {SECTION_LABELS.map((key) => (
            <View key={key} style={styles.toggleRow}>
              <Text style={[styles.toggleLabel, { color: palette.text }]}>
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </Text>
              <Switch
                value={controls.restricted_sections[key]}
                onValueChange={(v) => setSection(key, v)}
                trackColor={{ false: palette.divider, true: palette.primaryStrong }}
                thumbColor={palette.ivory}
              />
            </View>
          ))}
        </View>

        {/* Location Sharing */}
        <View style={[styles.section, { backgroundColor: palette.card, borderColor: palette.divider }]}>
          <View style={styles.toggleRow}>
            <Text style={[styles.toggleLabel, { color: palette.text }]}>Location Sharing</Text>
            <Switch
              value={controls.location_sharing}
              onValueChange={(v) => setControls((prev) => ({ ...prev, location_sharing: v }))}
              trackColor={{ false: palette.divider, true: palette.primaryStrong }}
              thumbColor={palette.ivory}
            />
          </View>
          <View style={[styles.toggleRow, { marginTop: 12 }]}>
            <Text style={[styles.toggleLabel, { color: palette.text }]}>SOS Alert</Text>
            <Switch
              value={controls.sos_enabled}
              onValueChange={(v) => setControls((prev) => ({ ...prev, sos_enabled: v }))}
              trackColor={{ false: palette.divider, true: palette.primaryStrong }}
              thumbColor={palette.ivory}
            />
          </View>
        </View>

        <KISButton
          title={saving ? 'Saving…' : 'Save Changes'}
          onPress={handleSave}
          disabled={saving}
          loading={saving}
          style={{ marginTop: 8 }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 20 },
  section: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  pickerWrapper: {
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  screenTimeValue: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sliderLabel: { fontSize: 12 },
  stepperControls: { flexDirection: 'row', gap: 12 },
  stepperBtn: {
    fontSize: 14,
    fontWeight: '600',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 44,
    textAlignVertical: 'center',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  toggleLabel: { fontSize: 15 },
});
