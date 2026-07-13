import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  type SharedValue,
} from 'react-native-reanimated';
import KISButton from '@/constants/KISButton';
import { KISIcon, type KISIconName } from '@/constants/kisIcons';
import { VerificationBadgeRow } from '@/components/verification';
import type { VerificationSummary } from '@/services/verificationService';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import {
  createProfileDashboardTheme,
  getProfileDashboardCardStyle,
} from '../../profileDashboardTheme';

import creditIcon from '../../../../../assets/KIS-Coin.png';

type DashboardAction = {
  key: string;
  title: string;
  subtitle?: string;
  icon: KISIconName;
  onPress?: () => void;
  tone?: 'primary' | 'success' | 'warning' | 'info';
};

type TimelineItem = {
  id: string;
  title: string;
  description?: string;
  timestamp?: string;
  icon?: KISIconName;
  tone?: 'primary' | 'success' | 'warning' | 'info';
  onPress?: () => void;
};

type StatItem = {
  key: string;
  label: string;
  value: string | number;
  icon?: KISIconName;
  tone?: 'primary' | 'success' | 'warning' | 'info';
};

type NotificationItem = {
  id: string;
  title: string;
  body?: string;
  createdAt?: string;
  read?: boolean;
  onPress?: () => void;
};

type OrderItem = {
  id: string;
  label: string;
  status?: string;
  date?: string;
};

type AppointmentItem = {
  id: string;
  title: string;
  provider?: string;
  dateLabel?: string;
  status?: string;
  paymentStatus?: string;
  meetingLink?: string;
  onPress?: () => void;
};

type WorkspaceLauncher = {
  key: string;
  title: string;
  helper?: string;
  icon: KISIconName;
  meta?: string;
  verificationSummary?: VerificationSummary | null;
  onPress?: () => void;
};

type LanguageOption = {
  code: string;
  label: string;
  nativeName?: string;
  flagEmoji?: string;
};

const useDashboardTheme = () => {
  const { palette, tone, isDark } = useKISTheme();
  const responsive = useResponsiveLayout();
  const compact = responsive.isWatch || responsive.isCompactPhone;
  const dashboardTheme = useMemo(
    () => createProfileDashboardTheme(palette, tone),
    [palette, tone],
  );
  return { palette, tone, isDark, dashboardTheme, responsive, compact };
};

const resolveToneColors = (
  tone: 'primary' | 'success' | 'warning' | 'info' | undefined,
  dashboardTheme: ReturnType<typeof createProfileDashboardTheme>,
  palette: ReturnType<typeof useDashboardTheme>['palette'],
) => {
  switch (tone) {
    case 'success':
      return {
        bg: dashboardTheme.accents.successSoft,
        color: palette.success,
      };
    case 'warning':
      return {
        bg: dashboardTheme.accents.warningSoft,
        color: palette.warning,
      };
    case 'info':
      return {
        bg: dashboardTheme.accents.infoSoft,
        color: palette.info,
      };
    case 'primary':
    default:
      return {
        bg: dashboardTheme.accents.orangeSoft,
        color: palette.primaryStrong,
      };
  }
};

