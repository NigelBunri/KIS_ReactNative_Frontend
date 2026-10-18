// src/screens/calls/components/AdmissionRequestSheet.tsx
// Bottom sheet listing pending link-based admission (knock) requests, for
// the call host/co-host only. Opened via the "Requests" control in
// CallControls (badge = pending count) — see ActiveCallScreen's wiring.
// Covers ~40% of device height per spec, slides up/down like the other
// InCall*Sheet components (same Animated.spring pattern as InCallQASheet).

import React, { useRef, useEffect, useState } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KISIcon } from '@/constants/kisIcons';
import { useKISTheme } from '@/theme/useTheme';
import type { KnockingUser } from '@/services/calls/callTypes';

type Props = {
  visible: boolean;
  onClose: () => void;
  knockingUsers: KnockingUser[];
  /** Resolves true only once the backend confirms — see SocketProvider's admitKnocker. */
  onAdmit: (userId: string) => Promise<boolean>;
  /** Resolves true only once the backend confirms — see SocketProvider's denyKnocker. */
  onDeny: (userId: string) => Promise<boolean>;
};

export default function AdmissionRequestSheet({ visible, onClose, knockingUsers, onAdmit, onDeny }: Props) {
  const { palette } = useKISTheme();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(500)).current;
  const [mounted, setMounted] = useState(visible);
  // Tracks which userIds have an admit/deny in flight, so a second tap on
  // the same row while its first request is still pending is a no-op
  // (disabled button) rather than firing a duplicate decision.
  const [pendingActionUserIds, setPendingActionUserIds] = useState<Set<string>>(new Set());
  // Rows that just failed stay visible (not silently removed) with a
  // visible error hint, per the "retain a consistent state" requirement.
  const [failedUserIds, setFailedUserIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (visible) setMounted(true);
    Animated.spring(slideAnim, { toValue: visible ? 0 : 500, useNativeDriver: true, tension: 60, friction: 12 })
      .start(({ finished }) => { if (finished && !visible) setMounted(false); });
  }, [visible]);

  if (!mounted) return null;

  const runAction = async (userId: string, action: 'admit' | 'deny') => {
    if (pendingActionUserIds.has(userId)) return; // already in flight — ignore repeat taps
    setPendingActionUserIds(prev => new Set(prev).add(userId));
    setFailedUserIds(prev => {
      if (!prev.has(userId)) return prev;
      const next = new Set(prev);
      next.delete(userId);
      return next;
    });
    const ok = await (action === 'admit' ? onAdmit(userId) : onDeny(userId));
    setPendingActionUserIds(prev => {
      const next = new Set(prev);
      next.delete(userId);
      return next;
    });
    if (!ok) {
      setFailedUserIds(prev => new Set(prev).add(userId));
    }
  };

  return (
    <Animated.View
      style={[
        styles.sheet,
        { backgroundColor: palette.royalInk, borderTopColor: `${palette.gold}33`, transform: [{ translateY: slideAnim }] },
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: palette.ivory }]}>
          Admission requests{knockingUsers.length > 0 ? ` (${knockingUsers.length})` : ''}
        </Text>
        <Pressable
          onPress={onClose}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Close admission requests"
        >
          <KISIcon name="close" size={20} color={palette.subtext} />
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={{ gap: 10, padding: 14, paddingBottom: Math.max(insets.bottom, 16) }}>
        {knockingUsers.length === 0 && (
          <View style={{ alignItems: 'center', paddingVertical: 32 }}>
            <KISIcon name="shield" size={32} color={palette.subtext} />
            <Text style={[styles.emptyText, { color: palette.subtext }]}>No one is waiting to join</Text>
          </View>
        )}

        {knockingUsers.map((user) => {
          const isPending = pendingActionUserIds.has(user.userId);
          const failed = failedUserIds.has(user.userId);
          const initials = user.displayName.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';

          return (
            <View
              key={user.userId}
              style={[
                styles.row,
                { backgroundColor: palette.surface, borderColor: failed ? `${palette.danger}60` : palette.inputBorder },
              ]}
            >
              <View style={[styles.avatar, { backgroundColor: `${palette.gold}33`, borderColor: `${palette.gold}60` }]}>
                <Text style={[styles.avatarText, { color: palette.gold }]}>{initials}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: palette.ivory }]} numberOfLines={1}>{user.displayName}</Text>
                {failed && (
                  <Text style={[styles.errorText, { color: palette.danger }]}>Couldn't update — try again</Text>
                )}
              </View>
              <View style={styles.btns}>
                <Pressable
                  onPress={() => void runAction(user.userId, 'deny')}
                  disabled={isPending}
                  style={[styles.denyBtn, { borderColor: `${palette.danger}60`, opacity: isPending ? 0.5 : 1 }]}
                  accessibilityLabel={`Decline ${user.displayName}`}
                  accessibilityRole="button"
                  hitSlop={6}
                >
                  <KISIcon name="close" size={14} color={palette.danger} />
                </Pressable>
                <Pressable
                  onPress={() => void runAction(user.userId, 'admit')}
                  disabled={isPending}
                  style={[styles.admitBtn, { backgroundColor: palette.success, opacity: isPending ? 0.5 : 1 }]}
                  accessibilityLabel={`Admit ${user.displayName}`}
                  accessibilityRole="button"
                  hitSlop={6}
                >
                  <KISIcon name="check" size={14} color={palette.ivory} />
                  <Text style={[styles.admitBtnText, { color: palette.ivory }]}>{isPending ? '…' : 'Admit'}</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: '40%',
    borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, zIndex: 50,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  title: { fontSize: 17, fontWeight: '900' },
  scroll: { flex: 1 },
  emptyText: { fontSize: 14, marginTop: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: { fontSize: 13, fontWeight: '800' },
  name: { fontSize: 14, fontWeight: '600' },
  errorText: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  btns: { flexDirection: 'row', gap: 8 },
  denyBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  admitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 17,
    minWidth: 68,
    justifyContent: 'center',
  },
  admitBtnText: { fontSize: 13, fontWeight: '800' },
});
