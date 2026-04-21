import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Modal, Pressable, ScrollView, Share, Text, View } from 'react-native';
import Video from 'react-native-video';
import Pdf from 'react-native-pdf';
import RNFS from 'react-native-fs';
import { buildMediaSource, useMediaHeaders } from '@/network';
import { useKISTheme } from '@/theme/useTheme';
import KISButton from '@/constants/KISButton';
import KISTextInput from '@/constants/KISTextInput';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import {
  EducationContentItem,
  EducationCourse,
  EducationCourseOutlineItem,
  EducationCourseOutlineModule,
  EducationLearnerInsights,
  EducationProgress,
} from '@/screens/broadcast/education/api/education.models';

type LearnerContent = EducationContentItem & {
  detailLoading?: boolean;
  courseOutline?: EducationCourseOutlineModule[];
  progress?: EducationProgress | null;
  insights?: EducationLearnerInsights | null;
  currentItem?: EducationCourseOutlineItem | null;
  currentModule?: EducationCourseOutlineModule | null;
  nextItem?: EducationCourseOutlineItem | null;
  certificate?: { ready?: boolean; certificateId?: string; issuedAt?: string | null } | null;
  viewerState?: any;
  faqs?: Array<{ question: string; answer: string }>;
};

type Props = {
  visible: boolean;
  item: EducationContentItem | null;
  onClose: () => void;
  onEnroll: (item: EducationContentItem) => void;
  onPreview: (item: EducationContentItem) => void;
  onRefreshProgress?: () => void | Promise<void>;
};

type AssessmentDraft = Record<string, { answer_text?: string; selected_option_ids: string[] }>;

