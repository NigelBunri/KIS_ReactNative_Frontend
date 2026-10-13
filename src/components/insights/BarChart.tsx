import React from 'react';
import { View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import type { InsightBreakdownItem } from '@/api/insights/types';
import { useKISTheme } from '@/theme/useTheme';

type Props = {
  data: InsightBreakdownItem[];
  width?: number;
  height?: number;
};

export default function BarChart({ data, width = 260, height = 120 }: Props) {
  const { palette } = useKISTheme();
  if (!data.length) return null;
  const max = Math.max(...data.map((item) => item.value));
  // Guard against more bars than fit: data.length beyond ~width/8 would
  // otherwise make barWidth negative, which SVG silently clamps to a
  // zero-width (invisible) bar instead of erroring - so a breakdown with
  // many categories would render blank with no visual indication.
  const barWidth = Math.max(width / data.length - 8, 1);
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
              // Theme-aware fallback (was a hardcoded indigo hex) so bars
              // without an explicit color still match the active accent
              // theme and dark/light mode instead of always rendering the
              // same off-brand indigo.
              fill={item.color ?? palette.primary}
              rx={6}
            />
          );
        })}
      </Svg>
    </View>
  );
}
