import { HealthThemeColors } from './colors';

export const getHealthThemeBorders = (palette: HealthThemeColors) => ({
  card: {
    borderWidth: 1,
    borderColor: palette.divider,
  },
  popover: {
    borderWidth: 1,
    borderColor: palette.divider,
  },
});
