// src/components/Bible/games/GameFeedback.tsx
//
// Two small shared pieces reused across most of the 6 games: an inline
// correct/incorrect banner (same green/red convention BibleLessonsPanel's
// quiz already uses, kept consistent rather than inventing a second one),
// and a round-complete summary card with play-again/back actions.

import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View, Pressable } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';

const CORRECT_COLOR = '#16a34a';
const INCORRECT_COLOR = '#dc2626';

export function AnswerFeedback({ correct, text }: { correct: boolean; text: string }) {
  const color = correct ? CORRECT_COLOR : INCORRECT_COLOR;
  return (
    <View style={[styles.feedback, { backgroundColor: `${color}20`, borderColor: `${color}55` }]}>
      <KISIcon name={correct ? 'checkmark-circle' : 'close-circle'} size={18} color={color} />
      <Text style={[styles.feedbackText, { color }]}>{text}</Text>
    </View>
  );
}

/** Stage-aware completion card shared by all 30 games - the ONE place a
 * round's ending is presented, for both of the journey map's two entry
 * modes (see gameStorage.ts's finishStage / BibleGamesPanel's ActiveView):
 *   - forward play (isReplay=false): the current stage was just cleared for
 *     the first time, progress advanced - "Stage N of 10 complete" (or the
 *     whole-game "{gameTitle} complete!" framing on the final stage).
 *   - replay (isReplay=true): an already-completed stage was played again
 *     to improve its score - "Stage N replayed", progress untouched.
 * Always offers the same two actions regardless of mode: Play Again (retry
 * this exact stage, same verses) and Continue Journey (back to the journey
 * map, where the newly-lit node and newly-unlocked next node are the real
 * "what's next" - see GameJourneyScreen.tsx), rather than duplicating that
 * progression logic here in 30 different call sites. */
export function StageComplete({
  gameTitle,
  scoreLine,
  stageNumber,
  totalStages,
  isFinalStage,
  isReplay = false,
  onPlayAgain,
  onBackToJourney,
  onViewStats,
}: {
  gameTitle: string;
  scoreLine: string;
  stageNumber: number; // 1-based
  totalStages: number;
  isFinalStage: boolean;
  isReplay?: boolean;
  onPlayAgain: () => void;
  onBackToJourney: () => void;
  onViewStats?: () => void;
}) {
  const { palette } = useKISTheme();
  const metallicGold = [palette.royalInk, palette.goldDeep, palette.gold, palette.goldDeep];
  const scale = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    Animated.spring(scale, { toValue: 1, friction: 5, tension: 60, useNativeDriver: true }).start();
  }, [scale]);

  const title = isFinalStage && !isReplay
    ? `${gameTitle} complete!`
    : isReplay
      ? `Stage ${stageNumber} replayed`
      : `Stage ${stageNumber} of ${totalStages} complete`;

  return (
    <View style={[styles.completeCard, { backgroundColor: palette.card }]}>
      <Animated.View style={[styles.trophyCircle, { backgroundColor: palette.selectedBg, transform: [{ scale }] }]}>
        <KISIcon name="trophy" size={30} color={palette.goldReadable} />
      </Animated.View>
      <Text style={[styles.completeTitle, { color: palette.text }]}>{title}</Text>
      <Text style={[styles.completeScore, { color: palette.subtext }]}>{scoreLine}</Text>
      {isFinalStage && !isReplay ? (
        <Text style={[styles.completeScore, { color: palette.subtext, marginTop: -8 }]}>
          Every verse this game carries is done. Play the rest of the 30 games to cover the whole Bible.
        </Text>
      ) : null}

      <Pressable onPress={onBackToJourney} style={styles.primaryBtnWrap}>
        <LinearGradient colors={metallicGold} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.primaryBtn}>
          <Text style={[styles.primaryBtnText, { color: palette.ivory }]}>Continue Journey</Text>
        </LinearGradient>
      </Pressable>

      <Pressable onPress={onPlayAgain} style={[styles.secondaryBtn, { borderColor: palette.selectedBg }]}>
        <Text style={[styles.secondaryBtnText, { color: palette.text }]}>Play Again</Text>
      </Pressable>

      {isFinalStage && !isReplay && onViewStats ? (
        <Pressable onPress={onViewStats} style={styles.statsLink} hitSlop={8}>
          <Text style={{ color: palette.primary, fontWeight: '800', fontSize: 12 }}>View overall stats</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function RoundComplete({
  title,
  scoreLine,
  onPlayAgain,
  onExit,
}: {
  title: string;
  scoreLine: string;
  onPlayAgain: () => void;
  onExit: () => void;
}) {
  const { palette } = useKISTheme();
  const metallicGold = [palette.royalInk, palette.goldDeep, palette.gold, palette.goldDeep];

  return (
    <View style={[styles.completeCard, { backgroundColor: palette.card }]}>
      <View style={[styles.trophyCircle, { backgroundColor: palette.selectedBg }]}>
        <KISIcon name="trophy" size={30} color={palette.goldReadable} />
      </View>
      <Text style={[styles.completeTitle, { color: palette.text }]}>{title}</Text>
      <Text style={[styles.completeScore, { color: palette.subtext }]}>{scoreLine}</Text>

      <Pressable onPress={onPlayAgain} style={styles.primaryBtnWrap}>
        <LinearGradient
          colors={metallicGold}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.primaryBtn}
        >
          <Text style={[styles.primaryBtnText, { color: palette.ivory }]}>Play Again</Text>
        </LinearGradient>
      </Pressable>

      <Pressable onPress={onExit} style={[styles.secondaryBtn, { borderColor: palette.selectedBg }]}>
        <Text style={[styles.secondaryBtnText, { color: palette.text }]}>Back to Games</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  feedback: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  feedbackText: { fontSize: 14, fontWeight: '800', flexShrink: 1 },

  completeCard: {
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 6,
  },
  trophyCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  completeTitle: { fontSize: 20, fontWeight: '900', textAlign: 'center' },
  completeScore: { fontSize: 14, fontWeight: '700', textAlign: 'center', marginBottom: 14 },
  primaryBtnWrap: { alignSelf: 'stretch', borderRadius: 999, overflow: 'hidden', marginTop: 4 },
  primaryBtn: { paddingVertical: 14, alignItems: 'center', borderRadius: 999 },
  primaryBtnText: { fontSize: 15, fontWeight: '900' },
  secondaryBtn: {
    alignSelf: 'stretch',
    borderRadius: 999,
    borderWidth: 1.5,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 10,
  },
  secondaryBtnText: { fontSize: 14, fontWeight: '800' },
  statsLink: { marginTop: 12, padding: 4 },
});
