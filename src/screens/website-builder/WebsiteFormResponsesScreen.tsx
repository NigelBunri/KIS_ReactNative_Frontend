import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { getRequest } from '@/network/get';
import ROUTES from '@/network';
import {
  getHealthThemeColors,
  HEALTH_THEME_SPACING,
  HEALTH_THEME_TYPOGRAPHY,
} from '@/theme/health';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { ScreenHeader } from '@/components/common/ScreenHeader';

type Props = NativeStackScreenProps<RootStackParamList, 'WebsiteFormResponses'>;

type Submission = {
  id: string;
  page_title: string;
  section_id: string;
  data: Record<string, string>;
  spam_score: number;
  created_at: string;
};

export default function WebsiteFormResponsesScreen({ route, navigation }: Props) {
  const { websiteId } = route.params;
  const palette = getHealthThemeColors('light');
  const spacing = HEALTH_THEME_SPACING;
  const typography = HEALTH_THEME_TYPOGRAPHY;

  const [loading, setLoading] = useState(true);
  const [submissions, setSubmissions] = useState<Submission[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getRequest(ROUTES.websites.formResponses(websiteId));
      const data = (res as any)?.data ?? res;
      setSubmissions(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, [websiteId]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: palette.bg }}>
        <ScreenHeader title="Form Responses" onBack={() => navigation.goBack()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={palette.accentPrimary} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <ScreenHeader
        title="Form Responses"
        subtitle={`${submissions.length} response${submissions.length === 1 ? '' : 's'}`}
        onBack={() => navigation.goBack()}
        animateBackHint
      />
      <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: palette.bg }}>
      <FlatList
        initialNumToRender={20}
        maxToRenderPerBatch={10}
        windowSize={10}
        removeClippedSubviews
        data={submissions}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.md, paddingTop: 0, gap: spacing.sm }}
        ListEmptyComponent={
          <Text style={{ ...typography.body, color: palette.subtext }}>No responses yet.</Text>
        }
        renderItem={({ item }) => (
          <View
            style={{
              borderRadius: spacing.md,
              borderWidth: 1,
              borderColor: palette.divider,
              backgroundColor: palette.card,
              padding: spacing.sm,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ ...typography.caption, color: palette.subtext }}>{item.page_title}</Text>
              <Text style={{ ...typography.caption, color: palette.subtext }}>
                {new Date(item.created_at).toLocaleString()}
              </Text>
            </View>
            {item.spam_score >= 0.5 ? (
              <Text style={{ ...typography.caption, color: '#B42318', marginTop: 2 }}>Possible spam</Text>
            ) : null}
            <View style={{ marginTop: spacing.xs, gap: 2 }}>
              {Object.entries(item.data || {}).map(([key, value]) => (
                <Text key={key} style={{ ...typography.body, color: palette.text }}>
                  <Text style={{ fontWeight: '700' }}>{key}: </Text>
                  {String(value)}
                </Text>
              ))}
            </View>
          </View>
        )}
      />
      </SafeAreaView>
    </View>
  );
}
