// src/screens/broadcast/education/components/EducationContentCard.tsx
import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import KISButton from '@/constants/KISButton';
import {
  EducationContentType,
  EducationContentItem,
  EducationProgress,
} from '@/screens/broadcast/education/api/education.models';

type Props = {
  item: EducationContentItem;
  onSelect?: (item: EducationContentItem) => void;
  onPrimaryAction?: (item: EducationContentItem) => void;
  onDownload?: (item: EducationContentItem) => void;
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

export default function EducationContentCard({
  item,
  onSelect,
  onPrimaryAction,
  onDownload,
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

  return (
    <Pressable
      onPress={handlePrimary}
      style={{
        borderWidth: 2,
        borderColor: palette.divider,
        borderRadius: 20,
        backgroundColor: palette.surface,
        padding: 12,
        marginBottom: 12,
        flexDirection: 'row',
        gap: 10,
      }}
    >
      {item.coverUrl ? (
        <Image
          source={{ uri: item.coverUrl }}
          style={{ width: 70, height: 70, borderRadius: 14 }}
          resizeMode="cover"
        />
      ) : null}
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: palette.primaryStrong, fontWeight: '700', fontSize: 12 }}>
            {getTypeLabel(item.type)}
          </Text>
          {progress ? (
            <Text style={{ color: palette.subtext, fontSize: 12 }}>
              {progress.progressPercent}% complete
            </Text>
          ) : null}
        </View>
        <Text
          style={{ color: palette.text, fontWeight: '800', fontSize: 16, marginTop: 4 }}
          numberOfLines={2}
        >
          {item.title}
        </Text>
        {getSubtitle(item) ? (
          <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 4 }} numberOfLines={2}>
            {getSubtitle(item)}
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 }}>
          <KISButton title="Details" size="xs" onPress={handlePrimary} variant="outline" />
          {onDownload ? (
            <KISButton
              title={downloaded ? 'Downloaded' : 'Download'}
              size="xs"
              variant={downloaded ? 'secondary' : 'outline'}
              disabled={downloaded}
              onPress={() => onDownload(item)}
            />
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}
