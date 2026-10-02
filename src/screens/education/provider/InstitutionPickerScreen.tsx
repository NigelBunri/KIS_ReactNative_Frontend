// src/screens/education/provider/InstitutionPickerScreen.tsx
//
// Education UX v2 — real "Institution" entry screen, replacing the
// `screen === 'hub'`/`screen === 'form'` internal states inside
// EducationManagementModal.tsx (left in place for its deeper CRUD forms).
// Institution creation stays an inline contextual form on this same
// screen rather than a separate destination — it's a short, one-time
// action per section 20 of the v2 brief, not a "major destination".
//
// Visual pass: rebuilt on the shared premium education component kit for
// visual parity with the rest of the v2 flow.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import KISTextInput from '@/constants/KISTextInput';
import ROUTES, { resolveBackendAssetUrl } from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { patchRequest } from '@/network/patch';
import type { RootStackParamList } from '@/navigation/types';
import {
  EducationScreenScaffold,
  EducationSectionCard,
  EducationListCard,
  EducationEmptyState,
  EducationActionButton,
} from '@/screens/education/shared/components';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const INSTITUTION_TYPES = ['school', 'college', 'university', 'academy', 'training_center', 'bootcamp', 'community', 'other'];

// Matches the old modal's getInstitutionBrandingUri exactly — the backend
// nests logo/cover art under institution.branding, not a flat field.
const getInstitutionLogoUri = (institution: any): string => {
  const raw = String(institution?.branding?.logo_url || institution?.branding?.image_url || '').trim();
  return raw ? resolveBackendAssetUrl(raw) || raw : '';
};

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
  const [broadcastingId, setBroadcastingId] = useState<string | null>(null);

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

  // One-tap "advertise us" broadcast — no form, since there's nothing to
  // configure: the backend auto-fills title/summary/cover from the
  // institution's own name/description/logo (see EducationBroadcastKind
  // .INSTITUTION handling in apps/broadcasts/views.py). Distinct from a
  // course/program broadcast, which does need a target and a form.
  //
  // Toggle, not a one-way action: each institution's most recent
  // institution-kind broadcast is now returned by the hub endpoint
  // (institution_broadcast_id/institution_broadcast_status), so a second
  // tap re-publishes or drafts that same record instead of creating a new
  // one every time — mirrors CourseBuilderScreen's isLive/"Remove from
  // live" pattern for courses.
  const handleBroadcastInstitution = useCallback(async (institution: any) => {
    const isLive = institution.institution_broadcast_status === 'published';
    setBroadcastingId(institution.id);
    try {
      const response = isLive
        ? await patchRequest(
            ROUTES.broadcasts.educationInstitutionBroadcast(institution.id, institution.institution_broadcast_id),
            { status: 'draft' },
            { errorMessage: 'Unable to remove this institution from live.' },
          )
        : institution.institution_broadcast_id
          ? await patchRequest(
              ROUTES.broadcasts.educationInstitutionBroadcast(institution.id, institution.institution_broadcast_id),
              { status: 'published' },
              { errorMessage: 'Unable to broadcast this institution.' },
            )
          : await postRequest(
              ROUTES.broadcasts.educationInstitutionBroadcasts(institution.id),
              { broadcast_kind: 'institution', status: 'published' },
              { errorMessage: 'Unable to broadcast this institution.' },
            );
      if (!response?.success) {
        Alert.alert('Broadcast', response?.message || 'Unable to update this institution’s broadcast.');
        return;
      }
      const broadcastId = response.data?.broadcast?.id ?? institution.institution_broadcast_id;
      setInstitutions(prev =>
        prev.map(row =>
          row.id === institution.id
            ? { ...row, institution_broadcast_id: broadcastId, institution_broadcast_status: isLive ? 'draft' : 'published' }
            : row,
        ),
      );
    } finally {
      setBroadcastingId(null);
    }
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }}>
      <EducationScreenScaffold
        palette={palette}
        breadcrumb="Education"
        title="Your institutions"
        subtitle="Create institutions here, then manage each one in its own dashboard."
        onBack={() => navigation.goBack()}
        actions={!showCreateForm ? <EducationActionButton palette={palette} label="+ Create" onPress={() => setShowCreateForm(true)} /> : undefined}
        scrollable={false}
        contentContainerStyle={{ flex: 1, padding: 0 }}
      >
        <FlatList
          style={{ flex: 1 }}
          data={institutions}
          keyExtractor={row => row.id}
          contentContainerStyle={{ padding: responsive.pageGutter, gap: 12, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={palette.primary} />}
          ListHeaderComponent={
            showCreateForm ? (
              <EducationSectionCard
                palette={palette}
                eyebrow="New institution"
                title="Create an institution"
              >
                <View style={{ gap: 10, marginTop: 6 }}>
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
                    <EducationActionButton palette={palette} label={submitting ? 'Creating…' : 'Create'} disabled={submitting} onPress={() => void handleCreate()} />
                    <EducationActionButton palette={palette} label="Cancel" variant="secondary" disabled={submitting} onPress={() => setShowCreateForm(false)} />
                  </View>
                </View>
              </EducationSectionCard>
            ) : null
          }
          ListEmptyComponent={
            !loading ? (
              <EducationEmptyState
                palette={palette}
                title="No institutions yet"
                description="Use the Create button above to add one."
              />
            ) : (
              <ActivityIndicator color={palette.primary} style={{ marginTop: 30 }} />
            )
          }
          renderItem={({ item }) => (
            <EducationListCard
              palette={palette}
              title={item.name}
              eyebrow={item.institution_type?.replace('_', ' ')}
              subtitle={item.description || 'No description yet.'}
              imageUrl={getInstitutionLogoUri(item) || null}
              statusLabel={item.institution_broadcast_status === 'published' ? 'Live' : undefined}
              statusTone="success"
              metaItems={[`${item.active_member_count ?? 0} members`]}
              onPress={() => navigation.navigate('EducationInstitutionDashboard', { institutionId: item.id, institutionName: item.name })}
              primaryAction={
                <EducationActionButton
                  palette={palette}
                  label="Open"
                  variant="secondary"
                  onPress={() => navigation.navigate('EducationInstitutionDashboard', { institutionId: item.id, institutionName: item.name })}
                />
              }
              secondaryAction={
                <>
                  <EducationActionButton
                    palette={palette}
                    label={
                      broadcastingId === item.id
                        ? 'Working…'
                        : item.institution_broadcast_status === 'published'
                          ? 'Remove from live'
                          : 'Broadcast'
                    }
                    variant={item.institution_broadcast_status === 'published' ? 'secondary' : 'primary'}
                    disabled={broadcastingId === item.id}
                    onPress={() => void handleBroadcastInstitution(item)}
                  />
                  <EducationActionButton
                    palette={palette}
                    label="Edit"
                    variant="ghost"
                    onPress={() => navigation.navigate('EducationInstitutionSettings', { institutionId: item.id, institutionName: item.name })}
                  />
                </>
              }
            />
          )}
        />
      </EducationScreenScaffold>
    </SafeAreaView>
  );
}
