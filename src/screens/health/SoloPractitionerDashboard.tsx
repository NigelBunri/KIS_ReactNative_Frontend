/**
 * Solo Practitioner Dashboard
 *
 * For individual medical professionals (doctors, nurses, therapists, etc.)
 * who want to offer e-consultations and services without being part of an institution.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { KISIcon } from '@/constants/kisIcons';
import { getHealthThemeColors, HEALTH_THEME_SPACING } from '@/theme/health';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { patchRequest } from '@/network/patch';
import ROUTES from '@/network';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { SafeAreaView } from 'react-native-safe-area-context';

type Specialty =
  | 'general_practice'
  | 'pediatrics'
  | 'cardiology'
  | 'dermatology'
  | 'psychiatry'
  | 'orthopedics'
  | 'neurology'
  | 'gynecology'
  | 'ophthalmology'
  | 'dentistry'
  | 'physiotherapy'
  | 'nutrition'
  | 'psychology'
  | 'other';

type ServiceType = {
  key: string;
  label: string;
  description: string;
  icon: string;
  durationMin: number;
  priceUSD: number;
};

type AppointmentStatus = 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';

type Appointment = {
  id: string;
  patientName: string;
  serviceType: string;
  scheduledAt: string;
  status: AppointmentStatus;
  notes?: string;
};

type PractitionerProfile = {
  id?: string;
  displayName: string;
  specialty: Specialty;
  credentials: string;
  bio: string;
  licenseNumber: string;
  availabilityStatus: 'online' | 'busy' | 'offline';
  services: ServiceType[];
  todaySlots: string[];
  rating?: number;
  reviewCount?: number;
  totalConsultations?: number;
};

const SPECIALTIES: { value: Specialty; label: string }[] = [
  { value: 'general_practice', label: 'General Practice' },
  { value: 'pediatrics', label: 'Pediatrics' },
  { value: 'cardiology', label: 'Cardiology' },
  { value: 'dermatology', label: 'Dermatology' },
  { value: 'psychiatry', label: 'Psychiatry' },
  { value: 'orthopedics', label: 'Orthopedics' },
  { value: 'neurology', label: 'Neurology' },
  { value: 'gynecology', label: 'Gynecology' },
  { value: 'ophthalmology', label: 'Ophthalmology' },
  { value: 'dentistry', label: 'Dentistry' },
  { value: 'physiotherapy', label: 'Physiotherapy' },
  { value: 'nutrition', label: 'Nutrition' },
  { value: 'psychology', label: 'Psychology' },
  { value: 'other', label: 'Other Specialty' },
];

const DEFAULT_SERVICES: ServiceType[] = [
  {
    key: 'video_consult',
    label: 'Video Consultation',
    description: 'Live 1-on-1 video consultation',
    icon: 'videocam-outline',
    durationMin: 30,
    priceUSD: 40,
  },
  {
    key: 'chat_consult',
    label: 'Chat Consultation',
    description: 'Async or live text-based consultation',
    icon: 'chatbubble-outline',
    durationMin: 20,
    priceUSD: 20,
  },
  {
    key: 'second_opinion',
    label: 'Second Opinion',
    description: 'Review existing diagnosis or test results',
    icon: 'document-text-outline',
    durationMin: 45,
    priceUSD: 60,
  },
  {
    key: 'prescription_refill',
    label: 'Prescription Refill',
    description: 'Renew an existing prescription',
    icon: 'medical-outline',
    durationMin: 10,
    priceUSD: 15,
  },
  {
    key: 'home_visit',
    label: 'Home Visit',
    description: 'In-person consultation at patient location',
    icon: 'home-outline',
    durationMin: 60,
    priceUSD: 120,
  },
];

const STATUS_COLOR = {
  online: '#10b981',
  busy: '#f59e0b',
  offline: '#6b7280',
};

const STATUS_LABEL = {
  online: 'Available',
  busy: 'In consultation',
  offline: 'Offline',
};

const APPT_STATUS_COLOR: Record<AppointmentStatus, string> = {
  pending: '#f59e0b',
  confirmed: '#3b82f6',
  in_progress: '#10b981',
  completed: '#6b7280',
  cancelled: '#ef4444',
};

function PulseDot({ color }: { color: string }) {
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1.5, duration: 800, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]),
    ).start();
  }, [anim]);
  return (
    <Animated.View
      style={{
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: color,
        transform: [{ scale: anim }],
      }}
    />
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) {
  const scheme = useColorScheme();
  const palette = getHealthThemeColors(scheme === 'light' ? 'light' : 'dark');
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: palette.surface,
        borderRadius: 18,
        padding: 14,
        alignItems: 'center',
        gap: 6,
        borderWidth: 1,
        borderColor: palette.divider,
      }}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 19,
          backgroundColor: color + '22',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <KISIcon name={icon as any} size={18} color={color} />
      </View>
      <Text style={{ color: palette.text, fontWeight: '900', fontSize: 20 }}>{value}</Text>
      <Text style={{ color: palette.subtext, fontWeight: '700', fontSize: 11, textAlign: 'center' }}>{label}</Text>
    </View>
  );
}

type TabId = 'dashboard' | 'consultations' | 'services' | 'schedule' | 'profile';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'grid-outline' },
  { id: 'consultations', label: 'Queue', icon: 'people-outline' },
  { id: 'services', label: 'Services', icon: 'briefcase-outline' },
  { id: 'schedule', label: 'Schedule', icon: 'calendar-outline' },
  { id: 'profile', label: 'Profile', icon: 'person-outline' },
];

type Props = {
  onClose?: () => void;
};

export default function SoloPractitionerDashboard({ onClose }: Props) {
  const scheme = useColorScheme();
  const palette = getHealthThemeColors(scheme === 'light' ? 'light' : 'dark');
  const sp = HEALTH_THEME_SPACING;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [tab, setTab] = useState<TabId>('dashboard');
  const [loading, setLoading] = useState(false);
  const [activeConsult, setActiveConsult] = useState<string | null>(null);

  const [profile, setProfile] = useState<PractitionerProfile>({
    displayName: '',
    specialty: 'general_practice',
    credentials: '',
    bio: '',
    licenseNumber: '',
    availabilityStatus: 'offline',
    services: DEFAULT_SERVICES,
    todaySlots: ['09:00', '09:30', '10:00', '10:30', '11:00', '14:00', '14:30', '15:00'],
    rating: 0,
    reviewCount: 0,
    totalConsultations: 0,
  });

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileDraft, setProfileDraft] = useState<Partial<PractitionerProfile>>({});
  const [editingService, setEditingService] = useState<ServiceType | null>(null);
  const [serviceDraft, setServiceDraft] = useState<Partial<ServiceType>>({});

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const [meRes, apptRes] = await Promise.allSettled([
        getRequest(ROUTES.auth.checkLogin, {}),
        getRequest(ROUTES.healthOps.appointments, {}),
      ]);

      if (meRes.status === 'fulfilled') {
        const me = meRes.value?.data ?? meRes.value ?? {};
        const practitioner = me?.practitioner_profile ?? me?.health_practitioner ?? {};
        if (practitioner?.display_name || practitioner?.displayName) {
          setProfile((prev) => ({
            ...prev,
            id: practitioner.id,
            displayName: practitioner.display_name ?? practitioner.displayName ?? prev.displayName,
            specialty: practitioner.specialty ?? prev.specialty,
            credentials: practitioner.credentials ?? prev.credentials,
            bio: practitioner.bio ?? prev.bio,
            licenseNumber: practitioner.license_number ?? practitioner.licenseNumber ?? prev.licenseNumber,
            availabilityStatus: practitioner.availability_status ?? practitioner.availabilityStatus ?? prev.availabilityStatus,
            rating: practitioner.rating ?? prev.rating,
            reviewCount: practitioner.review_count ?? practitioner.reviewCount ?? prev.reviewCount,
            totalConsultations: practitioner.total_consultations ?? practitioner.totalConsultations ?? prev.totalConsultations,
          }));
        }
      }

      if (apptRes.status === 'fulfilled') {
        const apptData = apptRes.value?.data ?? apptRes.value;
        const apptList = Array.isArray(apptData?.results)
          ? apptData.results
          : Array.isArray(apptData)
          ? apptData
          : [];
        setAppointments(
          apptList.slice(0, 20).map((a: any) => ({
            id: a.id ?? a.booking_id ?? String(Math.random()),
            patientName: a.patient_name ?? a.patientName ?? 'Patient',
            serviceType: a.service_name ?? a.serviceName ?? a.service_type ?? 'Consultation',
            scheduledAt: a.scheduled_at ?? a.scheduledAt ?? a.date ?? '',
            status: (a.status ?? 'pending') as AppointmentStatus,
            notes: a.notes ?? '',
          })),
        );
      }
    } catch (_) {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard().catch(() => {});
  }, [loadDashboard]);

  const setAvailability = useCallback(async (status: 'online' | 'busy' | 'offline') => {
    setProfile((prev) => ({ ...prev, availabilityStatus: status }));
    try {
      await patchRequest(
        ROUTES.core.profiles,
        { availability_status: status },
        { errorMessage: '' },
      );
    } catch (_) {}
  }, []);

  const startVideoSession = useCallback(async (appointmentId?: string) => {
    try {
      setActiveConsult(appointmentId ?? 'new');
      const res = await postRequest(
        ROUTES.healthOps.videoSessionStart,
        appointmentId ? { appointment_id: appointmentId, role: 'provider' } : { role: 'provider' },
        { errorMessage: 'Unable to start video session.' },
      );
      if (res?.success === false) {
        Alert.alert('E-Consultation', res?.message || 'Unable to start video session.');
        setActiveConsult(null);
        return;
      }
      Alert.alert('Video Session', 'Video consultation started. Session link ready.');
    } catch (e: any) {
      Alert.alert('Video Session', e?.message || 'Unable to start video session.');
    } finally {
      setActiveConsult(null);
    }
  }, []);

  const startChatSession = useCallback(async (appointmentId?: string) => {
    try {
      setActiveConsult(appointmentId ?? 'chat-new');
      const res = await postRequest(
        ROUTES.healthOps.messagingSessionStart,
        appointmentId ? { appointment_id: appointmentId, role: 'provider' } : { role: 'provider' },
        { errorMessage: 'Unable to start messaging session.' },
      );
      if (res?.success === false) {
        Alert.alert('Chat Session', res?.message || 'Unable to start session.');
        setActiveConsult(null);
        return;
      }
      Alert.alert('Chat Consultation', 'Secure messaging session started.');
    } catch (e: any) {
      Alert.alert('Chat Consultation', e?.message || 'Unable to start session.');
    } finally {
      setActiveConsult(null);
    }
  }, []);

  const saveProfile = useCallback(async () => {
    const updated = { ...profile, ...profileDraft };
    setProfile(updated as PractitionerProfile);
    setEditingProfile(false);
    try {
      await patchRequest(
        ROUTES.core.profiles,
        {
          display_name: updated.displayName,
          specialty: updated.specialty,
          credentials: updated.credentials,
          bio: updated.bio,
          license_number: updated.licenseNumber,
        },
        { errorMessage: '' },
      );
      Alert.alert('Profile', 'Profile saved successfully.');
    } catch (_) {
      Alert.alert('Profile', 'Profile saved locally. Sync when online.');
    }
  }, [profile, profileDraft]);

  const todayAppts = useMemo(
    () => appointments.filter((a) => a.status === 'pending' || a.status === 'confirmed' || a.status === 'in_progress'),
    [appointments],
  );

  const renderDashboard = () => (
    <ScrollView contentContainerStyle={{ padding: sp.md, gap: sp.md, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>

      {/* Status header */}
      <View
        style={{
          backgroundColor: palette.surface,
          borderRadius: 22,
          padding: sp.md,
          borderWidth: 1,
          borderColor: palette.divider,
          gap: sp.sm,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ gap: 4 }}>
            <Text style={{ color: palette.subtext, fontWeight: '700', fontSize: 12 }}>
              Solo Practitioner
            </Text>
            <Text style={{ color: palette.text, fontWeight: '900', fontSize: 20 }}>
              {profile.displayName || 'Set up your profile'}
            </Text>
            <Text style={{ color: palette.subtext, fontWeight: '700', fontSize: 13 }}>
              {SPECIALTIES.find((s) => s.value === profile.specialty)?.label ?? profile.specialty}
              {profile.credentials ? ` · ${profile.credentials}` : ''}
            </Text>
          </View>
          <View style={{ alignItems: 'center', gap: 6 }}>
            <PulseDot color={STATUS_COLOR[profile.availabilityStatus]} />
            <Text style={{ color: STATUS_COLOR[profile.availabilityStatus], fontWeight: '800', fontSize: 12 }}>
              {STATUS_LABEL[profile.availabilityStatus]}
            </Text>
          </View>
        </View>

        {/* Availability toggle */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(['online', 'busy', 'offline'] as const).map((s) => (
            <Pressable
              key={s}
              onPress={() => setAvailability(s)}
              style={{
                flex: 1,
                borderWidth: 1.5,
                borderColor: profile.availabilityStatus === s ? STATUS_COLOR[s] : palette.divider,
                backgroundColor: profile.availabilityStatus === s ? STATUS_COLOR[s] + '22' : palette.card,
                borderRadius: 10,
                paddingVertical: 8,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: STATUS_COLOR[s], fontWeight: '900', fontSize: 12 }}>
                {STATUS_LABEL[s]}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Quick stats */}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <StatCard
          label="Today's Queue"
          value={String(todayAppts.length)}
          icon="calendar-outline"
          color="#3b82f6"
        />
        <StatCard
          label="Total Consults"
          value={String(profile.totalConsultations ?? 0)}
          icon="people-outline"
          color="#10b981"
        />
        <StatCard
          label="Rating"
          value={profile.rating ? profile.rating.toFixed(1) : '—'}
          icon="star-outline"
          color="#f59e0b"
        />
      </View>

      {/* Quick actions */}
      <View
        style={{
          backgroundColor: palette.surface,
          borderRadius: 22,
          padding: sp.md,
          borderWidth: 1,
          borderColor: palette.divider,
          gap: sp.sm,
        }}
      >
        <Text style={{ color: palette.text, fontWeight: '900', fontSize: 16 }}>Start a Session</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable
            onPress={() => startVideoSession()}
            style={{
              flex: 1,
              backgroundColor: '#3b82f6' + '22',
              borderWidth: 1.5,
              borderColor: '#3b82f6',
              borderRadius: 14,
              padding: 14,
              alignItems: 'center',
              gap: 8,
            }}
          >
            <KISIcon name="videocam-outline" size={24} color="#3b82f6" />
            <Text style={{ color: '#3b82f6', fontWeight: '900', fontSize: 13 }}>Video Consult</Text>
          </Pressable>
          <Pressable
            onPress={() => startChatSession()}
            style={{
              flex: 1,
              backgroundColor: '#10b981' + '22',
              borderWidth: 1.5,
              borderColor: '#10b981',
              borderRadius: 14,
              padding: 14,
              alignItems: 'center',
              gap: 8,
            }}
          >
            <KISIcon name="chatbubble-outline" size={24} color="#10b981" />
            <Text style={{ color: '#10b981', fontWeight: '900', fontSize: 13 }}>Chat Consult</Text>
          </Pressable>
          <Pressable
            onPress={() => Alert.alert('Clinical Session', 'Starting clinical session...')}
            style={{
              flex: 1,
              backgroundColor: '#8b5cf6' + '22',
              borderWidth: 1.5,
              borderColor: '#8b5cf6',
              borderRadius: 14,
              padding: 14,
              alignItems: 'center',
              gap: 8,
            }}
          >
            <KISIcon name="medical-outline" size={24} color="#8b5cf6" />
            <Text style={{ color: '#8b5cf6', fontWeight: '900', fontSize: 13 }}>Clinical</Text>
          </Pressable>
        </View>
      </View>

      {/* Today's appointments */}
      {todayAppts.length > 0 && (
        <View
          style={{
            backgroundColor: palette.surface,
            borderRadius: 22,
            padding: sp.md,
            borderWidth: 1,
            borderColor: palette.divider,
            gap: sp.sm,
          }}
        >
          <Text style={{ color: palette.text, fontWeight: '900', fontSize: 16 }}>Upcoming Today</Text>
          {todayAppts.slice(0, 4).map((a) => (
            <View
              key={a.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                backgroundColor: palette.card,
                borderRadius: 14,
                padding: 12,
              }}
            >
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: APPT_STATUS_COLOR[a.status],
                }}
              />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: palette.text, fontWeight: '800', fontSize: 14 }}>{a.patientName}</Text>
                <Text style={{ color: palette.subtext, fontWeight: '700', fontSize: 12 }}>{a.serviceType}</Text>
              </View>
              <Text style={{ color: palette.subtext, fontWeight: '700', fontSize: 12 }}>
                {a.scheduledAt ? new Date(a.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
              </Text>
              <Pressable
                onPress={() => startVideoSession(a.id)}
                style={{
                  backgroundColor: '#3b82f6',
                  borderRadius: 8,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 11 }}>Join</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {/* E-Consultation features */}
      <View
        style={{
          backgroundColor: palette.surface,
          borderRadius: 22,
          padding: sp.md,
          borderWidth: 1,
          borderColor: palette.divider,
          gap: sp.sm,
        }}
      >
        <Text style={{ color: palette.text, fontWeight: '900', fontSize: 16 }}>E-Consultation Features</Text>
        {[
          { icon: 'videocam-outline', label: 'Secure Video Calls', desc: 'HIPAA-compliant video sessions', color: '#3b82f6' },
          { icon: 'document-text-outline', label: 'E-Prescriptions', desc: 'Write and send digital prescriptions', color: '#10b981' },
          { icon: 'flask-outline', label: 'Lab Order Requests', desc: 'Order diagnostic tests remotely', color: '#f59e0b' },
          { icon: 'share-outline', label: 'Referral Network', desc: 'Refer patients to specialists', color: '#8b5cf6' },
          { icon: 'shield-checkmark-outline', label: 'HIPAA Compliant', desc: 'All sessions are encrypted and audited', color: '#ef4444' },
        ].map((feat) => (
          <View key={feat.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: feat.color + '22',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <KISIcon name={feat.icon as any} size={18} color={feat.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: palette.text, fontWeight: '800', fontSize: 14 }}>{feat.label}</Text>
              <Text style={{ color: palette.subtext, fontWeight: '700', fontSize: 12 }}>{feat.desc}</Text>
            </View>
          </View>
        ))}
      </View>

    </ScrollView>
  );

  const renderConsultations = () => (
    <ScrollView contentContainerStyle={{ padding: sp.md, gap: sp.sm, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
      <Text style={{ color: palette.text, fontWeight: '900', fontSize: 18, marginBottom: 4 }}>Consultation Queue</Text>

      {appointments.length === 0 ? (
        <View
          style={{
            backgroundColor: palette.surface,
            borderRadius: 20,
            padding: 32,
            alignItems: 'center',
            gap: 12,
            borderWidth: 1,
            borderColor: palette.divider,
          }}
        >
          <KISIcon name="people-outline" size={40} color={palette.subtext} />
          <Text style={{ color: palette.text, fontWeight: '900', fontSize: 16 }}>No consultations yet</Text>
          <Text style={{ color: palette.subtext, fontWeight: '700', textAlign: 'center' }}>
            Set your availability to start receiving consultation requests.
          </Text>
          <Pressable
            onPress={() => setAvailability('online')}
            style={{
              backgroundColor: '#10b981',
              borderRadius: 12,
              paddingHorizontal: 20,
              paddingVertical: 10,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '900' }}>Go Online</Text>
          </Pressable>
        </View>
      ) : (
        appointments.map((a) => (
          <View
            key={a.id}
            style={{
              backgroundColor: palette.surface,
              borderRadius: 18,
              padding: 14,
              borderWidth: 1,
              borderColor: APPT_STATUS_COLOR[a.status] + '55',
              gap: 10,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ gap: 2 }}>
                <Text style={{ color: palette.text, fontWeight: '900', fontSize: 16 }}>{a.patientName}</Text>
                <Text style={{ color: palette.subtext, fontWeight: '700', fontSize: 13 }}>{a.serviceType}</Text>
              </View>
              <View
                style={{
                  backgroundColor: APPT_STATUS_COLOR[a.status] + '22',
                  borderRadius: 8,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                }}
              >
                <Text style={{ color: APPT_STATUS_COLOR[a.status], fontWeight: '900', fontSize: 11 }}>
                  {a.status.replace(/_/g, ' ').toUpperCase()}
                </Text>
              </View>
            </View>

            {a.scheduledAt && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <KISIcon name="calendar-outline" size={14} color={palette.subtext} />
                <Text style={{ color: palette.subtext, fontWeight: '700', fontSize: 13 }}>
                  {new Date(a.scheduledAt).toLocaleString()}
                </Text>
              </View>
            )}

            {a.notes && (
              <Text style={{ color: palette.subtext, fontWeight: '600', fontSize: 13, fontStyle: 'italic' }}>
                "{a.notes}"
              </Text>
            )}

            {(a.status === 'pending' || a.status === 'confirmed') && (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable
                  onPress={() => startVideoSession(a.id)}
                  style={{
                    flex: 1,
                    backgroundColor: '#3b82f6',
                    borderRadius: 10,
                    paddingVertical: 10,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: '900' }}>Start Video</Text>
                </Pressable>
                <Pressable
                  onPress={() => startChatSession(a.id)}
                  style={{
                    flex: 1,
                    backgroundColor: '#10b981',
                    borderRadius: 10,
                    paddingVertical: 10,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: '900' }}>Start Chat</Text>
                </Pressable>
              </View>
            )}
          </View>
        ))
      )}
    </ScrollView>
  );

  const renderServices = () => (
    <ScrollView contentContainerStyle={{ padding: sp.md, gap: sp.sm, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text style={{ color: palette.text, fontWeight: '900', fontSize: 18 }}>Service Catalog</Text>
        <Pressable
          onPress={() => {
            setServiceDraft({ key: `service_${Date.now()}`, icon: 'briefcase-outline', durationMin: 30, priceUSD: 50 });
            setEditingService(null);
          }}
          style={{
            backgroundColor: palette.cardAccent,
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderWidth: 1,
            borderColor: palette.primary,
          }}
        >
          <Text style={{ color: palette.accentPrimary, fontWeight: '900', fontSize: 13 }}>+ Add</Text>
        </Pressable>
      </View>

      {profile.services.map((service) => (
        <View
          key={service.key}
          style={{
            backgroundColor: palette.surface,
            borderRadius: 18,
            padding: 14,
            borderWidth: 1,
            borderColor: palette.divider,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              backgroundColor: palette.cardAccent,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <KISIcon name={service.icon as any} size={22} color={palette.accentPrimary} />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{ color: palette.text, fontWeight: '900', fontSize: 15 }}>{service.label}</Text>
            <Text style={{ color: palette.subtext, fontWeight: '700', fontSize: 12 }}>{service.description}</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Text style={{ color: palette.accentPrimary, fontWeight: '800', fontSize: 13 }}>
                USD {service.priceUSD}
              </Text>
              <Text style={{ color: palette.subtext, fontWeight: '700', fontSize: 12 }}>
                {service.durationMin} min
              </Text>
            </View>
          </View>
          <Pressable
            onPress={() => { setEditingService(service); setServiceDraft({ ...service }); }}
          >
            <KISIcon name="pencil-outline" size={18} color={palette.subtext} />
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );

  const renderSchedule = () => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const today = new Date().getDay();
    return (
      <ScrollView contentContainerStyle={{ padding: sp.md, gap: sp.md, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <Text style={{ color: palette.text, fontWeight: '900', fontSize: 18, marginBottom: 4 }}>My Schedule</Text>

        {/* Week view */}
        <View
          style={{
            backgroundColor: palette.surface,
            borderRadius: 20,
            padding: sp.md,
            borderWidth: 1,
            borderColor: palette.divider,
            gap: sp.sm,
          }}
        >
          <Text style={{ color: palette.subtext, fontWeight: '800', fontSize: 12, letterSpacing: 0.8 }}>THIS WEEK</Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {days.map((day, idx) => {
              const isToday = idx === (today === 0 ? 6 : today - 1);
              const hasSlots = idx < 5;
              return (
                <Pressable
                  key={day}
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    gap: 4,
                    paddingVertical: 10,
                    borderRadius: 12,
                    backgroundColor: isToday ? palette.primary + '22' : palette.card,
                    borderWidth: 1,
                    borderColor: isToday ? palette.primary : palette.divider,
                  }}
                  onPress={() => Alert.alert(day, `Manage ${day} availability`)}
                >
                  <Text
                    style={{
                      color: isToday ? palette.primary : palette.subtext,
                      fontWeight: '900',
                      fontSize: 11,
                    }}
                  >
                    {day}
                  </Text>
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: hasSlots ? '#10b981' : palette.divider,
                    }}
                  />
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Today's time slots */}
        <View
          style={{
            backgroundColor: palette.surface,
            borderRadius: 20,
            padding: sp.md,
            borderWidth: 1,
            borderColor: palette.divider,
            gap: sp.sm,
          }}
        >
          <Text style={{ color: palette.text, fontWeight: '900', fontSize: 16 }}>Today's Slots</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {profile.todaySlots.map((slot) => {
              const isBooked = todayAppts.some(
                (a) => a.scheduledAt && new Date(a.scheduledAt).getHours() === parseInt(slot),
              );
              return (
                <Pressable
                  key={slot}
                  style={{
                    borderWidth: 1.5,
                    borderColor: isBooked ? '#ef4444' : '#10b981',
                    backgroundColor: isBooked ? '#ef444415' : '#10b98115',
                    borderRadius: 10,
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                  }}
                  onPress={() =>
                    Alert.alert(slot, isBooked ? 'This slot is booked.' : 'This slot is available.')
                  }
                >
                  <Text
                    style={{
                      color: isBooked ? '#ef4444' : '#10b981',
                      fontWeight: '800',
                      fontSize: 13,
                    }}
                  >
                    {slot}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable
            onPress={() => {
              if (profile.id) {
                navigation.navigate('AvailabilityManagement', {
                  institutionId: profile.id,
                  institutionType: 'telemedicine_provider',
                });
              } else {
                Alert.alert('Save profile first', 'Please save your practitioner profile before managing availability.');
              }
            }}
            style={{
              borderWidth: 1.5,
              borderColor: palette.divider,
              borderRadius: 12,
              paddingVertical: 10,
              alignItems: 'center',
              marginTop: 4,
            }}
          >
            <Text style={{ color: palette.subtext, fontWeight: '800' }}>Edit availability</Text>
          </Pressable>
        </View>

      </ScrollView>
    );
  };

  const renderProfile = () => (
    <ScrollView contentContainerStyle={{ padding: sp.md, gap: sp.md, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: palette.text, fontWeight: '900', fontSize: 18 }}>Practitioner Profile</Text>
        <Pressable
          onPress={() => {
            if (editingProfile) {
              saveProfile();
            } else {
              setProfileDraft({ ...profile });
              setEditingProfile(true);
            }
          }}
          style={{
            backgroundColor: editingProfile ? '#10b981' : palette.cardAccent,
            borderRadius: 10,
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderWidth: 1,
            borderColor: editingProfile ? '#10b981' : palette.primary,
          }}
        >
          <Text style={{ color: editingProfile ? '#fff' : palette.accentPrimary, fontWeight: '900' }}>
            {editingProfile ? 'Save' : 'Edit'}
          </Text>
        </Pressable>
      </View>

      {[
        { label: 'Display Name', field: 'displayName', placeholder: 'Dr. Jane Smith' },
        { label: 'Credentials', field: 'credentials', placeholder: 'MD, FACP' },
        { label: 'License Number', field: 'licenseNumber', placeholder: 'License / Registration number' },
        { label: 'Bio', field: 'bio', placeholder: 'Tell patients about your experience and approach...' },
      ].map((item) => (
        <View
          key={item.field}
          style={{
            backgroundColor: palette.surface,
            borderRadius: 18,
            padding: sp.md,
            borderWidth: 1,
            borderColor: palette.divider,
            gap: 6,
          }}
        >
          <Text style={{ color: palette.subtext, fontWeight: '800', fontSize: 12 }}>{item.label}</Text>
          {editingProfile ? (
            <TextInput
              value={String((profileDraft as any)[item.field] ?? '')}
              onChangeText={(val) => setProfileDraft((prev) => ({ ...prev, [item.field]: val }))}
              placeholder={item.placeholder}
              placeholderTextColor={palette.subtext}
              multiline={item.field === 'bio'}
              numberOfLines={item.field === 'bio' ? 3 : 1}
              style={{
                color: palette.text,
                fontWeight: '700',
                fontSize: 15,
                borderBottomWidth: 1,
                borderBottomColor: palette.divider,
                paddingVertical: 4,
              }}
            />
          ) : (
            <Text style={{ color: palette.text, fontWeight: '700', fontSize: 15 }}>
              {String((profile as any)[item.field] || item.placeholder)}
            </Text>
          )}
        </View>
      ))}

      {/* Specialty picker */}
      <View
        style={{
          backgroundColor: palette.surface,
          borderRadius: 18,
          padding: sp.md,
          borderWidth: 1,
          borderColor: palette.divider,
          gap: 10,
        }}
      >
        <Text style={{ color: palette.subtext, fontWeight: '800', fontSize: 12 }}>Specialty</Text>
        {editingProfile ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {SPECIALTIES.map((s) => {
              const isSelected = (profileDraft.specialty ?? profile.specialty) === s.value;
              return (
                <Pressable
                  key={s.value}
                  onPress={() => setProfileDraft((prev) => ({ ...prev, specialty: s.value }))}
                  style={{
                    borderWidth: 1.5,
                    borderColor: isSelected ? palette.primary : palette.divider,
                    backgroundColor: isSelected ? palette.cardAccent : palette.card,
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                  }}
                >
                  <Text style={{ color: isSelected ? palette.accentPrimary : palette.subtext, fontWeight: '800', fontSize: 12 }}>
                    {s.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <Text style={{ color: palette.text, fontWeight: '700', fontSize: 15 }}>
            {SPECIALTIES.find((s) => s.value === profile.specialty)?.label ?? profile.specialty}
          </Text>
        )}
      </View>

      {/* Partner account CTA */}
      <Pressable
        onPress={() => Alert.alert('Partner Account', 'Connect a partner account to manage your practice globally and access premium features.')}
        style={{
          backgroundColor: palette.cardAccent,
          borderRadius: 20,
          padding: sp.md,
          borderWidth: 1,
          borderColor: palette.primary,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: palette.primary,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <KISIcon name="globe-outline" size={22} color="#fff" />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ color: palette.accentPrimary, fontWeight: '900', fontSize: 15 }}>Connect Partner Account</Text>
          <Text style={{ color: palette.accentPrimary, fontWeight: '700', fontSize: 12, opacity: 0.8 }}>
            Go global · Premium management · Verified badge
          </Text>
        </View>
        <KISIcon name="chevron-forward-outline" size={18} color={palette.accentPrimary} />
      </Pressable>

    </ScrollView>
  );

  const renderContent = () => {
    switch (tab) {
      case 'dashboard': return renderDashboard();
      case 'consultations': return renderConsultations();
      case 'services': return renderServices();
      case 'schedule': return renderSchedule();
      case 'profile': return renderProfile();
    }
  };

  const serviceEditorVisible = serviceDraft && (serviceDraft.key !== undefined || editingService !== null);

  const saveService = () => {
    const key = editingService?.key ?? serviceDraft.key ?? `service_${Date.now()}`;
    const newService: ServiceType = {
      key,
      label: (serviceDraft.label ?? '').trim() || 'Service',
      description: (serviceDraft.description ?? '').trim(),
      icon: serviceDraft.icon ?? 'briefcase-outline',
      durationMin: Number(serviceDraft.durationMin) || 30,
      priceUSD: Number(serviceDraft.priceUSD) || 0,
    };
    if (editingService) {
      setProfile(prev => ({ ...prev, services: prev.services.map(s => s.key === editingService.key ? newService : s) }));
    } else {
      setProfile(prev => ({ ...prev, services: [...prev.services, newService] }));
    }
    setServiceDraft({});
    setEditingService(null);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }}>
      <Modal visible={!!serviceEditorVisible} transparent animationType="slide" onRequestClose={() => { setServiceDraft({}); setEditingService(null); }}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <View style={{ backgroundColor: palette.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 12 }}>
            <Text style={{ color: palette.text, fontWeight: '900', fontSize: 17 }}>{editingService ? 'Edit Service' : 'Add Service'}</Text>
            {[
              { label: 'Service name *', field: 'label', placeholder: 'e.g. General Consultation' },
              { label: 'Description', field: 'description', placeholder: 'Brief description' },
              { label: 'Duration (minutes)', field: 'durationMin', placeholder: '30', keyboardType: 'numeric' },
              { label: 'Price (USD)', field: 'priceUSD', placeholder: '50', keyboardType: 'numeric' },
            ].map(({ label, field, placeholder, keyboardType }) => (
              <View key={field}>
                <Text style={{ color: palette.subtext, fontSize: 12, fontWeight: '700', marginBottom: 4 }}>{label}</Text>
                <TextInput
                  value={String((serviceDraft as any)[field] ?? '')}
                  onChangeText={v => setServiceDraft(prev => ({ ...prev, [field]: field === 'durationMin' || field === 'priceUSD' ? Number(v) || v : v }))}
                  placeholder={placeholder}
                  placeholderTextColor={palette.subtext}
                  keyboardType={(keyboardType as any) ?? 'default'}
                  style={{ borderWidth: 1, borderColor: palette.divider, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, color: palette.text, fontSize: 14 }}
                />
              </View>
            ))}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
              <Pressable onPress={() => { setServiceDraft({}); setEditingService(null); }} style={{ flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: palette.divider }}>
                <Text style={{ color: palette.text, fontWeight: '700' }}>Cancel</Text>
              </Pressable>
              <Pressable onPress={saveService} style={{ flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, backgroundColor: palette.primary }}>
                <Text style={{ color: '#fff', fontWeight: '900' }}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: sp.md,
          paddingVertical: sp.sm,
          borderBottomWidth: 1,
          borderBottomColor: palette.divider,
          gap: 12,
        }}
      >
        {onClose && (
          <Pressable onPress={onClose} style={{ padding: 4 }}>
            <KISIcon name="close-outline" size={22} color={palette.subtext} />
          </Pressable>
        )}
        <View style={{ flex: 1 }}>
          <Text style={{ color: palette.text, fontWeight: '900', fontSize: 18 }}>Solo Practitioner</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <PulseDot color={STATUS_COLOR[profile.availabilityStatus]} />
            <Text style={{ color: STATUS_COLOR[profile.availabilityStatus], fontWeight: '700', fontSize: 12 }}>
              {STATUS_LABEL[profile.availabilityStatus]}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={loadDashboard}
          style={{ padding: 8, borderRadius: 10, backgroundColor: palette.card }}
        >
          <KISIcon name="refresh-outline" size={18} color={loading ? palette.subtext : palette.text} />
        </Pressable>
      </View>

      {/* Tab bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: sp.md, paddingVertical: 8, gap: 6, flexDirection: 'row' }}
      >
        {TABS.map((t) => {
          const isActive = tab === t.id;
          return (
            <Pressable
              key={t.id}
              onPress={() => setTab(t.id)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                borderWidth: 1.5,
                borderColor: isActive ? palette.primary : palette.divider,
                backgroundColor: isActive ? palette.cardAccent : palette.surface,
                borderRadius: 999,
                paddingHorizontal: 14,
                paddingVertical: 8,
              }}
            >
              <KISIcon name={t.icon as any} size={14} color={isActive ? palette.accentPrimary : palette.subtext} />
              <Text style={{ color: isActive ? palette.accentPrimary : palette.subtext, fontWeight: '800', fontSize: 13 }}>
                {t.label}
              </Text>
              {t.id === 'consultations' && todayAppts.length > 0 && (
                <View
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 9,
                    backgroundColor: '#ef4444',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: '900', fontSize: 10 }}>{todayAppts.length}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Content */}
      <View style={{ flex: 1 }}>
        {renderContent()}
      </View>
    </SafeAreaView>
  );
}
