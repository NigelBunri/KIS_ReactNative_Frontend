// src/screens/broadcast/education/components/EducationContentCard.tsx
import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import KISButton from '@/constants/KISButton';
import { KISIcon } from '@/constants/kisIcons';
import PermanentRemoteImage from '@/components/media/PermanentRemoteImage';
import {
  EducationContentType,
  EducationContentItem,
  EducationProgress,
} from '@/screens/broadcast/education/api/education.models';

type Props = {
  item: EducationContentItem;
  onSelect?: (item: EducationContentItem) => void;
  onPrimaryAction?: (item: EducationContentItem) => void;
  primaryLabel?: string;
  onSecondaryAction?: (item: EducationContentItem) => void;
  secondaryLabel?: string;
  statusLabel?: string;
  onDownload?: (item: EducationContentItem) => void;
  downloadDisabled?: boolean;
  downloaded?: boolean;
  progress?: EducationProgress | null;
  // Card fills the width of its parent (grid usage) instead of the fixed
  // horizontal-scroll-row width — see BroadcastEducationPage's "View all"
  // grids vs. its teaser rows.
  fillWidth?: boolean;
};

const getTypeLabel = (type: EducationContentType) => {
  switch (type) {
    case 'course':
      return 'Course';
    case 'lesson':
      return 'Lesson';
    case 'workshop':
      return 'Workshop';
    case 'program':
      return 'Program';
    case 'class':
      return 'Class';
    case 'credential':
      return 'Credential';
    case 'mentorship':
      return 'Mentorship';
    case 'institution':
      return '🏫 Institution';
    default:
      return 'Content';
  }
};

const getDescription = (item: EducationContentItem) => {
  // Institution cards: partnerName duplicates the title (both are the
  // institution's own name) — show its description instead.
  if (item.type === 'institution') return item.summary || item.description || null;
  return item.summary || item.description || null;
};

const formatPrice = (item: EducationContentItem) => {
  const pricing = 'price' in item ? item.price : undefined;
  if (!pricing) return 'Pricing TBD';
  if (pricing.isFree) return 'Free';
  const amount = Number(pricing.amountCents || 0) / 100;
  return `${pricing.currency || 'USD'} ${amount.toLocaleString()}`;
};

const formatSchedule = (item: EducationContentItem) => {
  if (!item.startsAt) return null;
  const value = new Date(item.startsAt);
  if (Number.isNaN(value.getTime())) return null;
  return value.toLocaleDateString();
};

