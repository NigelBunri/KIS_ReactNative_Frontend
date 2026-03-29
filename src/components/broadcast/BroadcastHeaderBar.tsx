import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';

type Props = {
  title: string;
  tierLabel?: string;
  onCreate?: () => void;
};

export default function BroadcastHeaderBar({ title, tierLabel = 'Business Pro', onCreate }: Props) {
  const { palette, tokens } = useKISTheme();
  const styles = useMemo(() => makeStyles(tokens), [tokens]);

  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <Text style={[styles.title, { color: palette.text }]}>{title}</Text>
        <View style={[styles.badge, { backgroundColor: palette.primarySoft, borderColor: palette.primary }]}>
          <Text style={{ color: palette.primaryStrong, fontWeight: '900', fontSize: 11 }}>
            {tierLabel}
          </Text>
        </View>
      </View>

      <Pressable
        onPress={onCreate}
        style={[styles.createBtn, { backgroundColor: palette.primaryStrong }]}
        accessibilityRole="button"
      >
        <KISIcon name="plus" size={16} color="#fff" />
        <Text style={{ color: '#fff', fontWeight: '900' }}>Create</Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (_tokens: any) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 6,
    },
    left: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    title: {
      fontSize: 22,
      fontWeight: '900',
      letterSpacing: -0.4,
    },
    badge: {
      borderWidth: 2,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    createBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 10,
      shadowColor: '#000',
      shadowOpacity: 0.10,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 4,
    },
  });
