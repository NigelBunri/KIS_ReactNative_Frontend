// src/components/Bible/TwelvePillarsPanel.tsx
//
// "Discipleship" tab — presents "The 12 Pillars of the Christian Faith" as a
// locked, sequential journey: 12 doctrines, each broken into 6 days (one per
// section of that doctrine's own teaching), each day sealed with its own
// MCQ test. Content is bundled (src/assets/bible/twelvePillars.json) and
// progress lives in AsyncStorage — entirely offline, same "fixed and
// offline" requirement as the Bible games (see discipleshipStorage.ts's
// docblock). Sharing progress to chat is the one network-touching action,
// same split games make (gameplay offline, sharing online).
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import BibleSectionCard from './BibleSectionCard';
import DayRoadmap, { type DayNode } from './discipleship/DayRoadmap';
import DiscipleshipReadAloudSheet from './discipleship/DiscipleshipReadAloudSheet';
import KISButton from '@/constants/KISButton';
import { KISIcon } from '@/constants/kisIcons';
import useBibleReadAloud from '@/screens/tabs/bible/useBibleReadAloud';
import type { BibleReaderPayload, BibleVerse } from '@/screens/tabs/bible/useBibleData';
import { useSocket } from '../../../SocketProvider';
import ShareToChatModal from '../broadcast/ShareToChatModal';
import { shareDiscipleshipStats } from './discipleshipShare';
import type { Chat } from '@/Module/ChatRoom/messagesUtils';
import type { BibleDiscipleshipStatsMessage } from '@/Module/ChatRoom/chatTypes';
import {
  getCourseTitle,
  getDoctrines,
  getIntroSeen,
  getJourneyDescriptors,
  getOverallStats,
  recordDayScore,
  setIntroSeen,
  shuffledChoices,
  type DoctrineContent,
  type DoctrineDescriptor,
  type GradableChoice,
  type OverallStats,
} from './discipleship/discipleshipStorage';

// Plain-language companion name for each doctrine's formal theological term
// (e.g. "Theology Proper" -> "God the Father") — display-only, doesn't touch
// the bundled content's own title field.
const DOCTRINE_COMMON_NAME: Record<number, string> = {
  1: 'God the Father',
  2: 'Jesus Christ',
  3: 'The Holy Spirit',
  4: 'Man and Woman',
  5: 'Sin',
  6: 'Salvation',
  7: 'Creation',
  8: 'The Church',
  9: 'The Last Things',
  10: 'Angels',
  11: 'Demons',
  12: 'Spiritual Warfare',
};

const doctrineTitle = (order: number, title: string): string => {
  const common = DOCTRINE_COMMON_NAME[order];
  return common ? `Pillar ${order}: ${title} (${common})` : `Pillar ${order}: ${title}`;
};

type ContentBlock = { kind: 'h2' | 'h3' | 'p'; text: string };
const parseContent = (content: string): ContentBlock[] => {
  const blocks: ContentBlock[] = [];
  const lines = (content || '').split('\n');
  let para: string[] = [];
  const flush = () => {
    const text = para.join(' ').trim();
    if (text) blocks.push({ kind: 'p', text });
    para = [];
  };
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('## ')) {
      flush();
      blocks.push({ kind: 'h2', text: trimmed.slice(3).trim() });
    } else if (trimmed.startsWith('### ')) {
      flush();
      blocks.push({ kind: 'h3', text: trimmed.slice(4).trim() });
    } else if (trimmed === '') {
      flush();
    } else {
      para.push(trimmed);
    }
  }
  flush();
  return blocks;
};

type ViewMode = 'intro' | 'steps' | 'days' | 'lesson' | 'quiz' | 'results';

type QuizResult = { score: number; total: number; passed: boolean };

