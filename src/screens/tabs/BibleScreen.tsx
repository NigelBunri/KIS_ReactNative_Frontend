// src/screens/tabs/BibleScreen.tsx
import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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

export default function BibleScreen() {
  const { palette } = useKISTheme();
  const [activeTab, setActiveTab] = useState('read');
  const [openReadFilters, setOpenReadFilters] = useState<(() => void) | null>(null);
  const {
    translations,
    books,
    reader,
    devotionals,
    meditations,
    loadingReader,
    loadingDaily,
    loadingMeditations,
    loadReader,
  } = useBibleData();

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
      <View style={styles.header}>
        <Text style={{ color: palette.text, fontSize: 28, fontWeight: '900' }}>Bible</Text>
        <Text style={{ color: palette.subtext, marginTop: 6 }}>
          Official KCAN Bible section for reading, daily passages, prayers, lessons, and personal reading plans.
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
        {activeTab === 'read' ? (
          <View style={styles.readContent}>{renderTab()}</View>
        ) : (
          <ScrollView
            style={styles.contentScroll}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {renderTab()}
          </ScrollView>
        )}
      </View>

      {activeTab === 'read' && openReadFilters ? (
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={openReadFilters}
          style={[styles.floatingFilter, { backgroundColor: palette.primaryStrong }]}
        >
          <KISIcon name="filter" size={22} color="#fff" />
        </TouchableOpacity>
      ) : null}
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
  },
});
