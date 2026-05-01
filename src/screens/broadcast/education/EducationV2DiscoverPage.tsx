import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import KISButton from '@/constants/KISButton';
import ROUTES from '@/network';
import { postRequest } from '@/network/post';
import { getRequest } from '@/network/get';
import EducationContentCard from '@/screens/broadcast/education/components/EducationContentCard';
import EducationContinueLearning from '@/screens/broadcast/education/components/EducationContinueLearning';
import EducationDetailSheet from '@/screens/broadcast/education/components/EducationDetailSheet';
import EducationEnrollmentSheet from '@/screens/broadcast/education/components/EducationEnrollmentSheet';
import useEducationDiscovery from '@/screens/broadcast/education/hooks/useEducationDiscovery';
import useEducationOfflineStore from '@/screens/broadcast/education/hooks/useEducationOfflineStore';
import type {
  EducationContentItem,
  EducationContentType,
  EducationProgress,
  EducationInstitutionSpotlight,
} from '@/screens/broadcast/education/api/education.models';

type Props = {
  searchTerm?: string;
  searchContext?: string;
  onUnavailable?: () => void;
  onAvailable?: () => void;
};

const HERO_BADGES: Record<EducationContentType, string> = {
  course: 'Featured course',
  lesson: 'Live lesson',
  workshop: 'Workshop',
  program: 'Program bundle',
  credential: 'Certification',
  mentorship: 'Mentorship circle',
};

const ACTIVE_ENROLLMENT_STATUSES = new Set(['enrolled', 'completed']);

const hasLearningAccessForItem = (
  item: EducationContentItem | null | undefined,
  progress?: EducationProgress | null,
) => {
  if (!item) return false;
  const viewerState = (item as any)?.viewerState || {};
  const enrollmentStatus = String(
    viewerState?.enrollment?.status || viewerState?.enrollment_status || '',
  ).toLowerCase();
  return (
    Boolean(viewerState?.has_learning_access) ||
    ACTIVE_ENROLLMENT_STATUSES.has(enrollmentStatus) ||
    Boolean(progress)
  );
};

const getBookingStatus = (item: EducationContentItem | null | undefined) =>
  String(
    (item as any)?.viewerState?.booking?.status ||
      (item as any)?.viewerState?.booking_status ||
      '',
  ).toLowerCase();

const getEnrollmentStatus = (item: EducationContentItem | null | undefined) =>
  String(
    (item as any)?.viewerState?.enrollment?.status ||
      (item as any)?.viewerState?.enrollment_status ||
      '',
  ).toLowerCase();

const getPrimaryActionLabel = (
  item: EducationContentItem,
  progress?: EducationProgress | null,
) => {
  if (hasLearningAccessForItem(item, progress)) {
    return progress ? 'Resume' : 'Open';
  }
  const enrollmentStatus = getEnrollmentStatus(item);
  if (enrollmentStatus === 'waitlisted') return 'Waitlisted';
  if (enrollmentStatus === 'pending') return 'Pending';
  const bookingStatus = getBookingStatus(item);
  if (bookingStatus === 'awaiting_satisfaction') return 'In review';
  if (bookingStatus === 'confirmed') return 'Booked';
  if (bookingStatus === 'payment_pending' || bookingStatus === 'pending')
    return 'Continue';
  const pricing = 'price' in item ? item.price : undefined;
  return pricing?.isFree ? 'Enroll' : 'Book';
};

const getStatusLabel = (
  item: EducationContentItem,
  progress?: EducationProgress | null,
) => {
  if (hasLearningAccessForItem(item, progress)) {
    return progress ? `${progress.progressPercent}%` : 'Enrolled';
  }
  const enrollmentStatus = getEnrollmentStatus(item);
  if (enrollmentStatus) return enrollmentStatus.replace(/_/g, ' ');
  const bookingStatus = getBookingStatus(item);
  if (bookingStatus) return bookingStatus.replace(/_/g, ' ');
  return '';
};

const resolveContentImage = (item?: Partial<EducationContentItem> | null) =>
  String(
    (item as any)?.coverUrl ||
      (item as any)?.cover_url ||
      (item as any)?.imageUrl ||
      (item as any)?.image_url ||
      (item as any)?.thumbnailUrl ||
      (item as any)?.thumbnail_url ||
      '',
  ).trim();

