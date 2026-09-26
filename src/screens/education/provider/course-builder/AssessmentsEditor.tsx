// src/screens/education/provider/course-builder/AssessmentsEditor.tsx
//
// Education UX v2, Phase 3 — real editor for a course's assessments,
// including MCQ questions and options, replacing the Assessments tab's
// "go use Curriculum" pointer. Calls the real backend question/option
// endpoints (apps/broadcasts/urls.py) via the route helpers added
// alongside this file — those endpoints already existed and were already
// exercised end-to-end against production during an earlier GO-account
// content-seeding pass; only the frontend route helpers were missing.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import KISButton from '@/constants/KISButton';
import KISTextInput from '@/constants/KISTextInput';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';

function FieldLabel({ children }: { children: React.ReactNode }) {
  const { palette } = useKISTheme();
  return <Text style={{ fontSize: 12, fontWeight: '700', color: palette.subtext, marginBottom: 4 }}>{children}</Text>;
}

type Props = { institutionId: string; courseId: string };

export default function AssessmentsEditor({ institutionId, courseId }: Props) {
  const { palette } = useKISTheme();
  const [assessments, setAssessments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [addingQuestion, setAddingQuestion] = useState(false);
  const [questionPrompt, setQuestionPrompt] = useState('');
  const [optionTexts, setOptionTexts] = useState<string[]>(['', '', '']);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [savingQuestion, setSavingQuestion] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getRequest(`${ROUTES.broadcasts.educationInstitutionAssessments(institutionId)}?course_id=${courseId}`, { forceNetwork: true });
      setAssessments(response?.data?.assessments ?? []);
    } finally {
      setLoading(false);
    }
  }, [institutionId, courseId]);

  useEffect(() => {
    load();
  }, [load]);

  const loadQuestions = useCallback(async (assessmentId: string) => {
    setLoadingQuestions(true);
    try {
      const response = await getRequest(ROUTES.broadcasts.educationInstitutionAssessmentQuestions(institutionId, assessmentId), { forceNetwork: true });
      setQuestions(response?.data?.questions ?? []);
    } finally {
      setLoadingQuestions(false);
    }
  }, [institutionId]);

  const openAssessment = (assessment: any) => {
    if (expandedId === assessment.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(assessment.id);
    void loadQuestions(assessment.id);
  };

  const createQuizAssessment = useCallback(async () => {
    const response = await postRequest(
      ROUTES.broadcasts.educationInstitutionAssessments(institutionId),
      { title: `Quiz ${assessments.length + 1}`, course_id: courseId, assessment_type: 'mcq', status: 'published' },
      { errorMessage: 'Unable to create quiz.' },
    );
    if (response?.success) await load();
  }, [institutionId, courseId, assessments.length, load]);

  const saveQuestion = useCallback(async () => {
    if (!expandedId) return;
    if (!questionPrompt.trim()) {
      Alert.alert('Question', 'Write the question prompt first.');
      return;
    }
    const filledOptions = optionTexts.filter(t => t.trim());
    if (filledOptions.length < 2) {
      Alert.alert('Question', 'Add at least 2 answer options.');
      return;
    }
    setSavingQuestion(true);
    try {
      const qRes = await postRequest(
        ROUTES.broadcasts.educationInstitutionAssessmentQuestions(institutionId, expandedId),
        { prompt: questionPrompt.trim(), question_type: 'mcq', question_order: questions.length + 1, points: 1, is_required: true },
        { errorMessage: 'Unable to save question.' },
      );
      if (!qRes?.success) {
        Alert.alert('Question', qRes?.message || 'Unable to save question.');
        return;
      }
      const questionId = qRes.data?.question?.id;
      for (let i = 0; i < optionTexts.length; i += 1) {
        const text = optionTexts[i].trim();
        if (!text) continue;
        await postRequest(
          ROUTES.broadcasts.educationInstitutionAssessmentOptions(institutionId, expandedId, questionId),
          { option_text: text, option_order: i + 1, is_correct: i === correctIndex },
          { errorMessage: 'Unable to save answer option.' },
        );
      }
      setAddingQuestion(false);
      setQuestionPrompt('');
      setOptionTexts(['', '', '']);
      setCorrectIndex(0);
      await loadQuestions(expandedId);
    } finally {
      setSavingQuestion(false);
    }
  }, [expandedId, questionPrompt, optionTexts, correctIndex, questions.length, institutionId, loadQuestions]);

  if (loading) {
    return <ActivityIndicator color={palette.primary} style={{ marginTop: 20 }} />;
  }

  return (
    <View style={{ gap: 16 }}>
      {assessments.length === 0 ? (
        <Text style={{ color: palette.subtext, fontSize: 13 }}>No quizzes yet.</Text>
      ) : null}
      {assessments.map(assessment => {
        const expanded = expandedId === assessment.id;
        return (
          <View key={assessment.id} style={{ gap: 10 }}>
            <Pressable
              onPress={() => openAssessment(assessment)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: expanded ? palette.primary : palette.border, backgroundColor: palette.surface }}
            >
              <KISIcon name="check" size={16} color={palette.primary} />
              <Text style={{ color: palette.text, fontWeight: '700', flex: 1 }} numberOfLines={1}>{assessment.title}</Text>
              <Text style={{ fontSize: 11, color: palette.subtext }}>{assessment.question_count ?? 0} questions</Text>
              <KISIcon name={expanded ? 'chevron-down' : 'chevron-right'} size={16} color={palette.subtext} />
            </Pressable>
            {expanded ? (
              <View style={{ gap: 10, paddingLeft: 12 }}>
                {loadingQuestions ? <ActivityIndicator color={palette.primary} /> : null}
                {questions.map((question, qIndex) => (
                  <View key={question.id} style={{ padding: 12, borderRadius: 12, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, gap: 6 }}>
                    <Text style={{ fontWeight: '700', color: palette.text }}>{qIndex + 1}. {question.prompt}</Text>
                    {(question.options ?? []).map((option: any) => (
                      <Text key={option.id} style={{ fontSize: 13, color: option.is_correct ? palette.primaryStrong : palette.subtext }}>
                        {option.is_correct ? '✓ ' : '· '}{option.option_text}
                      </Text>
                    ))}
                  </View>
                ))}
                {addingQuestion ? (
                  <View style={{ gap: 10, padding: 12, borderRadius: 12, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border }}>
                    <View>
                      <FieldLabel>Question</FieldLabel>
                      <KISTextInput value={questionPrompt} onChangeText={setQuestionPrompt} placeholder="e.g. What is..." />
                    </View>
                    <FieldLabel>Answer options — tap to mark correct</FieldLabel>
                    {optionTexts.map((text, i) => (
                      <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Pressable onPress={() => setCorrectIndex(i)} style={{ width: 24, alignItems: 'center' }}>
                          <KISIcon name="check" size={16} color={correctIndex === i ? palette.primary : palette.border} />
                        </Pressable>
                        <View style={{ flex: 1 }}>
                          <KISTextInput
                            value={text}
                            onChangeText={t => setOptionTexts(prev => prev.map((v, idx) => (idx === i ? t : v)))}
                            placeholder={`Option ${i + 1}`}
                          />
                        </View>
                      </View>
                    ))}
                    <KISButton title="+ Another option" size="sm" variant="ghost" onPress={() => setOptionTexts(prev => [...prev, ''])} />
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <KISButton title={savingQuestion ? 'Saving…' : 'Save question'} disabled={savingQuestion} loading={savingQuestion} onPress={() => void saveQuestion()} />
                      <KISButton title="Cancel" variant="secondary" disabled={savingQuestion} onPress={() => setAddingQuestion(false)} />
                    </View>
                  </View>
                ) : (
                  <KISButton title="+ Add question" size="sm" variant="outline" onPress={() => setAddingQuestion(true)} />
                )}
              </View>
            ) : null}
          </View>
        );
      })}
      <KISButton title="+ Create quiz" variant="outline" onPress={() => void createQuizAssessment()} />
    </View>
  );
}
