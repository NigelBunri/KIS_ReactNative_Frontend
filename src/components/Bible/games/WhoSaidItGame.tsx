// src/components/Bible/games/WhoSaidItGame.tsx
//
// "Who Said It" — identify the speaker or narrator of a line. Every verse
// in the stage is run through speakerDetection.ts's detectSpeech heuristic;
// verses where it finds no attribution pattern are simply skipped (an
// expected, common outcome, not an error). Up to 8 rounds are built from
// however many were detected — same graceful degradation every
// partition-driven game uses. If a stage contains NO detectable speech at
// all (a real possibility — e.g. a stage sitting entirely inside Leviticus
// law code), a friendly one-line empty state is shown instead of a broken
// or blank round.
//
// Distractor speakers always come from OTHER speakers detected in this same
// stage first; the small fixed fallback pool only pads remaining slots when
// the stage genuinely doesn't have 3 real alternatives of its own.

import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import GameShell from './GameShell';
import { AnswerFeedback, StageComplete } from './GameFeedback';
import { getVerseText } from '../../../screens/tabs/bible/games/verseText';
import { detectSpeech } from '../../../screens/tabs/bible/games/speakerDetection';
import {
  finishStage,
  getStageVerses,
  STAGES_PER_GAME,
  type StageOutcome,
  type VerseRef,
} from '../../../screens/tabs/bible/games/gameStorage';
import { GAME_METADATA } from '../../../screens/tabs/bible/games/gameMetadata';
import type { GameScreenProps } from '../../../screens/tabs/bible/games/gameScreenTypes';

const ROUND_LENGTH = 8;
// Documented fixed fallback pool — only used to pad distractor slots when a
// stage genuinely doesn't have 3 other detected speakers of its own.
const FALLBACK_SPEAKERS = ['Jesus', 'Moses', 'Paul', 'Peter', 'David', 'the LORD', 'Isaiah', 'John'];

