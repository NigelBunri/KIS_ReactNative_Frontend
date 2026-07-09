import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import KISButton from '@/constants/KISButton';

type Props = NativeStackScreenProps<RootStackParamList, 'FamilySetup'>;

type TabKey = 'create' | 'join';

export default function FamilySetupScreen({ navigation }: Props) {
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const [activeTab, setActiveTab] = useState<TabKey>('create');
  const [familyName, setFamilyName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);

  const gutter = layout.pageGutter;

  async function handleCreate() {
    if (!familyName.trim()) {
      Alert.alert('Family name is required');
      return;
    }
    setLoading(true);
    try {
      await postRequest(ROUTES.family.accounts, { name: familyName.trim() });
      navigation.navigate('FamilyHub');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to create family');
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin() {
    if (!inviteCode.trim()) {
      Alert.alert('Invite code is required');
      return;
    }
    setLoading(true);
    try {
      await postRequest(ROUTES.family.accountJoin, { invite_code: inviteCode.trim() });
      navigation.navigate('FamilyHub');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Invalid or expired invite code');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: palette.bg, }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 80 }}>
        <View style={[styles.inner, { paddingHorizontal: gutter }]}>
          <Text style={[styles.title, { color: palette.text }]}>Family Setup</Text>
          <Text style={[styles.subtitle, { color: palette.subtext }]}>
            Create a new family group or join one with an invite code.
          </Text>

          {/* Tabs */}
          <View style={[styles.tabBar, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
            {(['create', 'join'] as TabKey[]).map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[
                  styles.tab,
                  activeTab === tab && { backgroundColor: palette.primary },
                ]}
                onPress={() => setActiveTab(tab)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text
                  style={[
                    styles.tabLabel,
                    { color: activeTab === tab ? palette.ivory : palette.subtext },
                  ]}
                >
                  {tab === 'create' ? 'Create' : 'Join'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {activeTab === 'create' ? (
            <View style={styles.form}>
              <Text style={[styles.label, { color: palette.text }]}>Family Name</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: palette.surface,
                    borderColor: palette.divider,
                    color: palette.text,
                  },
                ]}
                placeholder="e.g. The Johnson Family"
                placeholderTextColor={palette.subtext}
                value={familyName}
                onChangeText={setFamilyName}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleCreate}
              />
              <KISButton
                title={loading ? 'Creating…' : 'Create Family'}
                onPress={handleCreate}
                disabled={loading}
                loading={loading}
                style={{ marginTop: 8 }}
              />
            </View>
          ) : (
            <View style={styles.form}>
              <Text style={[styles.label, { color: palette.text }]}>Invite Code</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: palette.surface,
                    borderColor: palette.divider,
                    color: palette.text,
                  },
                ]}
                placeholder="Enter the family invite code"
                placeholderTextColor={palette.subtext}
                value={inviteCode}
                onChangeText={setInviteCode}
                autoCapitalize="characters"
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleJoin}
              />
              <KISButton
                title={loading ? 'Joining…' : 'Join Family'}
                onPress={handleJoin}
                disabled={loading}
                loading={loading}
                style={{ marginTop: 8 }}
              />
            </View>
          )}

          {loading && (
            <ActivityIndicator
              color={palette.gold}
              style={{ marginTop: 24 }}
            />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  inner: { paddingTop: 32 },
  title: { fontSize: 26, fontWeight: '700', marginBottom: 6 },
  subtitle: { fontSize: 15, marginBottom: 28 },
  tabBar: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 28,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabLabel: { fontSize: 15, fontWeight: '600' },
  form: { gap: 10 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    minHeight: 48,
  },
});
