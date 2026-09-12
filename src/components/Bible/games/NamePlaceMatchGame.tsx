// src/components/Bible/games/NamePlaceMatchGame.tsx
//
// "Name & Place Match" — a masked-verse multiple-choice quiz, the same
// mechanic shape as CompleteVerseGame's fill-in blank but with the blank
// always landing on a detected name/place word (verseText.ts's
// extractCapitalizedWords) rather than any word. Distractors are drawn from
// OTHER capitalized words found elsewhere in the SAME stage first, only
// padding from a small fixed fallback pool when a stage doesn't carry
// enough of its own.

import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, Pressable, ScrollView } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import GameShell from './GameShell';
import { AnswerFeedback, StageComplete } from './GameFeedback';
import { extractCapitalizedWords, getVerseText, tokenizeVerse } from '../../../screens/tabs/bible/games/verseText';
import {
  finishStage,
  getStageVerses,
  STAGES_PER_GAME,
  type StageOutcome,
  type VerseRef,
} from '../../../screens/tabs/bible/games/gameStorage';
import { GAME_METADATA } from '../../../screens/tabs/bible/games/gameMetadata';
import type { GameScreenProps } from '../../../screens/tabs/bible/games/gameScreenTypes';

const ROUND_LENGTH = 6;
const FALLBACK_POOL = ['Israel', 'Egypt', 'Jerusalem', 'Moses', 'David', 'Zion', 'Babylon', 'Canaan'];

function verseId(ref: VerseRef): string {
  return `${ref.bookName}-${ref.chapter}-${ref.verse}`;
}

function referenceOf(ref: VerseRef): string {
  return `${ref.bookName} ${ref.chapter}:${ref.verse}`;
}

function cleanToken(token: string): string {
  return token.replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, '');
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
  maskedTokens: string[];
  blankIndex: number;
  answer: string;
  choices: string[];
};

/** Every capitalized word found anywhere in the stage's own verses, keyed by
 * verse so a round can exclude the verse it's currently quizzing on when
 * gathering distractors — this stage's own content is always the first
 * (and usually only) source of distractors. */
function collectStageCapitalizedWords(stageVerses: VerseRef[], excludeId: string): string[] {
  const pool = new Set<string>();
  for (const v of stageVerses) {
    if (verseId(v) === excludeId) continue;
    const text = getVerseText(v.bookName, v.chapter, v.verse);
    for (const w of extractCapitalizedWords(text)) pool.add(w);
  }
  return Array.from(pool);
}

function buildRound(stageVerses: VerseRef[], eligible: VerseRef[], excludeIds: Set<string>): Round | null {
  if (!eligible.length) return null;
  const pool = eligible.filter((v) => !excludeIds.has(verseId(v)));
  const source = pool.length ? pool : eligible;
  const verse = source[Math.floor(Math.random() * source.length)];
  const text = getVerseText(verse.bookName, verse.chapter, verse.verse);
  const names = extractCapitalizedWords(text);
  if (!names.length) return null;
  const answer = names[Math.floor(Math.random() * names.length)];

  const tokens = tokenizeVerse(text);
  const blankIndex = tokens.findIndex((t) => cleanToken(t) === answer);
  const maskedTokens = tokens.map((t, i) => (i === blankIndex ? '_____' : t));

  let distractors = shuffle(collectStageCapitalizedWords(stageVerses, verseId(verse)).filter((w) => w !== answer)).slice(0, 3);
  if (distractors.length < 3) {
    const fallback = FALLBACK_POOL.filter((w) => w !== answer && !distractors.includes(w));
    distractors = [...distractors, ...shuffle(fallback)].slice(0, 3);
  }
  const choices = shuffle([answer, ...distractors]);

  return { verse, maskedTokens, blankIndex, answer, choices };
}

