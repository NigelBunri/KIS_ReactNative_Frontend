// src/screens/tabs/MesssagingSubTabs/MessagesOfflineCard.tsx
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { KIS_COLORS, KIS_ROYAL_GRADIENTS } from '@/theme/constants';

type Props = {
  visible: boolean;
  onRetry: () => void;
};

// Fixed, theme-independent premium palette — this card is deliberately a
// stable cream/gold surface (not tone-adjusted), since the app's dark-mode
// palette.text is a light cream that would be unreadable on this light card.
const INK = KIS_COLORS.brand.royalInk;
const INK_SOFT = '#6B5B47';
const GOLD_DEEP = KIS_COLORS.brand.goldDeep;

/**
 * Premium, reassuring "you're offline" state for MessagesScreen — replaces
 * the old red error bar. Sits between the gold header's filter chips and the
 * Chats/Updates/Calls/Communities tab bar. Purely presentational; connection
 * detection and reconnect handling stay in MessagesScreen (this only renders
 * based on `visible` and calls `onRetry` on button press).
 */
export default function MessagesOfflineCard({ visible, onRetry }: Props) {
  const appear = useSharedValue(0);
  const float = useSharedValue(0);
  const pressScale = useSharedValue(1);
  // Kept mounted only while visible or animating out — otherwise the card's
  // natural content height (~300px) would still be reserved in the layout
  // even at opacity 0, leaving a big blank gap above the tab bar.
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      appear.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) });
    } else {
      appear.value = withTiming(
        0,
        { duration: 420, easing: Easing.in(Easing.cubic) },
        (finished) => {
          if (finished) runOnJS(setMounted)(false);
        },
      );
    }
  }, [visible, appear]);

  useEffect(() => {
    if (!visible) return;
    float.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
  }, [visible, float]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: appear.value,
    transform: [{ translateY: (1 - appear.value) * 18 }],
  }));

  const iconFloatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -float.value * 6 }],
  }));

  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  if (!mounted) return null;

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[styles.outer, cardStyle]}
    >
      <View style={styles.shadowWrap}>
        <View style={styles.clip}>
          <LinearGradient
            colors={KIS_ROYAL_GRADIENTS.creamSurface as unknown as string[]}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />

          {/* Subtle decorative shapes — clouds/hills/sparkles, very low opacity */}
          <View pointerEvents="none" style={styles.decoLayer}>
            <View style={[styles.blobHill, { left: -40, bottom: -50, backgroundColor: KIS_COLORS.brand.goldLight }]} />
            <View style={[styles.blobHill, { right: -60, bottom: -70, width: 200, height: 200, backgroundColor: KIS_COLORS.brand.gold, opacity: 0.08 }]} />
            <View style={[styles.blobCloud, { top: 14, left: 26 }]} />
            <View style={[styles.blobCloud, { top: 30, right: 40, width: 46, height: 46 }]} />
            <Text style={[styles.sparkle, { top: 20, right: '28%' }]}>✦</Text>
            <Text style={[styles.sparkle, { top: 64, left: '18%', fontSize: 10 }]}>✦</Text>
            <Text style={[styles.sparkle, { bottom: 54, right: '16%', fontSize: 12 }]}>✦</Text>
          </View>

          <View style={styles.content}>
            <Animated.View style={iconFloatStyle}>
              <View style={styles.iconBadgeOuter}>
                <LinearGradient
                  colors={['#FFFDF8', '#F6ECD2']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.iconBadge}
                >
                  <Ionicons name="wifi" size={38} color={GOLD_DEEP} />
                </LinearGradient>
                <View style={styles.xBadge}>
                  <Ionicons name="close" size={13} color={KIS_COLORS.brand.ivory} />
                </View>
              </View>
            </Animated.View>

            <Text style={styles.headline}>You're offline</Text>
            <Text style={styles.subtitle}>
              No internet connection. Messages will automatically send once you're back online.
            </Text>

            <Pressable
              onPress={onRetry}
              onPressIn={() => {
                pressScale.value = withSpring(0.95, { damping: 14, stiffness: 260 });
              }}
              onPressOut={() => {
                pressScale.value = withSpring(1, { damping: 12, stiffness: 220 });
              }}
              hitSlop={8}
            >
              <Animated.View style={[styles.button, buttonStyle]}>
                <LinearGradient
                  colors={KIS_ROYAL_GRADIENTS.goldHeader as unknown as string[]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFillObject}
                />
                <Ionicons name="refresh" size={16} color={KIS_COLORS.brand.ivory} />
                <Text style={styles.buttonText}>Try Again</Text>
              </Animated.View>
            </Pressable>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  outer: {
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 4,
  },
  shadowWrap: {
    borderRadius: 30,
    shadowColor: '#3A2A12',
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  clip: {
    borderRadius: 30,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  decoLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  blobHill: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 999,
    opacity: 0.10,
  },
  blobCloud: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    opacity: 0.35,
  },
  sparkle: {
    position: 'absolute',
    fontSize: 14,
    color: KIS_COLORS.brand.goldDeep,
    opacity: 0.18,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 28,
  },
  iconBadgeOuter: {
    width: 84,
    height: 84,
    marginBottom: 18,
  },
  iconBadge: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(201,162,74,0.35)',
  },
  xBadge: {
    position: 'absolute',
    right: -2,
    bottom: 2,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: INK_SOFT,
    borderWidth: 2,
    borderColor: '#FFFDF8',
  },
  headline: {
    fontSize: 19,
    fontWeight: '800',
    color: INK,
    letterSpacing: 0.1,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13.5,
    lineHeight: 20,
    color: INK_SOFT,
    textAlign: 'center',
    maxWidth: 280,
    marginBottom: 24,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 22,
    paddingVertical: 13,
    borderRadius: 999,
    overflow: 'hidden',
    shadowColor: GOLD_DEEP,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  buttonText: {
    color: KIS_COLORS.brand.ivory,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
