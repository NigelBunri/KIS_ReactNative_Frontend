// src/screens/calls/components/WaitingRoomPanel.tsx
// Shown inside the call when participants are knocking to join.
// Only the host/co-host sees this.

import React from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { KISIcon } from '@/constants/kisIcons';
import { useKISTheme } from '@/theme/useTheme';

export type KnockingUser = {
  userId: string;
  displayName: string;
  knockedAt: string;
};

type Props = {
  knockingUsers: KnockingUser[];
  onAdmit: (userId: string) => void;
  onDeny: (userId: string) => void;
};

export default function WaitingRoomPanel({ knockingUsers, onAdmit, onDeny }: Props) {
  const { palette } = useKISTheme();

  if (knockingUsers.length === 0) return null;

  return (
    <View style={[styles.container, { backgroundColor: `${palette.royalInk}F0`, borderColor: `${palette.gold}33` }]}>
      <View style={styles.header}>
        <KISIcon name="people" size={15} color={palette.gold} />
        <Text style={[styles.headerText, { color: palette.gold }]}>
          Waiting to join ({knockingUsers.length})
        </Text>
      </View>

      {knockingUsers.map((user) => (
        <KnockingUserRow
          key={user.userId}
          user={user}
          onAdmit={() => onAdmit(user.userId)}
          onDeny={() => onDeny(user.userId)}
          palette={palette}
        />
      ))}

      {knockingUsers.length > 1 && (
        <Pressable
          onPress={() => knockingUsers.forEach(u => onAdmit(u.userId))}
          style={[styles.admitAllBtn, { backgroundColor: `${palette.success}26`, borderColor: `${palette.success}60` }]}
        >
          <KISIcon name="check" size={14} color={palette.success} />
          <Text style={[styles.admitAllText, { color: palette.success }]}>Admit all</Text>
        </Pressable>
      )}
    </View>
  );
}

function KnockingUserRow({
  user, onAdmit, onDeny, palette,
}: { user: KnockingUser; onAdmit: () => void; onDeny: () => void; palette: any }) {
  const initials = user.displayName.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();

  return (
    <View style={styles.row}>
      <View style={[styles.avatar, { backgroundColor: `${palette.gold}33`, borderColor: `${palette.gold}60` }]}>
        <Text style={[styles.avatarText, { color: palette.gold }]}>{initials}</Text>
      </View>
      <Text style={[styles.name, { color: palette.ivory }]} numberOfLines={1}>
        {user.displayName}
      </Text>
      <View style={styles.btns}>
        <Pressable
          onPress={onDeny}
          style={[styles.denyBtn, { borderColor: `${palette.danger}60` }]}
          accessibilityLabel={`Deny ${user.displayName}`}
          hitSlop={6}
        >
          <KISIcon name="close" size={14} color={palette.danger} />
        </Pressable>
        <Pressable
          onPress={onAdmit}
          style={[styles.admitBtn, { backgroundColor: palette.success }]}
          accessibilityLabel={`Admit ${user.displayName}`}
          hitSlop={6}
        >
          <KISIcon name="check" size={14} color={palette.ivory} />
          <Text style={[styles.admitBtnText, { color: palette.ivory }]}>Admit</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    margin: 12,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    paddingBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerText: { fontSize: 13, fontWeight: '800', letterSpacing: 0.3 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: { fontSize: 13, fontWeight: '800' },
  name: { flex: 1, fontSize: 14, fontWeight: '600' },
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
  },
  admitBtnText: { fontSize: 13, fontWeight: '800' },
  admitAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginHorizontal: 14,
    marginTop: 4,
    borderWidth: 1.5,
    borderRadius: 20,
    paddingVertical: 9,
  },
  admitAllText: { fontSize: 13, fontWeight: '800' },
});
