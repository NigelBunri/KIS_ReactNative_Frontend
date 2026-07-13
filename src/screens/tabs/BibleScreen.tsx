// src/screens/tabs/BibleScreen.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DeviceEventEmitter,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRawTopInset } from '@/hooks/useSafeTopInset';
import LinearGradient from 'react-native-linear-gradient';
import { useKISTheme } from '../../theme/useTheme';
import { useStatusBarStyle } from '../../theme/useStatusBarStyle';
import { useResponsiveLayout } from '../../theme/responsive';
import { KIS_ROYAL_GRADIENTS } from '../../theme/constants';
import { useGoldenSectionContent } from '@/contexts/GoldenSectionContext';
import { useBibleData } from './bible/useBibleData';
import DailyDevotionsPanel from '../../components/Bible/DailyDevotionsPanel';
import BibleReaderPanel from '../../components/Bible/BibleReaderPanel';
import MeditationPanel from '../../components/Bible/MeditationPanel';
import BiblePlansPanel from '../../components/Bible/BiblePlansPanel';
import PrayerPanel from '../../components/Bible/PrayerPanel';
import BibleLessonsPanel from '../../components/Bible/BibleLessonsPanel';
import BibleSettingsPanel from '../../components/Bible/BibleSettingsPanel';
import BibleBooksPanel from '../../components/Bible/BibleBooksPanel';
import BibleMessagesPanel from '../../components/Bible/BibleMessagesPanel';
import { KISIcon } from '../../constants/kisIcons';
import { markMainTabNotificationSourceRead } from '@/services/mainTabNotificationBadges';
import ConsumerSpiritualRevenuePreviewCard from '@/components/profitability/ConsumerSpiritualRevenuePreviewCard';
import NotificationRetentionPreviewCard from '@/components/profitability/NotificationRetentionPreviewCard';

