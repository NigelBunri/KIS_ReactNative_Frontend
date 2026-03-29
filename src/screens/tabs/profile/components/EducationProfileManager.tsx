import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useKISTheme } from '@/theme/useTheme';
import KISButton from '@/constants/KISButton';
import KISTextInput from '@/constants/KISTextInput';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import useEducationProfiles from '@/screens/broadcast/education/hooks/useEducationProfiles';
import type { MainTabsParamList } from '@/navigation/types';
import {
  refreshFromDeviceAndBackendWithOptions,
  type KISContact,
} from '@/Module/AddContacts/contactsService';

const EDUCATION_PROFILE_TYPE_OPTIONS = [
  { id: 'course', label: 'Course' },
  { id: 'degree', label: 'Degree' },
  { id: 'camp', label: 'Camp' },
  { id: 'vocational', label: 'Vocational Training' },
  { id: 'workshop', label: 'Workshop' },
  { id: 'misc', label: 'Other' },
] as const;

const PERMISSION_ENDPOINT = ROUTES.broadcasts.educationProfilePermissions;

type ProfileFormState = {
  name: string;
  description: string;
  profileType: (typeof EDUCATION_PROFILE_TYPE_OPTIONS)[number]['id'];
};

type PermissionOption = {
  id: string;
  label: string;
  description?: string;
};

type Props = {
  initialProfileId?: string | null;
};

type BottomTabsProp = BottomTabNavigationProp<MainTabsParamList, 'Profile'>;

const buildRolePayload = (roles: any[] = []) =>
  roles.map((role) => ({
    id: role?.id ?? role?.name ?? `role-${Math.random().toString(36).slice(2, 7)}`,
    name: role?.name ?? 'Unnamed role',
    permissions: Array.isArray(role?.permissions) ? role.permissions : [],
    assignments: Array.isArray(role?.assignments)
      ? role.assignments.map((assignment: any) => assignment.user_id).filter(Boolean)
      : [],
  }));

const EMPTY_CONTACT_NOTE = 'Select a registered contact from your device to invite.';

