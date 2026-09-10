// src/components/Bible/games/VerseVaultGame.tsx
//
// Game 5 of 30: "Verse Vault" — spaced-repetition flashcards, the anchor
// piece built specifically for long-term mastery rather than a one-off
// round (see srs.ts's SM-2-lite scheduler). Flip a card (reference only ->
// full text), self-rate recall (Again/Hard/Good/Easy), and the scheduler
// spaces out the next review based on that rating — exactly the mechanic
// real memory-verse work uses (Anki-style).
//
// The deck is the current stage's own verses (one card per verse), reseeded
// whenever the stage advances — same "this stage's content" contract every
// other game follows, rather than a separately curated pool the player
// manages by hand. A stage completes once every card in it has been
// reviewed at least once (tracked via lastReviewedAt, which survives a
// later "again" lapse resetting repetitions back to 0) — cards that lapse
// keep resurfacing on their normal SRS schedule for as long as the stage's
// deck is active, but that ongoing practice never blocks moving on, per the
// "stages until a final stage, not running forever" requirement.

import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, Pressable } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import GameShell from './GameShell';
import { StageComplete } from './GameFeedback';
import { getVerseText } from '../../../screens/tabs/bible/games/verseText';
import {
  completeCurrentStage,
  getOrSeedVaultDeck,
  saveVaultDeck,
  vaultCardId,
  STAGES_PER_GAME,
  recordScore,
  type GameKey,
  type VaultDeck,
  type VerseRef,
} from '../../../screens/tabs/bible/games/gameStorage';
import { dueCards, reviewCard, type SrsCardState, type SrsRating } from '../../../screens/tabs/bible/games/srs';
import { GAME_METADATA } from '../../../screens/tabs/bible/games/gameMetadata';

type Mode = 'loading' | 'menu' | 'reviewing' | 'sessionComplete';

const RATING_CONFIG: { rating: SrsRating; label: string; color: string; points: number }[] = [
  { rating: 'again', label: 'Again', color: '#dc2626', points: 0 },
  { rating: 'hard', label: 'Hard', color: '#d97706', points: 1 },
  { rating: 'good', label: 'Good', color: '#16a34a', points: 2 },
  { rating: 'easy', label: 'Easy', color: '#2563eb', points: 3 },
];

