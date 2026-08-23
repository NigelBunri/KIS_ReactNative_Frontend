import React, { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

type Cv = {
  headline?: string;
  bio?: string;
  industry?: string;
  open_to_work?: boolean;
  experiences?: Array<{ title: string; description?: string; start_date?: string; end_date?: string | null; currently_working?: boolean }>;
  educations?: Array<{ school: string; description?: string; start_date?: string; end_date?: string | null; currently_studying?: boolean }>;
  skills?: Array<{ skill_id: string; verified?: boolean; endorsements?: number; description?: string }>;
  projects?: Array<{ name: string; description?: string; project_url?: string; technologies?: string[] }>;
};

export type ApplicationUser = {
  id: string;
  display_name?: string;
  phone?: string;
  avatar_url?: string | null;
  cv?: Cv;
};

export type Application = {
  id: string;
  status: string;
  message?: string;
  job_post?: string | null;
  user: ApplicationUser;
  created_at?: string;
};

export default function PartnerApplicationsReview({
  palette,
  applications,
  onApprove,
  onReject,
}: {
  palette: any;
  applications: Application[];
  onApprove: (application: Application) => Promise<void>;
  onReject: (application: Application) => Promise<void>;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const pending = applications.filter(a => a.status === 'pending');
  if (pending.length === 0) return null;

  async function decide(app: Application, action: 'approve' | 'reject') {
    setBusyId(app.id);
    try {
      if (action === 'approve') await onApprove(app);
      else await onReject(app);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={{ color: palette.text, fontSize: 15, fontWeight: '800', marginBottom: 8 }}>
        Applications ({pending.length})
      </Text>
      {pending.map(app => {
        const expanded = expandedId === app.id;
        const busy = busyId === app.id;
        const cv = app.user?.cv;
        return (
          <View
            key={app.id}
            style={{
              borderWidth: 1, borderColor: palette.border, borderRadius: 12,
              padding: 12, marginBottom: 10, backgroundColor: palette.card,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: palette.text, fontSize: 14, fontWeight: '700' }}>
                  {app.user?.display_name || 'Applicant'}
                </Text>
                {cv?.headline ? (
                  <Text style={{ color: palette.subtext, fontSize: 12 }}>{cv.headline}</Text>
                ) : null}
              </View>
              <Pressable onPress={() => setExpandedId(expanded ? null : app.id)}>
                <Text style={{ color: palette.primary, fontSize: 12, fontWeight: '700' }}>
                  {expanded ? 'Hide CV' : 'View CV'}
                </Text>
              </Pressable>
            </View>

            {app.message ? (
              <Text style={{ color: palette.text, fontSize: 13, marginTop: 8 }}>{app.message}</Text>
            ) : null}

            {expanded ? (
              <View style={{ marginTop: 10, gap: 8 }}>
                {!cv ? (
                  <Text style={{ color: palette.subtext, fontSize: 12 }}>Applicant chose not to share their profile.</Text>
                ) : (
                  <>
                    {cv.bio ? <Text style={{ color: palette.subtext, fontSize: 12 }}>{cv.bio}</Text> : null}
                    {cv.open_to_work ? (
                      <Text style={{ color: palette.primary, fontSize: 11, fontWeight: '700' }}>Open to work</Text>
                    ) : null}
                    {(cv.experiences ?? []).length > 0 ? (
                      <View>
                        <Text style={{ color: palette.text, fontSize: 12, fontWeight: '700' }}>Experience</Text>
                        {cv.experiences!.map((exp, idx) => (
                          <Text key={idx} style={{ color: palette.subtext, fontSize: 12 }}>
                            • {exp.title}{exp.currently_working ? ' (current)' : ''}
                          </Text>
                        ))}
                      </View>
                    ) : null}
                    {(cv.educations ?? []).length > 0 ? (
                      <View>
                        <Text style={{ color: palette.text, fontSize: 12, fontWeight: '700' }}>Education</Text>
                        {cv.educations!.map((edu, idx) => (
                          <Text key={idx} style={{ color: palette.subtext, fontSize: 12 }}>• {edu.school}</Text>
                        ))}
                      </View>
                    ) : null}
                    {(cv.projects ?? []).length > 0 ? (
                      <View>
                        <Text style={{ color: palette.text, fontSize: 12, fontWeight: '700' }}>Projects</Text>
                        {cv.projects!.map((project, idx) => (
                          <Text key={idx} style={{ color: palette.subtext, fontSize: 12 }}>• {project.name}</Text>
                        ))}
                      </View>
                    ) : null}
                  </>
                )}
              </View>
            ) : null}

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <Pressable
                style={{ flex: 1, backgroundColor: palette.primary, borderRadius: 8, paddingVertical: 8, alignItems: 'center' }}
                onPress={() => decide(app, 'approve')}
                disabled={busy}
              >
                {busy ? <ActivityIndicator size="small" color={palette.onPrimary ?? '#fff'} /> : (
                  <Text style={{ color: palette.onPrimary ?? '#fff', fontSize: 12, fontWeight: '700' }}>Approve</Text>
                )}
              </Pressable>
              <Pressable
                style={{ flex: 1, borderWidth: 1, borderColor: palette.border, borderRadius: 8, paddingVertical: 8, alignItems: 'center' }}
                onPress={() => decide(app, 'reject')}
                disabled={busy}
              >
                <Text style={{ color: palette.subtext, fontSize: 12, fontWeight: '700' }}>Reject</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
    </View>
  );
}
