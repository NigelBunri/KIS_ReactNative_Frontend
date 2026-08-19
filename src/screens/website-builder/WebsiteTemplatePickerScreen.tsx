import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { getRequest } from '@/network/get';
import ROUTES from '@/network';
import KISButton from '@/constants/KISButton';
import {
  getHealthThemeColors,
  HEALTH_THEME_SPACING,
  HEALTH_THEME_TYPOGRAPHY,
} from '@/theme/health';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';

type Props = NativeStackScreenProps<RootStackParamList, 'WebsiteTemplatePicker'>;

type Template = { id: string; name: string; description: string; thumbnail_url: string };

export default function WebsiteTemplatePickerScreen({ navigation, route }: Props) {
  const { ownerType, ownerId, ownerLabel } = route.params;
  const palette = getHealthThemeColors('light');
  const spacing = HEALTH_THEME_SPACING;
  const typography = HEALTH_THEME_TYPOGRAPHY;

  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await getRequest(ROUTES.websites.templates(ownerType));
        const data = (res as any)?.data ?? res;
        setTemplates(Array.isArray(data) ? data : []);
      } finally {
        setLoading(false);
      }
    })();
  }, [ownerType]);

  const startWith = useCallback(async (templateId?: string) => {
    setCreating(true);
    try {
      const res = await getRequest(ROUTES.websites.mineWithTemplate(ownerType, ownerId, templateId));
      if (!res?.success) throw new Error((res as any)?.message || 'Unable to create your website.');
      navigation.replace('WebsiteBuilder', { ownerType, ownerId, ownerLabel });
    } catch (error: any) {
      Alert.alert('Website Builder', error?.message || 'Unable to create your website.');
    } finally {
      setCreating(false);
    }
  }, [ownerType, ownerId, ownerLabel, navigation]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={palette.accentPrimary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }}>
      <ScrollView contentContainerStyle={{ padding: spacing.md }}>
        <Text style={{ ...typography.h2, color: palette.text }}>Start Your Website</Text>
        <Text style={{ ...typography.caption, color: palette.subtext, marginTop: 2 }}>
          Pick a starting point — you can change everything afterward.
        </Text>

        <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
          {templates.map((template) => (
            <TouchableOpacity
              key={template.id}
              onPress={() => startWith(template.id)}
              disabled={creating}
              style={{
                borderRadius: spacing.md, borderWidth: 1, borderColor: palette.divider,
                backgroundColor: palette.card, padding: spacing.md,
              }}
            >
              <Text style={{ ...typography.label, color: palette.text }}>{template.name}</Text>
              {!!template.description && (
                <Text style={{ ...typography.caption, color: palette.subtext, marginTop: 2 }}>{template.description}</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ marginTop: spacing.lg }}>
          <KISButton title="Start From Blank" variant="outline" onPress={() => startWith(undefined)} disabled={creating} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
