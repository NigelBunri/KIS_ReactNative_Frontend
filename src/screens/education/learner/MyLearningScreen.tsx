// src/screens/education/learner/MyLearningScreen.tsx
//
// Education UX v2 — dedicated "My Learning" destination. Previously a
// learner had no way to see their enrolled courses except by scrolling
// back through Discover's "Continue learning" rail, which only showed
// in-progress items and had no notion of "completed" at all.
import React, { useMemo } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import KISButton from '@/constants/KISButton';
import useEducationDiscovery from '@/screens/broadcast/education/hooks/useEducationDiscovery';
import type { RootStackParamList } from '@/navigation/types';
import type { EducationProgress } from '@/screens/broadcast/education/api/education.models';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function ProgressRow({ item, onOpen, onCertificate }: {
  item: EducationProgress;
  onOpen: () => void;
  onCertificate?: () => void;
}) {
  const { palette } = useKISTheme();
  const percent = Math.max(0, Math.min(100, Math.round(item.progressPercent || 0)));
  return (
    <View
      style={{
        borderRadius: 16,
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: palette.surface,
        padding: 14,
        gap: 8,
      }}
    >
      <Text style={{ fontWeight: '800', color: palette.text }} numberOfLines={2}>
        {item.contentTitle || 'Untitled course'}
      </Text>
      {item.lastLessonTitle ? (
        <Text style={{ fontSize: 12, color: palette.subtext }} numberOfLines={1}>
          Last: {item.lastLessonTitle}
        </Text>
      ) : null}
      <View style={{ height: 6, borderRadius: 3, backgroundColor: palette.border, overflow: 'hidden' }}>
        <View style={{ width: `${percent}%`, height: '100%', backgroundColor: palette.primary }} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 12, fontWeight: '700', color: palette.subtext }}>{percent}% complete</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {item.isCompleted && onCertificate ? (
            <KISButton title="Certificate" size="sm" variant="ghost" onPress={onCertificate} />
          ) : null}
          <KISButton title={item.isCompleted ? 'Review' : 'Continue'} size="sm" variant="primary" onPress={onOpen} />
        </View>
      </View>
    </View>
  );
}

export default function MyLearningScreen() {
  const navigation = useNavigation<Nav>();
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const { data, loading, refresh } = useEducationDiscovery();

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
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: palette.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: responsive.pageGutter, paddingBottom: 40, gap: 24 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={palette.primary} />}
      >
        <Text style={{ fontSize: 24, fontWeight: '900', color: palette.text }}>My Learning</Text>

        <View style={{ gap: 12 }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: palette.text }}>
            In progress {inProgress.length > 0 ? `(${inProgress.length})` : ''}
          </Text>
          {inProgress.length === 0 && !loading ? (
            <View style={{ padding: 18, borderRadius: 16, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, alignItems: 'center', gap: 8 }}>
              <KISIcon name="book" size={28} color={palette.subtext} />
              <Text style={{ color: palette.subtext, fontWeight: '600', textAlign: 'center' }}>
                Nothing in progress yet. Enroll in a course from Education Home to get started.
              </Text>
              <KISButton title="Browse courses" size="sm" onPress={() => navigation.navigate('EducationHome')} />
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {inProgress.map(item => (
                <ProgressRow key={`${item.contentType}-${item.contentId}`} item={item} onOpen={() => openCourse(item)} />
              ))}
            </View>
          )}
        </View>

        <View style={{ gap: 12 }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: palette.text }}>
            Completed {completed.length > 0 ? `(${completed.length})` : ''}
          </Text>
          {completed.length === 0 && !loading ? (
            <View style={{ padding: 18, borderRadius: 16, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, alignItems: 'center' }}>
              <Text style={{ color: palette.subtext, fontWeight: '600', textAlign: 'center' }}>
                Complete a course to see it here.
              </Text>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {completed.map(item => (
                <ProgressRow
                  key={`${item.contentType}-${item.contentId}`}
                  item={item}
                  onOpen={() => openCourse(item)}
                  onCertificate={() => navigation.navigate('EducationCertificates')}
                />
              ))}
            </View>
          )}
        </View>

        {loading ? <ActivityIndicator color={palette.primary} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}
