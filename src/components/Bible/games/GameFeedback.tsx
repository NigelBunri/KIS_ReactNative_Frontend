// src/components/Bible/games/GameFeedback.tsx
//
// Two small shared pieces reused across most of the 6 games: an inline
// correct/incorrect banner (same green/red convention BibleLessonsPanel's
// quiz already uses, kept consistent rather than inventing a second one),
// and a round-complete summary card with play-again/back actions.

import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
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

/** Stage-aware completion card for the 30-game stage/partition system - the
 * "Play Again" framing RoundComplete uses doesn't fit here, since a
 * completed stage should advance to the NEXT slice of Scripture, not replay
 * the same one. Shows the real "X of 10" progress and switches to a
 * whole-game completion message once the final stage is done. */
export function StageComplete({
  gameTitle,
  scoreLine,
  stagesCompleted,
  totalStages,
  isFinalStage,
  onContinue,
  onViewStats,
  onExit,
}: {
  gameTitle: string;
  scoreLine: string;
  stagesCompleted: number;
  totalStages: number;
  isFinalStage: boolean;
  onContinue: () => void;
  onViewStats: () => void;
  onExit: () => void;
}) {
  const { palette } = useKISTheme();
  const metallicGold = [palette.royalInk, palette.goldDeep, palette.gold, palette.goldDeep];

  return (
    <View style={[styles.completeCard, { backgroundColor: palette.card }]}>
      <View style={[styles.trophyCircle, { backgroundColor: palette.selectedBg }]}>
        <KISIcon name="trophy" size={30} color={palette.goldReadable} />
      </View>
      <Text style={[styles.completeTitle, { color: palette.text }]}>
        {isFinalStage ? `${gameTitle} complete!` : `Stage ${stagesCompleted} of ${totalStages} complete`}
      </Text>
      <Text style={[styles.completeScore, { color: palette.subtext }]}>{scoreLine}</Text>
      {isFinalStage ? (
        <Text style={[styles.completeScore, { color: palette.subtext, marginTop: -8 }]}>
          Every verse this game carries is done. Play the rest of the 30 games to cover the whole Bible.
        </Text>
      ) : null}

      {isFinalStage ? (
        <Pressable onPress={onViewStats} style={styles.primaryBtnWrap}>
          <LinearGradient colors={metallicGold} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.primaryBtn}>
            <Text style={[styles.primaryBtnText, { color: palette.ivory }]}>View Stats</Text>
          </LinearGradient>
        </Pressable>
      ) : (
        <Pressable onPress={onContinue} style={styles.primaryBtnWrap}>
          <LinearGradient colors={metallicGold} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.primaryBtn}>
            <Text style={[styles.primaryBtnText, { color: palette.ivory }]}>Next Stage</Text>
          </LinearGradient>
        </Pressable>
      )}

      <Pressable onPress={onExit} style={[styles.secondaryBtn, { borderColor: palette.selectedBg }]}>
        <Text style={[styles.secondaryBtnText, { color: palette.text }]}>Back to Games</Text>
      </Pressable>
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
});
