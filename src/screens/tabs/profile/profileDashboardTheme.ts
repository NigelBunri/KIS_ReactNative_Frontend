import type { TextStyle, ViewStyle } from 'react-native';
import type { KISPalette, KISTone } from '@/theme/constants';

const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value)));

const hexToRgb = (input: string) => {
  const normalized = String(input || '').trim().replace('#', '');
  if (normalized.length === 3) {
    const [r, g, b] = normalized.split('');
    return {
      r: clamp(parseInt(`${r}${r}`, 16)),
      g: clamp(parseInt(`${g}${g}`, 16)),
      b: clamp(parseInt(`${b}${b}`, 16)),
    };
  }
  if (normalized.length !== 6) {
    return { r: 0, g: 0, b: 0 };
  }
  return {
    r: clamp(parseInt(normalized.slice(0, 2), 16)),
    g: clamp(parseInt(normalized.slice(2, 4), 16)),
    b: clamp(parseInt(normalized.slice(4, 6), 16)),
  };
};

const alpha = (color: string, opacity: number) => {
  if (!color) return `rgba(0,0,0,${opacity})`;
  if (color.startsWith('rgba(') || color.startsWith('rgb(')) return color;
  const { r, g, b } = hexToRgb(color);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

const createShadow = (
  palette: KISPalette,
  opacity: number,
  radius: number,
  y: number,
): ViewStyle => ({
  shadowColor: palette.shadow,
  shadowOpacity: opacity,
  shadowRadius: radius,
  shadowOffset: { width: 0, height: y },
  elevation: Math.max(1, Math.round(radius / 3)),
});

export type ProfileDashboardCardVariant =
  | 'dashboard'
  | 'glass'
  | 'action'
  | 'stat'
  | 'timeline'
  | 'heroOverlay';

export type ProfileDashboardTheme = {
  tone: KISTone;
  isDark: boolean;
  page: {
    background: string;
    sectionGap: number;
    cardGap: number;
  };
  hero: {
    gradient: string[];
    haloPrimary: string;
    haloSecondary: string;
    haloAccent: string;
    scrim: string;
    iconRailBg: string;
    iconColor: string;
    border: string;
    ring: string;
  };
  surfaces: {
    dashboardCard: ViewStyle;
    glassCard: ViewStyle;
    actionCard: ViewStyle;
    statCard: ViewStyle;
    timelineItem: ViewStyle;
    heroOverlayCard: ViewStyle;
  };
  sectionHeader: {
    title: TextStyle;
    subtitle: TextStyle;
    actionLabel: TextStyle;
    eyebrow: TextStyle;
  };
  content: {
    heading: TextStyle;
    body: TextStyle;
    meta: TextStyle;
    quiet: TextStyle;
    badge: TextStyle;
  };
  accents: {
    primaryRing: string;
    secondaryRing: string;
    successSoft: string;
    warningSoft: string;
    infoSoft: string;
    orangeSoft: string;
  };
  chips: {
    neutral: ViewStyle;
    primary: ViewStyle;
    glass: ViewStyle;
  };
  buttons: {
    primaryCard: ViewStyle;
    secondaryCard: ViewStyle;
    ghostCard: ViewStyle;
  };
};

export const createProfileDashboardTheme = (
  palette: KISPalette,
  tone: KISTone,
): ProfileDashboardTheme => {
  const isDark = tone === 'dark';

  return {
    tone,
    isDark,
    page: {
      background: isDark
        ? `linear:${palette.chrome}:${palette.bg}`
        : `linear:${palette.bg}:${palette.chrome}`,
      sectionGap: 18,
      cardGap: 14,
    },
    hero: {
      gradient: isDark
        ? ['#030712', '#0D1630', '#171224']
        : ['#FAF6FF', '#FFFFFF', '#FFF4EA'],
      haloPrimary: alpha(palette.accentPrimary ?? palette.primary, isDark ? 0.34 : 0.22),
      haloSecondary: alpha(palette.secondary, isDark ? 0.28 : 0.18),
      haloAccent: alpha(isDark ? '#F4B04F' : palette.accentPrimary ?? palette.primary, isDark ? 0.2 : 0.16),
      scrim: isDark ? 'rgba(3, 7, 18, 0.52)' : 'rgba(255,255,255,0.16)',
      iconRailBg: isDark ? alpha('#0C1322', 0.84) : alpha('#FFFFFF', 0.76),
      iconColor: isDark ? '#FFFFFF' : palette.text,
      border: alpha(isDark ? '#FFFFFF' : palette.primary, isDark ? 0.08 : 0.12),
      ring: alpha(isDark ? '#F4B04F' : palette.primaryStrong, isDark ? 0.24 : 0.12),
    },
    surfaces: {
      dashboardCard: {
        backgroundColor: isDark ? alpha('#0D1424', 0.94) : alpha('#FFFFFF', 0.98),
        borderColor: isDark ? alpha('#FFFFFF', 0.08) : alpha('#E6DEF7', 0.95),
        borderWidth: 1,
        borderRadius: 24,
        ...createShadow(palette, isDark ? 0.28 : 0.12, isDark ? 28 : 18, isDark ? 16 : 10),
      },
      glassCard: {
        backgroundColor: isDark ? alpha('#0E1526', 0.66) : alpha('#FFFFFF', 0.82),
        borderColor: isDark ? alpha('#FFFFFF', 0.11) : alpha('#FFFFFF', 0.92),
        borderWidth: 1,
        borderRadius: 24,
        ...createShadow(palette, isDark ? 0.24 : 0.08, isDark ? 24 : 16, isDark ? 14 : 8),
      },
      actionCard: {
        backgroundColor: isDark ? alpha('#101728', 0.88) : alpha('#FBFAFF', 0.96),
        borderColor: isDark ? alpha('#FFFFFF', 0.08) : alpha('#E8E1F8', 0.9),
        borderWidth: 1,
        borderRadius: 20,
        ...createShadow(palette, isDark ? 0.2 : 0.06, 14, 7),
      },
      statCard: {
        backgroundColor: isDark ? alpha('#121A2C', 0.74) : alpha('#FFFFFF', 0.88),
        borderColor: isDark ? alpha('#FFFFFF', 0.08) : alpha('#E8E0F8', 0.86),
        borderWidth: 1,
        borderRadius: 18,
      },
      timelineItem: {
        backgroundColor: isDark ? alpha('#0F1627', 0.74) : alpha('#FFFFFF', 0.82),
        borderColor: isDark ? alpha('#FFFFFF', 0.06) : alpha('#ECE4FB', 0.72),
        borderWidth: 1,
        borderRadius: 18,
      },
      heroOverlayCard: {
        backgroundColor: isDark ? alpha('#0B1221', 0.58) : alpha('#FFFFFF', 0.68),
        borderColor: isDark ? alpha('#FFFFFF', 0.08) : alpha('#FFFFFF', 0.76),
        borderWidth: 1,
        borderRadius: 22,
      },
    },
    sectionHeader: {
      title: {
        color: palette.text,
        fontSize: 20,
        fontWeight: '800',
        letterSpacing: -0.3,
      },
      subtitle: {
        color: palette.subtext,
        fontSize: 13,
        lineHeight: 20,
      },
      actionLabel: {
        color: palette.primaryStrong,
        fontSize: 13,
        fontWeight: '700',
      },
      eyebrow: {
        color: palette.subtext,
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 1,
        textTransform: 'uppercase',
      },
    },
    content: {
      heading: {
        color: palette.text,
        fontSize: 18,
        fontWeight: '800',
      },
      body: {
        color: palette.text,
        fontSize: 14,
        lineHeight: 21,
      },
      meta: {
        color: palette.subtext,
        fontSize: 12,
        lineHeight: 19,
      },
      quiet: {
        color: palette.textMuted ?? palette.subtext,
        fontSize: 11,
        lineHeight: 16,
      },
      badge: {
        color: isDark ? '#FFFFFF' : palette.text,
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.2,
      },
    },
    accents: {
      primaryRing: alpha(palette.primaryStrong, isDark ? 0.44 : 0.26),
      secondaryRing: alpha(palette.secondary, isDark ? 0.36 : 0.22),
      successSoft: alpha(palette.success, isDark ? 0.18 : 0.12),
      warningSoft: alpha(palette.warning, isDark ? 0.18 : 0.12),
      infoSoft: alpha(palette.info, isDark ? 0.2 : 0.13),
      orangeSoft: alpha(palette.accentPrimary ?? palette.primary, isDark ? 0.2 : 0.14),
    },
    chips: {
      neutral: {
        backgroundColor: isDark ? alpha(palette.surfaceElevated, 0.72) : alpha('#FFFFFF', 0.78),
        borderColor: isDark ? alpha('#FFFFFF', 0.08) : alpha(palette.divider, 0.82),
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 7,
      },
      primary: {
        backgroundColor: isDark ? alpha(palette.secondary, 0.22) : alpha(palette.primaryStrong, 0.12),
        borderColor: isDark ? alpha(palette.secondary, 0.42) : alpha(palette.primaryStrong, 0.18),
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 7,
      },
      glass: {
        backgroundColor: isDark ? alpha('#FFFFFF', 0.08) : alpha('#FFFFFF', 0.66),
        borderColor: isDark ? alpha('#FFFFFF', 0.12) : alpha('#FFFFFF', 0.82),
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 7,
      },
    },
    buttons: {
      primaryCard: {
        backgroundColor: isDark ? alpha(palette.secondary, 0.22) : alpha(palette.secondary, 0.14),
        borderColor: isDark ? alpha(palette.secondary, 0.44) : alpha(palette.secondary, 0.2),
        borderWidth: 1,
        borderRadius: 18,
      },
      secondaryCard: {
        backgroundColor: isDark ? alpha(palette.surfaceElevated, 0.76) : alpha('#FFFFFF', 0.9),
        borderColor: isDark ? alpha('#FFFFFF', 0.08) : alpha(palette.divider, 0.9),
        borderWidth: 1,
        borderRadius: 18,
      },
      ghostCard: {
        backgroundColor: 'transparent',
        borderColor: isDark ? alpha('#FFFFFF', 0.12) : alpha(palette.divider, 0.95),
        borderWidth: 1,
        borderRadius: 18,
      },
    },
  };
};

export const getProfileDashboardCardStyle = (
  theme: ProfileDashboardTheme,
  variant: ProfileDashboardCardVariant,
) => {
  switch (variant) {
    case 'glass':
      return theme.surfaces.glassCard;
    case 'action':
      return theme.surfaces.actionCard;
    case 'stat':
      return theme.surfaces.statCard;
    case 'timeline':
      return theme.surfaces.timelineItem;
    case 'heroOverlay':
      return theme.surfaces.heroOverlayCard;
    case 'dashboard':
    default:
      return theme.surfaces.dashboardCard;
  }
};
