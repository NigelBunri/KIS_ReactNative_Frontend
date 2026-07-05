import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import LinearGradient from 'react-native-linear-gradient';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import KISButton from '@/constants/KISButton';
import { KISIcon } from '@/constants/kisIcons';
import { getRequest } from '@/network/get';
import ROUTES from '@/network';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'TelemedicineHub'>;

type Consult = {
  id: string;
  doctor_name: string;
  specialty: string;
  scheduled_at: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  call_url?: string;
};

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export default function TelemedicineScreen({ navigation }: Props) {
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const sp = layout.pageGutter;

  const [consults, setConsults] = useState<Consult[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConsults = useCallback(async () => {
    setLoading(true);
    const res = await getRequest(ROUTES.healthExtended.consults);
    if (res.success) {
      setConsults(Array.isArray(res.data?.results ?? res.data) ? (res.data?.results ?? res.data) : []);
    }
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { fetchConsults(); }, [fetchConsults]));

  const handleJoinCall = (consult: Consult) => {
    if (consult.call_url) {
      Linking.openURL(consult.call_url).catch(() =>
        Alert.alert('Error', 'Unable to open the call link.')
      );
    } else {
      Alert.alert('Connecting...', 'Call link will be available shortly.');
    }
  };

  const statusColor = (status: string) => {
    if (status === 'in_progress') return palette.primary;
    if (status === 'completed') return palette.primaryStrong;
    if (status === 'cancelled') return palette.danger;
    return palette.subtext;
  };

  const styles = makeStyles(palette, sp);

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient
        colors={[palette.gradientStart, palette.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>Telemedicine</Text>
        <Text style={styles.headerSub}>Connect with doctors anywhere</Text>
      </LinearGradient>

      {/* Quick Actions */}
      <View style={styles.quickRow}>
        <TouchableOpacity
          style={styles.quickBtn}
          onPress={() => navigation.navigate('DoctorDirectory', { mode: 'instant' })}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <KISIcon name="bolt" size={22} color={palette.primary} />
          <Text style={styles.quickLabel}>Instant Consult</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickBtn}
          onPress={() => navigation.navigate('DoctorDirectory', { mode: 'book' })}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <KISIcon name="calendar" size={22} color={palette.primary} />
          <Text style={styles.quickLabel}>Book Appointment</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickBtn}
          onPress={() => navigation.navigate('DoctorDirectory', { mode: 'browse' })}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <KISIcon name="person" size={22} color={palette.primary} />
          <Text style={styles.quickLabel}>Doctor Directory</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Upcoming Consults</Text>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={palette.primary} size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.list, { paddingBottom: 80 }]}
          showsVerticalScrollIndicator={false}
        >
          {consults.length === 0 ? (
            <Text style={styles.empty}>No upcoming consults.</Text>
          ) : (
            consults.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={styles.card}
                onPress={() => navigation.navigate('ConsultDetail', { consultId: c.id })}
                activeOpacity={0.85}
              >
                <View style={styles.cardRow}>
                  <View style={styles.avatarCircle}>
                    <KISIcon name="person" size={20} color={palette.primary} />
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={styles.doctorName}>{c.doctor_name}</Text>
                    <Text style={styles.specialty}>{c.specialty}</Text>
                    <Text style={styles.dateText}>
                      {new Date(c.scheduled_at).toLocaleString()}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusColor(c.status) + '22' }]}>
                    <Text style={[styles.statusText, { color: statusColor(c.status) }]}>
                      {STATUS_LABELS[c.status] ?? c.status}
                    </Text>
                  </View>
                </View>
                {c.status === 'in_progress' && (
                  <KISButton
                    title="Join Call"
                    variant="primary"
                    size="sm"
                    style={styles.joinBtn}
                    onPress={() => handleJoinCall(c)}
                  />
                )}
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function makeStyles(palette: any, sp: number) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: palette.bg, marginTop: 25 },
    header: {
      paddingHorizontal: sp,
      paddingTop: 16,
      paddingBottom: 20,
    },
    headerTitle: {
      fontSize: 26,
      fontWeight: '700',
      color: palette.ivory,
    },
    headerSub: {
      fontSize: 14,
      color: palette.ivory,
      opacity: 0.8,
      marginTop: 2,
    },
    quickRow: {
      flexDirection: 'row',
      paddingHorizontal: sp,
      paddingVertical: 14,
      gap: 10,
      backgroundColor: palette.surface,
      borderBottomWidth: 1,
      borderBottomColor: palette.divider,
    },
    quickBtn: {
      flex: 1,
      alignItems: 'center',
      backgroundColor: palette.card,
      borderRadius: 12,
      paddingVertical: 12,
      gap: 6,
      minHeight: 70,
      justifyContent: 'center',
    },
    quickLabel: {
      fontSize: 11,
      color: palette.subtext,
      textAlign: 'center',
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: palette.text,
      paddingHorizontal: sp,
      paddingTop: 16,
      paddingBottom: 8,
    },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    list: { paddingHorizontal: sp, gap: 12 },
    empty: { color: palette.subtext, textAlign: 'center', marginTop: 40 },
    card: {
      backgroundColor: palette.card,
      borderRadius: 14,
      padding: 14,
      gap: 10,
      borderWidth: 1,
      borderColor: palette.divider,
    },
    cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    avatarCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: palette.primarySoft,
      justifyContent: 'center',
      alignItems: 'center',
    },
    cardInfo: { flex: 1 },
    doctorName: { fontSize: 15, fontWeight: '600', color: palette.text },
    specialty: { fontSize: 13, color: palette.subtext, marginTop: 2 },
    dateText: { fontSize: 12, color: palette.subtext, marginTop: 2 },
    statusBadge: {
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    statusText: { fontSize: 11, fontWeight: '600' },
    joinBtn: { alignSelf: 'flex-end', minWidth: 100 },
  });
}
