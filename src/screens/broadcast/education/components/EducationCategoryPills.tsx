import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';

type Category = { id: string; name: string; icon?: string };

type Props = {
  items: Category[];
  activeId?: string | null;
  onSelect: (id: string | null) => void;
};

export default function EducationCategoryPills({ items, activeId = null, onSelect }: Props) {
  const { palette } = useKISTheme();

  const allActive = !activeId;

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      <Pressable
        onPress={() => onSelect(null)}
        style={{
          borderWidth: 2,
          borderColor: allActive ? palette.primary : palette.divider,
          backgroundColor: allActive ? palette.primarySoft : palette.surface,
          borderRadius: 999,
          paddingHorizontal: 14,
          paddingVertical: 8,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <KISIcon name="spark" size={14} color={allActive ? palette.primaryStrong : palette.subtext} />
        <Text style={{ color: allActive ? palette.primaryStrong : palette.text, fontWeight: '900' }}>All</Text>
      </Pressable>

      {items.map((c) => {
        const active = activeId === c.id;
        return (
          <Pressable
            key={c.id}
            onPress={() => onSelect(c.id)}
            style={{
              borderWidth: 2,
              borderColor: active ? palette.primary : palette.divider,
              backgroundColor: active ? palette.primarySoft : palette.surface,
              borderRadius: 999,
              paddingHorizontal: 14,
              paddingVertical: 8,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <KISIcon name={(c.icon as any) ?? 'book'} size={14} color={active ? palette.primaryStrong : palette.subtext} />
            <Text style={{ color: active ? palette.primaryStrong : palette.text, fontWeight: '900' }}>
              {c.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
