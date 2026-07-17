// src/components/shell/MobileLayout.tsx
//
// Phone layout mode: a deliberate passthrough. The phone UI is not being
// redesigned — `children` here is the exact same Tabs.Navigator element
// (with the existing AnimatedKISTabBar wired as its tabBar prop) that
// AppNavigator has always rendered. This file exists so the Mobile/Tablet/
// Desktop choice in ResponsiveContainer is explicit and symmetric, not so
// phone rendering changes.
import React from 'react';

export function MobileLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export default MobileLayout;
