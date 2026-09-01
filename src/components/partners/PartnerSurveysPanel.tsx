// src/components/partners/PartnerSurveysPanel.tsx
//
// Feedback Hub & Surveys: admins build a survey (single/multiple choice,
// 1-5 rating, or open text questions), members respond once, admins view
// aggregated results. Backed by apps.partners.PartnerSurvey — a small,
// fully-Django survey model (not apps.surveys, an unrelated global
// social/gamified poll system with no partner scoping — see
// PartnerSurvey's model docstring).
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import styles from '@/components/partners/partnersStyles';
import { useKISTheme } from '@/theme/useTheme';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { patchRequest } from '@/network/patch';

type Props = {
  isOpen: boolean;
  panelWidth: number;
  panelTranslateX: Animated.Value;
  partnerId?: string | null;
  canManage?: boolean;
  onClose: () => void;
};

type QuestionType = 'single_choice' | 'multiple_choice' | 'rating' | 'text';
type Option = { id: string; label: string };
type Question = { id: number; text: string; question_type: QuestionType; options: Option[]; required: boolean; order: number };
type Survey = {
  id: string | number;
  title: string;
  description?: string;
  status: 'draft' | 'open' | 'closed';
  is_anonymous: boolean;
  question_count: number;
  response_count: number;
  has_responded: boolean;
  questions: Question[];
};
type ResultEntry = {
  question_id: number;
  text: string;
  question_type: QuestionType;
  response_count: number;
  choice_counts?: Record<string, number>;
  average_rating?: number | null;
  rating_count?: number;
  text_answers?: string[];
};

const inputStyle = (palette: any) => ({
  color: palette.text,
  borderColor: palette.borderMuted,
  borderWidth: 2,
  paddingHorizontal: 10,
  paddingVertical: 8,
  borderRadius: 10,
  marginTop: 8,
});

const typeLabel: Record<QuestionType, string> = {
  single_choice: 'Single choice',
  multiple_choice: 'Multiple choice',
  rating: 'Rating (1-5)',
  text: 'Open text',
};
const QUESTION_TYPES: QuestionType[] = ['single_choice', 'multiple_choice', 'rating', 'text'];
const statusLabel: Record<string, string> = { draft: 'Draft', open: 'Open', closed: 'Closed' };

let optionSeq = 0;

