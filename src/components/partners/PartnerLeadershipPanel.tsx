// src/components/partners/PartnerLeadershipPanel.tsx
//
// Leadership & Org Tree — org chart, leadership directory, reporting
// lines, span of control, role alignment, and leadership scorecards, all
// derived from PartnerDepartment (Org Setup) + apps.tasks — plus
// categorized department notes covering succession planning, leadership
// goals, and onboarding paths. Nine of the twenty catalog entries
// (team_health, mentorship_routes, skills_matrix, capacity_planning,
// cross_team_projects, diversity_dashboard, conflict_resolution,
// role_requirements, org_announcements) have no real data source
// anywhere yet and are shown honestly rather than faked.
import React, { useCallback, useEffect, useState } from 'react';
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

type OrgTreeRow = { department_id: number; department_name: string; lead_id: string | null; lead_name: string | null; member_count: number };
type DirectoryRow = { user_id: string; display_name: string; department_name: string; direct_reports: number };
type ReportingRow = { user_id: string; display_name: string; reports_to_id: string; reports_to_name: string; department_name: string };
type ScorecardRow = { user_id: string; display_name: string; tasks_assigned: number; tasks_completed: number; completion_rate: number | null };
type Leadership = {
  org_tree: OrgTreeRow[];
  leadership_directory: DirectoryRow[];
  reporting_lines: ReportingRow[];
  span_of_control: DirectoryRow[];
  role_alignment: { unaligned_departments: { department_id: number; department_name: string }[]; total_departments: number };
  leadership_scorecards: ScorecardRow[];
  unavailable_metrics: string[];
};
type DeptNote = { id: number; department: number; category: string; title: string; body: string; created_by_name: string | null; created_at: string };

const NOTE_CATEGORY_LABELS: Record<string, string> = {
  general: 'General',
  succession: 'Succession planning',
  goals: 'Leadership goals',
  onboarding: 'Onboarding path',
};
const UNAVAILABLE_TITLES: Record<string, string> = {
  team_health: 'Team Health',
  mentorship_routes: 'Mentorship Routes',
  skills_matrix: 'Skills Matrix',
  capacity_planning: 'Capacity Planning',
  cross_team_projects: 'Cross-team Projects',
  diversity_dashboard: 'Diversity Dashboard',
  conflict_resolution: 'Conflict Resolution',
  role_requirements: 'Role Requirements',
  org_announcements: 'Org Announcements',
};

function SectionTitle({ children, palette }: { children: React.ReactNode; palette: any }) {
  return <Text style={[styles.settingsSectionTitle, { color: palette.text, marginBottom: 8, marginTop: 4 }]}>{children}</Text>;
}

