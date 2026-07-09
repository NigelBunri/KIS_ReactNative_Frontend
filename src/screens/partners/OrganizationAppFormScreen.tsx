import React, { useCallback, useState } from 'react';
import {
  Alert,
  DeviceEventEmitter,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { APP_COLOR_THEMES, DEFAULT_THEME_ID } from '@/constants/appColorThemes';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { launchImageLibrary } from 'react-native-image-picker';
import { KISIcon } from '@/constants/kisIcons';
import KISButton from '@/constants/KISButton';
import KISTextInput from '@/constants/KISTextInput';
import { useKISTheme } from '@/theme/useTheme';
import { postRequest } from '@/network/post';
import { patchRequest } from '@/network/patch';
import ROUTES from '@/network';
import type { RootStackParamList } from '@/navigation/types';
import { uploadFileToBackend } from '@/Module/ChatRoom/uploadFileToBackend';
import { ORGANIZATION_APPS_UPDATED_EVENT } from '@/constants/partnerOrganizationApps';
import { getAccessToken } from '@/security/authStorage';

const TYPE_OPTIONS: Array<{ id: string; label: string }> = [
  { id: 'kis', label: 'KIS App' },
  { id: 'bible', label: 'Bible App' },
  { id: 'external', label: 'Embedded App' },
];

const VISIBILITY_OPTIONS: Array<{ id: string; label: string }> = [
  { id: 'owner', label: 'Owner' },
  { id: 'admin', label: 'Admin' },
  { id: 'manager', label: 'Manager' },
  { id: 'member', label: 'Member' },
  { id: 'analyst', label: 'Analyst' },
];

const DEFAULT_VISIBILITY = ['owner', 'admin', 'manager'];

type OrganizationAppPayload = {
  name: string;
  description: string;
  link: string;
  type: string;
  group: string;
  badge_label: string;
  visible_to?: string[];
  icon?: string;
  config?: Record<string, unknown>;
};

const buildPayload = (state: Record<string, string>): OrganizationAppPayload => ({
  name: state.name.trim(),
  description: state.description.trim(),
  link: state.link.trim(),
  type: state.type,
  group: state.group.trim(),
  badge_label: state.badge_label.trim(),
});

type NavigationProps = NativeStackNavigationProp<RootStackParamList, 'OrganizationAppForm'>;
type RouteProps = RouteProp<RootStackParamList, 'OrganizationAppForm'>;

const OrganizationAppFormScreen = () => {
  const navigation = useNavigation<NavigationProps>();
  const { params } = useRoute<RouteProps>();
  const { palette } = useKISTheme();
  const partnerId = params.partnerId;
  const app = params.app;
  const isEditing = Boolean(app);

  const [submitting, setSubmitting] = useState(false);
  const [formState, setFormState] = useState({
    name: app?.name ?? '',
    description: app?.description ?? '',
    link: app?.link ?? '',
    type: app?.type ?? TYPE_OPTIONS[0].id,
    group: app?.group ?? '',
    badge_label: app?.badge_label ?? '',
  });
  const [visibleRoles, setVisibleRoles] = useState<string[]>(
    app?.visible_to && app.visible_to.length ? [...app.visible_to] : [...DEFAULT_VISIBILITY],
  );
  const [iconPreview, setIconPreview] = useState(app?.icon ?? '');
  const [iconUploading, setIconUploading] = useState(false);
  const [iconRemoteUrl, setIconRemoteUrl] = useState(app?.icon ?? '');
  const [colorThemeId, setColorThemeId] = useState<string>(
    (app?.config?.color_theme_id as string | undefined) ?? DEFAULT_THEME_ID,
  );
  const [selectedIcon, setSelectedIcon] = useState<{
    uri: string;
    fileName?: string;
    type?: string;
    size?: number;
  } | null>(null);

  const handleToggleRole = useCallback((role: string) => {
    setVisibleRoles((prev) =>
      prev.includes(role) ? prev.filter((item) => item !== role) : [...prev, role],
    );
  }, []);

  const handlePickIcon = useCallback(async () => {
    if (!partnerId) {
      Alert.alert('Partner required', 'Select a partner to continue.');
      return;
    }
    const result = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: 1,
    });
    const asset = result.assets?.[0];
    if (!asset?.uri) return;
    setSelectedIcon({
      uri: asset.uri,
      fileName: asset.fileName,
      type: asset.type,
      size: asset.fileSize,
    });
    setIconPreview(asset.uri);
  }, [partnerId]);

  const uploadSelectedIcon = useCallback(async () => {
    if (!selectedIcon) {
      return iconRemoteUrl;
    }
    const token = await getAccessToken();
    if (!token) {
      Alert.alert('Authentication required', 'You must be logged in to upload an icon.');
      throw new Error('Missing auth token');
    }
    setIconUploading(true);
    try {
      const deviceId = await AsyncStorage.getItem('device_id');
      const uploaded = await uploadFileToBackend({
        file: {
          uri: selectedIcon.uri,
          name: selectedIcon.fileName ?? `org-app-icon-${Date.now()}`,
          type: selectedIcon.type ?? 'image/jpeg',
          size: selectedIcon.size ?? undefined,
        },
        authToken: token,
        deviceId: deviceId ?? undefined,
      });
      setIconRemoteUrl(uploaded.url);
      setIconPreview(uploaded.url);
      setSelectedIcon(null);
      return uploaded.url;
    } finally {
      setIconUploading(false);
    }
  }, [selectedIcon, iconRemoteUrl]);

  const typeLabel = TYPE_OPTIONS.find((option) => option.id === formState.type)?.label || 'Organization App';

  const handleSubmit = useCallback(async () => {
    if (!partnerId) {
      Alert.alert('Partner required', 'Select a partner to continue.');
      return;
    }
    if (!formState.name.trim()) {
      Alert.alert('Name required', 'Provide a name for the app.');
      return;
    }
    if (formState.type === 'external' && !formState.link.trim()) {
      Alert.alert('Link required', 'Provide a URL for the embedded app.');
      return;
    }
    if (!visibleRoles.length) {
      Alert.alert('Visibility required', 'Select at least one visibility role.');
      return;
    }

    const payload = buildPayload(formState);
    payload.visible_to = visibleRoles;
    payload.config = { ...(app?.config ?? {}), color_theme_id: colorThemeId };
    let iconUrl = iconRemoteUrl;
    if (selectedIcon) {
      try {
        iconUrl = await uploadSelectedIcon();
      } catch {
        setSubmitting(false);
        return;
      }
    } else if (iconPreview && iconPreview !== iconRemoteUrl) {
      iconUrl = iconPreview;
    }
    if (!iconUrl) {
      Alert.alert('Icon required', 'Pick an icon from your device.');
      return;
    }
    payload.icon = iconUrl;

    setSubmitting(true);
    try {
      if (isEditing && app) {
        await patchRequest(
          ROUTES.partners.organizationApp(partnerId, app.id),
          { ...payload },
          { errorMessage: 'Unable to update the app.' },
        );
        Alert.alert('Updated', `${app.name} was updated.`);
      } else {
        await postRequest(
          ROUTES.partners.organizationApps(partnerId),
          { ...payload },
          { errorMessage: 'Unable to create the app.' },
        );
        Alert.alert('Created', `${formState.name.trim()} was added to the catalog.`);
      }
      DeviceEventEmitter.emit(ORGANIZATION_APPS_UPDATED_EVENT, { partnerId });
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('App error', err?.message || 'Unable to save the app.');
    } finally {
      setSubmitting(false);
    }
  }, [
    app,
    colorThemeId,
    formState,
    iconPreview,
    iconRemoteUrl,
    isEditing,
    navigation,
    partnerId,
    selectedIcon,
    uploadSelectedIcon,
    visibleRoles,
  ]);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: palette.surface }]}>
      <View style={[styles.header, { backgroundColor: palette.surfaceElevated, borderBottomColor: palette.divider }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }, styles.backButton]}
        >
          <KISIcon name="chevron-left" size={20} color={palette.text} />
        </Pressable>
        <View style={styles.headerTitleWrap}>
          <Text style={[styles.headerTitle, { color: palette.text }]} numberOfLines={1}>
            {isEditing ? 'Edit organization app' : 'Create organization app'}
          </Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.formBody}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.sectionLabel, { color: palette.subtext }]}>
          {isEditing
            ? 'Update the configuration, visibility, and link/module for this app.'
            : 'Create a new organization app so members can launch it from the Partner center.'}
        </Text>

        <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
          <KISTextInput
            label="Name"
            value={formState.name}
            onChangeText={(value) => setFormState((prev) => ({ ...prev, name: value }))}
          />
          <KISTextInput
            label={formState.type === 'external' ? 'Link / Module (required)' : 'Link / Module (optional)'}
            value={formState.link}
            onChangeText={(value) => setFormState((prev) => ({ ...prev, link: value }))}
          />
          <KISTextInput
            label="Description"
            value={formState.description}
            onChangeText={(value) => setFormState((prev) => ({ ...prev, description: value }))}
            multiline
            style={{ minHeight: 80 }}
          />
          <View style={{ marginTop: 12 }}>
            <Text style={{ color: palette.text, fontSize: 12, marginBottom: 6 }}>Launch icon</Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                marginBottom: 12,
              }}
            >
              <View
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 16,
                  backgroundColor: palette.surfaceElevated,
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                }}
              >
                {iconPreview ? (
                  <Image
                    source={{ uri: iconPreview }}
                    style={{ width: '100%', height: '100%' }}
                    resizeMode="cover"
                  />
                ) : (
                  <Text style={{ color: palette.subtext, fontSize: 12 }}>None</Text>
                )}
              </View>
              <KISButton
                title={iconUploading ? 'Uploading...' : iconPreview ? 'Replace icon' : 'Pick icon'}
                onPress={handlePickIcon}
                disabled={iconUploading}
                size="sm"
              />
            </View>
            <Text style={{ color: palette.subtext, fontSize: 11 }}>
              Icons must be uploaded from your device; no external link values.
            </Text>
          </View>

          <Pressable
            onPress={() => {
              const currentIndex = TYPE_OPTIONS.findIndex((option) => option.id === formState.type);
              const nextIndex = (currentIndex + 1) % TYPE_OPTIONS.length;
              setFormState((prev) => ({ ...prev, type: TYPE_OPTIONS[nextIndex].id }));
            }}
            style={({ pressed }) => [
              styles.optionPill,
              {
                borderColor: palette.divider,
                backgroundColor: palette.surface,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Text style={{ color: palette.subtext, fontSize: 12 }}>
              Type · {typeLabel}
            </Text>
          </Pressable>

          <View style={{ gap: 8 }}>
            <Text style={{ color: palette.text, fontWeight: '700', fontSize: 12 }}>Visible to</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {VISIBILITY_OPTIONS.map((option) => {
                const selected = visibleRoles.includes(option.id);
                return (
                  <Pressable
                    key={option.id}
                    onPress={() => handleToggleRole(option.id)}
                    style={({ pressed }) => [
                      {
                        borderWidth: 2,
                        borderColor: selected ? palette.primaryStrong : palette.divider,
                        borderRadius: 12,
                        paddingHorizontal: 10,
                        paddingVertical: 10,
                        minHeight: 44,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: selected ? palette.primarySoft : palette.surface,
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    <Text style={{ color: selected ? palette.primaryStrong : palette.subtext, fontSize: 12 }}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        {/* ── Color Theme Picker ─────────────────────────────────────── */}
        <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
          <View style={{ gap: 4 }}>
            <Text style={{ color: palette.text, fontWeight: '700', fontSize: 13 }}>App colour theme</Text>
            <Text style={{ color: palette.subtext, fontSize: 11, lineHeight: 16 }}>
              Pick one of 12 royal themes for your app. KIS Gold is the canonical KIS colour — always available, never modified.
            </Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 10, paddingVertical: 4, paddingHorizontal: 2 }}
          >
            {APP_COLOR_THEMES.map((theme) => {
              const selected = colorThemeId === theme.id;
              return (
                <Pressable
                  key={theme.id}
                  onPress={() => setColorThemeId(theme.id)}
                  style={({ pressed }) => ({
                    alignItems: 'center',
                    gap: 5,
                    opacity: pressed ? 0.75 : 1,
                  })}
                >
                  <LinearGradient
                    colors={[theme.headerGradient[0], theme.headerGradient[2]]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 16,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: selected ? 2.5 : 1,
                      borderColor: selected ? theme.primary : palette.divider,
                    }}
                  >
                    {/* Shimmer line at top */}
                    <View
                      style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        top: 0,
                        height: 2,
                        borderTopLeftRadius: 16,
                        borderTopRightRadius: 16,
                        backgroundColor: theme.sheenColor,
                      }}
                    />
                    {selected ? (
                      <Text style={{ color: theme.primary, fontSize: 22, fontWeight: '900' }}>✓</Text>
                    ) : theme.id === 'kis' ? (
                      <Text style={{ fontSize: 18 }}>⭐</Text>
                    ) : (
                      <View
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: 9,
                          backgroundColor: theme.primary,
                          opacity: 0.85,
                        }}
                      />
                    )}
                  </LinearGradient>
                  <Text
                    style={{
                      color: selected ? theme.primary : palette.subtext,
                      fontSize: 9,
                      fontWeight: selected ? '800' : '500',
                      textAlign: 'center',
                      maxWidth: 56,
                    }}
                    numberOfLines={2}
                  >
                    {theme.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View style={{ marginTop: 16 }}>
          <KISButton
            title={submitting ? 'Saving…' : isEditing ? 'Update app' : 'Create app'}
            onPress={handleSubmit}
            disabled={submitting}
            size="sm"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
    borderRadius: 12,
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  formBody: {
    padding: 18,
    gap: 16,
  },
  sectionLabel: {
    fontSize: 14,
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 14,
  },
  optionPill: {
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
  },
});

export default OrganizationAppFormScreen;
