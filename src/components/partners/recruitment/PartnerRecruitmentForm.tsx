import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import AssignChips from './AssignChips';

type Option = { id: string; name: string };

export const JOB_TYPE_OPTIONS: { id: string; name: string }[] = [
  { id: 'full_time', name: 'Full time' },
  { id: 'part_time', name: 'Part time' },
  { id: 'contract', name: 'Contract' },
  { id: 'freelance', name: 'Freelance' },
  { id: 'internship', name: 'Internship' },
];

type Props = {
  palette: any;
  title: string;
  description: string;
  requirements: string;
  stepsText: string;
  location: string;
  isRemote: boolean;
  jobType: string;
  salaryMin: string;
  salaryMax: string;
  salaryCurrency: string;
  tagsText: string;
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
  onChangeLocation: (value: string) => void;
  onToggleRemote: () => void;
  onChangeJobType: (value: string) => void;
  onChangeSalaryMin: (value: string) => void;
  onChangeSalaryMax: (value: string) => void;
  onChangeSalaryCurrency: (value: string) => void;
  onChangeTagsText: (value: string) => void;
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
  location,
  isRemote,
  jobType,
  salaryMin,
  salaryMax,
  salaryCurrency,
  tagsText,
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
  onChangeLocation,
  onToggleRemote,
  onChangeJobType,
  onChangeSalaryMin,
  onChangeSalaryMax,
  onChangeSalaryCurrency,
  onChangeTagsText,
  onToggleCommunity,
  onToggleGroup,
  onToggleChannel,
  onSubmit,
}: Props) {
  const fieldStyle = {
    marginTop: 8,
    borderWidth: 2,
    borderColor: palette.borderMuted,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: palette.text,
  };
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
        style={fieldStyle}
      />

      <Text style={{ color: palette.text, fontWeight: '700', marginTop: 12 }}>
        Employment type
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 }}>
        {JOB_TYPE_OPTIONS.map((option) => {
          const active = jobType === option.id;
          return (
            <Pressable
              key={option.id}
              onPress={() => onChangeJobType(option.id)}
              style={({ pressed }) => ({
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 999,
                borderWidth: 2,
                borderColor: palette.borderMuted,
                backgroundColor: active ? palette.primarySoft : 'transparent',
                marginRight: 8,
                marginBottom: 8,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Text style={{ color: palette.text, fontSize: 12, fontWeight: '600' }}>
                {option.name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
        <TextInput
          value={location}
          onChangeText={onChangeLocation}
          placeholder="Location (e.g. Douala, Cameroon)"
          placeholderTextColor={palette.subtext}
          editable={!isRemote}
          style={[fieldStyle, { flex: 1, opacity: isRemote ? 0.5 : 1 }]}
        />
        <Pressable
          onPress={onToggleRemote}
          style={({ pressed }) => ({
            marginTop: 8,
            paddingHorizontal: 14,
            justifyContent: 'center',
            borderRadius: 10,
            borderWidth: 2,
            borderColor: palette.borderMuted,
            backgroundColor: isRemote ? palette.primarySoft : 'transparent',
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <Text style={{ color: palette.text, fontSize: 12, fontWeight: '700' }}>Remote</Text>
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput
          value={salaryMin}
          onChangeText={onChangeSalaryMin}
          placeholder="Salary min"
          placeholderTextColor={palette.subtext}
          keyboardType="numeric"
          style={[fieldStyle, { flex: 1 }]}
        />
        <TextInput
          value={salaryMax}
          onChangeText={onChangeSalaryMax}
          placeholder="Salary max"
          placeholderTextColor={palette.subtext}
          keyboardType="numeric"
          style={[fieldStyle, { flex: 1 }]}
        />
        <TextInput
          value={salaryCurrency}
          onChangeText={onChangeSalaryCurrency}
          placeholder="USD"
          placeholderTextColor={palette.subtext}
          autoCapitalize="characters"
          maxLength={3}
          style={[fieldStyle, { width: 70 }]}
        />
      </View>

      <TextInput
        value={tagsText}
        onChangeText={onChangeTagsText}
        placeholder="Skills / tags, comma separated"
        placeholderTextColor={palette.subtext}
        style={fieldStyle}
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