export default function PartnerSurveysPanel({ isOpen, panelWidth, panelTranslateX, partnerId, canManage, onClose }: Props) {
  const { palette } = useKISTheme();
  const [loading, setLoading] = useState(false);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [saving, setSaving] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [draftQuestions, setDraftQuestions] = useState<
    { text: string; question_type: QuestionType; options: Option[]; required: boolean }[]
  >([]);
  const [qText, setQText] = useState('');
  const [qType, setQType] = useState<QuestionType>('text');
  const [qOptionInput, setQOptionInput] = useState('');
  const [qOptions, setQOptions] = useState<Option[]>([]);

  const [selectedSurveyId, setSelectedSurveyId] = useState<string | number | null>(null);
  const [results, setResults] = useState<{ total_responses: number; questions: ResultEntry[] } | null>(null);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [answers, setAnswers] = useState<Record<number, any>>({});

  const backdropOpacity = panelTranslateX.interpolate({ inputRange: [0, panelWidth], outputRange: [1, 0], extrapolate: 'clamp' });

  const load = useCallback(async () => {
    if (!partnerId) return;
    const res = await getRequest(ROUTES.partners.surveys(partnerId), { errorMessage: 'Unable to load surveys.' });
    const payload = res?.data ?? [];
    setSurveys(Array.isArray(payload) ? payload : []);
  }, [partnerId]);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [isOpen, load]);

  const selectedSurvey = useMemo(
    () => surveys.find((s) => String(s.id) === String(selectedSurveyId)) ?? null,
    [surveys, selectedSurveyId],
  );

  const openSurvey = (survey: Survey) => {
    setSelectedSurveyId(survey.id);
    setShowResults(false);
    setResults(null);
    setAnswers({});
  };

  const addOption = () => {
    if (!qOptionInput.trim()) return;
    optionSeq += 1;
    setQOptions((prev) => [...prev, { id: `opt_${optionSeq}`, label: qOptionInput.trim() }]);
    setQOptionInput('');
  };

  const addQuestion = () => {
    if (!qText.trim()) {
      Alert.alert('Missing text', 'Enter the question text first.');
      return;
    }
    if ((qType === 'single_choice' || qType === 'multiple_choice') && qOptions.length < 2) {
      Alert.alert('Missing options', 'Add at least two options for a choice question.');
      return;
    }
    setDraftQuestions((prev) => [...prev, { text: qText.trim(), question_type: qType, options: qOptions, required: true }]);
    setQText('');
    setQType('text');
    setQOptions([]);
    setQOptionInput('');
  };

  const createSurvey = async (openImmediately: boolean) => {
    if (!partnerId || !newTitle.trim()) {
      Alert.alert('Missing info', 'Survey title is required.');
      return;
    }
    if (draftQuestions.length === 0) {
      Alert.alert('No questions', 'Add at least one question.');
      return;
    }
    setSaving(true);
    const res = await postRequest(
      ROUTES.partners.surveys(partnerId),
      {
        title: newTitle.trim(),
        description: newDescription.trim(),
        status: openImmediately ? 'open' : 'draft',
        questions: draftQuestions.map((q, index) => ({ ...q, order: index + 1 })),
      },
      { errorMessage: 'Unable to create survey.' },
    );
    setSaving(false);
    if (!res?.success) {
      Alert.alert('Failed', res?.message ?? 'Unable to create survey.');
      return;
    }
    setNewTitle('');
    setNewDescription('');
    setDraftQuestions([]);
    setShowCreate(false);
    load();
  };

  const changeStatus = async (survey: Survey, nextStatus: 'open' | 'closed') => {
    if (!partnerId) return;
    const res = await patchRequest(
      ROUTES.partners.surveyDetail(partnerId, String(survey.id)),
      { status: nextStatus },
      { errorMessage: 'Unable to update survey.' },
    );
    if (!res?.success) {
      Alert.alert('Failed', res?.message ?? 'Unable to update survey.');
      return;
    }
    load();
  };

  const deleteSurvey = (survey: Survey) => {
    if (!partnerId) return;
    Alert.alert('Delete survey?', `"${survey.title}" and all responses will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { deleteRequest } = await import('@/network/delete');
          const res = await deleteRequest(ROUTES.partners.surveyDetail(partnerId, String(survey.id)), {
            errorMessage: 'Unable to delete survey.',
          });
          if (!res?.success) {
            Alert.alert('Failed', res?.message ?? 'Unable to delete survey.');
            return;
          }
          setSelectedSurveyId(null);
          load();
        },
      },
    ]);
  };

  const loadResults = async () => {
    if (!partnerId || !selectedSurvey) return;
    setShowResults(true);
    setResultsLoading(true);
    const res = await getRequest(ROUTES.partners.surveyResults(partnerId, String(selectedSurvey.id)), {
      errorMessage: 'Unable to load results.',
    });
    setResults(res?.data ?? null);
    setResultsLoading(false);
  };

  const setAnswer = (questionId: number, value: any) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const toggleMultiChoice = (questionId: number, optionId: string) => {
    setAnswers((prev) => {
      const current: string[] = prev[questionId]?.choice_ids ?? [];
      const next = current.includes(optionId) ? current.filter((id) => id !== optionId) : [...current, optionId];
      return { ...prev, [questionId]: { choice_ids: next } };
    });
  };

  const submitResponse = async () => {
    if (!partnerId || !selectedSurvey) return;
    const missingRequired = selectedSurvey.questions.some((q) => q.required && answers[q.id] === undefined);
    if (missingRequired) {
      Alert.alert('Missing answers', 'Please answer all required questions.');
      return;
    }
    setSaving(true);
    const res = await postRequest(
      ROUTES.partners.surveyRespond(partnerId, String(selectedSurvey.id)),
      { answers: Object.entries(answers).map(([question, value]) => ({ question: Number(question), value })) },
      { errorMessage: 'Unable to submit response.' },
    );
    setSaving(false);
    if (!res?.success) {
      Alert.alert('Failed', res?.message ?? 'Unable to submit response.');
      return;
    }
    Alert.alert('Thank you', 'Your response has been recorded.');
    load();
  };

  if (!isOpen) return null;

  return (
    <View style={styles.settingsPanelOverlay} pointerEvents="box-none">
      <Animated.View style={[styles.settingsPanelBackdrop, { backgroundColor: palette.backdrop, opacity: backdropOpacity }]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          styles.settingsPanelContainer,
          { width: panelWidth, backgroundColor: palette.surfaceElevated, borderLeftColor: palette.divider, transform: [{ translateX: panelTranslateX }] },
        ]}
      >
        <View style={[styles.settingsPanelHeader, { borderBottomColor: palette.divider }]}>
          <Pressable
            onPress={() => (selectedSurveyId ? setSelectedSurveyId(null) : onClose())}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <Text style={{ color: palette.text, fontSize: 18 }}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingsPanelTitle, { color: palette.text }]}>
              {selectedSurvey ? selectedSurvey.title : 'Feedback Hub'}
            </Text>
            <Text style={[styles.settingsPanelDescription, { color: palette.subtext }]}>
              {selectedSurvey ? `${statusLabel[selectedSurvey.status]} · ${selectedSurvey.response_count} response${selectedSurvey.response_count === 1 ? '' : 's'}` : 'Structured feedback & surveys'}
            </Text>
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.settingsPanelBody} showsVerticalScrollIndicator={false}>
          {loading ? (
            <ActivityIndicator size="small" color={palette.primary} />
          ) : selectedSurvey ? (
            showResults ? (
              resultsLoading ? (
                <ActivityIndicator size="small" color={palette.primary} />
              ) : !results ? (
                <Text style={{ color: palette.subtext, fontSize: 13 }}>No results available.</Text>
              ) : (
                <>
                  <Text style={{ color: palette.text, fontSize: 14, fontWeight: '800', marginBottom: 12 }}>
                    {results.total_responses} total response{results.total_responses === 1 ? '' : 's'}
                  </Text>
                  {results.questions.map((q) => (
                    <View key={q.question_id} style={[styles.settingsFeatureRow, { borderColor: palette.borderMuted, backgroundColor: palette.surface, marginBottom: 8 }]}>
                      <Text style={[styles.settingsFeatureTitle, { color: palette.text }]}>{q.text}</Text>
                      {q.choice_counts ? (
                        Object.entries(q.choice_counts).map(([choiceId, count]) => (
                          <Text key={choiceId} style={{ color: palette.subtext, fontSize: 12, marginTop: 4 }}>{choiceId}: {count}</Text>
                        ))
                      ) : q.average_rating !== undefined ? (
                        <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 4 }}>
                          Average: {q.average_rating ?? '—'} ({q.rating_count} rating{q.rating_count === 1 ? '' : 's'})
                        </Text>
                      ) : (
                        (q.text_answers ?? []).map((a, idx) => (
                          <Text key={idx} style={{ color: palette.subtext, fontSize: 12, marginTop: 4 }}>“{a}”</Text>
                        ))
                      )}
                    </View>
                  ))}
                </>
              )
            ) : canManage ? (
              <>
                {selectedSurvey.description ? (
                  <Text style={{ color: palette.subtext, fontSize: 13, marginBottom: 16 }}>{selectedSurvey.description}</Text>
                ) : null}
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                  {selectedSurvey.status !== 'open' ? (
                    <Pressable onPress={() => changeStatus(selectedSurvey, 'open')} style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: palette.royalInk }}>
                      <Text style={{ color: palette.ivory, fontSize: 12, fontWeight: '700' }}>Open survey</Text>
                    </Pressable>
                  ) : (
                    <Pressable onPress={() => changeStatus(selectedSurvey, 'closed')} style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: palette.borderMuted }}>
                      <Text style={{ color: palette.text, fontSize: 12, fontWeight: '700' }}>Close survey</Text>
                    </Pressable>
                  )}
                  <Pressable onPress={loadResults} style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: palette.primary }}>
                    <Text style={{ color: palette.primary, fontSize: 12, fontWeight: '700' }}>View results</Text>
                  </Pressable>
                </View>
                <Text style={{ color: palette.text, fontSize: 14, fontWeight: '800', marginBottom: 8 }}>
                  Questions ({selectedSurvey.questions.length})
                </Text>
                {selectedSurvey.questions.map((q, index) => (
                  <View key={q.id} style={[styles.settingsFeatureRow, { borderColor: palette.borderMuted, backgroundColor: palette.surface, marginBottom: 8 }]}>
                    <Text style={[styles.settingsFeatureTitle, { color: palette.text }]}>{index + 1}. {q.text}</Text>
                    <Text style={{ color: palette.subtext, fontSize: 11, marginTop: 2 }}>{typeLabel[q.question_type]}{q.required ? ' · Required' : ''}</Text>
                  </View>
                ))}
                <Pressable onPress={() => deleteSurvey(selectedSurvey)} style={{ marginTop: 12 }}>
                  <Text style={{ color: palette.danger, fontSize: 13, fontWeight: '700' }}>Delete survey</Text>
                </Pressable>
              </>
            ) : selectedSurvey.has_responded ? (
              <Text style={{ color: palette.subtext, fontSize: 14, textAlign: 'center', marginTop: 40 }}>
                Thanks — you've already responded to this survey.
              </Text>
            ) : (
              <>
                {selectedSurvey.description ? (
                  <Text style={{ color: palette.subtext, fontSize: 13, marginBottom: 16 }}>{selectedSurvey.description}</Text>
                ) : null}
                {selectedSurvey.questions.map((q, index) => (
                  <View key={q.id} style={{ marginBottom: 20 }}>
                    <Text style={{ color: palette.text, fontSize: 13, fontWeight: '700', marginBottom: 8 }}>
                      {index + 1}. {q.text}{q.required ? ' *' : ''}
                    </Text>
                    {q.question_type === 'single_choice' ? (
                      <View style={{ gap: 6 }}>
                        {q.options.map((opt) => {
                          const selected = answers[q.id]?.choice_id === opt.id;
                          return (
                            <Pressable
                              key={opt.id}
                              onPress={() => setAnswer(q.id, { choice_id: opt.id })}
                              style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: selected ? palette.primary : palette.borderMuted }}
                            >
                              <Text style={{ color: selected ? palette.primary : palette.text, fontSize: 13 }}>{opt.label}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    ) : q.question_type === 'multiple_choice' ? (
                      <View style={{ gap: 6 }}>
                        {q.options.map((opt) => {
                          const selected = (answers[q.id]?.choice_ids ?? []).includes(opt.id);
                          return (
                            <Pressable
                              key={opt.id}
                              onPress={() => toggleMultiChoice(q.id, opt.id)}
                              style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: selected ? palette.primary : palette.borderMuted }}
                            >
                              <Text style={{ color: selected ? palette.primary : palette.text, fontSize: 13 }}>{selected ? '☑' : '☐'} {opt.label}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    ) : q.question_type === 'rating' ? (
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        {[1, 2, 3, 4, 5].map((n) => {
                          const selected = answers[q.id]?.value === n;
                          return (
                            <Pressable
                              key={n}
                              onPress={() => setAnswer(q.id, { value: n })}
                              style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: selected ? palette.primary : palette.borderMuted, backgroundColor: selected ? `${palette.primary}22` : palette.surface }}
                            >
                              <Text style={{ color: selected ? palette.primary : palette.text, fontWeight: '700' }}>{n}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    ) : (
                      <TextInput
                        value={answers[q.id]?.text ?? ''}
                        onChangeText={(v) => setAnswer(q.id, { text: v })}
                        placeholder="Your answer"
                        placeholderTextColor={palette.subtext}
                        multiline
                        style={[inputStyle(palette), { minHeight: 60, textAlignVertical: 'top', marginTop: 0 }]}
                      />
                    )}
                  </View>
                ))}
                <Pressable
                  onPress={submitResponse}
                  disabled={saving}
                  style={({ pressed }) => [{ paddingVertical: 10, borderRadius: 10, backgroundColor: palette.royalInk, alignItems: 'center', opacity: pressed || saving ? 0.7 : 1, marginBottom: 20 }]}
                >
                  <Text style={{ color: palette.ivory, fontWeight: '700' }}>{saving ? 'Submitting…' : 'Submit response'}</Text>
                </Pressable>
              </>
            )
          ) : (
            <>
              {canManage ? (
                <Pressable onPress={() => setShowCreate((v) => !v)}>
                  <Text style={{ color: palette.primary, fontSize: 13, fontWeight: '700', marginBottom: showCreate ? 8 : 12 }}>
                    {showCreate ? '− Cancel new survey' : '+ New survey'}
                  </Text>
                </Pressable>
              ) : null}
              {showCreate ? (
                <View style={{ marginBottom: 16 }}>
                  <TextInput value={newTitle} onChangeText={setNewTitle} placeholder="Survey title" placeholderTextColor={palette.subtext} style={[inputStyle(palette), { marginTop: 0 }]} />
                  <TextInput value={newDescription} onChangeText={setNewDescription} placeholder="Description (optional)" placeholderTextColor={palette.subtext} multiline style={[inputStyle(palette), { minHeight: 50, textAlignVertical: 'top' }]} />

                  <Text style={{ color: palette.text, fontSize: 13, fontWeight: '800', marginTop: 16, marginBottom: 8 }}>
                    Questions ({draftQuestions.length})
                  </Text>
                  {draftQuestions.map((q, index) => (
                    <View key={index} style={{ marginBottom: 6 }}>
                      <Text style={{ color: palette.text, fontSize: 12 }}>{index + 1}. {q.text} ({typeLabel[q.question_type]})</Text>
                    </View>
                  ))}

                  <TextInput value={qText} onChangeText={setQText} placeholder="New question text" placeholderTextColor={palette.subtext} style={[inputStyle(palette)]} />
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {QUESTION_TYPES.map((t) => {
                      const selected = qType === t;
                      return (
                        <Pressable
                          key={t}
                          onPress={() => setQType(t)}
                          style={{ paddingVertical: 5, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: selected ? palette.primary : palette.borderMuted }}
                        >
                          <Text style={{ color: selected ? palette.primary : palette.text, fontSize: 12 }}>{typeLabel[t]}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  {(qType === 'single_choice' || qType === 'multiple_choice') ? (
                    <>
                      <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                        <TextInput value={qOptionInput} onChangeText={setQOptionInput} placeholder="Option label" placeholderTextColor={palette.subtext} style={[inputStyle(palette), { flex: 1, marginTop: 0 }]} />
                        <Pressable onPress={addOption} style={{ paddingHorizontal: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.borderMuted }}>
                          <Text style={{ color: palette.text, fontWeight: '700' }}>Add</Text>
                        </Pressable>
                      </View>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                        {qOptions.map((opt) => (
                          <View key={opt.id} style={{ paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.borderMuted }}>
                            <Text style={{ color: palette.text, fontSize: 12 }}>{opt.label}</Text>
                          </View>
                        ))}
                      </View>
                    </>
                  ) : null}
                  <Pressable onPress={addQuestion} style={{ marginTop: 10, paddingVertical: 8, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: palette.primary }}>
                    <Text style={{ color: palette.primary, fontWeight: '700' }}>+ Add question to survey</Text>
                  </Pressable>

                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
                    <Pressable
                      onPress={() => createSurvey(false)}
                      disabled={saving}
                      style={({ pressed }) => [{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: palette.borderMuted, opacity: pressed || saving ? 0.7 : 1 }]}
                    >
                      <Text style={{ color: palette.text, fontWeight: '700' }}>Save as draft</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => createSurvey(true)}
                      disabled={saving}
                      style={({ pressed }) => [{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: palette.royalInk, opacity: pressed || saving ? 0.7 : 1 }]}
                    >
                      <Text style={{ color: palette.ivory, fontWeight: '700' }}>{saving ? 'Creating…' : 'Create & open'}</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}

              {surveys.length === 0 ? (
                <Text style={{ color: palette.subtext, fontSize: 13, textAlign: 'center', marginTop: 20 }}>No surveys yet.</Text>
              ) : (
                surveys.map((survey) => (
                  <Pressable
                    key={survey.id}
                    onPress={() => openSurvey(survey)}
                    style={[styles.settingsFeatureRow, { borderColor: palette.borderMuted, backgroundColor: palette.surface, marginBottom: 8 }]}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={[styles.settingsFeatureTitle, { color: palette.text }]} numberOfLines={1}>{survey.title}</Text>
                      <Text style={{ color: palette.subtext, fontSize: 11, fontWeight: '700' }}>{statusLabel[survey.status]}</Text>
                    </View>
                    <Text style={{ color: palette.subtext, fontSize: 11, marginTop: 4 }}>
                      {survey.question_count} question{survey.question_count === 1 ? '' : 's'}
                      {canManage ? ` · ${survey.response_count} response${survey.response_count === 1 ? '' : 's'}` : ''}
                      {!canManage && survey.has_responded ? ' · Responded' : ''}
                    </Text>
                  </Pressable>
                ))
              )}
            </>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}
