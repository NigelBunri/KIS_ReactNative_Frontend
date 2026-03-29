// src/screens/chat/components/VoiceLockedActionsRow.tsx

import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { chatRoomStyles as styles } from '../chatRoomStyles';
import { KISIcon } from '@/constants/kisIcons';

type VoiceLockedActionsRowProps = {
  palette: any;
  onDelete: () => void;
  onSend: () => void;
};

export const VoiceLockedActionsRow: React.FC<VoiceLockedActionsRowProps> = ({
  palette,
  onDelete,
  onSend,
}) => {
  return (
    <View style={styles.voiceLockedActionsRow}>
      <Pressable
        style={styles.voiceLockedButton}
        onPress={onDelete}
      >
        <KISIcon
          name="trash"
          size={18}
          color={palette.danger ?? '#EF4444'}
        />
        <Text
          style={[
            styles.voiceLockedButtonText,
            { color: palette.danger ?? '#EF4444' },
          ]}
        >
          Delete
        </Text>
      </Pressable>

      <Pressable
        style={styles.voiceLockedButton}
        onPress={onSend}
      >
        <KISIcon
          name="send"
          size={18}
          color={palette.primary}
        />
        <Text
          style={[
            styles.voiceLockedButtonText,
            { color: palette.primary },
          ]}
        >
          Send
        </Text>
      </Pressable>
    </View>
  );
};
