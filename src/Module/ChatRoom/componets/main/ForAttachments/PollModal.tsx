// src/screens/chat/components/PollModal.tsx

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
import { KISPalette, KIS_TOKENS, kisRadius } from '@/theme/constants';
import usePullDownToClose from '@/hooks/usePullDownToClose';
import KISDateTimeInput from '@/constants/KISDateTimeInput';

export type PollDraft = {
  question: string;
  options: string[];
  allowMultiple?: boolean;
  /** ISO timestamp (UTC) the poll stops accepting votes, or null for no closing time. */
  expiresAt?: string | null;
};

type ClosingMode = 'none' | '1h' | '6h' | '24h' | '3d' | '7d' | 'custom';

const CLOSING_DURATIONS_MS: Record<Exclude<ClosingMode, 'none' | 'custom'>, number> = {
  '1h': 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '3d': 3 * 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
};

const CLOSING_MODE_OPTIONS: { label: string; value: ClosingMode }[] = [
  { label: 'No closing time', value: 'none' },
  { label: '1 hour', value: '1h' },
  { label: '6 hours', value: '6h' },
  { label: '24 hours', value: '24h' },
  { label: '3 days', value: '3d' },
  { label: '7 days', value: '7d' },
  { label: 'Custom', value: 'custom' },
];

// Exported for regression testing only (see __tests__/PollModal.closing.test.ts) -
// every other caller stays internal to this component.
export function computeExpiresAtForClosingMode(
  mode: ClosingMode,
  customClosesAt: string | null,
  now: number = Date.now(),
): string | null {
  if (mode === 'none') return null;
  if (mode === 'custom') return customClosesAt;
  return new Date(now + CLOSING_DURATIONS_MS[mode]).toISOString();
}

export function isClosingTimeValid(
  mode: ClosingMode,
  computedExpiresAt: string | null,
  now: number = Date.now(),
): boolean {
  if (mode === 'none') return true;
  return !!computedExpiresAt && new Date(computedExpiresAt).getTime() > now;
}

type PollModalProps = {
  visible: boolean;
  palette: KISPalette;
  onClose: () => void;
  onCreatePoll?: (poll: PollDraft) => void;
};

