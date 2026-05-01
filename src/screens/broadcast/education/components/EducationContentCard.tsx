// src/screens/broadcast/education/components/EducationContentCard.tsx
import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import KISButton from '@/constants/KISButton';
import { KISIcon } from '@/constants/kisIcons';
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
    case 'credential':
      return 'Credential';
    case 'mentorship':
      return 'Mentorship';
    default:
      return 'Content';
  }
};

const getSubtitle = (item: EducationContentItem) => {
  if ('partnerName' in item && item.partnerName) return item.partnerName;
  if ('instructor' in item && item.instructor) return item.instructor;
  return item.summary ?? item.title;
};

const formatPrice = (item: EducationContentItem) => {
  const pricing = 'price' in item ? item.price : undefined;
  if (!pricing) return 'Pricing TBD';
  if (pricing.isFree) return 'Free';
  const amount = Number(pricing.amountCents || 0) / 100;
  return `${pricing.currency || 'KISC'} ${amount.toLocaleString()}`;
};

const formatSchedule = (item: EducationContentItem) => {
  if (!item.startsAt) return null;
  const value = new Date(item.startsAt);
  if (Number.isNaN(value.getTime())) return null;
  return value.toLocaleDateString();
};

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
}: Props) {
  const { palette } = useKISTheme();

  const handlePrimary = () => {
    if (onPrimaryAction) {
      onPrimaryAction(item);
    } else if (onSelect) {
      onSelect(item);
    }
  };

  const metadata = [
    formatPrice(item),
    item.durationMinutes ? `${item.durationMinutes} mins` : null,
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
        width: 304,
        minHeight: 186,
        borderWidth: 1,
        borderColor: palette.border,
        borderRadius: 24,
        backgroundColor: palette.surface,
        padding: 12,
        marginBottom: 12,
        marginRight: 12,
        flexDirection: 'row',
        gap: 10,
        shadowColor: palette.shadow ?? '#000',
        shadowOpacity: 0.08,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
        elevation: 3,
      }}
    >
      {item.coverUrl ? (
        <Image
          source={{ uri: item.coverUrl }}
          style={{ width: 78, height: 106, borderRadius: 18 }}
          resizeMode="cover"
        />
      ) : (
        <View
          style={{
            width: 78,
            height: 106,
            borderRadius: 18,
            backgroundColor: palette.primarySoft,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: palette.border,
          }}
        >
          <KISIcon name="book" size={24} color={palette.primaryStrong} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Text
            style={{
              color: palette.primaryStrong,
              fontWeight: '900',
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: 0.6,
            }}
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
                maxWidth: 82,
              }}
            >
              <Text
                style={{
                  color: palette.primaryStrong,
                  fontSize: 10,
                  fontWeight: '900',
                }}
                numberOfLines={1}
              >
                {statusLabel}
              </Text>
            </View>
          ) : progress ? (
            <Text style={{ color: palette.subtext, fontSize: 12 }}>
              {progress.progressPercent}% complete
            </Text>
          ) : null}
        </View>
        <Text
          style={{
            color: palette.text,
            fontWeight: '900',
            fontSize: 16,
            marginTop: 5,
            lineHeight: 19,
          }}
          numberOfLines={2}
        >
          {item.title}
        </Text>
        {getSubtitle(item) ? (
          <Text
            style={{
              color: palette.subtext,
              fontSize: 12,
              marginTop: 4,
              lineHeight: 16,
            }}
            numberOfLines={2}
          >
            {getSubtitle(item)}
          </Text>
        ) : null}
        {metadata.length ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              marginTop: 8,
            }}
          >
            {metadata.slice(0, 2).map((value, index) => (
              <View
                key={`${String(value)}-${index}`}
                style={{
                  borderRadius: 999,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderWidth: 1,
                  borderColor: palette.border,
                  backgroundColor: palette.card,
                  maxWidth: index === 0 ? 82 : 74,
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
                  {value}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: 10,
            gap: 6,
          }}
        >
          <KISButton
            title={primaryLabel || 'Open'}
            size="xs"
            onPress={handlePrimary}
          />
          <KISButton
            title={secondaryLabel || 'Details'}
            size="xs"
            onPress={() =>
              onSecondaryAction
                ? onSecondaryAction(item)
                : onSelect
                ? onSelect(item)
                : handlePrimary()
            }
            variant="outline"
          />
          {onDownload ? (
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
