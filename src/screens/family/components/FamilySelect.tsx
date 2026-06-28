import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
} from 'react-native';
import { KISIcon } from '@/constants/kisIcons';
import { useKISTheme } from '@/theme/useTheme';

type FamilySelectOption = {
  label: string;
  value: string;
};

type FamilySelectProps = {
  value: string;
  options: FamilySelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
};

export default function FamilySelect({
  value,
  options,
  onChange,
  placeholder = 'Select',
}: FamilySelectProps) {
  const { palette } = useKISTheme();
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  const choose = (nextValue: string) => {
    onChange(nextValue);
    setOpen(false);
  };

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => setOpen(true)}
        style={[
          styles.trigger,
          {
            backgroundColor: palette.card,
            borderColor: palette.divider,
          },
        ]}
      >
        <Text style={[styles.triggerText, { color: palette.text }]} numberOfLines={1}>
          {selected?.label ?? placeholder}
        </Text>
        <KISIcon name="chevron-down-outline" size={18} color={palette.subtext} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable
            style={[
              styles.sheet,
              {
                backgroundColor: palette.surface,
                borderColor: palette.divider,
              },
            ]}
          >
            <Text style={[styles.title, { color: palette.text }]}>{placeholder}</Text>
            <ScrollView style={styles.options} showsVerticalScrollIndicator={false}>
              {options.map((option) => {
                const isSelected = option.value === value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    activeOpacity={0.85}
                    onPress={() => choose(option.value)}
                    style={[
                      styles.option,
                      {
                        backgroundColor: isSelected ? palette.gold : palette.card,
                        borderColor: isSelected ? palette.gold : palette.divider,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        { color: isSelected ? palette.bg : palette.text },
                      ]}
                    >
                      {option.label}
                    </Text>
                    {isSelected ? (
                      <KISIcon name="checkmark-circle" size={18} color={palette.bg} />
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  triggerText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    maxHeight: '70%',
    padding: 16,
    paddingBottom: 28,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 12,
  },
  options: {
    maxHeight: 420,
  },
  option: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  optionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
  },
});
