// src/screens/education/provider/InstitutionPickerScreen.tsx
//
// Education UX v2 — real "Institution" entry screen, replacing the
// `screen === 'hub'`/`screen === 'form'` internal states inside
// EducationManagementModal.tsx (left in place for its deeper CRUD forms).
// Institution creation stays an inline contextual form on this same
// screen rather than a separate destination — it's a short, one-time
// action per section 20 of the v2 brief, not a "major destination".
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import KISButton from '@/constants/KISButton';
import KISTextInput from '@/constants/KISTextInput';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import type { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const INSTITUTION_TYPES = ['school', 'college', 'university', 'academy', 'training_center', 'bootcamp', 'community', 'other'];

export default function InstitutionPickerScreen() {
  const navigation = useNavigation<Nav>();
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [institutionType, setInstitutionType] = useState('academy');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getRequest(ROUTES.broadcasts.educationHub, {
        errorMessage: 'Unable to load your institutions.',
        forceNetwork: true,
      });
      if (response?.success) setInstitutions(response.data?.institutions ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleCreate = useCallback(async () => {
    if (!name.trim()) {
      Alert.alert('Institution', 'Give your institution a name first.');
      return;
    }
    setSubmitting(true);
    try {
      const response = await postRequest(
        ROUTES.broadcasts.educationInstitutions,
        { name: name.trim(), description: description.trim(), institution_type: institutionType, membership_policy: 'application' },
        { errorMessage: 'Unable to create institution.' },
      );
      if (!response?.success) {
        Alert.alert('Institution', response?.message || 'Unable to create institution.');
        return;
      }
      setShowCreateForm(false);
      setName('');
      setDescription('');
      await load();
      const created = response.data?.institution;
      if (created?.id) {
        navigation.navigate('EducationInstitutionDashboard', { institutionId: created.id, institutionName: created.name });
      }
    } finally {
      setSubmitting(false);
    }
  }, [name, description, institutionType, load, navigation]);

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: palette.bg }}>
      <FlatList
        data={institutions}
        keyExtractor={row => row.id}
        contentContainerStyle={{ padding: responsive.pageGutter, gap: 12, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={palette.primary} />}
        ListHeaderComponent={
          <View style={{ gap: 16, marginBottom: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Pressable onPress={() => navigation.goBack()} style={{ padding: 4, marginLeft: -4 }}>
                <KISIcon name="back" size={20} color={palette.text} />
              </Pressable>
              <Text style={{ fontSize: 22, fontWeight: '900', color: palette.text }}>Your institutions</Text>
            </View>
            <Text style={{ color: palette.subtext }}>Create institutions here, then manage each one in its own dashboard.</Text>

            {!showCreateForm ? (
              <KISButton title="+ Create institution" onPress={() => setShowCreateForm(true)} />
            ) : (
              <View style={{ gap: 10, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface }}>
                <KISTextInput placeholder="Institution name" value={name} onChangeText={setName} />
                <KISTextInput placeholder="Short description" value={description} onChangeText={setDescription} multiline />
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {INSTITUTION_TYPES.map(type => (
                    <Pressable
                      key={type}
                      onPress={() => setInstitutionType(type)}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: institutionType === type ? palette.primary : palette.border,
                        backgroundColor: institutionType === type ? palette.primarySoft : 'transparent',
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '700', color: institutionType === type ? palette.primaryStrong : palette.subtext, textTransform: 'capitalize' }}>
                        {type.replace('_', ' ')}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <KISButton title={submitting ? 'Creating…' : 'Create'} disabled={submitting} loading={submitting} onPress={() => void handleCreate()} />
                  <KISButton title="Cancel" variant="secondary" disabled={submitting} onPress={() => setShowCreateForm(false)} />
                </View>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          !loading ? (
            <View style={{ padding: 18, alignItems: 'center' }}>
              <Text style={{ color: palette.subtext, textAlign: 'center' }}>No institutions yet. Use the button above to add one.</Text>
            </View>
          ) : (
            <ActivityIndicator color={palette.primary} style={{ marginTop: 30 }} />
          )
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => navigation.navigate('EducationInstitutionDashboard', { institutionId: item.id, institutionName: item.name })}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface }}
          >
            <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
              <KISIcon name="school" size={20} color={palette.primaryStrong} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '800', color: palette.text }} numberOfLines={1}>{item.name}</Text>
              <Text style={{ fontSize: 12, color: palette.subtext, textTransform: 'capitalize' }}>
                {item.institution_type?.replace('_', ' ')} · {item.active_member_count ?? 0} members
              </Text>
            </View>
            <KISIcon name="chevron-right" size={16} color={palette.subtext} />
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}
