import React from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Pressable,
  Text,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useKISTheme } from '@/theme/useTheme';
import styles from '@/components/partners/partnersStyles';
import type { PartnerOrganizationApp } from '@/screens/tabs/partners/hooks/usePartnerOrganizationApps';
import { KISIcon } from '@/constants/kisIcons';

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
  const floatAnim = React.useRef(new Animated.Value(0)).current;
  const showMore = apps.length > 3;
  const visibleApps = showMore
    ? apps.slice(0, MAX_VISIBLE_WITH_MORE)
    : apps.slice(0, Math.min(3, apps.length));
  const shouldRenderBar = loading || visibleApps.length > 0 || showMore;

  React.useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 1800,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [floatAnim]);

  if (!shouldRenderBar) return null;

  const handleLaunchApp = (app: PartnerOrganizationApp) => {
    onLaunchApp?.(app);
  };

  const openMore = () => {
    onOpenMore?.();
  };

  const buttonBorder = palette.primaryStrong;
  const floatStyle = {
    transform: [
      {
        translateY: floatAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -4],
        }),
      },
    ],
  };

  return (
    <Animated.View style={[styles.appLaunchBar, floatStyle]}>
      {loading ? (
        <ActivityIndicator color={palette.primaryStrong} />
      ) : (
        visibleApps.map(app => (
          <Pressable
            key={app.id}
            onPress={() => handleLaunchApp(app)}
            style={({ pressed }) => [
              styles.appLaunchButton,
              {
                borderColor: buttonBorder,
                backgroundColor: 'transparent',
                shadowColor: palette.primaryStrong,
                opacity: pressed ? 0.8 : 1,
                transform: [{ scale: pressed ? 0.94 : 1 }],
              },
            ]}
          >
            <LinearGradient
              colors={[palette.surface, palette.primarySoft, palette.surface]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.appLaunchButtonInner}
            >
              {app.icon ? (
                <Image
                  source={{ uri: app.icon }}
                  style={styles.appLaunchIcon}
                  resizeMode="contain"
                />
              ) : (
                <Text
                  style={{
                    color: palette.text,
                    fontWeight: '900',
                    fontSize: 12,
                  }}
                >
                  {getAppAbbreviation(app.name)}
                </Text>
              )}
            </LinearGradient>
            {app.badge_label || app.status ? (
              <View
                style={[
                  styles.appLaunchBadge,
                  { backgroundColor: palette.primaryStrong },
                ]}
              >
                <Text
                  style={{
                    color: palette.onPrimary,
                    fontSize: 8,
                    fontWeight: '900',
                  }}
                >
                  {(app.badge_label || app.status || '')
                    .slice(0, 3)
                    .toUpperCase()}
                </Text>
              </View>
            ) : null}
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
              backgroundColor: palette.surface,
              shadowColor: palette.primaryStrong,
              opacity: pressed ? 0.8 : 1,
              transform: [{ scale: pressed ? 0.94 : 1 }],
            },
          ]}
        >
          <KISIcon name="layers" size={20} color={palette.primaryStrong} />
        </Pressable>
      ) : null}
    </Animated.View>
  );
}
