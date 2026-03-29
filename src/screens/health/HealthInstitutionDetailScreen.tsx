import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import { RootStackParamList } from '@/navigation/types';
import {
  ensureInstitutionDashboardExists,
  fetchInstitutionDashboardAnalytics,
  type InstitutionDashboardAnalyticsResult,
} from '@/services/healthDashboardService';
import { fetchHealthProfileState } from '@/services/healthProfileService';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import {
  HEALTH_DASHBOARD_INSTITUTION_TYPES,
  type HealthDashboardInstitutionType,
} from '@/features/health-dashboard/models';
import InstitutionDashboardShell from '@/features/health-dashboard/ui/InstitutionDashboardShell';
import type { TimeRange } from '@/api/insights/types';
import {
  getHealthThemeColors,
  HEALTH_THEME_SPACING,
  HEALTH_THEME_TYPOGRAPHY,
} from '@/theme/health';
import KISButton from '@/constants/KISButton';
import { KISIcon } from '@/constants/kisIcons';
import { getInstitutionRoleForUser } from './accessControl';

type Props = NativeStackScreenProps<RootStackParamList, 'HealthInstitutionDetail'>;

const isSupportedType = (value: string): value is HealthDashboardInstitutionType => {
  return HEALTH_DASHBOARD_INSTITUTION_TYPES.includes(value as HealthDashboardInstitutionType);
};

const normalizePhone = (value: unknown) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (raw.startsWith('+')) return `+${digits}`;
  if (raw.startsWith('00')) return `+${digits.slice(2)}`;
  return digits;
};

