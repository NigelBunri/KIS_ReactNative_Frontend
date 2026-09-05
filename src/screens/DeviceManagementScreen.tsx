import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import QRCode from 'react-native-qrcode-svg';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { deleteRequest } from '@/network/delete';
import { patchRequest } from '@/network/patch';
import ROUTES from '@/network';

type Device = {
  id: string;
  device_id?: string;
  name?: string;
  device_name?: string;
  nickname?: string;
  platform?: string;
  last_seen?: string;
  last_seen_at?: string;
  current?: boolean;
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

type WebPairingData = {
  code: string;
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
  const responsive = useResponsiveLayout();

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
  // Generate is not idempotent — each call deletes any unused prior code and
  // mints a new one. Tracks which call is the latest so an out-of-order
  // response (e.g. a slow first call resolving after a later one already
  // invalidated it) never overwrites the screen with an already-dead code.
  const qrRequestIdRef = useRef(0);

  // Web/Mobile tab + web pairing state (for parent device)
  const [activeTab, setActiveTab] = useState<'mobile' | 'web'>('mobile');
  const [webPairing, setWebPairing] = useState<WebPairingData | null>(null);
  const [webPairingLoading, setWebPairingLoading] = useState(false);
  const [webCountdown, setWebCountdown] = useState(0);
  const webCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const webPairingRequestIdRef = useRef(0);

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
      const rawList: Device[] = Array.isArray(res?.data?.devices)
        ? res.data.devices
        : Array.isArray(res?.devices)
        ? res.devices
        : Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res?.data?.results)
        ? res.data.results
        : Array.isArray(res)
        ? res
        : [];
      const list = rawList.map(device => ({
        ...device,
        id: String(device.device_id ?? device.id),
        device_name: device.device_name ?? device.name,
        is_current: Boolean(device.is_current ?? device.current),
        last_seen: device.last_seen ?? device.last_seen_at,
      }));
      setDevices(list);
    } catch (err: any) {
      setError(err?.message || 'Unable to load devices.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void loadDevices(); }, [loadDevices]);

  useFocusEffect(
    useCallback(() => {
      void loadDevices();
    }, [loadDevices]),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void loadDevices();
    });
    return () => subscription.remove();
  }, [loadDevices]);

  useEffect(() => {
    if (!isParent) return;
    const timer = setInterval(() => {
      void loadDevices();
    }, 8000);
    return () => clearInterval(timer);
  }, [isParent, loadDevices]);

  /* ---------- QR generation (parent only) ---------- */
  const loadQR = useCallback(async () => {
    const requestId = ++qrRequestIdRef.current;
    setQRLoading(true);
    try {
      const res = await getRequest(ROUTES.auth.deviceQRGenerate, { errorMessage: 'Unable to generate QR code.', forceNetwork: true });
      if (requestId !== qrRequestIdRef.current) return; // superseded by a newer call
      const data = (res?.data ?? res) as QRData;
      if (data?.qr_payload) {
        setQRData(data);
        setCountdown(secondsUntil(data.expires_at));
      } else {
        setQRData(null);
      }
    } catch (err: any) {
      if (requestId !== qrRequestIdRef.current) return;
      setQRData(null);
      setError(err?.message || 'Unable to generate QR code.');
    } finally {
      if (requestId === qrRequestIdRef.current) setQRLoading(false);
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

  /* ---------- Web pairing (parent only) ---------- */
  const loadWebPairing = useCallback(async () => {
    const requestId = ++webPairingRequestIdRef.current;
    setWebPairingLoading(true);
    try {
      const res = await getRequest(ROUTES.auth.deviceWebPairingGenerate, { errorMessage: 'Unable to generate a web sign-in code.', forceNetwork: true });
      if (requestId !== webPairingRequestIdRef.current) return; // superseded by a newer call
      const data = (res?.data ?? res) as WebPairingData;
      if (data?.code) {
        setWebPairing(data);
        setWebCountdown(secondsUntil(data.expires_at));
      } else {
        setWebPairing(null);
      }
    } catch (err: any) {
      if (requestId !== webPairingRequestIdRef.current) return;
      setWebPairing(null);
      setError(err?.message || 'Unable to generate a web sign-in code.');
    } finally {
      if (requestId === webPairingRequestIdRef.current) setWebPairingLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isParent || activeTab !== 'web') return;
    void loadWebPairing();
  }, [isParent, activeTab, loadWebPairing]);

  useEffect(() => {
    if (!webPairing) return;
    if (webCountdownRef.current) clearInterval(webCountdownRef.current);
    webCountdownRef.current = setInterval(() => {
      setWebCountdown(prev => {
        if (prev <= 1) {
          clearInterval(webCountdownRef.current!);
          void loadWebPairing(); // auto-refresh when expired
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (webCountdownRef.current) clearInterval(webCountdownRef.current); };
  }, [webPairing, loadWebPairing]);

  const copyWebCode = useCallback(() => {
    if (!webPairing?.code) return;
    Clipboard.setString(webPairing.code);
    Alert.alert('Copied', 'Web sign-in code copied. Paste it at kingdomimpactventures.org/pair.');
  }, [webPairing]);

  const copyWebLink = useCallback(() => {
    if (!webPairing?.qr_payload) return;
    Clipboard.setString(webPairing.qr_payload);
    Alert.alert('Copied', 'Web sign-in link copied.');
  }, [webPairing]);

  const shareWebLink = useCallback(() => {
    if (!webPairing?.qr_payload) return;
    void Share.share({ message: webPairing.qr_payload });
  }, [webPairing]);

  /* ---------- Actions ---------- */
  const handleRevoke = useCallback((device: Device) => {
    const label = device.nickname || device.device_name || device.name || device.platform || 'this device';
    Alert.alert('Remove device', `Remove "${label}" from your account?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setRevokingId(device.id);
          try {
            const res = await deleteRequest(ROUTES.auth.revokeDevice(device.id), { errorMessage: 'Unable to remove device.' });
            if (res && (res as any).success === false) {
              const msg = (res as any).message || (res as any).data?.detail || 'Unable to remove device.';
              Alert.alert('Failed', msg);
            } else {
              await loadDevices();
            }
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
              if (res && res.success === false) {
                Alert.alert('Failed', res.message || (res as any)?.data?.detail || 'Unable to revoke devices.');
                return;
              }
              const count = (res as any)?.data?.revoked_count ?? (res as any)?.revoked_count ?? 0;
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
    const label = targetDevice.nickname || targetDevice.device_name || targetDevice.name || 'the selected device';
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
    const label = item.nickname || item.device_name || item.name || item.platform || 'Unknown device';
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
                <Text style={[styles.badgeText, { color: palette.onPrimary }]}>PRIMARY</Text>
              </View>
            )}
            {item.is_current && !item.is_parent && (
              <View style={[styles.badge, { backgroundColor: palette.primarySoft }]}>
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
                <Text style={{ color: palette.onPrimary, fontWeight: '700', fontSize: 12 }}>Save</Text>
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
              onPress={() => { setRenamingId(item.id); setRenameValue(item.nickname || item.device_name || item.name || ''); }}
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
              style={[styles.smallBtn, { borderColor: palette.danger, borderWidth: 1.5 }]}
              onPress={() => handleRevoke(item)}
              disabled={isRevoking}
            >
              {isRevoking ? (
                <ActivityIndicator size="small" color={palette.danger} />
              ) : (
                <Text style={{ color: palette.danger, fontSize: 12, fontWeight: '700' }}>Remove</Text>
              )}
            </Pressable>
          )}
        </View>
      </View>
    );
  };

  const secondaryDevices = useMemo(() => devices.filter(d => !d.is_parent), [devices]);
  const hasSecondary = secondaryDevices.length > 0;

  const mobileDevices = useMemo(() => devices.filter(d => d.platform !== 'web'), [devices]);
  const webDevices = useMemo(() => devices.filter(d => d.platform === 'web'), [devices]);
  const listData = activeTab === 'web' ? webDevices : mobileDevices;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: palette.bg, }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: palette.divider }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <KISIcon name="arrow-left" size={22} color={palette.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: palette.text }]}>Manage Devices</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={[styles.tabSwitch, { borderColor: palette.divider }]}>
        <Pressable
          style={[styles.tabBtn, activeTab === 'mobile' && { backgroundColor: palette.primary }]}
          onPress={() => setActiveTab('mobile')}
        >
          <Text style={[styles.tabBtnText, { color: activeTab === 'mobile' ? palette.onPrimary : palette.subtext }]}>
            Mobile
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tabBtn, activeTab === 'web' && { backgroundColor: palette.primary }]}
          onPress={() => setActiveTab('web')}
        >
          <Text style={[styles.tabBtnText, { color: activeTab === 'web' ? palette.onPrimary : palette.subtext }]}>
            Web
          </Text>
        </Pressable>
      </View>

      <FlatList
        initialNumToRender={20}
        maxToRenderPerBatch={10}
        windowSize={10}
        removeClippedSubviews
        data={listData}
        keyExtractor={item => String(item.id)}
        renderItem={renderDevice}
        contentContainerStyle={{ padding: responsive.pageGutter, gap: 12, paddingBottom: responsive.pageGutter * 2, width: '100%', maxWidth: responsive.contentMaxWidth, alignSelf: 'center' }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void loadDevices(); }} tintColor={palette.primary} />
        }
        ListHeaderComponent={
          <>
            {activeTab === 'mobile' ? (
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
                      <View style={[styles.qrPlaceholder, { backgroundColor: palette.surface }]}>
                        <ActivityIndicator color={palette.primary} size="large" />
                      </View>
                    ) : qrData ? (
                      <>
                        <View style={[styles.qrWrap, { backgroundColor: palette.ivory }]}>
                          {/* QR code content is never displayed as text — only as a visual QR */}
                          <QRCode
                            value={qrData.qr_payload}
                            size={200}
                            backgroundColor={palette.ivory}
                            color={palette.royalInk}
                          />
                        </View>
                        <View style={styles.countdownRow}>
                          <KISIcon name="bell" size={12} color={countdown < 300 ? palette.danger : palette.subtext} />
                          <Text style={[styles.countdownText, { color: countdown < 300 ? palette.danger : palette.subtext }]}>
                            Expires in {formatCountdown(countdown)}
                          </Text>
                          <Pressable onPress={loadQR} style={styles.refreshQRBtn} disabled={qrLoading}>
                            <Text style={[styles.refreshQRText, { color: qrLoading ? palette.subtext : palette.primary }]}>Refresh</Text>
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
                      <View style={[styles.qrPlaceholder, { backgroundColor: palette.surface }]}>
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
                    style={[styles.revokeAllBtn, { borderColor: palette.danger }]}
                    onPress={handleRevokeAll}
                  >
                    <KISIcon name="warning" size={16} color={palette.danger} />
                    <Text style={{ color: palette.danger, fontWeight: '700', fontSize: 14 }}>
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
              </>
            ) : (
              <>
                {/* ── Web pairing panel (parent device only) ─────────────── */}
                {isParent ? (
                  <View style={[styles.qrPanel, { backgroundColor: palette.card, borderColor: palette.primary }]}>
                    <View style={styles.qrPanelHeader}>
                      <KISIcon name="desktop" size={18} color={palette.primary} />
                      <Text style={[styles.qrPanelTitle, { color: palette.text }]}>
                        Sign in on a computer
                      </Text>
                    </View>
                    <Text style={[styles.qrPanelSub, { color: palette.subtext }]}>
                      Scan this code, or go to kingdomimpactventures.org/pair and type the code below. It expires in
                      10 minutes and works once. You can have several computers signed in at the same time.
                    </Text>

                    {webPairingLoading ? (
                      <View style={[styles.qrPlaceholder, { backgroundColor: palette.surface }]}>
                        <ActivityIndicator color={palette.primary} size="large" />
                      </View>
                    ) : webPairing ? (
                      <>
                        <View style={[styles.qrWrap, { backgroundColor: palette.ivory }]}>
                          <QRCode
                            value={webPairing.qr_payload}
                            size={200}
                            backgroundColor={palette.ivory}
                            color={palette.royalInk}
                          />
                        </View>
                        <Text style={[styles.webCodeText, { color: palette.text }]}>{webPairing.code}</Text>
                        <View style={styles.countdownRow}>
                          <KISIcon name="bell" size={12} color={webCountdown < 120 ? palette.danger : palette.subtext} />
                          <Text style={[styles.countdownText, { color: webCountdown < 120 ? palette.danger : palette.subtext }]}>
                            Expires in {formatCountdown(webCountdown)}
                          </Text>
                          <Pressable onPress={loadWebPairing} style={styles.refreshQRBtn} disabled={webPairingLoading}>
                            <Text style={[styles.refreshQRText, { color: webPairingLoading ? palette.subtext : palette.primary }]}>Refresh</Text>
                          </Pressable>
                        </View>
                        <View style={styles.tokenActionRow}>
                          <Pressable onPress={copyWebCode} style={[styles.tokenActionBtn, { borderColor: palette.divider }]}>
                            <Text style={[styles.tokenActionText, { color: palette.primary }]}>Copy code</Text>
                          </Pressable>
                          <Pressable onPress={copyWebLink} style={[styles.tokenActionBtn, { borderColor: palette.divider }]}>
                            <Text style={[styles.tokenActionText, { color: palette.primary }]}>Copy link</Text>
                          </Pressable>
                          <Pressable onPress={shareWebLink} style={[styles.tokenActionBtn, { borderColor: palette.divider }]}>
                            <Text style={[styles.tokenActionText, { color: palette.primary }]}>Share link</Text>
                          </Pressable>
                        </View>
                      </>
                    ) : (
                      <View style={[styles.qrPlaceholder, { backgroundColor: palette.surface }]}>
                        <Text style={{ color: palette.subtext, fontWeight: '600' }}>Code unavailable</Text>
                        <Pressable onPress={loadWebPairing}>
                          <Text style={{ color: palette.primary, fontWeight: '700', marginTop: 8 }}>Retry</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                ) : (
                  <View style={[styles.infoBox, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
                    <KISIcon name="info" size={16} color={palette.subtext} />
                    <Text style={[styles.infoBoxText, { color: palette.subtext }]}>
                      This is a secondary device, so it can't create a web session. Use your primary device to sign in
                      on a computer.
                      {currentDevice?.parent_device_name ? ` Primary: ${currentDevice.parent_device_name}` : ''}
                    </Text>
                  </View>
                )}
              </>
            )}

            <Text style={[styles.sectionLabel, { color: palette.subtext }]}>
              {listData.length} {activeTab === 'web' ? 'web session' : 'device'}{listData.length === 1 ? '' : 's'}
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
              <Text style={{ color: palette.danger, fontWeight: '600', textAlign: 'center' }}>{error}</Text>
              <Pressable onPress={() => { setLoading(true); void loadDevices(); }}>
                <Text style={{ color: palette.primary, fontWeight: '700', marginTop: 12 }}>Retry</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.centered}>
              <Text style={{ color: palette.subtext, fontWeight: '500' }}>
                {activeTab === 'web' ? 'No web sessions yet.' : 'No devices found.'}
              </Text>
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
    backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 17, fontWeight: '700' },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },

    /* Web/Mobile tab switch */
    tabSwitch: {
      flexDirection: 'row',
      marginHorizontal: 16,
      marginTop: 12,
      borderRadius: 12,
      borderWidth: 1,
      overflow: 'hidden',
    },
    tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
    tabBtnText: { fontSize: 14, fontWeight: '700' },
    webCodeText: {
      textAlign: 'center',
      fontSize: 20,
      fontWeight: '900',
      letterSpacing: 3,
    },

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
    badgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
    deviceName: { fontSize: 15, fontWeight: '700' },
    deviceMeta: { fontSize: 12, fontWeight: '500' },

    actionCol: { alignItems: 'flex-end', gap: 8, justifyContent: 'center' },
    iconBtn: {
      width: 44,
      height: 44,
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
