// src/screens/education/provider/course-builder/LiveEditor.tsx
//
// Education UX v2, Phase 3 — real editor for a course's live class
// sessions, replacing the Live tab's "go use Curriculum" pointer.
//
// Date/time entry: the old EducationManagementModal captured starts_at/
// ends_at as a raw text field (no date-picker dependency exists anywhere
// in the app for this). Rather than reproduce that or pull in a new
// dependency, this uses preset day/duration buttons that compute real
// ISO timestamps client-side — safer (no malformed-date parsing) and
// faster to use than typing a timestamp string.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import KISButton from '@/constants/KISButton';
import KISTextInput from '@/constants/KISTextInput';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { patchRequest } from '@/network/patch';

function FieldLabel({ children }: { children: React.ReactNode }) {
  const { palette } = useKISTheme();
  return <Text style={{ fontSize: 12, fontWeight: '700', color: palette.subtext, marginBottom: 4 }}>{children}</Text>;
}

const DAY_PRESETS = [
  { key: 1, title: 'Tomorrow' },
  { key: 3, title: 'In 3 days' },
  { key: 7, title: 'Next week' },
  { key: 14, title: 'In 2 weeks' },
];
const DURATION_PRESETS = [30, 60, 90, 120];

type Props = { institutionId: string; courseId: string };

export default function LiveEditor({ institutionId, courseId }: Props) {
  const { palette } = useKISTheme();
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [dayOffset, setDayOffset] = useState(7);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [deliveryMode, setDeliveryMode] = useState<'online' | 'onsite' | 'hybrid'>('online');
  const [meetingUrl, setMeetingUrl] = useState('');
  const [locationText, setLocationText] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getRequest(`${ROUTES.broadcasts.educationInstitutionClassSessions(institutionId)}?course_id=${courseId}`, { forceNetwork: true });
      setSessions(response?.data?.class_sessions ?? []);
    } finally {
      setLoading(false);
    }
  }, [institutionId, courseId]);

  useEffect(() => {
    load();
  }, [load]);

  const saveSession = useCallback(async () => {
    setSaving(true);
    try {
      const start = new Date(Date.now() + dayOffset * 24 * 60 * 60 * 1000);
      const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
      const response = await postRequest(
        ROUTES.broadcasts.educationInstitutionClassSessions(institutionId),
        {
          title: title.trim() || `Live session ${sessions.length + 1}`,
          course_id: courseId,
          starts_at: start.toISOString(),
          ends_at: end.toISOString(),
          delivery_mode: deliveryMode,
          meeting_url: deliveryMode !== 'onsite' ? meetingUrl.trim() : '',
          location_text: deliveryMode !== 'online' ? locationText.trim() : '',
          status: 'scheduled',
        },
        { errorMessage: 'Unable to schedule class.' },
      );
      if (response?.success) {
        setAdding(false);
        setTitle('');
        setMeetingUrl('');
        setLocationText('');
        await load();
      }
    } finally {
      setSaving(false);
    }
  }, [title, dayOffset, durationMinutes, deliveryMode, meetingUrl, locationText, institutionId, courseId, sessions.length, load]);

  const cancelSession = useCallback(async (sessionId: string) => {
    const response = await patchRequest(
      ROUTES.broadcasts.educationInstitutionClassSession(institutionId, sessionId),
      { status: 'cancelled' },
      { errorMessage: 'Unable to cancel session.' },
    );
    if (response?.success) await load();
  }, [institutionId, load]);

  if (loading) {
    return <ActivityIndicator color={palette.primary} style={{ marginTop: 20 }} />;
  }

  return (
    <View style={{ gap: 16 }}>
      {sessions.length === 0 ? <Text style={{ color: palette.subtext, fontSize: 13 }}>No live classes scheduled yet.</Text> : null}
      {sessions.map(session => (
        <View key={session.id} style={{ padding: 12, borderRadius: 12, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <KISIcon name="video" size={16} color={palette.primary} />
            <Text style={{ color: palette.text, fontWeight: '700', flex: 1 }} numberOfLines={1}>{session.title}</Text>
            <Text style={{ fontSize: 11, color: palette.subtext, textTransform: 'capitalize' }}>{session.status}</Text>
          </View>
          <Text style={{ fontSize: 12, color: palette.subtext }}>
            {session.starts_at ? new Date(session.starts_at).toLocaleString() : 'Unscheduled'} · {session.delivery_mode}
          </Text>
          {session.status !== 'cancelled' ? (
            <KISButton title="Cancel session" size="sm" variant="ghost" onPress={() => void cancelSession(session.id)} />
          ) : null}
        </View>
      ))}

      {adding ? (
        <View style={{ gap: 10, padding: 12, borderRadius: 12, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border }}>
          <View>
            <FieldLabel>Title</FieldLabel>
            <KISTextInput value={title} onChangeText={setTitle} placeholder="Live session title" />
          </View>
          <View>
            <FieldLabel>When</FieldLabel>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {DAY_PRESETS.map(preset => (
                <Pressable
                  key={preset.key}
                  onPress={() => setDayOffset(preset.key)}
                  style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: dayOffset === preset.key ? palette.primary : palette.border, backgroundColor: dayOffset === preset.key ? palette.primarySoft : 'transparent' }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: dayOffset === preset.key ? palette.primaryStrong : palette.subtext }}>{preset.title}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View>
            <FieldLabel>Duration</FieldLabel>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {DURATION_PRESETS.map(minutes => (
                <Pressable
                  key={minutes}
                  onPress={() => setDurationMinutes(minutes)}
                  style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: durationMinutes === minutes ? palette.primary : palette.border, backgroundColor: durationMinutes === minutes ? palette.primarySoft : 'transparent' }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: durationMinutes === minutes ? palette.primaryStrong : palette.subtext }}>{minutes} min</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View>
            <FieldLabel>Delivery</FieldLabel>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {(['online', 'onsite', 'hybrid'] as const).map(mode => (
                <Pressable
                  key={mode}
                  onPress={() => setDeliveryMode(mode)}
                  style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: deliveryMode === mode ? palette.primary : palette.border, backgroundColor: deliveryMode === mode ? palette.primarySoft : 'transparent' }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', textTransform: 'capitalize', color: deliveryMode === mode ? palette.primaryStrong : palette.subtext }}>{mode}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          {deliveryMode !== 'onsite' ? (
            <View>
              <FieldLabel>Meeting link</FieldLabel>
              <KISTextInput value={meetingUrl} onChangeText={setMeetingUrl} placeholder="https://…" autoCapitalize="none" />
            </View>
          ) : null}
          {deliveryMode !== 'online' ? (
            <View>
              <FieldLabel>Location</FieldLabel>
              <KISTextInput value={locationText} onChangeText={setLocationText} placeholder="Address or room" />
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <KISButton title={saving ? 'Scheduling…' : 'Schedule'} disabled={saving} loading={saving} onPress={() => void saveSession()} />
            <KISButton title="Cancel" variant="secondary" disabled={saving} onPress={() => setAdding(false)} />
          </View>
        </View>
      ) : (
        <KISButton title="+ Schedule a live class" variant="outline" onPress={() => setAdding(true)} />
      )}
    </View>
  );
}
