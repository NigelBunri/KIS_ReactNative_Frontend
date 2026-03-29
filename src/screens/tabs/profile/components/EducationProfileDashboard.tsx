import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, DeviceEventEmitter, Pressable, Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import KISButton from '@/constants/KISButton';
import KISTextInput from '@/constants/KISTextInput';
import { KISIcon } from '@/constants/kisIcons';
import EducationCertificatesSection from '@/screens/broadcast/education/sections/EducationCertificatesSection';
import EducationRecommendationsSection from '@/screens/broadcast/education/sections/EducationRecommendationsSection';
import EducationReviewSection from '@/screens/broadcast/education/sections/EducationReviewSection';
import EducationAutomationRules from '@/screens/broadcast/education/components/EducationAutomationRules';
import useEducationData from '@/screens/broadcast/education/hooks/useEducationData';
import useEducationPhaseThreeData from '@/screens/broadcast/education/hooks/useEducationPhaseThreeData';
import useEducationAutomationRules from '@/screens/broadcast/education/hooks/useEducationAutomationRules';
import useEducationReviews from '@/screens/broadcast/education/hooks/useEducationReviews';
import useEducationRatings from '@/screens/broadcast/education/hooks/useEducationRatings';
import useEducationTier from '@/screens/broadcast/education/hooks/useEducationTier';
import type { EducationCourse } from '@/screens/broadcast/education/api/education.types';

const formatCurrency = (amount?: number | null, currency?: string) => {
  if (!amount || amount <= 0) return 'Free';
  const formatted = Number(amount).toFixed(2);
  return `${currency ?? 'USD'} ${formatted}`;
};

export default function EducationProfileDashboard() {
  const { palette } = useKISTheme();
  const { home, reload } = useEducationData({ q: '' });
  const {
    credentials,
    walletSnapshot,
    loading: phaseThreeLoading,
    error: phaseThreeError,
    refresh: refreshPhaseThree,
  } = useEducationPhaseThreeData();
  const { tierLabel, isTierAtLeast } = useEducationTier();
  const { rules, toggleRule } = useEducationAutomationRules();
  const { averageRating, getRating, setRating } = useEducationRatings();
  const [reviewText, setReviewText] = useState('');
  const [reviewRating, setReviewRating] = useState(4);
  const recommendedCourses = home.popular_courses ?? [];
  const recommendedCategories = home.categories ?? [];
  const courseCount = recommendedCourses.length;
  const completionPercent = courseCount ? (credentials.length / courseCount) * 100 : 0;
  const reviewCourseId = recommendedCourses[0]?.id;
  const {
    reviews,
    loading: reviewsLoading,
    error: reviewsError,
    refresh: refreshReviews,
    submitReview,
  } = useEducationReviews(reviewCourseId);
  const reviewCourseRating = reviewCourseId ? getRating(reviewCourseId) : averageRating;
  const walletCredits = Math.max(0, walletSnapshot.credits ?? 0);
  const walletBalanceLabel = formatCurrency(Math.max(0, (walletSnapshot.balanceCents ?? 0) / 100));
  const walletCreditsValueLabel = formatCurrency(Math.max(0, (walletSnapshot.creditsValueCents ?? 0) / 100));

  const handleCourseSelect = useCallback((course: EducationCourse) => {
    Alert.alert('Course selected', course.title ?? 'Course selected');
  }, []);

  const handleViewRecommendations = useCallback(() => {
    reload();
    Alert.alert('Discovery', 'Recommendations refreshed for this profile.');
  }, [reload]);

  const openWalletSheet = useCallback(() => {
    DeviceEventEmitter.emit('wallet.open', { mode: 'deposit' });
  }, []);

  const handleReviewSubmit = useCallback(async () => {
    if (!reviewCourseId) {
      Alert.alert('Review', 'Create a course first before sharing a review.');
      return;
    }
    const trimmed = reviewText.trim();
    if (!trimmed) {
      Alert.alert('Review', 'Please share some feedback before submitting.');
      return;
    }
    const success = await submitReview({ courseId: reviewCourseId, content: trimmed });
    if (success) {
      setReviewText('');
      setReviewRating(4);
      setRating(reviewCourseId, reviewRating);
      Alert.alert('Review', 'Thanks! Your feedback is live.');
    } else {
      Alert.alert('Review', 'Unable to submit the review right now.');
    }
  }, [reviewCourseId, reviewText, reviewRating, setRating, submitReview]);

  return (
    <View style={{ gap: 12 }}>
      <View
        style={{
          borderWidth: 2,
          borderColor: palette.divider,
          borderRadius: 22,
          padding: 12,
          backgroundColor: palette.surface,
          gap: 8,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: palette.text, fontWeight: '900', fontSize: 16 }}>Wallet</Text>
          {phaseThreeLoading ? <ActivityIndicator color={palette.primary} /> : null}
        </View>
        <Text style={{ color: palette.text, fontWeight: '900' }}>{walletBalanceLabel}</Text>
        <Text style={{ color: palette.subtext, fontSize: 12 }}>
          {walletCredits} credits ({walletCreditsValueLabel})
        </Text>
        <KISButton title="Add credits" size="sm" onPress={openWalletSheet} />
        {phaseThreeError ? (
          <Text style={{ color: palette.danger ?? palette.primaryStrong, fontSize: 12 }}>
            {phaseThreeError}
          </Text>
        ) : null}
      </View>

      <EducationCertificatesSection
        certificates={credentials}
        completionPercent={completionPercent}
        loading={phaseThreeLoading}
        error={phaseThreeError}
        onRefresh={refreshPhaseThree}
      />

      <EducationRecommendationsSection
        categories={recommendedCategories}
        courses={recommendedCourses}
        onSelectCourse={handleCourseSelect}
        onViewAll={handleViewRecommendations}
      />

      <EducationReviewSection
        reviews={reviews}
        averageRating={reviewCourseRating}
        loading={reviewsLoading}
        error={reviewsError}
        onRefresh={refreshReviews}
      />

      <View
        style={{
          borderWidth: 2,
          borderColor: palette.divider,
          borderRadius: 22,
          padding: 12,
          backgroundColor: palette.surface,
          gap: 10,
        }}
      >
        <Text style={{ color: palette.text, fontWeight: '900', fontSize: 16 }}>Share a review</Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {Array.from({ length: 5 }).map((_, index) => (
            <Pressable key={`profile-review-star-${index}`} onPress={() => setReviewRating(index + 1)}>
              <KISIcon
                name="star"
                size={18}
                color={index < reviewRating ? '#F59E0B' : palette.divider}
              />
            </Pressable>
          ))}
        </View>
        <KISTextInput
          label="Comment"
          value={reviewText}
          onChangeText={setReviewText}
          multiline
          style={{ minHeight: 80 }}
        />
        <KISButton title="Submit review" onPress={handleReviewSubmit} />
      </View>

      <EducationAutomationRules
        rules={rules}
        onToggle={(key, value) => toggleRule(key, value)}
        tierLabel={tierLabel}
        isTierAtLeast={isTierAtLeast}
      />
    </View>
  );
}
