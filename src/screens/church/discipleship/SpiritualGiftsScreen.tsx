import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import KISButton from '@/constants/KISButton';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'SpiritualGifts'>;

type QuestionOption = { value: string; label: string };
type Question = { id: string; question: string; options: QuestionOption[] };

type GiftResult = { gift: string; score: number; description: string };

const ASSESSMENT_QUESTIONS: Question[] = [
  { id: 'q1', question: 'I enjoy communicating God\'s message to large groups.', options: [{ value: '1', label: 'Rarely' }, { value: '2', label: 'Sometimes' }, { value: '3', label: 'Often' }, { value: '4', label: 'Always' }] },
  { id: 'q2', question: 'I find deep satisfaction in serving others practically.', options: [{ value: '1', label: 'Rarely' }, { value: '2', label: 'Sometimes' }, { value: '3', label: 'Often' }, { value: '4', label: 'Always' }] },
  { id: 'q3', question: 'I often feel led to pray for people and see results.', options: [{ value: '1', label: 'Rarely' }, { value: '2', label: 'Sometimes' }, { value: '3', label: 'Often' }, { value: '4', label: 'Always' }] },
  { id: 'q4', question: 'I excel at organizing people and projects.', options: [{ value: '1', label: 'Rarely' }, { value: '2', label: 'Sometimes' }, { value: '3', label: 'Often' }, { value: '4', label: 'Always' }] },
  { id: 'q5', question: 'Teaching complex spiritual truths feels natural to me.', options: [{ value: '1', label: 'Rarely' }, { value: '2', label: 'Sometimes' }, { value: '3', label: 'Often' }, { value: '4', label: 'Always' }] },
  { id: 'q6', question: 'I give generously even when it\'s a sacrifice.', options: [{ value: '1', label: 'Rarely' }, { value: '2', label: 'Sometimes' }, { value: '3', label: 'Often' }, { value: '4', label: 'Always' }] },
  { id: 'q7', question: 'I can discern when something is spiritually wrong in a situation.', options: [{ value: '1', label: 'Rarely' }, { value: '2', label: 'Sometimes' }, { value: '3', label: 'Often' }, { value: '4', label: 'Always' }] },
  { id: 'q8', question: 'I love mentoring and developing others\' faith.', options: [{ value: '1', label: 'Rarely' }, { value: '2', label: 'Sometimes' }, { value: '3', label: 'Often' }, { value: '4', label: 'Always' }] },
  { id: 'q9', question: 'Evangelism — sharing faith with strangers — feels exciting.', options: [{ value: '1', label: 'Rarely' }, { value: '2', label: 'Sometimes' }, { value: '3', label: 'Often' }, { value: '4', label: 'Always' }] },
  { id: 'q10', question: 'I am skilled at encouraging people who are struggling.', options: [{ value: '1', label: 'Rarely' }, { value: '2', label: 'Sometimes' }, { value: '3', label: 'Often' }, { value: '4', label: 'Always' }] },
  { id: 'q11', question: 'Hospitality and welcoming strangers comes naturally.', options: [{ value: '1', label: 'Rarely' }, { value: '2', label: 'Sometimes' }, { value: '3', label: 'Often' }, { value: '4', label: 'Always' }] },
  { id: 'q12', question: 'I have strong faith even in impossible-seeming situations.', options: [{ value: '1', label: 'Rarely' }, { value: '2', label: 'Sometimes' }, { value: '3', label: 'Often' }, { value: '4', label: 'Always' }] },
  { id: 'q13', question: 'I naturally take charge and lead teams.', options: [{ value: '1', label: 'Rarely' }, { value: '2', label: 'Sometimes' }, { value: '3', label: 'Often' }, { value: '4', label: 'Always' }] },
  { id: 'q14', question: 'I see God\'s hand in current events and trends.', options: [{ value: '1', label: 'Rarely' }, { value: '2', label: 'Sometimes' }, { value: '3', label: 'Often' }, { value: '4', label: 'Always' }] },
  { id: 'q15', question: 'I am drawn to care for the poor and marginalized.', options: [{ value: '1', label: 'Rarely' }, { value: '2', label: 'Sometimes' }, { value: '3', label: 'Often' }, { value: '4', label: 'Always' }] },
  { id: 'q16', question: 'I have received or practiced spiritual gifts like tongues or healing.', options: [{ value: '1', label: 'Rarely' }, { value: '2', label: 'Sometimes' }, { value: '3', label: 'Often' }, { value: '4', label: 'Always' }] },
  { id: 'q17', question: 'Writing, music or art expresses my faith powerfully.', options: [{ value: '1', label: 'Rarely' }, { value: '2', label: 'Sometimes' }, { value: '3', label: 'Often' }, { value: '4', label: 'Always' }] },
  { id: 'q18', question: 'I mediate conflict and bring peace between people.', options: [{ value: '1', label: 'Rarely' }, { value: '2', label: 'Sometimes' }, { value: '3', label: 'Often' }, { value: '4', label: 'Always' }] },
  { id: 'q19', question: 'Administration and detailed planning energize me.', options: [{ value: '1', label: 'Rarely' }, { value: '2', label: 'Sometimes' }, { value: '3', label: 'Often' }, { value: '4', label: 'Always' }] },
  { id: 'q20', question: 'Praying for healing — physically or emotionally — is important to me.', options: [{ value: '1', label: 'Rarely' }, { value: '2', label: 'Sometimes' }, { value: '3', label: 'Often' }, { value: '4', label: 'Always' }] },
];

