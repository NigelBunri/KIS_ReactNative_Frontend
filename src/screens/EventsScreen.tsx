import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import { KISIcon } from '@/constants/kisIcons';
import { useAuth } from '../../App';
import { isTierAtLeast } from '@/services/tierAccess';

type Event = {
  id: string;
  title: string;
  description?: string;
  start_dt?: string;
  end_dt?: string;
  location?: string;
  status?: string;
  attendance_count?: number;
};

type Attendance = {
  id: string;
  event: string;
  user?: string;
};

export default function EventsScreen() {
  const { palette } = useKISTheme();
  const { user } = useAuth();
  const canCreateEvents = isTierAtLeast(user?.profile?.tier ?? null, 'partner');
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);
  const [attending, setAttending] = useState<Set<string>>(new Set());
  const [createVisible, setCreateVisible] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', location: '', start_dt: '', end_dt: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getRequest(ROUTES.events.list, { errorMessage: 'Failed to load events' });
      const list: Event[] = Array.isArray(res?.data?.results)
        ? res.data.results
        : Array.isArray(res?.data)
        ? res.data
        : [];
      setEvents(list);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMyAttendances = useCallback(async () => {
    const res = await getRequest(ROUTES.events.rsvp, { params: { my: '1' } });
    const list: Attendance[] = Array.isArray(res?.data?.results)
      ? res.data.results
      : Array.isArray(res?.data)
      ? res.data
      : [];
    setAttending(new Set(list.map((a) => a.event)));
  }, []);

  useEffect(() => {
    loadEvents();
    loadMyAttendances();
  }, [loadEvents, loadMyAttendances]);

  const rsvp = useCallback(async (event: Event) => {
    if (attending.has(event.id)) return;
    const res = await postRequest(ROUTES.events.rsvp, { event: event.id }, { errorMessage: 'RSVP failed' });
    if (res?.success) setAttending((prev) => new Set([...prev, event.id]));
  }, [attending]);

  const createEvent = useCallback(async () => {
    if (!form.title.trim()) { setError('Title is required.'); return; }
    setSaving(true);
    setError('');
    const res = await postRequest(ROUTES.events.create, {
      title: form.title.trim(),
      description: form.description.trim(),
      location: form.location.trim(),
      start_dt: form.start_dt || undefined,
      end_dt: form.end_dt || undefined,
    }, { errorMessage: 'Failed to create event' });
    setSaving(false);
    if (res?.success) {
      setCreateVisible(false);
      setForm({ title: '', description: '', location: '', start_dt: '', end_dt: '' });
      loadEvents();
    } else {
      setError(res?.message || 'Failed to create event');
    }
  }, [form, loadEvents]);

  const formatDate = (dt?: string) => {
    if (!dt) return '';
    try { return new Date(dt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch { return dt; }
  };

  return (
    <View style={[styles.root, { backgroundColor: palette.bg }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: palette.text }]}>Events</Text>
        {canCreateEvents ? (
          <Pressable onPress={() => setCreateVisible(true)} style={[styles.addBtn, { backgroundColor: palette.primary }]}>
            <KISIcon name="add" size={16} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>Create</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => setError('Creating events requires a Partner plan or above. Upgrade your account to unlock this feature.')}
            style={[styles.addBtn, { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border }]}
          >
            <KISIcon name="lock" size={16} color={palette.subtext} />
            <Text style={{ color: palette.subtext, fontSize: 13, fontWeight: '600' }}>Partner+</Text>
          </Pressable>
        )}
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator color={palette.primary} /></View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(e) => e.id}
          renderItem={({ item }) => {
            const isGoing = attending.has(item.id);
            return (
              <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.inputBorder }]}>
                <Text style={[styles.eventTitle, { color: palette.text }]}>{item.title}</Text>
                {!!item.description && (
                  <Text style={{ color: palette.subtext, fontSize: 13, marginTop: 4 }} numberOfLines={2}>
                    {item.description}
                  </Text>
                )}
                {!!item.start_dt && (
                  <View style={styles.metaRow}>
                    <KISIcon name="calendar" size={13} color={palette.subtext} />
                    <Text style={{ color: palette.subtext, fontSize: 12 }}>{formatDate(item.start_dt)}</Text>
                  </View>
                )}
                {!!item.location && (
                  <View style={styles.metaRow}>
                    <KISIcon name="location" size={13} color={palette.subtext} />
                    <Text style={{ color: palette.subtext, fontSize: 12 }}>{item.location}</Text>
                  </View>
                )}
                <View style={styles.footer}>
                  {!!item.attendance_count && (
                    <Text style={{ color: palette.subtext, fontSize: 12 }}>{item.attendance_count} going</Text>
                  )}
                  <Pressable
                    onPress={() => rsvp(item)}
                    disabled={isGoing}
                    style={[styles.rsvpBtn, { backgroundColor: isGoing ? palette.surface : palette.primary, borderColor: palette.primary }]}
                  >
                    <Text style={{ color: isGoing ? palette.primary : '#fff', fontSize: 13, fontWeight: '600' }}>
                      {isGoing ? 'Going ✓' : 'RSVP'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={{ color: palette.subtext }}>No events yet. Create the first one!</Text>
            </View>
          }
          contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
        />
      )}

      <Modal visible={createVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: palette.card, borderColor: palette.inputBorder }]}>
            <Text style={[styles.modalTitle, { color: palette.text }]}>Create Event</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {[
                { label: 'Title *', key: 'title', placeholder: 'Event name' },
                { label: 'Description', key: 'description', placeholder: 'What is it about?' },
                { label: 'Location', key: 'location', placeholder: 'Where?' },
                { label: 'Start (YYYY-MM-DDTHH:MM)', key: 'start_dt', placeholder: '2026-06-01T10:00' },
                { label: 'End (YYYY-MM-DDTHH:MM)', key: 'end_dt', placeholder: '2026-06-01T12:00' },
              ].map(({ label, key, placeholder }) => (
                <View key={key} style={{ marginBottom: 10 }}>
                  <Text style={{ color: palette.subtext, fontSize: 12, marginBottom: 4 }}>{label}</Text>
                  <TextInput
                    value={form[key as keyof typeof form]}
                    onChangeText={(v) => setForm((f) => ({ ...f, [key]: v }))}
                    placeholder={placeholder}
                    placeholderTextColor={palette.subtext}
                    style={[styles.input, { color: palette.text, borderColor: palette.inputBorder }]}
                    multiline={key === 'description'}
                    numberOfLines={key === 'description' ? 3 : 1}
                  />
                </View>
              ))}
              {!!error && <Text style={{ color: palette.danger ?? '#d9534f', marginBottom: 8 }}>{error}</Text>}
            </ScrollView>
            <View style={styles.modalRow}>
              <Pressable onPress={() => { setCreateVisible(false); setError(''); }} style={styles.btnSecondary}>
                <Text style={{ color: palette.text }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={createEvent}
                disabled={saving}
                style={[styles.btnPrimary, { backgroundColor: palette.primary }]}
              >
                {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '600' }}>Create</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  title: { fontSize: 20, fontWeight: '700' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  card: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 10 },
  eventTitle: { fontSize: 16, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  rsvpBtn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 8, borderWidth: 1 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalCard: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, padding: 20, maxHeight: '85%' },
  modalTitle: { fontSize: 17, fontWeight: '700', marginBottom: 16 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14 },
  modalRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 12 },
  btnSecondary: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 8 },
  btnPrimary: { paddingHorizontal: 20, paddingVertical: 9, borderRadius: 8 },
});
