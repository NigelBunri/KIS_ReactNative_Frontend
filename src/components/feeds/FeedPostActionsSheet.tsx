import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useKISTheme } from '@/theme/useTheme';

export type FeedPostAction = {
  key: string;
  label: string;
  onPress: () => void;
  destructive?: boolean;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  actions: FeedPostAction[];
};

export default function FeedPostActionsSheet({
  visible,
  onClose,
  actions,
}: Props) {
  const { palette } = useKISTheme();

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: palette.card, borderColor: palette.divider }]}>
        {actions.map((action) => (
          <Pressable
            key={action.key}
            onPress={() => {
              action.onPress();
              onClose();
            }}
            style={({ pressed }) => [
              styles.actionRow,
              { backgroundColor: pressed ? palette.surface : 'transparent' },
            ]}
          >
            <Text
              style={{
                color: action.destructive ? palette.error ?? '#DC2626' : palette.text,
                fontSize: 14,
              }}
            >
              {action.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#00000066',
  },
  sheet: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
    borderWidth: 2,
    borderRadius: 16,
    overflow: 'hidden',
  },
  actionRow: {
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
});
