export const LANDING_BACKGROUND_COLOR_OPTIONS = [
  { key: 'ocean_mist', label: 'Ocean Mist', color: '#E8F5FF' },
  { key: 'mint_soft', label: 'Mint Soft', color: '#EAFBF3' },
  { key: 'sunset_blush', label: 'Sunset Blush', color: '#FFF0EA' },
  { key: 'lavender_fog', label: 'Lavender Fog', color: '#F3EEFF' },
  { key: 'sandstone', label: 'Sandstone', color: '#F8F2E8' },
  { key: 'slate_air', label: 'Slate Air', color: '#EDF2F7' },
] as const;

export type LandingBackgroundColorKey = (typeof LANDING_BACKGROUND_COLOR_OPTIONS)[number]['key'];

export const resolveBackgroundColor = (key?: string | null, fallback = '#FFFFFF') => {
  const match = LANDING_BACKGROUND_COLOR_OPTIONS.find((item) => item.key === key);
  return match?.color || fallback;
};
