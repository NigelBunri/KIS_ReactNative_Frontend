// src/components/Bible/games/AudioDictationGame.tsx
//
// "Audio Dictation" — on-device TTS speaks a verse UP TO (not including) one
// blanked-out word, then the full verse is revealed with that word replaced
// by a tap-to-fill blank (CompleteVerseGame.tsx's exact word-bank
// interaction, just a single blank). Reading only the leading substring is
// what makes "the verse cut off right before the missing word" achievable
// with the plain speak(text) API — no SSML pause markup needed.
//
// Same TTS-unavailable fallback philosophy as ListenAndTapGame: when
// useBibleGameTts().ready is false, the leading substring is shown as text
// instead of spoken, and the fill-in-the-blank step is available immediately
// — always a playable round, audio or not.

import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, Pressable, ScrollView } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import GameShell from './GameShell';
import { AnswerFeedback, StageComplete } from './GameFeedback';
import { getVerseText, normalizeWord, tokenizeVerse } from '../../../screens/tabs/bible/games/verseText';
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
const MIN_WORD_LENGTH = 4;

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

/** Picks one eligible interior word to blank (length >= 4, not first or
 * last token) — progressively relaxes those constraints if a sparse verse
 * (short legal-code lines, genealogies) doesn't have one, rather than
 * simply failing. Returns null only when the verse has no interior word at
 * all (e.g. a 1-2 word "fragment" verse). */
function pickBlankIndex(tokens: string[]): number | null {
  const eligible = (minLen: number, allowEdges: boolean) =>
    tokens
      .map((word, index) => ({ word, index }))
      .filter(
        ({ word, index }) =>
          normalizeWord(word).length >= minLen && (allowEdges || (index !== 0 && index !== tokens.length - 1)),
      );
  const candidates = eligible(MIN_WORD_LENGTH, false).length
    ? eligible(MIN_WORD_LENGTH, false)
    : eligible(3, false).length
      ? eligible(3, false)
      : eligible(3, true);
  if (!candidates.length) return null;
  return candidates[Math.floor(Math.random() * candidates.length)].index;
}

function buildDistractors(stageVerses: VerseRef[], correctWord: string, excludeId: string, count: number): string[] {
  const pool = new Set<string>();
  const otherVerses = shuffle(stageVerses.filter((v) => verseId(v) !== excludeId));
  for (const v of otherVerses) {
    if (pool.size >= count) break;
    const text = getVerseText(v.bookName, v.chapter, v.verse);
    const words = tokenizeVerse(text).map(normalizeWord).filter((w) => w.length >= MIN_WORD_LENGTH);
    for (const w of words) {
      if (w !== correctWord && !pool.has(w)) {
        pool.add(w);
        break; // at most one distractor per source verse, for variety
      }
    }
  }
  return Array.from(pool).slice(0, count);
}

type Round = {
  verse: VerseRef;
  tokens: string[];
  blankIndex: number;
  leadingText: string; // verse text up to (not including) the blank word
  correctWord: string; // normalized
  choices: string[]; // shuffled: correct word + distractors
};

function buildRound(stageVerses: VerseRef[], excludeIds: Set<string>): Round | null {
  const notExcluded = stageVerses.filter((v) => !excludeIds.has(verseId(v)));
  const candidateVerses = shuffle(notExcluded.length ? notExcluded : stageVerses);
  for (const verse of candidateVerses) {
    const text = getVerseText(verse.bookName, verse.chapter, verse.verse);
    if (!text) continue;
    const tokens = tokenizeVerse(text);
    const blankIndex = pickBlankIndex(tokens);
    if (blankIndex === null) continue;
    const correctWord = normalizeWord(tokens[blankIndex]);
    const leadingText = tokens.slice(0, blankIndex).join(' ');
    const distractors = buildDistractors(stageVerses, correctWord, verseId(verse), 3);
    const choices = shuffle([correctWord, ...distractors]);
    return { verse, tokens, blankIndex, leadingText, correctWord, choices };
  }
  return null; // every verse in this stage is too short/sparse for a blank — caller ends the stage early
}

