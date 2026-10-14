import React from 'react';
import { StyleSheet, View } from 'react-native';
import { KISIcon } from '@/constants/kisIcons';
import { useKISTheme } from '@/theme/useTheme';

// Minimal identity badges for wherever a user is REPRESENTED (chat list
// row, chat header, broadcast card, status ring, a shared-contact bubble)
// — distinct from VerificationCenter.tsx's VerificationBadgeRow/
// VerificationStatusCard, which are full status chips with text labels
// for the verification MANAGEMENT screens. This is icon-only, sized per
// context, and never fetches its own data (caller owns badges/tier).

export type UserBadgeKind = 'verified' | 'premium';

export type UserBadgeRowContext = 'inline-xs' | 'inline-sm' | 'header' | 'avatar-corner';

// Matches apps.verification's public badge shape (code/label/issued_at/
// expires_at) — `verified` is derived from whether any badge survives
// the backend's own expiry filtering (public_badges_for_subject already
// excludes expired-by-date badges), never recomputed client-side from
// expires_at, so a clock-skewed device can't show a stale "verified"
// mark the server would no longer return.
export type UserBadgeSummary = {
  code?: string | null;
  label?: string | null;
  issued_at?: string | null;
  expires_at?: string | null;
};

export type UserBadgeRowProps = {
  badges?: UserBadgeSummary[] | null;
  // "Free"/"Premium" etc. (User.tier) — only a paid tier renders the
  // premium mark; never derive this from anything other than the
  // server-reported tier string.
  tier?: string | null;
  context?: UserBadgeRowContext;
  style?: any;
};

const SIZE_BY_CONTEXT: Record<UserBadgeRowContext, number> = {
  'inline-xs': 11,
  'inline-sm': 13,
  header: 16,
  'avatar-corner': 14,
};

const GAP_BY_CONTEXT: Record<UserBadgeRowContext, number> = {
  'inline-xs': 2,
  'inline-sm': 3,
  header: 4,
  'avatar-corner': 0,
};

// User.tier is a free-form string ("Free" by default; apps.billing's
// upgrade flow writes the paid tier name) — no fixed enum exists to
// check against, so "not Free" is the correct, forward-compatible test
// rather than allow-listing specific paid tier names that could drift
// out of sync with billing.
function isPaidTier(tier?: string | null): boolean {
  const normalized = String(tier || '').trim().toLowerCase();
  return normalized.length > 0 && normalized !== 'free';
}

/** Array-driven so a third badge kind slots in without restructuring —
 * add a new entry to this list rather than adding new named props. */
function resolveBadgeKinds(badges: UserBadgeSummary[] | null | undefined, tier: string | null | undefined): UserBadgeKind[] {
  const kinds: UserBadgeKind[] = [];
  if (Array.isArray(badges) && badges.length > 0) {
    kinds.push('verified');
  }
  if (isPaidTier(tier)) {
    kinds.push('premium');
  }
  return kinds;
}

export default function UserBadgeRow({ badges, tier, context = 'inline-sm', style }: UserBadgeRowProps) {
  const { palette } = useKISTheme();
  const kinds = resolveBadgeKinds(badges, tier);
  if (kinds.length === 0) return null;

  const size = SIZE_BY_CONTEXT[context];
  const gap = GAP_BY_CONTEXT[context];
  const isCorner = context === 'avatar-corner';

  return (
    <View
      style={[
        styles.row,
        { gap },
        isCorner && [styles.corner, { backgroundColor: palette.bg }],
        style,
      ]}
    >
      {kinds.map(kind =>
        kind === 'verified' ? (
          <KISIcon key="verified" name="checkmark-circle" size={size} color={palette.primaryStrong ?? palette.primary} />
        ) : (
          <KISIcon key="premium" name="crown" size={size} color={palette.gold} />
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  corner: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    borderRadius: 999,
    padding: 1,
  },
});
