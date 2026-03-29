import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import styles from '@/components/partners/partnersStyles';

export type ConditionRow = {
  field: string;
  op: string;
  value: string;
};

type Props = {
  palette: any;
  conditions: ConditionRow[];
  onChange: (conditions: ConditionRow[]) => void;
};

export default function AutomationConditionsForm({ palette, conditions, onChange }: Props) {
  const updateCondition = (index: number, next: Partial<ConditionRow>) => {
    const updated = conditions.map((row, rowIndex) =>
      rowIndex === index ? { ...row, ...next } : row,
    );
    onChange(updated);
  };

  const addCondition = () => {
    onChange([...conditions, { field: '', op: 'eq', value: '' }]);
  };

  const removeCondition = (index: number) => {
    onChange(conditions.filter((_, rowIndex) => rowIndex !== index));
  };

  return (
    <View>
      <Text style={[styles.settingsFeatureTitle, { color: palette.text, marginTop: 12 }]}>
        Conditions
      </Text>
      {conditions.map((condition, index) => (
        <View
          key={`condition-${index}`}
          style={[
            styles.settingsFeatureRow,
            { borderColor: palette.borderMuted, backgroundColor: palette.surface, marginTop: 8 },
          ]}
        >
          <TextInput
            value={condition.field}
            onChangeText={(value) => updateCondition(index, { field: value })}
            placeholder="Field (e.g. status)"
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
            value={condition.op}
            onChangeText={(value) => updateCondition(index, { op: value })}
            placeholder="Operator (eq, in, contains)"
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
          <TextInput
            value={condition.value}
            onChangeText={(value) => updateCondition(index, { value })}
            placeholder="Value (comma-separated for 'in')"
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
            onPress={() => removeCondition(index)}
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
            <Text style={{ color: palette.text, fontWeight: '700' }}>REMOVE CONDITION</Text>
          </Pressable>
        </View>
      ))}
      <Pressable
        onPress={addCondition}
        style={({ pressed }) => [
          {
            marginTop: 8,
            paddingVertical: 6,
            borderRadius: 8,
            borderWidth: 2,
            borderColor: palette.borderMuted,
            backgroundColor: palette.primarySoft ?? palette.surface,
            opacity: pressed ? 0.8 : 1,
            alignItems: 'center',
          },
        ]}
      >
        <Text style={{ color: palette.primaryStrong ?? palette.text, fontWeight: '700' }}>
          ADD CONDITION
        </Text>
      </Pressable>
    </View>
  );
}