export default function BibleScreen() {
  const {
    translations,
    books,
    reader,
    readerError,
    devotionals,
    meditations,
    loadingReader,
    loadingDaily,
    loadingMeditations,
    spiritualGrowthSummary,
    loadReader,
    reload: reloadBible,
  } = useBibleData();
  const [bibleRefreshing, setBibleRefreshing] = React.useState(false);
  const handleBibleRefresh = React.useCallback(async () => {
    setBibleRefreshing(true);
    try {
      await reloadBible();
    } finally {
      setBibleRefreshing(false);
    }
  }, [reloadBible]);
  const insets = useSafeAreaInsets();
  // Opts out of the app-wide GLOBAL_TOP_PADDING dial (useSafeTopInset) — this
  // is one of the 5 main-tab gold-header screens with its own hand-tuned
  // spacing, so it reads the raw (corrected) device inset instead.
  const topInset = useRawTopInset();
  const { palette, tone } = useKISTheme();
  // Gold header always needs dark icons (same as Broadcast + Messages)
  useStatusBarStyle(tone, 'dark-content');
  const responsive = useResponsiveLayout();
  const compactBible = responsive.isWatch || responsive.isCompactPhone;
  const tinyBible = responsive.isWatch;
  const metallicGoldGradient = [palette.royalInk, palette.goldDeep, palette.gold, palette.goldDeep];
  // The same gold header gradient used across Messages and Broadcast screens
  const bibleGoldGradient = [...KIS_ROYAL_GRADIENTS.goldHeader];
  const [activeTab, setActiveTab] = useState('read');
  const [openReadFilters, setOpenReadFilters] = useState<(() => void) | null>(null);

  const tabs = useMemo(
    () => [
      { key: 'read', label: 'Read', icon: 'book' },
      { key: 'daily', label: 'Daily', icon: 'calendar' },
      { key: 'meditations', label: 'Meditations', icon: 'sparkles' },
      { key: 'prayer-calendar', label: 'Prayer Calendar', icon: 'heart' },
      { key: 'reading-planner', label: 'Reading Planner', icon: 'list' },
      { key: 'discipleship', label: 'Discipleship', icon: 'layers' },
      { key: 'books', label: 'Books', icon: 'library' },
      { key: 'messages', label: 'Messages', icon: 'videocam' },
      { key: 'settings', label: 'Settings', icon: 'settings' },
    ],
    [],
  );

  const registerReadFilterOpener = useCallback((open: () => void) => {
    setOpenReadFilters(() => open);
  }, []);

  // Listen for bible.verse.open events from global search
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('bible.verse.open', (payload: any) => {
      setActiveTab('read');
      if (payload?.reference) {
        loadReader(undefined, undefined, undefined, String(payload.reference));
      } else if (payload?.book && payload?.chapter) {
        const startVerse = payload.verse ? Number(payload.verse) : undefined;
        loadReader(undefined, String(payload.book), Number(payload.chapter), undefined, startVerse);
      }
    });
    return () => sub.remove();
  }, [loadReader]);

  useEffect(() => {
    if (activeTab === 'daily') {
      markMainTabNotificationSourceRead({
        source: 'bible',
        targetType: 'bible_daily_passage',
      }).catch(() => undefined);
    } else if (activeTab === 'meditations') {
      markMainTabNotificationSourceRead({
        source: 'bible',
        targetType: 'bible_meditation_post',
      }).catch(() => undefined);
    } else if (activeTab === 'reading-planner') {
      markMainTabNotificationSourceRead({
        source: 'bible',
        targetType: 'bible_reading_event',
      }).catch(() => undefined);
    }
  }, [activeTab]);

  const tabLabelForDevice = (label: string, key: string) => {
    if (!compactBible) return label;
    if (key === 'prayer-calendar') return 'Prayer';
    if (key === 'reading-planner') return 'Plan';
    if (key === 'meditations') return 'Meditate';
    return label;
  };

  const renderTab = () => {
    switch (activeTab) {
      case 'read':
        return (
          <BibleReaderPanel
            translations={translations}
            books={books}
            reader={reader}
            readerError={readerError}
            loading={loadingReader}
            onLoad={loadReader}
            onRegisterFilterOpener={registerReadFilterOpener}
            onRefresh={handleBibleRefresh}
            refreshing={bibleRefreshing}
          />
        );
      case 'daily':
        return <DailyDevotionsPanel devotionals={devotionals} loading={loadingDaily} />;
      case 'meditations':
        return <MeditationPanel meditations={meditations} loading={loadingMeditations} />;
      case 'prayer-calendar':
        return <PrayerPanel />;
      case 'reading-planner':
        return <BiblePlansPanel />;
      case 'discipleship':
      case 'lessons':
        return <BibleLessonsPanel />;
      case 'books':
        return <BibleBooksPanel />;
      case 'messages':
        return <BibleMessagesPanel />;
      case 'settings':
        return <BibleSettingsPanel translations={translations} spiritualGrowthSummary={spiritualGrowthSummary} />;
      default:
        return null;
    }
  };

  // Registered with the shared Golden Section host in App.tsx instead of
  // rendering GoldHeaderShell locally — stays mounted across tab switches.
  // A plain, static header now (identity bar + tab row): the collapsing
  // "Your journey" stats card that used to live here moved to the Settings
  // tab (BibleSettingsPanel), so there's no scroll-driven collapse animation
  // to drive anymore.
  useGoldenSectionContent({
    content: (
      <>
        {/* Soft radial halo in the top-right corner for depth */}
        <View style={[styles.headerHalo, {marginTop: topInset}]} />

        {/* ── Always-visible header bar ─────────────────────────────────── */}
        <View style={[styles.headerBar, { paddingTop: topInset + (compactBible ? 34 : 40) }]}>
          {/* Left: icon + eyebrow + title */}
          <View style={styles.headerTitleGroup}>
            <View style={styles.headerIconCircle}>
              <Text style={{ fontSize: compactBible ? 18 : 22 }}>✝</Text>
            </View>
            <View>
              <Text style={[styles.headerEyebrow, { color: 'rgba(255,244,184,0.72)' }]}>
                Spiritual growth
              </Text>
              <Text style={[styles.headerTitle, { color: palette.onGold, fontSize: compactBible ? 22 : 28 }]}>
                Bible
              </Text>
            </View>
          </View>

          {/* Right: filter + settings only (streak is shown inside the collapsing section) */}
          <View style={styles.headerActions}>
            {/* Filter — only on Read tab */}
            {activeTab === 'read' && openReadFilters ? (
              <Pressable
                onPress={openReadFilters}
                style={[styles.headerIconBtn, { backgroundColor: 'rgba(23,17,31,0.28)', borderColor: 'rgba(255,244,184,0.30)' }]}
                hitSlop={6}
                accessibilityLabel="Filters"
              >
                <KISIcon name="filter" size={17} color={palette.onGold} />
              </Pressable>
            ) : null}

            {/* Settings shortcut */}
            <Pressable
              onPress={() => setActiveTab('settings')}
              style={[styles.headerIconBtn, {
                backgroundColor: activeTab === 'settings' ? 'rgba(255,244,184,0.22)' : 'rgba(23,17,31,0.28)',
                borderColor: 'rgba(255,244,184,0.30)',
              }]}
              hitSlop={6}
              accessibilityLabel="Settings"
            >
              <KISIcon name="settings" size={17} color={palette.onGold} />
            </Pressable>
          </View>
        </View>

        {/* ── Tab bar — inside the gradient so it's part of the gold header ── */}
        <View style={[styles.stickyTabsOuter, { paddingHorizontal: responsive.pageGutter }]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.tabRow, { gap: compactBible ? 6 : 8, paddingVertical: compactBible ? 8 : 10 }]}
          >
            {tabs.map((tab) => {
              const isActive = tab.key === activeTab;
              return (
                <TouchableOpacity
                  key={tab.key}
                  onPress={() => setActiveTab(tab.key)}
                  style={[
                    styles.tabChip,
                    {
                      backgroundColor: isActive ? 'rgba(255,244,184,0.22)' : 'rgba(23,17,31,0.30)',
                      borderColor: isActive ? 'rgba(255,244,184,0.60)' : 'rgba(255,244,184,0.18)',
                      paddingHorizontal: compactBible ? 10 : 14,
                      paddingVertical: compactBible ? 7 : 8,
                      minHeight: tinyBible ? 30 : 34,
                    },
                  ]}
                >
                  {isActive ? (
                    <LinearGradient
                      colors={metallicGoldGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFillObject}
                    />
                  ) : null}
                  {isActive ? <View pointerEvents="none" style={styles.goldSheen} /> : null}
                  <View style={styles.tabLabel}>
                    <KISIcon
                      name={tab.icon as any}
                      size={14}
                      color={isActive ? palette.ivory : 'rgba(255,244,184,0.65)'}
                    />
                    <Text
                      numberOfLines={1}
                      style={{ color: isActive ? palette.ivory : 'rgba(255,244,184,0.80)', fontWeight: '800', fontSize: compactBible ? 11 : 13 }}
                    >
                      {tabLabelForDevice(tab.label, tab.key)}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </>
    ),
    colors: bibleGoldGradient,
    shellStyle: styles.goldHeader,
  });

  return (
    <View style={[styles.wrap, { backgroundColor: palette.bg}]}>
      {/* ══ Content area ═══════════════════════════════════════════════════ */}
      <View style={[styles.contentWrap, { marginTop: compactBible ? 8 : 12 }]}>
        {activeTab === 'read' ? (
          <View style={styles.readContent}>{renderTab()}</View>
        ) : (
          <ScrollView
            style={styles.contentScroll}
            contentContainerStyle={[
              styles.content,
              { gap: responsive.cardGap, paddingBottom: (compactBible ? 28 : 40) + insets.bottom },
            ]}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={bibleRefreshing}
                onRefresh={handleBibleRefresh}
              />
            }
          >
            <Text style={[styles.headerSubtitle, { color: palette.subtext, paddingHorizontal: responsive.pageGutter }]}>
              Read Scripture, pray, meditate, and track your spiritual reading journey.
            </Text>
            <ConsumerSpiritualRevenuePreviewCard
              palette={palette}
              kind="bible_home"
              title="Bible and family growth preview"
              subtitle="Consumer Plus and Family Plus are visible here for planning only; current Bible, prayer, meditation, and reading features stay available."
            />
            <NotificationRetentionPreviewCard
              palette={palette}
              kind="bible"
              title="Spiritual reminder preview"
              subtitle="Smarter reading, prayer, meditation, and family devotional reminders are preview-only."
            />
            {renderTab()}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // ── Root ───────────────────────────────────────────────────────────────────
  wrap: { flex: 1 },

  // ── Gold gradient header (the full top panel) ──────────────────────────────
  goldHeader: {
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  headerHalo: {
    position: 'absolute',
    top: -40,
    right: -20,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#C9A24A',
    opacity: 0.14,
  },

  // ── Header bar row ─────────────────────────────────────────────────────────
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  headerTitleGroup: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(23,17,31,0.32)',
    borderWidth: 1,
    borderColor: 'rgba(255,244,184,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerEyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  headerTitle: { fontWeight: '900', letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 13, fontWeight: '600', lineHeight: 19, marginTop: 4, marginBottom: 10 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Tab row (inside gradient) ──────────────────────────────────────────────
  stickyTabsOuter: { paddingBottom: 12 },
  tabRow: { alignItems: 'center' },
  tabChip: {
    borderRadius: 999,
    borderWidth: 1.5,
    minHeight: 34,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  tabLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  // ── Content area ───────────────────────────────────────────────────────────
  contentWrap: { flex: 1, minHeight: 0 },
  readContent: { flex: 1, minHeight: 0 },
  contentScroll: { flex: 1 },
  content: { paddingVertical: 16, gap: 16, paddingBottom: 40 },
  goldSheen: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.16)',
    transform: [{ translateX: -14 }, { rotate: '-18deg' }, { scaleX: 0.42 }],
  },
});
