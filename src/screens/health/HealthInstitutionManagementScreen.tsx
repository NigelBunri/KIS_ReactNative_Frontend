import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  Text,
  View,
  ActivityIndicator,
  Pressable,
  TouchableOpacity,
  useColorScheme,
  StyleSheet,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import KISButton from '@/constants/KISButton';
import KISTextInput from '@/constants/KISTextInput';
import { KISIcon } from '@/constants/kisIcons';
import {
  getHealthThemeBorders,
  getHealthThemeColors,
  HEALTH_THEME_SPACING,
  HEALTH_THEME_TYPOGRAPHY,
} from '@/theme/health';
import type { HealthInstitutionType } from '@/screens/tabs/profile-screen/types';
import { HEALTH_INSTITUTION_TYPES } from '@/screens/tabs/profile-screen/constants';
import { RootStackParamList } from '@/navigation/types';
import {
  createHealthProfile,
  fetchHealthProfileState,
  updateHealthInstitutions,
} from '@/services/healthProfileService';
import { canUserManageInstitution, getInstitutionRoleForUser } from './accessControl';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { nanoid } from 'nanoid/non-secure';

type Props = NativeStackScreenProps<RootStackParamList, 'HealthInstitutionManagement'>;

const BACKEND_HEALTH_INSTITUTION_TYPES = new Set([
  'clinic',
  'hospital',
  'lab',
  'wellness_center',
  'pharmacy',
  'diagnostics',
]);

const normalizeInstitutionTypeForBackend = (
  type: HealthInstitutionType,
): HealthInstitutionType => {
  if (type === 'laboratory') return 'lab';
  if (type === 'diagnostics_center') return 'diagnostics';
  return BACKEND_HEALTH_INSTITUTION_TYPES.has(type) ? type : 'clinic';
};

const buildOwnerMember = (owner: {
  id?: string;
  name?: string;
  phone?: string;
  email?: string;
}) => ({
  id: owner.id ? `user-${owner.id}` : `owner-${nanoid()}`,
  userId: owner.id,
  name: owner.name || 'Owner',
  phone: owner.phone || '',
  email: owner.email || '',
  role: 'owner',
  source: 'owner_added',
  permissions: {
    analytics: true,
    schedules: true,
    services: true,
    financial: true,
    compliance: true,
    members: true,
  },
});

const buildInstitutionPayload = (
  id: string,
  name: string,
  type: HealthInstitutionType,
  membersTargetCount: number,
  owner: {
    id?: string;
    name?: string;
    phone?: string;
    email?: string;
  },
  existing?: any,
) => {
  const existingOwnerContact = existing?.owner_contact || existing?.ownerContact || {};
  const ownerContactPayload = {
    userId: String(existingOwnerContact?.userId || existingOwnerContact?.user_id || owner.id || ''),
    name: String(existingOwnerContact?.name || owner.name || ''),
    phone: String(existingOwnerContact?.phone || owner.phone || ''),
    email: String(existingOwnerContact?.email || owner.email || ''),
  };

  return {
    ...(existing ?? {}),
  id,
  name,
  type: normalizeInstitutionTypeForBackend(type),
  members_target_count: Math.max(1, membersTargetCount),
  membersTargetCount: Math.max(1, membersTargetCount),
  owner_contact: ownerContactPayload,
  ownerContact: ownerContactPayload,
  employees:
    Array.isArray(existing?.employees) && existing.employees.length > 0
      ? existing.employees
      : [buildOwnerMember(owner)],
  members:
    Array.isArray(existing?.members) && existing.members.length > 0
      ? existing.members
      : Array.isArray(existing?.employees)
      ? existing.employees
      : [buildOwnerMember(owner)],
  membership_open:
    existing?.membership_open ??
    existing?.membershipOpen ??
    existing?.membership_settings?.open ??
    existing?.membershipSettings?.open ??
    false,
  membershipOpen:
    existing?.membershipOpen ??
    existing?.membership_open ??
    existing?.membershipSettings?.open ??
    existing?.membership_settings?.open ??
    false,
  membership_discount_pct:
    existing?.membership_discount_pct ??
    existing?.membershipDiscountPct ??
    existing?.membership_settings?.discountPercent ??
    existing?.membershipSettings?.discountPercent ??
    10,
  membershipDiscountPct:
    existing?.membershipDiscountPct ??
    existing?.membership_discount_pct ??
    existing?.membershipSettings?.discountPercent ??
    existing?.membership_settings?.discountPercent ??
    10,
  membership_settings: {
    ...(existing?.membership_settings || {}),
    open:
      existing?.membership_settings?.open ??
      existing?.membershipSettings?.open ??
      existing?.membership_open ??
      existing?.membershipOpen ??
      false,
    discountPercent:
      existing?.membership_settings?.discountPercent ??
      existing?.membershipSettings?.discountPercent ??
      existing?.membership_discount_pct ??
      existing?.membershipDiscountPct ??
      10,
  },
  membershipSettings: {
    ...(existing?.membershipSettings || {}),
    open:
      existing?.membershipSettings?.open ??
      existing?.membership_settings?.open ??
      existing?.membershipOpen ??
      existing?.membership_open ??
      false,
    discountPercent:
      existing?.membershipSettings?.discountPercent ??
      existing?.membership_settings?.discountPercent ??
      existing?.membershipDiscountPct ??
      existing?.membership_discount_pct ??
      10,
  },
  };
};

