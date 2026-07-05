import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import KISButton from '@/constants/KISButton';
import { KISIcon } from '@/constants/kisIcons';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ChurchAttendance'>;

type AttendanceStats = {
  streak?: number;
  last_checkin_date?: string;
};

type AttendanceRecord = {
  id: string;
  date: string;
  service_type?: string;
  check_in_method: string;
};

export default function AttendanceScreen({ navigation }: Props) {
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const [stats, setStats] = useState<AttendanceStats | null>(null);
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);

  const styles = useMemo(() => makeStyles(palette, layout), [palette, layout]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      getRequest(ROUTES.church.attendance)
        .then(res => {
          if (res?.success) {
            const raw = res.data;
            if (raw?.stats) setStats(raw.stats);
            const records = raw?.records ?? raw?.results ?? (Array.isArray(raw) ? raw : []);
            setHistory(records);
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }, []),
  );

  const handleCheckIn = useCallback(async (method: 'qr' | 'manual') => {
    setCheckingIn(true);
    try {
      const res = await postRequest(ROUTES.church.attendanceCheckin, {
        type: 'physical',
        check_in_method: method,
      });
      if (res?.success) {
        Alert.alert('Checked In!', 'Your attendance has been recorded.');
        setStats(prev => ({
          streak: (prev?.streak ?? 0) + 1,
          last_checkin_date: new Date().toISOString().split('T')[0],
        }));
      } else {
        Alert.alert('Error', res?.message ?? 'Check-in failed.');
      }
    } catch {
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setCheckingIn(false);
    }
  }, []);

  const formatDate = (d: string) => {
    try {
      return new Date(d).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return d;
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        data={history}
        keyExtractor={item => item.id}
        contentContainerStyle={{ paddingBottom: 80 }}
        ListHeaderComponent={
          <>
            <View style={styles.statsCard}>
              <View style={styles.streakBlock}>
                <KISIcon name="check" size={28} tone="primary" />
                <Text style={styles.streakNumber}>{stats?.streak ?? 0}</Text>
                <Text style={styles.streakLabel}>Week Streak</Text>
              </View>
              <View style={styles.dividerV} />
              <View style={styles.lastBlock}>
                <Text style={styles.lastLabel}>Last Check-in</Text>
                <Text style={styles.lastDate}>
                  {stats?.last_checkin_date ? formatDate(stats.last_checkin_date) : 'Never'}
                </Text>
              </View>
            </View>

            <View style={styles.section}>
              <KISButton
                title="Check In via QR"
                variant="primary"
                loading={checkingIn}
                disabled={checkingIn}
                style={styles.checkInBtn}
                onPress={() => handleCheckIn('qr')}
                left={<KISIcon name="qr-code" size={20} color={palette.ivory} />}
              />
              <KISButton
                title="Check In Manually"
                variant="outline"
                loading={checkingIn}
                disabled={checkingIn}
                style={[styles.checkInBtn, { marginTop: 10 }]}
                onPress={() => handleCheckIn('manual')}
              />
            </View>

            <Text style={styles.historyTitle}>Attendance History</Text>
            {loading && (
              <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                <ActivityIndicator color={palette.primary} />
              </View>
            )}
            {!loading && history.length === 0 && (
              <Text style={styles.emptyText}>No attendance records yet.</Text>
            )}
          </>
        }
        renderItem={({ item }) => (
          <View style={styles.historyRow}>
            <View style={styles.historyDot} />
            <View style={styles.historyInfo}>
              <Text style={styles.historyDate}>{formatDate(item.date)}</Text>
              {item.service_type ? (
                <Text style={styles.historyService}>{item.service_type}</Text>
              ) : null}
            </View>
            <View style={styles.methodBadge}>
              <Text style={styles.methodText}>
                {item.check_in_method === 'qr' ? 'QR' : 'Manual'}
              </Text>
            </View>
          </View>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </SafeAreaView>
  );
}

function makeStyles(palette: any, layout: any) {
  const sp = layout.pageGutter;
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: palette.bg, marginTop: 25 },
    statsCard: {
      flexDirection: 'row',
      backgroundColor: palette.card,
      borderRadius: 16,
      marginHorizontal: sp,
      marginTop: 16,
      padding: 20,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.divider,
      alignItems: 'center',
    },
    streakBlock: { flex: 1, alignItems: 'center' },
    streakNumber: { fontSize: 36, fontWeight: '800', color: palette.primary, marginTop: 4 },
    streakLabel: { fontSize: 13, color: palette.subtext, marginTop: 2 },
    dividerV: { width: StyleSheet.hairlineWidth, height: '80%', backgroundColor: palette.divider, marginHorizontal: 16 },
    lastBlock: { flex: 2, paddingLeft: 8 },
    lastLabel: { fontSize: 13, color: palette.subtext, marginBottom: 4 },
    lastDate: { fontSize: 15, fontWeight: '600', color: palette.text },
    section: { paddingHorizontal: sp, marginTop: 20 },
    checkInBtn: { minHeight: 52 },
    historyTitle: { fontSize: 17, fontWeight: '600', color: palette.text, paddingHorizontal: sp, marginTop: 24, marginBottom: 8 },
    emptyText: { fontSize: 14, color: palette.subtext, textAlign: 'center', paddingVertical: 20 },
    historyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: sp,
      paddingVertical: 12,
      minHeight: 56,
    },
    historyDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: palette.primary, marginRight: 12 },
    historyInfo: { flex: 1 },
    historyDate: { fontSize: 14, fontWeight: '600', color: palette.text },
    historyService: { fontSize: 12, color: palette.subtext, marginTop: 2 },
    methodBadge: {
      backgroundColor: palette.primarySoft,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    methodText: { fontSize: 12, fontWeight: '600', color: palette.primary },
    separator: { height: StyleSheet.hairlineWidth, backgroundColor: palette.divider, marginLeft: sp + 22 },
  });
}
