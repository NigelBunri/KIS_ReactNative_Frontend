// src/screens/education/provider/EventsLiveScreen.tsx
//
// Education UX v2 — real "Events & Live" destination, consolidating the
// institution's class sessions and events (previously two separate
// module-list modes inside EducationManagementModal.tsx) into one
// calendar-flavored view.
//
// Visual pass: rebuilt on the shared premium education component kit.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView } from 'react-native';
import { useNavigation, useRoute, useFocusEffect, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import type { RootStackParamList } from '@/navigation/types';
import {
  EducationScreenScaffold,
  EducationListCard,
  EducationEmptyState,
  EducationActionButton,
} from '@/screens/education/shared/components';

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
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }}>
      <EducationScreenScaffold
        palette={palette}
        breadcrumb={institutionName}
        title="Events & Live"
        onBack={() => navigation.goBack()}
        actions={<EducationActionButton palette={palette} label={creating ? 'Creating…' : '+ Create'} disabled={creating} onPress={() => void createQuickEvent()} />}
        scrollable={false}
        contentContainerStyle={{ flex: 1, padding: 0 }}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: responsive.pageGutter, gap: 10, paddingBottom: 60 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={palette.primary} />}
        >
          {loading && combined.length === 0 ? <ActivityIndicator color={palette.primary} /> : null}

          {combined.length === 0 && !loading ? (
            <EducationEmptyState
              palette={palette}
              title="Nothing scheduled"
              description="You don't have any upcoming classes or events."
              action={<EducationActionButton palette={palette} label="+ Create event" disabled={creating} onPress={() => void createQuickEvent()} />}
            />
          ) : (
            combined.map(row => (
              <EducationListCard
                key={`${row.kind}-${row.id}`}
                palette={palette}
                eyebrow={row.kind}
                title={row.title}
                subtitle={row.starts_at ? new Date(row.starts_at).toLocaleString() : 'Unscheduled'}
                statusLabel={row.status}
                statusTone={row.status === 'published' || row.status === 'scheduled' ? 'success' : 'muted'}
              />
            ))
          )}
        </ScrollView>
      </EducationScreenScaffold>
    </SafeAreaView>
  );
}
