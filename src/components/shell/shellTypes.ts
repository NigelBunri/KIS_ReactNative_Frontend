// src/components/shell/shellTypes.ts
//
// Shared prop shape for the tablet/desktop chrome (Sidebar only — the main
// content column's own header stays App.tsx's existing GoldenSection, not a
// separate TopBar), reused by TabletLayout, DesktopLayout,
// ResponsiveContainer and TabletShell so the wiring surface AppNavigator has
// to fill in is defined once.
import type { SidebarNavKey } from './Sidebar';

export type TabletShellChromeProps = {
  activeKey: SidebarNavKey | null;
  onNavigate: (key: SidebarNavKey) => void;
  onOpenProfile: () => void;
  badgeCounts?: Partial<Record<SidebarNavKey, number>>;
};
