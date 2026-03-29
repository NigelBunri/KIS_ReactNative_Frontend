import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import { EducationReview } from '@/screens/broadcast/education/hooks/useEducationReviews';

type Props = {
  reviews: EducationReview[];
  averageRating: number;
  loading: boolean;
  error?: string | null;
  onRefresh: () => void;
};

const renderStars = (value: number) => {
  const filled = Math.round(value);
  return Array.from({ length: 5 }).map((_, index) => (
    <KISIcon
      key={`star-${index}`}
      name="star"
      size={14}
      color={index < filled ? '#F59E0B' : '#CBD5F5'}
    />
  ));
};

export default function EducationReviewSection({ reviews, averageRating, loading, error, onRefresh }: Props) {
  const { palette } = useKISTheme();
  const hasReviews = reviews.length > 0;

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
        <Text style={{ color: palette.text, fontWeight: '900', fontSize: 16 }}>Ratings & reviews</Text>
        <Pressable onPress={onRefresh}>
          <Text style={{ color: palette.primaryStrong, fontWeight: '900' }}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </Text>
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {renderStars(averageRating)}
        <Text style={{ color: palette.subtext, fontWeight: '900' }}>{averageRating.toFixed(1)}</Text>
      </View>

      {error ? (
        <Text style={{ color: palette.danger ?? palette.primaryStrong }}>{error}</Text>
      ) : !hasReviews ? (
        <Text style={{ color: palette.subtext }}>No reviews yet.</Text>
      ) : (
        reviews.slice(0, 3).map((review) => (
          <View
            key={review.id}
            style={{
              borderWidth: 1,
              borderColor: palette.divider,
              borderRadius: 14,
              padding: 10,
              backgroundColor: palette.surface,
            }}
          >
            <Text style={{ color: palette.text, fontWeight: '900' }}>{review.user_name}</Text>
            <Text style={{ color: palette.subtext, fontSize: 12 }}>{review.content}</Text>
            <Text style={{ color: palette.subtext, fontSize: 10 }}>{review.created_at}</Text>
          </View>
        ))
      )}
    </View>
  );
}
