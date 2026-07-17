// src/components/shell/TabletShell.tsx
//
// Single import for AppNavigator.tsx's MainTabs: thin re-export of
// ResponsiveContainer so callers don't need to know it's also the
// ContextPanelProvider boundary. Kept as its own file (per the brief's
// requested file list) even though it currently adds no behavior beyond
// ResponsiveContainer, so future shell-wide concerns (e.g. floating dialog
// host for chat/community overlays) have an obvious home.
import { ResponsiveContainer as TabletShell } from './ResponsiveContainer';

export { TabletShell };
export default TabletShell;
