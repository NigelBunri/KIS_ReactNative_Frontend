import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';

type Props = {
  title: string;
  tierLabel?: string;
  onCreate?: () => void;
};

export default function BroadcastHeaderBar({
  title,
  tierLabel = 'Business Pro',
  onCreate,
}: Props) {
  const { palette, tokens } = useKISTheme();
  const styles = useMemo(() => makeStyles(tokens), [tokens]);

  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <View
          style={[
            styles.mark,
            { backgroundColor: palette.surface, borderColor: palette.border },
          ]}
        >
          <KISIcon name="megaphone" size={18} color={palette.primaryStrong} />
        </View>
        <View>
          <Text style={[styles.eyebrow, { color: palette.subtext }]}>
            Studio signal
          </Text>
          <Text style={[styles.title, { color: palette.text }]}>{title}</Text>
        </View>
        <View
          style={[
            styles.badge,
            {
              backgroundColor: palette.primarySoft,
              borderColor: palette.primary,
            },
          ]}
        >
          <KISIcon name="shield" size={12} color={palette.primaryStrong} />
          <Text
            style={{
              color: palette.primaryStrong,
              fontWeight: '900',
              fontSize: 11,
            }}
          >
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
        <Text style={{ color: '#fff', fontWeight: '900', lineHeight: 16 }}>
          Create
        </Text>
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
      paddingHorizontal: 2,
    },
    left: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      flex: 1,
      minWidth: 0,
    },
    mark: {
      width: 40,
      height: 40,
      borderRadius: 16,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    eyebrow: {
      fontSize: 10,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    title: {
      fontSize: 22,
      fontWeight: '900',
      letterSpacing: 0,
    },
    badge: {
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: 9,
      paddingVertical: 5,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    createBtn: {
      borderRadius: 999,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 14,
      minHeight: 42,
      paddingVertical: 9,
      justifyContent: 'center',
    },
  });
