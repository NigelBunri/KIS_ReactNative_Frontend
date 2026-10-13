import React from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import type { InsightBreakdownItem } from '@/api/insights/types';
import { useKISTheme } from '@/theme/useTheme';

type Props = {
  data: InsightBreakdownItem[];
  size?: number;
  strokeWidth?: number;
};

export default function DonutChart({ data, size = 140, strokeWidth = 14 }: Props) {
  const { palette } = useKISTheme();
  if (!data.length) return null;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = data.reduce((sum, entry) => sum + entry.value, 0);
  let offsetAccum = 0;
  return (
    <View>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        {data.map((entry) => {
          const percent = total === 0 ? 0 : entry.value / total;
          const strokeDasharray = `${circumference * percent} ${circumference}`;
          const strokeDashoffset = circumference * offsetAccum;
          // Theme-aware fallback (was a hardcoded green hex) so a segment
          // without an explicit color matches the active accent/dark mode.
          const color = entry.color ?? palette.success;
          offsetAccum += percent;
          return (
            <Circle
              key={entry.label}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={color}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDasharray}
              strokeDashoffset={strokeDashoffset}
              fill="none"
            />
          );
        })}
      </Svg>
    </View>
  );
}
