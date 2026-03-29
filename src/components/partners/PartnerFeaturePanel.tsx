import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import styles from '@/components/partners/partnersStyles';
import { useKISTheme } from '@/theme/useTheme';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { patchRequest } from '@/network/patch';
import type { PartnerFeatureMeta } from '@/screens/tabs/partners/usePartnerFeaturePanel';
import KeyValueEditor, { type KeyValueRow } from '@/components/partners/forms/KeyValueEditor';

type Props = {
  isOpen: boolean;
  panelWidth: number;
  panelTranslateX: Animated.Value;
  partnerId?: string | null;
  feature?: PartnerFeatureMeta | null;
  onClose: () => void;
};

export default function PartnerFeaturePanel({
  isOpen,
  panelWidth,
  panelTranslateX,
  partnerId,
  feature,
  onClose,
}: Props) {
  const { palette } = useKISTheme();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<KeyValueRow[]>([]);

  const backdropOpacity = panelTranslateX.interpolate({
    inputRange: [0, panelWidth],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const loadConfig = useCallback(async () => {
    if (!partnerId || !feature?.key) return;
    const res = await getRequest(
      ROUTES.partners.settingsConfigDetail(partnerId, feature.key),
      { errorMessage: 'Unable to load setting config.' },
    );
    const config = res?.data?.config ?? res?.config ?? {};
    const entries = Object.entries(config ?? {}).map(([key, value]) => ({
      key,
      value: String(value ?? ''),
    }));
    setRows(entries.length ? entries : [{ key: '', value: '' }]);
  }, [feature?.key, partnerId]);

  useEffect(() => {
    if (!isOpen || !feature) return;
    setLoading(true);
    loadConfig().finally(() => setLoading(false));
  }, [isOpen, feature, loadConfig]);

  const onSave = async () => {
    if (!partnerId || !feature?.key) return;
    const config: Record<string, any> = {};
    rows.forEach((row) => {
      if (!row.key.trim()) return;
      config[row.key.trim()] = coerceValue(row.value);
    });
    const res = await patchRequest(
      ROUTES.partners.settingsConfigDetail(partnerId, feature.key),
      { config },
      { errorMessage: 'Unable to update settings.' },
    );
    if (!res?.success) {
      Alert.alert('Update failed', res?.message ?? 'Please try again.');
      return;
    }
    Alert.alert('Saved', 'Settings updated successfully.');
  };

  const coerceValue = (value: string) => {
    const trimmed = value.trim();
    if (trimmed === '') return '';
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    const asNumber = Number(trimmed);
    if (!Number.isNaN(asNumber) && trimmed === String(asNumber)) {
      return asNumber;
    }
    return trimmed;
  };

  if (!isOpen || !feature) return null;

  return (
    <View style={styles.settingsPanelOverlay} pointerEvents="box-none">
      <Animated.View
        style={[
          styles.settingsPanelBackdrop,
          { backgroundColor: palette.backdrop, opacity: backdropOpacity },
        ]}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          styles.settingsPanelContainer,
          {
            width: panelWidth,
            backgroundColor: palette.surfaceElevated,
            borderLeftColor: palette.divider,
            transform: [{ translateX: panelTranslateX }],
          },
        ]}
      >
        <View
          style={[
            styles.settingsPanelHeader,
            { borderBottomColor: palette.divider },
          ]}
        >
          <Pressable onPress={onClose} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            <Text style={{ color: palette.text, fontSize: 18 }}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingsPanelTitle, { color: palette.text }]}>
              {feature.title}
            </Text>
            <Text style={[styles.settingsPanelDescription, { color: palette.subtext }]}>
              {feature.description ?? 'Configure settings for this feature.'}
            </Text>
          </View>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.settingsPanelBody}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <ActivityIndicator size="small" color={palette.primary} />
          ) : (
            <View
              style={[
                styles.settingsFeatureRow,
                { borderColor: palette.borderMuted, backgroundColor: palette.surface },
              ]}
            >
              <Text style={[styles.settingsFeatureTitle, { color: palette.text }]}>
                Configuration
              </Text>
              <KeyValueEditor palette={palette} rows={rows} onChange={setRows} />
              <Pressable
                onPress={onSave}
                style={({ pressed }) => [
                  {
                    marginTop: 10,
                    paddingVertical: 8,
                    borderRadius: 10,
                    borderWidth: 2,
                    borderColor: palette.borderMuted,
                    backgroundColor: palette.primarySoft ?? palette.surface,
                    opacity: pressed ? 0.8 : 1,
                    alignItems: 'center',
                  },
                ]}
              >
                <Text style={{ color: palette.primaryStrong ?? palette.text, fontWeight: '700' }}>
                  SAVE SETTINGS
                </Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}
