import React from 'react';
import { Pressable, Text, View } from 'react-native';

type Option = { id: string; name: string };

type Props = {
  palette: any;
  label: string;
  options: Option[];
  selectedIds: string[];
  onToggle: (id: string) => void;
};

export default function AssignChips({
  palette,
  label,
  options,
  selectedIds,
  onToggle,
}: Props) {
  if (options.length === 0) return null;

  return (
    <View style={{ marginTop: 6 }}>
      <Text style={{ color: palette.subtext, fontSize: 12, marginBottom: 6 }}>
        {label}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {options.map((item) => {
          const active = selectedIds.includes(item.id);
          return (
            <Pressable
              key={item.id}
              onPress={() => onToggle(item.id)}
              style={({ pressed }) => ({
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 999,
                borderWidth: 2,
                borderColor: palette.borderMuted,
                backgroundColor: active ? palette.primarySoft : 'transparent',
                marginRight: 8,
                marginBottom: 8,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Text style={{ color: palette.text, fontSize: 12, fontWeight: '600' }}>
                {item.name}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
