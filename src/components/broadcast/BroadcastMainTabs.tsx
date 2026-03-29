import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';

export type BroadcastMainTabId = 'feeds' | 'education' | 'market' | 'healthcare';

type TabDef = { id: BroadcastMainTabId; label: string; icon: string };

type Props = {
  value: BroadcastMainTabId;
  onChange: (next: BroadcastMainTabId) => void;
};

const TABS: TabDef[] = [
  { id: 'feeds', label: 'Feeds', icon: 'spark' },
  { id: 'education', label: 'Education', icon: 'book' },
  { id: 'market', label: 'Market', icon: 'store' },
  { id: 'healthcare', label: 'Healthcare', icon: 'heart' },
];

export default function BroadcastMainTabs({ value, onChange }: Props) {
  const { palette, tokens } = useKISTheme();
  const styles = useMemo(() => makeStyles(tokens), [tokens]);

  return (
    <View style={[styles.wrap, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {TABS.map((t) => {
          const active = t.id === value;
          return (
            <Pressable
              key={t.id}
              onPress={() => onChange(t.id)}
              style={[
                styles.pill,
                {
                  backgroundColor: active ? palette.primarySoft : 'transparent',
                  borderColor: active ? palette.primary : 'transparent',
                },
              ]}
              accessibilityRole="button"
            >
              <KISIcon name={t.icon as any} size={14} color={active ? palette.primaryStrong : palette.subtext} />
              <Text style={{ color: active ? palette.primaryStrong : palette.text, fontWeight: '900', marginLeft: 6 }}>
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const makeStyles = (_tokens: any) =>
  StyleSheet.create({
    wrap: {
      borderWidth: 2,
      borderRadius: 999,
      paddingVertical: 6,
      paddingHorizontal: 4,
      alignItems: 'center',
    },
    scrollContent: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 4,
      paddingVertical: 2,
    },
    pill: {
      borderWidth: 2,
      borderRadius: 999,
      paddingVertical: 8,
      paddingHorizontal: 16,
      marginRight: 2,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