export default function AudioDictationGame({ gameKey, stageIndex, isReplay, onExit, onOpenStats }: GameScreenProps) {
  const { palette } = useKISTheme();
  const meta = GAME_METADATA[gameKey];
  const tts = useBibleGameTts();

  const [stageVerses, setStageVerses] = useState<VerseRef[] | null>(null);
  const [roundIndex, setRoundIndex] = useState(0);
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  const [round, setRound] = useState<Round | null>(null);
  const [ranOutOfContent, setRanOutOfContent] = useState(false);
  const [revealed, setRevealed] = useState(false); // leading audio/text has been delivered
  const [filled, setFilled] = useState<string | null>(null);
  const [usedChoiceIdx, setUsedChoiceIdx] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [stageResult, setStageResult] = useState<StageOutcome | null>(null);

  useEffect(() => {
    let active = true;
    getStageVerses(gameKey, stageIndex).then((verses) => {
      if (!active) return;
      setStageVerses(verses);
    });
    return () => { active = false; };
  }, [gameKey, stageIndex]);

  const startRound = useCallback((verses: VerseRef[], exclude: Set<string>) => {
    const next = buildRound(verses, exclude);
    if (!next) {
      setRanOutOfContent(true);
      return;
    }
    setRound(next);
    setRevealed(!tts.ready); // no audio to wait for — reveal the fill-in step immediately
    setFilled(null);
    setUsedChoiceIdx(null);
    setSubmitted(false);
  }, [tts.ready]);

  useEffect(() => {
    if (stageVerses && !round && !ranOutOfContent) startRound(stageVerses, seenIds);
  }, [stageVerses, round, ranOutOfContent, seenIds, startRound]);

  // Sparse-stage edge case: no verse in this stage has a usable interior
  // word to blank. Rather than stall, finish the stage right away with
  // whatever score has accumulated so far.
  useEffect(() => {
    if (!ranOutOfContent) return;
    finishStage(gameKey, stageIndex, score).then(setStageResult);
  }, [ranOutOfContent, gameKey, stageIndex, score]);

  const handlePlayLeading = () => {
    if (!round || tts.status === 'speaking') return;
    tts.speak(round.leadingText, () => setRevealed(true));
  };

  const handleChoicePress = (choice: string, index: number) => {
    if (submitted || filled !== null) return;
    setFilled(choice);
    setUsedChoiceIdx(index);
  };

  const handleClearChoice = () => {
    if (submitted || filled === null) return;
    setFilled(null);
    setUsedChoiceIdx(null);
  };

  const handleSubmit = () => {
    if (!round || filled === null) return;
    setSubmitted(true);
    if (filled === round.correctWord) setScore((s) => s + 1);
  };

  const handleNext = async () => {
    if (!round || !stageVerses) return;
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
    setRound(null); // triggers startRound via the effect above
  };

  if (stageResult) {
    return (
      <GameShell title={meta.title} onBack={onExit}>
        <View style={styles.centerFill}>
          <StageComplete
            gameTitle={meta.title}
            scoreLine={`${score} / ${roundIndex} correct this stage`}
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
              setRanOutOfContent(false);
            }}
            onBackToJourney={onExit}
            onViewStats={onOpenStats}
          />
        </View>
      </GameShell>
    );
  }

  if (!stageVerses || (!round && !ranOutOfContent)) {
    return (
      <GameShell title={meta.title} onBack={onExit}>
        <View style={styles.centerFill}><ActivityIndicator color={palette.primary} /></View>
      </GameShell>
    );
  }

  if (!round) {
    // ranOutOfContent — the finishStage effect above is resolving; show a
    // brief spinner rather than a blank/broken screen while it does.
    return (
      <GameShell title={meta.title} onBack={onExit}>
        <View style={styles.centerFill}><ActivityIndicator color={palette.primary} /></View>
      </GameShell>
    );
  }

  return (
    <GameShell
      title={meta.title}
      subtitle={`${isReplay ? 'Replay · ' : ''}Verse ${roundIndex + 1} of ${ROUND_LENGTH}`}
      onBack={onExit}
      rightStat={{ label: 'Score', value: score }}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {!revealed ? (
          tts.ready ? (
            <View style={[styles.audioCard, { backgroundColor: palette.card }]}>
              <Pressable
                onPress={handlePlayLeading}
                disabled={tts.status === 'speaking'}
                style={[styles.playBtn, { backgroundColor: palette.goldReadable, opacity: tts.status === 'speaking' ? 0.6 : 1 }]}
                accessibilityRole="button"
                accessibilityLabel="Play the verse so far"
              >
                <KISIcon name="volume-2" size={28} color={palette.onGold} />
              </Pressable>
              <Text style={[styles.audioHint, { color: palette.subtext }]}>
                {tts.status === 'speaking' ? 'Playing…' : 'Tap to hear the verse so far'}
              </Text>
            </View>
          ) : (
            <View style={[styles.verseCard, { backgroundColor: palette.card }]}>
              <Text style={[styles.unavailableNote, { color: palette.subtext }]}>
                Audio isn't available on this device — reading instead.
              </Text>
              <Text style={[styles.verseText, { color: palette.text }]}>
                …the verse so far: "{round.leadingText}" — what word comes next?
              </Text>
            </View>
          )
        ) : (
          <View style={[styles.verseCard, { backgroundColor: palette.card }]}>
            <Text style={[styles.reference, { color: palette.goldReadable }]}>{referenceOf(round.verse)}</Text>
            <View style={styles.verseTextWrap}>
              {round.tokens.map((word, index) => {
                if (index !== round.blankIndex) {
                  return (
                    <Text key={index} style={[styles.word, { color: palette.text }]}>
                      {word}{' '}
                    </Text>
                  );
                }
                const slotCorrect = submitted && filled === round.correctWord;
                const slotWrong = submitted && filled !== round.correctWord;
                return (
                  <Pressable
                    key={index}
                    onPress={handleClearChoice}
                    disabled={submitted}
                    style={[
                      styles.blank,
                      {
                        backgroundColor: slotCorrect ? '#16a34a25' : slotWrong ? '#dc262625' : palette.selectedBg,
                        borderColor: slotCorrect ? '#16a34a' : slotWrong ? '#dc2626' : palette.goldReadable,
                      },
                    ]}
                  >
                    <Text style={[styles.blankText, { color: filled ? palette.text : palette.subtext }]}>
                      {filled ?? '_____'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {revealed && submitted ? (
          <AnswerFeedback
            correct={filled === round.correctWord}
            text={filled === round.correctWord ? 'Correct!' : `Correct answer: ${round.correctWord}`}
          />
        ) : null}

        {revealed ? (
          <View style={styles.wordBank}>
            {round.choices.map((choice, index) => {
              const used = usedChoiceIdx === index;
              return (
                <Pressable
                  key={`${choice}-${index}`}
                  onPress={() => handleChoicePress(choice, index)}
                  disabled={used || submitted || filled !== null}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: used ? palette.bg : palette.selectedBg,
                      borderColor: palette.goldReadable,
                      opacity: used ? 0.35 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.chipText, { color: palette.text }]}>{choice}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        {revealed && submitted ? (
          <Pressable onPress={handleNext} style={[styles.actionBtn, { backgroundColor: palette.goldReadable }]}>
            <Text style={[styles.actionBtnText, { color: palette.onGold }]}>
              {roundIndex + 1 >= ROUND_LENGTH ? 'See Results' : 'Next Verse'}
            </Text>
          </Pressable>
        ) : revealed ? (
          <Pressable
            onPress={handleSubmit}
            disabled={filled === null}
            style={[styles.actionBtn, { backgroundColor: filled !== null ? palette.goldReadable : palette.selectedBg }]}
          >
            <Text style={[styles.actionBtnText, { color: filled !== null ? palette.onGold : palette.subtext }]}>
              Check Answer
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
  reference: { fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.6 },
  verseTextWrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  word: { fontSize: 17, fontWeight: '600', lineHeight: 26 },
  blank: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginVertical: 2,
    marginHorizontal: 2,
  },
  blankText: { fontSize: 16, fontWeight: '800' },
  wordBank: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10 },
  chipText: { fontSize: 15, fontWeight: '800' },
  footer: { paddingVertical: 14 },
  actionBtn: { borderRadius: 999, paddingVertical: 15, alignItems: 'center' },
  actionBtnText: { fontSize: 15, fontWeight: '900' },
});
