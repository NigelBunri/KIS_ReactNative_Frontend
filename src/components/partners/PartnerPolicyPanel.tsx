import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import styles from '@/components/partners/partnersStyles';
import { useKISTheme } from '@/theme/useTheme';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { patchRequest } from '@/network/patch';
import { PartnerPolicySettings } from '@/components/partners/partnersTypes';

type Props = {
  isOpen: boolean;
  panelWidth: number;
  panelTranslateX: Animated.Value;
  partnerId?: string | null;
  onClose: () => void;
};

const emptySettings: PartnerPolicySettings = {
  security: {
    require_mfa: false,
    session_timeout_minutes: 60,
    allow_external_sharing: true,
  },
  compliance: {
    audit_enabled: true,
    legal_hold_enabled: false,
  },
  retention: {
    message_retention_days: 365,
    file_retention_days: 365,
  },
  dlp: {
    enabled: false,
  },
  data_residency: {
    region: 'auto',
    allow_cross_region: true,
  },
  integrations: {
    sso_required: false,
    scim_enabled: false,
    api_access_enabled: true,
  },
};

export default function PartnerPolicyPanel({
  isOpen,
  panelWidth,
  panelTranslateX,
  partnerId,
  onClose,
}: Props) {
  const { palette } = useKISTheme();
  const [settings, setSettings] = useState<PartnerPolicySettings>(emptySettings);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const rowCardStyle = {
    backgroundColor: palette.surface,
    borderColor: palette.borderMuted,
  };
  const patternsToText = (patterns?: string[]) => (patterns ?? []).join(', ');
  const textToPatterns = (text: string) =>
    text
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

  const backdropOpacity = panelTranslateX.interpolate({
    inputRange: [0, panelWidth],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const updateSetting = (section: keyof PartnerPolicySettings, key: string, value: any) => {
    setSettings((prev) => ({
      ...prev,
      [section]: {
        ...(prev[section] ?? {}),
        [key]: value,
      },
    }));
  };

  const loadPolicy = useCallback(async () => {
    if (!partnerId) return;
    const res = await getRequest(ROUTES.partners.policy(partnerId), {
      errorMessage: 'Unable to load policy.',
    });
    const incoming = (res?.data?.settings ?? null) as PartnerPolicySettings | null;
    if (incoming) {
      setSettings({ ...emptySettings, ...incoming });
    } else {
      setSettings(emptySettings);
    }
  }, [partnerId]);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    loadPolicy().finally(() => setLoading(false));
  }, [isOpen, loadPolicy]);

  const onSave = async () => {
    if (!partnerId) return;
    setSaving(true);
    const response = await patchRequest(ROUTES.partners.policy(partnerId), { settings }, {
      successMessage: 'Policy updated.',
      errorMessage: 'Unable to update policy.',
    });
    if (!response?.success) {
      Alert.alert('Update failed', response?.message ?? 'Please try again.');
    } else {
      Alert.alert('Policy updated', 'Enterprise policy saved.');
    }
    setSaving(false);
  };

  if (!isOpen) return null;

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
          <Pressable
            onPress={onClose}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <Text style={{ color: palette.text, fontSize: 18 }}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingsPanelTitle, { color: palette.text }]}>
              Enterprise Policy
            </Text>
            <Text
              style={[
                styles.settingsPanelDescription,
                { color: palette.subtext },
              ]}
            >
              Security, retention, and compliance rules.
            </Text>
          </View>
          <Pressable
            onPress={onSave}
            disabled={saving}
            style={({ pressed }) => [
              {
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 14,
                borderWidth: 2,
                borderColor: palette.borderMuted,
                backgroundColor: palette.surface,
                opacity: pressed || saving ? 0.7 : 1,
              },
            ]}
          >
            <Text style={{ color: palette.text, fontSize: 12, fontWeight: '700' }}>
              SAVE
            </Text>
          </Pressable>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.settingsPanelBody}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <ActivityIndicator size="small" color={palette.primary} />
          ) : (
            <>
              <Text style={[styles.settingsSectionTitle, { color: palette.text }]}>
                Security
              </Text>
              <View
                style={[
                  styles.settingsFeatureRow,
                  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
                  rowCardStyle,
                ]}
              >
                <Text style={[styles.settingsFeatureTitle, { color: palette.text }]}>
                  Require MFA
                </Text>
                <Switch
                  value={Boolean(settings.security?.require_mfa)}
                  onValueChange={(value) => updateSetting('security', 'require_mfa', value)}
                />
              </View>
              <View
                style={[
                  styles.settingsFeatureRow,
                  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
                  rowCardStyle,
                ]}
              >
                <Text style={[styles.settingsFeatureTitle, { color: palette.text }]}>
                  Allow External Sharing
                </Text>
                <Switch
                  value={Boolean(settings.security?.allow_external_sharing)}
                  onValueChange={(value) =>
                    updateSetting('security', 'allow_external_sharing', value)
                  }
                />
              </View>

              <Text style={[styles.settingsSectionTitle, { color: palette.text }]}>
                Retention
              </Text>
              <View
                style={[
                  styles.settingsFeatureRow,
                  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
                  rowCardStyle,
                ]}
              >
                <Text style={[styles.settingsFeatureTitle, { color: palette.text }]}>
                  Message retention (days)
                </Text>
                <TextInput
                  value={String(settings.retention?.message_retention_days ?? '')}
                  onChangeText={(value) =>
                    updateSetting('retention', 'message_retention_days', Number(value) || 0)
                  }
                  keyboardType="numeric"
                  style={{
                    color: palette.text,
                    borderColor: palette.borderMuted,
                    borderWidth: 2,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 8,
                    minWidth: 80,
                    textAlign: 'right',
                  }}
                />
              </View>
              <View
                style={[
                  styles.settingsFeatureRow,
                  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
                  rowCardStyle,
                ]}
              >
                <Text style={[styles.settingsFeatureTitle, { color: palette.text }]}>
                  File retention (days)
                </Text>
                <TextInput
                  value={String(settings.retention?.file_retention_days ?? '')}
                  onChangeText={(value) =>
                    updateSetting('retention', 'file_retention_days', Number(value) || 0)
                  }
                  keyboardType="numeric"
                  style={{
                    color: palette.text,
                    borderColor: palette.borderMuted,
                    borderWidth: 2,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 8,
                    minWidth: 80,
                    textAlign: 'right',
                  }}
                />
              </View>

              <Text style={[styles.settingsSectionTitle, { color: palette.text }]}>
                Compliance & DLP
              </Text>
              <View
                style={[
                  styles.settingsFeatureRow,
                  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
                  rowCardStyle,
                ]}
              >
                <Text style={[styles.settingsFeatureTitle, { color: palette.text }]}>
                  Legal hold enabled
                </Text>
                <Switch
                  value={Boolean(settings.compliance?.legal_hold_enabled)}
                  onValueChange={(value) =>
                    updateSetting('compliance', 'legal_hold_enabled', value)
                  }
                />
              </View>
              <View
                style={[
                  styles.settingsFeatureRow,
                  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
                  rowCardStyle,
                ]}
              >
                <Text style={[styles.settingsFeatureTitle, { color: palette.text }]}>
                  DLP enabled
                </Text>
                <Switch
                  value={Boolean(settings.dlp?.enabled)}
                  onValueChange={(value) => updateSetting('dlp', 'enabled', value)}
                />
              </View>
              <View style={[styles.settingsFeatureRow, rowCardStyle]}>
                <Text style={[styles.settingsFeatureTitle, { color: palette.text }]}>
                  Block patterns (comma separated)
                </Text>
                <TextInput
                  value={patternsToText(settings.dlp?.block_patterns)}
                  onChangeText={(value) =>
                    updateSetting('dlp', 'block_patterns', textToPatterns(value))
                  }
                  placeholder="password, secret, /\\bssn\\b/"
                  placeholderTextColor={palette.subtext}
                  style={{
                    color: palette.text,
                    borderColor: palette.borderMuted,
                    borderWidth: 2,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 8,
                    marginTop: 8,
                  }}
                />
              </View>
              <View style={[styles.settingsFeatureRow, rowCardStyle]}>
                <Text style={[styles.settingsFeatureTitle, { color: palette.text }]}>
                  Warn patterns (comma separated)
                </Text>
                <TextInput
                  value={patternsToText(settings.dlp?.warn_patterns)}
                  onChangeText={(value) =>
                    updateSetting('dlp', 'warn_patterns', textToPatterns(value))
                  }
                  placeholder="confidential, /\\bpii\\b/"
                  placeholderTextColor={palette.subtext}
                  style={{
                    color: palette.text,
                    borderColor: palette.borderMuted,
                    borderWidth: 2,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 8,
                    marginTop: 8,
                  }}
                />
              </View>

              <Text style={[styles.settingsSectionTitle, { color: palette.text }]}>
                Data Residency
              </Text>
              <View
                style={[
                  styles.settingsFeatureRow,
                  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
                  rowCardStyle,
                ]}
              >
                <Text style={[styles.settingsFeatureTitle, { color: palette.text }]}>
                  Region
                </Text>
                <TextInput
                  value={settings.data_residency?.region ?? 'auto'}
                  onChangeText={(value) =>
                    updateSetting('data_residency', 'region', value)
                  }
                  style={{
                    color: palette.text,
                    borderColor: palette.borderMuted,
                    borderWidth: 2,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 8,
                    minWidth: 100,
                    textAlign: 'right',
                  }}
                />
              </View>

              <Text style={[styles.settingsSectionTitle, { color: palette.text }]}>
                Integrations
              </Text>
              <View
                style={[
                  styles.settingsFeatureRow,
                  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
                  rowCardStyle,
                ]}
              >
                <Text style={[styles.settingsFeatureTitle, { color: palette.text }]}>
                  Require SSO
                </Text>
                <Switch
                  value={Boolean(settings.integrations?.sso_required)}
                  onValueChange={(value) =>
                    updateSetting('integrations', 'sso_required', value)
                  }
                />
              </View>
              <View
                style={[
                  styles.settingsFeatureRow,
                  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
                  rowCardStyle,
                ]}
              >
                <Text style={[styles.settingsFeatureTitle, { color: palette.text }]}>
                  SCIM enabled
                </Text>
                <Switch
                  value={Boolean(settings.integrations?.scim_enabled)}
                  onValueChange={(value) =>
                    updateSetting('integrations', 'scim_enabled', value)
                  }
                />
              </View>
            </>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}
