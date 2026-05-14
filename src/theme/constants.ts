import { Platform } from 'react-native';

/** ─────────────────────────
 *  Color & Theme Foundations
 *  ───────────────────────── */

export type KISTone = 'light' | 'dark';

export const KIS_COLORS = {
  brand: {
    // Royal gold is a metallic range, not a single flat color.
    goldHighlight: '#FFF4B8',
    goldLight: '#F4D77A',
    gold: '#C9A24A',
    goldRose: '#D6B15E',
    goldDeep: '#9A6A14',
    goldShadow: '#5E3B0A',
    goldSoft: '#FFF2C7',
    goldMuted: '#E6D7B2',
    goldGradientStart: '#FFF4B8',
    goldGradientMid: '#C9A24A',
    goldGradientEnd: '#8A5A12',
    purple: '#4B1D78',
    purpleDeep: '#2A0F45',
    purpleSoft: '#EEE4FA',
    imperialPurple: '#6E35B7',
    ivory: '#FFFBF2',
    parchment: '#F8F1E3',
    royalInk: '#17111F',
    primary: '#9A6A14',
    secondary: '#4B1D78',
    // Deprecated compatibility alias. New code should use gold/primary.
    orange: '#9A6A14',
    gradientStart: '#FFF4B8',
    gradientEnd: '#4B1D78',
  },

  // Base swatches per tone (kept compatible with existing keys)
  dark: {
    orange: '#9A6A14',
    bg: '#09070D',
    card: '#15101F',
    text: '#F7F1E3',
    subtext: '#C8BFD6',
    inputBg: '#1B1428',
    inputBorder: '#8A5A12',
    divider: '#5E3B0A',

    // New
    chrome: '#07050B',          // outer app chrome/background
    bar: '#120C1C',             // bars/strips like tab bar
    shadow: 'rgba(0,0,0,0.92)', // iOS shadowColor fallback
  },

  light: {
    orange: '#7A4B3E',
    bg: '#FFFFFF',
    card: '#FFFDF8',
    text: '#4B2F2A',
    subtext: '#8A6557',
    inputBg: '#FFFDF8',
    inputBorder: '#D9A875',
    divider: '#E7C7A1',

    // Reference-inspired light mode: cream pages, coffee-brown controls, tan-gold accents.
    chrome: '#F2D8B8',
    bar: '#FFFFFF',
    shadow: 'rgba(90,55,45,0.24)',
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
  goldHighlight: string;
  goldLight: string;
  gold: string;
  goldRose: string;
  goldDeep: string;
  goldShadow: string;
  goldSoft: string;
  goldMuted: string;
  goldGradientStart: string;
  goldGradientMid: string;
  goldGradientEnd: string;
  purple: string;
  purpleDeep: string;
  purpleSoft: string;
  imperialPurple: string;
  ivory: string;
  parchment: string;
  royalInk: string;

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
  const elevated = tone === 'dark' ? '#3c3847ff' : '#F4DDBD';

  const lightCoffeePrimary = '#7A4B3E';
  const lightCoffeeStrong = '#5A372D';
  const lightCoffeeSoft = '#F2D8B8';
  const lightTanGold = '#D9A875';
  const darkReadableGold = '#E7C76D';
  const darkReadableGoldStrong = '#FFF0A8';

  // Soft tint derived from the active primary color.
  const primarySoft =
    tone === 'dark'
      ? 'rgba(201,162,74,0.20)'
      : lightCoffeeSoft;

  // stronger color used for text/icons on top of primarySoft
  const primaryStrong = tone === 'dark' ? darkReadableGoldStrong : lightCoffeeStrong;

  // dimming veil for modals
  const backdrop =
    tone === 'dark'
      ? 'rgba(0,0,0,0.55)'
      : 'rgba(0,0,0,0.25)';

  // Royal chat colors using gold for outgoing and purple for incoming.
  const chatBg =
    tone === 'dark'
      ? '#09070D'
      : '#FFFFFF';

  const outgoingBubble =
    tone === 'dark'
      ? '#33260F'
      : '#F2D8B8';

  const incomingBubble =
    tone === 'dark'
      ? '#20112F'
      : '#FFFDF8';

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
      ? lightTanGold
      : lightCoffeePrimary;

  const onPrimary = tone === 'dark' ? '#FFFFFF' : '#FFFBF2';
  const onPrimaryMuted =
    tone === 'dark'
      ? c.brand.goldSoft
      : '#F6E8BD';

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
    inverseText: tone === 'dark' ? c.brand.royalInk : '#FFFFFF',

    // Inputs & borders
    inputBg: base.inputBg,
    inputBorder: base.inputBorder,
    border: base.inputBorder,
    borderMuted: tone === 'dark' ? c.brand.goldShadow : '#E7C7A1',
    divider: base.divider,

    // Brand
    primary: tone === 'dark' ? darkReadableGold : lightCoffeePrimary,
    secondary: tone === 'dark' ? c.brand.secondary : lightCoffeeStrong,
    gradientStart: tone === 'dark' ? c.brand.gradientStart : '#F2D8B8',
    gradientEnd: tone === 'dark' ? c.brand.gradientEnd : lightCoffeePrimary,
    goldHighlight: c.brand.goldHighlight,
    goldLight: c.brand.goldLight,
    gold: tone === 'dark' ? darkReadableGold : lightTanGold,
    goldRose: c.brand.goldRose,
    goldDeep: tone === 'dark' ? darkReadableGold : lightCoffeePrimary,
    goldShadow: tone === 'dark' ? '#B9852E' : c.brand.goldShadow,
    goldSoft: c.brand.goldSoft,
    goldMuted: c.brand.goldMuted,
    goldGradientStart: c.brand.goldGradientStart,
    goldGradientMid: c.brand.goldGradientMid,
    goldGradientEnd: c.brand.goldGradientEnd,
    purple: c.brand.purple,
    purpleDeep: c.brand.purpleDeep,
    purpleSoft: c.brand.purpleSoft,
    imperialPurple: c.brand.imperialPurple,
    ivory: c.brand.ivory,
    parchment: c.brand.parchment,
    royalInk: c.brand.royalInk,

    // Brand tints/intensities
    primarySoft,
    primaryStrong,

    // States
    success: c.states.success,
    warning: c.states.warning,
    danger: c.states.danger,
    info: c.states.info,

    // State-aware borders
    borderDanger: tone === 'dark' ? '#7A1F29' : '#C46A74',

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
    accent: tone === 'dark' ? darkReadableGold : lightCoffeePrimary,
    accentPrimary: tone === 'dark' ? darkReadableGoldStrong : lightCoffeePrimary,
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