const resolveInstitutionImage = (
  institution?: Partial<EducationInstitutionSpotlight> | null,
) =>
  String(
    institution?.imageUrl ||
      (institution as any)?.image_url ||
      institution?.logoUrl ||
      (institution as any)?.logo_url ||
      '',
  ).trim();

type ExpandedEducationList =
  | {
      kind: 'progress';
      title: string;
      subtitle: string;
      items: EducationProgress[];
    }
  | {
      kind: 'institutions';
      title: string;
      subtitle: string;
      items: EducationInstitutionSpotlight[];
    }
  | {
      kind: 'content';
      title: string;
      subtitle: string;
      items: EducationContentItem[];
    };

export default function EducationV2DiscoverPage({
  searchTerm = '',
  searchContext = 'Courses',
  onUnavailable,
  onAvailable,
}: Props) {
  const { palette } = useKISTheme();
  const { data, loading, error, refresh, setSearch, filters, updateFilter } =
    useEducationDiscovery({
      initialSearch: searchTerm,
      onUnavailable,
      onAvailable,
    });
  useEducationOfflineStore();
  const [detailItem, setDetailItem] = useState<EducationContentItem | null>(
    null,
  );
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [enrollmentVisible, setEnrollmentVisible] = useState(false);
  const [selectedCourse, setSelectedCourse] =
    useState<EducationContentItem | null>(null);
  const [paymentState, setPaymentState] = useState<
    'idle' | 'processing' | 'success' | 'error'
  >('idle');
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [expandedList, setExpandedList] =
    useState<ExpandedEducationList | null>(null);

  useEffect(() => {
    setSearch(searchTerm || '');
  }, [searchTerm, setSearch]);

  useEffect(() => {
    const normalizedContext = String(searchContext || '')
      .trim()
      .toLowerCase();
    const nextTypeByContext: Record<string, string> = {
      courses: 'course',
      course: 'course',
      lessons: 'lesson',
      lesson: 'lesson',
      workshops: 'workshop',
      workshop: 'workshop',
    };
    const nextType = nextTypeByContext[normalizedContext];
    if (nextType && filters.type !== nextType) {
      updateFilter('type', nextType);
    }
  }, [filters.type, searchContext, updateFilter]);

  const heroContent = data?.heroCourse ?? null;
  const institutionSpotlights = useMemo(
    () => data?.institutionSpotlights ?? [],
    [data?.institutionSpotlights],
  );
  const continueLearning = useMemo(
    () => data?.continueLearning ?? [],
    [data?.continueLearning],
  );
  const progressMap = useMemo(() => {
    const map: Record<string, EducationProgress> = {};
    continueLearning.forEach(progress => {
      map[`${progress.contentType}-${progress.contentId}`] = progress;
    });
    return map;
  }, [continueLearning]);
  const contentByProgressKey = useMemo(() => {
    const map: Record<string, EducationContentItem> = {};
    if (heroContent) {
      map[`${heroContent.type}-${heroContent.id}`] = heroContent;
    }
    (data?.sections ?? []).forEach((section: any) => {
      (section.items ?? []).forEach((item: EducationContentItem) => {
        map[`${item.type}-${item.id}`] = item;
      });
    });
    return map;
  }, [data?.sections, heroContent]);

  const learningStats = useMemo(() => {
    const total = continueLearning.length;
    const certificateReady = continueLearning.filter(
      row => row.isCompleted,
    ).length;
    const upcomingLive = (data?.sections ?? [])
      .flatMap((section: any) => section.items || [])
      .filter((item: any) => item?.startsAt).length;
    return { total, certificateReady, upcomingLive };
  }, [continueLearning, data?.sections]);

  const hydrateDetail = useCallback(
    async (contentId: string, seed?: Partial<EducationContentItem>) => {
      setDetailLoading(true);
      try {
        const response = await getRequest(ROUTES.education.detail(contentId), {
          errorMessage: 'Unable to load education details.',
        });
        if (response?.success === false) {
          throw new Error(
            response?.message || 'Unable to load education details.',
          );
        }
        const payload = response?.data ?? response ?? {};
        const content = payload?.content;
        if (content && typeof content === 'object') {
          setDetailItem(
            prev =>
              ({
                ...((prev ||
                  seed || { id: contentId }) as EducationContentItem),
                ...content,
                progress: payload?.progress ?? null,
                insights: payload?.insights ?? null,
                currentItem: payload?.current_item ?? null,
                currentModule: payload?.current_module ?? null,
                nextItem: payload?.next_item ?? null,
                certificate: payload?.certificate ?? null,
                faqs: payload?.faqs ?? [],
                detailSummary:
                  payload?.detailSummary ??
                  payload?.detail_summary ??
                  content?.detailSummary ??
                  content?.detail_summary ??
                  null,
                detail_summary:
                  payload?.detail_summary ??
                  payload?.detailSummary ??
                  content?.detail_summary ??
                  content?.detailSummary ??
                  null,
              } as EducationContentItem),
          );
        }
      } catch (error: any) {
        Alert.alert(
          'Education',
          error?.message || 'Unable to load education details.',
        );
      } finally {
        setDetailLoading(false);
      }
    },
    [],
  );

  const openDetails = useCallback(
    async (item: EducationContentItem) => {
      setDetailItem(item);
      setDetailVisible(true);
      await hydrateDetail(item.id, item);
    },
    [hydrateDetail],
  );

  const resumeLearning = useCallback(
    async (progress: EducationProgress) => {
      const seed = {
        id: progress.contentId,
        type: progress.contentType,
        title:
          progress.contentTitle || progress.lastLessonTitle || 'Learning item',
        summary:
          progress.currentModule?.summary || 'Resume where you left off.',
        durationMinutes: progress.currentItem?.duration_minutes || 0,
      } as EducationContentItem;
      setDetailItem(seed);
      setDetailVisible(true);
      await hydrateDetail(progress.contentId, seed);
    },
    [hydrateDetail],
  );

  const enrollCourse = (item: EducationContentItem) => {
    setSelectedCourse(item);
    setEnrollmentVisible(true);
    setPaymentState('idle');
    setReceiptUrl(null);
  };

  const previewCourse = (item: EducationContentItem) => {
    Alert.alert('Preview lesson', `Playing preview for “${item.title}”.`);
  };

  const handleEnrollmentRequest = useCallback(
    async (item: EducationContentItem) => {
      setPaymentState('processing');
      setReceiptUrl(null);
      const response = await postRequest(
        ROUTES.education.enroll(item.id),
        {},
        {
          errorMessage: 'Unable to complete this education action.',
        },
      );
      if (!response?.success) {
        setPaymentState('error');
        Alert.alert(
          'Education',
          response?.message || 'Unable to complete this education action.',
        );
        return;
      }
      const payload = response?.data ?? {};
      setPaymentState('success');
      setReceiptUrl(payload?.receiptUrl ?? null);
      setEnrollmentVisible(false);
      const nextViewerState = {
        ...((item as any)?.viewerState || {}),
        enrollment:
          payload?.enrollment ?? (item as any)?.viewerState?.enrollment ?? null,
        booking:
          payload?.booking ?? (item as any)?.viewerState?.booking ?? null,
        enrollment_status:
          payload?.enrollment?.status ??
          (item as any)?.viewerState?.enrollment?.status ??
          (item as any)?.viewerState?.enrollment_status ??
          '',
        booking_status:
          payload?.booking?.status ??
          (item as any)?.viewerState?.booking?.status ??
          (item as any)?.viewerState?.booking_status ??
          '',
      };
      nextViewerState.has_learning_access = ACTIVE_ENROLLMENT_STATUSES.has(
        String(nextViewerState.enrollment_status || '').toLowerCase(),
      );
      if (detailItem?.id === item.id) {
        setDetailItem(prev =>
          prev
            ? ({
                ...prev,
                viewerState: nextViewerState,
                progress: payload?.progress ?? (prev as any)?.progress ?? null,
              } as unknown as EducationContentItem)
            : prev,
        );
      }
      await refresh();
      await hydrateDetail(item.id, {
        ...item,
        viewerState: nextViewerState,
        progress: payload?.progress ?? null,
      } as unknown as EducationContentItem);
      setDetailVisible(true);
      const booking = payload?.booking;
      if (booking?.status === 'awaiting_satisfaction') {
        Alert.alert(
          'Booked',
          'Payment is held in KISC escrow until you confirm satisfaction or auto-release after 3 days.',
        );
        return;
      }
      if (booking?.status === 'confirmed') {
        Alert.alert(
          'Booked',
          'Payment received in KISC and held until the provider marks this completed.',
        );
        return;
      }
      if (payload?.enrollment) {
        Alert.alert('Enrollment', `${item.title} added to your learning flow.`);
        return;
      }
      Alert.alert('Education', 'Action completed successfully.');
    },
    [detailItem?.id, hydrateDetail, refresh],
  );

  const freeEnroll = useCallback(
    async (item: EducationContentItem) => {
      await handleEnrollmentRequest(item);
    },
    [handleEnrollmentRequest],
  );

  const checkout = useCallback(
    async (item: EducationContentItem) => {
      await handleEnrollmentRequest(item);
    },
    [handleEnrollmentRequest],
  );

  const renderExpandedHeader = (title: string, subtitle: string) => (
    <View
      style={{
        borderRadius: 26,
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: palette.surface,
        padding: 14,
        marginBottom: 14,
        shadowColor: palette.shadow ?? '#000',
        shadowOpacity: 0.08,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
        elevation: 3,
      }}
    >
      <KISButton
        title="Back to education"
        size="sm"
        variant="outline"
        onPress={() => setExpandedList(null)}
      />
      <Text
        style={{
          color: palette.subtext,
          fontSize: 10,
          fontWeight: '800',
          letterSpacing: 1,
          textTransform: 'uppercase',
          marginTop: 14,
        }}
      >
        Full collection
      </Text>
      <Text
        style={{
          color: palette.text,
          fontWeight: '900',
          fontSize: 22,
          marginTop: 3,
        }}
        numberOfLines={1}
      >
        {title}
      </Text>
      <Text
        style={{ color: palette.subtext, marginTop: 5, lineHeight: 18 }}
        numberOfLines={2}
      >
        {subtitle}
      </Text>
    </View>
  );

  const renderVerticalContentCard = (item: EducationContentItem) => {
    const progress = progressMap[`${item.type}-${item.id}`];
    const imageUri = resolveContentImage(item);
    const pricing = 'price' in item ? item.price : undefined;
    const priceLabel = pricing?.isFree
      ? 'Free'
      : pricing
      ? `${pricing.currency || 'KISC'} ${
          Number(pricing.amountCents || 0) / 100
        }`
      : 'Pricing TBD';
    return (
      <Pressable
        key={`${item.type}-${item.id}`}
        onPress={() => openDetails(item)}
        style={{
          borderRadius: 24,
          borderWidth: 1,
          borderColor: palette.border,
          backgroundColor: palette.surface,
          overflow: 'hidden',
          marginBottom: 12,
          shadowColor: palette.shadow ?? '#000',
          shadowOpacity: 0.07,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 8 },
          elevation: 2,
        }}
      >
        <View
          style={{
            width: '100%',
            height: 224,
            overflow: 'hidden',
            backgroundColor: palette.primarySoft,
          }}
        >
          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
            />
          ) : (
            <View
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                padding: 18,
              }}
            >
              <Text
                style={{
                  color: palette.primaryStrong,
                  fontWeight: '900',
                  fontSize: 13,
                  textAlign: 'center',
                }}
                numberOfLines={2}
              >
                {item.partnerName || item.title}
              </Text>
            </View>
          )}
          <View
            style={{
              position: 'absolute',
              left: 10,
              bottom: 10,
              borderRadius: 999,
              paddingHorizontal: 10,
              paddingVertical: 5,
              backgroundColor: 'rgba(0,0,0,0.56)',
            }}
          >
            <Text
              style={{
                color: '#fff',
                fontSize: 10,
                fontWeight: '900',
                textTransform: 'uppercase',
              }}
              numberOfLines={1}
            >
              {item.type.replace(/_/g, ' ')}
            </Text>
          </View>
        </View>
        <View style={{ padding: 14 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={{
                  color: palette.primaryStrong,
                  fontSize: 11,
                  fontWeight: '900',
                  letterSpacing: 0.7,
                  textTransform: 'uppercase',
                }}
                numberOfLines={1}
              >
                {item.type.replace(/_/g, ' ')}
              </Text>
              <Text
                style={{
                  color: palette.text,
                  fontSize: 18,
                  fontWeight: '900',
                  marginTop: 4,
                  lineHeight: 22,
                }}
                numberOfLines={2}
              >
                {item.title}
              </Text>
            </View>
            <Text
              style={{
                color: palette.primaryStrong,
                fontWeight: '900',
                fontSize: 12,
                maxWidth: 92,
                textAlign: 'right',
              }}
              numberOfLines={1}
            >
              {getStatusLabel(item, progress) || priceLabel}
            </Text>
          </View>
          {item.summary ? (
            <Text
              style={{ color: palette.subtext, marginTop: 8, lineHeight: 19 }}
              numberOfLines={2}
            >
              {item.summary}
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <KISButton
              title={getPrimaryActionLabel(item, progress)}
              size="xs"
              onPress={() => {
                if (hasLearningAccessForItem(item, progress)) {
                  void openDetails(item);
                  return;
                }
                enrollCourse(item);
              }}
            />
            <KISButton
              title="Details"
              size="xs"
              variant="outline"
              onPress={() => openDetails(item)}
            />
          </View>
        </View>
      </Pressable>
    );
  };

  const renderVerticalProgressCard = (item: EducationProgress) =>
    (() => {
      const seed =
        contentByProgressKey[`${item.contentType}-${item.contentId}`];
      const imageUri = resolveContentImage(seed);
      return (
        <Pressable
          key={`${item.contentType}-${item.contentId}`}
          onPress={() => resumeLearning(item)}
          style={{
            borderRadius: 24,
            borderWidth: 1,
            borderColor: palette.border,
            backgroundColor: palette.surface,
            overflow: 'hidden',
            marginBottom: 12,
          }}
        >
          <View
            style={{
              width: '100%',
              height: 202,
              overflow: 'hidden',
              backgroundColor: palette.primarySoft,
            }}
          >
            {imageUri ? (
              <Image
                source={{ uri: imageUri }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="cover"
              />
            ) : (
              <View
                style={{
                  flex: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 18,
                }}
              >
                <Text
                  style={{
                    color: palette.primaryStrong,
                    fontWeight: '900',
                    textAlign: 'center',
                  }}
                  numberOfLines={2}
                >
                  {item.contentTitle || item.lastLessonTitle || 'Learning item'}
                </Text>
              </View>
            )}
            <View
              style={{
                position: 'absolute',
                right: 12,
                bottom: 12,
                borderRadius: 999,
                paddingHorizontal: 12,
                paddingVertical: 6,
                backgroundColor: 'rgba(0,0,0,0.58)',
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 12 }}>
                {Math.round(item.progressPercent)}%
              </Text>
            </View>
          </View>
          <View style={{ padding: 14 }}>
            <View style={{ minWidth: 0 }}>
              <Text
                style={{
                  color: palette.text,
                  fontWeight: '900',
                  fontSize: 18,
                  lineHeight: 22,
                }}
                numberOfLines={2}
              >
                {item.contentTitle || item.lastLessonTitle || 'Learning item'}
              </Text>
              <Text
                style={{ color: palette.subtext, marginTop: 4 }}
                numberOfLines={2}
              >
                {item.currentModule?.title ||
                  item.lastLessonTitle ||
                  'Resume where you left off'}
              </Text>
              <Text
                style={{
                  color: palette.primaryStrong,
                  fontWeight: '900',
                  marginTop: 8,
                }}
              >
                {Math.round(item.progressPercent)}%
              </Text>
            </View>
            <View
              style={{
                height: 7,
                backgroundColor: palette.border,
                borderRadius: 999,
                marginTop: 12,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  width: `${Math.max(2, Math.min(100, item.progressPercent))}%`,
                  height: '100%',
                  backgroundColor: palette.primaryStrong,
                }}
              />
            </View>
          </View>
        </Pressable>
      );
    })();

  const renderVerticalInstitutionCard = (
    institution: EducationInstitutionSpotlight,
  ) => {
    const imageUri = resolveInstitutionImage(institution);
    return (
      <View
        key={institution.id}
        style={{
          borderRadius: 24,
          borderWidth: 1,
          borderColor: palette.border,
          backgroundColor: palette.surface,
          overflow: 'hidden',
          marginBottom: 12,
        }}
      >
        <View
          style={{
            width: '100%',
            height: 216,
            overflow: 'hidden',
            backgroundColor: palette.primarySoft,
          }}
        >
          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
            />
          ) : (
            <View
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                padding: 18,
              }}
            >
              <Text
                style={{
                  color: palette.primaryStrong,
                  fontWeight: '900',
                  textAlign: 'center',
                  fontSize: 15,
                }}
                numberOfLines={2}
              >
                {institution.name}
              </Text>
            </View>
          )}
          <View
            style={{
              position: 'absolute',
              left: 12,
              bottom: 12,
              borderRadius: 999,
              paddingHorizontal: 12,
              paddingVertical: 6,
              backgroundColor: 'rgba(0,0,0,0.58)',
            }}
          >
            <Text
              style={{
                color: '#fff',
                fontSize: 10,
                fontWeight: '900',
                letterSpacing: 0.7,
                textTransform: 'uppercase',
              }}
            >
              {String(institution.institutionType || 'Institution').replace(
                /_/g,
                ' ',
              )}
            </Text>
          </View>
        </View>
        <View style={{ padding: 14 }}>
          <View style={{ minWidth: 0 }}>
            <Text
              style={{
                color: palette.primaryStrong,
                fontSize: 11,
                fontWeight: '900',
                letterSpacing: 0.7,
                textTransform: 'uppercase',
              }}
            >
              {String(institution.institutionType || 'Institution').replace(
                /_/g,
                ' ',
              )}
            </Text>
            <Text
              style={{
                color: palette.text,
                fontWeight: '900',
                fontSize: 18,
                marginTop: 4,
              }}
              numberOfLines={2}
            >
              {institution.name}
            </Text>
            {institution.description ? (
              <Text
                style={{ color: palette.subtext, marginTop: 7, lineHeight: 18 }}
                numberOfLines={2}
              >
                {institution.description}
              </Text>
            ) : null}
            <Text
              style={{ color: palette.subtext, marginTop: 10, fontSize: 12 }}
            >
              {institution.courseCount ?? 0} courses ·{' '}
              {institution.programCount ?? 0} programs ·{' '}
              {institution.eventCount ?? 0} events
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderExpandedList = () => {
    if (!expandedList) return null;
    return (
      <>
        {renderExpandedHeader(expandedList.title, expandedList.subtitle)}
        {expandedList.kind === 'content'
          ? expandedList.items.map(renderVerticalContentCard)
          : null}
        {expandedList.kind === 'progress'
          ? expandedList.items.map(renderVerticalProgressCard)
          : null}
        {expandedList.kind === 'institutions'
          ? expandedList.items.map(renderVerticalInstitutionCard)
          : null}
      </>
    );
  };

  const renderLearningOverview = () => (
    <View
      style={{
        marginBottom: 20,
        borderRadius: 26,
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: palette.surface,
        padding: 14,
        shadowColor: palette.shadow ?? '#000',
        shadowOpacity: 0.08,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
        elevation: 3,
      }}
    >
      <Text
        style={{
          color: palette.subtext,
          fontSize: 10,
          fontWeight: '800',
          letterSpacing: 1,
          textTransform: 'uppercase',
        }}
      >
        Learning estate
      </Text>
      <Text
        style={{
          color: palette.text,
          fontWeight: '900',
          fontSize: 20,
          marginTop: 2,
          marginBottom: 12,
        }}
      >
        Your learning hub
      </Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {[
          {
            label: 'Active',
            value: String(learningStats.total),
            hint: 'In progress',
          },
          {
            label: 'Certified',
            value: String(learningStats.certificateReady),
            hint: 'Ready',
          },
          {
            label: 'Live',
            value: String(learningStats.upcomingLive),
            hint: 'Scheduled',
          },
        ].map(card => (
          <View
            key={card.label}
            style={{
              flex: 1,
              minWidth: 0,
              borderRadius: 20,
              paddingHorizontal: 10,
              paddingVertical: 12,
              backgroundColor: palette.primarySoft,
              borderWidth: 1,
              borderColor: palette.border,
            }}
          >
            <Text
              style={{
                color: palette.subtext,
                fontSize: 10,
                fontWeight: '800',
              }}
              numberOfLines={1}
            >
              {card.label}
            </Text>
            <Text
              style={{
                color: palette.text,
                fontSize: 22,
                fontWeight: '900',
                marginTop: 4,
              }}
              numberOfLines={1}
            >
              {card.value}
            </Text>
            <Text
              style={{ color: palette.subtext, marginTop: 3, fontSize: 11 }}
              numberOfLines={1}
            >
              {card.hint}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );

  const renderInstitutionSpotlights = () => {
    if (!institutionSpotlights.length) return null;
    return (
      <View style={{ marginBottom: 22 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 10,
          }}
        >
          <Text
            style={{
              color: palette.text,
              fontWeight: '900',
              fontSize: 18,
            }}
          >
            Institutions to learn from
          </Text>
          <Pressable
            onPress={() =>
              setExpandedList({
                kind: 'institutions',
                title: 'Institutions to learn from',
                subtitle:
                  'A vertical view of every featured learning provider.',
                items: institutionSpotlights,
              })
            }
          >
            <Text style={{ color: palette.primaryStrong, fontWeight: '800' }}>
              See all
            </Text>
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {institutionSpotlights.map(
            (institution: EducationInstitutionSpotlight) => (
              <View
                key={institution.id}
                style={{
                  width: 240,
                  marginRight: 12,
                  borderRadius: 22,
                  padding: 14,
                  backgroundColor: palette.surface,
                  borderWidth: 1,
                  borderColor: palette.border,
                  shadowColor: palette.shadow ?? '#000',
                  shadowOpacity: 0.07,
                  shadowRadius: 14,
                  shadowOffset: { width: 0, height: 8 },
                }}
              >
                <Text
                  style={{
                    color: palette.primaryStrong,
                    fontSize: 11,
                    fontWeight: '700',
                  }}
                >
                  {String(institution.institutionType || 'Institution').replace(
                    /_/g,
                    ' ',
                  )}
                </Text>
                <Text
                  style={{
                    color: palette.text,
                    fontWeight: '900',
                    fontSize: 17,
                    marginTop: 6,
                  }}
                  numberOfLines={1}
                >
                  {institution.name}
                </Text>
                {institution.description ? (
                  <Text
                    style={{
                      color: palette.subtext,
                      marginTop: 6,
                      lineHeight: 18,
                    }}
                    numberOfLines={3}
                  >
                    {institution.description}
                  </Text>
                ) : null}
                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: 8,
                    marginTop: 10,
                  }}
                >
                  <Text style={{ color: palette.subtext, fontSize: 12 }}>
                    {institution.courseCount ?? 0} courses
                  </Text>
                  <Text style={{ color: palette.subtext, fontSize: 12 }}>
                    {institution.programCount ?? 0} programs
                  </Text>
                  <Text style={{ color: palette.subtext, fontSize: 12 }}>
                    {institution.eventCount ?? 0} events
                  </Text>
                </View>
              </View>
            ),
          )}
        </ScrollView>
      </View>
    );
  };

  const renderHero = () => {
    if (!heroContent) return null;
    const heroPricing = 'price' in heroContent ? heroContent.price : undefined;
    const heroProgress = progressMap[`${heroContent.type}-${heroContent.id}`];
    const heroPrimaryLabel = getPrimaryActionLabel(heroContent, heroProgress);
    return (
      <View
        style={{
          borderRadius: 20,
          borderWidth: 1,
          borderColor: palette.border,
          backgroundColor: palette.surface,
          padding: 16,
          marginBottom: 16,
          shadowColor: palette.shadow ?? '#000',
          shadowOpacity: 0.09,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 10 },
          elevation: 4,
        }}
      >
        <Text
          style={{
            color: palette.primaryStrong,
            fontSize: 11,
            fontWeight: '900',
            letterSpacing: 0.8,
            textTransform: 'uppercase',
          }}
          numberOfLines={1}
        >
          {HERO_BADGES[heroContent.type]}
        </Text>
        <Text
          style={{
            color: palette.text,
            fontWeight: '900',
            fontSize: 20,
            marginTop: 4,
          }}
          numberOfLines={2}
        >
          {heroContent.title}
        </Text>
        {heroContent.summary ? (
          <Text
            style={{ color: palette.subtext, marginTop: 4, lineHeight: 18 }}
            numberOfLines={2}
          >
            {heroContent.summary}
          </Text>
        ) : null}
        <Text
          style={{
            color: palette.primaryStrong,
            fontWeight: '800',
            marginTop: 8,
          }}
        >
          {heroPricing?.isFree
            ? 'Free'
            : `${heroPricing?.currency || 'KISC'} ${
                Number(heroPricing?.amountCents || 0) / 100
              }`}
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
          <KISButton
            title="Preview"
            size="sm"
            variant="outline"
            onPress={() => previewCourse(heroContent)}
          />
          <KISButton
            title="Details"
            size="sm"
            variant="secondary"
            onPress={() => openDetails(heroContent)}
          />
          <KISButton
            title={heroPrimaryLabel}
            size="sm"
            onPress={() => {
              if (hasLearningAccessForItem(heroContent, heroProgress)) {
                void openDetails(heroContent);
                return;
              }
              enrollCourse(heroContent);
            }}
          />
        </View>
      </View>
    );
  };

  const renderSection = (section: any) => {
    if (!Array.isArray(section.items) || section.items.length === 0)
      return null;
    return (
      <View key={section.id} style={{ marginBottom: 24 }}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Text
            style={{ color: palette.text, fontWeight: '900', fontSize: 18 }}
            numberOfLines={1}
          >
            {section.title}
          </Text>
          <Pressable
            onPress={() =>
              setExpandedList({
                kind: 'content',
                title: section.title,
                subtitle:
                  'A focused vertical view designed for browsing this collection.',
                items: section.items,
              })
            }
          >
            <Text style={{ color: palette.primaryStrong, fontSize: 12 }}>
              See all
            </Text>
          </Pressable>
        </View>
        <FlatList
          data={section.items}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item: any) => `${item.type}-${item.id}`}
          contentContainerStyle={{ paddingTop: 10, paddingRight: 8 }}
          renderItem={({ item }: { item: EducationContentItem }) => (
            <EducationContentCard
              item={item}
              onSelect={openDetails}
              onPrimaryAction={selected => {
                const progress = progressMap[`${selected.type}-${selected.id}`];
                if (hasLearningAccessForItem(selected, progress)) {
                  void openDetails(selected);
                  return;
                }
                enrollCourse(selected);
              }}
              onSecondaryAction={openDetails}
              primaryLabel={getPrimaryActionLabel(
                item,
                progressMap[`${item.type}-${item.id}`],
              )}
              secondaryLabel="Details"
              statusLabel={getStatusLabel(
                item,
                progressMap[`${item.type}-${item.id}`],
              )}
              progress={progressMap[`${item.type}-${item.id}`]}
            />
          )}
        />
      </View>
    );
  };

  if (loading && !data) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: palette.bg,
        }}
      >
        <ActivityIndicator color={palette.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refresh}
            tintColor={palette.primary}
          />
        }
      >
        {expandedList ? (
          renderExpandedList()
        ) : (
          <>
            {renderLearningOverview()}
            {renderHero()}
            {renderInstitutionSpotlights()}

            <View style={{ marginBottom: 24 }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 8,
                }}
              >
                <Text style={{ color: palette.text, fontWeight: '900' }}>
                  Continue learning
                </Text>
                {continueLearning.length ? (
                  <Pressable
                    onPress={() =>
                      setExpandedList({
                        kind: 'progress',
                        title: 'Continue learning',
                        subtitle:
                          'A vertical view of every course and session you can resume.',
                        items: continueLearning,
                      })
                    }
                  >
                    <Text
                      style={{
                        color: palette.primaryStrong,
                        fontWeight: '800',
                      }}
                    >
                      See all
                    </Text>
                  </Pressable>
                ) : null}
              </View>
              <EducationContinueLearning
                items={continueLearning}
                onResume={resumeLearning}
              />
            </View>
          </>
        )}

        {!expandedList && error ? (
          <View
            style={{
              borderWidth: 2,
              borderColor: palette.danger ?? palette.primaryStrong,
              borderRadius: 18,
              padding: 12,
              backgroundColor: palette.surface,
              marginBottom: 16,
            }}
          >
            <Text
              style={{
                color: palette.danger ?? palette.primaryStrong,
                marginBottom: 8,
              }}
            >
              {error}
            </Text>
            <KISButton title="Retry" onPress={refresh} />
          </View>
        ) : null}

        {!expandedList ? (data?.sections ?? []).map(renderSection) : null}
      </ScrollView>

      <EducationDetailSheet
        visible={detailVisible}
        item={
          detailItem
            ? ({ ...detailItem, detailLoading } as EducationContentItem & {
                detailLoading?: boolean;
              })
            : null
        }
        onClose={() => {
          setDetailVisible(false);
          setDetailLoading(false);
        }}
        onEnroll={item => enrollCourse(item)}
        onPreview={item => previewCourse(item)}
        onRefreshProgress={refresh}
      />

      <EducationEnrollmentSheet
        visible={enrollmentVisible}
        content={selectedCourse}
        onClose={() => setEnrollmentVisible(false)}
        onFreeEnroll={item => freeEnroll(item)}
        onCheckout={item => checkout(item)}
        paymentState={paymentState}
        receiptUrl={receiptUrl}
      />
    </View>
  );
}
