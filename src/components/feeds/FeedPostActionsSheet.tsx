import React from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import usePullDownToClose from '@/hooks/usePullDownToClose';

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
  const { dragY, panHandlers } = usePullDownToClose({
    enabled: visible,
    onClose,
  });

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />
      <Animated.View
        style={[
          styles.sheet,
          {
            backgroundColor: palette.card,
            borderColor: palette.divider,
            transform: [{ translateY: dragY }],
          },
        ]}
      >
        <View {...panHandlers} style={styles.handleWrap}>
          <View style={[styles.handle, { backgroundColor: palette.divider }]} />
        </View>
        {actions.map(action => (
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
                color: action.destructive
                  ? palette.error ?? '#DC2626'
                  : palette.text,
                fontSize: 14,
              }}
            >
              {action.label}
            </Text>
          </Pressable>
        ))}
      </Animated.View>
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
  handleWrap: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 4,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 999,
  },
  actionRow: {
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
});
