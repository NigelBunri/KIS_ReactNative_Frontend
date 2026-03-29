import React, { useMemo } from 'react';
import { ScrollView, Pressable, Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { EducationCourse } from '@/screens/broadcast/education/api/education.types';

type Category = {
  id: string;
  name: string;
};

type Props = {
  categories: Category[];
  courses: EducationCourse[];
  onSelectCourse: (course: EducationCourse) => void;
  onViewAll?: () => void;
};

export default function EducationRecommendationsSection({
  categories,
  courses,
  onSelectCourse,
  onViewAll,
}: Props) {
  const { palette } = useKISTheme();
  const recommended = useMemo(() => courses.slice(0, 4), [courses]);

  const spotlight = useMemo(() => {
    if (!categories.length || !courses.length) return [];
    return categories
      .map((category) => ({
        category,
        course: courses.find((course) => (course.level ?? '').toLowerCase() === category.id.toLowerCase()),
      }))
      .filter((entry) => entry.course);
  }, [categories, courses]);

  return (
    <View
      style={{
        borderWidth: 2,
        borderColor: palette.divider,
        borderRadius: 22,
        padding: 12,
        backgroundColor: palette.card,
        gap: 12,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: palette.text, fontWeight: '900', fontSize: 16 }}>Discovery & recommendations</Text>
        <Text
          style={{ color: palette.primaryStrong, fontWeight: '900' }}
          onPress={onViewAll}
          suppressHighlighting
        >
          See all
        </Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {categories.map((category) => (
            <View
              key={category.id}
              style={{
                borderWidth: 1,
                borderColor: palette.divider,
                borderRadius: 16,
                paddingHorizontal: 16,
                paddingVertical: 8,
                backgroundColor: palette.surface,
              }}
            >
              <Text style={{ color: palette.text, fontWeight: '700' }}>{category.name}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {recommended.map((course) => (
            <Pressable
              key={course.id}
              onPress={() => onSelectCourse(course)}
              style={{
                width: 220,
                borderWidth: 1,
                borderColor: palette.divider,
                borderRadius: 18,
                padding: 12,
                backgroundColor: palette.surface,
              }}
            >
              <Text style={{ color: palette.text, fontWeight: '900' }} numberOfLines={2}>
                {course.title ?? 'Course'}
              </Text>
              <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 6 }} numberOfLines={2}>
                {course.subtitle ?? course.description ?? 'Browse this course for more details.'}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {spotlight.length > 0 ? (
        <View style={{ gap: 10 }}>
          {spotlight.map(({ category, course }) =>
            course ? (
              <View key={`${course.id}-${category.id}`}>
                <Text style={{ color: palette.primaryStrong, fontWeight: '700' }}>
                  {category.name} spotlight
                </Text>
                <Text style={{ color: palette.text, fontSize: 14 }}>{course.title}</Text>
              </View>
            ) : null,
          )}
        </View>
      ) : null}
    </View>
  );
}
