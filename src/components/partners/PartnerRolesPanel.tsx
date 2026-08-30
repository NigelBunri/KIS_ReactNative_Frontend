// src/components/partners/PartnerRolesPanel.tsx
//
// Custom role CRUD + assignment — PartnerRole/PartnerRoleAssignment already
// existed fully on the backend (create/list/assign/remove, plus the new
// role_detail PATCH/DELETE added alongside this screen) with zero RN
// consumer before this.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import styles from '@/components/partners/partnersStyles';
import { useKISTheme } from '@/theme/useTheme';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { patchRequest } from '@/network/patch';
import { deleteRequest } from '@/network/delete';

type Props = {
  isOpen: boolean;
  panelWidth: number;
  panelTranslateX: Animated.Value;
  partnerId?: string | null;
  onClose: () => void;
};

type PartnerRole = {
  id: string | number;
  name: string;
  description?: string;
  permissions: string[];
  is_default?: boolean;
};

// Governance codenames (apps/partners/services.py's ensure_default_partner_roles)
// plus the channel-scoped codes (PartnerChannelPermissionOverwrite.PermissionCode).
// No server-side catalog endpoint exists for this yet — kept here as the one
// place the full assignable list is defined client-side.
const PERMISSION_CATALOG: { group: string; keys: string[] }[] = [
  {
    group: 'Organization',
    keys: [
      'partner.settings.manage',
      'partner.roles.manage',
      'partner.roles.view',
      'partner.audit.view',
      'partner.policy.edit',
    ],
  },
  {
    group: 'Integrations & Automation',
    keys: ['partner.integrations.manage', 'partner.integrations.view', 'partner.automation.manage', 'partner.webhooks.manage'],
  },
  {
    group: 'Reports & Access',
    keys: ['partner.reports.view', 'partner.exports.manage', 'partner.access.manage', 'partner.access.view'],
  },
  {
    group: 'Channels',
    keys: [
      'view_channel',
      'send_messages',
      'manage_channel',
      'manage_categories',
      'manage_roles',
      'kick_members',
      'ban_members',
      'manage_webhooks',
      'mention_everyone',
    ],
  },
];

