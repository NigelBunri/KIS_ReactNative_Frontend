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
      <View style={[styles.searchWrap, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
        <View style={[styles.searchInput,]}>
          <View style={[styles.searchIcon, { backgroundColor: palette.surface }]}>
            <KISIcon name="search" size={16} color={palette.subtext} />
          </View>
          <KISTextInput
            layout={{ size: 'md', bordered: false }}
            placeholder={searchPlaceholder}
            placeholderTextColor={palette.subtext}
            value={searchValue}
            onChangeText={onSearchChange}
            style={styles.textInput}
          />
        </View>
        <Pressable
          onPress={onFilterPress}
          style={[
            styles.filterBtn,
            {
              borderColor: filterActive ? palette.primaryStrong : palette.divider,
              backgroundColor: filterActive ? palette.primarySoft : 'transparent',
            },
          ]}
        >
          <KISIcon name="filter" size={16} color={filterActive ? palette.primaryStrong : palette.subtext} />
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
      borderWidth: 2,
      borderRadius: 18,
      paddingHorizontal: 12,
      paddingVertical: 4,
      height: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    searchInput: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      height: '100%',
    },
    searchIcon: {
      width: 32,
      height: 32,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    textInput: {
      flex: 1,
      height: 32,
      paddingVertical: 0,
    },
    filterBtn: {
      borderWidth: 2,
      borderRadius: 16,
      paddingHorizontal: 14,
      height: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 8,
    },
  });
