import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { PartnerDiscover } from '@/components/partners/partnersTypes';

type Props = {
  palette: any;
  target: PartnerDiscover;
  message: string;
  role: string;
  jobPosts: Array<{
    id: string | number;
    title: string;
    description?: string | null;
    requirements?: string | null;
    steps?: string[] | null;
  }>;
  selectedJobId: string | null;
  onChangeJobId: (value: string | null) => void;
  onChangeMessage: (value: string) => void;
  onChangeRole: (value: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
};

export default function PartnerApplySheet({
  palette,
  target,
  message,
  role,
  jobPosts,
  selectedJobId,
  onChangeJobId,
  onChangeMessage,
  onChangeRole,
  onCancel,
  onSubmit,
}: Props) {
  return (
    <View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        borderTopWidth: 1,
        borderColor: palette.divider,
        backgroundColor: palette.surfaceElevated,
        padding: 16,
      }}
    >
      <Text style={{ color: palette.text, fontSize: 14, fontWeight: '700' }}>
        Apply to {target.name}
      </Text>
      <TextInput
        value={role}
        onChangeText={onChangeRole}
        placeholder="Desired role or department"
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
      {jobPosts.length > 0 ? (
        <View style={{ marginTop: 10 }}>
          <Text style={{ color: palette.subtext, fontSize: 12, marginBottom: 6 }}>
            Select a job
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {jobPosts.map((job) => {
              const isSelected = selectedJobId === String(job.id);
              return (
                <Pressable
                  key={String(job.id)}
                  onPress={() => onChangeJobId(String(job.id))}
                  style={({ pressed }) => ({
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 999,
                    borderWidth: 2,
                    borderColor: palette.borderMuted,
                    backgroundColor: isSelected ? palette.primarySoft : 'transparent',
                    marginRight: 8,
                    marginBottom: 8,
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <Text style={{ color: palette.text, fontSize: 12, fontWeight: '600' }}>
                    {job.title}
                  </Text>
                </Pressable>
              );
            })}
            <Pressable
              onPress={() => onChangeJobId(null)}
              style={({ pressed }) => ({
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 999,
                borderWidth: 2,
                borderColor: palette.borderMuted,
                backgroundColor: selectedJobId ? 'transparent' : palette.primarySoft,
                marginRight: 8,
                marginBottom: 8,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Text style={{ color: palette.text, fontSize: 12, fontWeight: '600' }}>
                General
              </Text>
            </Pressable>
          </View>
          {selectedJobId ? (
            <View style={{ marginTop: 6 }}>
              {jobPosts
                .filter((job) => String(job.id) === selectedJobId)
                .map((job) => (
                  <View key={String(job.id)}>
                    {job.description ? (
                      <Text style={{ color: palette.subtext, fontSize: 11 }}>
                        {job.description}
                      </Text>
                    ) : null}
                    {job.requirements ? (
                      <Text style={{ color: palette.subtext, fontSize: 11, marginTop: 4 }}>
                        Requirements: {job.requirements}
                      </Text>
                    ) : null}
                    {job.steps && job.steps.length > 0 ? (
                      <Text style={{ color: palette.subtext, fontSize: 11, marginTop: 4 }}>
                        Steps: {job.steps.join(' -> ')}
                      </Text>
                    ) : null}
                  </View>
                ))}
            </View>
          ) : null}
        </View>
      ) : null}
      <TextInput
        value={message}
        onChangeText={onChangeMessage}
        placeholder="Why do you want to join?"
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
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
        <Pressable
          onPress={onCancel}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 10,
            borderWidth: 2,
            borderColor: palette.borderMuted,
          }}
        >
          <Text style={{ color: palette.text, fontWeight: '600' }}>Cancel</Text>
        </Pressable>
        <Pressable
          onPress={onSubmit}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 10,
            backgroundColor: palette.primaryStrong,
          }}
        >
          <Text style={{ color: palette.onPrimary, fontWeight: '700' }}>Submit</Text>
        </Pressable>
      </View>
    </View>
  );
}