export const PollModal: React.FC<PollModalProps> = ({
  visible,
  palette,
  onClose,
  onCreatePoll,
}) => {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [closingMode, setClosingMode] = useState<ClosingMode>('none');
  const [customClosesAt, setCustomClosesAt] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);
  const { dragY, panHandlers } = usePullDownToClose({
    enabled: visible,
    onClose,
  });

  const updateOption = (idx: number, value: string) => {
    setOptions(prev => {
      const copy = [...prev];
      copy[idx] = value;
      return copy;
    });
  };

  const addOption = () => {
    setOptions(prev => [...prev, '']);
  };

  const removeOption = (idx: number) => {
    setOptions(prev => prev.filter((_, i) => i !== idx));
  };

  const cleanedOptions = options.map(o => o.trim()).filter(Boolean);
  const questionValid = !!question.trim();
  const optionsValid = cleanedOptions.length >= 2;

  // Requirement 1E: validate the closing time is in the future before it
  // ever leaves this device - the server (assertValidPollPayload in
  // messages.service.ts) re-checks this independently regardless.
  const computedExpiresAt = computeExpiresAtForClosingMode(closingMode, customClosesAt);
  const closingValid = isClosingTimeValid(closingMode, computedExpiresAt);

  const canCreate = questionValid && optionsValid && closingValid;

  const handleCreate = () => {
    setAttempted(true);
    // Previously this silently did nothing on invalid input ("minimal
    // guard; real validation later") - tapping Create with a blank
    // question or fewer than 2 options just appeared to not respond at
    // all, with no indication why. Now mirrors EventModal's pattern:
    // show the specific reason beneath each invalid field.
    if (!canCreate) return;

    if (onCreatePoll) {
      onCreatePoll({
        question: question.trim(),
        options: cleanedOptions,
        allowMultiple,
        expiresAt: computedExpiresAt,
      });
    }
    onClose();
    setQuestion('');
    setOptions(['', '']);
    setAllowMultiple(false);
    setClosingMode('none');
    setCustomClosesAt(null);
    setAttempted(false);
  };

  return (
    <Modal transparent visible={visible} animationType="slide">
      {/* AND-030: this bottom sheet had no keyboard handling at all, unlike
          every other full-screen chat composer in this module
          (TextCardComposer.tsx's KeyboardAvoidingView is the established
          pattern). The sheet is pinned to the bottom with justifyContent:
          'flex-end', so on focusing the Question field (or any Option
          field further down the ScrollView) the keyboard simply overlaid
          the lower half of the sheet - including the Options list and the
          Create button - with nothing shifting it up out of the way. */}
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
            Create a poll
          </Text>

          <ScrollView>
            <Text
              style={{
                color: palette.subtext,
                marginBottom: KIS_TOKENS.spacing.xs,
              }}
            >
              Question
            </Text>
            <TextInput
              value={question}
              onChangeText={setQuestion}
              placeholder="What do you want to ask?"
              placeholderTextColor={palette.subtext}
              style={{
                borderRadius: kisRadius.lg,
                borderWidth: 2,
                borderColor: palette.inputBorder,
                backgroundColor: palette.inputBg,
                paddingHorizontal: KIS_TOKENS.spacing.md,
                paddingVertical: KIS_TOKENS.spacing.sm,
                color: palette.text,
                marginBottom: attempted && !questionValid ? KIS_TOKENS.spacing.xs : KIS_TOKENS.spacing.lg,
              }}
            />
            {attempted && !questionValid && (
              <Text style={{ color: palette.danger, marginBottom: KIS_TOKENS.spacing.md, fontSize: 12 }}>
                A question is required.
              </Text>
            )}

            <Text
              style={{
                color: palette.subtext,
                marginBottom: KIS_TOKENS.spacing.xs,
              }}
            >
              Options
            </Text>

            {options.map((opt, idx) => (
              <View
                key={idx}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginBottom: KIS_TOKENS.spacing.sm,
                }}
              >
                <TextInput
                  value={opt}
                  onChangeText={val => updateOption(idx, val)}
                  placeholder={`Option ${idx + 1}`}
                  placeholderTextColor={palette.subtext}
                  style={{
                    flex: 1,
                    borderRadius: kisRadius.lg,
                    borderWidth: 2,
                    borderColor: palette.inputBorder,
                    backgroundColor: palette.inputBg,
                    paddingHorizontal: KIS_TOKENS.spacing.md,
                    paddingVertical: KIS_TOKENS.spacing.sm,
                    color: palette.text,
                  }}
                />
                {options.length > 2 && (
                  <Pressable
                    onPress={() => removeOption(idx)}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove option ${idx + 1}`}
                    style={{ marginLeft: KIS_TOKENS.spacing.sm, padding: 10, minHeight: 44, justifyContent: 'center' }}
                  >
                    <Text style={{ color: palette.danger }}>Remove</Text>
                  </Pressable>
                )}
              </View>
            ))}

            {attempted && !optionsValid && (
              <Text style={{ color: palette.danger, marginBottom: KIS_TOKENS.spacing.sm, fontSize: 12 }}>
                Enter at least 2 options.
              </Text>
            )}

            <Pressable
              onPress={addOption}
              accessibilityRole="button"
              accessibilityLabel="Add option"
              style={{ paddingVertical: 10, minHeight: 44, justifyContent: 'center' }}
            >
              <Text
                style={{
                  color: palette.primary,
                  marginBottom: KIS_TOKENS.spacing.sm,
                }}
              >
                + Add option
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setAllowMultiple(prev => !prev)}
              accessibilityRole="button"
              accessibilityLabel="Allow multiple answers"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 10,
                minHeight: 44,
                marginTop: KIS_TOKENS.spacing.sm,
              }}
            >
              <View
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 5,
                  borderWidth: 2,
                  borderColor: allowMultiple ? palette.primary : palette.inputBorder,
                  backgroundColor: allowMultiple ? palette.primary : 'transparent',
                  marginRight: KIS_TOKENS.spacing.sm,
                }}
              />
              <Text style={{ color: palette.text }}>Allow multiple answers</Text>
            </Pressable>

            <Text
              style={{
                color: palette.subtext,
                marginTop: KIS_TOKENS.spacing.md,
                marginBottom: KIS_TOKENS.spacing.xs,
              }}
            >
              Closing time
            </Text>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: KIS_TOKENS.spacing.xs,
                marginBottom: KIS_TOKENS.spacing.sm,
              }}
            >
              {CLOSING_MODE_OPTIONS.map(opt => {
                const active = closingMode === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => setClosingMode(opt.value)}
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

            {closingMode === 'custom' && (
              <KISDateTimeInput
                label="Closes at"
                mode="datetime"
                value={customClosesAt}
                onChange={setCustomClosesAt}
                minimumDate={new Date()}
                errorText={attempted && !closingValid ? 'Pick a closing time in the future.' : undefined}
                error={attempted && !closingValid}
              />
            )}

            {closingMode !== 'custom' && closingMode !== 'none' && computedExpiresAt && (
              <Text style={{ color: palette.subtext, fontSize: 12, marginBottom: KIS_TOKENS.spacing.sm }}>
                Closes {new Date(computedExpiresAt).toLocaleString()}
              </Text>
            )}
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
              accessibilityRole="button"
              accessibilityLabel="Create poll"
              style={{ paddingHorizontal: 14, paddingVertical: 12, minHeight: 44, justifyContent: 'center' }}
            >
              <Text style={{ color: canCreate ? palette.primary : palette.subtext, fontWeight: '700' }}>
                Create
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