export default function HealthInstitutionManagementScreen({ route, navigation }: Props) {
  const initialParams = useMemo(
    () => ({
      id: route.params.institutionId,
      name: route.params.institutionName ?? '',
      type: route.params.institutionType ?? 'clinic',
      employees: route.params.employees ?? 3,
    }),
    [route.params],
  );

  const [institutions, setInstitutions] = useState<any[]>([]);
  const [hasHealthProfile, setHasHealthProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [ownerProfile, setOwnerProfile] = useState<{
    id?: string;
    name?: string;
    phone?: string;
    email?: string;
  }>({});
  const [form, setForm] = useState({
    id: initialParams.id,
    name: initialParams.name,
    type: initialParams.type,
    employees: String(initialParams.employees),
  });

  useEffect(() => {
    setForm({
      id: initialParams.id,
      name: initialParams.name,
      type: initialParams.type,
      employees: String(initialParams.employees),
    });
  }, [initialParams]);

  const loadInstitutions = useCallback(async () => {
    setLoading(true);
    try {
      const meRes = await getRequest(ROUTES.auth.checkLogin);
      const me = (meRes as any)?.data ?? {};
      setOwnerProfile({
        id: me?.id ? String(me.id) : undefined,
        name: String(me?.display_name || me?.name || me?.username || '').trim() || undefined,
        phone: String(me?.phone || '').trim() || undefined,
        email: String(me?.email || '').trim() || undefined,
      });

      const result = await fetchHealthProfileState();
      setHasHealthProfile(result.exists);
      const list = Array.isArray(result.profile?.institutions)
        ? result.profile.institutions
        : [];
      setInstitutions(list);
      const match = list.find((inst: any) => inst.id === initialParams.id);
      if (match) {
        setForm((prev) => ({
          ...prev,
          name: match.name ?? prev.name,
          type: normalizeInstitutionTypeForBackend(match.type ?? prev.type),
          employees: String(
            match.members_target_count ??
              match.membersTargetCount ??
              match.employees?.length ??
              (Number(prev.employees) || 1),
          ),
        }));
      }
    } catch (error: any) {
      Alert.alert('Health institution', error?.message || 'Unable to fetch institution data.');
    } finally {
      setLoading(false);
    }
  }, [initialParams.id]);

  useEffect(() => {
    void loadInstitutions();
  }, [loadInstitutions]);

  const parseCount = useCallback((value: string, fallback: number) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(fallback, Math.floor(parsed));
  }, []);

  const currentInstitution = institutions.find((inst) => inst.id === form.id);
  const resolvedInstitution = useMemo(() => {
    if (currentInstitution) return currentInstitution;
    const nameKey = String(form.name || '').trim().toLowerCase();
    if (!nameKey) return null;
    return (
      institutions.find(
        (inst) => String(inst?.name || '').trim().toLowerCase() === nameKey,
      ) || null
    );
  }, [currentInstitution, form.name, institutions]);
  const resolvedInstitutionId = String(form.id || resolvedInstitution?.id || '').trim();
  const currentUser = useMemo(
    () => ({
      id: ownerProfile.id,
      phone: ownerProfile.phone,
      email: ownerProfile.email,
    }),
    [ownerProfile.email, ownerProfile.id, ownerProfile.phone],
  );
  const actorRole = useMemo(
    () => getInstitutionRoleForUser(resolvedInstitution || currentInstitution, currentUser) || 'unassigned',
    [currentInstitution, currentUser, resolvedInstitution],
  );
  const canDeleteInstitution = useMemo(
    () => canUserManageInstitution(resolvedInstitution || currentInstitution, currentUser),
    [currentInstitution, currentUser, resolvedInstitution],
  );
  const canOpenMembers = useMemo(
    () => ['owner', 'admin', 'manager'].includes(String(actorRole).toLowerCase()),
    [actorRole],
  );
  const canOpenServiceCatalog = useMemo(
    () => ['owner', 'admin', 'manager', 'analyst'].includes(String(actorRole).toLowerCase()),
    [actorRole],
  );

  const handleSave = useCallback(async () => {
    if (!form.name.trim()) {
      Alert.alert('Manage institution', 'Provide a name.');
      return;
    }
    const count = parseCount(form.employees, 1);
    const targetId = form.id ?? nanoid();
    const existing = institutions.find((inst) => inst.id === form.id);
    const payload = buildInstitutionPayload(targetId, form.name.trim(), form.type, count, ownerProfile, existing);
    const nextInstitutions = form.id
      ? institutions.map((inst) => (inst.id === form.id ? payload : inst))
      : [...institutions, payload];
    setSubmitting(true);
    try {
      const res = hasHealthProfile
        ? await updateHealthInstitutions(nextInstitutions)
        : await createHealthProfile(nextInstitutions);
      if (!res?.success) throw new Error(res?.message || 'Unable to update institution.');
      if (!hasHealthProfile) {
        setHasHealthProfile(true);
      }
      if (form.id) {
        Alert.alert('Institution updated', 'Changes saved.');
      } else {
        Alert.alert('Institution created', 'New institution saved.');
        navigation.setParams({
          institutionId: targetId,
          institutionName: payload.name,
          institutionType: payload.type,
          employees: Math.max(count, 1),
        });
        setForm((prev) => ({ ...prev, id: targetId }));
      }
      await loadInstitutions();
    } catch (error: any) {
      Alert.alert('Manage institution', error?.message || 'Unable to update institution.');
    } finally {
      setSubmitting(false);
    }
  }, [form, hasHealthProfile, institutions, loadInstitutions, navigation, ownerProfile, parseCount]);

  const handleDelete = useCallback(async () => {
    if (!form.id) {
      Alert.alert('Delete institution', 'Missing institution ID.');
      return;
    }
    if (!canDeleteInstitution) {
      Alert.alert('Delete institution', 'Only owner, admin, or manager can delete an institution.');
      return;
    }
    const nextInstitutions = institutions.filter((inst) => inst.id !== form.id);
    setSubmitting(true);
    try {
      const res = await updateHealthInstitutions(nextInstitutions);
      if (!res?.success) throw new Error(res?.message || 'Unable to delete institution.');
      Alert.alert('Institution removed', 'This institution has been removed.');
      navigation.goBack();
    } catch (error: any) {
      Alert.alert('Delete institution', error?.message || 'Unable to delete institution.');
    } finally {
      setSubmitting(false);
    }
  }, [canDeleteInstitution, form.id, institutions, navigation]);

  const handleManageServices = useCallback(() => {
    if (!resolvedInstitutionId) {
      Alert.alert('Services', 'Create the institution first.');
      return;
    }
    navigation.navigate('HealthInstitutionServicesCatalog', {
      institutionId: resolvedInstitutionId,
      institutionName: form.name || resolvedInstitution?.name,
      institutionType: form.type,
    });
  }, [form.name, form.type, navigation, resolvedInstitution?.name, resolvedInstitutionId]);

  const handleViewMembers = useCallback(() => {
    if (!resolvedInstitutionId) {
      Alert.alert('Members', 'Create the institution first.');
      return;
    }
    navigation.navigate('HealthInstitutionMembers', {
      institutionId: resolvedInstitutionId,
      institutionName: form.name || resolvedInstitution?.name,
    });
  }, [form.name, navigation, resolvedInstitution?.name, resolvedInstitutionId]);

  const cycleType = useCallback(() => {
    const index = HEALTH_INSTITUTION_TYPES.findIndex((type) => type === form.type);
    const nextType = HEALTH_INSTITUTION_TYPES[(index + 1) % HEALTH_INSTITUTION_TYPES.length];
    setForm((prev) => ({ ...prev, type: nextType }));
  }, [form.type]);

  const scheme = useColorScheme();
  const palette = getHealthThemeColors(scheme === 'light' ? 'light' : 'dark');
  const borders = getHealthThemeBorders(palette);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }}>
        <LinearGradient
          colors={[palette.gradientStart, palette.gradientEnd]}
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <ActivityIndicator size="large" color={palette.accentPrimary} />
          <Text
            style={{
              ...HEALTH_THEME_TYPOGRAPHY.body,
              color: palette.subtext,
              marginTop: HEALTH_THEME_SPACING.sm,
            }}
          >
            Loading institution…
          </Text>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }}>
      <LinearGradient colors={[palette.gradientStart, palette.gradientEnd]} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: HEALTH_THEME_SPACING.lg }}>
          <View style={[styles.headerRow, { marginBottom: HEALTH_THEME_SPACING.sm }]}
          >
            <View>
              <Text style={{ ...HEALTH_THEME_TYPOGRAPHY.h1, color: palette.text }}>Manage institution</Text>
              <Text style={{ ...HEALTH_THEME_TYPOGRAPHY.body, color: palette.subtext, marginTop: 4 }}>
                {currentInstitution?.name || form.name}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={[styles.closeButton, { borderColor: palette.divider }]}
              accessibilityLabel="Close manage institution"
            >
              <KISIcon name="close" size={20} color={palette.text} />
            </TouchableOpacity>
          </View>

          <View
            style={{
              marginTop: HEALTH_THEME_SPACING.lg,
              padding: HEALTH_THEME_SPACING.md,
              backgroundColor: palette.card,
              borderRadius: HEALTH_THEME_SPACING.lg,
              ...borders.card,
            }}
          >
            <Text style={{ ...HEALTH_THEME_TYPOGRAPHY.h3, color: palette.text }}>Institution details</Text>
            <KISTextInput
              label="Name"
              value={form.name}
              onChangeText={(value) => setForm((prev) => ({ ...prev, name: value }))}
              style={{ marginTop: HEALTH_THEME_SPACING.sm }}
            />
            <Pressable
              onPress={cycleType}
              style={{
                borderWidth: 2,
                borderColor: palette.divider,
                borderRadius: 12,
                paddingVertical: HEALTH_THEME_SPACING.sm,
                paddingHorizontal: HEALTH_THEME_SPACING.md,
                marginTop: HEALTH_THEME_SPACING.sm,
              }}
            >
              <Text style={{ ...HEALTH_THEME_TYPOGRAPHY.body, color: palette.accentPrimary }}>
                Type: {form.type.replace('_', ' ')}
              </Text>
            </Pressable>
            <KISTextInput
              label="Employees"
              keyboardType="numeric"
              value={form.employees}
              onChangeText={(value) => setForm((prev) => ({ ...prev, employees: value }))}
              style={{ marginTop: HEALTH_THEME_SPACING.sm }}
            />
            <View style={{ flexDirection: 'row', marginTop: HEALTH_THEME_SPACING.lg, gap: HEALTH_THEME_SPACING.sm }}>
              <KISButton title="Save changes" onPress={handleSave} disabled={submitting} />
              <KISButton title="Delete" variant="outline" onPress={handleDelete} disabled={submitting || !canDeleteInstitution} />
            </View>
            <Text style={{ ...HEALTH_THEME_TYPOGRAPHY.body, color: palette.subtext, marginTop: HEALTH_THEME_SPACING.xs }}>
              Your role: {actorRole}. Delete allowed for owner, admin, and manager only.
            </Text>
          </View>

          <View
            style={{
              marginTop: HEALTH_THEME_SPACING.lg,
              padding: HEALTH_THEME_SPACING.md,
              backgroundColor: palette.card,
              borderRadius: HEALTH_THEME_SPACING.lg,
              ...borders.card,
            }}
          >
            <Text style={{ ...HEALTH_THEME_TYPOGRAPHY.h3, color: palette.text }}>Institution Operations</Text>
            <Text
              style={{
                ...HEALTH_THEME_TYPOGRAPHY.body,
                color: palette.subtext,
                marginTop: HEALTH_THEME_SPACING.sm,
              }}
            >
              Manage institution details and team members here. Service catalog is managed separately.
            </Text>
            <View style={{ marginTop: HEALTH_THEME_SPACING.sm }}>
              <KISButton
                title={resolvedInstitutionId ? 'Open Service Catalog' : 'Create institution first'}
                variant="secondary"
                onPress={resolvedInstitutionId ? handleManageServices : undefined}
                disabled={!resolvedInstitutionId || !canOpenServiceCatalog}
              />
              <View style={{ height: HEALTH_THEME_SPACING.sm }} />
              <KISButton
                title={resolvedInstitutionId ? 'View members' : 'Create institution first'}
                variant="outline"
                onPress={resolvedInstitutionId ? handleViewMembers : undefined}
                disabled={!resolvedInstitutionId || !canOpenMembers}
              />
            </View>
          </View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  closeButton: {
    borderWidth: 1,
    borderRadius: 999,
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
