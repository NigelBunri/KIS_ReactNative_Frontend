import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import KISButton from '@/constants/KISButton';
import KISTextInput from '@/constants/KISTextInput';
import EducationContentCard from '@/screens/broadcast/education/components/EducationContentCard';
import EducationContinueLearning from '@/screens/broadcast/education/components/EducationContinueLearning';
import EducationDetailSheet from '@/screens/broadcast/education/components/EducationDetailSheet';
import EducationEnrollmentSheet from '@/screens/broadcast/education/components/EducationEnrollmentSheet';
import EducationFilterSheet from '@/screens/broadcast/education/components/EducationFilterSheet';
import useEducationDiscovery, { EDUCATION_SORT_OPTIONS } from '@/screens/broadcast/education/hooks/useEducationDiscovery';
import useEducationOfflineStore from '@/screens/broadcast/education/hooks/useEducationOfflineStore';
import type {
  EducationContentItem,
  EducationContentType,
  EducationProgress,
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

export default function EducationV2DiscoverPage({
  searchTerm = '',
  searchContext = 'Courses',
  onUnavailable,
  onAvailable,
}: Props) {
  const { palette } = useKISTheme();
  const {
    data,
    loading,
    error,
    refresh,
    search,
    setSearch,
    filters,
    updateFilter,
    sort,
    setSort,
    sortOptions,
    availableFilters,
  } = useEducationDiscovery({
    initialSearch: searchTerm,
    onUnavailable,
    onAvailable,
  });
  const { scheduleDownload, isDownloaded } = useEducationOfflineStore();
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<EducationContentItem | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [enrollmentVisible, setEnrollmentVisible] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<EducationContentItem | null>(null);
  const [paymentState, setPaymentState] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);

  const heroContent = data?.heroCourse ?? null;
  const continueLearning = useMemo(
    () => data?.continueLearning ?? [],
    [data?.continueLearning],
  );
  const progressMap = useMemo(() => {
    const map: Record<string, EducationProgress> = {};
    continueLearning.forEach((progress) => {
      map[`${progress.contentType}-${progress.contentId}`] = progress;
    });
    return map;
  }, [continueLearning]);

  const filterSummary = useMemo(() => {
    const parts: string[] = [];
    if (filters.type) parts.push(filters.type);
    if (filters.level && filters.level !== 'all') parts.push(filters.level);
    if (filters.price) parts.push(filters.price === 'free' ? 'Free' : 'Paid');
    return parts.length ? parts.join(' · ') : 'All filters';
  }, [filters]);

  const openDetails = (item: EducationContentItem) => {
    setDetailItem(item);
    setDetailVisible(true);
  };

  const enrollCourse = (item: EducationContentItem) => {
    setSelectedCourse(item);
    setEnrollmentVisible(true);
    setPaymentState('idle');
    setReceiptUrl(null);
  };

  const previewCourse = (item: EducationContentItem) => {
    Alert.alert('Preview lesson', `Playing preview for “${item.title}”.`);
  };

  const freeEnroll = (item: EducationContentItem) => {
    setPaymentState('processing');
    setTimeout(() => {
      setPaymentState('success');
      setReceiptUrl(`https://receipts.kis/${item.id}`);
      Alert.alert('Enrollment', `${item.title} added to your library.`);
    }, 1400);
  };

  const checkout = (item: EducationContentItem) => {
    setPaymentState('processing');
    setTimeout(() => {
      setPaymentState('success');
      setReceiptUrl(`https://receipts.kis/${item.id}`);
      Alert.alert('Checkout', 'Payment confirmed. Enjoy the course!');
    }, 1800);
  };

  const downloadContent = (item: EducationContentItem) => {
    scheduleDownload({
      contentId: item.id,
      contentType: item.type,
      progressPercent: 0,
      downloaded: true,
    });
    Alert.alert('Offline', `${item.title} queued for offline sync.`);
  };

  const renderHero = () => {
    if (!heroContent) return null;
    const heroPricing = 'price' in heroContent ? heroContent.price : undefined;
    return (
      <View
        style={{
          borderRadius: 20,
          borderWidth: 2,
          borderColor: palette.divider,
          backgroundColor: palette.card,
          padding: 16,
          marginBottom: 16,
        }}
      >
        <Text style={{ color: palette.subtext, fontSize: 12 }}>{HERO_BADGES[heroContent.type]}</Text>
        <Text style={{ color: palette.text, fontWeight: '900', fontSize: 20, marginTop: 4 }}>
          {heroContent.title}
        </Text>
        {heroContent.summary ? <Text style={{ color: palette.subtext, marginTop: 4 }}>{heroContent.summary}</Text> : null}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
          <KISButton title="Preview" size="sm" variant="outline" onPress={() => previewCourse(heroContent)} />
          <KISButton title="Details" size="sm" variant="secondary" onPress={() => openDetails(heroContent)} />
          <KISButton
            title={heroPricing?.isFree ? 'Free enroll' : 'Enroll'}
            size="sm"
            onPress={() => enrollCourse(heroContent)}
          />
        </View>
      </View>
    );
  };

  const renderSection = (section: any) => {
    if (!Array.isArray(section.items) || section.items.length === 0) return null;
    return (
      <View key={section.id} style={{ marginBottom: 24 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: palette.text, fontWeight: '800' }}>{section.title}</Text>
          <Pressable onPress={() => Alert.alert('See all', `${section.title} coming soon.`)}>
            <Text style={{ color: palette.primaryStrong, fontSize: 12 }}>See all</Text>
          </Pressable>
        </View>
          <FlatList
            data={section.items}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item: any) => `${item.type}-${item.id}`}
            renderItem={({ item }: { item: EducationContentItem }) => (
              <EducationContentCard
                item={item}
                onSelect={openDetails}
              onPrimaryAction={openDetails}
              onDownload={downloadContent}
              downloaded={isDownloaded(item.id, item.type)}
              progress={progressMap[`${item.type}-${item.id}`]}
            />
          )}
        />
      </View>
    );
  };

  if (loading && !data) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: palette.bg }}>
        <ActivityIndicator color={palette.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={palette.primary} />}
      >
        <View style={{ marginBottom: 12 }}>
          <Text style={{ color: palette.text, fontWeight: '700', marginBottom: 4 }}>{searchContext}</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <KISTextInput
              placeholder="Search courses, lessons, programs"
              value={search}
              onChangeText={setSearch}
              style={{ flex: 1 }}
            />
            <KISButton title={filterSummary} size="sm" variant="outline" onPress={() => setFilterSheetOpen(true)} />
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
          {(sortOptions ?? EDUCATION_SORT_OPTIONS).map((option) => (
            <Pressable
              key={option}
              onPress={() => setSort(option)}
              style={{
                borderRadius: 14,
                borderWidth: 1,
                borderColor: option === sort ? palette.primaryStrong : palette.divider,
                paddingHorizontal: 12,
                paddingVertical: 6,
                backgroundColor: option === sort ? palette.primarySoft : 'transparent',
              }}
            >
              <Text style={{ color: option === sort ? palette.primaryStrong : palette.subtext, fontSize: 12 }}>
                {option.replace(/_/g, ' ')}
              </Text>
            </Pressable>
          ))}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          {(data?.categories ?? []).map((category) => (
            <Pressable
              key={category.id}
              onPress={() => updateFilter('topic', category.label)}
              style={{
                borderRadius: 16,
                borderWidth: 1,
                borderColor: filters.topic === category.label ? palette.primaryStrong : palette.divider,
                paddingHorizontal: 14,
                paddingVertical: 6,
                marginRight: 8,
              }}
            >
              <Text style={{ color: filters.topic === category.label ? palette.primaryStrong : palette.subtext }}>
                {category.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {renderHero()}

        <View style={{ marginBottom: 24 }}>
          <Text style={{ color: palette.text, fontWeight: '800', marginBottom: 8 }}>Continue learning</Text>
          <EducationContinueLearning
            items={continueLearning}
            onResume={(item) => Alert.alert('Resume', `Opening latest lesson for ${item.contentId}.`)}
          />
        </View>

        {error ? (
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
            <Text style={{ color: palette.danger ?? palette.primaryStrong, marginBottom: 8 }}>{error}</Text>
            <KISButton title="Retry" onPress={refresh} />
          </View>
        ) : null}

        {(data?.sections ?? []).map(renderSection)}
      </ScrollView>

      <EducationFilterSheet
        visible={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        filters={filters}
        available={availableFilters}
        onUpdate={updateFilter}
        onReset={() => {
          updateFilter('type', undefined);
          updateFilter('language', undefined);
          updateFilter('level', undefined);
          updateFilter('price', undefined);
          updateFilter('topic', undefined);
          updateFilter('creator', undefined);
        }}
      />

      <EducationDetailSheet
        visible={detailVisible}
        item={detailItem}
        onClose={() => setDetailVisible(false)}
        onEnroll={(item) => enrollCourse(item)}
        onPreview={(item) => previewCourse(item)}
      />

      <EducationEnrollmentSheet
        visible={enrollmentVisible}
        content={selectedCourse}
        onClose={() => setEnrollmentVisible(false)}
        onFreeEnroll={(item) => freeEnroll(item)}
        onCheckout={(item) => checkout(item)}
        paymentState={paymentState}
        receiptUrl={receiptUrl}
      />
    </View>
  );
}
