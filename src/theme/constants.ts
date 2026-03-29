import { Platform } from 'react-native';

/** ─────────────────────────
 *  Color & Theme Foundations
 *  ───────────────────────── */

export type KISTone = 'light' | 'dark';

export const KIS_COLORS = {
  brand: {
    orange: '#FF8A33',
    primary: '#FF8A33',
    purple: '#6C4AF2',
    gradientStart: '#FF8A33',
    gradientEnd: '#6C4AF2',
  },

  // Base swatches per tone (kept compatible with existing keys)
  dark: {
    orange: '#FF8A33',
    bg: '#0F0D14',
    card: '#1A1720',
    text: '#EDEDED',
    subtext: '#B5B2BD',
    inputBg: '#1A1720',
    inputBorder: '#746f81ff',
    divider: '#362b47ff',

    // 🆕 New
    chrome: '#0B0A10',          // outer app chrome/background
    bar: '#14121A',             // bars/strips like tab bar
    shadow: 'rgba(0,0,0,0.9)',  // iOS shadowColor fallback
  },

  light: {
    orange: '#FF8A33',
    bg: '#FFFFFF',
    card: '#F7F6FB',
    text: '#1B1B1F',
    subtext: '#5C5A66',
    inputBg: '#FFFFFF',
    inputBorder: '#E6E2EE',
    divider: '#EAE7F2',

    // 🆕 New
    chrome: '#F5F5FA',
    bar: '#E7E4F0',
    shadow: 'rgba(0,0,0,0.35)',
  },

  states: {
    success: '#22C55E',
    warning: '#F59E0B',
    danger: '#EF4444',
    info: '#0EA5E9',
  },
} as const;

/** Semantic palette derived each render; change here, not in components. */
export type KISPalette = {
  // Surfaces
  bg: string;
  surface: string;
  surfaceElevated: string;
  overlay: string;

  // Extra surfaces used by navigation/UI chrome
  chrome: string;
  bar: string;
  card: string;

  // Text
  text: string;
  subtext: string;
  mutedText: string;        // 🆕 alias used by chat/request UI
  inverseText: string;

  // Inputs & borders
  inputBg: string;
  inputBorder: string;
  border: string;
  borderMuted: string;
  divider: string;

  // Brand
  primary: string;
  secondary: string;
  gradientStart: string;
  gradientEnd: string;

  // Brand tints/intensities used in UI
  primarySoft: string;
  primaryStrong: string;

  // States
  success: string;
  warning: string;
  danger: string;
  info: string;

  // State-aware borders
  borderDanger: string;

  // Backdrop for modals/popovers
  backdrop: string;

  // Shadow color (iOS) / fallback for themed shadows
  shadow: string;

  // 🆕 Common extra fields already used in screens
  onPrimary: string;
  onPrimaryMuted: string;
  error: string;
  disabled: string;

  // 🆕 Chat-specific fields
  chatBg: string;           // main chat background
  chatHeaderBg: string;     // chat header bar
  chatComposerBg: string;   // composer bar background

  composerInputBg: string;
  composerInputBorder: string;

  outgoingBubble: string;
  incomingBubble: string;

  avatarBg: string;
  onAvatar: string;
  onHeader: string;
  headerSubtext: string;

  timestampBg: string;
  onTimestamp: string;
  readStatus: string;

  // Compatibility aliases used across legacy screens
  muted: string;
  accent: string;
  accentPrimary: string;
  surfaceSoft: string;
  successSoft: string;
  dangerSoft: string;

  [key: string]: string | undefined;
};