export default function TwelvePillarsPanel() {
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const compact = responsive.isWatch || responsive.isCompactPhone;
  const { socket } = useSocket();

  const [mode, setMode] = useState<ViewMode>('intro');
  const [introChecked, setIntroChecked] = useState(false);

  const [descriptors, setDescriptors] = useState<DoctrineDescriptor[]>([]);
  const [stats, setStats] = useState<OverallStats | null>(null);
  const doctrineContent = useMemo<DoctrineContent[]>(() => getDoctrines(), []);
  const courseTitle = useMemo(() => getCourseTitle(), []);

  const [activeDoctrineOrder, setActiveDoctrineOrder] = useState<number | null>(null);
  const [activeDayIndex, setActiveDayIndex] = useState<number | null>(null);

  const [quizChoices, setQuizChoices] = useState<GradableChoice[][]>([]);
  const [answers, setAnswers] = useState<Record<number, number>>({}); // questionIndex -> chosen originalIndex
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<QuizResult | null>(null);

  const [shareVisible, setShareVisible] = useState(false);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    getIntroSeen().then(seen => {
      setMode(seen ? 'steps' : 'intro');
      setIntroChecked(true);
    });
  }, []);

  const dismissIntro = () => {
    setIntroSeen();
    setMode('steps');
  };

  const refresh = useCallback(async () => {
    const [nextDescriptors, nextStats] = await Promise.all([getJourneyDescriptors(), getOverallStats()]);
    setDescriptors(nextDescriptors);
    setStats(nextStats);
  }, []);

  useEffect(() => {
    if (introChecked) refresh();
  }, [introChecked, refresh]);

  const activeDoctrineDescriptor = useMemo(
    () => descriptors.find(d => d.order === activeDoctrineOrder) ?? null,
    [descriptors, activeDoctrineOrder],
  );
  const activeDoctrineContent = useMemo(
    () => doctrineContent.find(d => d.order === activeDoctrineOrder) ?? null,
    [doctrineContent, activeDoctrineOrder],
  );
  const activeDayContent =
    activeDoctrineContent && activeDayIndex != null ? activeDoctrineContent.days[activeDayIndex] : null;
  const activeDayDescriptor =
    activeDoctrineDescriptor && activeDayIndex != null ? activeDoctrineDescriptor.days[activeDayIndex] : null;

  // "Listen" — reuses useBibleReadAloud's own on-device TTS engine
  // wiring (play/pause/stop platform quirks, speed persistence) instead
  // of a parallel implementation. It's built around verse-by-verse
  // BibleReaderPayload/BibleVerse shapes, so each parsed content block
  // (heading or paragraph) stands in for one "verse" - the hook doesn't
  // care that the text isn't Scripture, only that verses[].text exists.
  // navigation.next is always empty here, so a finished reading just
  // stops (no cross-day auto-continue, unlike the Bible's cross-chapter
  // one - there's no "next" that would make sense to keep reading into).
  const readAloudBlocks = useMemo(
    () => parseContent(activeDayContent?.content || ''),
    [activeDayContent],
  );
  const readAloudVerses = useMemo<BibleVerse[]>(
    () => readAloudBlocks.map((b, i) => ({ id: `block-${i}`, number: i + 1, text: b.text })),
    [readAloudBlocks],
  );
  const readAloudReader = useMemo<BibleReaderPayload | null>(() => {
    if (!activeDayContent || activeDoctrineOrder == null || activeDayIndex == null) return null;
    return {
      book: { code: `discipleship-${activeDoctrineOrder}` } as any,
      chapter: { number: activeDayIndex + 1 } as any,
      navigation: { next: null },
      verses: readAloudVerses,
    };
  }, [activeDayContent, activeDoctrineOrder, activeDayIndex, readAloudVerses]);
  const readAloud = useBibleReadAloud({
    reader: readAloudReader,
    verses: readAloudVerses,
    onLoadChapter: () => {},
  });
  const [readAloudSheetOpen, setReadAloudSheetOpen] = useState(false);

  const openDoctrine = (order: number, locked: boolean) => {
    if (locked) return;
    setActiveDoctrineOrder(order);
    setMode('days');
  };

  const openDay = (dayIndex: number) => {
    if (!activeDoctrineDescriptor) return;
    if (activeDoctrineDescriptor.days[dayIndex]?.status === 'locked') return;
    setActiveDayIndex(dayIndex);
    setMode('lesson');
    setResult(null);
    setAnswers({});
  };

  const backToDays = async () => {
    if (activeDoctrineOrder == null) { setMode('steps'); return; }
    await refresh();
    setMode('days');
  };

  const backToSteps = async () => {
    setActiveDoctrineOrder(null);
    setActiveDayIndex(null);
    await refresh();
    setMode('steps');
  };

  const startTest = () => {
    if (!activeDayContent) return;
    setMode('quiz');
    setResult(null);
    setAnswers({});
    setQuizChoices(activeDayContent.questions.map(shuffledChoices));
  };

  const allAnswered =
    activeDayContent != null && activeDayContent.questions.every((_, qi) => answers[qi] != null);

  const submitQuiz = async () => {
    if (!activeDayContent || activeDoctrineOrder == null || activeDayIndex == null || !allAnswered) return;
    setSubmitting(true);
    const total = activeDayContent.questions.length;
    let score = 0;
    activeDayContent.questions.forEach((q, qi) => {
      const chosenOriginalIndex = answers[qi];
      if (q.choices[chosenOriginalIndex]?.isCorrect) score += 1;
    });
    const percent = Math.round((score / Math.max(1, total)) * 100);
    const passed = percent >= activeDayContent.passScore;
    await recordDayScore(activeDoctrineOrder, activeDayIndex, percent);
    setResult({ score, total, passed });
    if (passed) await refresh();
    setSubmitting(false);
  };

  const handleSharePicked = async (chat: Chat) => {
    setShareVisible(false);
    if (!stats) return;
    setSharing(true);
    const message: BibleDiscipleshipStatsMessage = {
      scope: 'overall',
      doctrinesCompleted: stats.doctrinesCompleted,
      totalDoctrines: stats.totalDoctrines,
      daysCompleted: stats.daysCompleted,
      totalDays: stats.totalDays,
      hasCertificate: stats.journeyComplete,
    };
    const res = await shareDiscipleshipStats(socket, chat, message);
    setSharing(false);
    if (!res.ok) Alert.alert('Share failed', res.error || 'Please try again.');
    else Alert.alert('Shared', `Discipleship progress shared to ${chat.name || 'chat'}.`);
  };

  const styles = useMemo(() => sheet(palette, compact), [palette, compact]);

  if (!introChecked) {
    return (
      <BibleSectionCard>
        <View style={styles.stateBox}>
          <ActivityIndicator color={palette.primaryStrong} />
        </View>
      </BibleSectionCard>
    );
  }

  // ── Intro / grounding message — reachable any time via the "About" icon
  // in the steps header, not just on first visit. ─────────────────────
  if (mode === 'intro') {
    return (
      <View style={styles.stack}>
        <BibleSectionCard>
          <View style={{ alignItems: 'center', gap: 14, paddingVertical: 8 }}>
            <View style={[styles.introBadge, { backgroundColor: palette.primarySoft }]}>
              <KISIcon name="shield-checkmark" size={30} color={palette.primaryStrong} />
            </View>
            <Text style={[styles.title, { color: palette.text, fontSize: compact ? 19 : 23, textAlign: 'center' }]}>
              Be grounded in the faith
            </Text>
            <Text style={{ color: palette.subtext, textAlign: 'center', lineHeight: 22, fontSize: 14 }}>
              This is a guided walk through the twelve foundational pillars of the Christian faith —
              God, Christ, the Spirit, man, sin, salvation, the church, and more — built to root you
              deeply, not water anything down.
            </Text>
            <Text style={{ color: palette.subtext, textAlign: 'center', lineHeight: 22, fontSize: 14 }}>
              Each pillar unfolds over six days of focused study, and each day ends with a short test.
              Score 70% or higher to move forward — you can't skip ahead, and you can always try again.
            </Text>
            <View style={[styles.introBanner, { backgroundColor: `${palette.gold}14`, borderColor: `${palette.gold}33` }]}>
              <KISIcon name="trophy" size={18} color={palette.gold} />
              <Text style={{ color: palette.gold, fontWeight: '800', flex: 1, lineHeight: 20 }}>
                Complete all twelve pillars to earn your Discipleship Badge.
              </Text>
            </View>
            <KISButton title={mode === 'intro' ? 'Begin the journey' : 'Continue'} onPress={dismissIntro} />
          </View>
        </BibleSectionCard>
      </View>
    );
  }

  if (!stats) {
    return (
      <BibleSectionCard>
        <View style={styles.stateBox}>
          <ActivityIndicator color={palette.primaryStrong} />
        </View>
      </BibleSectionCard>
    );
  }

  // ── Results / analysis ──────────────────────────────────────────────
  if (mode === 'results') {
    const overallPct = stats.totalDays ? Math.round((stats.daysCompleted / stats.totalDays) * 100) : 0;
    return (
      <View style={styles.stack}>
        <BibleSectionCard>
          <View style={styles.headerRow}>
            <KISButton title="Steps" size="xs" variant="outline" onPress={() => setMode('steps')} />
            <Text style={[styles.title, { color: palette.text, fontSize: compact ? 17 : 20, flex: 1 }]}>Your progress</Text>
          </View>
        </BibleSectionCard>

        <BibleSectionCard style={{ gap: 10 }}>
          <Text style={styles.cardLabel}>Pillars completed</Text>
          <Text style={[styles.bigNumber, { color: palette.text }]}>{stats.doctrinesCompleted} of {stats.totalDoctrines}</Text>
          <View style={[styles.progressTrack, { backgroundColor: palette.divider }]}>
            <View style={[styles.progressFill, { width: `${overallPct}%`, backgroundColor: palette.gold }]} />
          </View>
          <Text style={{ color: palette.subtext, fontSize: 12, fontWeight: '600' }}>
            {stats.daysCompleted} of {stats.totalDays} days · {overallPct}%
          </Text>
        </BibleSectionCard>

        <View style={{ gap: 8 }}>
          {descriptors.map(d => (
            <View key={d.order} style={[styles.doctrineRow, { borderColor: palette.divider, backgroundColor: palette.card }]}>
              <KISIcon
                name={d.status === 'completed' ? 'checkmark-circle' : d.status === 'locked' ? 'lock' : 'flame'}
                size={18}
                color={d.status === 'completed' ? palette.success : d.status === 'locked' ? palette.subtext : palette.gold}
              />
              <Text style={{ color: palette.text, fontWeight: '700', flex: 1 }} numberOfLines={1}>{doctrineTitle(d.order, d.title)}</Text>
              <Text style={{ color: palette.subtext, fontSize: 12, fontWeight: '700' }}>
                {d.days.filter(x => x.status === 'completed').length}/{d.days.length}
              </Text>
            </View>
          ))}
        </View>

        {stats.journeyComplete ? (
          <BibleSectionCard style={{ alignItems: 'center', gap: 10, paddingVertical: 18 }}>
            <View style={[styles.badgeCircle, { backgroundColor: palette.gold }]}>
              <KISIcon name="trophy" size={30} color={palette.royalInk} />
            </View>
            <Text style={{ color: palette.text, fontWeight: '900', fontSize: 17 }}>Discipleship Badge earned</Text>
            <Text style={{ color: palette.subtext, textAlign: 'center' }}>
              You've completed all twelve pillars — well done.
            </Text>
          </BibleSectionCard>
        ) : null}

        <BibleSectionCard>
          <KISButton
            title={sharing ? 'Sharing…' : 'Share progress to chat'}
            variant="outline"
            loading={sharing}
            disabled={sharing}
            onPress={() => setShareVisible(true)}
          />
        </BibleSectionCard>

        <ShareToChatModal visible={shareVisible} onClose={() => setShareVisible(false)} onPicked={handleSharePicked} />
      </View>
    );
  }

  // ── Quiz view ────────────────────────────────────────────────────────
  if (mode === 'quiz' && activeDayContent && activeDayDescriptor) {
    return (
      <View style={styles.stack}>
        <BibleSectionCard>
          <View style={styles.headerRow}>
            <KISButton title="Lesson" size="xs" variant="outline" onPress={() => setMode('lesson')} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: palette.text, fontSize: compact ? 17 : 20 }]}>
                {activeDayContent.title} — Test
              </Text>
              <Text style={{ color: palette.subtext, marginTop: 2 }}>
                Score {activeDayContent.passScore}% or higher to unlock the next day.
              </Text>
            </View>
          </View>
        </BibleSectionCard>

        <BibleSectionCard>
          <View style={{ gap: 18 }}>
            {activeDayContent.questions.map((q, qi) => (
              <View key={qi} style={{ gap: 8 }}>
                <Text style={{ color: palette.text, fontWeight: '800', lineHeight: 21 }}>
                  {qi + 1}. {q.prompt}
                </Text>
                {(quizChoices[qi] ?? []).map(choice => {
                  const selected = answers[qi] === choice.originalIndex;
                  return (
                    <TouchableOpacity
                      key={choice.originalIndex}
                      disabled={!!result}
                      onPress={() => setAnswers(prev => ({ ...prev, [qi]: choice.originalIndex }))}
                      style={[
                        styles.choice,
                        {
                          borderColor: selected ? palette.primaryStrong : palette.divider,
                          backgroundColor: selected ? palette.primarySoft : 'transparent',
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.radio,
                          { borderColor: selected ? palette.primaryStrong : palette.subtext },
                          selected && { backgroundColor: palette.primaryStrong },
                        ]}
                      />
                      <Text style={{ color: selected ? palette.primaryStrong : palette.text, flex: 1 }}>
                        {choice.text}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}

            {result ? (
              <View style={[styles.resultBanner, { backgroundColor: result.passed ? `${palette.success}20` : `${palette.danger}20` }]}>
                <KISIcon
                  name={result.passed ? 'checkmark-circle' : 'close-circle'}
                  size={22}
                  color={result.passed ? palette.success : palette.danger}
                />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: result.passed ? palette.success : palette.danger, fontWeight: '900', fontSize: 15 }}>
                    {result.passed ? 'Passed — next day unlocked' : 'Not passed yet'}
                  </Text>
                  <Text style={{ color: palette.subtext, marginTop: 2 }}>
                    {Math.round((result.score / Math.max(1, result.total)) * 100)}% ({result.score}/{result.total})
                  </Text>
                </View>
              </View>
            ) : null}

            {result ? (
              result.passed ? (
                <KISButton title="Continue the journey" onPress={backToDays} />
              ) : (
                <View style={styles.optionRow}>
                  <KISButton title="Try again" variant="outline" onPress={startTest} />
                  <KISButton title="Review lesson" variant="outline" onPress={() => setMode('lesson')} />
                </View>
              )
            ) : (
              <KISButton
                title={submitting ? 'Submitting…' : allAnswered ? 'Submit test' : `Answer all ${activeDayContent.questions.length} questions`}
                loading={submitting}
                disabled={submitting || !allAnswered}
                onPress={submitQuiz}
              />
            )}
          </View>
        </BibleSectionCard>
      </View>
    );
  }

  // ── Day content view ─────────────────────────────────────────────────
  if (mode === 'lesson' && activeDayContent && activeDoctrineContent && activeDayDescriptor && activeDayIndex != null) {
    return (
      <View style={styles.stack}>
        <BibleSectionCard>
          <View style={styles.headerRow}>
            <KISButton title="Days" size="xs" variant="outline" onPress={backToDays} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: palette.gold, fontWeight: '900', fontSize: 12, letterSpacing: 0.4 }}>
                PILLAR {activeDoctrineContent.order} · DAY {activeDayIndex + 1} OF {activeDoctrineContent.days.length}
              </Text>
              <Text style={[styles.title, { color: palette.text, fontSize: compact ? 18 : 21 }]}>{activeDayContent.title}</Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setReadAloudSheetOpen(true)}
              disabled={!readAloudVerses.length}
              accessibilityRole="button"
              accessibilityLabel={readAloud.status === 'playing' ? 'Reading aloud' : readAloud.status === 'paused' ? 'Paused' : 'Listen'}
              style={[
                styles.circleIconBtn,
                readAloud.isActive
                  ? { backgroundColor: palette.goldDeep, borderColor: palette.gold }
                  : { backgroundColor: palette.royalInk ?? palette.surface, borderColor: `${palette.gold}55` },
                { opacity: readAloudVerses.length ? 1 : 0.45 },
              ]}
            >
              <KISIcon name="volume" size={15} color={palette.ivory} />
            </TouchableOpacity>
            {activeDayDescriptor.status === 'completed' ? <KISIcon name="checkmark-circle" size={22} color={palette.success} /> : null}
          </View>
        </BibleSectionCard>

        <BibleSectionCard>
          <View style={{ gap: 12 }}>
            {readAloudBlocks.map((b, i) =>
              b.kind === 'h2' ? (
                <Text key={i} style={[styles.h2, { color: palette.primaryStrong }]}>{b.text}</Text>
              ) : b.kind === 'h3' ? (
                <Text key={i} style={[styles.h3, { color: palette.text }]}>{b.text}</Text>
              ) : (
                <Text key={i} style={[styles.copy, { color: palette.text }]}>{b.text}</Text>
              ),
            )}
          </View>
        </BibleSectionCard>

        <BibleSectionCard>
          <KISButton title={activeDayDescriptor.status === 'completed' ? 'Retake the test' : 'Take the test'} onPress={startTest} />
          {activeDayDescriptor.status !== 'completed' ? (
            <Text style={{ color: palette.subtext, marginTop: 8, textAlign: 'center' }}>
              You need {activeDayContent.passScore}% or higher to unlock the next day.
            </Text>
          ) : null}
        </BibleSectionCard>

        <DiscipleshipReadAloudSheet
          visible={readAloudSheetOpen}
          onClose={() => setReadAloudSheetOpen(false)}
          status={readAloud.status}
          finishReason={readAloud.finishReason}
          dayTitle={activeDayContent.title}
          elapsedMs={readAloud.elapsedMs}
          ttsReady={readAloud.ttsReady}
          errorMessage={readAloud.errorMessage}
          speed={readAloud.speed}
          onPlay={readAloud.play}
          onPause={readAloud.pause}
          onStop={readAloud.stop}
          onSetSpeed={readAloud.setSpeed}
        />
      </View>
    );
  }

  // ── Day roadmap for one doctrine ────────────────────────────────────
  if (mode === 'days' && activeDoctrineDescriptor) {
    const dayNodes: DayNode[] = activeDoctrineDescriptor.days.map((day, i) => ({
      index: i,
      label: `Day ${i + 1}`,
      status: day.status,
      scorePercent: day.scorePercent,
    }));
    const completedDays = activeDoctrineDescriptor.days.filter(d => d.status === 'completed').length;

    return (
      <View style={styles.stack}>
        <BibleSectionCard>
          <View style={styles.headerRow}>
            <KISButton title="Steps" size="xs" variant="outline" onPress={backToSteps} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: palette.text, fontSize: compact ? 16 : 19 }]}>
                {doctrineTitle(activeDoctrineDescriptor.order, activeDoctrineDescriptor.title)}
              </Text>
              <Text style={{ color: palette.subtext, marginTop: 3 }}>{activeDoctrineDescriptor.summary}</Text>
            </View>
          </View>
          <Text style={{ color: palette.subtext, marginTop: 10, fontSize: 12, fontWeight: '700' }}>
            {completedDays} of {activeDoctrineDescriptor.days.length} days complete
          </Text>
        </BibleSectionCard>

        <BibleSectionCard>
          <DayRoadmap days={dayNodes} onSelectDay={openDay} />
        </BibleSectionCard>
      </View>
    );
  }

  // ── Step list (12 doctrines) ────────────────────────────────────────
  const overallPct = stats.totalDays ? Math.round((stats.daysCompleted / stats.totalDays) * 100) : 0;
  return (
    <View style={styles.stack}>
      <BibleSectionCard>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: palette.text, fontSize: compact ? 18 : 22 }]}>{courseTitle}</Text>
            <Text style={{ color: palette.subtext, marginTop: 4 }}>
              Twelve pillars, unlocked in order as you complete each one.
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              onPress={() => setMode('intro')}
              accessibilityRole="button"
              accessibilityLabel="About this journey"
              style={[styles.iconBadge, { backgroundColor: palette.divider }]}
            >
              <KISIcon name="info" size={16} color={palette.subtext} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setMode('results')}
              style={[styles.badge, { backgroundColor: palette.primarySoft }]}
            >
              <KISIcon name="bar-chart" size={16} color={palette.primaryStrong} />
              <Text style={{ color: palette.primaryStrong, fontWeight: '900' }}>{stats.doctrinesCompleted}/{stats.totalDoctrines}</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.progressRow}>
          <View style={[styles.progressTrack, { backgroundColor: palette.divider }]}>
            <View style={[styles.progressFill, { width: `${overallPct}%`, backgroundColor: palette.primaryStrong }]} />
          </View>
          <Text style={{ color: palette.subtext }}>{overallPct}%</Text>
        </View>
      </BibleSectionCard>

      <View style={{ gap: 10 }}>
        {descriptors.map((d, idx) => {
          const locked = d.status === 'locked';
          const completed = d.status === 'completed';
          const isNext = !locked && !completed;
          const completedDays = d.days.filter(x => x.status === 'completed').length;
          return (
            <TouchableOpacity
              key={d.order}
              disabled={locked}
              onPress={() => openDoctrine(d.order, locked)}
              style={[
                styles.stepCard,
                {
                  borderColor: completed ? palette.success : isNext ? palette.primaryStrong : palette.divider,
                  backgroundColor: locked ? palette.surface : palette.card,
                  opacity: locked ? 0.55 : 1,
                },
              ]}
            >
              <View style={[styles.stepBadge, { backgroundColor: completed ? palette.success : isNext ? palette.primaryStrong : palette.divider }]}>
                {locked ? (
                  <KISIcon name="lock" size={16} color={palette.subtext} />
                ) : completed ? (
                  <KISIcon name="checkmark-circle" size={18} color={palette.ivory} />
                ) : (
                  <Text style={{ color: palette.royalInk, fontWeight: '900' }}>{d.order ?? idx + 1}</Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: palette.text, fontWeight: '900', fontSize: 15 }}>{doctrineTitle(d.order, d.title)}</Text>
                <Text style={{ color: palette.subtext, marginTop: 2 }} numberOfLines={2}>{d.summary}</Text>
                {!locked ? (
                  <Text style={{ color: palette.gold, marginTop: 3, fontSize: 11, fontWeight: '800' }}>
                    {completedDays}/{d.days.length} days
                  </Text>
                ) : null}
              </View>
              {!locked ? <KISIcon name="chevron-right" size={18} color={palette.subtext} /> : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const sheet = (palette: any, compact: boolean) =>
  StyleSheet.create({
    stack: { gap: 14, paddingBottom: 24 },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    circleIconBtn: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    title: { fontWeight: '900' },
    badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
    iconBadge: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
    progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
    progressTrack: { flex: 1, height: 7, borderRadius: 999, overflow: 'hidden' },
    progressFill: { height: 7, borderRadius: 999 },
    stateBox: { minHeight: 150, alignItems: 'center', justifyContent: 'center', gap: 10 },
    introBadge: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
    introBanner: { borderWidth: 1, borderRadius: 12, padding: 12, flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
    stepCard: { borderWidth: 2, borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
    stepBadge: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
    doctrineRow: { borderWidth: 1, borderRadius: 12, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
    cardLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, color: palette.subtext },
    bigNumber: { fontSize: 26, fontWeight: '900' },
    badgeCircle: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
    h2: { fontSize: compact ? 16 : 18, fontWeight: '900', marginTop: 4 },
    h3: { fontSize: compact ? 14 : 15, fontWeight: '800', marginTop: 2 },
    copy: { fontSize: 15, lineHeight: 24 },
    choice: { borderWidth: 2, borderRadius: 12, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 10 },
    radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2 },
    resultBanner: { borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
    optionRow: { flexDirection: 'row', gap: 10 },
  });
