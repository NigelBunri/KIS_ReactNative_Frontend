// src/components/shell/DesktopLayout.tsx
//
// >=1024dp variant. Per the brief, "large tablet/desktop" is a size variant
// of the same three-column structure (more breathing room), not a
// structurally different layout — so this reuses TabletLayout rather than
// duplicating the sidebar/topbar/panel composition a second time.
import React from 'react';
import { TabletLayout } from './TabletLayout';
import type { TabletShellChromeProps } from './shellTypes';

export function DesktopLayout(props: TabletShellChromeProps & { children: React.ReactNode }) {
  return <TabletLayout {...props} desktop />;
}

export default DesktopLayout;
