export type AppColorTheme = {
  id: string;
  name: string;
  emoji: string;
  /** Accent / brand primary — used for buttons, active tabs, text highlights. */
  primary: string;
  /** 4-stop gradient for the messaging header panel (dark → mid → accent → dark). */
  headerGradient: readonly [string, string, string, string];
  /** Shimmer line colour at the top of the header panel. */
  sheenColor: string;
};

/**
 * 22 royal-luxury colour themes available to Partner Pro apps.
 * All but the last are distinct world-popular colours; the last is the
 * canonical KIS Gold — fixed and immutable as a design system constant.
 */
export const APP_COLOR_THEMES: AppColorTheme[] = [
  {
    id: 'royal_blue',
    name: 'Royal Blue',
    emoji: '💙',
    primary: '#5C8FFF',
    headerGradient: ['#0D1B3A', '#1A3A7A', '#2E5FCC', '#162D5E'],
    sheenColor: 'rgba(184,212,255,0.45)',
  },
  {
    id: 'emerald',
    name: 'Emerald',
    emoji: '💚',
    primary: '#2DB87D',
    headerGradient: ['#0A2010', '#1A5030', '#2D9A5A', '#163820'],
    sheenColor: 'rgba(184,255,220,0.45)',
  },
  {
    id: 'crimson',
    name: 'Crimson',
    emoji: '❤️',
    primary: '#E05252',
    headerGradient: ['#2A0808', '#6B1515', '#C03030', '#4A1010'],
    sheenColor: 'rgba(255,184,184,0.45)',
  },
  {
    id: 'amber',
    name: 'Amber',
    emoji: '🧡',
    primary: '#F5A623',
    headerGradient: ['#2B1500', '#6B3A00', '#C47A00', '#4A2800'],
    sheenColor: 'rgba(255,230,184,0.45)',
  },
  {
    id: 'teal',
    name: 'Teal',
    emoji: '🩵',
    primary: '#20C997',
    headerGradient: ['#041520', '#0A3A4A', '#0F7A8A', '#072A38'],
    sheenColor: 'rgba(184,255,245,0.45)',
  },
  {
    id: 'rose',
    name: 'Rose',
    emoji: '🌸',
    primary: '#F06595',
    headerGradient: ['#2B0815', '#6B1535', '#C0306A', '#4A1028'],
    sheenColor: 'rgba(255,184,210,0.45)',
  },
  {
    id: 'violet',
    name: 'Violet',
    emoji: '💜',
    primary: '#9775FA',
    headerGradient: ['#1A0828', '#3D1570', '#7B35D4', '#2A0A45'],
    sheenColor: 'rgba(220,184,255,0.45)',
  },
  {
    id: 'copper',
    name: 'Copper',
    emoji: '🔶',
    primary: '#FF8C42',
    headerGradient: ['#2A1200', '#6B3010', '#C06420', '#4A2000'],
    sheenColor: 'rgba(255,210,184,0.45)',
  },
  {
    id: 'steel',
    name: 'Steel Blue',
    emoji: '🔷',
    primary: '#74C0FC',
    headerGradient: ['#0A1520', '#1A303D', '#2E5F7A', '#152838'],
    sheenColor: 'rgba(184,220,255,0.45)',
  },
  {
    id: 'forest',
    name: 'Forest',
    emoji: '🌲',
    primary: '#69DB7C',
    headerGradient: ['#0A1A0A', '#1A3A20', '#2E6A3A', '#152A1A'],
    sheenColor: 'rgba(184,255,200,0.45)',
  },
  {
    id: 'lavender',
    name: 'Lavender',
    emoji: '🔮',
    primary: '#CC5DE8',
    headerGradient: ['#1A0828', '#3D1560', '#8A35C0', '#2A0A45'],
    sheenColor: 'rgba(230,184,255,0.45)',
  },
  {
    id: 'turquoise',
    name: 'Turquoise',
    emoji: '🌊',
    primary: '#22C3C3',
    headerGradient: ['#031F1F', '#0A4A4A', '#1AABAB', '#073636'],
    sheenColor: 'rgba(184,255,255,0.45)',
  },
  {
    id: 'magenta',
    name: 'Magenta',
    emoji: '💗',
    primary: '#E0369D',
    headerGradient: ['#2E0620', '#661044', '#C42E8C', '#450C30'],
    sheenColor: 'rgba(255,196,230,0.45)',
  },
  {
    id: 'indigo',
    name: 'Indigo',
    emoji: '💠',
    primary: '#5B6EE8',
    headerGradient: ['#0F1240', '#232B80', '#4655CC', '#191F5C'],
    sheenColor: 'rgba(206,212,255,0.45)',
  },
  {
    id: 'burgundy',
    name: 'Burgundy',
    emoji: '🍷',
    primary: '#A03A54',
    headerGradient: ['#280811', '#571223', '#8A2F48', '#3D0F1B'],
    sheenColor: 'rgba(244,196,208,0.45)',
  },
  {
    id: 'mint',
    name: 'Mint',
    emoji: '🌿',
    primary: '#3ED9A8',
    headerGradient: ['#04241A', '#0C4C38', '#1FAE82', '#0A3628'],
    sheenColor: 'rgba(190,255,230,0.45)',
  },
  {
    id: 'coral',
    name: 'Coral',
    emoji: '🪸',
    primary: '#FF6F5E',
    headerGradient: ['#330E09', '#6B2116', '#C4523F', '#4A1810'],
    sheenColor: 'rgba(255,206,199,0.45)',
  },
  {
    id: 'sunshine_yellow',
    name: 'Sunshine Yellow',
    emoji: '☀️',
    primary: '#F4C430',
    headerGradient: ['#2B2200', '#5C4700', '#C49A00', '#453700'],
    sheenColor: 'rgba(255,240,184,0.45)',
  },
  {
    id: 'navy',
    name: 'Navy',
    emoji: '⚓',
    primary: '#3B5998',
    headerGradient: ['#0A1428', '#152A54', '#2C4A8A', '#0F1F3C'],
    sheenColor: 'rgba(190,208,240,0.45)',
  },
  {
    id: 'charcoal',
    name: 'Charcoal',
    emoji: '🪨',
    primary: '#6B7785',
    headerGradient: ['#14171C', '#2A3038', '#4A5460', '#1E2228'],
    sheenColor: 'rgba(210,218,226,0.45)',
  },
  {
    id: 'terracotta',
    name: 'Terracotta',
    emoji: '🏺',
    primary: '#C1603F',
    headerGradient: ['#2B0F06', '#5C2412', '#A34A2A', '#421A0C'],
    sheenColor: 'rgba(255,206,180,0.45)',
  },
  {
    // KIS is always last — the canonical royal gold. Fixed, immutable.
    id: 'kis',
    name: 'KIS Gold',
    emoji: '✨',
    primary: '#C9A84C',
    headerGradient: ['#3B271E', '#6F4515', '#B9852E', '#56321F'],
    sheenColor: 'rgba(255,244,184,0.45)',
  },
];

export const DEFAULT_THEME_ID = 'kis';

export function getThemeById(id?: string | null): AppColorTheme {
  return APP_COLOR_THEMES.find((t) => t.id === id) ?? APP_COLOR_THEMES[APP_COLOR_THEMES.length - 1];
}
