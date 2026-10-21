// src/screens/tabs/profile-screen/WorkPreferencesSheet.tsx
//
// Section A of the "Open to Work" spec: job titles/roles sought, employment
// type, workplace arrangement, preferred location, availability/start date.
// Shown as a secondary step right after picking "Open for work" in
// ProfileScreen's avatar-status picker - and re-openable any time after
// (not just on first activation) via the same picker's "Edit" affordance.
//
// Persists through the exact same PATCH ROUTES.profiles.update endpoint the
// tri-state work_status picker already uses (Profile.work_preferences, a
// JSON blob backend-gated to only ever persist while work_status is
// 'open_for_work' - see apps.accounts.serializers.ProfileSerializer.validate).
import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import KISButton from '@/constants/KISButton';
import KISTextInput from '@/constants/KISTextInput';
import type { KISPalette } from '@/theme/constants';
import { useSafeTopInset } from '@/hooks/useSafeTopInset';

export type WorkPreferences = {
  roles?: string[];
  employment_types?: string[];
  workplace?: 'on_site' | 'hybrid' | 'remote' | '';
  location?: string;
  availability?: string;
};

const EMPLOYMENT_TYPES: { value: string; label: string }[] = [
  { value: 'full_time', label: 'Full-time' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'contract', label: 'Contract' },
  { value: 'internship', label: 'Internship' },
];

const WORKPLACE_OPTIONS: { value: 'on_site' | 'hybrid' | 'remote'; label: string }[] = [
  { value: 'on_site', label: 'On-site' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'remote', label: 'Remote' },
];

type Props = {
  visible: boolean;
  palette: KISPalette;
  initial?: WorkPreferences | null;
  saving?: boolean;
  onSkip: () => void;
  onSave: (prefs: WorkPreferences) => void;
  onClose: () => void;
};

function Chip({
  label,
  selected,
  color,
  onPress,
}: {
  label: string;
  selected: boolean;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[
        styles.chip,
        { borderColor: selected ? color : 'rgba(128,128,128,0.35)', backgroundColor: selected ? `${color}1F` : 'transparent' },
      ]}
    >
      <Text style={{ color: selected ? color : undefined, fontWeight: '700', fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

export default function WorkPreferencesSheet({
  visible,
  palette,
  initial,
  saving = false,
  onSkip,
  onSave,
  onClose,
}: Props) {
  const topInset = useSafeTopInset();
  const [rolesText, setRolesText] = useState('');
  const [employmentTypes, setEmploymentTypes] = useState<string[]>([]);
  const [workplace, setWorkplace] = useState<'on_site' | 'hybrid' | 'remote' | ''>('');
  const [location, setLocation] = useState('');
  const [availability, setAvailability] = useState('');

  useEffect(() => {
    if (!visible) return;
    setRolesText((initial?.roles ?? []).join(', '));
    setEmploymentTypes(Array.isArray(initial?.employment_types) ? initial!.employment_types! : []);
    setWorkplace((initial?.workplace as any) ?? '');
    setLocation(initial?.location ?? '');
    setAvailability(initial?.availability ?? '');
  }, [visible, initial]);

  const toggleEmploymentType = (value: string) => {
    setEmploymentTypes((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  };

  const handleSave = () => {
    const roles = rolesText
      .split(',')
      .map((r) => r.trim())
      .filter(Boolean);
    onSave({
      roles,
      employment_types: employmentTypes,
      workplace,
      location: location.trim(),
      availability: availability.trim(),
    });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: palette.surface, paddingTop: Math.max(12, topInset * 0.2) }]}>
          <View style={styles.handle} />
          <Text style={[styles.title, { color: palette.text }]}>Open to work preferences</Text>
          <Text style={[styles.subtitle, { color: palette.subtext }]}>
            Tell us what you're looking for - you can edit this any time.
          </Text>
          <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
            <KISTextInput
              label="Roles / job titles"
              placeholder="e.g. Backend Engineer, Product Manager"
              value={rolesText}
              onChangeText={setRolesText}
            />
            <Text style={[styles.sectionLabel, { color: palette.subtext }]}>Employment type</Text>
            <View style={styles.chipsRow}>
              {EMPLOYMENT_TYPES.map((opt) => (
                <Chip
                  key={opt.value}
                  label={opt.label}
                  selected={employmentTypes.includes(opt.value)}
                  color={palette.success}
                  onPress={() => toggleEmploymentType(opt.value)}
                />
              ))}
            </View>
            <Text style={[styles.sectionLabel, { color: palette.subtext }]}>Workplace</Text>
            <View style={styles.chipsRow}>
              {WORKPLACE_OPTIONS.map((opt) => (
                <Chip
                  key={opt.value}
                  label={opt.label}
                  selected={workplace === opt.value}
                  color={palette.success}
                  onPress={() => setWorkplace((prev) => (prev === opt.value ? '' : opt.value))}
                />
              ))}
            </View>
            <KISTextInput
              label="Preferred location"
              placeholder="e.g. Douala, Cameroon"
              value={location}
              onChangeText={setLocation}
            />
            <KISTextInput
              label="Availability / start date"
              placeholder="e.g. Immediately, or a date"
              value={availability}
              onChangeText={setAvailability}
            />
          </ScrollView>
          <View style={styles.actionsRow}>
            <KISButton title="Skip for now" variant="ghost" onPress={onSkip} disabled={saving} style={{ flex: 1 }} />
            <KISButton title="Save" variant="primary" onPress={handleSave} loading={saving} style={{ flex: 1 }} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16, maxHeight: '85%' },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(128,128,128,0.4)', marginBottom: 10 },
  title: { fontSize: 17, fontWeight: '800' },
  subtitle: { fontSize: 13, marginTop: 4, marginBottom: 12 },
  sectionLabel: { fontSize: 12, fontWeight: '700', marginTop: 10, marginBottom: 6 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1.5 },
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
});
