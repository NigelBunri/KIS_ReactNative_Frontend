// src/screens/chat/components/TextCardComposer.tsx

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { KISIcon } from '@/constants/kisIcons';

export type TextCardPayload = {
  text: string;
  backgroundColor: string;
  fontSize: number;
  fontColor: string;
  fontFamily?: string;
};

type TextCardComposerProps = {
  palette: any;
  backgroundColor: string;
  onClose: () => void;
  onSend: (payload: TextCardPayload) => void;
};

const FONT_SIZES = [16, 20, 24, 30, 36];

// NO pure black / white here – just light colors
const FONT_COLORS = [
  '#FFEB3B', // yellow
  '#FFCDD2', // light red
  '#F8BBD0', // pink
  '#C8E6C9', // light green
  '#BBDEFB', // light blue
  '#D1C4E9', // lavender
  '#FFE0B2', // light orange
  '#B2DFDB', // teal-ish
];

// Use fonts that exist on iOS & Android
const FONT_FAMILIES = [
  { id: 'default', label: 'Default', value: undefined as string | undefined },
  { id: 'serif',   label: 'Serif',   value: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }) },
  { id: 'mono',    label: 'Mono',    value: Platform.select({ ios: 'Courier New', android: 'monospace', default: 'monospace' }) },
];

export const TextCardComposer: React.FC<TextCardComposerProps> = ({
  palette,
  backgroundColor,
  onClose,
  onSend,
}) => {
  const [text, setText] = useState('');
  const [fontSize, setFontSize] = useState<number>(24);
  const [fontColor, setFontColor] = useState<string>(FONT_COLORS[0]);
  const [fontFamily, setFontFamily] = useState<string | undefined>(undefined);

  const screenWidth = Dimensions.get('window').width;
  const translateX = useRef(new Animated.Value(screenWidth)).current;

  // Slide in from right
  useEffect(() => {
    Animated.timing(translateX, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [translateX]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;

    onSend({
      text: trimmed,
      backgroundColor,
      fontSize,
      fontColor,
      // IMPORTANT: send the actual fontFamily or undefined – no "system" override
      fontFamily,
    });
    onClose();
  };

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor,
        transform: [{ translateX }],
      }}
    >
      {/* Header with back arrow */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 12,
          backgroundColor: 'rgba(0,0,0,0.18)',
        }}
      >
        <Pressable
          onPress={onClose}
          style={{ padding: 8, marginRight: 8 }}
          hitSlop={8}
        >
          {/* use your actual back icon name here */}
          <KISIcon
            name="back"
            size={22}
            color={palette.onPrimary ?? '#fff'}
          />
        </Pressable>
        <Text
          style={{
            color: palette.onPrimary ?? '#fff',
            fontSize: 16,
            fontWeight: '600',
          }}
        >
          Styled text message
        </Text>
      </View>

      {/* Body */}
      <View
        style={{
          flex: 1,
          padding: 16,
          justifyContent: 'space-between',
        }}
      >
        {/* Preview + controls */}
        <View style={{ flex: 1 }}>
          {/* Preview */}
          <View
            style={{
              flex: 1,
              justifyContent: 'center',
              alignItems: 'center',
              paddingHorizontal: 12,
            }}
          >
            <Text
              style={{
                fontSize,
                color: fontColor,
                fontFamily,
                textAlign: 'center',
              }}
            >
              {text || 'Type your message...'}
            </Text>
          </View>

          {/* Controls */}
          <View>
            {/* Font size */}
            <Text
              style={{
                color: fontColor,
                marginBottom: 4,
                fontWeight: '500',
              }}
            >
              Font size
            </Text>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                marginBottom: 8,
              }}
            >
              {FONT_SIZES.map(size => {
                const selected = size === fontSize;
                return (
                  <Pressable
                    key={`fs-${size}`}
                    onPress={() => setFontSize(size)}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 16,
                      borderWidth: 2,
                      borderColor: selected
                        ? fontColor
                        : 'rgba(255,255,255,0.7)',
                      marginRight: 8,
                      marginBottom: 6,
                      backgroundColor: selected
                        ? 'rgba(0,0,0,0.2)'
                        : 'transparent',
                    }}
                  >
                    <Text
                      style={{
                        color: fontColor,
                        fontSize: 12,
                      }}
                    >
                      {size}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Font color */}
            <Text
              style={{
                color: fontColor,
                marginBottom: 4,
                fontWeight: '500',
              }}
            >
              Font color
            </Text>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                marginBottom: 8,
              }}
            >
              {FONT_COLORS.map(color => {
                const selected = color === fontColor;
                return (
                  <Pressable
                    key={`fc-${color}`}
                    onPress={() => setFontColor(color)}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      marginRight: 8,
                      marginBottom: 6,
                      backgroundColor: color,
                      borderWidth: selected ? 2 : 1,
                      borderColor: selected ? '#fff' : 'rgba(255,255,255,0.7)',
                    }}
                  />
                );
              })}
            </View>

            {/* Font type */}
            <Text
              style={{
                color: fontColor,
                marginBottom: 4,
                fontWeight: '500',
              }}
            >
              Font type
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {FONT_FAMILIES.map(ff => {
                const selected =
                  ff.value === fontFamily ||
                  (!ff.value && !fontFamily && ff.id === 'default');

                return (
                  <Pressable
                    key={`ff-${ff.id}`}
                    onPress={() => setFontFamily(ff.value)}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 16,
                      borderWidth: 2,
                      borderColor: selected
                        ? fontColor
                        : 'rgba(255,255,255,0.7)',
                      marginRight: 8,
                      marginBottom: 6,
                      backgroundColor: selected
                        ? 'rgba(0,0,0,0.2)'
                        : 'transparent',
                    }}
                  >
                    <Text
                      style={{
                        color: fontColor,
                        fontSize: 12,
                      }}
                    >
                      {ff.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        {/* Input + send */}
        <View>
          <View
            style={{
              borderRadius: 12,
              backgroundColor: 'rgba(0,0,0,0.18)',
              paddingHorizontal: 12,
              paddingVertical: 8,
              marginBottom: 8,
            }}
          >
            <TextInput
              multiline
              placeholder="Type your message here"
              placeholderTextColor="rgba(255,255,255,0.7)"
              value={text}
              onChangeText={setText}
              style={{
                minHeight: 60,
                color: fontColor,
                fontSize: 16,
              }}
            />
          </View>

          <Pressable
            onPress={handleSend}
            style={{
              alignSelf: 'flex-end',
              paddingHorizontal: 20,
              paddingVertical: 10,
              borderRadius: 20,
              backgroundColor: 'rgba(0,0,0,0.35)',
              opacity: text.trim() ? 1 : 0.6,
            }}
            disabled={!text.trim()}
          >
            <Text
              style={{
                color: '#fff',
                fontWeight: '600',
              }}
            >
              Send
            </Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
};
