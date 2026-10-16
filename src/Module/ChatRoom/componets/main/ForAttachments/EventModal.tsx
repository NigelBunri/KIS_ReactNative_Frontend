// src/screens/chat/components/EventModal.tsx

import React, { useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { KISPalette, KIS_TOKENS, kisRadius } from '@/theme/constants';
import usePullDownToClose from '@/hooks/usePullDownToClose';
import KISDateTimeInput from '@/constants/KISDateTimeInput';

const KIS_EVENT_REMINDERS_KEY = 'KIS_EVENT_REMINDERS';

export type EventDraft = {
  title: string;
  location: string;
  description: string;
  startsAt: string;
  endsAt: string;
  reminderMinutes?: number;
};

// Exported for regression testing only (see __tests__/EventModal.timeRange.test.ts) -
// mirrors assertValidEventPayload in the Nest messages.service.ts so the
// client-side gate matches the server's independent re-check. Multi-day
// events are deliberately allowed here - this only requires the end
// INSTANT to be after the start instant, never that both fall on the same
// calendar date.
export function isEventTimeRangeValid(startIso: string | null, endIso: string | null): boolean {
  if (!startIso || !endIso) return false;
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return false;
  return end > start;
}

type EventModalProps = {
  visible: boolean;
  palette: KISPalette;
  onClose: () => void;
  onCreateEvent?: (event: EventDraft) => void;
};

export const EventModal: React.FC<EventModalProps> = ({
  visible,
  palette,
  onClose,
  onCreateEvent,
}) => {
  const [title, setTitle] = useState('');
  const [startIsoDraft, setStartIsoDraft] = useState<string | null>(null);
  const [endIsoDraft, setEndIsoDraft] = useState<string | null>(null);
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [reminderMinutes, setReminderMinutes] = useState<number>(10);
  const [attempted, setAttempted] = useState(false);
  const { dragY, panHandlers } = usePullDownToClose({
    enabled: visible,
    onClose,
  });
  // AND-031: the Actions row (Cancel/Save) had no bottom safe-area padding
  // at all, so on any device with a gesture nav bar / home indicator this
  // bottom-pinned sheet's Save button rendered partly or fully underneath
  // it - unreachable even though canSave correctly gated it. Added to the
  // Actions row's own padding below rather than the sheet's outer padding,
  // so it only affects the bottom edge, not every side.
  const insets = useSafeAreaInsets();

  const reminderOptions = [
    { label: 'None', value: 0 },
    { label: '5 min before', value: 5 },
    { label: '10 min before', value: 10 },
    { label: '30 min before', value: 30 },
    { label: '1 hour before', value: 60 },
    { label: '1 day before', value: 1440 },
  ];

  const startValid = !!startIsoDraft && !Number.isNaN(new Date(startIsoDraft).getTime());
  const endValid = !!endIsoDraft && !Number.isNaN(new Date(endIsoDraft).getTime());
  const titleValid = !!title.trim();
  const locationValid = !!location.trim();
  const descriptionValid = !!description.trim();
  const startIso = startValid ? String(startIsoDraft) : '';
  const endIso = endValid ? String(endIsoDraft) : '';
  const endAfterStart = isEventTimeRangeValid(startIso, endIso);

  const canSave =
    titleValid &&
    locationValid &&
    descriptionValid &&
    startValid &&
    endValid &&
    endAfterStart;

  const handleCreate = () => {
    setAttempted(true);
    if (!canSave) return;

    const event: EventDraft = {
      title: title.trim(),
      location: location.trim(),
      description: description.trim(),
      startsAt: startIso,
      endsAt: endIso,
      reminderMinutes: reminderMinutes > 0 ? reminderMinutes : undefined,
    };

    if (onCreateEvent) {
      onCreateEvent(event);
    }

    // Schedule local reminder if requested
    if (reminderMinutes > 0 && startIso) {
      const reminderAt = new Date(startIso).getTime() - reminderMinutes * 60000;
      const reminder = { title: title.trim(), startsAt: startIso, reminderAt };
      AsyncStorage.getItem(KIS_EVENT_REMINDERS_KEY)
        .then(raw => {
          const queue: typeof reminder[] = raw ? JSON.parse(raw) : [];
          queue.push(reminder);
          return AsyncStorage.setItem(KIS_EVENT_REMINDERS_KEY, JSON.stringify(queue));
        })
        .catch(() => {});
      const delay = reminderAt - Date.now();
      if (delay > 0) {
        setTimeout(() => {
          import('react-native').then(({ Alert }) => {
            Alert.alert(
              '📅 Event reminder',
              `"${title.trim()}" starts in ${reminderMinutes < 60 ? `${reminderMinutes} min` : `${reminderMinutes / 60} hr`}.`,
            );
          });
        }, delay);
      }
    }

    onClose();

    setTitle('');
    setStartIsoDraft(null);
    setEndIsoDraft(null);
    setLocation('');
    setDescription('');
    setReminderMinutes(10);
    setAttempted(false);
  };

  const inputStyle = {
    borderRadius: kisRadius.lg,
    borderWidth: 2,
    borderColor: palette.inputBorder,
    backgroundColor: palette.inputBg,
    paddingHorizontal: KIS_TOKENS.spacing.md,
    paddingVertical: KIS_TOKENS.spacing.sm,
    color: palette.text,
    marginBottom: KIS_TOKENS.spacing.md,
  } as const;

  return (
    <Modal transparent visible={visible} animationType="slide">
      {/* AND-031: this bottom sheet had no keyboard handling at all (same
          gap as PollModal.tsx, fixed the same way) - focusing Title,
          Start/End date or time, Location, or Description just let the
          keyboard cover whichever field was lower in the ScrollView,
          including the Save button below it. */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      <View
        style={{
          flex: 1,
          backgroundColor: palette.backdrop,
          justifyContent: 'flex-end',
        }}
      >
        <Animated.View
          style={{
            backgroundColor: palette.surfaceElevated,
            borderTopLeftRadius: kisRadius.xl,
            borderTopRightRadius: kisRadius.xl,
            padding: KIS_TOKENS.spacing.lg,
            maxHeight: '80%',
            transform: [{ translateY: dragY }],
          }}
        >
          <View
            {...panHandlers}
            style={{
              alignItems: 'center',
              marginBottom: KIS_TOKENS.spacing.sm,
            }}
          >
            <View
              style={{
                width: 42,
                height: 4,
                borderRadius: 999,
                backgroundColor: palette.divider,
              }}
            />
          </View>
          <Text
            style={{
              fontSize: KIS_TOKENS.typography.title,
              fontWeight: KIS_TOKENS.typography.weight.bold,
              color: palette.text,
              marginBottom: KIS_TOKENS.spacing.md,
            }}
          >
            Create an event
          </Text>

          <ScrollView>
            <Text style={{ color: palette.subtext }}>Title</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Birthday, meetup..."
              placeholderTextColor={palette.subtext}
              style={inputStyle}
            />

            <KISDateTimeInput
              label="Starts"
              mode="datetime"
              value={startIsoDraft}
              onChange={setStartIsoDraft}
              errorText={attempted && !startValid ? 'Pick a start date and time.' : undefined}
              error={attempted && !startValid}
            />

            <KISDateTimeInput
              label="Ends"
              mode="datetime"
              value={endIsoDraft}
              onChange={setEndIsoDraft}
              minimumDate={startValid ? new Date(startIso) : undefined}
              errorText={attempted && !endValid ? 'Pick an end date and time.' : undefined}
              error={attempted && !endValid}
            />

            {attempted && !endAfterStart && startValid && endValid && (
              <Text
                style={{ color: palette.danger, marginBottom: 8 }}
              >
                End time must be after start time.
              </Text>
            )}

            <Text style={{ color: palette.subtext }}>Location</Text>
            <TextInput
              value={location}
              onChangeText={setLocation}
              placeholder="Online / physical address"
              placeholderTextColor={palette.subtext}
              style={inputStyle}
            />

            {attempted && !locationValid && (
              <Text
                style={{ color: palette.danger, marginBottom: 8 }}
              >
                Location is required.
              </Text>
            )}

            <Text style={{ color: palette.subtext }}>Description</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Details and agenda"
              placeholderTextColor={palette.subtext}
              multiline
              style={[
                inputStyle,
                { height: 80, textAlignVertical: 'top' as const },
              ]}
            />

            {attempted && !descriptionValid && (
              <Text
                style={{ color: palette.danger, marginBottom: 8 }}
              >
                Description is required.
              </Text>
            )}

            <Text style={{ color: palette.subtext, marginBottom: 6 }}>
              Reminder
            </Text>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: KIS_TOKENS.spacing.xs,
                marginBottom: KIS_TOKENS.spacing.md,
              }}
            >
              {reminderOptions.map(opt => {
                const active = reminderMinutes === opt.value;
                return (
                  <Pressable
                    key={opt.label}
                    onPress={() => setReminderMinutes(opt.value)}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 14,
                      backgroundColor: active
                        ? palette.primarySoft ?? palette.primary
                        : palette.card,
                      borderWidth: 2,
                      borderColor: active
                        ? palette.primary ?? palette.inputBorder
                        : palette.inputBorder,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        color: active ? palette.primary : palette.text,
                        fontWeight: active ? '700' : '500',
                      }}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          {/* Actions */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'flex-end',
              gap: KIS_TOKENS.spacing.sm,
              marginTop: KIS_TOKENS.spacing.sm,
              paddingBottom: insets.bottom,
            }}
          >
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              style={{ paddingHorizontal: 14, paddingVertical: 12, minHeight: 44, justifyContent: 'center' }}
            >
              <Text style={{ color: palette.subtext }}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleCreate}
              disabled={!canSave}
              accessibilityRole="button"
              accessibilityLabel="Save event"
              style={{ paddingHorizontal: 14, paddingVertical: 12, minHeight: 44, justifyContent: 'center' }}
            >
              <Text
                style={{
                  color: canSave ? palette.primary : palette.subtext,
                  fontWeight: '700',
                }}
              >
                Save
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
