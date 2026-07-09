// src/screens/calls/ScheduleCallSheet.tsx
// Bottom sheet for creating a standalone call (with optional scheduling and invite link).

import React, { useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KISIcon } from '@/constants/kisIcons';
import { useKISTheme } from '@/theme/useTheme';
import type { CallType } from '@/services/calls/callTypes';
import { useSafeTopInset } from '@/hooks/useSafeTopInset';

export type StandaloneCallResult = {
  callId: string;
  conversationId: string;
  inviteToken: string;
  callType: CallType;
  title: string;
  scheduledFor?: string | null;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onStart: (result: StandaloneCallResult) => void;
  onCreate: (params: {
    callId: string;
    callType: CallType;
    title: string;
    scheduledFor?: Date | null;
  }) => Promise<StandaloneCallResult>;
};

type CallTypeOption = {
  type: CallType;
  icon: string;
  label: string;
  desc: string;
};

const CALL_TYPE_OPTIONS: CallTypeOption[] = [
  { type: 'voice', icon: 'phone', label: 'Voice', desc: 'Audio only' },
  { type: 'video', icon: 'video', label: 'Video', desc: '1-on-1 with video' },
  { type: 'video-group', icon: 'people', label: 'Group video', desc: 'Up to 32 people' },
  { type: 'broadcast', icon: 'radio', label: 'Broadcast', desc: 'Live to many viewers' },
];

