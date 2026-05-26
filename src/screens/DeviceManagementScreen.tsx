// src/screens/DeviceManagementScreen.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import { getRequest } from '@/network/get';
import { deleteRequest } from '@/network/delete';
import ROUTES from '@/network';

type Device = {
  id: string;
  device_name?: string;
  platform?: string;
  last_seen?: string;
  is_current?: boolean;
};

export default function DeviceManagementScreen() {
  const { palette } = useKISTheme();
  const navigation = useNavigation();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const styles = useMemo(() => createStyles(palette), [palette]);

  const loadDevices = useCallback(async () => {
    setError(null);
    try {
      const res = await getRequest(ROUTES.auth.listDevices, {
        errorMessage: 'Unable to load devices.',
        forceNetwork: true,
      });
      if (res?.success) {
        const payload = res.data;
        const list: Device[] = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.results)
          ? payload.results
          : [];
        setDevices(list);
      } else {
        setError(res?.message || 'Unable to load devices.');
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to load devices.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadDevices();
  }, [loadDevices]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void loadDevices();
  }, [loadDevices]);

  const handleRevoke = useCallback(
    (device: Device) => {
      const label = device.device_name || device.platform || 'this device';
      Alert.alert(
        'Revoke device',
        `Remove "${label}" from your account? You will be logged out on that device.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Revoke',
            style: 'destructive',
            onPress: async () => {
              setRevokingId(device.id);
              try {
                const res = await deleteRequest(
                  ROUTES.auth.revokeDevice(device.id),
                  { errorMessage: 'Unable to revoke device.' },
                );
                if (!res.success) {
                  throw new Error(res.message || 'Unable to revoke device.');
                }
                await loadDevices();
              } catch (err: any) {
                Alert.alert('Revoke device', err?.message || 'Unable to revoke device.');
              } finally {
                setRevokingId(null);
              }
            },
          },
        ],
      );
    },
    [loadDevices],
  );

  const formatLastSeen = (value?: string) => {
    if (!value) return 'Unknown';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Unknown';
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const renderDevice = ({ item }: { item: Device }) => {
    const isRevoking = revokingId === item.id;
    const label = item.device_name || item.platform || 'Unknown device';
    const platformLabel = item.platform
      ? item.platform.charAt(0).toUpperCase() + item.platform.slice(1)
      : null;

    return (
      <View
        style={[
          styles.deviceRow,
          {
            backgroundColor: palette.surface,
            borderColor: item.is_current ? palette.primary : palette.divider,
          },
        ]}
      >
        <View style={[styles.deviceIcon, { backgroundColor: palette.surfaceElevated }]}>
          <KISIcon
            name={item.platform === 'ios' || item.platform === 'android' ? 'phone-portrait' : 'desktop'}
            size={20}
            color={palette.subtext}
          />
        </View>
        <View style={styles.deviceInfo}>
          <View style={styles.deviceNameRow}>
            <Text style={[styles.deviceName, { color: palette.text }]} numberOfLines={1}>
              {label}
            </Text>
            {item.is_current ? (
              <View style={[styles.currentBadge, { backgroundColor: palette.primary }]}>
                <Text style={styles.currentBadgeText}>Current</Text>
              </View>
            ) : null}
          </View>
          {platformLabel ? (
            <Text style={[styles.deviceMeta, { color: palette.subtext }]}>
              {platformLabel}
            </Text>
          ) : null}
          <Text style={[styles.deviceMeta, { color: palette.subtext }]}>
            Last seen: {formatLastSeen(item.last_seen)}
          </Text>
        </View>
        {!item.is_current ? (
          <Pressable
            style={[styles.revokeButton, { borderColor: palette.danger }]}
            onPress={() => handleRevoke(item)}
            disabled={isRevoking}
          >
            {isRevoking ? (
              <ActivityIndicator size="small" color={palette.danger} />
            ) : (
              <Text style={[styles.revokeText, { color: palette.danger }]}>Revoke</Text>
            )}
          </Pressable>
        ) : null}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: palette.bg }]}>
      <View style={[styles.header, { borderBottomColor: palette.divider }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <KISIcon name="chevron-left" size={20} color={palette.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: palette.text }]}>
          Manage Devices
        </Text>
        <View style={styles.backButton} />
      </View>

      {loading && !refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator color={palette.primary} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={[styles.errorText, { color: palette.danger }]}>{error}</Text>
          <Pressable onPress={() => { setLoading(true); void loadDevices(); }} style={styles.retryButton}>
            <Text style={[styles.retryText, { color: palette.primary }]}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={devices}
          keyExtractor={item => String(item.id)}
          renderItem={renderDevice}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={palette.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={[styles.emptyText, { color: palette.subtext }]}>
                No active sessions found.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const createStyles = (palette: ReturnType<typeof useKISTheme>['palette']) =>
  StyleSheet.create({
    root: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: '700',
    },
    backButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      gap: 12,
    },
    listContent: {
      padding: 16,
      gap: 12,
    },
    deviceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderRadius: 18,
      borderWidth: 1,
      padding: 14,
    },
    deviceIcon: {
      width: 42,
      height: 42,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    deviceInfo: {
      flex: 1,
      gap: 3,
    },
    deviceNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap',
    },
    deviceName: {
      fontSize: 15,
      fontWeight: '700',
      flexShrink: 1,
    },
    currentBadge: {
      borderRadius: 6,
      paddingHorizontal: 7,
      paddingVertical: 2,
    },
    currentBadgeText: {
      color: '#FFFFFF',
      fontSize: 11,
      fontWeight: '700',
    },
    deviceMeta: {
      fontSize: 12,
      fontWeight: '500',
    },
    revokeButton: {
      borderRadius: 10,
      borderWidth: 1.5,
      paddingHorizontal: 12,
      paddingVertical: 7,
      minWidth: 64,
      alignItems: 'center',
    },
    revokeText: {
      fontSize: 13,
      fontWeight: '700',
    },
    errorText: {
      fontSize: 15,
      fontWeight: '600',
      textAlign: 'center',
    },
    retryButton: {
      paddingVertical: 8,
      paddingHorizontal: 16,
    },
    retryText: {
      fontSize: 15,
      fontWeight: '700',
    },
    emptyText: {
      fontSize: 15,
      fontWeight: '500',
    },
  });
