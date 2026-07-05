import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import LinearGradient from 'react-native-linear-gradient';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import KISButton from '@/constants/KISButton';
import { KISIcon } from '@/constants/kisIcons';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'MentalHealthHub'>;

type MoodTrend = { date: string; mood_score: number };

const EMOTION_TAGS = [
  { key: 'happy', label: 'Happy', icon: 'smile' },
  { key: 'sad', label: 'Sad', icon: 'heart' },
  { key: 'anxious', label: 'Anxious', icon: 'warning' },
  { key: 'peaceful', label: 'Peaceful', icon: 'sparkles' },
  { key: 'angry', label: 'Angry', icon: 'flame' },
  { key: 'grateful', label: 'Grateful', icon: 'gift' },
];

export default function MentalHealthScreen({ navigation }: Props) {
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const sp = layout.pageGutter;

  const [moodScore, setMoodScore] = useState(5);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [trends, setTrends] = useState<MoodTrend[]>([]);
  const [loadingTrends, setLoadingTrends] = useState(true);

  const fetchTrends = useCallback(async () => {
    setLoadingTrends(true);
    const res = await getRequest(ROUTES.healthExtended.moodTrends);
    if (res.success) {
      setTrends(Array.isArray(res.data?.results ?? res.data) ? (res.data?.results ?? res.data) : []);
    }
    setLoadingTrends(false);
  }, []);

  useFocusEffect(useCallback(() => { fetchTrends(); }, [fetchTrends]));

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmitMood = async () => {
    setSubmitting(true);
    const res = await postRequest(ROUTES.healthExtended.moodEntries, {
      mood_score: moodScore,
      emotion_tags: selectedTags,
      entry_date: new Date().toISOString().split('T')[0],
    });
    setSubmitting(false);
    if (res.success) {
      Alert.alert('Mood logged!', 'Your check-in has been recorded.');
      setSelectedTags([]);
      fetchTrends();
    } else {
      Alert.alert('Error', res.message || 'Failed to log mood.');
    }
  };

  const styles = makeStyles(palette, sp);

  const last7Trends = trends.slice(-7);
  const maxScore = 10;

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient
        colors={[palette.gradientStart, palette.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>Mental Health</Text>
        <Text style={styles.headerSub}>Check in with yourself daily</Text>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 80 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Mood Check-In */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>How are you feeling?</Text>

          {/* Slider (1-10) */}
          <Text style={styles.scoreDisplay}>{moodScore}/10</Text>
          <View style={styles.sliderRow}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <TouchableOpacity
                key={n}
                onPress={() => setMoodScore(n)}
                style={[
                  styles.scoreBtn,
                  moodScore === n && styles.scoreBtnActive,
                ]}
                hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
              >
                <Text style={[
                  styles.scoreBtnText,
                  moodScore === n && styles.scoreBtnTextActive,
                ]}>
                  {n}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Emotion Tags */}
          <Text style={styles.tagLabel}>Select emotions:</Text>
          <View style={styles.tagsRow}>
            {EMOTION_TAGS.map((e) => (
              <TouchableOpacity
                key={e.key}
                style={[
                  styles.emotionTag,
                  selectedTags.includes(e.key) && styles.emotionTagActive,
                ]}
                onPress={() => toggleTag(e.key)}
                hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              >
                <KISIcon
                  name={e.icon as any}
                  size={16}
                  color={selectedTags.includes(e.key) ? palette.primary : palette.subtext}
                />
                <Text style={[
                  styles.emotionText,
                  selectedTags.includes(e.key) && styles.emotionTextActive,
                ]}>
                  {e.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <KISButton
            title="Submit Check-In"
            variant="primary"
            size="md"
            loading={submitting}
            onPress={handleSubmitMood}
          />
        </View>

        {/* 7-Day Mood Trend */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>7-Day Mood Trend</Text>
          {loadingTrends ? (
            <ActivityIndicator color={palette.primary} />
          ) : last7Trends.length === 0 ? (
            <Text style={styles.emptyText}>No mood data yet. Start checking in!</Text>
          ) : (
            <View style={styles.chartContainer}>
              {last7Trends.map((t, i) => {
                const barHeight = Math.max(4, (t.mood_score / maxScore) * 80);
                const barColor = t.mood_score >= 7 ? palette.primary : t.mood_score >= 4 ? palette.gold : palette.danger;
                return (
                  <View key={i} style={styles.barColumn}>
                    <View style={[styles.bar, { height: barHeight, backgroundColor: barColor }]} />
                    <Text style={styles.barLabel}>{t.mood_score}</Text>
                    <Text style={styles.barDate}>
                      {new Date(t.date).toLocaleDateString('en', { weekday: 'short' }).slice(0, 1)}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Quick Links */}
        <Text style={styles.sectionTitle}>Resources</Text>
        <View style={styles.linksGrid}>
          <TouchableOpacity
            style={styles.linkCard}
            onPress={() => navigation.navigate('TelemedicineHub')}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          >
            <KISIcon name="video" size={24} color={palette.primary} />
            <Text style={styles.linkText}>Talk to Therapist</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.linkCard}
            onPress={() => navigation.navigate('MoodJournal')}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          >
            <KISIcon name="document" size={24} color={palette.primary} />
            <Text style={styles.linkText}>My Journal</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.linkCard}
            onPress={() => navigation.navigate('CrisisResources')}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          >
            <KISIcon name="warning" size={24} color={palette.danger} />
            <Text style={[styles.linkText, { color: palette.danger }]}>Crisis Resources</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(palette: any, sp: number) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: palette.bg, marginTop: 25 },
    header: {
      paddingHorizontal: sp,
      paddingTop: 16,
      paddingBottom: 20,
    },
    headerTitle: { fontSize: 26, fontWeight: '700', color: palette.ivory },
    headerSub: { fontSize: 14, color: palette.ivory, opacity: 0.8, marginTop: 2 },
    content: { padding: sp, gap: 16 },
    card: {
      backgroundColor: palette.card,
      borderRadius: 14,
      padding: 16,
      borderWidth: 1,
      borderColor: palette.divider,
      gap: 12,
    },
    cardTitle: { fontSize: 16, fontWeight: '600', color: palette.text },
    scoreDisplay: {
      fontSize: 36,
      fontWeight: '700',
      color: palette.primary,
      textAlign: 'center',
    },
    sliderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 4,
    },
    scoreBtn: {
      flex: 1,
      minHeight: 36,
      borderRadius: 8,
      backgroundColor: palette.surface,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: palette.divider,
    },
    scoreBtnActive: {
      backgroundColor: palette.primarySoft,
      borderColor: palette.primary,
    },
    scoreBtnText: { fontSize: 12, color: palette.subtext, fontWeight: '500' },
    scoreBtnTextActive: { color: palette.primary, fontWeight: '700' },
    tagLabel: { fontSize: 13, color: palette.subtext },
    tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    emotionTag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.divider,
      minHeight: 36,
    },
    emotionTagActive: {
      backgroundColor: palette.primarySoft,
      borderColor: palette.primary,
    },
    emotionText: { fontSize: 13, color: palette.subtext },
    emotionTextActive: { color: palette.primary, fontWeight: '600' },
    chartContainer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 8,
      height: 110,
    },
    barColumn: {
      flex: 1,
      alignItems: 'center',
      gap: 4,
      justifyContent: 'flex-end',
    },
    bar: { width: '80%', borderRadius: 4, minHeight: 4 },
    barLabel: { fontSize: 10, color: palette.subtext },
    barDate: { fontSize: 10, color: palette.subtext },
    emptyText: { color: palette.subtext, textAlign: 'center', fontSize: 13 },
    sectionTitle: { fontSize: 16, fontWeight: '600', color: palette.text },
    linksGrid: { flexDirection: 'row', gap: 10 },
    linkCard: {
      flex: 1,
      backgroundColor: palette.card,
      borderRadius: 14,
      padding: 16,
      alignItems: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: palette.divider,
      minHeight: 80,
      justifyContent: 'center',
    },
    linkText: { fontSize: 12, color: palette.text, textAlign: 'center', fontWeight: '500' },
  });
}
