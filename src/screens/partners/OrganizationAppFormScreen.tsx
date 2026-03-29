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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
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
  { id: 'ai', label: 'Assistant App' },
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
    if (!formState.link.trim()) {
      Alert.alert('Link required', 'Provide a link or module reference.');
      return;
    }
    if (!visibleRoles.length) {
      Alert.alert('Visibility required', 'Select at least one visibility role.');
      return;
    }

    const payload = buildPayload(formState);
    payload.visible_to = visibleRoles;
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
            label="Link / Module"
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
                        paddingVertical: 4,
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
  },
});

export default OrganizationAppFormScreen;