const formatTypeLabel = (value?: string) =>
  (value || 'item')
    .replace(/_/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ');

const flattenOutline = (outline: EducationCourseOutlineModule[]) =>
  outline.flatMap((module) =>
    (module.items || []).map((item) => ({
      ...item,
      module_id: item.module_id || module.id,
      module_title: item.module_title || module.title,
    })),
  );

const formatDateTime = (value?: string | null) => {
  if (!value) return 'TBD';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const formatSeatLimit = (value?: number | null) => {
  if (value == null) return 'Open access';
  return `${value} seats`;
};

const buildProtectedSource = (uri?: string | null, headers?: Record<string, string>) => {
  if (!uri) return undefined;
  if (headers && Object.keys(headers).length > 0) {
    return { uri, headers };
  }
  return { uri };
};

const hasMime = (value: unknown, token: string) => String(value || '').toLowerCase().includes(token);
const toText = (value: any) => String(value ?? '').trim();

const inferMaterialMime = (payload: any) => {
  const rawMime = toText(payload?.resource_mime_type || payload?.resource_type || payload?.mime_type).toLowerCase();
  if (rawMime) return rawMime;
  const source = toText(payload?.resource_name || payload?.name || payload?.title || payload?.resource_url).toLowerCase();
  if (source.endsWith('.pdf')) return 'application/pdf';
  if (/\.(png|jpg|jpeg|gif|webp|bmp|heic|heif|svg)$/.test(source)) return 'image/*';
  if (/\.(mp4|mov|m4v|webm|avi|mkv|m3u8)$/.test(source)) return 'video/*';
  if (/\.(mp3|wav|aac|m4a|ogg|oga|flac)$/.test(source)) return 'audio/*';
  return toText(payload?.kind).toLowerCase();
};

const inferMaterialKind = (payload: any) => {
  const mime = inferMaterialMime(payload);
  if (mime.includes('image')) return 'image';
  if (mime.includes('video')) return 'video';
  if (mime.includes('audio')) return 'audio';
  if (mime.includes('pdf')) return 'pdf';
  return toText(payload?.kind).toLowerCase() || 'document';
};

const renderOutcomes = (outcomes?: EducationCourse['outcomes']) => {
  if (!outcomes?.length) return null;
  return (
    <View style={{ marginTop: 16 }}>
      <Text style={{ fontWeight: '800', marginBottom: 8 }}>What you will achieve</Text>
      {outcomes.map((outcome) => (
        <Text key={outcome.id} style={{ color: '#5d6472', fontSize: 13, marginBottom: 6 }}>
          • {outcome.label}
        </Text>
      ))}
    </View>
  );
};

const renderRequirements = (requirements?: EducationCourse['requirements']) => {
  if (!requirements?.length) return null;
  return (
    <View style={{ marginTop: 16 }}>
      <Text style={{ fontWeight: '800', marginBottom: 8 }}>Before you start</Text>
      {requirements.map((req) => (
        <Text key={req.id} style={{ color: '#5d6472', fontSize: 13, marginBottom: 6 }}>
          • {req.label}
        </Text>
      ))}
    </View>
  );
};

const InsightsStrip = ({ palette, insights }: { palette: any; insights?: EducationLearnerInsights | null }) => {
  if (!insights) return null;
  const cards = [
    { label: 'Attendance', value: String(insights.attendanceCount) },
    { label: 'Graded', value: String(insights.gradedAssessmentCount) },
    { label: 'Average score', value: `${Math.round(insights.averageScorePercent || 0)}%` },
    { label: 'Certificate', value: insights.certificateReady ? 'Ready' : `${insights.certificateProgressPercent}%` },
  ];
  return (
    <View style={{ marginTop: 16 }}>
      <Text style={{ color: palette.text, fontWeight: '800', marginBottom: 10 }}>Learner insights</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {cards.map((card) => (
          <View
            key={card.label}
            style={{
              minWidth: 132,
              marginRight: 10,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: palette.divider,
              backgroundColor: palette.surface,
              padding: 12,
            }}
          >
            <Text style={{ color: palette.subtext, fontSize: 11, fontWeight: '700' }}>{card.label}</Text>
            <Text style={{ color: palette.text, fontWeight: '900', fontSize: 18, marginTop: 6 }}>{card.value}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

export default function EducationDetailSheet({ visible, item, onClose, onEnroll, onPreview, onRefreshProgress }: Props) {
  const { palette } = useKISTheme();
  const mediaHeaders = useMediaHeaders();
  const [certificateVisible, setCertificateVisible] = useState(false);
  const [certificateLocalUri, setCertificateLocalUri] = useState<string | null>(null);
  const [certificateLoading, setCertificateLoading] = useState(false);
  const [workspaceSection, setWorkspaceSection] = useState<'overview' | 'path' | 'current' | 'certificate'>('overview');
  const content = item as LearnerContent | null;
  const outline = useMemo(() => content?.courseOutline || [], [content]);
  const flatItems = useMemo(() => flattenOutline(outline), [outline]);
  const [progressState, setProgressState] = useState<EducationProgress | null>(content?.progress || null);
  const [insightsState, setInsightsState] = useState<EducationLearnerInsights | null>(content?.insights || null);
  const [activeModuleId, setActiveModuleId] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [progressBusy, setProgressBusy] = useState(false);
  const [assessmentSubmission, setAssessmentSubmission] = useState<any | null>(null);
  const [assessmentDraft, setAssessmentDraft] = useState<AssessmentDraft>({});
  const [previewMaterial, setPreviewMaterial] = useState<any | null>(null);

  useEffect(() => {
    const nextProgress = content?.progress || null;
    setProgressState(nextProgress);
    setInsightsState(content?.insights || null);
    const nextModuleId = nextProgress?.currentModuleId || content?.currentModule?.id || outline[0]?.id || '';
    setActiveModuleId(nextModuleId);
    const nextItemId = nextProgress?.currentItemId || content?.currentItem?.id || flatItems[0]?.id || '';
    setSelectedItemId(nextItemId);
  }, [content, outline, flatItems]);

  const enrolled = Boolean(content?.viewerState?.enrollment) || Boolean(progressState);
  const completedItemIds = new Set(progressState?.completedItemIds || []);
  const activeModule = outline.find((module) => module.id === activeModuleId) || outline[0] || null;
  const activeModuleItems = activeModule?.items || [];
  const selectedItem =
    flatItems.find((row) => row.id === selectedItemId) ||
    flatItems.find((row) => row.id === progressState?.currentItemId) ||
    flatItems[0] ||
    null;
  const progressPercent = Math.round(progressState?.progressPercent || 0);
  const nextItem = progressState?.nextItem || null;
  const certificateId = content?.certificate?.certificateId || '';

  useEffect(() => {
    if (!selectedItem || selectedItem.type !== 'assessment') {
      setAssessmentSubmission(null);
      setAssessmentDraft({});
      return;
    }
    setAssessmentSubmission(null);
    setAssessmentDraft({});
  }, [selectedItem?.id, selectedItem?.type]);

  useEffect(() => {
    setWorkspaceSection(enrolled ? 'current' : 'overview');
    setPreviewMaterial(null);
  }, [content?.id, enrolled]);

  const certificateReady = Boolean(content?.certificate?.ready || insightsState?.certificateReady);
  const certificateIssuedAt = content?.certificate?.issuedAt || null;
  const certificateUrl = content?.id ? ROUTES.education.certificate(content.id) : null;

  useEffect(() => {
    const fetchCertificate = async () => {
      if (!certificateVisible || !certificateUrl || !certificateReady) return;
      if (!Object.keys(mediaHeaders || {}).length) return;
      setCertificateLoading(true);
      setCertificateLocalUri(null);
      try {
        const filePath = `${RNFS.DocumentDirectoryPath}/education-certificate-${content?.id}.pdf`;
        await RNFS.downloadFile({
          fromUrl: certificateUrl,
          toFile: filePath,
          headers: mediaHeaders,
        }).promise;
        setCertificateLocalUri(`file://${filePath}`);
      } catch (error: any) {
        Alert.alert('Certificate', error?.message || 'Unable to load certificate.');
      } finally {
        setCertificateLoading(false);
      }
    };
    fetchCertificate();
  }, [certificateVisible, certificateReady, certificateUrl, content?.id, mediaHeaders]);

  if (!content) return null;


  const sectionChips = [
    { key: 'overview', label: 'Overview' },
    { key: 'path', label: 'Path' },
    { key: 'current', label: enrolled ? 'Continue' : 'Preview' },
    ...(certificateReady ? [{ key: 'certificate', label: 'Certificate' }] : []),
  ] as const;

  const breadcrumbParts = [content.title];
  if (workspaceSection === 'path') {
    breadcrumbParts.push(activeModule?.title || 'Path');
  } else if (workspaceSection === 'current') {
    breadcrumbParts.push(activeModule?.title || 'Current module');
    if (selectedItem?.title) breadcrumbParts.push(selectedItem.title);
  } else if (workspaceSection === 'certificate') {
    breadcrumbParts.push('Certificate');
  } else {
    breadcrumbParts.push('Overview');
  }

  const handleShareCertificate = async () => {
    if (!certificateReady || !content.id) return;
    try {
      const response = await getRequest(`${ROUTES.education.certificate(content.id)}?format=json`, {
        errorMessage: 'Unable to prepare certificate sharing.',
      });
      const payload = response?.data ?? response ?? {};
      const shareUrl = payload?.share_url || (payload?.certificate_share_token ? ROUTES.education.certificateShare(payload.certificate_share_token) : null);
      await Share.share({
        title: `${content.title} certificate`,
        message: [
          `${content.title} certificate`,
          content.partnerName ? `Institution: ${content.partnerName}` : null,
          certificateId ? `Certificate ID: ${certificateId}` : null,
          certificateIssuedAt ? `Issued: ${formatDateTime(certificateIssuedAt)}` : null,
          shareUrl ? `Verify: ${shareUrl}` : null,
        ].filter(Boolean).join('\n'),
      });
    } catch (error: any) {
      Alert.alert('Certificate', error?.message || 'Unable to share certificate right now.');
    }
  };

  const applyLearningPayload = async (payload: any) => {
    const progress = payload?.progress || null;
    setProgressState(progress);
    setInsightsState(payload?.insights || null);
    if (payload?.current_module?.id) setActiveModuleId(payload.current_module.id);
    else if (progress?.currentModuleId) setActiveModuleId(progress.currentModuleId);
    if (payload?.current_item?.id) setSelectedItemId(payload.current_item.id);
    else if (progress?.currentItemId) setSelectedItemId(progress.currentItemId);
    if (payload?.submission) {
      setAssessmentSubmission(payload.submission);
      const nextDraft: AssessmentDraft = {};
      (payload.submission.responses || []).forEach((response: any) => {
        nextDraft[response.question_id] = {
          answer_text: response.answer_text || '',
          selected_option_ids: Array.isArray(response.selected_options)
            ? response.selected_options.map((option: any) => option.option_id)
            : [],
        };
      });
      setAssessmentDraft(nextDraft);
    }
    await onRefreshProgress?.();
  };

  const updateProgress = async (action: string, currentItemId?: string, currentModuleId?: string) => {
    setProgressBusy(true);
    const response = await postRequest(
      ROUTES.education.progress,
      {
        content_id: content.id,
        action,
        current_item_id: currentItemId,
        current_module_id: currentModuleId,
      },
      { errorMessage: 'Unable to update learning progress.' },
    );
    setProgressBusy(false);
    if (!response?.success) {
      Alert.alert('Education', response?.message || 'Unable to update learning progress.');
      return;
    }
    await applyLearningPayload(response?.data || response || {});
  };

  const handleOpenItem = async (learningItem: EducationCourseOutlineItem & { module_id?: string }) => {
    setSelectedItemId(learningItem.id);
    setActiveModuleId(learningItem.module_id || activeModuleId);
    if (enrolled) {
      await updateProgress('set_current', learningItem.id, learningItem.module_id);
    }
  };

  const handleCompleteItem = async (learningItem: EducationCourseOutlineItem & { module_id?: string }) => {
    setSelectedItemId(learningItem.id);
    setActiveModuleId(learningItem.module_id || activeModuleId);
    await updateProgress('complete_item', learningItem.id, learningItem.module_id);
  };

  const openResource = async (url?: string) => {
    if (!url) {
      Alert.alert('Education', 'No resource link is available for this item yet.');
      return;
    }
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert('Education', 'Unable to open this resource on the device.');
      return;
    }
    await Linking.openURL(url);
  };

  const handleLearnerItemAction = async (action: string, payload: Record<string, any> = {}) => {
    if (!selectedItem) return;
    setProgressBusy(true);
    const response = await postRequest(
      ROUTES.education.itemAction(content.id, selectedItem.id),
      { action, submission_id: assessmentSubmission?.id, ...payload },
      { errorMessage: 'Unable to complete this learning action.' },
    );
    setProgressBusy(false);
    if (!response?.success) {
      Alert.alert('Education', response?.message || 'Unable to complete this learning action.');
      return;
    }
    await applyLearningPayload(response?.data || response || {});
  };

  const buildAssessmentResponsesPayload = () => {
    if (!selectedItem || selectedItem.type !== 'assessment') return [];
    const questions = Array.isArray((selectedItem.content as any)?.questions) ? (selectedItem.content as any).questions : [];
    return questions.map((question: any) => ({
      question_id: question.id,
      answer_text: assessmentDraft[question.id]?.answer_text || '',
      selected_option_ids: assessmentDraft[question.id]?.selected_option_ids || [],
    }));
  };

  const renderMaterialViewer = (materialPayload: any, options?: { heading?: string; title?: string; summary?: string }) => {
    const resourceUrl = materialPayload?.resource_url;
    const mime = inferMaterialMime(materialPayload);
    const kind = inferMaterialKind(materialPayload);
    const mediaSource = buildMediaSource(resourceUrl, mediaHeaders);
    const pdfSource = buildProtectedSource(resourceUrl, mediaHeaders);
    const imageSource = resourceUrl
      ? Object.keys(mediaHeaders || {}).length > 0
        ? { uri: resourceUrl, headers: mediaHeaders }
        : { uri: resourceUrl }
      : undefined;

    return (
      <View
        style={{
          marginTop: 18,
          borderRadius: 22,
          padding: 16,
          backgroundColor: palette.card,
          borderWidth: 1,
          borderColor: palette.divider,
        }}
      >
        <Text style={{ color: palette.primaryStrong, fontWeight: '700', fontSize: 12 }}>
          {options?.heading || 'Material viewer'}
        </Text>
        <Text style={{ color: palette.text, fontWeight: '900', fontSize: 18, marginTop: 6 }}>
          {options?.title || 'Material'}
        </Text>
        <Text style={{ color: palette.subtext, marginTop: 8 }}>
          {formatTypeLabel(kind || 'material')}
          {materialPayload?.resource_name ? ` · ${materialPayload.resource_name}` : ''}
        </Text>
        {mime ? <Text style={{ color: palette.subtext, marginTop: 4 }}>{mime}</Text> : null}
        {options?.summary ? (
          <Text style={{ color: palette.subtext, marginTop: 10, lineHeight: 20 }}>{options.summary}</Text>
        ) : null}
        {resourceUrl && kind === 'video' ? (
          <View style={{ marginTop: 14 }}>
            <Video
              source={mediaSource}
              style={{ width: '100%', height: 220, borderRadius: 18, backgroundColor: '#000' }}
              controls
            />
          </View>
        ) : null}
        {resourceUrl && kind === 'audio' ? (
          <View style={{ marginTop: 14 }}>
            <Video
              source={mediaSource}
              style={{ width: '100%', height: 72, borderRadius: 18, backgroundColor: '#000' }}
              controls
              audioOnly
            />
          </View>
        ) : null}
        {resourceUrl && kind === 'pdf' ? (
          <View style={{ marginTop: 14, height: 420, borderRadius: 18, overflow: 'hidden' }}>
            <Pdf source={pdfSource ?? { uri: resourceUrl }} style={{ flex: 1 }} />
          </View>
        ) : null}
        {resourceUrl && kind === 'image' ? (
          <View style={{ marginTop: 14 }}>
            <Image source={imageSource} style={{ width: '100%', height: 220, borderRadius: 18, backgroundColor: palette.card }} resizeMode="contain" />
          </View>
        ) : null}
        {resourceUrl && !['video', 'audio', 'pdf', 'image'].includes(kind) ? (
          <View style={{ marginTop: 14, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: palette.divider, backgroundColor: palette.surface }}>
            <Text style={{ color: palette.subtext, lineHeight: 19 }}>
              This file type does not have an inline viewer. Use the button below to open it externally.
            </Text>
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          <KISButton
            title={resourceUrl ? 'Open material' : 'No resource'}
            size="sm"
            variant="outline"
            disabled={!resourceUrl}
            onPress={() => openResource(resourceUrl)}
          />
        </View>
      </View>
    );
  };

  const renderConsumptionPanel = () => {
    if (!selectedItem) return null;
    const learningItem = selectedItem;
    const contentPayload: any = learningItem.content || {};
    const sectionStyle = {
      marginTop: 18,
      borderRadius: 22,
      padding: 16,
      backgroundColor: palette.card,
      borderWidth: 1,
      borderColor: palette.divider,
    } as const;

    if (learningItem.type === 'lesson') {
      return (
        <View style={sectionStyle}>
          <Text style={{ color: palette.primaryStrong, fontWeight: '700', fontSize: 12 }}>Lesson reader</Text>
          <Text style={{ color: palette.text, fontWeight: '900', fontSize: 18, marginTop: 6 }}>{learningItem.title}</Text>
          <Text style={{ color: palette.subtext, marginTop: 8, lineHeight: 22 }}>
            {contentPayload.content || learningItem.summary || 'This lesson does not have body content yet.'}
          </Text>
          {Array.isArray(contentPayload.materials) && contentPayload.materials.length ? (
            <View style={{ marginTop: 14 }}>
              <Text style={{ color: palette.text, fontWeight: '800', marginBottom: 8 }}>Lesson materials</Text>
              {contentPayload.materials.map((material: any) => (
                <Pressable
                  key={material.id}
                  onPress={() => setPreviewMaterial(material)}
                  style={{
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: palette.divider,
                    padding: 12,
                    marginBottom: 8,
                    backgroundColor: palette.surface,
                  }}
                >
                  <Text style={{ color: palette.text, fontWeight: '700' }}>{material.title}</Text>
                  <Text style={{ color: palette.subtext, marginTop: 4 }}>{formatTypeLabel(material.kind)}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      );
    }

    if (learningItem.type === 'material') {
      return renderMaterialViewer(contentPayload, {
        heading: 'Material viewer',
        title: learningItem.title,
        summary: learningItem.summary,
      });
    }

    if (learningItem.type === 'class_session') {
      return (
        <View style={sectionStyle}>
          <Text style={{ color: palette.primaryStrong, fontWeight: '700', fontSize: 12 }}>Class session</Text>
          <Text style={{ color: palette.text, fontWeight: '900', fontSize: 18, marginTop: 6 }}>{learningItem.title}</Text>
          <Text style={{ color: palette.subtext, marginTop: 8 }}>Starts: {formatDateTime(contentPayload.starts_at)}</Text>
          <Text style={{ color: palette.subtext, marginTop: 4 }}>Ends: {formatDateTime(contentPayload.ends_at)}</Text>
          <Text style={{ color: palette.subtext, marginTop: 4 }}>Mode: {formatTypeLabel(contentPayload.delivery_mode || 'scheduled')}</Text>
          {contentPayload.location_text ? (
            <Text style={{ color: palette.subtext, marginTop: 4 }}>Location: {contentPayload.location_text}</Text>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            <KISButton
              title={contentPayload.meeting_url ? 'Join class' : 'Meeting unavailable'}
              size="sm"
              disabled={!contentPayload.meeting_url}
              onPress={() => openResource(contentPayload.meeting_url)}
            />
            <KISButton
              title="Mark attendance"
              size="sm"
              variant="outline"
              onPress={() => void handleLearnerItemAction('mark_attended')}
              disabled={progressBusy}
            />
          </View>
        </View>
      );
    }

    if (learningItem.type === 'assessment') {
      const questions = Array.isArray(contentPayload.questions) ? contentPayload.questions : [];
      return (
        <View style={sectionStyle}>
          <Text style={{ color: palette.primaryStrong, fontWeight: '700', fontSize: 12 }}>Assessment</Text>
          <Text style={{ color: palette.text, fontWeight: '900', fontSize: 18, marginTop: 6 }}>{learningItem.title}</Text>
          {contentPayload.instructions ? (
            <Text style={{ color: palette.subtext, marginTop: 8, lineHeight: 20 }}>{contentPayload.instructions}</Text>
          ) : null}
          <Text style={{ color: palette.subtext, marginTop: 8 }}>
            {formatTypeLabel(contentPayload.assessment_type || 'assessment')} · {contentPayload.duration_minutes ?? 0} mins · {contentPayload.question_count ?? 0} questions
          </Text>
          {assessmentSubmission ? (
            <Text style={{ color: palette.primaryStrong, marginTop: 10, fontSize: 12, fontWeight: '700' }}>
              Attempt #{assessmentSubmission.attempt_number} · {formatTypeLabel(assessmentSubmission.status || 'started')}
              {assessmentSubmission.score_percent !== null && assessmentSubmission.score_percent !== undefined
                ? ` · ${Math.round(assessmentSubmission.score_percent)}%`
                : ''}
            </Text>
          ) : null}
          {assessmentSubmission?.grader_feedback ? (
            <View style={{ marginTop: 12, borderRadius: 16, padding: 12, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.divider }}>
              <Text style={{ color: palette.text, fontWeight: '800' }}>Instructor feedback</Text>
              <Text style={{ color: palette.subtext, marginTop: 6, lineHeight: 19 }}>{assessmentSubmission.grader_feedback}</Text>
            </View>
          ) : null}
          {Array.isArray(assessmentSubmission?.responses) && assessmentSubmission.responses.some((response: any) => response?.grader_feedback || response?.earned_points !== null) ? (
            <View style={{ marginTop: 12 }}>
              <Text style={{ color: palette.text, fontWeight: '800', marginBottom: 8 }}>Response feedback</Text>
              {assessmentSubmission.responses.map((response: any, index: number) => (
                <View
                  key={response.id || index}
                  style={{
                    borderRadius: 14,
                    padding: 10,
                    marginBottom: 8,
                    backgroundColor: palette.surface,
                    borderWidth: 1,
                    borderColor: palette.divider,
                  }}
                >
                  <Text style={{ color: palette.primaryStrong, fontSize: 11, fontWeight: '700' }}>Question {index + 1}</Text>
                  <Text style={{ color: palette.subtext, marginTop: 4 }}>
                    {response.earned_points ?? 0} pts{response.is_correct === true ? ' · Correct' : response.is_correct === false ? ' · Needs review' : ''}
                  </Text>
                  {response.grader_feedback ? (
                    <Text style={{ color: palette.subtext, marginTop: 6, lineHeight: 18 }}>{response.grader_feedback}</Text>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}
          <View style={{ marginTop: 14 }}>
            {questions.slice(0, 8).map((question: any, index: number) => {
              const answer = assessmentDraft[question.id] || { answer_text: '', selected_option_ids: [] };
              const hasOptions = Array.isArray(question.options) && question.options.length > 0;
              return (
                <View
                  key={question.id}
                  style={{
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: palette.divider,
                    padding: 12,
                    marginBottom: 10,
                    backgroundColor: palette.surface,
                  }}
                >
                  <Text style={{ color: palette.primaryStrong, fontSize: 11, fontWeight: '700' }}>Question {index + 1}</Text>
                  <Text style={{ color: palette.text, fontWeight: '700', marginTop: 4 }}>{question.prompt}</Text>
                  {hasOptions ? (
                    <View style={{ marginTop: 10 }}>
                      {question.options.map((option: any) => {
                        const selected = answer.selected_option_ids?.includes(option.id);
                        return (
                          <Pressable
                            key={option.id}
                            onPress={() =>
                              setAssessmentDraft((prev) => ({
                                ...prev,
                                [question.id]: {
                                  answer_text: prev[question.id]?.answer_text || '',
                                  selected_option_ids: [option.id],
                                },
                              }))
                            }
                            style={{
                              borderRadius: 14,
                              borderWidth: 1,
                              borderColor: selected ? palette.primaryStrong : palette.divider,
                              backgroundColor: selected ? palette.primarySoft : palette.surface,
                              padding: 10,
                              marginBottom: 8,
                            }}
                          >
                            <Text style={{ color: selected ? palette.primaryStrong : palette.text }}>{option.option_text}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : (
                    <KISTextInput
                      label="Answer"
                      value={answer.answer_text || ''}
                      onChangeText={(value) =>
                        setAssessmentDraft((prev) => ({
                          ...prev,
                          [question.id]: {
                            answer_text: value,
                            selected_option_ids: prev[question.id]?.selected_option_ids || [],
                          },
                        }))
                      }
                      multiline
                      style={{ minHeight: 80, marginTop: 10 }}
                    />
                  )}
                </View>
              );
            })}
          </View>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {!assessmentSubmission ? (
              <KISButton title="Start attempt" size="sm" onPress={() => void handleLearnerItemAction('start_assessment')} disabled={progressBusy} />
            ) : null}
            <KISButton
              title="Save draft"
              size="sm"
              variant="outline"
              onPress={() => void handleLearnerItemAction('save_assessment', { responses: buildAssessmentResponsesPayload() })}
              disabled={progressBusy || !assessmentSubmission}
            />
            <KISButton
              title="Submit assessment"
              size="sm"
              onPress={() => void handleLearnerItemAction('submit_assessment', { responses: buildAssessmentResponsesPayload() })}
              disabled={progressBusy || !assessmentSubmission || assessmentSubmission?.status !== 'started'}
            />
          </View>
        </View>
      );
    }

    if (learningItem.type === 'event' || learningItem.type === 'broadcast') {
      return (
        <View style={sectionStyle}>
          <Text style={{ color: palette.primaryStrong, fontWeight: '700', fontSize: 12 }}>
            {learningItem.type === 'event' ? 'Event experience' : 'Broadcast notice'}
          </Text>
          <Text style={{ color: palette.text, fontWeight: '900', fontSize: 18, marginTop: 6 }}>{learningItem.title}</Text>
          <Text style={{ color: palette.subtext, marginTop: 8 }}>Starts: {formatDateTime(contentPayload.starts_at)}</Text>
          <Text style={{ color: palette.subtext, marginTop: 4 }}>Ends: {formatDateTime(contentPayload.ends_at)}</Text>
          {contentPayload.location_text ? (
            <Text style={{ color: palette.subtext, marginTop: 4 }}>Location: {contentPayload.location_text}</Text>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
            <KISButton
              title={contentPayload.meeting_url ? 'Open joining link' : 'No live link'}
              size="sm"
              variant="outline"
              disabled={!contentPayload.meeting_url}
              onPress={() => openResource(contentPayload.meeting_url)}
            />
          </View>
        </View>
      );
    }

    if (content.type === 'workshop') {
      const contentDescription = toText((content as any)?.description);
      const scheduleStartsAt = (content as any)?.startsAt;
      const scheduleEndsAt = (content as any)?.endsAt;
      const deliveryMode = toText((content as any)?.deliveryMode);
      const eventType = toText((content as any)?.eventType || (content as any)?.broadcastKind);
      const meetingUrl = toText((content as any)?.meetingUrl);
      const locationText = toText((content as any)?.locationText);
      const timezoneName = toText((content as any)?.timezoneName);
      const statusText = toText((content as any)?.status);
      const targetLabel = toText((content as any)?.targetLabel);
      const seatLimit = (content as any)?.seatLimit;
      const detailBits = [
        eventType ? formatTypeLabel(eventType) : '',
        deliveryMode ? formatTypeLabel(deliveryMode) : '',
        statusText ? formatTypeLabel(statusText) : '',
      ].filter(Boolean);

      return (
        <View style={sectionStyle}>
          <Text style={{ color: palette.primaryStrong, fontWeight: '700', fontSize: 12 }}>Event details</Text>
          <Text style={{ color: palette.text, fontWeight: '900', fontSize: 18, marginTop: 6 }}>{content.title}</Text>
          {content.summary ? (
            <Text style={{ color: palette.subtext, marginTop: 8, lineHeight: 20 }}>{content.summary}</Text>
          ) : null}
          {contentDescription ? (
            <Text style={{ color: palette.subtext, marginTop: 8, lineHeight: 20 }}>{contentDescription}</Text>
          ) : null}
          {detailBits.length ? (
            <Text style={{ color: palette.subtext, marginTop: 8 }}>{detailBits.join(' · ')}</Text>
          ) : null}
          <Text style={{ color: palette.subtext, marginTop: 8 }}>Starts: {formatDateTime(scheduleStartsAt)}</Text>
          <Text style={{ color: palette.subtext, marginTop: 4 }}>Ends: {formatDateTime(scheduleEndsAt)}</Text>
          {timezoneName ? (
            <Text style={{ color: palette.subtext, marginTop: 4 }}>Timezone: {timezoneName}</Text>
          ) : null}
          {targetLabel ? (
            <Text style={{ color: palette.subtext, marginTop: 4 }}>Linked to: {targetLabel}</Text>
          ) : null}
          {locationText ? (
            <Text style={{ color: palette.subtext, marginTop: 4 }}>Location: {locationText}</Text>
          ) : null}
          <Text style={{ color: palette.subtext, marginTop: 4 }}>Capacity: {formatSeatLimit(seatLimit)}</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            <KISButton
              title={meetingUrl ? 'Open event link' : 'Event link unavailable'}
              size="sm"
              variant="outline"
              disabled={!meetingUrl}
              onPress={() => openResource(meetingUrl)}
            />
          </View>
        </View>
      );
    }

    return null;
  };

  const footerPrimaryTitle = enrolled ? 'Resume learning' : 'Enroll';

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={{ flex: 1, backgroundColor: palette.backdrop }}>
        <View
          style={{
            marginTop: '10%',
            backgroundColor: palette.surface,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingHorizontal: 18,
            paddingTop: 18,
            paddingBottom: 14,
            flex: 1,
          }}
        >
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
            <View
              style={{
                borderRadius: 24,
                padding: 18,
                backgroundColor: palette.card,
                borderWidth: 1,
                borderColor: palette.divider,
              }}
            >
              <Text style={{ color: palette.primaryStrong, fontWeight: '700', fontSize: 12 }}>
                {formatTypeLabel(content.type)} workspace
              </Text>
              <Text style={{ color: palette.text, fontWeight: '900', fontSize: 22, marginTop: 6 }}>{content.title}</Text>
              {content.partnerName ? <Text style={{ color: palette.subtext, marginTop: 4 }}>{content.partnerName}</Text> : null}
              {content.summary ? <Text style={{ color: palette.subtext, marginTop: 10, lineHeight: 20 }}>{content.summary}</Text> : null}
              {(content as any)?.detailLoading ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 }}>
                  <ActivityIndicator color={palette.primaryStrong} />
                  <Text style={{ color: palette.subtext }}>Loading full learner workspace…</Text>
                </View>
              ) : null}
              <View style={{ marginTop: 16 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text style={{ color: palette.text, fontWeight: '800' }}>Learning progress</Text>
                  <Text style={{ color: palette.primaryStrong, fontWeight: '800' }}>{progressPercent}%</Text>
                </View>
                <View style={{ height: 8, borderRadius: 999, backgroundColor: palette.divider }}>
                  <View
                    style={{
                      width: `${Math.max(3, Math.min(100, progressPercent || 3))}%`,
                      height: '100%',
                      borderRadius: 999,
                      backgroundColor: palette.primaryStrong,
                    }}
                  />
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                  <View style={{ borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: palette.surface }}>
                    <Text style={{ color: palette.text, fontSize: 12, fontWeight: '700' }}>{outline.length} module{outline.length === 1 ? '' : 's'}</Text>
                  </View>
                  <View style={{ borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: palette.surface }}>
                    <Text style={{ color: palette.text, fontSize: 12, fontWeight: '700' }}>{flatItems.length} learning item{flatItems.length === 1 ? '' : 's'}</Text>
                  </View>
                  <View style={{ borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: palette.surface }}>
                    <Text style={{ color: palette.text, fontSize: 12, fontWeight: '700' }}>{content.durationMinutes ?? 0} mins</Text>
                  </View>
                </View>
                <InsightsStrip palette={palette} insights={insightsState} />
                {certificateReady ? (
                  <View style={{ marginTop: 14, borderRadius: 18, padding: 14, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.divider }}>
                    <Text style={{ color: palette.text, fontWeight: '800' }}>Certificate unlocked</Text>
                    <Text style={{ color: palette.subtext, marginTop: 4, lineHeight: 19 }}>
                      {certificateIssuedAt ? `Issued ${formatDateTime(certificateIssuedAt)}.` : 'Your certificate is ready.'}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                      <KISButton title={certificateVisible ? 'Hide certificate' : 'View certificate'} size="sm" onPress={() => setCertificateVisible((value) => !value)} />
                      <KISButton title="Open PDF" size="sm" variant="outline" disabled={!certificateLocalUri} onPress={() => certificateLocalUri && Linking.openURL(certificateLocalUri)} />
                    </View>
                  </View>
                ) : null}
              </View>
            </View>

            <View style={{ marginTop: 18, borderRadius: 20, padding: 14, backgroundColor: palette.card, borderWidth: 1, borderColor: palette.divider }}>
              <Text style={{ color: palette.subtext, fontSize: 11, fontWeight: '700' }}>Learning path</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                {breadcrumbParts.map((part, index) => (
                  <View key={`${part}-${index}`} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 8 }}>
                    <View style={{ borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: index === breadcrumbParts.length - 1 ? palette.primarySoft : palette.surface, borderWidth: 1, borderColor: index === breadcrumbParts.length - 1 ? palette.primaryStrong : palette.divider }}>
                      <Text style={{ color: index === breadcrumbParts.length - 1 ? palette.primaryStrong : palette.text, fontSize: 12, fontWeight: '700' }}>{part}</Text>
                    </View>
                    {index < breadcrumbParts.length - 1 ? <Text style={{ color: palette.subtext, marginLeft: 8 }}>›</Text> : null}
                  </View>
                ))}
              </ScrollView>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
                {sectionChips.map((section) => {
                  const active = workspaceSection === section.key;
                  return (
                    <Pressable
                      key={section.key}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={`Open ${section.label} section`}
                      onPress={() => setWorkspaceSection(section.key as 'overview' | 'path' | 'current' | 'certificate')}
                      style={{
                        borderRadius: 999,
                        paddingHorizontal: 14,
                        paddingVertical: 9,
                        marginRight: 10,
                        borderWidth: 1,
                        borderColor: active ? palette.primaryStrong : palette.divider,
                        backgroundColor: active ? palette.primarySoft : palette.surface,
                      }}
                    >
                      <Text style={{ color: active ? palette.primaryStrong : palette.text, fontSize: 12, fontWeight: '800' }}>{section.label}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <Text style={{ color: palette.subtext, marginTop: 12, lineHeight: 18 }}>
                Start with Overview, move through Path, continue in the active lesson area, and collect or share your verified certificate when you finish.
              </Text>
            </View>

            {workspaceSection === 'path' && outline.length ? (
              <View style={{ marginTop: 18 }}>
                <Text style={{ color: palette.text, fontWeight: '800', marginBottom: 10 }}>Course path</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {outline.map((module, index) => {
                    const active = module.id === activeModule?.id;
                    return (
                      <Pressable
                        key={module.id}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={`Open module ${index + 1}: ${module.title}`}
                        onPress={() => setActiveModuleId(module.id)}
                        style={{
                          borderRadius: 18,
                          paddingHorizontal: 14,
                          paddingVertical: 10,
                          borderWidth: 1,
                          borderColor: active ? palette.primaryStrong : palette.divider,
                          backgroundColor: active ? palette.primarySoft : palette.surface,
                          marginRight: 10,
                          minWidth: 160,
                        }}
                      >
                        <Text style={{ color: active ? palette.primaryStrong : palette.subtext, fontSize: 11, fontWeight: '700' }}>Module {index + 1}</Text>
                        <Text style={{ color: palette.text, fontWeight: '800', marginTop: 4 }} numberOfLines={2}>{module.title}</Text>
                        <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 4 }}>{module.item_count ?? module.items?.length ?? 0} items</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            ) : null}

            {workspaceSection === 'path' && activeModule ? (
              <View style={{ marginTop: 18, borderRadius: 22, padding: 16, backgroundColor: palette.card, borderWidth: 1, borderColor: palette.divider }}>
                <Text style={{ color: palette.primaryStrong, fontWeight: '700', fontSize: 12 }}>{activeModule.title}</Text>
                {activeModule.summary ? <Text style={{ color: palette.subtext, marginTop: 6, lineHeight: 19 }}>{activeModule.summary}</Text> : null}
                <Text style={{ color: palette.subtext, marginTop: 8, fontSize: 12 }}>{activeModule.item_count ?? activeModuleItems.length} items · {activeModule.duration_minutes ?? 0} minutes</Text>
                <View style={{ marginTop: 14, gap: 10 }}>
                  {activeModuleItems.map((learningItem) => {
                    const isCurrent = (progressState?.currentItemId || selectedItem?.id) === learningItem.id;
                    const isDone = completedItemIds.has(learningItem.id);
                    return (
                      <Pressable
                        key={learningItem.id}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isCurrent, disabled: false }}
                        accessibilityLabel={`Open ${formatTypeLabel(learningItem.type)} ${learningItem.title}`}
                        onPress={() => {
                          setWorkspaceSection('current');
                          handleOpenItem(learningItem);
                        }}
                        style={{
                          borderRadius: 18,
                          borderWidth: 1,
                          borderColor: isCurrent ? palette.primaryStrong : palette.divider,
                          backgroundColor: isCurrent ? palette.primarySoft : palette.surface,
                          padding: 14,
                        }}
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={{ color: palette.primaryStrong, fontSize: 11, fontWeight: '700' }}>{formatTypeLabel(learningItem.type)}</Text>
                          <Text style={{ color: isDone ? palette.primaryStrong : palette.subtext, fontSize: 11, fontWeight: '700' }}>{isDone ? 'Completed' : isCurrent ? 'Current' : 'Pending'}</Text>
                        </View>
                        <Text style={{ color: palette.text, fontWeight: '800', marginTop: 6 }}>{learningItem.title}</Text>
                        {learningItem.summary ? <Text style={{ color: palette.subtext, marginTop: 4, lineHeight: 18 }}>{learningItem.summary}</Text> : null}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                          <Text style={{ color: palette.subtext, fontSize: 12 }}>{learningItem.duration_minutes ?? 0} mins</Text>
                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            <KISButton title="Open" size="xs" variant="outline" onPress={() => { setWorkspaceSection('current'); handleOpenItem(learningItem); }} />
                            {enrolled ? (
                              <KISButton title={isDone ? 'Done' : 'Mark done'} size="xs" variant={isDone ? 'secondary' : 'primary'} disabled={isDone || progressBusy} onPress={() => handleCompleteItem(learningItem)} />
                            ) : null}
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {workspaceSection === 'current' && selectedItem ? (
              <View style={{ marginTop: 18, borderRadius: 22, padding: 16, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.divider }}>
                <Text style={{ color: palette.primaryStrong, fontWeight: '700', fontSize: 12 }}>Now learning</Text>
                <Text style={{ color: palette.text, fontWeight: '900', fontSize: 18, marginTop: 6 }}>{selectedItem.title}</Text>
                <Text style={{ color: palette.subtext, marginTop: 4 }}>{formatTypeLabel(selectedItem.type)} · {selectedItem.duration_minutes ?? 0} mins</Text>
                {selectedItem.summary ? <Text style={{ color: palette.subtext, marginTop: 10, lineHeight: 20 }}>{selectedItem.summary}</Text> : null}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
                  <KISButton title={enrolled ? 'Set as current' : 'Preview'} size="sm" variant="outline" onPress={() => (enrolled ? handleOpenItem(selectedItem) : onPreview(content))} />
                  {enrolled && !completedItemIds.has(selectedItem.id) ? (
                    <KISButton title="Complete item" size="sm" onPress={() => handleCompleteItem(selectedItem)} disabled={progressBusy} />
                  ) : null}
                  {!enrolled ? <KISButton title="Enroll to continue" size="sm" onPress={() => onEnroll(content)} /> : null}
                </View>
                {nextItem ? (
                  <View style={{ marginTop: 14, borderRadius: 16, padding: 12, backgroundColor: palette.card, borderWidth: 1, borderColor: palette.divider }}>
                    <Text style={{ color: palette.primaryStrong, fontWeight: '700', fontSize: 12 }}>Next up</Text>
                    <Text style={{ color: palette.text, fontWeight: '800', marginTop: 4 }}>{nextItem.title}</Text>
                    <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 4 }}>{formatTypeLabel(nextItem.type)} · {nextItem.duration_minutes ?? 0} mins</Text>
                    <KISButton title="Go to next item" size="xs" variant="outline" onPress={() => handleOpenItem(nextItem)} style={{ marginTop: 10 }} />
                  </View>
                ) : null}
              </View>
            ) : null}

            {workspaceSection === 'current' ? renderConsumptionPanel() : null}
            {workspaceSection === 'current' && previewMaterial ? (
              <View style={{ marginTop: 18 }}>
                {renderMaterialViewer(previewMaterial, {
                  heading: 'Lesson material',
                  title: previewMaterial?.title || previewMaterial?.resource_name || 'Material',
                  summary: previewMaterial?.summary,
                })}
                <View style={{ marginTop: 10, flexDirection: 'row', justifyContent: 'flex-end' }}>
                  <KISButton title="Close material" size="sm" variant="secondary" onPress={() => setPreviewMaterial(null)} />
                </View>
              </View>
            ) : null}
            {workspaceSection === 'certificate' && certificateReady ? (
              <View style={{ marginTop: 18, borderRadius: 22, padding: 16, backgroundColor: palette.card, borderWidth: 1, borderColor: palette.divider }}>
                <Text style={{ color: palette.primaryStrong, fontWeight: '700', fontSize: 12 }}>Certificate preview</Text>
                <Text style={{ color: palette.text, fontWeight: '900', fontSize: 18, marginTop: 6 }}>{content.title}</Text>
                <Text style={{ color: palette.subtext, marginTop: 6 }}>
                  {certificateIssuedAt ? `Issued ${formatDateTime(certificateIssuedAt)}` : 'Certificate available'}
                </Text>
                {certificateId ? <Text style={{ color: palette.subtext, marginTop: 4 }}>Certificate ID: {certificateId}</Text> : null}
                <View style={{ marginTop: 14, height: 420, borderRadius: 18, overflow: 'hidden', backgroundColor: palette.surface }}>
                  {certificateLocalUri ? (
                    <Pdf
                      source={{ uri: certificateLocalUri }}
                      style={{ flex: 1 }}
                      onError={(error) => {
                        Alert.alert('Certificate', 'Unable to render certificate preview.');
                        console.log('education certificate preview error', error);
                      }}
                    />
                  ) : (
                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 }}>
                      {certificateLoading ? <ActivityIndicator color={palette.primaryStrong} /> : null}
                      <Text style={{ color: palette.subtext, marginTop: 12, textAlign: 'center' }}>
                        {certificateLoading ? 'Loading certificate preview…' : 'Open this tab again in a moment if the preview is still loading.'}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                  <KISButton title="Open PDF" size="sm" disabled={!certificateLocalUri} onPress={() => certificateLocalUri && Linking.openURL(certificateLocalUri)} />
                  <KISButton title="Share verification" size="sm" variant="outline" onPress={() => void handleShareCertificate()} />
                </View>
              </View>
            ) : null}

            {workspaceSection === 'overview' && (content as any)?.institutionSummary ? (
              <View style={{ marginTop: 18, borderRadius: 22, padding: 16, backgroundColor: palette.card, borderWidth: 1, borderColor: palette.divider }}>
                <Text style={{ color: palette.primaryStrong, fontWeight: '700', fontSize: 12 }}>Institution</Text>
                <Text style={{ color: palette.text, fontWeight: '900', fontSize: 18, marginTop: 6 }}>{(content as any).institutionSummary.name}</Text>
                {(content as any).institutionSummary.description ? (
                  <Text style={{ color: palette.subtext, marginTop: 8, lineHeight: 19 }}>{(content as any).institutionSummary.description}</Text>
                ) : null}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                  <Text style={{ color: palette.subtext, fontSize: 12 }}>{(content as any).institutionSummary.courseCount ?? 0} courses</Text>
                  <Text style={{ color: palette.subtext, fontSize: 12 }}>{(content as any).institutionSummary.programCount ?? 0} programs</Text>
                  <Text style={{ color: palette.subtext, fontSize: 12 }}>{(content as any).institutionSummary.memberCount ?? 0} members</Text>
                </View>
              </View>
            ) : null}
            {workspaceSection === 'overview' && (content as any)?.trustSignals ? (
              <View style={{ marginTop: 18 }}>
                <Text style={{ color: palette.text, fontWeight: '800', marginBottom: 10 }}>What this includes</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                  {[
                    { label: 'Modules', value: String((content as any).trustSignals.moduleCount ?? 0) },
                    { label: 'Learning items', value: String((content as any).trustSignals.itemCount ?? 0) },
                    { label: 'Assessments', value: String((content as any).trustSignals.assessmentCount ?? 0) },
                    { label: 'Live sessions', value: String((content as any).trustSignals.liveSessionCount ?? 0) },
                    { label: 'Materials', value: String((content as any).trustSignals.materialCount ?? 0) },
                    { label: 'Learners', value: String((content as any).trustSignals.enrollmentCount ?? 0) },
                  ].map((card) => (
                    <View key={card.label} style={{ minWidth: 140, flexGrow: 1, borderRadius: 18, padding: 12, backgroundColor: palette.card, borderWidth: 1, borderColor: palette.divider }}>
                      <Text style={{ color: palette.subtext, fontSize: 11, fontWeight: '700' }}>{card.label}</Text>
                      <Text style={{ color: palette.text, fontWeight: '900', fontSize: 18, marginTop: 6 }}>{card.value}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
            {workspaceSection === 'overview' && Array.isArray((content as any)?.instructors) && (content as any).instructors.length ? (
              <View style={{ marginTop: 18, borderRadius: 22, padding: 16, backgroundColor: palette.card, borderWidth: 1, borderColor: palette.divider }}>
                <Text style={{ color: palette.text, fontWeight: '800', marginBottom: 8 }}>Teaching team</Text>
                {(content as any).instructors.map((person: any) => (
                  <View key={person.id} style={{ marginBottom: 8 }}>
                    <Text style={{ color: palette.text, fontWeight: '700' }}>{person.name}</Text>
                    {person.role ? <Text style={{ color: palette.subtext, marginTop: 2 }}>{person.role}</Text> : null}
                  </View>
                ))}
              </View>
            ) : null}
            {workspaceSection === 'overview' ? renderOutcomes((content as EducationCourse).outcomes) : null}
            {workspaceSection === 'overview' ? renderRequirements((content as EducationCourse).requirements) : null}
            {workspaceSection === 'overview' && Array.isArray((content as any)?.faqs) && (content as any).faqs.length ? (
              <View style={{ marginTop: 18 }}>
                <Text style={{ color: palette.text, fontWeight: '800', marginBottom: 8 }}>FAQs</Text>
                {(content as any).faqs.map((faq: any, index: number) => (
                  <View key={`${faq.question}-${index}`} style={{ marginBottom: 12 }}>
                    <Text style={{ color: palette.text, fontWeight: '700' }}>{faq.question}</Text>
                    <Text style={{ color: palette.subtext, marginTop: 4, lineHeight: 19 }}>{faq.answer}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </ScrollView>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, gap: 10 }}>
            <KISButton title="Close" variant="secondary" onPress={onClose} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <KISButton title="Preview" size="sm" variant="outline" onPress={() => onPreview(content)} />
              <KISButton title={footerPrimaryTitle} size="sm" onPress={() => (enrolled ? handleOpenItem(selectedItem || flatItems[0]) : onEnroll(content))} disabled={progressBusy || (enrolled && !selectedItem && flatItems.length === 0)} />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
