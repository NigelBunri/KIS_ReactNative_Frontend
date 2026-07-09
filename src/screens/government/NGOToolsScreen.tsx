import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import { KISIcon } from '@/constants/kisIcons';
import KISButton from '@/constants/KISButton';

type Props = NativeStackScreenProps<RootStackParamList, 'NGOTools'>;

type NGOProfile = {
  id?: string;
  name: string;
  reg_number: string;
  focus_areas: string;
  country: string;
};

type Grant = {
  id: string;
  title: string;
  amount: string;
  status: string;
};

const STATUS_COLOR_MAP: Record<string, string> = {
  approved: 'primary',
  pending: 'gold',
  rejected: 'danger',
};

export default function NGOToolsScreen(_props: Props) {
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const gutter = layout.pageGutter;

  const [profile, setProfile] = useState<NGOProfile | null>(null);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [loading, setLoading] = useState(true);

  // Profile form
  const [profileName, setProfileName] = useState('');
  const [regNumber, setRegNumber] = useState('');
  const [focusAreas, setFocusAreas] = useState('');
  const [country, setCountry] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Grant form
  const [showGrantForm, setShowGrantForm] = useState(false);
  const [grantTitle, setGrantTitle] = useState('');
  const [grantAmount, setGrantAmount] = useState('');
  const [savingGrant, setSavingGrant] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      Promise.all([
        getRequest(ROUTES.government.ngoProfiles).catch(() => null),
        getRequest(ROUTES.government.grants).catch(() => null),
      ]).then(([profileRes, grantsRes]) => {
        if (!active) return;
        const p = Array.isArray(profileRes)
          ? profileRes[0]
          : profileRes?.results?.[0] ?? profileRes;
        if (p?.id) {
          setProfile(p);
          setProfileName(p.name ?? '');
          setRegNumber(p.reg_number ?? '');
          setFocusAreas(p.focus_areas ?? '');
          setCountry(p.country ?? '');
        }
        setGrants(
          Array.isArray(grantsRes) ? grantsRes : grantsRes?.results ?? [],
        );
      }).finally(() => { if (active) setLoading(false); });
      return () => { active = false; };
    }, []),
  );

  async function handleSaveProfile() {
    if (!profileName.trim() || !country.trim()) {
      Alert.alert('Required', 'Name and country are required.');
      return;
    }
    setSavingProfile(true);
    try {
      const payload = {
        name: profileName.trim(),
        reg_number: regNumber.trim(),
        focus_areas: focusAreas.trim(),
        country: country.trim(),
      };
      const result = (await postRequest(
        ROUTES.government.ngoProfiles,
        payload,
      )) as NGOProfile;
      setProfile(result);
      Alert.alert('Saved', 'NGO profile saved successfully.');
    } catch {
      Alert.alert('Error', 'Could not save profile. Please try again.');
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleSubmitGrant() {
    if (!grantTitle.trim()) {
      Alert.alert('Required', 'Grant title is required.');
      return;
    }
    setSavingGrant(true);
    try {
      const result = (await postRequest(ROUTES.government.grants, {
        title: grantTitle.trim(),
        amount: grantAmount.trim(),
      })) as Grant;
      setGrants((prev) => [result, ...prev]);
      setGrantTitle('');
      setGrantAmount('');
      setShowGrantForm(false);
    } catch {
      Alert.alert('Error', 'Could not submit application. Please try again.');
    } finally {
      setSavingGrant(false);
    }
  }

  const inputStyle = [
    styles.input,
    {
      backgroundColor: palette.surface,
      borderColor: palette.divider,
      color: palette.text,
    },
  ];

  if (loading) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: palette.bg, }]}>
        <ActivityIndicator style={styles.flex} color={palette.gold} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: palette.bg, }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: gutter,
            paddingTop: 20,
            paddingBottom: 80,
          }}
        >
          {/* NGO Profile Section */}
          <View style={styles.sectionHeaderRow}>
            <KISIcon name="people-outline" size={20} color={palette.primary} />
            <Text style={[styles.sectionTitle, { color: palette.text }]}>
              {profile?.id ? 'My NGO Profile' : 'Create NGO Profile'}
            </Text>
          </View>

          <View
            style={[
              styles.profileCard,
              { backgroundColor: palette.card, borderColor: palette.divider },
            ]}
          >
            <Text style={[styles.label, { color: palette.text }]}>
              Organisation Name *
            </Text>
            <TextInput
              style={inputStyle}
              value={profileName}
              onChangeText={setProfileName}
              placeholder="e.g. Kingdom Aid Foundation"
              placeholderTextColor={palette.subtext}
            />

            <Text style={[styles.label, { color: palette.text }]}>
              Registration Number
            </Text>
            <TextInput
              style={inputStyle}
              value={regNumber}
              onChangeText={setRegNumber}
              placeholder="e.g. RC-123456"
              placeholderTextColor={palette.subtext}
            />

            <Text style={[styles.label, { color: palette.text }]}>
              Focus Areas
            </Text>
            <TextInput
              style={[inputStyle, styles.textarea]}
              value={focusAreas}
              onChangeText={setFocusAreas}
              placeholder="e.g. Education, Healthcare, Poverty Alleviation"
              placeholderTextColor={palette.subtext}
              multiline
              textAlignVertical="top"
            />

            <Text style={[styles.label, { color: palette.text }]}>
              Country *
            </Text>
            <TextInput
              style={inputStyle}
              value={country}
              onChangeText={setCountry}
              placeholder="e.g. Nigeria"
              placeholderTextColor={palette.subtext}
            />

            <KISButton
              title={savingProfile ? 'Saving…' : 'Save Profile'}
              onPress={handleSaveProfile}
              disabled={savingProfile}
              style={{ marginTop: 14 }}
            />
          </View>

          {/* Grant Applications Section */}
          <View style={[styles.sectionHeaderRow, { marginTop: 28 }]}>
            <KISIcon
              name="cash-outline"
              size={20}
              color={palette.primary}
            />
            <Text style={[styles.sectionTitle, { color: palette.text }]}>
              Grant Applications
            </Text>
          </View>

          {grants.length === 0 && !showGrantForm && (
            <Text style={[styles.emptyNote, { color: palette.subtext }]}>
              No grant applications yet.
            </Text>
          )}

          {grants.map((grant) => {
            const statusKey = grant.status?.toLowerCase() ?? 'pending';
            const colorKey = STATUS_COLOR_MAP[statusKey] ?? 'subtext';
            const statusColor = palette[colorKey as keyof typeof palette] as string ?? palette.subtext;
            return (
              <View
                key={grant.id}
                style={[
                  styles.grantCard,
                  {
                    backgroundColor: palette.card,
                    borderColor: palette.divider,
                    marginBottom: layout.cardGap,
                  },
                ]}
              >
                <View style={styles.grantRow}>
                  <View style={styles.grantInfo}>
                    <Text style={[styles.grantTitle, { color: palette.text }]}>
                      {grant.title}
                    </Text>
                    {grant.amount ? (
                      <Text
                        style={[styles.grantAmount, { color: palette.subtext }]}
                      >
                        {grant.amount}
                      </Text>
                    ) : null}
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: statusColor + '22' },
                    ]}
                  >
                    <Text
                      style={[styles.statusBadgeText, { color: statusColor }]}
                    >
                      {grant.status}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}

          {showGrantForm ? (
            <View
              style={[
                styles.profileCard,
                { backgroundColor: palette.card, borderColor: palette.divider },
              ]}
            >
              <Text style={[styles.label, { color: palette.text }]}>
                Grant Title *
              </Text>
              <TextInput
                style={inputStyle}
                value={grantTitle}
                onChangeText={setGrantTitle}
                placeholder="e.g. Community Development Fund"
                placeholderTextColor={palette.subtext}
              />
              <Text style={[styles.label, { color: palette.text }]}>
                Amount Requested
              </Text>
              <TextInput
                style={inputStyle}
                value={grantAmount}
                onChangeText={setGrantAmount}
                placeholder="e.g. $50,000"
                placeholderTextColor={palette.subtext}
              />
              <View style={styles.grantFormActions}>
                <KISButton
                  title={savingGrant ? 'Submitting…' : 'Submit Application'}
                  onPress={handleSubmitGrant}
                  disabled={savingGrant}
                  style={{ flex: 1 }}
                />
                <TouchableOpacity
                  activeOpacity={0.75}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={[
                    styles.cancelBtn,
                    { borderColor: palette.divider },
                  ]}
                  onPress={() => setShowGrantForm(false)}
                >
                  <Text style={[styles.cancelBtnText, { color: palette.subtext }]}>
                    Cancel
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              activeOpacity={0.75}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              style={[
                styles.newAppBtn,
                {
                  borderColor: palette.primary,
                  backgroundColor: palette.primarySoft,
                },
              ]}
              onPress={() => setShowGrantForm(true)}
            >
              <KISIcon name="add-circle-outline" size={18} color={palette.primary} />
              <Text style={[styles.newAppBtnText, { color: palette.primary }]}>
                New Application
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  profileCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 10,
    marginBottom: 4,
  },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    minHeight: 44,
  },
  textarea: {
    minHeight: 80,
    paddingTop: 11,
  },
  emptyNote: {
    fontSize: 14,
    marginBottom: 12,
  },
  grantCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  grantRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  grantInfo: {
    flex: 1,
  },
  grantTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  grantAmount: {
    fontSize: 12,
    marginTop: 2,
  },
  statusBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  grantFormActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    alignItems: 'center',
  },
  cancelBtn: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 11,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  newAppBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    minHeight: 44,
    marginTop: 4,
  },
  newAppBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
