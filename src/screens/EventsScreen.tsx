import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useKISTheme } from '@/theme/useTheme';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { deleteRequest } from '@/network/delete';
import { patchRequest } from '@/network/patch';
import ROUTES from '@/network';
import { KISIcon } from '@/constants/kisIcons';
import { useAuth } from '../../App';
import { isTierAtLeast } from '@/services/tierAccess';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Event = {
  id: string;
  title: string;
  description?: string;
  start_dt?: string;
  end_dt?: string;
  location?: string;
  status?: string;
  attendance_count?: number;
  created_by?: string;
  ticket_count?: number;
  attendees?: Attendee[];
};

type Attendee = {
  id: string;
  user?: string;
  username?: string;
  display_name?: string;
};

type Attendance = {
  id: string;
  event: string;
  user?: string;
};

type FilterTab = 'all' | 'upcoming' | 'going' | 'past';

type EventFormData = {
  title: string;
  description: string;
  location: string;
  start_dt: Date | null;
  end_dt: Date | null;
};

const EMPTY_FORM: EventFormData = {
  title: '',
  description: '',
  location: '',
  start_dt: null,
  end_dt: null,
};

// ---------------------------------------------------------------------------
// Reminder types
// ---------------------------------------------------------------------------

type ReminderOffset = 0 | 15 | 60 | 1440; // minutes before event

type ReminderOption = {
  label: string;
  offsetMinutes: ReminderOffset;
};

const REMINDER_OPTIONS: ReminderOption[] = [
  { label: 'At event time', offsetMinutes: 0 },
  { label: '15 min before', offsetMinutes: 15 },
  { label: '1 hour before', offsetMinutes: 60 },
  { label: '1 day before', offsetMinutes: 1440 },
];

function reminderStorageKey(eventId: string) {
  return `event_reminder_${eventId}`;
}

type StoredReminder = {
  eventId: string;
  eventTitle: string;
  startDt: string;
  offsetMinutes: ReminderOffset;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dt?: string | null) {
  if (!dt) return '';
  try {
    return new Date(dt).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dt ?? '';
  }
}

