// src/components/common/WorkStatusRing.tsx
//
// "Open for work" / "Hiring" status ring. Wraps any avatar (image, initials
// circle, placeholder - doesn't matter) and overlays the matching full-circle
// badge frame image (text baked into the artwork) when the wrapped user has
// set a work_status. Single source of truth for the visual everywhere an
// avatar is rendered (chat list, chat room, status screen, call tiles,
// members lists, profile screens).
import React from 'react';
import { View, Image, Pressable, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';

const OPEN_FOR_WORK_BADGE = require('@/assets/open-for-work-badge.png');
const HIRING_BADGE = require('@/assets/hiring-badge.png');

// Each badge PNG is a full ring, drawn larger than its own transparent
// center hole (the frame + baked-in text live outside that hole). Earlier
// this component drew the ring OVERSIZED relative to the avatar and let it
// overflow `size x size` so the hole would line up with the avatar's edge -
// that looked right in isolation, but every real call site allocates
// exactly a `size x size` box for us and several wrap it in their own
// overflow:hidden (see e.g. ProfileDashboardBlocks.tsx's bigAvatarWrap /
// stickyAvatarWrap), which silently clipped the oversized ring down to
// nothing visible. So instead we keep this component's own box at exactly
// `size x size` (the contract every call site relies on) and shrink the
// AVATAR inward to match the ring's hole, so the full ring - frame, text,
// and all - renders and stays visible inside the box callers already give
// us. Ratios measured directly off the source PNGs (1254px canvas): open-
// for-work's transparent hole is ~697px across, hiring's is ~768px across.
const HOLE_RATIO: Record<string, number> = {
  open_for_work: 697 / 1254,
  hiring: 768 / 1254,
};

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
  /**
   * No-op now that the ring is a baked-in-artwork image frame rather than a
   * drawn SVG stroke. Kept so existing call sites that still pass it don't
   * need to change.
   */
  strokeWidth?: number;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /**
   * Hiring only: when provided, the badge frame becomes its own tappable
   * target, distinct from tapping the bare avatar/parent row - spec section
   * 7's explicit guidance ("tapping it distinct from tapping the bare
   * avatar... don't make small list avatars open a disruptive modal").
   * Ignored for open_for_work.
   */
  onHiringPress?: () => void;
};

// Screen-reader announcement for the ring itself - distinct from whatever
// accessibilityLabel (if any) the wrapped avatar/child already carries, so
// VoiceOver/TalkBack calls out the status instead of silently skipping this
// purely-visual decoration.
const RING_ACCESSIBILITY_LABEL: Record<string, string> = {
  open_for_work: 'Open for work',
  hiring: 'Hiring',
};

export default function WorkStatusRing({ workStatus, size, children, style, onHiringPress }: Props) {
  const normalized = workStatus === 'open_for_work' || workStatus === 'hiring' ? workStatus : null;

  if (!normalized || size <= 0) {
    // No status (incl. 'none'), or a value we don't recognize (older cached
    // payload, unexpected backend value) - render the plain avatar, no ring.
    return <View style={[{ width: size, height: size }, style]}>{children}</View>;
  }

  const badgeSource = normalized === 'hiring' ? HIRING_BADGE : OPEN_FOR_WORK_BADGE;
  const avatarSize = Math.max(1, Math.round(size * HOLE_RATIO[normalized]));
  const avatarInset = (size - avatarSize) / 2;
  // The whole ring gets its own tap target (distinct from the parent
  // row/avatar's own onPress) only for hiring, and only when a caller handed
  // us something to do about it - e.g. a linked, still-active JobListing;
  // see get_visible_hiring_job_listing_id on the backend for when that is/
  // isn't set.
  const badgeIsInteractive = normalized === 'hiring' && !!onHiringPress;
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
      {/* Ring first (fills the whole size x size box - no overflow, so it
          can never get clipped by a caller's own overflow:hidden wrapper),
          avatar on top, inset and clipped to a smaller circle matching the
          ring's transparent hole. */}
      <BadgeWrapper
        {...(badgeIsInteractive
          ? {
              onPress: onHiringPress,
              accessibilityRole: 'button' as const,
              accessibilityLabel: 'Hiring - view job listing',
              hitSlop: 6,
            }
          : { pointerEvents: 'none' as const })}
        style={StyleSheet.absoluteFill}
      >
        <Image source={badgeSource} style={{ width: size, height: size }} resizeMode="contain" />
      </BadgeWrapper>

      {/* Every existing call site builds its avatar child (Image, initials
          circle, gradient fallback...) assuming it fills a `size x size`
          box - that was this component's whole contract before the ring
          artwork shrank the visible slot to `avatarSize`. Honoring that by
          literally sizing this wrapper to `avatarSize` broke any child that
          declares an explicit (non-percentage, non-absoluteFill) width/
          height equal to `size`: the child rendered at its full declared
          size anyway, got clipped by this wrapper's overflow:hidden, and
          only its top-left corner survived - visually reading as the photo
          "shifted" toward the bottom-right of the circle (chat list rows
          hit this). Instead, give the child its full expected `size x size`
          box to lay out in, then uniformly scale that whole box down to
          `avatarSize` with a transform (which RN applies after layout, and
          centers by default) - so every child renders exactly as it always
          has, just visually shrunk to fit the ring's hole, regardless of
          how that child sizes itself internally. */}
      <View
        style={{
          position: 'absolute',
          top: avatarInset,
          left: avatarInset,
          width: avatarSize,
          height: avatarSize,
          borderRadius: avatarSize / 2,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            // Scale transforms apply around the element's OWN layout
            // center, not the parent's - so this box is laid out pre-
            // centered on the avatarSize-sized parent's center first (top/
            // left offset by -(size - avatarSize)/2, same inset used for
            // this whole wrapper above), and the scale then shrinks it
            // symmetrically around that already-correct center point.
            // Skipping this offset would leave the box's untransformed
            // center sitting at (size/2, size/2) - correct only when
            // size === avatarSize - which re-introduces the exact
            // off-center "shifted to the bottom-right" bug this is fixing.
            position: 'absolute',
            top: -(size - avatarSize) / 2,
            left: -(size - avatarSize) / 2,
            width: size,
            height: size,
            transform: [{ scale: avatarSize / size }],
          }}
        >
          {children}
        </View>
      </View>
    </View>
  );
}
