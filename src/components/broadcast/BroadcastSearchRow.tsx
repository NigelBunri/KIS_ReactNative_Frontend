import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import KISTextInput from '@/constants/KISTextInput';
import { useResponsiveLayout } from '@/theme/responsive';

type Props = {
  searchPlaceholder: string;
  searchValue: string;
  onSearchChange: (next: string) => void;
  onFilterPress: () => void;
  filterLabel: string;
  filterActive: boolean;
};

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
  const styles = useMemo(() => makeStyles(), []);

  return (
    <View>
      <View
        style={[
          styles.searchWrap,
          {
            backgroundColor: 'rgba(23,17,31,0.26)',
            borderColor: filterActive ? 'rgba(255,244,184,0.44)' : 'rgba(255,244,184,0.24)',
            shadowColor: palette.shadow ?? '#000',
            paddingHorizontal: compact ? 7 : 10,
            paddingVertical: compact ? 5 : 7,
            minHeight: compact ? 46 : 54,
          },
        ]}
      >
        <View style={styles.searchInput}>
          <View
            style={[
              styles.searchIcon,
              { backgroundColor: 'rgba(255,244,184,0.16)' },
            ]}
          >
            <KISIcon name="search" size={16} color={palette.onGold} />
          </View>
          <KISTextInput
            containerStyle={styles.inputContainer}
            layout={{
              size: 'sm',
              bordered: false,
              height: compact ? 36 : 40,
              minHeight: compact ? 36 : 40,
              paddingHorizontal: 0,
              paddingVertical: 0,
              wrapStyle: styles.inputWrap,
              inputStyle: { ...styles.inputText, color: palette.onGold },
            }}
            placeholder={searchPlaceholder}
            placeholderTextColor="rgba(255,244,184,0.78)"
            value={searchValue}
            onChangeText={onSearchChange}
          />
        </View>
        <Pressable
          onPress={onFilterPress}
          style={[
            styles.filterBtn,
            {
              borderColor: filterActive
                ? 'rgba(255,244,184,0.48)'
                : 'rgba(255,244,184,0.26)',
              backgroundColor: filterActive
                ? 'rgba(255,244,184,0.20)'
                : 'rgba(23,17,31,0.14)',
            },
          ]}
        >
          <KISIcon
            name="filter"
            size={16}
            color={filterActive ? palette.onGold : palette.onGold}
          />
          {responsive.isWatch ? null : (
            <Text
              style={{
                color: palette.onGold,
                fontWeight: '800',
                fontSize: responsive.labelFontSize,
              }}
              numberOfLines={1}
            >
              {filterLabel}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    searchWrap: {
      borderWidth: 1,
      borderRadius: 22,
      paddingHorizontal: 10,
      paddingVertical: 7,
      minHeight: 54,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      shadowOpacity: 0.06,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 8 },
      elevation: 2,
    },
    searchInput: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 40,
    },
    searchIcon: {
      width: 32,
      height: 32,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    textInput: {
      flex: 1,
      minHeight: 40,
      paddingVertical: 0,
    },
    inputContainer: {
      flex: 1,
      height: 40,
      marginBottom: 0,
      justifyContent: 'center',
    },
    inputWrap: {
      height: 40,
      minHeight: 40,
      marginBottom: 0,
      minWidth: 0,
      justifyContent: 'center',
      backgroundColor: 'transparent',
    },
    inputText: {
      height: 40,
      minHeight: 40,
      paddingTop: 0,
      paddingBottom: 0,
      textAlignVertical: 'center',
    },
    filterBtn: {
      borderWidth: 1,
      borderRadius: 18,
      paddingHorizontal: 12,
      height: 40,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 8,
      gap: 6,
    },
  });
