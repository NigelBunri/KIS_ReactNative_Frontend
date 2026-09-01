// src/components/partners/PartnerVolunteerRosterPanel.tsx
//
// Volunteer Roster: admins post shifts with a slot capacity, members
// sign up (or cancel), admins see the confirmed roster. Backed by
// apps.partners.PartnerVolunteerShift/PartnerVolunteerSignup.
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
  canManage?: boolean;
  onClose: () => void;
};

type Shift = {
  id: string | number;
  title: string;
  description?: string;
  location?: string;
  starts_at: string;
  ends_at: string;
  slots_total: number;
  signup_count: number;
  slots_remaining: number;
  my_status: string | null;
};
type RosterRow = { id: string | number; volunteer: string; volunteer_name?: string | null; status: string };

const inputStyle = (palette: any) => ({
  color: palette.text,
  borderColor: palette.borderMuted,
  borderWidth: 2,
  paddingHorizontal: 10,
  paddingVertical: 8,
  borderRadius: 10,
  marginTop: 8,
});

function formatRange(startIso: string, endIso: string) {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const dateStr = start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const startTime = start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const endTime = end.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${dateStr} · ${startTime} – ${endTime}`;
}

export default function PartnerVolunteerRosterPanel({ isOpen, panelWidth, panelTranslateX, partnerId, canManage, onClose }: Props) {
  const { palette } = useKISTheme();
  const [loading, setLoading] = useState(false);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [saving, setSaving] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [slotsTotal, setSlotsTotal] = useState('1');

  const [selectedShiftId, setSelectedShiftId] = useState<string | number | null>(null);
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);

  const backdropOpacity = panelTranslateX.interpolate({ inputRange: [0, panelWidth], outputRange: [1, 0], extrapolate: 'clamp' });

  const load = useCallback(async () => {
    if (!partnerId) return;
    const res = await getRequest(ROUTES.partners.volunteerShifts(partnerId), { errorMessage: 'Unable to load shifts.' });
    const payload = res?.data ?? [];
    setShifts(Array.isArray(payload) ? payload : []);
  }, [partnerId]);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [isOpen, load]);

  const selectedShift = shifts.find((s) => String(s.id) === String(selectedShiftId)) ?? null;

  const loadRoster = useCallback(
    async (shiftId: string | number) => {
      if (!partnerId) return;
      setRosterLoading(true);
      const res = await getRequest(ROUTES.partners.volunteerShiftRoster(partnerId, String(shiftId)), { errorMessage: 'Unable to load roster.' });
      const payload = (res?.data ?? []) as RosterRow[];
      setRoster(Array.isArray(payload) ? payload : []);
      setRosterLoading(false);
    },
    [partnerId],
  );

  const openShift = (shift: Shift) => {
    setSelectedShiftId(shift.id);
    if (canManage) loadRoster(shift.id);
  };

  const createShift = async () => {
    if (!partnerId || !title.trim() || !startsAt.trim() || !endsAt.trim()) {
      Alert.alert('Missing info', 'Title, start and end time are required (e.g. 2026-10-01T09:00:00Z).');
      return;
    }
    setSaving(true);
    const res = await postRequest(
      ROUTES.partners.volunteerShifts(partnerId),
      {
        title: title.trim(),
        description: description.trim(),
        location: location.trim(),
        starts_at: startsAt.trim(),
        ends_at: endsAt.trim(),
        slots_total: Number(slotsTotal) || 1,
      },
      { errorMessage: 'Unable to create shift.' },
    );
    setSaving(false);
    if (!res?.success) {
      Alert.alert('Failed', res?.message ?? 'Unable to create shift.');
      return;
    }
    setTitle('');
    setDescription('');
    setLocation('');
    setStartsAt('');
    setEndsAt('');
    setSlotsTotal('1');
    setShowCreate(false);
    load();
  };

  const deleteShift = (shift: Shift) => {
    if (!partnerId) return;
    Alert.alert('Delete shift?', `"${shift.title}" will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { deleteRequest } = await import('@/network/delete');
          const res = await deleteRequest(ROUTES.partners.volunteerShiftDetail(partnerId, String(shift.id)), {
            errorMessage: 'Unable to delete shift.',
          });
          if (!res?.success) {
            Alert.alert('Failed', res?.message ?? 'Unable to delete shift.');
            return;
          }
          setSelectedShiftId(null);
          load();
        },
      },
    ]);
  };

  const signUp = async () => {
    if (!partnerId || !selectedShift) return;
    const res = await postRequest(
      ROUTES.partners.volunteerShiftSignup(partnerId, String(selectedShift.id)),
      {},
      { errorMessage: 'Unable to sign up.' },
    );
    if (!res?.success) {
      Alert.alert('Failed', res?.message ?? 'Unable to sign up.');
      return;
    }
    load();
  };

  const cancelSignup = async () => {
    if (!partnerId || !selectedShift) return;
    const res = await postRequest(
      ROUTES.partners.volunteerShiftSignup(partnerId, String(selectedShift.id)),
      { action: 'cancel' },
      { errorMessage: 'Unable to cancel signup.' },
    );
    if (!res?.success) {
      Alert.alert('Failed', res?.message ?? 'Unable to cancel signup.');
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
            onPress={() => (selectedShiftId ? setSelectedShiftId(null) : onClose())}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <Text style={{ color: palette.text, fontSize: 18 }}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingsPanelTitle, { color: palette.text }]}>
              {selectedShift ? selectedShift.title : 'Volunteer Roster'}
            </Text>
            <Text style={[styles.settingsPanelDescription, { color: palette.subtext }]}>
              {selectedShift ? formatRange(selectedShift.starts_at, selectedShift.ends_at) : 'Schedule volunteers and shifts'}
            </Text>
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.settingsPanelBody} showsVerticalScrollIndicator={false}>
          {loading ? (
            <ActivityIndicator size="small" color={palette.primary} />
          ) : selectedShift ? (
            <>
              {selectedShift.description ? (
                <Text style={{ color: palette.subtext, fontSize: 13, marginBottom: 12 }}>{selectedShift.description}</Text>
              ) : null}
              {selectedShift.location ? (
                <Text style={{ color: palette.text, fontSize: 13, marginBottom: 12 }}>📍 {selectedShift.location}</Text>
              ) : null}
              <Text style={{ color: palette.subtext, fontSize: 12, marginBottom: 16 }}>
                {selectedShift.signup_count}/{selectedShift.slots_total} filled · {selectedShift.slots_remaining} spot{selectedShift.slots_remaining === 1 ? '' : 's'} left
              </Text>

              {selectedShift.my_status === 'signed_up' || selectedShift.my_status === 'confirmed' ? (
                <Pressable
                  onPress={cancelSignup}
                  style={{ paddingVertical: 10, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: palette.danger, marginBottom: 20 }}
                >
                  <Text style={{ color: palette.danger, fontWeight: '700' }}>Cancel my signup</Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={signUp}
                  disabled={selectedShift.slots_remaining <= 0}
                  style={({ pressed }) => [{ paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: palette.royalInk, opacity: pressed || selectedShift.slots_remaining <= 0 ? 0.5 : 1, marginBottom: 20 }]}
                >
                  <Text style={{ color: palette.ivory, fontWeight: '700' }}>
                    {selectedShift.slots_remaining <= 0 ? 'Shift full' : 'Sign up'}
                  </Text>
                </Pressable>
              )}

              {canManage ? (
                <>
                  <Text style={{ color: palette.text, fontSize: 14, fontWeight: '800', marginBottom: 8 }}>
                    Roster ({roster.length})
                  </Text>
                  {rosterLoading ? (
                    <ActivityIndicator size="small" color={palette.primary} />
                  ) : roster.length === 0 ? (
                    <Text style={{ color: palette.subtext, fontSize: 13, marginBottom: 16 }}>No signups yet.</Text>
                  ) : (
                    roster.map((row) => (
                      <View key={row.id} style={[styles.settingsFeatureRow, { borderColor: palette.borderMuted, backgroundColor: palette.surface, marginBottom: 8 }]}>
                        <Text style={[styles.settingsFeatureTitle, { color: palette.text }]}>{row.volunteer_name || 'Volunteer'}</Text>
                      </View>
                    ))
                  )}
                  <Pressable onPress={() => deleteShift(selectedShift)} style={{ marginTop: 8 }}>
                    <Text style={{ color: palette.danger, fontSize: 13, fontWeight: '700' }}>Delete shift</Text>
                  </Pressable>
                </>
              ) : null}
            </>
          ) : (
            <>
              {canManage ? (
                <Pressable onPress={() => setShowCreate((v) => !v)}>
                  <Text style={{ color: palette.primary, fontSize: 13, fontWeight: '700', marginBottom: showCreate ? 8 : 12 }}>
                    {showCreate ? '− Cancel new shift' : '+ New shift'}
                  </Text>
                </Pressable>
              ) : null}
              {showCreate ? (
                <View style={{ marginBottom: 16 }}>
                  <TextInput value={title} onChangeText={setTitle} placeholder="Shift title" placeholderTextColor={palette.subtext} style={[inputStyle(palette), { marginTop: 0 }]} />
                  <TextInput value={description} onChangeText={setDescription} placeholder="Description (optional)" placeholderTextColor={palette.subtext} multiline style={[inputStyle(palette), { minHeight: 50, textAlignVertical: 'top' }]} />
                  <TextInput value={location} onChangeText={setLocation} placeholder="Location (optional)" placeholderTextColor={palette.subtext} style={inputStyle(palette)} />
                  <TextInput value={startsAt} onChangeText={setStartsAt} placeholder="Start (e.g. 2026-10-01T09:00:00Z)" placeholderTextColor={palette.subtext} style={inputStyle(palette)} autoCapitalize="none" />
                  <TextInput value={endsAt} onChangeText={setEndsAt} placeholder="End (e.g. 2026-10-01T11:00:00Z)" placeholderTextColor={palette.subtext} style={inputStyle(palette)} autoCapitalize="none" />
                  <TextInput value={slotsTotal} onChangeText={setSlotsTotal} placeholder="Volunteers needed" placeholderTextColor={palette.subtext} keyboardType="number-pad" style={inputStyle(palette)} />
                  <Pressable
                    onPress={createShift}
                    disabled={saving}
                    style={({ pressed }) => [{ marginTop: 10, paddingVertical: 10, borderRadius: 10, backgroundColor: palette.royalInk, alignItems: 'center', opacity: pressed || saving ? 0.7 : 1 }]}
                  >
                    <Text style={{ color: palette.ivory, fontWeight: '700' }}>{saving ? 'Creating…' : 'Create shift'}</Text>
                  </Pressable>
                </View>
              ) : null}

              {shifts.length === 0 ? (
                <Text style={{ color: palette.subtext, fontSize: 13, textAlign: 'center', marginTop: 20 }}>No shifts scheduled.</Text>
              ) : (
                shifts.map((shift) => (
                  <Pressable
                    key={shift.id}
                    onPress={() => openShift(shift)}
                    style={[styles.settingsFeatureRow, { borderColor: palette.borderMuted, backgroundColor: palette.surface, marginBottom: 8 }]}
                  >
                    <Text style={[styles.settingsFeatureTitle, { color: palette.text }]}>{shift.title}</Text>
                    <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 4 }}>{formatRange(shift.starts_at, shift.ends_at)}</Text>
                    <Text style={{ color: palette.subtext, fontSize: 11, marginTop: 2 }}>
                      {shift.signup_count}/{shift.slots_total} filled
                      {shift.my_status === 'signed_up' || shift.my_status === 'confirmed' ? ' · You signed up' : ''}
                    </Text>
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
