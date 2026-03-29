// src/screens/chat/components/StickerPicker.tsx

import React from 'react';
import { View, Text, Pressable, Image } from 'react-native';

export type StickerThumb = {
  id: string;
  uri: string;
  text?: string; // optional, from editor overlay
};

type StickerPickerProps = {
  palette: any;
  stickers: StickerThumb[];
  onCreateStickerPress: () => void;
  onSelectSticker: (sticker: StickerThumb) => void;
};

export const StickerPicker: React.FC<StickerPickerProps> = ({
  palette,
  stickers,
  onCreateStickerPress,
  onSelectSticker,
}) => {
  return (
    <View style={{ padding: 12 }}>
      {/* Create new sticker button */}
      <Pressable
        onPress={onCreateStickerPress}
        style={{
          marginBottom: 12,
          backgroundColor: palette.primary,
          paddingVertical: 8,
          paddingHorizontal: 14,
          borderRadius: 10,
          alignSelf: 'flex-start',
        }}
      >
        <Text
          style={{
            color: palette.onPrimary ?? '#fff',
            fontWeight: '600',
            fontSize: 13,
          }}
        >
          + Create New Sticker
        </Text>
      </Pressable>

      {/* Sticker grid */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {stickers.length === 0 && (
          <Text style={{ color: palette.subtext, fontSize: 13 }}>
            No stickers yet. Create one!
          </Text>
        )}

        {stickers.map((sticker) => (
          <Pressable
            key={sticker.id}
            onPress={() => onSelectSticker(sticker)}
            style={{
              width: 80,
              height: 80,
              margin: 6,
              borderRadius: 12,
              overflow: 'hidden',
              backgroundColor: palette.surface ?? '#222',
            }}
          >
            <Image
              source={{ uri: sticker.uri }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="contain"
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
};