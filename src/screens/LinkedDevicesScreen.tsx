// src/screens/LinkedDevicesScreen.tsx
// Multi-device session management screen — lists linked devices and allows
// the user to log out individual sessions or all other devices.
// Uses REST API as primary source; falls back gracefully if socket unavailable.

import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { useSocket } from '../../SocketProvider';
import { KISIcon } from '@/constants/kisIcons';
import { getRequest } from '@/network/get';
import { deleteRequest } from '@/network/delete';
import ROUTES from '@/network';

/* -------------------------------------------------------------------------- */
/*                                   Types                                    */
/* -------------------------------------------------------------------------- */

type LinkedDevice = {
  deviceId: string;
  name: string;
  platform: string;
  lastSeen: string;
  current: boolean;
};

/* -------------------------------------------------------------------------- */
/*                               Helper: relative time                        */
/* -------------------------------------------------------------------------- */

function relativeTime(iso: string): string {
  if (!iso) return 'Unknown';
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

function normaliseDevice(raw: any): LinkedDevice {
  return {
    deviceId: String(raw.device_id ?? raw.deviceId ?? raw.id ?? ''),
    name: raw.nickname ?? raw.device_name ?? raw.name ?? raw.platform ?? 'Device',
    platform: String(raw.platform ?? 'unknown'),
    lastSeen: raw.last_seen ?? raw.last_seen_at ?? raw.lastSeen ?? '',
    current: Boolean(raw.is_current ?? raw.current ?? false),
  };
}

/* -------------------------------------------------------------------------- */
/*                                 Component                                  */
/* -------------------------------------------------------------------------- */

export default function LinkedDevicesScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { socket } = useSocket();
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();

  const [devices, setDevices] = useState<LinkedDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── REST fetch (primary) ──────────────────────────────────────────────────

  const fetchViaRest = useCallback(async (isRefresh = false): Promise<boolean> => {
    try {
      const res = await getRequest(ROUTES.auth.listDevices, {
        errorMessage: 'Unable to load devices.',
        forceNetwork: isRefresh,
      });
      if (res?.success) {
        const raw: any[] = Array.isArray(res.data?.results)
          ? res.data.results
          : Array.isArray(res.data)
          ? res.data
          : [];
        setDevices(raw.map(normaliseDevice));
        return true;
      }
    } catch {}
    return false;
  }, []);

  // ── Socket fetch (fallback) ───────────────────────────────────────────────

  const fetchViaSocket = useCallback((): Promise<boolean> => {
    return new Promise((resolve) => {
      if (!socket?.connected) { resolve(false); return; }
      const timer = setTimeout(() => resolve(false), 4000);
      socket.emit(
        'user.get_devices',
        {},
        (res: { devices?: any[]; ok?: boolean } | any[]) => {
          clearTimeout(timer);
          const list: any[] = Array.isArray(res)
            ? res
            : Array.isArray((res as any)?.devices)
            ? (res as any).devices
            : [];
          if (list.length > 0) {
            setDevices(list.map(normaliseDevice));
            resolve(true);
          } else {
            resolve(false);
          }
        },
      );
    });
  }, [socket]);

  const fetchDevices = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(null);

    const restOk = await fetchViaRest(isRefresh);
    if (!restOk) {
      // REST failed — try socket
      const socketOk = await fetchViaSocket();
      if (!socketOk) {
        // Both unavailable — show informative empty state
        setDevices([]);
        setError('Unable to load devices. Check your connection and try again.');
      }
    }

    setLoading(false);
    setRefreshing(false);
  }, [fetchViaRest, fetchViaSocket]);

  useEffect(() => { void fetchDevices(); }, [fetchDevices]);

  // ── Remove device via REST then socket ────────────────────────────────────

  const removeDevice = useCallback(async (device: LinkedDevice) => {
    setRemovingId(device.deviceId);
    try {
      const res = await deleteRequest(ROUTES.auth.revokeDevice(device.deviceId), {
        errorMessage: 'Unable to remove device.',
      });
      if (res?.success !== false) {
        await fetchDevices(true);
        setRemovingId(null);
        return;
      }
    } catch {}

    // REST failed — try socket
    if (socket?.connected) {
      socket.emit('user.remove_device', { deviceId: device.deviceId }, () => {
        setRemovingId(null);
        void fetchDevices(true);
      });
    } else {
      setRemovingId(null);
      Alert.alert('Error', 'Could not remove device. Please try again.');
    }
  }, [fetchDevices, socket]);

  const handleLogOut = (device: LinkedDevice) => {
    Alert.alert(
      'Log out device',
      `Log out ${device.name} (last active ${device.current ? 'now' : relativeTime(device.lastSeen)})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log out', style: 'destructive', onPress: () => removeDevice(device) },
      ],
    );
  };

  const handleLogOutAll = async () => {
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
          onPress: async () => {
            try {
              const res = await deleteRequest(ROUTES.auth.revokeAllSecondary, {
                errorMessage: 'Unable to revoke devices.',
              });
              // Treat 2xx (success field present & true, or absent on 204) as success
              const failed = res && typeof (res as any).success === 'boolean' && (res as any).success === false;
              if (!failed) {
                await fetchDevices(true);
                return;
              }
              const msg = (res as any).message || (res as any).data?.detail || 'Unable to log out devices.';
              Alert.alert('Failed', msg);
              return;
            } catch {}
            // Fallback: socket per-device
            others.forEach(d => socket?.emit('user.remove_device', { deviceId: d.deviceId }));
            setTimeout(() => void fetchDevices(true), 800);
          },
        },
      ],
    );
  };

  const platformIcon = (platform: string): string => {
    const p = platform.toLowerCase();
    if (p === 'web' || p === 'browser') return '💻';
    if (p === 'ios' || p === 'android') return '📱';
    return '📱';
  };

  const renderDevice = ({ item }: { item: LinkedDevice }) => {
    const isRemoving = removingId === item.deviceId;
    return (
      <View
        style={[
          styles.row,
          {
            backgroundColor: palette.surface,
            borderColor: item.current ? palette.primary + '55' : palette.divider,
          },
        ]}
      >
        <Text style={styles.icon}>{platformIcon(item.platform)}</Text>
        <View style={styles.info}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={[styles.platform, { color: palette.text }]}>
              {item.name.charAt(0).toUpperCase() + item.name.slice(1)}
            </Text>
            {item.current && (
              <View style={[styles.activeBadge, { backgroundColor: palette.success + '22' }]}>
                <Text style={[styles.activeBadgeTxt, { color: palette.success }]}>Active now</Text>
              </View>
            )}
          </View>
          <Text style={[styles.lastSeen, { color: palette.subtext }]}>
            {item.current ? 'This device' : `Last active: ${relativeTime(item.lastSeen)}`}
          </Text>
        </View>

        {!item.current && (
          <Pressable
            onPress={() => handleLogOut(item)}
            disabled={!!isRemoving}
            style={({ pressed }) => [
              styles.logoutBtn,
              {
                backgroundColor: pressed ? palette.danger + '11' : palette.surfaceSoft ?? palette.surface,
                borderColor: palette.danger,
                opacity: isRemoving ? 0.5 : 1,
              },
            ]}
          >
            <Text style={[styles.logoutTxt, { color: palette.danger }]}>
              {isRemoving ? '…' : 'Log out'}
            </Text>
          </Pressable>
        )}
      </View>
    );
  };

  const nonCurrentCount = devices.filter(d => !d.current).length;

  return (
    <View style={[styles.root, { backgroundColor: palette.bg }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 8,
            backgroundColor: palette.surface,
            borderBottomColor: palette.divider,
          },
        ]}
      >
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backBtn}>
          <KISIcon name="back" size={24} color={palette.text} />
        </Pressable>
        <View style={styles.headerTitleRow}>
          <Text style={[styles.headerTitle, { color: palette.text }]}>Linked Devices</Text>
          {devices.length > 0 && (
            <View style={[styles.countBadge, { backgroundColor: palette.primarySoft ?? palette.primary + '22' }]}>
              <Text style={[styles.countBadgeTxt, { color: palette.primary }]}>{devices.length}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Device list */}
      {loading ? (
        <View style={styles.center}>
          <Text style={[styles.emptyTxt, { color: palette.subtext }]}>Loading devices…</Text>
        </View>
      ) : (
        <FlatList
          data={devices}
          keyExtractor={item => item.deviceId}
          renderItem={renderDevice}
          contentContainerStyle={{
            padding: responsive.pageGutter,
            gap: 10,
            paddingBottom: insets.bottom + responsive.pageGutter * 3 + (nonCurrentCount > 0 ? 80 : 0),
            width: '100%',
            maxWidth: responsive.contentMaxWidth,
            alignSelf: 'center',
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); void fetchDevices(true); }}
              tintColor={palette.primaryStrong}
              colors={[palette.primaryStrong]}
            />
          }
          ListHeaderComponent={error ? (
            <View style={[styles.errorBox, { backgroundColor: palette.danger + '12', borderColor: palette.danger + '44' }]}>
              <Text style={[styles.errorTxt, { color: palette.danger }]}>{error}</Text>
              <Pressable
                onPress={() => void fetchDevices(true)}
                style={[styles.retryBtn, { borderColor: palette.danger }]}
              >
                <Text style={[styles.retryTxt, { color: palette.danger }]}>Retry</Text>
              </Pressable>
            </View>
          ) : null}
          ListEmptyComponent={!error ? (
            <View style={{ paddingVertical: 60, alignItems: 'center' }}>
              <Text style={{ color: palette.subtext, fontSize: 14 }}>No linked devices found.</Text>
              <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 4, textAlign: 'center', paddingHorizontal: 32 }}>
                Devices you log in from will appear here.
              </Text>
            </View>
          ) : null}
        />
      )}

      {/* Log out all button */}
      {!loading && nonCurrentCount > 0 && (
        <View
          style={[
            styles.footer,
            {
              paddingBottom: insets.bottom + 16,
              backgroundColor: palette.surface,
              borderTopColor: palette.divider,
            },
          ]}
        >
          <Pressable
            onPress={handleLogOutAll}
            style={({ pressed }) => [
              styles.logoutAllBtn,
              { opacity: pressed ? 0.75 : 1, borderColor: palette.danger },
            ]}
          >
            <Text style={[styles.logoutAllTxt, { color: palette.danger }]}>
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
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  backBtn: { padding: 4, minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  countBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  countBadgeTxt: { fontSize: 12, fontWeight: '800' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTxt: { fontSize: 15 },
  errorBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 10,
    marginBottom: 12,
    alignItems: 'center',
  },
  errorTxt: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  retryTxt: { fontSize: 13, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    gap: 12,
  },
  icon: { fontSize: 26 },
  info: { flex: 1, gap: 3 },
  platform: { fontSize: 15, fontWeight: '700' },
  activeBadge: { borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  activeBadgeTxt: { fontSize: 11, fontWeight: '700' },
  lastSeen: { fontSize: 12 },
  logoutBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: 'center',
  },
  logoutTxt: { fontSize: 13, fontWeight: '700' },
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
  logoutAllTxt: { fontSize: 14, fontWeight: '700' },
});
