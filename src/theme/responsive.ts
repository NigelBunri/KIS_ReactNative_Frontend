import { useMemo } from 'react';
import { PixelRatio, useWindowDimensions } from 'react-native';

export type KISDeviceClass =
  | 'watch'
  | 'compactPhone'
  | 'phone'
  | 'tablet'
  | 'largeTablet';

export type ResponsiveLayout = {
  width: number;
  height: number;
  shortestSide: number;
  longestSide: number;
  fontScale: number;
  pixelRatio: number;
  deviceClass: KISDeviceClass;
  isWatch: boolean;
  isCompactPhone: boolean;
  isPhone: boolean;
  isTablet: boolean;
  isLargeTablet: boolean;
  isLandscape: boolean;
  pageGutter: number;
  contentMaxWidth: number;
  cardGap: number;
  minTouchTarget: number;
  headerTitleSize: number;
  bodyFontSize: number;
  labelFontSize: number;
  columns: { cards: number; dense: number };

  // ── Tablet shell layout mode ─────────────────────────────────────────
  // Independent of the density-oriented isTablet/isLargeTablet above (which
  // key off shortestSide for phone-density scaling). These key off raw
  // `width` against the KIS tablet-shell breakpoints (768dp / 1024dp) and
  // decide whether the app renders the phone bottom-tab UI or the tablet
  // three-column shell (sidebar + top bar + context panel). Keep these two
  // concerns separate: existing isTablet/isLargeTablet consumers (219 call
  // sites) must not change behavior when these are added.
  isPhoneLayout: boolean;
  isTabletLayout: boolean;
  isDesktopLayout: boolean;
  shellMode: 'phone' | 'tablet' | 'desktop';
  // Actual width available to screen content once the tablet/desktop shell's
  // chrome (Sidebar, ContextPanel) is accounted for — equal to `width` in
  // phone layout. Any component that sizes itself as a fraction of the
  // screen (slide-over panels, etc.) should size off this, not raw `width`
  // — see shellContentWidth()'s doc comment for why.
  shellContentWidth: number;
};

const TABLET_SHELL_BREAKPOINT = 768;
const DESKTOP_SHELL_BREAKPOINT = 1024;

export function getShellMode(width: number): 'phone' | 'tablet' | 'desktop' {
  if (width >= DESKTOP_SHELL_BREAKPOINT) return 'desktop';
  if (width >= TABLET_SHELL_BREAKPOINT) return 'tablet';
  return 'phone';
}

// Mirrors the chrome widths TabletLayout.tsx reserves (Sidebar.tsx's
// SIDEBAR_EXPANDED_WIDTH, ContextPanel.tsx's CONTEXT_PANEL_WIDTH) and its
// MIN_CONTENT_WIDTH cutoff for showing the context panel at all. Duplicated
// as literals here (not imported) because those are UI components that
// themselves import this module — importing them back would cycle. Keep in
// sync if the shell chrome widths change.
//
// This assumes the sidebar is expanded (300dp), which is a conservative
// lower bound: TabletLayout's Sidebar can be collapsed to 88dp by the user,
// giving screens more real room than this estimate — safe, since the
// failure mode being prevented is content sizing itself WIDER than its
// actual (clipped, overflow:hidden) column, not narrower.
const SHELL_SIDEBAR_WIDTH = 300;
const SHELL_CONTEXT_PANEL_WIDTH = 340;
const SHELL_MIN_CONTENT_WIDTH = 480;

export function getShellContentWidth(width: number): number {
  if (getShellMode(width) === 'phone') return width;
  const withoutSidebar = width - SHELL_SIDEBAR_WIDTH;
  const showContextPanel = withoutSidebar - SHELL_CONTEXT_PANEL_WIDTH >= SHELL_MIN_CONTENT_WIDTH;
  return showContextPanel ? withoutSidebar - SHELL_CONTEXT_PANEL_WIDTH : withoutSidebar;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export function getDeviceClass(width: number, height: number): KISDeviceClass {
  const shortestSide = Math.min(width, height);
  if (shortestSide <= 260) return 'watch';
  if (shortestSide < 360) return 'compactPhone';
  if (shortestSide < 600) return 'phone';
  if (shortestSide < 900) return 'tablet';
  return 'largeTablet';
}

export function createResponsiveLayout(width: number, height: number, fontScale = 1): ResponsiveLayout {
  const shortestSide = Math.min(width, height);
  const longestSide = Math.max(width, height);
  const deviceClass = getDeviceClass(width, height);
  const isWatch = deviceClass === 'watch';
  const isCompactPhone = deviceClass === 'compactPhone';
  const isPhone = deviceClass === 'phone';
  const isTablet = deviceClass === 'tablet' || deviceClass === 'largeTablet';
  const isLargeTablet = deviceClass === 'largeTablet';
  const isLandscape = width > height;

  const pageGutter = isWatch ? 8 : isCompactPhone ? 10 : isPhone ? 14 : isTablet ? 22 : 18;
  const contentMaxWidth = isLargeTablet ? 980 : isTablet ? 820 : width;
  const cardGap = isWatch ? 8 : isCompactPhone ? 10 : isPhone ? 12 : 16;
  const minTouchTarget = isWatch ? 36 : isCompactPhone ? 42 : isPhone ? 44 : 48;
  const headerTitleSize = isWatch ? 18 : isCompactPhone ? 22 : isPhone ? 26 : 30;
  const bodyFontSize = isWatch ? 13 : isCompactPhone ? 14 : 15;
  const labelFontSize = isWatch ? 11 : isCompactPhone ? 12 : 13;
  const cards = isLargeTablet ? 3 : isTablet && isLandscape ? 2 : 1;
  const dense = isLargeTablet ? 4 : isTablet ? 3 : isCompactPhone || isWatch ? 1 : 2;

  const shellMode = getShellMode(width);

  return {
    width,
    height,
    shortestSide,
    longestSide,
    fontScale,
    pixelRatio: PixelRatio.get(),
    deviceClass,
    isWatch,
    isCompactPhone,
    isPhone,
    isTablet,
    isLargeTablet,
    isLandscape,
    pageGutter,
    contentMaxWidth,
    cardGap,
    minTouchTarget,
    headerTitleSize: clamp(headerTitleSize / Math.max(fontScale, 1), 16, 32),
    bodyFontSize: clamp(bodyFontSize / Math.max(fontScale, 1), 12, 17),
    labelFontSize: clamp(labelFontSize / Math.max(fontScale, 1), 10, 14),
    columns: { cards, dense },

    isPhoneLayout: shellMode === 'phone',
    isTabletLayout: shellMode === 'tablet',
    isDesktopLayout: shellMode === 'desktop',
    shellMode,
    shellContentWidth: getShellContentWidth(width),
  };
}

export function useResponsiveLayout(): ResponsiveLayout {
  const { width, height, fontScale } = useWindowDimensions();
  return useMemo(
    () => createResponsiveLayout(width, height, fontScale),
    [width, height, fontScale],
  );
}
