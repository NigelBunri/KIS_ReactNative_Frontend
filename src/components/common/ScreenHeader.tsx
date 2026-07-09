// src/components/common/ScreenHeader.tsx
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { KIS_TOKENS } from '@/theme/constants';
import { KISIcon } from '@/constants/kisIcons';
import { useSafeTopInset } from '@/hooks/useSafeTopInset';

type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  backgroundColor?: string;
  borderColor?: string;
};

/**
 * Shared top-of-screen header: background reaches the true top edge of the
 * device (render it as the first child of a plain `<View style={{flex:1}}>`
 * root — NOT inside a `SafeAreaView`, which would clip/offset it before it
 * can paint behind the status bar). Content (back button, title) is padded
 * by the real device inset, never a hardcoded literal.
 */
export function ScreenHeader({
  title,
  subtitle,
  onBack,
  right,
  backgroundColor,
  borderColor,
}: ScreenHeaderProps) {
  const { palette } = useKISTheme();
  const topInset = useSafeTopInset();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: backgroundColor ?? palette.card,
          borderBottomColor: borderColor ?? palette.divider,
          paddingTop: topInset + KIS_TOKENS.SCREEN_HEADER_TOP_PADDING,
        },
      ]}
    >
      <View style={styles.row}>
        {onBack ? (
          <Pressable onPress={onBack} style={styles.sideSlot} hitSlop={12}>
            <KISIcon name="arrow-left" size={22} color={palette.text} />
          </Pressable>
        ) : (
          <View style={styles.sideSlot} />
        )}

        <View style={styles.titleWrap}>
          <Text style={[styles.title, { color: palette.text }]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: palette.subtext }]} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        {right ?? <View style={styles.sideSlot} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  sideSlot: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrap: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
});

export default ScreenHeader;
