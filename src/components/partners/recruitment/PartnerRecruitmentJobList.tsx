import React from 'react';
import { Text, View } from 'react-native';
import { PartnerJobPost } from '@/components/partners/partnersTypes';

type Props = {
  palette: any;
  jobs: PartnerJobPost[];
};

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
        const salaryRange = formatSalaryRange(job);
        const locationLabel = job.is_remote
          ? 'Remote'
          : job.location || null;
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
              {[humanizeJobType(job.job_type), locationLabel, salaryRange]
                .filter(Boolean)
                .join(' · ') || 'No details added yet'}
            </Text>
            <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 2 }}>
              Steps: {job.steps?.length ?? 0} | Auto-assign: {assignCount}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
