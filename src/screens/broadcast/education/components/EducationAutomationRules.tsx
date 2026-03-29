import React from 'react';
import { View, Text, Switch } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';

type Rule = {
  key: string;
  label: string;
  description: string;
  requiredTier: string;
};

type Props = {
  rules: Record<string, boolean>;
  onToggle: (key: string, value: boolean) => void;
  tierLabel?: string | null;
  isTierAtLeast: (name: string) => boolean;
};

const RULE_DEFINITIONS: Rule[] = [
  { key: 'auto_enroll', label: 'Auto-enroll learners', description: 'Grant course access when they hit the funnel.', requiredTier: 'business pro' },
  { key: 'auto_reminders', label: 'Auto reminders', description: 'Send reminder messages before lessons.', requiredTier: 'business' },
  { key: 'credit_gating', label: 'Credit gating', description: 'Gate paid modules with credit approvals.', requiredTier: 'business pro' },
];

export default function EducationAutomationRules({
  rules,
  onToggle,
  tierLabel,
  isTierAtLeast,
}: Props) {
  const { palette } = useKISTheme();

  return (
    <View
      style={{
        borderWidth: 2,
        borderColor: palette.divider,
        borderRadius: 22,
        padding: 12,
        backgroundColor: palette.card,
        gap: 8,
      }}
    >
      <Text style={{ color: palette.text, fontWeight: '900', fontSize: 16 }}>Automation rules</Text>
      <Text style={{ color: palette.subtext, fontSize: 12 }}>
        Current tier: {tierLabel ?? 'Unknown'} • Unlock higher automation tiers with credits.
      </Text>
      {RULE_DEFINITIONS.map((rule) => {
        const disabled = !isTierAtLeast(rule.requiredTier);
        return (
          <View
            key={rule.key}
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ color: palette.text, fontWeight: '900' }}>{rule.label}</Text>
              <Text style={{ color: disabled ? palette.danger ?? palette.subtext : palette.subtext, fontSize: 12 }}>
                {rule.description}
                {disabled ? ` • Requires ${rule.requiredTier}` : ''}
              </Text>
            </View>
            <Switch
              value={!!rules[rule.key]}
              disabled={disabled}
              onValueChange={(value) => onToggle(rule.key, value)}
              thumbColor={palette.primaryStrong}
            />
          </View>
        );
      })}
    </View>
  );
}
