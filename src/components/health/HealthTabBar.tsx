import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { KISIcon } from '@/constants/kisIcons';
import KISButton from '@/constants/KISButton';
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
 * Single shared horizontal tab bar for the health provider screens, built
 * on the app's one standard KISButton (primary = selected, outline =
 * unselected) per the app-wide button-consistency pass — same selection
 * look every other tab/segmented control in the app now uses, instead of
 * this bar's own previously bespoke accent-tinted pill. accentColor/
 * badgeColor are kept as props only for the badge-count dot (KISButton has
 * no native badge slot), not for the tab's own selected/unselected fill
 * anymore.
 */
export default function HealthTabBar({ palette, badgeColor, tabs, activeTabId, onChange }: HealthTabBarProps) {
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
        const hasBadge = typeof tab.badgeCount === 'number' && tab.badgeCount > 0;
        return (
          <View key={tab.id} style={{ position: 'relative' }}>
            <KISButton
              size="xs"
              variant={isActive ? 'primary' : 'outline'}
              onPress={() => onChange(tab.id)}
              left={
                tab.icon ? (
                  <KISIcon name={tab.icon as any} size={13} color={isActive ? undefined : palette.subtext} />
                ) : undefined
              }
              title={tab.label}
            />
            {hasBadge ? (
              <View
                style={{
                  position: 'absolute',
                  top: -4,
                  right: -4,
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
          </View>
        );
      })}
    </ScrollView>
  );
}
