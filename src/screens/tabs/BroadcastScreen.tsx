import React, { useCallback, useMemo, useState } from 'react';
import {
  DeviceEventEmitter,
  PanResponder,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKISTheme } from '@/theme/useTheme';
import { KIS_ROYAL_GRADIENTS } from '@/theme/constants';
import { useStatusBarStyle } from '@/theme/useStatusBarStyle';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
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
import { KISIcon } from '@/constants/kisIcons';
import { useResponsiveLayout } from '@/theme/responsive';
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
};

const SEARCH_PLACEHOLDERS: Record<BroadcastMainTabId, string> = {
  feeds: 'Search broadcast feeds',
  channels: 'Search channels',
  education: 'Search courses & lessons',
  market: 'Search marketplace drops',
  healthcare: 'Search providers & services',
};

const PROFILE_KEY_BY_TAB: Record<BroadcastMainTabId, BroadcastProfileKey> = {
  feeds: 'broadcast_feed',
  channels: 'broadcast_feed',
  education: 'education',
  market: 'market',
  healthcare: 'health',
};

const MAIN_TAB_ORDER: BroadcastMainTabId[] = [
  'feeds',
  'channels',
  'education',
  'market',
  'healthcare',
];

const TAB_SWIPE_DISTANCE = 104;
const TAB_SWIPE_MAX_VERTICAL_DRIFT = 30;
const TAB_SWIPE_DIRECTION_RATIO = 2.5;

