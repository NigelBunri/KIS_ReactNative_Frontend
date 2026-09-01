// src/components/partners/PartnerTrainingTracksPanel.tsx
//
// Training Tracks: admins assemble ordered sequences of existing Bible
// courses into a track, assign the track to individual members or an
// entire department, and monitor per-member completion. Every member
// also sees their own assigned tracks with a live progress bar, derived
// server-side from their course/lesson progress (apps/bible).
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import styles from '@/components/partners/partnersStyles';
import { useKISTheme } from '@/theme/useTheme';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';

type Props = {
  isOpen: boolean;
  panelWidth: number;
  panelTranslateX: Animated.Value;
  partnerId?: string | null;
  onClose: () => void;
};

type Course = { id: string | number; title: string };
type TrackItem = {
  id: string | number;
  course: string | number;
  order: number;
  course_title: string;
  course_progress_percent: number;
  course_enrollment_status: string | null;
};
type Track = {
  id: string | number;
  title: string;
  description?: string;
  items: TrackItem[];
  item_count: number;
  assignment_count: number;
  is_assigned: boolean;
  my_status: string;
  my_progress_percent: number;
};
type Department = { id: string | number; name: string };
type MemberOption = { user_id: string; display_name?: string | null; username?: string | null };
type RosterRow = {
  user_id: string;
  user_name: string;
  department_id: string | number | null;
  department_name: string | null;
  assigned_at: string;
  status: string;
  progress_percent: number;
  completed_at: string | null;
};

const inputStyle = (palette: any) => ({
  color: palette.text,
  borderColor: palette.borderMuted,
  borderWidth: 2,
  paddingHorizontal: 10,
  paddingVertical: 8,
  borderRadius: 10,
  marginTop: 8,
});

const statusLabel: Record<string, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  completed: 'Completed',
};

function ProgressBar({ percent, palette }: { percent: number; palette: any }) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <View style={{ height: 6, borderRadius: 999, backgroundColor: palette.borderMuted, overflow: 'hidden', marginTop: 6 }}>
      <View style={{ height: '100%', width: `${clamped}%`, borderRadius: 999, backgroundColor: palette.primary }} />
    </View>
  );
}