export default function VerseVaultGame({ gameKey, onExit, onOpenStats }: { gameKey: GameKey; onExit: () => void; onOpenStats: () => void }) {
  const { palette } = useKISTheme();
  const meta = GAME_METADATA[gameKey];
  const [mode, setMode] = useState<Mode>('loading');
  const [deck, setDeck] = useState<VaultDeck>({});
  const [stageVerseById, setStageVerseById] = useState<Record<string, VerseRef>>({});
  const [queue, setQueue] = useState<SrsCardState[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [sessionReviewed, setSessionReviewed] = useState(0);
  const [sessionScore, setSessionScore] = useState(0);
  const [stageResult, setStageResult] = useState<{ stagesCompleted: number; isFinalStage: boolean } | null>(null);

  const load = useCallback(async () => {
    const { deck: freshDeck, stageVerses } = await getOrSeedVaultDeck();
    setDeck(freshDeck);
    const byId: Record<string, VerseRef> = {};
    for (const ref of stageVerses) byId[vaultCardId(ref)] = ref;
    setStageVerseById(byId);
    setMode('menu');
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalCards = Object.keys(deck).length;
  const reviewedCount = Object.values(deck).filter((c) => c.lastReviewedAt !== null).length;
  const due = dueCards(Object.values(deck));

  const startSession = useCallback(() => {
    setQueue(due);
    setQueueIndex(0);
    setSessionReviewed(0);
    setSessionScore(0);
    setRevealed(false);
    setMode(due.length ? 'reviewing' : 'menu');
  }, [due]);

  const currentCard = queue[queueIndex];
  const currentVerse = currentCard ? stageVerseById[currentCard.verseId] : undefined;

  const handleRate = async (rating: SrsRating, points: number) => {
    if (!currentCard) return;
    const updatedCard = reviewCard(currentCard, rating);
    const nextDeck = { ...deck, [updatedCard.verseId]: updatedCard };
    setDeck(nextDeck);
    await saveVaultDeck(nextDeck);
    setSessionReviewed((n) => n + 1);
    const finalScore = sessionScore + points;
    setSessionScore(finalScore);

    const nextIndex = queueIndex + 1;
    const allReviewedNow = Object.values(nextDeck).every((c) => c.lastReviewedAt !== null);

    if (nextIndex >= queue.length) {
      if (allReviewedNow) {
        await recordScore(gameKey, finalScore);
        const progress = await completeCurrentStage(gameKey);
        setStageResult({ stagesCompleted: progress.stagesCompleted, isFinalStage: progress.stagesCompleted >= STAGES_PER_GAME });
      } else {
        setMode('sessionComplete');
      }
      return;
    }
    setQueueIndex(nextIndex);
    setRevealed(false);
  };

  // ── Loading ────────────────────────────────────────────────────────────
  if (mode === 'loading') {
    return (
      <GameShell title={meta.title} onBack={onExit}>
        <View style={styles.centerFill}><ActivityIndicator color={palette.primary} /></View>
      </GameShell>
    );
  }

  // ── Stage complete ─────────────────────────────────────────────────────
  if (stageResult) {
    return (
      <GameShell title={meta.title} onBack={onExit}>
        <View style={styles.centerFill}>
          <StageComplete
            gameTitle={meta.title}
            scoreLine={`${totalCards} ${totalCards === 1 ? 'verse' : 'verses'} reviewed at least once`}
            stagesCompleted={stageResult.stagesCompleted}
            totalStages={STAGES_PER_GAME}
            isFinalStage={stageResult.isFinalStage}
            onContinue={() => {
              setStageResult(null);
              setMode('loading');
              load();
            }}
            onViewStats={onOpenStats}
            onExit={onExit}
          />
        </View>
      </GameShell>
    );
  }

  // ── Session complete (worked through the due queue, stage not done yet) ─
  if (mode === 'sessionComplete') {
    return (
      <GameShell title={meta.title} onBack={onExit}>
        <View style={styles.centerFill}>
          <View style={[styles.completeCard, { backgroundColor: palette.card }]}>
            <View style={[styles.trophyCircle, { backgroundColor: palette.selectedBg }]}>
              <KISIcon name="trophy" size={30} color={palette.goldReadable} />
            </View>
            <Text style={[styles.completeTitle, { color: palette.text }]}>Session complete</Text>
            <Text style={[styles.completeScore, { color: palette.subtext }]}>
              Reviewed {sessionReviewed} {sessionReviewed === 1 ? 'verse' : 'verses'} this session
            </Text>
            <Text style={[styles.completeSub, { color: palette.subtext }]}>
              {reviewedCount} of {totalCards} verses in this stage reviewed at least once
            </Text>
            <Pressable onPress={() => setMode('menu')} style={[styles.actionBtn, { backgroundColor: palette.goldReadable, marginTop: 10 }]}>
              <Text style={[styles.actionBtnText, { color: palette.onGold }]}>Back to Vault</Text>
            </Pressable>
          </View>
        </View>
      </GameShell>
    );
  }

  // ── Reviewing ──────────────────────────────────────────────────────────
  if (mode === 'reviewing' && currentCard && currentVerse) {
    const text = getVerseText(currentVerse.bookName, currentVerse.chapter, currentVerse.verse);
    const reference = `${currentVerse.bookName} ${currentVerse.chapter}:${currentVerse.verse}`;
    return (
      <GameShell
        title={meta.title}
        subtitle={`Card ${queueIndex + 1} of ${queue.length}`}
        onBack={onExit}
        rightStat={{ label: 'Reviewed', value: sessionReviewed }}
      >
        <View style={styles.reviewWrap}>
          <Pressable
            onPress={() => setRevealed(true)}
            disabled={revealed}
            style={[styles.flashcard, { backgroundColor: palette.card, borderColor: palette.goldReadable }]}
          >
            <Text style={[styles.flashcardRef, { color: palette.goldReadable }]}>{reference}</Text>
            {revealed ? (
              <Text style={[styles.flashcardText, { color: palette.text }]}>{text}</Text>
            ) : (
              <View style={styles.tapHint}>
                <KISIcon name="eye" size={20} color={palette.subtext} />
                <Text style={[styles.tapHintText, { color: palette.subtext }]}>Tap to reveal</Text>
              </View>
            )}
          </Pressable>

          {revealed ? (
            <View style={styles.ratingRow}>
              {RATING_CONFIG.map(({ rating, label, color, points }) => (
                <Pressable
                  key={rating}
                  onPress={() => handleRate(rating, points)}
                  style={[styles.ratingBtn, { backgroundColor: `${color}20`, borderColor: color }]}
                >
                  <Text style={[styles.ratingBtnText, { color }]}>{label}</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <Text style={[styles.reviewHint, { color: palette.subtext }]}>
              How well did you remember this verse? Rate yourself after revealing.
            </Text>
          )}
        </View>
      </GameShell>
    );
  }

  // ── Menu ───────────────────────────────────────────────────────────────
  return (
    <GameShell title={meta.title} subtitle="Spaced-repetition memorization" onBack={onExit}>
      <View style={styles.menuWrap}>
        <View style={[styles.statCard, { backgroundColor: palette.card }]}>
          <View style={styles.statRow}>
            <Text style={[styles.statBig, { color: palette.text }]}>{reviewedCount}/{totalCards}</Text>
            <Text style={[styles.statSmall, { color: palette.subtext }]}>verses reviewed this stage</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={[styles.statBig, { color: due.length ? palette.goldReadable : palette.text }]}>
              {due.length}
            </Text>
            <Text style={[styles.statSmall, { color: palette.subtext }]}>due for review now</Text>
          </View>
        </View>

        <Pressable
          onPress={startSession}
          disabled={!due.length}
          style={[styles.actionBtn, { backgroundColor: due.length ? palette.goldReadable : palette.selectedBg }]}
        >
          <Text style={[styles.actionBtnText, { color: due.length ? palette.onGold : palette.subtext }]}>
            {due.length ? 'Start Review' : 'All caught up!'}
          </Text>
        </Pressable>

        {!due.length ? (
          <Text style={[styles.emptyHint, { color: palette.subtext }]}>
            Nothing due right now — lapsed cards resurface on their own schedule. Come back later.
          </Text>
        ) : null}
      </View>
    </GameShell>
  );
}

const styles = StyleSheet.create({
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  menuWrap: { flex: 1, gap: 14, paddingTop: 8 },
  statCard: { borderRadius: 18, padding: 20, flexDirection: 'row', gap: 24 },
  statRow: { alignItems: 'flex-start' },
  statBig: { fontSize: 28, fontWeight: '900' },
  statSmall: { fontSize: 12, fontWeight: '700', marginTop: 2, maxWidth: 110 },
  emptyHint: { fontSize: 13, fontWeight: '600', textAlign: 'center', lineHeight: 19 },

  actionBtn: { borderRadius: 999, paddingVertical: 15, alignItems: 'center' },
  actionBtnText: { fontSize: 15, fontWeight: '900' },

  reviewWrap: { flex: 1, gap: 20, paddingTop: 8 },
  flashcard: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  flashcardRef: { fontSize: 14, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.6 },
  flashcardText: { fontSize: 19, fontWeight: '600', lineHeight: 28, textAlign: 'center' },
  tapHint: { alignItems: 'center', gap: 8 },
  tapHintText: { fontSize: 13, fontWeight: '700' },
  reviewHint: { fontSize: 12, fontWeight: '600', textAlign: 'center' },

  ratingRow: { flexDirection: 'row', gap: 8 },
  ratingBtn: { flex: 1, borderRadius: 14, borderWidth: 1.5, paddingVertical: 14, alignItems: 'center' },
  ratingBtnText: { fontSize: 13, fontWeight: '900' },

  completeCard: { borderRadius: 20, padding: 24, alignItems: 'center', gap: 6, minWidth: 260 },
  trophyCircle: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  completeTitle: { fontSize: 20, fontWeight: '900' },
  completeScore: { fontSize: 14, fontWeight: '700' },
  completeSub: { fontSize: 12, fontWeight: '600', marginTop: 2 },
});
