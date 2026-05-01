import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import KISTextInput from '@/constants/KISTextInput';

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
  const styles = useMemo(() => makeStyles(), []);

  return (
    <View>
      <View
        style={[
          styles.searchWrap,
          {
            backgroundColor: palette.surface,
            borderColor: filterActive ? palette.primary : palette.border,
            shadowColor: palette.shadow ?? '#000',
          },
        ]}
      >
        <View style={styles.searchInput}>
          <View
            style={[
              styles.searchIcon,
              { backgroundColor: palette.primarySoft },
            ]}
          >
            <KISIcon name="search" size={16} color={palette.subtext} />
          </View>
          <KISTextInput
            containerStyle={styles.inputContainer}
            layout={{
              size: 'sm',
              bordered: false,
              height: 40,
              minHeight: 40,
              paddingHorizontal: 0,
              paddingVertical: 0,
              wrapStyle: styles.inputWrap,
              inputStyle: styles.inputText,
            }}
            placeholder={searchPlaceholder}
            placeholderTextColor={palette.subtext}
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
                ? palette.primaryStrong
                : palette.border,
              backgroundColor: filterActive
                ? palette.primarySoft
                : 'transparent',
            },
          ]}
        >
          <KISIcon
            name="filter"
            size={16}
            color={filterActive ? palette.primaryStrong : palette.subtext}
          />
          <Text
            style={{
              color: filterActive ? palette.primaryStrong : palette.text,
              fontWeight: '800',
              fontSize: 12,
            }}
          >
            {filterLabel}
          </Text>
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
