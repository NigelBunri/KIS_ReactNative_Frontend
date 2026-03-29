import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import styles from '@/components/partners/partnersStyles';

export type KeyValueRow = { key: string; value: string };

type Props = {
  palette: any;
  rows: KeyValueRow[];
  onChange: (rows: KeyValueRow[]) => void;
  addLabel?: string;
};

export default function KeyValueEditor({ palette, rows, onChange, addLabel }: Props) {
  const updateRow = (index: number, next: Partial<KeyValueRow>) => {
    const updated = rows.map((row, rowIndex) =>
      rowIndex === index ? { ...row, ...next } : row,
    );
    onChange(updated);
  };

  const removeRow = (index: number) => {
    const updated = rows.filter((_, rowIndex) => rowIndex !== index);
    onChange(updated);
  };

  const addRow = () => {
    onChange([...rows, { key: '', value: '' }]);
  };

  return (
    <View>
      {rows.map((row, index) => (
        <View
          key={`${row.key}-${index}`}
          style={[
            styles.settingsFeatureRow,
            {
              borderColor: palette.borderMuted,
              backgroundColor: palette.surface,
              marginTop: 8,
            },
          ]}
        >
          <TextInput
            value={row.key}
            onChangeText={(value) => updateRow(index, { key: value })}
            placeholder="Field"
            placeholderTextColor={palette.subtext}
            style={{
              color: palette.text,
              borderColor: palette.borderMuted,
              borderWidth: 2,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 8,
            }}
          />
          <TextInput
            value={row.value}
            onChangeText={(value) => updateRow(index, { value })}
            placeholder="Value"
            placeholderTextColor={palette.subtext}
            style={{
              color: palette.text,
              borderColor: palette.borderMuted,
              borderWidth: 2,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 8,
              marginTop: 8,
            }}
          />
          <Pressable
            onPress={() => removeRow(index)}
            style={({ pressed }) => [
              {
                marginTop: 8,
                paddingVertical: 6,
                borderRadius: 8,
                borderWidth: 2,
                borderColor: palette.borderMuted,
                opacity: pressed ? 0.8 : 1,
                alignItems: 'center',
              },
            ]}
          >
            <Text style={{ color: palette.text, fontWeight: '700' }}>REMOVE</Text>
          </Pressable>
        </View>
      ))}
      <Pressable
        onPress={addRow}
        style={({ pressed }) => [
          {
            marginTop: 10,
            paddingVertical: 8,
            borderRadius: 10,
            borderWidth: 2,
            borderColor: palette.borderMuted,
            backgroundColor: palette.primarySoft ?? palette.surface,
            opacity: pressed ? 0.8 : 1,
            alignItems: 'center',
          },
        ]}
      >
        <Text style={{ color: palette.primaryStrong ?? palette.text, fontWeight: '700' }}>
          {addLabel ?? 'ADD FIELD'}
        </Text>
      </Pressable>
    </View>
  );
}
