import { Platform } from 'react-native';
import { APP_COLOR_THEMES, DEFAULT_THEME_ID, getThemeById, type AppColorTheme } from '@/constants/appColorThemes';

/** ─────────────────────────
 *  Color & Theme Foundations
 *  ───────────────────────── */

export type KISTone = 'light' | 'dark';

/** The 8 accent colors exposed in the app's own Appearance settings — Gold
 *  (the default, first in the list) plus the 7 most broadly recognizable
 *  colors from the larger Partner Pro set in appColorThemes.ts. Re-exported
 *  from here (rather than duplicated) so the settings picker and the palette
 *  generator below always agree on exactly which colors exist. */
export const KIS_ACCENT_THEMES: AppColorTheme[] = (() => {
  const gold = getThemeById(DEFAULT_THEME_ID);
  const pickIds = ['royal_blue', 'emerald', 'crimson', 'amber', 'teal', 'rose', 'violet'];
  const rest = pickIds
    .map((id) => APP_COLOR_THEMES.find((t) => t.id === id))
    .filter((t): t is AppColorTheme => !!t);
  return [gold, ...rest];
})();

// ---- small hex color helpers, used only to derive accent-tinted palette
// values below (lighten/darken toward white or black, and rgba() tints).
// Deliberately simple linear channel blending rather than true HSL math —
// good enough for UI tints and much easier to reason about/verify by eye.
const clampChannel = (n: number) => Math.max(0, Math.min(255, Math.round(n)));

const hexToRgbChannels = (hex: string): [number, number, number] => {
  const normalized = String(hex || '').trim().replace('#', '');
  const full = normalized.length === 3
    ? normalized.split('').map((c) => c + c).join('')
    : normalized;
  if (full.length !== 6) return [0, 0, 0];
  return [
    clampChannel(parseInt(full.slice(0, 2), 16)),
    clampChannel(parseInt(full.slice(2, 4), 16)),
    clampChannel(parseInt(full.slice(4, 6), 16)),
  ];
};