export default function HealthInstitutionDetailScreen({ route, navigation }: Props) {
  const { institutionId, institutionType, institutionName: routeInstitutionName } = route.params;
  const scheme = useColorScheme();
  const palette = getHealthThemeColors(scheme === 'light' ? 'light' : 'dark');

  const [loading, setLoading] = useState(true);
  const institutionName = routeInstitutionName || 'Health Institution';
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [analytics, setAnalytics] = useState<InstitutionDashboardAnalyticsResult | null>(null);
  const [accessControls, setAccessControls] = useState({
    profile: true,
    schedules: true,
    services: true,
    members: true,
  });

  const dashboardType = useMemo(() => {
    if (!isSupportedType(institutionType)) return null;
    return institutionType;
  }, [institutionType]);

  const loadDashboard = useCallback(async () => {
    if (!dashboardType) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const bootstrap = await ensureInstitutionDashboardExists(institutionId, dashboardType);
      if (!bootstrap?.success) {
        throw new Error(bootstrap?.message || 'Unable to initialize institution dashboard.');
      }
      const [analyticsRes, healthState, meRes] = await Promise.all([
        fetchInstitutionDashboardAnalytics(institutionId, timeRange),
        fetchHealthProfileState(),
        getRequest(ROUTES.auth.checkLogin),
      ]);

      const meRequestOk = !!(meRes as any)?.success;
      if (!meRequestOk) {
        // Keep existing access controls instead of incorrectly downgrading to staff during 429 windows.
        setAnalytics(analyticsRes);
        return;
      }

      const me = (meRes as any)?.data ?? {};
      const currentUserId = me?.id != null ? String(me.id) : '';
      const currentUserPhone = normalizePhone(me?.phone);
      const institutions = Array.isArray(healthState.profile?.institutions) ? healthState.profile.institutions : [];
      const institution = institutions.find((item: any) => String(item?.id) === String(institutionId));
      const actorRole = String(
        getInstitutionRoleForUser(institution, {
          id: currentUserId || undefined,
          phone: currentUserPhone || undefined,
          email: String(me?.email || '').trim() || undefined,
        }) || 'unassigned',
      ).toLowerCase();

      const rolePermissions: Record<string, { profile: boolean; schedules: boolean; services: boolean; members: boolean }> = {
        owner: { profile: true, schedules: true, services: true, members: true },
        admin: { profile: true, schedules: true, services: true, members: true },
        manager: { profile: true, schedules: true, services: true, members: true },
        analyst: { profile: true, schedules: true, services: true, members: false },
        staff: { profile: true, schedules: true, services: false, members: false },
        member: { profile: false, schedules: false, services: false, members: false },
        unassigned: { profile: false, schedules: false, services: false, members: false },
      };
      setAccessControls(rolePermissions[actorRole] || rolePermissions.unassigned);
      setAnalytics(analyticsRes);
    } catch (error: any) {
      Alert.alert('Institution dashboard', error?.message || 'Unable to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, [dashboardType, institutionId, timeRange]);

  useFocusEffect(
    useCallback(() => {
      loadDashboard().catch(() => undefined);
      return () => undefined;
    }, [loadDashboard]),
  );

  const handleEditProfilePage = useCallback(() => {
    if (!dashboardType) return;
    navigation.navigate('InstitutionProfileEditor', {
      institutionId,
      institutionType: dashboardType,
    });
  }, [dashboardType, institutionId, navigation]);

  const handleManageAvailability = useCallback(() => {
    if (!dashboardType) return;
    navigation.navigate('AvailabilityManagement', {
      institutionId,
      institutionType: dashboardType,
    });
  }, [dashboardType, institutionId, navigation]);

  const handleManageServices = useCallback(() => {
    if (!dashboardType) return;
    navigation.navigate('HealthInstitutionServicesCatalog', {
      institutionId,
      institutionName,
      institutionType: dashboardType,
    });
  }, [dashboardType, institutionId, institutionName, navigation]);

  const handleManageMembers = useCallback(() => {
    navigation.navigate('HealthInstitutionMembers', {
      institutionId,
      institutionName,
    });
  }, [institutionId, institutionName, navigation]);

  const handleOpenHealthCards = useCallback(() => {
    if (!dashboardType) return;
    navigation.navigate('HealthInstitutionCards', {
      institutionId,
      institutionType: dashboardType,
      institutionName,
    });
  }, [dashboardType, institutionId, institutionName, navigation]);

  if (!dashboardType) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }}>
        <LinearGradient colors={[palette.gradientStart, palette.gradientEnd]} style={{ flex: 1, padding: HEALTH_THEME_SPACING.lg }}>
          <View style={{ alignItems: 'flex-end' }}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={{
                borderWidth: 1,
                borderColor: palette.divider,
                borderRadius: 12,
                padding: HEALTH_THEME_SPACING.xs,
                backgroundColor: palette.card,
              }}
              accessibilityLabel="Close dashboard"
            >
              <KISIcon name="close" size={18} color={palette.text} />
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <Text style={{ ...HEALTH_THEME_TYPOGRAPHY.h2, color: palette.text }}>
              Unsupported Institution Type
            </Text>
            <Text style={{ ...HEALTH_THEME_TYPOGRAPHY.body, color: palette.subtext, marginTop: HEALTH_THEME_SPACING.sm }}>
              This dashboard supports only clinic, hospital, lab, diagnostics, pharmacy, and wellness center.
            </Text>
            <View style={{ marginTop: HEALTH_THEME_SPACING.lg }}>
              <KISButton title="Go back" onPress={() => navigation.goBack()} />
            </View>
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  if (loading && !analytics) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }}>
        <LinearGradient
          colors={[palette.gradientStart, palette.gradientEnd]}
          style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
        >
          <View style={{ position: 'absolute', right: HEALTH_THEME_SPACING.lg, top: HEALTH_THEME_SPACING.lg }}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={{
                borderWidth: 1,
                borderColor: palette.divider,
                borderRadius: 12,
                padding: HEALTH_THEME_SPACING.xs,
                backgroundColor: palette.card,
              }}
              accessibilityLabel="Close dashboard"
            >
              <KISIcon name="close" size={18} color={palette.text} />
            </TouchableOpacity>
          </View>
          <ActivityIndicator size="large" color={palette.accentPrimary} />
          <Text
            style={{
              ...HEALTH_THEME_TYPOGRAPHY.body,
              color: palette.subtext,
              marginTop: HEALTH_THEME_SPACING.sm,
            }}
          >
            Loading dashboard...
          </Text>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }}>
      <LinearGradient colors={[palette.gradientStart, palette.gradientEnd]} style={{ flex: 1 }}>
        <View style={{ alignItems: 'flex-end', paddingHorizontal: HEALTH_THEME_SPACING.lg, paddingTop: HEALTH_THEME_SPACING.sm }}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{
              borderWidth: 1,
              borderColor: palette.divider,
              borderRadius: 12,
              padding: HEALTH_THEME_SPACING.xs,
              backgroundColor: palette.card,
            }}
            accessibilityLabel="Close dashboard"
          >
            <KISIcon name="close" size={18} color={palette.text} />
          </TouchableOpacity>
        </View>
        <InstitutionDashboardShell
          scheme={scheme === 'light' ? 'light' : 'dark'}
          institutionName={institutionName}
          institutionType={dashboardType}
          loading={loading}
          analytics={analytics}
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
          onEditProfilePage={handleEditProfilePage}
          onManageAvailability={handleManageAvailability}
          onManageServices={handleManageServices}
          onManageMembers={handleManageMembers}
          onOpenHealthCards={handleOpenHealthCards}
          accessControls={accessControls}
        />
      </LinearGradient>
    </SafeAreaView>
  );
}
