import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useKISTheme } from '@/theme/useTheme';
import { KIS_ROYAL_GRADIENTS } from '@/theme/constants';
import { KISIcon } from '@/constants/kisIcons';
import { useResponsiveLayout } from '@/theme/responsive';

export type BroadcastMainTabId =
  | 'feeds'
  | 'channels'
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
  { id: 'channels', label: 'Channels', icon: 'sub-channel' },
  { id: 'education', label: 'Education', icon: 'book' },
  { id: 'market', label: 'Market', icon: 'store' },
  { id: 'healthcare', label: 'Healthcare', icon: 'heart' },
];

export default function BroadcastMainTabs({ value, onChange }: Props) {
  const { palette, tokens, tone } = useKISTheme();
  const responsive = useResponsiveLayout();
  const compact = responsive.isWatch || responsive.isCompactPhone;
  const inactiveTextColor = palette.ivory ?? '#FFFFFF';
  const inactiveIconColor = palette.goldSoft ?? 'rgba(255,244,184,0.86)';
  const styles = useMemo(() => makeStyles(tokens), [tokens]);

  return (
    <View
      style={[
        styles.wrap,
        { backgroundColor: 'transparent', borderColor: 'transparent' },
      ]}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingHorizontal: compact ? 0 : 4 }]}
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
                  paddingHorizontal: compact ? 10 : 15,
                  paddingVertical: compact ? 7 : 8,
                  borderRadius: compact ? 15 : 18,
                  backgroundColor: active ? 'transparent' : 'rgba(255,255,255,0.08)',
                  borderColor: active ? palette.goldLight : 'rgba(255,244,184,0.26)',
                },
              ]}
              accessibilityRole="button"
            >
              {active ? (
                <LinearGradient
                  colors={tone === 'dark' ? [...KIS_ROYAL_GRADIENTS.goldDark] : [...KIS_ROYAL_GRADIENTS.goldLight]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFillObject}
                />
              ) : null}
              <KISIcon
                name={t.icon as any}
                size={compact ? 13 : 15}
                color={active ? palette.onPrimary : inactiveIconColor}
              />
              <Text
                style={{
                  color: active ? palette.onPrimary : inactiveTextColor,
                  fontWeight: '900',
                  marginLeft: compact ? 4 : 6,
                  fontSize: responsive.isWatch ? 11 : 13,
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
      borderWidth: 0,
      borderRadius: 0,
      paddingVertical: 6,
      paddingHorizontal: 0,
      alignItems: 'center',
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
      marginRight: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
  });
