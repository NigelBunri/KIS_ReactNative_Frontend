// src/screens/tabs/BibleScreen.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, DeviceEventEmitter, PanResponder, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { useKISTheme } from '../../theme/useTheme';
import { useStatusBarStyle } from '../../theme/useStatusBarStyle';
import { useResponsiveLayout } from '../../theme/responsive';
import { KIS_ROYAL_GRADIENTS } from '../../theme/constants';
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
  const headerScrollY = useRef(new Animated.Value(0)).current;
  const headerScrollOffsetRef = useRef(0);
  const gestureStartOffsetRef = useRef(0);
  const [topChromeHeight, setTopChromeHeight] = useState(240);
  const growthCounts = spiritualGrowthSummary?.counts ?? {};
  const growthReadiness = spiritualGrowthSummary?.readiness ?? {};

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

  const handleContentScroll = useMemo(
    () =>
      Animated.event(
        [{ nativeEvent: { contentOffset: { y: headerScrollY } } }],
        { useNativeDriver: false },
      ),
    [headerScrollY],
  );

  useEffect(() => {
    headerScrollY.setValue(0);
  }, [activeTab, headerScrollY]);

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
    const listenerId = headerScrollY.addListener(({ value }) => {
      headerScrollOffsetRef.current = value;
    });
    return () => headerScrollY.removeListener(listenerId);
  }, [headerScrollY]);

  const topChromeCollapseDistance = Math.max(topChromeHeight, 1);
  const clampHeaderOffset = useCallback(
    (value: number) => Math.max(0, Math.min(topChromeCollapseDistance, value)),
    [topChromeCollapseDistance],
  );
  const topAreaPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dy) > 8 &&
          Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.25,
        onPanResponderGrant: () => {
          gestureStartOffsetRef.current = headerScrollOffsetRef.current;
        },
        onPanResponderMove: (_, gesture) => {
          headerScrollY.setValue(
            clampHeaderOffset(gestureStartOffsetRef.current - gesture.dy),
          );
        },
        onPanResponderRelease: (_, gesture) => {
          const nextOffset = clampHeaderOffset(
            gestureStartOffsetRef.current - gesture.dy,
          );
          const shouldCollapse =
            gesture.vy < -0.35 || nextOffset > topChromeCollapseDistance * 0.45;
          const shouldExpand =
            gesture.vy > 0.35 || nextOffset < topChromeCollapseDistance * 0.18;
          Animated.spring(headerScrollY, {
            toValue: shouldExpand ? 0 : shouldCollapse ? topChromeCollapseDistance : nextOffset,
            useNativeDriver: false,
            friction: 9,
            tension: 90,
          }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(headerScrollY, {
            toValue: clampHeaderOffset(headerScrollOffsetRef.current),
            useNativeDriver: false,
            friction: 9,
            tension: 90,
          }).start();
        },
      }),
    [clampHeaderOffset, headerScrollY, topChromeCollapseDistance],
  );
  const topChromeAnimatedStyle = {
    height: headerScrollY.interpolate({
      inputRange: [0, topChromeCollapseDistance],
      outputRange: [topChromeHeight, 0],
      extrapolate: 'clamp',
    }),
    opacity: headerScrollY.interpolate({
      inputRange: [0, topChromeCollapseDistance * 0.8, topChromeCollapseDistance],
      outputRange: [1, 0.18, 0],
      extrapolate: 'clamp',
    }),
  };

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
            onScroll={handleContentScroll}
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
        return <BibleSettingsPanel translations={translations} />;
      default:
        return null;
    }
  };

  const streak = spiritualGrowthSummary?.journey?.streak ?? 0;

  return (
    <View style={[styles.wrap, { backgroundColor: palette.bg }]}>

      {/* ══════════════════════════════════════════════════════════════════════
          GOLD GRADIENT HEADER — same visual language as Messages + Broadcast
          but tailored for Scripture / spiritual growth.
          Curved bottom edge, luxury sheen, collapsing inner content.
          ══════════════════════════════════════════════════════════════════════ */}
      <LinearGradient
        colors={bibleGoldGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.goldHeader}
      >
        {/* Luxury shimmer across the very top */}
        <View style={styles.headerSheen} pointerEvents="none" />
        {/* Soft radial halo in the top-right corner for depth */}
        <View style={[styles.headerHalo, {marginTop: insets.top}]} />

        {/* ── Always-visible header bar ─────────────────────────────────── */}
        <View style={[styles.headerBar, { paddingTop: insets.top + (compactBible ? 10 : 16) , marginTop: 25}]}>
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

        {/* ── Collapsing section: subtitle + spiritual journey stats ────── */}
        <Animated.View
          {...topAreaPanResponder.panHandlers}
          style={[styles.topChrome, topChromeAnimatedStyle]}
        >
          <View
            style={styles.topChromeMeasure}
            onLayout={(event) => {
              const nextHeight = event.nativeEvent.layout.height;
              if (nextHeight > 0 && Math.abs(nextHeight - topChromeHeight) > 1) {
                setTopChromeHeight(nextHeight);
              }
            }}
          >
            {/* Brief subtitle */}
            <Text style={[styles.headerSubtitle, { color: 'rgba(255,244,184,0.78)', paddingHorizontal: responsive.pageGutter }]}>
              Read Scripture, pray, meditate, and track your spiritual reading journey.
            </Text>

            {/* Spiritual journey stats card */}
            <View style={[styles.growthCard, { backgroundColor: 'rgba(23,17,31,0.35)', borderColor: 'rgba(255,244,184,0.22)', marginHorizontal: responsive.pageGutter }]}>
              <View style={styles.growthHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.growthTitle, { color: palette.onGold }]}>
                    Your journey
                  </Text>
                  <Text style={[styles.growthSubtitle, { color: 'rgba(255,244,184,0.68)' }]}>
                    Scripture, prayer, notes, plans, and discipleship in one flow.
                  </Text>
                </View>
                {/* Streak badge — visible in the collapsing section */}
                <LinearGradient
                  colors={metallicGoldGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.streakBadge}
                >
                  <View pointerEvents="none" style={styles.goldSheen} />
                  <Text style={{ color: palette.ivory, fontSize: 19, fontWeight: '900', lineHeight: 23 }}>
                    {streak}
                  </Text>
                  <Text style={{ color: palette.ivory, fontSize: 9, fontWeight: '900', letterSpacing: 0.6, opacity: 0.90 }}>
                    DAY
                  </Text>
                </LinearGradient>
              </View>
              <View style={styles.growthStats}>
                {[
                  { label: 'Notes', value: growthCounts.notes ?? 0, icon: '📝' },
                  { label: 'Highlights', value: growthCounts.highlights ?? 0, icon: '✨' },
                  { label: 'Plans', value: growthCounts.active_reading_plans ?? 0, icon: '📅' },
                  { label: 'Missed', value: growthCounts.missed_reading_events ?? 0, icon: '⚠️' },
                ].map(item => (
                  <View
                    key={item.label}
                    style={[styles.growthStat, { backgroundColor: 'rgba(255,244,184,0.10)', borderColor: 'rgba(255,244,184,0.18)' }]}
                  >
                    <Text style={{ fontSize: 16, marginBottom: 2 }}>{item.icon}</Text>
                    <Text style={[styles.growthStatValue, { color: palette.onGold }]}>
                      {item.value > 99 ? '99+' : item.value}
                    </Text>
                    <Text style={[styles.growthStatLabel, { color: 'rgba(255,244,184,0.65)' }]}>
                      {item.label}
                    </Text>
                  </View>
                ))}
              </View>
              {/* Readiness signals */}
              <View style={styles.growthSignals}>
                {[
                  growthReadiness.family_safe_journey ? 'Family-safe ✓' : 'Safety pending',
                  growthReadiness.low_bandwidth_ready ? 'Offline-ready ✓' : 'Online-first',
                  growthReadiness.licensed_translations_ready ? 'Licensed ✓' : 'License review',
                  growthReadiness.study_courses_ready ? 'Study-ready ✓' : 'Study setup',
                ].map(label => (
                  <View key={label} style={[styles.growthSignal, { borderColor: 'rgba(255,244,184,0.28)', backgroundColor: 'rgba(255,244,184,0.08)' }]}>
                    <Text style={[styles.growthSignalText, { color: 'rgba(255,244,184,0.75)' }]}>
                      {label}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

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
          </View>
        </Animated.View>

        {/* ── Tab bar — inside the gradient so it's part of the gold header ── */}
        <View
          {...topAreaPanResponder.panHandlers}
          style={[styles.stickyTabsOuter, { paddingHorizontal: responsive.pageGutter }]}
        >
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
      </LinearGradient>

      {/* ══ Content area ═══════════════════════════════════════════════════ */}
      <View style={[styles.contentWrap, { marginTop: compactBible ? 8 : 12 }]}>
        {activeTab === 'read' ? (
          <View style={styles.readContent}>{renderTab()}</View>
        ) : (
          <Animated.ScrollView
            style={styles.contentScroll}
            contentContainerStyle={[
              styles.content,
              { gap: responsive.cardGap, paddingBottom: (compactBible ? 28 : 40) + insets.bottom },
            ]}
            showsVerticalScrollIndicator={false}
            onScroll={handleContentScroll}
            scrollEventThrottle={16}
            refreshControl={
              <RefreshControl
                refreshing={bibleRefreshing}
                onRefresh={handleBibleRefresh}
              />
            }
          >
            {renderTab()}
          </Animated.ScrollView>
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
  headerSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#FFF4B8',
    opacity: 0.45,
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

  // ── Streak badge (inside the collapsing section) ───────────────────────────
  streakBadge: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },

  // ── Collapsing top chrome ──────────────────────────────────────────────────
  topChrome: { overflow: 'hidden' },
  topChromeMeasure: { paddingBottom: 6 },

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
  growthCard: {
    borderWidth: 1.5,
    borderRadius: 20,
    padding: 14,
    marginTop: 12,
    marginBottom: 6,
    shadowOpacity: 0.14,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 20,
    elevation: 6,
    overflow: 'hidden',
  },
  growthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  growthTitle: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.1,
  },
  growthSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
    marginTop: 2,
  },
  goldSheen: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.16)',
    transform: [{ translateX: -14 }, { rotate: '-18deg' }, { scaleX: 0.42 }],
  },
  growthStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  growthStat: {
    flexGrow: 1,
    flexBasis: '22%',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  growthStatValue: {
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.1,
  },
  growthStatLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
    letterSpacing: 0.1,
  },
  growthSignals: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 12,
  },
  growthSignal: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  growthSignalText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
