// src/screens/broadcast/education/components/EducationContinueLearning.tsx
import React from 'react';
import { FlatList, Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import KISButton from '@/constants/KISButton';
import type { EducationProgress } from '@/screens/broadcast/education/api/education.models';

type Props = {
  items: EducationProgress[];
  onResume: (item: EducationProgress) => void;
};

export default function EducationContinueLearning({ items, onResume }: Props) {
  const { palette } = useKISTheme();

  if (items.length === 0) {
    return (
      <View style={{ padding: 12 }}>
        <Text style={{ color: palette.subtext }}>No active enrollments yet.</Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 10 }}>
      <FlatList
        data={items}
        keyExtractor={(progress) => `${progress.contentType}-${progress.contentId}`}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 8 }}
        renderItem={({ item }) => (
          <View
            style={{
              width: 220,
              borderWidth: 2,
              borderColor: palette.divider,
              borderRadius: 18,
              padding: 12,
              backgroundColor: palette.surface,
              marginRight: 10,
            }}
          >
            <Text style={{ color: palette.text, fontWeight: '800' }} numberOfLines={1}>
              {item.contentId}
            </Text>
            <Text style={{ color: palette.subtext, fontSize: 12 }} numberOfLines={2}>
              {item.lastLessonTitle ?? 'Resume where you left off'}
            </Text>
            <View
              style={{
                height: 6,
                backgroundColor: palette.divider,
                borderRadius: 6,
                marginVertical: 10,
              }}
            >
              <View
                style={{
                  width: `${Math.max(2, Math.min(100, item.progressPercent))}%`,
                  height: '100%',
                  backgroundColor: palette.primaryStrong,
                  borderRadius: 6,
                }}
              />
            </View>
            <Text style={{ color: palette.subtext, fontSize: 12 }}>
              {Math.round(item.progressPercent)}% complete
            </Text>
            <KISButton title="Resume" size="xs" onPress={() => onResume(item)} style={{ marginTop: 10 }} />
          </View>
        )}
      />
    </View>
  );
}
