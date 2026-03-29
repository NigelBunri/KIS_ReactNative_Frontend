import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useColorScheme } from 'react-native';
import KISButton from '@/constants/KISButton';
import { HealthInstitution } from './types';
import { fetchHealthProfileState } from '@/services/healthProfileService';
import Skeleton from '@/components/common/Skeleton';
import {
  canUserManageInstitution,
  filterInstitutionsForVisibleRoles,
  getInstitutionRoleForUser,
  type HealthAccessUser,
} from './accessControl';
import {
  getHealthThemeBorders,
  getHealthThemeColors,
  HEALTH_THEME_SPACING,
  HEALTH_THEME_TYPOGRAPHY,
} from '@/theme/health';

type InstitutionsListScreenProps = {
  institutions: HealthInstitution[];
  onEdit?: (institution: HealthInstitution) => void;
  onView: (institution: HealthInstitution) => void;
  onAdd: () => void;
  refreshing?: boolean;
  loading?: boolean;
  currentUser?: HealthAccessUser | null;
  onRefresh?: () => void;
};

export function InstitutionsListScreen({
  institutions,
  onEdit,
  onView,
  onAdd,
  refreshing = false,
  loading = false,
  currentUser = null,
  onRefresh,
}: InstitutionsListScreenProps) {
  const scheme = useColorScheme();
  const palette = getHealthThemeColors(scheme === 'light' ? 'light' : 'dark');
  const spacing = HEALTH_THEME_SPACING;
  const borders = getHealthThemeBorders(palette);
  const [fallbackInstitutions, setFallbackInstitutions] = useState<HealthInstitution[]>([]);
  const [loadingFallback, setLoadingFallback] = useState(false);
  const [preferFallbackData, setPreferFallbackData] = useState(false);

  console.log('InstitutionsListScreen render', {
    institutions: institutions,
    fallbackCount: fallbackInstitutions.length,
    loading,
    loadingFallback,
    refreshing,
  });

  const loadFallbackInstitutions = useCallback(async (options?: { forceNetwork?: boolean }) => {
    setLoadingFallback(true);
    try {
      const result = await fetchHealthProfileState({ forceNetwork: !!options?.forceNetwork });
      const data: HealthInstitution[] = Array.isArray(result.profile?.institutions)
        ? result.profile!.institutions
        : [];
      setFallbackInstitutions(data);
    } finally {
      setLoadingFallback(false);
    }
  }, []);

  useEffect(() => {
    if (institutions.length > 0) return;
    loadFallbackInstitutions().catch(() => {});
  }, [institutions.length, loadFallbackInstitutions]);

  console.log('InstitutionsListScreen after data load', {
    institutions: institutions,
    fallback: fallbackInstitutions,
    loading,
    loadingFallback,
    refreshing,
  });

  const displayInstitutions = useMemo(() => {
    if (onRefresh) return institutions.length > 0 ? institutions : fallbackInstitutions;
    if (preferFallbackData) return fallbackInstitutions;
    return institutions.length > 0 ? institutions : fallbackInstitutions;
  }, [fallbackInstitutions, institutions, onRefresh, preferFallbackData]);
  const visibleInstitutions = useMemo(
    () => filterInstitutionsForVisibleRoles(displayInstitutions, currentUser),
    [currentUser, displayInstitutions],
  );
  const staffCount = visibleInstitutions.reduce((sum, inst) => sum + (inst.employees?.length ?? 0), 0);

  const handleRefresh = useCallback(() => {
    if (onRefresh) {
      onRefresh();
      return;
    }
    setPreferFallbackData(true);
    loadFallbackInstitutions({ forceNetwork: true }).catch(() => {});
  }, [onRefresh, loadFallbackInstitutions]);
  const showSkeletons = (loading || loadingFallback || refreshing) && visibleInstitutions.length === 0;
  const formatRoleLabel = (value: string | null | undefined) => {
    const role = String(value || 'unassigned').trim().toLowerCase();
    if (!role) return 'Unassigned';
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  return (
    <LinearGradient
      colors={[palette.gradientStart, palette.gradientEnd]}
      style={{ flex: 1 }}
    >
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing || loadingFallback}
            onRefresh={handleRefresh}
          />
        }
      >
        <View style={{ marginBottom: spacing.lg }}>
          <Text style={{ ...HEALTH_THEME_TYPOGRAPHY.h1, color: palette.text }}>Health Institutions</Text>
          <Text style={{ ...HEALTH_THEME_TYPOGRAPHY.body, color: palette.subtext, marginTop: 4 }}>
            {visibleInstitutions.length} institutions · {staffCount} staff
          </Text>
        </View>

        {showSkeletons ? (
          <View>
            {Array.from({ length: 3 }).map((_, index) => (
              <View
                key={`inst-skeleton-${index}`}
                style={{
                  borderRadius: spacing.lg,
                  backgroundColor: palette.card,
                  padding: spacing.md,
                  marginBottom: spacing.sm,
                  ...borders.card,
                }}
              >
                <Skeleton height={18} width="70%" radius={6} />
                <Skeleton height={12} width="52%" radius={6} style={{ marginTop: spacing.sm }} />
                <View style={{ flexDirection: 'row', marginTop: spacing.md, gap: spacing.sm }}>
                  <Skeleton height={32} width={84} radius={10} />
                  <Skeleton height={32} width={84} radius={10} />
                </View>
              </View>
            ))}
          </View>
        ) : (
          visibleInstitutions.map((institution) => {
            const canEditInstitution = canUserManageInstitution(institution, currentUser);
            const actorRole = getInstitutionRoleForUser(institution, currentUser);
            return (
              <View
                key={institution.id}
                style={{
                  borderRadius: spacing.lg,
                  backgroundColor: palette.card,
                  padding: spacing.md,
                  marginBottom: spacing.sm,
                  ...borders.card,
                }}
              >
                <Text style={{ ...HEALTH_THEME_TYPOGRAPHY.h3, color: palette.text }}>
                  {institution.name}
                </Text>
                <Text
                  style={{
                    ...HEALTH_THEME_TYPOGRAPHY.label,
                    color: palette.subtext,
                    marginTop: 4,
                  }}
                >
                  {institution.type.replace('_', ' ')} · {institution.employees?.length ?? 0} members
                </Text>
                <Text
                  style={{
                    ...HEALTH_THEME_TYPOGRAPHY.label,
                    color: palette.subtext,
                    marginTop: 4,
                  }}
                >
                  Your role: {formatRoleLabel(actorRole)}
                </Text>
                <View style={{ flexDirection: 'row', marginTop: spacing.md, gap: spacing.sm }}>
                  <KISButton
                    title="Edit"
                    variant="outline"
                    size="sm"
                    onPress={() => onEdit?.(institution)}
                    disabled={!canEditInstitution}
                  />
                  <KISButton
                    title="View"
                    variant="ghost"
                    size="sm"
                    onPress={() => onView(institution)}
                  />
                </View>
              </View>
            );
          })
        )}

        <View style={{ marginTop: spacing.xl }}>
          <KISButton title="Add institution" onPress={onAdd} />
        </View>
      </ScrollView>
    </LinearGradient>
  );
}
