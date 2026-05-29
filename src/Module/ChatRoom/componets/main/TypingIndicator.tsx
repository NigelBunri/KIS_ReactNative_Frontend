import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';

export type TypingUser = {
  id: string;
  name: string;
  avatarUrl?: string | null;
};

type Props = {
  typingUsers: TypingUser[];
  palette: any;
};

const DOT_COUNT = 3;
const AVATAR_SIZE = 24;
const AVATAR_OVERLAP = 8;
const MAX_AVATARS = 3;

/* Three staggered bouncing dots */
function BouncingDots({ color }: { color: string }) {
  const anims = useRef(
    Array.from({ length: DOT_COUNT }, () => new Animated.Value(0)),
  ).current;

  useEffect(() => {
    const loops = anims.map((anim, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 120),
          Animated.timing(anim, {
            toValue: -5,
            duration: 280,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 280,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.delay((DOT_COUNT - 1 - i) * 120),
        ]),
      ),
    );
    loops.forEach(l => l.start());
    return () => loops.forEach(l => l.stop());
  }, [anims]);

  return (
    <View style={s.dotsRow}>
      {anims.map((anim, i) => (
        <Animated.View
          key={i}
          style={[s.dot, { backgroundColor: color, transform: [{ translateY: anim }] }]}
        />
      ))}
    </View>
  );
}

/* Single avatar or initial fallback */
function Avatar({ user, index }: { user: TypingUser; index: number }) {
  const initial = (user.name ?? '?').charAt(0).toUpperCase();
  const left = index * (AVATAR_SIZE - AVATAR_OVERLAP);

  return (
    <View style={[s.avatar, { left, zIndex: MAX_AVATARS - index }]}>
      {user.avatarUrl ? (
        <Image source={{ uri: user.avatarUrl }} style={s.avatarImg} />
      ) : (
        <View style={[s.avatarFallback, { backgroundColor: stringToColor(user.id) }]}>
          <Text style={s.avatarInitial}>{initial}</Text>
        </View>
      )}
    </View>
  );
}

/* Deterministic pastel color from a string */
function stringToColor(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360}, 52%, 62%)`;
}

function buildLabel(users: TypingUser[]): string {
  const safe = users.filter(u => u?.name);
  if (safe.length === 0) return '';
  if (safe.length === 1) return `${safe[0].name} is typing`;
  if (safe.length === 2) return `${safe[0].name} and ${safe[1].name} are typing`;
  if (safe.length === 3)
    return `${safe[0].name}, ${safe[1].name} and ${safe[2].name} are typing`;
  return `${safe[0].name}, ${safe[1].name} and ${safe.length - 2} others are typing`;
}

export default function TypingIndicator({ typingUsers, palette }: Props) {
  const visible = typingUsers.length > 0;
  const slideY = useRef(new Animated.Value(visible ? 0 : 10)).current;
  const opacity = useRef(new Animated.Value(visible ? 1 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideY, {
        toValue: visible ? 0 : 8,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: visible ? 1 : 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, slideY, opacity]);

  const avatarUsers = typingUsers.slice(0, MAX_AVATARS);
  const avatarStackWidth =
    avatarUsers.length * (AVATAR_SIZE - AVATAR_OVERLAP) + AVATAR_OVERLAP + 2;

  return (
    /* Fixed-height wrapper — never causes layout shift */
    <View style={s.wrapper}>
      <Animated.View
        style={[
          s.row,
          {
            opacity,
            transform: [{ translateY: slideY }],
          },
        ]}
        pointerEvents="none"
      >
        {/* Stacked avatars */}
        <View style={[s.avatarStack, { width: avatarStackWidth }]}>
          {avatarUsers.map((u, i) => (
            <Avatar key={u.id} user={u} index={i} />
          ))}
        </View>

        {/* Bubble with dots + label */}
        <View
          style={[
            s.bubble,
            {
              backgroundColor: palette.card ?? palette.surface,
              borderColor: palette.divider,
            },
          ]}
        >
          <BouncingDots color={palette.primary} />
          <Text
            style={[s.label, { color: palette.subtext }]}
            numberOfLines={1}
          >
            {buildLabel(typingUsers)}
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  wrapper: {
    height: 36,
    justifyContent: 'flex-end',
    paddingHorizontal: 12,
    paddingBottom: 4,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  avatarStack: {
    height: AVATAR_SIZE,
    position: 'relative',
    flexShrink: 0,
  },
  avatar: {
    position: 'absolute',
    top: 0,
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.8)',
    overflow: 'hidden',
  },
  avatarImg: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
  },
  avatarFallback: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 6,
    flexShrink: 1,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
    flexShrink: 1,
  },
});
