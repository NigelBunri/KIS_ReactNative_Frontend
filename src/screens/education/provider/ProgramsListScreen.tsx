// src/screens/education/provider/ProgramsListScreen.tsx
//
// Education UX v2 — "Programs & Classes" destination. Two primary tabs:
// PROGRAMS and CLASSES. A Class is never implied to require a Program —
// the Classes tab explicitly separates "belongs to a Program" from
// "Standalone" rather than nesting every Class inside a Program's own
// list. Opening a row goes to its full Dashboard (ProgramDashboardScreen
// / ClassDashboardScreen); "+ Add" goes to the full creation form
// (ProgramFormScreen / ClassFormScreen) — the old inline
// name-only-field/accordion UI is gone.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useNavigation, useRoute, useFocusEffect, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { patchRequest } from '@/network/patch';
import type { RootStackParamList } from '@/navigation/types';
import { EducationScreenScaffold, EducationListCard, EducationEmptyState, EducationActionButton } from '@/screens/education/shared/components';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route_ = RouteProp<RootStackParamList, 'EducationPrograms'>;

const TOP_TABS = [
  { key: 'programs', label: 'Programs' },
  { key: 'classes', label: 'Classes' },
] as const;
type TopTab = typeof TOP_TABS[number]['key'];

export default function ProgramsListScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route_>();
  const { institutionId, institutionName } = route.params;
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const [topTab, setTopTab] = useState<TopTab>('programs');
  const [programs, setPrograms] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingBroadcastId, setTogglingBroadcastId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [programsResponse, classesResponse] = await Promise.all([
        getRequest(ROUTES.broadcasts.educationInstitutionPrograms(institutionId), { errorMessage: 'Unable to load programs.', forceNetwork: true }),
        getRequest(ROUTES.broadcasts.educationInstitutionClasses(institutionId), { errorMessage: 'Unable to load classes.', forceNetwork: true }),
      ]);
      if (programsResponse?.success) setPrograms(programsResponse.data?.programs ?? []);
      if (classesResponse?.success) setClasses(classesResponse.data?.classes ?? []);
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

  const { programAssociated, standalone } = useMemo(() => {
    const withProgram = classes.filter(c => c.program_id);
    const without = classes.filter(c => !c.program_id);
    return { programAssociated: withProgram, standalone: without };
  }, [classes]);

  const toggleProgramBroadcast = useCallback(async (program: any) => {
    setTogglingBroadcastId(program.id);
    try {
      if (program.broadcast_id) {
        const response = await patchRequest(
          ROUTES.broadcasts.educationInstitutionBroadcast(institutionId, program.broadcast_id),
          { status: 'draft' },
          { errorMessage: 'Unable to remove this program from broadcast.' },
        );
        if (!response?.success) {
          Alert.alert('Broadcast', response?.message || 'Unable to remove this program from broadcast.');
          return;
        }
      } else {
        const response = await postRequest(
          ROUTES.broadcasts.educationInstitutionBroadcasts(institutionId),
          { program_id: program.id, broadcast_kind: 'program', status: 'published' },
          { errorMessage: 'Unable to broadcast this program.' },
        );
        if (!response?.success) {
          Alert.alert('Broadcast', response?.message || 'Unable to broadcast this program.');
          return;
        }
      }
      await load();
    } finally {
      setTogglingBroadcastId(null);
    }
  }, [institutionId, load]);

  const toggleClassBroadcast = useCallback(async (cls: any) => {
    setTogglingBroadcastId(cls.id);
    try {
      if (cls.broadcast_id) {
        const response = await patchRequest(
          ROUTES.broadcasts.educationInstitutionBroadcast(institutionId, cls.broadcast_id),
          { status: 'draft' },
          { errorMessage: 'Unable to remove this class from broadcast.' },
        );
        if (!response?.success) {
          Alert.alert('Broadcast', response?.message || 'Unable to remove this class from broadcast.');
          return;
        }
      } else {
        const response = await postRequest(
          ROUTES.broadcasts.educationInstitutionBroadcasts(institutionId),
          { institution_class_id: cls.id, broadcast_kind: 'institution_class', status: 'published' },
          { errorMessage: 'Unable to broadcast this class.' },
        );
        if (!response?.success) {
          Alert.alert('Broadcast', response?.message || 'Unable to broadcast this class.');
          return;
        }
      }
      await load();
    } finally {
      setTogglingBroadcastId(null);
    }
  }, [institutionId, load]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }}>
      <EducationScreenScaffold
        palette={palette}
        breadcrumb={institutionName}
        title="Programs & Classes"
        onBack={() => navigation.goBack()}
        scrollable={false}
        contentContainerStyle={{ flex: 1, padding: 0 }}
      >
        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: responsive.pageGutter, paddingVertical: 12 }}>
          {TOP_TABS.map(t => (
            <Text
              key={t.key}
              onPress={() => setTopTab(t.key)}
              style={{
                flex: 1, textAlign: 'center', paddingVertical: 10, borderRadius: 10, borderWidth: 1,
                borderColor: topTab === t.key ? palette.primary : palette.border,
                backgroundColor: topTab === t.key ? palette.primarySoft : 'transparent',
                color: topTab === t.key ? palette.primaryStrong : palette.subtext, fontWeight: '800', fontSize: 14,
              }}
            >
              {t.label}
            </Text>
          ))}
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: responsive.pageGutter, gap: 10, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={palette.primary} />}
        >
          {topTab === 'programs' ? (
            <View style={{ gap: 10 }}>
              <EducationActionButton
                palette={palette}
                label="+ Add Program"
                onPress={() => navigation.navigate('EducationProgramForm', { institutionId, institutionName })}
              />
              {loading && programs.length === 0 ? (
                <ActivityIndicator color={palette.primary} style={{ marginTop: 30 }} />
              ) : programs.length === 0 ? (
                <EducationEmptyState palette={palette} title="No programs yet" description="A Program is a major educational track — a degree, diploma, certificate, or similar." />
              ) : (
                programs.map(program => (
                  <EducationListCard
                    key={program.id}
                    palette={palette}
                    title={program.title}
                    subtitle={[program.program_type, program.duration_value && program.duration_unit ? `${program.duration_value} ${program.duration_unit}` : null, `${program.class_count ?? 0} classes`, `${program.course_count ?? 0} courses`].filter(Boolean).join(' · ')}
                    statusLabel={program.status}
                    statusTone={program.status === 'published' ? 'success' : 'muted'}
                    onPress={() => navigation.push('EducationProgramDashboard', { institutionId, institutionName, programId: program.id, programTitle: program.title })}
                    primaryAction={
                      <EducationActionButton
                        palette={palette}
                        label="Open"
                        onPress={() => navigation.push('EducationProgramDashboard', { institutionId, institutionName, programId: program.id, programTitle: program.title })}
                      />
                    }
                    secondaryAction={
                      <EducationActionButton
                        palette={palette}
                        label={togglingBroadcastId === program.id ? '…' : program.broadcast_id ? 'Remove from Broadcast' : 'Broadcast'}
                        variant="ghost"
                        disabled={togglingBroadcastId === program.id}
                        onPress={() => void toggleProgramBroadcast(program)}
                      />
                    }
                  />
                ))
              )}
            </View>
          ) : (
            <View style={{ gap: 16 }}>
              <EducationActionButton
                palette={palette}
                label="+ Add Class"
                onPress={() => navigation.navigate('EducationClassForm', { institutionId, institutionName })}
              />

              <View style={{ gap: 10 }}>
                <Text style={{ fontSize: 15, fontWeight: '800', color: palette.text }}>Program-associated Classes</Text>
                {programAssociated.length === 0 ? (
                  <Text style={{ fontSize: 13, color: palette.subtext }}>No program-associated classes yet.</Text>
                ) : (
                  programAssociated.map(cls => (
                    <ClassRow
                      key={cls.id}
                      cls={cls}
                      palette={palette}
                      togglingBroadcastId={togglingBroadcastId}
                      onOpen={() => navigation.push('EducationClassDashboard', { institutionId, institutionName, classId: cls.id, className: cls.name })}
                      onToggleBroadcast={() => void toggleClassBroadcast(cls)}
                    />
                  ))
                )}
              </View>

              <View style={{ gap: 10 }}>
                <Text style={{ fontSize: 15, fontWeight: '800', color: palette.text }}>Standalone Classes</Text>
                {standalone.length === 0 ? (
                  <Text style={{ fontSize: 13, color: palette.subtext }}>No standalone classes yet.</Text>
                ) : (
                  standalone.map(cls => (
                    <ClassRow
                      key={cls.id}
                      cls={cls}
                      palette={palette}
                      togglingBroadcastId={togglingBroadcastId}
                      onOpen={() => navigation.push('EducationClassDashboard', { institutionId, institutionName, classId: cls.id, className: cls.name })}
                      onToggleBroadcast={() => void toggleClassBroadcast(cls)}
                    />
                  ))
                )}
              </View>
            </View>
          )}
        </ScrollView>
      </EducationScreenScaffold>
    </SafeAreaView>
  );
}

function ClassRow({
  cls,
  palette,
  togglingBroadcastId,
  onOpen,
  onToggleBroadcast,
}: {
  cls: any;
  palette: any;
  togglingBroadcastId: string | null;
  onOpen: () => void;
  onToggleBroadcast: () => void;
}) {
  return (
    <EducationListCard
      palette={palette}
      title={cls.name}
      subtitle={[cls.program_title ? `Program: ${cls.program_title}` : 'Standalone', `${cls.course_count ?? 0} courses`].filter(Boolean).join(' · ')}
      statusLabel={cls.status}
      statusTone={cls.status === 'published' ? 'success' : 'muted'}
      onPress={onOpen}
      primaryAction={<EducationActionButton palette={palette} label="Open" onPress={onOpen} />}
      secondaryAction={
        <EducationActionButton
          palette={palette}
          label={togglingBroadcastId === cls.id ? '…' : cls.broadcast_id ? 'Remove from Broadcast' : 'Broadcast'}
          variant="ghost"
          disabled={togglingBroadcastId === cls.id}
          onPress={onToggleBroadcast}
        />
      }
    />
  );
}
