// src/components/partners/PartnerWorkspaceBrandingPanel.tsx
//
// Workspace Branding: a focused logo + brand-color editor, distinct
// from the general org-info form (PartnerOrganizationProfilePanel,
// which already has a raw comma-separated brand_colors field mixed in
// with legal name/mission/social links). Same backend field though —
// apps.partners.PartnerOrganizationProfile.logo_url/brand_colors via
// the existing organization-profile GET/PATCH endpoint — no new model
// needed, this is a purpose-built UI on top of already-real data.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import styles from '@/components/partners/partnersStyles';
import { useKISTheme } from '@/theme/useTheme';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { patchRequest } from '@/network/patch';

type Props = {
  isOpen: boolean;
  panelWidth: number;
  panelTranslateX: Animated.Value;
  partnerId?: string | null;
  onClose: () => void;
};

const HEX_RE = /^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/;

const PRESETS: { name: string; colors: [string, string, string] }[] = [
  { name: 'Royal Gold', colors: ['#B8860B', '#1A1A2E', '#F5F5DC'] },
  { name: 'Deep Ocean', colors: ['#0B3D91', '#1E88E5', '#E3F2FD'] },
  { name: 'Forest', colors: ['#1B5E20', '#4CAF50', '#E8F5E9'] },
  { name: 'Crimson', colors: ['#8B0000', '#C62828', '#FFEBEE'] },
];

const inputStyle = (palette: any) => ({
  color: palette.text,
  borderColor: palette.borderMuted,
  borderWidth: 2,
  paddingHorizontal: 10,
  paddingVertical: 8,
  borderRadius: 10,
  marginTop: 8,
});

const roleLabels = ['Primary', 'Secondary', 'Accent'];

export default function PartnerWorkspaceBrandingPanel({ isOpen, panelWidth, panelTranslateX, partnerId, onClose }: Props) {
  const { palette } = useKISTheme();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [logoUrl, setLogoUrl] = useState('');
  const [colors, setColors] = useState<string[]>(['', '', '']);

  const backdropOpacity = panelTranslateX.interpolate({ inputRange: [0, panelWidth], outputRange: [1, 0], extrapolate: 'clamp' });

  const load = useCallback(async () => {
    if (!partnerId) return;
    const res = await getRequest(ROUTES.partners.organizationProfile(partnerId), { errorMessage: 'Unable to load branding.' });
    const data = res?.data ?? {};
    setLogoUrl(data.logo_url ?? '');
    const existing: string[] = Array.isArray(data.brand_colors) ? data.brand_colors : [];
    setColors([existing[0] ?? '', existing[1] ?? '', existing[2] ?? '']);
  }, [partnerId]);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [isOpen, load]);

  const setColorAt = (index: number, value: string) => {
    setColors((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const applyPreset = (preset: [string, string, string]) => {
    setColors([...preset]);
  };

  const save = async () => {
    if (!partnerId) return;
    const invalid = colors.some((c) => c.trim() && !HEX_RE.test(c.trim()));
    if (invalid) {
      Alert.alert('Invalid color', 'Colors must be a hex code like #B8860B.');
      return;
    }
    setSaving(true);
    const res = await patchRequest(
      ROUTES.partners.organizationProfile(partnerId),
      { logo_url: logoUrl.trim(), brand_colors: colors.map((c) => c.trim()).filter(Boolean) },
      { errorMessage: 'Unable to save branding.' },
    );
    setSaving(false);
    if (!res?.success) {
      Alert.alert('Failed', res?.message ?? 'Unable to save branding.');
      return;
    }
    Alert.alert('Saved', 'Workspace branding updated.');
  };

  if (!isOpen) return null;

  return (
    <View style={styles.settingsPanelOverlay} pointerEvents="box-none">
      <Animated.View style={[styles.settingsPanelBackdrop, { backgroundColor: palette.backdrop, opacity: backdropOpacity }]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          styles.settingsPanelContainer,
          { width: panelWidth, backgroundColor: palette.surfaceElevated, borderLeftColor: palette.divider, transform: [{ translateX: panelTranslateX }] },
        ]}
      >
        <View style={[styles.settingsPanelHeader, { borderBottomColor: palette.divider }]}>
          <Pressable onPress={onClose} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            <Text style={{ color: palette.text, fontSize: 18 }}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingsPanelTitle, { color: palette.text }]}>Workspace Branding</Text>
            <Text style={[styles.settingsPanelDescription, { color: palette.subtext }]}>Theme and branding controls</Text>
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.settingsPanelBody} showsVerticalScrollIndicator={false}>
          {loading ? (
            <ActivityIndicator size="small" color={palette.primary} />
          ) : (
            <>
              <Text style={{ color: palette.text, fontSize: 14, fontWeight: '800', marginBottom: 8 }}>Logo</Text>
              {logoUrl ? (
                <View style={{ alignItems: 'center', marginBottom: 12 }}>
                  <Image source={{ uri: logoUrl }} style={{ width: 96, height: 96, borderRadius: 16, backgroundColor: palette.surface }} resizeMode="contain" />
                </View>
              ) : null}
              <TextInput
                value={logoUrl}
                onChangeText={setLogoUrl}
                placeholder="Logo URL"
                placeholderTextColor={palette.subtext}
                autoCapitalize="none"
                style={[inputStyle(palette), { marginTop: 0, marginBottom: 24 }]}
              />

              <Text style={{ color: palette.text, fontSize: 14, fontWeight: '800', marginBottom: 8 }}>Brand colors</Text>
              {roleLabels.map((label, index) => {
                const value = colors[index];
                const valid = !value || HEX_RE.test(value);
                return (
                  <View key={label} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                    <View
                      style={{
                        width: 32, height: 32, borderRadius: 8, marginRight: 10,
                        backgroundColor: valid && value ? value : palette.borderMuted,
                        borderWidth: 1, borderColor: palette.borderMuted,
                      }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: palette.subtext, fontSize: 11 }}>{label}</Text>
                      <TextInput
                        value={value}
                        onChangeText={(v) => setColorAt(index, v)}
                        placeholder="#RRGGBB"
                        placeholderTextColor={palette.subtext}
                        autoCapitalize="characters"
                        style={{ color: valid ? palette.text : palette.danger, fontSize: 14, paddingVertical: 4 }}
                      />
                    </View>
                  </View>
                );
              })}

              <Text style={{ color: palette.subtext, fontSize: 11, marginTop: 16, marginBottom: 8 }}>Quick presets</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
                {PRESETS.map((preset) => (
                  <Pressable
                    key={preset.name}
                    onPress={() => applyPreset(preset.colors)}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: palette.borderMuted }}
                  >
                    <View style={{ flexDirection: 'row', marginRight: 8 }}>
                      {preset.colors.map((c, i) => (
                        <View key={i} style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: c, marginLeft: i === 0 ? 0 : -4, borderWidth: 1, borderColor: palette.surfaceElevated }} />
                      ))}
                    </View>
                    <Text style={{ color: palette.text, fontSize: 12 }}>{preset.name}</Text>
                  </Pressable>
                ))}
              </View>

              <Pressable
                onPress={save}
                disabled={saving}
                style={({ pressed }) => [{ paddingVertical: 10, borderRadius: 10, backgroundColor: palette.royalInk, alignItems: 'center', opacity: pressed || saving ? 0.7 : 1 }]}
              >
                <Text style={{ color: palette.ivory, fontWeight: '700' }}>{saving ? 'Saving…' : 'Save branding'}</Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}
