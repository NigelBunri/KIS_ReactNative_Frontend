// src/screens/chat/components/AvatarPicker.tsx

import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
} from 'react-native';

export type AvatarOption = {
  id: string;
  label: string;
  initials: string;
  bgColor: string;
  fgColor?: string;
};

type AvatarPickerProps = {
  palette: any;
  onSelectAvatar: (avatarId: string) => void;
  selectedAvatarId?: string;
};

export const AVATAR_OPTIONS: AvatarOption[] = [
  { id: 'sunrise_orange',  label: 'Sunrise',     initials: 'SR', bgColor: '#FF7043', fgColor: '#FFFFFF' },
  { id: 'deep_blue',       label: 'Deep Blue',   initials: 'DB', bgColor: '#1976D2', fgColor: '#FFFFFF' },
  { id: 'forest_green',    label: 'Forest',      initials: 'FG', bgColor: '#2E7D32', fgColor: '#FFFFFF' },
  { id: 'royal_purple',    label: 'Royal',       initials: 'RP', bgColor: '#7B1FA2', fgColor: '#FFFFFF' },
  { id: 'golden_yellow',   label: 'Golden',      initials: 'GY', bgColor: '#FBC02D', fgColor: '#263238' },
  { id: 'ocean_teal',      label: 'Ocean',       initials: 'OC', bgColor: '#009688', fgColor: '#FFFFFF' },
  { id: 'charcoal',        label: 'Charcoal',    initials: 'CH', bgColor: '#37474F', fgColor: '#FFFFFF' },
  { id: 'raspberry',       label: 'Raspberry',   initials: 'RS', bgColor: '#C2185B', fgColor: '#FFFFFF' },
  { id: 'sky_light',       label: 'Sky Light',   initials: 'SL', bgColor: '#4FC3F7', fgColor: '#0D47A1' },
  { id: 'lime_fresh',      label: 'Lime',        initials: 'LM', bgColor: '#CDDC39', fgColor: '#263238' },
  { id: 'coffee_brown',    label: 'Coffee',      initials: 'CF', bgColor: '#6D4C41', fgColor: '#FFFFFF' },
  { id: 'steel',           label: 'Steel',       initials: 'ST', bgColor: '#90A4AE', fgColor: '#263238' },
  { id: 'midnight',        label: 'Midnight',    initials: 'MN', bgColor: '#263238', fgColor: '#FFFFFF' },
  { id: 'coral',           label: 'Coral',       initials: 'CR', bgColor: '#FF8A65', fgColor: '#263238' },
  { id: 'mint',            label: 'Mint',        initials: 'MT', bgColor: '#A5D6A7', fgColor: '#1B5E20' },
  { id: 'violet',          label: 'Violet',      initials: 'VT', bgColor: '#9575CD', fgColor: '#311B92' },
  { id: 'sand',            label: 'Sand',        initials: 'SD', bgColor: '#FFE082', fgColor: '#4E342E' },
  { id: 'ink',             label: 'Ink',         initials: 'IK', bgColor: '#1A237E', fgColor: '#FFFFFF' },
  { id: 'aqua',            label: 'Aqua',        initials: 'AQ', bgColor: '#00BCD4', fgColor: '#004D40' },
  { id: 'peach',           label: 'Peach',       initials: 'PC', bgColor: '#FFCCBC', fgColor: '#4E342E' },
  { id: 'olive',           label: 'Olive',       initials: 'OL', bgColor: '#827717', fgColor: '#FFFFFF' },
  { id: 'plum',            label: 'Plum',        initials: 'PL', bgColor: '#6A1B9A', fgColor: '#FFFFFF' },
  { id: 'ice',             label: 'Ice',         initials: 'IC', bgColor: '#E1F5FE', fgColor: '#01579B' },
  { id: 'firebrick',       label: 'Brick',       initials: 'BR', bgColor: '#D32F2F', fgColor: '#FFFFFF' },
];

export const AvatarPicker: React.FC<AvatarPickerProps> = ({
  palette,
  onSelectAvatar,
  selectedAvatarId,
}) => {
  return (
    <View
      style={{
        borderTopWidth: 1,
        borderTopColor: palette.divider,
        backgroundColor: palette.chatComposerBg ?? palette.card,
        paddingVertical: 4,
      }}
    >
      {/* Small header to guide the user */}
      <View
        style={{
          paddingHorizontal: 8,
          paddingBottom: 4,
        }}
      >
        <Text
          style={{
            fontSize: 12,
            color: palette.textSecondary ?? '#888',
          }}
        >
          Pick a background for styled text
        </Text>
      </View>

      <ScrollView
        style={{ maxHeight: 220 }}
        contentContainerStyle={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          paddingHorizontal: 8,
          paddingBottom: 8,
        }}
      >
        {AVATAR_OPTIONS.map((avatar, index) => {
          const isSelected = avatar.id === selectedAvatarId;

          return (
            <Pressable
              key={`${avatar.id}-${index}`}
              onPress={() => onSelectAvatar(avatar.id)}
              style={{
                width: 72,
                alignItems: 'center',
                marginVertical: 6,
              }}
              android_ripple={{ color: '#ccc', borderless: true }}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: avatar.bgColor,
                  borderWidth: isSelected ? 2 : 1,
                  borderColor: isSelected
                    ? palette.primary ?? '#1976D2'
                    : palette.divider ?? '#ccc',
                }}
              >
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: '700',
                    color: avatar.fgColor ?? '#FFFFFF',
                  }}
                >
                  {avatar.initials}
                </Text>
              </View>
              <Text
                numberOfLines={1}
                style={{
                  marginTop: 4,
                  fontSize: 10,
                  color: isSelected
                    ? palette.primary ?? '#1976D2'
                    : palette.textSecondary ?? '#777',
                }}
              >
                {avatar.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
};
