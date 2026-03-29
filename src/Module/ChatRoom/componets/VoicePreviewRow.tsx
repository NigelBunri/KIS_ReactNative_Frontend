// src/screens/chat/components/VoicePreviewRow.tsx

import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { chatRoomStyles as styles } from '../chatRoomStyles';
import { KISIcon } from '@/constants/kisIcons';

type VoicePreviewRowProps = {
  palette: any;
  recordSeconds: number;
  isPlaying: boolean;
  progress: number; // 0..1
  onTogglePlay: () => void;
  onDelete: () => void;
  onSend: () => void;
};

const formatTime = (secs: number) => {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  const mm = m < 10 ? `0${m}` : `${m}`;
  const ss = s < 10 ? `0${s}` : `${s}`;
  return `${mm}:${ss}`;
};

export const VoicePreviewRow: React.FC<VoicePreviewRowProps> = ({
  palette,
  recordSeconds,
  isPlaying,
  progress,
  onTogglePlay,
  onDelete,
  onSend,
}) => {
  return (
    <View
      style={[
        styles.voicePreviewRow,
        {
          backgroundColor:
            palette.composerInputBg ?? palette.surface,
          borderColor:
            palette.composerInputBorder ?? palette.inputBorder,
        },
      ]}
    >
      <Pressable
        style={styles.voicePreviewMain}
        onPress={onTogglePlay}
      >
        <KISIcon
          name={isPlaying ? 'pause' : 'play'}
          size={20}
          color={palette.primary}
        />

        <View style={styles.voicePreviewTextCol}>
          <Text
            style={[
              styles.voicePreviewTime,
              { color: palette.text },
            ]}
          >
            {formatTime(recordSeconds)}
            {isPlaying ? '  (Playing)' : ''}
          </Text>
          <View style={styles.voicePreviewProgressTrack}>
            <View
              style={[
                styles.voicePreviewProgressFill,
                {
                  width: `${Math.round(progress * 100)}%`,
                  backgroundColor: palette.primary,
                },
              ]}
            />
          </View>
        </View>
      </Pressable>

      <View style={styles.voicePreviewActions}>
        <Pressable
          style={styles.voicePreviewIconButton}
          onPress={onDelete}
        >
          <KISIcon
            name="trash"
            size={20}
            color={palette.danger ?? '#EF4444'}
          />
        </Pressable>
        <Pressable
          style={styles.voicePreviewIconButton}
          onPress={onSend}
        >
          <KISIcon
            name="send"
            size={20}
            color={palette.primary}
          />
        </Pressable>
      </View>
    </View>
  );
};