const channelsToHex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((c) => clampChannel(c).toString(16).padStart(2, '0')).join('')}`;

/** Blends `hex` toward [255,255,255] (amount>0, lighten) or [0,0,0] (amount<0, darken). */
export const shade = (hex: string, amount: number): string => {
  const [r, g, b] = hexToRgbChannels(hex);
  const target = amount >= 0 ? 255 : 0;
  const t = Math.min(1, Math.abs(amount));
  return channelsToHex(
    r + (target - r) * t,
    g + (target - g) * t,
    b + (target - b) * t,
  );
};

export const withAlpha = (hex: string, alpha: number): string => {
  const [r, g, b] = hexToRgbChannels(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

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
    // Near-black with the faintest warm undertone - less purple than before,
    // so content areas feel calm rather than atmospheric.
    bg: '#0A090F',
    card: '#111117',            // neutral dark, not purple-tinted
    text: '#F0EBE1',            // softer cream - readable but less glaring
    subtext: '#9E9AA8',         // neutral grey-purple, not lavender
    inputBg: '#16141C',
    inputBorder: '#8A5A12',
    divider: '#242230',         // very subtle cool-dark divider, not amber

    chrome: '#07060C',
    bar: '#0E0C14',
    shadow: 'rgba(0,0,0,0.88)',
  },

  light: {
    orange: '#7A4B3E',
    // Soft warm neutral instead of stark white - easier on the eyes.
    bg: '#F8F6F3',
    card: '#F2EFE9',            // neutral warm cream, less yellow than before
    text: '#2A2420',            // dark neutral brown, less red
    subtext: '#706A64',         // neutral grey-brown, not warm-saturated
    inputBg: '#F8F6F3',
    inputBorder: '#C9A87A',     // slightly softened gold border
    divider: '#DDD8D0',         // neutral warm grey, not amber

    // Less orange chrome - warm neutral that doesn't compete with the gold headers.
    chrome: '#EDE8E0',
    bar: '#F8F6F3',
    shadow: 'rgba(60,45,35,0.18)',
  },

  states: {
    success: '#22C55E',
    warning: '#F59E0B',
    danger: '#EF4444',
    info: '#0EA5E9',
  },
} as const;

export const KIS_ROYAL_GRADIENTS = {
  goldLight: ['#FFF7C8', '#E6C66B', '#B9852E', '#70450D'],
  goldDark: ['#3F2506', '#6F4515', '#9A6A14', '#5E3B0A'],
  // For screen headers that bleed behind the transparent status bar: gold at
  // the top so the status bar area shows the app's gold theme, not a dark void.
  goldHeader: ['#C9A24A', '#9A6A14', '#6F4515', '#3F2506'] as const,
  goldPressed: ['#6B4212', '#9A6A14', '#D6B15E', '#5E3B0A'],
  purpleLight: ['#EEE4FA', '#6E35B7', '#2A0F45'],
  purpleDark: ['#2A0F45', '#4B1D78', '#09070D'],
  creamSurface: ['#FFFFFF', '#FFFBF2', '#F8F1E3'],
  // Subtle brand wash for the 5 main-tab header sections: gold fading into
  // royal purple, keeping lightness roughly constant across the gradient (in
  // each theme) so a single flat text color (palette.text/subtext) stays
  // readable everywhere on it, unlike goldHeader's high-contrast swing which
  // needed a dedicated always-white "onGold" text color.
  brandHeaderLight: ['#FFF2C7', '#F7ECEF', '#EEE4FA'] as const,
  brandHeaderDark: ['#3A2A12', '#2A1E27', '#1E1536'] as const,
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
  royalSurface: string;
  royalSurfaceAlt: string;
  royalPanel: string;
  royalPanelText: string;
  royalPanelSubtext: string;
  goldReadable: string;
  onGold: string;
  goldBorder: string;
  selectedBg: string;
  selectedText: string;
  selectedBorder: string;
  badgeBg: string;
  badgeText: string;
  focusRing: string;

  // Brand tints/intensities used in UI
  primaryWeak: string;    // very light tint - subtler than primarySoft
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

/** The original, hand-tuned gold/coffee-brown palette — unchanged from
 *  before accent colors existed. Every other accent starts from this same
 *  base (so all the neutral surface/text/chat/state colors stay identical
 *  across every accent) and then has its brand-specific keys overridden by
 *  createPalette below. Kept private so accentId is never forgotten at a
 *  call site — always go through createPalette. */
const createBasePalette = (tone: KISTone): KISPalette => {
  const c = KIS_COLORS;
  const base = tone === 'dark' ? c.dark : c.light;

  // Elevated surface - neutral, not purple-saturated in dark mode
  const elevated = tone === 'dark' ? '#1C1A22' : '#EDE9E2';

  // KIS brand colors - same hex in both themes for fills and accents
  const coffeePrimary = '#7A4B3E';
  const coffeeStrong = '#5A372D';
  const tanGold = '#D9A875';
  const coffeeDivider = '#E7C7A1';
  const lightRoyalPurple = '#4B1D78';
  const lightRoyalPurpleSoft = '#F4ECFF';
  const lightRoyalCream = '#FFF9EE';

  // In dark mode, fills use the same coffee-brown/tan-gold as light theme (paired with
  // white text via onPrimary). For bare text/icons drawn directly on the near-black bg,
  // tanGold (#D9A875) is the right choice - it IS the light theme's gold and passes
  // 9.5:1 contrast against #09070D, so it looks identical to what you see in light mode.
  const goldOnDark = tanGold;

  const primaryWeak =
    tone === 'dark'
      ? 'rgba(122,75,62,0.08)'   // very faint coffee-brown tint on dark bg
      : 'rgba(217,168,117,0.10)'; // very faint tan-gold tint on light bg

  const primarySoft =
    tone === 'dark'
      ? 'rgba(122,75,62,0.18)'   // coffee-brown tint on dark bg
      : 'rgba(217,168,117,0.24)'; // tan-gold tint on light bg

  const primaryStrong = tone === 'dark' ? goldOnDark : coffeeStrong;

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
  // Matches the `inputBorder` key below exactly (not base.inputBorder
  // directly), so an accent override applied to one applies to both —
  // otherwise the chat composer's own input border stayed gold-tinted no
  // matter what accent was picked, since it read the raw un-accented value.
  const composerInputBorder = tone === 'dark' ? tanGold : base.inputBorder;

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

  // A distinct teal-blue so "read" ticks are clearly different from grey "delivered" ticks
  const readStatus = tone === 'dark' ? '#34D1BF' : '#1A9E8F';

  // Primary and metallic dark-gold fills use white text/icons. Very light gold
  // chips should override this locally with royalInk.
  const onPrimary = '#FFFFFF';
  const onGold = '#FFFFFF';
  const onPrimaryMuted = '#F6E8BD';

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

    // Inputs & borders - tan-gold (#D9A875) is the light-theme border color and reads
    // well at 9.5:1 on dark bg, so we use it directly in both themes.
    inputBg: base.inputBg,
    inputBorder: tone === 'dark' ? tanGold : base.inputBorder,
    border: tone === 'dark' ? tanGold : base.inputBorder,
    borderMuted: tone === 'dark' ? 'rgba(217,168,117,0.38)' : coffeeDivider,
    divider: tone === 'dark' ? 'rgba(231,199,161,0.30)' : base.divider,

    // Brand - same brown-gold hex in both themes
    primary: coffeePrimary,
    secondary: tone === 'dark' ? c.brand.secondary : coffeeStrong,
    gradientStart: tone === 'dark' ? c.brand.gradientStart : '#F2D8B8',
    gradientEnd: tone === 'dark' ? c.brand.gradientEnd : coffeePrimary,
    goldHighlight: c.brand.goldHighlight,
    goldLight: c.brand.goldLight,
    gold: tanGold,
    goldRose: c.brand.goldRose,
    goldDeep: coffeePrimary,
    goldShadow: tone === 'dark' ? '#B9852E' : c.brand.goldShadow,
    goldSoft: tone === 'dark' ? 'rgba(217,168,117,0.15)' : c.brand.goldSoft,
    goldMuted: tone === 'dark' ? 'rgba(217,168,117,0.35)' : c.brand.goldMuted,
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
    royalSurface: tone === 'dark' ? '#0F0D16' : '#F8F6F3',
    royalSurfaceAlt: tone === 'dark' ? '#161320' : lightRoyalCream,
    royalPanel: tone === 'dark' ? '#1A1226' : lightRoyalPurple,
    royalPanelText: tone === 'dark' ? c.brand.goldHighlight : '#FFFFFF',
    royalPanelSubtext: tone === 'dark' ? c.brand.goldSoft : '#F8F1E3',
    // goldReadable: tan-gold text on dark bg (9.5:1 contrast) - same color family as light theme
    goldReadable: tone === 'dark' ? goldOnDark : '#5E3B0A',
    onGold,
    goldBorder: tone === 'dark' ? tanGold : '#B9852E',
    selectedBg: tone === 'dark' ? 'rgba(217,168,117,0.15)' : lightRoyalPurpleSoft,
    selectedText: tone === 'dark' ? goldOnDark : lightRoyalPurple,
    selectedBorder: tone === 'dark' ? tanGold : '#B9852E',
    badgeBg: tone === 'dark' ? coffeePrimary : coffeeStrong,
    badgeText: '#FFFFFF',
    focusRing: tone === 'dark' ? 'rgba(217,168,117,0.70)' : 'rgba(75,29,120,0.36)',

    // Brand tints/intensities
    primaryWeak,
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
    accent: coffeePrimary,
    // accentPrimary is used as bare text/icon on the page bg, so dark mode uses
    // goldOnDark (= tanGold) which is the same color family but readable on near-black.
    accentPrimary: tone === 'dark' ? goldOnDark : coffeePrimary,
    surfaceSoft: elevated,
    successSoft,
    dangerSoft,
  };
};

/**
 * Derives the brand-specific slice of a palette from one accent color's
 * `primary` hex, mirroring the shape of the hand-tuned gold values above
 * (a dark shade for primary/badges/text-on-light-bg, a mid shade for the
 * accent itself, soft rgba tints for weak/soft backgrounds). Applied as an
 * override on top of createBasePalette's result, so every truly neutral
 * surface, text, and state color is identical across every accent — only
 * the "what color is the brand" keys change.
 *
 * This includes every key that carried a hardcoded gold/tan/coffee cast in
 * the base palette, not just the keys literally named gold*: dividers,
 * muted borders, the composer input border, the selected-item highlight in
 * dark mode, and the outgoing chat bubble all used a fixed tan color
 * regardless of accent until this override list covered them too — which
 * is exactly what made a non-gold accent still look "goldenish" in the
 * borders and backgrounds around it, even once the headers/buttons/tab bar
 * had already switched color.
 *
 * The app's secondary royal-purple accents (purple*, royal*, incomingBubble,
 * and selectedBg/Text/Border's LIGHT-mode branch specifically) are still
 * deliberately left untouched: they're the app's fixed complementary color
 * family — e.g. "your message is accent-colored, their message is neutral
 * purple" — not a gold-specific choice that needs re-deriving per accent.
 */
const applyAccentOverride = (base: KISPalette, tone: KISTone, accent: AppColorTheme): KISPalette => {
  const p = accent.primary;
  const deep = shade(p, tone === 'dark' ? -0.15 : -0.35); // dark, readable shade for primary/badges
  const light = shade(p, 0.35);
  const highlight = shade(p, 0.55);
  const readable = tone === 'dark' ? shade(p, 0.15) : shade(p, -0.4);
  const border = tone === 'dark' ? shade(p, 0.1) : shade(p, -0.2);

  return {
    ...base,
    primary: deep,
    secondary: base.secondary,
    gradientStart: light,
    gradientEnd: deep,
    goldHighlight: highlight,
    goldLight: light,
    gold: p,
    goldRose: shade(p, 0.1),
    goldDeep: deep,
    goldShadow: shade(p, -0.55),
    goldSoft: withAlpha(p, tone === 'dark' ? 0.15 : 0.14),
    goldMuted: withAlpha(p, tone === 'dark' ? 0.35 : 0.30),
    goldGradientStart: light,
    goldGradientMid: p,
    goldGradientEnd: deep,
    goldReadable: readable,
    goldBorder: border,
    badgeBg: deep,
    focusRing: withAlpha(p, tone === 'dark' ? 0.70 : 0.45),
    primaryWeak: withAlpha(p, tone === 'dark' ? 0.08 : 0.10),
    primarySoft: withAlpha(p, tone === 'dark' ? 0.18 : 0.24),
    primaryStrong: tone === 'dark' ? readable : deep,
    accent: deep,
    accentPrimary: tone === 'dark' ? readable : deep,
    inputBorder: tone === 'dark' ? p : border,
    border: tone === 'dark' ? p : border,
    composerInputBorder: tone === 'dark' ? p : border,
    // Every card/list divider and muted border in the app read one of
    // these two — a fixed tan rgba in dark mode, a fixed coffee hex in
    // light mode — regardless of accent, which is why dividers/outlines
    // kept looking gold-tinted even after the branded chrome switched.
    divider: tone === 'dark' ? withAlpha(p, 0.30) : base.divider,
    borderMuted: tone === 'dark' ? withAlpha(p, 0.38) : withAlpha(p, 0.35),
    // Selected-item highlight: only the dark-mode branch was gold-tinted
    // (light mode already used the fixed purple family, kept as-is here).
    selectedBg: tone === 'dark' ? withAlpha(p, 0.15) : base.selectedBg,
    selectedText: tone === 'dark' ? readable : base.selectedText,
    selectedBorder: tone === 'dark' ? p : base.selectedBorder,
    // The soft cream/tan text tone meant to sit on a primary-colored fill.
    onPrimaryMuted: shade(p, tone === 'dark' ? 0.5 : 0.45),
    // Outgoing chat bubble: "your messages are accent-colored" — the
    // incoming bubble stays the fixed neutral purple/white pairing.
    outgoingBubble: tone === 'dark' ? shade(p, -0.55) : shade(p, 0.55),
  };
};

/** Builds the full semantic palette for a given tone and accent color.
 *  `accentId` defaults to the gold KIS theme, so every existing call site
 *  that doesn't know about accents keeps rendering exactly as before. */
export const createPalette = (tone: KISTone, accentId: string = DEFAULT_THEME_ID): KISPalette => {
  const base = createBasePalette(tone);
  if (!accentId || accentId === DEFAULT_THEME_ID) return base;
  const accent = getThemeById(accentId);
  return applyAccentOverride(base, tone, accent);
};

export type KISAccentGradients = {
  /** Bright-to-dark 4 stops for full-bleed "Golden Section" headers, the
   *  shared button, and other chrome that always uses the same gradient
   *  regardless of tone (mirrors KIS_ROYAL_GRADIENTS.goldHeader's shape). */
  header: readonly [string, string, string, string];
  /** Tone-branched 4 stops for smaller accents like the selected tab icon
   *  circle and sidebar highlights (mirrors goldLight/goldDark's shapes). */
  tabSelected: readonly [string, string, string, string];
};

/**
 * The gradient equivalent of createPalette above — KIS_ROYAL_GRADIENTS is
 * the fixed gold definition; this derives the same two gradient shapes for
 * whichever accent is active, so headers/buttons/tab-bar chrome change
 * color along with the flat palette values instead of staying gold no
 * matter what the user picks. Gold itself is passed through untouched
 * (same values as KIS_ROYAL_GRADIENTS), so nothing changes for the default.
 */
export const getAccentGradients = (tone: KISTone, accentId: string = DEFAULT_THEME_ID): KISAccentGradients => {
  if (!accentId || accentId === DEFAULT_THEME_ID) {
    return {
      header: KIS_ROYAL_GRADIENTS.goldHeader,
      tabSelected: tone === 'dark' ? (KIS_ROYAL_GRADIENTS.goldDark as any) : (KIS_ROYAL_GRADIENTS.goldLight as any),
    };
  }
  const accent = getThemeById(accentId);
  const p = accent.primary;
  return {
    header: [p, shade(p, -0.25), shade(p, -0.45), shade(p, -0.65)],
    tabSelected: tone === 'dark'
      ? [shade(p, -0.65), shade(p, -0.35), shade(p, -0.1), shade(p, -0.55)]
      : [shade(p, 0.55), shade(p, 0.15), p, shade(p, -0.4)],
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

  /** Breathing room added below the real safe-area top inset for screen
   *  headers. Never hardcode top spacing - always `insets.top + this`. */
  SCREEN_HEADER_TOP_PADDING: 12,

  radius: {
    sm: 8,
    md: 10,
    lg: 14,
    xl: 20,
    royal: 24,
    pill: 999,
  },

  controlHeights: { xs: 34, sm: 42, md: 52, lg: 60, touch: 48 },

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
    minReadable: 13,
    weight: {
      regular: '400' as const,
      medium: '600' as const,
      semibold: '600' as const,
      bold: '700' as const,
      extrabold: '800' as const,
    },
  },
  accessibility: {
    minTouchTarget: 44,
    comfortableTouchTarget: 48,
    childFriendlyTouchTarget: 52,
    elderFriendlyTouchTarget: 56,
    minBodyFont: 15,
    minLabelFont: 13,
    lineHeightRatio: 1.42,
    ageModes: {
      child: {
        minTouchTarget: 52,
        fontScale: 1.08,
        navigation: 'guided',
        safeRecommendations: true,
      },
      youth: {
        minTouchTarget: 48,
        fontScale: 1,
        navigation: 'standard',
        safeRecommendations: true,
      },
      adult: {
        minTouchTarget: 48,
        fontScale: 1,
        navigation: 'standard',
        safeRecommendations: true,
      },
      olderAdult: {
        minTouchTarget: 56,
        fontScale: 1.18,
        navigation: 'simplified',
        safeRecommendations: true,
      },
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

export const KIS_COMPONENT_TOKENS = {
  button: {
    radius: KIS_TOKENS.radius.lg,
    pillRadius: KIS_TOKENS.radius.pill,
    minHeight: KIS_TOKENS.controlHeights.touch,
    horizontalPadding: 16,
    borderWidth: 1.5,
  },
  card: {
    radius: KIS_TOKENS.radius.royal,
    compactRadius: KIS_TOKENS.radius.lg,
    borderWidth: 1,
    padding: 16,
  },
  input: {
    radius: KIS_TOKENS.radius.lg,
    minHeight: KIS_TOKENS.controlHeights.md,
    borderWidth: 1.5,
    horizontalPadding: 14,
  },
  badge: {
    minSize: 20,
    borderWidth: 2,
    radius: KIS_TOKENS.radius.pill,
  },
  tab: {
    iconSize: 42,
    selectedRadius: 18,
    badgeOffset: -9,
  },
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

export const inputStyles = (tone: KISTone, accentId?: string) => {
  const palette = createPalette(tone, accentId);
  return {
    container: {
      minHeight: KIS_COMPONENT_TOKENS.input.minHeight,
      borderRadius: KIS_COMPONENT_TOKENS.input.radius,
      borderWidth: KIS_COMPONENT_TOKENS.input.borderWidth,
      borderColor: palette.inputBorder,
      backgroundColor: palette.inputBg,
      paddingHorizontal: KIS_COMPONENT_TOKENS.input.horizontalPadding,
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

export const cardStyles = (tone: KISTone, accentId?: string) => {
  const palette = createPalette(tone, accentId);
  return {
    base: {
      borderRadius: KIS_COMPONENT_TOKENS.card.radius,
      borderWidth: KIS_COMPONENT_TOKENS.card.borderWidth,
      borderColor: palette.goldBorder,
      backgroundColor: palette.surface,
      padding: KIS_COMPONENT_TOKENS.card.padding,
    },
    compact: {
      borderRadius: KIS_COMPONENT_TOKENS.card.compactRadius,
      borderWidth: KIS_COMPONENT_TOKENS.card.borderWidth,
      borderColor: palette.borderMuted,
      backgroundColor: palette.surface,
      padding: 12,
    },
    elevated: {
      borderRadius: KIS_COMPONENT_TOKENS.card.radius,
      borderWidth: KIS_COMPONENT_TOKENS.card.borderWidth,
      borderColor: palette.goldBorder,
      backgroundColor: palette.surfaceElevated,
      padding: KIS_COMPONENT_TOKENS.card.padding,
      shadowColor: palette.shadow,
      shadowOpacity: tone === 'dark' ? 0.24 : 0.10,
      shadowRadius: tone === 'dark' ? 18 : 12,
      shadowOffset: { width: 0, height: tone === 'dark' ? 10 : 6 },
      elevation: tone === 'dark' ? 8 : 4,
    },
  };
};

export const selectedControlStyles = (tone: KISTone, accentId?: string) => {
  const palette = createPalette(tone, accentId);
  return {
    container: {
      minHeight: KIS_TOKENS.accessibility.minTouchTarget,
      borderRadius: KIS_TOKENS.radius.pill,
      borderWidth: KIS_COMPONENT_TOKENS.button.borderWidth,
      borderColor: palette.selectedBorder,
      backgroundColor: palette.selectedBg,
      paddingHorizontal: 14,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      flexDirection: 'row' as const,
      gap: 8,
    },
    text: {
      color: palette.selectedText,
      fontSize: KIS_TOKENS.typography.label,
      fontWeight: KIS_TOKENS.typography.weight.bold,
    },
  };
};

export const badgeStyles = (tone: KISTone, accentId?: string) => {
  const palette = createPalette(tone, accentId);
  return {
    container: {
      minWidth: KIS_COMPONENT_TOKENS.badge.minSize,
      height: KIS_COMPONENT_TOKENS.badge.minSize,
      borderRadius: KIS_COMPONENT_TOKENS.badge.radius,
      paddingHorizontal: 6,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      backgroundColor: palette.badgeBg,
      borderWidth: KIS_COMPONENT_TOKENS.badge.borderWidth,
      borderColor: palette.surface,
    },
    text: {
      color: palette.badgeText,
      fontSize: 10,
      fontWeight: KIS_TOKENS.typography.weight.extrabold,
    },
  };
};
