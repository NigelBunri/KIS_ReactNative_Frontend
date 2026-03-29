// src/screens/tabs/BibleScreen.tsx
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useKISTheme } from '../../theme/useTheme';
import { useBibleData } from './bible/useBibleData';
import DailyDevotionsPanel from '../../components/Bible/DailyDevotionsPanel';
import BibleReaderPanel from '../../components/Bible/BibleReaderPanel';
import MeditationPanel from '../../components/Bible/MeditationPanel';
import BiblePlansPanel from '../../components/Bible/BiblePlansPanel';
import BibleStatsPanel from '../../components/Bible/BibleStatsPanel';
import StudyToolsPanel from '../../components/Bible/StudyToolsPanel';
import BibleCommunityPanel from '../../components/Bible/BibleCommunityPanel';
import PrayerPanel from '../../components/Bible/PrayerPanel';
import BibleLessonsPanel from '../../components/Bible/BibleLessonsPanel';
import BibleFeatureVaultPanel from '../../components/Bible/BibleFeatureVaultPanel';
import { KISIcon } from '../../constants/kisIcons';

export default function BibleScreen() {
  const { palette } = useKISTheme();
  const [activeTab, setActiveTab] = useState('today');
  const {
    translations,
    books,
    reader,
    devotionals,
    meditations,
    loadingReader,
    loadReader,
  } = useBibleData();

  const tabs = useMemo(
    () => [
      { key: 'today', label: 'Today', icon: 'calendar' },
      { key: 'read', label: 'Read', icon: 'book' },
      { key: 'meditate', label: 'Meditate', icon: 'sparkles' },
      { key: 'prayer', label: 'Prayer', icon: 'heart' },
      { key: 'plans', label: 'Plans', icon: 'list' },
      { key: 'stats', label: 'Stats', icon: 'poll' },
      { key: 'study', label: 'Study', icon: 'school' },
      { key: 'community', label: 'Community', icon: 'people' },
      { key: 'lessons', label: 'Lessons', icon: 'layers' },
      { key: 'features', label: 'Features', icon: 'settings' },
    ],
    [],
  );

  const renderTab = () => {
    switch (activeTab) {
      case 'today':
        return <DailyDevotionsPanel devotionals={devotionals} />;
      case 'read':
        return (
          <BibleReaderPanel
            translations={translations}
            books={books}
            reader={reader}
            loading={loadingReader}
            onLoad={loadReader}
          />
        );
      case 'meditate':
        return <MeditationPanel meditations={meditations} />;
      case 'prayer':
        return <PrayerPanel />;
      case 'plans':
        return <BiblePlansPanel />;
      case 'stats':
        return <BibleStatsPanel />;
      case 'study':
        return <StudyToolsPanel />;
      case 'community':
        return <BibleCommunityPanel />;
      case 'lessons':
        return <BibleLessonsPanel />;
      case 'features':
        return <BibleFeatureVaultPanel />;
      default:
        return null;
    }
  };

  return (
    <View style={[styles.wrap, { backgroundColor: palette.bg }]}>
      <View style={styles.header}>
        <Text style={{ color: palette.text, fontSize: 28, fontWeight: '900' }}>Bible</Text>
        <Text style={{ color: palette.subtext, marginTop: 6 }}>
          Read, listen, and grow with daily devotionals, meditations, and guided study tools.
        </Text>
      </View>

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
                    backgroundColor: isActive ? palette.primarySoft : palette.surface,
                    borderColor: palette.divider,
                  },
                ]}
              >
                <View style={styles.tabLabel}>
                  <KISIcon
                    name={tab.icon as any}
                    size={14}
                    color={isActive ? palette.primaryStrong : palette.subtext}
                  />
                  <Text
                    numberOfLines={1}
                    style={{ color: isActive ? palette.primaryStrong : palette.text, fontWeight: '700' }}
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
        <ScrollView
          style={styles.contentScroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {renderTab()}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 16 },
  header: { gap: 2 },
  tabsWrapper: { paddingVertical: 8 },
  tabRow: { gap: 8, paddingVertical: 4, alignItems: 'center' },
  tabChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 2,
    minHeight: 32,
    justifyContent: 'center',
  },
  tabLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  contentWrap: { flex: 1, minHeight: 0 },
  contentScroll: { flex: 1 },
  content: { paddingVertical: 16, gap: 16, paddingBottom: 40 },
});