export default function EducationProfileManager({ initialProfileId = null }: Props) {
  const { palette } = useKISTheme();
  const navigation = useNavigation<BottomTabsProp>();
  const [formState, setFormState] = useState<ProfileFormState>({
    name: '',
    description: '',
    profileType: EDUCATION_PROFILE_TYPE_OPTIONS[0].id,
  });
  const [formLoading, setFormLoading] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [profileBroadcastingId, setProfileBroadcastingId] = useState<string | null>(null);
  const [roleName, setRoleName] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [roleActionPending, setRoleActionPending] = useState(false);
  const [courseTitle, setCourseTitle] = useState('');
  const [courseSummary, setCourseSummary] = useState('');
  const [courseSubmitting, setCourseSubmitting] = useState(false);
  const [moduleTitle, setModuleTitle] = useState('');
  const [moduleSummary, setModuleSummary] = useState('');
  const [moduleSubmitting, setModuleSubmitting] = useState(false);
  const {
    profiles: educationProfiles,
    loading,
    error,
    deleteProfile,
    updateProfile,
    createProfile,
  } = useEducationProfiles();
  const [permissions, setPermissions] = useState<PermissionOption[]>([]);
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [permissionsError, setPermissionsError] = useState<string | null>(null);
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<string[]>([]);
  const [contacts, setContacts] = useState<KISContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsError, setContactsError] = useState<string | null>(null);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [contactSearchTerm, setContactSearchTerm] = useState('');

  const activeProfile = useMemo(
    () => educationProfiles.find((profile) => profile.id === editingProfileId) ?? null,
    [educationProfiles, editingProfileId],
  );

  useEffect(() => {
    let mounted = true;
    setPermissionsLoading(true);
    getRequest(PERMISSION_ENDPOINT, {
      errorMessage: 'Unable to load permissions.',
    })
      .then((res) => {
        if (!mounted) return;
        if (res?.success) {
          setPermissions(res.data?.permissions ?? []);
          setPermissionsError(null);
        } else {
          setPermissions([]);
          setPermissionsError(res?.message || 'Unable to load permissions.');
        }
      })
      .catch((err) => {
        if (!mounted) return;
        setPermissions([]);
        setPermissionsError(err?.message || 'Unable to load permissions.');
      })
      .finally(() => {
        if (mounted) setPermissionsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    setContactsLoading(true);
    refreshFromDeviceAndBackendWithOptions({ force: true })
      .then((result) => {
        if (!mounted) return;
        const registered = result.filter((contact) => contact.isRegistered && Boolean(contact.userId));
        setContacts(registered);
        setContactsError(null);
      })
      .catch((err) => {
        if (!mounted) return;
        setContacts([]);
        setContactsError(err?.message || 'Unable to load contacts.');
      })
      .finally(() => {
        if (mounted) setContactsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const analyticsSummary = useMemo(() => {
    const defaultProfileName =
      educationProfiles.find((profile) => profile.is_default)?.name ?? 'Not set';
    const courseCount = educationProfiles.reduce(
      (sum, profile) => sum + (Array.isArray(profile.courses) ? profile.courses.length : 0),
      0,
    );
    const moduleCount = educationProfiles.reduce(
      (sum, profile) => sum + (Array.isArray(profile.modules) ? profile.modules.length : 0),
      0,
    );
    const roleCount = educationProfiles.reduce(
      (sum, profile) => sum + (Array.isArray(profile.roles) ? profile.roles.length : 0),
      0,
    );
    return {
      totalProfiles: educationProfiles.length,
      defaultProfileName,
      courseCount,
      moduleCount,
      roleCount,
    };
  }, [educationProfiles]);

  const normalizedRoles = useMemo(() => buildRolePayload(activeProfile?.roles), [activeProfile]);

  const selectedContact = useMemo(
    () => contacts.find((contact) => contact.id === selectedContactId) ?? null,
    [contacts, selectedContactId],
  );

  const filteredContacts = useMemo(() => {
    const needle = contactSearchTerm.trim().toLowerCase();
    if (!needle) return contacts;
    return contacts.filter(
      (contact) =>
        contact.name?.toLowerCase().includes(needle) ||
        contact.phone?.toLowerCase().includes(needle),
    );
  }, [contacts, contactSearchTerm]);

  const cycleProfileType = useCallback(() => {
    setFormState((prev) => {
      const currentIndex = EDUCATION_PROFILE_TYPE_OPTIONS.findIndex(
        (option) => option.id === prev.profileType,
      );
      const nextIndex = (currentIndex + 1) % EDUCATION_PROFILE_TYPE_OPTIONS.length;
      return { ...prev, profileType: EDUCATION_PROFILE_TYPE_OPTIONS[nextIndex].id };
    });
  }, []);

  const resetForm = useCallback(() => {
    setFormState({
      name: '',
      description: '',
      profileType: EDUCATION_PROFILE_TYPE_OPTIONS[0].id,
    });
    setEditingProfileId(null);
  }, []);

  const handleProfileSubmit = useCallback(async () => {
    const trimmedName = formState.name.trim();
    if (!trimmedName) {
      Alert.alert('Education profile', 'Provide a name for the profile.');
      return;
    }
    setFormLoading(true);
    try {
      if (editingProfileId) {
        await updateProfile(editingProfileId, {
          name: trimmedName,
          description: formState.description.trim(),
          profile_type: formState.profileType,
        });
        Alert.alert('Education profile', 'Profile updated.');
      } else {
        const profile = await createProfile({
          name: trimmedName,
          description: formState.description.trim() || undefined,
          profile_type: formState.profileType,
          is_default: true,
        });
        if (profile?.id) {
          setEditingProfileId(profile.id);
        }
        Alert.alert('Education profile', 'Profile created.');
      }
    } catch (err: any) {
      Alert.alert('Education profile', err?.message || 'Unable to save the profile.');
    } finally {
      setFormLoading(false);
    }
  }, [formState, editingProfileId, updateProfile, createProfile]);

  const beginEditProfile = useCallback((profile: any) => {
    setEditingProfileId(profile.id);
    setFormState({
      name: profile.name ?? '',
      description: profile.description ?? '',
      profileType: profile.profile_type ?? EDUCATION_PROFILE_TYPE_OPTIONS[0].id,
    });
  }, []);

  useEffect(() => {
    if (!initialProfileId) return;
    if (initialProfileId === editingProfileId) return;
    const targetProfile = educationProfiles.find((profile) => profile.id === initialProfileId);
    if (!targetProfile) return;
    beginEditProfile(targetProfile);
  }, [initialProfileId, educationProfiles, beginEditProfile, editingProfileId]);

  const handleBroadcastProfile = useCallback(
    async (profileId: string) => {
      setProfileBroadcastingId(profileId);
      try {
        const response = await postRequest(
          ROUTES.broadcasts.educationProfileBroadcast(profileId),
          {},
          { errorMessage: 'Unable to broadcast education profile.' },
        );
        if (response?.success) {
          Alert.alert('Broadcast', 'Education profile broadcasted to the feed.');
          DeviceEventEmitter.emit('broadcast.refresh');
        } else {
          Alert.alert('Broadcast', response?.message || 'Unable to broadcast education profile.');
        }
      } catch (err: any) {
        Alert.alert('Broadcast', err?.message || 'Unable to broadcast education profile.');
      } finally {
        setProfileBroadcastingId((prev) => (prev === profileId ? null : prev));
      }
    },
    [],
  );

  const handleDeleteProfile = useCallback(
    async (profileId: string) => {
      Alert.alert('Delete profile', 'Are you sure you want to delete this education profile?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteProfile(profileId);
              if (editingProfileId === profileId) resetForm();
              Alert.alert('Education profile', 'Profile deleted.');
            } catch (err: any) {
              Alert.alert('Education profile', err?.message || 'Unable to delete the profile.');
            }
          },
        },
      ]);
    },
    [deleteProfile, editingProfileId, resetForm],
  );

  const togglePermission = useCallback((permissionId: string) => {
    setSelectedPermissionIds((prev) =>
      prev.includes(permissionId) ? prev.filter((id) => id !== permissionId) : [...prev, permissionId],
    );
  }, []);

  const handleAddRole = useCallback(async () => {
    if (!activeProfile) {
      Alert.alert('Education profile', 'Select or create a profile first.');
      return;
    }
    const trimmedName = roleName.trim();
    if (!trimmedName) {
      Alert.alert('Roles', 'Please enter a role name.');
      return;
    }
    if (selectedPermissionIds.length === 0) {
      Alert.alert('Roles', 'Select at least one permission.');
      return;
    }
    const assignments = selectedContact?.userId ? [selectedContact.userId] : [];
    const newRolesPayload = [
      ...normalizedRoles,
      { name: trimmedName, permissions: selectedPermissionIds, assignments },
    ];
    setRoleActionPending(true);
    try {
      await updateProfile(activeProfile.id, { roles: newRolesPayload });
      setRoleName('');
      setSelectedPermissionIds([]);
      setSelectedContactId(null);
      Alert.alert('Roles', 'Role created.');
    } catch (err: any) {
      Alert.alert('Roles', err?.message || 'Unable to add role.');
    } finally {
      setRoleActionPending(false);
      setSelectedRoleId((prev) => prev ?? activeProfile.roles?.[0]?.id ?? null);
    }
  }, [activeProfile, normalizedRoles, roleName, selectedContact, selectedPermissionIds, updateProfile]);

  const handleAssignMember = useCallback(async () => {
    if (!activeProfile) {
      Alert.alert('Education profile', 'Select or create a profile first.');
      return;
    }
    if (!selectedRoleId) {
      Alert.alert('Members', 'Choose a role to assign the member to.');
      return;
    }
    if (!selectedContact?.userId) {
      Alert.alert('Members', 'Pick a registered contact before assigning.');
      return;
    }
    const userId = selectedContact.userId;
    const nextRoles = normalizedRoles.map((role, index) => {
      const roleRecord = activeProfile.roles?.[index];
      if (!roleRecord || roleRecord.id !== selectedRoleId) {
        return role;
      }
      const existing = new Set(role.assignments);
      existing.add(userId);
      return { ...role, assignments: Array.from(existing) };
    });
    setRoleActionPending(true);
    try {
      await updateProfile(activeProfile.id, { roles: nextRoles });
      Alert.alert('Members', 'Member added to the role.');
      setSelectedContactId(null);
    } catch (err: any) {
      Alert.alert('Members', err?.message || 'Unable to assign member.');
    } finally {
      setRoleActionPending(false);
    }
  }, [activeProfile, normalizedRoles, selectedContact, selectedRoleId, updateProfile]);

  const handleAddCourse = useCallback(async () => {
    if (!activeProfile) {
      Alert.alert('Courses', 'Create or select a profile first.');
      return;
    }
    const title = courseTitle.trim();
    if (!title) {
      Alert.alert('Courses', 'Provide a title for the course.');
      return;
    }
    setCourseSubmitting(true);
    try {
      const courses = Array.isArray(activeProfile.courses) ? activeProfile.courses : [];
      const nextCourses = [...courses, { title, summary: courseSummary.trim() }];
      await updateProfile(activeProfile.id, { courses: nextCourses });
      setCourseTitle('');
      setCourseSummary('');
      Alert.alert('Courses', 'Course added to profile.');
    } catch (err: any) {
      Alert.alert('Courses', err?.message || 'Unable to add course.');
    } finally {
      setCourseSubmitting(false);
    }
  }, [activeProfile, courseTitle, courseSummary, updateProfile]);

  const handleAddModule = useCallback(async () => {
    if (!activeProfile) {
      Alert.alert('Modules', 'Create or select a profile first.');
      return;
    }
    const title = moduleTitle.trim();
    if (!title) {
      Alert.alert('Modules', 'Provide a title for the module.');
      return;
    }
    setModuleSubmitting(true);
    try {
      const modules = Array.isArray(activeProfile.modules) ? activeProfile.modules : [];
      const nextModules = [...modules, { title, summary: moduleSummary.trim() }];
      await updateProfile(activeProfile.id, { modules: nextModules });
      setModuleTitle('');
      setModuleSummary('');
      Alert.alert('Modules', 'Module added to profile.');
    } catch (err: any) {
      Alert.alert('Modules', err?.message || 'Unable to add module.');
    } finally {
      setModuleSubmitting(false);
    }
  }, [activeProfile, moduleTitle, moduleSummary, updateProfile]);

  useEffect(() => {
    if (!selectedRoleId && activeProfile?.roles?.length) {
      setSelectedRoleId(activeProfile.roles[0].id);
    }
  }, [activeProfile, selectedRoleId]);

  const typeLabel =
    EDUCATION_PROFILE_TYPE_OPTIONS.find((item) => item.id === formState.profileType)?.label ?? '';

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
      <View
        style={{
          borderWidth: 2,
          borderColor: palette.divider,
          borderRadius: 18,
          padding: 14,
          backgroundColor: palette.surface,
          gap: 10,
        }}
      >
        <Text style={{ fontSize: 18, fontWeight: '800', color: palette.text }}>Education profile builder</Text>
        <Text style={{ color: palette.subtext, fontSize: 13 }}>
          Create and manage your education offerings, invite collaborators, and broadcast the entire profile when
          everything is ready.
        </Text>
        <KISTextInput
          label="Profile name"
          value={formState.name}
          onChangeText={(value) => setFormState((prev) => ({ ...prev, name: value }))}
        />
        <KISTextInput
          label="Description"
          value={formState.description}
          onChangeText={(value) => setFormState((prev) => ({ ...prev, description: value }))}
          multiline
          style={{ minHeight: 60 }}
        />
        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          <KISButton title={`Type: ${typeLabel}`} variant="outline" size="xs" onPress={cycleProfileType} />
          <KISButton
            title={editingProfileId ? 'Update profile' : 'Create profile'}
            onPress={handleProfileSubmit}
            disabled={formLoading}
          />
          {editingProfileId ? (
            <KISButton title="Cancel" variant="outline" size="xs" onPress={resetForm} disabled={formLoading} />
          ) : null}
        </View>
      </View>

      <View
        style={{
          borderWidth: 2,
          borderColor: palette.divider,
          borderRadius: 18,
          padding: 14,
          backgroundColor: palette.surface,
          gap: 8,
        }}
      >
        <Text style={{ fontSize: 17, fontWeight: '700', color: palette.text }}>Analytics</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ color: palette.subtext }}>Profiles</Text>
          <Text style={{ color: palette.text }}>{analyticsSummary.totalProfiles}</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ color: palette.subtext }}>Courses</Text>
          <Text style={{ color: palette.text }}>{analyticsSummary.courseCount}</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ color: palette.subtext }}>Modules</Text>
          <Text style={{ color: palette.text }}>{analyticsSummary.moduleCount}</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ color: palette.subtext }}>Roles</Text>
          <Text style={{ color: palette.text }}>{analyticsSummary.roleCount}</Text>
        </View>
        <Text style={{ color: palette.subtext, fontSize: 12 }}>
          Default profile: {analyticsSummary.defaultProfileName}
        </Text>
      </View>

      {activeProfile ? (
        <View
          style={{
            borderWidth: 2,
            borderColor: palette.divider,
            borderRadius: 18,
            padding: 14,
            backgroundColor: palette.surface,
            gap: 8,
          }}
        >
          <Text style={{ fontSize: 17, fontWeight: '700', color: palette.text }}>
            {activeProfile.name} details
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: palette.subtext }}>Courses</Text>
            <Text style={{ color: palette.text }}>{activeProfile.courses?.length ?? 0}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: palette.subtext }}>Modules</Text>
            <Text style={{ color: palette.text }}>{activeProfile.modules?.length ?? 0}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: palette.subtext }}>Roles</Text>
            <Text style={{ color: palette.text }}>{activeProfile.roles?.length ?? 0}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
            <KISButton
              size="xs"
              title="View analytics"
              onPress={() => Alert.alert('Analytics', 'Federated analytics coming soon.')}
            />
            <KISButton
              size="xs"
              variant="outline"
              title="Edit items"
              onPress={() => Alert.alert('Education profile', 'Use the add commands below')}
            />
          </View>
          <View
            style={{
              borderWidth: 1,
              borderColor: palette.divider,
              borderRadius: 16,
              padding: 10,
              backgroundColor: palette.card,
              gap: 8,
            }}
          >
            <Text style={{ color: palette.text, fontWeight: '600' }}>Add course</Text>
            <KISTextInput label="Title" value={courseTitle} onChangeText={setCourseTitle} />
            <KISTextInput
              label="Summary"
              value={courseSummary}
              onChangeText={setCourseSummary}
              multiline
              style={{ minHeight: 60 }}
            />
            <KISButton
              title={courseSubmitting ? 'Saving…' : 'Add course'}
              onPress={handleAddCourse}
              disabled={courseSubmitting}
            />
          </View>
          <View
            style={{
              borderWidth: 1,
              borderColor: palette.divider,
              borderRadius: 16,
              padding: 10,
              backgroundColor: palette.card,
              gap: 8,
            }}
          >
            <Text style={{ color: palette.text, fontWeight: '600' }}>Add module</Text>
            <KISTextInput label="Title" value={moduleTitle} onChangeText={setModuleTitle} />
            <KISTextInput
              label="Summary"
              value={moduleSummary}
              onChangeText={setModuleSummary}
              multiline
              style={{ minHeight: 60 }}
            />
            <KISButton
              title={moduleSubmitting ? 'Saving…' : 'Add module'}
              onPress={handleAddModule}
              disabled={moduleSubmitting}
            />
          </View>
        </View>
      ) : null}

      <View
        style={{
          borderWidth: 2,
          borderColor: palette.divider,
          borderRadius: 18,
          padding: 14,
          backgroundColor: palette.surface,
          gap: 8,
        }}
      >
        <Text style={{ fontSize: 17, fontWeight: '700', color: palette.text }}>Members & admin roles</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {normalizedRoles.map((role) => (
            <KISButton
              key={role.id}
              size="xs"
              variant={selectedRoleId === role.id ? 'primary' : 'outline'}
              title={`${role.name} (${role.assignments?.length ?? 0})`}
              onPress={() => setSelectedRoleId(role.id)}
            />
          ))}
        </View>
        <KISTextInput label="Role name" value={roleName} onChangeText={setRoleName} />
        <Text style={{ color: palette.subtext, fontSize: 12 }}>Permissions</Text>
        {permissionsLoading ? (
          <ActivityIndicator color={palette.primaryStrong} />
        ) : permissionsError ? (
          <Text style={{ color: palette.danger }}>{permissionsError}</Text>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {permissions.map((permission) => {
              const selected = selectedPermissionIds.includes(permission.id);
              return (
                <Pressable
                  key={permission.id}
                  onPress={() => togglePermission(permission.id)}
                  style={{
                    borderWidth: 1,
                    borderColor: selected ? palette.primaryStrong : palette.divider,
                    borderRadius: 14,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    backgroundColor: selected ? palette.primarySoft : palette.surface,
                  }}
                >
                  <Text style={{ color: selected ? palette.primaryStrong : palette.text }}>
                    {permission.label}
                  </Text>
                  {permission.description ? (
                    <Text style={{ fontSize: 10, color: palette.subtext }}>{permission.description}</Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        )}

        <View
          style={{
            borderWidth: 1,
            borderColor: palette.divider,
            borderRadius: 16,
            padding: 10,
            backgroundColor: palette.card,
            gap: 6,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Text style={{ color: palette.text }}>Select member (contacts only)</Text>
            <KISButton
              title={showContactPicker ? 'Hide list' : 'Show contacts'}
              size="xs"
              variant="outline"
              onPress={() => setShowContactPicker((prev) => !prev)}
            />
          </View>
          <KISTextInput
            label="Search contacts"
            value={contactSearchTerm}
            onChangeText={setContactSearchTerm}
            placeholder="Filter by name or number"
          />
          {selectedContact ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: palette.text }}>
                Selected: {selectedContact.name} ({selectedContact.phone})
              </Text>
              <KISButton size="xs" variant="outline" title="Clear" onPress={() => setSelectedContactId(null)} />
            </View>
          ) : (
            <Text style={{ color: palette.subtext, fontSize: 12 }}>{EMPTY_CONTACT_NOTE}</Text>
          )}
          {contactsError ? (
            <Text style={{ color: palette.danger, fontSize: 12 }}>{contactsError}</Text>
          ) : null}
          {showContactPicker && (
            <View style={{ maxHeight: 180 }}>
              {contactsLoading ? (
                <ActivityIndicator color={palette.primaryStrong} />
              ) : filteredContacts.length === 0 ? (
                <Text style={{ color: palette.subtext, fontSize: 12 }}>No registered contacts found.</Text>
              ) : (
                <ScrollView>
                  {filteredContacts.map((contact) => (
                    <Pressable
                      key={contact.id}
                      onPress={() => {
                        setSelectedContactId(contact.id);
                        setShowContactPicker(false);
                      }}
                      style={{
                        paddingVertical: 8,
                        borderBottomWidth: 1,
                        borderBottomColor: palette.divider,
                      }}
                    >
                      <Text style={{ color: palette.text, fontWeight: '700' }}>{contact.name}</Text>
                      <Text style={{ color: palette.subtext, fontSize: 12 }}>{contact.phone}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}
            </View>
          )}
        </View>

        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          <KISButton title="Create role" onPress={handleAddRole} disabled={roleActionPending} />
          <KISButton
            title="Add member"
            variant="outline"
            onPress={handleAssignMember}
            disabled={roleActionPending || !selectedContact?.userId}
          />
        </View>
      </View>

      <View
        style={{
          borderWidth: 2,
          borderColor: palette.divider,
          borderRadius: 18,
          padding: 14,
          backgroundColor: palette.surface,
          gap: 10,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 17, fontWeight: '700', color: palette.text }}>Your education profiles</Text>
          <KISButton size="xs" variant="outline" title="Open tab" onPress={() => navigation.navigate('Broadcast', { focusTab: 'education' })} />
        </View>
        {loading ? (
          <ActivityIndicator color={palette.primaryStrong} />
        ) : error ? (
          <Text style={{ color: palette.danger, fontSize: 12 }}>{error}</Text>
        ) : null}
        {educationProfiles.length === 0 ? (
          <Text style={{ color: palette.subtext, fontSize: 12 }}>Create a profile to begin broadcasting.</Text>
        ) : (
          educationProfiles.map((profile) => {
            const isBroadcasting = profileBroadcastingId === profile.id;
            const roleCount = Array.isArray(profile.roles) ? profile.roles.length : 0;
            return (
              <View
                key={profile.id}
                style={{
                  borderWidth: 1,
                  borderColor: palette.divider,
                  borderRadius: 16,
                  padding: 12,
                  backgroundColor: palette.card,
                  gap: 6,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: palette.text }}>{profile.name}</Text>
                  {profile.is_default ? (
                    <Text style={{ color: palette.primaryStrong, fontSize: 12 }}>Default</Text>
                  ) : null}
                </View>
                <Text style={{ color: palette.subtext, fontSize: 12 }}>{profile.description ?? 'No description'}</Text>
                <Text style={{ color: palette.subtext, fontSize: 12 }}>
                  {profile.profile_type} · {profile.courses?.length ?? 0} courses · {profile.modules?.length ?? 0} modules ·{' '}
                  {roleCount} roles
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  <KISButton size="xs" title="Open" onPress={() => beginEditProfile(profile)} />
                  <KISButton size="xs" variant="outline" title="Edit" onPress={() => beginEditProfile(profile)} />
                  <KISButton size="xs" variant="outline" title="Delete" onPress={() => handleDeleteProfile(profile.id)} />
                  <KISButton
                    size="xs"
                    title={isBroadcasting ? 'Broadcasting…' : 'Broadcast'}
                    onPress={() => handleBroadcastProfile(profile.id)}
                    disabled={isBroadcasting}
                  />
                </View>
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}
