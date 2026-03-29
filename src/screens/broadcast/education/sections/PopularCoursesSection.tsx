import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import CourseCard from '@/screens/broadcast/education/components/CourseCard';
import KISButton from '@/constants/KISButton';

type Course = {
  id: string;
  title?: string;
  subtitle?: string;
  price?: string | number;
  currency?: string;
  cover_url?: string | null;
  partner?: string | null;
  source?: string;
  is_custom?: boolean;
};

type Props = {
  title?: string;
  items: Course[];
  onSeeAll?: () => void;
  onEnroll?: (courseId: string) => void;
  onBroadcast?: (course: Course) => void;
  broadcastingCourseId?: string | null;
};

export default function PopularCoursesSection({
  title = 'Popular Courses',
  items,
  onSeeAll,
  onEnroll,
  onBroadcast,
  broadcastingCourseId,
}: Props) {
  const { palette } = useKISTheme();

  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: palette.text, fontWeight: '900', fontSize: 16 }}>{title}</Text>
        <Pressable onPress={onSeeAll}>
          <Text style={{ color: palette.subtext, fontWeight: '900' }}>See All ›</Text>
        </Pressable>
      </View>

      <View style={{ gap: 12 }}>
        {items.slice(0, 2).map((c) => {
          const price = c.price !== undefined && c.price !== null ? String(c.price) : '';
          const currency = c.currency ?? '';
          const priceLabel = price ? `Price ${currency ? `${currency} ` : ''}${price}` : '';

          return (
            <View key={c.id} style={{ gap: 6 }}>
              <CourseCard
                title={c.title ?? 'Course'}
                subtitle={c.subtitle}
                priceLabel={priceLabel}
                coverUrl={c.cover_url ?? null}
                ctaLabel="Enroll"
                onPress={() => onEnroll?.(c.id)}
              />
              {onBroadcast && (c.partner || c.source === 'education_profile') ? (
                <KISButton
                  title={broadcastingCourseId === c.id ? 'Broadcasting…' : 'Broadcast'}
                  variant="outline"
                  size="xs"
                  onPress={() => onBroadcast(c)}
                  disabled={broadcastingCourseId === c.id}
                />
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}