export default function PartnerTrainingTracksPanel({ isOpen, panelWidth, panelTranslateX, partnerId, onClose }: Props) {
  const { palette } = useKISTheme();
  const [loading, setLoading] = useState(false);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [saving, setSaving] = useState(false);

  const [selectedTrackId, setSelectedTrackId] = useState<string | number | null>(null);
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');

  const [assignDeptId, setAssignDeptId] = useState<string | null>(null);
  const [assignUserIds, setAssignUserIds] = useState<string[]>([]);

  const backdropOpacity = panelTranslateX.interpolate({ inputRange: [0, panelWidth], outputRange: [1, 0], extrapolate: 'clamp' });

  const load = useCallback(async () => {
    if (!partnerId) return;
    const [trackRes, courseRes, depRes, memberRes] = await Promise.all([
      getRequest(`${ROUTES.bible.courseTracks}?partner=${partnerId}`, { errorMessage: 'Unable to load training tracks.' }),
      getRequest(`${ROUTES.bible.courses}?partner=${partnerId}`, { errorMessage: 'Unable to load courses.' }),
      getRequest(ROUTES.partners.departments(partnerId), { errorMessage: 'Unable to load departments.' }),
      getRequest(`${ROUTES.partners.members(partnerId)}?page=1`, { errorMessage: 'Unable to load members.' }),
    ]);
    const trackPayload = trackRes?.data?.results ?? trackRes?.data ?? [];
    setTracks(Array.isArray(trackPayload) ? trackPayload : []);
    const coursePayload = courseRes?.data?.results ?? courseRes?.data ?? [];
    setCourses(Array.isArray(coursePayload) ? coursePayload : []);
    const depPayload = depRes?.data ?? depRes ?? [];
    setDepartments(Array.isArray(depPayload) ? depPayload : []);
    const memberPayload = memberRes?.data ?? memberRes ?? {};
    const memberList = (memberPayload.results ?? memberPayload.members ?? []) as MemberOption[];
    setMembers(Array.isArray(memberList) ? memberList : []);
  }, [partnerId]);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [isOpen, load]);

  const selectedTrack = useMemo(
    () => tracks.find((t) => String(t.id) === String(selectedTrackId)) ?? null,
    [tracks, selectedTrackId],
  );

  const loadRoster = useCallback(async (trackId: string | number) => {
    setRosterLoading(true);
    const res = await getRequest(ROUTES.bible.courseTrackRoster(trackId), { errorMessage: 'Unable to load roster.' });
    const payload = (res?.data ?? []) as RosterRow[];
    setRoster(Array.isArray(payload) ? payload : []);
    setRosterLoading(false);
  }, []);

  const openTrack = (track: Track) => {
    setSelectedTrackId(track.id);
    setAssignDeptId(null);
    setAssignUserIds([]);
    loadRoster(track.id);
  };

  const createTrack = async () => {
    if (!partnerId || !newTitle.trim()) {
      Alert.alert('Missing info', 'Track title is required.');
      return;
    }
    setSaving(true);
    const res = await postRequest(
      ROUTES.bible.courseTracks,
      { partner: partnerId, title: newTitle.trim(), description: newDescription.trim() },
      { errorMessage: 'Unable to create track.' },
    );
    setSaving(false);
    if (!res?.success) {
      Alert.alert('Failed', res?.message ?? 'Unable to create track.');
      return;
    }
    setNewTitle('');
    setNewDescription('');
    setShowCreate(false);
    load();
  };

  const addCourseToTrack = async (courseId: string | number) => {
    if (!selectedTrack) return;
    const nextOrder = (selectedTrack.items?.length ?? 0) + 1;
    const res = await postRequest(
      ROUTES.bible.courseTrackItems,
      { track: selectedTrack.id, course: courseId, order: nextOrder },
      { errorMessage: 'Unable to add course to track.' },
    );
    if (!res?.success) {
      Alert.alert('Failed', res?.message ?? 'Unable to add course to track.');
      return;
    }
    load();
  };

  const removeTrackItem = async (item: TrackItem) => {
    const { deleteRequest } = await import('@/network/delete');
    const res = await deleteRequest(ROUTES.bible.courseTrackItemDetail(item.id), {
      errorMessage: 'Unable to remove course from track.',
    });
    if (!res?.success) {
      Alert.alert('Failed', res?.message ?? 'Unable to remove course from track.');
      return;
    }
    load();
  };

  const toggleAssignUser = (id: string) => {
    setAssignUserIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const assignTrack = async () => {
    if (!selectedTrack) return;
    if (!assignDeptId && assignUserIds.length === 0) {
      Alert.alert('Training Tracks', 'Choose a department or select at least one member.');
      return;
    }
    setSaving(true);
    const res = await postRequest(
      ROUTES.bible.courseTrackAssign(selectedTrack.id),
      { user_ids: assignUserIds, department: assignDeptId },
      { errorMessage: 'Unable to assign track.' },
    );
    setSaving(false);
    if (!res?.success) {
      Alert.alert('Failed', res?.message ?? 'Unable to assign track.');
      return;
    }
    setAssignDeptId(null);
    setAssignUserIds([]);
    loadRoster(selectedTrack.id);
    load();
  };

  const unassignUser = (row: RosterRow) => {
    if (!selectedTrack) return;
    Alert.alert('Remove from track?', `${row.user_name} will lose this assignment.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const res = await postRequest(
            ROUTES.bible.courseTrackUnassign(selectedTrack.id),
            { user_id: row.user_id },
            { errorMessage: 'Unable to remove assignment.' },
          );
          if (!res?.success) {
            Alert.alert('Failed', res?.message ?? 'Unable to remove assignment.');
            return;
          }
          loadRoster(selectedTrack.id);
          load();
        },
      },
    ]);
  };

  if (!isOpen) return null;

  const memberName = (m: MemberOption) => m.display_name || m.username || 'Member';
  const availableCourses = selectedTrack
    ? courses.filter((c) => !selectedTrack.items.some((item) => String(item.course) === String(c.id)))
    : [];

  return (
    <View style={styles.settingsPanelOverlay} pointerEvents="box-none">
      <Animated.View style={[styles.settingsPanelBackdrop, { backgroundColor: palette.backdrop, opacity: backdropOpacity }]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          styles.settingsPanelContainer,
          { width: panelWidth, backgroundColor: palette.surfaceElevated, borderLeftColor: palette.divider, transform: [{ translateX: panelTranslateX }] },
        ]}
      >
        <View style={[styles.settingsPanelHeader, { borderBottomColor: palette.divider }]}>
          <Pressable
            onPress={() => (selectedTrackId ? setSelectedTrackId(null) : onClose())}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <Text style={{ color: palette.text, fontSize: 18 }}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingsPanelTitle, { color: palette.text }]}>
              {selectedTrack ? selectedTrack.title : 'Training Tracks'}
            </Text>
            <Text style={[styles.settingsPanelDescription, { color: palette.subtext }]}>
              {selectedTrack ? 'Courses, assignment and roster' : 'Structured learning paths for your members'}
            </Text>
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.settingsPanelBody} showsVerticalScrollIndicator={false}>
          {loading ? (
            <ActivityIndicator size="small" color={palette.primary} />
          ) : selectedTrack ? (
            <>
              {selectedTrack.description ? (
                <Text style={{ color: palette.subtext, fontSize: 13, marginBottom: 16 }}>{selectedTrack.description}</Text>
              ) : null}

              {selectedTrack.is_assigned ? (
                <View style={[styles.settingsFeatureRow, { borderColor: palette.primary, backgroundColor: palette.surface, marginBottom: 16 }]}>
                  <Text style={[styles.settingsFeatureTitle, { color: palette.text }]}>Your progress</Text>
                  <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 2 }}>
                    {statusLabel[selectedTrack.my_status] ?? selectedTrack.my_status} · {selectedTrack.my_progress_percent}%
                  </Text>
                  <ProgressBar percent={selectedTrack.my_progress_percent} palette={palette} />
                </View>
              ) : null}

              <Text style={{ color: palette.text, fontSize: 14, fontWeight: '800', marginBottom: 8 }}>
                Courses in this track ({selectedTrack.items.length})
              </Text>
              {selectedTrack.items.length === 0 ? (
                <Text style={{ color: palette.subtext, fontSize: 13, marginBottom: 12 }}>No courses added yet.</Text>
              ) : (
                selectedTrack.items
                  .slice()
                  .sort((a, b) => a.order - b.order)
                  .map((item, index) => (
                    <View key={item.id} style={[styles.settingsFeatureRow, { borderColor: palette.borderMuted, backgroundColor: palette.surface, marginBottom: 8 }]}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={[styles.settingsFeatureTitle, { color: palette.text }]}>
                          {index + 1}. {item.course_title}
                        </Text>
                        <Pressable onPress={() => removeTrackItem(item)}>
                          <Text style={{ color: palette.danger, fontSize: 12, fontWeight: '700' }}>Remove</Text>
                        </Pressable>
                      </View>
                      <Text style={{ color: palette.subtext, fontSize: 11, marginTop: 2 }}>
                        {item.course_enrollment_status ? statusLabel[item.course_enrollment_status] ?? item.course_enrollment_status : 'Not enrolled'}
                        {' · '}
                        {item.course_progress_percent}%
                      </Text>
                    </View>
                  ))
              )}

              {availableCourses.length > 0 ? (
                <>
                  <Text style={{ color: palette.subtext, fontSize: 11, marginTop: 8, marginBottom: 6 }}>Add a course</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 16 }}>
                    {availableCourses.map((course) => (
                      <Pressable
                        key={course.id}
                        onPress={() => addCourseToTrack(course.id)}
                        style={{ borderWidth: 1, borderColor: palette.divider, backgroundColor: palette.surface, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 }}
                      >
                        <Text numberOfLines={1} style={{ color: palette.text, fontWeight: '700', maxWidth: 180 }}>
                          + {course.title}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </>
              ) : null}

              <Text style={{ color: palette.text, fontSize: 14, fontWeight: '800', marginTop: 8, marginBottom: 8 }}>
                Assign this track
              </Text>
              <Text style={{ color: palette.subtext, fontSize: 11, marginBottom: 4 }}>Whole department</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {departments.length === 0 ? (
                  <Text style={{ color: palette.subtext, fontSize: 12 }}>No departments yet.</Text>
                ) : (
                  departments.map((dep) => {
                    const selected = assignDeptId === String(dep.id);
                    return (
                      <Pressable
                        key={dep.id}
                        onPress={() => setAssignDeptId(selected ? null : String(dep.id))}
                        style={{ paddingVertical: 5, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: selected ? palette.primary : palette.borderMuted }}
                      >
                        <Text style={{ color: selected ? palette.primary : palette.text, fontSize: 12 }}>{dep.name}</Text>
                      </Pressable>
                    );
                  })
                )}
              </View>
              <Text style={{ color: palette.subtext, fontSize: 11, marginBottom: 4 }}>Or specific members</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {members.map((m) => {
                  const selected = assignUserIds.includes(m.user_id);
                  return (
                    <Pressable
                      key={m.user_id}
                      onPress={() => toggleAssignUser(m.user_id)}
                      style={{ paddingVertical: 5, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: selected ? palette.primary : palette.borderMuted }}
                    >
                      <Text style={{ color: selected ? palette.primary : palette.text, fontSize: 12 }}>{memberName(m)}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Pressable
                onPress={assignTrack}
                disabled={saving}
                style={({ pressed }) => [{ paddingVertical: 10, borderRadius: 10, backgroundColor: palette.royalInk, alignItems: 'center', opacity: pressed || saving ? 0.7 : 1, marginBottom: 20 }]}
              >
                <Text style={{ color: palette.ivory, fontWeight: '700' }}>{saving ? 'Assigning…' : 'Assign track'}</Text>
              </Pressable>

              <Text style={{ color: palette.text, fontSize: 14, fontWeight: '800', marginBottom: 8 }}>
                Roster ({roster.length})
              </Text>
              {rosterLoading ? (
                <ActivityIndicator size="small" color={palette.primary} />
              ) : roster.length === 0 ? (
                <Text style={{ color: palette.subtext, fontSize: 13 }}>Not assigned to anyone yet.</Text>
              ) : (
                roster.map((row) => (
                  <View key={row.user_id} style={[styles.settingsFeatureRow, { borderColor: palette.borderMuted, backgroundColor: palette.surface, marginBottom: 8 }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={[styles.settingsFeatureTitle, { color: palette.text }]}>{row.user_name}</Text>
                      <Pressable onPress={() => unassignUser(row)}>
                        <Text style={{ color: palette.danger, fontSize: 12, fontWeight: '700' }}>Remove</Text>
                      </Pressable>
                    </View>
                    <Text style={{ color: palette.subtext, fontSize: 11, marginTop: 2 }}>
                      {row.department_name ? `${row.department_name} · ` : ''}
                      {statusLabel[row.status] ?? row.status} · {row.progress_percent}%
                    </Text>
                    <ProgressBar percent={row.progress_percent} palette={palette} />
                  </View>
                ))
              )}
            </>
          ) : (
            <>
              <Pressable onPress={() => setShowCreate((v) => !v)}>
                <Text style={{ color: palette.primary, fontSize: 13, fontWeight: '700', marginBottom: showCreate ? 8 : 12 }}>
                  {showCreate ? '− Cancel new track' : '+ New training track'}
                </Text>
              </Pressable>
              {showCreate ? (
                <View style={{ marginBottom: 16 }}>
                  <TextInput value={newTitle} onChangeText={setNewTitle} placeholder="Track title" placeholderTextColor={palette.subtext} style={[inputStyle(palette), { marginTop: 0 }]} />
                  <TextInput value={newDescription} onChangeText={setNewDescription} placeholder="Description (optional)" placeholderTextColor={palette.subtext} multiline style={[inputStyle(palette), { minHeight: 50, textAlignVertical: 'top' }]} />
                  <Pressable
                    onPress={createTrack}
                    disabled={saving}
                    style={({ pressed }) => [{ marginTop: 10, paddingVertical: 10, borderRadius: 10, backgroundColor: palette.royalInk, alignItems: 'center', opacity: pressed || saving ? 0.7 : 1 }]}
                  >
                    <Text style={{ color: palette.ivory, fontWeight: '700' }}>{saving ? 'Creating…' : 'Create track'}</Text>
                  </Pressable>
                </View>
              ) : null}

              {tracks.length === 0 ? (
                <Text style={{ color: palette.subtext, fontSize: 13, textAlign: 'center', marginTop: 20 }}>No training tracks yet.</Text>
              ) : (
                tracks.map((track) => (
                  <Pressable
                    key={track.id}
                    onPress={() => openTrack(track)}
                    style={[styles.settingsFeatureRow, { borderColor: palette.borderMuted, backgroundColor: palette.surface, marginBottom: 8 }]}
                  >
                    <Text style={[styles.settingsFeatureTitle, { color: palette.text }]}>{track.title}</Text>
                    <Text style={{ color: palette.subtext, fontSize: 11, marginTop: 4 }}>
                      {track.item_count} course{track.item_count === 1 ? '' : 's'} · {track.assignment_count} assigned
                    </Text>
                    {track.is_assigned ? (
                      <>
                        <Text style={{ color: palette.subtext, fontSize: 11, marginTop: 4 }}>
                          Your progress: {statusLabel[track.my_status] ?? track.my_status} · {track.my_progress_percent}%
                        </Text>
                        <ProgressBar percent={track.my_progress_percent} palette={palette} />
                      </>
                    ) : null}
                  </Pressable>
                ))
              )}
            </>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}
