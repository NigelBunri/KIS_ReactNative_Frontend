// src/components/partners/PartnerFeaturePanel.tsx
//
// Fallback for settings-catalog features that don't have a purpose-built
// panel yet (most of them have no backend behind them at all — this isn't
// a config screen, there's nothing real to configure). It used to let
// people "edit" an arbitrary key/value config blob that nothing on the
// backend ever read, which looked like a working settings form but did
// nothing — worse than admitting the feature isn't built. This is an
// honest empty state instead: no input fields, no false affordance.
import React from 'react';
import { Animated, Pressable, ScrollView, Text, View } from 'react-native';
import styles from '@/components/partners/partnersStyles';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import type { PartnerFeatureMeta } from '@/screens/tabs/partners/usePartnerFeaturePanel';

type Props = {
  isOpen: boolean;
  panelWidth: number;
  panelTranslateX: Animated.Value;
  partnerId?: string | null;
  feature?: PartnerFeatureMeta | null;
  onClose: () => void;
};

export default function PartnerFeaturePanel({
  isOpen,
  panelWidth,
  panelTranslateX,
  feature,
  onClose,
}: Props) {
  const { palette } = useKISTheme();

  const backdropOpacity = panelTranslateX.interpolate({
    inputRange: [0, panelWidth],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  if (!isOpen || !feature) return null;

  return (
    <View style={styles.settingsPanelOverlay} pointerEvents="box-none">
      <Animated.View
        style={[
          styles.settingsPanelBackdrop,
          { backgroundColor: palette.backdrop, opacity: backdropOpacity },
        ]}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          styles.settingsPanelContainer,
          {
            width: panelWidth,
            backgroundColor: palette.surfaceElevated,
            borderLeftColor: palette.divider,
            transform: [{ translateX: panelTranslateX }],
          },
        ]}
      >
        <View
          style={[
            styles.settingsPanelHeader,
            { borderBottomColor: palette.divider },
          ]}
        >
          <Pressable onPress={onClose} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            <Text style={{ color: palette.text, fontSize: 18 }}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingsPanelTitle, { color: palette.text }]}>
              {feature.title}
            </Text>
          </View>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.settingsPanelBody, { flexGrow: 1 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 }}>
            <KISIcon name="warning" size={40} color={palette.subtext} />
            <Text
              style={{
                color: palette.text,
                fontSize: 16,
                fontWeight: '700',
                marginTop: 16,
                textAlign: 'center',
              }}
            >
              Not built yet
            </Text>
            <Text
              style={{
                color: palette.subtext,
                fontSize: 13,
                marginTop: 8,
                textAlign: 'center',
                paddingHorizontal: 24,
                lineHeight: 19,
              }}
            >
              {feature.description
                ? `${feature.description} This isn't available yet — let us know if you need it sooner.`
                : "This feature isn't available yet — let us know if you need it sooner."}
            </Text>
          </View>
        </ScrollView>
      </Animated.View>
    </View>
  );
}