export default function PartnerLeadershipPanel({ isOpen, panelWidth, panelTranslateX, partnerId, onClose }: Props) {
  const { palette } = useKISTheme();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Leadership | null>(null);
  const [notes, setNotes] = useState<DeptNote[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<number | null>(null);
  const [noteCategory, setNoteCategory] = useState('general');
  const [noteTitle, setNoteTitle] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [saving, setSaving] = useState(false);

  const backdropOpacity = panelTranslateX.interpolate({ inputRange: [0, panelWidth], outputRange: [1, 0], extrapolate: 'clamp' });

  const load = useCallback(async () => {
    if (!partnerId) return;
    const [leadershipRes, notesRes] = await Promise.all([
      getRequest(ROUTES.partners.leadership(partnerId), { errorMessage: 'Unable to load leadership data.' }),
      getRequest(ROUTES.partners.departmentNotes(partnerId), { errorMessage: 'Unable to load notes.' }),
    ]);
    const leadershipPayload = (leadershipRes?.data ?? leadershipRes ?? {}) as Leadership;
    setData(leadershipPayload);
    const notesPayload = (notesRes?.data ?? notesRes ?? []) as DeptNote[];
    setNotes(Array.isArray(notesPayload) ? notesPayload : []);
    if (!selectedDeptId && leadershipPayload.org_tree?.length) {
      setSelectedDeptId(leadershipPayload.org_tree[0].department_id);
    }
  }, [partnerId, selectedDeptId]);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [isOpen, load]);

  const addNote = async () => {
    if (!partnerId || !selectedDeptId || !noteBody.trim()) {
      Alert.alert('Missing info', 'Pick a department and write something.');
      return;
    }
    setSaving(true);
    const res = await postRequest(
      ROUTES.partners.departmentNotes(partnerId),
      { department: selectedDeptId, category: noteCategory, title: noteTitle.trim(), body: noteBody.trim() },
      { errorMessage: 'Unable to save note.' },
    );
    setSaving(false);
    if (!res?.success) {
      Alert.alert('Failed', res?.message ?? 'Unable to save note.');
      return;
    }
    setNoteTitle('');
    setNoteBody('');
    load();
  };

  const deleteNote = (note: DeptNote) => {
    if (!partnerId) return;
    Alert.alert('Delete note?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { deleteRequest } = await import('@/network/delete');
          const res = await deleteRequest(ROUTES.partners.departmentNoteDetail(partnerId, String(note.id)), { errorMessage: 'Unable to delete note.' });
          if (!res?.success) {
            Alert.alert('Failed', res?.message ?? 'Unable to delete note.');
            return;
          }
          load();
        },
      },
    ]);
  };

  if (!isOpen) return null;

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
          <Pressable onPress={onClose} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            <Text style={{ color: palette.text, fontSize: 18 }}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingsPanelTitle, { color: palette.text }]}>Leadership & Org Tree</Text>
            <Text style={[styles.settingsPanelDescription, { color: palette.subtext }]}>Departments, leads, and reporting lines</Text>
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.settingsPanelBody} showsVerticalScrollIndicator={false}>
          {loading || !data ? (
            <ActivityIndicator size="small" color={palette.primary} />
          ) : (
            <>
              <SectionTitle palette={palette}>Org Tree</SectionTitle>
              <View style={{ marginBottom: 16 }}>
                {data.org_tree.length === 0 ? (
                  <Text style={{ color: palette.subtext, fontSize: 12 }}>No departments yet — add one in Organization Setup.</Text>
                ) : (
                  data.org_tree.map((row) => (
                    <View key={row.department_id} style={[styles.settingsFeatureRow, { borderColor: palette.borderMuted, backgroundColor: palette.surface, marginBottom: 6 }]}>
                      <Text style={[styles.settingsFeatureTitle, { color: palette.text }]}>{row.department_name}</Text>
                      <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 2 }}>
                        {row.lead_name ? `Led by ${row.lead_name}` : 'No lead assigned'} · {row.member_count} member{row.member_count === 1 ? '' : 's'}
                      </Text>
                    </View>
                  ))
                )}
              </View>

              <SectionTitle palette={palette}>Leadership Directory</SectionTitle>
              <View style={{ marginBottom: 16 }}>
                {data.leadership_directory.length === 0 ? (
                  <Text style={{ color: palette.subtext, fontSize: 12 }}>No department leads assigned yet.</Text>
                ) : (
                  data.leadership_directory.map((row) => (
                    <Text key={row.user_id} style={{ color: palette.text, fontSize: 12, marginBottom: 6 }}>
                      {row.display_name} — {row.department_name} ({row.direct_reports} direct report{row.direct_reports === 1 ? '' : 's'})
                    </Text>
                  ))
                )}
              </View>

              <SectionTitle palette={palette}>Span of Control</SectionTitle>
              <View style={{ marginBottom: 16 }}>
                {data.span_of_control.map((row) => (
                  <View key={row.user_id} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={{ color: palette.text, fontSize: 12 }}>{row.display_name}</Text>
                    <Text style={{ color: palette.subtext, fontSize: 12 }}>{row.direct_reports}</Text>
                  </View>
                ))}
              </View>

              {data.role_alignment.unaligned_departments.length > 0 ? (
                <View style={[styles.settingsFeatureRow, { borderColor: palette.warning, backgroundColor: palette.surface, marginBottom: 16 }]}>
                  <Text style={{ color: palette.subtext, fontSize: 11, fontWeight: '700', marginBottom: 4 }}>Role Alignment</Text>
                  <Text style={{ color: palette.text, fontSize: 12 }}>
                    {data.role_alignment.unaligned_departments.length} of {data.role_alignment.total_departments} departments have no lead: {data.role_alignment.unaligned_departments.map((d) => d.department_name).join(', ')}
                  </Text>
                </View>
              ) : null}

              <SectionTitle palette={palette}>Leadership Scorecards</SectionTitle>
              <View style={{ marginBottom: 16 }}>
                {data.leadership_scorecards.length === 0 ? (
                  <Text style={{ color: palette.subtext, fontSize: 12 }}>No leads with tasks assigned yet.</Text>
                ) : (
                  data.leadership_scorecards.map((row) => (
                    <Text key={row.user_id} style={{ color: palette.text, fontSize: 12, marginBottom: 6 }}>
                      {row.display_name}: {row.tasks_completed}/{row.tasks_assigned} tasks completed
                      {row.completion_rate !== null ? ` (${Math.round(row.completion_rate * 100)}%)` : ''}
                    </Text>
                  ))
                )}
              </View>

              <SectionTitle palette={palette}>Notes (succession, goals, onboarding)</SectionTitle>
              {data.org_tree.length > 0 ? (
                <>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                    {data.org_tree.map((d) => (
                      <Pressable
                        key={d.department_id}
                        onPress={() => setSelectedDeptId(d.department_id)}
                        style={{ paddingVertical: 5, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: selectedDeptId === d.department_id ? palette.primary : palette.borderMuted }}
                      >
                        <Text style={{ color: selectedDeptId === d.department_id ? palette.primary : palette.text, fontSize: 12 }}>{d.department_name}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                    {Object.entries(NOTE_CATEGORY_LABELS).map(([key, label]) => (
                      <Pressable
                        key={key}
                        onPress={() => setNoteCategory(key)}
                        style={{ paddingVertical: 5, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: noteCategory === key ? palette.primary : palette.borderMuted }}
                      >
                        <Text style={{ color: noteCategory === key ? palette.primary : palette.text, fontSize: 12 }}>{label}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <TextInput
                    value={noteTitle}
                    onChangeText={setNoteTitle}
                    placeholder="Title (optional)"
                    placeholderTextColor={palette.subtext}
                    style={[styles.settingsTextInput, { borderColor: palette.borderMuted, color: palette.text, marginTop: 0 }]}
                  />
                  <TextInput
                    value={noteBody}
                    onChangeText={setNoteBody}
                    placeholder="Write a note…"
                    placeholderTextColor={palette.subtext}
                    multiline
                    style={[styles.settingsTextInput, { borderColor: palette.borderMuted, color: palette.text, minHeight: 60, textAlignVertical: 'top' }]}
                  />
                  <Pressable
                    onPress={addNote}
                    disabled={saving}
                    style={({ pressed }) => [{ marginTop: 8, paddingVertical: 8, borderRadius: 10, backgroundColor: palette.royalInk, alignItems: 'center', opacity: pressed || saving ? 0.7 : 1 }]}
                  >
                    <Text style={{ color: palette.ivory, fontWeight: '700', fontSize: 13 }}>{saving ? 'Saving…' : 'Add note'}</Text>
                  </Pressable>

                  <View style={{ marginTop: 12, marginBottom: 20 }}>
                    {notes.filter((n) => n.department === selectedDeptId).length === 0 ? (
                      <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 8 }}>No notes for this department yet.</Text>
                    ) : (
                      notes.filter((n) => n.department === selectedDeptId).map((note) => (
                        <View key={note.id} style={[styles.settingsFeatureRow, { borderColor: palette.borderMuted, backgroundColor: palette.surface, marginTop: 8 }]}>
                          <Text style={{ color: palette.subtext, fontSize: 10, fontWeight: '700' }}>{NOTE_CATEGORY_LABELS[note.category] || note.category}</Text>
                          {note.title ? <Text style={{ color: palette.text, fontSize: 13, fontWeight: '600', marginTop: 2 }}>{note.title}</Text> : null}
                          <Text style={{ color: palette.text, fontSize: 12, marginTop: 2 }}>{note.body}</Text>
                          <Pressable onPress={() => deleteNote(note)} style={{ marginTop: 6 }}>
                            <Text style={{ color: palette.danger, fontSize: 11, fontWeight: '700' }}>Delete</Text>
                          </Pressable>
                        </View>
                      ))
                    )}
                  </View>
                </>
              ) : (
                <Text style={{ color: palette.subtext, fontSize: 12, marginBottom: 20 }}>Add a department first to write notes.</Text>
              )}

              {data.unavailable_metrics.length > 0 ? (
                <View style={[styles.settingsFeatureRow, { borderColor: palette.borderMuted, backgroundColor: palette.surface, marginBottom: 12 }]}>
                  <Text style={{ color: palette.subtext, fontSize: 11, fontWeight: '700', marginBottom: 4 }}>Not tracked yet</Text>
                  <Text style={{ color: palette.subtext, fontSize: 11, lineHeight: 16 }}>
                    {data.unavailable_metrics.map((k) => UNAVAILABLE_TITLES[k] || k).join(' · ')} — no real data source exists for these yet.
                  </Text>
                </View>
              ) : null}
            </>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}
