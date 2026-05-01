// src/screens/broadcast/education/components/EducationContinueLearning.tsx
import React from 'react';
import { FlatList, Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import KISButton from '@/constants/KISButton';
import { KISIcon } from '@/constants/kisIcons';
import type { EducationProgress } from '@/screens/broadcast/education/api/education.models';

type Props = {
  items: EducationProgress[];
  onResume: (item: EducationProgress) => void;
};

export default function EducationContinueLearning({ items, onResume }: Props) {
  const { palette } = useKISTheme();

  if (items.length === 0) {
    return (
      <View
        style={{
          padding: 14,
          borderRadius: 22,
          borderWidth: 1,
          borderColor: palette.border,
          backgroundColor: palette.surface,
        }}
      >
        <Text style={{ color: palette.subtext, fontWeight: '700' }}>
          No active enrollments yet.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 10 }}>
      <FlatList
        data={items}
        keyExtractor={progress =>
          `${progress.contentType}-${progress.contentId}`
        }
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 8 }}
        renderItem={({ item }) => (
          <View
            style={{
              width: 248,
              borderWidth: 1,
              borderColor: palette.border,
              borderRadius: 24,
              padding: 12,
              backgroundColor: palette.surface,
              marginRight: 10,
              shadowColor: palette.shadow ?? '#000',
              shadowOpacity: 0.07,
              shadowRadius: 14,
              shadowOffset: { width: 0, height: 8 },
              elevation: 3,
            }}
          >
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
            >
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 14,
                  backgroundColor: palette.primarySoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <KISIcon name="book" size={16} color={palette.primaryStrong} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={{ color: palette.text, fontWeight: '900' }}
                  numberOfLines={1}
                >
                  {item.contentTitle || item.lastLessonTitle || 'Learning item'}
                </Text>
                <Text
                  style={{ color: palette.subtext, fontSize: 11 }}
                  numberOfLines={1}
                >
                  {item.contentType.replace(/_/g, ' ')}
                </Text>
              </View>
            </View>
            <Text
              style={{
                color: palette.subtext,
                fontSize: 12,
                marginTop: 10,
                lineHeight: 16,
              }}
              numberOfLines={2}
            >
              {item.currentModule?.title ||
                item.lastLessonTitle ||
                'Resume where you left off'}
            </Text>
            <View
              style={{
                height: 6,
                backgroundColor: palette.border,
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
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Text style={{ color: palette.subtext, fontSize: 12 }}>
                {Math.round(item.progressPercent)}%
              </Text>
              <KISButton
                title="Resume"
                size="xs"
                onPress={() => onResume(item)}
              />
            </View>
          </View>
        )}
      />
    </View>
  );
}