export default function BroadcastScreen() {
  const { palette, tone } = useKISTheme();
  const responsive = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const compactBroadcast = responsive.isWatch || responsive.isCompactPhone;
  const styles = useMemo(() => makeStyles(palette), [palette]);
  // goldHeader: gold-first so the transparent status bar shows gold, not dark.
  const broadcastGoldGradient = [...KIS_ROYAL_GRADIENTS.goldHeader];

  const [activeMainTab, setActiveMainTab] =
    useState<BroadcastMainTabId>('feeds');
  const [searchTerms, setSearchTerms] = useState<
    Record<BroadcastMainTabId, string>
  >({
    feeds: '',
    channels: '',
    education: '',
    market: '',
    healthcare: '',
  });
  const [filterVisible, setFilterVisible] = useState(false);
  const [visionVisible, setVisionVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // ── Scroll-driven animation ───────────────────────────────────────────────
  // scrollY drives collapsing the Vision + Testimony banners as the user scrolls.
  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: e => { scrollY.value = e.contentOffset.y; },
  });
  // (collapseDistance and fullHeaderHeight removed — animation uses fixed ANIM_END constant)

  // ── Animated styles ───────────────────────────────────────────────────────
  // ANIM_END = scroll distance at which the animation completes.
  // This matches the approximate natural height of the vision + testimony
  // content so animations finish just as those elements scroll off screen.
  const ANIM_END = 160;

  // Our Vision button fades + scales down as it scrolls toward the top.
  const visionAnimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [20, ANIM_END * 0.7], [1, 0], Extrapolation.CLAMP),
    transform: [
      { scale: interpolate(scrollY.value, [20, ANIM_END * 0.7], [1, 0.88], Extrapolation.CLAMP) },
      { translateY: interpolate(scrollY.value, [20, ANIM_END * 0.7], [0, -10], Extrapolation.CLAMP) },
    ],
  }));

  // Testimony banner — staggered ~10% after vision so they don't move in unison.
  const testimonyAnimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [40, ANIM_END * 0.8], [1, 0], Extrapolation.CLAMP),
    transform: [
      { scale: interpolate(scrollY.value, [40, ANIM_END * 0.8], [1, 0.88], Extrapolation.CLAMP) },
      { translateY: interpolate(scrollY.value, [40, ANIM_END * 0.8], [0, -8], Extrapolation.CLAMP) },
    ],
  }));

  // Mini testimony pill — appears in the search row as the banner scrolls off.
  // Mini pills — WRAPPER animates from width:0 → 40 so the search bar is
  // truly full-width when pills are hidden and shrinks in exact sync as they appear.
  // marginLeft starts at 0 (no gap when pill invisible) and grows to 6 with the width.
  const miniTestimonyWrapStyle = useAnimatedStyle(() => ({
    width: interpolate(scrollY.value, [ANIM_END * 0.45, ANIM_END], [0, 40], Extrapolation.CLAMP),
    marginLeft: interpolate(scrollY.value, [ANIM_END * 0.45, ANIM_END], [0, 6], Extrapolation.CLAMP),
    overflow: 'hidden' as const,
  }));
  const miniVisionWrapStyle = useAnimatedStyle(() => ({
    width: interpolate(scrollY.value, [ANIM_END * 0.55, ANIM_END], [0, 40], Extrapolation.CLAMP),
    marginLeft: interpolate(scrollY.value, [ANIM_END * 0.55, ANIM_END], [0, 6], Extrapolation.CLAMP),
    overflow: 'hidden' as const,
  }));

  // PILL CONTENT — opacity + scale for the pill itself (separate from the wrapper).
  const miniTestimonyStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [ANIM_END * 0.5, ANIM_END], [0, 1], Extrapolation.CLAMP),
    transform: [
      { scale: interpolate(scrollY.value, [ANIM_END * 0.5, ANIM_END], [0.5, 1], Extrapolation.CLAMP) },
    ],
  }));
  // Mini vision pill — staggered slightly after testimony.
  const miniVisionStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [ANIM_END * 0.6, ANIM_END], [0, 1], Extrapolation.CLAMP),
    transform: [
      { scale: interpolate(scrollY.value, [ANIM_END * 0.6, ANIM_END], [0.5, 1], Extrapolation.CLAMP) },
    ],
  }));
  // The top section (header bar + vision button) collapses to 0 height as the
  // user scrolls, leaving only the sticky tabs + search visible inside the gradient.
  const innerCollapseStyle = useAnimatedStyle(() => ({
    maxHeight: interpolate(scrollY.value, [0, ANIM_END], [999, 0], Extrapolation.CLAMP),
    overflow: 'hidden' as const,
  }));

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
    const profileKey = PROFILE_KEY_BY_TAB[activeMainTab];
    navigation.navigate('Profile', { broadcastProfileKey: profileKey });
  }, [activeMainTab, navigation]);

  const handleOpenSearch = useCallback(() => {
    (navigation as any).navigate('GlobalSearch');
  }, [navigation]);

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

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg, marginTop: 25 }}>

      {/*
       * ONE gradient — everything (header bar, vision, tabs, search) lives
       * inside a single LinearGradient with the curved bottom border.
       * stickyHeaderIndices={[0]} makes this entire gradient sticky.
       * As the user scrolls, the TOP portion (header bar + vision) collapses
       * via maxHeight animation, leaving only tabs + search visible — all
       * still inside the same curved gradient. No second header seam.
       *
       *  0  ← STICKY gradient:
       *         collapsing top (header bar + vision)
       *         always-visible bottom (tabs + search + mini pills)
       *  1  ← Testimony banner (scrolls away)
       *  2  ← Tab content
       */}
      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={1}
        stickyHeaderIndices={[0]}
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1, backgroundColor: palette.bg, marginTop: 25 }}
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

        {/* ═══ 0 — STICKY: single unified gradient header ════════════════════
            One LinearGradient owns both the collapsing top section (header
            bar + vision) and the always-visible bottom section (tabs +
            search). The curved bottom border belongs to this one element so
            there is never a visual seam between two separate headers.        */}
        <LinearGradient
          colors={broadcastGoldGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerContainer}
        >
          <View style={styles.headerHalo} />
          <View style={styles.headerSheen} pointerEvents="none" />

          {/* ── TOP: collapses via maxHeight as user scrolls ─────────────── */}
          <Animated.View style={innerCollapseStyle}>
            <Animated.View style={visionAnimStyle}>
              <View style={{
                paddingHorizontal: responsive.pageGutter,
                paddingTop: insets.top + (compactBroadcast ? 12 : 18),
                marginTop: insets.top,
              }}>
                {/* Header bar */}
                <View style={styles.headerSection}>
                  <BroadcastHeaderBar
                    title="Broadcast"
                    tierLabel="Business Pro"
                    onCreate={handleCreate}
                    onSearch={handleOpenSearch}
                  />
                </View>

                {/* Our Vision button */}
                <View style={styles.headerSection}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setVisionVisible(true)}
                    hitSlop={10}
                    style={[styles.visionButton, {
                      paddingHorizontal: compactBroadcast ? 10 : 14,
                      paddingVertical: compactBroadcast ? 9 : 12,
                      borderRadius: compactBroadcast ? 16 : 20,
                    }]}
                  >
                    <View style={styles.visionIcon}>
                      <KISIcon name="sparkles" size={15} color={palette.onGold} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.visionButtonTitle}>Our Vision</Text>
                      <Text style={styles.visionButtonText} numberOfLines={2}>
                        {compactBroadcast
                          ? 'KCAN purpose and direction.'
                          : 'Discover why KCAN exists and where Kingdom Impact Social is going.'}
                      </Text>
                    </View>
                    <KISIcon name="chevron-right" size={18} color={palette.onGold} />
                  </Pressable>
                </View>
              </View>
            </Animated.View>
          </Animated.View>

          {/* ── BOTTOM: always visible — tabs + search + mini pills ───────── */}
          <View style={{ paddingHorizontal: responsive.pageGutter, paddingTop: 8, paddingBottom: 6 }}>
            <BroadcastMainTabs
              value={activeMainTab}
              onChange={tab => { setActiveMainTab(tab); setFilterVisible(false); }}
            />
          </View>

          {/* Search row — no gap here; each pill wrapper carries its own animated marginLeft
              so the search bar is full-width when pills are hidden and shrinks in sync
              as they slide in.                                                          */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
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

            {/* Mini Testimony pill — wrapper expands from 0 → 40px pushing search bar left */}
            <Animated.View style={miniTestimonyWrapStyle}>
              <Animated.View style={miniTestimonyStyle}>
                <Pressable
                  onPress={() => (navigation as any).navigate('TestimonyHub')}
                  style={[styles.miniPill, { backgroundColor: palette.primaryStrong }]}
                  accessibilityLabel="Testimony Network"
                  hitSlop={8}
                >
                  <Text style={{ fontSize: compactBroadcast ? 14 : 16 }}>🤝</Text>
                </Pressable>
              </Animated.View>
            </Animated.View>

            {/* Mini Vision pill — staggered, same expanding wrapper */}
            <Animated.View style={miniVisionWrapStyle}>
              <Animated.View style={miniVisionStyle}>
                <Pressable
                  onPress={() => setVisionVisible(true)}
                  style={[styles.miniPill, {
                    backgroundColor: `${palette.royalInk}70`,
                    borderColor: palette.goldBorder,
                    borderWidth: 1,
                  }]}
                  accessibilityLabel="Our Vision"
                  hitSlop={8}
                >
                  <KISIcon name="sparkles" size={compactBroadcast ? 14 : 16} color={palette.onGold} />
                </Pressable>
              </Animated.View>
            </Animated.View>
          </View>

          {/* Filter panel */}
          {showFilterPanel && (
            <View style={[styles.filterPanel, {
              marginHorizontal: responsive.pageGutter,
              marginBottom: 12,
              padding: compactBroadcast ? 8 : 10,
            }]}>
              {activeMainTab === 'feeds' ? (
                <Animated.ScrollView showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled" style={{ maxHeight: 300 }}>
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
              )}
            </View>
          )}
        </LinearGradient>

        {/* ═══ 1 — TESTIMONY BANNER (scrolls away) ═══════════════════════════ */}
        <Animated.View style={[testimonyAnimStyle, { marginTop: 12 }]}>
          <Pressable
            onPress={() => (navigation as any).navigate('TestimonyHub')}
            style={[styles.testimonyBanner, { backgroundColor: palette.primaryStrong }]}
          >
            <Text style={{ fontSize: 20 }}>🤝</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: palette.onPrimary, fontWeight: '900', fontSize: 15 }}>Testimony Network</Text>
              <Text style={{ color: palette.onPrimary, fontSize: 12, opacity: 0.85 }}>Real people. Real stories. Real help.</Text>
            </View>
            <KISIcon name="arrow-left" size={16} color={palette.onPrimary} style={{ transform: [{ rotate: '180deg' }] }} />
          </Pressable>
        </Animated.View>

        {/* ═══ 2 — TAB CONTENT ════════════════════════════════════════════════ */}
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
          {activeMainTab === 'education' && <BroadcastEducationPage searchTerm={currentSearchTerm} searchContext={currentFilter} />}
          {activeMainTab === 'market' && <BroadcastMarketPage searchTerm={currentSearchTerm} searchContext={currentFilter} />}
          {activeMainTab === 'healthcare' && <BroadcastHealthcarePage searchTerm={currentSearchTerm} searchContext={currentFilter} />}
        </View>

      </Animated.ScrollView>

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
    // ── Testimony banner (full-size, scrollable) ───────────────────────────
    testimonyBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderRadius: 16,
      padding: 16,
      marginHorizontal: 16,
      marginBottom: 12,
    },
    // ── Mini pills (appear in search row when collapsed) ────────────────────
    miniPillWrap: {
      // Overflow hidden so during scale-in the pill doesn't bleed outside bounds
      overflow: 'hidden',
    },
    miniPill: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
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
    headerSheen: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 2,
      backgroundColor: palette.goldHighlight,
      opacity: 0.45,
    },
    headerInner: {
      paddingHorizontal: 12,
      paddingTop: 12,
      paddingBottom: 22,
    },
    headerSection: {
      marginBottom: 12,
    },
    visionButton: {
      marginTop: 12,
      borderRadius: 22,
      paddingHorizontal: 14,
      paddingVertical: 14,
      // Semi-transparent royalInk overlay on the gold gradient header
      backgroundColor: `${palette.royalInk}4D`,
      opacity: 0.92,
      borderWidth: 1,
      borderColor: palette.goldBorder,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    visionIcon: {
      width: 40,
      height: 40,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      // Semi-transparent gold overlay on the gold gradient header
      backgroundColor: `${palette.ivory}2E`,
      borderWidth: 1,
      borderColor: palette.goldBorder,
    },
    visionButtonTitle: {
      color: palette.onGold,
      fontSize: 15,
      fontWeight: '900',
      letterSpacing: 0.2,
    },
    visionButtonText: {
      color: palette.onGold,
      fontSize: 12,
      lineHeight: 18,
      fontWeight: '700',
      marginTop: 3,
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
