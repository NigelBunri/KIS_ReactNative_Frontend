import React, { useRef, useEffect } from 'react';
import {
  Animated,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { KISIcon } from '@/constants/kisIcons';
import type { ReadByEntry } from '../../chatTypes';

type Props = {
  visible: boolean;
  onClose: () => void;
  readBy: ReadByEntry[];
  deliveredTo?: string[];
  palette: any;
};

export const ReadReceiptsSheet: React.FC<Props> = ({
  visible,
  onClose,
  readBy,
  deliveredTo = [],
  palette,
}) => {
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 1 : 0,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  }, [visible]);

  const translateY = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [400, 0] });

  if (!visible) return null;

  const readUserIds = new Set(readBy.map((r) => r.userId));
  const unreadDelivered = deliveredTo.filter((uid) => !readUserIds.has(uid));

  const renderEntry = ({ item }: { item: ReadByEntry }) => {
    const date = new Date(item.readAt);
    const timeLabel = isNaN(date.getTime())
      ? ''
      : date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

    return (
      <View style={[styles.row, { borderBottomColor: palette.divider }]}>
        <View
          style={[
            styles.avatar,
            { backgroundColor: palette.primary + '33' },
          ]}
        >
          <Text style={[styles.avatarText, { color: palette.primary }]}>
            {(item.displayName ?? item.userId).charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: palette.text }]}>
            {item.displayName ?? item.userId}
          </Text>
          {!!timeLabel && (
            <Text style={[styles.time, { color: palette.subtext }]}>Read {timeLabel}</Text>
          )}
        </View>
        <KISIcon name="check" size={16} color={palette.readStatus ?? palette.primary} focused />
      </View>
    );
  };

  const renderDelivered = (userId: string) => (
    <View key={userId} style={[styles.row, { borderBottomColor: palette.divider }]}>
      <View style={[styles.avatar, { backgroundColor: palette.surfaceSoft ?? '#eee' }]}>
        <KISIcon name="person" size={18} color={palette.subtext} />
      </View>
      <Text style={[styles.name, { color: palette.text, flex: 1 }]}>
        {userId}
      </Text>
      <KISIcon name="check" size={16} color={palette.subtext} />
    </View>
  );

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <Animated.View
        style={[
          styles.sheet,
          {
            backgroundColor: palette.surface ?? palette.background,
            transform: [{ translateY }],
          },
        ]}
      >
        <View style={[styles.handle, { backgroundColor: palette.divider }]} />
        <View style={[styles.header, { borderBottomColor: palette.divider }]}>
          <Text style={[styles.title, { color: palette.text }]}>Message Info</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <KISIcon name="close" size={22} color={palette.text} />
          </Pressable>
        </View>

        {readBy.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: palette.subtext }]}>
              READ BY ({readBy.length})
            </Text>
            <FlatList
              data={readBy}
              keyExtractor={(r) => r.userId}
              renderItem={renderEntry}
              scrollEnabled={false}
            />
          </>
        )}

        {unreadDelivered.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: palette.subtext }]}>
              DELIVERED TO ({unreadDelivered.length})
            </Text>
            {unreadDelivered.map(renderDelivered)}
          </>
        )}

        {readBy.length === 0 && unreadDelivered.length === 0 && (
          <View style={styles.empty}>
            <KISIcon name="check" size={32} color={palette.subtext} />
            <Text style={[styles.emptyText, { color: palette.subtext }]}>
              No read data yet
            </Text>
          </View>
        )}
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '65%',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingBottom: 32,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 17, fontWeight: '700' },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: '700' },
  name: { fontSize: 15, fontWeight: '500' },
  time: { fontSize: 12, marginTop: 2 },
  empty: { alignItems: 'center', padding: 40, gap: 12 },
  emptyText: { fontSize: 14 },
});
