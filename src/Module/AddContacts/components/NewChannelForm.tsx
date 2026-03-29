import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';

import { KIS_TOKENS } from '../../../theme/constants';
import { KISIcon } from '@/constants/kisIcons';
import ROUTES from '@/network';
import { postRequest } from '@/network/post';

type NewChannelFormProps = {
  palette: {
    bg: string;
    card: string;
    text: string;
    subtext: string;
    primary: string;
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
    <View style={{ marginTop: 16 }}>
      <Text
        style={{
          color: palette.text,
          fontSize: 18,
          fontWeight: '700',
          marginBottom: 12,
        }}
      >
        Create a new channel
      </Text>

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
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <KISIcon name="megaphone" size={16} color="#fff" />
            <Text
              style={{
                color: '#fff',
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
