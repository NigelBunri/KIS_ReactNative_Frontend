// src/screens/education/learner/MyLearningScreen.tsx
//
// Education UX v2 — dedicated "My Learning" destination. Previously a
// learner had no way to see their enrolled courses except by scrolling
// back through Discover's "Continue learning" rail, which only showed
// in-progress items and had no notion of "completed" at all.
//
// Visual pass: rebuilt on the shared premium education component kit, and
// adds a "Downloaded" tab backed by useEducationOfflineStore — restores
// the offline-save bookmark the old Broadcast-tab discovery page had
// (CourseDetailScreen now exposes the save/remove toggle) but that had no
// destination of its own in the v2 rewrite until now.
import React, { useMemo } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import useEducationDiscovery from '@/screens/broadcast/education/hooks/useEducationDiscovery';
import useEducationOfflineStore from '@/screens/broadcast/education/hooks/useEducationOfflineStore';
import type { RootStackParamList } from '@/navigation/types';
import type { EducationProgress } from '@/screens/broadcast/education/api/education.models';
import {
  EducationScreenScaffold,
  EducationListCard,
  EducationEmptyState,
  EducationActionButton,
} from '@/screens/education/shared/components';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function ProgressCard({ item, onOpen, onCertificate }: {
  item: EducationProgress;
  onOpen: () => void;
  onCertificate?: () => void;
}) {
  const { palette } = useKISTheme();
  const percent = Math.max(0, Math.min(100, Math.round(item.progressPercent || 0)));
  return (
    <EducationListCard
      palette={palette}
      title={item.contentTitle || 'Untitled course'}
      subtitle={item.lastLessonTitle ? `Last: ${item.lastLessonTitle}` : undefined}
      metaItems={[`${percent}% complete`]}
      onPress={onOpen}
      primaryAction={<EducationActionButton palette={palette} label={item.isCompleted ? 'Review' : 'Continue'} onPress={onOpen} />}
      secondaryAction={
        item.isCompleted && onCertificate ? (
          <EducationActionButton palette={palette} label="Certificate" variant="ghost" onPress={onCertificate} />
        ) : undefined
      }
    >
      <View style={{ height: 6, borderRadius: 3, backgroundColor: palette.border, overflow: 'hidden', marginTop: 2 }}>
        <View style={{ width: `${percent}%`, height: '100%', backgroundColor: palette.primary }} />
      </View>
    </EducationListCard>
  );
}

export default function MyLearningScreen() {
  const navigation = useNavigation<Nav>();
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const { data, loading, refresh } = useEducationDiscovery();
  const { offlineItems } = useEducationOfflineStore();

  const { inProgress, completed } = useMemo(() => {
    const all = data?.continueLearning ?? [];
    return {
      inProgress: all.filter(row => !row.isCompleted),
      completed: all.filter(row => row.isCompleted),
    };
  }, [data?.continueLearning]);

  const openCourse = (progress: EducationProgress) => {
    navigation.navigate('EducationCourseDetail', {
      contentId: progress.contentId,
      contentType: progress.contentType,
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }}>
      <EducationScreenScaffold
        palette={palette}
        title="My Learning"
        onBack={() => navigation.goBack()}
        scrollable={false}
        contentContainerStyle={{ flex: 1, padding: 0 }}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: responsive.pageGutter, paddingBottom: 40, gap: 24 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={palette.primary} />}
        >
          <View style={{ gap: 12 }}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: palette.text }}>
              In progress {inProgress.length > 0 ? `(${inProgress.length})` : ''}
            </Text>
            {inProgress.length === 0 && !loading ? (
              <EducationEmptyState
                palette={palette}
                title="Nothing in progress"
                description="Enroll in a course from the Education tab to get started."
                action={
                  <EducationActionButton
                    palette={palette}
                    label="Browse courses"
                    onPress={() => navigation.popToTop()}
                  />
                }
              />
            ) : (
              <View style={{ gap: 10 }}>
                {inProgress.map(item => (
                  <ProgressCard key={`${item.contentType}-${item.contentId}`} item={item} onOpen={() => openCourse(item)} />
                ))}
              </View>
            )}
          </View>

          <View style={{ gap: 12 }}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: palette.text }}>
              Completed {completed.length > 0 ? `(${completed.length})` : ''}
            </Text>
            {completed.length === 0 && !loading ? (
              <EducationEmptyState palette={palette} title="Nothing completed yet" description="Complete a course to see it here." />
            ) : (
              <View style={{ gap: 10 }}>
                {completed.map(item => (
                  <ProgressCard
                    key={`${item.contentType}-${item.contentId}`}
                    item={item}
                    onOpen={() => openCourse(item)}
                    onCertificate={() => navigation.navigate('EducationCertificates')}
                  />
                ))}
              </View>
            )}
          </View>

          {offlineItems.length > 0 ? (
            <View style={{ gap: 12 }}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: palette.text }}>
                Saved for offline ({offlineItems.length})
              </Text>
              <View style={{ gap: 10 }}>
                {offlineItems.map(item => (
                  <EducationListCard
                    key={`offline-${item.contentType}-${item.contentId}`}
                    palette={palette}
                    title={item.contentTitle || 'Saved course'}
                    onPress={() => navigation.navigate('EducationCourseDetail', { contentId: item.contentId, contentType: item.contentType })}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {loading ? <ActivityIndicator color={palette.primary} /> : null}
        </ScrollView>
      </EducationScreenScaffold>
    </SafeAreaView>
  );
}
