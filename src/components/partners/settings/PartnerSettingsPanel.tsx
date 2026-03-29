import React from 'react';
import {
  Alert,
  Animated,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import styles from '@/components/partners/partnersStyles';
import {
  PartnerRole,
  PartnerSettingsSection,
  canAccessFeature,
} from './partnerSettingsData';

type Props = {
  isOpen: boolean;
  panelWidth: number;
  panelTranslateX: Animated.Value;
  section?: PartnerSettingsSection;
  role: PartnerRole;
  onClose: () => void;
  onOpenRecruitment?: () => void;
  onOpenAudit?: () => void;
  onOpenPolicy?: () => void;
  onOpenIntegrations?: () => void;
  onOpenAutomation?: () => void;
  onOpenReports?: () => void;
  onOpenGovernance?: () => void;
  onOpenFeature?: (feature: { key: string; title: string; description?: string }) => void;
  onOpenOrgProfile?: () => void;
  onOpenComplaints?: () => void;
};

export default function PartnerSettingsPanel({
  isOpen,
  panelWidth,
  panelTranslateX,
  section,
  role,
  onClose,
  onOpenRecruitment,
  onOpenAudit,
  onOpenPolicy,
  onOpenIntegrations,
  onOpenAutomation,
  onOpenReports,
  onOpenGovernance,
  onOpenFeature,
  onOpenOrgProfile,
}: Props) {
  const { palette } = useKISTheme();

  if (!isOpen || !section) return null;

  const backdropOpacity = panelTranslateX.interpolate({
    inputRange: [0, panelWidth],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

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
              {section.title}
            </Text>
            <Text
              style={[
                styles.settingsPanelDescription,
                { color: palette.subtext },
              ]}
            >
              {section.description}
            </Text>
          </View>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.settingsPanelBody}
          showsVerticalScrollIndicator={false}
        >
          {section.features.map((feature) => {
            const allowed = feature.allowed ?? canAccessFeature(role, feature);
            const enabled = feature.enabled ?? true;
            const statusLabel = !allowed
              ? 'LOCKED'
              : enabled
                ? 'ENABLED'
                : 'DISABLED';
            const statusColor = !allowed
              ? palette.danger
              : enabled
                ? palette.success
                : palette.warning;
            return (
              <Pressable
                key={feature.key}
                onPress={() => {
                  if (!allowed) {
                    Alert.alert(
                      'Access restricted',
                      'This feature is limited to higher roles.',
                    );
                    return;
                  }
                  if (feature.key === 'recruitment_pipeline') {
                    onOpenRecruitment?.();
                    return;
                  }
                  if (feature.key === 'audit_log') {
                    onOpenAudit?.();
                    return;
                  }
                  if (feature.key === 'org_profile') {
                    onOpenOrgProfile?.();
                    return;
                  }
                  if (['access_requests', 'approval_flows'].includes(feature.key)) {
                    onOpenGovernance?.();
                    return;
                  }
                  if (['org_policies', 'security_center', 'compliance_center'].includes(feature.key)) {
                    onOpenPolicy?.();
                    return;
                  }
                  if (feature.key === 'org_integrations') {
                    onOpenIntegrations?.();
                    return;
                  }
                  if (feature.key === 'automation_rules') {
                    onOpenAutomation?.();
                    return;
                  }
                  if (feature.key === 'data_exports') {
                    onOpenReports?.();
                    return;
                  }
                  if (feature.key === 'complaints') {
                    onOpenComplaints?.();
                    return;
                  }
                  if (onOpenFeature) {
                    onOpenFeature({
                      key: feature.key,
                      title: feature.title,
                      description: feature.description,
                    });
                    return;
                  }
                  Alert.alert('Partner', `${feature.title} settings open here.`);
                }}
                style={({ pressed }) => [
                  styles.settingsFeatureRow,
                  {
                    backgroundColor: palette.surface,
                    borderColor: allowed ? palette.borderMuted : palette.borderDanger,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Text style={[styles.settingsFeatureTitle, { color: palette.text }]}>
                  {feature.title}
                </Text>
                <Text
                  style={[
                    styles.settingsFeatureDescription,
                    { color: palette.subtext },
                  ]}
                >
                  {feature.description}
                </Text>
                <Text
                  style={[
                    styles.settingsFeatureMeta,
                    { color: statusColor },
                  ]}
                >
                  {statusLabel}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </Animated.View>
    </View>
  );
}
