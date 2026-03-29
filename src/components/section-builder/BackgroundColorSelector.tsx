import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { LANDING_BACKGROUND_COLOR_OPTIONS } from './backgroundOptions';

type Props = {
  value?: string;
  onChange: (key: string) => void;
  palette: any;
  typography: any;
  spacing: any;
  title?: string;
  disabled?: boolean;
};

export default function BackgroundColorSelector({ value, onChange, palette, typography, spacing, title, disabled }: Props) {
  return (
    <View style={{ marginTop: spacing.sm }}>
      {title ? <Text style={{ ...typography.label, color: palette.text, marginBottom: spacing.xs }}>{title}</Text> : null}
      {disabled ? (
        <Text style={{ ...typography.caption, color: palette.subtext, marginBottom: spacing.xs }}>
          Background image is active. Remove it to apply a section color.
        </Text>
      ) : null}
      <View style={{ gap: spacing.xs }}>
        {LANDING_BACKGROUND_COLOR_OPTIONS.map((option) => {
          const active = value === option.key;
          return (
            <TouchableOpacity
              key={option.key}
              onPress={() => {
                if (disabled) return;
                onChange(option.key);
              }}
              disabled={disabled}
              style={{
                borderWidth: 1,
                borderColor: active ? palette.accentPrimary : palette.divider,
                borderRadius: spacing.sm,
                backgroundColor: palette.card,
                padding: spacing.xs,
                opacity: disabled ? 0.5 : 1,
              }}
            >
              <View
                style={{
                  borderRadius: spacing.xs,
                  borderWidth: 1,
                  borderColor: palette.divider,
                  backgroundColor: option.color,
                  padding: spacing.xs,
                }}
              >
                <View style={{ borderRadius: spacing.xs, backgroundColor: '#ffffffAA', padding: spacing.xs }}>
                  <View style={{ height: 8, borderRadius: 6, backgroundColor: '#1f2937AA', marginBottom: 6 }} />
                  <View style={{ height: 7, borderRadius: 6, backgroundColor: '#1f293755', marginBottom: 6 }} />
                  <View style={{ width: '45%', height: 20, borderRadius: 999, backgroundColor: '#1f293722' }} />
                </View>
              </View>
              <View style={{ marginTop: spacing.xs, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ ...typography.body, color: palette.text }}>{option.label}</Text>
                {active ? <Text style={{ ...typography.caption, color: palette.accentPrimary }}>Selected</Text> : null}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
