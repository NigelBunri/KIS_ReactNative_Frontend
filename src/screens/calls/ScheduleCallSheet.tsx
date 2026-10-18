// src/screens/calls/ScheduleCallSheet.tsx
// Bottom sheet for creating a standalone call (with optional scheduling,
// panelist selection for broadcasts, and invite link).

import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import KISButton from '@/constants/KISButton';
import KISDateTimeInput from '@/constants/KISDateTimeInput';
import { useKISTheme } from '@/theme/useTheme';
import type { CallType } from '@/services/calls/callTypes';
import { useSafeTopInset } from '@/hooks/useSafeTopInset';
import { fetchConversationsForCurrentUser } from '@/Module/ChatRoom/normalizeConversation';
import { otherDirectParticipantUserId, type Chat } from '@/Module/ChatRoom/messagesUtils';
import { getCurrentAuthUserId } from '@/storage/userScopedProfileCache';
import PanelistPickerSheet, {
  MAX_BROADCAST_PANELISTS,
  MIN_BROADCAST_PANELISTS,
} from './components/PanelistPickerSheet';
import {
  DEFAULT_DURATION_MINUTES,
  MAX_DURATION_MINUTES,
  MIN_DURATION_MINUTES,
  evaluateNewCallSubmit,
  formatDuration,
  mergeDateAndTime,
} from './scheduleCallSheetHelpers';

