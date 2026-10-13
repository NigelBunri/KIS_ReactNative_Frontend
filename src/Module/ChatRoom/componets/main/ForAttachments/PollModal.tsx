// src/screens/chat/components/PollModal.tsx

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

export type PollDraft = {
  question: string;
  options: string[];
};

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
  const canCreate = questionValid && optionsValid;

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
      });
    }
    onClose();
    setQuestion('');
    setOptions(['', '']);
    setAttempted(false);
  };

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
    </Modal>
  );
};