// Luxurious "feed post" card, top to bottom: the posting institution
// (circular gold-ringed logo + name) up top, then the content's own title,
// then a full-width cover image, then the description, then stat/trust
// badges, then the action buttons. Institution-spotlight cards skip their
// own "posted by" row (the card already IS the institution) but otherwise
// share the exact same shell/order — used identically in the public
// broadcast feed and in the creator's course list.
export default function EducationContentCard({
  item,
  onSelect,
  onPrimaryAction,
  primaryLabel,
  onSecondaryAction,
  secondaryLabel,
  statusLabel,
  onDownload,
  downloadDisabled,
  downloaded,
  progress,
  fillWidth,
}: Props) {
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const cardWidth: number | '100%' = fillWidth ? '100%' : responsive.isTablet ? 320 : 272;
  const imageHeight = responsive.isWatch ? 130 : responsive.isCompactPhone ? 150 : 176;

  const handlePrimary = () => {
    if (onPrimaryAction) {
      onPrimaryAction(item);
    } else if (onSelect) {
      onSelect(item);
    }
  };

  const isInstitution = item.type === 'institution';
  const institutionName = 'partnerName' in item ? item.partnerName : undefined;
  const institutionLogoUrl = 'partnerLogoUrl' in item ? item.partnerLogoUrl : undefined;
  const showInstitutionHeader = !isInstitution && !!institutionName;

  // A promotional institution card advertises the institution as a whole —
  // course/member counts are the relevant stats here, not price/duration/
  // schedule, which don't apply to the institution itself.
  const metadata = isInstitution
    ? [
        typeof item.courseCount === 'number' ? `${item.courseCount} courses` : null,
        typeof item.memberCount === 'number' ? `${item.memberCount} members` : null,
      ].filter(Boolean)
    : [
        formatPrice(item),
        item.durationMinutes ? `${item.durationMinutes} mins` : null,
        item.reviewSummary?.reviewCount
          ? `${Number(item.reviewSummary.rating || 0).toFixed(1)} stars`
          : null,
        formatSchedule(item),
        item.deliveryMode ? String(item.deliveryMode).replace(/_/g, ' ') : null,
      ].filter(Boolean);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${getTypeLabel(item.type)}: ${item.title}${
        progress ? `, ${progress.progressPercent}% complete` : ''
      }`}
      onPress={handlePrimary}
      style={{
        width: cardWidth,
        borderWidth: 1.5,
        borderColor: isInstitution ? palette.primary : `${palette.gold ?? palette.primary}55`,
        borderRadius: 26,
        backgroundColor: isInstitution ? palette.primarySoft : palette.surface,
        overflow: 'hidden',
        marginBottom: 14,
        marginRight: fillWidth ? 0 : 14,
        shadowColor: palette.goldShadow ?? palette.shadow ?? palette.royalInk,
        shadowOpacity: isInstitution ? 0.18 : 0.14,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 10 },
        elevation: isInstitution ? 6 : 5,
      }}
    >
      {/* 1. Posting institution — circular gold-ringed logo + name, feed-post style */}
      {showInstitutionHeader ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 9,
            paddingHorizontal: 14,
            paddingTop: 13,
            paddingBottom: 10,
          }}
        >
          {institutionLogoUrl ? (
            <Image
              source={{ uri: institutionLogoUrl }}
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                borderWidth: 1.5,
                borderColor: palette.gold ?? palette.primary,
                backgroundColor: palette.bg,
              }}
            />
          ) : (
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                borderWidth: 1.5,
                borderColor: palette.gold ?? palette.primary,
                backgroundColor: palette.primarySoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <KISIcon name="school" size={16} color={palette.primaryStrong} />
            </View>
          )}
          <Text style={{ color: palette.text, fontWeight: '800', fontSize: 13, flex: 1 }} numberOfLines={1}>
            {institutionName}
          </Text>
          <Text
            style={{ color: palette.goldDeep ?? palette.primaryStrong, fontWeight: '900', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6 }}
            numberOfLines={1}
          >
            {getTypeLabel(item.type)}
          </Text>
        </View>
      ) : null}

      {/* 2. Title (eyebrow + status/progress above it when there's no institution header) */}
      <View style={{ paddingHorizontal: 14, paddingTop: showInstitutionHeader ? 0 : 14, paddingBottom: 8 }}>
        {!showInstitutionHeader ? (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
            <Text
              style={{ color: palette.goldDeep ?? palette.primaryStrong, fontWeight: '900', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6 }}
              numberOfLines={1}
            >
              {getTypeLabel(item.type)}
            </Text>
            {statusLabel ? (
              <View
                style={{
                  borderRadius: 999,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderWidth: 1,
                  borderColor: palette.primary,
                  backgroundColor: palette.primarySoft,
                  maxWidth: 100,
                }}
              >
                <Text style={{ color: palette.primaryStrong, fontSize: 10, fontWeight: '900' }} numberOfLines={1}>
                  {statusLabel}
                </Text>
              </View>
            ) : progress ? (
              <Text style={{ color: palette.subtext, fontSize: 12 }}>{progress.progressPercent}% complete</Text>
            ) : null}
          </View>
        ) : statusLabel ? (
          <View style={{ alignItems: 'flex-start', marginBottom: 4 }}>
            <View
              style={{
                borderRadius: 999,
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderWidth: 1,
                borderColor: palette.primary,
                backgroundColor: palette.primarySoft,
              }}
            >
              <Text style={{ color: palette.primaryStrong, fontSize: 10, fontWeight: '900' }} numberOfLines={1}>
                {statusLabel}
              </Text>
            </View>
          </View>
        ) : null}
        <Text style={{ color: palette.text, fontWeight: '900', fontSize: 18, letterSpacing: -0.3, lineHeight: 22 }} numberOfLines={2}>
          {item.title}
        </Text>
      </View>

      {/* 3. Cover image — full card width */}
      {item.coverUrl ? (
        <PermanentRemoteImage
          uri={item.coverUrl}
          domain="Education"
          stableKey={`education_content_${item.id}_${item.coverUrl}`}
          containerStyle={{ width: '100%', height: imageHeight }}
        />
      ) : (
        <View
          style={{
            width: '100%',
            height: imageHeight,
            backgroundColor: palette.primarySoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <KISIcon name="book" size={32} color={palette.primaryStrong} />
        </View>
      )}

      <View style={{ padding: 14, paddingTop: 11 }}>
        {/* 4. Description */}
        {getDescription(item) ? (
          <Text style={{ color: palette.subtext, fontSize: 13.5, lineHeight: 19 }} numberOfLines={3}>
            {getDescription(item)}
          </Text>
        ) : null}

        {metadata.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 9 }}>
            {metadata.map((value, index) => (
              <View
                key={`${String(value)}-${index}`}
                style={{
                  borderRadius: 999,
                  paddingHorizontal: 9,
                  paddingVertical: 4,
                  borderWidth: 1,
                  borderColor: `${palette.gold ?? palette.border}66`,
                  backgroundColor: palette.card,
                }}
              >
                <Text style={{ color: palette.subtext, fontSize: 10, fontWeight: '800' }} numberOfLines={1}>
                  {value}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {item.trustSummary?.verified || item.offlineSummary?.offlineReady ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {item.trustSummary?.verified ? (
              <View
                style={{
                  borderRadius: 999,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  backgroundColor: palette.goldSoft ?? palette.primarySoft,
                  borderWidth: 1,
                  borderColor: palette.gold ?? palette.primary,
                }}
              >
                <Text style={{ color: palette.goldDeep ?? palette.primaryStrong, fontSize: 10, fontWeight: '900' }}>✦ Verified institution</Text>
              </View>
            ) : null}
            {item.offlineSummary?.offlineReady ? (
              <Text style={{ color: palette.subtext, fontSize: 10, fontWeight: '800' }} numberOfLines={1}>
                Low-bandwidth ready
              </Text>
            ) : null}
          </View>
        ) : null}

        {/* 5. Buttons */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: 12, gap: 8 }}>
          <KISButton title={primaryLabel || (isInstitution ? 'View Institution' : 'Open')} size="xs" onPress={handlePrimary} />
          {!isInstitution ? (
            <KISButton
              title={secondaryLabel || 'Details'}
              size="xs"
              onPress={() => (onSecondaryAction ? onSecondaryAction(item) : onSelect ? onSelect(item) : handlePrimary())}
              variant="outline"
            />
          ) : null}
          {onDownload && !isInstitution ? (
            <KISButton
              title={downloaded ? 'Downloaded' : 'Download'}
              size="xs"
              variant={downloaded ? 'secondary' : 'outline'}
              disabled={downloaded || downloadDisabled}
              onPress={() => onDownload(item)}
            />
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}
