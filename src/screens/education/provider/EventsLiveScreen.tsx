// src/screens/education/provider/EventsLiveScreen.tsx
//
// Education UX v2 — real "Events & Live" destination, consolidating the
// institution's class sessions and events (previously two separate
// module-list modes inside EducationManagementModal.tsx) into one
// calendar-flavored view.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useNavigation, useRoute, useFocusEffect, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import KISButton from '@/constants/KISButton';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import type { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route_ = RouteProp<RootStackParamList, 'EducationEventsLive'>;

export default function EventsLiveScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route_>();
  const { institutionId, institutionName } = route.params;
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const [classSessions, setClassSessions] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sessionsRes, eventsRes] = await Promise.all([
        getRequest(ROUTES.broadcasts.educationInstitutionClassSessions(institutionId), { forceNetwork: true }),
        getRequest(ROUTES.broadcasts.educationInstitutionEvents(institutionId), { forceNetwork: true }),
      ]);
      setClassSessions(sessionsRes?.data?.class_sessions ?? []);
      setEvents(eventsRes?.data?.events ?? []);
    } finally {
      setLoading(false);
    }
  }, [institutionId]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const combined = useMemo(() => {
    const sessions = classSessions.map(row => ({ ...row, kind: 'Live class' as const }));
    const evts = events.map(row => ({ ...row, kind: 'Event' as const }));
    return [...sessions, ...evts].sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  }, [classSessions, events]);

  const createQuickEvent = useCallback(async () => {
    setCreating(true);
    try {
      const start = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
      const response = await postRequest(
        ROUTES.broadcasts.educationInstitutionEvents(institutionId),
        { title: 'New event', event_type: 'event', starts_at: start.toISOString(), ends_at: end.toISOString(), status: 'draft' },
        { errorMessage: 'Unable to create event.' },
      );
      if (response?.success) await load();
    } finally {
      setCreating(false);
    }
  }, [institutionId, load]);

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: palette.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: responsive.pageGutter, gap: 14, paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={palette.primary} />}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Pressable onPress={() => navigation.goBack()} style={{ padding: 4, marginLeft: -4 }}>
            <KISIcon name="back" size={20} color={palette.text} />
          </Pressable>
          <View>
            <Text style={{ fontSize: 22, fontWeight: '900', color: palette.text }}>Events & Live</Text>
            {institutionName ? <Text style={{ fontSize: 12, color: palette.subtext }}>{institutionName}</Text> : null}
          </View>
        </View>

        <KISButton title={creating ? 'Creating…' : '+ Create event'} disabled={creating} onPress={() => void createQuickEvent()} />

        {loading && combined.length === 0 ? <ActivityIndicator color={palette.primary} /> : null}

        {combined.length === 0 && !loading ? (
          <View style={{ padding: 18, alignItems: 'center' }}>
            <KISIcon name="calendar" size={28} color={palette.subtext} />
            <Text style={{ color: palette.subtext, textAlign: 'center', marginTop: 8 }}>
              You don't have any upcoming classes or events.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {combined.map(row => (
              <View key={`${row.kind}-${row.id}`} style={{ padding: 14, borderRadius: 14, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, gap: 6 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontWeight: '800', color: palette.text }} numberOfLines={1}>{row.title}</Text>
                  <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: palette.primarySoft }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: palette.primaryStrong }}>{row.kind}</Text>
                  </View>
                </View>
                <Text style={{ fontSize: 12, color: palette.subtext }}>
                  {row.starts_at ? new Date(row.starts_at).toLocaleString() : 'Unscheduled'}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
