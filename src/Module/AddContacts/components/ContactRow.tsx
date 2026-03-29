// src/screens/chat/components/ContactRow.tsx

import React from 'react';
import { View, Text, Pressable } from 'react-native';

import { KIS_TOKENS } from '../../../theme/constants';
import { addContactsStyles as styles } from '../addContactsStyles';
import { KISContact } from '../contactsService';

type ContactRowProps = {
  contact: KISContact;
  palette: any;
  onPress: () => void;
  showInvite: boolean;
};

export const ContactRow: React.FC<ContactRowProps> = ({
  contact,
  palette,
  onPress,
  showInvite,
}) => {
  const initials = contact.name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.contactRow,
        {
          backgroundColor: palette.card,
          borderColor: palette.inputBorder,
          opacity: pressed ? KIS_TOKENS.opacity.pressed : 1,
        },
      ]}
    >
      <View
        style={[
          styles.avatar,
          { backgroundColor: palette.divider },
        ]}
      >
        <Text style={{ color: palette.text, fontWeight: '600' }}>
          {initials || '?'}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: palette.text, fontSize: 15 }}>
          {contact.name}
        </Text>
        <Text
          style={{ color: palette.subtext, fontSize: 13 }}
          numberOfLines={1}
        >
          {contact.phone}
        </Text>
      </View>
      {showInvite && (
        <View
          style={[
            styles.invitePill,
            {
              backgroundColor: palette.primarySoft ?? palette.surface,
              borderColor: palette.primaryStrong ?? palette.inputBorder,
            },
          ]}
        >
          <Text
            style={{
              color: palette.primaryStrong ?? palette.primary,
              fontSize: 12,
              fontWeight: '600',
            }}
          >
            INVITE
          </Text>
        </View>
      )}
    </Pressable>
  );
};
