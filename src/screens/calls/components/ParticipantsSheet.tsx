// src/screens/calls/components/ParticipantsSheet.tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Animated,
  Alert,
} from 'react-native';
import { useRef, useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { CallParticipant } from '@/services/calls/callTypes';
import { KISIcon } from '@/constants/kisIcons';
import NetworkQualityBars from './NetworkQualityBars';
import { useKISTheme } from '@/theme/useTheme';

type Props = {
  participants: CallParticipant[];
  visible: boolean;
  onClose: () => void;
  localUserId: string;
  onMute?: (userId: string) => void;
  onRemove?: (userId: string) => void;
  onAddParticipant?: () => void;
  isHost?: boolean;
};

const ROLE_LABEL: Record<string, string> = {
  host: 'Host',
  'co-host': 'Co-host',
  speaker: 'Speaker',
  audience: 'Audience',
};

const buildRoleColor = (p: any): Record<string, string> => ({
  host: p.primary,
  'co-host': p.goldMuted ?? p.gold,
  speaker: p.success,
  audience: 'rgba(255,255,255,0.4)',
});

export default function ParticipantsSheet({ participants, visible, onClose, localUserId, isHost, onMute, onRemove, onAddParticipant }: Props) {
  const { palette } = useKISTheme();
  const insets = useSafeAreaInsets();
  const ROLE_COLOR = buildRoleColor(palette);
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Track mounted state so we can defer unmounting until the slide-out animation finishes.
  const [mounted, setMounted] = React.useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
    }
    Animated.timing(slideAnim, {
      toValue: visible ? 1 : 0,
      duration: 280,
      useNativeDriver: true,
    }).start(({ finished }) => {
      // Unmount only after slide-out fully completes
      if (finished && !visible) setMounted(false);
    });
  }, [visible]);

  if (!mounted) return null;

  const translateY = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [400, 0] });

  return (
    <Animated.View style={[styles.sheet, { backgroundColor: palette.royalInk, borderTopColor: `${palette.gold}33`, transform: [{ translateY }] }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: palette.ivory }]}>Participants ({participants.length})</Text>
        <View style={styles.headerActions}>
          {isHost && (
            <Pressable
              onPress={() => {
                if (onAddParticipant) {
                  onAddParticipant();
                } else {
                  Alert.alert('Coming soon', 'Adding participants to an active call is not available yet.');
                }
              }}
              style={styles.closeBtn}
              accessibilityLabel="Add participant"
              accessibilityRole="button"
              hitSlop={8}
            >
              <KISIcon name="user-plus" size={20} color={palette.gold} />
            </Pressable>
          )}
          <Pressable
            onPress={onClose}
            style={styles.closeBtn}
            accessibilityLabel="Close participants list"
            accessibilityRole="button"
            hitSlop={8}
          >
            <KISIcon name="close" size={20} color={palette.subtext} />
          </Pressable>
        </View>
      </View>

      <FlatList
        data={participants}
        keyExtractor={p => p.userId}
        contentContainerStyle={[styles.list, { paddingBottom: Math.max(insets.bottom, 12) }]}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 48 }}>
            <Text style={{ color: palette.subtext, fontSize: 14, textAlign: 'center' }}>
              No participants
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const isLocal = item.userId === localUserId;
          return (
            <View style={styles.row}>
              {/* Avatar */}
              <View style={[styles.avatar, { backgroundColor: palette.gold }]}>
                <Text style={[styles.avatarText, { color: palette.royalInk }]}>
                  {item.displayName.charAt(0).toUpperCase()}
                </Text>
              </View>

              {/* Info */}
              <View style={styles.info}>
                <Text style={[styles.name, { color: palette.ivory }]} numberOfLines={1}>
                  {isLocal ? `${item.displayName} (You)` : item.displayName}
                </Text>
                <Text style={[styles.roleLabel, { color: ROLE_COLOR[item.role] ?? palette.ivory }]}>
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
                  color={item.isMuted ? palette.danger : palette.subtext}
                />
                <KISIcon
                  name={item.isVideoOff ? 'video-off' : 'video'}
                  size={15}
                  color={item.isVideoOff ? palette.danger : palette.subtext}
                />
              </View>

              {/* Host actions */}
              {isHost && !isLocal && (
                <View style={styles.actions}>
                  {onMute && (
                    <Pressable
                      onPress={() => onMute(item.userId)}
                      style={styles.actionBtn}
                      accessibilityLabel={item.isMuted ? `Unmute ${item.displayName}` : `Mute ${item.displayName}`}
                      accessibilityRole="button"
                      hitSlop={6}
                    >
                      <KISIcon name={item.isMuted ? 'mic' : 'mic-off'} size={16} color={palette.subtext} />
                    </Pressable>
                  )}
                  {onRemove && (
                    <Pressable
                      onPress={() => onRemove(item.userId)}
                      style={styles.actionBtn}
                      accessibilityLabel={`Remove ${item.displayName}`}
                      accessibilityRole="button"
                      hitSlop={6}
                    >
                      <KISIcon name="user-minus" size={16} color={palette.danger} />
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
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
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
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  title: { fontSize: 16, fontWeight: '700' },
  closeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
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
  avatarText: { fontSize: 15, fontWeight: '800' },
  info: { flex: 1 },
  name: { fontSize: 14, fontWeight: '600' },
  roleLabel: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  handIcon: { fontSize: 14 },
  actions: { flexDirection: 'row', gap: 6 },
  actionBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
  },
});
