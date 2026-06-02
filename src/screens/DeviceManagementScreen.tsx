import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import QRCode from 'react-native-qrcode-svg';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { deleteRequest } from '@/network/delete';
import { patchRequest } from '@/network/patch';
import ROUTES from '@/network';

type Device = {
  id: string;
  device_name?: string;
  nickname?: string;
  platform?: string;
  last_seen?: string;
  is_current?: boolean;
  is_parent?: boolean;
  linked_via_qr?: boolean;
  trusted_until?: string;
  parent_device_name?: string;
};

type QRData = {
  qr_payload: string;
  expires_at: string;
  nonce: string;
};

const formatLastSeen = (value?: string) => {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
};

const secondsUntil = (iso: string) => {
  const diff = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.floor(diff / 1000));
};

const formatCountdown = (secs: number) => {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
};

export default function DeviceManagementScreen() {
  const { palette } = useKISTheme();
  const navigation = useNavigation();

  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // QR state (for parent device)
  const [qrData, setQRData] = useState<QRData | null>(null);
  const [qrLoading, setQRLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Rename state
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Transfer parent state
  const [transferring, setTransferring] = useState(false);

  const currentDevice = useMemo(() => devices.find(d => d.is_current), [devices]);
  const isParent = currentDevice?.is_parent ?? false;

  const styles = useMemo(() => createStyles(), []);

  const loadDevices = useCallback(async () => {
    setError(null);
    try {
      const res = await getRequest(ROUTES.auth.listDevices, { errorMessage: 'Unable to load devices.', forceNetwork: true });
      const list: Device[] = Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res?.data?.results)
        ? res.data.results
        : Array.isArray(res)
        ? res
        : [];
      setDevices(list);
    } catch (err: any) {
      setError(err?.message || 'Unable to load devices.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void loadDevices(); }, [loadDevices]);

  /* ---------- QR generation (parent only) ---------- */
  const loadQR = useCallback(async () => {
    setQRLoading(true);
    try {
      const res = await getRequest(ROUTES.auth.deviceQRGenerate, { errorMessage: 'Unable to generate QR code.' });
      const data = (res as unknown) as QRData;
      if (data?.qr_payload) {
        setQRData(data);
        setCountdown(secondsUntil(data.expires_at));
      }
    } catch { /* silent */ } finally {
      setQRLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isParent) return;
    void loadQR();
  }, [isParent, loadQR]);

  // Tick countdown
  useEffect(() => {
    if (!qrData) return;
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current!);
          void loadQR(); // auto-refresh when expired
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [qrData, loadQR]);

  const copyQRToken = useCallback(() => {
    if (!qrData?.qr_payload) return;
    Clipboard.setString(qrData.qr_payload);
    Alert.alert('Copied', 'One-time device link token copied.');
  }, [qrData]);

  const shareQRToken = useCallback(() => {
    if (!qrData?.qr_payload) return;
    void Share.share({ message: qrData.qr_payload });
  }, [qrData]);

  /* ---------- Actions ---------- */
  const handleRevoke = useCallback((device: Device) => {
    const label = device.nickname || device.device_name || device.platform || 'this device';
    Alert.alert('Remove device', `Remove "${label}" from your account?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setRevokingId(device.id);
          try {
            await deleteRequest(ROUTES.auth.revokeDevice(device.id), { errorMessage: 'Unable to remove device.' });
            await loadDevices();
          } catch (err: any) {
            Alert.alert('Failed', err?.message ?? 'Unable to remove device.');
          } finally {
            setRevokingId(null);
          }
        },
      },
    ]);
  }, [loadDevices]);

  const handleRevokeAll = useCallback(() => {
    Alert.alert(
      'Log out all secondary devices',
      'This will immediately log out all secondary devices. Your primary device stays logged in.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log out all',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await deleteRequest(ROUTES.auth.revokeAllSecondary, { errorMessage: 'Unable to revoke devices.' });
              const count = (res as any)?.revoked_count ?? 0;
              Alert.alert('Done', `${count} device${count === 1 ? '' : 's'} logged out.`);
              await loadDevices();
            } catch (err: any) {
              Alert.alert('Failed', err?.message ?? 'Unable to revoke devices.');
            }
          },
        },
      ],
    );
  }, [loadDevices]);

  const handleRename = useCallback(async (device: Device) => {
    if (!renameValue.trim()) return;
    try {
      await patchRequest(ROUTES.auth.renameDevice(device.id), { nickname: renameValue.trim() });
      setRenamingId(null);
      setRenameValue('');
      await loadDevices();
    } catch (err: any) {
      Alert.alert('Failed', err?.message ?? 'Unable to rename device.');
    }
  }, [renameValue, loadDevices]);

  const handleTransferParent = useCallback((targetDevice: Device) => {
    const label = targetDevice.nickname || targetDevice.device_name || 'the selected device';
    Alert.alert(
      'Transfer primary role',
      `Make "${label}" the new primary device?\n\nThis device will become a secondary device. A confirmation email will be sent.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Transfer',
          style: 'destructive',
          onPress: async () => {
            setTransferring(true);
            try {
              await postRequest(
                ROUTES.auth.transferParentDevice,
                { target_device_id: targetDevice.id },
                { errorMessage: 'Unable to transfer primary role.' },
              );
              Alert.alert('Done', 'Primary device role transferred. Check your email for confirmation.');
              await loadDevices();
            } catch (err: any) {
              Alert.alert('Failed', err?.message ?? 'Unable to transfer primary role.');
            } finally {
              setTransferring(false);
            }
          },
        },
      ],
    );
  }, [loadDevices]);

  /* ---------- Render ---------- */
  const renderDevice = ({ item }: { item: Device }) => {
    const label = item.nickname || item.device_name || item.platform || 'Unknown device';
    const isRevoking = revokingId === item.id;
    const isRenaming = renamingId === item.id;

    return (
      <View style={[styles.deviceRow, { backgroundColor: palette.surface, borderColor: item.is_parent ? palette.primary : item.is_current ? palette.primarySoft ?? palette.border : palette.divider }]}>
        <View style={[styles.deviceIcon, { backgroundColor: palette.surfaceElevated ?? palette.surface }]}>
          <KISIcon
            name={item.platform === 'ios' || item.platform === 'android' ? 'phone-portrait' : 'desktop'}
            size={20}
            color={item.is_parent ? palette.primary : palette.subtext}
          />
        </View>

        <View style={{ flex: 1, gap: 4 }}>
          <View style={styles.deviceNameRow}>
            {item.is_parent && (
              <View style={[styles.badge, { backgroundColor: palette.primary }]}>
                <Text style={styles.badgeText}>PRIMARY</Text>
              </View>
            )}
            {item.is_current && !item.is_parent && (
              <View style={[styles.badge, { backgroundColor: palette.primarySoft ?? '#EEF2FF' }]}>
                <Text style={[styles.badgeText, { color: palette.primary }]}>THIS DEVICE</Text>
              </View>
            )}
            {item.linked_via_qr && (
              <View style={[styles.badge, { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.divider }]}>
                <Text style={[styles.badgeText, { color: palette.subtext }]}>QR LINKED</Text>
              </View>
            )}
          </View>

          {isRenaming ? (
            <View style={styles.renameRow}>
              <TextInput
                style={[styles.renameInput, { backgroundColor: palette.bg, borderColor: palette.primary, color: palette.text }]}
                value={renameValue}
                onChangeText={setRenameValue}
                placeholder="Device nickname"
                placeholderTextColor={palette.subtext}
                autoFocus
                maxLength={100}
              />
              <Pressable style={[styles.smallBtn, { backgroundColor: palette.primary }]} onPress={() => handleRename(item)}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>Save</Text>
              </Pressable>
              <Pressable style={[styles.smallBtn, { backgroundColor: palette.surface, borderColor: palette.border, borderWidth: 1 }]} onPress={() => setRenamingId(null)}>
                <Text style={{ color: palette.subtext, fontWeight: '700', fontSize: 12 }}>Cancel</Text>
              </Pressable>
            </View>
          ) : (
            <Text style={[styles.deviceName, { color: palette.text }]} numberOfLines={1}>{label}</Text>
          )}

          <Text style={[styles.deviceMeta, { color: palette.subtext }]}>
            {item.platform ? `${item.platform.charAt(0).toUpperCase() + item.platform.slice(1)} · ` : ''}
            Last seen: {formatLastSeen(item.last_seen)}
          </Text>
          {item.trusted_until && (
            <Text style={[styles.deviceMeta, { color: palette.subtext }]}>
              Trust expires: {formatLastSeen(item.trusted_until)}
            </Text>
          )}
        </View>

        <View style={styles.actionCol}>
          {/* Rename */}
          {!isRenaming && (
            <Pressable
              style={styles.iconBtn}
              onPress={() => { setRenamingId(item.id); setRenameValue(item.nickname || item.device_name || ''); }}
            >
              <KISIcon name="edit" size={16} color={palette.subtext} />
            </Pressable>
          )}

          {/* Transfer parent to this device (visible on non-parent secondary devices, for the current parent device user) */}
          {isParent && !item.is_current && !item.is_parent && (
            <Pressable
              style={styles.iconBtn}
              onPress={() => { handleTransferParent(item); }}
              disabled={transferring}
            >
              <KISIcon name="arrow-left" size={16} color={palette.primary} style={{ transform: [{ rotate: '180deg' }] }} />
            </Pressable>
          )}

          {/* Revoke (non-current devices, or parent revoking secondary) */}
          {!item.is_current && (
            <Pressable
              style={[styles.smallBtn, { borderColor: '#EF4444', borderWidth: 1.5 }]}
              onPress={() => handleRevoke(item)}
              disabled={isRevoking}
            >
              {isRevoking ? (
                <ActivityIndicator size="small" color="#EF4444" />
              ) : (
                <Text style={{ color: '#EF4444', fontSize: 12, fontWeight: '700' }}>Remove</Text>
              )}
            </Pressable>
          )}
        </View>
      </View>
    );
  };

  const secondaryDevices = useMemo(() => devices.filter(d => !d.is_parent), [devices]);
  const hasSecondary = secondaryDevices.length > 0;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: palette.bg }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: palette.divider }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <KISIcon name="arrow-left" size={22} color={palette.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: palette.text }]}>Manage Devices</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={devices}
        keyExtractor={item => String(item.id)}
        renderItem={renderDevice}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void loadDevices(); }} tintColor={palette.primary} />
        }
        ListHeaderComponent={
          <>
            {/* ── QR Panel (parent device only) ─────────────────────── */}
            {isParent && (
              <View style={[styles.qrPanel, { backgroundColor: palette.card, borderColor: palette.primary }]}>
                <View style={styles.qrPanelHeader}>
                  <KISIcon name="lock" size={18} color={palette.primary} />
                  <Text style={[styles.qrPanelTitle, { color: palette.text }]}>
                    Link a new device
                  </Text>
                </View>
                <Text style={[styles.qrPanelSub, { color: palette.subtext }]}>
                  On the new device, open KIS → Login → "Log in as secondary device", then scan this code. The code rotates every 3 hours and is single-use.
                </Text>

                {qrLoading ? (
                  <View style={styles.qrPlaceholder}>
                    <ActivityIndicator color={palette.primary} size="large" />
                  </View>
                ) : qrData ? (
                  <>
                    <View style={[styles.qrWrap, { backgroundColor: '#fff' }]}>
                      {/* QR code content is never displayed as text — only as a visual QR */}
                      <QRCode
                        value={qrData.qr_payload}
                        size={200}
                        backgroundColor="#fff"
                        color="#000"
                      />
                    </View>
                    <View style={styles.countdownRow}>
                      <KISIcon name="bell" size={12} color={countdown < 300 ? '#EF4444' : palette.subtext} />
                      <Text style={[styles.countdownText, { color: countdown < 300 ? '#EF4444' : palette.subtext }]}>
                        Expires in {formatCountdown(countdown)}
                      </Text>
                      <Pressable onPress={loadQR} style={styles.refreshQRBtn}>
                        <Text style={[styles.refreshQRText, { color: palette.primary }]}>Refresh</Text>
                      </Pressable>
                    </View>
                    <View style={styles.tokenActionRow}>
                      <Pressable onPress={copyQRToken} style={[styles.tokenActionBtn, { borderColor: palette.divider }]}>
                        <Text style={[styles.tokenActionText, { color: palette.primary }]}>Copy token</Text>
                      </Pressable>
                      <Pressable onPress={shareQRToken} style={[styles.tokenActionBtn, { borderColor: palette.divider }]}>
                        <Text style={[styles.tokenActionText, { color: palette.primary }]}>Share token</Text>
                      </Pressable>
                    </View>
                  </>
                ) : (
                  <View style={styles.qrPlaceholder}>
                    <Text style={{ color: palette.subtext, fontWeight: '600' }}>QR code unavailable</Text>
                    <Pressable onPress={loadQR}>
                      <Text style={{ color: palette.primary, fontWeight: '700', marginTop: 8 }}>Retry</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            )}

            {/* ── Revoke all secondary button ────────────────────────── */}
            {isParent && hasSecondary && (
              <Pressable
                style={[styles.revokeAllBtn, { borderColor: '#EF4444' }]}
                onPress={handleRevokeAll}
              >
                <KISIcon name="warning" size={16} color="#EF4444" />
                <Text style={{ color: '#EF4444', fontWeight: '700', fontSize: 14 }}>
                  Log out all secondary devices
                </Text>
              </Pressable>
            )}

            {/* ── Not parent info ────────────────────────────────────── */}
            {!isParent && currentDevice && (
              <View style={[styles.infoBox, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
                <KISIcon name="info" size={16} color={palette.subtext} />
                <Text style={[styles.infoBoxText, { color: palette.subtext }]}>
                  This is a secondary device. To add more devices or manage others, use your primary device.
                  {currentDevice.parent_device_name ? ` Primary: ${currentDevice.parent_device_name}` : ''}
                </Text>
              </View>
            )}

            <Text style={[styles.sectionLabel, { color: palette.subtext }]}>
              {devices.length} device{devices.length === 1 ? '' : 's'}
            </Text>
          </>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.centered}>
              <ActivityIndicator color={palette.primary} />
            </View>
          ) : error ? (
            <View style={styles.centered}>
              <Text style={{ color: '#EF4444', fontWeight: '600', textAlign: 'center' }}>{error}</Text>
              <Pressable onPress={() => { setLoading(true); void loadDevices(); }}>
                <Text style={{ color: palette.primary, fontWeight: '700', marginTop: 12 }}>Retry</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.centered}>
              <Text style={{ color: palette.subtext, fontWeight: '500' }}>No devices found.</Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

const createStyles = () =>
  StyleSheet.create({
    root: { flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 17, fontWeight: '700' },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },

    /* QR panel */
    qrPanel: {
      borderRadius: 18,
      borderWidth: 2,
      padding: 18,
      gap: 12,
      marginBottom: 12,
    },
    qrPanelHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    qrPanelTitle: { fontSize: 16, fontWeight: '800' },
    qrPanelSub: { fontSize: 13, fontWeight: '500', lineHeight: 20 },
    qrWrap: {
      alignSelf: 'center',
      borderRadius: 16,
      padding: 16,
    },
    qrPlaceholder: {
      width: 232,
      height: 232,
      alignSelf: 'center',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 16,
      backgroundColor: '#F5F5F5',
    },
    countdownRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    countdownText: { fontSize: 13, fontWeight: '700' },
    refreshQRBtn: { marginLeft: 8, paddingVertical: 2, paddingHorizontal: 8 },
    refreshQRText: { fontSize: 13, fontWeight: '700', textDecorationLine: 'underline' },
    tokenActionRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 10 },
    tokenActionBtn: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
    tokenActionText: { fontSize: 13, fontWeight: '800' },

    /* Revoke all */
    revokeAllBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderWidth: 1.5,
      borderRadius: 14,
      paddingVertical: 12,
      marginBottom: 8,
    },

    /* Info box (secondary device) */
    infoBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      borderRadius: 14,
      borderWidth: 1,
      padding: 14,
      marginBottom: 8,
    },
    infoBoxText: { flex: 1, fontSize: 13, fontWeight: '500', lineHeight: 20 },

    sectionLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },

    /* Device row */
    deviceRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      borderRadius: 18,
      borderWidth: 1.5,
      padding: 14,
    },
    deviceIcon: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    deviceNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
    badge: {
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    badgeText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
    deviceName: { fontSize: 15, fontWeight: '700' },
    deviceMeta: { fontSize: 12, fontWeight: '500' },

    actionCol: { alignItems: 'flex-end', gap: 8, justifyContent: 'center' },
    iconBtn: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    smallBtn: {
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 6,
      alignItems: 'center',
    },

    /* Rename row */
    renameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
    renameInput: {
      flex: 1,
      minWidth: 120,
      borderRadius: 10,
      borderWidth: 1.5,
      padding: 8,
      fontSize: 13,
    },
  });
