// src/screens/LinkedDevicesScreen.tsx
// Multi-device session management screen — lists linked devices and allows
// the user to log out individual sessions or all other devices.

import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useKISTheme } from '@/theme/useTheme';
import { useSocket } from '../../SocketProvider';
import { KISIcon } from '@/constants/kisIcons';

/* -------------------------------------------------------------------------- */
/*                                   Types                                    */
/* -------------------------------------------------------------------------- */

type LinkedDevice = {
  deviceId: string;
  platform: string;    // e.g. 'ios', 'android', 'web'
  lastSeen: string;    // ISO datetime
  current: boolean;    // is this the device the user is currently on
};

/* -------------------------------------------------------------------------- */
/*                               Helper: relative time                        */
/* -------------------------------------------------------------------------- */

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return 'Just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

/* -------------------------------------------------------------------------- */
/*                                 Component                                  */
/* -------------------------------------------------------------------------- */

export default function LinkedDevicesScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { socket } = useSocket();
  const { palette } = useKISTheme();

  const [devices, setDevices] = useState<LinkedDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const fetchDevices = useCallback(() => {
    if (!socket) {
      setLoading(false);
      return;
    }
    setLoading(true);
    socket.emit(
      'user.get_devices',
      {},
      (res: { devices?: LinkedDevice[]; ok?: boolean } | LinkedDevice[]) => {
        const list: LinkedDevice[] = Array.isArray(res)
          ? res
          : Array.isArray((res as any)?.devices)
          ? (res as any).devices
          : [];
        setDevices(list);
        setLoading(false);
      },
    );
  }, [socket]);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  const handleLogOut = (device: LinkedDevice) => {
    Alert.alert(
      'Log out device',
      `Log out the ${device.platform} device that was last active ${relativeTime(device.lastSeen)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log out',
          style: 'destructive',
          onPress: () => {
            setRemovingId(device.deviceId);
            socket?.emit(
              'user.remove_device',
              { deviceId: device.deviceId },
              () => {
                setRemovingId(null);
                fetchDevices();
              },
            );
          },
        },
      ],
    );
  };

  const handleLogOutAll = () => {
    const others = devices.filter(d => !d.current);
    if (!others.length) {
      Alert.alert('No other devices', 'You have no other active sessions.');
      return;
    }
    Alert.alert(
      'Log out all other devices',
      `This will end ${others.length} other session${others.length === 1 ? '' : 's'}. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log out all',
          style: 'destructive',
          onPress: () => {
            others.forEach(d => {
              socket?.emit('user.remove_device', { deviceId: d.deviceId });
            });
            setTimeout(fetchDevices, 800);
          },
        },
      ],
    );
  };

  const platformIcon = (platform: string): string => {
    const p = platform.toLowerCase();
    if (p === 'web' || p === 'browser') return '💻';
    return '📱';
  };

  const renderDevice = ({ item }: { item: LinkedDevice }) => {
    const isRemoving = removingId === item.deviceId;
    return (
      <View
        style={[
          styles.row,
          {
            backgroundColor: palette.surface ?? '#fff',
            borderColor: item.current
              ? (palette.primary ?? '#C9A227') + '55'
              : (palette.divider ?? '#e5e5e5'),
          },
        ]}
      >
        <Text style={styles.icon}>{platformIcon(item.platform)}</Text>
        <View style={styles.info}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={[styles.platform, { color: palette.text ?? '#111' }]}>
              {item.platform.charAt(0).toUpperCase() + item.platform.slice(1)}
            </Text>
            {item.current && (
              <View style={[styles.activeBadge, { backgroundColor: (palette.success ?? '#22C55E') + '22' }]}>
                <Text style={[styles.activeBadgeTxt, { color: palette.success ?? '#22C55E' }]}>
                  Active now
                </Text>
              </View>
            )}
          </View>
          <Text style={[styles.lastSeen, { color: palette.subtext ?? '#888' }]}>
            Last active: {item.current ? 'This device' : relativeTime(item.lastSeen)}
          </Text>
        </View>

        {!item.current && (
          <Pressable
            onPress={() => handleLogOut(item)}
            disabled={!!isRemoving}
            style={({ pressed }) => [
              styles.logoutBtn,
              {
                backgroundColor: pressed ? '#DC262611' : (palette.surfaceSoft ?? '#f5f5f5'),
                borderColor: palette.danger ?? '#DC2626',
                opacity: isRemoving ? 0.5 : 1,
              },
            ]}
          >
            <Text style={[styles.logoutTxt, { color: palette.danger ?? '#DC2626' }]}>
              {isRemoving ? '…' : 'Log out'}
            </Text>
          </Pressable>
        )}
      </View>
    );
  };

  const nonCurrentCount = devices.filter(d => !d.current).length;

  return (
    <View style={[styles.root, { backgroundColor: palette.bg ?? '#f9f9f9' }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 8,
            backgroundColor: palette.surface ?? '#fff',
            borderBottomColor: palette.divider ?? '#e5e5e5',
          },
        ]}
      >
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backBtn}>
          <KISIcon name="back" size={24} color={palette.text ?? '#111'} />
        </Pressable>
        <View style={styles.headerTitleRow}>
          <Text style={[styles.headerTitle, { color: palette.text ?? '#111' }]}>
            Linked Devices
          </Text>
          {devices.length > 0 && (
            <View style={[styles.countBadge, { backgroundColor: palette.primarySoft ?? '#C9A22722' }]}>
              <Text style={[styles.countBadgeTxt, { color: palette.primary ?? '#C9A227' }]}>
                {devices.length}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Device list */}
      {loading ? (
        <View style={styles.center}>
          <Text style={[styles.emptyTxt, { color: palette.subtext ?? '#888' }]}>Loading devices…</Text>
        </View>
      ) : devices.length === 0 ? (
        <View style={styles.center}>
          <Text style={[styles.emptyTxt, { color: palette.subtext ?? '#888' }]}>No linked devices found.</Text>
        </View>
      ) : (
        <FlatList
          data={devices}
          keyExtractor={item => item.deviceId}
          renderItem={renderDevice}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: insets.bottom + 80 }}
          ItemSeparatorComponent={() => <View style={{ height: 0 }} />}
        />
      )}

      {/* Log out all button */}
      {!loading && nonCurrentCount > 0 && (
        <View
          style={[
            styles.footer,
            {
              paddingBottom: insets.bottom + 16,
              backgroundColor: palette.surface ?? '#fff',
              borderTopColor: palette.divider ?? '#e5e5e5',
            },
          ]}
        >
          <Pressable
            onPress={handleLogOutAll}
            style={({ pressed }) => [
              styles.logoutAllBtn,
              { opacity: pressed ? 0.75 : 1, borderColor: palette.danger ?? '#DC2626' },
            ]}
          >
            <Text style={[styles.logoutAllTxt, { color: palette.danger ?? '#DC2626' }]}>
              Log out all other devices ({nonCurrentCount})
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  Styles                                    */
/* -------------------------------------------------------------------------- */

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  backBtn: {
    padding: 4,
  },
  headerTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  countBadge: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  countBadgeTxt: {
    fontSize: 12,
    fontWeight: '800',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTxt: {
    fontSize: 15,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    gap: 12,
  },
  icon: {
    fontSize: 26,
  },
  info: {
    flex: 1,
    gap: 3,
  },
  platform: {
    fontSize: 15,
    fontWeight: '700',
  },
  activeBadge: {
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  activeBadgeTxt: {
    fontSize: 11,
    fontWeight: '700',
  },
  lastSeen: {
    fontSize: 12,
  },
  logoutBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  logoutTxt: {
    fontSize: 13,
    fontWeight: '700',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  logoutAllBtn: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  logoutAllTxt: {
    fontSize: 14,
    fontWeight: '700',
  },
});
