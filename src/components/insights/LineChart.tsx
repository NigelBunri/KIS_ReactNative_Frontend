import React from 'react';
import { Dimensions } from 'react-native';
import { Path, Svg } from 'react-native-svg';
import type { InsightSeries } from '@/api/insights/types';

type Props = {
  series: InsightSeries[];
  width?: number;
  height?: number;
  strokeWidth?: number;
  color?: string;
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function LineChart({
  series,
  width = SCREEN_WIDTH - 48,
  height = 160,
  strokeWidth = 3,
  color = '#3B82F6',
}: Props) {
  const data = series[0]?.data ?? [];
  if (!data.length) return null;
  const values = data.map((point) => point.y);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max === min ? 1 : max - min;

  const path = data
    .map((point, index) => {
      const x = (index / (data.length - 1 || 1)) * width;
      const y = height - ((point.y - min) / span) * height;
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  return (
    <Svg width={width} height={height}>
      <Path
        d={path}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
