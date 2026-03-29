// src/screens/chat/componets/PinnedMessagesSheet.tsx

import React from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  FlatList,
} from 'react-native';

import { chatRoomStyles as styles } from '../../chatRoomStyles';
import { KISIcon } from '@/constants/kisIcons';
import { ChatMessage } from '../../chatTypes';

type PinnedMessagesSheetProps = {
  visible: boolean;
  onClose: () => void;
  roomId: string;
  pinnedMessages: ChatMessage[];
  palette: any;
  /**
   * NEW: when a pinned message is tapped,
   * the parent can scroll + highlight it in the main list.
   */
  onJumpToMessage?: (messageId: string) => void;
};

export const PinnedMessagesSheet: React.FC<PinnedMessagesSheetProps> = ({
  visible,
  onClose,
  roomId: _roomId,
  pinnedMessages,
  palette,
  onJumpToMessage,
}) => {
  const count = pinnedMessages.length;

  const handlePressPinned = (item: ChatMessage) => {
    if (onJumpToMessage) {
      onJumpToMessage(item.id);
    } else {
      onClose();
    }
  };

  const renderItem = ({ item }: { item: ChatMessage }) => {
    const snippet =
      item.text ||
      item.styledText?.text ||
      (item.sticker ? 'Sticker' : '') ||
      (item.voice ? 'Voice message' : '') ||
      '';

    const createdAt = new Date(item.createdAt);
    const timeLabel = createdAt.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });

    return (
      <Pressable
        style={{
          paddingVertical: 8,
          paddingHorizontal: 12,
          borderBottomWidth: 1,
          borderBottomColor: palette.divider,
        }}
        onPress={() => handlePressPinned(item)}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 2,
          }}
        >
          <KISIcon
            name="pin"
            size={14}
            color={palette.primary}
          />
          <Text
            style={{
              marginLeft: 6,
              fontSize: 12,
              fontWeight: '600',
              color: palette.primary,
            }}
          >
            Pinned
          </Text>
          <Text
            style={{
              marginLeft: 8,
              fontSize: 11,
              color: palette.subtext,
            }}
          >
            {timeLabel}
          </Text>
        </View>

        {!!snippet && (
          <Text
            numberOfLines={2}
            ellipsizeMode="tail"
            style={{
              fontSize: 13,
              color: palette.text,
            }}
          >
            {snippet}
          </Text>
        )}
      </Pressable>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.sheetOverlay}>
        <Pressable style={styles.sheetBackdrop} onPress={onClose} />

        <View
          style={[
            styles.sheetContainer,
            {
              backgroundColor: palette.card,
              borderTopColor: palette.divider,
            },
          ]}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderBottomColor: palette.divider,
            }}
          >
            <Text
              style={{
                flex: 1,
                fontSize: 16,
                fontWeight: '600',
                color: palette.text,
              }}
            >
              Pinned messages ({count})
            </Text>

            <Pressable onPress={onClose}>
              <KISIcon
                name="close"
                size={20}
                color={palette.subtext}
              />
            </Pressable>
          </View>

          {/* Empty state / List */}
          {count === 0 ? (
            <View
              style={{
                paddingHorizontal: 16,
                paddingVertical: 20,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  color: palette.subtext,
                }}
              >
                No pinned messages yet in this room.
              </Text>
            </View>
          ) : (
            <FlatList
              data={pinnedMessages}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              contentContainerStyle={{ paddingBottom: 24 }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
};
