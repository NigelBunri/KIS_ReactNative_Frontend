import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { PartnerDiscover, PartnerJobPost } from '@/components/partners/partnersTypes';

const humanizeJobType = (value?: string | null) =>
  String(value || '')
    .replace(/_/g, ' ')
    .replace(/^\w/, (letter) => letter.toUpperCase());

const formatSalaryRange = (job: PartnerJobPost) => {
  if (!job.salary_min && !job.salary_max) return null;
  const currency = job.salary_currency || 'USD';
  if (job.salary_min && job.salary_max) {
    return `${currency} ${job.salary_min.toLocaleString()}–${job.salary_max.toLocaleString()}`;
  }
  return `${currency} ${(job.salary_min ?? job.salary_max)!.toLocaleString()}+`;
};

type Props = {
  palette: any;
  target: PartnerDiscover;
  message: string;
  role: string;
  jobPosts: PartnerJobPost[];
  selectedJobId: string | null;
  onChangeJobId: (value: string | null) => void;
  onChangeMessage: (value: string) => void;
  onChangeRole: (value: string) => void;
  shareProfile: boolean;
  onChangeShareProfile: (value: boolean) => void;
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
  shareProfile,
  onChangeShareProfile,
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
                .map((job) => {
                  const salaryRange = formatSalaryRange(job);
                  const locationLabel = job.is_remote ? 'Remote' : job.location || null;
                  const metaLine = [humanizeJobType(job.job_type), locationLabel, salaryRange]
                    .filter(Boolean)
                    .join(' · ');
                  return (
                    <View
                      key={String(job.id)}
                      style={{
                        borderWidth: 2,
                        borderColor: palette.borderMuted,
                        borderRadius: 10,
                        padding: 10,
                        gap: 6,
                      }}
                    >
                      {metaLine ? (
                        <Text style={{ color: palette.primaryStrong, fontSize: 12, fontWeight: '700' }}>
                          {metaLine}
                        </Text>
                      ) : null}
                      {job.description ? (
                        <View>
                          <Text style={{ color: palette.text, fontSize: 12, fontWeight: '700' }}>About the role</Text>
                          <Text style={{ color: palette.subtext, fontSize: 11, marginTop: 2 }}>
                            {job.description}
                          </Text>
                        </View>
                      ) : null}
                      {job.requirements ? (
                        <View>
                          <Text style={{ color: palette.text, fontSize: 12, fontWeight: '700' }}>Requirements</Text>
                          <Text style={{ color: palette.subtext, fontSize: 11, marginTop: 2 }}>
                            {job.requirements}
                          </Text>
                        </View>
                      ) : null}
                      {job.tags && job.tags.length > 0 ? (
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                          {job.tags.map((tag) => (
                            <View
                              key={tag}
                              style={{
                                borderWidth: 1,
                                borderColor: palette.borderMuted,
                                borderRadius: 999,
                                paddingHorizontal: 8,
                                paddingVertical: 3,
                              }}
                            >
                              <Text style={{ color: palette.subtext, fontSize: 10, fontWeight: '600' }}>{tag}</Text>
                            </View>
                          ))}
                        </View>
                      ) : null}
                      {job.steps && job.steps.length > 0 ? (
                        <View>
                          <Text style={{ color: palette.text, fontSize: 12, fontWeight: '700' }}>Hiring process</Text>
                          <Text style={{ color: palette.subtext, fontSize: 11, marginTop: 2 }}>
                            {job.steps.join(' → ')}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  );
                })}
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
      <Pressable
        onPress={() => onChangeShareProfile(!shareProfile)}
        style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 8 }}
      >
        <View
          style={{
            width: 18, height: 18, borderRadius: 4, borderWidth: 2, borderColor: palette.borderMuted,
            backgroundColor: shareProfile ? palette.primaryStrong : 'transparent',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          {shareProfile ? <Text style={{ color: palette.onPrimary, fontSize: 12, fontWeight: '900' }}>✓</Text> : null}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: palette.text, fontSize: 12, fontWeight: '600' }}>Share my profile as your CV</Text>
          <Text style={{ color: palette.subtext, fontSize: 11 }}>Headline, bio, experience, education, and skills</Text>
        </View>
      </Pressable>
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
