// src/components/partners/PartnerMembershipRulesPanel.tsx
//
// Community Governance > Membership Rules. The backend already had a
// full PATCH /api/v1/partners/<id>/join-config/ endpoint (and the config
// itself nested in the partner detail payload) — it just had no frontend
// anywhere. This is that missing UI, not new backend.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Pressable, ScrollView, Switch, Text, View } from 'react-native';
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

type JoinConfig = {
  allow_public_listing: boolean;
  allow_apply: boolean;
  allow_subscribe: boolean;
  auto_approve: boolean;
  require_profile: boolean;
  methods: string[];
};

const ALL_METHODS: { key: string; label: string }[] = [
  { key: 'application', label: 'Application review' },
  { key: 'subscription', label: 'Free subscription' },
  { key: 'invite', label: 'Invite only' },
  { key: 'referral', label: 'Member referral' },
  { key: 'auto_approve', label: 'Auto-approve everyone' },
  { key: 'staff_pick', label: 'Staff pick / hand-selected' },
  { key: 'event_pass', label: 'Event pass holders' },
];

function ToggleRow({ label, description, value, onValueChange, palette }: {
  label: string; description: string; value: boolean; onValueChange: (v: boolean) => void; palette: any;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 }}>
      <View style={{ flex: 1, marginRight: 12 }}>
        <Text style={{ color: palette.text, fontSize: 13, fontWeight: '600' }}>{label}</Text>
        <Text style={{ color: palette.subtext, fontSize: 11, marginTop: 2 }}>{description}</Text>
      </View>
      <Switch value={value} onValueChange={onValueChange} />
    </View>
  );
}

export default function PartnerMembershipRulesPanel({ isOpen, panelWidth, panelTranslateX, partnerId, onClose }: Props) {
  const { palette } = useKISTheme();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<JoinConfig | null>(null);

  const backdropOpacity = panelTranslateX.interpolate({ inputRange: [0, panelWidth], outputRange: [1, 0], extrapolate: 'clamp' });

  const load = useCallback(async () => {
    if (!partnerId) return;
    const res = await getRequest(ROUTES.partners.detail(partnerId), { errorMessage: 'Unable to load membership rules.' });
    const payload = res?.data ?? res ?? {};
    const joinConfig = payload.join_config ?? {};
    setConfig({
      allow_public_listing: joinConfig.allow_public_listing ?? true,
      allow_apply: joinConfig.allow_apply ?? true,
      allow_subscribe: joinConfig.allow_subscribe ?? true,
      auto_approve: joinConfig.auto_approve ?? false,
      require_profile: joinConfig.require_profile ?? true,
      methods: Array.isArray(joinConfig.methods) ? joinConfig.methods : [],
    });
  }, [partnerId]);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [isOpen, load]);

  const patchConfig = (patch: Partial<JoinConfig>) => {
    setConfig((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const toggleMethod = (key: string) => {
    setConfig((prev) => {
      if (!prev) return prev;
      const methods = prev.methods.includes(key) ? prev.methods.filter((m) => m !== key) : [...prev.methods, key];
      return { ...prev, methods };
    });
  };

  const save = async () => {
    if (!partnerId || !config) return;
    setSaving(true);
    const res = await patchRequest(ROUTES.partners.joinConfig(partnerId), config, { errorMessage: 'Unable to save membership rules.' });
    setSaving(false);
    if (!res?.success) {
      Alert.alert('Failed', res?.message ?? 'Unable to save membership rules.');
      return;
    }
    Alert.alert('Saved', 'Membership rules updated.');
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
            <Text style={[styles.settingsPanelTitle, { color: palette.text }]}>Membership Rules</Text>
            <Text style={[styles.settingsPanelDescription, { color: palette.subtext }]}>Who can join and how</Text>
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.settingsPanelBody} showsVerticalScrollIndicator={false}>
          {loading || !config ? (
            <ActivityIndicator size="small" color={palette.primary} />
          ) : (
            <>
              <View style={[styles.settingsFeatureRow, { borderColor: palette.borderMuted, backgroundColor: palette.surface, marginBottom: 16 }]}>
                <ToggleRow
                  label="Public listing"
                  description="Show this organization in discovery search."
                  value={config.allow_public_listing}
                  onValueChange={(v) => patchConfig({ allow_public_listing: v })}
                  palette={palette}
                />
                <ToggleRow
                  label="Accept applications"
                  description="Let people apply to join and get reviewed."
                  value={config.allow_apply}
                  onValueChange={(v) => patchConfig({ allow_apply: v })}
                  palette={palette}
                />
                <ToggleRow
                  label="Accept free subscribers"
                  description="Let people subscribe without a full application."
                  value={config.allow_subscribe}
                  onValueChange={(v) => patchConfig({ allow_subscribe: v })}
                  palette={palette}
                />
                <ToggleRow
                  label="Auto-approve"
                  description="Skip manual review — approve every join request automatically."
                  value={config.auto_approve}
                  onValueChange={(v) => patchConfig({ auto_approve: v })}
                  palette={palette}
                />
                <ToggleRow
                  label="Require a completed profile"
                  description="New members must finish their profile before joining."
                  value={config.require_profile}
                  onValueChange={(v) => patchConfig({ require_profile: v })}
                  palette={palette}
                />
              </View>

              <Text style={[styles.settingsSectionTitle, { color: palette.text, marginBottom: 6 }]}>Join methods offered</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
                {ALL_METHODS.map((m) => {
                  const selected = config.methods.includes(m.key);
                  return (
                    <Pressable
                      key={m.key}
                      onPress={() => toggleMethod(m.key)}
                      style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: selected ? palette.primary : palette.borderMuted }}
                    >
                      <Text style={{ color: selected ? palette.primary : palette.text, fontSize: 12 }}>{m.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Pressable
                onPress={save}
                disabled={saving}
                style={({ pressed }) => [{ paddingVertical: 10, borderRadius: 10, backgroundColor: palette.royalInk, alignItems: 'center', opacity: pressed || saving ? 0.7 : 1 }]}
              >
                <Text style={{ color: palette.ivory, fontWeight: '700' }}>{saving ? 'Saving…' : 'Save membership rules'}</Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}