export default function NamePlaceMatchGame({ gameKey, stageIndex, isReplay, onExit, onOpenStats }: GameScreenProps) {
  const { palette } = useKISTheme();
  const meta = GAME_METADATA[gameKey];
  const [stageVerses, setStageVerses] = useState<VerseRef[] | null>(null);
  const [eligibleVerses, setEligibleVerses] = useState<VerseRef[]>([]);
  const [roundIndex, setRoundIndex] = useState(0);
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  const [round, setRound] = useState<Round | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [stageResult, setStageResult] = useState<StageOutcome | null>(null);

  const startRound = useCallback((verses: VerseRef[], eligible: VerseRef[], exclude: Set<string>) => {
    const next = buildRound(verses, eligible, exclude);
    setRound(next);
    setSelected(null);
    setSubmitted(false);
  }, []);

  const load = useCallback(() => {
    let active = true;
    getStageVerses(gameKey, stageIndex).then((verses) => {
      if (!active) return;
      const eligible = verses.filter((v) => extractCapitalizedWords(getVerseText(v.bookName, v.chapter, v.verse)).length > 0);
      setStageVerses(verses);
      setEligibleVerses(eligible);
      setRoundIndex(0);
      setSeenIds(new Set());
      setScore(0);
      setStageResult(null);
      startRound(verses, eligible, new Set());
    });
    return () => { active = false; };
  }, [gameKey, stageIndex, startRound]);

  useEffect(() => load(), [load]);

  const handleSelect = (choice: string) => {
    if (submitted) return;
    setSelected(choice);
  };

  const handleSubmit = () => {
    if (!round || !selected) return;
    setSubmitted(true);
    if (selected === round.answer) setScore((s) => s + 1);
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
    startRound(stageVerses, eligibleVerses, nextSeen);
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
            onPlayAgain={load}
            onBackToJourney={onExit}
            onViewStats={onOpenStats}
          />
        </View>
      </GameShell>
    );
  }

  if (stageVerses === null) {
    return (
      <GameShell title={meta.title} onBack={onExit}>
        <View style={styles.centerFill}><ActivityIndicator color={palette.primary} /></View>
      </GameShell>
    );
  }

  if (eligibleVerses.length === 0) {
    return (
      <GameShell title={meta.title} onBack={onExit}>
        <View style={styles.centerFill}>
          <View style={[styles.fallbackCard, { backgroundColor: palette.card }]}>
            <Text style={[styles.fallbackText, { color: palette.text }]}>
              This stage doesn't contain any names or places to match.
            </Text>
            <Pressable onPress={onExit} style={[styles.actionBtn, { backgroundColor: palette.goldReadable }]}>
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
      subtitle={`${isReplay ? 'Replay · ' : ''}Verse ${roundIndex + 1} of ${ROUND_LENGTH}`}
      onBack={onExit}
      rightStat={{ label: 'Score', value: score }}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.verseCard, { backgroundColor: palette.card }]}>
          <Text style={[styles.reference, { color: palette.goldReadable }]}>{referenceOf(round.verse)}</Text>
          <View style={styles.verseTextWrap}>
            {round.maskedTokens.map((word, index) => (
              <Text
                key={index}
                style={[
                  index === round.blankIndex ? styles.blankWord : styles.word,
                  { color: index === round.blankIndex ? palette.goldReadable : palette.text },
                ]}
              >
                {word}{' '}
              </Text>
            ))}
          </View>
        </View>

        <Text style={[styles.prompt, { color: palette.subtext }]}>Which name/place belongs in the blank?</Text>

        <View style={styles.choiceList}>
          {round.choices.map((choice) => {
            const isSelected = selected === choice;
            const isCorrectChoice = submitted && choice === round.answer;
            const isWrongSelected = submitted && isSelected && choice !== round.answer;
            return (
              <Pressable
                key={choice}
                onPress={() => handleSelect(choice)}
                disabled={submitted}
                style={[
                  styles.choiceRow,
                  {
                    backgroundColor: isCorrectChoice ? '#16a34a20' : isWrongSelected ? '#dc262620' : isSelected ? palette.selectedBg : palette.card,
                    borderColor: isCorrectChoice ? '#16a34a' : isWrongSelected ? '#dc2626' : isSelected ? palette.goldReadable : palette.selectedBg,
                  },
                ]}
              >
                <Text style={[styles.choiceText, { color: palette.text }]}>{choice}</Text>
              </Pressable>
            );
          })}
        </View>

        {submitted ? (
          <AnswerFeedback
            correct={selected === round.answer}
            text={selected === round.answer ? 'Correct!' : `Correct answer: ${round.answer}`}
          />
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        {submitted ? (
          <Pressable onPress={handleNext} style={[styles.actionBtn, { backgroundColor: palette.goldReadable }]}>
            <Text style={[styles.actionBtnText, { color: palette.onGold }]}>
              {roundIndex + 1 >= ROUND_LENGTH ? 'See Results' : 'Next Verse'}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={handleSubmit}
            disabled={!selected}
            style={[styles.actionBtn, { backgroundColor: selected ? palette.goldReadable : palette.selectedBg }]}
          >
            <Text style={[styles.actionBtnText, { color: selected ? palette.onGold : palette.subtext }]}>Check Answer</Text>
          </Pressable>
        )}
      </View>
    </GameShell>
  );
}

const styles = StyleSheet.create({
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fallbackCard: { borderRadius: 20, padding: 24, alignItems: 'center', gap: 14 },
  fallbackText: { fontSize: 15, fontWeight: '700', textAlign: 'center' },
  scrollContent: { gap: 16, paddingBottom: 16 },
  verseCard: { borderRadius: 18, padding: 18, gap: 10 },
  reference: { fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.6 },
  verseTextWrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  word: { fontSize: 17, fontWeight: '600', lineHeight: 26 },
  blankWord: { fontSize: 17, fontWeight: '900', lineHeight: 26, textDecorationLine: 'underline' },
  prompt: { fontSize: 14, fontWeight: '700' },
  choiceList: { gap: 10 },
  choiceRow: { borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14 },
  choiceText: { fontSize: 15, fontWeight: '800' },
  footer: { paddingVertical: 14 },
  actionBtn: { borderRadius: 999, paddingVertical: 15, alignItems: 'center' },
  actionBtnText: { fontSize: 15, fontWeight: '900' },
});
