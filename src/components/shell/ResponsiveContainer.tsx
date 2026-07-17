// src/components/shell/ResponsiveContainer.tsx
//
// The single decision point: picks MobileLayout / TabletLayout / DesktopLayout
// based on useResponsiveLayout().shellMode (768dp / 1024dp breakpoints, see
// src/theme/responsive.ts). ContextPanelProvider wraps all three
// unconditionally so cross-breakpoint resizes (rotating an iPad, resizing a
// simulator window) never remount the provider and drop in-flight
// registrations — on phone it's simply unused since MobileLayout doesn't
// render a ContextPanel.
import React from 'react';
import { useResponsiveLayout } from '@/theme/responsive';
import { ContextPanelProvider } from './ContextPanelContext';
import { MobileLayout } from './MobileLayout';
import { TabletLayout } from './TabletLayout';
import { DesktopLayout } from './DesktopLayout';
import type { TabletShellChromeProps } from './shellTypes';

export function ResponsiveContainer({
  children,
  ...chrome
}: TabletShellChromeProps & { children: React.ReactNode }) {
  const { shellMode } = useResponsiveLayout();

  return (
    <ContextPanelProvider>
      {shellMode === 'phone' ? (
        <MobileLayout>{children}</MobileLayout>
      ) : shellMode === 'desktop' ? (
        <DesktopLayout {...chrome}>{children}</DesktopLayout>
      ) : (
        <TabletLayout {...chrome}>{children}</TabletLayout>
      )}
    </ContextPanelProvider>
  );
}

export default ResponsiveContainer;
