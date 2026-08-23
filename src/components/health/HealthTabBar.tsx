import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { KISIcon } from '@/constants/kisIcons';
import { HealthThemeColors, HEALTH_THEME_SPACING } from '@/theme/health';

export type HealthTab = {
  id: string;
  label: string;
  icon?: string;
  badgeCount?: number;
};

type HealthTabBarProps = {
  palette: HealthThemeColors;
  accentColor: string;
  badgeColor: string;
  tabs: HealthTab[];
  activeTabId: string;
  onChange: (id: string) => void;
};

/**
 * Single shared horizontal tab bar for the health provider screens —
 * filled-pill active state (closer to Practo's segmented nav than a text
 * underline), compact footprint. Replaces both screens' previously
 * separate, visually inconsistent tab bar implementations.
 */
export default function HealthTabBar({ palette, accentColor, badgeColor, tabs, activeTabId, onChange }: HealthTabBarProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        paddingHorizontal: HEALTH_THEME_SPACING.md,
        paddingVertical: HEALTH_THEME_SPACING.xs,
        gap: 6,
        flexDirection: 'row',
      }}
    >
      {tabs.map((tab) => {
        const isActive = activeTabId === tab.id;
        return (
          <Pressable
            key={tab.id}
            onPress={() => onChange(tab.id)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              borderWidth: 1.5,
              borderColor: isActive ? accentColor : palette.divider,
              backgroundColor: isActive ? accentColor + '1F' : palette.surface,
              borderRadius: 999,
              paddingHorizontal: 12,
              paddingVertical: 6,
            }}
          >
            {tab.icon ? (
              <KISIcon name={tab.icon as any} size={13} color={isActive ? accentColor : palette.subtext} />
            ) : null}
            <Text
              style={{
                color: isActive ? accentColor : palette.subtext,
                fontWeight: '800',
                fontSize: 12,
              }}
            >
              {tab.label}
            </Text>
            {typeof tab.badgeCount === 'number' && tab.badgeCount > 0 ? (
              <View
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 8,
                  backgroundColor: badgeColor,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 9 }}>{tab.badgeCount}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