export default function SpiritualGiftsScreen({ navigation }: Props) {
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const [started, setStarted] = useState(false);
  const [currentQ, setCurrentQ] = useState(0);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<GiftResult[] | null>(null);

  const styles = useMemo(() => makeStyles(palette, layout), [palette, layout]);

  const question = ASSESSMENT_QUESTIONS[currentQ];
  const totalQ = ASSESSMENT_QUESTIONS.length;
  const answered = Object.keys(responses).length;

  const handleSelect = useCallback((qId: string, value: string) => {
    setResponses(prev => ({ ...prev, [qId]: value }));
    if (currentQ < totalQ - 1) {
      setTimeout(() => setCurrentQ(c => c + 1), 300);
    }
  }, [currentQ, totalQ]);

  const handleSubmit = useCallback(async () => {
    if (answered < totalQ) {
      Alert.alert('Incomplete', 'Please answer all questions before submitting.');
      return;
    }
    setSubmitting(true);
    try {
      const responsePayload = Object.entries(responses).map(([question_id, value]) => ({
        question_id,
        value: parseInt(value, 10),
      }));
      const res = await postRequest(ROUTES.church.discipleshipGifts, { responses: responsePayload });
      if (res?.success) {
        setResults(res.data?.gifts ?? res.data ?? []);
      } else {
        Alert.alert('Error', 'Could not submit assessment.');
      }
    } catch {
      Alert.alert('Error', 'Network error.');
    } finally {
      setSubmitting(false);
    }
  }, [answered, totalQ, responses]);

  if (results) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.title}>Your Spiritual Gifts</Text>
          <Text style={styles.subtitle}>Based on your assessment responses</Text>
          {results.map((g, idx) => (
            <View key={idx} style={styles.giftResult}>
              <View style={styles.giftHeader}>
                <Text style={styles.giftName}>{g.gift}</Text>
                <Text style={styles.giftScore}>{g.score}%</Text>
              </View>
              <View style={styles.giftTrack}>
                <View style={[styles.giftBar, { width: `${g.score}%` as any }]} />
              </View>
              {g.description ? (
                <Text style={styles.giftDesc}>{g.description}</Text>
              ) : null}
            </View>
          ))}
          <KISButton
            title="Done"
            onPress={() => navigation.goBack()}
            style={styles.doneBtn}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!started) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.title}>Spiritual Gifts Assessment</Text>
          <View style={styles.introCard}>
            <Text style={styles.introText}>
              Discover your God-given spiritual gifts through this short assessment. Answer 20
              questions honestly to receive a personalised gift profile and understand how you can
              best serve your church community.
            </Text>
            <View style={styles.introStats}>
              <View style={styles.introStat}>
                <Text style={styles.introStatNum}>20</Text>
                <Text style={styles.introStatLabel}>Questions</Text>
              </View>
              <View style={styles.introStat}>
                <Text style={styles.introStatNum}>~5 min</Text>
                <Text style={styles.introStatLabel}>Duration</Text>
              </View>
              <View style={styles.introStat}>
                <Text style={styles.introStatNum}>7+</Text>
                <Text style={styles.introStatLabel}>Gift Categories</Text>
              </View>
            </View>
          </View>
          <KISButton
            title="Start Assessment"
            onPress={() => setStarted(true)}
            style={styles.startBtn}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${((currentQ + 1) / totalQ) * 100}%` as any }]} />
        </View>
        <Text style={styles.progressLabel}>{currentQ + 1} of {totalQ}</Text>

        <View style={styles.questionCard}>
          <Text style={styles.questionText}>{question.question}</Text>
          <View style={styles.optionsGrid}>
            {question.options.map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.optionBtn,
                  responses[question.id] === opt.value && styles.optionBtnSelected,
                ]}
                onPress={() => handleSelect(question.id, opt.value)}
                hitSlop={{ top: 4, bottom: 4 }}
              >
                <Text style={[
                  styles.optionText,
                  responses[question.id] === opt.value && styles.optionTextSelected,
                ]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.navRow}>
          {currentQ > 0 && (
            <KISButton
              title="Previous"
              variant="outline"
              size="sm"
              onPress={() => setCurrentQ(c => c - 1)}
              style={styles.navBtn}
            />
          )}
          {currentQ < totalQ - 1 ? (
            <KISButton
              title="Next"
              variant="secondary"
              size="sm"
              onPress={() => setCurrentQ(c => c + 1)}
              style={styles.navBtn}
              disabled={!responses[question.id]}
            />
          ) : (
            <KISButton
              title={submitting ? 'Submitting...' : 'Submit'}
              loading={submitting}
              disabled={submitting || answered < totalQ}
              onPress={handleSubmit}
              style={styles.navBtn}
            />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(palette: any, layout: any) {
  const sp = layout.pageGutter;
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: palette.bg, },
    scroll: { padding: sp, paddingBottom: 80 },
    title: { fontSize: 26, fontWeight: '700', color: palette.text, marginBottom: 6 },
    subtitle: { fontSize: 14, color: palette.subtext, marginBottom: 20 },
    introCard: {
      backgroundColor: palette.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.divider,
      marginBottom: 24,
    },
    introText: { fontSize: 15, color: palette.text, lineHeight: 22, marginBottom: 20 },
    introStats: { flexDirection: 'row', justifyContent: 'space-around' },
    introStat: { alignItems: 'center' },
    introStatNum: { fontSize: 22, fontWeight: '700', color: palette.primary },
    introStatLabel: { fontSize: 12, color: palette.subtext, marginTop: 4 },
    startBtn: { minHeight: 52 },
    progressBar: {
      height: 6,
      backgroundColor: palette.primarySoft,
      borderRadius: 3,
      overflow: 'hidden',
      marginBottom: 8,
    },
    progressFill: { height: 6, backgroundColor: palette.primary, borderRadius: 3 },
    progressLabel: { fontSize: 12, color: palette.subtext, marginBottom: 20, textAlign: 'right' },
    questionCard: {
      backgroundColor: palette.card,
      borderRadius: 16,
      padding: 20,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.divider,
      marginBottom: 20,
    },
    questionText: { fontSize: 17, fontWeight: '600', color: palette.text, marginBottom: 20, lineHeight: 24 },
    optionsGrid: { gap: 10 },
    optionBtn: {
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.divider,
      backgroundColor: palette.surface,
      minHeight: 48,
      justifyContent: 'center',
    },
    optionBtnSelected: { backgroundColor: palette.primary, borderColor: palette.primary },
    optionText: { fontSize: 15, color: palette.text, textAlign: 'center' },
    optionTextSelected: { color: palette.ivory, fontWeight: '600' },
    navRow: { flexDirection: 'row', gap: 12, justifyContent: 'flex-end' },
    navBtn: { minWidth: 100 },
    giftResult: {
      backgroundColor: palette.card,
      borderRadius: 12,
      padding: 14,
      marginBottom: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.divider,
    },
    giftHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    giftName: { fontSize: 15, fontWeight: '600', color: palette.text },
    giftScore: { fontSize: 15, fontWeight: '700', color: palette.primary },
    giftTrack: { height: 8, backgroundColor: palette.primarySoft, borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
    giftBar: { height: 8, backgroundColor: palette.primary, borderRadius: 4 },
    giftDesc: { fontSize: 13, color: palette.subtext, lineHeight: 18 },
    doneBtn: { marginTop: 8, minHeight: 52 },
  });
}
