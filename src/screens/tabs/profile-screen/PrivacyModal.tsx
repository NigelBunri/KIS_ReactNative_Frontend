import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import KISButton from '@/constants/KISButton';
import KISTextInput from '@/constants/KISTextInput';
import type { KISPalette } from '@/theme/constants';
import {
  fieldLabels,
  fieldPrivacyDescriptions,
  privacyFieldGroups,
  visibilityDescriptions,
  visibilityOptions,
} from '../profile/profile.constants';
import { styles } from '../profile/profile.styles';

type PrivacyModalProps = {
  palette: KISPalette;
  draftPrivacy: Record<string, any>;
  setDraftPrivacy: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  saving: boolean;
  savePrivacy: () => void;
  profile?: any;
};

export function PrivacyModal(props: PrivacyModalProps) {
  const { palette, draftPrivacy, setDraftPrivacy, saving, savePrivacy, profile } = props;
  const [customEntryDrafts, setCustomEntryDrafts] = useState<Record<string, string>>({});
  const activeFields = useMemo(() => {
    const sections = profile?.sections || {};
    const showcases = sections?.showcases || {};
    const preferences = profile?.preferences || {};
    const next = new Set<string>();
    if (profile?.profile?.avatar_url) next.add('avatar');
    if (profile?.profile?.cover_url) next.add('cover');
    if (profile?.profile?.headline) next.add('headline');
    if (profile?.profile?.bio) next.add('bio');
    if (profile?.profile?.industry) next.add('industry');
    if (profile?.user?.phone) next.add('contact_phone');
    if (profile?.user?.email) next.add('contact_email');
    if ((sections?.experiences || []).length) next.add('experience');
    if ((sections?.educations || []).length) next.add('education');
    if ((sections?.projects || []).length) next.add('projects');
    if ((sections?.skills || []).length) next.add('skills');
    if ((sections?.recommendations || []).length) next.add('recommendations');
    if ((sections?.articles || []).length) next.add('articles');
    if ((sections?.activity || []).length) next.add('activity');
    if ((preferences?.services || []).length) next.add('services');
    if ((preferences?.highlights || []).length) next.add('highlights');
    if ((showcases?.portfolio || []).length) next.add('portfolio');
    if ((showcases?.case_study || []).length) next.add('case_study');
    if ((showcases?.testimonial || []).length) next.add('testimonial');
    if ((showcases?.certification || []).length) next.add('certification');
    if ((showcases?.intro_video || []).length) next.add('intro_video');
    return next;
  }, [profile]);

  const setCustomDraft = (key: string, value: string) => {
    setCustomEntryDrafts((prev) => ({ ...prev, [key]: value }));
  };

  const addCustomTargets = (key: string, rule: any) => {
    const rawValue = String(customEntryDrafts[key] || '').trim();
    if (!rawValue) return;
    const tokens = rawValue
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    if (!tokens.length) return;
    const nextValues = Array.from(new Set([...(Array.isArray(rule?.allow_user_ids) ? rule.allow_user_ids : []), ...tokens]));
    setDraftPrivacy((current: any) => ({
      ...current,
      [key]: {
        ...rule,
        field_key: key,
        visibility: 'custom',
        allow_user_ids: nextValues,
      },
    }));
    setCustomDraft(key, '');
  };

  const removeCustomTarget = (key: string, rule: any, value: string) => {
    const nextValues = (Array.isArray(rule?.allow_user_ids) ? rule.allow_user_ids : []).filter(
      (entry: string) => entry !== value,
    );
    setDraftPrivacy((current: any) => ({
      ...current,
      [key]: {
        ...rule,
        field_key: key,
        allow_user_ids: nextValues,
      },
    }));
  };

  return (
    <View style={{ gap: 16 }}>
      <View
        style={{
          borderRadius: 16,
          padding: 14,
          backgroundColor: palette.surface,
          borderWidth: 1,
          borderColor: palette.divider,
          gap: 6,
        }}
      >
        <Text style={[styles.privacyLabel, { color: palette.text }]}>Who can see each part of your profile</Text>
        <Text style={{ color: palette.textMuted, fontSize: 12, lineHeight: 18 }}>
          Public is visible to everyone. Contacts only is limited to mutual contacts. Custom lets you add specific
          people by user ID or phone number one at a time.
        </Text>
      </View>

      {privacyFieldGroups.map((group) => (
        <View
          key={group.key}
          style={{
            gap: 12,
            borderRadius: 18,
            padding: 14,
            backgroundColor: palette.surface,
            borderWidth: 1,
            borderColor: palette.divider,
          }}
        >
          <View style={{ gap: 4 }}>
            <Text style={[styles.privacyLabel, { color: palette.text }]}>{group.title}</Text>
            <Text style={{ color: palette.textMuted, fontSize: 12, lineHeight: 18 }}>{group.description}</Text>
          </View>

          {group.fields.map((key) => {
            const rule = draftPrivacy?.[key] || { visibility: 'public', allow_user_ids: [] };
            const customTargets = Array.isArray(rule.allow_user_ids) ? rule.allow_user_ids : [];
            const hasActiveContent = activeFields.has(key);
            return (
              <View key={key} style={[styles.privacyRow, { borderColor: palette.divider }]}>
                <View style={{ gap: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Text style={[styles.privacyLabel, { color: palette.text }]}>{fieldLabels[key]}</Text>
                    <View
                      style={{
                        borderRadius: 999,
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        backgroundColor: hasActiveContent ? palette.primarySoft : palette.card,
                        borderWidth: 1,
                        borderColor: palette.divider,
                      }}
                    >
                      <Text style={{ color: palette.textMuted, fontSize: 11 }}>
                        {hasActiveContent ? 'Visible on profile' : 'No current content'}
                      </Text>
                    </View>
                  </View>
                  {fieldPrivacyDescriptions[key] ? (
                    <Text style={{ color: palette.textMuted, fontSize: 12, lineHeight: 18 }}>
                      {fieldPrivacyDescriptions[key]}
                    </Text>
                  ) : null}
                </View>

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

                <Text style={{ color: palette.textMuted, fontSize: 12 }}>
                  {visibilityDescriptions[rule.visibility || 'public'] || visibilityDescriptions.public}
                </Text>

                {rule.visibility === 'custom' && (
                  <View style={{ gap: 10 }}>
                    <View style={{ gap: 8 }}>
                      <KISTextInput
                        label="Allow one person"
                        placeholder="Enter a user ID or phone number"
                        value={customEntryDrafts[key] || ''}
                        onChangeText={(text) => setCustomDraft(key, text)}
                      />
                      <KISButton
                        title="Add person"
                        onPress={() => addCustomTargets(key, rule)}
                        disabled={!String(customEntryDrafts[key] || '').trim()}
                      />
                    </View>

                    {customTargets.length ? (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                        {customTargets.map((value: string, index: number) => (
                          <View
                            key={`${key}-${value}-${index}`}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 8,
                              borderRadius: 999,
                              paddingHorizontal: 12,
                              paddingVertical: 8,
                              borderWidth: 1,
                              borderColor: palette.divider,
                              backgroundColor: palette.primarySoft,
                            }}
                          >
                            <Text style={{ color: palette.text, fontSize: 12, maxWidth: 180 }} numberOfLines={1}>
                              {value}
                            </Text>
                            <Pressable onPress={() => removeCustomTarget(key, rule, value)}>
                              <Text style={{ color: palette.textMuted, fontSize: 12 }}>Remove</Text>
                            </Pressable>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Text style={{ color: palette.textMuted, fontSize: 12 }}>
                        No custom viewers added yet. Until you add someone, this field will stay hidden from other people.
                      </Text>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      ))}

      <KISButton title={saving ? 'Saving privacy...' : 'Save privacy'} onPress={savePrivacy} disabled={saving} />
    </View>
  );
}
