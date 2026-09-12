// src/components/Bible/games/ListenAndTapGame.tsx
//
// "Listen & Tap" — on-device TTS speaks a verse aloud, the player taps
// which of 4 verse-text options matches what they heard. Audio-first
// framing (options stay hidden until the verse has been played at least
// once) fits the title, but this is never a dead end on a device without a
// working TTS engine — useBibleGameTts's `ready` flag being false just
// swaps the "tap Play" step for the verse text shown directly, same
// tap-the-matching-text mechanic either way.

import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, Pressable, ScrollView } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import GameShell from './GameShell';
import { AnswerFeedback, StageComplete } from './GameFeedback';
import { getVerseText } from '../../../screens/tabs/bible/games/verseText';
import { useBibleGameTts } from '../../../screens/tabs/bible/games/bibleGameTts';
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
const MAX_DISTRACTORS = 3;

function verseId(ref: VerseRef): string {
  return `${ref.bookName}-${ref.chapter}-${ref.verse}`;
}

function referenceOf(ref: VerseRef): string {
  return `${ref.bookName} ${ref.chapter}:${ref.verse}`;
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

type Round = {
  verse: VerseRef;
  text: string;
  options: string[]; // shuffled verse texts, including the correct one
};

/** Verses with real, non-empty bundled text — the only ones worth building a
 * round from. A verse missing from kjv.json is a content gap, never a crash. */
function withText(verses: VerseRef[]): VerseRef[] {
  return verses.filter((v) => getVerseText(v.bookName, v.chapter, v.verse).length > 0);
}

function buildRound(playable: VerseRef[], excludeIds: Set<string>): Round | null {
  if (!playable.length) return null;
  const notExcluded = playable.filter((v) => !excludeIds.has(verseId(v)));
  const source = notExcluded.length ? notExcluded : playable; // sparse stage: allow reuse rather than stall
  const verse = source[Math.floor(Math.random() * source.length)];
  const text = getVerseText(verse.bookName, verse.chapter, verse.verse);

  const distractorPool = shuffle(playable.filter((v) => verseId(v) !== verseId(verse)));
  const seenTexts = new Set([text]);
  const distractors: string[] = [];
  for (const v of distractorPool) {
    if (distractors.length >= MAX_DISTRACTORS) break;
    const t = getVerseText(v.bookName, v.chapter, v.verse);
    if (t && !seenTexts.has(t)) {
      seenTexts.add(t);
      distractors.push(t);
    }
  }
  const options = shuffle([text, ...distractors]);
  return { verse, text, options };
}

export default function ListenAndTapGame({ gameKey, stageIndex, isReplay, onExit, onOpenStats }: GameScreenProps) {
  const { palette } = useKISTheme();
  const meta = GAME_METADATA[gameKey];
  const tts = useBibleGameTts();

  const [playable, setPlayable] = useState<VerseRef[] | null>(null);
  const [roundIndex, setRoundIndex] = useState(0);
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  const [round, setRound] = useState<Round | null>(null);
  const [hasPlayed, setHasPlayed] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [stageResult, setStageResult] = useState<StageOutcome | null>(null);

  useEffect(() => {
    let active = true;
    getStageVerses(gameKey, stageIndex).then((verses) => {
      if (!active) return;
      setPlayable(withText(verses));
    });
    return () => { active = false; };
  }, [gameKey, stageIndex]);

  const startRound = useCallback((source: VerseRef[], exclude: Set<string>) => {
    const next = buildRound(source, exclude);
    setRound(next);
    setHasPlayed(!tts.ready); // no audio to wait on — text is shown immediately
    setSelected(null);
  }, [tts.ready]);

  useEffect(() => {
    if (playable && !round) startRound(playable, seenIds);
  }, [playable, round, seenIds, startRound]);

  const handlePlay = () => {
    if (!round || tts.status === 'speaking') return;
    tts.speak(round.text, () => setHasPlayed(true));
  };

  const handleSelect = (option: string) => {
    if (!round || selected !== null) return;
    setSelected(option);
    if (option === round.text) setScore((s) => s + 1);
  };

  const handleNext = async () => {
    if (!round || !playable) return;
    const nextSeen = new Set(seenIds).add(verseId(round.verse));
    setSeenIds(nextSeen);
    const nextIndex = roundIndex + 1;
    if (nextIndex >= ROUND_LENGTH) {
      setRoundIndex(nextIndex);
      const outcome = await finishStage(gameKey, stageIndex, score);
      setStageResult(outcome);
      return;
    }
    setRoundIndex(nextIndex);
    startRound(playable, nextSeen);
  };

  if (stageResult) {
    return (
      <GameShell title={meta.title} onBack={onExit}>
        <View style={styles.centerFill}>
          <StageComplete
            gameTitle={meta.title}
            scoreLine={`${score} / ${ROUND_LENGTH} correct this stage`}
            stageNumber={stageIndex + 1}
            totalStages={STAGES_PER_GAME}
            isFinalStage={stageResult.isFinalStage}
            isReplay={!stageResult.isNewCompletion}
            onPlayAgain={() => {
              setStageResult(null);
              setRoundIndex(0);
              setSeenIds(new Set());
              setScore(0);
              setRound(null);
            }}
            onBackToJourney={onExit}
            onViewStats={onOpenStats}
          />
        </View>
      </GameShell>
    );
  }

  if (playable && playable.length === 0) {
    return (
      <GameShell title={meta.title} onBack={onExit}>
        <View style={styles.centerFill}>
          <View style={[styles.emptyCard, { backgroundColor: palette.card }]}>
            <KISIcon name="volume-2" size={32} color={palette.subtext} />
            <Text style={[styles.emptyTitle, { color: palette.text }]}>Nothing to listen to yet</Text>
            <Text style={[styles.emptyBody, { color: palette.subtext }]}>
              This stage's passage doesn't have readable verse text to build a round from.
            </Text>
            <Pressable onPress={onExit} style={[styles.emptyBtn, { backgroundColor: palette.goldReadable }]}>
              <Text style={[styles.emptyBtnText, { color: palette.onGold }]}>Back to Journey</Text>
            </Pressable>
          </View>
        </View>
      </GameShell>
    );
  }

  if (!playable || !round) {
    return (
      <GameShell title={meta.title} onBack={onExit}>
        <View style={styles.centerFill}><ActivityIndicator color={palette.primary} /></View>
      </GameShell>
    );
  }

  const showOptions = hasPlayed;

  return (
    <GameShell
      title={meta.title}
      subtitle={`${isReplay ? 'Replay · ' : ''}Verse ${roundIndex + 1} of ${ROUND_LENGTH}`}
      onBack={onExit}
      rightStat={{ label: 'Score', value: score }}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {tts.ready ? (
          <View style={[styles.audioCard, { backgroundColor: palette.card }]}>
            <Pressable
              onPress={handlePlay}
              disabled={tts.status === 'speaking'}
              style={[styles.playBtn, { backgroundColor: palette.goldReadable, opacity: tts.status === 'speaking' ? 0.6 : 1 }]}
              accessibilityRole="button"
              accessibilityLabel="Play verse audio"
            >
              <KISIcon name="volume-2" size={28} color={palette.onGold} />
            </Pressable>
            <Text style={[styles.audioHint, { color: palette.subtext }]}>
              {tts.status === 'speaking' ? 'Playing…' : hasPlayed ? 'Tap to hear it again' : 'Tap to listen'}
            </Text>
          </View>
        ) : (
          <View style={[styles.verseCard, { backgroundColor: palette.card }]}>
            <Text style={[styles.unavailableNote, { color: palette.subtext }]}>
              Audio isn't available on this device — reading instead.
            </Text>
            <Text style={[styles.verseText, { color: palette.text }]}>{round.text}</Text>
          </View>
        )}

        {showOptions ? (
          <View style={styles.optionsWrap}>
            {round.options.map((option, index) => {
              const isCorrectOption = option === round.text;
              const isSelected = selected === option;
              const revealCorrect = selected !== null && isCorrectOption;
              const revealWrong = selected !== null && isSelected && !isCorrectOption;
              return (
                <Pressable
                  key={`${index}-${option.slice(0, 12)}`}
                  onPress={() => handleSelect(option)}
                  disabled={selected !== null}
                  style={[
                    styles.optionCard,
                    {
                      backgroundColor: revealCorrect ? '#16a34a20' : revealWrong ? '#dc262620' : palette.selectedBg,
                      borderColor: revealCorrect ? '#16a34a' : revealWrong ? '#dc2626' : palette.goldReadable,
                    },
                  ]}
                >
                  <Text style={[styles.optionText, { color: palette.text }]}>{option}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <Text style={[styles.waitingHint, { color: palette.subtext }]}>Play the verse to see your choices.</Text>
        )}

        {selected !== null ? (
          <AnswerFeedback
            correct={selected === round.text}
            text={selected === round.text ? 'Correct!' : `That was ${referenceOf(round.verse)}`}
          />
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        {selected !== null ? (
          <Pressable onPress={handleNext} style={[styles.actionBtn, { backgroundColor: palette.goldReadable }]}>
            <Text style={[styles.actionBtnText, { color: palette.onGold }]}>
              {roundIndex + 1 >= ROUND_LENGTH ? 'See Results' : 'Next Verse'}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </GameShell>
  );
}

const styles = StyleSheet.create({
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { gap: 16, paddingBottom: 16 },
  audioCard: { borderRadius: 18, padding: 22, alignItems: 'center', gap: 10 },
  playBtn: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  audioHint: { fontSize: 13, fontWeight: '700' },
  verseCard: { borderRadius: 18, padding: 18, gap: 10 },
  unavailableNote: { fontSize: 12, fontWeight: '700' },
  verseText: { fontSize: 17, fontWeight: '600', lineHeight: 26 },
  waitingHint: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  optionsWrap: { gap: 10 },
  optionCard: { borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 },
  optionText: { fontSize: 15, fontWeight: '700', lineHeight: 22 },
  footer: { paddingVertical: 14 },
  actionBtn: { borderRadius: 999, paddingVertical: 15, alignItems: 'center' },
  actionBtnText: { fontSize: 15, fontWeight: '900' },
  emptyCard: { borderRadius: 20, padding: 24, alignItems: 'center', gap: 8, maxWidth: 320 },
  emptyTitle: { fontSize: 17, fontWeight: '900', textAlign: 'center' },
  emptyBody: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  emptyBtn: { alignSelf: 'stretch', borderRadius: 999, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  emptyBtnText: { fontSize: 15, fontWeight: '900' },
});
