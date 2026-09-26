// src/screens/education/provider/course-builder/AssessmentsEditor.tsx
//
// Education UX v2, Phase 3 (+ hardening pass) — real editor for a course's
// assessments: questions of all 4 backend-supported types (MCQ, True/False,
// Short Answer, Essay) and reordering. Calls the real backend
// question/option endpoints (apps/broadcasts/urls.py) via the route
// helpers added alongside this file — those endpoints already existed and
// were already exercised end-to-end against production during an earlier
// GO-account content-seeding pass; only the frontend route helpers were
// missing.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import KISButton from '@/constants/KISButton';
import KISTextInput from '@/constants/KISTextInput';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { patchRequest } from '@/network/patch';

function FieldLabel({ children }: { children: React.ReactNode }) {
  const { palette } = useKISTheme();
  return <Text style={{ fontSize: 12, fontWeight: '700', color: palette.subtext, marginBottom: 4 }}>{children}</Text>;
}

const QUESTION_TYPES: Array<{ key: string; title: string }> = [
  { key: 'mcq', title: 'Multiple choice' },
  { key: 'true_false', title: 'True / False' },
  { key: 'short_answer', title: 'Short answer' },
  { key: 'essay', title: 'Essay' },
];

type Props = { institutionId: string; courseId: string };

