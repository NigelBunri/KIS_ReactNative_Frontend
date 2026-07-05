import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { patchRequest } from '@/network/patch';
import { deleteRequest } from '@/network/delete';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';

// ─── Types ────────────────────────────────────────────────────────────────────

type QuestionType = 'text' | 'multiple_choice' | 'rating' | 'yes_no';
const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'multiple_choice', label: 'Multiple Choice' },
  { value: 'rating', label: 'Rating' },
  { value: 'yes_no', label: 'Yes / No' },
];

type SurveyQuestion = {
  id: string;
  text?: string;
  question_text?: string;
  type?: QuestionType;
  question_type?: QuestionType;
  order?: number;
};

type SurveyItem = {
  id: string;
  title?: string;
  description?: string;
  question_count?: number;
  response_count?: number;
  created_at?: string;
  status?: string;
};

type SurveyResponse = {
  id: string;
  created_at?: string;
  respondent?: string;
  answers?: Record<string, any>;
};

// ─── Question text helper ─────────────────────────────────────────────────────

const qText = (q: SurveyQuestion) => q.text ?? q.question_text ?? `Question ${q.id}`;
const qType = (q: SurveyQuestion) => q.type ?? q.question_type ?? 'text';

// ─── Create Survey Modal ──────────────────────────────────────────────────────

type NewQuestion = { text: string; type: QuestionType };

