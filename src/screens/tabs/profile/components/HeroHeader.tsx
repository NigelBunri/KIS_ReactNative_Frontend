// src/screens/tabs/profile/components/HeroHeader.tsx
import React from 'react';
import { Image, Text, View } from 'react-native';
import ImagePlaceholder from '@/components/common/ImagePlaceholder';
import { styles } from '../profile.styles';
import { useKISTheme } from '@/theme/useTheme';

export default function HeroHeader({
  coverUrl,
  avatarUrl,
  displayName,
  handle,
  headline,
  tierName,
  completion,
  onEdit: _onEdit,
}: {
  coverUrl?: string | null;
  avatarUrl?: string | null;
  displayName: string;
  handle: string;
  headline: string;
  tierName: string;
  completion: number;
  onEdit: () => void;
}) {
  const { palette } = useKISTheme();
  const hasCover = !!coverUrl;

  // On-cover colors
  const textColor = hasCover ? '#FFFFFF' : palette.text;
  const subColor = hasCover ? 'rgba(255,255,255,0.85)' : palette.subtext;

  const shadow = hasCover
    ? {
        textShadowColor: 'rgba(0,0,0,0.65)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 10,
      }
    : undefined;

  return (
    <View style={[styles.heroCard, { backgroundColor: palette.card }]}>
      <View style={[styles.heroTop, { backgroundColor: palette.chrome }]}>

        {/* 🔥 Cover image FIRST (so it is visible) */}
        {hasCover && (
          <Image
            source={{ uri: coverUrl! }}
            style={styles.heroCoverImg}
          />
        )}

        {/* Brand glows (on top of image) */}
        <View style={[styles.heroGlow, { backgroundColor: palette.primary }]} />
        <View style={[styles.heroGlow2, { backgroundColor: palette.secondary }]} />

        {/* Dark scrim (guarantees text contrast) */}
        {hasCover && <View style={styles.heroCoverScrim} />}
      </View>

      <View style={styles.heroBody}>
        <View style={[styles.avatarWrap, { backgroundColor: palette.surfaceElevated }]}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
          ) : (
            <ImagePlaceholder size={92} radius={30} />
          )}
        </View>

        <View style={{ flex: 1 }}>
          <Text style={[styles.heroName, { color: textColor }, shadow]}>
            {displayName}
          </Text>

          <Text style={[styles.heroHandle, { color: subColor }, shadow]}>
            {handle}
          </Text>

          <Text
            style={[styles.heroHeadline, { color: subColor }, shadow]}
            numberOfLines={2}
          >
            {headline}
          </Text>

          <View style={styles.badgeRow}>
            <View
              style={[
                styles.pill,
                {
                  backgroundColor: hasCover ? 'rgba(255,255,255,0.18)' : palette.primarySoft,
                  borderWidth: hasCover ? 1 : 0,
                  borderColor: hasCover ? 'rgba(255,255,255,0.22)' : 'transparent',
                },
              ]}
            >
              <Text style={[styles.pillText, { color: hasCover ? '#fff' : palette.primaryStrong }, shadow]}>
                {tierName}
              </Text>
            </View>

            <View
              style={[
                styles.pill,
                {
                  backgroundColor: hasCover ? 'rgba(0,0,0,0.28)' : palette.surfaceElevated,
                  borderWidth: hasCover ? 1 : 0,
                  borderColor: hasCover ? 'rgba(255,255,255,0.16)' : 'transparent',
                },
              ]}
            >
              <Text style={[styles.pillText, { color: subColor }, shadow]}>
                {completion}% complete
              </Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}
