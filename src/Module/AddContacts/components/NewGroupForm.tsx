// src/screens/chat/components/NewGroupForm.tsx

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';

import { KIS_TOKENS } from '../../../theme/constants';
import { KISIcon } from '@/constants/kisIcons';
import ROUTES from '@/network';
import { postRequest } from '@/network/post';
import { getRequest } from '@/network/get';

type NewGroupFormProps = {
  palette: {
    bg: string;
    card: string;
    surface?: string;
    text: string;
    subtext: string;
    primary: string;
    inputBorder: string;
    error?: string;
  };
  onSuccess: (group: any) => void;
  selectedMemberIds: string[];
  onSelectMembers: () => void;
  showMemberPicker?: boolean;
  communityId?: string | null;
  communityName?: string | null;
  initialChannelId?: string | null;
  onCreateChannel?: () => void;
  partnerId?: string | null;
  name: string;
  slug: string;
  description: string;
  selectedChannelId: string | null;
  onChangeName: (value: string) => void;
  onChangeSlug: (value: string) => void;
  onChangeDescription: (value: string) => void;
  onChangeChannelId: (value: string | null) => void;
};

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const NewGroupForm: React.FC<NewGroupFormProps> = ({
  palette,
  onSuccess,
  selectedMemberIds,
  onSelectMembers,
  showMemberPicker = true,
  communityId,
  communityName,
  initialChannelId,
  onCreateChannel,
  partnerId,
  name,
  slug,
  description,
  selectedChannelId,
  onChangeName,
  onChangeSlug,
  onChangeDescription,
  onChangeChannelId,
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [channels, setChannels] = useState<Array<{ id: string; name?: string }>>([]);
  const [channelsLoading, setChannelsLoading] = useState(false);

  const memberCountLabel = `${selectedMemberIds.length} selected`;

  useEffect(() => {
    const loadChannels = async () => {
      setChannelsLoading(true);
      try {
        const res = await getRequest(ROUTES.channels.getAllChannels, {
          errorMessage: 'Failed to load channels',
        });
        const list = res?.data ?? res ?? [];
        if (Array.isArray(list)) {
          const filtered = partnerId
            ? list.filter((channel: any) => String(channel.partner) === String(partnerId))
            : list;
          setChannels(filtered);
        }
      } finally {
        setChannelsLoading(false);
      }
    };
    loadChannels();
  }, [partnerId]);

  useEffect(() => {
    if (!initialChannelId) return;
    onChangeChannelId(String(initialChannelId));
  }, [initialChannelId, onChangeChannelId]);

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Missing name', 'Please enter a group name.');
      return;
    }

    const finalSlug = slug.trim() ? slugify(slug) : slugify(trimmedName);

    try {
      setSubmitting(true);

      if (!communityId && !selectedChannelId && !partnerId) {
        Alert.alert('Select a channel', 'Please select a channel for this group.');
        return;
      }

      const payload = {
        name: trimmedName,
        slug: finalSlug,
        // For now: no partner / community selection in the UI
        partner: partnerId ?? null,
        community: communityId ?? null,
        channel: communityId ? null : selectedChannelId,
        description: description.trim() || undefined,
      };

      const createdGroup = await postRequest(
        ROUTES.groups.create,
        payload,
        { errorMessage: 'Unable to create group.' },
      );

      if (!createdGroup?.success || !createdGroup.data) {
        throw new Error(createdGroup?.message || 'Unable to create group.');
      }

      const groupData = createdGroup.data;
      const groupId = groupData?.id;
      if (groupId && selectedMemberIds.length > 0) {
        const userIds = selectedMemberIds;
        await postRequest(ROUTES.groups.addMembers(groupId), { userIds });
      }

      onSuccess(groupData);
    } catch (e: any) {
      console.warn('Error creating group:', e);
      Alert.alert(
        'Error',
        e?.message || 'Could not create the group. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={{ marginTop: 12 }}>
      <View style={{ marginBottom: 16 }}>
        <Text
          style={{
            color: palette.text,
            fontSize: 20,
            fontWeight: '700',
            letterSpacing: 0.2,
          }}
        >
          Create a group
        </Text>
        <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 4 }}>
          Pick members, give it a name, and start chatting.
        </Text>
      </View>

      {/* Group name */}
      <View style={{ marginBottom: 12 }}>
        <Text
          style={{
            color: palette.subtext,
            fontSize: 13,
            marginBottom: 4,
          }}
        >
          Group name
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
            onChangeText={onChangeName}
            placeholder="e.g. KIS Dev Squad"
            placeholderTextColor={palette.subtext}
            style={{ color: palette.text, fontSize: 15 }}
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
          Group slug (optional)
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
            onChangeText={onChangeSlug}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="e.g. kis-dev-squad"
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
          If left empty, we’ll generate one from the group name.
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
            onChangeText={onChangeDescription}
            placeholder="What is this group about?"
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

      {communityId ? (
        <View style={{ marginBottom: 16 }}>
          <Text style={{ color: palette.subtext, fontSize: 13, marginBottom: 6 }}>
            Community
          </Text>
          <View
            style={{
              borderRadius: 12,
              borderWidth: 2,
              borderColor: palette.inputBorder,
              backgroundColor: palette.card,
              paddingHorizontal: 12,
              paddingVertical: 10,
            }}
          >
            <Text style={{ color: palette.text, fontSize: 14, fontWeight: '600' }}>
              {communityName || 'Selected community'}
            </Text>
          </View>
        </View>
      ) : (
        <View style={{ marginBottom: 16 }}>
          <Text
            style={{
              color: palette.subtext,
              fontSize: 13,
              marginBottom: 6,
            }}
          >
            {partnerId
              ? 'Select a channel for this group (optional)'
              : 'Select a channel for this group'}
          </Text>
          <View
            style={{
              borderRadius: 12,
              borderWidth: 2,
              borderColor: palette.inputBorder,
              backgroundColor: palette.card,
              padding: 8,
              maxHeight: 160,
            }}
          >
            {channelsLoading ? (
              <ActivityIndicator color={palette.primary} />
            ) : channels.length === 0 ? (
              <Pressable
                onPress={onCreateChannel}
                style={({ pressed }) => ({
                  borderWidth: 2,
                  borderColor: palette.inputBorder,
                  borderRadius: 10,
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  backgroundColor: pressed ? palette.surface : 'transparent',
                })}
              >
                <Text style={{ color: palette.text, fontSize: 13 }}>
                  No channels found. Create a channel first.
                </Text>
              </Pressable>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {channels.map((ch) => {
                  const isSelected = selectedChannelId === String(ch.id);
                  return (
                    <Pressable
                      key={String(ch.id)}
                      onPress={() => onChangeChannelId(String(ch.id))}
                      style={{
                        paddingVertical: 8,
                        paddingHorizontal: 10,
                        borderRadius: 10,
                        borderWidth: 2,
                        borderColor: palette.inputBorder,
                        marginBottom: 8,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      backgroundColor: isSelected ? palette.bg : 'transparent',
                      }}
                    >
                      <Text style={{ color: palette.text, fontSize: 13 }}>
                        {ch.name || `Channel ${ch.id}`}
                      </Text>
                      {isSelected && (
                        <KISIcon name="check" size={16} color={palette.primary} />
                      )}
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      )}

      {showMemberPicker ? (
        <View style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text style={{ color: palette.subtext, fontSize: 13 }}>Members</Text>
            <Text style={{ color: palette.subtext, fontSize: 12 }}>{memberCountLabel}</Text>
          </View>
          <View
            style={{
              borderRadius: 12,
              borderWidth: 2,
              borderColor: palette.inputBorder,
              backgroundColor: palette.card,
              padding: 10,
            }}
          >
            <Pressable
              onPress={onSelectMembers}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: 10,
                borderWidth: 2,
                borderColor: palette.inputBorder,
                backgroundColor: pressed ? palette.surface : 'transparent',
              })}
            >
              <Text style={{ color: palette.text, fontSize: 13 }}>
                Add or edit members
              </Text>
              <KISIcon name="chevron-right" size={16} color={palette.subtext} />
            </Pressable>
          </View>
        </View>
      ) : null}

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
          shadowColor: palette.primary,
          shadowOpacity: 0.25,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 8 },
          elevation: 4,
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
            <KISIcon name="people" size={16} color="#fff" />
            <Text
              style={{
                color: '#fff',
                fontSize: 14,
                fontWeight: '600',
                marginLeft: 6,
              }}
            >
              Create group
            </Text>
          </>
        )}
      </Pressable>
    </View>
  );
};

export default NewGroupForm;
