// src/screens/tabs/BibleScreen.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useKISTheme } from '../../theme/useTheme';
import { useBibleData } from './bible/useBibleData';
import DailyDevotionsPanel from '../../components/Bible/DailyDevotionsPanel';
import BibleReaderPanel from '../../components/Bible/BibleReaderPanel';
import MeditationPanel from '../../components/Bible/MeditationPanel';
import BiblePlansPanel from '../../components/Bible/BiblePlansPanel';
import PrayerPanel from '../../components/Bible/PrayerPanel';
import BibleLessonsPanel from '../../components/Bible/BibleLessonsPanel';
import BibleSettingsPanel from '../../components/Bible/BibleSettingsPanel';
import { KISIcon } from '../../constants/kisIcons';
import { markMainTabNotificationSourceRead } from '@/services/mainTabNotificationBadges';
import { MainTabPageHeader } from '@/components/common/MainTabScaffold';
import ConsumerSpiritualRevenuePreviewCard from '@/components/profitability/ConsumerSpiritualRevenuePreviewCard';
import NotificationRetentionPreviewCard from '@/components/profitability/NotificationRetentionPreviewCard';

export default function BibleScreen() {
  const { palette, tone } = useKISTheme();
  const metallicGoldGradient = tone === 'dark'
    ? ['#3B271E', '#6F4515', '#B9852E', '#56321F']
    : ['#5A372D', '#8A5A12', '#D9A875', '#7A4B3E'];
  const [activeTab, setActiveTab] = useState('read');
  const [openReadFilters, setOpenReadFilters] = useState<(() => void) | null>(null);
  const headerScrollY = useRef(new Animated.Value(0)).current;
  const [topChromeHeight, setTopChromeHeight] = useState(240);
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

  const topChromeCollapseDistance = Math.max(topChromeHeight, 1);
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
      case 'settings':
        return <BibleSettingsPanel translations={translations} />;
      default:
        return null;
    }
  };

  return (
    <View style={[styles.wrap, { backgroundColor: palette.bg }]}>
      <Animated.View style={[styles.topChrome, topChromeAnimatedStyle]}>
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

      <View style={styles.tabsWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
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
                    {tab.label}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.contentWrap}>
        {activeTab === 'read' ? (
          <View style={styles.readContent}>{renderTab()}</View>
        ) : (
          <Animated.ScrollView
            style={styles.contentScroll}
            contentContainerStyle={styles.content}
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
          style={[styles.floatingFilter, { backgroundColor: palette.goldDeep }]}
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
  wrap: { flex: 1, padding: 16 },
  topChrome: { overflow: 'hidden' },
  topChromeMeasure: { paddingBottom: 2 },
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
