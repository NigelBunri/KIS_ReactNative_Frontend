import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import LinearGradient from 'react-native-linear-gradient';
import { KISIcon } from '@/constants/kisIcons';
import KISButton from '@/constants/KISButton';
import { RootStackParamList } from '@/navigation/types';
import ROUTES, { API_BASE_URL } from '@/network';
import { getRequest } from '@/network/get';
import {
  createHealthProfile,
  fetchHealthProfileState,
  updateHealthInstitutions,
} from '@/services/healthProfileService';
import AddContactsPage from '@/Module/AddContacts/AddContactsPage';
import type { KISContact } from '@/Module/AddContacts/contactsService';
import {
  getHealthThemeBorders,
  getHealthThemeColors,
  HEALTH_THEME_SPACING,
  HEALTH_THEME_TYPOGRAPHY,
} from '@/theme/health';
import type { HealthInstitutionMember } from './types';
import { getInstitutionRoleForUser } from './accessControl';

type Props = NativeStackScreenProps<RootStackParamList, 'HealthInstitutionMembers'>;

const ROLE_ORDER = ['admin', 'manager', 'staff', 'analyst', 'member'] as const;
type InstitutionRole = (typeof ROLE_ORDER)[number];
type MemberRole = InstitutionRole | 'owner' | 'unassigned';

const ROLE_RANK: Record<MemberRole, number> = {
  member: 0,
  unassigned: 0,
  staff: 1,
  analyst: 1,
  manager: 2,
  admin: 3,
  owner: 4,
};

const ROLE_PERMISSIONS: Record<MemberRole, Record<string, boolean>> = {
  member: {
    analytics: false,
    schedules: false,
    services: false,
    financial: false,
    compliance: false,
    members: false,
  },
  unassigned: {
    analytics: false,
    schedules: false,
    services: false,
    financial: false,
    compliance: false,
    members: false,
  },
  owner: {
    analytics: true,
    schedules: true,
    services: true,
    financial: true,
    compliance: true,
    members: true,
  },
  admin: {
    analytics: true,
    schedules: true,
    services: true,
    financial: true,
    compliance: true,
    members: true,
  },
  manager: {
    analytics: true,
    schedules: true,
    services: true,
    financial: false,
    compliance: false,
    members: true,
  },
  staff: {
    analytics: false,
    schedules: true,
    services: true,
    financial: false,
    compliance: false,
    members: false,
  },
  analyst: {
    analytics: true,
    schedules: false,
    services: false,
    financial: true,
    compliance: true,
    members: false,
  },
};

const normalizeRole = (value: unknown): MemberRole => {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'owner' || raw === 'admin' || raw === 'manager' || raw === 'staff' || raw === 'analyst' || raw === 'member' || raw === 'unassigned') {
    return raw as MemberRole;
  }
  return 'staff';
};

const clampMembershipDiscount = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 10;
  const rounded = Math.round(parsed);
  return Math.max(10, Math.min(100, rounded));
};

const normalizePhoneForCompare = (value: unknown) => String(value || '').replace(/\D/g, '');

const asMember = (raw: any, fallbackSource: HealthInstitutionMember['source']): HealthInstitutionMember | null => {
  if (!raw) return null;
  if (typeof raw === 'string') {
    const name = raw.trim();
    if (!name) return null;
    return {
      id: `name-${name}`,
      name,
      role: 'staff',
      source: fallbackSource,
      permissions: ROLE_PERMISSIONS.staff,
    };
  }

  const name = String(raw?.name ?? raw?.display_name ?? raw?.full_name ?? '').trim();
  if (!name) return null;
  const role = normalizeRole(raw?.role ?? raw?.member_role ?? 'staff');
  const userId = raw?.userId ?? raw?.user_id ?? raw?.user?.id;
  const phone = raw?.phone ?? raw?.user?.phone;
  const email = raw?.email ?? raw?.user?.email;
  const source = (raw?.source as HealthInstitutionMember['source']) || fallbackSource;

  return {
    id: String(raw?.id ?? userId ?? `${name}-${phone ?? 'member'}`),
    userId: userId ? String(userId) : undefined,
    name,
    phone: phone ? String(phone) : undefined,
    email: email ? String(email) : undefined,
    role,
    source,
    permissions: {
      ...ROLE_PERMISSIONS[role],
      ...(raw?.permissions || {}),
    },
  };
};

