import React, { useMemo } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import KISButton from '@/constants/KISButton';
import { KISIcon, type KISIconName } from '@/constants/kisIcons';
import { useKISTheme } from '@/theme/useTheme';
import {
  createProfileDashboardTheme,
  getProfileDashboardCardStyle,
} from '../../profileDashboardTheme';

import KISC from '../../../../../assets/KIS-Coin.png';

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
  onPress?: () => void;
};

type LanguageOption = {
  code: string;
  label: string;
};

const useDashboardTheme = () => {
  const { palette, tone, isDark } = useKISTheme();
  const dashboardTheme = useMemo(
    () => createProfileDashboardTheme(palette, tone),
    [palette, tone],
  );
  return { palette, tone, isDark, dashboardTheme };
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
  const { dashboardTheme } = useDashboardTheme();
  return (
    <View
      style={[
        dashboardStyles.cardBase,
        getProfileDashboardCardStyle(dashboardTheme, variant),
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
  const { dashboardTheme, palette } = useDashboardTheme();
  return (
    <View style={dashboardStyles.sectionHeaderRow}>
      <View style={{ flex: 1, gap: 4, paddingRight: 12 }}>
        <Text style={dashboardTheme.sectionHeader.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={dashboardTheme.sectionHeader.subtitle}>{subtitle}</Text>
        ) : null}
      </View>
      {actionLabel ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={[dashboardTheme.sectionHeader.actionLabel, { color: palette.primaryStrong }]}>
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
};

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
}) => {
  const { palette, dashboardTheme, isDark } = useDashboardTheme();

  return (
    <View style={[dashboardStyles.heroShell, getProfileDashboardCardStyle(dashboardTheme, 'dashboard')]}>
      <View
        style={[
          dashboardStyles.heroBackdrop,
          { backgroundColor: isDark  ? 'rgba(0,0,0,0.5)'
        : 'rgba(0, 0, 0, 0.92)', },
        ]}
      >
        {coverUrl ? (
          <>
          <View style={{backgroundColor: 'rgba(0, 0, 0, 0.46)', height: '100%', width: '100%', zIndex: 9}} />
          <Image source={{ uri: coverUrl }} style={dashboardStyles.heroCoverImage} />
          </>
        ) : null}
        <View style={[dashboardStyles.heroGlowPrimary, { backgroundColor: dashboardTheme.hero.haloPrimary }]} />
        <View style={[dashboardStyles.heroGlowSecondary, { backgroundColor: dashboardTheme.hero.haloSecondary }]} />
        <View style={[dashboardStyles.heroGlowAccent, { backgroundColor: dashboardTheme.hero.haloAccent }]} />
        <View style={[dashboardStyles.heroArcLarge, { borderColor: dashboardTheme.hero.ring }]} />
        <View style={[dashboardStyles.heroArcSmall, { borderColor: dashboardTheme.hero.border }]} />
        <View style={[dashboardStyles.heroScrim, { backgroundColor: dashboardTheme.hero.scrim }]} />
      </View>

      <View style={dashboardStyles.heroActionsRail}>
        <View style={[dashboardStyles.heroTopChip, getProfileDashboardCardStyle(dashboardTheme, 'heroOverlay')]}>
          <Text style={[dashboardTheme.sectionHeader.eyebrow, { color: palette.text }]}>
            Profile Dashboard
          </Text>
        </View>
        <View style={dashboardStyles.heroActionMain}>
          <Pressable
            onPress={onNotificationsPress}
            style={[dashboardStyles.heroIconButton, { backgroundColor: dashboardTheme.hero.iconRailBg, borderColor: dashboardTheme.hero.border }]}
          >
            <KISIcon name="bell" size={20} color={dashboardTheme.hero.iconColor} />
            {notificationCount ? (
              <View style={[dashboardStyles.heroNotificationBadge, { backgroundColor: palette.primaryStrong }]}>
                <Text style={dashboardStyles.heroNotificationText}>{notificationCount}</Text>
              </View>
            ) : null}
          </Pressable>
          <Pressable
            onPress={onSettingsPress}
            style={[dashboardStyles.heroIconButton, { backgroundColor: dashboardTheme.hero.iconRailBg, borderColor: dashboardTheme.hero.border }]}
          >
            <KISIcon name="settings" size={20} color={dashboardTheme.hero.iconColor} />
          </Pressable>
        </View>
        
      </View>

      <View style={dashboardStyles.heroContent}>
        <View style={dashboardStyles.heroIdentityRow}>
          <View style={dashboardStyles.heroAvatarWrap}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={dashboardStyles.heroAvatar} />
            ) : (
              <View style={[dashboardStyles.heroAvatarFallback, { backgroundColor: palette.surfaceElevated }]}>
                <KISIcon name="person" size={40} color={palette.subtext} />
              </View>
            )}
            <Pressable
              onPress={onEdit}
              style={[dashboardStyles.heroEditButton, getProfileDashboardCardStyle(dashboardTheme, 'glass')]}
            >
              <KISIcon name="edit" size={16} color={palette.text} />
            </Pressable>
          </View>

          <View style={dashboardStyles.heroTextBlock}>
            <Text style={dashboardStyles.heroName} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={dashboardStyles.heroHandle} numberOfLines={1}>
              {handle}
            </Text>
            {headline ? (
              <Text style={dashboardStyles.heroHeadline} numberOfLines={2}>
                {headline}
              </Text>
            ) : null}
            <View style={dashboardStyles.heroBadgeRow}>
              {tierLabel ? (
                <View style={[dashboardStyles.heroBadge, dashboardTheme.chips.primary]}>
                  <KISIcon name="star" size={12} color={palette.primaryStrong} />
                  <Text style={[dashboardTheme.content.badge, { color: palette.primaryStrong }]} numberOfLines={1}>
                    {tierLabel}
                  </Text>
                </View>
              ) : null}
              {completionLabel ? (
                <View style={[dashboardStyles.heroBadge, dashboardTheme.chips.glass]}>
                  <Text style={[dashboardTheme.content.badge, { color: palette.text}]} numberOfLines={1}>
                    {completionLabel}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>
      </View>
    </View>
  );
};

export const WalletSummaryCard = ({
  title = 'Wallet',
  balanceLabel,
  usdLabel,
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
  const { palette, dashboardTheme } = useDashboardTheme();
  return (
    <DashboardCard>
      <SectionHeader title={title} actionLabel="View all" onAction={onViewAll} />
      <View style={dashboardStyles.walletTopRow}>
        <View style={{ flex: 1, gap: 8 }}>
          <Text style={dashboardTheme.content.meta}>KIS Coin Balance</Text>
          <Text style={[dashboardTheme.content.heading, { fontSize: 24 }]} numberOfLines={1}>
            {balanceLabel}
          </Text>
          {usdLabel ? <Text style={dashboardTheme.content.meta}>{usdLabel}</Text> : null}
          {tierLabel ? <Text style={dashboardTheme.content.meta}>Plan: {tierLabel}</Text> : null}
        </View>
        <View style={[dashboardStyles.walletCoinBadge, dashboardTheme.chips.primary]}>
          <Image source={KISC} style={dashboardStyles.walletCoinIcon} />
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
  const { palette, dashboardTheme } = useDashboardTheme();
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
  const { palette, dashboardTheme } = useDashboardTheme();
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
              style={dashboardStyles.timelineRow}
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
                <View style={dashboardStyles.timelineTextRow}>
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
  const { dashboardTheme } = useDashboardTheme();
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
              style={[dashboardStyles.orderCard, {borderWidth: 2, borderColor: '#FF8A33', borderRadius: 15,}]}
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
      <View style={dashboardStyles.dualActionRow}>
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
  const { dashboardTheme } = useDashboardTheme();
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
            style={[dashboardStyles.orderCard, {borderWidth: 2, borderColor: '#FF8A33', borderRadius: 15,}]}
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
              <Pressable onPress={() => onDeleteItem(item.id)} hitSlop={8}>
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
  onSelect,
}: {
  currentLabel: string;
  languages: LanguageOption[];
  currentCode: string;
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
          return (
            <Pressable
              key={entry.code}
              onPress={() => onSelect?.(entry.code)}
              style={[
                dashboardStyles.languageChip,
                selected ? dashboardTheme.chips.primary : dashboardTheme.chips.neutral,
              ]}
            >
              <Text
                style={[
                  dashboardTheme.content.badge,
                  { color: selected ? undefined : dashboardTheme.content.body.color },
                ]}
              >
                {entry.label}
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
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroShell: {
    overflow: 'hidden',
    minHeight: 308,
    width: '100%',
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
  heroActionsRail: {
    position: 'absolute',
    top: 16,
    flexDirection: 'row',
    gap: 10,
    zIndex: 4,
    width: "100%",
    padding: 10,
    justifyContent: 'space-between',
  },
  heroActionMain: {
    flexDirection: 'row',
    gap: 10,
  },
  heroIconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
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
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  heroContent: {
    paddingTop: 88,
    paddingBottom: 16,
  },
  heroTopChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 16,
  },
  heroIdentityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    justifyContent: 'space-between',
    paddingLeft: 10,
  },
  heroAvatarWrap: {
    width: 112,
    height: 112,
    borderRadius: 56,
    position: 'relative',
  },
  heroAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 56,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  heroAvatarFallback: {
    width: '100%',
    height: '100%',
    borderRadius: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroEditButton: {
    position: 'absolute',
    right: -2,
    bottom: -4,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTextBlock: {
    flex: 1,
    gap: 5,
    paddingBottom: 4,
  },
  heroName: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -1,
  },
  heroHandle: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 17,
    fontWeight: '600',
  },
  heroHeadline: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    lineHeight: 21,
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
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickActionCard: {
    minWidth: '47%',
    flexGrow: 1,
    padding: 16,
    gap: 12,
    minHeight: 132,
    justifyContent: 'space-between',
  },
  quickActionIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 16,
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
    minWidth: '47%',
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
    minWidth: 110,
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
  },
});
