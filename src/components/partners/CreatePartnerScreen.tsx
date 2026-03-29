// src/screens/partners/PartnerCreateSlide.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
  Pressable,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';

import { useKISTheme } from '../../theme/useTheme';
import KISButton from '../../constants/KISButton';
import { postRequest } from '@/network/post';
import ROUTES, { CHAT_BASE_URL } from '@/network';
import { uploadFileToBackend } from '@/Module/ChatRoom/uploadFileToBackend';
import { getAccessToken } from '@/security/authStorage';

type Props = {
  onClose: () => void;
};

export default function PartnerCreateSlide({ onClose }: Props) {
  const { palette } = useKISTheme();

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handlePickAvatar = async () => {
    if (isUploading) return;
    const picked = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: 1,
      quality: 0.9,
    });
    if (picked.didCancel) return;
    const asset = picked.assets?.[0];
    if (!asset?.uri) {
      Alert.alert('No image selected', 'Please pick a valid image.');
      return;
    }

    const token = await getAccessToken();
    if (!token) {
      Alert.alert('Not signed in', 'Please log in again.');
      return;
    }

    try {
      setIsUploading(true);
      setAvatarPreview(asset.uri);
      const file = {
        uri: asset.uri,
        name: asset.fileName ?? 'partner-avatar.jpg',
        type: asset.type ?? 'image/jpeg',
        size: asset.fileSize ?? undefined,
      };
      const uploaded = await uploadFileToBackend({
        file,
        authToken: token,
        baseUrl: CHAT_BASE_URL,
      });
      setAvatarUrl(uploaded.url);
    } catch (err: any) {
      Alert.alert('Upload failed', err?.message || 'Unable to upload image.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!name.trim() || !slug.trim()) {
      Alert.alert('Missing fields', 'Name and slug are required.');
      return;
    }

    setIsSubmitting(true);
    const payload = {
      name: name.trim(),
      slug: slug.trim(),
      description: description.trim(),
      avatar_url: avatarUrl.trim(),
      create_main_conversation: true,
    };

    const res = await postRequest(ROUTES.partners.create, payload, {
      errorMessage: 'Unable to create partner.',
    });

    setIsSubmitting(false);

    if (!res.success) {
      Alert.alert('Error', res.message || 'Could not create partner.');
      return;
    }

    Alert.alert('Success', 'Partner created successfully!', [
      { text: 'OK', onPress: onClose },
    ]);
  };

  const autoSlugify = (value: string) => {
    setName(value);
    if (!slug) {
      const s = value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      setSlug(s);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.page, { backgroundColor: palette.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <KISButton title="Back" variant="outline" onPress={onClose} />
          <Text style={[styles.title, { color: palette.text }]}>Create Partner</Text>
          <View style={{ width: 75 }} />
        </View>

        {/* Form Fields */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: palette.subtext }]}>Name *</Text>
          <TextInput
            value={name}
            onChangeText={autoSlugify}
            placeholder="Partner name"
            placeholderTextColor={palette.subtext}
            style={[styles.input, { backgroundColor: palette.card, borderColor: palette.inputBorder, color: palette.text }]}
          />
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: palette.subtext }]}>Slug *</Text>
          <TextInput
            value={slug}
            onChangeText={setSlug}
            placeholder="partner-slug"
            placeholderTextColor={palette.subtext}
            style={[styles.input, { backgroundColor: palette.card, borderColor: palette.inputBorder, color: palette.text }]}
          />
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: palette.subtext }]}>Description</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Short description…"
            multiline
            placeholderTextColor={palette.subtext}
            style={[
              styles.input,
              styles.textarea,
              { backgroundColor: palette.card, borderColor: palette.inputBorder, color: palette.text }
            ]}
          />
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: palette.subtext }]}>Partner image</Text>
          <Pressable
            onPress={handlePickAvatar}
            style={({ pressed }) => [
              styles.avatarPicker,
              {
                backgroundColor: palette.card,
                borderColor: palette.inputBorder,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            {avatarPreview ? (
              <Image source={{ uri: avatarPreview }} style={styles.avatarPreview} />
            ) : (
              <Text style={{ color: palette.subtext }}>
                Tap to pick an image
              </Text>
            )}
          </Pressable>
          {isUploading ? (
            <Text style={{ color: palette.subtext, marginTop: 6 }}>
              Uploading image…
            </Text>
          ) : null}
        </View>

        <View style={{ marginTop: 24 }}>
          <KISButton
            title={isSubmitting ? 'Creating…' : 'Create Partner'}
            onPress={handleSubmit}
            disabled={isSubmitting}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 48,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    marginBottom: 6,
  },
  input: {
    borderWidth: 2,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  avatarPicker: {
    borderWidth: 2,
    borderRadius: 12,
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarPreview: {
    width: '100%',
    height: 120,
    resizeMode: 'cover',
  },
  textarea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
});