export type StandaloneCallResult = {
  callId: string;
  conversationId: string;
  inviteToken: string;
  callType: CallType;
  title: string;
  scheduledFor?: string | null;
  scheduledDurationMinutes?: number | null;
  /** Echoed back from the create params so the caller (CallsTab) knows
   * who to actually ring without re-deriving the list. */
  inviteeUserIds?: string[];
  /** Echoed back so the caller knows whether to show the host as a panelist on start. */
  hostIsPanelist?: boolean;
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
    durationMinutes?: number | null;
    inviteeUserIds?: string[];
    hostIsPanelist?: boolean;
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

const DURATION_STEP = 5;
const DURATION_PRESETS = [5, 15, 30, 60, 120, 240, 480, 720, 1440];

function makeTempCallId() {
  return `call_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function formatScheduled(d: Date): string {
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function ScheduleCallSheet({ visible, onClose, onStart, onCreate }: Props) {
  const { palette } = useKISTheme();
  const insets = useSafeAreaInsets();
  const topInset = useSafeTopInset();

  const [title, setTitle] = useState('');
  const [selectedType, setSelectedType] = useState<CallType>('voice');
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState<Date>(() => new Date());
  const [scheduledTime, setScheduledTime] = useState<Date>(() => addMinutes(new Date(), 30));
  const [durationMinutes, setDurationMinutes] = useState(DEFAULT_DURATION_MINUTES);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Panelists (broadcast only)
  const [panelistIds, setPanelistIds] = useState<string[]>([]);
  // "the creator should be included as one of the options to be a
  // panelist. one can create the call but is not a panelist" — default
  // true (host appears on their own panel, matching every other call
  // type's existing behavior), explicit opt-out via this toggle.
  const [hostIsPanelist, setHostIsPanelist] = useState(true);
  const [showPanelistPicker, setShowPanelistPicker] = useState(false);
  const [panelistChats, setPanelistChats] = useState<Chat[]>([]);
  const [panelistChatsLoading, setPanelistChatsLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const isBroadcast = selectedType === 'broadcast';

  useEffect(() => {
    if (!visible) return;
    setPanelistChatsLoading(true);
    Promise.all([fetchConversationsForCurrentUser(), getCurrentAuthUserId()])
      .then(([chats, uid]) => {
        setPanelistChats(chats);
        setCurrentUserId(uid);
      })
      .catch(() => setPanelistChats([]))
      .finally(() => setPanelistChatsLoading(false));
  }, [visible]);

  const invitablePanelists = useMemo(() => {
    const seen = new Set<string>();
    const out: { chat: Chat; userId: string }[] = [];
    for (const chat of panelistChats) {
      if (chat.isGroup || chat.isGroupChat || chat.isCommunityChat || chat.kind === 'group' || chat.kind === 'community') continue;
      const uid = otherDirectParticipantUserId(chat.participants, currentUserId ?? undefined);
      if (!uid || seen.has(uid)) continue;
      seen.add(uid);
      out.push({ chat, userId: uid });
    }
    return out;
  }, [panelistChats, currentUserId]);

  const scheduledFor = useMemo(
    () => mergeDateAndTime(scheduledDate, scheduledTime),
    [scheduledDate, scheduledTime],
  );

  const { canSubmit: formCanSubmit, needsPanelists, scheduleInPast } = evaluateNewCallSubmit({
    callType: selectedType,
    panelistCount: panelistIds.length,
    isScheduled,
    scheduledFor,
  });
  const canSubmit = formCanSubmit && !loading;

  const resetForm = useCallback(() => {
    setTitle('');
    setSelectedType('voice');
    setIsScheduled(false);
    setScheduledDate(new Date());
    setScheduledTime(addMinutes(new Date(), 30));
    setDurationMinutes(DEFAULT_DURATION_MINUTES);
    setPanelistIds([]);
    setHostIsPanelist(true);
  }, []);

  const handleCreate = useCallback(async (startNow: boolean) => {
    if (needsPanelists) {
      setError(`Add at least ${MIN_BROADCAST_PANELISTS} panelist to start a broadcast.`);
      setShowPanelistPicker(true);
      return;
    }
    if (!startNow && scheduleInPast) {
      setError('Pick a date and time in the future.');
      return;
    }
    setError(null);
    const callTitle = title.trim() || 'My call';
    const callId = makeTempCallId();
    const when = startNow ? null : scheduledFor;

    setLoading(true);
    try {
      const result = await onCreate({
        callId,
        callType: selectedType,
        title: callTitle,
        scheduledFor: when,
        durationMinutes: when ? durationMinutes : null,
        inviteeUserIds: panelistIds,
        hostIsPanelist: isBroadcast ? hostIsPanelist : undefined,
      });

      onStart({ ...result, inviteeUserIds: panelistIds, hostIsPanelist: isBroadcast ? hostIsPanelist : undefined });
      resetForm();
    } catch (e: any) {
      setError(e?.message ?? 'Failed to create call');
    } finally {
      setLoading(false);
    }
  }, [title, selectedType, scheduledFor, durationMinutes, panelistIds, hostIsPanelist, isBroadcast, needsPanelists, scheduleInPast, onCreate, onStart, resetForm]);

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
            <Pressable
              onPress={onClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
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
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${opt.label}, ${opt.desc}`}
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

          {/* Panelists (broadcast only) */}
          {isBroadcast && (
            <View style={{ gap: 8 }}>
              <Text style={[styles.label, { color: palette.subtext }]}>
                Panelists ({MIN_BROADCAST_PANELISTS}-{MAX_BROADCAST_PANELISTS} required)
              </Text>
              <Pressable
                onPress={() => setShowPanelistPicker(true)}
                style={[
                  styles.scheduleToggle,
                  { borderColor: needsPanelists ? palette.danger : palette.inputBorder, backgroundColor: palette.surface },
                ]}
              >
                <KISIcon name="people" size={18} color={panelistIds.length > 0 ? palette.gold : palette.subtext} />
                <Text style={[styles.scheduleToggleText, { color: panelistIds.length > 0 ? palette.gold : palette.text }]}>
                  {panelistIds.length > 0 ? `${panelistIds.length} panelist${panelistIds.length === 1 ? '' : 's'} selected` : 'Add panelists'}
                </Text>
                <KISIcon name="chevron-right" size={16} color={palette.subtext} />
              </Pressable>

              {/* "the creator should be included as one of the options to
                  be a panelist. one can create the call but is not a
                  panelist" */}
              <Pressable
                onPress={() => setHostIsPanelist(v => !v)}
                style={[styles.scheduleToggle, { borderColor: palette.inputBorder, backgroundColor: palette.surface }]}
              >
                <KISIcon name="radio" size={18} color={hostIsPanelist ? palette.gold : palette.subtext} />
                <Text style={[styles.scheduleToggleText, { color: hostIsPanelist ? palette.gold : palette.text }]}>
                  {hostIsPanelist ? "You'll appear as a panelist" : "You'll host off-panel"}
                </Text>
                <View style={[styles.hostToggleTrack, { backgroundColor: hostIsPanelist ? palette.gold : palette.inputBorder }]}>
                  <View style={[styles.hostToggleThumb, { backgroundColor: palette.ivory, alignSelf: hostIsPanelist ? 'flex-end' : 'flex-start' }]} />
                </View>
              </Pressable>
            </View>
          )}

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
              <View style={{ gap: 14 }}>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <KISDateTimeInput
                      label="Date"
                      mode="date"
                      value={scheduledDate.toISOString()}
                      onChange={(iso) => setScheduledDate(new Date(iso))}
                      minimumDate={new Date()}
                      containerStyle={{ marginBottom: 0 }}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <KISDateTimeInput
                      label="Time"
                      mode="time"
                      value={scheduledTime.toISOString()}
                      onChange={(iso) => setScheduledTime(new Date(iso))}
                      containerStyle={{ marginBottom: 0 }}
                    />
                  </View>
                </View>

                <View style={{ gap: 8 }}>
                  <Text style={[styles.label, { color: palette.subtext }]}>Duration</Text>
                  <View style={styles.presetRow}>
                    {DURATION_PRESETS.map(mins => {
                      const selected = durationMinutes === mins;
                      return (
                        <KISButton
                          key={mins}
                          title={formatDuration(mins)}
                          size="xs"
                          variant={selected ? 'primary' : 'outline'}
                          onPress={() => setDurationMinutes(mins)}
                        />
                      );
                    })}
                  </View>
                  <View style={styles.durationStepperRow}>
                    <Pressable
                      onPress={() => setDurationMinutes(d => Math.max(MIN_DURATION_MINUTES, d - DURATION_STEP))}
                      disabled={durationMinutes <= MIN_DURATION_MINUTES}
                      accessibilityRole="button"
                      accessibilityLabel="Decrease duration by 5 minutes"
                      style={[styles.stepperBtn, { borderColor: palette.inputBorder, opacity: durationMinutes <= MIN_DURATION_MINUTES ? 0.4 : 1 }]}
                    >
                      <KISIcon name="minus" size={16} color={palette.text} />
                    </Pressable>
                    <Text style={[styles.durationValue, { color: palette.text }]}>
                      {formatDuration(durationMinutes)}
                    </Text>
                    <Pressable
                      onPress={() => setDurationMinutes(d => Math.min(MAX_DURATION_MINUTES, d + DURATION_STEP))}
                      disabled={durationMinutes >= MAX_DURATION_MINUTES}
                      accessibilityRole="button"
                      accessibilityLabel="Increase duration by 5 minutes"
                      style={[styles.stepperBtn, { borderColor: palette.inputBorder, opacity: durationMinutes >= MAX_DURATION_MINUTES ? 0.4 : 1 }]}
                    >
                      <KISIcon name="plus" size={16} color={palette.text} />
                    </Pressable>
                  </View>
                </View>

                <Text style={[styles.scheduleConfirm, { color: scheduleInPast ? palette.danger : palette.subtext }]}>
                  {scheduleInPast ? 'Pick a date and time in the future.' : `Starts ${formatScheduled(scheduledFor)} · ${formatDuration(durationMinutes)}`}
                </Text>
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
              disabled={!canSubmit}
              style={[styles.primaryBtn, { backgroundColor: palette.gold }, !canSubmit && styles.btnDisabled]}
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
              disabled={!canSubmit}
              style={[styles.primaryBtn, { backgroundColor: palette.gold }, !canSubmit && styles.btnDisabled]}
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

      <PanelistPickerSheet
        visible={showPanelistPicker}
        palette={palette}
        loading={panelistChatsLoading}
        invitable={invitablePanelists}
        selectedUserIds={panelistIds}
        onChangeSelected={setPanelistIds}
        onClose={() => setShowPanelistPicker(false)}
        onDone={() => setShowPanelistPicker(false)}
      />
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
  hostToggleTrack: {
    width: 40,
    height: 22,
    borderRadius: 11,
    padding: 2,
    justifyContent: 'center',
  },
  hostToggleThumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  presetRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  durationStepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginTop: 4,
  },
  stepperBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationValue: { fontSize: 16, fontWeight: '800', minWidth: 80, textAlign: 'center' },
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