function formatDateShort(d: Date) {
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(d: Date) {
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

/** Format a date string to Google Calendar's YYYYMMDDTHHmmssZ format */
function formatGCal(dt?: string | null): string {
  if (!dt) return '';
  const d = new Date(dt);
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

type EventStatus = 'past' | 'today' | 'upcoming' | 'cancelled';

function getEventStatus(event: Event): EventStatus {
  if (event.status === 'cancelled') return 'cancelled';
  if (!event.start_dt) return 'upcoming';
  const now = new Date();
  const start = new Date(event.start_dt);
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const todayDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (start < now && (!event.end_dt || new Date(event.end_dt) < now)) return 'past';
  if (startDay.getTime() === todayDay.getTime()) return 'today';
  return 'upcoming';
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

type DateFieldProps = {
  label: string;
  value: Date | null;
  onChange: (d: Date) => void;
  palette: ReturnType<typeof useKISTheme>['palette'];
  minimumDate?: Date;
};

function DateField({ label, value, onChange, palette, minimumDate }: DateFieldProps) {
  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);
  const working = useRef<Date>(value ?? new Date());

  const handleDateChange = (_event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') setShowDate(false);
    if (selected) {
      working.current = selected;
      if (Platform.OS === 'android') {
        // On Android, date picker fires then we show time picker
        setShowTime(true);
      }
    }
  };

  const handleTimeChange = (_event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') setShowTime(false);
    if (selected) {
      onChange(selected);
    } else {
      onChange(working.current);
    }
  };

  const displayText = value
    ? `${formatDateShort(value)}  ${formatTime(value)}`
    : 'Tap to set date & time';

  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ color: palette.subtext, fontSize: 12, marginBottom: 4 }}>{label}</Text>
      <Pressable
        onPress={() => { Keyboard.dismiss(); setShowDate(true); }}
        style={[
          dtStyles.dateButton,
          {
            borderColor: palette.inputBorder,
            backgroundColor: palette.surface,
          },
        ]}
      >
        <KISIcon name="calendar" size={15} color={palette.primary} />
        <Text style={{ color: value ? palette.text : palette.subtext, fontSize: 14, marginLeft: 8, flex: 1 }}>
          {displayText}
        </Text>
        {value && (
          <Pressable
            hitSlop={12}
            onPress={() => {
              // clear — handled at parent
              onChange(new Date(0));
            }}
          >
            <KISIcon name="close" size={14} color={palette.subtext} />
          </Pressable>
        )}
      </Pressable>

      {showDate && (
        <DateTimePicker
          value={working.current}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          minimumDate={minimumDate}
          onChange={handleDateChange}
          onTouchCancel={() => setShowDate(false)}
        />
      )}
      {/* On iOS: after date picker dismiss we show time; on Android handled via state sequence */}
      {showTime && (
        <DateTimePicker
          value={working.current}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleTimeChange}
          onTouchCancel={() => setShowTime(false)}
        />
      )}
      {/* iOS: show both pickers inline using a confirm button approach */}
      {Platform.OS === 'ios' && showDate && (
        <View style={{ alignItems: 'flex-end', marginTop: 4 }}>
          <Pressable
            onPress={() => { setShowDate(false); setShowTime(true); }}
            style={[dtStyles.iosNext, { backgroundColor: palette.primary }]}
          >
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>Next: Time</Text>
          </Pressable>
        </View>
      )}
      {Platform.OS === 'ios' && showTime && !showDate && (
        <View style={{ alignItems: 'flex-end', marginTop: 4 }}>
          <Pressable
            onPress={() => { setShowTime(false); onChange(working.current); }}
            style={[dtStyles.iosNext, { backgroundColor: palette.primary }]}
          >
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>Done</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const dtStyles = StyleSheet.create({
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  iosNext: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 8,
  },
});

// ---------------------------------------------------------------------------
// Status Badge
// ---------------------------------------------------------------------------

type StatusBadgeProps = {
  status: EventStatus;
  palette: ReturnType<typeof useKISTheme>['palette'];
};

function StatusBadge({ status, palette }: StatusBadgeProps) {
  const config: Record<EventStatus, { label: string; bg: string; color: string }> = {
    upcoming: { label: 'Upcoming', bg: palette.primary + '22', color: palette.primary },
    today: { label: 'Today', bg: '#f59e0b22', color: '#f59e0b' },
    past: { label: 'Past', bg: palette.subtext + '22', color: palette.subtext },
    cancelled: { label: 'Cancelled', bg: '#ef444422', color: '#ef4444' },
  };
  const { label, bg, color } = config[status];
  return (
    <View style={[badgeStyles.badge, { backgroundColor: bg }]}>
      <Text style={[badgeStyles.label, { color }]}>{label}</Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  label: { fontSize: 11, fontWeight: '600' },
});

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------

export default function EventsScreen() {
  const { palette } = useKISTheme();
  const { user } = useAuth();
  const canCreateEvents = isTierAtLeast(user?.profile?.tier ?? null, 'partner');

  // List state
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [attending, setAttending] = useState<Set<string>>(new Set());
  // attendanceId map: event id -> attendance record id (needed for cancel)
  const [attendanceIds, setAttendanceIds] = useState<Record<string, string>>({});

  // Search & filter
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterTab>('all');

  // Create / Edit modal
  const [createVisible, setCreateVisible] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [form, setForm] = useState<EventFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Detail modal
  const [detailEvent, setDetailEvent] = useState<Event | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);

  // Attendee list modal
  const [attendeeModalEvent, setAttendeeModalEvent] = useState<Event | null>(null);
  const [attendeeModalVisible, setAttendeeModalVisible] = useState(false);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [attendeesLoading, setAttendeesLoading] = useState(false);

  // Upgrade error message for non-partner users
  const [headerError, setHeaderError] = useState('');

  // Reminder modal state
  const [reminderModalVisible, setReminderModalVisible] = useState(false);
  const [reminderEvent, setReminderEvent] = useState<Event | null>(null);
  const [savedReminders, setSavedReminders] = useState<Record<string, ReminderOffset>>({});

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const res = await getRequest(ROUTES.events.list, { errorMessage: 'Failed to load events' });
      const list: Event[] = Array.isArray(res?.data?.results)
        ? res.data.results
        : Array.isArray(res?.data)
        ? res.data
        : [];
      setEvents(list);
      if (!res?.success && !list.length) {
        setListError(res?.message || 'Unable to load events.');
      }
    } catch (err: any) {
      setListError(err?.message || 'Unable to load events.');
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
    const ids = new Set(list.map((a) => a.event));
    const idMap: Record<string, string> = {};
    list.forEach((a) => { idMap[a.event] = a.id; });
    setAttending(ids);
    setAttendanceIds(idMap);
  }, []);

  useEffect(() => {
    loadEvents();
    loadMyAttendances();
  }, [loadEvents, loadMyAttendances]);

  // ---------------------------------------------------------------------------
  // On-mount: check stored reminders and alert for upcoming events
  // ---------------------------------------------------------------------------

  useEffect(() => {
    async function checkReminders() {
      try {
        const keys = await AsyncStorage.getAllKeys();
        const reminderKeys = keys.filter((k) => k.startsWith('event_reminder_'));
        if (reminderKeys.length === 0) return;
        const pairs = await AsyncStorage.multiGet(reminderKeys);
        const now = Date.now();
        for (const [, value] of pairs) {
          if (!value) continue;
          let reminder: StoredReminder;
          try {
            reminder = JSON.parse(value) as StoredReminder;
          } catch {
            continue;
          }
          const eventStart = new Date(reminder.startDt).getTime();
          const reminderTime = eventStart - reminder.offsetMinutes * 60 * 1000;
          // Alert if the reminder time is within the past 24h and the event hasn't started more than 1h ago
          const windowMs = 24 * 60 * 60 * 1000;
          if (reminderTime <= now && now <= eventStart + 60 * 60 * 1000 && now >= reminderTime - windowMs) {
            const option = REMINDER_OPTIONS.find((o) => o.offsetMinutes === reminder.offsetMinutes);
            Alert.alert(
              '📅 Event Reminder',
              `${reminder.eventTitle}\n${option ? option.label : ''} — ${formatDate(reminder.startDt)}`,
              [{ text: 'Got it', style: 'default' }],
            );
          }
        }
        // Also load saved reminder offsets into state for UI display
        const remindersMap: Record<string, ReminderOffset> = {};
        for (const [, value] of pairs) {
          if (!value) continue;
          try {
            const r = JSON.parse(value) as StoredReminder;
            remindersMap[r.eventId] = r.offsetMinutes;
          } catch {
            // ignore malformed entries
          }
        }
        setSavedReminders(remindersMap);
      } catch {
        // Non-critical — silently ignore AsyncStorage errors on mount
      }
    }
    checkReminders();
  }, []);

  // ---------------------------------------------------------------------------
  // Filtered list
  // ---------------------------------------------------------------------------

  const filteredEvents = useMemo(() => {
    let list = events;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          (e.description ?? '').toLowerCase().includes(q) ||
          (e.location ?? '').toLowerCase().includes(q),
      );
    }
    if (filter === 'upcoming') {
      list = list.filter((e) => {
        const s = getEventStatus(e);
        return s === 'upcoming' || s === 'today';
      });
    } else if (filter === 'going') {
      list = list.filter((e) => attending.has(e.id));
    } else if (filter === 'past') {
      list = list.filter((e) => getEventStatus(e) === 'past');
    }
    return list;
  }, [events, search, filter, attending]);

  // ---------------------------------------------------------------------------
  // RSVP / Cancel RSVP
  // ---------------------------------------------------------------------------

  const rsvp = useCallback(
    async (event: Event) => {
      const res = await postRequest(
        ROUTES.events.rsvp,
        { event: event.id },
        { errorMessage: 'RSVP failed' },
      );
      if (res?.success) {
        const attendanceId = res.data?.id as string | undefined;
        setAttending((prev) => new Set([...prev, event.id]));
        if (attendanceId) {
          setAttendanceIds((prev) => ({ ...prev, [event.id]: attendanceId }));
        }
        setEvents((prev) =>
          prev.map((e) =>
            e.id === event.id
              ? { ...e, attendance_count: (e.attendance_count ?? 0) + 1 }
              : e,
          ),
        );
      } else {
        Alert.alert('RSVP Failed', res?.message ?? 'Please try again.');
      }
    },
    [],
  );

  const cancelRSVP = useCallback(
    async (event: Event) => {
      const attendanceId = attendanceIds[event.id];
      const url = attendanceId
        ? ROUTES.events.detail(attendanceId).replace('/events/', '/attendances/')
        : ROUTES.events.rsvp;
      // Use query-param approach: DELETE to rsvp endpoint with event param
      const res = await deleteRequest(
        attendanceId
          ? `${ROUTES.events.rsvp}${attendanceId}/`
          : ROUTES.events.rsvp,
        { errorMessage: 'Cancel RSVP failed' },
      );
      if (res?.success || res?.status === 404) {
        setAttending((prev) => {
          const next = new Set(prev);
          next.delete(event.id);
          return next;
        });
        setAttendanceIds((prev) => {
          const next = { ...prev };
          delete next[event.id];
          return next;
        });
        setEvents((prev) =>
          prev.map((e) =>
            e.id === event.id
              ? { ...e, attendance_count: Math.max(0, (e.attendance_count ?? 1) - 1) }
              : e,
          ),
        );
      } else {
        Alert.alert('Error', res?.message ?? 'Failed to cancel RSVP.');
      }
    },
    [attendanceIds],
  );

  // ---------------------------------------------------------------------------
  // Create / Edit
  // ---------------------------------------------------------------------------

  const openCreate = useCallback(() => {
    setEditingEvent(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setCreateVisible(true);
  }, []);

  const openEdit = useCallback((event: Event) => {
    setDetailVisible(false);
    setEditingEvent(event);
    setForm({
      title: event.title ?? '',
      description: event.description ?? '',
      location: event.location ?? '',
      start_dt: event.start_dt ? new Date(event.start_dt) : null,
      end_dt: event.end_dt ? new Date(event.end_dt) : null,
    });
    setFormError('');
    setCreateVisible(true);
  }, []);

  const submitForm = useCallback(async () => {
    if (!form.title.trim()) {
      setFormError('Title is required.');
      return;
    }
    setSaving(true);
    setFormError('');
    const payload: Record<string, unknown> = {
      title: form.title.trim(),
      description: form.description.trim(),
      location: form.location.trim(),
      start_dt: form.start_dt ? form.start_dt.toISOString() : undefined,
      end_dt: form.end_dt ? form.end_dt.toISOString() : undefined,
    };
    const isEdit = !!editingEvent;
    const res = isEdit
      ? await patchRequest(ROUTES.events.detail(editingEvent!.id), payload, {
          errorMessage: 'Failed to update event',
        })
      : await postRequest(ROUTES.events.create, payload, {
          errorMessage: 'Failed to create event',
        });
    setSaving(false);
    if (res?.success) {
      setCreateVisible(false);
      setForm(EMPTY_FORM);
      setEditingEvent(null);
      loadEvents();
    } else {
      setFormError(res?.message ?? (isEdit ? 'Failed to update event' : 'Failed to create event'));
    }
  }, [form, editingEvent, loadEvents]);

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------

  const confirmDelete = useCallback(
    (event: Event) => {
      Alert.alert(
        'Delete Event',
        `Are you sure you want to delete "${event.title}"? This cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              setDetailVisible(false);
              const res = await deleteRequest(ROUTES.events.detail(event.id), {
                errorMessage: 'Failed to delete event',
              });
              if (res?.success) {
                setEvents((prev) => prev.filter((e) => e.id !== event.id));
              } else {
                Alert.alert('Error', res?.message ?? 'Failed to delete event.');
              }
            },
          },
        ],
      );
    },
    [],
  );

  // ---------------------------------------------------------------------------
  // Attendee list
  // ---------------------------------------------------------------------------

  const openAttendees = useCallback(async (event: Event) => {
    setAttendeeModalEvent(event);
    setAttendeeModalVisible(true);
    setAttendeesLoading(true);
    const res = await getRequest(ROUTES.events.detail(event.id));
    const data: Event | null = res?.data ?? null;
    const list: Attendee[] = Array.isArray(data?.attendees)
      ? data!.attendees
      : [];
    setAttendees(list);
    setAttendeesLoading(false);
  }, []);

  // ---------------------------------------------------------------------------
  // Detail modal
  // ---------------------------------------------------------------------------

  const openDetail = useCallback((event: Event) => {
    setDetailEvent(event);
    setDetailVisible(true);
  }, []);

  // ---------------------------------------------------------------------------
  // Share event
  // ---------------------------------------------------------------------------

  const shareEvent = useCallback(async (event: Event) => {
    try {
      await Share.share({
        title: event.title,
        message: `${event.title}\n${event.description || ''}\n📅 ${formatDate(event.start_dt)}\n📍 ${event.location || ''}\n\nJoin on KIS app`,
      });
    } catch {
      // User cancelled share or platform error — ignore silently
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Add to Calendar
  // ---------------------------------------------------------------------------

  const addToCalendar = useCallback(async (event: Event) => {
    try {
      let calUrl: string;
      if (Platform.OS === 'ios') {
        const startTimestamp = new Date(event.start_dt ?? Date.now()).getTime() / 1000;
        calUrl = `calshow:${startTimestamp}`;
      } else {
        const startMs = new Date(event.start_dt ?? Date.now()).getTime();
        const endMs = event.end_dt
          ? new Date(event.end_dt).getTime()
          : startMs + 3_600_000;
        const gcalStart = formatGCal(event.start_dt);
        const gcalEnd = formatGCal(event.end_dt ?? event.start_dt);
        // Try Google Calendar intent first; fall back to content URI
        calUrl = `intent://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${gcalStart}/${gcalEnd}&details=${encodeURIComponent(event.description || '')}&location=${encodeURIComponent(event.location || '')}#Intent;scheme=https;package=com.google.android.calendar;end`;
        // Suppress unused variable warning:
        void endMs;
      }
      const supported = await Linking.canOpenURL(calUrl);
      if (supported) {
        await Linking.openURL(calUrl);
      } else {
        Alert.alert(
          'Calendar unavailable',
          'No calendar app was found on this device. Please add the event manually.',
          [{ text: 'OK' }],
        );
      }
    } catch {
      Alert.alert('Error', 'Could not open the calendar app. Please try again.');
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Set Reminder
  // ---------------------------------------------------------------------------

  const openReminderModal = useCallback((event: Event) => {
    setReminderEvent(event);
    setReminderModalVisible(true);
  }, []);

  const saveReminder = useCallback(async (event: Event, offsetMinutes: ReminderOffset) => {
    try {
      const reminder: StoredReminder = {
        eventId: event.id,
        eventTitle: event.title,
        startDt: event.start_dt ?? '',
        offsetMinutes,
      };
      await AsyncStorage.setItem(reminderStorageKey(event.id), JSON.stringify(reminder));
      setSavedReminders((prev) => ({ ...prev, [event.id]: offsetMinutes }));
      const option = REMINDER_OPTIONS.find((o) => o.offsetMinutes === offsetMinutes);
      const label = option?.label ?? 'At event time';
      Alert.alert(
        'Reminder Set',
        `Reminder set for "${label}". You'll be notified when the app is open.`,
        [{ text: 'OK' }],
      );
    } catch {
      Alert.alert('Error', 'Could not save reminder. Please try again.');
    }
    setReminderModalVisible(false);
  }, []);

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const isOwner = useCallback(
    (event: Event) => {
      if (!user?.id) return false;
      return event.created_by === user.id || event.created_by === user.pk?.toString();
    },
    [user],
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const FILTER_TABS: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'going', label: 'Going' },
    { key: 'past', label: 'Past' },
  ];

  return (
    <View style={[styles.root, { backgroundColor: palette.bg }]}>
      {/* Header */}
      <View style={[styles.headerRow, { borderBottomColor: palette.border }]}>
        <Text style={[styles.title, { color: palette.text }]}>Events</Text>
        {canCreateEvents ? (
          <Pressable
            onPress={openCreate}
            style={[styles.addBtn, { backgroundColor: palette.primary }]}
          >
            <KISIcon name="add" size={16} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>Create</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() =>
              setHeaderError(
                'Creating events requires a Partner plan or above. Upgrade to unlock this feature.',
              )
            }
            style={[
              styles.addBtn,
              { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
            ]}
          >
            <KISIcon name="lock" size={16} color={palette.subtext} />
            <Text style={{ color: palette.subtext, fontSize: 13, fontWeight: '600' }}>
              Partner+
            </Text>
          </Pressable>
        )}
      </View>

      {/* Tier upgrade error */}
      {!!headerError && (
        <View
          style={[styles.infoBanner, { backgroundColor: palette.surface, borderColor: palette.border }]}
        >
          <Text style={{ color: palette.subtext, fontSize: 13, flex: 1 }}>{headerError}</Text>
          <Pressable onPress={() => setHeaderError('')} hitSlop={12}>
            <KISIcon name="close" size={15} color={palette.subtext} />
          </Pressable>
        </View>
      )}

      {/* Search */}
      <View style={[styles.searchRow, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <KISIcon name="search" size={16} color={palette.subtext} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search events…"
          placeholderTextColor={palette.subtext}
          style={[styles.searchInput, { color: palette.text }]}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ maxHeight: 44 }}
        contentContainerStyle={styles.filterRow}
      >
        {FILTER_TABS.map(({ key, label }) => (
          <Pressable
            key={key}
            onPress={() => setFilter(key)}
            style={[
              styles.filterChip,
              {
                backgroundColor: filter === key ? palette.primary : palette.surface,
                borderColor: filter === key ? palette.primary : palette.border,
              },
            ]}
          >
            <Text
              style={{
                color: filter === key ? '#fff' : palette.subtext,
                fontSize: 13,
                fontWeight: filter === key ? '600' : '400',
              }}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* List */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={palette.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredEvents}
          keyExtractor={(e) => e.id}
          renderItem={({ item }) => {
            const isGoing = attending.has(item.id);
            const status = getEventStatus(item);
            return (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => openDetail(item)}
                style={[styles.card, { backgroundColor: palette.card, borderColor: palette.inputBorder }]}
              >
                {/* Title row */}
                <View style={styles.cardTitleRow}>
                  <Text style={[styles.eventTitle, { color: palette.text, flex: 1 }]} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <StatusBadge status={status} palette={palette} />
                </View>

                {!!item.description && (
                  <Text
                    style={{ color: palette.subtext, fontSize: 13, marginTop: 4 }}
                    numberOfLines={2}
                  >
                    {item.description}
                  </Text>
                )}

                {!!item.start_dt && (
                  <View style={styles.metaRow}>
                    <KISIcon name="calendar" size={13} color={palette.subtext} />
                    <Text style={{ color: palette.subtext, fontSize: 12 }}>
                      {formatDate(item.start_dt)}
                    </Text>
                  </View>
                )}
                {!!item.location && (
                  <View style={styles.metaRow}>
                    <KISIcon name="location" size={13} color={palette.subtext} />
                    <Text style={{ color: palette.subtext, fontSize: 12 }}>{item.location}</Text>
                  </View>
                )}

                <View style={styles.footer}>
                  {/* Attendee count — tappable */}
                  {(item.attendance_count ?? 0) > 0 ? (
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation?.();
                        openAttendees(item);
                      }}
                      hitSlop={8}
                    >
                      <Text style={{ color: palette.primary, fontSize: 12, fontWeight: '500' }}>
                        {item.attendance_count} going
                      </Text>
                    </Pressable>
                  ) : (
                    <View />
                  )}

                  {/* RSVP / Cancel */}
                  {status !== 'past' && status !== 'cancelled' ? (
                    isGoing ? (
                      <Pressable
                        onPress={(e) => {
                          e.stopPropagation?.();
                          Alert.alert('Cancel RSVP', 'Remove yourself from this event?', [
                            { text: 'No', style: 'cancel' },
                            { text: 'Yes', style: 'destructive', onPress: () => cancelRSVP(item) },
                          ]);
                        }}
                        style={[
                          styles.rsvpBtn,
                          { backgroundColor: palette.surface, borderColor: palette.primary },
                        ]}
                      >
                        <KISIcon name="check" size={13} color={palette.primary} />
                        <Text style={{ color: palette.primary, fontSize: 13, fontWeight: '600', marginLeft: 4 }}>
                          Going
                        </Text>
                      </Pressable>
                    ) : (
                      <Pressable
                        onPress={(e) => {
                          e.stopPropagation?.();
                          rsvp(item);
                        }}
                        style={[styles.rsvpBtn, { backgroundColor: palette.primary, borderColor: palette.primary }]}
                      >
                        <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>RSVP</Text>
                      </Pressable>
                    )
                  ) : (
                    <View />
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.centered}>
              <KISIcon name="calendar" size={40} color={listError ? (palette.danger ?? '#dc2626') : palette.subtext} />
              <Text style={{ color: listError ? (palette.danger ?? '#dc2626') : palette.subtext, marginTop: 12, textAlign: 'center' }}>
                {listError
                  ? listError
                  : search || filter !== 'all'
                  ? 'No events match your search or filter.'
                  : 'No events yet. Create the first one!'}
              </Text>
            </View>
          }
          contentContainerStyle={{ padding: 12, paddingBottom: 40, flexGrow: 1 }}
        />
      )}

      {/* ------------------------------------------------------------------ */}
      {/* CREATE / EDIT MODAL                                                  */}
      {/* ------------------------------------------------------------------ */}
      <Modal
        visible={createVisible}
        transparent
        animationType="slide"
        onRequestClose={() => { setCreateVisible(false); setFormError(''); }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: palette.card, borderColor: palette.inputBorder }]}>
            <Text style={[styles.modalTitle, { color: palette.text }]}>
              {editingEvent ? 'Edit Event' : 'Create Event'}
            </Text>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Title */}
              <View style={{ marginBottom: 10 }}>
                <Text style={[styles.fieldLabel, { color: palette.subtext }]}>Title *</Text>
                <TextInput
                  value={form.title}
                  onChangeText={(v) => setForm((f) => ({ ...f, title: v }))}
                  placeholder="Event name"
                  placeholderTextColor={palette.subtext}
                  style={[styles.input, { color: palette.text, borderColor: palette.inputBorder }]}
                />
              </View>

              {/* Description */}
              <View style={{ marginBottom: 10 }}>
                <Text style={[styles.fieldLabel, { color: palette.subtext }]}>Description</Text>
                <TextInput
                  value={form.description}
                  onChangeText={(v) => setForm((f) => ({ ...f, description: v }))}
                  placeholder="What is it about?"
                  placeholderTextColor={palette.subtext}
                  style={[
                    styles.input,
                    { color: palette.text, borderColor: palette.inputBorder, minHeight: 70, textAlignVertical: 'top' },
                  ]}
                  multiline
                  numberOfLines={3}
                />
              </View>

              {/* Location */}
              <View style={{ marginBottom: 10 }}>
                <Text style={[styles.fieldLabel, { color: palette.subtext }]}>Location</Text>
                <TextInput
                  value={form.location}
                  onChangeText={(v) => setForm((f) => ({ ...f, location: v }))}
                  placeholder="Where?"
                  placeholderTextColor={palette.subtext}
                  style={[styles.input, { color: palette.text, borderColor: palette.inputBorder }]}
                />
              </View>

              {/* Start datetime */}
              <DateField
                label="Start date & time"
                value={form.start_dt && form.start_dt.getTime() !== 0 ? form.start_dt : null}
                onChange={(d) =>
                  setForm((f) => ({
                    ...f,
                    start_dt: d.getTime() === 0 ? null : d,
                  }))
                }
                palette={palette}
              />

              {/* End datetime */}
              <DateField
                label="End date & time"
                value={form.end_dt && form.end_dt.getTime() !== 0 ? form.end_dt : null}
                onChange={(d) =>
                  setForm((f) => ({
                    ...f,
                    end_dt: d.getTime() === 0 ? null : d,
                  }))
                }
                palette={palette}
                minimumDate={form.start_dt ?? undefined}
              />

              {!!formError && (
                <Text style={{ color: palette.danger ?? '#d9534f', marginBottom: 8 }}>{formError}</Text>
              )}
            </ScrollView>

            <View style={styles.modalRow}>
              <Pressable
                onPress={() => { setCreateVisible(false); setFormError(''); }}
                style={styles.btnSecondary}
              >
                <Text style={{ color: palette.text }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={submitForm}
                disabled={saving}
                style={[styles.btnPrimary, { backgroundColor: palette.primary }]}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={{ color: '#fff', fontWeight: '600' }}>
                    {editingEvent ? 'Save' : 'Create'}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ------------------------------------------------------------------ */}
      {/* DETAIL MODAL                                                         */}
      {/* ------------------------------------------------------------------ */}
      <Modal
        visible={detailVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              styles.detailCard,
              { backgroundColor: palette.card, borderColor: palette.inputBorder },
            ]}
          >
            <View style={styles.detailHeader}>
              <Text style={[styles.modalTitle, { color: palette.text, flex: 1 }]} numberOfLines={2}>
                {detailEvent?.title}
              </Text>
              <Pressable onPress={() => setDetailVisible(false)} hitSlop={12}>
                <KISIcon name="close" size={20} color={palette.subtext} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Status badge */}
              {detailEvent && (
                <View style={{ marginBottom: 12 }}>
                  <StatusBadge status={getEventStatus(detailEvent)} palette={palette} />
                </View>
              )}

              {/* Description */}
              {!!detailEvent?.description && (
                <Text style={{ color: palette.text, fontSize: 14, lineHeight: 21, marginBottom: 14 }}>
                  {detailEvent.description}
                </Text>
              )}

              {/* Meta */}
              {!!detailEvent?.start_dt && (
                <View style={[styles.metaRow, { marginBottom: 8 }]}>
                  <KISIcon name="calendar" size={15} color={palette.primary} />
                  <View style={{ marginLeft: 8 }}>
                    <Text style={{ color: palette.subtext, fontSize: 11 }}>Start</Text>
                    <Text style={{ color: palette.text, fontSize: 14 }}>
                      {formatDate(detailEvent.start_dt)}
                    </Text>
                  </View>
                </View>
              )}
              {!!detailEvent?.end_dt && (
                <View style={[styles.metaRow, { marginBottom: 8 }]}>
                  <KISIcon name="calendar" size={15} color={palette.subtext} />
                  <View style={{ marginLeft: 8 }}>
                    <Text style={{ color: palette.subtext, fontSize: 11 }}>End</Text>
                    <Text style={{ color: palette.text, fontSize: 14 }}>
                      {formatDate(detailEvent.end_dt)}
                    </Text>
                  </View>
                </View>
              )}
              {!!detailEvent?.location && (
                <View style={[styles.metaRow, { marginBottom: 8 }]}>
                  <KISIcon name="location" size={15} color={palette.primary} />
                  <Text style={{ color: palette.text, fontSize: 14, marginLeft: 8 }}>
                    {detailEvent.location}
                  </Text>
                </View>
              )}

              {/* Attendee count */}
              {(detailEvent?.attendance_count ?? 0) > 0 && (
                <Pressable
                  onPress={() => { if (detailEvent) openAttendees(detailEvent); }}
                  style={[styles.metaRow, { marginBottom: 8 }]}
                >
                  <KISIcon name="people" size={15} color={palette.primary} />
                  <Text style={{ color: palette.primary, fontSize: 14, marginLeft: 8, fontWeight: '500' }}>
                    {detailEvent?.attendance_count} going — tap to see list
                  </Text>
                </Pressable>
              )}

              {/* Tickets section */}
              {((detailEvent?.ticket_count ?? 0) > 0) && (
                <View
                  style={[
                    styles.ticketSection,
                    { backgroundColor: palette.surface, borderColor: palette.border },
                  ]}
                >
                  <View style={styles.metaRow}>
                    <KISIcon name="card" size={16} color={palette.primary} />
                    <Text style={{ color: palette.text, fontSize: 14, fontWeight: '600', marginLeft: 8 }}>
                      Tickets
                    </Text>
                  </View>
                  <Text style={{ color: palette.subtext, fontSize: 13, marginTop: 6 }}>
                    {detailEvent!.ticket_count} ticket{detailEvent!.ticket_count !== 1 ? 's' : ''} available
                  </Text>
                  {detailEvent && isOwner(detailEvent) && (
                    <Pressable
                      onPress={() =>
                        Alert.alert(
                          'Manage Tickets',
                          'Full ticket management — including pricing, capacity limits, and sales reports — is available from the KIS web dashboard at app.kis.community. Log in and navigate to your event to manage tickets.',
                          [{ text: 'Got it', style: 'default' }],
                        )
                      }
                      style={[styles.manageTicketsBtn, { borderColor: palette.primary }]}
                    >
                      <KISIcon name="settings" size={14} color={palette.primary} />
                      <Text style={{ color: palette.primary, fontSize: 13, fontWeight: '600', marginLeft: 6 }}>
                        Manage Tickets
                      </Text>
                    </Pressable>
                  )}
                </View>
              )}

              {/* Owner: show manage tickets even if ticket_count is 0 */}
              {detailEvent && isOwner(detailEvent) && (detailEvent.ticket_count ?? 0) === 0 && (
                <View
                  style={[
                    styles.ticketSection,
                    { backgroundColor: palette.surface, borderColor: palette.border },
                  ]}
                >
                  <View style={styles.metaRow}>
                    <KISIcon name="card" size={16} color={palette.primary} />
                    <Text style={{ color: palette.text, fontSize: 14, fontWeight: '600', marginLeft: 8 }}>
                      Tickets
                    </Text>
                  </View>
                  <Text style={{ color: palette.subtext, fontSize: 13, marginTop: 6, marginBottom: 8 }}>
                    No tickets configured for this event yet.
                  </Text>
                  <Pressable
                    onPress={() =>
                      Alert.alert(
                        'Manage Tickets',
                        'Ticket creation and management — including pricing, capacity limits, and sales reports — is available from the KIS web dashboard at app.kis.community. Log in and navigate to your event to set up tickets.',
                        [{ text: 'Got it', style: 'default' }],
                      )
                    }
                    style={[styles.manageTicketsBtn, { borderColor: palette.primary }]}
                  >
                    <KISIcon name="settings" size={14} color={palette.primary} />
                    <Text style={{ color: palette.primary, fontSize: 13, fontWeight: '600', marginLeft: 6 }}>
                      Manage Tickets
                    </Text>
                  </Pressable>
                </View>
              )}
            </ScrollView>

            {/* Action buttons */}
            <View style={styles.detailActions}>
              {/* Share + Add to Calendar row */}
              {detailEvent && (
                <View style={styles.secondaryActionsRow}>
                  <Pressable
                    onPress={() => shareEvent(detailEvent)}
                    style={[styles.secondaryActionBtn, { backgroundColor: palette.surface, borderColor: palette.border }]}
                  >
                    <KISIcon name="share" size={14} color={palette.text} />
                    <Text style={{ color: palette.text, fontSize: 13, fontWeight: '500', marginLeft: 6 }}>
                      Share
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => addToCalendar(detailEvent)}
                    style={[styles.secondaryActionBtn, { backgroundColor: palette.surface, borderColor: palette.border }]}
                  >
                    <KISIcon name="calendar" size={14} color={palette.text} />
                    <Text style={{ color: palette.text, fontSize: 13, fontWeight: '500', marginLeft: 6 }}>
                      Add to Calendar
                    </Text>
                  </Pressable>
                </View>
              )}

              {/* Set Reminder — only when attending a future event */}
              {detailEvent &&
                attending.has(detailEvent.id) &&
                getEventStatus(detailEvent) !== 'past' &&
                getEventStatus(detailEvent) !== 'cancelled' && (
                  <Pressable
                    onPress={() => openReminderModal(detailEvent)}
                    style={[
                      styles.detailRsvpBtn,
                      { backgroundColor: palette.surface, borderColor: palette.border },
                    ]}
                  >
                    <KISIcon name="bell" size={14} color={palette.primary} />
                    <Text style={{ color: palette.primary, fontWeight: '600', marginLeft: 6 }}>
                      {savedReminders[detailEvent.id] != null
                        ? `Reminder: ${REMINDER_OPTIONS.find((o) => o.offsetMinutes === savedReminders[detailEvent.id])?.label ?? 'Set'}`
                        : 'Set Reminder'}
                    </Text>
                  </Pressable>
                )}

              {/* RSVP / Cancel RSVP */}
              {detailEvent && getEventStatus(detailEvent) !== 'past' && getEventStatus(detailEvent) !== 'cancelled' && (
                attending.has(detailEvent.id) ? (
                  <Pressable
                    onPress={() =>
                      Alert.alert('Cancel RSVP', 'Remove yourself from this event?', [
                        { text: 'No', style: 'cancel' },
                        {
                          text: 'Yes',
                          style: 'destructive',
                          onPress: () => {
                            cancelRSVP(detailEvent);
                            setDetailEvent((prev) =>
                              prev
                                ? { ...prev, attendance_count: Math.max(0, (prev.attendance_count ?? 1) - 1) }
                                : prev,
                            );
                          },
                        },
                      ])
                    }
                    style={[styles.detailRsvpBtn, { backgroundColor: palette.surface, borderColor: palette.primary }]}
                  >
                    <KISIcon name="check" size={14} color={palette.primary} />
                    <Text style={{ color: palette.primary, fontWeight: '600', marginLeft: 6 }}>
                      Going — Cancel RSVP
                    </Text>
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={() => {
                      rsvp(detailEvent);
                      setDetailEvent((prev) =>
                        prev
                          ? { ...prev, attendance_count: (prev.attendance_count ?? 0) + 1 }
                          : prev,
                      );
                    }}
                    style={[styles.detailRsvpBtn, { backgroundColor: palette.primary, borderColor: palette.primary }]}
                  >
                    <Text style={{ color: '#fff', fontWeight: '600' }}>RSVP to this event</Text>
                  </Pressable>
                )
              )}

              {/* Owner: Edit + Delete */}
              {detailEvent && isOwner(detailEvent) && (
                <View style={styles.ownerActions}>
                  <Pressable
                    onPress={() => openEdit(detailEvent)}
                    style={[styles.ownerBtn, { backgroundColor: palette.surface, borderColor: palette.border }]}
                  >
                    <KISIcon name="edit" size={14} color={palette.text} />
                    <Text style={{ color: palette.text, fontSize: 13, fontWeight: '500', marginLeft: 6 }}>
                      Edit
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => confirmDelete(detailEvent)}
                    style={[
                      styles.ownerBtn,
                      { backgroundColor: '#ef444415', borderColor: '#ef4444' },
                    ]}
                  >
                    <KISIcon name="trash" size={14} color="#ef4444" />
                    <Text style={{ color: '#ef4444', fontSize: 13, fontWeight: '500', marginLeft: 6 }}>
                      Delete
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* ------------------------------------------------------------------ */}
      {/* REMINDER PICKER MODAL                                                */}
      {/* ------------------------------------------------------------------ */}
      <Modal
        visible={reminderModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setReminderModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: palette.card, borderColor: palette.inputBorder }]}>
            <View style={[styles.detailHeader, { marginBottom: 12 }]}>
              <Text style={[styles.modalTitle, { color: palette.text, flex: 1 }]}>
                Set Reminder
              </Text>
              <Pressable onPress={() => setReminderModalVisible(false)} hitSlop={12}>
                <KISIcon name="close" size={20} color={palette.subtext} />
              </Pressable>
            </View>
            <Text style={{ color: palette.subtext, fontSize: 13, marginBottom: 16 }}>
              You'll be notified when the app is open near the event time.
            </Text>
            {REMINDER_OPTIONS.map((option) => {
              const isSelected = reminderEvent != null && savedReminders[reminderEvent.id] === option.offsetMinutes;
              return (
                <Pressable
                  key={option.offsetMinutes}
                  onPress={() => { if (reminderEvent) saveReminder(reminderEvent, option.offsetMinutes); }}
                  style={[
                    styles.reminderOption,
                    {
                      backgroundColor: isSelected ? palette.primary + '18' : palette.surface,
                      borderColor: isSelected ? palette.primary : palette.border,
                    },
                  ]}
                >
                  <KISIcon name="bell" size={15} color={isSelected ? palette.primary : palette.subtext} />
                  <Text style={{ color: isSelected ? palette.primary : palette.text, fontSize: 14, marginLeft: 10, fontWeight: isSelected ? '600' : '400' }}>
                    {option.label}
                  </Text>
                  {isSelected && (
                    <View style={{ flex: 1, alignItems: 'flex-end' }}>
                      <KISIcon name="check" size={14} color={palette.primary} />
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>
      </Modal>

      {/* ------------------------------------------------------------------ */}
      {/* ATTENDEE LIST MODAL                                                  */}
      {/* ------------------------------------------------------------------ */}
      <Modal
        visible={attendeeModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAttendeeModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: palette.card, borderColor: palette.inputBorder, maxHeight: '60%' },
            ]}
          >
            <View style={[styles.detailHeader, { marginBottom: 12 }]}>
              <Text style={[styles.modalTitle, { color: palette.text, flex: 1 }]}>
                Attendees
              </Text>
              <Pressable onPress={() => setAttendeeModalVisible(false)} hitSlop={12}>
                <KISIcon name="close" size={20} color={palette.subtext} />
              </Pressable>
            </View>

            {attendeesLoading ? (
              <ActivityIndicator color={palette.primary} style={{ marginVertical: 24 }} />
            ) : attendees.length === 0 ? (
              <Text style={{ color: palette.subtext, textAlign: 'center', paddingVertical: 24 }}>
                No attendee details available.
              </Text>
            ) : (
              <FlatList
                data={attendees}
                keyExtractor={(a) => a.id}
                renderItem={({ item }) => (
                  <View
                    style={[
                      styles.attendeeRow,
                      { borderBottomColor: palette.border },
                    ]}
                  >
                    <View
                      style={[styles.attendeeAvatar, { backgroundColor: palette.primary + '33' }]}
                    >
                      <Text style={{ color: palette.primary, fontWeight: '700' }}>
                        {(item.display_name ?? item.username ?? '?')[0].toUpperCase()}
                      </Text>
                    </View>
                    <Text style={{ color: palette.text, fontSize: 14 }}>
                      {item.display_name ?? item.username ?? `User ${item.id.slice(0, 6)}`}
                    </Text>
                  </View>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 20, fontWeight: '700' },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  filterRow: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  card: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 10 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 2 },
  eventTitle: { fontSize: 16, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  rsvpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  modalCard: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    padding: 20,
    maxHeight: '88%',
  },
  detailCard: { maxHeight: '90%' },
  modalTitle: { fontSize: 17, fontWeight: '700', marginBottom: 16 },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  fieldLabel: { fontSize: 12, marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14 },
  modalRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 12 },
  btnSecondary: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 8 },
  btnPrimary: { paddingHorizontal: 20, paddingVertical: 9, borderRadius: 8 },
  detailActions: { marginTop: 16, gap: 10 },
  detailRsvpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  ownerActions: { flexDirection: 'row', gap: 10 },
  ownerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  ticketSection: {
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  manageTicketsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  attendeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  attendeeAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  reminderOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
});
