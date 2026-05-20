// src/screens/calls/components/ReactionsLayer.tsx
import React, { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet, View } from 'react-native';
import type { ActiveReaction } from '@/services/calls/callTypes';

const LIFETIME_MS = 2800;

type AnimatedReaction = ActiveReaction & { anim: Animated.Value };

type Props = {
  reactions: ActiveReaction[];
  width: number;
  height: number;
};

export default function ReactionsLayer({ reactions, width, height }: Props) {
  return (
    <View style={[styles.layer, { width, height }]} pointerEvents="none">
      {reactions.map(r => (
        <FloatingEmoji key={r.id} reaction={r} width={width} height={height} />
      ))}
    </View>
  );
}

function FloatingEmoji({ reaction, width, height }: { reaction: ActiveReaction; width: number; height: number }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: LIFETIME_MS,
      useNativeDriver: true,
    }).start();
  }, []);

  const x = reaction.xNorm * (width - 44);
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -height * 0.6] });
  const opacity = anim.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] });
  const scale = anim.interpolate({ inputRange: [0, 0.1, 1], outputRange: [0.4, 1.2, 1] });

  return (
    <Animated.View
      style={[
        styles.emoji,
        {
          left: x,
          bottom: 100,
          opacity,
          transform: [{ translateY }, { scale }],
        },
      ]}
    >
      <Text style={styles.emojiText}>{reaction.emoji}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 20,
  },
  emoji: {
    position: 'absolute',
    alignItems: 'center',
  },
  emojiText: { fontSize: 32 },
});
