import React, { useState } from 'react';
import { View, LayoutChangeEvent } from 'react-native';
import { Path, Svg } from 'react-native-svg';
import type { InsightSeries } from '@/api/insights/types';

type Props = {
  series: InsightSeries[];
  width?: number;
  height?: number;
  strokeWidth?: number;
  color?: string;
};

export default function LineChart({
  series,
  width: widthProp,
  height = 160,
  strokeWidth = 3,
  color = '#3B82F6',
}: Props) {
  // When no explicit width is given, measure the chart's own rendered
  // container via onLayout instead of assuming it fills the raw device
  // width. Every call site places this chart inside a padded card/column
  // narrower than the full screen — on a tablet, narrower still once the
  // shell's contentMaxWidth cap and card padding are subtracted — so
  // sizing off Dimensions.get('window') always drew a chart wider than
  // its own container, letting the line bleed past the card's edge.
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const width = widthProp ?? measuredWidth;

  const handleLayout = (e: LayoutChangeEvent) => {
    if (widthProp != null) return;
    const w = Math.round(e.nativeEvent.layout.width);
    if (w > 0 && w !== measuredWidth) setMeasuredWidth(w);
  };

  const data = series[0]?.data ?? [];
  if (!data.length) return null;

  let path = '';
  if (width > 0) {
    const values = data.map((point) => point.y);
    const max = Math.max(...values);
    const min = Math.min(...values);
    const span = max === min ? 1 : max - min;
    path = data
      .map((point, index) => {
        const x = (index / (data.length - 1 || 1)) * width;
        const y = height - ((point.y - min) / span) * height;
        return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(' ');
  }

  return (
    <View
      onLayout={widthProp == null ? handleLayout : undefined}
      style={widthProp == null ? { width: '100%', height } : undefined}
    >
      {width > 0 && (
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
      )}
    </View>
  );
}
