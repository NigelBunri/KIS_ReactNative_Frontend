/**
 * LocationAttendanceTemplate
 *
 * Rendered inside OrganizationAppScreen when a tab has template = "partner_geolocation_attendance".
 * Inherits the app's brand colours and theme.
 *
 * Safety contract (matches backend rules):
 * - No silent tracking. User must explicitly tap "Check In".
 * - No background location.
 * - Precise coordinates used only for distance math, then discarded.
 * - Only rounded distance stored.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import useGeolocationData, {
  LocationEvent,
  MyAttendanceStatus,
} from '@/screens/tabs/partners/hooks/useGeolocationData';
import { useKISTheme } from '@/theme/useTheme';
import type { KISPalette } from '@/theme/constants';

type BrandColors = {
  primary?: string;
  background?: string;
  text?: string;
  accent?: string;
};

type Props = {
  partnerId: string;
  brandColors?: BrandColors;
  theme?: 'dark' | 'light';
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  active: 'Active',
  closed: 'Closed',
  cancelled: 'Cancelled',
};

export default function LocationAttendanceTemplate({ partnerId, brandColors, theme }: Props) {
  // `theme` is the partner org-app's own white-label setting (may differ from
  // the user's global app theme) — forced into useKISTheme so the palette
  // still comes from the real theme system (and reacts to the user's chosen
  // accent color) instead of a second, hand-maintained set of hex fallbacks.
  const { palette } = useKISTheme(theme);
  const primary = brandColors?.primary ?? palette.gold;
  const bg = brandColors?.background ?? palette.bg;
  const textColor = brandColors?.text ?? palette.text;
  const subColor = palette.subtext;
  const cardBg = palette.card;
  const borderColor = palette.border;

  const geo = useGeolocationData(partnerId);
  const [selectedEvent, setSelectedEvent] = useState<LocationEvent | null>(null);
  const [myStatus, setMyStatus] = useState<MyAttendanceStatus | null>(null);
  const [consentLoaded, setConsentLoaded] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    geo.loadEvents();
    geo.loadConsent().then(() => setConsentLoaded(true));
  }, [partnerId]);

  const handleSelectEvent = useCallback(async (event: LocationEvent) => {
    setSelectedEvent(event);
    setLocationError(null);
    const status = await geo.loadMyStatus(event.id);
    setMyStatus(status as MyAttendanceStatus);
  }, [geo]);

  const handleGrantConsent = useCallback(async () => {
    await geo.setConsented(true);
  }, [geo]);

  const handleRevokeConsent = useCallback(() => {
    Alert.alert(
      'Revoke Location Consent',
      'You will no longer be able to check in to location events until you re-grant consent.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: async () => { await geo.setConsented(false); },
        },
      ],
    );
  }, [geo]);

  const handleCheckin = useCallback(async () => {
    if (!selectedEvent) return;
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
      const res = await geo.checkin(
        selectedEvent.id,
        pos.coords.latitude,
        pos.coords.longitude,
        Platform.OS,
      );
      if (res?.success || res?.status === 201 || res?.status === 200) {
        const updated = await geo.loadMyStatus(selectedEvent.id);
        setMyStatus(updated as MyAttendanceStatus);
      } else {
        const detail = res?.data?.detail ?? res?.message ?? 'Check-in failed.';
        setLocationError(detail);
      }
    } catch {
      setLocationError('Could not access your location. Enable location permission and try again.');
    }
    setCheckingIn(false);
  }, [selectedEvent, geo]);

  const s = buildStyles(palette, primary, bg, textColor, subColor, cardBg, borderColor, brandColors?.accent);

  // ── Event list ──
  if (!selectedEvent) {
    return (
      <ScrollView style={[s.root]} contentContainerStyle={s.content}>
        <Text style={s.pageTitle}>Attendance Events</Text>
        <Text style={s.pageSub}>Check in when you arrive at an event to record your attendance.</Text>

        {geo.loading && (
          <View style={s.centerRow}>
            <ActivityIndicator size="small" color={primary} />
            <Text style={s.subText}>Loading events…</Text>
          </View>
        )}

        {!geo.loading && geo.events.length === 0 && (
          <View style={s.emptyState}>
            <Text style={s.emptyIcon}>📍</Text>
            <Text style={s.emptyTitle}>No active events</Text>
            <Text style={s.emptyBody}>Your admin hasn't created any attendance events yet.</Text>
          </View>
        )}

        {geo.events.filter(e => e.status === 'active' || e.is_checkin_open).map(event => (
          <Pressable key={event.id} style={s.eventCard} onPress={() => handleSelectEvent(event)}>
            <Text style={s.eventTitle}>{event.title}</Text>
            <Text style={s.eventMeta}>{new Date(event.start_dt).toLocaleString()}</Text>
            {event.show_checkin_count_to_members && (
              <Text style={s.eventMeta}>{event.attendance_count} checked in</Text>
            )}
            <View style={[s.pill, { backgroundColor: event.is_checkin_open ? primary + '22' : subColor + '22' }]}>
              <Text style={[s.pillText, { color: event.is_checkin_open ? primary : subColor }]}>
                {event.is_checkin_open ? '✅ Check-in open' : STATUS_LABELS[event.status]}
              </Text>
            </View>
          </Pressable>
        ))}

        <View style={s.safetyNotice}>
          <Text style={s.safetyText}>
            🔒 Location is used only for attendance events. No background tracking. You can revoke consent at any time.
          </Text>
        </View>
      </ScrollView>
    );
  }

  // ── Event detail + check-in ──
  const checkedIn = myStatus?.checked_in;
  const attendance = myStatus?.attendance;
  const hasConsent = geo.consent?.granted;

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      <TouchableOpacity onPress={() => setSelectedEvent(null)} style={s.backBtn}>
        <Text style={[s.backBtnText, { color: primary }]}>← Events</Text>
      </TouchableOpacity>

      <Text style={s.pageTitle}>{selectedEvent.title}</Text>
      {selectedEvent.description ? <Text style={s.pageSub}>{selectedEvent.description}</Text> : null}
      <Text style={s.eventMeta}>{new Date(selectedEvent.start_dt).toLocaleString()}</Text>

      <View style={s.safetyNotice}>
        <Text style={s.safetyText}>
          🔒 Location is used only to confirm you're within {selectedEvent.radius_meters} metres of this event. Precise coordinates are never stored. No background tracking. You can revoke consent at any time.
        </Text>
      </View>

      {/* Consent required */}
      {consentLoaded && !hasConsent && (
        <View style={s.consentBox}>
          <Text style={s.consentTitle}>Location consent needed</Text>
          <Text style={s.consentBody}>
            To check in, grant this organisation permission to verify your proximity once per event.
          </Text>
          <TouchableOpacity style={s.btn} onPress={handleGrantConsent}>
            <Text style={s.btnText}>Grant Location Consent</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Already checked in */}
      {consentLoaded && hasConsent && checkedIn && attendance && (
        <View style={s.checkedInBox}>
          <Text style={s.checkedInIcon}>✅</Text>
          <Text style={s.checkedInTitle}>You're checked in</Text>
          <Text style={[s.arrivalNumber, { color: primary }]}>#{attendance.arrival_number}</Text>
          <Text style={s.eventMeta}>
            {new Date(attendance.checked_in_at).toLocaleTimeString()}
            {attendance.is_late ? ' · Late' : ''}
          </Text>
          {myStatus?.checkin_count != null && (
            <Text style={s.subText}>{myStatus.checkin_count} total checked in</Text>
          )}
          {myStatus?.arrival_list && (
            <Text style={s.subText}>Arrival list: {myStatus.arrival_list.slice(0, 10).join(', ')}{myStatus.arrival_list.length > 10 ? '…' : ''}</Text>
          )}
          <TouchableOpacity style={s.revokeBtn} onPress={handleRevokeConsent}>
            <Text style={s.revokeBtnText}>Revoke consent</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Check-in UI */}
      {consentLoaded && hasConsent && !checkedIn && (
        <>
          {!selectedEvent.is_checkin_open && (
            <View style={s.warningBox}>
              <Text style={s.warningText}>
                Check-in window is not open. Come back closer to the event start time.
              </Text>
            </View>
          )}

          {selectedEvent.is_checkin_open && (
            <>
              <Text style={s.checkinGuide}>
                Stand within {selectedEvent.radius_meters} m of the event location, then tap check in.
              </Text>
              {locationError && <Text style={s.errorText}>{locationError}</Text>}
              <TouchableOpacity
                style={[s.btn, { backgroundColor: primary }, checkingIn && s.btnDisabled]}
                onPress={handleCheckin}
                disabled={checkingIn}
              >
                {checkingIn
                  ? <ActivityIndicator size="small" color={palette.onPrimary} />
                  : <Text style={[s.btnText, { color: palette.onPrimary }]}>📍 Check In Now</Text>
                }
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity style={s.revokeBtn} onPress={handleRevokeConsent}>
            <Text style={s.revokeBtnText}>Revoke consent</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

function buildStyles(
  palette: KISPalette,
  primary: string,
  bg: string,
  textColor: string,
  subColor: string,
  cardBg: string,
  borderColor: string,
  accent?: string,
) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: bg },
    content: { padding: 20, paddingBottom: 80 },
    pageTitle: { color: textColor, fontSize: 22, fontWeight: '800', marginBottom: 6 },
    pageSub: { color: subColor, fontSize: 14, marginBottom: 16, lineHeight: 20 },
    subText: { color: subColor, fontSize: 13 },
    centerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20 },
    emptyState: { alignItems: 'center', paddingVertical: 40 },
    emptyIcon: { fontSize: 40, marginBottom: 12 },
    emptyTitle: { color: textColor, fontSize: 17, fontWeight: '700', marginBottom: 8 },
    emptyBody: { color: subColor, fontSize: 14, textAlign: 'center' },
    eventCard: {
      backgroundColor: cardBg,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor,
    },
    eventTitle: { color: textColor, fontSize: 15, fontWeight: '700', marginBottom: 4 },
    eventMeta: { color: subColor, fontSize: 12, marginTop: 2 },
    pill: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4, marginTop: 8, alignSelf: 'flex-start' },
    pillText: { fontSize: 12, fontWeight: '600' },
    safetyNotice: {
      backgroundColor: `${palette.success}10`,
      borderRadius: 10,
      padding: 14,
      marginVertical: 16,
      borderWidth: 1,
      borderColor: `${palette.success}30`,
    },
    safetyText: { color: palette.success, fontSize: 12, lineHeight: 18 },
    consentBox: {
      backgroundColor: cardBg,
      borderRadius: 12,
      padding: 20,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: primary + '44',
    },
    consentTitle: { color: textColor, fontSize: 15, fontWeight: '700', marginBottom: 8 },
    consentBody: { color: subColor, fontSize: 13, lineHeight: 20, marginBottom: 16 },
    btn: {
      backgroundColor: primary,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: 'center',
      marginBottom: 12,
    },
    btnDisabled: { opacity: 0.5 },
    btnText: { color: palette.onPrimary, fontSize: 15, fontWeight: '700' },
    checkedInBox: { alignItems: 'center', paddingVertical: 32, gap: 8 },
    checkedInIcon: { fontSize: 48 },
    checkedInTitle: { color: accent ?? palette.success, fontSize: 17, fontWeight: '700' },
    arrivalNumber: { fontSize: 52, fontWeight: '900' },
    warningBox: {
      backgroundColor: `${palette.gold}10`,
      borderRadius: 10,
      padding: 14,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: `${palette.gold}30`,
    },
    warningText: { color: palette.gold, fontSize: 13 },
    checkinGuide: { color: subColor, fontSize: 13, marginBottom: 12, textAlign: 'center' },
    errorText: { color: palette.danger, fontSize: 13, marginBottom: 12, textAlign: 'center' },
    backBtn: { marginBottom: 12 },
    backBtnText: { fontSize: 14, fontWeight: '600' },
    revokeBtn: { alignItems: 'center', paddingVertical: 12 },
    revokeBtnText: { color: palette.danger, fontSize: 13 },
  });
}
