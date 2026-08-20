import React, { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { getHealthThemeColors, HEALTH_THEME_SPACING, HEALTH_THEME_TYPOGRAPHY } from '@/theme/health';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { ScreenHeader } from '@/components/common/ScreenHeader';

type Props = NativeStackScreenProps<RootStackParamList, 'WebsitePreview'>;

// The "TRUE preview" screen — this loads the actual public website URL
// (with a short-lived owner-only preview token appended so drafts/
// unpublished content are visible) inside a real WebView, rather than a
// native re-render of the section editor. What renders here is exactly
// what a visitor would see once published.
export default function WebsitePreviewScreen({ route, navigation }: Props) {
  const { previewUrl } = route.params;
  const palette = getHealthThemeColors('light');
  const spacing = HEALTH_THEME_SPACING;
  const typography = HEALTH_THEME_TYPOGRAPHY;
  const [loading, setLoading] = useState(true);

  if (!previewUrl) {
    return (
      <View style={{ flex: 1, backgroundColor: palette.bg }}>
        <ScreenHeader title="Preview" onBack={() => navigation.goBack()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg }}>
          <Text style={{ ...typography.body, color: palette.subtext, textAlign: 'center' }}>
            Unable to open the preview link. Please try again.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <ScreenHeader title="Preview" onBack={() => navigation.goBack()} animateBackHint />
      <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: palette.bg }}>
        {loading ? (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
            <ActivityIndicator color={palette.accentPrimary} />
          </View>
        ) : null}
        <WebView
          source={{ uri: previewUrl }}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          style={{ flex: 1, backgroundColor: palette.bg }}
        />
      </SafeAreaView>
    </View>
  );
}
