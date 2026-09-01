// src/components/partners/PartnerOrgStructurePanel.tsx
//
// Org Setup > Departments & Units + Locations & Branches. Two related,
// small CRUD resources sharing one panel with a tab switcher, matching
// PartnerMembersPanel's members/log tab pattern.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import styles from '@/components/partners/partnersStyles';
import { useKISTheme } from '@/theme/useTheme';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { patchRequest } from '@/network/patch';

type Props = {
  isOpen: boolean;
  panelWidth: number;
  panelTranslateX: Animated.Value;
  partnerId?: string | null;
  onClose: () => void;
};

type Department = {
  id: string | number;
  name: string;
  description?: string;
  lead?: string | null;
  lead_name?: string | null;
  member_count: number;
};
type Location = {
  id: string | number;
  name: string;
  address?: string;
  city?: string;
  country?: string;
  phone?: string;
  notes?: string;
  is_primary: boolean;
};
type MemberOption = { user_id: string; display_name?: string | null; username?: string | null };

const inputStyle = (palette: any) => ({
  color: palette.text,
  borderColor: palette.borderMuted,
  borderWidth: 2,
  paddingHorizontal: 10,
  paddingVertical: 8,
  borderRadius: 10,
  marginTop: 8,
});

export default function PartnerOrgStructurePanel({ isOpen, panelWidth, panelTranslateX, partnerId, onClose }: Props) {
  const { palette } = useKISTheme();
  const [tab, setTab] = useState<'departments' | 'locations'>('departments');
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [saving, setSaving] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [depName, setDepName] = useState('');
  const [depDescription, setDepDescription] = useState('');
  const [depMemberIds, setDepMemberIds] = useState<string[]>([]);
  const [locName, setLocName] = useState('');
  const [locCity, setLocCity] = useState('');
  const [locCountry, setLocCountry] = useState('');
  const [locAddress, setLocAddress] = useState('');
  const [locPhone, setLocPhone] = useState('');

  const backdropOpacity = panelTranslateX.interpolate({ inputRange: [0, panelWidth], outputRange: [1, 0], extrapolate: 'clamp' });

  const load = useCallback(async () => {
    if (!partnerId) return;
    const [depRes, locRes, memberRes] = await Promise.all([
      getRequest(ROUTES.partners.departments(partnerId), { errorMessage: 'Unable to load departments.' }),
      getRequest(ROUTES.partners.locations(partnerId), { errorMessage: 'Unable to load locations.' }),
      getRequest(`${ROUTES.partners.members(partnerId)}?page=1`, { errorMessage: 'Unable to load members.' }),
    ]);
    const depList = (depRes?.data ?? depRes ?? []) as Department[];
    setDepartments(Array.isArray(depList) ? depList : []);
    const locList = (locRes?.data ?? locRes ?? []) as Location[];
    setLocations(Array.isArray(locList) ? locList : []);
    const memberPayload = memberRes?.data ?? memberRes ?? {};
    const memberList = (memberPayload.results ?? memberPayload.members ?? []) as MemberOption[];
    setMembers(Array.isArray(memberList) ? memberList : []);
  }, [partnerId]);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [isOpen, load]);

  const memberName = (m: MemberOption) => m.display_name || m.username || 'Member';

  const toggleDepMember = (id: string) => {
    setDepMemberIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const createDepartment = async () => {
    if (!partnerId || !depName.trim()) {
      Alert.alert('Missing info', 'Department name is required.');
      return;
    }
    setSaving(true);
    const res = await postRequest(
      ROUTES.partners.departments(partnerId),
      { name: depName.trim(), description: depDescription.trim(), member_ids: depMemberIds },
      { errorMessage: 'Unable to create department.' },
    );
    setSaving(false);
    if (!res?.success) {
      Alert.alert('Failed', res?.message ?? 'Unable to create department.');
      return;
    }
    setDepName('');
    setDepDescription('');
    setDepMemberIds([]);
    setShowCreate(false);
    load();
  };

  const deleteDepartment = (department: Department) => {
    if (!partnerId) return;
    Alert.alert('Delete department?', `"${department.name}" will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { deleteRequest } = await import('@/network/delete');
          const res = await deleteRequest(ROUTES.partners.departmentDetail(partnerId, String(department.id)), {
            errorMessage: 'Unable to delete department.',
          });
          if (!res?.success) {
            Alert.alert('Failed', res?.message ?? 'Unable to delete department.');
            return;
          }
          load();
        },
      },
    ]);
  };

  const createLocation = async () => {
    if (!partnerId || !locName.trim()) {
      Alert.alert('Missing info', 'Location name is required.');
      return;
    }
    setSaving(true);
    const res = await postRequest(
      ROUTES.partners.locations(partnerId),
      { name: locName.trim(), city: locCity.trim(), country: locCountry.trim(), address: locAddress.trim(), phone: locPhone.trim() },
      { errorMessage: 'Unable to create location.' },
    );
    setSaving(false);
    if (!res?.success) {
      Alert.alert('Failed', res?.message ?? 'Unable to create location.');
      return;
    }
    setLocName('');
    setLocCity('');
    setLocCountry('');
    setLocAddress('');
    setLocPhone('');
    setShowCreate(false);
    load();
  };

  const setPrimaryLocation = async (location: Location) => {
    if (!partnerId) return;
    const res = await patchRequest(
      ROUTES.partners.locationDetail(partnerId, String(location.id)),
      { is_primary: true },
      { errorMessage: 'Unable to update location.' },
    );
    if (!res?.success) {
      Alert.alert('Failed', res?.message ?? 'Unable to update location.');
      return;
    }
    load();
  };

  const deleteLocation = (location: Location) => {
    if (!partnerId) return;
    Alert.alert('Delete location?', `"${location.name}" will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { deleteRequest } = await import('@/network/delete');
          const res = await deleteRequest(ROUTES.partners.locationDetail(partnerId, String(location.id)), {
            errorMessage: 'Unable to delete location.',
          });
          if (!res?.success) {
            Alert.alert('Failed', res?.message ?? 'Unable to delete location.');
            return;
          }
          load();
        },
      },
    ]);
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
          <Pressable onPress={onClose} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            <Text style={{ color: palette.text, fontSize: 18 }}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingsPanelTitle, { color: palette.text }]}>Organization Setup</Text>
            <Text style={[styles.settingsPanelDescription, { color: palette.subtext }]}>Departments and locations</Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 10, paddingTop: 10 }}>
          {(['departments', 'locations'] as const).map((t) => (
            <Pressable
              key={t}
              onPress={() => { setTab(t); setShowCreate(false); }}
              style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: tab === t ? palette.primary : palette.borderMuted }}
            >
              <Text style={{ color: tab === t ? palette.primary : palette.text, fontSize: 13, fontWeight: '600' }}>
                {t === 'departments' ? 'Departments' : 'Locations'}
              </Text>
            </Pressable>
          ))}
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.settingsPanelBody} showsVerticalScrollIndicator={false}>
          {loading ? (
            <ActivityIndicator size="small" color={palette.primary} />
          ) : tab === 'departments' ? (
            <>
              <Pressable onPress={() => setShowCreate((v) => !v)}>
                <Text style={{ color: palette.primary, fontSize: 13, fontWeight: '700', marginBottom: showCreate ? 8 : 12 }}>
                  {showCreate ? '− Cancel new department' : '+ New department'}
                </Text>
              </Pressable>
              {showCreate ? (
                <View style={{ marginBottom: 16 }}>
                  <TextInput value={depName} onChangeText={setDepName} placeholder="Department name" placeholderTextColor={palette.subtext} style={[inputStyle(palette), { marginTop: 0 }]} />
                  <TextInput value={depDescription} onChangeText={setDepDescription} placeholder="Description (optional)" placeholderTextColor={palette.subtext} multiline style={[inputStyle(palette), { minHeight: 50, textAlignVertical: 'top' }]} />
                  <Text style={{ color: palette.subtext, fontSize: 11, marginTop: 10, marginBottom: 4 }}>Members</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                    {members.map((m) => {
                      const selected = depMemberIds.includes(m.user_id);
                      return (
                        <Pressable
                          key={m.user_id}
                          onPress={() => toggleDepMember(m.user_id)}
                          style={{ paddingVertical: 5, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: selected ? palette.primary : palette.borderMuted }}
                        >
                          <Text style={{ color: selected ? palette.primary : palette.text, fontSize: 12 }}>{memberName(m)}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <Pressable
                    onPress={createDepartment}
                    disabled={saving}
                    style={({ pressed }) => [{ paddingVertical: 10, borderRadius: 10, backgroundColor: palette.royalInk, alignItems: 'center', opacity: pressed || saving ? 0.7 : 1 }]}
                  >
                    <Text style={{ color: palette.ivory, fontWeight: '700' }}>{saving ? 'Creating…' : 'Create department'}</Text>
                  </Pressable>
                </View>
              ) : null}

              {departments.length === 0 ? (
                <Text style={{ color: palette.subtext, fontSize: 13, textAlign: 'center', marginTop: 20 }}>No departments yet.</Text>
              ) : (
                departments.map((dep) => (
                  <View key={dep.id} style={[styles.settingsFeatureRow, { borderColor: palette.borderMuted, backgroundColor: palette.surface, marginBottom: 8 }]}>
                    <Text style={[styles.settingsFeatureTitle, { color: palette.text }]}>{dep.name}</Text>
                    {dep.description ? <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 2 }}>{dep.description}</Text> : null}
                    <Text style={{ color: palette.subtext, fontSize: 11, marginTop: 4 }}>
                      {dep.member_count} member{dep.member_count === 1 ? '' : 's'}{dep.lead_name ? ` · Lead: ${dep.lead_name}` : ''}
                    </Text>
                    <Pressable onPress={() => deleteDepartment(dep)} style={{ marginTop: 6 }}>
                      <Text style={{ color: palette.danger, fontSize: 12, fontWeight: '700' }}>Delete</Text>
                    </Pressable>
                  </View>
                ))
              )}
            </>
          ) : (
            <>
              <Pressable onPress={() => setShowCreate((v) => !v)}>
                <Text style={{ color: palette.primary, fontSize: 13, fontWeight: '700', marginBottom: showCreate ? 8 : 12 }}>
                  {showCreate ? '− Cancel new location' : '+ New location'}
                </Text>
              </Pressable>
              {showCreate ? (
                <View style={{ marginBottom: 16 }}>
                  <TextInput value={locName} onChangeText={setLocName} placeholder="Location name" placeholderTextColor={palette.subtext} style={[inputStyle(palette), { marginTop: 0 }]} />
                  <TextInput value={locAddress} onChangeText={setLocAddress} placeholder="Address" placeholderTextColor={palette.subtext} style={inputStyle(palette)} />
                  <TextInput value={locCity} onChangeText={setLocCity} placeholder="City" placeholderTextColor={palette.subtext} style={inputStyle(palette)} />
                  <TextInput value={locCountry} onChangeText={setLocCountry} placeholder="Country" placeholderTextColor={palette.subtext} style={inputStyle(palette)} />
                  <TextInput value={locPhone} onChangeText={setLocPhone} placeholder="Phone (optional)" placeholderTextColor={palette.subtext} style={inputStyle(palette)} keyboardType="phone-pad" />
                  <Pressable
                    onPress={createLocation}
                    disabled={saving}
                    style={({ pressed }) => [{ marginTop: 10, paddingVertical: 10, borderRadius: 10, backgroundColor: palette.royalInk, alignItems: 'center', opacity: pressed || saving ? 0.7 : 1 }]}
                  >
                    <Text style={{ color: palette.ivory, fontWeight: '700' }}>{saving ? 'Creating…' : 'Create location'}</Text>
                  </Pressable>
                </View>
              ) : null}

              {locations.length === 0 ? (
                <Text style={{ color: palette.subtext, fontSize: 13, textAlign: 'center', marginTop: 20 }}>No locations yet.</Text>
              ) : (
                locations.map((loc) => (
                  <View key={loc.id} style={[styles.settingsFeatureRow, { borderColor: loc.is_primary ? palette.primary : palette.borderMuted, backgroundColor: palette.surface, marginBottom: 8 }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={[styles.settingsFeatureTitle, { color: palette.text }]}>{loc.name}</Text>
                      {loc.is_primary ? <Text style={{ color: palette.primary, fontSize: 10, fontWeight: '700' }}>PRIMARY</Text> : null}
                    </View>
                    <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 2 }}>
                      {[loc.address, loc.city, loc.country].filter(Boolean).join(', ') || 'No address on file'}
                    </Text>
                    {loc.phone ? <Text style={{ color: palette.subtext, fontSize: 11, marginTop: 2 }}>{loc.phone}</Text> : null}
                    <View style={{ flexDirection: 'row', gap: 12, marginTop: 6 }}>
                      {!loc.is_primary ? (
                        <Pressable onPress={() => setPrimaryLocation(loc)}>
                          <Text style={{ color: palette.primary, fontSize: 12, fontWeight: '700' }}>Make primary</Text>
                        </Pressable>
                      ) : null}
                      <Pressable onPress={() => deleteLocation(loc)}>
                        <Text style={{ color: palette.danger, fontSize: 12, fontWeight: '700' }}>Delete</Text>
                      </Pressable>
                    </View>
                  </View>
                ))
              )}
            </>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}
