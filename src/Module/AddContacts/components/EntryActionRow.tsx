// src/screens/chat/components/EntryActionRow.tsx

import React from 'react';
import { View, Text, Pressable } from 'react-native';

import { KISIcon } from '@/constants/kisIcons';
import { KIS_TOKENS } from '../../../theme/constants';
import { addContactsStyles as styles } from '../addContactsStyles';

type EntryActionRowProps = {
  icon: any;
  title: string;
  subtitle: string;
  // keep palette loose so we don't depend on theme types here
  palette: any;
  onPress: () => void;
};

export const EntryActionRow: React.FC<EntryActionRowProps> = ({
  icon,
  title,
  subtitle,
  palette,
  onPress,
}) => {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.entryRow,
        {
          backgroundColor: palette.card,
          borderColor: palette.inputBorder,
          opacity: pressed ? KIS_TOKENS.opacity.pressed : 1,
        },
      ]}
    >
      <View
        style={[
          styles.entryIconCircle,
          { backgroundColor: palette.primarySoft ?? palette.surface },
        ]}
      >
        <KISIcon
          name={icon}
          size={20}
          color={palette.primaryStrong ?? palette.primary}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.entryTitle, { color: palette.text }]}>{title}</Text>
        <Text style={[styles.entrySubtitle, { color: palette.subtext }]}>
          {subtitle}
        </Text>
      </View>
    </Pressable>
  );
};
