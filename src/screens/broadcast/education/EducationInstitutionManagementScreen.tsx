/**
 * Education Institution Management Screen
 *
 * Allows universities, schools, bootcamps, and any learning organization
 * to be created, configured, and managed globally from the app.
 * When connected to a partner account, management becomes global and multi-admin.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { patchRequest } from '@/network/patch';
import { API_BASE_URL } from '@/network/config';
import ROUTES from '@/network';
import { Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PermanentRemoteImage from '@/components/media/PermanentRemoteImage';

const INSTITUTIONS_ENDPOINT = `${API_BASE_URL}/api/v1/broadcasts/education/institutions/`;
const INSTITUTION_DASHBOARD_ENDPOINT = (id: string) => `${API_BASE_URL}/api/v1/broadcasts/education/institutions/${id}/dashboard/`;
const INSTITUTION_PROGRAMS_ENDPOINT = (id: string) => `${API_BASE_URL}/api/v1/broadcasts/education/institutions/${id}/programs/`;
const INSTITUTION_COURSES_ENDPOINT = (id: string) => `${API_BASE_URL}/api/v1/broadcasts/education/institutions/${id}/courses/`;
const INSTITUTION_MEMBERS_ENDPOINT = (id: string) => `${API_BASE_URL}/api/v1/broadcasts/education/institutions/${id}/memberships/`;

type InstitutionType =
  | 'university'
  | 'college'
  | 'school'
  | 'bootcamp'
  | 'corporate_training'
  | 'tutoring_center'
  | 'online_academy'
  | 'professional_institute'
  | 'research_institute'
  | 'other';

type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';

type Institution = {
  id: string;
  name: string;
  description?: string;
  institution_type?: InstitutionType;
  institutionType?: InstitutionType;
  website?: string;
  email?: string;
  phone?: string;
  address?: string;
  country?: string;
  logo_url?: string;
  logoUrl?: string;
  image_url?: string;
  imageUrl?: string;
  verification_status?: VerificationStatus;
  verificationStatus?: VerificationStatus;
  is_verified?: boolean;
  isVerified?: boolean;
  member_count?: number;
  memberCount?: number;
  course_count?: number;
  courseCount?: number;
  program_count?: number;
  programCount?: number;
  enrollment_count?: number;
  enrollmentCount?: number;
  membership_policy?: 'open' | 'invite' | 'request';
  membershipPolicy?: 'open' | 'invite' | 'request';
  partner_connected?: boolean;
  partnerConnected?: boolean;
  accreditation?: string;
  established_year?: number;
};

type TabId = 'overview' | 'courses' | 'programs' | 'members' | 'analytics' | 'settings';

const INST_TYPES: { value: InstitutionType; label: string; icon: string }[] = [
  { value: 'university', label: 'University', icon: 'school-outline' },
  { value: 'college', label: 'College', icon: 'library-outline' },
  { value: 'school', label: 'School', icon: 'book-outline' },
  { value: 'bootcamp', label: 'Bootcamp', icon: 'code-slash-outline' },
  { value: 'corporate_training', label: 'Corporate Training', icon: 'briefcase-outline' },
  { value: 'tutoring_center', label: 'Tutoring Center', icon: 'people-outline' },
  { value: 'online_academy', label: 'Online Academy', icon: 'globe-outline' },
  { value: 'professional_institute', label: 'Professional Institute', icon: 'medal-outline' },
  { value: 'research_institute', label: 'Research Institute', icon: 'flask-outline' },
  { value: 'other', label: 'Other', icon: 'ellipsis-horizontal-outline' },
];

const VERIFICATION_LABEL: Record<VerificationStatus, string> = {
  unverified: 'Not Verified',
  pending: 'Pending Review',
  verified: 'Verified',
  rejected: 'Rejected',
};

const verificationColor = (status: VerificationStatus, p: any): string =>
  ({ unverified: p.subtext, pending: p.gold, verified: p.success, rejected: p.danger } as Record<VerificationStatus, string>)[status] ?? p.subtext;

function StatBadge({ label, value, icon, color }: { label: string; value: string | number; icon: string; color: string }) {
  const { palette } = useKISTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: palette.surface,
        borderRadius: 16,
        padding: 12,
        alignItems: 'center',
        gap: 4,
        borderWidth: 1,
        borderColor: palette.divider,
      }}
    >
      <KISIcon name={icon as any} size={18} color={color} />
      <Text style={{ color: palette.text, fontWeight: '900', fontSize: 18 }}>{String(value)}</Text>
      <Text style={{ color: palette.subtext, fontWeight: '700', fontSize: 10, textAlign: 'center' }}>{label}</Text>
    </View>
  );
}

function CreateInstitutionSheet({
  visible,
  onClose,
  onCreate,
}: {
  visible: boolean;
  onClose: () => void;
  onCreate: (inst: Institution) => void;
}) {
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<{
    name: string;
    description: string;
    institution_type: InstitutionType;
    website: string;
    email: string;
    phone: string;
    address: string;
    country: string;
    accreditation: string;
    membership_policy: 'open' | 'invite' | 'request';
  }>({
    name: '',
    description: '',
    institution_type: 'university',
    website: '',
    email: '',
    phone: '',
    address: '',
    country: '',
    accreditation: '',
    membership_policy: 'open',
  });

  const steps = ['Identity', 'Details', 'Policy', 'Review'];

  const update = (key: keyof typeof form, val: string) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const handleCreate = async () => {
    if (!form.name.trim()) {
      Alert.alert('Required', 'Institution name is required.');
      return;
    }
    setSaving(true);
    try {
      const res = await postRequest(
        INSTITUTIONS_ENDPOINT,
        form,
        { errorMessage: 'Unable to create institution.' },
      );
      if (res?.success === false) {
        Alert.alert('Error', res?.message || 'Unable to create institution.');
        return;
      }
      const created = res?.data ?? res;
      Alert.alert('Success', `"${form.name}" institution created!`);
      onCreate(created);
      onClose();
      setStep(0);
      setForm({
        name: '',
        description: '',
        institution_type: 'university',
        website: '',
        email: '',
        phone: '',
        address: '',
        country: '',
        accreditation: '',
        membership_policy: 'open',
      });
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Unable to create institution.');
    } finally {
      setSaving(false);
    }
  };

  const renderStep0 = () => (
    <View style={{ gap: 16 }}>
      <Text style={{ color: palette.text, fontWeight: '900', fontSize: 18 }}>What type of institution?</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {INST_TYPES.map((t) => {
          const isSelected = form.institution_type === t.value;
          return (
            <Pressable
              key={t.value}
              onPress={() => update('institution_type', t.value)}
              style={{
                borderWidth: 1.5,
                borderColor: isSelected ? palette.primary : palette.divider,
                backgroundColor: isSelected ? palette.primarySoft : palette.surface,
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 8,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <KISIcon name={t.icon as any} size={14} color={isSelected ? palette.primaryStrong : palette.subtext} />
              <Text style={{ color: isSelected ? palette.primaryStrong : palette.subtext, fontWeight: '800', fontSize: 13 }}>
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const renderStep1 = () => (
    <View style={{ gap: 14 }}>
      <Text style={{ color: palette.text, fontWeight: '900', fontSize: 18 }}>Institution Details</Text>
      {[
        { label: 'Institution Name *', key: 'name', placeholder: 'e.g. Global Academy' },
        { label: 'Description', key: 'description', placeholder: 'What does your institution offer?' },
        { label: 'Accreditation', key: 'accreditation', placeholder: 'e.g. WASC, ISO 9001' },
        { label: 'Website', key: 'website', placeholder: 'https://your-institution.com' },
        { label: 'Contact Email', key: 'email', placeholder: 'info@your-institution.com' },
        { label: 'Phone', key: 'phone', placeholder: '+1 555 000 0000' },
        { label: 'Address', key: 'address', placeholder: 'Street address' },
        { label: 'Country', key: 'country', placeholder: 'e.g. United States' },
      ].map((field) => (
        <View key={field.key} style={{ gap: 4 }}>
          <Text style={{ color: palette.subtext, fontWeight: '800', fontSize: 12 }}>{field.label}</Text>
          <TextInput
            value={(form as any)[field.key]}
            onChangeText={(val) => update(field.key as keyof typeof form, val)}
            placeholder={field.placeholder}
            placeholderTextColor={palette.subtext}
            multiline={field.key === 'description'}
            numberOfLines={field.key === 'description' ? 3 : 1}
            style={{
              borderWidth: 1.5,
              borderColor: palette.divider,
              borderRadius: 12,
              padding: 12,
              color: palette.text,
              fontSize: 15,
              fontWeight: '600',
              backgroundColor: palette.surface,
            }}
          />
        </View>
      ))}
    </View>
  );

  const renderStep2 = () => (
    <View style={{ gap: 16 }}>
      <Text style={{ color: palette.text, fontWeight: '900', fontSize: 18 }}>Membership Policy</Text>
      <Text style={{ color: palette.subtext, fontWeight: '700', fontSize: 13 }}>
        How can students and staff join your institution?
      </Text>
      {[
        { value: 'open', label: 'Open enrollment', desc: 'Anyone can join immediately', icon: 'globe-outline' },
        { value: 'request', label: 'Request-based', desc: 'Students must request and be approved', icon: 'mail-outline' },
        { value: 'invite', label: 'Invite only', desc: 'Only invited users can join', icon: 'lock-closed-outline' },
      ].map((opt) => {
        const isSelected = form.membership_policy === opt.value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => update('membership_policy', opt.value)}
            style={{
              borderWidth: 1.5,
              borderColor: isSelected ? palette.primary : palette.divider,
              backgroundColor: isSelected ? palette.primarySoft : palette.surface,
              borderRadius: 16,
              padding: 14,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <KISIcon name={opt.icon as any} size={20} color={isSelected ? palette.primaryStrong : palette.subtext} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: isSelected ? palette.primaryStrong : palette.text, fontWeight: '900', fontSize: 15 }}>
                {opt.label}
              </Text>
              <Text style={{ color: palette.subtext, fontWeight: '700', fontSize: 12 }}>{opt.desc}</Text>
            </View>
            {isSelected && <KISIcon name="checkmark-circle" size={20} color={palette.primaryStrong} />}
          </Pressable>
        );
      })}
    </View>
  );

  const renderStep3 = () => (
    <View style={{ gap: 14 }}>
      <Text style={{ color: palette.text, fontWeight: '900', fontSize: 18 }}>Review & Create</Text>
      {[
        { label: 'Type', value: INST_TYPES.find((t) => t.value === form.institution_type)?.label ?? form.institution_type },
        { label: 'Name', value: form.name },
        { label: 'Description', value: form.description || '—' },
        { label: 'Accreditation', value: form.accreditation || '—' },
        { label: 'Website', value: form.website || '—' },
        { label: 'Email', value: form.email || '—' },
        { label: 'Country', value: form.country || '—' },
        { label: 'Membership', value: form.membership_policy },
      ].map((row) => (
        <View key={row.label} style={{ flexDirection: 'row', gap: 8 }}>
          <Text style={{ color: palette.subtext, fontWeight: '800', fontSize: 13, width: 110 }}>{row.label}</Text>
          <Text style={{ color: palette.text, fontWeight: '700', fontSize: 13, flex: 1 }}>{row.value}</Text>
        </View>
      ))}
    </View>
  );

  const stepContent = [renderStep0, renderStep1, renderStep2, renderStep3];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }}>
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: palette.divider,
          }}
        >
          <Pressable onPress={onClose}>
            <KISIcon name="close-outline" size={22} color={palette.subtext} />
          </Pressable>
          <Text style={{ color: palette.text, fontWeight: '900', fontSize: 18, flex: 1, textAlign: 'center' }}>
            Create Institution
          </Text>
          <Text style={{ color: palette.subtext, fontWeight: '700', fontSize: 13 }}>
            {step + 1}/{steps.length}
          </Text>
        </View>

        {/* Progress */}
        <View style={{ paddingHorizontal: 16, paddingTop: 12, gap: 8 }}>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {steps.map((s, i) => (
              <View
                key={s}
                style={{
                  flex: 1,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: i <= step ? palette.primary : palette.divider,
                }}
              />
            ))}
          </View>
          <Text style={{ color: palette.subtext, fontWeight: '800', fontSize: 12 }}>{steps[step]}</Text>
        </View>

        <ScrollView contentContainerStyle={{ padding: responsive.pageGutter, maxWidth: responsive.contentMaxWidth, width: '100%', alignSelf: 'center', paddingBottom: 120 }}>
          {stepContent[step]?.()}
        </ScrollView>

        {/* Navigation */}
        <View
          style={{
            flexDirection: 'row',
            gap: 10,
            paddingHorizontal: 16,
            paddingBottom: 24,
            paddingTop: 8,
            borderTopWidth: 1,
            borderTopColor: palette.divider,
          }}
        >
          {step > 0 && (
            <Pressable
              onPress={() => setStep((s) => s - 1)}
              style={{
                flex: 1,
                borderWidth: 1.5,
                borderColor: palette.divider,
                borderRadius: 14,
                paddingVertical: 14,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: palette.subtext, fontWeight: '900' }}>Back</Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => {
              if (step < steps.length - 1) {
                setStep((s) => s + 1);
              } else {
                handleCreate();
              }
            }}
            disabled={saving}
            style={{
              flex: 1,
              backgroundColor: palette.primary,
              borderRadius: 14,
              paddingVertical: 14,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: palette.onPrimary, fontWeight: '900', fontSize: 15 }}>
              {saving ? 'Creating…' : step < steps.length - 1 ? 'Next' : 'Create Institution'}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function InstitutionDashboard({
  institution,
  onClose,
}: {
  institution: Institution;
  onClose: () => void;
}) {
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const dashNavigation = useNavigation<any>();
  const [tab, setTab] = useState<TabId>('overview');
  const [loading, setLoading] = useState(false);
  const [dashboard, setDashboard] = useState<any>(null);
  const [courses, setCourses] = useState<any[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [tabLoading, setTabLoading] = useState(false);
  const [courseForm, setCourseForm] = useState<{ title: string; description: string } | null>(null);
  const [programForm, setProgramForm] = useState<{ title: string; description: string } | null>(null);
  const [editingInstitution, setEditingInstitution] = useState(false);
  const [editName, setEditName] = useState(institution.name);
  const [editDescription, setEditDescription] = useState(institution.description ?? '');
  const [savingInstitution, setSavingInstitution] = useState(false);

  const instType = (institution.institution_type ?? institution.institutionType ?? 'university') as InstitutionType;
  const verStatus = (institution.verification_status ?? institution.verificationStatus ?? 'unverified') as VerificationStatus;
  const memberCount = institution.member_count ?? institution.memberCount ?? 0;
  const courseCount = institution.course_count ?? institution.courseCount ?? 0;
  const programCount = institution.program_count ?? institution.programCount ?? 0;
  const enrollmentCount = institution.enrollment_count ?? institution.enrollmentCount ?? 0;
  const isPartnerConnected = institution.partner_connected ?? institution.partnerConnected ?? false;
  const logoUri = institution.logo_url ?? institution.logoUrl ?? institution.image_url ?? institution.imageUrl;

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getRequest(INSTITUTION_DASHBOARD_ENDPOINT(institution.id), {});
      setDashboard(res?.data ?? res);
    } catch {}
    finally { setLoading(false); }
  }, [institution.id]);

  useEffect(() => { loadDashboard().catch(() => {}); }, [loadDashboard]);

  const loadTabData = useCallback(async (tabId: TabId) => {
    if (tabId === 'courses') {
      setTabLoading(true);
      try {
        const res = await getRequest(INSTITUTION_COURSES_ENDPOINT(institution.id), {});
        const list = Array.isArray(res?.data?.results) ? res.data.results : Array.isArray(res?.data) ? res.data : [];
        setCourses(list);
      } catch {} finally { setTabLoading(false); }
    } else if (tabId === 'programs') {
      setTabLoading(true);
      try {
        const res = await getRequest(INSTITUTION_PROGRAMS_ENDPOINT(institution.id), {});
        const list = Array.isArray(res?.data?.results) ? res.data.results : Array.isArray(res?.data) ? res.data : [];
        setPrograms(list);
      } catch {} finally { setTabLoading(false); }
    } else if (tabId === 'members') {
      setTabLoading(true);
      try {
        const res = await getRequest(INSTITUTION_MEMBERS_ENDPOINT(institution.id), {});
        const list = Array.isArray(res?.data?.results) ? res.data.results : Array.isArray(res?.data) ? res.data : [];
        setMembers(list);
      } catch {} finally { setTabLoading(false); }
    }
  }, [institution.id]);

  useEffect(() => { loadTabData(tab).catch(() => {}); }, [tab, loadTabData]);

  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overview', icon: 'grid-outline' },
    { id: 'courses', label: 'Courses', icon: 'book-outline' },
    { id: 'programs', label: 'Programs', icon: 'layers-outline' },
    { id: 'members', label: 'Members', icon: 'people-outline' },
    { id: 'analytics', label: 'Analytics', icon: 'bar-chart-outline' },
    { id: 'settings', label: 'Settings', icon: 'settings-outline' },
  ];

  const renderOverview = () => (
    <View style={{ gap: 16 }}>
      {/* Hero */}
      <View
        style={{
          borderRadius: 20,
          overflow: 'hidden',
          height: 160,
          backgroundColor: palette.primarySoft,
        }}
      >
        {logoUri ? (
          <PermanentRemoteImage
            uri={logoUri}
            domain="Institutions"
            stableKey={`institution_${institution.id}_${logoUri}`}
            containerStyle={{ width: '100%', height: '100%' }}
          />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <KISIcon name="school-outline" size={48} color={palette.primaryStrong} />
          </View>
        )}
        <View style={{ position: 'absolute', top: 12, right: 12 }}>
          <View
            style={{
              backgroundColor: verificationColor(verStatus, palette) + 'ee',
              borderRadius: 10,
              paddingHorizontal: 10,
              paddingVertical: 5,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <KISIcon name="shield-checkmark-outline" size={12} color={palette.onPrimary} />
            <Text style={{ color: palette.onPrimary, fontWeight: '900', fontSize: 11 }}>
              {VERIFICATION_LABEL[verStatus]}
            </Text>
          </View>
        </View>
      </View>

      {/* Stats row */}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <StatBadge label="Members" value={memberCount >= 1000 ? `${(memberCount / 1000).toFixed(1)}k` : memberCount} icon="people-outline" color={palette.info} />
        <StatBadge label="Courses" value={courseCount} icon="book-outline" color={palette.success} />
        <StatBadge label="Programs" value={programCount} icon="layers-outline" color={palette.gold} />
        <StatBadge label="Enrolled" value={enrollmentCount >= 1000 ? `${(enrollmentCount / 1000).toFixed(1)}k` : enrollmentCount} icon="school-outline" color={palette.primaryStrong} />
      </View>

      {/* Quick actions */}
      <View
        style={{
          backgroundColor: palette.surface,
          borderRadius: 20,
          padding: 14,
          borderWidth: 1,
          borderColor: palette.divider,
          gap: 12,
        }}
      >
        <Text style={{ color: palette.text, fontWeight: '900', fontSize: 16 }}>Quick Actions</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {[
            { label: 'Add Course', icon: 'add-circle-outline', color: palette.success },
            { label: 'Add Program', icon: 'layers-outline', color: palette.info },
            { label: 'Invite Staff', icon: 'person-add-outline', color: palette.gold },
            { label: 'Live Class', icon: 'videocam-outline', color: palette.danger },
            { label: 'Issue Certificate', icon: 'ribbon-outline', color: palette.primaryStrong },
            { label: 'Publish Landing', icon: 'globe-outline', color: palette.info },
          ].map((action) => (
            <Pressable
              key={action.label}
              onPress={() => {
                if (action.label === 'Add Course') { setTab('courses'); setCourseForm({ title: '', description: '' }); }
                else if (action.label === 'Add Program') { setTab('programs'); setProgramForm({ title: '', description: '' }); }
                else if (action.label === 'Invite Staff') setTab('members');
                else if (action.label === 'Live Class') Alert.alert('Live Class', 'To start a live class, go to the Courses tab and open a scheduled course session. Live streaming will be available soon.');
                else if (action.label === 'Issue Certificate') Alert.alert('Issue Certificate', 'Certificates are issued automatically when a learner completes all course requirements. You can track this in the Analytics tab.');
                else if (action.label === 'Publish Landing') { setTab('settings'); Alert.alert('Publish Landing', 'Institution landing page publishing is managed via institution settings. Coming soon.'); }
              }}
              style={{
                borderWidth: 1.5,
                borderColor: action.color + '66',
                backgroundColor: action.color + '15',
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 8,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <KISIcon name={action.icon as any} size={14} color={action.color} />
              <Text style={{ color: action.color, fontWeight: '800', fontSize: 12 }}>{action.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Verification CTA */}
      {verStatus === 'unverified' && (
        <Pressable
          onPress={async () => {
            try {
              const res = await postRequest(
                ROUTES.educationInstitutionVerificationStart(institution.id),
                {},
                { errorMessage: '' },
              );
              if (res?.success === false) {
                Alert.alert('Error', res?.message || 'Could not start verification. Please try again.');
              } else {
                Alert.alert('Verification Started', 'Your institution has been submitted for verification. We will review it shortly.');
              }
            } catch {
              Alert.alert('Error', 'Could not start verification. Please try again.');
            }
          }}
          style={{
            backgroundColor: palette.gold + '15',
            borderWidth: 1.5,
            borderColor: palette.gold,
            borderRadius: 18,
            padding: 14,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <KISIcon name="shield-outline" size={22} color={palette.gold} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: palette.gold, fontWeight: '900', fontSize: 15 }}>Get Verified</Text>
            <Text style={{ color: palette.gold, fontWeight: '700', fontSize: 12, opacity: 0.85 }}>
              Verified institutions get more enrollments and global visibility
            </Text>
          </View>
          <KISIcon name="chevron-forward-outline" size={16} color={palette.gold} />
        </Pressable>
      )}

      {/* Partner account CTA */}
      {!isPartnerConnected && (
        <Pressable
          onPress={() => dashNavigation.navigate('MainTabs', { screen: 'Partners' })}
          style={{
            backgroundColor: palette.primarySoft,
            borderWidth: 1.5,
            borderColor: palette.primary,
            borderRadius: 18,
            padding: 14,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <KISIcon name="globe-outline" size={22} color={palette.primaryStrong} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: palette.primaryStrong, fontWeight: '900', fontSize: 15 }}>
              Connect Partner Account
            </Text>
            <Text style={{ color: palette.primaryStrong, fontWeight: '700', fontSize: 12, opacity: 0.8 }}>
              Global management · Multi-admin · International enrollment
            </Text>
          </View>
          <KISIcon name="chevron-forward-outline" size={16} color={palette.primaryStrong} />
        </Pressable>
      )}

      {isPartnerConnected && (
        <View
          style={{
            backgroundColor: palette.success + '15',
            borderWidth: 1.5,
            borderColor: palette.success,
            borderRadius: 18,
            padding: 14,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <KISIcon name="checkmark-circle-outline" size={22} color={palette.success} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: palette.success, fontWeight: '900', fontSize: 15 }}>Partner Account Connected</Text>
            <Text style={{ color: palette.success, fontWeight: '700', fontSize: 12, opacity: 0.85 }}>
              Global management enabled
            </Text>
          </View>
        </View>
      )}

      {/* Features list */}
      <View
        style={{
          backgroundColor: palette.surface,
          borderRadius: 20,
          padding: 14,
          borderWidth: 1,
          borderColor: palette.divider,
          gap: 12,
        }}
      >
        <Text style={{ color: palette.text, fontWeight: '900', fontSize: 16 }}>Platform Features</Text>
        {[
          { icon: 'book-outline', label: 'Course Builder', desc: 'Create and organize multi-module courses', color: palette.success },
          { icon: 'layers-outline', label: 'Program Management', desc: 'Bundle courses into degree/diploma programs', color: palette.info },
          { icon: 'videocam-outline', label: 'Live Classes', desc: 'Schedule and broadcast live sessions', color: palette.danger },
          { icon: 'ribbon-outline', label: 'Certificates', desc: 'Issue verifiable digital certificates', color: palette.gold },
          { icon: 'people-outline', label: 'Staff & Roles', desc: 'Assign instructors, admins, and TAs', color: palette.primaryStrong },
          { icon: 'analytics-outline', label: 'Analytics', desc: 'Track enrollment, completion, and revenue', color: palette.info },
          { icon: 'card-outline', label: 'USD Payments', desc: 'Collect tuition and fees in USD', color: palette.success },
          { icon: 'globe-outline', label: 'Landing Page', desc: 'Publish a public-facing institution page', color: palette.info },
        ].map((feat) => (
          <View key={feat.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                backgroundColor: feat.color + '22',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <KISIcon name={feat.icon as any} size={18} color={feat.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: palette.text, fontWeight: '800', fontSize: 14 }}>{feat.label}</Text>
              <Text style={{ color: palette.subtext, fontWeight: '600', fontSize: 12 }}>{feat.desc}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );

  const renderAnalytics = () => {
    const d = dashboard ?? {};
    const kpis = [
      { label: 'Enrolled', value: d.enrollment_count ?? enrollmentCount },
      { label: 'Members', value: d.member_count ?? memberCount },
      { label: 'Courses', value: d.course_count ?? courseCount },
      { label: 'Programs', value: d.program_count ?? programCount },
      { label: 'Completion rate', value: d.completion_rate != null ? `${Math.round(Number(d.completion_rate) * 100)}%` : '—' },
      { label: 'Avg rating', value: d.avg_rating != null ? Number(d.avg_rating).toFixed(1) : '—' },
      { label: 'Active learners', value: d.active_learner_count ?? '—' },
      { label: 'Revenue', value: d.revenue_total != null ? `$${Number(d.revenue_total).toFixed(2)}` : '—' },
    ];
    return (
      <View style={{ gap: 12 }}>
        <Text style={{ color: palette.text, fontWeight: '900', fontSize: 16 }}>Institution analytics</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {kpis.map(kpi => (
            <View
              key={kpi.label}
              style={{
                flex: 1,
                minWidth: 120,
                backgroundColor: palette.surface,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: palette.divider,
                padding: 14,
                gap: 4,
              }}
            >
              <Text style={{ color: palette.text, fontWeight: '900', fontSize: 18 }}>{String(kpi.value ?? '—')}</Text>
              <Text style={{ color: palette.subtext, fontSize: 12 }}>{kpi.label}</Text>
            </View>
          ))}
        </View>
        {loading ? (
          <Text style={{ color: palette.subtext, textAlign: 'center' }}>Loading dashboard…</Text>
        ) : null}
      </View>
    );
  };

  const handleSaveInstitution = async () => {
    if (!editName.trim()) {
      Alert.alert('Institution', 'Name is required.');
      return;
    }
    setSavingInstitution(true);
    try {
      const res = await patchRequest(
        ROUTES.broadcasts.educationInstitution(institution.id),
        { name: editName.trim(), description: editDescription.trim() },
        { errorMessage: 'Unable to save institution details.' },
      );
      if (!res?.success) throw new Error(res?.message || 'Unable to save institution details.');
      Alert.alert('Institution', 'Details updated.');
      setEditingInstitution(false);
    } catch (e: any) {
      Alert.alert('Institution', e?.message || 'Unable to save institution details.');
    } finally {
      setSavingInstitution(false);
    }
  };

  const renderSettings = () => (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: palette.text, fontWeight: '900', fontSize: 16 }}>Institution info</Text>
        <Pressable
          onPress={() => {
            setEditName(institution.name);
            setEditDescription(institution.description ?? '');
            setEditingInstitution(v => !v);
          }}
          style={{ paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: palette.divider, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ color: palette.primaryStrong, fontWeight: '900', fontSize: 13 }}>
            {editingInstitution ? 'Cancel' : 'Edit'}
          </Text>
        </Pressable>
      </View>
      {editingInstitution ? (
        <View style={{ gap: 10 }}>
          <TextInput
            value={editName}
            onChangeText={setEditName}
            placeholder="Institution name"
            placeholderTextColor={palette.subtext}
            style={{ borderWidth: 1, borderColor: palette.divider, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: palette.text, fontSize: 15, backgroundColor: palette.inputBg }}
          />
          <TextInput
            value={editDescription}
            onChangeText={setEditDescription}
            placeholder="Description (optional)"
            placeholderTextColor={palette.subtext}
            multiline
            numberOfLines={3}
            style={{ borderWidth: 1, borderColor: palette.divider, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: palette.text, fontSize: 14, backgroundColor: palette.inputBg, minHeight: 80 }}
          />
          <Pressable
            onPress={() => void handleSaveInstitution()}
            disabled={savingInstitution}
            style={{ backgroundColor: palette.primaryStrong, borderRadius: 12, paddingVertical: 12, alignItems: 'center', minHeight: 44, justifyContent: 'center', opacity: savingInstitution ? 0.6 : 1 }}
          >
            <Text style={{ color: palette.onPrimary, fontWeight: '900', fontSize: 15 }}>
              {savingInstitution ? 'Saving…' : 'Save changes'}
            </Text>
          </Pressable>
        </View>
      ) : null}
      {[
        { label: 'Name', value: institution.name },
        { label: 'Type', value: institution.institution_type ?? institution.institutionType ?? '—' },
        { label: 'Verification', value: institution.verification_status ?? institution.verificationStatus ?? 'unverified' },
        { label: 'Partner connected', value: isPartnerConnected ? 'Yes' : 'No' },
        { label: 'Members', value: String(memberCount) },
        { label: 'Courses', value: String(courseCount) },
        { label: 'Enrollments', value: String(enrollmentCount) },
      ].map(row => (
        <View
          key={row.label}
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            paddingVertical: 12,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: palette.divider,
          }}
        >
          <Text style={{ color: palette.subtext, fontSize: 14 }}>{row.label}</Text>
          <Text style={{ color: palette.text, fontSize: 14, fontWeight: '700' }}>{row.value ?? '—'}</Text>
        </View>
      ))}
    </View>
  );

  const renderCourses = () => (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: palette.text, fontWeight: '900', fontSize: 16 }}>Courses ({courses.length})</Text>
        <Pressable
          onPress={() => setCourseForm({ title: '', description: '' })}
          style={{ backgroundColor: palette.primarySoft, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: palette.primary, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ color: palette.primaryStrong, fontWeight: '900', fontSize: 13 }}>+ Add Course</Text>
        </Pressable>
      </View>
      {tabLoading ? (
        <Text style={{ color: palette.subtext, textAlign: 'center', padding: 32 }}>Loading…</Text>
      ) : courses.length === 0 ? (
        <View style={{ alignItems: 'center', padding: 32, gap: 8 }}>
          <KISIcon name="book-outline" size={40} color={palette.subtext} />
          <Text style={{ color: palette.subtext, fontWeight: '700' }}>No courses yet. Add your first course.</Text>
        </View>
      ) : (
        courses.map((c: any) => (
          <View key={c.id} style={{ backgroundColor: palette.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: palette.divider }}>
            <Text style={{ color: palette.text, fontWeight: '800', fontSize: 15 }}>{c.title ?? c.name ?? 'Course'}</Text>
            {!!c.description && <Text style={{ color: palette.subtext, fontSize: 13, marginTop: 4 }} numberOfLines={2}>{c.description}</Text>}
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
              {c.enrollment_count !== undefined && <Text style={{ color: palette.subtext, fontSize: 12 }}>{c.enrollment_count} enrolled</Text>}
              {c.status && <Text style={{ color: palette.primaryStrong, fontSize: 12, fontWeight: '700' }}>{String(c.status).toUpperCase()}</Text>}
            </View>
          </View>
        ))
      )}
      <Modal visible={courseForm !== null} transparent animationType="slide" onRequestClose={() => setCourseForm(null)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <View style={{ backgroundColor: palette.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 12 }}>
            <Text style={{ color: palette.text, fontWeight: '900', fontSize: 17 }}>Add Course</Text>
            {[{ label: 'Course title *', key: 'title', placeholder: 'e.g. Introduction to Python' }, { label: 'Description', key: 'description', placeholder: 'What will students learn?' }].map(({ label, key, placeholder }) => (
              <View key={key}>
                <Text style={{ color: palette.subtext, fontSize: 12, fontWeight: '700', marginBottom: 4 }}>{label}</Text>
                <TextInput value={(courseForm as any)?.[key] ?? ''} onChangeText={v => setCourseForm(f => f ? { ...f, [key]: v } : f)} placeholder={placeholder} placeholderTextColor={palette.subtext} style={{ borderWidth: 1, borderColor: palette.divider, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, color: palette.text, fontSize: 14 }} />
              </View>
            ))}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable onPress={() => setCourseForm(null)} style={{ flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: palette.divider }}>
                <Text style={{ color: palette.text, fontWeight: '700' }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={async () => {
                  if (!courseForm?.title.trim()) { Alert.alert('Required', 'Course title is required.'); return; }
                  try {
                    const res = await postRequest(INSTITUTION_COURSES_ENDPOINT(institution.id), { title: courseForm.title.trim(), description: courseForm.description.trim() }, {});
                    if (res?.success || res?.data?.id) {
                      setCourseForm(null);
                      loadTabData('courses').catch(() => {});
                    } else { Alert.alert('Error', res?.message || 'Failed to create course.'); }
                  } catch { Alert.alert('Error', 'Failed to create course.'); }
                }}
                style={{ flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, backgroundColor: palette.primary }}
              >
                <Text style={{ color: palette.onPrimary, fontWeight: '900' }}>Create</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );

  const renderPrograms = () => (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: palette.text, fontWeight: '900', fontSize: 16 }}>Programs ({programs.length})</Text>
        <Pressable
          onPress={() => setProgramForm({ title: '', description: '' })}
          style={{ backgroundColor: palette.primarySoft, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: palette.primary, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ color: palette.primaryStrong, fontWeight: '900', fontSize: 13 }}>+ Add Program</Text>
        </Pressable>
      </View>
      {tabLoading ? (
        <Text style={{ color: palette.subtext, textAlign: 'center', padding: 32 }}>Loading…</Text>
      ) : programs.length === 0 ? (
        <View style={{ alignItems: 'center', padding: 32, gap: 8 }}>
          <KISIcon name="layers-outline" size={40} color={palette.subtext} />
          <Text style={{ color: palette.subtext, fontWeight: '700' }}>No programs yet.</Text>
        </View>
      ) : (
        programs.map((p: any) => (
          <View key={p.id} style={{ backgroundColor: palette.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: palette.divider }}>
            <Text style={{ color: palette.text, fontWeight: '800', fontSize: 15 }}>{p.title ?? p.name ?? 'Program'}</Text>
            {!!p.description && <Text style={{ color: palette.subtext, fontSize: 13, marginTop: 4 }} numberOfLines={2}>{p.description}</Text>}
          </View>
        ))
      )}
      <Modal visible={programForm !== null} transparent animationType="slide" onRequestClose={() => setProgramForm(null)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <View style={{ backgroundColor: palette.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 12 }}>
            <Text style={{ color: palette.text, fontWeight: '900', fontSize: 17 }}>Add Program</Text>
            {[{ label: 'Program title *', key: 'title', placeholder: 'e.g. Full-Stack Development' }, { label: 'Description', key: 'description', placeholder: 'Program overview' }].map(({ label, key, placeholder }) => (
              <View key={key}>
                <Text style={{ color: palette.subtext, fontSize: 12, fontWeight: '700', marginBottom: 4 }}>{label}</Text>
                <TextInput value={(programForm as any)?.[key] ?? ''} onChangeText={v => setProgramForm(f => f ? { ...f, [key]: v } : f)} placeholder={placeholder} placeholderTextColor={palette.subtext} style={{ borderWidth: 1, borderColor: palette.divider, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, color: palette.text, fontSize: 14 }} />
              </View>
            ))}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable onPress={() => setProgramForm(null)} style={{ flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: palette.divider }}>
                <Text style={{ color: palette.text, fontWeight: '700' }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={async () => {
                  if (!programForm?.title.trim()) { Alert.alert('Required', 'Program title is required.'); return; }
                  try {
                    const res = await postRequest(INSTITUTION_PROGRAMS_ENDPOINT(institution.id), { title: programForm.title.trim(), description: programForm.description.trim() }, {});
                    if (res?.success || res?.data?.id) {
                      setProgramForm(null);
                      loadTabData('programs').catch(() => {});
                    } else { Alert.alert('Error', res?.message || 'Failed to create program.'); }
                  } catch { Alert.alert('Error', 'Failed to create program.'); }
                }}
                style={{ flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, backgroundColor: palette.primary }}
              >
                <Text style={{ color: palette.onPrimary, fontWeight: '900' }}>Create</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );

  const renderMembers = () => (
    <View style={{ gap: 12 }}>
      <Text style={{ color: palette.text, fontWeight: '900', fontSize: 16 }}>Members ({members.length})</Text>
      {tabLoading ? (
        <Text style={{ color: palette.subtext, textAlign: 'center', padding: 32 }}>Loading…</Text>
      ) : members.length === 0 ? (
        <View style={{ alignItems: 'center', padding: 32, gap: 8 }}>
          <KISIcon name="people-outline" size={40} color={palette.subtext} />
          <Text style={{ color: palette.subtext, fontWeight: '700' }}>No members yet.</Text>
        </View>
      ) : (
        members.map((m: any) => {
          const name = m.user_name ?? m.user?.name ?? m.user?.username ?? 'Member';
          const role = m.role ?? m.membership_type ?? 'student';
          return (
            <View key={m.id} style={{ backgroundColor: palette.surface, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: palette.divider, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                <KISIcon name="person-outline" size={20} color={palette.primaryStrong} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: palette.text, fontWeight: '800' }}>{name}</Text>
                <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 2 }}>{String(role).replace('_', ' ').toUpperCase()}</Text>
              </View>
              {m.status && <Text style={{ color: m.status === 'active' ? palette.success : palette.subtext, fontSize: 11, fontWeight: '700' }}>{String(m.status).toUpperCase()}</Text>}
            </View>
          );
        })
      )}
    </View>
  );

  const content = (() => {
    switch (tab) {
      case 'overview': return renderOverview();
      case 'courses': return renderCourses();
      case 'programs': return renderPrograms();
      case 'members': return renderMembers();
      case 'analytics': return renderAnalytics();
      case 'settings': return renderSettings();
    }
  })();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: palette.divider,
          gap: 12,
        }}
      >
        <Pressable onPress={onClose}>
          <KISIcon name="chevron-back-outline" size={22} color={palette.subtext} />
        </Pressable>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: palette.text, fontWeight: '900', fontSize: 17 }} numberOfLines={1}>
            {institution.name}
          </Text>
          <Text style={{ color: palette.subtext, fontWeight: '700', fontSize: 12 }}>
            {INST_TYPES.find((t) => t.value === instType)?.label ?? instType}
          </Text>
        </View>
        <Pressable
          onPress={() => {
            Share.share({
              message: `Check out ${institution.name} on KIS`,
              url: institution.website ?? '',
            }).catch(() => {});
          }}
          style={{ padding: 6 }}
        >
          <KISIcon name="share-outline" size={20} color={palette.subtext} />
        </Pressable>
      </View>

      {/* Tab bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8, gap: 6, flexDirection: 'row' }}
      >
        {tabs.map((t) => {
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
                backgroundColor: isActive ? palette.primarySoft : palette.surface,
                borderRadius: 999,
                paddingHorizontal: 14,
                paddingVertical: 8,
              }}
            >
              <KISIcon name={t.icon as any} size={13} color={isActive ? palette.primaryStrong : palette.subtext} />
              <Text style={{ color: isActive ? palette.primaryStrong : palette.subtext, fontWeight: '800', fontSize: 13 }}>
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView contentContainerStyle={{ padding: responsive.pageGutter, maxWidth: responsive.contentMaxWidth, width: '100%', alignSelf: 'center', paddingBottom: 120 }}>
        {content}
      </ScrollView>
    </SafeAreaView>
  );
}

type Props = {
  onClose?: () => void;
};

export default function EducationInstitutionManagementScreen({ onClose }: Props) {
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedInstitution, setSelectedInstitution] = useState<Institution | null>(null);

  const loadInstitutions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getRequest(INSTITUTIONS_ENDPOINT, { errorMessage: '' });
      const data = res?.data ?? res;
      const list = Array.isArray(data?.results)
        ? data.results
        : Array.isArray(data)
        ? data
        : [];
      setInstitutions(list);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadInstitutions().catch(() => {}); }, [loadInstitutions]);

  if (selectedInstitution) {
    return (
      <InstitutionDashboard
        institution={selectedInstitution}
        onClose={() => setSelectedInstitution(null)}
      />
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: palette.divider,
          gap: 12,
        }}
      >
        {onClose && (
          <Pressable onPress={onClose}>
            <KISIcon name="close-outline" size={22} color={palette.subtext} />
          </Pressable>
        )}
        <Text style={{ color: palette.text, fontWeight: '900', fontSize: 18, flex: 1 }}>
          My Institutions
        </Text>
        <Pressable
          onPress={() => setShowCreate(true)}
          style={{
            backgroundColor: palette.primary,
            borderRadius: 10,
            paddingHorizontal: 14,
            paddingVertical: 8,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <KISIcon name="add-outline" size={16} color={palette.onPrimary} />
          <Text style={{ color: palette.onPrimary, fontWeight: '900', fontSize: 13 }}>Create</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: responsive.pageGutter, maxWidth: responsive.contentMaxWidth, width: '100%', alignSelf: 'center', paddingBottom: 120, gap: 14 }} showsVerticalScrollIndicator={false}>

        {/* Intro card */}
        <View
          style={{
            backgroundColor: palette.primarySoft,
            borderWidth: 1.5,
            borderColor: palette.primary,
            borderRadius: 20,
            padding: 16,
            gap: 10,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <KISIcon name="school-outline" size={28} color={palette.primaryStrong} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: palette.primaryStrong, fontWeight: '900', fontSize: 17 }}>
                Education Institutions
              </Text>
              <Text style={{ color: palette.primaryStrong, fontWeight: '700', fontSize: 12, opacity: 0.85 }}>
                Coursera-level learning management from your app
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {['Universities', 'Schools', 'Bootcamps', 'Academies', 'Training Centers'].map((tag) => (
              <View
                key={tag}
                style={{
                  backgroundColor: palette.primarySoft,
                  borderRadius: 8,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                }}
              >
                <Text style={{ color: palette.primaryStrong, fontWeight: '800', fontSize: 11 }}>{tag}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Institutions list */}
        {institutions.length > 0 ? (
          institutions.map((inst) => {
            const verStatus = (inst.verification_status ?? inst.verificationStatus ?? 'unverified') as VerificationStatus;
            const logoUri = inst.logo_url ?? inst.logoUrl ?? inst.image_url ?? inst.imageUrl;
            const instType = (inst.institution_type ?? inst.institutionType ?? 'university') as InstitutionType;
            const isPartnerConnected = inst.partner_connected ?? inst.partnerConnected ?? false;

            return (
              <Pressable
                key={inst.id}
                onPress={() => setSelectedInstitution(inst)}
                style={{
                  backgroundColor: palette.surface,
                  borderRadius: 20,
                  overflow: 'hidden',
                  borderWidth: 1,
                  borderColor: palette.divider,
                }}
              >
                <View style={{ height: 100, backgroundColor: palette.primarySoft }}>
                  {logoUri ? (
                    <PermanentRemoteImage
                      uri={logoUri}
                      domain="Institutions"
                      stableKey={`institution_${inst.id}_${logoUri}`}
                      containerStyle={{ width: '100%', height: '100%' }}
                    />
                  ) : (
                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                      <KISIcon name="school-outline" size={36} color={palette.primaryStrong} />
                    </View>
                  )}
                  <View style={{ position: 'absolute', top: 10, right: 10 }}>
                    <View
                      style={{
                        backgroundColor: verificationColor(verStatus, palette) + 'ee',
                        borderRadius: 8,
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <KISIcon name="shield-checkmark-outline" size={10} color={palette.onPrimary} />
                      <Text style={{ color: palette.onPrimary, fontWeight: '900', fontSize: 10 }}>
                        {VERIFICATION_LABEL[verStatus]}
                      </Text>
                    </View>
                  </View>
                  {isPartnerConnected && (
                    <View style={{ position: 'absolute', top: 10, left: 10 }}>
                      <View
                        style={{
                          backgroundColor: palette.success + 'ee',
                          borderRadius: 8,
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <KISIcon name="globe-outline" size={10} color={palette.onPrimary} />
                        <Text style={{ color: palette.onPrimary, fontWeight: '900', fontSize: 10 }}>Global</Text>
                      </View>
                    </View>
                  )}
                </View>
                <View style={{ padding: 14, gap: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <Text style={{ color: palette.text, fontWeight: '900', fontSize: 16, flex: 1 }} numberOfLines={1}>
                      {inst.name}
                    </Text>
                    <Text style={{ color: palette.subtext, fontWeight: '700', fontSize: 12 }}>
                      {INST_TYPES.find((t) => t.value === instType)?.label ?? instType}
                    </Text>
                  </View>
                  {inst.description && (
                    <Text style={{ color: palette.subtext, fontWeight: '600', fontSize: 13 }} numberOfLines={2}>
                      {inst.description}
                    </Text>
                  )}
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    {[
                      { icon: 'people-outline', value: inst.member_count ?? inst.memberCount ?? 0, label: 'members' },
                      { icon: 'book-outline', value: inst.course_count ?? inst.courseCount ?? 0, label: 'courses' },
                      { icon: 'layers-outline', value: inst.program_count ?? inst.programCount ?? 0, label: 'programs' },
                    ].map((stat) => (
                      <View key={stat.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <KISIcon name={stat.icon as any} size={13} color={palette.subtext} />
                        <Text style={{ color: palette.subtext, fontWeight: '700', fontSize: 12 }}>
                          {stat.value} {stat.label}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              </Pressable>
            );
          })
        ) : !loading ? (
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
            <KISIcon name="school-outline" size={44} color={palette.subtext} />
            <Text style={{ color: palette.text, fontWeight: '900', fontSize: 18 }}>No institutions yet</Text>
            <Text style={{ color: palette.subtext, fontWeight: '700', textAlign: 'center' }}>
              Create your first learning institution to start offering courses, programs, and certifications.
            </Text>
            <Pressable
              onPress={() => setShowCreate(true)}
              style={{
                backgroundColor: palette.primary,
                borderRadius: 14,
                paddingHorizontal: 24,
                paddingVertical: 12,
              }}
            >
              <Text style={{ color: palette.onPrimary, fontWeight: '900', fontSize: 15 }}>Create Institution</Text>
            </Pressable>
          </View>
        ) : null}

      </ScrollView>

      <CreateInstitutionSheet
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={(inst) => {
          setInstitutions((prev) => [inst, ...prev]);
        }}
      />
    </SafeAreaView>
  );
}
