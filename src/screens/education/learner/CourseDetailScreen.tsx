// src/screens/education/learner/CourseDetailScreen.tsx
//
// Education UX v2 — real "Course" destination. The old experience only had
// EducationDetailSheet, a bottom sheet stacked on top of the Broadcast tab;
// this screen gives the course its own place in the navigation stack while
// keeping the enrollment sheet (EducationEnrollmentSheet) as the genuinely
// contextual short action it already was. Deep item consumption (lesson
// text, material preview, live-session join, assessment answering) lives
// in LearningPlayerScreen, reached from the curriculum list here.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import KISButton from '@/constants/KISButton';
import PermanentRemoteImage from '@/components/media/PermanentRemoteImage';
import ROUTES from '@/network';
import { queueableJsonRequest } from '@/services/offlineActionQueue';
import { getDirectPaymentInfo, openDirectPaymentUrl } from '@/utils/directPaymentHandoff';
import useEducationCourseDetail from '@/screens/broadcast/education/hooks/useEducationCourseDetail';
import EducationEnrollmentSheet from '@/screens/broadcast/education/components/EducationEnrollmentSheet';
import {
  hasLearningAccessForItem,
  getPrimaryActionLabel,
  getStatusLabel,
} from '@/screens/broadcast/education/utils/educationAccess';
import type { RootStackParamList } from '@/navigation/types';
import type { EducationCourseOutlineModule } from '@/screens/broadcast/education/api/education.models';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route_ = RouteProp<RootStackParamList, 'EducationCourseDetail'>;

