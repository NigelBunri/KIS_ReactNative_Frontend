import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Image,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import { useMiniPlayer } from '@/contexts/MiniPlayerContext';
import type { RootStackParamList } from '@/navigation/types';

const HEIGHT = 64;
const DISMISS_THRESHOLD = 40;

export default function MiniPlayer() {
  const { palette } = useKISTheme();
  const { contentId, title, channelName, posterUrl, playing, dismiss, togglePlay } =
    useMiniPlayer();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const slideAnim = useRef(new Animated.Value(HEIGHT + 4)).current;
  const panY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (contentId) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 12,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: HEIGHT + 4,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [contentId, slideAnim]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6,
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) panY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > DISMISS_THRESHOLD) {
          dismiss();
          panY.setValue(0);
        } else {
          Animated.spring(panY, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    }),
  ).current;

  if (!contentId) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: palette.surface,
          borderTopColor: palette.border,
          shadowColor: palette.shadow ?? '#000',
        },
        { transform: [{ translateY: slideAnim }, { translateY: panY }] },
      ]}
      {...panResponder.panHandlers}
    >
      {/* Gold accent bar */}
      <View style={[styles.accent, { backgroundColor: palette.primaryStrong }]} />

      {/* Thumbnail */}
      <Pressable
        onPress={() => navigation.navigate('ChannelContentDetail', { contentId })}
        style={styles.thumbWrap}
      >
        {posterUrl ? (
          <Image source={{ uri: posterUrl }} style={styles.thumb} resizeMode="cover" />
        ) : (
          <View
            style={[
              styles.thumb,
              {
                backgroundColor: palette.primarySoft ?? '#3d2b00',
                alignItems: 'center',
                justifyContent: 'center',
              },
            ]}
          >
            <KISIcon name="play" size={16} color={palette.primaryStrong} />
          </View>
        )}
      </Pressable>

      {/* Info */}
      <Pressable
        style={styles.info}
        onPress={() => navigation.navigate('ChannelContentDetail', { contentId })}
      >
        <Text style={[styles.title, { color: palette.text }]} numberOfLines={1}>
          {title || 'Now playing'}
        </Text>
        {channelName ? (
          <Text style={[styles.channel, { color: palette.subtext }]} numberOfLines={1}>
            {channelName}
          </Text>
        ) : null}
      </Pressable>

      {/* Controls */}
      <Pressable onPress={togglePlay} style={styles.control} hitSlop={8}>
        <KISIcon name={playing ? 'pause' : 'play'} size={22} color={palette.text} />
      </Pressable>
      <Pressable onPress={dismiss} style={styles.control} hitSlop={8}>
        <KISIcon name="close" size={20} color={palette.subtext} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 60,
    left: 0,
    right: 0,
    height: HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -3 },
    elevation: 8,
    zIndex: 999,
  },
  accent: {
    width: 4,
    alignSelf: 'stretch',
  },
  thumbWrap: {
    marginLeft: 10,
  },
  thumb: {
    width: 48,
    height: 36,
    borderRadius: 4,
    overflow: 'hidden',
  },
  info: {
    flex: 1,
    marginHorizontal: 10,
    justifyContent: 'center',
  },
  title: {
    fontSize: 13,
    fontWeight: '800',
  },
  channel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  control: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
