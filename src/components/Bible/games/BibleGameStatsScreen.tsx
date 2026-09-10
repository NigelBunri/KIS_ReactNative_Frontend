// src/components/Bible/games/BibleGameStatsScreen.tsx
//
// One shared, parameterized stats screen for all 30 games - not 30 bespoke
// ones. Shows this game's own stage progress (X of 10), how many of the
// Bible's verses this game carries, best score, and a "Share to chat"
// action that posts a real card via bibleGameShare.ts/ShareToChatModal.

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import { useSocket } from '../../../../SocketProvider';
import BibleSectionCard from '../BibleSectionCard';
import ShareToChatModal from '../../broadcast/ShareToChatModal';
import type { Chat } from '@/Module/ChatRoom/messagesUtils';
import {
  getBestScores,
  getCoverageSummary,
  STAGES_PER_GAME,
  type GameCoverageSummary,
  type GameKey,
} from '../../../screens/tabs/bible/games/gameStorage';
import { GAME_METADATA } from '../../../screens/tabs/bible/games/gameMetadata';
import { shareGameStats } from './bibleGameShare';

export default function BibleGameStatsScreen({ gameKey, onBack }: { gameKey: GameKey; onBack: () => void }) {
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const { socket } = useSocket();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<GameCoverageSummary | null>(null);
  const [bestScore, setBestScore] = useState<number | undefined>(undefined);
  const [shareVisible, setShareVisible] = useState(false);
  const [sharing, setSharing] = useState(false);

  const meta = GAME_METADATA[gameKey];

  useEffect(() => {
    let active = true;
    Promise.all([getCoverageSummary(), getBestScores()]).then(([coverage, scores]) => {
      if (!active) return;
      setSummary(coverage.games.find((g) => g.game === gameKey) ?? null);
      setBestScore(scores[gameKey]?.best);
      setLoading(false);
    });
    return () => { active = false; };
  }, [gameKey]);

  const handleSharePicked = async (chat: Chat) => {
    setShareVisible(false);
    if (!summary) return;
    setSharing(true);
    const result = await shareGameStats(socket, chat, {
      scope: 'game',
      gameKey,
      gameTitle: meta.title,
      stagesCompleted: summary.progress.stagesCompleted,
      totalStages: STAGES_PER_GAME,
      verseCount: summary.verseCount,
      bestScore,
    });
    setSharing(false);
    if (!result.ok) {
      Alert.alert('Share failed', result.error || 'Please try again.');
    } else {
      Alert.alert('Shared', `${meta.title} progress shared to ${chat.name || 'chat'}.`);
    }
  };

  if (loading || !summary) {
    return (
      <View style={[styles.center, { backgroundColor: palette.bg }]}>
        <ActivityIndicator color={palette.primary} />
      </View>
    );
  }

  const percent = Math.round((summary.progress.stagesCompleted / STAGES_PER_GAME) * 100);

  return (
    <View style={[styles.wrap, { backgroundColor: palette.bg, paddingTop: insets.top }]}>
      <View style={[styles.header, { paddingHorizontal: responsive.pageGutter }]}>
        <Pressable onPress={onBack} hitSlop={10} style={[styles.backBtn, { backgroundColor: palette.selectedBg }]}>
          <KISIcon name="back" size={18} color={palette.text} />
        </Pressable>
        <Text style={[styles.title, { color: palette.text }]} numberOfLines={1}>{meta.title} — Stats</Text>
        <Pressable
          onPress={() => setShareVisible(true)}
          disabled={sharing}
          hitSlop={10}
          style={[styles.backBtn, { backgroundColor: palette.selectedBg }]}
        >
          {sharing ? <ActivityIndicator size="small" color={palette.primary} /> : <KISIcon name="share" size={18} color={palette.primary} />}
        </Pressable>
      </View>

      <View style={{ paddingHorizontal: responsive.pageGutter, gap: 14, paddingTop: 8 }}>
        <BibleSectionCard style={{ gap: 10 }}>
          <Text style={[styles.cardLabel, { color: palette.subtext }]}>Stage progress</Text>
          <Text style={[styles.bigNumber, { color: palette.text }]}>
            {summary.progress.stagesCompleted} of {STAGES_PER_GAME}
          </Text>
          <View style={[styles.progressTrack, { backgroundColor: palette.divider }]}>
            <View style={[styles.progressFill, { width: `${percent}%`, backgroundColor: palette.primaryStrong }]} />
          </View>
          {summary.progress.stagesCompleted >= STAGES_PER_GAME ? (
            <Text style={{ color: palette.success, fontWeight: '800', fontSize: 13 }}>
              Completed — every verse this game carries is done.
            </Text>
          ) : null}
        </BibleSectionCard>

        <BibleSectionCard style={{ gap: 10 }}>
          <Text style={[styles.cardLabel, { color: palette.subtext }]}>Verses this game carries</Text>
          <Text style={[styles.bigNumber, { color: palette.text }]}>{summary.verseCount.toLocaleString()}</Text>
          <Text style={{ color: palette.subtext, fontSize: 12, fontWeight: '600' }}>
            {summary.versesCoveredByCompletedStages.toLocaleString()} covered so far
          </Text>
        </BibleSectionCard>

        {typeof bestScore === 'number' ? (
          <BibleSectionCard style={{ gap: 10 }}>
            <Text style={[styles.cardLabel, { color: palette.subtext }]}>Best score</Text>
            <Text style={[styles.bigNumber, { color: palette.text }]}>{bestScore}</Text>
          </BibleSectionCard>
        ) : null}
      </View>

      <ShareToChatModal visible={shareVisible} onClose={() => setShareVisible(false)} onPicked={handleSharePicked} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 17, fontWeight: '900' },
  cardLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  bigNumber: { fontSize: 26, fontWeight: '900' },
  progressTrack: { height: 8, borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 999 },
});
