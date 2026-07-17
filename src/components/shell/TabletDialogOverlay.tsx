// src/components/shell/TabletDialogOverlay.tsx
//
// AppNavigator's MainTabs renders 5 near-identical full-screen slide-in
// overlays (chat room, sub-room, chat info, community room, community info —
// see AppNavigator.tsx's chatVisible/subRoomVisible/infoVisible/
// communityVisible/communityInfoVisible block). On phone they should keep
// behaving exactly as before (full-bleed slide from the right). On tablet/
// desktop, per the brief's "popup dialogs -> floating centered dialogs"
// mapping, the same content should appear as a centered, rounded, shadowed
// dialog over the persistent shell instead of covering the sidebar/topbar.
//
// This component only changes position/size/presentation — the screen it
// wraps (ChatRoomPage, ChatInfoPage, CommunityRoomPage, CommunityInfoPage)
// is rendered completely unmodified as `children`, so none of their logic is
// touched. Centralizing this also removes 5 copies of near-identical
// interpolation/positioning code that previously lived inline in
// AppNavigator.tsx.
import React from 'react';
import { Animated, StyleSheet, useWindowDimensions } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';

export function TabletDialogOverlay({
  visible,
  progress,
  zIndex,
  children,
}: {
  visible: boolean;
  progress: Animated.Value;
  zIndex: number;
  children: React.ReactNode;
}) {
  const { palette } = useKISTheme();
  const { width, height } = useWindowDimensions();
  const { shellMode } = useResponsiveLayout();

  if (shellMode === 'phone') {
    const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [width, 0] });
    return (
      <Animated.View
        pointerEvents={visible ? 'auto' : 'none'}
        style={[
          styles.fullBleed,
          { transform: [{ translateX }], zIndex, backgroundColor: palette.bg },
        ]}
      >
        {children}
      </Animated.View>
    );
  }

  const dialogWidth = Math.min(760, width - 140);
  const dialogHeight = Math.min(880, height - 110);
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] });

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[styles.fullBleed, styles.dialogHost, { zIndex }]}
    >
      <Animated.View pointerEvents="none" style={[styles.backdrop, { backgroundColor: palette.backdrop, opacity: progress }]} />
      <Animated.View
        style={[
          styles.dialog,
          {
            width: dialogWidth,
            height: dialogHeight,
            backgroundColor: palette.bg,
            shadowColor: palette.shadow,
            opacity: progress,
            transform: [{ scale }],
          },
        ]}
      >
        {children}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fullBleed: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  dialogHost: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  dialog: {
    borderRadius: 32,
    overflow: 'hidden',
    shadowOpacity: 0.32,
    shadowRadius: 44,
    shadowOffset: { width: 0, height: 22 },
    elevation: 16,
  },
});

export default TabletDialogOverlay;
