import { StyleSheet, View } from 'react-native';
import type { KISPalette } from '@/theme/constants';
import { useKISTheme } from '@/theme/useTheme';
import KISText from '@/components/common/KISText';

type Props = {
  palette?: KISPalette | Record<string, any>;
  kind?: string;
  title?: string;
  subtitle?: string;
  label?: string;
  icon?: string;
};

// This card intentionally does not display revenue figures: no monetization
// backend exists yet for health provider/institution preview surfaces. It
// replaces a silent `return null` with an honest "not live yet" notice
// instead of pretending this data exists.
export default function HealthRevenuePreviewCard({ palette: paletteProp, title, subtitle, label, icon }: Props) {
  const { palette: themePalette } = useKISTheme();
  const palette = (paletteProp as KISPalette) ?? themePalette;

  return (
    <View style={[styles.card, { borderColor: palette.borderMuted, backgroundColor: palette.surface }]}>
      <KISText preset="label" weight="800" style={[styles.eyebrow, { color: palette.subtext }]}>
        {icon ? `${icon} ` : ''}
        {label ?? 'Preview only'}
      </KISText>
      <KISText preset="body" weight="800" style={[styles.title, { color: palette.text }]}>
        {title ?? 'Profitability insights'}
      </KISText>
      <KISText preset="caption" style={[styles.subtitle, { color: palette.subtext }]}>
        {subtitle ?? 'Coming soon — this monetization data is not available yet.'}
      </KISText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    marginBottom: 14,
  },
  eyebrow: {
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  title: {
    fontSize: 15,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 18,
  },
});
