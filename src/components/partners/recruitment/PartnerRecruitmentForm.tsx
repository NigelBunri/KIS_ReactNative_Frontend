import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import AssignChips from './AssignChips';

type Option = { id: string; name: string };

type Props = {
  palette: any;
  title: string;
  description: string;
  requirements: string;
  stepsText: string;
  communities: Option[];
  groups: Option[];
  channels: Option[];
  assignCommunities: string[];
  assignGroups: string[];
  assignChannels: string[];
  submitting: boolean;
  onChangeTitle: (value: string) => void;
  onChangeDescription: (value: string) => void;
  onChangeRequirements: (value: string) => void;
  onChangeStepsText: (value: string) => void;
  onToggleCommunity: (id: string) => void;
  onToggleGroup: (id: string) => void;
  onToggleChannel: (id: string) => void;
  onSubmit: () => void;
};

export default function PartnerRecruitmentForm({
  palette,
  title,
  description,
  requirements,
  stepsText,
  communities,
  groups,
  channels,
  assignCommunities,
  assignGroups,
  assignChannels,
  submitting,
  onChangeTitle,
  onChangeDescription,
  onChangeRequirements,
  onChangeStepsText,
  onToggleCommunity,
  onToggleGroup,
  onToggleChannel,
  onSubmit,
}: Props) {
  return (
    <View>
      <Text style={{ color: palette.text, fontSize: 14, fontWeight: '700' }}>
        Create a recruitment job
      </Text>
      <TextInput
        value={title}
        onChangeText={onChangeTitle}
        placeholder="Job title"
        placeholderTextColor={palette.subtext}
        style={{
          marginTop: 8,
          borderWidth: 2,
          borderColor: palette.borderMuted,
          borderRadius: 10,
          paddingHorizontal: 10,
          paddingVertical: 8,
          color: palette.text,
        }}
      />
      <TextInput
        value={description}
        onChangeText={onChangeDescription}
        placeholder="Job description"
        placeholderTextColor={palette.subtext}
        multiline
        style={{
          marginTop: 8,
          borderWidth: 2,
          borderColor: palette.borderMuted,
          borderRadius: 10,
          paddingHorizontal: 10,
          paddingVertical: 8,
          color: palette.text,
          minHeight: 70,
          textAlignVertical: 'top',
        }}
      />
      <TextInput
        value={requirements}
        onChangeText={onChangeRequirements}
        placeholder="Requirements / criteria"
        placeholderTextColor={palette.subtext}
        multiline
        style={{
          marginTop: 8,
          borderWidth: 2,
          borderColor: palette.borderMuted,
          borderRadius: 10,
          paddingHorizontal: 10,
          paddingVertical: 8,
          color: palette.text,
          minHeight: 70,
          textAlignVertical: 'top',
        }}
      />
      <TextInput
        value={stepsText}
        onChangeText={onChangeStepsText}
        placeholder="Recruitment steps (one per line)"
        placeholderTextColor={palette.subtext}
        multiline
        style={{
          marginTop: 8,
          borderWidth: 2,
          borderColor: palette.borderMuted,
          borderRadius: 10,
          paddingHorizontal: 10,
          paddingVertical: 8,
          color: palette.text,
          minHeight: 80,
          textAlignVertical: 'top',
        }}
      />

      <Text style={{ color: palette.text, fontWeight: '700', marginTop: 12 }}>
        Auto-assign on acceptance
      </Text>
      <AssignChips
        palette={palette}
        label="Communities"
        options={communities}
        selectedIds={assignCommunities}
        onToggle={onToggleCommunity}
      />
      <AssignChips
        palette={palette}
        label="Groups"
        options={groups}
        selectedIds={assignGroups}
        onToggle={onToggleGroup}
      />
      <AssignChips
        palette={palette}
        label="Channels"
        options={channels}
        selectedIds={assignChannels}
        onToggle={onToggleChannel}
      />

      <Pressable
        onPress={onSubmit}
        disabled={submitting}
        style={({ pressed }) => ({
          marginTop: 16,
          paddingVertical: 10,
          borderRadius: 12,
          backgroundColor: palette.primaryStrong,
          opacity: pressed ? 0.8 : 1,
          alignItems: 'center',
        })}
      >
        <Text style={{ color: palette.onPrimary, fontWeight: '700' }}>
          {submitting ? 'Saving...' : 'Create job post'}
        </Text>
      </Pressable>
    </View>
  );
}
