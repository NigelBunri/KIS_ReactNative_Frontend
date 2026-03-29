import React from 'react';
import { View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import type { InsightBreakdownItem } from '@/api/insights/types';

type Props = {
  data: InsightBreakdownItem[];
  width?: number;
  height?: number;
};

export default function BarChart({ data, width = 260, height = 120 }: Props) {
  if (!data.length) return null;
  const max = Math.max(...data.map((item) => item.value));
  const barWidth = width / data.length - 8;
  return (
    <View>
      <Svg width={width} height={height}>
        {data.map((item, index) => {
          const x = index * (barWidth + 8);
          const barHeight = max === 0 ? 0 : (item.value / max) * (height - 16);
          return (
            <Rect
              key={item.label + index}
              x={x}
              y={height - barHeight}
              width={barWidth}
              height={barHeight}
              fill={item.color ?? '#6366F1'}
              rx={6}
            />
          );
        })}
      </Svg>
    </View>
  );
}
