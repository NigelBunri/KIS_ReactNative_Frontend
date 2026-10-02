// src/screens/education/provider/BroadcastsScreen.tsx
//
// Education UX v2 — real "Broadcasts" destination. The v2 rewrite's first
// pass auto-syncs a course's own Broadcast record when its status flips to
// published (see CourseBuilderScreen's saveDetails), which covers the
// `course` broadcast_kind. It deliberately left everything else out:
// - `institution_notice` broadcasts (pure announcements with no
//   program/course/lesson/class_session/event target) have no other home
//   in the new IA at all.
// - `program` / `lesson` / `class_session` / `training_session` / `event`
//   broadcasts still need a manual publish step exactly like the old
//   modal's Broadcasts module — nothing auto-syncs those.
// This screen restores that capability as its own destination instead of
// the old modal's generic module-list/detail pair. Field set and payload
// shape match the old modal exactly (see EducationManagementModal.tsx git
// history, BROADCAST_KIND_OPTIONS / BROADCAST_STATUS_OPTIONS and the
// broadcasts case in its save handler) — same backend contract, new UI.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useNavigation, useRoute, useFocusEffect, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import KISTextInput from '@/constants/KISTextInput';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { patchRequest } from '@/network/patch';
import type { RootStackParamList } from '@/navigation/types';
import {
  EducationScreenScaffold,
  EducationSectionCard,
  EducationListCard,
  EducationEmptyState,
  EducationActionButton,
} from '@/screens/education/shared/components';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route_ = RouteProp<RootStackParamList, 'EducationBroadcasts'>;

// Must match apps.broadcasts.models.EducationBroadcastKind exactly.
const BROADCAST_KIND_OPTIONS: Array<{ value: string; label: string; needsLink: boolean; lookupKey?: 'courses' | 'events' }> = [
  { value: 'institution_notice', label: 'Announcement', needsLink: false },
  { value: 'institution', label: 'Institution Spotlight', needsLink: false },
  { value: 'course', label: 'Course', needsLink: true, lookupKey: 'courses' },
  { value: 'program', label: 'Program', needsLink: false },
  { value: 'lesson', label: 'Lesson', needsLink: false },
  { value: 'class_session', label: 'Class session', needsLink: false },
  { value: 'training_session', label: 'Training session', needsLink: false },
  { value: 'event', label: 'Event', needsLink: true, lookupKey: 'events' },
];

// Must match apps.broadcasts.models.EducationBroadcastStatus exactly.
const STATUS_FILTERS: Array<{ key: string; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'published', label: 'Published' },
  { key: 'draft', label: 'Draft' },
  { key: 'archived', label: 'Archived' },
];

const emptyForm = () => ({
  id: '' as string,
  title: '',
  summary: '',
  description: '',
  broadcast_kind: 'institution_notice',
  course_id: '',
  event_id: '',
  status: 'published' as 'draft' | 'published' | 'archived',
});