const DashboardCard = ({
  children,
  variant = 'dashboard',
  style,
}: {
  children: React.ReactNode;
  variant?: Parameters<typeof getProfileDashboardCardStyle>[1];
  style?: any;
}) => {
  const { dashboardTheme, responsive, compact } = useDashboardTheme();
  return (
    <View
      style={[
        dashboardStyles.cardBase,
        getProfileDashboardCardStyle(dashboardTheme, variant),
        {
          padding: compact ? 14 : 20,
          gap: responsive.cardGap,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
};

const SectionHeader = ({
  title,
  subtitle,
  actionLabel,
  onAction,
}: {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}) => {
  const { dashboardTheme, palette, compact } = useDashboardTheme();
  return (
    <View style={[dashboardStyles.sectionHeaderRow, compact && dashboardStyles.wrapRow]}>
      <View style={{ flex: 1, gap: 4, paddingRight: 12 }}>
        <Text style={dashboardTheme.sectionHeader.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={dashboardTheme.sectionHeader.subtitle}>{subtitle}</Text>
        ) : null}
      </View>
      {actionLabel ? (
        <Pressable
          onPress={onAction}
          hitSlop={8}
          style={{ minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={[dashboardTheme.sectionHeader.actionLabel, { color: palette.primaryStrong }]}>
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
};

// Scroll distance (px) over which the hero collapses to just the sticky bar.
// Exported so ProfileScreen.tsx's useCollapsingGoldHeader call uses the same
// value instead of duplicating the literal.
export const HERO_COLLAPSE_DISTANCE = 130;
const BIG_AVATAR_SIZE_COMPACT = 84;
const BIG_AVATAR_SIZE_REGULAR = 100;

/**
 * The Profile gold section — registered via useGoldenSectionContent (see
 * ProfileScreen.tsx) and rendered inside the shared, fixed Golden Section
 * host in App.tsx. LinkedIn-style: a cover-image banner with the profile
 * picture overlapping its bottom edge, name/handle/headline/badges below
 * that. Two states crossfade on the same `scrollY`, rather than one avatar
 * morphing position/size (simpler, avoids a janky repositioning animation):
 *  - Rich hero (cover + big overlapping avatar + name/headline/badges/edit)
 *    — fully visible at rest, fades + collapses away as the user scrolls.
 *  - Compact sticky bar (small avatar + name + notification/settings) —
 *    invisible at rest, fades in as the rich hero fades out, absolutely
 *    overlaid at the top so it doesn't reserve its own layout space (the
 *    rich hero's collapsing height is the only thing driving the section's
 *    total height).
 */
export const ProfileHeroCard = ({
  coverUrl,
  avatarUrl,
  displayName,
  handle,
  headline,
  tierLabel,
  completionLabel,
  onEdit,
  onNotificationsPress,
  onSettingsPress,
  notificationCount,
  verificationSummary,
  onVerificationPress,
  topInset,
  scrollY,
}: {
  coverUrl?: string | null;
  avatarUrl?: string | null;
  displayName: string;
  handle: string;
  headline?: string;
  tierLabel?: string;
  completionLabel?: string;
  onEdit?: () => void;
  onNotificationsPress?: () => void;
  onSettingsPress?: () => void;
  notificationCount?: number;
  verificationSummary?: VerificationSummary | null;
  onVerificationPress?: () => void;
  topInset: number;
  scrollY: SharedValue<number>;
}) => {
  const { palette, dashboardTheme, isDark, compact } = useDashboardTheme();
  const tierBadgeTextColor = isDark ? palette.goldReadable : palette.royalInk;
  // Starting guess for the hero's expanded height, corrected up via onLayout
  // below on first real measurement — seeded from topInset (not a flat
  // constant) since that's the biggest source of natural-height variance
  // across devices; too low a guess clips the hero at mount (see onLayout
  // comment) and the collapse animation fights that stale ceiling for a few
  // frames before it can settle, reading as a stutter right as scroll starts.
  const collapseNaturalHeight = useSharedValue(topInset + 250);
  const bigAvatarSize = compact ? BIG_AVATAR_SIZE_COMPACT : BIG_AVATAR_SIZE_REGULAR;

  const collapseStyle = useAnimatedStyle(() => ({
    maxHeight: interpolate(
      scrollY.value,
      [0, HERO_COLLAPSE_DISTANCE],
      [collapseNaturalHeight.value, 0],
      Extrapolation.CLAMP,
    ),
    opacity: interpolate(
      scrollY.value,
      [0, HERO_COLLAPSE_DISTANCE * 0.6],
      [1, 0],
      Extrapolation.CLAMP,
    ),
  }));

  const stickyBarStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [HERO_COLLAPSE_DISTANCE * 0.55, HERO_COLLAPSE_DISTANCE],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  return (
    // minHeight = the sticky bar's own rendered height (topInset clearance +
    // its row content + padding). GoldHeaderShell's outer gradient clips to
    // overflow:hidden and is sized by *this* view's content — without a
    // floor here, once the rich hero's own maxHeight collapses toward 0
    // there'd be nothing left holding the section open, so the gradient
    // (and everything in it, including the absolutely-positioned sticky bar)
    // shrinks away too — the sticky bar doesn't move, it gets clipped from
    // the bottom up as the shell around it shrinks, which reads as "fades in
    // then gets carried away with the rest of the page."
    <View style={{ position: 'relative', minHeight: topInset + 96 }}>
      {/* ── Rich hero — cover banner + overlapping avatar, collapses away ── */}
      <Animated.View style={[collapseStyle, { overflow: 'hidden' }]}>
        <View
          onLayout={(e) => {
            // Once maxHeight above starts constraining this view, onLayout
            // re-fires with the *clipped* height, not the natural content
            // height — recording that would shrink the "expanded" target on
            // every scroll-down tick, so scrolling back up could never fully
            // re-open the hero. Only ever grow the recorded height, never
            // shrink it, so a single unclipped measurement (mount, or fully
            // scrolled back to the top) sticks.
            const measured = e.nativeEvent.layout.height;
            if (measured > collapseNaturalHeight.value) {
              collapseNaturalHeight.value = measured;
            }
          }}
          style={{ paddingTop: topInset, position: 'relative', overflow: 'hidden' }}
        >
          {/* Background — real cover photo or the decorative gold gradient
              fallback — spans the *entire* hero (not just a top strip), so
              it reads as one cohesive backdrop behind the avatar+name row
              and the headline/badges below it, same as a LinkedIn cover. */}
          <View style={StyleSheet.absoluteFillObject}>
            {coverUrl ? (
              <>
                <Image source={{ uri: coverUrl }} style={dashboardStyles.heroCoverImage} />
                <LinearGradient
                  colors={['transparent', 'rgba(18,10,0,0.45)']}
                  locations={[0.35, 1]}
                  style={StyleSheet.absoluteFillObject}
                />
              </>
            ) : (
              <>
                <View style={[dashboardStyles.heroGlowPrimary, { backgroundColor: '#C9A24A', opacity: 0.40 }]} />
                <View style={[dashboardStyles.heroGlowSecondary, { backgroundColor: '#6F4515', opacity: 0.35 }]} />
                <View style={[dashboardStyles.heroGlowAccent, { backgroundColor: '#9A6A14', opacity: 0.30 }]} />
                <View style={[dashboardStyles.heroArcLarge, { borderColor: 'rgba(255,244,184,0.15)' }]} />
                <View style={[dashboardStyles.heroArcSmall, { borderColor: 'rgba(255,244,184,0.10)' }]} />
              </>
            )}
          </View>

          {/* Avatar + name/handle + actions — one row, LinkedIn-style */}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 44, gap: 14 }}>
            {/* Outer wrapper has NO overflow:hidden — only the inner circle
                clips the image, so the edit badge (positioned partly outside
                the circle) doesn't get clipped along with it. */}
            <View style={{ width: bigAvatarSize, height: bigAvatarSize }}>
              <View style={[dashboardStyles.bigAvatarWrap, { width: bigAvatarSize, height: bigAvatarSize, borderRadius: bigAvatarSize / 2 }]}>
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={StyleSheet.absoluteFillObject as any} resizeMode="cover" />
                ) : (
                  <View style={[StyleSheet.absoluteFillObject, dashboardStyles.bigAvatarFallback, { backgroundColor: palette.surfaceElevated }]}>
                    <KISIcon name="person" size={compact ? 26 : 30} color={palette.subtext} />
                  </View>
                )}
              </View>
              <Pressable
                onPress={onEdit}
                style={[dashboardStyles.bigAvatarEditBtn, getProfileDashboardCardStyle(dashboardTheme, 'glass')]}
              >
                <KISIcon name="edit" size={14} color={palette.text} />
              </Pressable>
            </View>

            {/* Name/handle — fixed pale-gold text, same as every other Golden
                Section: this sits on the gold gradient/cover backdrop, not a
                theme-adjusted surface, so palette.text (dark brown in light
                mode, light cream in dark mode) wouldn't reliably contrast
                against it the way this does. */}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={dashboardStyles.heroName} numberOfLines={1}>
                {displayName}
              </Text>
              <Text style={dashboardStyles.heroHandle} numberOfLines={1}>
                {handle}
              </Text>
            </View>

            {/* Notification/settings — same buttons as the sticky bar's, but
                always visible here (the sticky bar's copies only fade in
                once scrolled, so without these the actions would be
                unreachable at rest). */}
            <Pressable onPress={onNotificationsPress} style={dashboardStyles.stickyIconBtn}>
              <KISIcon name="bell" size={18} color="rgba(255,244,184,0.92)" />
              {notificationCount ? (
                <View style={[dashboardStyles.heroNotificationBadge, { backgroundColor: palette.primaryStrong }]}>
                  <Text style={[dashboardStyles.heroNotificationText, { color: palette.onPrimary }]}>{notificationCount}</Text>
                </View>
              ) : null}
            </Pressable>
            <Pressable onPress={onSettingsPress} style={dashboardStyles.stickyIconBtn}>
              <KISIcon name="settings" size={18} color="rgba(255,244,184,0.92)" />
            </Pressable>
          </View>

          <View style={[dashboardStyles.heroContent, { paddingTop: 10 }]}>
            {headline ? (
              <Text style={dashboardStyles.heroHeadline} numberOfLines={2}>
                {headline}
              </Text>
            ) : null}
            <View style={dashboardStyles.heroBadgeRow}>
              {tierLabel ? (
                <View style={[dashboardStyles.heroBadge, dashboardTheme.chips.glass, dashboardStyles.heroBadgeCompact]}>
                  <KISIcon name="star" size={10} color={tierBadgeTextColor} />
                  <Text style={[dashboardTheme.content.badge, dashboardStyles.heroBadgeCompactText, { color: tierBadgeTextColor }]} numberOfLines={1}>
                    {tierLabel}
                  </Text>
                </View>
              ) : null}
              {completionLabel ? (
                <View style={[dashboardStyles.heroBadge, dashboardTheme.chips.glass, dashboardStyles.heroBadgeCompact]}>
                  <Text style={[dashboardTheme.content.badge, dashboardStyles.heroBadgeCompactText, { color: palette.text}]} numberOfLines={1}>
                    {completionLabel}
                  </Text>
                </View>
              ) : null}
              <Pressable
                onPress={onVerificationPress}
                disabled={!onVerificationPress}
                style={{ minHeight: 44, justifyContent: 'center' }}
              >
                <VerificationBadgeRow palette={palette} summary={verificationSummary} compact />
              </Pressable>
            </View>
          </View>
        </View>
      </Animated.View>

      {/* ── Compact sticky bar — invisible at rest, fades in as hero collapses.
          Absolutely overlaid so it doesn't reserve its own layout space. ── */}
      <Animated.View
        pointerEvents="box-none"
        style={[
          dashboardStyles.stickyRow,
          stickyBarStyle,
          { position: 'absolute', top: 0, left: 0, right: 0, paddingTop: topInset + 40, paddingHorizontal: 16 },
        ]}
      >
        <View style={dashboardStyles.stickyAvatarWrap}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={StyleSheet.absoluteFillObject as any} resizeMode="cover" />
          ) : (
            <View style={[StyleSheet.absoluteFillObject, dashboardStyles.stickyAvatarFallback]}>
              <KISIcon name="person" size={18} color="rgba(255,244,184,0.85)" />
            </View>
          )}
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={dashboardStyles.stickyName}>
            {displayName}
          </Text>
          <Text numberOfLines={1} style={dashboardStyles.stickyHandle}>
            {handle}
          </Text>
        </View>

        <Pressable onPress={onNotificationsPress} style={dashboardStyles.stickyIconBtn}>
          <KISIcon name="bell" size={18} color="rgba(255,244,184,0.92)" />
          {notificationCount ? (
            <View style={[dashboardStyles.heroNotificationBadge, { backgroundColor: palette.primaryStrong }]}>
              <Text style={[dashboardStyles.heroNotificationText, { color: palette.onPrimary }]}>{notificationCount}</Text>
            </View>
          ) : null}
        </Pressable>
        <Pressable onPress={onSettingsPress} style={dashboardStyles.stickyIconBtn}>
          <KISIcon name="settings" size={18} color="rgba(255,244,184,0.92)" />
        </Pressable>
      </Animated.View>
    </View>
  );
};

export const WalletSummaryCard = ({
  title = 'Wallet',
  balanceLabel,
  tierLabel,
  actions,
  onViewAll,
}: {
  title?: string;
  balanceLabel: string;
  usdLabel?: string;
  tierLabel?: string;
  actions?: DashboardAction[];
  onViewAll?: () => void;
}) => {
  const { palette, dashboardTheme, compact, responsive } = useDashboardTheme();
  const quickCardLayoutStyle = responsive.isWatch
    ? dashboardStyles.quickActionCardTwo
    : dashboardStyles.quickActionCardThree;
  return (
    <DashboardCard>
      <SectionHeader title={title} actionLabel="View all" onAction={onViewAll} />
      <View style={[dashboardStyles.walletTopRow, compact && dashboardStyles.wrapRow]}>
        <View style={{ flex: 1, gap: 8 }}>
          <Text style={dashboardTheme.content.meta}>Promotional credits</Text>
          <Text style={[dashboardTheme.content.heading, { fontSize: 24 }]} numberOfLines={1}>
            {String(balanceLabel || '').replace(/KISC/g, 'promotional credits')}
          </Text>
          <Text style={dashboardTheme.content.meta}>Reward credits are not cash or transferable value.</Text>
          {tierLabel ? <Text style={dashboardTheme.content.meta}>Plan: {tierLabel}</Text> : null}
        </View>
        <View style={[dashboardStyles.walletCoinBadge, compact && dashboardStyles.walletCoinBadgeCompact, dashboardTheme.chips.primary]}>
          <Image source={creditIcon} style={dashboardStyles.walletCoinIcon} />
        </View>
      </View>
      {actions?.length ? (
        <View style={dashboardStyles.quickGrid}>
          {actions.map((action) => {
            const toneColors = resolveToneColors(action.tone, dashboardTheme, palette);
            return (
              <Pressable
                key={action.key}
                onPress={action.onPress}
                style={[
                  dashboardStyles.quickActionCard,
                  quickCardLayoutStyle,
                  compact && dashboardStyles.quickActionCardCompact,
                  getProfileDashboardCardStyle(dashboardTheme, 'action'),
                ]}
              >
                <View style={[dashboardStyles.quickActionIconWrap, { backgroundColor: toneColors.bg }]}>
                  <KISIcon name={action.icon} size={20} color={toneColors.color} />
                </View>
                <Text style={dashboardTheme.content.body} numberOfLines={2}>
                  {action.title}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </DashboardCard>
  );
};

export const QuickActionGrid = ({
  title = 'Quick actions',
  items,
}: {
  title?: string;
  items: DashboardAction[];
}) => {
  const { palette, dashboardTheme, compact, responsive } = useDashboardTheme();
  const quickCardLayoutStyle = responsive.isWatch
    ? dashboardStyles.quickActionCardTwo
    : dashboardStyles.quickActionCardThree;
  return (
    <DashboardCard>
      <SectionHeader title={title} />
      <View style={dashboardStyles.quickGrid}>
        {items.map((item) => {
          const toneColors = resolveToneColors(item.tone, dashboardTheme, palette);
          return (
            <Pressable
              key={item.key}
              onPress={item.onPress}
              style={[
                dashboardStyles.quickActionCard,
                quickCardLayoutStyle,
                compact && dashboardStyles.quickActionCardCompact,
                getProfileDashboardCardStyle(dashboardTheme, 'action'),
              ]}
            >
              <View style={[dashboardStyles.quickActionIconWrap, { backgroundColor: toneColors.bg }]}>
                <KISIcon name={item.icon} size={22} color={toneColors.color} />
              </View>
              <Text style={dashboardTheme.content.body} numberOfLines={2}>
                {item.title}
              </Text>
              {item.subtitle ? (
                <Text style={dashboardTheme.content.quiet} numberOfLines={2}>
                  {item.subtitle}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </DashboardCard>
  );
};

export const RecentActivityTimeline = ({
  title = 'Recent activity',
  items,
  onViewAll,
}: {
  title?: string;
  items: TimelineItem[];
  onViewAll?: () => void;
}) => {
  const { palette, dashboardTheme, compact } = useDashboardTheme();
  return (
    <DashboardCard>
      <SectionHeader title={title} actionLabel="View all" onAction={onViewAll} />
      <View style={dashboardStyles.timelineWrap}>
        {items.map((item, index) => {
          const toneColors = resolveToneColors(item.tone, dashboardTheme, palette);
          return (
            <Pressable
              key={item.id}
              onPress={item.onPress}
              style={[dashboardStyles.timelineRow, { minHeight: 44 }]}
            >
              <View style={dashboardStyles.timelineRail}>
                <View style={[dashboardStyles.timelineDot, { backgroundColor: toneColors.bg }]}>
                  <KISIcon name={item.icon || 'check'} size={16} color={toneColors.color} />
                </View>
                {index < items.length - 1 ? (
                  <View style={[dashboardStyles.timelineLine, { backgroundColor: palette.divider }]} />
                ) : null}
              </View>
              <View style={[dashboardStyles.timelineCard, getProfileDashboardCardStyle(dashboardTheme, 'timeline')]}>
                <View style={[dashboardStyles.timelineTextRow, compact && dashboardStyles.wrapRow]}>
                  <View style={{ flex: 1, gap: 4, paddingRight: 12 }}>
                    <Text style={dashboardTheme.content.heading} numberOfLines={1}>
                      {item.title}
                    </Text>
                    {item.description ? (
                      <Text style={dashboardTheme.content.meta}>{item.description}</Text>
                    ) : null}
                  </View>
                  {item.timestamp ? (
                    <Text style={[dashboardTheme.content.quiet, dashboardStyles.timelineTime]} numberOfLines={2}>
                      {item.timestamp}
                    </Text>
                  ) : null}
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>
    </DashboardCard>
  );
};

export const ImpactSnapshotCard = ({
  title = 'Impact snapshot',
  periodLabel,
  stats,
  onViewAll,
}: {
  title?: string;
  periodLabel?: string;
  stats: StatItem[];
  onViewAll?: () => void;
}) => {
  const { palette, dashboardTheme } = useDashboardTheme();
  return (
    <DashboardCard>
      <SectionHeader title={title} actionLabel={periodLabel} onAction={onViewAll} />
      <View style={dashboardStyles.statGrid}>
        {stats.map((stat) => {
          const toneColors = resolveToneColors(stat.tone, dashboardTheme, palette);
          return (
            <View
              key={stat.key}
              style={[dashboardStyles.statCard, getProfileDashboardCardStyle(dashboardTheme, 'stat')]}
            >
              {stat.icon ? (
                <View style={[dashboardStyles.statIconWrap, { backgroundColor: toneColors.bg }]}>
                  <KISIcon name={stat.icon} size={18} color={toneColors.color} />
                </View>
              ) : null}
              <Text style={dashboardTheme.content.meta} numberOfLines={1}>
                {stat.label}
              </Text>
              <Text style={[dashboardTheme.content.heading, { fontSize: 28 }]} numberOfLines={1}>
                {stat.value}
              </Text>
            </View>
          );
        })}
      </View>
    </DashboardCard>
  );
};

export const PartnerOrganizationSummary = ({
  title = 'Partner organizations',
  summary,
  ctaTitle,
  onPress,
  onViewAll,
}: {
  title?: string;
  summary: string;
  ctaTitle?: string;
  onPress?: () => void;
  onViewAll?: () => void;
}) => {
  const { palette, dashboardTheme } = useDashboardTheme();
  return (
    <DashboardCard>
      <SectionHeader title={title} actionLabel="View all" onAction={onViewAll} />
      <View style={dashboardStyles.emptySummaryWrap}>
        <View style={[dashboardStyles.emptySummaryIcon, { backgroundColor: dashboardTheme.accents.secondaryRing }]}>
          <KISIcon name="people" size={28} color={palette.secondary} />
        </View>
        <Text style={[dashboardTheme.content.body, { textAlign: 'center' }]}>{summary}</Text>
        {ctaTitle ? <KISButton title={ctaTitle} onPress={onPress} /> : null}
      </View>
    </DashboardCard>
  );
};

export const MarketplaceOrdersSummary = ({
  summary,
  recentOrders,
  onViewOrders,
  onViewReceivedOrders,
}: {
  summary: StatItem[];
  recentOrders: OrderItem[];
  onViewOrders?: () => void;
  onViewReceivedOrders?: () => void;
}) => {
  const { palette, dashboardTheme, compact } = useDashboardTheme();
  return (
    <DashboardCard>
      <SectionHeader title="Marketplace orders" actionLabel="View all orders" onAction={onViewOrders} />
      <View style={dashboardStyles.summaryRow}>
        {summary.map((item) => (
          <View key={item.key} style={[dashboardStyles.summaryMiniCard, getProfileDashboardCardStyle(dashboardTheme, 'stat')]}>
            <Text style={dashboardTheme.content.meta} numberOfLines={1}>
              {item.label}
            </Text>
            <Text style={[dashboardTheme.content.heading, { fontSize: 22 }]} numberOfLines={1}>
              {item.value}
            </Text>
          </View>
        ))}
      </View>
      {recentOrders.length ? (
        <View style={dashboardStyles.orderList}>
          {recentOrders.map((order) => (
            <View
              key={order.id}
              style={[dashboardStyles.orderCard, { borderWidth: 2, borderColor: palette.gold, borderRadius: 15 }]}
            >
              <Text style={dashboardTheme.content.body} numberOfLines={1}>
                {order.label}
              </Text>
              <Text style={dashboardTheme.content.meta} numberOfLines={1}>
                {[order.status, order.date].filter(Boolean).join(' • ')}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      <View style={[dashboardStyles.dualActionRow, compact && dashboardStyles.wrapRow]}>
        <KISButton title="View Orders" onPress={onViewOrders} />
        <KISButton title="Received Orders" variant="outline" onPress={onViewReceivedOrders} />
      </View>
    </DashboardCard>
  );
};

export const WorkspaceLauncherSection = ({
  title = 'Workspace launchers',
  items,
}: {
  title?: string;
  items: WorkspaceLauncher[];
}) => {
  const { palette, dashboardTheme } = useDashboardTheme();
  return (
    <DashboardCard>
      <SectionHeader title={title} subtitle="Open the real management workspace for each domain." />
      <View style={dashboardStyles.workspaceList}>
        {items.map((item) => {
          const toneColors = resolveToneColors('primary', dashboardTheme, palette);
          return (
            <Pressable
              key={item.key}
              onPress={item.onPress}
              style={[dashboardStyles.workspaceCard, getProfileDashboardCardStyle(dashboardTheme, 'action')]}
            >
              <View style={[dashboardStyles.workspaceIcon, { backgroundColor: toneColors.bg }]}>
                <KISIcon name={item.icon} size={20} color={toneColors.color} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={dashboardTheme.content.heading} numberOfLines={1}>
                  {item.title}
                </Text>
                {item.helper ? (
                  <Text style={dashboardTheme.content.meta} numberOfLines={2}>
                    {item.helper}
                  </Text>
                ) : null}
                {item.meta ? (
                  <Text style={dashboardTheme.content.quiet} numberOfLines={1}>
                    {item.meta}
                  </Text>
                ) : null}
                <VerificationBadgeRow palette={palette} summary={item.verificationSummary} compact />
              </View>
              <KISIcon name="chevron-right" size={18} color={palette.subtext} />
            </Pressable>
          );
        })}
      </View>
    </DashboardCard>
  );
};

export const AppointmentSummaryCard = ({
  summary,
  items,
}: {
  summary: StatItem[];
  items: AppointmentItem[];
}) => {
  const { palette, dashboardTheme } = useDashboardTheme();
  return (
    <DashboardCard>
      <SectionHeader
        title="Appointments"
        subtitle="A quick summary of active service bookings and pending follow-up."
      />
      <View style={dashboardStyles.summaryRow}>
        {summary.map((item) => (
          <View key={item.key} style={[dashboardStyles.summaryMiniCard, getProfileDashboardCardStyle(dashboardTheme, 'stat')]}>
            <Text style={dashboardTheme.content.meta} numberOfLines={1}>
              {item.label}
            </Text>
            <Text style={[dashboardTheme.content.heading, { fontSize: 22 }]} numberOfLines={1}>
              {item.value}
            </Text>
          </View>
        ))}
      </View>
      <View style={dashboardStyles.orderList}>
        {items.map((item) => (
          <Pressable
            key={item.id}
            onPress={item.onPress}
            style={[dashboardStyles.orderCard, { borderWidth: 2, borderColor: palette.gold, borderRadius: 15 }]}
          >
            <Text style={dashboardTheme.content.body} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={dashboardTheme.content.meta} numberOfLines={2}>
              {[item.provider, item.dateLabel].filter(Boolean).join(' • ')}
            </Text>
            <Text style={dashboardTheme.content.quiet} numberOfLines={1}>
              {[item.status, item.paymentStatus].filter(Boolean).join(' • ')}
            </Text>
          </Pressable>
        ))}
      </View>
    </DashboardCard>
  );
};

export const NotificationSummaryCard = ({
  unreadCount,
  items,
  onViewAll,
  onDeleteItem,
}: {
  unreadCount: number;
  items: NotificationItem[];
  onViewAll?: () => void;
  onDeleteItem?: (id: string) => void;
}) => {
  const { palette, dashboardTheme } = useDashboardTheme();
  return (
    <DashboardCard>
      <SectionHeader
        title="In-app notifications"
        subtitle={`${unreadCount} unread`}
        actionLabel="View all"
        onAction={onViewAll}
      />
      <View style={dashboardStyles.notificationList}>
        {items.map((item) => (
          <Pressable
            key={item.id}
            onPress={item.onPress}
            style={[
              dashboardStyles.notificationCard,
              getProfileDashboardCardStyle(dashboardTheme, 'timeline'),
              !item.read && { borderColor: dashboardTheme.accents.primaryRing },
            ]}
          >
            <View style={{ flex: 1, gap: 4, paddingRight: 10 }}>
              <Text style={dashboardTheme.content.body} numberOfLines={1}>
                {item.title}
              </Text>
              {item.body ? (
                <Text style={dashboardTheme.content.meta} numberOfLines={2}>
                  {item.body}
                </Text>
              ) : null}
              {item.createdAt ? (
                <Text style={dashboardTheme.content.quiet} numberOfLines={1}>
                  {item.createdAt}
                </Text>
              ) : null}
            </View>
            {onDeleteItem ? (
              <Pressable
                onPress={() => onDeleteItem(item.id)}
                hitSlop={8}
                style={{ minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' }}
              >
                <KISIcon name="trash" size={16} color={palette.subtext} />
              </Pressable>
            ) : null}
          </Pressable>
        ))}
      </View>
    </DashboardCard>
  );
};

export const LanguageSelectorCard = ({
  currentLabel,
  languages,
  currentCode,
  downloadingCode,
  onSelect,
}: {
  currentLabel: string;
  languages: LanguageOption[];
  currentCode: string;
  downloadingCode?: string | null;
  onSelect?: (code: string) => void;
}) => {
  const { dashboardTheme } = useDashboardTheme();
  return (
    <DashboardCard variant="glass">
      <SectionHeader
        title="Language"
        subtitle={`Current language: ${currentLabel}`}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={dashboardStyles.languageScroller}
      >
        {languages.map((entry) => {
          const selected = entry.code === currentCode;
          const downloading = entry.code === downloadingCode;
          return (
            <Pressable
              key={entry.code}
              disabled={downloading}
              onPress={() => onSelect?.(entry.code)}
              style={[
                dashboardStyles.languageChip,
                selected ? dashboardTheme.chips.primary : dashboardTheme.chips.neutral,
              ]}
            >
              {downloading ? (
                <ActivityIndicator size="small" style={{ marginRight: 6 }} />
              ) : entry.flagEmoji ? (
                <Text style={{ fontSize: 18, marginRight: 6 }}>{entry.flagEmoji}</Text>
              ) : null}
              <Text
                style={[
                  dashboardTheme.content.badge,
                  { color: selected ? undefined : dashboardTheme.content.body.color },
                ]}
              >
                {entry.nativeName ?? entry.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </DashboardCard>
  );
};

const dashboardStyles = StyleSheet.create({
  cardBase: {
    padding: 20,
    gap: 16,
  },
  wrapRow: { flexWrap: 'wrap' },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  // ── Compact sticky bar (absolutely overlaid, fades in as hero collapses) ──
  stickyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 14,
  },
  stickyAvatarWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255,244,184,0.35)',
  },
  stickyAvatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(23,17,31,0.32)',
  },
  stickyName: {
    color: 'rgba(255,244,184,0.96)',
    fontSize: 17,
    fontWeight: '900',
  },
  stickyHandle: {
    color: 'rgba(255,244,184,0.70)',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  stickyIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(23,17,31,0.32)',
    borderWidth: 1,
    borderColor: 'rgba(255,244,184,0.30)',
  },
  // ── Rich hero: full-bleed cover/gold backdrop + avatar-and-name row ──
  bigAvatarWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#FFFDF8',
  },
  bigAvatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigAvatarEditBtn: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletCoinIcon: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  heroBackdrop: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  heroCoverImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  heroGlowPrimary: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    top: -80,
    right: -70,
  },
  heroGlowSecondary: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    bottom: -90,
    left: -60,
  },
  heroGlowAccent: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    top: 22,
    right: 56,
  },
  heroArcLarge: {
    position: 'absolute',
    width: 360,
    height: 360,
    borderRadius: 180,
    right: -140,
    top: -120,
    borderWidth: 1.5,
  },
  heroArcSmall: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    right: -72,
    top: -28,
    borderWidth: 1,
  },
  heroScrim: {
    ...StyleSheet.absoluteFillObject,
  },
  heroNotificationBadge: {
    position: 'absolute',
    top: -4,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  heroNotificationText: {
    fontSize: 10,
    fontWeight: '800',
  },
  heroContent: {
    paddingTop: 20,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  heroName: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.3,
    color: 'rgba(255,244,184,0.96)',
  },
  heroHandle: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
    color: 'rgba(255,244,184,0.70)',
  },
  heroHeadline: {
    fontSize: 14,
    lineHeight: 21,
    marginTop: 6,
    color: 'rgba(255,244,184,0.78)',
  },
  heroBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  // Shrinks the tier/completion pills below the shared chips.glass default
  // (paddingHorizontal:12/paddingVertical:7/fontSize:11) — layered on top of
  // it rather than edited in the shared theme, since chips.glass is reused
  // by chips elsewhere in the profile dashboard that shouldn't shrink too.
  heroBadgeCompact: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  heroBadgeCompactText: {
    fontSize: 10,
  },
  completionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 84,
  },
  progressRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  walletCoinBadge: {
    width: 116,
    height: 116,
    borderRadius: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  walletCoinBadgeCompact: { width: 74, height: 74, borderRadius: 37 },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickActionCard: {
    flexGrow: 0,
    flexShrink: 1,
    minWidth: 0,
    padding: 10,
    gap: 6,
    minHeight: 88,
    justifyContent: 'space-between',
  },
  quickActionCardThree: {
    flexBasis: '31.2%',
    maxWidth: '31.2%',
  },
  quickActionCardTwo: {
    flexBasis: '47.8%',
    maxWidth: '47.8%',
  },
  quickActionCardCompact: {
    padding: 10,
    minHeight: 96,
  },
  quickActionIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineWrap: {
    gap: 12,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
  },
  timelineRail: {
    alignItems: 'center',
    width: 28,
  },
  timelineDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginTop: 4,
  },
  timelineCard: {
    flex: 1,
    padding: 16,
  },
  timelineTextRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  timelineTime: {
    maxWidth: 110,
    textAlign: 'right',
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    minWidth: 132,
    flexGrow: 1,
    padding: 16,
    gap: 8,
    minHeight: 122,
  },
  statIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySummaryWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingVertical: 14,
  },
  emptySummaryIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  summaryMiniCard: {
    minWidth: 96,
    flexGrow: 1,
    padding: 14,
    gap: 6,
  },
  orderList: {
    gap: 10,
  },
  orderCard: {
    padding: 14,
    gap: 5,
  },
  dualActionRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
    marginTop: 2,
  },
  workspaceList: {
    gap: 12,
  },
  workspaceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 15,
    minHeight: 88,
  },
  workspaceIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationList: {
    gap: 10,
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
  },
  languageScroller: {
    gap: 10,
    paddingTop: 2,
  },
  languageChip: {
    marginRight: 10,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
