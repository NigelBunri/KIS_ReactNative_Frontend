import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import type { RootStackParamList } from '@/navigation/types';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { KISIcon } from '@/constants/kisIcons';
import { buildRecentActivityItems } from '@/screens/tabs/profile/profileDashboardData';

const CANCELLED_BOOKING_STATUSES = new Set(['cancelled', 'canceled', 'rejected', 'void']);

export default function ProfileRecentActivityScreen() {
  const { palette } = useKISTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const responsive = useResponsiveLayout();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [appointments, setAppointments] = useState<any[]>([]);

  const openBookingDetails = useCallback(
    (bookingId: string) => navigation.navigate('ServiceBookingDetails', { bookingId }),
    [navigation],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [profileRes, bookingRes] = await Promise.all([
        getRequest(ROUTES.profiles.me, { errorMessage: 'Unable to load profile activity.' }),
        getRequest(ROUTES.commerce.serviceBookings, {
          errorMessage: 'Unable to load recent bookings.',
          forceNetwork: true,
        }),
      ]);

      if (profileRes?.success) {
        setProfile(profileRes.data ?? null);
      }

      const bookingPayload = bookingRes?.data ?? bookingRes ?? {};
      const bookingList = Array.isArray(bookingPayload)
        ? bookingPayload
        : Array.isArray(bookingPayload?.results)
        ? bookingPayload.results
        : [];
      setAppointments(
        bookingList.filter((booking: any) => {
          const status = String(booking?.status || '').toLowerCase();
          return !CANCELLED_BOOKING_STATUSES.has(status);
        }),
      );

      if (!profileRes?.success && !bookingRes?.success) {
        throw new Error(profileRes?.message || bookingRes?.message || 'Unable to load recent activity.');
      }
    } catch (loadError: any) {
      setError(loadError?.message || 'Unable to load recent activity.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData]),
  );

  const activities = useMemo(
    () => buildRecentActivityItems(profile, appointments, openBookingDetails, 100),
    [profile, appointments, openBookingDetails],
  );

  return (
    <ScrollView style={{ flex: 1, paddingTop: insets.top, backgroundColor: palette.bg, marginTop: 25 }} contentContainerStyle={{ padding: responsive.pageGutter, gap: 14, width: '100%', maxWidth: responsive.contentMaxWidth, alignSelf: 'center' }}>
      <View style={{ gap: 6 }}>
        <Text style={{ color: palette.text, fontSize: responsive.headerTitleSize, fontWeight: '800' }}>Recent activity</Text>
        <Text style={{ color: palette.subtext }}>
          Recent profile activity and booking-related actions, using backend profile data where available.
        </Text>
      </View>

      {loading ? <ActivityIndicator color={palette.primaryStrong} /> : null}
      {error ? (
        <>
          <Text style={{ color: palette.danger }}>{error}</Text>
          <Pressable
            onPress={() => void loadData()}
            style={{ marginTop: 12, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: palette.primary, borderRadius: 8, alignSelf: 'center' }}
          >
            <Text style={{ color: palette.onPrimary, fontWeight: '600' }}>Retry</Text>
          </Pressable>
        </>
      ) : null}

      {!loading && !activities.length ? (
        <View style={{ padding: 18, borderWidth: 1, borderColor: palette.divider, borderRadius: 18, backgroundColor: palette.surface }}>
          <Text style={{ color: palette.text, fontWeight: '700' }}>No recent activity yet.</Text>
        </View>
      ) : null}

      {activities.map((item) => (
        <Pressable
          key={item.id}
          onPress={item.onPress}
          disabled={!item.onPress}
          style={{
            borderWidth: 1,
            borderColor: palette.divider,
            borderRadius: 20,
            backgroundColor: palette.surface,
            padding: 16,
            flexDirection: 'row',
            gap: 12,
            alignItems: 'flex-start',
          }}
        >
          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: palette.primarySoft,
            }}
          >
            <KISIcon name={item.icon} size={18} color={palette.primaryStrong} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: palette.text, fontSize: 16, fontWeight: '700' }}>{item.title}</Text>
            {item.description ? <Text style={{ color: palette.subtext }}>{item.description}</Text> : null}
            {item.timestamp ? <Text style={{ color: palette.subtext, fontSize: 12 }}>{item.timestamp}</Text> : null}
          </View>
          {item.onPress ? <KISIcon name="chevron-right" size={18} color={palette.subtext} /> : null}
        </Pressable>
      ))}
    </ScrollView>
  );
}