export default function BroadcastsScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route_>();
  const { institutionId, institutionName } = route.params;
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();

  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [formVisible, setFormVisible] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (forceNetwork = false) => {
    setLoading(true);
    try {
      const [broadcastsRes, coursesRes, eventsRes] = await Promise.all([
        getRequest(ROUTES.broadcasts.educationInstitutionBroadcasts(institutionId), { forceNetwork }),
        getRequest(ROUTES.broadcasts.educationInstitutionCourses(institutionId), { forceNetwork }),
        getRequest(ROUTES.broadcasts.educationInstitutionEvents(institutionId), { forceNetwork }),
      ]);
      setBroadcasts(broadcastsRes?.data?.broadcasts ?? []);
      setCourses(coursesRes?.data?.courses ?? []);
      setEvents(eventsRes?.data?.events ?? []);
    } finally {
      setLoading(false);
    }
  }, [institutionId]);

  useEffect(() => {
    load(true);
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load(true);
    }, [load]),
  );

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return broadcasts;
    return broadcasts.filter(row => row.status === statusFilter);
  }, [broadcasts, statusFilter]);

  const lookupsByKind = useMemo(
    () => ({ courses, events }),
    [courses, events],
  );

  const openCreate = useCallback(() => {
    setForm(emptyForm());
    setFormVisible(true);
  }, []);

  const openEdit = useCallback((broadcast: any) => {
    setForm({
      id: broadcast.id,
      title: broadcast.title ?? '',
      summary: broadcast.summary ?? '',
      description: broadcast.description ?? '',
      broadcast_kind: broadcast.broadcast_kind ?? 'institution_notice',
      course_id: broadcast.course_id ?? '',
      event_id: broadcast.event_id ?? '',
      status: broadcast.status ?? 'draft',
    });
    setFormVisible(true);
  }, []);

  const closeForm = useCallback(() => {
    setFormVisible(false);
    setForm(emptyForm());
  }, []);

  const save = useCallback(async () => {
    if (!form.title.trim()) {
      Alert.alert('Broadcast', 'Give this broadcast a title first.');
      return;
    }
    const kindOption = BROADCAST_KIND_OPTIONS.find(k => k.value === form.broadcast_kind);
    if (kindOption?.needsLink) {
      const linked = kindOption.lookupKey === 'courses' ? form.course_id : form.event_id;
      if (!linked) {
        Alert.alert('Broadcast', `Pick which ${kindOption.label.toLowerCase()} this broadcasts.`);
        return;
      }
    }
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        title: form.title.trim(),
        summary: form.summary.trim(),
        description: form.description.trim(),
        broadcast_kind: form.broadcast_kind,
        status: form.status,
        course_id: form.broadcast_kind === 'course' ? form.course_id || undefined : undefined,
        event_id: form.broadcast_kind === 'event' ? form.event_id || undefined : undefined,
      };
      const response = form.id
        ? await patchRequest(ROUTES.broadcasts.educationInstitutionBroadcast(institutionId, form.id), payload, { errorMessage: 'Unable to save broadcast.' })
        : await postRequest(ROUTES.broadcasts.educationInstitutionBroadcasts(institutionId), payload, { errorMessage: 'Unable to create broadcast.' });
      if (!response?.success) {
        Alert.alert('Broadcast', response?.message || 'Unable to save broadcast.');
        return;
      }
      closeForm();
      await load(true);
    } finally {
      setSaving(false);
    }
  }, [form, institutionId, closeForm, load]);

  const archive = useCallback(
    (broadcast: any) => {
      Alert.alert(
        'Remove broadcast',
        'This will be marked as archived and hidden from learners until you publish it again.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: async () => {
              const response = await patchRequest(
                ROUTES.broadcasts.educationInstitutionBroadcast(institutionId, broadcast.id),
                { status: 'archived' },
                { errorMessage: 'Unable to remove broadcast.' },
              );
              if (response?.success) await load(true);
            },
          },
        ],
      );
    },
    [institutionId, load],
  );

  const kindLabel = (kind: string) => BROADCAST_KIND_OPTIONS.find(k => k.value === kind)?.label ?? kind;
  const statusTone = (status: string) => (status === 'published' ? 'success' : status === 'archived' ? 'muted' : 'warning');
  const selectedKindOption = BROADCAST_KIND_OPTIONS.find(k => k.value === form.broadcast_kind);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }}>
      <EducationScreenScaffold
        palette={palette}
        breadcrumb={institutionName}
        title="Broadcasts"
        subtitle="Publish announcements and broadcast your programs, lessons, live sessions, and events so learners can discover them."
        onBack={() => navigation.goBack()}
        actions={<EducationActionButton palette={palette} label="+ New" onPress={openCreate} />}
        scrollable={false}
        contentContainerStyle={{ flex: 1, padding: 0 }}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: responsive.pageGutter, gap: 16, paddingBottom: 60 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={() => load(true)} tintColor={palette.primary} />}
        >
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            {STATUS_FILTERS.map(f => (
              <Pressable
                key={f.key}
                onPress={() => setStatusFilter(f.key)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 7,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: statusFilter === f.key ? palette.primary : palette.border,
                  backgroundColor: statusFilter === f.key ? palette.primarySoft : 'transparent',
                }}
              >
                <Text style={{ fontWeight: '700', fontSize: 13, color: statusFilter === f.key ? palette.primaryStrong : palette.subtext }}>
                  {f.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {formVisible ? (
            <EducationSectionCard
              palette={palette}
              eyebrow={form.id ? 'Edit broadcast' : 'New broadcast'}
              title={form.id ? 'Update this broadcast' : 'Create a broadcast'}
              description="Announcements have no target. Everything else links to an existing record so learners land on the right place."
            >
              <View style={{ gap: 10, marginTop: 6 }}>
                <KISTextInput placeholder="Title" value={form.title} onChangeText={v => setForm(prev => ({ ...prev, title: v }))} />
                <KISTextInput
                  placeholder="Summary (short, shown in lists)"
                  value={form.summary}
                  onChangeText={v => setForm(prev => ({ ...prev, summary: v }))}
                />
                <KISTextInput
                  placeholder="Description (optional, full detail)"
                  value={form.description}
                  onChangeText={v => setForm(prev => ({ ...prev, description: v }))}
                  multiline
                  style={{ minHeight: 80 }}
                />

                <Text style={{ fontSize: 12, fontWeight: '700', color: palette.subtext }}>Kind</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {BROADCAST_KIND_OPTIONS.map(kind => (
                    <Pressable
                      key={kind.value}
                      onPress={() => setForm(prev => ({ ...prev, broadcast_kind: kind.value }))}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 7,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: form.broadcast_kind === kind.value ? palette.primary : palette.border,
                        backgroundColor: form.broadcast_kind === kind.value ? palette.primarySoft : 'transparent',
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '700', color: form.broadcast_kind === kind.value ? palette.primaryStrong : palette.subtext }}>
                        {kind.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {selectedKindOption?.needsLink ? (
                  <View style={{ gap: 6 }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: palette.subtext }}>
                      Which {selectedKindOption.label.toLowerCase()}?
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                      {(selectedKindOption.lookupKey === 'courses' ? lookupsByKind.courses : lookupsByKind.events).map((row: any) => {
                        const field = selectedKindOption.lookupKey === 'courses' ? 'course_id' : 'event_id';
                        const selected = (form as any)[field] === row.id;
                        return (
                          <Pressable
                            key={row.id}
                            onPress={() => setForm(prev => ({ ...prev, [field]: row.id } as any))}
                            style={{
                              paddingHorizontal: 12,
                              paddingVertical: 7,
                              borderRadius: 999,
                              borderWidth: 1,
                              borderColor: selected ? palette.primary : palette.border,
                              backgroundColor: selected ? palette.primarySoft : 'transparent',
                            }}
                          >
                            <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: '700', color: selected ? palette.primaryStrong : palette.subtext, maxWidth: 160 }}>
                              {row.title}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  </View>
                ) : null}

                <Text style={{ fontSize: 12, fontWeight: '700', color: palette.subtext }}>Status</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {(['draft', 'published'] as const).map(s => (
                    <Pressable
                      key={s}
                      onPress={() => setForm(prev => ({ ...prev, status: s }))}
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 7,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: form.status === s ? palette.primary : palette.border,
                        backgroundColor: form.status === s ? palette.primarySoft : 'transparent',
                      }}
                    >
                      <Text style={{ fontWeight: '700', fontSize: 13, textTransform: 'capitalize', color: form.status === s ? palette.primaryStrong : palette.subtext }}>
                        {s}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                  <EducationActionButton palette={palette} label={saving ? 'Saving…' : 'Save'} onPress={() => void save()} disabled={saving} />
                  <EducationActionButton palette={palette} label="Cancel" variant="secondary" onPress={closeForm} disabled={saving} />
                </View>
              </View>
            </EducationSectionCard>
          ) : null}

          {loading && filtered.length === 0 ? <ActivityIndicator color={palette.primary} style={{ marginTop: 24 }} /> : null}

          {!loading && filtered.length === 0 ? (
            <EducationEmptyState
              palette={palette}
              title="No broadcasts yet"
              description="Publish an announcement or broadcast a program, lesson, live session, or event so learners can find it."
              action={<EducationActionButton palette={palette} label="+ New broadcast" onPress={openCreate} />}
            />
          ) : (
            <View style={{ gap: 10, marginTop: formVisible ? 14 : 0 }}>
              {filtered.map(broadcast => (
                <EducationListCard
                  key={broadcast.id}
                  palette={palette}
                  eyebrow={kindLabel(broadcast.broadcast_kind)}
                  title={broadcast.title}
                  subtitle={broadcast.summary}
                  statusLabel={broadcast.status}
                  statusTone={statusTone(broadcast.status) as any}
                  onPress={() => openEdit(broadcast)}
                  primaryAction={
                    <EducationActionButton palette={palette} label="Edit" variant="secondary" onPress={() => openEdit(broadcast)} />
                  }
                  secondaryAction={
                    broadcast.status !== 'archived' ? (
                      <EducationActionButton palette={palette} label="Remove" variant="ghost" onPress={() => archive(broadcast)} />
                    ) : undefined
                  }
                />
              ))}
            </View>
          )}
        </ScrollView>
      </EducationScreenScaffold>
    </SafeAreaView>
  );
}
