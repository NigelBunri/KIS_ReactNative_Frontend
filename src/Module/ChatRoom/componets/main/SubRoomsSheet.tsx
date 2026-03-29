// src/screens/chat/componets/SubRoomsSheet.tsx

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
import { SubRoom } from '../../chatTypes';

type SubRoomsSheetProps = {
  visible: boolean;
  onClose: () => void;
  parentRoomId: string;
  subRooms: SubRoom[];
  palette: any;
};

export const SubRoomsSheet: React.FC<SubRoomsSheetProps> = ({
  visible,
  onClose,
  parentRoomId: _parentRoomId,
  subRooms,
  palette,
}) => {
  const count = subRooms.length;

  const renderItem = ({ item }: { item: SubRoom }) => {
    const title =
      item.title ||
      (item.rootMessageId
        ? `Thread from message ${item.rootMessageId.slice(0, 6)}…`
        : 'Sub-room');

    return (
      <Pressable
        style={{
          paddingVertical: 10,
          paddingHorizontal: 16,
          borderBottomWidth: 1,
          borderBottomColor: palette.divider,
        }}
        // Later this will navigate or request join
        onPress={() => {
          // placeholder – just close for now
          onClose();
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <KISIcon
            name="layers"
            size={16}
            color={palette.primary}
          />
          <View style={{ marginLeft: 8, flex: 1 }}>
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              style={{
                fontSize: 14,
                fontWeight: '600',
                color: palette.text,
              }}
            >
              {title}
            </Text>
            <Text
              style={{
                fontSize: 12,
                color: palette.subtext,
                marginTop: 2,
              }}
            >
              Nested sub-room (UI only for now)
            </Text>
          </View>
        </View>
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
              Sub-rooms ({count})
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
                No sub-rooms created yet for this chat.
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: palette.subtext,
                  marginTop: 4,
                }}
              >
                Long-press a message and use the “continue in sub-room” action
                to start a dedicated thread.
              </Text>
            </View>
          ) : (
            <FlatList
              data={subRooms}
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
