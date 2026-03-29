// src/screens/chat/components/PollModal.tsx

import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
} from 'react-native';
import { KISPalette, KIS_TOKENS, kisRadius } from '@/theme/constants';

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

  const updateOption = (idx: number, value: string) => {
    setOptions((prev) => {
      const copy = [...prev];
      copy[idx] = value;
      return copy;
    });
  };

  const addOption = () => {
    setOptions((prev) => [...prev, '']);
  };

  const removeOption = (idx: number) => {
    setOptions((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleCreate = () => {
    const cleaned = options.map((o) => o.trim()).filter(Boolean);
    if (!question.trim() || cleaned.length < 2) {
      // minimal guard; real validation later
      return;
    }
    if (onCreatePoll) {
      onCreatePoll({
        question: question.trim(),
        options: cleaned,
      });
    }
    onClose();
    // Optional: reset if you want
    setQuestion('');
    setOptions(['', '']);
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
        <View
          style={{
            backgroundColor: palette.surfaceElevated,
            borderTopLeftRadius: kisRadius.xl,
            borderTopRightRadius: kisRadius.xl,
            padding: KIS_TOKENS.spacing.lg,
            maxHeight: '80%',
          }}
        >
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
                marginBottom: KIS_TOKENS.spacing.lg,
              }}
            />

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
                  onChangeText={(val) => updateOption(idx, val)}
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
                    style={{ marginLeft: KIS_TOKENS.spacing.sm }}
                  >
                    <Text style={{ color: palette.danger }}>Remove</Text>
                  </Pressable>
                )}
              </View>
            ))}

            <Pressable onPress={addOption}>
              <Text
                style={{
                  color: palette.primary,
                  marginTop: KIS_TOKENS.spacing.sm,
                  marginBottom: KIS_TOKENS.spacing.lg,
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
            <Pressable onPress={onClose}>
              <Text style={{ color: palette.subtext }}>Cancel</Text>
            </Pressable>
            <Pressable onPress={handleCreate}>
              <Text style={{ color: palette.primary, fontWeight: '700' }}>
                Create
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};
