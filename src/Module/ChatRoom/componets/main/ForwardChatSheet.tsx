import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  Animated,
} from 'react-native';

import type { Chat } from '../../messagesUtils';
import { KISIcon } from '@/constants/kisIcons';
import ImagePlaceholder from '@/components/common/ImagePlaceholder';

type ForwardChatSheetProps = {
  visible: boolean;
  palette: any;
  chats: Chat[];
  maxTargets?: number;
  onClose: () => void;
  onConfirm: (chatIds: string[]) => void;
};

export const ForwardChatSheet: React.FC<ForwardChatSheetProps> = ({
  visible,
  palette,
  chats,
  maxTargets = 5,
  onClose,
  onConfirm,
}) => {
  const [query, setQuery] = useState('');
  const [selectedChatIds, setSelectedChatIds] = useState<string[]>([]);
  const translateX = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(translateX, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(translateX, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setQuery('');
        setSelectedChatIds([]);
      });
    }
  }, [visible, translateX]);

  const toggleChat = (id: string) => {
    setSelectedChatIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(x => x !== id);
      }
      if (prev.length >= maxTargets) {
        return prev;
      }
      return [...prev, id];
    });
  };

  const filteredChats = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return chats;
    return chats.filter(c =>
      (c.name ?? '')
        .toLowerCase()
        .includes(q),
    );
  }, [query, chats]);

  if (!visible) return null;

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: palette.forwardSheetBackdrop ?? '#00000088',
        transform: [
          {
            translateX: translateX.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 400], // slide from right
            }),
          },
        ],
      }}
    >
      <View
        style={{
          flex: 1,
          marginLeft: 32,
          backgroundColor: palette.forwardSheetBg ?? palette.bg,
        }}
      >
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderBottomWidth: 1,
            borderColor: palette.divider,
          }}
        >
          <Pressable
            onPress={onClose}
            style={{ padding: 4, marginRight: 8 }}
          >
            <KISIcon
              name="arrow-left"
              size={20}
              color={palette.text}
            />
          </Pressable>
          <Text
            style={{
              flex: 1,
              fontSize: 16,
              fontWeight: '600',
              color: palette.text,
            }}
          >
            Forward to...
          </Text>
          <Text
            style={{
              fontSize: 12,
              color: palette.subtext,
            }}
          >
            {selectedChatIds.length}/{maxTargets}
          </Text>
        </View>

        {/* Search */}
        <View
          style={{
            paddingHorizontal: 12,
            paddingVertical: 8,
          }}
        >
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search chats"
            placeholderTextColor={palette.subtext}
            style={{
              borderRadius: 999,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderWidth: 2,
              borderColor: palette.divider,
              color: palette.text,
            }}
          />
        </View>

        {/* Chats list */}
        <FlatList
          data={filteredChats}
          keyExtractor={item => item.id}
          renderItem={({ item }) => {
            const selected = selectedChatIds.includes(item.id);
            return (
              <Pressable
                onPress={() => toggleChat(item.id)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  backgroundColor: selected
                    ? palette.selectedChatBg ?? '#4F46E511'
                    : 'transparent',
                }}
              >
                <ImagePlaceholder
                  size={32}
                  radius={16}
                  style={{ marginRight: 10 }}
                />

                <Text
                  style={{
                    flex: 1,
                    color: palette.text,
                    fontSize: 14,
                  }}
                >
                  {item.name ?? 'Chat'}
                </Text>

                {selected && (
                  <KISIcon
                    name="check"
                    size={18}
                    color={palette.primary}
                  />
                )}
              </Pressable>
            );
          }}
        />

        {/* Confirm */}
        <View
          style={{
            padding: 12,
            borderTopWidth: 1,
            borderColor: palette.divider,
          }}
        >
          <Pressable
            onPress={() => onConfirm(selectedChatIds)}
            disabled={selectedChatIds.length === 0}
            style={{
              borderRadius: 999,
              paddingVertical: 10,
              alignItems: 'center',
              backgroundColor:
                selectedChatIds.length === 0
                  ? palette.disabledBg ?? '#999'
                  : palette.primary,
            }}
          >
            <Text
              style={{
                color: palette.onPrimary ?? '#fff',
                fontWeight: '600',
              }}
            >
              Forward
            </Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
};
