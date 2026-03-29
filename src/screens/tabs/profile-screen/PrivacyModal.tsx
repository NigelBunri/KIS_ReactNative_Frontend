import React from 'react';
import { Pressable, Text, View } from 'react-native';
import KISButton from '@/constants/KISButton';
import KISTextInput from '@/constants/KISTextInput';
import type { KISPalette } from '@/theme/constants';
import { fieldLabels, visibilityOptions } from '../profile/profile.constants';
import { styles } from '../profile/profile.styles';

type PrivacyModalProps = {
  palette: KISPalette;
  draftPrivacy: Record<string, any>;
  setDraftPrivacy: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  saving: boolean;
  savePrivacy: () => void;
};

export function PrivacyModal(props: PrivacyModalProps) {
  const { palette, draftPrivacy, setDraftPrivacy, saving, savePrivacy } = props;

  return (
    <View style={{ gap: 16 }}>
      {Object.keys(fieldLabels).map((key) => {
        const rule = draftPrivacy?.[key] || { visibility: 'public', allow_user_ids: [] };
        const allowValue = Array.isArray(rule.allow_user_ids) ? rule.allow_user_ids.join(',') : '';
        return (
          <View key={key} style={[styles.privacyRow, { borderColor: palette.divider }]}>
            <Text style={[styles.privacyLabel, { color: palette.text }]}>{fieldLabels[key]}</Text>

            <View style={styles.privacyOptions}>
              {visibilityOptions.map((opt) => (
                <Pressable
                  key={opt.value}
                  onPress={() =>
                    setDraftPrivacy((s: any) => ({
                      ...s,
                      [key]: { ...rule, field_key: key, visibility: opt.value },
                    }))
                  }
                  style={[
                    styles.privacyChip,
                    {
                      backgroundColor:
                        rule.visibility === opt.value ? palette.primarySoft : palette.surface,
                      borderColor: palette.divider,
                    },
                  ]}
                >
                  <Text style={{ color: palette.text, fontSize: 12 }}>{opt.label}</Text>
                </Pressable>
              ))}
            </View>

            {rule.visibility === 'custom' && (
              <KISTextInput
                label="Allowed phone numbers (comma separated)"
                value={allowValue}
                onChangeText={(text) =>
                  setDraftPrivacy((s: any) => ({
                    ...s,
                    [key]: {
                      ...rule,
                      field_key: key,
                      allow_user_ids: text
                        .split(',')
                        .map((t) => t.trim())
                        .filter(Boolean),
                    },
                  }))
                }
              />
            )}
          </View>
        );
      })}

      <KISButton title={saving ? 'Saving...' : 'Save'} onPress={savePrivacy} disabled={saving} />
    </View>
  );
}
