import React, { useCallback, useMemo, useState } from 'react';
import {
  DeviceEventEmitter,
  PanResponder,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { useRawTopInset } from '@/hooks/useSafeTopInset';

import { useKISTheme } from '@/theme/useTheme';
import { useGoldenSectionContent } from '@/contexts/GoldenSectionContext';
import { useSearchOverlay } from '@/contexts/SearchOverlayContext';
import { useContextPanelContent, TabletCard } from '@/components/shell';
import { useStatusBarStyle } from '@/theme/useStatusBarStyle';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type {
  MainTabsParamList,
  BroadcastProfileKey,
} from '@/navigation/types';

import BroadcastHeaderBar from '@/components/broadcast/BroadcastHeaderBar';
import KcanVisionModal from '@/components/broadcast/KcanVisionModal';
import BroadcastMainTabs, {
  type BroadcastMainTabId,
} from '@/components/broadcast/BroadcastMainTabs';
import BroadcastSearchRow from '@/components/broadcast/BroadcastSearchRow';
import BroadcastFeedsPage from '../broadcast/pages/BroadcastFeedsPage';
import ChannelsDiscoverPage from '../broadcast/channels/ChannelsDiscoverPage';
import BroadcastEducationPage from '../broadcast/pages/BroadcastEducationPage';
import BroadcastMarketPage from '../broadcast/pages/BroadcastMarketPage';
import BroadcastHealthcarePage from '../broadcast/pages/BroadcastHealthcarePage';
import BroadcastJobsPage from '../broadcast/pages/BroadcastJobsPage';
import { KISIcon } from '@/constants/kisIcons';
import { useResponsiveLayout } from '@/theme/responsive';
import {
  bindMainTabBadgeSourceEvents,
  fetchMainTabBadgeCounts,
} from '@/services/mainTabNotificationBadges';
import {
  getShopCartState,
  refreshShopCartFromBackend,
  subscribeToShopCart,
  type ShopCartState,
} from '@/screens/market/cart/shopCartManager';

type BroadcastFilterOption = {
  key: string;
  label: string;
  description: string;
};

const FILTER_OPTIONS: Record<BroadcastMainTabId, BroadcastFilterOption[]> = {
  feeds: [
    { key: 'latest', label: 'Latest', description: 'Fresh broadcasts' },
    { key: 'trending', label: 'Trending', description: 'Most active' },
    { key: 'saved', label: 'Saved', description: 'Your keeps' },
  ],
  channels: [
    { key: 'all', label: 'All', description: 'Every channel' },
    { key: 'video', label: 'Video', description: 'Long-form uploads' },
    { key: 'shorts', label: 'Shorts', description: 'Vertical clips' },
    { key: 'live', label: 'Live', description: 'Streams and replays' },
    { key: 'education', label: 'Education', description: 'Learning channels' },
    { key: 'market', label: 'Market', description: 'Shops and services' },
    { key: 'health', label: 'Health', description: 'Care providers' },
  ],
  education: [
    { key: 'course', label: 'Courses', description: 'Structured learning' },
    { key: 'lesson', label: 'Lessons', description: 'Short sessions' },
    { key: 'workshop', label: 'Workshops', description: 'Live programs' },
  ],
  market: [
    { key: 'all', label: 'All', description: 'Products and services' },
    { key: 'trending', label: 'Trending', description: 'Rated broadcasts' },
    { key: 'drops', label: 'Drops', description: 'Limited releases' },
    {
      key: 'broadcasted',
      label: 'Broadcasted',
      description: 'Live market posts',
    },
  ],
  healthcare: [
    { key: 'upcoming', label: 'Upcoming', description: 'Next available' },
    { key: 'today', label: 'Today', description: 'Ready now' },
    { key: 'past', label: 'Past', description: 'Recent history' },
  ],
  jobs: [
    { key: 'all', label: 'All', description: 'Every open role' },
    { key: 'remote', label: 'Remote', description: 'Work from anywhere' },
    { key: 'full_time', label: 'Full time', description: 'Full-time roles' },
    { key: 'part_time', label: 'Part time', description: 'Part-time roles' },
  ],
};

const SEARCH_PLACEHOLDERS: Record<BroadcastMainTabId, string> = {
  feeds: 'Search broadcast feeds',
  channels: 'Search channels',
  education: 'Search courses & lessons',
  market: 'Search marketplace drops',
  healthcare: 'Search providers & services',
  jobs: 'Search job openings',
};

const PROFILE_KEY_BY_TAB: Record<BroadcastMainTabId, BroadcastProfileKey> = {
  feeds: 'broadcast_feed',
  channels: 'broadcast_feed',
  education: 'education',
  market: 'market',
  healthcare: 'health',
  jobs: 'broadcast_feed',
};

const MAIN_TAB_ORDER: BroadcastMainTabId[] = [
  'feeds',
  'channels',
  'education',
  'market',
  'healthcare',
  'jobs',
];

const TAB_SWIPE_DISTANCE = 104;
const TAB_SWIPE_MAX_VERTICAL_DRIFT = 30;
const TAB_SWIPE_DIRECTION_RATIO = 2.5;

// Fixed footprint for the filter panel, regardless of which tab's filters
// are showing or how many rows they need — the feeds tab alone stacks five
// sections (quick access, category, sort, date, duration) that previously
// had no outer height cap, so opening filters there could grow the panel
// tall enough to push the tab content well down the screen. A real `height`
// (not `maxHeight`, which still shrinks for short content) keeps the
// panel's size 100% predictable, so the tab-content ScrollView beneath it
// always starts in the same place and never overlaps any part of it; all
// filter content scrolls inside this fixed box instead.
const FILTER_PANEL_HEIGHT = 300;
const FILTER_PANEL_HEIGHT_COMPACT = 240;

export default function BroadcastScreen() {
  const { palette, tone, gradients } = useKISTheme();
  const responsive = useResponsiveLayout();
  // Opts out of the app-wide GLOBAL_TOP_PADDING dial (useSafeTopInset) — this
  // is one of the 5 main-tab gold-header screens with its own hand-tuned
  // spacing, so it reads the raw (corrected) device inset instead.
  const topInset = useRawTopInset();
  const compactBroadcast = responsive.isWatch || responsive.isCompactPhone;
  const styles = useMemo(() => makeStyles(palette), [palette]);
  // header: accent-first so the transparent status bar shows the accent, not dark.
  const broadcastGoldGradient = [...gradients.header];

  const [activeMainTab, setActiveMainTab] =
    useState<BroadcastMainTabId>('feeds');

  // Bell icon in the header — see BroadcastHeaderBar's onNotifications prop.
  // Reuses the same backend-backed badge count every other main tab's
  // unread dot already reads, refreshed on the same shared event bus
  // (message/broadcast/channel/bible updates etc.) rather than a bespoke
  // poll.
  const [hasUnreadBroadcastNotifications, setHasUnreadBroadcastNotifications] = useState(false);
  const refreshBroadcastNotificationBadge = useCallback(() => {
    fetchMainTabBadgeCounts()
      .then((counts) => setHasUnreadBroadcastNotifications((counts.Broadcast ?? 0) > 0))
      .catch(() => {});
  }, []);
  useFocusEffect(
    useCallback(() => {
      refreshBroadcastNotificationBadge();
      return bindMainTabBadgeSourceEvents(refreshBroadcastNotificationBadge);
    }, [refreshBroadcastNotificationBadge]),
  );

  // Tablet-shell sidebar deep-link: Sidebar's "Marketplace" nav item calls
  // navigation.navigate('Broadcast', { mainTab: 'market' }) to switch this
  // screen's internal sub-tab from outside (BroadcastScreen has no nested
  // navigator for its sub-tabs — activeMainTab is local state — so a route
  // param is the standard react-navigation way to reach in from a sibling).
  const broadcastRouteParams = useRoute<RouteProp<MainTabsParamList, 'Broadcast'>>().params;
  const routeMainTabParam = broadcastRouteParams?.mainTab;
  // actionId is a deep-link (kis:// / https://kis.app) pass-through — see
  // src/push/deepLinkRouter.ts — identifying a specific item to auto-open
  // once the matching sub-tab is active (currently: an education course).
  const routeActionId = broadcastRouteParams?.actionId;
  useFocusEffect(
    useCallback(() => {
      if (routeMainTabParam && MAIN_TAB_ORDER.includes(routeMainTabParam as BroadcastMainTabId)) {
        setActiveMainTab(routeMainTabParam as BroadcastMainTabId);
      }
    }, [routeMainTabParam]),
  );
  const [searchTerms, setSearchTerms] = useState<
    Record<BroadcastMainTabId, string>
  >({
    feeds: '',
    channels: '',
    education: '',
    market: '',
    healthcare: '',
    jobs: '',
  });
  const [filterVisible, setFilterVisible] = useState(false);
  const [visionVisible, setVisionVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [cartState, setCartState] = useState<ShopCartState>(getShopCartState());
  const [selectedFilters, setSelectedFilters] = useState<
    Record<BroadcastMainTabId, string>
  >(() =>
    (Object.keys(FILTER_OPTIONS) as BroadcastMainTabId[]).reduce((acc, key) => {
      acc[key] = FILTER_OPTIONS[key][0].key;
      return acc;
    }, {} as Record<BroadcastMainTabId, string>),
  );

  const handleFilterSelect = (optionKey: string) => {
    setSelectedFilters(prev => ({ ...prev, [activeMainTab]: optionKey }));
  };

  // ── Feed-specific filter state (lifted so the filter panel can own them) ──
  type FeedCategory = 'for_you' | 'following' | 'trending' | 'live' | 'channels' | 'community' | 'market' | 'education';
  const [feedCategory, setFeedCategory] = useState<FeedCategory>('for_you');
  const [feedSort, setFeedSort] = useState<'new' | 'top' | 'oldest'>('new');
  const [feedDatePreset, setFeedDatePreset] = useState<'today' | 'week' | 'month' | 'all'>('all');
  const [feedDuration, setFeedDuration] = useState<'short' | 'medium' | 'long' | 'any'>('any');

  const feedFiltersActive =
    feedCategory !== 'for_you' ||
    feedSort !== 'new' ||
    feedDatePreset !== 'all' ||
    feedDuration !== 'any';

  const FEED_CATEGORIES: Array<{ id: FeedCategory; label: string }> = [
    { id: 'for_you', label: 'For You' },
    { id: 'following', label: 'Following' },
    { id: 'trending', label: 'Trending' },
    { id: 'live', label: 'Live' },
    { id: 'channels', label: 'Channels' },
    { id: 'community', label: 'Community' },
    { id: 'market', label: 'Market' },
    { id: 'education', label: 'Education' },
  ];

  const switchMainTabByDirection = useCallback(
    (direction: 'next' | 'previous') => {
      const currentIndex = MAIN_TAB_ORDER.indexOf(activeMainTab);
      const nextIndex =
        direction === 'next'
          ? Math.min(MAIN_TAB_ORDER.length - 1, currentIndex + 1)
          : Math.max(0, currentIndex - 1);
      const nextTab = MAIN_TAB_ORDER[nextIndex];
      if (nextTab && nextTab !== activeMainTab) {
        setFilterVisible(false);
        setActiveMainTab(nextTab);
      }
    },
    [activeMainTab],
  );

  const tabSwipeResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_evt, gesture) => {
          const absDx = Math.abs(gesture.dx);
          const absDy = Math.abs(gesture.dy);
          return absDx < TAB_SWIPE_DISTANCE ||
            absDy > TAB_SWIPE_MAX_VERTICAL_DRIFT ||
            absDx < absDy * TAB_SWIPE_DIRECTION_RATIO
            ? false
            : true;
        },
        onMoveShouldSetPanResponder: (_evt, gesture) => {
          const absDx = Math.abs(gesture.dx);
          const absDy = Math.abs(gesture.dy);
          return (
            absDx >= TAB_SWIPE_DISTANCE &&
            absDy <= TAB_SWIPE_MAX_VERTICAL_DRIFT &&
            absDx >= absDy * TAB_SWIPE_DIRECTION_RATIO
          );
        },
        onPanResponderRelease: (_evt, gesture) => {
          if (gesture.dx <= -TAB_SWIPE_DISTANCE) {
            switchMainTabByDirection('next');
          } else if (gesture.dx >= TAB_SWIPE_DISTANCE) {
            switchMainTabByDirection('previous');
          }
        },
        onPanResponderTerminationRequest: () => true,
        onShouldBlockNativeResponder: () => false,
      }),
    [switchMainTabByDirection],
  );

  const currentFilter = selectedFilters[activeMainTab];
  const currentSearchTerm = searchTerms[activeMainTab];
  const currentFilterOption =
    FILTER_OPTIONS[activeMainTab].find(
      option => option.key === currentFilter,
    ) ?? FILTER_OPTIONS[activeMainTab][0];
  const showFilterPanel =
    filterVisible && FILTER_OPTIONS[activeMainTab]?.length > 0;
  const navigation =
    useNavigation<BottomTabNavigationProp<MainTabsParamList, 'Broadcast'>>();
  const handleCreate = useCallback(() => {
    if (activeMainTab === 'jobs') {
      // Posting a job is partner-scoped and manager-gated (PartnerRecruitmentPanel,
      // opened from partner management) — there's no generic per-user "create a
      // job profile" flow the way the other tabs have, so route to Partners instead.
      navigation.navigate('Partners');
      return;
    }
    const profileKey = PROFILE_KEY_BY_TAB[activeMainTab];
    navigation.navigate('Profile', { broadcastProfileKey: profileKey });
  }, [activeMainTab, navigation]);

  const { open: openSearchOverlay } = useSearchOverlay();
  const handleOpenSearch = useCallback(() => {
    openSearchOverlay();
  }, [openSearchOverlay]);

  const handlePullToRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      DeviceEventEmitter.emit('broadcast.refresh');
      // Keep the indicator visible briefly while listeners re-fetch feed data.
      await new Promise(resolve =>
        setTimeout(resolve, activeMainTab === 'feeds' ? 900 : 600),
      );
    } finally {
      setRefreshing(false);
    }
  }, [activeMainTab, refreshing]);

  React.useEffect(() => {
    const unsubscribe = subscribeToShopCart(setCartState);
    return () => {
      unsubscribe();
    };
  }, []);

  React.useEffect(() => {
    if (activeMainTab !== 'market') return;
    void refreshShopCartFromBackend();
  }, [activeMainTab]);

  useFocusEffect(
    useCallback(() => {
      if (activeMainTab !== 'market') {
        return () => {};
      }
      void refreshShopCartFromBackend();
      return () => {};
    }, [activeMainTab]),
  );

  // Gold header → dark icons for readability, managed via push/pop.
  useStatusBarStyle(tone, 'dark-content');

  const totalCartItems = useMemo(
    () =>
      Object.values(cartState.carts).reduce(
        (sum, cart) =>
          sum +
          cart.items.reduce(
            (inner, item) => inner + Math.max(0, item.quantity),
            0,
          ),
        0,
      ),
    [cartState.carts],
  );

  const openCartList = useCallback(() => {
    navigation.navigate('CartsList' as never);
  }, [navigation]);

  // Tablet-shell right-hand Context Panel — built from state this screen
  // already owns (feedCategory/FEED_CATEGORIES, cartState). A "Drafts /
  // Analytics" card from the reference mockup is omitted: no drafts or
  // analytics data source exists anywhere in this screen or its APIs today,
  // and inventing one would fabricate data (same principle applied to the
  // sidebar's omitted "Saved" item).
  useContextPanelContent(
    <>
      <TabletCard>
        <Text style={{ fontSize: 15, fontWeight: '800', color: palette.text }}>Browse</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          {FEED_CATEGORIES.map((cat) => {
            const active = feedCategory === cat.id;
            return (
              <Pressable
                key={cat.id}
                onPress={() => setFeedCategory(cat.id)}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 14,
                  borderRadius: 999,
                  backgroundColor: active ? palette.selectedBg : palette.surfaceElevated,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '800', color: active ? palette.selectedText : palette.subtext }}>
                  {cat.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </TabletCard>

      {totalCartItems > 0 ? (
        <TabletCard>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <KISIcon name="cart" size={18} color={palette.goldReadable} />
            <Text style={{ fontSize: 15, fontWeight: '800', color: palette.text }}>Your Cart</Text>
          </View>
          <Text style={{ fontSize: 13, fontWeight: '600', color: palette.subtext, marginTop: 6 }}>
            {totalCartItems} {totalCartItems === 1 ? 'item' : 'items'} waiting for checkout
          </Text>
          <Pressable onPress={openCartList} style={{ marginTop: 10 }}>
            <Text style={{ fontSize: 13, fontWeight: '800', color: palette.goldReadable }}>View cart ›</Text>
          </Pressable>
        </TabletCard>
      ) : null}
    </>,
  );

  // Registered with the shared Golden Section host in App.tsx instead of
  // rendering GoldHeaderShell locally — stays mounted across tab switches.
  // Fixed-height content only (no scroll-driven collapse) — see the "Fixed
  // content only" note just below for why.
  useGoldenSectionContent({
    content: (
      <>
          <View style={styles.headerHalo} />

          {/* Fixed content only — nothing here collapses or animates on
              scroll, so this section's height never changes and the Golden
              Section can never be pushed out of place or shrink away as the
              user scrolls the tab content below it. */}
          <View style={{ paddingTop: topInset }}>
            <View style={{ paddingHorizontal: responsive.pageGutter }}>
              <BroadcastHeaderBar
                title="Broadcast"
                tierLabel="Business Pro"
                onCreate={handleCreate}
                onSearch={handleOpenSearch}
                onNotifications={() => (navigation as any).navigate('ProfileNotifications')}
                hasUnreadNotifications={hasUnreadBroadcastNotifications}
              />
            </View>

            <View style={{ paddingHorizontal: responsive.pageGutter, paddingTop: 10, paddingBottom: 6 }}>
              <BroadcastMainTabs
                value={activeMainTab}
                onChange={tab => { setActiveMainTab(tab); setFilterVisible(false); }}
              />
            </View>
          </View>

          {/* Search row — Vision and Testimonials live here as compact,
              always-visible buttons next to Filter/Search, instead of the
              full-size banners that used to sit above and collapse away on
              scroll. */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: responsive.pageGutter,
            paddingBottom: showFilterPanel ? 6 : 16,
          }}>
            <View style={{ flex: 1 }}>
              <BroadcastSearchRow
                searchPlaceholder={SEARCH_PLACEHOLDERS[activeMainTab]}
                searchValue={currentSearchTerm}
                onSearchChange={next =>
                  setSearchTerms(prev => ({ ...prev, [activeMainTab]: next }))
                }
                onFilterPress={() => setFilterVisible(prev => !prev)}
                filterLabel={currentFilterOption.label}
                filterActive={filterVisible}
              />
            </View>

            <Pressable
              onPress={() => (navigation as any).navigate('TestimonyHub')}
              style={[styles.miniPill, {
                width: compactBroadcast ? 34 : 40,
                height: compactBroadcast ? 34 : 40,
                borderRadius: compactBroadcast ? 17 : 20,
                backgroundColor: palette.primaryStrong,
              }]}
              accessibilityLabel="Testimony Network"
              hitSlop={8}
            >
              <Text style={{ fontSize: compactBroadcast ? 14 : 16 }}>🤝</Text>
            </Pressable>

            <Pressable
              onPress={() => setVisionVisible(true)}
              style={[styles.miniPill, {
                width: compactBroadcast ? 34 : 40,
                height: compactBroadcast ? 34 : 40,
                borderRadius: compactBroadcast ? 17 : 20,
                backgroundColor: `${palette.royalInk}70`,
                borderColor: palette.goldBorder,
                borderWidth: 1,
              }]}
              accessibilityLabel="Our Vision"
              hitSlop={8}
            >
              <KISIcon name="sparkles" size={compactBroadcast ? 14 : 16} color={palette.onGold} />
            </Pressable>
          </View>

          {/* Filter panel — fixed height regardless of tab/content, so it
              never grows tall enough to push (or destabilize the space
              reserved for) the tab content below; everything inside
              scrolls within this fixed box instead. */}
          {showFilterPanel && (
            <View style={[styles.filterPanel, {
              height: compactBroadcast ? FILTER_PANEL_HEIGHT_COMPACT : FILTER_PANEL_HEIGHT,
              marginHorizontal: responsive.pageGutter,
              marginBottom: 12,
              padding: compactBroadcast ? 8 : 10,
            }]}>
              {activeMainTab === 'feeds' ? (
                <Animated.ScrollView showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled" style={{ flex: 1 }}>
                  <Text style={styles.filterSectionLabel}>Quick access</Text>
                  <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', paddingBottom: 12 }}>
                    {([{ label: 'Playlists', icon: 'list' as const, route: 'PlaylistList' }, { label: 'History', icon: 'play' as const, route: 'WatchHistory' }, { label: 'Shorts', icon: 'play' as const, route: 'ShortsScreen' }]).map(item => (
                      <Pressable key={item.label} onPress={() => { setFilterVisible(false); (navigation as any).navigate(item.route); }}
                        style={[styles.filterOption, { paddingHorizontal: 12, paddingVertical: 8, borderColor: palette.inputBorder, backgroundColor: palette.card }]}>
                        <KISIcon name={item.icon} size={14} color={palette.primaryStrong} />
                        <Text style={[styles.filterOptionLabel, { color: palette.text }]}>{item.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <Text style={styles.filterSectionLabel}>Category</Text>
                  <Animated.ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7, paddingBottom: 12 }}>
                    {FEED_CATEGORIES.map(cat => { const a = feedCategory === cat.id; return (
                      <Pressable key={cat.id} onPress={() => setFeedCategory(cat.id)}
                        style={[styles.filterOption, { paddingHorizontal: 14, paddingVertical: 8, borderColor: a ? palette.primaryStrong : palette.inputBorder, backgroundColor: a ? palette.primaryStrong : palette.card }]}>
                        <Text style={[styles.filterOptionLabel, { color: a ? palette.onPrimary : palette.text }]}>{cat.label}</Text>
                      </Pressable>
                    ); })}
                  </Animated.ScrollView>
                  <Text style={[styles.filterSectionLabel, { marginTop: 4 }]}>Sort by</Text>
                  <View style={{ flexDirection: 'row', gap: 7, flexWrap: 'wrap', paddingBottom: 12 }}>
                    {([{ id: 'new' as const, label: 'Newest' }, { id: 'top' as const, label: 'Top' }, { id: 'oldest' as const, label: 'Oldest' }]).map(opt => { const a = feedSort === opt.id; return (
                      <Pressable key={opt.id} onPress={() => setFeedSort(opt.id)}
                        style={[styles.filterOption, { paddingHorizontal: 14, paddingVertical: 8, borderColor: a ? palette.primaryStrong : palette.inputBorder, backgroundColor: a ? palette.primaryStrong : palette.card }]}>
                        <Text style={[styles.filterOptionLabel, { color: a ? palette.onPrimary : palette.text }]}>{opt.label}</Text>
                      </Pressable>
                    ); })}
                  </View>
                  <Text style={[styles.filterSectionLabel, { marginTop: 4 }]}>Date range</Text>
                  <View style={{ flexDirection: 'row', gap: 7, flexWrap: 'wrap', paddingBottom: 12 }}>
                    {([{ id: 'today' as const, label: 'Today' }, { id: 'week' as const, label: 'This week' }, { id: 'month' as const, label: 'This month' }, { id: 'all' as const, label: 'All time' }]).map(opt => { const a = feedDatePreset === opt.id; return (
                      <Pressable key={opt.id} onPress={() => setFeedDatePreset(opt.id)}
                        style={[styles.filterOption, { paddingHorizontal: 14, paddingVertical: 8, borderColor: a ? palette.primaryStrong : palette.inputBorder, backgroundColor: a ? palette.primaryStrong : palette.card }]}>
                        <Text style={[styles.filterOptionLabel, { color: a ? palette.onPrimary : palette.text }]}>{opt.label}</Text>
                      </Pressable>
                    ); })}
                  </View>
                  <Text style={[styles.filterSectionLabel, { marginTop: 4 }]}>Duration</Text>
                  <View style={{ flexDirection: 'row', gap: 7, flexWrap: 'wrap', paddingBottom: 8 }}>
                    {([{ id: 'short' as const, label: 'Short (<4m)' }, { id: 'medium' as const, label: 'Medium (4–20m)' }, { id: 'long' as const, label: 'Long (>20m)' }, { id: 'any' as const, label: 'Any length' }]).map(opt => { const a = feedDuration === opt.id; return (
                      <Pressable key={opt.id} onPress={() => setFeedDuration(opt.id)}
                        style={[styles.filterOption, { paddingHorizontal: 14, paddingVertical: 8, borderColor: a ? palette.primaryStrong : palette.inputBorder, backgroundColor: a ? palette.primaryStrong : palette.card }]}>
                        <Text style={[styles.filterOptionLabel, { color: a ? palette.onPrimary : palette.text }]}>{opt.label}</Text>
                      </Pressable>
                    ); })}
                  </View>
                  {feedFiltersActive && (
                    <Pressable onPress={() => { setFeedCategory('for_you'); setFeedSort('new'); setFeedDatePreset('all'); setFeedDuration('any'); }}
                      style={{ alignSelf: 'flex-start', marginTop: 4, marginBottom: 4 }}>
                      <Text style={{ color: palette.danger, fontSize: 12, fontWeight: '700', textDecorationLine: 'underline' }}>Reset all filters</Text>
                    </Pressable>
                  )}
                </Animated.ScrollView>
              ) : (
                <View style={{ flex: 1, justifyContent: 'center' }}>
                  <Animated.ScrollView horizontal showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 8, paddingRight: 4 }} keyboardShouldPersistTaps="handled">
                    {FILTER_OPTIONS[activeMainTab].map(option => (
                      <Pressable key={option.key} onPress={() => handleFilterSelect(option.key)}
                        style={[styles.filterOption, { minWidth: compactBroadcast ? 96 : 120, paddingHorizontal: compactBroadcast ? 10 : 14, paddingVertical: compactBroadcast ? 8 : 10, marginRight: 0, marginBottom: 0, borderColor: option.key === currentFilter ? palette.primary : palette.divider, backgroundColor: option.key === currentFilter ? palette.primaryStrong : palette.surface }]}>
                        <Text style={[styles.filterOptionLabel, { color: option.key === currentFilter ? palette.onPrimary : palette.text }]}>{option.label}</Text>
                        <Text style={[styles.filterOptionDescription, { color: option.key === currentFilter ? palette.onPrimary : palette.subtext }]}>{compactBroadcast ? '' : option.description}</Text>
                      </Pressable>
                    ))}
                  </Animated.ScrollView>
                </View>
              )}
            </View>
          )}
      </>
    ),
    colors: broadcastGoldGradient,
    shellStyle: styles.headerContainer,
  });

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg, }}>

      {/*
       * The gold header (header bar, tabs, search + Vision/Testimony
       * buttons) is registered via useGoldenSectionContent above and
       * rendered by the shared Golden Section host in App.tsx — fixed above
       * this ScrollView, not a scroll child, and no longer collapses or
       * resizes on scroll, so it stays visible and fixed in place
       * regardless of what this ScrollView does. Plain ScrollView now that
       * nothing here drives a Reanimated collapse.
       */}
      <ScrollView
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1, backgroundColor: palette.bg, }}
        contentContainerStyle={{ paddingBottom: compactBroadcast ? 92 : 120 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handlePullToRefresh}
            tintColor={palette.primaryStrong}
            colors={[palette.primaryStrong]}
          />
        }
      >

        {/* ═══ TAB CONTENT ════════════════════════════════════════════════════ */}
        <View
          style={{ paddingHorizontal: responsive.pageGutter }}
          {...tabSwipeResponder.panHandlers}
        >
          {activeMainTab === 'feeds' && (
            <BroadcastFeedsPage
              searchTerm={currentSearchTerm}
              searchContext={currentFilter}
              onTrendingSeeAll={() => { setFeedCategory('trending'); setFilterVisible(false); }}
              activeCategory={feedCategory}
              onCategoryChange={cat => { setFeedCategory(cat as FeedCategory); setFilterVisible(false); }}
              filterSort={feedSort}
              filterDatePreset={feedDatePreset}
              filterDuration={feedDuration}
            />
          )}
          {activeMainTab === 'channels' && <ChannelsDiscoverPage searchTerm={currentSearchTerm} searchContext={currentFilter} />}
          {activeMainTab === 'education' && <BroadcastEducationPage searchTerm={currentSearchTerm} searchContext={currentFilter} openContentId={routeActionId} />}
          {activeMainTab === 'market' && <BroadcastMarketPage searchTerm={currentSearchTerm} searchContext={currentFilter} />}
          {activeMainTab === 'healthcare' && <BroadcastHealthcarePage searchTerm={currentSearchTerm} searchContext={currentFilter} />}
          {activeMainTab === 'jobs' && <BroadcastJobsPage searchTerm={currentSearchTerm} searchContext={currentFilter} />}
        </View>

      </ScrollView>

      {/* Cart FAB (market tab only) */}
      {activeMainTab === 'market' && (
        <View pointerEvents="box-none" style={styles.cartOverlay}>
          <Pressable
            onPress={openCartList}
            style={[styles.cartButton, {
              backgroundColor: palette.primarySoft,
              borderColor: palette.primary,
              width: compactBroadcast ? 48 : 56,
              height: compactBroadcast ? 48 : 56,
              shadowColor: palette.shadow,
            }]}
          >
            <KISIcon name="cart" size={22} color={palette.primaryStrong} />
            {totalCartItems > 0 && (
              <View style={[styles.cartBadge, { backgroundColor: palette.primaryStrong }]}>
                <Text style={{ color: palette.surface, fontWeight: '800', fontSize: 11 }}>
                  {totalCartItems}
                </Text>
              </View>
            )}
          </Pressable>
        </View>
      )}

      <KcanVisionModal visible={visionVisible} onClose={() => setVisionVisible(false)} />
    </View>
  );
}

