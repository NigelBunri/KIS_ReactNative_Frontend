import React from 'react';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import styles from '@/components/partners/partnersStyles';
import type { PartnerOrganizationApp } from '@/screens/tabs/partners/hooks/usePartnerOrganizationApps';

type Props = {
  apps: PartnerOrganizationApp[];
  loading: boolean;
  onLaunchApp?: (app: PartnerOrganizationApp) => void;
  onOpenMore?: () => void;
};

const MAX_VISIBLE_WITH_MORE = 2;

const getAppAbbreviation = (name?: string) => {
  const trimmed = name?.trim() ?? '';
  if (!trimmed) return '';
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  const first = words[0][0] ?? '';
  const second = words[1]?.[0] ?? '';
  return (first + second).toUpperCase();
};

export default function PartnerAppLaunchBar({
  apps,
  loading,
  onLaunchApp,
  onOpenMore,
}: Props) {
  const { palette } = useKISTheme();
  const showMore = apps.length > 3;
  const visibleApps = showMore ? apps.slice(0, MAX_VISIBLE_WITH_MORE) : apps.slice(0, Math.min(3, apps.length));
  const shouldRenderBar = loading || visibleApps.length > 0 || showMore;
  if (!shouldRenderBar) return null;

  const handleLaunchApp = (app: PartnerOrganizationApp) => {
    onLaunchApp?.(app);
  };

  const openMore = () => {
    onOpenMore?.();
  };

  const buttonColor = palette.surface;
  const buttonBorder = palette.primaryStrong;

  return (
    <View style={styles.appLaunchBar}>
      {loading ? (
        <ActivityIndicator color={palette.primaryStrong} />
      ) : (
        visibleApps.map((app) => (
          <Pressable
            key={app.id}
            onPress={() => handleLaunchApp(app)}
            style={({ pressed }) => [
              styles.appLaunchButton,
              {
                borderColor: buttonBorder,
                backgroundColor: buttonColor,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            {app.icon ? (
              <Image
                source={{ uri: app.icon }}
                style={styles.appLaunchIcon}
                resizeMode="contain"
              />
            ) : (
              <Text style={{ color: palette.text, fontWeight: '700', fontSize: 12 }}>
                {getAppAbbreviation(app.name)}
              </Text>
            )}
          </Pressable>
        ))
      )}
      {showMore && !loading ? (
        <Pressable
          onPress={openMore}
          style={({ pressed }) => [
            styles.appLaunchButton,
            {
              borderColor: buttonBorder,
              backgroundColor: buttonColor,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Text style={{ color: palette.primaryStrong, fontWeight: '700', fontSize: 12 }}>
            More
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
