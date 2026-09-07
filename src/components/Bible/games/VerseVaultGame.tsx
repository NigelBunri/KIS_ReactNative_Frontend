// src/components/Bible/games/VerseVaultGame.tsx
//
// Game 5 of 6: "Verse Vault" — spaced-repetition flashcards, the anchor
// piece built specifically for long-term mastery rather than a one-off
// round (see srs.ts's SM-2-lite scheduler). Flip a card (reference only ->
// full text), self-rate recall (Again/Hard/Good/Easy), and the scheduler
// spaces out the next review based on that rating — exactly the mechanic
// real memory-verse work uses (Anki-style), just scoped to a small,
// curated Bible deck instead of a general flashcard app.
//
// Includes a lightweight "Manage Deck" view since a spaced-repetition game
// is only useful if the user can actually choose what's in their own deck,
// not just play through a fixed starter set forever.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View, Pressable, ScrollView } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import GameShell from './GameShell';
import { CURATED_VERSES, type CuratedVerseRef } from '../../../screens/tabs/bible/games/curatedVerses';
import { getVerseText } from '../../../screens/tabs/bible/games/verseText';
import {
  getOrSeedVaultDeck,
  saveVaultDeck,
  addVerseToVault,
  removeVerseFromVault,
  type VaultDeck,
} from '../../../screens/tabs/bible/games/gameStorage';
import { dueCards, reviewCard, type SrsCardState, type SrsRating } from '../../../screens/tabs/bible/games/srs';

type Mode = 'loading' | 'menu' | 'reviewing' | 'sessionComplete' | 'manage';

const verseById = (id: string): CuratedVerseRef | undefined => CURATED_VERSES.find((v) => v.id === id);

const RATING_CONFIG: { rating: SrsRating; label: string; color: string }[] = [
  { rating: 'again', label: 'Again', color: '#dc2626' },
  { rating: 'hard', label: 'Hard', color: '#d97706' },
  { rating: 'good', label: 'Good', color: '#16a34a' },
  { rating: 'easy', label: 'Easy', color: '#2563eb' },
];

export default function VerseVaultGame({ onExit }: { onExit: () => void }) {
  const { palette } = useKISTheme();
  const [mode, setMode] = useState<Mode>('loading');
  const [deck, setDeck] = useState<VaultDeck>({});
  const [queue, setQueue] = useState<SrsCardState[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [sessionReviewed, setSessionReviewed] = useState(0);

  useEffect(() => {
    getOrSeedVaultDeck().then((d) => {
      setDeck(d);
      setMode('menu');
    });
  }, []);

  const due = useMemo(() => dueCards(Object.values(deck)), [deck]);

  const startSession = useCallback(() => {
    setQueue(due);
    setQueueIndex(0);
    setSessionReviewed(0);
    setRevealed(false);
    setMode(due.length ? 'reviewing' : 'menu');
  }, [due]);

  const currentCard = queue[queueIndex];
  const currentVerse = currentCard ? verseById(currentCard.verseId) : undefined;

  const handleRate = async (rating: SrsRating) => {
    if (!currentCard) return;
    const updatedCard = reviewCard(currentCard, rating);
    const nextDeck = { ...deck, [updatedCard.verseId]: updatedCard };
    setDeck(nextDeck);
    await saveVaultDeck(nextDeck);
    setSessionReviewed((n) => n + 1);

    const nextIndex = queueIndex + 1;
    if (nextIndex >= queue.length) {
      setMode('sessionComplete');
    } else {
      setQueueIndex(nextIndex);
      setRevealed(false);
    }
  };

  const handleToggleDeckVerse = async (verseId: string) => {
    const inDeck = !!deck[verseId];
    const next = inDeck ? await removeVerseFromVault(verseId) : await addVerseToVault(verseId);
    setDeck(next);
  };

  // ── Loading ────────────────────────────────────────────────────────────
  if (mode === 'loading') {
    return (
      <GameShell title="Verse Vault" onBack={onExit}>
        <View style={styles.centerFill} />
      </GameShell>
    );
  }

  // ── Manage deck ────────────────────────────────────────────────────────
  if (mode === 'manage') {
    return (
      <GameShell title="Manage Deck" subtitle={`${Object.keys(deck).length} verses saved`} onBack={() => setMode('menu')}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.manageList}>
          {CURATED_VERSES.map((v) => {
            const inDeck = !!deck[v.id];
            return (
              <Pressable
                key={v.id}
                onPress={() => handleToggleDeckVerse(v.id)}
                style={[
                  styles.manageRow,
                  { backgroundColor: palette.card, borderColor: inDeck ? palette.goldReadable : 'transparent' },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.manageRowRef, { color: palette.text }]}>{v.reference}</Text>
                </View>
                <KISIcon
                  name={inDeck ? 'checkmark-circle' : 'add'}
                  size={22}
                  color={inDeck ? '#16a34a' : palette.subtext}
                />
              </Pressable>
            );
          })}
        </ScrollView>
      </GameShell>
    );
  }

  // ── Session complete ───────────────────────────────────────────────────
  if (mode === 'sessionComplete') {
    return (
      <GameShell title="Verse Vault" onBack={onExit}>
        <View style={styles.centerFill}>
          <View style={[styles.completeCard, { backgroundColor: palette.card }]}>
            <View style={[styles.trophyCircle, { backgroundColor: palette.selectedBg }]}>
              <KISIcon name="trophy" size={30} color={palette.goldReadable} />
            </View>
            <Text style={[styles.completeTitle, { color: palette.text }]}>Session complete</Text>
            <Text style={[styles.completeScore, { color: palette.subtext }]}>
              Reviewed {sessionReviewed} {sessionReviewed === 1 ? 'verse' : 'verses'}
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
    return (
      <GameShell
        title="Verse Vault"
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
            <Text style={[styles.flashcardRef, { color: palette.goldReadable }]}>{currentVerse.reference}</Text>
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
              {RATING_CONFIG.map(({ rating, label, color }) => (
                <Pressable
                  key={rating}
                  onPress={() => handleRate(rating)}
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
  const totalCards = Object.keys(deck).length;
  return (
    <GameShell title="Verse Vault" subtitle="Spaced-repetition memorization" onBack={onExit}>
      <View style={styles.menuWrap}>
        <View style={[styles.statCard, { backgroundColor: palette.card }]}>
          <View style={styles.statRow}>
            <Text style={[styles.statBig, { color: palette.text }]}>{totalCards}</Text>
            <Text style={[styles.statSmall, { color: palette.subtext }]}>verses in your deck</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={[styles.statBig, { color: due.length ? palette.goldReadable : palette.text }]}>
              {due.length}
            </Text>
            <Text style={[styles.statSmall, { color: palette.subtext }]}>due for review today</Text>
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

        <Pressable onPress={() => setMode('manage')} style={[styles.secondaryBtn, { borderColor: palette.selectedBg }]}>
          <Text style={[styles.secondaryBtnText, { color: palette.text }]}>Manage Deck</Text>
        </Pressable>

        {!due.length ? (
          <Text style={[styles.emptyHint, { color: palette.subtext }]}>
            Nothing due right now — come back later, or add more verses from Manage Deck.
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
  secondaryBtn: { borderRadius: 999, borderWidth: 1.5, paddingVertical: 13, alignItems: 'center' },
  secondaryBtnText: { fontSize: 14, fontWeight: '800' },

  manageList: { gap: 10, paddingBottom: 16 },
  manageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  manageRowRef: { fontSize: 15, fontWeight: '800' },

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
});