export default function CourseDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route_>();
  const { contentId, seed } = route.params;
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const { item, loading, hydrate } = useEducationCourseDetail(seed as any);
  const [enrollmentVisible, setEnrollmentVisible] = useState(false);
  const [requestingAccess, setRequestingAccess] = useState(false);
  const [paymentState, setPaymentState] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');

  useEffect(() => {
    hydrate(contentId, seed as any);
  }, [contentId, hydrate, seed]);

  // A learner who backgrounds the app to complete a Flutterwave/Stripe
  // checkout naturally re-focuses this screen on return - refresh so the
  // primary CTA/status flips to "enrolled" without a manual pull-to-refresh.
  useFocusEffect(
    useCallback(() => {
      hydrate(contentId);
    }, [contentId, hydrate]),
  );

  const handleEnrollmentRequest = useCallback(
    async () => {
      if (!item) return;
      setPaymentState('processing');
      try {
        const response = await queueableJsonRequest({
          domain: 'Education',
          kind: 'education.enroll',
          method: 'POST',
          url: ROUTES.education.enroll(item.id),
          body: {},
          dedupeKey: `education:enroll:${item.id}`,
          errorMessage: 'Unable to complete this education action.',
        });
        if (!response?.success) {
          setPaymentState('error');
          Alert.alert('Education', response?.message || 'Unable to complete this education action.');
          return;
        }
        if (response?.queued) {
          setPaymentState('processing');
          Alert.alert(
            'Still connecting',
            'Your request will be sent automatically once your connection is stable. You have not been charged yet.',
          );
          return;
        }
        const payload = response?.data ?? {};
        setPaymentState('success');
        setEnrollmentVisible(false);
        await hydrate(item.id);
        const booking = payload?.booking;
        const directPayment = getDirectPaymentInfo(booking, payload);
        if (String(booking?.status || '').toLowerCase() === 'payment_pending') {
          if (directPayment.paymentUrl) {
            const opened = await openDirectPaymentUrl(directPayment.paymentUrl);
            Alert.alert(
              opened ? 'Checkout opened' : 'Payment pending',
              opened
                ? "Complete payment in the browser, then come back to KIS — we'll refresh this automatically."
                : 'The secure checkout link is not available on this device. Refresh after payment is confirmed.',
            );
          } else {
            Alert.alert('Payment pending', 'This booking is waiting for a provider checkout link.');
          }
          return;
        }
        if (payload?.enrollment) {
          Alert.alert('Enrollment', `${item.title} added to your learning flow.`);
        }
      } catch (error: any) {
        setPaymentState('error');
        Alert.alert('Education', error?.message || 'Unable to complete this education action.');
      }
    },
    [item, hydrate],
  );

  const handleRequestAccess = useCallback(async () => {
    if (!item) return;
    setRequestingAccess(true);
    try {
      const response = await queueableJsonRequest({
        domain: 'Education',
        kind: 'education.accessRequest',
        method: 'POST',
        url: ROUTES.education.contentAccessRequest(item.id),
        body: {},
        dedupeKey: `education:access-request:${item.id}`,
        errorMessage: 'Unable to submit access request.',
      });
      if (!response?.success) {
        Alert.alert('Access request', response?.message || 'Unable to submit access request.');
        return;
      }
      Alert.alert('Access request', 'Your request has been submitted for approval.');
      await hydrate(item.id);
    } finally {
      setRequestingAccess(false);
    }
  }, [item, hydrate]);

  const openItem = useCallback(
    (itemId: string, isPreview?: boolean, hasAccess?: boolean) => {
      if (!isPreview && !hasAccess) {
        Alert.alert('Locked', 'Enroll in this course to unlock this item.');
        return;
      }
      navigation.navigate('EducationLearningPlayer', { contentId, itemId });
    },
    [contentId, navigation],
  );

  if (loading && !item) {
    return (
      <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: palette.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={palette.primary} />
      </SafeAreaView>
    );
  }

  if (!item) {
    return (
      <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: palette.bg, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: palette.subtext, fontWeight: '700', textAlign: 'center' }}>
          This course is no longer available.
        </Text>
        <KISButton title="Go back" onPress={() => navigation.goBack()} />
      </SafeAreaView>
    );
  }

  const hasAccess = hasLearningAccessForItem(item);
  const progress = (item as any)?.progress ?? null;
  const primaryLabel = getPrimaryActionLabel(item, progress);
  const statusLabel = getStatusLabel(item, progress);
  const outline: EducationCourseOutlineModule[] = (item as any)?.courseOutline ?? [];

  const handlePrimaryAction = () => {
    if (hasAccess) {
      const nextItemId = progress?.nextItem?.id || progress?.currentItem?.id || outline[0]?.items?.[0]?.id;
      if (nextItemId) {
        navigation.navigate('EducationLearningPlayer', { contentId, itemId: nextItemId });
      }
      return;
    }
    setEnrollmentVisible(true);
  };

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: palette.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <PermanentRemoteImage uri={item.coverUrl || ''} domain="Education" style={{ width: '100%', height: 200, backgroundColor: palette.border }} />
        <View style={{ padding: responsive.pageGutter, gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Pressable onPress={() => navigation.goBack()} style={{ padding: 4, marginLeft: -4 }}>
              <KISIcon name="back" size={20} color={palette.text} />
            </Pressable>
            <Text style={{ fontSize: 12, fontWeight: '700', color: palette.subtext, textTransform: 'uppercase' }}>
              {item.type}
            </Text>
          </View>
          <Text style={{ fontSize: 24, fontWeight: '900', color: palette.text }}>{item.title}</Text>
          <Text style={{ color: palette.subtext, fontWeight: '600' }}>
            {item.partnerName || 'Institution'} · {item.level ?? 'All levels'}
            {item.durationMinutes ? ` · ${Math.round(item.durationMinutes / 60)}h` : ''}
          </Text>

          {statusLabel ? (
            <View style={{ alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: palette.primarySoft }}>
              <Text style={{ color: palette.primaryStrong, fontWeight: '800', fontSize: 12, textTransform: 'capitalize' }}>
                {statusLabel}
              </Text>
            </View>
          ) : null}

          {hasAccess && typeof progress?.progressPercent === 'number' ? (
            <View style={{ gap: 6 }}>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: palette.border, overflow: 'hidden' }}>
                <View style={{ width: `${Math.round(progress.progressPercent)}%`, height: '100%', backgroundColor: palette.primary }} />
              </View>
              <Text style={{ fontSize: 12, color: palette.subtext, fontWeight: '700' }}>
                {Math.round(progress.progressPercent)}% complete
              </Text>
            </View>
          ) : null}

          <Text style={{ color: palette.text, lineHeight: 21 }}>{item.description || item.summary}</Text>

          <KISButton title={primaryLabel} onPress={handlePrimaryAction} />

          {outline.length > 0 ? (
            <View style={{ gap: 14, marginTop: 10 }}>
              <Text style={{ fontSize: 17, fontWeight: '800', color: palette.text }}>Curriculum</Text>
              {outline.map((module, moduleIndex) => (
                <View key={module.id} style={{ gap: 8 }}>
                  <Text style={{ fontWeight: '800', color: palette.text }}>
                    Module {moduleIndex + 1}: {module.title}
                  </Text>
                  {(module.items ?? []).map((outlineItem, itemIndex) => {
                    const completed = (progress?.completedItemIds ?? []).includes(outlineItem.id);
                    const unlocked = outlineItem.is_preview || hasAccess;
                    return (
                      <Pressable
                        key={outlineItem.id}
                        onPress={() => openItem(outlineItem.id, outlineItem.is_preview, hasAccess)}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 10,
                          padding: 12,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: palette.border,
                          backgroundColor: palette.surface,
                          opacity: unlocked ? 1 : 0.6,
                        }}
                      >
                        <KISIcon
                          name={completed ? 'check' : unlocked ? 'play' : 'lock'}
                          size={16}
                          color={completed ? palette.primary : palette.subtext}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: palette.text, fontWeight: '700' }} numberOfLines={1}>
                            {itemIndex + 1}. {outlineItem.title}
                          </Text>
                          {outlineItem.duration_minutes ? (
                            <Text style={{ color: palette.subtext, fontSize: 12 }}>{outlineItem.duration_minutes} min</Text>
                          ) : null}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>

      <EducationEnrollmentSheet
        visible={enrollmentVisible}
        content={item}
        onClose={() => setEnrollmentVisible(false)}
        onFreeEnroll={() => void handleEnrollmentRequest()}
        onCheckout={() => void handleEnrollmentRequest()}
        onRequestAccess={() => void handleRequestAccess()}
        requestingAccess={requestingAccess}
        paymentState={paymentState}
      />
    </SafeAreaView>
  );
}
