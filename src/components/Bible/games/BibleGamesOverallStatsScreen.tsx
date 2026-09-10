// src/components/Bible/games/BibleGamesOverallStatsScreen.tsx
//
// The one general stats page across all 30 games: total Bible verses,
// what each game carries, overall coverage, the aim ("finish all 30 games
// = read the whole Bible"), the times-completed-the-Bible counter, and the
// reset action - which the product requirement is explicit stays disabled
// until every one of the 30 games has reached its final stage.

import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import { useSocket } from '../../../../SocketProvider';
import BibleSectionCard from '../BibleSectionCard';
import ShareToChatModal from '../../broadcast/ShareToChatModal';
import type { Chat } from '@/Module/ChatRoom/messagesUtils';
import {
  areAllGamesCompleted,
  getCoverageSummary,
  isGameCompleted,
  resetAndReshuffle,
  STAGES_PER_GAME,
  TOTAL_GAMES,
  type GameCoverageSummary,
} from '../../../screens/tabs/bible/games/gameStorage';
import { GAME_METADATA } from '../../../screens/tabs/bible/games/gameMetadata';
import { shareGameStats } from './bibleGameShare';

export default function BibleGamesOverallStatsScreen({ onBack, onReset }: { onBack: () => void; onReset: () => void }) {
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const { socket } = useSocket();
  const [loading, setLoading] = useState(true);
  const [games, setGames] = useState<GameCoverageSummary[]>([]);
  const [totalBibleVerses, setTotalBibleVerses] = useState(0);
  const [timesCompletedBible, setTimesCompletedBible] = useState(0);
  const [allComplete, setAllComplete] = useState(false);
  const [shareVisible, setShareVisible] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [resetting, setResetting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [summary, complete] = await Promise.all([getCoverageSummary(), areAllGamesCompleted()]);
    setGames(summary.games);
    setTotalBibleVerses(summary.totalBibleVerses);
    setTimesCompletedBible(summary.timesCompletedBible);
    setAllComplete(complete);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const versesCovered = games.reduce((sum, g) => sum + g.versesCoveredByCompletedStages, 0);
  const gamesCompleted = games.filter((g) => isGameCompleted(g.progress)).length;
  const percent = totalBibleVerses > 0 ? Math.round((versesCovered / totalBibleVerses) * 100) : 0;

  const handleSharePicked = async (chat: Chat) => {
    setShareVisible(false);
    setSharing(true);
    const result = await shareGameStats(socket, chat, {
      scope: 'general',
      totalBibleVerses,
      versesCovered,
      gamesCompleted,
      totalGames: TOTAL_GAMES,
      timesCompletedBible,
    });
    setSharing(false);
    if (!result.ok) {
      Alert.alert('Share failed', result.error || 'Please try again.');
    } else {
      Alert.alert('Shared', `Overall progress shared to ${chat.name || 'chat'}.`);
    }
  };

  const handleReset = () => {
    if (!allComplete) return;
    Alert.alert(
      'Reset all games?',
      'Every game has finished its final stage — you’ve been through the whole Bible. Reset shuffles which verses each game carries next, so your next run is a new path through the same Bible.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset & Reshuffle', style: 'destructive',
          onPress: async () => {
            setResetting(true);
            await resetAndReshuffle();
            setResetting(false);
            await load();
            onReset();
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: palette.bg }]}>
        <ActivityIndicator color={palette.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.wrap, { backgroundColor: palette.bg, paddingTop: insets.top }]}>
      <View style={[styles.header, { paddingHorizontal: responsive.pageGutter }]}>
        <Pressable onPress={onBack} hitSlop={10} style={[styles.backBtn, { backgroundColor: palette.selectedBg }]}>
          <KISIcon name="back" size={18} color={palette.text} />
        </Pressable>
        <Text style={[styles.title, { color: palette.text }]} numberOfLines={1}>Bible Games — Overall Progress</Text>
        <Pressable
          onPress={() => setShareVisible(true)}
          disabled={sharing}
          hitSlop={10}
          style={[styles.backBtn, { backgroundColor: palette.selectedBg }]}
        >
          {sharing ? <ActivityIndicator size="small" color={palette.primary} /> : <KISIcon name="share" size={18} color={palette.primary} />}
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: responsive.pageGutter, paddingBottom: 40 + insets.bottom, gap: 14, paddingTop: 8 }}
        showsVerticalScrollIndicator={false}
      >
        <BibleSectionCard style={{ gap: 10 }}>
          <Text style={[styles.cardLabel, { color: palette.subtext }]}>The aim</Text>
          <Text style={{ color: palette.text, fontSize: 14, fontWeight: '700', lineHeight: 20 }}>
            Every one of the 30 games carries a real slice of the Bible. Finish every game&apos;s {STAGES_PER_GAME} stages
            and you will have gone through all {totalBibleVerses.toLocaleString()} verses in the Bible.
          </Text>
        </BibleSectionCard>

        <BibleSectionCard style={{ gap: 10 }}>
          <Text style={[styles.cardLabel, { color: palette.subtext }]}>Bible coverage</Text>
          <Text style={[styles.bigNumber, { color: palette.text }]}>
            {versesCovered.toLocaleString()} <Text style={{ fontSize: 16, fontWeight: '700' }}>/ {totalBibleVerses.toLocaleString()} verses</Text>
          </Text>
          <View style={[styles.progressTrack, { backgroundColor: palette.divider }]}>
            <View style={[styles.progressFill, { width: `${percent}%`, backgroundColor: palette.primaryStrong }]} />
          </View>
          <Text style={{ color: palette.subtext, fontSize: 12, fontWeight: '600' }}>{percent}% of the whole Bible</Text>
        </BibleSectionCard>

        <BibleSectionCard style={{ gap: 10 }}>
          <Text style={[styles.cardLabel, { color: palette.subtext }]}>Games completed</Text>
          <Text style={[styles.bigNumber, { color: palette.text }]}>{gamesCompleted} of {TOTAL_GAMES}</Text>
          {timesCompletedBible > 0 ? (
            <Text style={{ color: palette.goldReadable, fontSize: 13, fontWeight: '800' }}>
              You&apos;ve been through the whole Bible {timesCompletedBible} time{timesCompletedBible === 1 ? '' : 's'} using these games.
            </Text>
          ) : null}
        </BibleSectionCard>

        <BibleSectionCard style={{ gap: 8 }}>
          <Text style={[styles.cardLabel, { color: palette.subtext }]}>Each game&apos;s verses</Text>
          {games.map((g) => {
            const meta = GAME_METADATA[g.game];
            const complete = isGameCompleted(g.progress);
            return (
              <View key={g.game} style={styles.gameRow}>
                <KISIcon name={meta.icon} size={16} color={complete ? palette.success : palette.subtext} />
                <Text style={{ flex: 1, color: palette.text, fontSize: 13, fontWeight: '600' }} numberOfLines={1}>
                  {meta.title}
                </Text>
                <Text style={{ color: palette.subtext, fontSize: 12, fontWeight: '700' }}>
                  {g.verseCount.toLocaleString()} verses · {g.progress.stagesCompleted}/{STAGES_PER_GAME}
                </Text>
              </View>
            );
          })}
        </BibleSectionCard>

        <BibleSectionCard style={{ gap: 10 }}>
          <Text style={[styles.cardLabel, { color: palette.subtext }]}>Reset</Text>
          <Text style={{ color: palette.subtext, fontSize: 12, fontWeight: '600', lineHeight: 17 }}>
            {allComplete
              ? 'Every game is finished — resetting reshuffles which verses each game carries next.'
              : `Unlocks once all ${TOTAL_GAMES} games reach their final stage. ${gamesCompleted} of ${TOTAL_GAMES} done so far.`}
          </Text>
          <Pressable
            onPress={handleReset}
            disabled={!allComplete || resetting}
            style={[
              styles.resetBtn,
              { borderColor: allComplete ? palette.danger : palette.divider, opacity: allComplete ? 1 : 0.5 },
            ]}
          >
            {resetting ? (
              <ActivityIndicator size="small" color={palette.danger} />
            ) : (
              <Text style={{ color: allComplete ? palette.danger : palette.subtext, fontWeight: '800', fontSize: 13 }}>
                Reset &amp; Reshuffle All Games
              </Text>
            )}
          </Pressable>
        </BibleSectionCard>
      </ScrollView>

      <ShareToChatModal visible={shareVisible} onClose={() => setShareVisible(false)} onPicked={handleSharePicked} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 16, fontWeight: '900' },
  cardLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  bigNumber: { fontSize: 24, fontWeight: '900' },
  progressTrack: { height: 8, borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 999 },
  gameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  resetBtn: { borderWidth: 1.5, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
});
