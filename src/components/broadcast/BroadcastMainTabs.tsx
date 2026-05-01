import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';

export type BroadcastMainTabId =
  | 'feeds'
  | 'education'
  | 'market'
  | 'healthcare';

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
    <View
      style={[
        styles.wrap,
        { backgroundColor: palette.surface, borderColor: palette.border },
      ]}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {TABS.map(t => {
          const active = t.id === value;
          return (
            <Pressable
              key={t.id}
              onPress={() => onChange(t.id)}
              style={[
                styles.pill,
                {
                  backgroundColor: active ? 'transparent' : 'transparent',
                  borderColor: active ? palette.primary : 'transparent',
                },
              ]}
              accessibilityRole="button"
            >
              {active ? (
                <LinearGradient
                  colors={[palette.primarySoft, palette.surface]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFillObject}
                />
              ) : null}
              <KISIcon
                name={t.icon as any}
                size={15}
                color={active ? palette.primaryStrong : palette.subtext}
              />
              <Text
                style={{
                  color: active ? palette.primaryStrong : palette.text,
                  fontWeight: '900',
                  marginLeft: 6,
                  fontSize: 13,
                }}
              >
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
      borderWidth: 1,
      borderRadius: 22,
      paddingVertical: 6,
      paddingHorizontal: 4,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOpacity: 0.06,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 8 },
      elevation: 2,
    },
    scrollContent: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 4,
      paddingVertical: 2,
    },
    pill: {
      borderWidth: 1,
      borderRadius: 18,
      paddingVertical: 8,
      paddingHorizontal: 15,
      marginRight: 2,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
  });
