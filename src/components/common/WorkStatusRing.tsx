// src/components/common/WorkStatusRing.tsx
//
// LinkedIn-style "Open to work" / "Hiring" status ring. Wraps any avatar
// (image, initials circle, placeholder - doesn't matter) and overlays a
// bottom-hugging semicircular arc + short label when the wrapped user has
// set a work_status. Single source of truth for the visual everywhere an
// avatar is rendered (chat list, chat room, status screen, call tiles,
// members lists, profile screens).
import React from 'react';
import { View, Text, Pressable, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useKISTheme } from '@/theme/useTheme';

export type WorkStatusValue = 'none' | 'open_for_work' | 'hiring';

// Accepts the raw backend value as-is (string | null | undefined) so every
// call site can just forward whatever `profile.work_status` it has without
// its own normalization - an older cached payload that predates this field,
// or any value this component doesn't recognize, degrades to "no ring"
// rather than throwing.
export type WorkStatusLike = WorkStatusValue | string | null | undefined;

type Props = {
  /** The user's work_status, straight off the API payload. */
  workStatus?: WorkStatusLike;
  /** Diameter of the avatar being wrapped, in points. */
  size: number;
  /** Ring thickness. Defaults to ~7% of size (clamped to a sane minimum). */
  strokeWidth?: number;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /**
   * Hiring only: when provided, the small "HIRING" badge pill becomes its
   * OWN tappable target, distinct from tapping the bare avatar/parent row -
   * spec section 7's explicit guidance ("tapping it distinct from tapping
   * the bare avatar... don't make small list avatars open a disruptive
   * modal"). Ignored for open_for_work, and whenever the badge itself
   * isn't shown at all (size < 40 - see `showLabel` below) since there's
   * then no separate tappable area to add in the first place.
   */
  onHiringPress?: () => void;
};

const RING_COLOR_KEY: Record<string, 'success' | 'purple'> = {
  open_for_work: 'success',
  // Purple, not blue - matches LinkedIn's own Hiring treatment and keeps
  // it visually distinct from any blue already used for links/info
  // elsewhere in the app, not just from the green Open to Work ring.
  hiring: 'purple',
};

const RING_LABEL: Record<string, string> = {
  open_for_work: 'OPEN',
  hiring: 'HIRING',
};

// Screen-reader announcement for the ring itself - distinct from whatever
// accessibilityLabel (if any) the wrapped avatar/child already carries, so
// VoiceOver/TalkBack calls out the status instead of silently skipping this
// purely-visual decoration. Kept as a flat record (not RING_LABEL reused
// verbatim) since "OPEN"/"HIRING" are terse visual badge text, not a
// sentence a screen reader should read aloud.
const RING_ACCESSIBILITY_LABEL: Record<string, string> = {
  open_for_work: 'Open to work',
  hiring: 'Hiring',
};

export default function WorkStatusRing({ workStatus, size, strokeWidth, children, style, onHiringPress }: Props) {
  const { palette } = useKISTheme();
  const normalized = workStatus === 'open_for_work' || workStatus === 'hiring' ? workStatus : null;

  if (!normalized || size <= 0) {
    // No status (incl. 'none'), or a value we don't recognize (older cached
    // payload, unexpected backend value) - render the plain avatar, no ring.
    return <View style={[{ width: size, height: size }, style]}>{children}</View>;
  }

  const color = RING_COLOR_KEY[normalized] === 'purple' ? palette.purple : palette.success;
  const label = RING_LABEL[normalized];
  const resolvedStrokeWidth = Math.max(2, strokeWidth ?? Math.round(size * 0.08));
  const radius = Math.max(0, (size - resolvedStrokeWidth) / 2);
  const circumference = 2 * Math.PI * radius;
  const halfCircumference = circumference / 2;
  // Only show the text badge when there's enough room for it to be legible
  // ("reasonable space" per design) - below this a bare colored arc still
  // conveys the two-color distinction without illegible micro-text.
  const showLabel = size >= 40;
  // Only the Hiring badge ever gets its own tap target, and only when
  // there's actually a badge rendered to tap (showLabel) and a caller
  // handed us something to do about it (onHiringPress - e.g. a linked,
  // still-active JobListing; see get_visible_hiring_job_listing_id on the
  // backend for when that is/isn't set).
  const badgeIsInteractive = normalized === 'hiring' && showLabel && !!onHiringPress;
  const BadgeWrapper: typeof View | typeof Pressable = badgeIsInteractive ? Pressable : View;

  return (
    <View
      style={[{ width: size, height: size }, style]}
      // When the badge itself is independently tappable, DON'T collapse
      // this whole region into one non-interactive accessible unit - that
      // would hide the nested Pressable badge below from screen readers
      // entirely. The badge's own accessibilityLabel covers the
      // announcement in that case instead.
      accessible={!badgeIsInteractive}
      accessibilityLabel={badgeIsInteractive ? undefined : RING_ACCESSIBILITY_LABEL[normalized]}
    >
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          overflow: 'hidden',
        }}
      >
        {children}
      </View>

      {/* An SVG <circle>'s dash pattern starts at the 3-o'clock point and
          advances clockwise, so the first half of the path (dash "on" for
          exactly half the circumference, "off" for the rest) sweeps
          3 o'clock -> 6 o'clock (bottom) -> 9 o'clock - i.e. precisely the
          bottom semicircle hugging the avatar's lower edge. No rotation
          needed; origin is the circle's own center either way. */}
      <Svg
        width={size}
        height={size}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={resolvedStrokeWidth}
          strokeDasharray={`${halfCircumference} ${circumference}`}
          strokeLinecap="round"
          fill="none"
          rotation={0}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>

      {showLabel && (
        <BadgeWrapper
          {...(badgeIsInteractive
            ? {
                onPress: onHiringPress,
                accessibilityRole: 'button' as const,
                accessibilityLabel: 'Hiring - view job listing',
                hitSlop: 6,
              }
            : { pointerEvents: 'none' as const })}
          style={{
            position: 'absolute',
            bottom: -Math.max(2, Math.round(size * 0.05)),
            left: 0,
            right: 0,
            alignItems: 'center',
          }}
        >
          <View
            style={{
              backgroundColor: color,
              borderRadius: 999,
              paddingHorizontal: Math.max(4, Math.round(size * 0.09)),
              paddingVertical: 1,
            }}
          >
            <Text
              numberOfLines={1}
              style={{
                color: '#FFFFFF',
                fontSize: Math.max(7, Math.round(size * 0.15)),
                fontWeight: '800',
                letterSpacing: 0.3,
              }}
            >
              {label}
            </Text>
          </View>
        </BadgeWrapper>
      )}
    </View>
  );
}