function CreateSurveyModal({
  visible,
  onClose,
  onCreated,
  palette,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
  palette: any;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState<NewQuestion[]>([]);
  const [saving, setSaving] = useState(false);

  // Add-question mini-form
  const [addingQ, setAddingQ] = useState(false);
  const [qText_, setQText] = useState('');
  const [qType_, setQType] = useState<QuestionType>('text');

  const reset = () => {
    setTitle('');
    setDescription('');
    setQuestions([]);
    setAddingQ(false);
    setQText('');
    setQType('text');
  };

  const addQuestion = () => {
    if (!qText_.trim()) return;
    setQuestions(prev => [...prev, { text: qText_.trim(), type: qType_ }]);
    setQText('');
    setQType('text');
    setAddingQ(false);
  };

  const removeQuestion = (idx: number) => {
    setQuestions(prev => prev.filter((_, i) => i !== idx));
  };

  const save = async () => {
    if (!title.trim()) {
      Alert.alert('Missing title', 'Please enter a survey title.');
      return;
    }
    setSaving(true);
    try {
      const surveyRes = await postRequest(ROUTES.surveys.list, {
        title: title.trim(),
        description: description.trim() || undefined,
      });
      const surveyId = surveyRes?.data?.id;
      if (surveyId && questions.length > 0) {
        await Promise.allSettled(
          questions.map((q, i) =>
            postRequest(ROUTES.surveys.questions, {
              survey: surveyId,
              text: q.text,
              type: q.type,
              order: i + 1,
            }),
          ),
        );
      }
      reset();
      onCreated();
      onClose();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to create survey.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg, marginTop: 25 }}>
        <View style={[styles.modalHeader, { borderBottomColor: palette.divider }]}>
          <Text style={[styles.modalTitle, { color: palette.text }]}>Create Survey</Text>
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <Pressable onPress={() => { reset(); onClose(); }}>
              <Text style={{ color: palette.subtext, fontSize: 16 }}>Cancel</Text>
            </Pressable>
            <Pressable onPress={save} disabled={saving}>
              {saving
                ? <ActivityIndicator size="small" color={palette.primaryStrong} />
                : <Text style={{ color: palette.primaryStrong, fontWeight: '700', fontSize: 16 }}>Save</Text>
              }
            </Pressable>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
          <FieldLabel label="Title *" palette={palette} />
          <TextInput
            style={[styles.input, { backgroundColor: palette.surface, borderColor: palette.divider, color: palette.text }]}
            placeholder="Survey title"
            placeholderTextColor={palette.subtext}
            value={title}
            onChangeText={setTitle}
          />

          <FieldLabel label="Description" palette={palette} />
          <TextInput
            style={[styles.textArea, { backgroundColor: palette.surface, borderColor: palette.divider, color: palette.text }]}
            placeholder="Optional description"
            placeholderTextColor={palette.subtext}
            multiline
            numberOfLines={3}
            value={description}
            onChangeText={setDescription}
            textAlignVertical="top"
          />

          <Text style={[styles.sectionLabel, { color: palette.text }]}>
            Questions ({questions.length})
          </Text>

          {questions.map((q, i) => (
            <View key={i} style={[styles.qRow, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: palette.text, fontSize: 14, fontWeight: '600' }}>{q.text}</Text>
                <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 2 }}>{q.type}</Text>
              </View>
              <Pressable onPress={() => removeQuestion(i)} hitSlop={8}>
                <Text style={{ color: palette.danger, fontSize: 20 }}>×</Text>
              </Pressable>
            </View>
          ))}

          {addingQ ? (
            <View style={[styles.addQBox, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
              <TextInput
                style={[styles.input, { backgroundColor: palette.bg, marginTop: 25, borderColor: palette.divider, color: palette.text }]}
                placeholder="Question text"
                placeholderTextColor={palette.subtext}
                value={qText_}
                onChangeText={setQText}
                autoFocus
              />
              <Text style={[styles.fieldLabelSm, { color: palette.subtext }]}>Type</Text>
              <View style={styles.typesRow}>
                {QUESTION_TYPES.map(t => (
                  <Pressable
                    key={t.value}
                    onPress={() => setQType(t.value)}
                    style={[
                      styles.typeChip,
                      {
                        backgroundColor: qType_ === t.value ? palette.primaryStrong : palette.bg,
                        borderColor: qType_ === t.value ? palette.primaryStrong : palette.divider,
                      },
                    ]}
                  >
                    <Text style={{ color: qType_ === t.value ? palette.onPrimary : palette.subtext, fontSize: 12, fontWeight: '600' }}>
                      {t.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                <Pressable
                  onPress={() => { setAddingQ(false); setQText(''); setQType('text'); }}
                  style={[styles.halfBtn, { borderColor: palette.divider, backgroundColor: palette.bg, marginTop: 25 }]}
                >
                  <Text style={{ color: palette.subtext, fontWeight: '600' }}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={addQuestion}
                  style={[styles.halfBtn, { backgroundColor: palette.primaryStrong }]}
                >
                  <Text style={{ color: palette.onPrimary, fontWeight: '700' }}>Add</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              onPress={() => setAddingQ(true)}
              style={[styles.addQBtn, { borderColor: palette.divider, backgroundColor: palette.surface }]}
            >
              <Text style={{ color: palette.primaryStrong, fontWeight: '700' }}>+ Add Question</Text>
            </Pressable>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Survey Detail Sheet ──────────────────────────────────────────────────────

function SurveyDetailSheet({
  survey,
  onClose,
  onDeleted,
  onUpdated,
  palette,
}: {
  survey: SurveyItem | null;
  onClose: () => void;
  onDeleted: (id: string) => void;
  onUpdated: () => void;
  palette: any;
}) {
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [qLoading, setQLoading] = useState(false);
  const [rLoading, setRLoading] = useState(false);
  const [activeSection, setActiveSection] = useState<'questions' | 'responses'>('questions');

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [saving, setSaving] = useState(false);

  const [addingQ, setAddingQ] = useState(false);
  const [qTextNew, setQTextNew] = useState('');
  const [qTypeNew, setQTypeNew] = useState<QuestionType>('text');
  const [addingQBusy, setAddingQBusy] = useState(false);

  const loadQuestions = useCallback(async () => {
    if (!survey) return;
    setQLoading(true);
    try {
      const res = await getRequest(`${ROUTES.surveys.questions}?survey=${survey.id}`, {
        errorMessage: 'Unable to load questions.',
      });
      setQuestions(res.data?.results ?? res.data ?? []);
    } catch {
      setQuestions([]);
    } finally {
      setQLoading(false);
    }
  }, [survey]);

  const loadResponses = useCallback(async () => {
    if (!survey) return;
    setRLoading(true);
    try {
      const res = await getRequest(`${ROUTES.surveys.responses}?survey=${survey.id}`, {
        errorMessage: 'Unable to load responses.',
      });
      setResponses(res.data?.results ?? res.data ?? []);
    } catch {
      setResponses([]);
    } finally {
      setRLoading(false);
    }
  }, [survey]);

  useEffect(() => {
    if (survey) {
      setEditTitle(survey.title ?? '');
      setEditDesc(survey.description ?? '');
      setEditing(false);
      loadQuestions();
    }
  }, [survey, loadQuestions]);

  useEffect(() => {
    if (activeSection === 'responses') loadResponses();
  }, [activeSection, loadResponses]);

  const saveEdits = async () => {
    if (!survey) return;
    setSaving(true);
    try {
      await patchRequest(ROUTES.surveys.detail(survey.id), {
        title: editTitle.trim(),
        description: editDesc.trim() || undefined,
      });
      setEditing(false);
      onUpdated();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to update survey.');
    } finally {
      setSaving(false);
    }
  };

  const addQuestion = async () => {
    if (!survey || !qTextNew.trim()) return;
    setAddingQBusy(true);
    try {
      await postRequest(ROUTES.surveys.questions, {
        survey: survey.id,
        text: qTextNew.trim(),
        type: qTypeNew,
        order: questions.length + 1,
      });
      setQTextNew('');
      setQTypeNew('text');
      setAddingQ(false);
      loadQuestions();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to add question.');
    } finally {
      setAddingQBusy(false);
    }
  };

  const deleteQuestion = (q: SurveyQuestion) => {
    Alert.alert('Delete Question', `Delete "${qText(q)}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteRequest(ROUTES.surveys.question(q.id));
            setQuestions(prev => prev.filter(x => x.id !== q.id));
          } catch (e: any) {
            Alert.alert('Error', e?.message ?? 'Failed to delete question.');
          }
        },
      },
    ]);
  };

  const deleteSurvey = () => {
    if (!survey) return;
    Alert.alert('Delete Survey', `Delete "${survey.title ?? 'this survey'}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteRequest(ROUTES.surveys.detail(survey.id));
            onDeleted(survey.id);
            onClose();
          } catch (e: any) {
            Alert.alert('Error', e?.message ?? 'Failed to delete survey.');
          }
        },
      },
    ]);
  };

  if (!survey) return null;

  return (
    <Modal visible={!!survey} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg, marginTop: 25 }}>
        {/* Header */}
        <View style={[styles.modalHeader, { borderBottomColor: palette.divider }]}>
          {editing ? (
            <>
              <Text style={[styles.modalTitle, { color: palette.text }]}>Edit Survey</Text>
              <View style={{ flexDirection: 'row', gap: 14 }}>
                <Pressable onPress={() => setEditing(false)}>
                  <Text style={{ color: palette.subtext, fontSize: 15 }}>Cancel</Text>
                </Pressable>
                <Pressable onPress={saveEdits} disabled={saving}>
                  {saving
                    ? <ActivityIndicator size="small" color={palette.primaryStrong} />
                    : <Text style={{ color: palette.primaryStrong, fontWeight: '700', fontSize: 15 }}>Save</Text>
                  }
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <Text style={[styles.modalTitle, { color: palette.text }]} numberOfLines={1}>
                {survey.title ?? 'Survey'}
              </Text>
              <View style={{ flexDirection: 'row', gap: 14 }}>
                <Pressable onPress={() => setEditing(true)}>
                  <Text style={{ color: palette.primaryStrong, fontSize: 15 }}>Edit</Text>
                </Pressable>
                <Pressable onPress={deleteSurvey}>
                  <Text style={{ color: palette.danger, fontSize: 15 }}>Delete</Text>
                </Pressable>
                <Pressable onPress={onClose}>
                  <Text style={{ color: palette.subtext, fontSize: 15 }}>Close</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>

        {editing ? (
          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            <FieldLabel label="Title" palette={palette} />
            <TextInput
              style={[styles.input, { backgroundColor: palette.surface, borderColor: palette.divider, color: palette.text }]}
              value={editTitle}
              onChangeText={setEditTitle}
              placeholder="Survey title"
              placeholderTextColor={palette.subtext}
            />
            <FieldLabel label="Description" palette={palette} />
            <TextInput
              style={[styles.textArea, { backgroundColor: palette.surface, borderColor: palette.divider, color: palette.text }]}
              value={editDesc}
              onChangeText={setEditDesc}
              placeholder="Description"
              placeholderTextColor={palette.subtext}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </ScrollView>
        ) : (
          <>
            {/* Meta strip */}
            <View style={[styles.metaStrip, { backgroundColor: palette.surface, borderBottomColor: palette.divider }]}>
              <Text style={{ color: palette.subtext, fontSize: 13 }}>
                {survey.question_count ?? 0} questions · {survey.response_count ?? 0} responses
              </Text>
              {survey.status ? (
                <View style={[styles.capChip, { backgroundColor: palette.bg, marginTop: 25, borderColor: palette.divider }]}>
                  <Text style={{ fontSize: 11, color: palette.subtext }}>{survey.status}</Text>
                </View>
              ) : null}
            </View>

            {/* Section tabs */}
            <View style={[styles.sectionTabRow, { borderBottomColor: palette.divider }]}>
              {(['questions', 'responses'] as const).map(sec => (
                <Pressable
                  key={sec}
                  onPress={() => setActiveSection(sec)}
                  style={[
                    styles.sectionTab,
                    activeSection === sec && [styles.sectionTabActive, { borderBottomColor: palette.primaryStrong }],
                  ]}
                >
                  <Text style={[styles.sectionTabLabel, { color: activeSection === sec ? palette.primaryStrong : palette.subtext }]}>
                    {sec === 'questions' ? 'Questions' : 'Responses'}
                  </Text>
                </Pressable>
              ))}
            </View>

            {activeSection === 'questions' ? (
              <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
                {qLoading ? (
                  <ActivityIndicator color={palette.primaryStrong} style={{ marginVertical: 24 }} />
                ) : questions.length === 0 ? (
                  <Text style={{ color: palette.subtext, textAlign: 'center', marginVertical: 24 }}>
                    No questions yet.
                  </Text>
                ) : (
                  questions.map(q => (
                    <View key={q.id} style={[styles.qRow, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: palette.text, fontSize: 14, fontWeight: '600' }}>{qText(q)}</Text>
                        <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 2 }}>{qType(q)}</Text>
                      </View>
                      <Pressable onPress={() => deleteQuestion(q)} hitSlop={8}>
                        <Text style={{ color: palette.danger, fontSize: 20 }}>×</Text>
                      </Pressable>
                    </View>
                  ))
                )}

                {addingQ ? (
                  <View style={[styles.addQBox, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
                    <TextInput
                      style={[styles.input, { backgroundColor: palette.bg, marginTop: 25, borderColor: palette.divider, color: palette.text }]}
                      placeholder="Question text"
                      placeholderTextColor={palette.subtext}
                      value={qTextNew}
                      onChangeText={setQTextNew}
                      autoFocus
                    />
                    <Text style={[styles.fieldLabelSm, { color: palette.subtext }]}>Type</Text>
                    <View style={styles.typesRow}>
                      {QUESTION_TYPES.map(t => (
                        <Pressable
                          key={t.value}
                          onPress={() => setQTypeNew(t.value)}
                          style={[
                            styles.typeChip,
                            {
                              backgroundColor: qTypeNew === t.value ? palette.primaryStrong : palette.bg,
                              borderColor: qTypeNew === t.value ? palette.primaryStrong : palette.divider,
                            },
                          ]}
                        >
                          <Text style={{ color: qTypeNew === t.value ? palette.onPrimary : palette.subtext, fontSize: 12, fontWeight: '600' }}>
                            {t.label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                      <Pressable
                        onPress={() => { setAddingQ(false); setQTextNew(''); setQTypeNew('text'); }}
                        style={[styles.halfBtn, { borderColor: palette.divider, backgroundColor: palette.bg, marginTop: 25 }]}
                      >
                        <Text style={{ color: palette.subtext, fontWeight: '600' }}>Cancel</Text>
                      </Pressable>
                      <Pressable
                        onPress={addQuestion}
                        disabled={addingQBusy || !qTextNew.trim()}
                        style={[styles.halfBtn, { backgroundColor: palette.primaryStrong }]}
                      >
                        {addingQBusy
                          ? <ActivityIndicator size="small" color={palette.onPrimary} />
                          : <Text style={{ color: palette.onPrimary, fontWeight: '700' }}>Add</Text>
                        }
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Pressable
                    onPress={() => setAddingQ(true)}
                    style={[styles.addQBtn, { borderColor: palette.divider, backgroundColor: palette.surface }]}
                  >
                    <Text style={{ color: palette.primaryStrong, fontWeight: '700' }}>+ Add Question</Text>
                  </Pressable>
                )}
              </ScrollView>
            ) : (
              <ScrollView contentContainerStyle={styles.modalContent}>
                {rLoading ? (
                  <ActivityIndicator color={palette.primaryStrong} style={{ marginVertical: 24 }} />
                ) : responses.length === 0 ? (
                  <Text style={{ color: palette.subtext, textAlign: 'center', marginVertical: 24 }}>
                    No responses yet.
                  </Text>
                ) : (
                  responses.map(r => (
                    <View key={r.id} style={[styles.qRow, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: palette.text, fontSize: 13, fontWeight: '600' }}>
                          {r.respondent ?? `Response ${r.id}`}
                        </Text>
                        {r.created_at ? (
                          <Text style={{ color: palette.subtext, fontSize: 12 }}>
                            {new Date(r.created_at).toLocaleString()}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  ))
                )}
              </ScrollView>
            )}
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function FieldLabel({ label, palette }: { label: string; palette: any }) {
  return <Text style={[styles.fieldLabel, { color: palette.subtext }]}>{label}</Text>;
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function SurveyManagerScreen() {
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const [surveys, setSurveys] = useState<SurveyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SurveyItem | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await getRequest(ROUTES.surveys.list, { errorMessage: 'Unable to load surveys.' });
      setSurveys(res.data?.results ?? res.data ?? []);
    } catch (e: any) {
      setError(e?.message ?? 'Unable to load surveys.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg, marginTop: 25 }} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: palette.divider }]}>
        <Text style={[styles.screenTitle, { color: palette.text }]}>Survey Manager</Text>
        <Text style={[styles.screenSubtitle, { color: palette.subtext }]}>
          Create, edit, and review surveys and responses.
        </Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={palette.primaryStrong} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={{ color: palette.danger, textAlign: 'center' }}>{error}</Text>
          <Pressable onPress={() => load()} style={[styles.retryBtn, { backgroundColor: palette.primaryStrong }]}>
            <Text style={{ color: palette.onPrimary, fontWeight: '700' }}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={surveys}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={[styles.listContent, { paddingHorizontal: responsive.pageGutter }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={palette.primary} />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={{ color: palette.subtext }}>No surveys yet. Create one!</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => setSelected(item)}
              style={[styles.card, { backgroundColor: palette.card, borderColor: palette.divider }]}
            >
              <Text style={[styles.cardTitle, { color: palette.text }]} numberOfLines={2}>
                {item.title ?? 'Untitled Survey'}
              </Text>
              {item.description ? (
                <Text style={[styles.cardDesc, { color: palette.subtext }]} numberOfLines={2}>
                  {item.description}
                </Text>
              ) : null}
              <View style={styles.cardFooter}>
                <Text style={[styles.cardMeta, { color: palette.subtext }]}>
                  {item.question_count ?? 0} questions
                </Text>
                <Text style={[styles.cardMeta, { color: palette.subtext }]}>
                  {item.response_count ?? 0} responses
                </Text>
                {item.status ? (
                  <View style={[styles.capChip, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
                    <Text style={{ fontSize: 11, color: palette.subtext }}>{item.status}</Text>
                  </View>
                ) : null}
                {item.created_at ? (
                  <Text style={[styles.cardMeta, { color: palette.subtext }]}>
                    {new Date(item.created_at).toLocaleDateString()}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          )}
        />
      )}

      {/* FAB – Create */}
      <Pressable
        onPress={() => setShowCreate(true)}
        style={[styles.fab, { backgroundColor: palette.primaryStrong, shadowColor: palette.royalInk }]}
      >
        <Text style={[styles.fabText, { color: palette.onPrimary }]}>+ Create Survey</Text>
      </Pressable>

      {/* Create Modal */}
      <CreateSurveyModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => load()}
        palette={palette}
      />

      {/* Detail Sheet */}
      <SurveyDetailSheet
        survey={selected}
        onClose={() => setSelected(null)}
        onDeleted={id => setSurveys(prev => prev.filter(s => s.id !== id))}
        onUpdated={() => load()}
        palette={palette}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  screenTitle: { fontSize: 22, fontWeight: '800', marginBottom: 2 },
  screenSubtitle: { fontSize: 13 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },

  listContent: { padding: 16, gap: 12, paddingBottom: 100 },
  card: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  cardDesc: { fontSize: 13, lineHeight: 18 },
  cardMeta: { fontSize: 12 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },

  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 28,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 4,
  },
  fabText: { fontWeight: '700', fontSize: 14 },

  // Modal
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', flex: 1 },
  modalContent: { padding: 20, gap: 12, paddingBottom: 40 },

  metaStrip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },

  sectionTabRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sectionTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  sectionTabActive: {},
  sectionTabLabel: { fontSize: 13, fontWeight: '600' },

  sectionLabel: { fontSize: 15, fontWeight: '700' },

  input: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  textArea: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    fontSize: 14,
    minHeight: 80,
  },
  fieldLabel: { fontSize: 13, fontWeight: '600' },
  fieldLabelSm: { fontSize: 12, fontWeight: '600', marginTop: 4 },

  qRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
  },

  addQBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  addQBtn: {
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },

  typesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  typeChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },

  halfBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
  },

  capChip: { borderRadius: 6, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2 },
});
