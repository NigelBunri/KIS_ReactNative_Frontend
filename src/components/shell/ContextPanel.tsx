// src/components/shell/ContextPanel.tsx
//
// Right-hand column chrome for the tablet/desktop shell. Has no page-specific
// knowledge itself — it just renders whatever the focused tab screen
// registered via useContextPanelContent() (see ContextPanelContext.tsx),
// fading/sliding between pages. Keeping this dumb avoids a big page-keyed
// switch statement here that would duplicate what each screen already knows
// about its own data.
import React, { useEffect, useRef } from 'react';
import { Animated, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKISTheme } from '@/theme/useTheme';
import { useContextPanel } from './ContextPanelContext';

export const CONTEXT_PANEL_WIDTH = 340;

export function ContextPanel() {
  const { palette } = useKISTheme();
  const insets = useSafeAreaInsets();
  const content = useContextPanel();
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    fade.setValue(0);
    slide.setValue(8);
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(slide, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 4 }),
    ]).start();
  }, [content, fade, slide]);

  return (
    <View
      style={[
        styles.wrap,
        {
          width: CONTEXT_PANEL_WIDTH,
          backgroundColor: palette.bg,
          borderColor: palette.goldBorder,
          paddingTop: Math.max(insets.top, 16),
          paddingBottom: Math.max(insets.bottom, 16),
        },
      ]}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Animated.View style={{ opacity: fade, transform: [{ translateY: slide }], gap: 16 }}>
          {content ?? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyTitle, { color: palette.subtext }]}>Nothing to show here yet</Text>
            </View>
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderLeftWidth: 1,
    paddingHorizontal: 16,
  },
  scrollContent: {
    paddingBottom: 24,
    gap: 16,
  },
  emptyState: {
    paddingTop: 40,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
});

export default ContextPanel;
