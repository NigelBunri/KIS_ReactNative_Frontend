// src/screens/chat/components/EventModal.tsx

import React, { useState } from 'react';
import {
  Animated,
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
} from 'react-native';
import { KISPalette, KIS_TOKENS, kisRadius } from '@/theme/constants';
import usePullDownToClose from '@/hooks/usePullDownToClose';

export type EventDraft = {
  title: string;
  location: string;
  description: string;
  startsAt: string;
  endsAt: string;
  reminderMinutes?: number;
};

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
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [reminderMinutes, setReminderMinutes] = useState<number>(10);
  const [attempted, setAttempted] = useState(false);
  const { dragY, panHandlers } = usePullDownToClose({
    enabled: visible,
    onClose,
  });

  const reminderOptions = [
    { label: 'None', value: 0 },
    { label: '5 min before', value: 5 },
    { label: '10 min before', value: 10 },
    { label: '30 min before', value: 30 },
    { label: '1 hour before', value: 60 },
    { label: '1 day before', value: 1440 },
  ];

  const isValidDate = (value: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(new Date(`${value}T00:00:00`).getTime());

  const isValidTime = (value: string) => {
    if (!/^\d{2}:\d{2}$/.test(value)) return false;
    const [h, m] = value.split(':').map(v => Number(v));
    return h >= 0 && h < 24 && m >= 0 && m < 60;
  };

  const buildIso = (d: string, t: string) =>
    new Date(`${d}T${t}:00`).toISOString();

  const startValid = isValidDate(startDate) && isValidTime(startTime);
  const endValid = isValidDate(endDate) && isValidTime(endTime);
  const titleValid = !!title.trim();
  const locationValid = !!location.trim();
  const descriptionValid = !!description.trim();
  const startIso = startValid ? buildIso(startDate, startTime) : '';
  const endIso = endValid ? buildIso(endDate, endTime) : '';
  const endAfterStart =
    startValid &&
    endValid &&
    new Date(endIso).getTime() > new Date(startIso).getTime();

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

    onClose();

    setTitle('');
    setStartDate('');
    setStartTime('');
    setEndDate('');
    setEndTime('');
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

            <Text style={{ color: palette.subtext }}>Start date</Text>
            <TextInput
              value={startDate}
              onChangeText={setStartDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={palette.subtext}
              style={inputStyle}
            />

            {attempted && !isValidDate(startDate) && (
              <Text
                style={{ color: palette.error ?? '#ff6b6b', marginBottom: 8 }}
              >
                Enter a valid start date (YYYY-MM-DD).
              </Text>
            )}

            <Text style={{ color: palette.subtext }}>Start time</Text>
            <TextInput
              value={startTime}
              onChangeText={setStartTime}
              placeholder="HH:MM"
              placeholderTextColor={palette.subtext}
              style={inputStyle}
            />

            {attempted && !isValidTime(startTime) && (
              <Text
                style={{ color: palette.error ?? '#ff6b6b', marginBottom: 8 }}
              >
                Enter a valid start time (HH:MM).
              </Text>
            )}

            <Text style={{ color: palette.subtext }}>End date</Text>
            <TextInput
              value={endDate}
              onChangeText={setEndDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={palette.subtext}
              style={inputStyle}
            />

            {attempted && !isValidDate(endDate) && (
              <Text
                style={{ color: palette.error ?? '#ff6b6b', marginBottom: 8 }}
              >
                Enter a valid end date (YYYY-MM-DD).
              </Text>
            )}

            <Text style={{ color: palette.subtext }}>End time</Text>
            <TextInput
              value={endTime}
              onChangeText={setEndTime}
              placeholder="HH:MM"
              placeholderTextColor={palette.subtext}
              style={inputStyle}
            />

            {attempted && !isValidTime(endTime) && (
              <Text
                style={{ color: palette.error ?? '#ff6b6b', marginBottom: 8 }}
              >
                Enter a valid end time (HH:MM).
              </Text>
            )}

            {attempted && !endAfterStart && startValid && endValid && (
              <Text
                style={{ color: palette.error ?? '#ff6b6b', marginBottom: 8 }}
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
                style={{ color: palette.error ?? '#ff6b6b', marginBottom: 8 }}
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
                style={{ color: palette.error ?? '#ff6b6b', marginBottom: 8 }}
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
            }}
          >
            <Pressable onPress={onClose}>
              <Text style={{ color: palette.subtext }}>Cancel</Text>
            </Pressable>
            <Pressable onPress={handleCreate} disabled={!canSave}>
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
    </Modal>
  );
};