function verseId(ref: VerseRef): string {
  return `${ref.bookName}-${ref.chapter}-${ref.verse}`;
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

type DetectedRound = { quote: string; speaker: string; id: string };

function buildDetectedRounds(stageVerses: VerseRef[]): DetectedRound[] {
  const results: DetectedRound[] = [];
  for (const v of stageVerses) {
    const text = getVerseText(v.bookName, v.chapter, v.verse);
    if (!text) continue;
    const detected = detectSpeech(text);
    if (!detected) continue;
    results.push({ quote: detected.quote, speaker: detected.speaker, id: verseId(v) });
  }
  return results;
}

type Round = {
  quote: string;
  speaker: string;
  options: string[];
  correctIndex: number;
};

function buildOptions(correctSpeaker: string, allDetected: DetectedRound[]): string[] {
  const otherSpeakers = Array.from(new Set(allDetected.map((d) => d.speaker).filter((s) => s !== correctSpeaker)));
  const distractors = shuffle(otherSpeakers).slice(0, 3);
  const used = new Set([correctSpeaker, ...distractors]);
  for (const candidate of FALLBACK_SPEAKERS) {
    if (distractors.length >= 3) break;
    if (used.has(candidate)) continue;
    distractors.push(candidate);
    used.add(candidate);
  }
  return shuffle([correctSpeaker, ...distractors]);
}

function buildRound(item: DetectedRound, allDetected: DetectedRound[]): Round {
  const options = buildOptions(item.speaker, allDetected);
  return { quote: item.quote, speaker: item.speaker, options, correctIndex: options.indexOf(item.speaker) };
}

export default function WhoSaidItGame({ gameKey, stageIndex, isReplay, onExit, onOpenStats }: GameScreenProps) {
  const { palette } = useKISTheme();
  const meta = GAME_METADATA[gameKey];
  const [stageVerses, setStageVerses] = useState<VerseRef[] | null>(null);
  const [detected, setDetected] = useState<DetectedRound[]>([]);
  const [roundIndex, setRoundIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [stageResult, setStageResult] = useState<StageOutcome | null>(null);

  useEffect(() => {
    let active = true;
    getStageVerses(gameKey, stageIndex).then((verses) => {
      if (!active) return;
      setStageVerses(verses);
      setDetected(shuffle(buildDetectedRounds(verses)).slice(0, ROUND_LENGTH));
    });
    return () => { active = false; };
  }, [gameKey, stageIndex]);

  const round = useMemo<Round | null>(() => {
    const item = detected[roundIndex];
    if (!item) return null;
    return buildRound(item, detected);
  }, [detected, roundIndex]);

  const handleSelect = (index: number) => {
    if (selectedIndex !== null || !round) return;
    setSelectedIndex(index);
    if (index === round.correctIndex) setScore((s) => s + 1);
  };

  const handleNext = async () => {
    const nextIndex = roundIndex + 1;
    if (nextIndex >= detected.length) {
      const outcome = await finishStage(gameKey, stageIndex, score); // score already reflects this round's point, set by handleSelect
      setStageResult(outcome);
      return;
    }
    setRoundIndex(nextIndex);
    setSelectedIndex(null);
  };

  if (stageResult) {
    return (
      <GameShell title={meta.title} onBack={onExit}>
        <View style={styles.centerFill}>
          <StageComplete
            gameTitle={meta.title}
            scoreLine={`${score} / ${detected.length} correct this stage`}
            stageNumber={stageIndex + 1}
            totalStages={STAGES_PER_GAME}
            isFinalStage={stageResult.isFinalStage}
            isReplay={!stageResult.isNewCompletion}
            onPlayAgain={() => {
              setStageResult(null);
              setRoundIndex(0);
              setScore(0);
              setSelectedIndex(null);
              getStageVerses(gameKey, stageIndex).then((verses) => {
                setStageVerses(verses);
                setDetected(shuffle(buildDetectedRounds(verses)).slice(0, ROUND_LENGTH));
              });
            }}
            onBackToJourney={onExit}
            onViewStats={onOpenStats}
          />
        </View>
      </GameShell>
    );
  }

  if (!stageVerses) {
    return (
      <GameShell title={meta.title} onBack={onExit}>
        <View style={styles.centerFill}><ActivityIndicator color={palette.primary} /></View>
      </GameShell>
    );
  }

  if (detected.length === 0) {
    return (
      <GameShell title={meta.title} onBack={onExit}>
        <View style={styles.centerFill}>
          <View style={[styles.emptyCard, { backgroundColor: palette.card }]}>
            <KISIcon name="users" size={30} color={palette.subtext} />
            <Text style={[styles.emptyText, { color: palette.subtext }]}>
              This stage doesn't have enough quoted speech to play a full round — try another stage.
            </Text>
            <Pressable onPress={onExit} style={[styles.actionBtn, { backgroundColor: palette.goldReadable, marginTop: 10 }]}>
              <Text style={[styles.actionBtnText, { color: palette.onGold }]}>Back to Journey</Text>
            </Pressable>
          </View>
        </View>
      </GameShell>
    );
  }

  if (!round) {
    return (
      <GameShell title={meta.title} onBack={onExit}>
        <View style={styles.centerFill}><ActivityIndicator color={palette.primary} /></View>
      </GameShell>
    );
  }

  return (
    <GameShell
      title={meta.title}
      subtitle={`${isReplay ? 'Replay · ' : ''}Line ${roundIndex + 1} of ${detected.length}`}
      onBack={onExit}
      rightStat={{ label: 'Score', value: score }}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.verseCard, { backgroundColor: palette.card }]}>
          <Text style={[styles.quoteText, { color: palette.text }]}>&ldquo;{round.quote}&rdquo;</Text>
        </View>

        <Text style={[styles.questionPrompt, { color: palette.text }]}>Who said this?</Text>

        <View style={styles.optionsWrap}>
          {round.options.map((option, index) => {
            const showState = selectedIndex !== null;
            const isSelected = selectedIndex === index;
            const isCorrectOption = index === round.correctIndex;
            return (
              <Pressable
                key={`${option}-${index}`}
                onPress={() => handleSelect(index)}
                disabled={selectedIndex !== null}
                style={[
                  styles.optionBtn,
                  {
                    backgroundColor: showState && isCorrectOption ? '#16a34a25' : showState && isSelected ? '#dc262625' : palette.selectedBg,
                    borderColor: showState && isCorrectOption ? '#16a34a' : showState && isSelected ? '#dc2626' : palette.goldReadable,
                  },
                ]}
              >
                <Text style={[styles.optionText, { color: palette.text }]}>{option}</Text>
              </Pressable>
            );
          })}
        </View>

        {selectedIndex !== null ? (
          <AnswerFeedback
            correct={selectedIndex === round.correctIndex}
            text={selectedIndex === round.correctIndex ? 'Correct!' : `It was ${round.speaker}.`}
          />
        ) : null}

        {selectedIndex !== null ? (
          <Pressable onPress={handleNext} style={[styles.actionBtn, { backgroundColor: palette.goldReadable }]}>
            <Text style={[styles.actionBtnText, { color: palette.onGold }]}>
              {roundIndex + 1 >= detected.length ? 'See Results' : 'Next Line'}
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </GameShell>
  );
}

const styles = StyleSheet.create({
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  scrollContent: { gap: 16, paddingBottom: 16 },
  verseCard: { borderRadius: 18, padding: 18, gap: 10, alignSelf: 'stretch' },
  quoteText: { fontSize: 18, fontWeight: '700', lineHeight: 26, fontStyle: 'italic' },
  questionPrompt: { fontSize: 16, fontWeight: '800', textAlign: 'center' },
  optionsWrap: { gap: 10 },
  optionBtn: { borderWidth: 1.5, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16 },
  optionText: { fontSize: 15, fontWeight: '800', textAlign: 'center' },
  actionBtn: { alignSelf: 'stretch', borderRadius: 999, paddingVertical: 15, alignItems: 'center' },
  actionBtnText: { fontSize: 15, fontWeight: '900' },
  emptyCard: { borderRadius: 20, padding: 24, alignItems: 'center', gap: 12, alignSelf: 'stretch' },
  emptyText: { fontSize: 14, fontWeight: '700', textAlign: 'center', lineHeight: 20 },
});
