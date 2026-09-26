// src/screens/education/learner/LearningPlayerScreen.tsx
//
// Education UX v2 — real "Learning Player" destination for consuming one
// curriculum item (lesson, material, class session, assessment, event, or
// broadcast). Deliberately narrower than EducationDetailSheet's inline
// item viewer (untouched — see that file): rich in-line PDF/video preview
// is not reimplemented here, materials open via the device's own
// viewer/browser instead. See the v2 architecture note's "Known
// limitations" for exactly what that trades off.
//
// Backend note: EducationContentItemActionView only supports
// `mark_attended` (class sessions) and the three assessment actions
// (start/save/submit) — there is currently no "mark lesson/material
// complete" action on the backend at all, for either this screen or the
// original sheet. Prev/Next here just moves between outline items; it
// does not claim to mark anything "done" that the API has no way to record.
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import KISButton from '@/constants/KISButton';
import ROUTES from '@/network';
import { queueableJsonRequest } from '@/services/offlineActionQueue';
import useEducationCourseDetail from '@/screens/broadcast/education/hooks/useEducationCourseDetail';
import { hasLearningAccessForItem } from '@/screens/broadcast/education/utils/educationAccess';
import type { RootStackParamList } from '@/navigation/types';
import type { EducationCourseOutlineItem } from '@/screens/broadcast/education/api/education.models';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route_ = RouteProp<RootStackParamList, 'EducationLearningPlayer'>;

function flattenOutline(outline: any[]): EducationCourseOutlineItem[] {
  return (outline ?? []).flatMap(module => module.items ?? []);
}

