import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import styles from '@/components/partners/partnersStyles';
import KeyValueEditor, { type KeyValueRow } from './KeyValueEditor';

export type ActionRow = {
  type: string;
  params: KeyValueRow[];
};

type Props = {
  palette: any;
  actions: ActionRow[];
  onChange: (actions: ActionRow[]) => void;
};

export default function AutomationActionsForm({ palette, actions, onChange }: Props) {
  const updateAction = (index: number, next: Partial<ActionRow>) => {
    const updated = actions.map((row, rowIndex) =>
      rowIndex === index ? { ...row, ...next } : row,
    );
    onChange(updated);
  };

  const addAction = () => {
    onChange([...actions, { type: '', params: [{ key: '', value: '' }] }]);
  };

  const removeAction = (index: number) => {
    onChange(actions.filter((_, rowIndex) => rowIndex !== index));
  };

  return (
    <View>
      <Text style={[styles.settingsFeatureTitle, { color: palette.text, marginTop: 12 }]}>
        Actions
      </Text>
      {actions.map((action, index) => (
        <View
          key={`action-${index}`}
          style={[
            styles.settingsFeatureRow,
            { borderColor: palette.borderMuted, backgroundColor: palette.surface, marginTop: 8 },
          ]}
        >
          <TextInput
            value={action.type}
            onChangeText={(value) => updateAction(index, { type: value })}
            placeholder="Action type (assign_role, remove_role, dispatch_webhook, set_feature_flag)"
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
          <KeyValueEditor
            palette={palette}
            rows={action.params}
            onChange={(rows) => updateAction(index, { params: rows })}
            addLabel="ADD PARAM"
          />
          <Pressable
            onPress={() => removeAction(index)}
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
            <Text style={{ color: palette.text, fontWeight: '700' }}>REMOVE ACTION</Text>
          </Pressable>
        </View>
      ))}
      <Pressable
        onPress={addAction}
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
          ADD ACTION
        </Text>
      </Pressable>
    </View>
  );
}
