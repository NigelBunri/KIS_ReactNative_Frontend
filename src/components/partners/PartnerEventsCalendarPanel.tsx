// src/components/partners/PartnerEventsCalendarPanel.tsx
//
// Events Calendar: admins create org-wide events (in-person or virtual,
// optionally admins-only), members RSVP, admins see the attendee roster.
// Deliberately not built on the app's global apps.events (that's a
// per-user personal calendar already live as the top-level "Events" tab)
// — this is a small, partner-scoped model matching every other Partners
// feature (apps/partners/models.py PartnerCalendarEvent/Rsvp).
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
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
  canManage?: boolean;
  onClose: () => void;
};

type CalendarEvent = {
  id: string | number;
  title: string;
  description?: string;
  location?: string;
  virtual_url?: string;
  start_at: string;
  end_at: string;
  visibility: 'all_members' | 'admins_only';
  department_name?: string | null;
  my_rsvp_status: string | null;
  rsvp_counts: { going: number; maybe: number; declined: number };
};

type Attendee = { user_id: string; user_name: string; status: string; responded_at: string };

const inputStyle = (palette: any) => ({
  color: palette.text,
  borderColor: palette.borderMuted,
  borderWidth: 2,
  paddingHorizontal: 10,
  paddingVertical: 8,
  borderRadius: 10,
  marginTop: 8,
});

const rsvpLabel: Record<string, string> = { going: 'Going', maybe: 'Maybe', declined: "Can't go" };

