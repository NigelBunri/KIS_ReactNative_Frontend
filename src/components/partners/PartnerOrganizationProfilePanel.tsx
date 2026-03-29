import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import styles from '@/components/partners/partnersStyles';
import { useKISTheme } from '@/theme/useTheme';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { patchRequest } from '@/network/patch';

type Props = {
  isOpen: boolean;
  panelWidth: number;
  panelTranslateX: Animated.Value;
  partnerId?: string | null;
  onClose: () => void;
};

type OrgProfile = {
  display_name?: string;
  legal_name?: string;
  tagline?: string;
  mission?: string;
  vision?: string;
  website?: string;
  email?: string;
  phone?: string;
  industry?: string;
  size?: string;
  founded_year?: number | null;
  headquarters?: string;
  logo_url?: string;
  brand_colors?: string[];
  social_links?: Record<string, string>;
  public_fields?: Record<string, boolean>;
};

export default function PartnerOrganizationProfilePanel({
  isOpen,
  panelWidth,
  panelTranslateX,
  partnerId,
  onClose,
}: Props) {
  const { palette } = useKISTheme();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<OrgProfile>({});
  const [brandColors, setBrandColors] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [twitter, setTwitter] = useState('');
  const [facebook, setFacebook] = useState('');
  const [instagram, setInstagram] = useState('');
  const [youtube, setYoutube] = useState('');
  const [publicFields, setPublicFields] = useState<Record<string, boolean>>({});

  const fieldDefs: Array<{ key: keyof OrgProfile; label: string }> = useMemo(() => ([
    { key: 'display_name', label: 'Display name' },
    { key: 'legal_name', label: 'Legal name' },
    { key: 'tagline', label: 'Tagline' },
    { key: 'mission', label: 'Mission' },
    { key: 'vision', label: 'Vision' },
    { key: 'website', label: 'Website' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'industry', label: 'Industry' },
    { key: 'size', label: 'Company size' },
    { key: 'founded_year', label: 'Founded year' },
    { key: 'headquarters', label: 'Headquarters' },
    { key: 'logo_url', label: 'Logo URL' },
  ]), []);

  const backdropOpacity = panelTranslateX.interpolate({
    inputRange: [0, panelWidth],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const loadProfile = useCallback(async () => {
    if (!partnerId) return;
    const res = await getRequest(ROUTES.partners.organizationProfile(partnerId), {
      errorMessage: 'Unable to load organization profile.',
    });
    const data = res?.data ?? res ?? {};
    setForm(data);
    setBrandColors((data.brand_colors || []).join(', '));
    const socials = data.social_links || {};
    setLinkedin(String(socials.linkedin ?? ''));
    setTwitter(String(socials.twitter ?? ''));
    setFacebook(String(socials.facebook ?? ''));
    setInstagram(String(socials.instagram ?? ''));
    setYoutube(String(socials.youtube ?? ''));
    const incomingPublic = data.public_fields || {};
    const defaults: Record<string, boolean> = {};
    fieldDefs.forEach((field) => {
      defaults[field.key] = Boolean(incomingPublic[field.key]);
    });
    defaults.brand_colors = Boolean(incomingPublic.brand_colors);
    defaults.social_linkedin = Boolean(incomingPublic.social_linkedin);
    defaults.social_twitter = Boolean(incomingPublic.social_twitter);
    defaults.social_facebook = Boolean(incomingPublic.social_facebook);
    defaults.social_instagram = Boolean(incomingPublic.social_instagram);
    defaults.social_youtube = Boolean(incomingPublic.social_youtube);
    setPublicFields(defaults);
  }, [fieldDefs, partnerId]);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    loadProfile().finally(() => setLoading(false));
  }, [isOpen, loadProfile]);

  const updateField = (key: keyof OrgProfile, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const togglePublicField = (key: string) => {
    setPublicFields((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const renderVisibilityToggle = (key: string) => (
    <Pressable
      onPress={() => togglePublicField(key)}
      style={({ pressed }) => [
        {
          alignSelf: 'flex-start',
          marginTop: 6,
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 999,
          borderWidth: 2,
          borderColor: publicFields[key] ? palette.success : palette.borderMuted,
          backgroundColor: publicFields[key]
            ? palette.success + '22'
            : palette.surface,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <Text
        style={{
          color: publicFields[key] ? palette.success : palette.subtext,
          fontSize: 11,
          fontWeight: '700',
        }}
      >
        {publicFields[key] ? 'PUBLIC' : 'PRIVATE'}
      </Text>
    </Pressable>
  );

  const onSave = async () => {
    if (!partnerId) return;
    const social: Record<string, string> = {
      linkedin: linkedin.trim(),
      twitter: twitter.trim(),
      facebook: facebook.trim(),
      instagram: instagram.trim(),
      youtube: youtube.trim(),
    };
    const payload = {
      ...form,
      founded_year: form.founded_year ? Number(form.founded_year) : null,
      brand_colors: brandColors
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
      social_links: social,
      public_fields: publicFields,
    };
    const res = await patchRequest(
      ROUTES.partners.organizationProfile(partnerId),
      payload,
      { errorMessage: 'Unable to update profile.' },
    );
    if (!res?.success) {
      Alert.alert('Update failed', res?.message ?? 'Please try again.');
      return;
    }
    Alert.alert('Saved', 'Organization profile updated.');
  };

  if (!isOpen) return null;

  return (
    <View style={styles.settingsPanelOverlay} pointerEvents="box-none">
      <Animated.View
        style={[
          styles.settingsPanelBackdrop,
          { backgroundColor: palette.backdrop, opacity: backdropOpacity },
        ]}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          styles.settingsPanelContainer,
          {
            width: panelWidth,
            backgroundColor: palette.surfaceElevated,
            borderLeftColor: palette.divider,
            transform: [{ translateX: panelTranslateX }],
          },
        ]}
      >
        <View
          style={[
            styles.settingsPanelHeader,
            { borderBottomColor: palette.divider },
          ]}
        >
          <Pressable onPress={onClose} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            <Text style={{ color: palette.text, fontSize: 18 }}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingsPanelTitle, { color: palette.text }]}>
              Organization Profile
            </Text>
            <Text style={[styles.settingsPanelDescription, { color: palette.subtext }]}>
              Control what is public and what stays private.
            </Text>
          </View>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.settingsPanelBody}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <ActivityIndicator size="small" color={palette.primary} />
          ) : (
            <View
              style={[
                styles.settingsFeatureRow,
                { borderColor: palette.borderMuted, backgroundColor: palette.surface },
              ]}
            >
              <Text style={[styles.settingsFeatureTitle, { color: palette.text }]}>
                Core details
              </Text>
              {fieldDefs.map((field) => (
                <View key={field.key}>
                  <TextInput
                    value={String((form as any)[field.key] ?? '')}
                    onChangeText={(value) => updateField(field.key, value)}
                    placeholder={field.label}
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
                  {renderVisibilityToggle(String(field.key))}
                </View>
              ))}
              <Text style={[styles.settingsFeatureTitle, { color: palette.text, marginTop: 12 }]}>
                Brand colors
              </Text>
              <TextInput
                value={brandColors}
                onChangeText={setBrandColors}
                placeholder="Comma-separated hex colors (e.g. #112233, #445566)"
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
              {renderVisibilityToggle('brand_colors')}
              <Text style={[styles.settingsFeatureTitle, { color: palette.text, marginTop: 12 }]}>
                Social links
              </Text>
              {[
                ['LinkedIn', linkedin, setLinkedin, 'social_linkedin'],
                ['Twitter/X', twitter, setTwitter, 'social_twitter'],
                ['Facebook', facebook, setFacebook, 'social_facebook'],
                ['Instagram', instagram, setInstagram, 'social_instagram'],
                ['YouTube', youtube, setYoutube, 'social_youtube'],
              ].map(([label, value, setter, key]) => (
                <View key={String(label)}>
                  <TextInput
                    value={String(value)}
                    onChangeText={setter as (value: string) => void}
                    placeholder={`${label} URL`}
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
                  {renderVisibilityToggle(String(key))}
                </View>
              ))}
              <Pressable
                onPress={onSave}
                style={({ pressed }) => [
                  {
                    marginTop: 12,
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
                  SAVE PROFILE
                </Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}