export default function PartnerRolesPanel({ isOpen, panelWidth, panelTranslateX, partnerId, onClose }: Props) {
  const { palette } = useKISTheme();
  const [loading, setLoading] = useState(false);
  const [roles, setRoles] = useState<PartnerRole[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPermissions, setNewPermissions] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [assignUserId, setAssignUserId] = useState('');
  const [assignRoleId, setAssignRoleId] = useState<string | number | null>(null);

  const backdropOpacity = panelTranslateX.interpolate({
    inputRange: [0, panelWidth],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const load = useCallback(async () => {
    if (!partnerId) return;
    const res = await getRequest(ROUTES.partners.roles(partnerId), { errorMessage: 'Unable to load roles.' });
    const list = (res?.data ?? res ?? []) as PartnerRole[];
    setRoles(Array.isArray(list) ? list : []);
  }, [partnerId]);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [isOpen, load]);

  const togglePermission = (key: string) => {
    setNewPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const createRole = async () => {
    if (!partnerId || !newName.trim()) {
      Alert.alert('Missing info', 'Role name is required.');
      return;
    }
    setCreating(true);
    const res = await postRequest(
      ROUTES.partners.roles(partnerId),
      { name: newName.trim(), permissions: Array.from(newPermissions) },
      { errorMessage: 'Unable to create role.' },
    );
    setCreating(false);
    if (!res?.success) {
      Alert.alert('Failed', res?.message ?? 'Unable to create role.');
      return;
    }
    setNewName('');
    setNewPermissions(new Set());
    load();
  };

  const togglePermissionOnRole = async (role: PartnerRole, key: string) => {
    const has = role.permissions.includes(key);
    const nextPermissions = has ? role.permissions.filter((p) => p !== key) : [...role.permissions, key];
    setRoles((prev) => prev.map((r) => (r.id === role.id ? { ...r, permissions: nextPermissions } : r)));
    if (!partnerId) return;
    const res = await patchRequest(
      ROUTES.partners.roleDetail(partnerId, String(role.id)),
      { permissions: nextPermissions },
      { errorMessage: 'Unable to update role.' },
    );
    if (!res?.success) {
      Alert.alert('Failed', res?.message ?? 'Unable to update role.');
      load();
    }
  };

  const deleteRole = (role: PartnerRole) => {
    if (!partnerId) return;
    Alert.alert('Delete role?', `"${role.name}" will be permanently removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const res = await deleteRequest(ROUTES.partners.roleDetail(partnerId, String(role.id)), {
            errorMessage: 'Unable to delete role.',
          });
          if (!res?.success) {
            Alert.alert('Failed', res?.message ?? 'Unassign this role from all members first.');
            return;
          }
          load();
        },
      },
    ]);
  };

  const assignRole = async () => {
    if (!partnerId || !assignRoleId || !assignUserId.trim()) {
      Alert.alert('Missing info', 'Pick a role and enter a user id.');
      return;
    }
    const res = await postRequest(
      ROUTES.partners.roleAssignments(partnerId),
      { role: assignRoleId, user: assignUserId.trim(), scope_type: 'global' },
      { errorMessage: 'Unable to assign role.' },
    );
    if (!res?.success) {
      Alert.alert('Failed', res?.message ?? 'Unable to assign role.');
      return;
    }
    setAssignUserId('');
    Alert.alert('Assigned', 'Role assigned.');
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
          {
            width: panelWidth,
            backgroundColor: palette.surfaceElevated,
            borderLeftColor: palette.divider,
            transform: [{ translateX: panelTranslateX }],
          },
        ]}
      >
        <View style={[styles.settingsPanelHeader, { borderBottomColor: palette.divider }]}>
          <Pressable onPress={onClose} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            <Text style={{ color: palette.text, fontSize: 18 }}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingsPanelTitle, { color: palette.text }]}>Roles & Permissions</Text>
            <Text style={[styles.settingsPanelDescription, { color: palette.subtext }]}>
              Create custom roles and control exactly what each one can do.
            </Text>
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.settingsPanelBody} showsVerticalScrollIndicator={false}>
          {loading ? (
            <ActivityIndicator size="small" color={palette.primary} />
          ) : (
            <>
              <Text style={[styles.settingsSectionTitle, { color: palette.text }]}>New role</Text>
              <TextInput
                value={newName}
                onChangeText={setNewName}
                placeholder="Role name"
                placeholderTextColor={palette.subtext}
                style={{
                  borderWidth: 1,
                  borderColor: palette.borderMuted,
                  borderRadius: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  color: palette.text,
                  marginBottom: 8,
                }}
              />
              {PERMISSION_CATALOG.map((group) => (
                <View key={group.group} style={{ marginBottom: 6 }}>
                  <Text style={{ color: palette.subtext, fontSize: 11, fontWeight: '600', marginBottom: 4 }}>
                    {group.group.toUpperCase()}
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {group.keys.map((key) => {
                      const selected = newPermissions.has(key);
                      return (
                        <Pressable
                          key={key}
                          onPress={() => togglePermission(key)}
                          style={{
                            paddingVertical: 5,
                            paddingHorizontal: 9,
                            borderRadius: 8,
                            borderWidth: 1,
                            borderColor: selected ? palette.primary : palette.borderMuted,
                            backgroundColor: selected ? palette.primary + '22' : 'transparent',
                          }}
                        >
                          <Text style={{ color: selected ? palette.primary : palette.subtext, fontSize: 11 }}>{key}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}
              <Pressable
                onPress={createRole}
                disabled={creating}
                style={({ pressed }) => [
                  {
                    marginTop: 10,
                    paddingVertical: 10,
                    borderRadius: 10,
                    backgroundColor: palette.primary,
                    alignItems: 'center',
                    opacity: pressed || creating ? 0.7 : 1,
                  },
                ]}
              >
                <Text style={{ color: palette.onPrimary ?? '#fff', fontWeight: '600' }}>
                  {creating ? 'Creating…' : 'Create role'}
                </Text>
              </Pressable>

              <Text style={[styles.settingsSectionTitle, { color: palette.text, marginTop: 20 }]}>Assign a role</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {roles.map((role) => (
                  <Pressable
                    key={role.id}
                    onPress={() => setAssignRoleId(role.id)}
                    style={{
                      paddingVertical: 5,
                      paddingHorizontal: 9,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: assignRoleId === role.id ? palette.primary : palette.borderMuted,
                    }}
                  >
                    <Text style={{ color: assignRoleId === role.id ? palette.primary : palette.text, fontSize: 12 }}>
                      {role.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                value={assignUserId}
                onChangeText={setAssignUserId}
                placeholder="User ID to assign this role to"
                placeholderTextColor={palette.subtext}
                style={{
                  borderWidth: 1,
                  borderColor: palette.borderMuted,
                  borderRadius: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  color: palette.text,
                  marginBottom: 8,
                }}
              />
              <Pressable
                onPress={assignRole}
                style={({ pressed }) => [
                  {
                    paddingVertical: 8,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: palette.borderMuted,
                    alignItems: 'center',
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Text style={{ color: palette.text, fontWeight: '600' }}>Assign</Text>
              </Pressable>

              <Text style={[styles.settingsSectionTitle, { color: palette.text, marginTop: 20 }]}>Existing roles</Text>
              {roles.map((role) => (
                <View
                  key={role.id}
                  style={[styles.settingsFeatureRow, { borderColor: palette.borderMuted, backgroundColor: palette.surface }]}
                >
                  <Text style={[styles.settingsFeatureTitle, { color: palette.text }]}>{role.name}</Text>
                  <Text style={[styles.settingsFeatureDescription, { color: palette.subtext, marginTop: 2 }]}>
                    {role.permissions.length} permission{role.permissions.length === 1 ? '' : 's'}
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {editingId === role.id
                      ? PERMISSION_CATALOG.flatMap((g) => g.keys).map((key) => {
                          const selected = role.permissions.includes(key);
                          return (
                            <Pressable
                              key={key}
                              onPress={() => togglePermissionOnRole(role, key)}
                              style={{
                                paddingVertical: 4,
                                paddingHorizontal: 8,
                                borderRadius: 8,
                                borderWidth: 1,
                                borderColor: selected ? palette.primary : palette.borderMuted,
                              }}
                            >
                              <Text style={{ color: selected ? palette.primary : palette.subtext, fontSize: 10 }}>{key}</Text>
                            </Pressable>
                          );
                        })
                      : null}
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                    <Pressable
                      onPress={() => setEditingId(editingId === role.id ? null : role.id)}
                      style={({ pressed }) => [
                        { paddingVertical: 5, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: palette.borderMuted, opacity: pressed ? 0.7 : 1 },
                      ]}
                    >
                      <Text style={{ color: palette.text, fontSize: 12 }}>{editingId === role.id ? 'Done' : 'Edit permissions'}</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => deleteRole(role)}
                      style={({ pressed }) => [
                        { paddingVertical: 5, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: palette.danger, opacity: pressed ? 0.7 : 1 },
                      ]}
                    >
                      <Text style={{ color: palette.danger, fontSize: 12 }}>Delete</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}
