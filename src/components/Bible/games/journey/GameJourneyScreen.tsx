// src/components/Bible/games/journey/GameJourneyScreen.tsx
//
// The screen every one of the 30 games opens into now, instead of jumping
// straight from the hub into gameplay (see BibleGamesPanel.tsx) — shows
// "where I am, what I've completed, what's next" per the product spec,
// using JourneyMap.tsx + journeyThemes.ts for the per-game visual identity
// and gameStorage.ts's getGameStageDescriptors for the actual lock/complete/
// current state. One shared screen (not 30 bespoke ones) - see
// journeyThemes.ts's docblock for why that's the right split.

import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import BibleSectionCard from '../../BibleSectionCard';
import JourneyMap from './JourneyMap';
import { getJourneyTheme } from './journeyThemes';
import { GAME_METADATA } from '../../../../screens/tabs/bible/games/gameMetadata';
import {
  getGameStageDescriptors,
  STAGES_PER_GAME,
  type GameKey,
  type StageDescriptor,
} from '../../../../screens/tabs/bible/games/gameStorage';

export type GameJourneyScreenProps = {
  gameKey: GameKey;
  onExit: () => void;
  onOpenStats: () => void;
  /** stageIndex is the tapped node; isReplay is true for an already-completed
   * stage (score updates only, progress never moves - see gameStorage.ts's
   * finishStage) and false for the current stage (the only one that can
   * still advance the journey). */
  onEnterStage: (stageIndex: number, isReplay: boolean) => void;
};

export default function GameJourneyScreen({ gameKey, onExit, onOpenStats, onEnterStage }: GameJourneyScreenProps) {
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const meta = GAME_METADATA[gameKey];
  const theme = getJourneyTheme(gameKey);
  const [stages, setStages] = useState<StageDescriptor[] | null>(null);

  const load = useCallback(() => {
    getGameStageDescriptors(gameKey).then(setStages);
  }, [gameKey]);

  useEffect(() => { load(); }, [load]);

  if (!stages) {
    return (
      <View style={[styles.center, { backgroundColor: palette.bg }]}>
        <ActivityIndicator color={palette.primary} />
      </View>
    );
  }

  const completedCount = stages.filter((s) => s.status === 'completed').length;
  const versesCovered = stages.filter((s) => s.status === 'completed').reduce((sum, s) => sum + s.verseCount, 0);
  const totalVerses = stages.reduce((sum, s) => sum + s.verseCount, 0);
  const currentStage = stages.find((s) => s.status === 'current');
  const isFullyComplete = completedCount >= STAGES_PER_GAME;

  return (
    <View style={[styles.wrap, { backgroundColor: palette.bg, paddingTop: insets.top }]}>
      <View style={[styles.header, { paddingHorizontal: responsive.pageGutter }]}>
        <Pressable onPress={onExit} hitSlop={10} style={[styles.backBtn, { backgroundColor: palette.selectedBg }]}>
          <KISIcon name="back" size={18} color={palette.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: palette.text }]} numberOfLines={1}>{meta.title}</Text>
          <Text style={[styles.subtitle, { color: theme.accent }]} numberOfLines={1}>{theme.journeyTitle}</Text>
        </View>
        <Pressable onPress={onOpenStats} hitSlop={10} style={[styles.backBtn, { backgroundColor: palette.selectedBg }]}>
          <KISIcon name="bar-chart" size={16} color={palette.primary} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingHorizontal: responsive.pageGutter, paddingBottom: 40 + insets.bottom }]}
      >
        <BibleSectionCard style={{ gap: 8 }}>
          <Text style={{ color: palette.subtext, fontSize: 13, fontWeight: '600', lineHeight: 18 }}>
            {theme.journeyTagline}
          </Text>
          <View style={styles.summaryRow}>
            <SummaryStat label="Stage" value={`${Math.min(completedCount + 1, STAGES_PER_GAME)} / ${STAGES_PER_GAME}`} color={theme.accent} />
            <SummaryStat label="Verses covered" value={versesCovered.toLocaleString()} color={theme.accent} />
            <SummaryStat label="Total verses" value={totalVerses.toLocaleString()} color={palette.subtext} />
          </View>
        </BibleSectionCard>

        <View style={[styles.mapCard, { backgroundColor: palette.card }]}>
          <JourneyMap
            theme={theme}
            stages={stages}
            icon={meta.icon}
            onSelectStage={(index) => {
              const stage = stages[index];
              if (stage.status === 'locked') return;
              onEnterStage(index, stage.status === 'completed');
            }}
          />
        </View>

        <View style={styles.legendRow}>
          <LegendDot color={theme.accent} label="Completed" />
          <LegendDot color={palette.card} borderColor={theme.accent} label="Current" />
          <LegendDot color={palette.selectedBg} label="Locked" />
        </View>

        {isFullyComplete ? (
          <View style={[styles.doneBanner, { backgroundColor: palette.selectedBg, borderColor: theme.accent }]}>
            <KISIcon name="trophy" size={18} color={theme.accent} />
            <Text style={{ color: palette.text, fontSize: 13, fontWeight: '700', flex: 1 }}>
              Every stage of {theme.journeyTitle} is complete. Tap any stage to replay and improve your score.
            </Text>
          </View>
        ) : currentStage ? (
          <Pressable
            onPress={() => onEnterStage(currentStage.index, false)}
            style={[styles.continueBtn, { backgroundColor: theme.accent }]}
          >
            <Text style={[styles.continueBtnText, { color: palette.ivory }]}>
              {completedCount === 0 ? 'Begin Stage 1' : `Continue — Stage ${currentStage.index + 1}`}
            </Text>
            <KISIcon name="chevron-right" size={16} color={palette.ivory} />
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

function SummaryStat({ label, value, color }: { label: string; value: string; color: string }) {
  const { palette } = useKISTheme();
  return (
    <View style={{ flex: 1 }}>
      <Text style={[styles.summaryValue, { color }]}>{value}</Text>
      <Text style={[styles.summaryLabel, { color: palette.subtext }]}>{label}</Text>
    </View>
  );
}

function LegendDot({ color, borderColor, label }: { color: string; borderColor?: string; label: string }) {
  const { palette } = useKISTheme();
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendSwatch, { backgroundColor: color, borderColor: borderColor ?? color }]} />
      <Text style={{ color: palette.subtext, fontSize: 11, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '900' },
  subtitle: { fontSize: 11, fontWeight: '800', marginTop: 1 },
  scrollContent: { gap: 14, paddingTop: 8 },
  summaryRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  summaryValue: { fontSize: 18, fontWeight: '900' },
  summaryLabel: { fontSize: 10, fontWeight: '700', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.4 },
  mapCard: { borderRadius: 20, padding: 16 },
  legendRow: { flexDirection: 'row', gap: 16, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendSwatch: { width: 12, height: 12, borderRadius: 6, borderWidth: 1.5 },
  doneBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, padding: 14 },
  continueBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 999, paddingVertical: 15 },
  continueBtnText: { fontSize: 15, fontWeight: '900' },
});
