import React from 'react';
import { Text, TextProps, TextStyle } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { TypographyPreset } from '@/theme/foundations/fonts';
import { useGlobalProfilePreview } from '@/components/profile/GlobalProfilePreviewProvider';
import { splitTextByKisHandles } from '@/utils/kisHandle';

type Props = TextProps & {
  preset?: TypographyPreset;
  color?: string;
  weight?: TextStyle['fontWeight'];
  autoLinkHandles?: boolean;
};

export default function KISText({
  preset = 'body',
  color,
  weight,
  autoLinkHandles = true,
  style,
  children,
  ...rest
}: Props) {
  const { typography, palette } = useKISTheme();
  const { openProfileByHandle } = useGlobalProfilePreview();
  const baseStyle = typography.getStyle(preset, color);
  const linkStyle: TextStyle = {
    color: palette.primaryStrong,
    fontWeight: '700',
    textDecorationLine: 'underline',
  };

  const renderLinkedString = (text: string, keyPrefix: string) =>
    splitTextByKisHandles(text).map((segment, index) => {
      if (segment.type === 'text') return segment.value;
      return (
        <Text
          key={`${keyPrefix}-handle-${index}`}
          style={linkStyle}
          suppressHighlighting
          onPress={() => {
            void openProfileByHandle(segment.handle);
          }}
        >
          {segment.value}
        </Text>
      );
    });

  const renderChildren = (value: any, keyPrefix: string): any => {
    if (!autoLinkHandles) return value;
    if (typeof value === 'string' || typeof value === 'number') {
      return renderLinkedString(String(value), keyPrefix);
    }
    if (Array.isArray(value)) {
      return value.map((entry, index) => renderChildren(entry, `${keyPrefix}-${index}`));
    }
    return value;
  };

  return (
    <Text style={[baseStyle, weight ? { fontWeight: weight } : undefined, style]} {...rest}>
      {renderChildren(children, 'root')}
    </Text>
  );
}
