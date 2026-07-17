// src/components/shell/TabletLayout.tsx
//
// The three-column tablet shell: permanent Sidebar, the main content column
// (each screen's own existing gold GoldenSection header still renders above
// it, unchanged — see App.tsx's GoldenSection — no separate TopBar duplicate
// here), and the right-hand ContextPanel — matching large_screen_size_design.png.
// `children` is the existing MainTabs Tabs.Navigator element (screens/logic
// untouched); this component only supplies the chrome around it.
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { Sidebar, SIDEBAR_COLLAPSED_WIDTH, SIDEBAR_EXPANDED_WIDTH } from './Sidebar';
import { ContextPanel, CONTEXT_PANEL_WIDTH } from './ContextPanel';
import type { TabletShellChromeProps } from './shellTypes';

// Below this, content built for phone widths (e.g. ProfileScreen's account
// tier / upgrade-account row) starts overflowing or getting clipped once
// it's squeezed into a column narrower than it was ever designed for — the
// app is currently portrait-only, so a fixed Sidebar (300dp) + ContextPanel
// (340dp) on an 11" iPad portrait (834dp) left only ~194dp for content,
// narrower than any phone. Chosen comfortably above the widest common phone
// width (~430dp) so nothing that already works on phone gets more cramped
// than it already handles there.
const MIN_CONTENT_WIDTH = 480;

export function TabletLayout({
  children,
  desktop = false,
  ...chrome
}: TabletShellChromeProps & { children: React.ReactNode; desktop?: boolean }) {
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const [collapsed, setCollapsed] = useState(false);

  const sidebarWidth = collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH;
  // Yield the context panel back to content rather than always reserving its
  // fixed width regardless of what's left — see MIN_CONTENT_WIDTH above.
  const showContextPanel = responsive.width - sidebarWidth - CONTEXT_PANEL_WIDTH >= MIN_CONTENT_WIDTH;

  return (
    <View style={[styles.wrap, { backgroundColor: palette.bg }]}>
      <Sidebar
        activeKey={chrome.activeKey}
        onNavigate={chrome.onNavigate}
        onOpenProfile={chrome.onOpenProfile}
        badgeCounts={chrome.badgeCounts}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((prev) => !prev)}
      />

      <View style={styles.mainColumn}>
        <View
          style={[
            styles.content,
            {
              paddingHorizontal: desktop ? Math.max(responsive.pageGutter, 24) : responsive.pageGutter,
              maxWidth: desktop && showContextPanel ? 1100 : undefined,
              alignSelf: desktop && showContextPanel ? 'center' : 'stretch',
              width: desktop && showContextPanel ? '100%' : undefined,
            },
          ]}
        >
          {children}
        </View>
      </View>

      {showContextPanel ? <ContextPanel /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    flexDirection: 'row',
  },
  mainColumn: {
    flex: 1,
    // React Native doesn't clip a child's overflow by default — some nested
    // screen content (phone-era components that size themselves off raw
    // device width rather than their actual flex-allocated parent width)
    // was rendering wider than this column and visually spilling into the
    // ContextPanel sitting to its right. Clipping at the column boundary
    // contains that regardless of which nested component is responsible.
    overflow: 'hidden',
  },
  content: {
    flex: 1,
  },
});

export default TabletLayout;
