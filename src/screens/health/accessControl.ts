export type HealthAccessUser = {
  id?: string;
  phone?: string;
  email?: string;
};

const MANAGER_ROLES = new Set(['owner', 'admin', 'manager']);
const VISIBLE_ROLES = new Set(['owner', 'admin', 'manager', 'staff', 'analyst']);
const ROLE_RANK: Record<string, number> = {
  member: 0,
  unassigned: 0,
  staff: 1,
  analyst: 1,
  manager: 2,
  admin: 3,
  owner: 4,
};

export const normalizeInstitutionRole = (value: unknown): string => {
  const role = String(value || '').trim().toLowerCase();
  if (!role) return 'unassigned';
  if (role === 'care worker' || role === 'care_worker' || role === 'worker' || role === 'employee') {
    return 'staff';
  }
  if (VISIBLE_ROLES.has(role) || role === 'unassigned' || role === 'member') return role;
  return 'unassigned';
};

const normalizePhone = (value: unknown): string => String(value || '').replace(/\D/g, '');

const normalizeEmail = (value: unknown): string => String(value || '').trim().toLowerCase();

export const resolveHealthAccessUser = (payload: any): HealthAccessUser => {
  const data = payload?.data ?? payload ?? {};
  const user =
    data?.user ||
    data?.account ||
    data?.profile?.user ||
    data?.profile ||
    data;
  return {
    id:
      user?.id != null
        ? String(user.id)
        : user?.user_id != null
        ? String(user.user_id)
        : user?.userId != null
        ? String(user.userId)
        : undefined,
    phone:
      String(user?.phone || user?.phone_number || user?.phoneNumber || data?.phone || '')
        .trim() || undefined,
    email:
      String(user?.email || data?.email || '')
        .trim() || undefined,
  };
};

const doesMemberMatchUser = (member: any, user: HealthAccessUser): boolean => {
  const memberUserId = String(member?.userId || member?.user_id || '').trim();
  const userId = String(user?.id || '').trim();
  if (memberUserId && userId && memberUserId === userId) return true;

  const memberPhone = normalizePhone(member?.phone);
  const userPhone = normalizePhone(user?.phone);
  if (memberPhone && userPhone && memberPhone === userPhone) return true;

  const memberEmail = normalizeEmail(member?.email);
  const userEmail = normalizeEmail(user?.email);
  if (memberEmail && userEmail && memberEmail === userEmail) return true;

  return false;
};

export const getInstitutionRoleForUser = (
  institution: any,
  user: HealthAccessUser | null | undefined,
): string | null => {
  if (!institution || !user) return null;

  const directOwnerUserId = String(
    institution?.owner_user_id ||
      institution?.ownerUserId ||
      institution?.owner ||
      institution?.created_by_user_id ||
      institution?.createdByUserId ||
      '',
  ).trim();
  const userId = String(user.id || '').trim();
  if (directOwnerUserId && userId && directOwnerUserId === userId) return 'owner';

  const relationship = String(institution?.relationship || institution?.viewer?.relationship || '').trim().toLowerCase();
  if (relationship === 'owner') return 'owner';

  const ownerContact = institution?.owner_contact || institution?.ownerContact || {};
  const ownerUserId = String(ownerContact?.userId || ownerContact?.user_id || '').trim();
  if (ownerUserId && userId && ownerUserId === userId) return 'owner';

  const ownerPhone = normalizePhone(ownerContact?.phone);
  const userPhone = normalizePhone(user.phone);
  if (ownerPhone && userPhone && ownerPhone === userPhone) return 'owner';

  const ownerEmail = normalizeEmail(ownerContact?.email);
  const userEmail = normalizeEmail(user.email);
  if (ownerEmail && userEmail && ownerEmail === userEmail) return 'owner';

  const viewerRole = normalizeInstitutionRole(
    institution?.viewer?.role ||
      institution?.current_membership?.role ||
      institution?.currentMembership?.role ||
      institution?.access?.role ||
      institution?.permissions?.role ||
      institution?.current_user_role ||
      institution?.currentUserRole,
  );
  if (viewerRole !== 'unassigned') return viewerRole;

  const members = [
    ...(Array.isArray(institution?.members) ? institution.members : []),
    ...(Array.isArray(institution?.employees) ? institution.employees : []),
  ];
  const matchedRoles = members
    .filter((member) => doesMemberMatchUser(member, user))
    .map((member) => normalizeInstitutionRole(member?.role))
    .filter(Boolean);

  if (matchedRoles.length === 0) return null;

  // Security-first: if duplicate rows conflict, apply least privileged role.
  return matchedRoles.reduce((least, current) => {
    const leastRank = ROLE_RANK[least] ?? ROLE_RANK.unassigned;
    const currentRank = ROLE_RANK[current] ?? ROLE_RANK.unassigned;
    return currentRank < leastRank ? current : least;
  }, matchedRoles[0]);
};

export const canUserManageInstitution = (
  institution: any,
  user: HealthAccessUser | null | undefined,
): boolean => {
  const role = getInstitutionRoleForUser(institution, user);
  return !!role && MANAGER_ROLES.has(role);
};

export const canUserViewInstitution = (
  institution: any,
  user: HealthAccessUser | null | undefined,
): boolean => {
  const role = getInstitutionRoleForUser(institution, user);
  return !!role && VISIBLE_ROLES.has(role);
};

export const filterInstitutionsForManagers = <T extends any>(
  institutions: T[],
  user: HealthAccessUser | null | undefined,
): T[] => {
  if (!Array.isArray(institutions) || !user) return [];
  return institutions.filter((institution) => canUserManageInstitution(institution, user));
};

export const filterInstitutionsForVisibleRoles = <T extends any>(
  institutions: T[],
  user: HealthAccessUser | null | undefined,
): T[] => {
  if (!Array.isArray(institutions) || !user) return [];
  return institutions.filter((institution) => canUserViewInstitution(institution, user));
};
