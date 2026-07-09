import React from 'react';
import { SafeAreaView as RNSafeAreaView, type SafeAreaViewProps } from 'react-native-safe-area-context';

// Mirrors GLOBAL_TOP_PADDING in useSafeTopInset.ts — every screen/modal that
// wraps its content in <SafeAreaView> (instead of reading useSafeTopInset()
// directly) goes through this so the app-wide top-spacing dial reaches it
// too. The 5 main-tab gold-header screens don't import from here.
const EXTRA_TOP_PADDING = 20;

function includesTopEdge(edges: SafeAreaViewProps['edges']): boolean {
  if (!edges) return true;
  if (Array.isArray(edges)) return edges.includes('top');
  return (edges as Partial<Record<'top', string>>).top !== 'off';
}

export function SafeAreaView({ style, edges, ...rest }: SafeAreaViewProps) {
  const includesTop = includesTopEdge(edges);
  return (
    <RNSafeAreaView
      {...rest}
      edges={edges}
      style={includesTop ? [style, { paddingTop: EXTRA_TOP_PADDING }] : style}
    />
  );
}

export default SafeAreaView;