export default function AssessmentsEditor({ institutionId, courseId }: Props) {
  const { palette } = useKISTheme();
  const [assessments, setAssessments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [addingQuestion, setAddingQuestion] = useState(false);
  const [questionType, setQuestionType] = useState('mcq');
  const [questionPrompt, setQuestionPrompt] = useState('');
  const [optionTexts, setOptionTexts] = useState<string[]>(['', '', '']);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [trueFalseCorrect, setTrueFalseCorrect] = useState<'true' | 'false'>('true');
  const [savingQuestion, setSavingQuestion] = useState(false);
  const [reorderingId, setReorderingId] = useState<string | null>(null);

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
      const rows = response?.data?.questions ?? [];
      rows.sort((a: any, b: any) => (a.question_order ?? 0) - (b.question_order ?? 0));
      setQuestions(rows);
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
      { title: `Quiz ${assessments.length + 1}`, course_id: courseId, assessment_type: 'mixed', status: 'published' },
      { errorMessage: 'Unable to create quiz.' },
    );
    if (response?.success) await load();
  }, [institutionId, courseId, assessments.length, load]);

  const resetQuestionForm = () => {
    setAddingQuestion(false);
    setQuestionType('mcq');
    setQuestionPrompt('');
    setOptionTexts(['', '', '']);
    setCorrectIndex(0);
    setTrueFalseCorrect('true');
  };

  const saveQuestion = useCallback(async () => {
    if (!expandedId) return;
    if (!questionPrompt.trim()) {
      Alert.alert('Question', 'Write the question prompt first.');
      return;
    }
    if (questionType === 'mcq') {
      const filledOptions = optionTexts.filter(t => t.trim());
      if (filledOptions.length < 2) {
        Alert.alert('Question', 'Add at least 2 answer options.');
        return;
      }
    }
    setSavingQuestion(true);
    try {
      const qRes = await postRequest(
        ROUTES.broadcasts.educationInstitutionAssessmentQuestions(institutionId, expandedId),
        { prompt: questionPrompt.trim(), question_type: questionType, question_order: questions.length + 1, points: 1, is_required: true },
        { errorMessage: 'Unable to save question.' },
      );
      if (!qRes?.success) {
        Alert.alert('Question', qRes?.message || 'Unable to save question.');
        return;
      }
      const questionId = qRes.data?.question?.id;
      if (questionType === 'mcq') {
        for (let i = 0; i < optionTexts.length; i += 1) {
          const text = optionTexts[i].trim();
          if (!text) continue;
          await postRequest(
            ROUTES.broadcasts.educationInstitutionAssessmentOptions(institutionId, expandedId, questionId),
            { option_text: text, option_order: i + 1, is_correct: i === correctIndex },
            { errorMessage: 'Unable to save answer option.' },
          );
        }
      } else if (questionType === 'true_false') {
        await postRequest(
          ROUTES.broadcasts.educationInstitutionAssessmentOptions(institutionId, expandedId, questionId),
          { option_text: 'True', option_order: 1, is_correct: trueFalseCorrect === 'true' },
          { errorMessage: 'Unable to save answer option.' },
        );
        await postRequest(
          ROUTES.broadcasts.educationInstitutionAssessmentOptions(institutionId, expandedId, questionId),
          { option_text: 'False', option_order: 2, is_correct: trueFalseCorrect === 'false' },
          { errorMessage: 'Unable to save answer option.' },
        );
      }
      // Short answer / essay: no options - the learner's answer_text is
      // graded outside the auto-scoring path, same as the backend's
      // EducationAssessmentType.THEORY handling.
      resetQuestionForm();
      await loadQuestions(expandedId);
    } finally {
      setSavingQuestion(false);
    }
  }, [expandedId, questionType, questionPrompt, optionTexts, correctIndex, trueFalseCorrect, questions.length, institutionId, loadQuestions]);

  const moveQuestion = useCallback(
    async (assessmentId: string, index: number, direction: -1 | 1) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= questions.length) return;
      const a = questions[index];
      const b = questions[targetIndex];
      setReorderingId(a.id);
      try {
        await Promise.all([
          patchRequest(ROUTES.broadcasts.educationInstitutionAssessmentQuestion(institutionId, assessmentId, a.id), { question_order: b.question_order ?? targetIndex + 1 }, { errorMessage: 'Unable to reorder.' }),
          patchRequest(ROUTES.broadcasts.educationInstitutionAssessmentQuestion(institutionId, assessmentId, b.id), { question_order: a.question_order ?? index + 1 }, { errorMessage: 'Unable to reorder.' }),
        ]);
        await loadQuestions(assessmentId);
      } finally {
        setReorderingId(null);
      }
    },
    [questions, institutionId, loadQuestions],
  );

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
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                      <Text style={{ fontWeight: '700', color: palette.text, flex: 1 }}>{qIndex + 1}. {question.prompt}</Text>
                      <View style={{ flexDirection: 'row', gap: 4 }}>
                        <Pressable disabled={qIndex === 0 || reorderingId === question.id} onPress={() => void moveQuestion(assessment.id, qIndex, -1)} style={{ padding: 4, opacity: qIndex === 0 ? 0.3 : 1 }}>
                          <KISIcon name="chevron-right" size={14} color={palette.subtext} style={{ transform: [{ rotate: '-90deg' }] } as any} />
                        </Pressable>
                        <Pressable disabled={qIndex === questions.length - 1 || reorderingId === question.id} onPress={() => void moveQuestion(assessment.id, qIndex, 1)} style={{ padding: 4, opacity: qIndex === questions.length - 1 ? 0.3 : 1 }}>
                          <KISIcon name="chevron-right" size={14} color={palette.subtext} style={{ transform: [{ rotate: '90deg' }] } as any} />
                        </Pressable>
                      </View>
                    </View>
                    <Text style={{ fontSize: 11, color: palette.subtext, textTransform: 'capitalize' }}>{String(question.question_type ?? 'mcq').replace('_', ' ')}</Text>
                    {(question.options ?? []).map((option: any) => (
                      <Text key={option.id} style={{ fontSize: 13, color: option.is_correct ? palette.primaryStrong : palette.subtext }}>
                        {option.is_correct ? '✓ ' : '· '}{option.option_text}
                      </Text>
                    ))}
                    {(question.question_type === 'short_answer' || question.question_type === 'essay') && (question.options ?? []).length === 0 ? (
                      <Text style={{ fontSize: 12, color: palette.subtext, fontStyle: 'italic' }}>Free-text answer — graded manually.</Text>
                    ) : null}
                  </View>
                ))}
                {addingQuestion ? (
                  <View style={{ gap: 10, padding: 12, borderRadius: 12, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border }}>
                    <FieldLabel>Question type</FieldLabel>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {QUESTION_TYPES.map(t => (
                        <Pressable
                          key={t.key}
                          onPress={() => setQuestionType(t.key)}
                          style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: questionType === t.key ? palette.primary : palette.border, backgroundColor: questionType === t.key ? palette.primarySoft : 'transparent' }}
                        >
                          <Text style={{ fontSize: 12, fontWeight: '700', color: questionType === t.key ? palette.primaryStrong : palette.subtext }}>{t.title}</Text>
                        </Pressable>
                      ))}
                    </View>
                    <View>
                      <FieldLabel>Question</FieldLabel>
                      <KISTextInput value={questionPrompt} onChangeText={setQuestionPrompt} placeholder="e.g. What is..." />
                    </View>
                    {questionType === 'mcq' ? (
                      <>
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
                      </>
                    ) : null}
                    {questionType === 'true_false' ? (
                      <View>
                        <FieldLabel>Correct answer</FieldLabel>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          {(['true', 'false'] as const).map(v => (
                            <Pressable
                              key={v}
                              onPress={() => setTrueFalseCorrect(v)}
                              style={{ flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, alignItems: 'center', borderColor: trueFalseCorrect === v ? palette.primary : palette.border, backgroundColor: trueFalseCorrect === v ? palette.primarySoft : 'transparent' }}
                            >
                              <Text style={{ fontWeight: '700', textTransform: 'capitalize', color: trueFalseCorrect === v ? palette.primaryStrong : palette.subtext }}>{v}</Text>
                            </Pressable>
                          ))}
                        </View>
                      </View>
                    ) : null}
                    {questionType === 'short_answer' || questionType === 'essay' ? (
                      <Text style={{ fontSize: 12, color: palette.subtext }}>
                        No answer options — learners type a free-text response you grade manually.
                      </Text>
                    ) : null}
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <KISButton title={savingQuestion ? 'Saving…' : 'Save question'} disabled={savingQuestion} loading={savingQuestion} onPress={() => void saveQuestion()} />
                      <KISButton title="Cancel" variant="secondary" disabled={savingQuestion} onPress={resetQuestionForm} />
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