function formatRange(startIso: string, endIso: string) {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const dateStr = start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const startTime = start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const endTime = end.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${dateStr} · ${startTime} – ${endTime}`;
}

export default function PartnerEventsCalendarPanel({ isOpen, panelWidth, panelTranslateX, partnerId, canManage, onClose }: Props) {
  const { palette } = useKISTheme();
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [saving, setSaving] = useState(false);

  const [selectedEventId, setSelectedEventId] = useState<string | number | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [attendeesLoading, setAttendeesLoading] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [virtualUrl, setVirtualUrl] = useState('');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [adminsOnly, setAdminsOnly] = useState(false);

  const backdropOpacity = panelTranslateX.interpolate({ inputRange: [0, panelWidth], outputRange: [1, 0], extrapolate: 'clamp' });

  const load = useCallback(async () => {
    if (!partnerId) return;
    const res = await getRequest(ROUTES.partners.calendarEvents(partnerId), { errorMessage: 'Unable to load events.' });
    const payload = res?.data ?? [];
    setEvents(Array.isArray(payload) ? payload : []);
  }, [partnerId]);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [isOpen, load]);

  const selectedEvent = useMemo(
    () => events.find((e) => String(e.id) === String(selectedEventId)) ?? null,
    [events, selectedEventId],
  );

  const loadAttendees = useCallback(
    async (eventId: string | number) => {
      if (!partnerId) return;
      setAttendeesLoading(true);
      const res = await getRequest(ROUTES.partners.calendarEventAttendees(partnerId, String(eventId)), {
        errorMessage: 'Unable to load attendees.',
      });
      const payload = (res?.data ?? []) as Attendee[];
      setAttendees(Array.isArray(payload) ? payload : []);
      setAttendeesLoading(false);
    },
    [partnerId],
  );

  const openEvent = (ev: CalendarEvent) => {
    setSelectedEventId(ev.id);
    if (canManage) loadAttendees(ev.id);
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setLocation('');
    setVirtualUrl('');
    setStartAt('');
    setEndAt('');
    setAdminsOnly(false);
  };

  const createEvent = async () => {
    if (!partnerId || !title.trim() || !startAt.trim() || !endAt.trim()) {
      Alert.alert('Missing info', 'Title, start time and end time are required (ISO format, e.g. 2026-10-01T09:00:00Z).');
      return;
    }
    setSaving(true);
    const res = await postRequest(
      ROUTES.partners.calendarEvents(partnerId),
      {
        title: title.trim(),
        description: description.trim(),
        location: location.trim(),
        virtual_url: virtualUrl.trim(),
        start_at: startAt.trim(),
        end_at: endAt.trim(),
        visibility: adminsOnly ? 'admins_only' : 'all_members',
      },
      { errorMessage: 'Unable to create event.' },
    );
    setSaving(false);
    if (!res?.success) {
      Alert.alert('Failed', res?.message ?? 'Unable to create event.');
      return;
    }
    resetForm();
    setShowCreate(false);
    load();
  };

  const deleteEvent = (ev: CalendarEvent) => {
    if (!partnerId) return;
    Alert.alert('Delete event?', `"${ev.title}" will be removed for everyone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { deleteRequest } = await import('@/network/delete');
          const res = await deleteRequest(ROUTES.partners.calendarEventDetail(partnerId, String(ev.id)), {
            errorMessage: 'Unable to delete event.',
          });
          if (!res?.success) {
            Alert.alert('Failed', res?.message ?? 'Unable to delete event.');
            return;
          }
          setSelectedEventId(null);
          load();
        },
      },
    ]);
  };

  const rsvp = async (rsvpStatus: 'going' | 'maybe' | 'declined') => {
    if (!partnerId || !selectedEvent) return;
    const res = await postRequest(
      ROUTES.partners.calendarEventRsvp(partnerId, String(selectedEvent.id)),
      { status: rsvpStatus },
      { errorMessage: 'Unable to RSVP.' },
    );
    if (!res?.success) {
      Alert.alert('Failed', res?.message ?? 'Unable to RSVP.');
      return;
    }
    load();
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
          <Pressable
            onPress={() => (selectedEventId ? setSelectedEventId(null) : onClose())}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <Text style={{ color: palette.text, fontSize: 18 }}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingsPanelTitle, { color: palette.text }]}>
              {selectedEvent ? selectedEvent.title : 'Events Calendar'}
            </Text>
            <Text style={[styles.settingsPanelDescription, { color: palette.subtext }]}>
              {selectedEvent ? formatRange(selectedEvent.start_at, selectedEvent.end_at) : 'Org-wide events and RSVPs'}
            </Text>
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.settingsPanelBody} showsVerticalScrollIndicator={false}>
          {loading ? (
            <ActivityIndicator size="small" color={palette.primary} />
          ) : selectedEvent ? (
            <>
              {selectedEvent.description ? (
                <Text style={{ color: palette.subtext, fontSize: 13, marginBottom: 12 }}>{selectedEvent.description}</Text>
              ) : null}
              {selectedEvent.location ? (
                <Text style={{ color: palette.text, fontSize: 13, marginBottom: 4 }}>📍 {selectedEvent.location}</Text>
              ) : null}
              {selectedEvent.virtual_url ? (
                <Text style={{ color: palette.primary, fontSize: 13, marginBottom: 4 }}>🔗 {selectedEvent.virtual_url}</Text>
              ) : null}
              {selectedEvent.visibility === 'admins_only' ? (
                <Text style={{ color: palette.subtext, fontSize: 11, marginBottom: 12 }}>Visible to admins only</Text>
              ) : null}

              <Text style={{ color: palette.text, fontSize: 14, fontWeight: '800', marginTop: 12, marginBottom: 8 }}>Your RSVP</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                {(['going', 'maybe', 'declined'] as const).map((opt) => {
                  const selected = selectedEvent.my_rsvp_status === opt;
                  return (
                    <Pressable
                      key={opt}
                      onPress={() => rsvp(opt)}
                      style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: selected ? palette.primary : palette.borderMuted, backgroundColor: selected ? `${palette.primary}22` : palette.surface }}
                    >
                      <Text style={{ color: selected ? palette.primary : palette.text, fontWeight: '700', fontSize: 13 }}>{rsvpLabel[opt]}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={{ color: palette.subtext, fontSize: 12, marginBottom: 16 }}>
                {selectedEvent.rsvp_counts.going} going · {selectedEvent.rsvp_counts.maybe} maybe · {selectedEvent.rsvp_counts.declined} can't go
              </Text>

              {canManage ? (
                <>
                  <Text style={{ color: palette.text, fontSize: 14, fontWeight: '800', marginBottom: 8 }}>
                    Attendees ({attendees.length})
                  </Text>
                  {attendeesLoading ? (
                    <ActivityIndicator size="small" color={palette.primary} />
                  ) : attendees.length === 0 ? (
                    <Text style={{ color: palette.subtext, fontSize: 13, marginBottom: 16 }}>No responses yet.</Text>
                  ) : (
                    attendees.map((row) => (
                      <View key={row.user_id} style={[styles.settingsFeatureRow, { borderColor: palette.borderMuted, backgroundColor: palette.surface, marginBottom: 8 }]}>
                        <Text style={[styles.settingsFeatureTitle, { color: palette.text }]}>{row.user_name}</Text>
                        <Text style={{ color: palette.subtext, fontSize: 11, marginTop: 2 }}>{rsvpLabel[row.status] ?? row.status}</Text>
                      </View>
                    ))
                  )}
                  <Pressable onPress={() => deleteEvent(selectedEvent)} style={{ marginTop: 8 }}>
                    <Text style={{ color: palette.danger, fontSize: 13, fontWeight: '700' }}>Delete event</Text>
                  </Pressable>
                </>
              ) : null}
            </>
          ) : (
            <>
              {canManage ? (
                <Pressable onPress={() => setShowCreate((v) => !v)}>
                  <Text style={{ color: palette.primary, fontSize: 13, fontWeight: '700', marginBottom: showCreate ? 8 : 12 }}>
                    {showCreate ? '− Cancel new event' : '+ New event'}
                  </Text>
                </Pressable>
              ) : null}
              {showCreate ? (
                <View style={{ marginBottom: 16 }}>
                  <TextInput value={title} onChangeText={setTitle} placeholder="Event title" placeholderTextColor={palette.subtext} style={[inputStyle(palette), { marginTop: 0 }]} />
                  <TextInput value={description} onChangeText={setDescription} placeholder="Description (optional)" placeholderTextColor={palette.subtext} multiline style={[inputStyle(palette), { minHeight: 50, textAlignVertical: 'top' }]} />
                  <TextInput value={location} onChangeText={setLocation} placeholder="Location (optional)" placeholderTextColor={palette.subtext} style={inputStyle(palette)} />
                  <TextInput value={virtualUrl} onChangeText={setVirtualUrl} placeholder="Virtual link (optional)" placeholderTextColor={palette.subtext} style={inputStyle(palette)} autoCapitalize="none" />
                  <TextInput value={startAt} onChangeText={setStartAt} placeholder="Start (e.g. 2026-10-01T09:00:00Z)" placeholderTextColor={palette.subtext} style={inputStyle(palette)} autoCapitalize="none" />
                  <TextInput value={endAt} onChangeText={setEndAt} placeholder="End (e.g. 2026-10-01T17:00:00Z)" placeholderTextColor={palette.subtext} style={inputStyle(palette)} autoCapitalize="none" />
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
                    <Text style={{ color: palette.text, fontSize: 13 }}>Admins only</Text>
                    <Switch value={adminsOnly} onValueChange={setAdminsOnly} />
                  </View>
                  <Pressable
                    onPress={createEvent}
                    disabled={saving}
                    style={({ pressed }) => [{ marginTop: 10, paddingVertical: 10, borderRadius: 10, backgroundColor: palette.royalInk, alignItems: 'center', opacity: pressed || saving ? 0.7 : 1 }]}
                  >
                    <Text style={{ color: palette.ivory, fontWeight: '700' }}>{saving ? 'Creating…' : 'Create event'}</Text>
                  </Pressable>
                </View>
              ) : null}

              {events.length === 0 ? (
                <Text style={{ color: palette.subtext, fontSize: 13, textAlign: 'center', marginTop: 20 }}>No upcoming events.</Text>
              ) : (
                events.map((ev) => (
                  <Pressable
                    key={ev.id}
                    onPress={() => openEvent(ev)}
                    style={[styles.settingsFeatureRow, { borderColor: palette.borderMuted, backgroundColor: palette.surface, marginBottom: 8 }]}
                  >
                    <Text style={[styles.settingsFeatureTitle, { color: palette.text }]}>{ev.title}</Text>
                    <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 4 }}>{formatRange(ev.start_at, ev.end_at)}</Text>
                    {ev.location ? <Text style={{ color: palette.subtext, fontSize: 11, marginTop: 2 }}>📍 {ev.location}</Text> : null}
                    {ev.my_rsvp_status ? (
                      <Text style={{ color: palette.primary, fontSize: 11, marginTop: 4, fontWeight: '700' }}>
                        You: {rsvpLabel[ev.my_rsvp_status] ?? ev.my_rsvp_status}
                      </Text>
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
