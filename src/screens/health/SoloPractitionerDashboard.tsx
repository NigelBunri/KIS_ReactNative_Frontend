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
import { queueableJsonRequest } from '@/services/offlineActionQueue';
import ROUTES from '@/network';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { useKISTheme } from '@/theme/useTheme';
import { HealthCard, StatTile, SectionHeader, HealthTabBar, EmptyState, StatusPill } from '@/components/health';
import type { HealthTab } from '@/components/health';

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

const soloStatusColor = (status: string, p: any): string =>
  ({ online: p.success, busy: p.gold, offline: p.subtext } as Record<string, string>)[status] ?? p.subtext;

const STATUS_LABEL = {
  online: 'Available',
  busy: 'In consultation',
  offline: 'Offline',
};

const apptStatusColor = (status: AppointmentStatus, p: any): string =>
  ({ pending: p.gold, confirmed: p.primary, in_progress: p.success, completed: p.subtext, cancelled: p.danger } as Record<AppointmentStatus, string>)[status] ?? p.subtext;


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
  const { palette: kisPalette } = useKISTheme();
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
    if (!profile.id) {
      // No backend profile id resolved yet (practitioner profile bootstrap
      // pending) — avoid PATCHing the collection endpoint, which does not
      // accept partial updates and would silently no-op.
      return;
    }
    try {
      await queueableJsonRequest({
        domain: 'Healthcare',
        kind: 'healthcare.availability_status',
        method: 'PATCH',
        url: ROUTES.healthcare.profile(profile.id),
        body: { metadata: { availability_status: status } },
        dedupeKey: 'healthcare:availability-status',
        replaceExisting: true,
        errorMessage: '',
      });
    } catch (_) {}
  }, [profile.id]);

  // videoSessionStart/messagingSessionStart both require a workflow_session_id
  // (a ServiceWorkflowSession — institution+service+payment record from
  // apps.health_ops), which appointment_id can never satisfy: the
  // appointments shown on this screen (apps.core.Appointment, tied to a
  // PatientMasterRecord) aren't linked to a ServiceWorkflowSession at all —
  // they're two separate systems. Every call here failed unconditionally
  // with "workflow_session_id: this field is required" rather than doing
  // anything, so this is short-circuited with a clear explanation instead
  // of a wasted round-trip and a confusing raw backend error. Properly
  // wiring this needs a real decision on how solo-practitioner appointments
  // relate to the institution/service-scoped workflow-session system.
  const startVideoSession = useCallback(async (_appointmentId?: string) => {
    Alert.alert(
      'Video Session unavailable',
      'Starting a video consult directly from an appointment isn’t wired up yet on this screen. This is a known gap, not a temporary error.',
    );
  }, []);

  const startChatSession = useCallback(async (_appointmentId?: string) => {
    Alert.alert(
      'Chat Session unavailable',
      'Starting a chat consult directly from an appointment isn’t wired up yet on this screen. This is a known gap, not a temporary error.',
    );
  }, []);

  const saveProfile = useCallback(async () => {
    const updated = { ...profile, ...profileDraft };
    setProfile(updated as PractitionerProfile);
    setEditingProfile(false);
    if (!updated.id) {
      Alert.alert('Profile', 'Profile saved on this device. Sign in to sync to your account once a practitioner profile is provisioned.');
      return;
    }
    try {
      await patchRequest(
        ROUTES.healthcare.profile(updated.id),
        {
          metadata: {
            display_name: updated.displayName,
            specialty: updated.specialty,
            credentials: updated.credentials,
            bio: updated.bio,
            license_number: updated.licenseNumber,
            services: updated.services,
          },
        },
        { errorMessage: '' },
      );
      Alert.alert('Profile', 'Profile saved successfully.');
    } catch (_) {
      Alert.alert('Profile', 'Profile saved on this device. We could not reach the server — changes will sync when back online.');
    }
  }, [profile, profileDraft]);

  const todayAppts = useMemo(
    () => appointments.filter((a) => a.status === 'pending' || a.status === 'confirmed' || a.status === 'in_progress'),
    [appointments],
  );

  const renderDashboard = () => (
    <ScrollView contentContainerStyle={{ padding: sp.md, gap: sp.md, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>

      {/* Status header */}
      <HealthCard palette={palette} padding={sp.md} style={{ borderRadius: 22, gap: sp.sm }}>
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
            <PulseDot color={soloStatusColor(profile.availabilityStatus, kisPalette)} />
            <Text style={{ color: soloStatusColor(profile.availabilityStatus, kisPalette), fontWeight: '800', fontSize: 12 }}>
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
                borderColor: profile.availabilityStatus === s ? soloStatusColor(s, kisPalette) : palette.divider,
                backgroundColor: profile.availabilityStatus === s ? soloStatusColor(s, kisPalette) + '22' : palette.card,
                borderRadius: 10,
                paddingVertical: 8,
                minHeight: 44,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: soloStatusColor(s, kisPalette), fontWeight: '900', fontSize: 12 }}>
                {STATUS_LABEL[s]}
              </Text>
            </Pressable>
          ))}
        </View>
      </HealthCard>

      {/* Quick stats */}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <StatTile
          palette={palette}
          label="Today's Queue"
          value={String(todayAppts.length)}
          icon="calendar-outline"
          color={kisPalette.info}
        />
        <StatTile
          palette={palette}
          label="Total Consults"
          value={String(profile.totalConsultations ?? 0)}
          icon="people-outline"
          color={kisPalette.success}
        />
        <StatTile
          palette={palette}
          label="Rating"
          value={profile.rating ? profile.rating.toFixed(1) : '—'}
          icon="star-outline"
          color={kisPalette.gold}
        />
      </View>

      {/* Quick actions */}
      <HealthCard palette={palette} padding={sp.md} style={{ borderRadius: 22, gap: sp.sm }}>
        <SectionHeader palette={palette} title="Start a Session" />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable
            onPress={() => startVideoSession()}
            style={{
              flex: 1,
              backgroundColor: kisPalette.info + '22',
              borderWidth: 1.5,
              borderColor: kisPalette.info,
              borderRadius: 14,
              padding: 14,
              alignItems: 'center',
              gap: 8,
            }}
          >
            <KISIcon name="videocam-outline" size={24} color={kisPalette.info} />
            <Text style={{ color: kisPalette.info, fontWeight: '900', fontSize: 13 }}>Video Consult</Text>
          </Pressable>
          <Pressable
            onPress={() => startChatSession()}
            style={{
              flex: 1,
              backgroundColor: kisPalette.success + '22',
              borderWidth: 1.5,
              borderColor: kisPalette.success,
              borderRadius: 14,
              padding: 14,
              alignItems: 'center',
              gap: 8,
            }}
          >
            <KISIcon name="chatbubble-outline" size={24} color={kisPalette.success} />
            <Text style={{ color: kisPalette.success, fontWeight: '900', fontSize: 13 }}>Chat Consult</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              if (profile.id) {
                navigation.navigate('ClinicalCommandCenter', {
                  institutionId: profile.id,
                  institutionName: profile.displayName || undefined,
                });
              } else {
                (navigation as any).navigate('Broadcast');
              }
            }}
            style={{
              flex: 1,
              backgroundColor: kisPalette.primaryStrong + '22',
              borderWidth: 1.5,
              borderColor: kisPalette.primaryStrong,
              borderRadius: 14,
              padding: 14,
              alignItems: 'center',
              gap: 8,
            }}
          >
            <KISIcon name="medical-outline" size={24} color={kisPalette.primaryStrong} />
            <Text style={{ color: kisPalette.primaryStrong, fontWeight: '900', fontSize: 13 }}>Clinical</Text>
          </Pressable>
        </View>
      </HealthCard>

      {/* Today's appointments */}
      {todayAppts.length > 0 && (
        <HealthCard palette={palette} padding={sp.md} style={{ borderRadius: 22, gap: sp.sm }}>
          <SectionHeader palette={palette} title="Upcoming Today" />
          {todayAppts.slice(0, 4).map((a) => (
            <View
              key={a.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                backgroundColor: palette.cardAccent,
                borderRadius: 14,
                padding: 12,
              }}
            >
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: apptStatusColor(a.status, kisPalette),
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
                  backgroundColor: kisPalette.info,
                  borderRadius: 8,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                }}
              >
                <Text style={{ color: kisPalette.onPrimary, fontWeight: '900', fontSize: 11 }}>Join</Text>
              </Pressable>
            </View>
          ))}
        </HealthCard>
      )}

      {/* E-Consultation features */}
      <HealthCard palette={palette} padding={sp.md} style={{ borderRadius: 22, gap: sp.sm }}>
        <SectionHeader palette={palette} title="E-Consultation Features" />
        {[
          { icon: 'videocam-outline', label: 'Secure Video Calls', desc: 'HIPAA-compliant video sessions', color: kisPalette.info },
          { icon: 'document-text-outline', label: 'E-Prescriptions', desc: 'Write and send digital prescriptions', color: kisPalette.success },
          { icon: 'flask-outline', label: 'Lab Order Requests', desc: 'Order diagnostic tests remotely', color: kisPalette.gold },
          { icon: 'share-outline', label: 'Referral Network', desc: 'Refer patients to specialists', color: kisPalette.primaryStrong },
          { icon: 'shield-checkmark-outline', label: 'HIPAA Compliant', desc: 'All sessions are encrypted and audited', color: kisPalette.error },
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
      </HealthCard>

    </ScrollView>
  );

  const renderConsultations = () => (
    <ScrollView contentContainerStyle={{ padding: sp.md, gap: sp.sm, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
      <SectionHeader palette={palette} title="Consultation Queue" />

      {appointments.length === 0 ? (
        <HealthCard palette={palette} padding={0} style={{ borderRadius: 20 }}>
          <EmptyState
            palette={palette}
            accentColor={kisPalette.success}
            icon="people-outline"
            title="No consultations yet"
            message="Set your availability to start receiving consultation requests."
            ctaLabel="Go Online"
            onCtaPress={() => setAvailability('online')}
          />
        </HealthCard>
      ) : (
        appointments.map((a) => (
          <HealthCard key={a.id} palette={palette} padding={14} accentColor={apptStatusColor(a.status, kisPalette)} style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ gap: 2 }}>
                <Text style={{ color: palette.text, fontWeight: '900', fontSize: 16 }}>{a.patientName}</Text>
                <Text style={{ color: palette.subtext, fontWeight: '700', fontSize: 13 }}>{a.serviceType}</Text>
              </View>
              <StatusPill label={a.status.replace(/_/g, ' ')} color={apptStatusColor(a.status, kisPalette)} />
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
                    backgroundColor: kisPalette.info,
                    borderRadius: 10,
                    paddingVertical: 10,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: kisPalette.onPrimary, fontWeight: '900' }}>Start Video</Text>
                </Pressable>
                <Pressable
                  onPress={() => startChatSession(a.id)}
                  style={{
                    flex: 1,
                    backgroundColor: kisPalette.success,
                    borderRadius: 10,
                    paddingVertical: 10,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: kisPalette.onPrimary, fontWeight: '900' }}>Start Chat</Text>
                </Pressable>
              </View>
            )}
          </HealthCard>
        ))
      )}
    </ScrollView>
  );

  const renderServices = () => (
    <ScrollView contentContainerStyle={{ padding: sp.md, gap: sp.sm, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
      <SectionHeader
        palette={palette}
        title="Service Catalog"
        trailing={
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
        }
      />

      {profile.services.map((service) => (
        <HealthCard key={service.key} palette={palette} padding={14} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
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
        </HealthCard>
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
        <HealthCard palette={palette} padding={sp.md} style={{ borderRadius: 20, gap: sp.sm }}>
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
                  onPress={() => {
                    if (profile.id) {
                      navigation.navigate('AvailabilityManagement', {
                        institutionId: profile.id,
                        institutionType: 'clinic',
                      });
                    } else {
                      Alert.alert('Save profile first', 'Please save your practitioner profile before managing availability.');
                    }
                  }}
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
                      backgroundColor: hasSlots ? kisPalette.success : palette.divider,
                    }}
                  />
                </Pressable>
              );
            })}
          </View>
        </HealthCard>

        {/* Today's time slots */}
        <HealthCard palette={palette} padding={sp.md} style={{ borderRadius: 20, gap: sp.sm }}>
          <SectionHeader palette={palette} title="Today's Slots" />
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
                    borderColor: isBooked ? kisPalette.error : kisPalette.success,
                    backgroundColor: isBooked ? kisPalette.error + '15' : kisPalette.success + '15',
                    borderRadius: 10,
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                  }}
                  onPress={() => {
                    const slotInfo = isBooked ? 'This slot is booked.' : 'This slot is available.';
                    Alert.alert(
                      slot,
                      slotInfo,
                      isBooked
                        ? [
                            {
                              text: 'View Booking',
                              onPress: () => {
                                const booked = todayAppts.find(
                                  (a) => a.scheduledAt && new Date(a.scheduledAt).getHours() === parseInt(slot),
                                );
                                if (booked) {
                                  Alert.alert(booked.patientName, `${booked.serviceType}\n${booked.scheduledAt}`);
                                }
                              },
                            },
                            { text: 'Close', style: 'cancel' },
                          ]
                        : [{ text: 'OK', style: 'cancel' }],
                    );
                  }}
                >
                  <Text
                    style={{
                      color: isBooked ? kisPalette.error : kisPalette.success,
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
        </HealthCard>

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
            backgroundColor: editingProfile ? kisPalette.success : palette.cardAccent,
            borderRadius: 10,
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderWidth: 1,
            borderColor: editingProfile ? kisPalette.success : palette.primary,
          }}
        >
          <Text style={{ color: editingProfile ? kisPalette.onPrimary : palette.accentPrimary, fontWeight: '900' }}>
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
        <HealthCard key={item.field} palette={palette} padding={sp.md} style={{ gap: 6 }}>
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
        </HealthCard>
      ))}

      {/* Specialty picker */}
      <HealthCard palette={palette} padding={sp.md} style={{ gap: 10 }}>
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
      </HealthCard>

      {/* Partner account CTA */}
      <Pressable
        onPress={() => (navigation as any).navigate('MainTabs', { screen: 'Partners' })}
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
          <KISIcon name="globe-outline" size={22} color={kisPalette.onPrimary} />
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
    const nextServices = editingService
      ? profile.services.map(s => (s.key === editingService.key ? newService : s))
      : [...profile.services, newService];
    setProfile(prev => ({ ...prev, services: nextServices }));
    setServiceDraft({});
    setEditingService(null);
    if (profile.id) {
      patchRequest(
        ROUTES.healthcare.profile(profile.id),
        { metadata: { services: nextServices } },
        { errorMessage: '' },
      ).catch(() => {
        Alert.alert('Services', 'Service saved on this device. Changes will sync when back online.');
      });
    } else {
      Alert.alert('Services', 'Service saved on this device. Sign in to sync changes to your account.');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg, }}>
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
                <Text style={{ color: kisPalette.onPrimary, fontWeight: '900' }}>Save</Text>
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
          <Pressable
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={{ padding: 4, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
            accessibilityLabel="Close solo practitioner dashboard"
          >
            <KISIcon name="close-outline" size={22} color={palette.subtext} />
          </Pressable>
        )}
        <View style={{ flex: 1 }}>
          <Text style={{ color: palette.text, fontWeight: '900', fontSize: 18 }}>Solo Practitioner</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <PulseDot color={soloStatusColor(profile.availabilityStatus, kisPalette)} />
            <Text style={{ color: soloStatusColor(profile.availabilityStatus, kisPalette), fontWeight: '700', fontSize: 12 }}>
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
      <HealthTabBar
        palette={palette}
        accentColor={palette.accentPrimary}
        badgeColor={kisPalette.error}
        activeTabId={tab}
        onChange={(id) => setTab(id as TabId)}
        tabs={TABS.map((t): HealthTab => ({
          id: t.id,
          label: t.label,
          icon: t.icon,
          badgeCount: t.id === 'consultations' ? todayAppts.length : undefined,
        }))}
      />

      {/* Content */}
      <View style={{ flex: 1 }}>
        {renderContent()}
      </View>
    </SafeAreaView>
  );
}