export default function LearningPlayerScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route_>();
  const { contentId, itemId } = route.params;
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const { item, loading, hydrate } = useEducationCourseDetail();
  const [assessmentDraft, setAssessmentDraft] = useState<Record<string, string[]>>({});
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    hydrate(contentId);
  }, [contentId, hydrate]);

  const flatItems = useMemo(() => flattenOutline((item as any)?.courseOutline ?? []), [item]);
  const index = flatItems.findIndex(row => row.id === itemId);
  const current = flatItems[index] ?? null;
  const prevItem = index > 0 ? flatItems[index - 1] : null;
  const nextItem = index >= 0 && index < flatItems.length - 1 ? flatItems[index + 1] : null;
  const hasAccess = item ? hasLearningAccessForItem(item) : false;

  const runAction = useCallback(
    async (action: string, extra?: Record<string, any>) => {
      setBusy(true);
      try {
        const response = await queueableJsonRequest({
          domain: 'Education',
          kind: 'education.itemAction',
          method: 'POST',
          url: ROUTES.education.itemAction(contentId, itemId),
          body: { action, submission_id: submissionId, ...extra },
          dedupeKey: `education:item-action:${contentId}:${itemId}:${action}:${Date.now()}`,
          errorMessage: 'Unable to submit.',
        });
        if (!response?.success) {
          Alert.alert('Education', response?.message || 'Unable to submit.');
          return null;
        }
        const payload = response?.data ?? {};
        if (payload?.submission_id) setSubmissionId(payload.submission_id);
        await hydrate(contentId);
        return payload;
      } finally {
        setBusy(false);
      }
    },
    [contentId, itemId, submissionId, hydrate],
  );

  const goToItem = (targetItemId?: string) => {
    if (!targetItemId) return;
    navigation.setParams({ contentId, itemId: targetItemId } as any);
  };

  if (loading && !current) {
    return (
      <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: palette.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={palette.primary} />
      </SafeAreaView>
    );
  }

  if (!current) {
    return (
      <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: palette.bg, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: palette.subtext, fontWeight: '700', textAlign: 'center' }}>This item is not available.</Text>
        <KISButton title="Back to course" onPress={() => navigation.goBack()} />
      </SafeAreaView>
    );
  }

  if (!current.is_preview && !hasAccess) {
    return (
      <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: palette.bg, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 }}>
        <KISIcon name="lock" size={32} color={palette.subtext} />
        <Text style={{ color: palette.subtext, fontWeight: '700', textAlign: 'center' }}>
          Enroll in this course to unlock this item.
        </Text>
        <KISButton
          title="View course"
          onPress={() => navigation.navigate('EducationCourseDetail', { contentId })}
        />
      </SafeAreaView>
    );
  }

  const content: any = current.content ?? {};

  const renderBody = () => {
    switch (current.type) {
      case 'lesson':
        return (
          <View style={{ gap: 14 }}>
            <Text style={{ color: palette.text, lineHeight: 22 }}>{content.content || current.summary || 'No content available.'}</Text>
            {(content.materials ?? []).length > 0 ? (
              <View style={{ gap: 8 }}>
                <Text style={{ fontWeight: '800', color: palette.text }}>Attached materials</Text>
                {content.materials.map((material: any) => (
                  <Pressable
                    key={material.id}
                    onPress={() => Linking.openURL(material.safe_resource_url || material.resource_url)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: palette.border }}
                  >
                    <KISIcon name="file" size={16} color={palette.primary} />
                    <Text style={{ color: palette.text, fontWeight: '700', flex: 1 }} numberOfLines={1}>
                      {material.title}
                    </Text>
                    <KISIcon name="download" size={16} color={palette.subtext} />
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        );
      case 'material':
        return (
          <View style={{ gap: 12 }}>
            <Text style={{ color: palette.subtext }}>{current.summary}</Text>
            <KISButton
              title={content.is_downloadable === false ? 'Open' : 'Open / Download'}
              onPress={() => Linking.openURL(content.safe_resource_url || content.resource_url)}
            />
          </View>
        );
      case 'class_session':
        return (
          <View style={{ gap: 12 }}>
            <Text style={{ color: palette.text }}>
              {content.starts_at ? new Date(content.starts_at).toLocaleString() : 'Schedule TBD'}
            </Text>
            <Text style={{ color: palette.subtext }}>
              {content.delivery_mode === 'online' ? 'Online session' : content.location_text || 'In person'}
            </Text>
            {content.meeting_url ? (
              <KISButton title="Join session" onPress={() => Linking.openURL(content.meeting_url)} />
            ) : null}
            <KISButton
              title={busy ? 'Marking…' : "I attended this session"}
              variant="outline"
              disabled={busy}
              onPress={() => void runAction('mark_attended')}
            />
          </View>
        );
      case 'assessment':
        return (
          <View style={{ gap: 14 }}>
            <Text style={{ color: palette.subtext }}>{content.instructions}</Text>
            {(content.questions ?? []).map((question: any, qIndex: number) => (
              <View key={question.id} style={{ gap: 8 }}>
                <Text style={{ fontWeight: '800', color: palette.text }}>
                  {qIndex + 1}. {question.prompt}
                </Text>
                {(question.options ?? []).map((option: any) => {
                  const selected = (assessmentDraft[question.id] ?? []).includes(option.id);
                  return (
                    <Pressable
                      key={option.id}
                      onPress={() =>
                        setAssessmentDraft(prev => ({ ...prev, [question.id]: [option.id] }))
                      }
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        padding: 10,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: selected ? palette.primary : palette.border,
                        backgroundColor: selected ? palette.primarySoft : palette.surface,
                      }}
                    >
                      {selected ? <KISIcon name="check" size={14} color={palette.primary} /> : null}
                      <Text style={{ color: palette.text }}>{option.option_text}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <KISButton
                title={submissionId ? 'Resume attempt' : 'Start attempt'}
                variant="outline"
                onPress={() => void runAction('start_assessment')}
              />
              <KISButton
                title={busy ? 'Submitting…' : 'Submit answers'}
                disabled={busy || !submissionId}
                onPress={() =>
                  void runAction('submit_assessment', {
                    responses: Object.entries(assessmentDraft).map(([question_id, selected_option_ids]) => ({
                      question_id,
                      selected_option_ids,
                    })),
                  })
                }
              />
            </View>
          </View>
        );
      default:
        return <Text style={{ color: palette.subtext }}>{current.summary}</Text>;
    }
  };

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: palette.bg }}>
      <ScrollView contentContainerStyle={{ padding: responsive.pageGutter, gap: 18, paddingBottom: 100 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Pressable onPress={() => navigation.navigate('EducationCourseDetail', { contentId })} style={{ padding: 4, marginLeft: -4 }}>
            <KISIcon name="back" size={20} color={palette.text} />
          </Pressable>
          <Text style={{ color: palette.subtext, fontWeight: '700', textTransform: 'uppercase', fontSize: 12 }}>
            {current.type.replace('_', ' ')} · {item?.title}
          </Text>
        </View>
        <Text style={{ fontSize: 22, fontWeight: '900', color: palette.text }}>{current.title}</Text>
        {renderBody()}
      </ScrollView>
      <View style={{ flexDirection: 'row', gap: 10, padding: responsive.pageGutter, borderTopWidth: 1, borderTopColor: palette.border, backgroundColor: palette.bg }}>
        <KISButton title="Previous" variant="outline" disabled={!prevItem} onPress={() => goToItem(prevItem?.id)} />
        <View style={{ flex: 1 }} />
        <KISButton title="Next" disabled={!nextItem} onPress={() => goToItem(nextItem?.id)} />
      </View>
    </SafeAreaView>
  );
}
