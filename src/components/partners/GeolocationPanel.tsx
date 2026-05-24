import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import useGeolocationData, {
  CreateEventPayload,
  LocationAttendance,
  LocationEvent,
} from '@/screens/tabs/partners/hooks/useGeolocationData';

type PanelView = 'events' | 'create_event' | 'event_detail' | 'attendance';

type Props = {
  isOpen: boolean;
  panelWidth: number;
  panelTranslateX: Animated.Value;
  partnerId: string;
  isAdmin: boolean;
  onClose: () => void;
};

const STATUS_COLORS: Record<string, string> = {
  draft: '#888',
  active: '#4caf50',
  closed: '#f39c12',
  cancelled: '#e74c3c',
};

const RECURRENCE_OPTIONS = [
  { key: 'once', label: 'Once' },
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
];

export default function GeolocationPanel({
  isOpen, panelWidth, panelTranslateX, partnerId, isAdmin, onClose,
}: Props) {
  const [view, setView] = useState<PanelView>('events');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [attendanceSummary, setAttendanceSummary] = useState<any>(null);
  const [createForm, setCreateForm] = useState<Partial<CreateEventPayload>>({
    recurrence: 'once',
    radius_meters: 100,
    checkin_opens_before_minutes: 15,
    late_after_minutes: 0,
    show_arrival_order_to_members: false,
    show_checkin_count_to_members: true,
    status: 'draft',
  });

  const geo = useGeolocationData(partnerId);

  useEffect(() => {
    if (isOpen) {
      geo.loadEvents();
      setView('events');
    }
  }, [isOpen, partnerId]);

  const handleSelectEvent = useCallback(async (event: LocationEvent) => {
    geo.setSelectedEvent(event);
    setSelectedEventId(event.id);
    if (isAdmin) {
      const data = await geo.loadAttendance(event.id);
      setAttendanceSummary(data?.summary ?? null);
      setView('attendance');
    } else {
      setView('event_detail');
    }
  }, [isAdmin, geo]);

  const handleCreateEvent = useCallback(async () => {
    const payload = createForm as CreateEventPayload;
    if (!payload.title?.trim()) return;
    if (!payload.start_dt || !payload.end_dt) return;
    if (!payload.center_lat || !payload.center_lng) return;
    const result = await geo.createEvent(payload);
    if (result) {
      setView('events');
      setCreateForm({
        recurrence: 'once',
        radius_meters: 100,
        checkin_opens_before_minutes: 15,
        late_after_minutes: 0,
        show_arrival_order_to_members: false,
        show_checkin_count_to_members: true,
        status: 'draft',
      });
    }
  }, [createForm, geo]);

  const handleDeleteEvent = useCallback(async (event: LocationEvent) => {
    await geo.deleteEvent(event.id);
  }, [geo]);

  const handleActivate = useCallback(async (event: LocationEvent) => {
    await geo.updateEvent(event.id, { status: 'active' });
    geo.loadEvents();
  }, [geo]);

  const handleClose = useCallback(async (event: LocationEvent) => {
    await geo.updateEvent(event.id, { status: 'closed' });
    geo.loadEvents();
  }, [geo]);

  if (!isOpen) return null;

  return (
    <Animated.View
      style={[styles.panel, { width: panelWidth, transform: [{ translateX: panelTranslateX }] }]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {view !== 'events' && (
            <TouchableOpacity onPress={() => setView('events')} style={styles.backBtn}>
              <Text style={styles.backBtnText}>← Back</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.headerTitle}>
            {view === 'events' ? 'Location & Attendance' :
             view === 'create_event' ? 'New Event' :
             view === 'attendance' ? 'Attendance' : 'Event Details'}
          </Text>
        </View>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>

        {/* ── Events list ── */}
        {view === 'events' && (
          <>
            {isAdmin && (
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => setView('create_event')}
              >
                <Text style={styles.primaryBtnText}>+ New Location Event</Text>
              </TouchableOpacity>
            )}

            {geo.loading && (
              <View style={styles.centerRow}>
                <ActivityIndicator size="small" color="#c9a84c" />
                <Text style={styles.loadingText}>Loading events…</Text>
              </View>
            )}

            {!geo.loading && geo.events.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>📍</Text>
                <Text style={styles.emptyTitle}>No location events yet</Text>
                <Text style={styles.emptyBody}>
                  {isAdmin
                    ? 'Create your first attendance event to track member check-ins at meetings, services, or field assignments.'
                    : 'No active events have been set up by your admin yet.'}
                </Text>
              </View>
            )}

            {geo.events.map(event => (
              <Pressable
                key={event.id}
                style={styles.eventCard}
                onPress={() => handleSelectEvent(event)}
              >
                <View style={styles.eventCardTop}>
                  <Text style={styles.eventTitle}>{event.title}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[event.status] + '22' }]}>
                    <Text style={[styles.statusText, { color: STATUS_COLORS[event.status] }]}>
                      {event.status.toUpperCase()}
                    </Text>
                  </View>
                </View>
                <Text style={styles.eventMeta}>
                  {new Date(event.start_dt).toLocaleString()} → {new Date(event.end_dt).toLocaleTimeString()}
                </Text>
                <Text style={styles.eventMeta}>
                  Radius: {event.radius_meters} m · {event.attendance_count} checked in
                  {event.is_checkin_open ? ' · ✅ Check-in open' : ''}
                </Text>
                {isAdmin && (
                  <View style={styles.eventActions}>
                    {event.status === 'draft' && (
                      <TouchableOpacity onPress={() => handleActivate(event)} style={styles.actionBtn}>
                        <Text style={styles.actionBtnText}>Activate</Text>
                      </TouchableOpacity>
                    )}
                    {event.status === 'active' && (
                      <TouchableOpacity onPress={() => handleClose(event)} style={[styles.actionBtn, styles.actionBtnWarning]}>
                        <Text style={styles.actionBtnText}>Close</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={() => handleDeleteEvent(event)} style={[styles.actionBtn, styles.actionBtnDanger]}>
                      <Text style={styles.actionBtnText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </Pressable>
            ))}
          </>
        )}

        {/* ── Create event form ── */}
        {view === 'create_event' && (
          <>
            <Text style={styles.sectionLabel}>Event Title *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Sunday Morning Service"
              placeholderTextColor="#666"
              value={createForm.title || ''}
              onChangeText={v => setCreateForm(f => ({ ...f, title: v }))}
            />

            <Text style={styles.sectionLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              placeholder="What is this event?"
              placeholderTextColor="#666"
              multiline
              numberOfLines={3}
              value={createForm.description || ''}
              onChangeText={v => setCreateForm(f => ({ ...f, description: v }))}
            />

            <_DateTimeField
              label="Start Date/Time *"
              value={createForm.start_dt ? new Date(createForm.start_dt) : null}
              onChange={d => setCreateForm(f => ({ ...f, start_dt: d.toISOString() }))}
            />

            <_DateTimeField
              label="End Date/Time *"
              value={createForm.end_dt ? new Date(createForm.end_dt) : null}
              onChange={d => setCreateForm(f => ({ ...f, end_dt: d.toISOString() }))}
            />

            <Text style={styles.sectionLabel}>Recurrence</Text>
            <View style={styles.chipRow}>
              {RECURRENCE_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.chip, createForm.recurrence === opt.key && styles.chipActive]}
                  onPress={() => setCreateForm(f => ({ ...f, recurrence: opt.key as any }))}
                >
                  <Text style={[styles.chipText, createForm.recurrence === opt.key && styles.chipTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sectionLabel}>Geofence Center *</Text>
            <TouchableOpacity
              style={styles.locationBtn}
              onPress={() => {
                navigator.geolocation.getCurrentPosition(
                  pos => {
                    setCreateForm(f => ({
                      ...f,
                      center_lat: pos.coords.latitude.toFixed(6),
                      center_lng: pos.coords.longitude.toFixed(6),
                    }));
                  },
                  () => Alert.alert('Location Error', 'Could not access your location. Enter coordinates manually below.'),
                  { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
                );
              }}
            >
              <Text style={styles.locationBtnText}>📍 Use My Current Location</Text>
            </TouchableOpacity>
            {(createForm.center_lat || createForm.center_lng) && (
              <View style={styles.coordDisplay}>
                <Text style={styles.coordText}>
                  {createForm.center_lat}, {createForm.center_lng}
                </Text>
                <TouchableOpacity onPress={() => setCreateForm(f => ({ ...f, center_lat: '', center_lng: '' }))}>
                  <Text style={styles.coordClear}>✕</Text>
                </TouchableOpacity>
              </View>
            )}
            <Text style={styles.coordOrLabel}>— or enter manually —</Text>
            <TextInput
              style={styles.input}
              placeholder="Latitude e.g. 3.848500"
              placeholderTextColor="#666"
              keyboardType="decimal-pad"
              value={createForm.center_lat || ''}
              onChangeText={v => setCreateForm(f => ({ ...f, center_lat: v }))}
            />
            <View style={{ height: 8 }} />
            <TextInput
              style={styles.input}
              placeholder="Longitude e.g. 11.502100"
              placeholderTextColor="#666"
              keyboardType="decimal-pad"
              value={createForm.center_lng || ''}
              onChangeText={v => setCreateForm(f => ({ ...f, center_lng: v }))}
            />

            <Text style={styles.sectionLabel}>Radius (metres)</Text>
            <TextInput
              style={styles.input}
              placeholder="100"
              placeholderTextColor="#666"
              keyboardType="numeric"
              value={String(createForm.radius_meters ?? 100)}
              onChangeText={v => setCreateForm(f => ({ ...f, radius_meters: parseInt(v, 10) || 100 }))}
            />

            <Text style={styles.sectionLabel}>Check-in opens X minutes before start</Text>
            <TextInput
              style={styles.input}
              placeholder="15"
              placeholderTextColor="#666"
              keyboardType="numeric"
              value={String(createForm.checkin_opens_before_minutes ?? 15)}
              onChangeText={v => setCreateForm(f => ({ ...f, checkin_opens_before_minutes: parseInt(v, 10) || 15 }))}
            />

            <Text style={styles.sectionLabel}>Mark late after X minutes (0 = never)</Text>
            <TextInput
              style={styles.input}
              placeholder="0"
              placeholderTextColor="#666"
              keyboardType="numeric"
              value={String(createForm.late_after_minutes ?? 0)}
              onChangeText={v => setCreateForm(f => ({ ...f, late_after_minutes: parseInt(v, 10) || 0 }))}
            />

            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Show arrival order to members</Text>
              <TouchableOpacity
                style={[styles.toggle, createForm.show_arrival_order_to_members && styles.toggleOn]}
                onPress={() => setCreateForm(f => ({ ...f, show_arrival_order_to_members: !f.show_arrival_order_to_members }))}
              >
                <Text style={styles.toggleText}>{createForm.show_arrival_order_to_members ? 'ON' : 'OFF'}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Show check-in count to members</Text>
              <TouchableOpacity
                style={[styles.toggle, createForm.show_checkin_count_to_members && styles.toggleOn]}
                onPress={() => setCreateForm(f => ({ ...f, show_checkin_count_to_members: !f.show_checkin_count_to_members }))}
              >
                <Text style={styles.toggleText}>{createForm.show_checkin_count_to_members ? 'ON' : 'OFF'}</Text>
              </TouchableOpacity>
            </View>

            {geo.error && <Text style={styles.errorText}>{geo.error}</Text>}

            <TouchableOpacity
              style={[styles.primaryBtn, geo.saving && styles.primaryBtnDisabled]}
              onPress={handleCreateEvent}
              disabled={geo.saving}
            >
              {geo.saving
                ? <ActivityIndicator size="small" color="#1a1a1a" />
                : <Text style={styles.primaryBtnText}>Create Event</Text>
              }
            </TouchableOpacity>
          </>
        )}

        {/* ── Attendance (admin) ── */}
        {view === 'attendance' && geo.selectedEvent && (
          <>
            <View style={styles.eventSummaryCard}>
              <Text style={styles.eventSummaryTitle}>{geo.selectedEvent.title}</Text>
              <Text style={styles.eventMeta}>
                {new Date(geo.selectedEvent.start_dt).toLocaleString()}
              </Text>
              <Text style={styles.eventMeta}>
                Radius: {geo.selectedEvent.radius_meters} m
              </Text>
            </View>

            {attendanceSummary && (
              <View style={styles.summaryRow}>
                <_StatBadge label="Checked In" value={attendanceSummary.total_checked_in} color="#4caf50" />
                <_StatBadge label="Late" value={attendanceSummary.late_count} color="#f39c12" />
                <_StatBadge label="Manual" value={attendanceSummary.manual_count} color="#888" />
              </View>
            )}

            {geo.loading
              ? <ActivityIndicator size="small" color="#c9a84c" style={{ marginTop: 16 }} />
              : geo.attendance.length === 0
              ? <Text style={styles.emptyBody}>No check-ins recorded yet.</Text>
              : geo.attendance.map(att => (
                  <View key={att.id} style={styles.attendanceRow}>
                    <View style={styles.arrivalBadge}>
                      <Text style={styles.arrivalNumber}>#{att.arrival_number}</Text>
                    </View>
                    <View style={styles.attendeeInfo}>
                      <Text style={styles.attendeeName}>{att.user_display?.display_name ?? att.user_id}</Text>
                      <Text style={styles.attendeeMeta}>
                        {new Date(att.checked_in_at).toLocaleTimeString()}
                        {att.is_late ? ' · ⏰ Late' : ''}
                        {att.is_manual ? ' · ✏️ Manual' : ''}
                        {' · ~'}{att.distance_from_center_m} m away
                      </Text>
                    </View>
                  </View>
                ))
            }

            <TouchableOpacity
              style={styles.refreshBtn}
              onPress={async () => {
                const data = await geo.loadAttendance(geo.selectedEvent!.id);
                setAttendanceSummary(data?.summary ?? null);
              }}
            >
              <Text style={styles.refreshBtnText}>↻ Refresh attendance</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── Event detail (member) ── */}
        {view === 'event_detail' && geo.selectedEvent && (
          <_MemberEventView
            event={geo.selectedEvent}
            partnerId={partnerId}
            geo={geo}
          />
        )}

      </ScrollView>
    </Animated.View>
  );
}

// ── Date/time picker field ────────────────────────────────────────────────────

function _DateTimeField({ label, value, onChange }: {
  label: string;
  value: Date | null;
  onChange: (d: Date) => void;
}) {
  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);
  const current = value ?? new Date();

  const displayStr = value
    ? `${value.toLocaleDateString()} ${value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : 'Tap to set';

  return (
    <View style={styles.dateFieldWrap}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <TouchableOpacity
        style={styles.dateBtn}
        onPress={() => Platform.OS === 'ios' ? setShowDate(true) : setShowDate(true)}
      >
        <Text style={[styles.dateBtnText, !value && styles.dateBtnPlaceholder]}>
          📅 {displayStr}
        </Text>
      </TouchableOpacity>
      {showDate && (
        <DateTimePicker
          value={current}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_, d) => {
            setShowDate(false);
            if (d) {
              const merged = new Date(current);
              merged.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
              onChange(merged);
              if (Platform.OS === 'android') setShowTime(true);
            }
          }}
        />
      )}
      {showTime && (
        <DateTimePicker
          value={current}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_, d) => {
            setShowTime(false);
            if (d) {
              const merged = new Date(current);
              merged.setHours(d.getHours(), d.getMinutes(), 0, 0);
              onChange(merged);
            }
          }}
        />
      )}
      {value && Platform.OS === 'ios' && (
        <TouchableOpacity style={styles.timeEditBtn} onPress={() => setShowTime(true)}>
          <Text style={styles.timeEditBtnText}>⏰ Change Time</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Member event view (check-in UI) ──────────────────────────────────────────

function _MemberEventView({ event, partnerId, geo }: {
  event: LocationEvent;
  partnerId: string;
  geo: ReturnType<typeof useGeolocationData>;
}) {
  const [consentLoaded, setConsentLoaded] = useState(false);
  const [statusLoaded, setStatusLoaded] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    geo.loadConsent().then(() => setConsentLoaded(true));
    geo.loadMyStatus(event.id).then(() => setStatusLoaded(true));
  }, [event.id]);

  const handleGrantConsent = async () => {
    await geo.setConsented(true);
  };

  const handleRevokeConsent = async () => {
    await geo.setConsented(false);
  };

  const handleCheckin = async () => {
    setCheckingIn(true);
    setLocationError(null);
    try {
      const pos: GeolocationPosition = await new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        })
      );
      const res = await geo.checkin(event.id, pos.coords.latitude, pos.coords.longitude, Platform.OS);
      if (res?.success || res?.status === 201 || res?.status === 200) {
        await geo.loadMyStatus(event.id);
      } else {
        setLocationError(res?.data?.detail || res?.message || 'Check-in failed. Are you in the right area?');
      }
    } catch {
      setLocationError('Could not get your location. Make sure location permission is enabled.');
    }
    setCheckingIn(false);
  };

  const hasConsent = geo.consent?.granted;
  const checkedIn = geo.myStatus?.checked_in;
  const attendance = geo.myStatus?.attendance;

  return (
    <>
      <View style={styles.eventSummaryCard}>
        <Text style={styles.eventSummaryTitle}>{event.title}</Text>
        {event.description ? <Text style={styles.eventMeta}>{event.description}</Text> : null}
        <Text style={styles.eventMeta}>{new Date(event.start_dt).toLocaleString()}</Text>
        <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[event.status] + '22', alignSelf: 'flex-start' }]}>
          <Text style={[styles.statusText, { color: STATUS_COLORS[event.status] }]}>
            {event.status.toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Safety notice */}
      <View style={styles.safetyNotice}>
        <Text style={styles.safetyIcon}>🔒</Text>
        <View style={styles.safetyBody}>
          <Text style={styles.safetyTitle}>Location used only for this event</Text>
          <Text style={styles.safetyText}>
            Your location is used only to verify you are within the event area. Precise coordinates are never stored. No background tracking.
          </Text>
        </View>
      </View>

      {/* Consent */}
      {consentLoaded && !hasConsent && (
        <View style={styles.consentBox}>
          <Text style={styles.consentTitle}>Location consent required</Text>
          <Text style={styles.consentBody}>
            To check in, you must allow this partner to verify your proximity once per event. You can revoke this at any time.
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={handleGrantConsent}>
            <Text style={styles.primaryBtnText}>Grant Location Consent</Text>
          </TouchableOpacity>
        </View>
      )}

      {consentLoaded && hasConsent && (
        <>
          {/* Already checked in */}
          {checkedIn && attendance && (
            <View style={styles.checkedInBox}>
              <Text style={styles.checkedInIcon}>✅</Text>
              <Text style={styles.checkedInTitle}>You're checked in!</Text>
              <Text style={styles.arrivalNumberLarge}>#{attendance.arrival_number}</Text>
              <Text style={styles.checkedInMeta}>
                {new Date(attendance.checked_in_at).toLocaleTimeString()}
                {attendance.is_late ? ' · Late' : ''}
              </Text>
              {geo.myStatus?.arrival_list && (
                <Text style={styles.arrivalMeta}>
                  {geo.myStatus.arrival_list.length} members checked in
                </Text>
              )}
            </View>
          )}

          {/* Not yet checked in */}
          {!checkedIn && (
            <>
              {!event.is_checkin_open && (
                <View style={styles.warningBox}>
                  <Text style={styles.warningText}>
                    Check-in window is not open yet. Come back closer to the event start time.
                  </Text>
                </View>
              )}

              {event.is_checkin_open && (
                <>
                  <Text style={styles.checkinGuide}>
                    Stand within {event.radius_meters} metres of the event location, then tap check in.
                  </Text>
                  {locationError && <Text style={styles.errorText}>{locationError}</Text>}
                  <TouchableOpacity
                    style={[styles.checkinBtn, (checkingIn || !event.is_checkin_open) && styles.primaryBtnDisabled]}
                    onPress={handleCheckin}
                    disabled={checkingIn || !event.is_checkin_open}
                  >
                    {checkingIn
                      ? <ActivityIndicator size="small" color="#1a1a1a" />
                      : <Text style={styles.checkinBtnText}>📍 Check In Now</Text>
                    }
                  </TouchableOpacity>
                </>
              )}
            </>
          )}

          {/* Revoke consent */}
          <TouchableOpacity style={styles.revokeBtn} onPress={handleRevokeConsent}>
            <Text style={styles.revokeBtnText}>Revoke location consent</Text>
          </TouchableOpacity>
        </>
      )}
    </>
  );
}

// ── Stat badge ────────────────────────────────────────────────────────────────

function _StatBadge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={[styles.statBadge, { borderColor: color + '44' }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#141414',
    borderLeftWidth: 1,
    borderLeftColor: '#2a2a2a',
    zIndex: 200,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowOffset: { width: -2, height: 0 },
    shadowRadius: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { color: '#f0e6c8', fontSize: 18, fontWeight: '700' },
  backBtn: { paddingRight: 8 },
  backBtnText: { color: '#c9a84c', fontSize: 14 },
  closeBtn: { padding: 8 },
  closeBtnText: { color: '#888', fontSize: 18 },
  body: { flex: 1 },
  bodyContent: { padding: 20, paddingBottom: 80 },

  primaryBtn: {
    backgroundColor: '#c9a84c',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: { color: '#1a1a1a', fontSize: 15, fontWeight: '700' },

  centerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20 },
  loadingText: { color: '#888', fontSize: 14 },

  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { color: '#f0e6c8', fontSize: 17, fontWeight: '700', marginBottom: 8 },
  emptyBody: { color: '#888', fontSize: 14, textAlign: 'center', lineHeight: 21 },

  eventCard: {
    backgroundColor: '#1f1f1f',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  eventCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  eventTitle: { color: '#f0e6c8', fontSize: 15, fontWeight: '700', flex: 1 },
  eventMeta: { color: '#888', fontSize: 12, marginTop: 2 },
  statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 10, fontWeight: '700' },
  eventActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  actionBtn: { backgroundColor: '#2a2a2a', borderRadius: 6, paddingVertical: 6, paddingHorizontal: 12 },
  actionBtnWarning: { backgroundColor: '#f39c1222' },
  actionBtnDanger: { backgroundColor: '#e74c3c22' },
  actionBtnText: { color: '#c9a84c', fontSize: 12, fontWeight: '600' },

  sectionLabel: { color: '#888', fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: '#1f1f1f',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    color: '#f0e6c8',
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
  },
  inputMultiline: { minHeight: 72, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: { borderRadius: 8, paddingVertical: 7, paddingHorizontal: 14, backgroundColor: '#1f1f1f', borderWidth: 1, borderColor: '#333' },
  chipActive: { backgroundColor: '#c9a84c22', borderColor: '#c9a84c' },
  chipText: { color: '#888', fontSize: 13 },
  chipTextActive: { color: '#c9a84c', fontWeight: '700' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 10 },
  toggleLabel: { color: '#ccc', fontSize: 14, flex: 1 },
  toggle: { backgroundColor: '#333', borderRadius: 6, paddingVertical: 6, paddingHorizontal: 16 },
  toggleOn: { backgroundColor: '#c9a84c33' },
  toggleText: { color: '#c9a84c', fontSize: 12, fontWeight: '700' },

  errorText: { color: '#e74c3c', fontSize: 13, marginVertical: 8 },

  eventSummaryCard: {
    backgroundColor: '#1f1f1f',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  eventSummaryTitle: { color: '#f0e6c8', fontSize: 17, fontWeight: '700', marginBottom: 4 },

  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statBadge: { flex: 1, borderWidth: 1, borderRadius: 10, padding: 12, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { color: '#888', fontSize: 11, marginTop: 2 },

  attendanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f1f1f',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  arrivalBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#c9a84c22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrivalNumber: { color: '#c9a84c', fontWeight: '800', fontSize: 14 },
  attendeeInfo: { flex: 1 },
  attendeeName: { color: '#f0e6c8', fontSize: 14, fontWeight: '600' },
  attendeeMeta: { color: '#888', fontSize: 12, marginTop: 2 },

  refreshBtn: { marginTop: 16, alignItems: 'center', padding: 12 },
  refreshBtnText: { color: '#c9a84c', fontSize: 14 },

  safetyNotice: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#1a2a1a',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2a3a2a',
  },
  safetyIcon: { fontSize: 20 },
  safetyBody: { flex: 1 },
  safetyTitle: { color: '#5aaf5a', fontSize: 13, fontWeight: '700', marginBottom: 4 },
  safetyText: { color: '#888', fontSize: 12, lineHeight: 18 },

  consentBox: {
    backgroundColor: '#1f1f1f',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#c9a84c44',
  },
  consentTitle: { color: '#f0e6c8', fontSize: 15, fontWeight: '700', marginBottom: 8 },
  consentBody: { color: '#888', fontSize: 13, lineHeight: 20, marginBottom: 16 },

  checkedInBox: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  checkedInIcon: { fontSize: 48 },
  checkedInTitle: { color: '#4caf50', fontSize: 17, fontWeight: '700' },
  arrivalNumberLarge: { color: '#c9a84c', fontSize: 48, fontWeight: '900' },
  checkedInMeta: { color: '#888', fontSize: 13 },
  arrivalMeta: { color: '#555', fontSize: 12 },

  warningBox: {
    backgroundColor: '#f39c1211',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f39c1244',
  },
  warningText: { color: '#f39c12', fontSize: 13 },

  checkinGuide: { color: '#888', fontSize: 13, marginBottom: 12, textAlign: 'center' },
  checkinBtn: {
    backgroundColor: '#c9a84c',
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 16,
  },
  checkinBtnText: { color: '#1a1a1a', fontSize: 17, fontWeight: '800' },

  revokeBtn: { alignItems: 'center', paddingVertical: 12 },
  revokeBtnText: { color: '#e74c3c', fontSize: 13 },

  dateFieldWrap: { marginBottom: 4 },
  dateBtn: {
    backgroundColor: '#1f1f1f',
    borderWidth: 1,
    borderColor: '#c9a84c44',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  dateBtnText: { color: '#f0e6c8', fontSize: 14 },
  dateBtnPlaceholder: { color: '#555' },
  timeEditBtn: { alignSelf: 'flex-start', marginTop: 6, paddingVertical: 4 },
  timeEditBtnText: { color: '#c9a84c', fontSize: 12 },

  locationBtn: {
    backgroundColor: '#1a2a1a',
    borderWidth: 1,
    borderColor: '#2a4a2a',
    borderRadius: 8,
    paddingVertical: 13,
    paddingHorizontal: 14,
    marginBottom: 8,
    alignItems: 'center',
  },
  locationBtnText: { color: '#5aaf5a', fontSize: 14, fontWeight: '600' },
  coordDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1f1f1f',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#c9a84c33',
  },
  coordText: { color: '#c9a84c', fontSize: 13, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  coordClear: { color: '#888', fontSize: 14 },
  coordOrLabel: { color: '#444', fontSize: 11, textAlign: 'center', marginVertical: 8 },
});
