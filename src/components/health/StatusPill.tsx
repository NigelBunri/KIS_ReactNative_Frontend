import React from 'react';
import { View, Text } from 'react-native';

type StatusPillProps = {
  label: string;
  color: string;
  compact?: boolean;
};

/**
 * Shared colored status pill for status/priority/severity/triage-level/
 * referral-state across the health provider screens. Callers keep their
 * own label -> color lookup (the domain meaning of "urgent" differs by
 * context) and pass the resolved color straight through — rendering is
 * unified, replacing CCC's Badge + ad hoc triage badge + Solo's inline
 * appointment-status view.
 */
export default function StatusPill({ label, color, compact = false }: StatusPillProps) {
  return (
    <View
      style={{
        backgroundColor: color + '1F',
        borderColor: color + '55',
        borderWidth: 1,
        borderRadius: 99,
        paddingHorizontal: compact ? 8 : 10,
        paddingVertical: compact ? 2 : 4,
        alignSelf: 'flex-start',
      }}
    >
      <Text
        style={{
          color,
          fontSize: compact ? 10 : 11,
          fontWeight: '700',
          textTransform: 'capitalize',
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}
