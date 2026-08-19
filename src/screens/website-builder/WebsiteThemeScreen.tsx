import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { patchRequest } from '@/network/patch';
import ROUTES from '@/network';
import KISButton from '@/constants/KISButton';
import {
  getHealthThemeColors,
  HEALTH_THEME_SPACING,
  HEALTH_THEME_TYPOGRAPHY,
} from '@/theme/health';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';

type Props = NativeStackScreenProps<RootStackParamList, 'WebsiteTheme'>;

type Palette = { primary: string; secondary: string; background: string; text: string };
type TypographyPreset = 'system' | 'sans' | 'serif';
type ButtonShape = 'rounded' | 'pill' | 'square';
type ButtonFill = 'solid' | 'outline';

const DEFAULT_PALETTE: Palette = { primary: '#1a1a2e', secondary: '#e94560', background: '#ffffff', text: '#0f0f1a' };

const SWATCHES = [
  '#1a1a2e', '#0f172a', '#e94560', '#f97316', '#16a34a', '#0ea5e9',
  '#7c3aed', '#db2777', '#ffffff', '#f5f5f4', '#111827', '#facc15',
];

const TYPOGRAPHY_OPTIONS: { key: TypographyPreset; label: string }[] = [
  { key: 'system', label: 'System' },
  { key: 'sans', label: 'Sans' },
  { key: 'serif', label: 'Serif' },
];

const SHAPE_OPTIONS: { key: ButtonShape; label: string }[] = [
  { key: 'rounded', label: 'Rounded' },
  { key: 'pill', label: 'Pill' },
  { key: 'square', label: 'Square' },
];

const FILL_OPTIONS: { key: ButtonFill; label: string }[] = [
  { key: 'solid', label: 'Solid' },
  { key: 'outline', label: 'Outline' },
];

function PillOption<T extends string>({
  options, value, onChange, palette, typography, spacing,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
  palette: any; typography: any; spacing: any;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' }}>
      {options.map((option) => {
        const active = option.key === value;
        return (
          <TouchableOpacity
            key={option.key}
            onPress={() => onChange(option.key)}
            style={{
              borderRadius: 999,
              borderWidth: 1,
              borderColor: active ? palette.accentPrimary : palette.divider,
              backgroundColor: active ? palette.accentPrimary : palette.card,
              paddingVertical: spacing.xs,
              paddingHorizontal: spacing.sm,
            }}
          >
            <Text style={{ ...typography.label, color: active ? '#FFFFFF' : palette.text }}>{option.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function ColorField({
  label, value, onChange, palette, typography, spacing,
}: {
  label: string; value: string; onChange: (hex: string) => void;
  palette: any; typography: any; spacing: any;
}) {
  return (
    <View style={{ marginTop: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
        <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: value, borderWidth: 1, borderColor: palette.divider }} />
        <Text style={{ ...typography.label, color: palette.text }}>{label}</Text>
        <Text style={{ ...typography.caption, color: palette.subtext }}>{value}</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap', marginTop: spacing.xs }}>
        {SWATCHES.map((hex) => {
          const active = hex.toLowerCase() === value?.toLowerCase();
          return (
            <TouchableOpacity
              key={hex}
              onPress={() => onChange(hex)}
              style={{
                width: 28, height: 28, borderRadius: 14, backgroundColor: hex,
                borderWidth: active ? 2 : 1, borderColor: active ? palette.accentPrimary : palette.divider,
              }}
            />
          );
        })}
      </View>
    </View>
  );
}

export default function WebsiteThemeScreen({ navigation, route }: Props) {
  const { websiteId, branding: initialBranding } = route.params;
  const palette = getHealthThemeColors('light');
  const spacing = HEALTH_THEME_SPACING;
  const typography = HEALTH_THEME_TYPOGRAPHY;

  const [colors, setColors] = useState<Palette>({ ...DEFAULT_PALETTE, ...(initialBranding?.palette || {}) });
  const [preset, setPreset] = useState<TypographyPreset>(initialBranding?.typography?.preset || 'system');
  const [shape, setShape] = useState<ButtonShape>(initialBranding?.buttons?.shape || 'rounded');
  const [fill, setFill] = useState<ButtonFill>(initialBranding?.buttons?.fill || 'solid');
  const [saving, setSaving] = useState(false);

  const setColor = useCallback((key: keyof Palette, hex: string) => {
    setColors((prev) => ({ ...prev, [key]: hex }));
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await patchRequest(
        ROUTES.websites.detail(websiteId),
        { branding: { palette: colors, typography: { preset }, buttons: { shape, fill } } },
        { errorMessage: 'Unable to save theme.' },
      );
      if (!res?.success) throw new Error((res as any)?.message || 'Unable to save theme.');
      Alert.alert('Website Theme', 'Theme saved.');
      navigation.goBack();
    } catch (error: any) {
      Alert.alert('Website Theme', error?.message || 'Unable to save theme.');
    } finally {
      setSaving(false);
    }
  }, [websiteId, colors, preset, shape, fill, navigation]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }}>
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl }}>
        <Text style={{ ...typography.h2, color: palette.text }}>Theme</Text>
        <Text style={{ ...typography.caption, color: palette.subtext, marginTop: 2 }}>
          Colors, typography, and button style — applied across your whole website.
        </Text>

        <Text style={{ ...typography.h3, color: palette.text, marginTop: spacing.lg }}>Palette</Text>
        <ColorField label="Primary" value={colors.primary} onChange={(hex) => setColor('primary', hex)} palette={palette} typography={typography} spacing={spacing} />
        <ColorField label="Secondary" value={colors.secondary} onChange={(hex) => setColor('secondary', hex)} palette={palette} typography={typography} spacing={spacing} />
        <ColorField label="Background" value={colors.background} onChange={(hex) => setColor('background', hex)} palette={palette} typography={typography} spacing={spacing} />
        <ColorField label="Text" value={colors.text} onChange={(hex) => setColor('text', hex)} palette={palette} typography={typography} spacing={spacing} />

        <Text style={{ ...typography.h3, color: palette.text, marginTop: spacing.lg }}>Typography</Text>
        <View style={{ marginTop: spacing.xs }}>
          <PillOption options={TYPOGRAPHY_OPTIONS} value={preset} onChange={setPreset} palette={palette} typography={typography} spacing={spacing} />
        </View>

        <Text style={{ ...typography.h3, color: palette.text, marginTop: spacing.lg }}>Button Shape</Text>
        <View style={{ marginTop: spacing.xs }}>
          <PillOption options={SHAPE_OPTIONS} value={shape} onChange={setShape} palette={palette} typography={typography} spacing={spacing} />
        </View>

        <Text style={{ ...typography.h3, color: palette.text, marginTop: spacing.lg }}>Button Fill</Text>
        <View style={{ marginTop: spacing.xs }}>
          <PillOption options={FILL_OPTIONS} value={fill} onChange={setFill} palette={palette} typography={typography} spacing={spacing} />
        </View>

        <View style={{ marginTop: spacing.xl }}>
          <KISButton title="Save Theme" onPress={handleSave} disabled={saving} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
