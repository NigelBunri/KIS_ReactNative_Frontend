import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  SafeAreaView,
  useColorScheme,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { InstitutionsListScreen } from './InstitutionsListScreen';
import type { HealthInstitution } from './types';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import {
  getHealthThemeColors,
} from '@/theme/health';
import { fetchHealthProfileState } from '@/services/healthProfileService';
import type { RootStackParamList } from '@/navigation/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { HealthInstitutionType } from '@/screens/tabs/profile-screen/types';
import { filterInstitutionsForVisibleRoles, type HealthAccessUser } from './accessControl';

const SUPPORTED_TYPES = new Set([
  'clinic',
  'hospital',
  'lab',
  'diagnostics',
  'pharmacy',
  'wellness_center',
]);

export default function HealthInstitutionsScreen() {
  const [institutions, setInstitutions] = useState<HealthInstitution[]>([]);
  const [currentUser, setCurrentUser] = useState<HealthAccessUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const scheme = useColorScheme();
  const palette = getHealthThemeColors(scheme === 'light' ? 'light' : 'dark');

  const normalizeInstitutionType = (type: any): HealthInstitutionType => {
    const value = String(type ?? '').trim();
    if (value === 'laboratory') return 'lab';
    if (value === 'diagnostics_center') return 'diagnostics';
    if (SUPPORTED_TYPES.has(value)) return value as HealthInstitutionType;
    return 'clinic';
  };

  const loadInstitutions = useCallback(async (options?: { refresh?: boolean; forceNetwork?: boolean }) => {
    if (options?.refresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [meRes, result] = await Promise.all([
        getRequest(ROUTES.auth.checkLogin, { forceNetwork: !!options?.forceNetwork }),
        fetchHealthProfileState({ forceNetwork: !!options?.forceNetwork }),
      ]);
      const me = (meRes as any)?.data ?? {};
      const meUser: HealthAccessUser = {
        id: me?.id ? String(me.id) : undefined,
        phone: String(me?.phone || '').trim() || undefined,
        email: String(me?.email || '').trim() || undefined,
      };
      setCurrentUser(meUser);
      const data: HealthInstitution[] = Array.isArray(result.profile?.institutions)
        ? result.profile!.institutions
        : [];
      setInstitutions(filterInstitutionsForVisibleRoles(data, meUser));
    } catch (error: any) {
      Alert.alert('Health institutions', error?.message || 'Unable to load institutions.');
    } finally {
      if (options?.refresh) setRefreshing(false);
      else setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInstitutions().catch(() => {});
  }, [loadInstitutions]);

  const handleView = useCallback((institution: HealthInstitution) => {
    navigation.navigate('HealthInstitutionDetail', {
      institutionId: institution.id,
      institutionType: normalizeInstitutionType(institution.type),
      institutionName: institution.name,
    });
  }, [navigation]);

  const handleEdit = useCallback((institution: HealthInstitution) => {
    navigation.navigate('HealthInstitutionManagement', {
      institutionId: institution.id,
      institutionName: institution.name,
      institutionType: normalizeInstitutionType(institution.type),
      employees: Math.max(1, Array.isArray(institution.employees) ? institution.employees.length : 1),
    });
  }, [navigation]);

  const handleAdd = useCallback(() => {
    navigation.navigate('HealthInstitutionManagement', {
      institutionType: 'clinic',
    });
  }, [navigation]);

  const handleRefresh = useCallback(() => {
    loadInstitutions({ refresh: true, forceNetwork: true }).catch(() => {});
  }, [loadInstitutions]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }}>
      <InstitutionsListScreen
        institutions={institutions}
        onEdit={handleEdit}
        onView={handleView}
        onAdd={handleAdd}
        currentUser={currentUser}
        loading={loading}
        refreshing={refreshing}
        onRefresh={handleRefresh}
      />
    </SafeAreaView>
  );
}
