import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import KISButton from '@/constants/KISButton';
import { EducationModule } from '@/screens/broadcast/education/api/education.types';

type Props = {
  title?: string;
  items: EducationModule[];
  onOpenResource?: (module: EducationModule) => void;
};

export default function EducationWorkshopsSection({
  title = 'Workshops & resources',
  items,
  onOpenResource,
}: Props) {
  const { palette } = useKISTheme();
  const renderedItems = useMemo(() => items.slice(0, 4), [items]);
  if (!renderedItems.length) return null;

  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: palette.text, fontWeight: '900', fontSize: 16 }}>{title}</Text>
      </View>

      <View style={{ gap: 10 }}>
        {renderedItems.map((module) => (
          <View
            key={module.id}
            style={{
              borderWidth: 2,
              borderColor: palette.divider,
              borderRadius: 18,
              padding: 12,
              backgroundColor: palette.surface,
              gap: 8,
            }}
          >
            <Text style={{ color: palette.text, fontWeight: '900', fontSize: 16 }}>
              {module.title ?? 'Workshop'}
            </Text>
            {module.summary ? (
              <Text style={{ color: palette.subtext, fontWeight: '700' }} numberOfLines={3}>
                {module.summary}
              </Text>
            ) : null}
            {module.resource_url ? (
              <KISButton
                title="Open resource"
                onPress={() => onOpenResource?.(module)}
                variant="outline"
                size="xs"
              />
            ) : (
              <Text style={{ color: palette.subtext, fontWeight: '700', fontSize: 12 }}>
                Resource link pending.
              </Text>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}