export const createPalette = (tone: KISTone): KISPalette => {
  const c = KIS_COLORS;
  const base = tone === 'dark' ? c.dark : c.light;

  // sensible elevated default when not provided by swatches
  const elevated = tone === 'dark' ? '#3c3847ff' : '#e6e6e9ff';

  // soft tint derived from brand primary (alpha works well across themes)
  const primarySoft =
    tone === 'dark'
      ? 'rgba(255,138,51,0.16)'
      : 'rgba(255,138,51,0.15)';

  // stronger color used for text/icons on top of primarySoft
  const primaryStrong = c.brand.primary;

  // dimming veil for modals
  const backdrop =
    tone === 'dark'
      ? 'rgba(0,0,0,0.55)'
      : 'rgba(0,0,0,0.25)';

  // 🆕 KIS-style chat colors using both gradientStart & gradientEnd
  // - Light: soft tints of orange (sender) & purple (receiver)
  // - Dark: richer, deeper variants of orange & purple
  // 🆕 KIS-style chat colors using deeper, desaturated variants in dark mode
  const chatBg =
    tone === 'dark'
      ? '#0C0B0F'          // nearly-black violet/charcoal base
      : '#FFF5EE';         // light warm background

  // Outgoing (sender) bubble → dark muted burnt-orange
  const outgoingBubble =
    tone === 'dark'
      ? '#3F2A1F'          // extremely dark warm orange tone
      : '#FFE3CF';         // light orange-tinted bubble

  // Incoming (receiver) bubble → deep muted purple/indigo
  const incomingBubble =
    tone === 'dark'
      ? '#1E1A2B'          // deep desaturated purple, almost charcoal
      : '#ECE6FF';         // light lavender bubble

  const chatHeaderBg = base.card;
  const chatComposerBg = base.card;

  const composerInputBg = base.inputBg;
  const composerInputBorder = base.inputBorder;

  const avatarBg =
    tone === 'dark'
      ? base.chrome
      : base.card;

  const onAvatar = base.text;
  const onHeader = base.text;
  const headerSubtext = base.subtext;

  const timestampBg =
    tone === 'dark'
      ? 'rgba(0,0,0,0.6)'
      : 'rgba(0,0,0,0.4)';

  const onTimestamp = '#FFFFFF';

  const readStatus =
    tone === 'dark'
      ? '#8B7CFB'
      : c.brand.purple;

  const onPrimary = '#FFFFFF';
  const onPrimaryMuted =
    tone === 'dark'
      ? '#B3E5FC'
      : '#E0E0E0';

  const disabled =
    tone === 'dark'
      ? 'rgba(255,255,255,0.30)'
      : 'rgba(0,0,0,0.35)';

  const successSoft =
    tone === 'dark'
      ? 'rgba(34,197,94,0.22)'
      : 'rgba(34,197,94,0.14)';
  const dangerSoft =
    tone === 'dark'
      ? 'rgba(239,68,68,0.22)'
      : 'rgba(239,68,68,0.14)';

  return {
    // Core surfaces
    bg: base.bg,
    surface: base.card,
    surfaceElevated: elevated,
    overlay:
      tone === 'dark'
        ? 'rgba(0,0,0,0.5)'
        : 'rgba(0,0,0,0.25)',

    // Extra surfaces
    chrome: base.chrome,
    bar: base.bar,
    card: base.card,

    // Text
    text: base.text,
    subtext: base.subtext,
    mutedText: base.subtext,     // 🆕 keeps request banners aligned with subtext
    inverseText: tone === 'dark' ? '#0F0D14' : '#FFFFFF',

    // Inputs & borders
    inputBg: base.inputBg,
    inputBorder: base.inputBorder,
    border: base.inputBorder,
    borderMuted: tone === 'dark' ? '#272530' : '#EFEAF6',
    divider: base.divider,

    // Brand
    primary: c.brand.primary,
    secondary: c.brand.purple,
    gradientStart: c.brand.gradientStart,
    gradientEnd: c.brand.gradientEnd,

    // Brand tints/intensities
    primarySoft,
    primaryStrong,

    // States
    success: c.states.success,
    warning: c.states.warning,
    danger: c.states.danger,
    info: c.states.info,

    // State-aware borders
    borderDanger: tone === 'dark' ? '#7A1F29' : '#F3B2B7',

    // Backdrop + shadow
    backdrop,
    shadow: base.shadow,

    // Extra commonly used fields
    onPrimary,
    onPrimaryMuted,
    error: c.states.danger,
    disabled,

    // Chat-specific
    chatBg,
    chatHeaderBg,
    chatComposerBg,

    composerInputBg,
    composerInputBorder,

    outgoingBubble,
    incomingBubble,

    avatarBg,
    onAvatar,
    onHeader,
    headerSubtext,

    timestampBg,
    onTimestamp,
    readStatus,

    // Compatibility aliases
    muted: base.subtext,
    accent: c.brand.primary,
    accentPrimary: c.brand.primary,
    surfaceSoft: elevated,
    successSoft,
    dangerSoft,
  };
};

/** ─────────────────────────
 *  Scales & Global Tokens
 *  ───────────────────────── */

export const KIS_TOKENS = {
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    '2xl': 32,
    '3xl': 40,
  },

  radius: {
    sm: 8,
    md: 10,
    lg: 14,
    xl: 20,
    pill: 999,
  },

  controlHeights: { sm: 40, md: 52, lg: 60 },

  typography: {
    h1: 28,
    h2: 24,
    h3: 20,
    title: 18,
    body: 16,
    input: 16,
    label: 14,
    helper: 13,
    tiny: 12,
    weight: {
      regular: '400' as const,
      medium: '600' as const,
      semibold: '600' as const,
      bold: '700' as const,
      extrabold: '800' as const,
    },
  },

  elevation: {
    card: Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.12,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
      },
      android: { elevation: 6 },
      default: {},
    }),
    popover: Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 10 },
      },
      android: { elevation: 10 },
      default: {},
    }),
    modal: Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.28,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 14 },
      },
      android: { elevation: 16 },
      default: {},
    }),
  },

  opacity: { disabled: 0.5, pressed: 0.72, focus: 0.88, subtle: 0.64 },

  durations: { fast: 120, normal: 200, slow: 300 },

  easing: {
    standard: 'cubic-bezier(0.2, 0, 0, 1)',
    emphasized: 'cubic-bezier(0.2, 0, 0, 1)',
  },

  zIndex: { base: 0, header: 10, overlay: 20, modal: 30, toast: 40 },
} as const;

export const kisElevation = {
  card: {
    ...(KIS_TOKENS.elevation.card as object),
  },
};

/** Backwards-compat radius export (kept to avoid refactors) */
export const kisRadius = {
  xl: KIS_TOKENS.radius.xl,
  lg: KIS_TOKENS.radius.lg,
  md: KIS_TOKENS.radius.md,
  sm: KIS_TOKENS.radius.sm,
};

/** ─────────────────────────
 *  Component Recipes
 *  ───────────────────────── */

export const inputStyles = (tone: KISTone) => {
  const palette = createPalette(tone);
  return {
    container: {
      height: KIS_TOKENS.controlHeights.md,
      borderRadius: KIS_TOKENS.radius.lg,
      borderWidth: 2,
      borderColor: palette.inputBorder,
      backgroundColor: palette.inputBg,
      paddingHorizontal: 12,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
    },
    text: {
      color: palette.text,
      fontSize: KIS_TOKENS.typography.input,
      flex: 1,
    },
    errorBorder: {
      borderColor: palette.borderDanger,
    },
  };
};