const makeStyles = (palette: ReturnType<typeof useKISTheme>['palette']) =>
  StyleSheet.create({
    // ── Sticky tabs + search section (child #2, pinned by stickyHeaderIndices)
    stickySection: {
      // Shadow so content visually slides under it when sticky
      shadowColor: '#000',
      shadowOpacity: 0.12,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
      elevation: 8,
    },
    // ── Compact Vision/Testimony buttons in the search row ─────────────────
    miniPill: {
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    // ── Header container ───────────────────────────────────────────────────
    headerContainer: {
      paddingHorizontal: 0,
      paddingTop: 0,
      paddingBottom: 0,
      backgroundColor: palette.royalInk,
      borderBottomWidth: 0,
      borderBottomColor: palette.divider,
      borderBottomLeftRadius: 24,
      borderBottomRightRadius: 24,
      overflow: 'hidden',
      shadowColor: palette.shadow,
      shadowOpacity: 0.08,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 4,
    },
    headerHalo: {
      position: 'absolute',
      top: -48,
      right: -28,
      width: 150,
      height: 150,
      borderRadius: 75,
      backgroundColor: palette.gold,
      opacity: 0.16,
    },
    filterPanel: {
      borderWidth: 1,
      borderRadius: 24,
      borderColor: palette.goldBorder,
      padding: 10,
      backgroundColor: palette.surface,
      shadowColor: palette.shadow,
      shadowOpacity: 0.09,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 10 },
    },
    filterSectionLabel: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      marginBottom: 8,
      color: palette.subtext,
    },
    filterOption: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      borderWidth: 1.5,
      borderRadius: 999,
      paddingHorizontal: 16,
      paddingVertical: 10,
      marginRight: 8,
      marginBottom: 8,
    },
    filterOptionLabel: {
      fontSize: 13,
      fontWeight: '900',
      letterSpacing: 0.1,
    },
    filterOptionDescription: {
      fontSize: 11,
      fontWeight: '600',
      marginTop: 2,
      letterSpacing: 0.05,
    },
    cartOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'flex-end',
      alignItems: 'flex-end',
      paddingRight: 16,
      paddingBottom: 24,
      zIndex: 100,
      elevation: 100,
    },
    cartButton: {
      borderWidth: 1,
      borderRadius: 999,
      width: 56,
      height: 56,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 8,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.18,
      shadowRadius: 6,
    },
    cartBadge: {
      minWidth: 24,
      position: 'absolute',
      top: -4,
      right: -4,
      paddingHorizontal: 6,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
