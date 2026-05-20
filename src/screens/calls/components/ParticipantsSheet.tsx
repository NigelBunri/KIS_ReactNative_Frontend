// src/screens/calls/components/ParticipantsSheet.tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Animated,
} from 'react-native';
import { useRef, useEffect } from 'react';
import type { CallParticipant } from '@/services/calls/callTypes';
import { KISIcon } from '@/constants/kisIcons';
import NetworkQualityBars from './NetworkQualityBars';

type Props = {
  participants: CallParticipant[];
  visible: boolean;
  onClose: () => void;
  localUserId: string;
  onMute?: (userId: string) => void;
  onRemove?: (userId: string) => void;
  isHost?: boolean;
};

const ROLE_LABEL: Record<string, string> = {
  host: 'Host',
  'co-host': 'Co-host',
  speaker: 'Speaker',
  audience: 'Audience',
};

const ROLE_COLOR: Record<string, string> = {
  host: '#F59E0B',
  'co-host': '#6366F1',
  speaker: '#22C55E',
  audience: 'rgba(255,255,255,0.4)',
};

export default function ParticipantsSheet({ participants, visible, onClose, localUserId, isHost, onMute, onRemove }: Props) {
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: visible ? 1 : 0,
      duration: 280,
      useNativeDriver: true,
    }).start();
  }, [visible]);

  if (!visible) return null;

  const translateY = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [400, 0] });

  return (
    <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Participants ({participants.length})</Text>
        <Pressable onPress={onClose} style={styles.closeBtn}>
          <KISIcon name="x" size={20} color="rgba(255,255,255,0.7)" />
        </Pressable>
      </View>

      <FlatList
        data={participants}
        keyExtractor={p => p.userId}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const isLocal = item.userId === localUserId;
          return (
            <View style={styles.row}>
              {/* Avatar */}
              <View style={[styles.avatar, { backgroundColor: '#6366F1' }]}>
                <Text style={styles.avatarText}>
                  {item.displayName.charAt(0).toUpperCase()}
                </Text>
              </View>

              {/* Info */}
              <View style={styles.info}>
                <Text style={styles.name} numberOfLines={1}>
                  {isLocal ? `${item.displayName} (You)` : item.displayName}
                </Text>
                <Text style={[styles.roleLabel, { color: ROLE_COLOR[item.role] ?? '#fff' }]}>
                  {ROLE_LABEL[item.role] ?? item.role}
                </Text>
              </View>

              {/* Status icons */}
              <View style={styles.statusRow}>
                <NetworkQualityBars quality={item.networkQuality} size={13} />
                {item.handRaised && <Text style={styles.handIcon}>✋</Text>}
                <KISIcon
                  name={item.isMuted ? 'mic-off' : 'mic'}
                  size={15}
                  color={item.isMuted ? '#E52B2B' : 'rgba(255,255,255,0.5)'}
                />
                <KISIcon
                  name={item.isVideoOff ? 'video-off' : 'video'}
                  size={15}
                  color={item.isVideoOff ? '#E52B2B' : 'rgba(255,255,255,0.5)'}
                />
              </View>

              {/* Host actions */}
              {isHost && !isLocal && (
                <View style={styles.actions}>
                  {onMute && (
                    <Pressable onPress={() => onMute(item.userId)} style={styles.actionBtn}>
                      <KISIcon name={item.isMuted ? 'mic' : 'mic-off'} size={14} color="rgba(255,255,255,0.6)" />
                    </Pressable>
                  )}
                  {onRemove && (
                    <Pressable onPress={() => onRemove(item.userId)} style={styles.actionBtn}>
                      <KISIcon name="user-minus" size={14} color="#E52B2B" />
                    </Pressable>
                  )}
                </View>
              )}
            </View>
          );
        }}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '65%',
    backgroundColor: '#111128',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    zIndex: 50,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  title: { color: '#fff', fontSize: 16, fontWeight: '700' },
  closeBtn: { padding: 6 },
  list: { padding: 12, gap: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginBottom: 4,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  info: { flex: 1 },
  name: { color: '#fff', fontSize: 14, fontWeight: '600' },
  roleLabel: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  handIcon: { fontSize: 14 },
  actions: { flexDirection: 'row', gap: 6 },
  actionBtn: {
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
  },
});
