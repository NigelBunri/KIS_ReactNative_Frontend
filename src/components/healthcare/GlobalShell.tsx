import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View, Pressable } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';

type OrganizationOption = {
  id: string;
  name: string;
  org_type: string;
  profiles: { id: string; name: string; profile_type: string; status: string }[];
  locations: { id: string; label: string; timezone: string; is_primary: boolean }[];
};

type GlobalShellProps = {
  organizations: OrganizationOption[];
  activeProfileId: string | null;
  activeOrganizationId: string | null;
  onSelectProfile: (profileId: string) => void;
  emergencyMode: boolean;
  onToggleEmergency: () => void;
  searchTerm: string;
  onChangeSearch: (value: string) => void;
  onSubmitSearch: () => void;
};

export default function GlobalShell({
  organizations,
  activeProfileId,
  activeOrganizationId: _activeOrganizationId,
  onSelectProfile,
  emergencyMode,
  onToggleEmergency,
  searchTerm,
  onChangeSearch,
  onSubmitSearch,
}: GlobalShellProps) {
  const { palette } = useKISTheme();
  const [pickerOpen, setPickerOpen] = useState(false);

  const profiles = useMemo(
    () =>
      organizations.flatMap((org) =>
        org.profiles.map((profile) => ({
          ...profile,
          orgName: org.name,
          orgId: org.id,
        })),
      ),
    [organizations],
  );

  const activeProfile = profiles.find((profile) => profile.id === activeProfileId);

  return (
    <View style={[styles.shell, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
      <View style={styles.row}>
        <View style={[styles.profilePicker, { borderColor: palette.divider }]}>
          <Pressable
            onPress={() => setPickerOpen((prev) => !prev)}
            style={styles.profilePickerButton}
          >
            <Text style={[styles.label, { color: palette.text }]}>
              {activeProfile ? `${activeProfile.name} (${activeProfile.orgName})` : 'Select profile'}
            </Text>
            <KISIcon name="chevronDown" size={16} color={palette.subtext} />
          </Pressable>
          {pickerOpen && (
            <View style={[styles.pickerList, { borderColor: palette.divider, backgroundColor: palette.card }]}>
              <ScrollView style={{ maxHeight: 220 }}>
                {profiles.map((profile) => (
                  <Pressable
                    key={profile.id}
                    onPress={() => {
                      onSelectProfile(profile.id);
                      setPickerOpen(false);
                    }}
                    style={[
                      styles.pickerItem,
                      { backgroundColor: profile.id === activeProfileId ? palette.primarySoft : 'transparent' },
                    ]}
                  >
                    <Text style={{ color: palette.text, fontWeight: '700' }}>{profile.name}</Text>
                    <Text style={{ color: palette.subtext, fontSize: 12 }}>
                      {profile.profile_type} · {profile.orgName}
                    </Text>
                  </Pressable>
                ))}
                {profiles.length === 0 && (
                  <Text style={{ color: palette.subtext, padding: 12 }}>No profiles yet.</Text>
                )}
              </ScrollView>
            </View>
          )}
        </View>
        <Pressable
          onPress={onToggleEmergency}
          style={[styles.emergencyToggle, { borderColor: palette.divider }]}
        >
          <KISIcon
            name="bolt"
            size={16}
            color={emergencyMode ? palette.danger : palette.primaryStrong}
          />
          <Text
            style={{
              color: emergencyMode ? palette.danger : palette.primaryStrong,
              fontWeight: '900',
              fontSize: 12,
            }}
          >
            {emergencyMode ? 'Emergency ON' : 'Emergency OFF'}
          </Text>
        </Pressable>
      </View>

      <View style={[styles.searchRow, { borderColor: palette.divider }]}>
        <KISIcon name="search" size={18} color={palette.subtext} />
        <TextInput
          placeholder="Search patients, locations, services..."
          placeholderTextColor={palette.subtext}
          value={searchTerm}
          onChangeText={onChangeSearch}
          onSubmitEditing={onSubmitSearch}
          style={[styles.searchInput, { color: palette.text }]}
        />
      </View>

      <View style={styles.locationsRow}>
        <Text style={[styles.sectionLabel, { color: palette.text }]}>Locations</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.locationsList}>
          {organizations.flatMap((org) =>
            org.locations.map((loc) => (
              <View key={loc.id} style={[styles.locationCard, { borderColor: palette.divider, backgroundColor: palette.surface }]}>
                <Text style={{ color: palette.text, fontWeight: '900' }}>{loc.label}</Text>
                <Text style={{ color: palette.subtext, fontSize: 12 }}>{loc.timezone || 'No timezone'}</Text>
                <Text style={{ color: palette.subtext, fontSize: 11 }}>
                  {loc.is_primary ? 'Primary' : 'Secondary'} · {org.name}
                </Text>
              </View>
            )),
          )}
          {organizations.every((org) => org.locations.length === 0) && (
            <Text style={{ color: palette.subtext }}>Add locations to appear here.</Text>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderWidth: 2,
    borderRadius: 18,
    padding: 14,
    gap: 12,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  profilePicker: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  profilePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
  },
  pickerList: {
    marginTop: 8,
    borderWidth: 2,
    borderRadius: 12,
    padding: 6,
  },
  pickerItem: {
    padding: 10,
    borderRadius: 10,
    gap: 4,
  },
  emergencyToggle: {
    borderWidth: 2,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  searchRow: {
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '900',
  },
  locationsRow: {
    gap: 6,
  },
  locationsList: {
    gap: 10,
  },
  locationCard: {
    borderWidth: 2,
    borderRadius: 14,
    padding: 10,
    minWidth: 150,
  },
});
