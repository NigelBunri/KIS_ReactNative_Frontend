import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useKISTheme } from '@/theme/useTheme';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import {
  buildImpactSnapshotSections,
  buildImpactSnapshotStats,
  type ImpactSnapshotRange,
} from '@/screens/tabs/profile/profileDashboardData';

const FILTERS: Array<{ key: ImpactSnapshotRange; label: string }> = [
  { key: 'all_time', label: 'All time' },
  { key: 'month', label: 'This month' },
  { key: 'year', label: 'This year' },
];

const labelForItem = (item: any) =>
  item?.title || item?.name || item?.headline || item?.summary || item?.text || item?.action || 'Profile item';

export default function ProfileImpactSnapshotScreen() {
  const { palette } = useKISTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [range, setRange] = useState<ImpactSnapshotRange>('month');

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getRequest(ROUTES.profiles.me, { errorMessage: 'Unable to load impact snapshot.' });
      if (!res?.success) {
        throw new Error(res?.message || 'Unable to load impact snapshot.');
      }
      setProfile(res.data ?? null);
    } catch (loadError: any) {
      setError(loadError?.message || 'Unable to load impact snapshot.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadProfile();
    }, [loadProfile]),
  );

  const stats = useMemo(() => buildImpactSnapshotStats(profile, range), [profile, range]);
  const sections = useMemo(() => buildImpactSnapshotSections(profile, range), [profile, range]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: palette.bg }} contentContainerStyle={{ padding: 20, gap: 16 }}>
      <View style={{ gap: 6 }}>
        <Text style={{ color: palette.text, fontSize: 28, fontWeight: '800' }}>Impact snapshot</Text>
        <Text style={{ color: palette.subtext }}>
          Review your profile impact for all time, this month, or this year based on your profile data.
        </Text>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {FILTERS.map((filter) => {
          const selected = filter.key === range;
          return (
            <Pressable
              key={filter.key}
              onPress={() => setRange(filter.key)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: selected ? palette.primaryStrong : palette.divider,
                backgroundColor: selected ? palette.primarySoft : palette.surface,
              }}
            >
              <Text style={{ color: selected ? palette.primaryStrong : palette.text, fontWeight: '700' }}>
                {filter.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? <ActivityIndicator color={palette.primaryStrong} /> : null}
      {error ? <Text style={{ color: palette.error || '#E53935' }}>{error}</Text> : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {stats.map((stat) => (
          <View
            key={stat.key}
            style={{
              minWidth: '47%',
              flexGrow: 1,
              borderWidth: 1,
              borderColor: palette.divider,
              borderRadius: 18,
              backgroundColor: palette.surface,
              padding: 16,
              gap: 6,
            }}
          >
            <Text style={{ color: palette.subtext, fontSize: 12 }}>{stat.label}</Text>
            <Text style={{ color: palette.text, fontSize: 28, fontWeight: '800' }}>{stat.value}</Text>
          </View>
        ))}
      </View>

      {sections.map((section) => (
        <View
          key={section.key}
          style={{
            borderWidth: 1,
            borderColor: palette.divider,
            borderRadius: 20,
            backgroundColor: palette.surface,
            padding: 16,
            gap: 10,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
            <Text style={{ color: palette.text, fontSize: 18, fontWeight: '800' }}>{section.label}</Text>
            <Text style={{ color: palette.primaryStrong, fontWeight: '700' }}>{section.count}</Text>
          </View>
          {section.items.length ? (
            section.items.map((item, index) => (
              <View
                key={String(item?.id || `${section.key}-${index}`)}
                style={{
                  borderWidth: 1,
                  borderColor: palette.divider,
                  borderRadius: 14,
                  padding: 12,
                  gap: 4,
                }}
              >
                <Text style={{ color: palette.text, fontWeight: '700' }}>{labelForItem(item)}</Text>
                {item?.summary || item?.description || item?.body ? (
                  <Text style={{ color: palette.subtext }}>
                    {String(item?.summary || item?.description || item?.body)}
                  </Text>
                ) : null}
              </View>
            ))
          ) : (
            <Text style={{ color: palette.subtext }}>No {section.label.toLowerCase()} in this period.</Text>
          )}
        </View>
      ))}
    </ScrollView>
  );
}