function makeTempCallId() {
  return `call_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function formatScheduled(d: Date): string {
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffMin = Math.round(diffMs / 60_000);
  if (diffMin < 60) return `in ${diffMin} min`;
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  return `in ${h}h${m > 0 ? ` ${m}m` : ''}`;
}

export default function ScheduleCallSheet({ visible, onClose, onStart, onCreate }: Props) {
  const { palette } = useKISTheme();
  const insets = useSafeAreaInsets();
  const topInset = useSafeTopInset();

  const [title, setTitle] = useState('');
  const [selectedType, setSelectedType] = useState<CallType>('voice');
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledFor, setScheduledFor] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const SCHEDULE_PRESETS = [15, 30, 60, 120].map(m => ({
    label: m < 60 ? `${m} min` : `${m / 60}h`,
    date: addMinutes(new Date(), m),
  }));

  const handleCreate = useCallback(async (startNow: boolean) => {
    setError(null);
    const callTitle = title.trim() || 'My call';
    const callId = makeTempCallId();
    const when = startNow ? null : (scheduledFor ?? addMinutes(new Date(), 30));

    setLoading(true);
    try {
      const result = await onCreate({
        callId,
        callType: selectedType,
        title: callTitle,
        scheduledFor: when,
      });

      if (startNow) {
        onStart(result);
      } else {
        // Scheduled — show the invite link + confirm
        onStart(result);
      }
      // Reset
      setTitle('');
      setSelectedType('voice');
      setIsScheduled(false);
      setScheduledFor(null);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to create call');
    } finally {
      setLoading(false);
    }
  }, [title, selectedType, scheduledFor, onCreate, onStart]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: palette.card, paddingBottom: insets.bottom + 16 }]}>

        {/* Handle */}
        <View style={[styles.handle, { backgroundColor: palette.inputBorder }]} />

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 20, paddingTop: 8 }}>

          {/* Header */}
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, { color: palette.text }]}>New call</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <KISIcon name="close" size={20} color={palette.subtext} />
            </Pressable>
          </View>

          {/* Title input */}
          <View style={{ gap: 6 }}>
            <Text style={[styles.label, { color: palette.subtext }]}>Call title (optional)</Text>
            <TextInput
              style={[styles.titleInput, { backgroundColor: palette.surface, borderColor: palette.inputBorder, color: palette.text }]}
              placeholder="My call"
              placeholderTextColor={palette.subtext}
              value={title}
              onChangeText={setTitle}
              maxLength={80}
              returnKeyType="done"
            />
          </View>

          {/* Call type selector */}
          <View style={{ gap: 8 }}>
            <Text style={[styles.label, { color: palette.subtext }]}>Call type</Text>
            <View style={styles.typeGrid}>
              {CALL_TYPE_OPTIONS.map(opt => {
                const selected = selectedType === opt.type;
                return (
                  <Pressable
                    key={opt.type}
                    onPress={() => setSelectedType(opt.type)}
                    style={[
                      styles.typeCard,
                      {
                        borderColor: selected ? palette.gold : palette.inputBorder,
                        backgroundColor: selected ? `${palette.gold}1A` : palette.surface,
                      },
                    ]}
                  >
                    <KISIcon name={opt.icon} size={22} color={selected ? palette.gold : palette.subtext} />
                    <Text style={[styles.typeLabel, { color: selected ? palette.gold : palette.text }]}>
                      {opt.label}
                    </Text>
                    <Text style={[styles.typeDesc, { color: palette.subtext }]}>{opt.desc}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Schedule toggle */}
          <View style={{ gap: 10 }}>
            <Pressable
              onPress={() => setIsScheduled(v => !v)}
              style={[styles.scheduleToggle, { borderColor: palette.inputBorder, backgroundColor: palette.surface }]}
            >
              <KISIcon name="calendar" size={18} color={isScheduled ? palette.gold : palette.subtext} />
              <Text style={[styles.scheduleToggleText, { color: isScheduled ? palette.gold : palette.text }]}>
                {isScheduled ? 'Scheduled call' : 'Schedule for later'}
              </Text>
              <KISIcon name={isScheduled ? 'chevron-up' : 'chevron-down'} size={16} color={palette.subtext} />
            </Pressable>

            {isScheduled && (
              <View style={{ gap: 8 }}>
                <Text style={[styles.label, { color: palette.subtext }]}>Start in</Text>
                <View style={styles.presetRow}>
                  {SCHEDULE_PRESETS.map(preset => {
                    const selected = scheduledFor?.getTime() === preset.date.getTime();
                    return (
                      <Pressable
                        key={preset.label}
                        onPress={() => setScheduledFor(preset.date)}
                        style={[
                          styles.presetBtn,
                          {
                            borderColor: selected ? palette.gold : palette.inputBorder,
                            backgroundColor: selected ? `${palette.gold}1A` : palette.surface,
                          },
                        ]}
                      >
                        <Text style={[styles.presetText, { color: selected ? palette.gold : palette.text }]}>
                          {preset.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                {scheduledFor && (
                  <Text style={[styles.scheduleConfirm, { color: palette.subtext }]}>
                    Starts {formatScheduled(scheduledFor)}
                  </Text>
                )}
              </View>
            )}
          </View>

          {/* Error */}
          {error && (
            <Text style={[styles.error, { color: palette.danger }]}>{error}</Text>
          )}

        </ScrollView>

        {/* Action buttons */}
        <View style={[styles.actions, { borderTopColor: palette.inputBorder }]}>
          {isScheduled ? (
            <Pressable
              onPress={() => handleCreate(false)}
              disabled={loading}
              style={[styles.primaryBtn, { backgroundColor: palette.gold }, loading && styles.btnDisabled]}
            >
              {loading ? (
                <ActivityIndicator color={palette.royalInk} />
              ) : (
                <>
                  <KISIcon name="calendar" size={18} color={palette.royalInk} />
                  <Text style={[styles.primaryBtnText, { color: palette.royalInk }]}>Schedule & get link</Text>
                </>
              )}
            </Pressable>
          ) : (
            <Pressable
              onPress={() => handleCreate(true)}
              disabled={loading}
              style={[styles.primaryBtn, { backgroundColor: palette.gold }, loading && styles.btnDisabled]}
            >
              {loading ? (
                <ActivityIndicator color={palette.royalInk} />
              ) : (
                <>
                  <KISIcon name="phone" size={18} color={palette.royalInk} />
                  <Text style={[styles.primaryBtnText, { color: palette.royalInk }]}>Start call now</Text>
                </>
              )}
            </Pressable>
          )}
        </View>

      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1 },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: '88%',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 20,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sheetTitle: { fontSize: 20, fontWeight: '900' },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  titleInput: {
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
    fontWeight: '600',
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  typeCard: {
    flex: 1,
    minWidth: '44%',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1.5,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 10,
  },
  typeLabel: { fontSize: 13, fontWeight: '800' },
  typeDesc: { fontSize: 10, fontWeight: '500', textAlign: 'center' },
  scheduleToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 14,
  },
  scheduleToggleText: { flex: 1, fontSize: 15, fontWeight: '700' },
  presetRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  presetBtn: {
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  presetText: { fontSize: 13, fontWeight: '700' },
  scheduleConfirm: { fontSize: 12, textAlign: 'center' },
  error: { fontSize: 13, textAlign: 'center' },
  actions: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 14,
    marginTop: 8,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 32,
    paddingVertical: 16,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 10,
  },
  primaryBtnText: { fontSize: 16, fontWeight: '900' },
  btnDisabled: { opacity: 0.55 },
});
