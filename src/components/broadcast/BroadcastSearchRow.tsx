import React, { useMemo } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import { useResponsiveLayout } from '@/theme/responsive';

type Props = {
  searchPlaceholder: string;
  searchValue: string;
  onSearchChange: (next: string) => void;
  onFilterPress: () => void;
  filterLabel: string;
  filterActive: boolean;
};

// Height shared by both the input row and the filter pill so they always align.
const ROW_HEIGHT = 44;
const COMPACT_ROW_HEIGHT = 38;

export default function BroadcastSearchRow({
  searchPlaceholder,
  searchValue,
  onSearchChange,
  onFilterPress,
  filterLabel,
  filterActive,
}: Props) {
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const compact = responsive.isWatch || responsive.isCompactPhone;

  const rowH = compact ? COMPACT_ROW_HEIGHT : ROW_HEIGHT;
  const fontSize = responsive.labelFontSize + (compact ? 0 : 1);

  const styles = useMemo(() => makeStyles(rowH), [rowH]);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: 'rgba(23,17,31,0.26)',
          borderColor: filterActive
            ? 'rgba(255,244,184,0.44)'
            : 'rgba(255,244,184,0.24)',
          shadowColor: '#000',
        },
      ]}
    >
      {/* ── Search icon ──────────────────────────────────────────────────── */}
      <View style={styles.iconWrap}>
        <KISIcon name="search" size={16} color="rgba(255,244,184,0.85)" />
      </View>

      {/* ── Text input ───────────────────────────────────────────────────── */}
      <TextInput
        style={[styles.input, { fontSize, color: 'rgba(255,244,184,0.95)' }]}
        placeholder={searchPlaceholder}
        placeholderTextColor="rgba(255,244,184,0.55)"
        value={searchValue}
        onChangeText={onSearchChange}
        returnKeyType="search"
        clearButtonMode="while-editing"
        textAlignVertical="center"
        {...(Platform.OS === 'android' ? { includeFontPadding: false } : {})}
      />

      {/* ── Vertical separator ───────────────────────────────────────────── */}
      <View style={styles.separator} />

      {/* ── Filter pill ──────────────────────────────────────────────────── */}
      <Pressable
        onPress={onFilterPress}
        style={({ pressed }) => [
          styles.filterBtn,
          {
            borderColor: filterActive
              ? 'rgba(255,244,184,0.5)'
              : 'rgba(255,244,184,0.22)',
            backgroundColor: filterActive
              ? 'rgba(255,244,184,0.18)'
              : 'transparent',
            opacity: pressed ? 0.75 : 1,
          },
        ]}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={`Filter: ${filterLabel}`}
      >
        <KISIcon name="filter" size={14} color="rgba(255,244,184,0.9)" />
        {!responsive.isWatch && (
          <Text
            style={[styles.filterText, { fontSize }]}
            numberOfLines={1}
          >
            {filterLabel}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

const makeStyles = (rowH: number) =>
  StyleSheet.create({
    container: {
      // Single fixed-height row — search input and filter pill share this height
      // so they are always perfectly vertically centred against each other.
      height: rowH,
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderRadius: rowH / 2,
      paddingHorizontal: 12,
      shadowOpacity: 0.06,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 2,
    },
    iconWrap: {
      // Fixed-width icon slot — keeps the icon from shifting when text changes.
      width: 28,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    input: {
      // Takes all remaining horizontal space.
      flex: 1,
      // Match the container height so there is no extra vertical padding.
      height: rowH,
      // Suppress platform-specific internal padding that breaks vertical centre.
      paddingTop: 0,
      paddingBottom: 0,
      paddingHorizontal: 6,
      // iOS: TextInput has a small built-in top offset; this cancels it.
      ...Platform.select({ ios: { lineHeight: undefined } }),
    },
    separator: {
      width: StyleSheet.hairlineWidth,
      height: rowH * 0.55,
      backgroundColor: 'rgba(255,244,184,0.22)',
      marginHorizontal: 8,
      flexShrink: 0,
    },
    filterBtn: {
      // Same height reference as the outer container so the pill aligns naturally.
      height: rowH - 10,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      paddingHorizontal: 10,
      borderWidth: 1,
      borderRadius: (rowH - 10) / 2,
      flexShrink: 0,
    },
    filterText: {
      color: 'rgba(255,244,184,0.9)',
      fontWeight: '700',
    },
  });
