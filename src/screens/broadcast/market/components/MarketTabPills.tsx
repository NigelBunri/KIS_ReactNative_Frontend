import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';

export type MarketTabId = 'home' | 'drops' | 'shops' | 'products' | 'insights';

const TABS: { id: MarketTabId; label: string; icon: string }[] = [
  { id: 'home', label: 'Market', icon: 'spark' },
  { id: 'drops', label: 'Drops', icon: 'radio' },
  { id: 'shops', label: 'Shops', icon: 'store' },
  { id: 'products', label: 'Products', icon: 'box' },
  { id: 'insights', label: 'Insights', icon: 'chart' },
];

type Props = {
  value: MarketTabId;
  onChange: (id: MarketTabId) => void;
};

export default function MarketTabPills({ value, onChange }: Props) {
  const { palette } = useKISTheme();

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {TABS.map((t) => {
        const active = value === t.id;
        return (
          <Pressable
            key={t.id}
            onPress={() => onChange(t.id)}
            style={{
              paddingVertical: 8,
              paddingHorizontal: 14,
              borderRadius: 999,
              borderWidth: 2,
              borderColor: active ? palette.primary : palette.divider,
              backgroundColor: active ? palette.primarySoft : palette.surface,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <KISIcon name={t.icon as any} size={14} color={active ? palette.primaryStrong : palette.subtext} />
            <Text style={{ color: active ? palette.primaryStrong : palette.text, fontWeight: '900' }}>
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
