// src/screens/tabs/BibleScreen.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, DeviceEventEmitter, PanResponder, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useKISTheme } from '../../theme/useTheme';
import { useResponsiveLayout } from '../../theme/responsive';
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
import { MainTabPageHeader } from '@/components/common/MainTabScaffold';
import ConsumerSpiritualRevenuePreviewCard from '@/components/profitability/ConsumerSpiritualRevenuePreviewCard';
import NotificationRetentionPreviewCard from '@/components/profitability/NotificationRetentionPreviewCard';

export default function BibleScreen() {
  const {
    translations,
    books,
    reader,
    devotionals,
    meditations,
    loadingReader,
    loadingDaily,
    loadingMeditations,
    spiritualGrowthSummary,
    loadReader,
  } = useBibleData();
  const { palette, tone } = useKISTheme();
  const responsive = useResponsiveLayout();
  const compactBible = responsive.isWatch || responsive.isCompactPhone;
  const tinyBible = responsive.isWatch;
  const metallicGoldGradient = tone === 'dark'
    ? ['#3B271E', '#6F4515', '#B9852E', '#56321F']
    : ['#5A372D', '#8A5A12', '#D9A875', '#7A4B3E'];
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
      { key: 'lessons', label: 'Lessons', icon: 'layers' },
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
            loading={loadingReader}
            onLoad={loadReader}
            onRegisterFilterOpener={registerReadFilterOpener}
            onScroll={handleContentScroll}
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

  return (
    <View style={[styles.wrap, { backgroundColor: palette.bg, paddingHorizontal: responsive.pageGutter }]}>
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
          <MainTabPageHeader
            eyebrow="Spiritual growth"
            title="Bible"
            subtitle="Read Scripture, follow daily passages, pray, learn, and keep your personal reading plans in one calm place."
            secondaryAction={
              activeTab === 'read' && openReadFilters
                ? {
                    label: 'Filters',
                    icon: 'filter',
                    onPress: openReadFilters,
                  }
                : undefined
            }
          />

          <View
            style={[
              styles.growthCard,
              {
                backgroundColor: palette.surface,
                borderColor: palette.goldLight,
                shadowColor: palette.shadow ?? '#000',
              },
            ]}
          >
            <View style={styles.growthHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.growthTitle, { color: palette.text }]}>
                  Spiritual journey
                </Text>
                <Text style={[styles.growthSubtitle, { color: palette.subtext }]}>
                  Scripture, prayer, notes, plans, and safe discipleship in one flow.
                </Text>
              </View>
              <View style={[styles.streakBadge, { backgroundColor: palette.primarySoft }]}>
                <Text style={{ color: palette.primaryStrong, fontSize: 16, fontWeight: '900' }}>
                  {spiritualGrowthSummary?.journey?.streak ?? 0}
                </Text>
                <Text style={{ color: palette.primaryStrong, fontSize: 9, fontWeight: '900' }}>
                  DAY
                </Text>
              </View>
            </View>
            <View style={styles.growthStats}>
              {[
                { label: 'Notes', value: growthCounts.notes ?? 0 },
                { label: 'Highlights', value: growthCounts.highlights ?? 0 },
                { label: 'Plans', value: growthCounts.active_reading_plans ?? 0 },
                { label: 'Missed', value: growthCounts.missed_reading_events ?? 0 },
              ].map(item => (
                <View
                  key={item.label}
                  style={[
                    styles.growthStat,
                    { backgroundColor: palette.card, borderColor: palette.goldLight },
                  ]}
                >
                  <Text style={[styles.growthStatValue, { color: palette.text }]}>
                    {item.value > 99 ? '99+' : item.value}
                  </Text>
                  <Text style={[styles.growthStatLabel, { color: palette.subtext }]}>
                    {item.label}
                  </Text>
                </View>
              ))}
            </View>
            <View style={styles.growthSignals}>
              {[
                growthReadiness.family_safe_journey ? 'Family-safe' : 'Safety ready',
                growthReadiness.low_bandwidth_ready ? 'Low-bandwidth' : 'Online-first',
                growthReadiness.licensed_translations_ready ? 'Licensed text' : 'License review',
                growthReadiness.study_courses_ready ? 'Study ready' : 'Study setup',
              ].map(label => (
                <View key={label} style={[styles.growthSignal, { borderColor: palette.goldLight }]}>
                  <Text style={[styles.growthSignalText, { color: palette.text }]}>
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

      <View
        {...topAreaPanResponder.panHandlers}
        style={[
          styles.stickyTabsOuter,
          { backgroundColor: palette.bg, paddingBottom: compactBible ? 0 : 2 },
        ]}
      >
        <View style={[styles.tabsWrapper, { paddingVertical: compactBible ? 5 : 8 }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.tabRow, { gap: compactBible ? 6 : 8 }]}>
            {tabs.map((tab) => {
              const isActive = tab.key === activeTab;
              return (
                <TouchableOpacity
                  key={tab.key}
                  onPress={() => setActiveTab(tab.key)}
                  style={[
                    styles.tabChip,
                    {
                      backgroundColor: isActive ? palette.goldDeep : palette.surface,
                      borderColor: isActive ? palette.goldLight : palette.divider,
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
                      color={isActive ? palette.ivory : palette.subtext}
                    />
                    <Text
                      numberOfLines={1}
                      style={{ color: isActive ? palette.ivory : palette.text, fontWeight: '800' }}
                    >
                      {tabLabelForDevice(tab.label, tab.key)}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>

      <View style={styles.contentWrap}>
        {activeTab === 'read' ? (
          <View style={styles.readContent}>{renderTab()}</View>
        ) : (
          <Animated.ScrollView
            style={styles.contentScroll}
            contentContainerStyle={[
              styles.content,
              { gap: responsive.cardGap, paddingBottom: compactBible ? 28 : 40 },
            ]}
            showsVerticalScrollIndicator={false}
            onScroll={handleContentScroll}
            scrollEventThrottle={16}
          >
            {renderTab()}
          </Animated.ScrollView>
        )}
      </View>

      {activeTab === 'read' && openReadFilters ? (
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={openReadFilters}
          style={[
            styles.floatingFilter,
            {
              backgroundColor: palette.goldDeep,
              width: compactBible ? 48 : 58,
              height: compactBible ? 48 : 58,
              borderRadius: compactBible ? 24 : 29,
              right: responsive.pageGutter,
            },
          ]}
        >
          <LinearGradient
            colors={metallicGoldGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <View pointerEvents="none" style={styles.goldSheen} />
          <KISIcon name="filter" size={22} color={palette.ivory} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingVertical: 16 },
  topChrome: { overflow: 'hidden' },
  topChromeMeasure: { paddingBottom: 2 },
  stickyTabsOuter: { zIndex: 10, paddingTop: 2, paddingBottom: 2 },
  tabsWrapper: { paddingVertical: 8 },
  tabRow: { gap: 8, paddingVertical: 4, alignItems: 'center' },
  tabChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 2,
    minHeight: 32,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  tabLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  contentWrap: { flex: 1, minHeight: 0 },
  readContent: { flex: 1, minHeight: 0 },
  contentScroll: { flex: 1 },
  content: { paddingVertical: 16, gap: 16, paddingBottom: 40 },
  floatingFilter: {
    position: 'absolute',
    right: 22,
    bottom: 24,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 14,
    elevation: 8,
    zIndex: 20,
    overflow: 'hidden',
  },
  growthCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
    marginTop: 12,
    marginBottom: 6,
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 7 },
    shadowRadius: 15,
    elevation: 4,
  },
  growthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  growthTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  growthSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
    marginTop: 2,
  },
  streakBadge: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
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
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  growthStatValue: {
    fontSize: 15,
    fontWeight: '900',
  },
  growthStatLabel: {
    fontSize: 10,
    fontWeight: '800',
    marginTop: 2,
  },
  growthSignals: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 10,
  },
  growthSignal: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  growthSignalText: {
    fontSize: 10,
    fontWeight: '800',
  },
  goldSheen: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.16)',
    transform: [{ translateX: -18 }, { rotate: '-18deg' }, { scaleX: 0.42 }],
  },
});
