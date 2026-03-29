import React from 'react';
import { Text, View } from 'react-native';
import { PartnerJobPost } from '@/components/partners/partnersTypes';

type Props = {
  palette: any;
  jobs: PartnerJobPost[];
};

export default function PartnerRecruitmentJobList({ palette, jobs }: Props) {
  if (jobs.length === 0) return null;

  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ color: palette.text, fontSize: 14, fontWeight: '700' }}>
        Active job posts
      </Text>
      {jobs.map((job) => {
        const assignCount =
          (job.auto_assign?.groups?.length ?? 0) +
          (job.auto_assign?.communities?.length ?? 0) +
          (job.auto_assign?.channels?.length ?? 0);
        return (
          <View
            key={String(job.id)}
            style={{
              borderWidth: 2,
              borderColor: palette.borderMuted,
              borderRadius: 12,
              padding: 10,
              marginTop: 10,
              backgroundColor: palette.surface,
            }}
          >
            <Text style={{ color: palette.text, fontWeight: '700' }}>{job.title}</Text>
            <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 4 }}>
              Steps: {job.steps?.length ?? 0} | Auto-assign: {assignCount}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
