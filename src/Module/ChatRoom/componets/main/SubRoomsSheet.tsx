// src/screens/chat/componets/SubRoomsSheet.tsx

import React from 'react';
import { ActionSheetIOS, Alert, Animated, Modal, Platform, View, Text, Pressable, FlatList } from 'react-native';

import { chatRoomStyles as styles } from '../../chatRoomStyles';
import { KISIcon } from '@/constants/kisIcons';
import usePullDownToClose from '@/hooks/usePullDownToClose';
import { SubRoom } from '../../chatTypes';

type SubRoomsSheetProps = {
  visible: boolean;
  onClose: () => void;
  parentRoomId: string;
  subRooms: SubRoom[];
  palette: any;
  onOpenSubRoom: (subRoom: SubRoom) => void;
  onEditThreadSubject?: (subRoom: SubRoom) => void;
};

export const SubRoomsSheet: React.FC<SubRoomsSheetProps> = ({
  visible,
  onClose,
  parentRoomId: _parentRoomId,
  subRooms,
  palette,
  onOpenSubRoom,
  onEditThreadSubject,
}) => {
  const count = subRooms.length;
  const { dragY, panHandlers } = usePullDownToClose({
    enabled: visible,
    onClose,
  });

  const renderItem = ({ item }: { item: SubRoom }) => {
    const title =
      item.title ||
      (item.rootMessageId
        ? `Thread from message ${item.rootMessageId.slice(0, 6)}…`
        : 'Sub-room');

    const handleLongPress = () => {
      if (!onEditThreadSubject) return;
      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          { options: ['Edit subject', 'Cancel'], cancelButtonIndex: 1 },
          (idx) => { if (idx === 0) onEditThreadSubject(item); },
        );
      } else {
        Alert.alert('Thread', 'Edit subject?', [
          { text: 'Edit', onPress: () => onEditThreadSubject(item) },
          { text: 'Cancel', style: 'cancel' },
        ]);
      }
    };

    const formattedTime = (() => {
      if (!item.lastAt) return '';
      const dt = new Date(item.lastAt);
      if (Number.isNaN(dt.getTime())) return '';
      return dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    })();

    return (
      <Pressable
        style={({ pressed }) => ({
          paddingVertical: 10,
          paddingHorizontal: 16,
          borderBottomWidth: 1,
          borderBottomColor: palette.divider,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          opacity: pressed ? 0.7 : 1,
        })}
        onPress={() => onOpenSubRoom(item)}
        onLongPress={handleLongPress}
      >
        {/* Avatar circle */}
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: palette.pillSubRoomBg ?? palette.surfaceSoft ?? palette.surface,
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <KISIcon name="layers" size={20} color={palette.primary} />
        </View>

        {/* Center: title + preview */}
        <View style={{ flex: 1, minWidth: 0 }}>
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
          {item.lastMessage ? (
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              style={{
                fontSize: 12,
                color: palette.subtext,
                marginTop: 2,
              }}
            >
              {item.lastMessage}
            </Text>
          ) : (
            <Text
              style={{
                fontSize: 12,
                color: palette.subtext,
                marginTop: 2,
                fontStyle: 'italic',
              }}
            >
              Tap to open
            </Text>
          )}
        </View>

        {/* Right: time + unread badge */}
        <View style={{ alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
          {formattedTime ? (
            <Text style={{ fontSize: 11, color: palette.subtext }}>
              {formattedTime}
            </Text>
          ) : null}
          {(item.unreadCount ?? 0) > 0 && (
            <View
              style={{
                minWidth: 20,
                paddingHorizontal: 5,
                height: 20,
                borderRadius: 10,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: palette.error ?? '#FF3B30',
              }}
            >
              <Text
                style={{
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: '700',
                }}
              >
                {(item.unreadCount ?? 0) > 99 ? '99+' : item.unreadCount}
              </Text>
            </View>
          )}
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

        <Animated.View
          style={[
            styles.sheetContainer,
            {
              backgroundColor: palette.card,
              borderTopColor: palette.divider,
              transform: [{ translateY: dragY }],
            },
          ]}
        >
          {/* Header */}
          <View
            {...panHandlers}
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
              <KISIcon name="close" size={20} color={palette.subtext} />
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
                Long-press a message and use the "continue in sub-room" action
                to start a dedicated thread.
              </Text>
            </View>
          ) : (
            <FlatList
              data={subRooms}
              keyExtractor={item => item.id}
              renderItem={renderItem}
              contentContainerStyle={{ paddingBottom: 24 }}
            />
          )}
        </Animated.View>
      </View>
    </Modal>
  );
};
