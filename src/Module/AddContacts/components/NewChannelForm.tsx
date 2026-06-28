import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';

import { KIS_TOKENS } from '../../../theme/constants';
import { KISIcon } from '@/constants/kisIcons';
import ROUTES, { CHAT_BASE_URL } from '@/network';
import { postRequest } from '@/network/post';
import { uploadFileToBackend } from '@/Module/ChatRoom/uploadFileToBackend';
import { getAccessToken } from '@/security/authStorage';

type NewChannelFormProps = {
  palette: {
    bg: string;
    card: string;
    text: string;
    subtext: string;
    primary: string;
    onPrimary: string;
    inputBorder: string;
    error?: string;
  };
  onSuccess: (channel: any) => void;
  partnerId?: string | null;
};

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const NewChannelForm: React.FC<NewChannelFormProps> = ({
  palette,
  onSuccess,
  partnerId,
}) => {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const handlePickAvatar = async () => {
    if (uploadingAvatar) return;
    const picked = await launchImageLibrary({ mediaType: 'photo', selectionLimit: 1, quality: 0.9 });
    if (picked.didCancel) return;
    const asset = picked.assets?.[0];
    if (!asset?.uri) return;
    const token = await getAccessToken();
    if (!token) { Alert.alert('Not signed in', 'Please log in again.'); return; }
    try {
      setUploadingAvatar(true);
      setAvatarPreview(asset.uri);
      const uploaded = await uploadFileToBackend({
        file: { uri: asset.uri, name: asset.fileName ?? 'channel-avatar.jpg', type: asset.type ?? 'image/jpeg', size: asset.fileSize },
        authToken: token,
        baseUrl: CHAT_BASE_URL,
      });
      setAvatarUrl(uploaded.url);
    } catch (err: any) {
      Alert.alert('Upload failed', err?.message || 'Unable to upload image.');
      setAvatarPreview(null);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Missing name', 'Please enter a channel name.');
      return;
    }

    const finalSlug = slug.trim() ? slugify(slug) : slugify(trimmedName);

    try {
      setSubmitting(true);

      const payload = {
        name: trimmedName,
        slug: finalSlug,
        description: description.trim() || undefined,
        partner: partnerId ?? null,
        community: null,
        avatar_url: avatarUrl || undefined,
      };

      const createdChannel = await postRequest(
        ROUTES.channels.createChannel,
        payload,
        { errorMessage: 'Unable to create channel.' },
      );

      if (!createdChannel?.success || !createdChannel.data) {
        throw new Error(createdChannel?.message || 'Unable to create channel.');
      }

      onSuccess(createdChannel.data);
    } catch (e: any) {
      console.warn('Error creating channel:', e);
      Alert.alert(
        'Error',
        e?.message || 'Could not create the channel. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={{ marginTop: 4 }}>
      <View style={{
        backgroundColor: palette.card,
        borderRadius: 18,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: palette.inputBorder,
      }}>
        <Text
          style={{
            color: palette.text,
            fontSize: 20,
            fontWeight: '800',
            marginBottom: 4,
          }}
        >
          Create a channel
        </Text>
        <Text style={{ color: palette.subtext, fontSize: 13, lineHeight: 18 }}>
          Publish updates, announcements and content to your followers.
        </Text>
      </View>

      {/* Channel avatar */}
      <View style={{ alignItems: 'center', marginBottom: 20 }}>
        <Pressable
          onPress={handlePickAvatar}
          style={({ pressed }) => ({
            width: 84,
            height: 84,
            borderRadius: 42,
            backgroundColor: palette.card,
            borderWidth: 2,
            borderColor: avatarPreview ? palette.primary : palette.inputBorder,
            borderStyle: avatarPreview ? 'solid' : 'dashed',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            opacity: pressed ? 0.8 : 1,
          })}
        >
          {avatarPreview ? (
            <Image source={{ uri: avatarPreview }} style={{ width: 84, height: 84 }} />
          ) : (
            <KISIcon name="camera" size={28} color={palette.subtext} />
          )}
        </Pressable>
        <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 6 }}>
          {uploadingAvatar ? 'Uploading…' : 'Channel photo (optional)'}
        </Text>
      </View>

      {/* Channel name */}
      <View style={{ marginBottom: 12 }}>
        <Text
          style={{
            color: palette.subtext,
            fontSize: 13,
            marginBottom: 4,
          }}
        >
          Channel name
        </Text>
        <View
          style={{
            borderRadius: 12,
            borderWidth: 2,
            borderColor: palette.inputBorder,
            backgroundColor: palette.card,
            paddingHorizontal: 12,
            paddingVertical: 8,
          }}
        >
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Announcements"
            placeholderTextColor={palette.subtext}
            style={{ color: palette.text, fontSize: 14 }}
          />
        </View>
      </View>

      {/* Slug (optional) */}
      <View style={{ marginBottom: 12 }}>
        <Text
          style={{
            color: palette.subtext,
            fontSize: 13,
            marginBottom: 4,
          }}
        >
          Channel slug (optional)
        </Text>
        <View
          style={{
            borderRadius: 12,
            borderWidth: 2,
            borderColor: palette.inputBorder,
            backgroundColor: palette.card,
            paddingHorizontal: 12,
            paddingVertical: 8,
          }}
        >
          <TextInput
            value={slug}
            onChangeText={setSlug}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="e.g. announcements"
            placeholderTextColor={palette.subtext}
            style={{ color: palette.text, fontSize: 14 }}
          />
        </View>
        <Text
          style={{
            color: palette.subtext,
            fontSize: 11,
            marginTop: 4,
          }}
        >
          If left empty, we’ll generate one from the channel name.
        </Text>
      </View>

      {/* Description (optional) */}
      <View style={{ marginBottom: 16 }}>
        <Text
          style={{
            color: palette.subtext,
            fontSize: 13,
            marginBottom: 4,
          }}
        >
          Description (optional)
        </Text>
        <View
          style={{
            borderRadius: 12,
            borderWidth: 2,
            borderColor: palette.inputBorder,
            backgroundColor: palette.card,
            paddingHorizontal: 12,
            paddingVertical: 8,
          }}
        >
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="What is this channel for?"
            placeholderTextColor={palette.subtext}
            style={{
              color: palette.text,
              fontSize: 14,
              minHeight: 60,
              textAlignVertical: 'top',
            }}
            multiline
          />
        </View>
      </View>

      {/* Submit button */}
      <Pressable
        onPress={handleSubmit}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 999,
          paddingVertical: 10,
          paddingHorizontal: 16,
          backgroundColor: palette.primary,
          opacity:
            submitting || !name.trim()
              ? 0.6
              : pressed
              ? KIS_TOKENS.opacity.pressed
              : 1,
        })}
      >
        {submitting ? (
          <ActivityIndicator color={palette.onPrimary} />
        ) : (
          <>
            <KISIcon name="megaphone" size={16} color={palette.onPrimary} />
            <Text
              style={{
                color: palette.onPrimary,
                fontSize: 14,
                fontWeight: '600',
                marginLeft: 6,
              }}
            >
              Create channel
            </Text>
          </>
        )}
      </Pressable>
    </View>
  );
};

export default NewChannelForm;
