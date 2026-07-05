import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import { KISIcon } from '@/constants/kisIcons';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import {
  clearPermanentMediaDomain,
  formatPermanentMediaBytes,
  getPermanentMediaUsage,
  type PermanentMediaDomainUsage,
} from '@/storage/permanentMediaStorage';
import { getMediaTransferSummary, clearCompletedMediaTransfers, type MediaTransferSummary } from '@/services/mediaTransferQueue';
import { getOfflineActionQueue } from '@/services/offlineActionQueue';

export default function CacheManagementScreen() {
  const { palette } = useKISTheme();
  const navigation = useNavigation();
  const responsive = useResponsiveLayout();
  const [rows, setRows] = useState<PermanentMediaDomainUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState<string | null>(null);
  const [mediaQueue, setMediaQueue] = useState<MediaTransferSummary | null>(null);
  const [actionQueueCount, setActionQueueCount] = useState(0);

  const totalBytes = useMemo(() => rows.reduce((sum, row) => sum + row.bytes, 0), [rows]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [usage, transferSummary, actionQueue] = await Promise.all([
        getPermanentMediaUsage(),
        getMediaTransferSummary(),
        getOfflineActionQueue(),
      ]);
      setRows(usage);
      setMediaQueue(transferSummary);
      setActionQueueCount(actionQueue.length);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const confirmClear = useCallback((row: PermanentMediaDomainUsage) => {
    Alert.alert(
      `Clear ${row.domain}?`,
      `This removes ${formatPermanentMediaBytes(row.bytes)} of downloaded KIS media from this device. Online content can be downloaded again later.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            setClearing(row.domain);
            clearPermanentMediaDomain(row.domain)
              .then(load)
              .finally(() => setClearing(null));
          },
        },
      ],
    );
  }, [load]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg, marginTop: 25 }} edges={['top', 'bottom']}>
      <View style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <KISIcon name="arrow-left" size={22} color={palette.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: palette.text, fontSize: 20, fontWeight: '900' }}>Media storage</Text>
          <Text style={{ color: palette.subtext, fontWeight: '700' }}>{formatPermanentMediaBytes(totalBytes)} on this device</Text>
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={palette.primaryStrong ?? palette.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: responsive.pageGutter, gap: 10, width: '100%', maxWidth: responsive.contentMaxWidth, alignSelf: 'center' }}>
          <View
            style={{
              borderWidth: 1,
              borderColor: palette.divider,
              backgroundColor: palette.surface,
              borderRadius: 14,
              padding: 14,
              gap: 8,
            }}
          >
            <Text style={{ color: palette.text, fontWeight: '900', fontSize: 16 }}>Sync queues</Text>
            <Text style={{ color: palette.subtext, fontWeight: '700' }}>
              Media: {mediaQueue?.queued ?? 0} queued, {mediaQueue?.running ?? 0} running, {mediaQueue?.failed ?? 0} failed
            </Text>
            <Text style={{ color: palette.subtext, fontWeight: '700' }}>
              Actions: {actionQueueCount} waiting to sync
            </Text>
            <Pressable
              onPress={() => clearCompletedMediaTransfers().then(load)}
              style={{
                alignSelf: 'flex-start',
                borderWidth: 1,
                borderColor: palette.primary,
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 8,
                minHeight: 44,
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: palette.primary, fontWeight: '900' }}>Clear completed transfers</Text>
            </Pressable>
          </View>
          {rows.map((row) => (
            <View
              key={row.domain}
              style={{
                borderWidth: 1,
                borderColor: palette.divider,
                backgroundColor: palette.surface,
                borderRadius: 14,
                padding: 14,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: palette.text, fontWeight: '900', fontSize: 16 }}>{row.domain}</Text>
                <Text style={{ color: palette.subtext, fontWeight: '700' }}>
                  {row.fileCount} files · {formatPermanentMediaBytes(row.bytes)}
                </Text>
              </View>
              <Pressable
                onPress={() => confirmClear(row)}
                disabled={row.bytes <= 0 || clearing === row.domain}
                style={{
                  borderWidth: 1,
                  borderColor: row.bytes > 0 ? palette.danger : palette.divider,
                  borderRadius: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  opacity: row.bytes > 0 ? 1 : 0.45,
                }}
              >
                <Text style={{ color: row.bytes > 0 ? palette.danger : palette.subtext, fontWeight: '900' }}>
                  {clearing === row.domain ? 'Clearing' : 'Clear'}
                </Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