const normalizeInstitutionMembers = (institution: any): HealthInstitutionMember[] => {
  const buckets = [
    { list: institution?.members, source: 'owner_added' as const },
    { list: institution?.employees, source: 'owner_added' as const },
    { list: institution?.registered_members, source: 'registered' as const },
    { list: institution?.subscribed_members, source: 'subscription' as const },
    { list: institution?.subscriptions, source: 'subscription' as const },
  ];

  const merged: HealthInstitutionMember[] = [];
  const seen = new Set<string>();

  buckets.forEach(({ list, source }) => {
    if (!Array.isArray(list)) return;
    list.forEach((item: any) => {
      const member = asMember(item, source);
      if (!member) return;
      const identityKeys = [
        member.userId ? `uid:${member.userId}` : '',
        member.id ? `id:${member.id}` : '',
        member.phone ? `phone:${member.phone}` : '',
        member.name ? `name:${member.name.toLowerCase()}` : '',
      ].filter(Boolean);
      if (identityKeys.some((key) => seen.has(key))) return;
      identityKeys.forEach((key) => seen.add(key));
      merged.push(member);
    });
  });

  return merged;
};

export default function HealthInstitutionMembersScreen({ route, navigation }: Props) {
  const institutionId = route.params.institutionId;
  const institutionName = route.params.institutionName ?? 'Institution Members';

  const scheme = useColorScheme();
  const palette = getHealthThemeColors(scheme === 'light' ? 'light' : 'dark');
  const borders = getHealthThemeBorders(palette);
  const spacing = HEALTH_THEME_SPACING;
  const typography = HEALTH_THEME_TYPOGRAPHY;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addingMember, setAddingMember] = useState(false);
  const [contactsPickerOpen, setContactsPickerOpen] = useState(false);
  const [hasHealthProfile, setHasHealthProfile] = useState(false);
  const [currentUserId, setCurrentUserId] = useState('');
  const [editingRoleMemberId, setEditingRoleMemberId] = useState('');
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [members, setMembers] = useState<HealthInstitutionMember[]>([]);
  const [, setMemberAuditLogs] = useState<
    Array<{
      id: string;
      at: string;
      actorUserId?: string;
      action: string;
      memberName: string;
      fromRole?: string;
      toRole?: string;
    }>
  >([]);
  const [selectedRole, setSelectedRole] = useState<InstitutionRole>('staff');
  const [membershipOpen, setMembershipOpen] = useState(false);
  const [membershipDiscountPercent, setMembershipDiscountPercent] = useState(10);

  const institution = institutions.find((item: any) => String(item?.id) === String(institutionId));
  const ownerContact = (institution as any)?.owner_contact || (institution as any)?.ownerContact || {};
  const ownerMember = members.find((member) => normalizeRole(member.role) === 'owner');
  const ownerCount = members.filter((member) => normalizeRole(member.role) === 'owner').length;

  const actorRole = useMemo<MemberRole>(() => {
    const resolved = getInstitutionRoleForUser(institution, {
      id: currentUserId || undefined,
    });
    if (resolved) return normalizeRole(resolved);
    if (String(ownerContact?.userId || '') === String(currentUserId)) return 'owner';
    return 'staff';
  }, [currentUserId, institution, ownerContact?.userId]);
  const canManageMembers = !!ROLE_PERMISSIONS[actorRole]?.members;

  const appendAuditLog = useCallback((entry: { action: string; memberName: string; fromRole?: string; toRole?: string }) => {
    setMemberAuditLogs((prev) => [
      {
        id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        at: new Date().toISOString(),
        actorUserId: currentUserId || undefined,
        ...entry,
      },
      ...prev,
    ]);
  }, [currentUserId]);

  const isRoleAssignableByActor = useCallback((target: HealthInstitutionMember, nextRole: MemberRole) => {
    const targetRole = normalizeRole(target.role);
    if (!ROLE_PERMISSIONS[actorRole]?.members) return false;
    if (targetRole === 'owner') return nextRole === 'owner';
    if (nextRole === 'owner') return false;
    if (ROLE_RANK[nextRole] > ROLE_RANK[actorRole]) return false;
    return true;
  }, [actorRole]);

  const getAssignableRolesForMember = useCallback((target: HealthInstitutionMember): MemberRole[] => {
    const candidates: MemberRole[] = ['admin', 'manager', 'staff', 'analyst', 'member', 'unassigned'];
    return candidates.filter((role) => isRoleAssignableByActor(target, role));
  }, [isRoleAssignableByActor]);

  const resolveUserIdByPhone = useCallback(async (phone: string): Promise<string> => {
    const cleanPhone = String(phone || '').trim();
    if (!cleanPhone) return '';

    const extractId = (payload: any): string => {
      const data = payload?.data ?? payload ?? {};
      const direct = data?.userId ?? data?.user_id ?? data?.id ?? null;
      if (direct != null) return String(direct);
      const nested = data?.user?.id ?? null;
      return nested != null ? String(nested) : '';
    };

    const urls = [
      `${ROUTES.auth.checkContact}?phone=${encodeURIComponent(cleanPhone)}`,
      `${API_BASE_URL}/api/v1/contacts/check?phone=${encodeURIComponent(cleanPhone)}`,
      `${API_BASE_URL}/api/v1/users/check-status/?phone=${encodeURIComponent(cleanPhone)}`,
    ];

    for (const url of urls) {
      try {
        const response = await getRequest(url);
        const resolved = extractId(response);
        if (resolved) return resolved;
      } catch {
        // continue fallback chain
      }
    }
    return '';
  }, []);

  const loadState = useCallback(async () => {
    setLoading(true);
    try {
      const meRes = await getRequest(ROUTES.auth.checkLogin);
      const me = (meRes as any)?.data ?? {};
      setCurrentUserId(me?.id != null ? String(me.id) : '');

      const state = await fetchHealthProfileState();
      setHasHealthProfile(state.exists);
      const list = Array.isArray(state.profile?.institutions) ? state.profile.institutions : [];
      setInstitutions(list);
      const currentInstitution = list.find((item: any) => String(item?.id) === String(institutionId));
      setMembers(normalizeInstitutionMembers(currentInstitution));
      const membershipSettings = currentInstitution?.membership_settings || currentInstitution?.membershipSettings || {};
      const isOpen =
        membershipSettings?.open ??
        membershipSettings?.is_open ??
        currentInstitution?.membership_open ??
        currentInstitution?.membershipOpen ??
        false;
      const discount =
        membershipSettings?.discountPercent ??
        membershipSettings?.discount_percent ??
        currentInstitution?.membership_discount_pct ??
        currentInstitution?.membershipDiscountPct ??
        10;
      setMembershipOpen(!!isOpen);
      setMembershipDiscountPercent(clampMembershipDiscount(discount));

    } catch (error: any) {
      Alert.alert('Institution members', error?.message || 'Unable to load institution members.');
    } finally {
      setLoading(false);
    }
  }, [institutionId]);

  useEffect(() => {
    loadState().catch(() => {});
  }, [loadState]);

  const addMemberFromContact = useCallback(async (contact: KISContact) => {
    if (!canManageMembers) {
      Alert.alert('Members', 'Your role does not allow member management.');
      return;
    }
    if (!contact?.isRegistered) return;

    setAddingMember(true);
    try {
      let resolvedUserId = contact?.userId ? String(contact.userId) : '';
      if (!resolvedUserId && contact?.phone) {
        resolvedUserId = await resolveUserIdByPhone(contact.phone);
      }
      if (!resolvedUserId) {
        Alert.alert('Members', 'Could not resolve this user id from phone number yet. Please try again.');
        return;
      }

      const normalizedContactPhone = normalizePhoneForCompare(contact.phone);
      const existingMember = members.find((member) => {
        const memberUserId = String(member.userId || '').trim();
        const memberPhone = normalizePhoneForCompare(member.phone);
        if (memberUserId && memberUserId === resolvedUserId) return true;
        if (normalizedContactPhone && memberPhone && memberPhone === normalizedContactPhone) return true;
        return false;
      });

      let finalRole: MemberRole = selectedRole;
      if (ROLE_RANK[selectedRole] > ROLE_RANK[actorRole]) {
        finalRole = 'staff';
      }

      if (existingMember) {
        if (existingMember.source === 'owner_added' || existingMember.source === 'imported') {
          Alert.alert(
            'Members',
            'This contact is already a member of the institution. If you just changed members, tap "Save Members & Roles" to persist.',
          );
          return;
        }

        const nextRole = isRoleAssignableByActor(existingMember, finalRole)
          ? finalRole
          : normalizeRole(existingMember.role);

        setMembers((prev) =>
          prev.map((member) =>
            member.id === existingMember.id
              ? {
                  ...member,
                  userId: resolvedUserId || member.userId,
                  phone: member.phone || contact.phone,
                  source: 'owner_added',
                  role: nextRole,
                  permissions: ROLE_PERMISSIONS[nextRole],
                }
              : member,
          ),
        );
        appendAuditLog({
          action: 'member.promoted',
          memberName: existingMember.name || contact.name,
          fromRole: String(existingMember.role || ''),
          toRole: nextRole,
        });
        Alert.alert(
          'Members',
          `${contact.name} was linked as an owner-added member. Tap "Save Members & Roles" to persist.`,
        );
        return;
      }

      setMembers((prev) => [
        ...prev,
        {
          id: `user-${resolvedUserId}`,
          userId: resolvedUserId,
          name: contact.name,
          phone: contact.phone,
          email: '',
          role: finalRole,
          source: 'owner_added',
          permissions: ROLE_PERMISSIONS[finalRole],
        },
      ]);

      appendAuditLog({ action: 'member.added', memberName: contact.name, toRole: finalRole });
      Alert.alert('Members', `${contact.name} added as ${finalRole}. Tap "Save Members & Roles" to persist.`);
    } catch (error: any) {
      Alert.alert('Members', error?.message || 'Unable to add member from selected contact.');
    } finally {
      setAddingMember(false);
    }
  }, [
    actorRole,
    appendAuditLog,
    canManageMembers,
    isRoleAssignableByActor,
    members,
    resolveUserIdByPhone,
    selectedRole,
  ]);

  const assignMemberRole = useCallback((member: HealthInstitutionMember, nextRole: MemberRole) => {
    if (!canManageMembers) {
      Alert.alert('Members', 'Your role does not allow role assignment.');
      return;
    }
    if (!isRoleAssignableByActor(member, nextRole)) {
      Alert.alert('Members', 'You cannot assign that role for this member.');
      return;
    }
    if (normalizeRole(member.role) === 'owner' && nextRole !== 'owner') {
      Alert.alert('Members', 'Owner role cannot be changed.');
      return;
    }

    setMembers((prev) =>
      prev.map((item) => {
        if (item.id === member.id) {
          return { ...item, role: nextRole, permissions: ROLE_PERMISSIONS[nextRole] };
        }
        return item;
      }),
    );
    appendAuditLog({
      action: 'member.role_assigned',
      memberName: member.name,
      fromRole: String(member.role || ''),
      toRole: nextRole,
    });
    setEditingRoleMemberId('');
  }, [appendAuditLog, canManageMembers, isRoleAssignableByActor]);

  const cycleMemberRole = useCallback((memberId: string) => {
    if (!canManageMembers) {
      Alert.alert('Members', 'Your role does not allow role assignment.');
      return;
    }

    setMembers((prev) =>
      prev.map((member) => {
        if (member.id !== memberId) return member;
        const currentRole = normalizeRole(member.role);
        if (currentRole === 'owner') return member;
        const currentIndex = ROLE_ORDER.findIndex((item) => item === (currentRole as InstitutionRole));
        const nextRole = ROLE_ORDER[(currentIndex + 1) % ROLE_ORDER.length] as MemberRole;

        if (!isRoleAssignableByActor(member, nextRole)) return member;

        appendAuditLog({
          action: 'member.role_cycled',
          memberName: member.name,
          fromRole: currentRole,
          toRole: nextRole,
        });
        return { ...member, role: nextRole, permissions: ROLE_PERMISSIONS[nextRole] };
      }),
    );
  }, [appendAuditLog, canManageMembers, isRoleAssignableByActor]);

  const clearMemberRole = useCallback((memberId: string) => {
    if (!canManageMembers) {
      Alert.alert('Members', 'Your role does not allow role assignment.');
      return;
    }

    setMembers((prev) =>
      prev.map((member) => {
        if (member.id !== memberId) return member;
        if (normalizeRole(member.role) === 'owner') return member;
        if (!isRoleAssignableByActor(member, 'unassigned')) return member;

        appendAuditLog({
          action: 'member.role_cleared',
          memberName: member.name,
          fromRole: String(member.role || ''),
          toRole: 'unassigned',
        });
        return { ...member, role: 'unassigned', permissions: ROLE_PERMISSIONS.unassigned };
      }),
    );
  }, [appendAuditLog, canManageMembers, isRoleAssignableByActor]);

  const removeMember = useCallback((memberId: string) => {
    if (!canManageMembers) {
      Alert.alert('Members', 'Your role does not allow member removal.');
      return;
    }

    setMembers((prev) => {
      const target = prev.find((member) => member.id === memberId);
      if (!target) return prev;
      if (normalizeRole(target.role) === 'owner') {
        Alert.alert('Members', 'Owner cannot be removed.');
        return prev;
      }
      if (!isRoleAssignableByActor(target, normalizeRole(target.role))) {
        Alert.alert('Members', 'You cannot remove this member.');
        return prev;
      }

      appendAuditLog({
        action: 'member.removed',
        memberName: target.name,
        fromRole: String(target.role || ''),
      });
      return prev.filter((member) => member.id !== memberId);
    });
  }, [appendAuditLog, canManageMembers, isRoleAssignableByActor]);

  const saveMembers = useCallback(async () => {
    const currentInstitution = institutions.find((item: any) => String(item?.id) === String(institutionId));
    if (!currentInstitution) {
      Alert.alert('Institution members', 'Institution not found.');
      return;
    }

    const ownerMembers = members.filter((member) => normalizeRole(member.role) === 'owner');
    if (ownerMembers.length === 0) {
      Alert.alert('Institution members', 'At least one owner is required.');
      return;
    }
    if (ownerMembers.length > 1) {
      Alert.alert('Institution members', 'Only one owner is allowed. Owner role cannot be transferred.');
      return;
    }

    const nextInstitution = {
      ...currentInstitution,
      members,
      membership_open: membershipOpen,
      membershipOpen: membershipOpen,
      membership_discount_pct: clampMembershipDiscount(membershipDiscountPercent),
      membershipDiscountPct: clampMembershipDiscount(membershipDiscountPercent),
      membership_settings: {
        ...(currentInstitution?.membership_settings || {}),
        open: membershipOpen,
        discountPercent: clampMembershipDiscount(membershipDiscountPercent),
      },
      membershipSettings: {
        ...(currentInstitution?.membershipSettings || {}),
        open: membershipOpen,
        discountPercent: clampMembershipDiscount(membershipDiscountPercent),
      },
      employees: members.map((member) => ({
        id: member.id,
        user_id: member.userId,
        name: member.name,
        phone: member.phone,
        email: member.email ?? '',
        role: normalizeRole(member.role),
        source: member.source ?? 'owner_added',
        permissions: member.permissions ?? ROLE_PERMISSIONS.staff,
      })),
    };
    const nextInstitutions = institutions.map((item: any) =>
      String(item?.id) === String(institutionId) ? nextInstitution : item,
    );

    setSaving(true);
    try {
      const response = hasHealthProfile
        ? await updateHealthInstitutions(nextInstitutions)
        : await createHealthProfile(nextInstitutions);
      if (!response?.success) {
        throw new Error(response?.message || 'Unable to save members.');
      }
      await loadState();
      Alert.alert('Institution members', 'Members, roles, and access controls saved.');
    } catch (error: any) {
      Alert.alert('Institution members', error?.message || 'Unable to save members.');
    } finally {
      setSaving(false);
    }
  }, [
    hasHealthProfile,
    institutionId,
    institutions,
    loadState,
    members,
    membershipDiscountPercent,
    membershipOpen,
  ]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }}>
        <LinearGradient colors={[palette.gradientStart, palette.gradientEnd]} style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color={palette.accentPrimary} />
          <Text style={{ ...typography.body, color: palette.subtext, marginTop: spacing.sm }}>Loading members...</Text>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }}>
      <LinearGradient colors={[palette.gradientStart, palette.gradientEnd]} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={{ ...typography.h1, color: palette.text }}>Members</Text>
              <Text style={{ ...typography.body, color: palette.subtext, marginTop: spacing.xs }}>{institutionName}</Text>
            </View>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={{ borderWidth: 1, borderColor: palette.divider, borderRadius: 999, padding: spacing.xs }}
              accessibilityLabel="Close members"
            >
              <KISIcon name="close" size={20} color={palette.text} />
            </TouchableOpacity>
          </View>

          <View style={{ marginTop: spacing.md, borderRadius: spacing.lg, padding: spacing.md, backgroundColor: palette.card, ...borders.card }}>
            <Text style={{ ...typography.h3, color: palette.text }}>Owner Contact</Text>
            <Text style={{ ...typography.body, color: palette.subtext, marginTop: spacing.xs }}>
              {ownerContact?.name || ownerMember?.name || 'Owner'}
            </Text>
            <Text style={{ ...typography.body, color: palette.subtext }}>
              Phone: {ownerContact?.phone || ownerMember?.phone || 'Not set'}
            </Text>
            <Text style={{ ...typography.body, color: palette.subtext }}>
              Email: {ownerContact?.email || ownerMember?.email || 'Not set'}
            </Text>
          </View>

          <View style={{ marginTop: spacing.md, borderRadius: spacing.lg, padding: spacing.md, backgroundColor: palette.card, ...borders.card }}>
            <Text style={{ ...typography.h3, color: palette.text }}>Access Control Summary</Text>
            <Text style={{ ...typography.body, color: palette.subtext, marginTop: spacing.xs }}>Your role: {actorRole}</Text>
            <Text style={{ ...typography.body, color: palette.subtext }}>Member controls: {canManageMembers ? 'allowed' : 'read only'}</Text>
            <Text style={{ ...typography.body, color: palette.subtext }}>Owners in institution: {ownerCount}</Text>
          </View>

          <View style={{ marginTop: spacing.md, borderRadius: spacing.lg, padding: spacing.md, backgroundColor: palette.card, ...borders.card }}>
            <Text style={{ ...typography.h3, color: palette.text }}>Public Membership Settings</Text>
            <Text style={{ ...typography.body, color: palette.subtext, marginTop: spacing.xs }}>
              Control whether users can join this institution and choose member discount from 10% to 100%.
            </Text>
            <View style={{ marginTop: spacing.sm, flexDirection: 'row', gap: spacing.xs }}>
              <KISButton
                title="Open"
                size="sm"
                variant={membershipOpen ? 'primary' : 'outline'}
                onPress={() => setMembershipOpen(true)}
                disabled={!canManageMembers}
              />
              <KISButton
                title="Closed"
                size="sm"
                variant={!membershipOpen ? 'primary' : 'outline'}
                onPress={() => setMembershipOpen(false)}
                disabled={!canManageMembers}
              />
            </View>
            <Text style={{ ...typography.label, color: palette.text, marginTop: spacing.sm }}>
              Discount: {membershipDiscountPercent}%
            </Text>
            <View style={{ marginTop: spacing.xs, flexDirection: 'row', gap: spacing.xs }}>
              <KISButton
                title="-5"
                size="xs"
                variant="outline"
                onPress={() => setMembershipDiscountPercent((prev) => clampMembershipDiscount(prev - 5))}
                disabled={!canManageMembers}
              />
              <KISButton
                title="+5"
                size="xs"
                variant="outline"
                onPress={() => setMembershipDiscountPercent((prev) => clampMembershipDiscount(prev + 5))}
                disabled={!canManageMembers}
              />
            </View>
          </View>

          <View style={{ marginTop: spacing.md, borderRadius: spacing.lg, padding: spacing.md, backgroundColor: palette.card, ...borders.card }}>
            <Text style={{ ...typography.h3, color: palette.text }}>Add From Registered Contacts</Text>
            <Text style={{ ...typography.body, color: palette.subtext, marginTop: spacing.xs }}>
              Reuse the Select Contacts page from Messages. Only contacts registered on KIS can be added.
            </Text>
            <Text style={{ ...typography.label, color: palette.subtext, marginTop: spacing.sm }}>Default role for added members</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs }}>
              {ROLE_ORDER.map((role) => (
                <KISButton
                  key={role}
                  title={role}
                  size="xs"
                  variant={selectedRole === role ? 'primary' : 'outline'}
                  onPress={() => setSelectedRole(role)}
                  disabled={!canManageMembers}
                />
              ))}
            </View>
            <View style={{ marginTop: spacing.sm }}>
              <KISButton
                title={addingMember ? 'Adding member...' : 'Open Select Contacts'}
                onPress={() => setContactsPickerOpen(true)}
                variant="outline"
                disabled={addingMember || !canManageMembers}
              />
            </View>
          </View>

          <View style={{ marginTop: spacing.md, borderRadius: spacing.lg, padding: spacing.md, backgroundColor: palette.card, ...borders.card }}>
            <Text style={{ ...typography.h3, color: palette.text }}>Institution Members</Text>
            <Text style={{ ...typography.body, color: palette.subtext, marginTop: spacing.xs }}>
              Members added by owner, registration, or subscription.
            </Text>
            <View style={{ marginTop: spacing.sm, gap: spacing.xs }}>
              {members.map((member) => (
                <View
                  key={`${member.id || 'member'}-${member.userId || member.phone || member.name}`}
                  style={{
                    borderRadius: spacing.sm,
                    borderWidth: 1,
                    borderColor: palette.divider,
                    padding: spacing.sm,
                    backgroundColor: palette.surface,
                  }}
                >
                  {normalizeRole(member.role) === 'owner' ? (
                    <Text style={{ ...typography.caption, color: palette.accentPrimary, marginBottom: spacing.xs }}>
                      Owner role is permanent
                    </Text>
                  ) : null}
                  <Text style={{ ...typography.label, color: palette.text }}>{member.name}</Text>
                  <Text style={{ ...typography.body, color: palette.subtext }}>
                    {member.phone || 'No phone'} · Role: {normalizeRole(member.role)}
                  </Text>
                  <Text style={{ ...typography.body, color: palette.subtext }}>Source: {member.source || 'owner_added'}</Text>
                  <Text style={{ ...typography.body, color: palette.subtext }}>
                    Access: {Object.entries(member.permissions || {}).filter(([, enabled]) => enabled).map(([key]) => key).join(', ') || 'none'}
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{ marginTop: spacing.xs }}
                    contentContainerStyle={{ flexDirection: 'row', gap: spacing.xs, paddingRight: spacing.xs }}
                  >
                    <KISButton
                      title="Assign role"
                      size="xs"
                      variant="outline"
                      onPress={() => setEditingRoleMemberId(editingRoleMemberId === String(member.id) ? '' : String(member.id))}
                      disabled={!canManageMembers || normalizeRole(member.role) === 'owner'}
                    />
                    <KISButton
                      title="Quick cycle"
                      size="xs"
                      variant="outline"
                      onPress={() => cycleMemberRole(String(member.id))}
                      disabled={!canManageMembers || normalizeRole(member.role) === 'owner'}
                    />
                    <KISButton
                      title="Remove role"
                      size="xs"
                      variant="outline"
                      onPress={() => clearMemberRole(String(member.id))}
                      disabled={!canManageMembers || normalizeRole(member.role) === 'owner'}
                    />
                    <KISButton
                      title="Remove"
                      size="xs"
                      variant="outline"
                      onPress={() => removeMember(String(member.id))}
                      disabled={!canManageMembers || normalizeRole(member.role) === 'owner'}
                    />
                  </ScrollView>
                  {editingRoleMemberId === String(member.id) ? (
                    <View style={{ marginTop: spacing.xs, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                      {getAssignableRolesForMember(member).map((role) => (
                        <KISButton
                          key={`${member.id}-${role}`}
                          title={role}
                          size="xs"
                          variant={normalizeRole(member.role) === role ? 'primary' : 'outline'}
                          onPress={() => assignMemberRole(member, role)}
                        />
                      ))}
                    </View>
                  ) : null}
                </View>
              ))}
              {members.length === 0 ? (
                <Text style={{ ...typography.body, color: palette.subtext }}>No members added yet.</Text>
              ) : null}
            </View>
            <View style={{ marginTop: spacing.md, flexDirection: 'row', gap: spacing.sm }}>
              <KISButton
                title={saving ? 'Saving...' : 'Save Members & Roles'}
                onPress={() => {
                  saveMembers().catch(() => undefined);
                }}
                disabled={saving}
              />
              <KISButton title="Back" variant="outline" onPress={() => navigation.goBack()} disabled={saving} />
            </View>
          </View>
        </ScrollView>

        {contactsPickerOpen ? (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: palette.background }}>
            <AddContactsPage
              onClose={() => setContactsPickerOpen(false)}
              onOpenChat={(_chat) => undefined}
              onSelectKISContact={addMemberFromContact}
            />
          </View>
        ) : null}
      </LinearGradient>
    </SafeAreaView>
  );
}
