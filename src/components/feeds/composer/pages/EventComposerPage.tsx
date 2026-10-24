// src/components/feeds/composer/pages/EventComposerPage.tsx
import React, { useCallback } from 'react';
import { Image, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import KISDateTimeInput from '@/constants/KISDateTimeInput';
import type { EventSettings } from '../types';

const REMINDER_OPTIONS: { value: EventSettings['reminder']; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: '15m', label: '15 min before' },
  { value: '1h', label: '1 hour before' },
  { value: '1d', label: '1 day before' },
];

const REPEATS_OPTIONS: { value: EventSettings['repeats']; label: string }[] = [
  { value: 'none', label: "Doesn't repeat" },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

const CATEGORY_PRESETS = ['Worship', 'Outreach', 'Youth', 'Bible study', 'Fellowship', 'Mission trip'];

export function EventComposerPage({
  eventTitle,
  setEventTitle,
  eventStartsAt,
  setEventStartsAt,
  eventLocation,
  setEventLocation,
  eventSettings,
  setEventSettings,
}: {
  eventTitle: string;
  setEventTitle: (v: string) => void;
  eventStartsAt: string;
  setEventStartsAt: (v: string) => void;
  eventLocation: string;
  setEventLocation: (v: string) => void;
  eventSettings: EventSettings;
  setEventSettings: React.Dispatch<React.SetStateAction<EventSettings>>;
}) {
  const { palette } = useKISTheme();
  const timezoneLabel = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const updateSetting = useCallback(
    <K extends keyof EventSettings>(key: K, value: EventSettings[K]) => {
      setEventSettings(prev => ({ ...prev, [key]: value }));
    },
    [setEventSettings],
  );

  const pickCoverImage = useCallback(async () => {
    const result = await launchImageLibrary({ mediaType: 'photo', selectionLimit: 1 });
    if (result.didCancel || !result.assets?.length) return;
    const uri = result.assets[0]?.uri;
    if (uri) updateSetting('coverImage', uri);
  }, [updateSetting]);

  return (
    <View style={{ gap: 12 }}>
      <TextInput
        placeholder="Event title"
        placeholderTextColor={palette.subtext}
        value={eventTitle}
        onChangeText={setEventTitle}
        style={[styles.input, { color: palette.text, borderColor: palette.divider }]}
      />

      <TextInput
        placeholder="Description (optional)"
        placeholderTextColor={palette.subtext}
        value={eventSettings.description}
        onChangeText={v => updateSetting('description', v)}
        multiline
        style={[styles.input, styles.textarea, { color: palette.text, borderColor: palette.divider }]}
      />

      <View style={styles.settingRow}>
        <Text style={[styles.settingLabel, { color: palette.text }]}>All-day event</Text>
        <Switch
          value={eventSettings.allDay}
          onValueChange={v => updateSetting('allDay', v)}
          trackColor={{ false: palette.divider, true: palette.primaryStrong }}
          thumbColor={palette.onPrimary}
        />
      </View>

      <KISDateTimeInput
        mode={eventSettings.allDay ? 'date' : 'datetime'}
        value={eventStartsAt || null}
        onChange={setEventStartsAt}
        placeholder="Select start date/time"
      />
      <KISDateTimeInput
        mode={eventSettings.allDay ? 'date' : 'datetime'}
        value={eventSettings.endsAt || null}
        onChange={v => updateSetting('endsAt', v)}
        placeholder="Select end date/time (optional)"
        minimumDate={eventStartsAt ? new Date(eventStartsAt) : undefined}
      />
      <Text style={[styles.helperText, { color: palette.subtext }]}>Times shown in {timezoneLabel}</Text>

      <View style={styles.settingRow}>
        <Text style={[styles.settingLabel, { color: palette.text }]}>Online event</Text>
        <Switch
          value={eventSettings.isOnline}
          onValueChange={v => updateSetting('isOnline', v)}
          trackColor={{ false: palette.divider, true: palette.primaryStrong }}
          thumbColor={palette.onPrimary}
        />
      </View>
      {eventSettings.isOnline ? (
        <TextInput
          placeholder="Meeting URL"
          placeholderTextColor={palette.subtext}
          value={eventSettings.onlineUrl}
          onChangeText={v => updateSetting('onlineUrl', v)}
          autoCapitalize="none"
          style={[styles.input, { color: palette.text, borderColor: palette.divider }]}
        />
      ) : (
        <TextInput
          placeholder="Location (optional)"
          placeholderTextColor={palette.subtext}
          value={eventLocation}
          onChangeText={setEventLocation}
          style={[styles.input, { color: palette.text, borderColor: palette.divider }]}
        />
      )}

      <TextInput
        placeholder="RSVP capacity (optional)"
        placeholderTextColor={palette.subtext}
        value={eventSettings.rsvpCapacity}
        onChangeText={v => updateSetting('rsvpCapacity', v.replace(/[^0-9]/g, ''))}
        keyboardType="number-pad"
        style={[styles.input, { color: palette.text, borderColor: palette.divider }]}
      />

      <View>
        <Text style={[styles.settingLabel, { color: palette.subtext }]}>Reminder</Text>
        <View style={styles.chipRow}>
          {REMINDER_OPTIONS.map(opt => {
            const active = eventSettings.reminder === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => updateSetting('reminder', opt.value)}
                style={[styles.chip, { borderColor: active ? palette.primary : palette.divider, backgroundColor: active ? palette.primarySoft : 'transparent' }]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={{ color: active ? palette.primaryStrong : palette.text, fontWeight: '800', fontSize: 11 }}>{opt.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View>
        <Text style={[styles.settingLabel, { color: palette.subtext }]}>Repeats</Text>
        <View style={styles.chipRow}>
          {REPEATS_OPTIONS.map(opt => {
            const active = eventSettings.repeats === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => updateSetting('repeats', opt.value)}
                style={[styles.chip, { borderColor: active ? palette.primary : palette.divider, backgroundColor: active ? palette.primarySoft : 'transparent' }]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={{ color: active ? palette.primaryStrong : palette.text, fontWeight: '800', fontSize: 11 }}>{opt.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View>
        <Text style={[styles.settingLabel, { color: palette.subtext }]}>Category (optional)</Text>
        <View style={styles.chipRow}>
          {CATEGORY_PRESETS.map(cat => {
            const active = eventSettings.category === cat;
            return (
              <Pressable
                key={cat}
                onPress={() => updateSetting('category', active ? '' : cat)}
                style={[styles.chip, { borderColor: active ? palette.primary : palette.divider, backgroundColor: active ? palette.primarySoft : 'transparent' }]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={{ color: active ? palette.primaryStrong : palette.text, fontWeight: '800', fontSize: 11 }}>{cat}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.settingRow}>
        <Text style={[styles.settingLabel, { color: palette.text }]}>Add to calendar</Text>
        <Switch
          value={eventSettings.addToCalendar}
          onValueChange={v => updateSetting('addToCalendar', v)}
          trackColor={{ false: palette.divider, true: palette.primaryStrong }}
          thumbColor={palette.onPrimary}
        />
      </View>

      <View style={styles.settingRow}>
        <Text style={[styles.settingLabel, { color: palette.text }]}>Cover image</Text>
        <Pressable onPress={pickCoverImage} accessibilityRole="button" accessibilityLabel={eventSettings.coverImage ? 'Change cover image' : 'Add cover image'}>
          <Text style={{ color: palette.primaryStrong, fontWeight: '800', fontSize: 12 }}>
            {eventSettings.coverImage ? 'Change' : 'Add'}
          </Text>
        </Pressable>
      </View>
      {eventSettings.coverImage ? (
        <View style={styles.coverRow}>
          <Image source={{ uri: eventSettings.coverImage }} style={styles.coverImage} />
          <Pressable onPress={() => updateSetting('coverImage', null)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Remove cover image">
            <KISIcon name="close" size={16} color={palette.subtext} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 2,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 48,
  },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  helperText: { fontSize: 11, fontWeight: '700' },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingLabel: { fontSize: 12, fontWeight: '800', marginBottom: 6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 2,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  coverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  coverImage: { width: 72, height: 72, borderRadius: 12 },
});
